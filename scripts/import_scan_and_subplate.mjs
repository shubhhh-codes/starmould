import fs from 'fs';
import readline from 'readline';
import pg from 'pg';

const envContent = fs.readFileSync('D:/Repo/starmould/.env.local', 'utf8');
let databaseUrl = '';
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('DATABASE_URL=')) {
    databaseUrl = trimmed.substring('DATABASE_URL='.length).trim();
    if ((databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) ||
        (databaseUrl.startsWith("'") && databaseUrl.endsWith("'"))) {
      databaseUrl = databaseUrl.slice(1, -1);
    }
    break;
  }
}

function parseSqlValues(line, prefix) {
  if (!line.startsWith(prefix)) {
    throw new Error(`Line does not start with ${prefix}`);
  }

  const content = line.slice(prefix.length);
  const rows = [];
  let i = 0;
  const len = content.length;

  while (i < len) {
    while (i < len && content[i] !== '(') {
      i++;
    }
    if (i >= len) break;
    i++; // skip '('

    const currentRow = [];
    let currentVal = '';
    let inQuotes = false;
    let quoteChar = '';
    let isEscaped = false;

    while (i < len) {
      const ch = content[i];

      if (inQuotes) {
        if (isEscaped) {
          if (ch === 'n') currentVal += '\n';
          else if (ch === 'r') currentVal += '\r';
          else if (ch === 't') currentVal += '\t';
          else if (ch === '0') currentVal += '\0';
          else currentVal += ch;
          isEscaped = false;
        } else if (ch === '\\') {
          isEscaped = true;
        } else if (ch === quoteChar) {
          inQuotes = false;
        } else {
          currentVal += ch;
        }
      } else {
        if (ch === "'" || ch === '"') {
          inQuotes = true;
          quoteChar = ch;
        } else if (ch === ',') {
          const trimmed = currentVal.trim();
          currentRow.push(trimmed === 'NULL' ? null : currentVal);
          currentVal = '';
        } else if (ch === ')') {
          const trimmed = currentVal.trim();
          currentRow.push(trimmed === 'NULL' ? null : currentVal);
          currentVal = '';
          rows.push(currentRow);
          i++; // skip ')'
          break;
        } else {
          currentVal += ch;
        }
      }
      i++;
    }
  }

  return rows;
}

function inferPlateCategory(platename) {
  if (!platename) return 'General Component';
  const p = platename.toLowerCase();
  if (/(core|cavity|kvt|insert|injetor|injector|forming|punch|parting|plug|cutting|blade|trimming)/i.test(p)) {
    return 'Core & Cavity Inserts';
  }
  if (/(top|bottom|bottam|clamp|base|hotpress|press|spacer|bolster|support|mount|heater)/i.test(p)) {
    return 'Base & Clamping Plates';
  }
  if (/(eject|ejection|pusher|return|knockout)/i.test(p)) {
    return 'Ejection System';
  }
  if (/(slide|lifter|wedge|heel|cam)/i.test(p)) {
    return 'Slides & Lifters';
  }
  if (/(guide|pillar|bush|dowel|interlock|wear|locating|lock|shaft|saft|kayda)/i.test(p)) {
    return 'Guiding & Alignment';
  }
  return 'General Component';
}

