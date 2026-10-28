import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlDumpPath = 'C:/Users/Design-2/Downloads/sm_prod_080723_--24-09-2026_1300.sql';
if (!fs.existsSync(sqlDumpPath)) {
  console.error(`[ERROR] SQL dump not found at: ${sqlDumpPath}`);
  process.exit(1);
}

const rl = readline.createInterface({
  input: fs.createReadStream(sqlDumpPath),
  crlfDelay: Infinity,
});

function parseSqlValues(line, prefix) {
  const content = line.slice(prefix.length).trim();
  const rows = [];
  let inString = false, escapeNext = false, currentField = '', currentRow = [];
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (escapeNext) { currentField += ch; escapeNext = false; continue; }
    if (ch === '\\') { escapeNext = true; continue; }
    if (ch === "'") { inString = !inString; continue; }
    if (inString) { currentField += ch; continue; }
    if (ch === '(') { currentRow = []; currentField = ''; continue; }
    if (ch === ',' && !inString) { currentRow.push(currentField.trim() === 'NULL' ? null : currentField); currentField = ''; continue; }
    if (ch === ')') { currentRow.push(currentField.trim() === 'NULL' ? null : currentField); rows.push(currentRow); currentRow = []; currentField = ''; continue; }
    currentField += ch;
  }
  return rows;
}

// Canonical normalizer to merge casing & standard phonetic workshop spelling typos
export function canonicalizePlateName(raw) {
  if (!raw) return '';
  let s = raw.trim();
  s = s.replace(/\bbottam\b/gi, 'Bottom');
  s = s.replace(/\bbottm\b/gi, 'Bottom');
  s = s.replace(/\binjetor\b/gi, 'Injector');
  s = s.replace(/\bkvt\b/gi, 'KVT');
  s = s.replace(/\bms\b/gi, 'MS');
  s = s.replace(/\bp20\b/gi, 'P20');
  s = s.replace(/\ben8\b/gi, 'EN8');
  s = s.replace(/\bd2\b/gi, 'D2');
  s = s.replace(/\bguid\b/gi, 'Guide');
  s = s.replace(/\bpilar\b/gi, 'Pillar');
  s = s.replace(/\bclmp\b/gi, 'Clamp');
  s = s.replace(/\bsqur\b/gi, 'Square');
  s = s.replace(/\bsqure\b/gi, 'Square');

  const words = s.split(/\s+/).map((w) => {
    const upper = w.toUpperCase();
    if (['MS', 'KVT', 'D2', 'EN8', 'SS', 'C45', 'WPS', 'OD', 'ID'].includes(upper)) {
      return upper;
    }
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });

  return words.join(' ');
}

const mouldBaskets = new Map(); // projKey -> Set of canonical plates
const plateFrequency = new Map(); // canonName -> count
const plateCategoryMap = new Map(); // canonName -> primary category

function inferCategory(platename) {
  const p = platename.toLowerCase();
  if (/(core|cavity|kvt|insert|injector|forming|punch|parting|plug|cutting|blade|trimming)/i.test(p)) {
    return 'Core & Cavity Inserts';
  }
  if (/(top|bottom|clamp|base|hotpress|press|spacer|bolster|support|mount|heater)/i.test(p)) {
    return 'Base & Clamping Plates';
  }
  if (/(eject|ejection|pusher|return|knockout)/i.test(p)) {
    return 'Ejection System';
  }
  if (/(slide|lifter|wedge|heel|cam)/i.test(p)) {
    return 'Slides & Lifters';
  }
  if (/(guide|pillar|bush|dowel|interlock|wear|locating|lock|shaft|kayda)/i.test(p)) {
    return 'Guiding & Alignment';
  }
  return 'General Component';
}

console.log('Compiling co-occurrence graph from SQL dump...');