async function main() {
  console.log('Connecting to PostgreSQL database...');
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('[OK] Connected to database.');

  const dumpPath = 'C:/Users/Design-2/Downloads/sm_prod_080723_--24-09-2026_1300.sql';
  console.log(`Reading SQL dump from: ${dumpPath}`);

  const fileStream = fs.createReadStream(dumpPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const scanRows = [];
  const subplateRows = [];

  for await (const line of rl) {
    if (line.startsWith('INSERT INTO `scan` VALUES ')) {
      const parsed = parseSqlValues(line, 'INSERT INTO `scan` VALUES ');
      scanRows.push(...parsed);
    } else if (line.startsWith('INSERT INTO `subplate` VALUES ')) {
      const parsed = parseSqlValues(line, 'INSERT INTO `subplate` VALUES ');
      subplateRows.push(...parsed);
    }
  }

  console.log(`Parsed ${scanRows.length} scan rows and ${subplateRows.length} subplate rows.`);

  // 1. Process Scan Rows
  // Supabase scan columns:
  // id, rdate, cdate, dispatchdate, cname, description, note, scan_by, qc_by, modeldesign_by, mail_done, worktype, scan_hr, model_hr, sr_scanhr, sr_modelhr, status, projectid, subnote, created_at, created_by, updated_at, updated_by
  console.log('Inserting scan rows into public.scan...');
  
  // Clean / prepare scan batches
  const scanCols = [
    'id', 'rdate', 'cdate', 'dispatchdate', 'cname', 'description', 'note',
    'scan_by', 'qc_by', 'modeldesign_by', 'mail_done', 'worktype',
    'scan_hr', 'model_hr', 'sr_scanhr', 'sr_modelhr', 'status',
    'projectid', 'subnote', 'created_at', 'created_by', 'updated_at', 'updated_by'
  ];

  // Helper for batch inserting
  const BATCH_SIZE = 250;
  for (let i = 0; i < scanRows.length; i += BATCH_SIZE) {
    const batch = scanRows.slice(i, i + BATCH_SIZE);
    const valuePlaceholders = [];
    const values = [];
    let pIdx = 1;

    for (const r of batch) {
      // Map MySQL scan row to Postgres
      // r indices:
      // 0: id, 1: rdate, 2: cdate, 3: dispatchdate, 4: cname, 5: description, 6: note,
      // 7: scan_by, 8: qc_by, 9: modeldesign_by, 10: payment (skip), 11: mail_done, 12: worktype,
      // 13: scan_hr, 14: model_hr, 15: sr_scanhr, 16: sr_modelhr, 17: amount (skip),
      // 18: status, 19: projectid, 20: subnote, 21: created_at, 22: created_by, 23: updated_at, 24: updated_by
      const rowVals = [
        Number(r[0]), // id
        r[1] || null, // rdate
        r[2] || null, // cdate
        r[3] || null, // dispatchdate
        r[4],         // cname
        r[5] || '',   // description
        r[6] || null, // note
        r[7] !== null ? Number(r[7]) : null, // scan_by
        r[8] !== null ? Number(r[8]) : null, // qc_by
        r[9] !== null ? Number(r[9]) : null, // modeldesign_by
        r[11] !== null ? Number(r[11]) : 0,  // mail_done
        r[12] || null, // worktype
        r[13] !== null ? Number(r[13]) : 0,  // scan_hr
        r[14] !== null ? Number(r[14]) : 0,  // model_hr
        r[15] !== null ? Number(r[15]) : 0,  // sr_scanhr
        r[16] !== null ? Number(r[16]) : 0,  // sr_modelhr
        r[18] || 'pending', // status
        r[19] || null, // projectid
        r[20] || null, // subnote
        r[21] || null, // created_at
        r[22] !== null ? Number(r[22]) : null, // created_by
        r[23] || null, // updated_at
        r[24] !== null ? Number(r[24]) : null  // updated_by
      ];

      const placeholders = rowVals.map(() => `$${pIdx++}`);
      valuePlaceholders.push(`(${placeholders.join(', ')})`);
      values.push(...rowVals);
    }

    const sql = `
      INSERT INTO public.scan (${scanCols.join(', ')})
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (id) DO UPDATE SET
        rdate = EXCLUDED.rdate,
        cdate = EXCLUDED.cdate,
        dispatchdate = EXCLUDED.dispatchdate,
        cname = EXCLUDED.cname,
        description = EXCLUDED.description,
        note = EXCLUDED.note,
        scan_by = EXCLUDED.scan_by,
        qc_by = EXCLUDED.qc_by,
        modeldesign_by = EXCLUDED.modeldesign_by,
        mail_done = EXCLUDED.mail_done,
        worktype = EXCLUDED.worktype,
        scan_hr = EXCLUDED.scan_hr,
        model_hr = EXCLUDED.model_hr,
        sr_scanhr = EXCLUDED.sr_scanhr,
        sr_modelhr = EXCLUDED.sr_modelhr,
        status = EXCLUDED.status,
        projectid = EXCLUDED.projectid,
        subnote = EXCLUDED.subnote,
        created_at = EXCLUDED.created_at,
        created_by = EXCLUDED.created_by,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by
    `;
    await client.query(sql, values);
    process.stdout.write(`  Scan rows inserted: ${Math.min(i + BATCH_SIZE, scanRows.length)} / ${scanRows.length}\r`);
  }
  console.log(`\n[OK] Scan table import completed: ${scanRows.length} rows.`);

  // Update scan sequence
  await client.query("SELECT setval('scan_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.scan))");

  // Create lookup map of scan id -> projectid
  const scanLookupById = new Map();
  const scanLookupByCode = new Map();
  for (const s of scanRows) {
    const id = Number(s[0]);
    const code = s[19]; // projectid string
    scanLookupById.set(id, code);
    if (code) {
      scanLookupByCode.set(code.toLowerCase(), id);
    }
  }

  // 2. Process Subplate Rows & Linking
  console.log('Inserting subplate rows into public.subplate with mold links...');
  const subCols = [
    'id', 'platename', 'projectid', 'subprojectid',
    'mold_id', 'mold_code', 'plate_category',
    'shape', 'width', 'height', 'length', 'weight', 'unit', 'material', 'sqty',
    'photo', 'design_by', 'order_by', 'received_workby', 'received_qcby',
    'vmc_workby', 'vmc_qcby', 'drilltap_workby', 'final_qcby', 'packing_workby',
    'packing_photo', 'location', 'created_at', 'updated_at', 'deleted_at'
  ];

  for (let i = 0; i < subplateRows.length; i += BATCH_SIZE) {
    const batch = subplateRows.slice(i, i + BATCH_SIZE);
    const valuePlaceholders = [];
    const values = [];
    let pIdx = 1;

    for (const r of batch) {
      const id = Number(r[0]);
      const platename = r[1] || '';
      const rawProjectId = r[2] || '';
      const subprojectid = r[3] || null;

      // Link mold_id and mold_code:
      let mold_id = null;
      let mold_code = null;

      // Rule 1: Check if rawProjectId is numeric scan id
      if (/^\d+$/.test(rawProjectId)) {
        const numId = Number(rawProjectId);
        if (scanLookupById.has(numId)) {
          mold_id = numId;
          mold_code = scanLookupById.get(numId);
        } else {
          mold_id = numId;
        }
      }

      // Rule 2: If mold_code still not found, check exact string match
      if (!mold_code && scanLookupByCode.has(rawProjectId.toLowerCase())) {
        mold_id = scanLookupByCode.get(rawProjectId.toLowerCase());
        mold_code = scanLookupById.get(mold_id);
      }

      // Rule 3: Extract mold_code prefix from subprojectid (e.g. 0002_SSB_001_001 -> 0002_SSB_001)
      if (!mold_code && subprojectid) {
        const parts = subprojectid.split('_');
        if (parts.length >= 4) {
          const extractedCode = parts.slice(0, 3).join('_');
          if (scanLookupByCode.has(extractedCode.toLowerCase())) {
            mold_id = scanLookupByCode.get(extractedCode.toLowerCase());
            mold_code = scanLookupById.get(mold_id);
          } else {
            mold_code = extractedCode;
          }
        }
      }

      // Plate category
      const plate_category = inferPlateCategory(platename);

      // Numeric parsing helpers
      const numOrNull = (val) => (val !== null && val !== undefined && val !== '' ? Number(val) : null);
      const strOrNull = (val) => (val !== null && val !== undefined && val !== '' ? val : null);

      const rowVals = [
        id,                                      // id
        platename,                               // platename
        rawProjectId,                            // projectid
        subprojectid,                            // subprojectid
        mold_id,                                 // mold_id
        mold_code,                               // mold_code
        plate_category,                          // plate_category
        strOrNull(r[4]),                         // shape
        numOrNull(r[5]),                         // width
        numOrNull(r[6]),                         // height
        numOrNull(r[7]),                         // length
        numOrNull(r[8]),                         // weight
        strOrNull(r[9]),                         // unit
        strOrNull(r[10]),                        // material
        Number(r[11]) || 1,                      // sqty
        strOrNull(r[12]),                        // photo
        numOrNull(r[13]),                        // design_by
        numOrNull(r[14]),                        // order_by
        numOrNull(r[15]),                        // received_workby
        numOrNull(r[16]),                        // received_qcby
        numOrNull(r[17]),                        // vmc_workby
        numOrNull(r[18]),                        // vmc_qcby
        numOrNull(r[19]),                        // drilltap_workby
        numOrNull(r[20]),                        // final_qcby
        numOrNull(r[21]),                        // packing_workby
        strOrNull(r[22]),                        // packing_photo
        r[23] || 'SM',                           // location
        r[24] || null,                           // created_at
        r[25] || null,                           // updated_at
        r[26] || null                            // deleted_at
      ];

      const placeholders = rowVals.map(() => `$${pIdx++}`);
      valuePlaceholders.push(`(${placeholders.join(', ')})`);
      values.push(...rowVals);
    }

    const sql = `
      INSERT INTO public.subplate (${subCols.join(', ')})
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (id) DO UPDATE SET
        platename = EXCLUDED.platename,
        projectid = EXCLUDED.projectid,
        subprojectid = EXCLUDED.subprojectid,
        mold_id = EXCLUDED.mold_id,
        mold_code = EXCLUDED.mold_code,
        plate_category = EXCLUDED.plate_category,
        shape = EXCLUDED.shape,
        width = EXCLUDED.width,
        height = EXCLUDED.height,
        length = EXCLUDED.length,
        weight = EXCLUDED.weight,
        unit = EXCLUDED.unit,
        material = EXCLUDED.material,
        sqty = EXCLUDED.sqty,
        photo = EXCLUDED.photo,
        design_by = EXCLUDED.design_by,
        order_by = EXCLUDED.order_by,
        received_workby = EXCLUDED.received_workby,
        received_qcby = EXCLUDED.received_qcby,
        vmc_workby = EXCLUDED.vmc_workby,
        vmc_qcby = EXCLUDED.vmc_qcby,
        drilltap_workby = EXCLUDED.drilltap_workby,
        final_qcby = EXCLUDED.final_qcby,
        packing_workby = EXCLUDED.packing_workby,
        packing_photo = EXCLUDED.packing_photo,
        location = EXCLUDED.location,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        deleted_at = EXCLUDED.deleted_at
    `;
    await client.query(sql, values);
    process.stdout.write(`  Subplate rows inserted: ${Math.min(i + BATCH_SIZE, subplateRows.length)} / ${subplateRows.length}\r`);
  }
  console.log(`\n[OK] Subplate table import completed: ${subplateRows.length} rows.`);

  // Update subplate sequence
  await client.query("SELECT setval('subplate_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.subplate))");

  // Post-import Verification
  console.log('\n--- VERIFICATION ---');
  const scanCount = await client.query('SELECT count(*) FROM public.scan');
  const subCount = await client.query('SELECT count(*) FROM public.subplate');
  const linkedCount = await client.query('SELECT count(*) FROM public.subplate WHERE mold_id IS NOT NULL');
  const categoryCounts = await client.query('SELECT plate_category, count(*) FROM public.subplate GROUP BY plate_category ORDER BY count(*) DESC');

  console.log(`Total public.scan rows: ${scanCount.rows[0].count}`);
  console.log(`Total public.subplate rows: ${subCount.rows[0].count}`);
  console.log(`Subplates linked with mold_id: ${linkedCount.rows[0].count}`);
  console.log('Category distribution:');
  console.table(categoryCounts.rows);

  await client.end();
  console.log('\n[SUCCESS] All operations completed!');
}

main().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