rl.on('line', (line) => {
  if (line.startsWith('INSERT INTO `subplate` VALUES ')) {
    const rows = parseSqlValues(line, 'INSERT INTO `subplate` VALUES ');
    for (const r of rows) {
      const rawPlate = r[1];
      const rawProj = r[2];
      if (!rawPlate || !rawPlate.trim()) continue;

      const canon = canonicalizePlateName(rawPlate);
      const proj = rawProj ? rawProj.trim() : 'UNKNOWN';

      plateFrequency.set(canon, (plateFrequency.get(canon) || 0) + 1);

      if (!plateCategoryMap.has(canon)) {
        plateCategoryMap.set(canon, inferCategory(canon));
      }

      if (!mouldBaskets.has(proj)) {
        mouldBaskets.set(proj, new Set());
      }
      mouldBaskets.get(proj).add(canon);
    }
  }
});

rl.on('close', () => {
  const totalBaskets = mouldBaskets.size;
  console.log(`Parsed ${totalBaskets} mould baskets and ${plateFrequency.size} distinct canonical plates.`);

  // 1. Build pairwise co-occurrence adjacency map: PlateA -> { PlateB: count }
  const adjacency = {};
  // Track pair counts
  for (const [proj, plateSet] of mouldBaskets.entries()) {
    const plates = Array.from(plateSet);
    if (plates.length < 2) continue;

    for (let i = 0; i < plates.length; i++) {
      const p1 = plates[i];
      if (!adjacency[p1]) adjacency[p1] = {};

      for (let j = 0; j < plates.length; j++) {
        if (i === j) continue;
        const p2 = plates[j];
        adjacency[p1][p2] = (adjacency[p1][p2] || 0) + 1;
      }
    }
  }

  // 2. Build pre-computed sparse companion affinity graph
  // For each plate, compute top companions with Confidence and Lift
  const companionGraph = {};

  for (const [p1, companions] of Object.entries(adjacency)) {
    const countA = plateFrequency.get(p1) || 1;
    const ranked = [];

    for (const [p2, jointCount] of Object.entries(companions)) {
      if (jointCount < 2) continue; // Filter 1-off noise
      const countB = plateFrequency.get(p2) || 1;

      // Association metrics:
      const confidence = Number((jointCount / countA).toFixed(3)); // P(B | A)
      const supportB = countB / totalBaskets;
      const lift = Number((confidence / supportB).toFixed(2)); // Lift(A -> B)

      ranked.push({
        plate: p2,
        jointCount,
        confidence: Math.round(confidence * 100), // Pct
        lift,
        category: plateCategoryMap.get(p2) || 'General Component',
      });
    }

    // Sort by jointCount descending, then lift
    ranked.sort((a, b) => b.jointCount - a.jointCount || b.lift - a.lift);

    if (ranked.length > 0) {
      companionGraph[p1] = ranked.slice(0, 8); // Top 8 companion partners
    }
  }

  // 3. Filter canonical index to high-confidence plates (N >= 2)
  const canonicalIndex = [];
  for (const [name, count] of plateFrequency.entries()) {
    if (count >= 2) {
      canonicalIndex.push({
        name,
        count,
        category: plateCategoryMap.get(name) || 'General Component',
      });
    }
  }
  canonicalIndex.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  // Write output files
  const dataDir = path.join(__dirname, '..', 'src', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const graphPath = path.join(dataDir, 'plate-cooccurrence-graph.json');
  const indexPath = path.join(dataDir, 'plate-canonical-index.json');

  fs.writeFileSync(graphPath, JSON.stringify(companionGraph, null, 2), 'utf8');
  fs.writeFileSync(indexPath, JSON.stringify(canonicalIndex, null, 2), 'utf8');

  console.log(`[SUCCESS] Generated co-occurrence graph (${Object.keys(companionGraph).length} anchors) at: ${graphPath}`);
  console.log(`[SUCCESS] Generated canonical plate index (${canonicalIndex.length} high-confidence plates) at: ${indexPath}`);
});
