import cooccurrenceData from "@/data/plate-cooccurrence-graph.json";
import canonicalIndexData from "@/data/plate-canonical-index.json";
import { harmonizeSuggestionCase, GhostSuggestionResult } from "@/lib/mould-autocomplete";

export interface CompanionRecommendation {
  name: string;
  confidence: number;
  jointCount: number;
  category: string;
  sourcePlateName?: string;
  mirroredSpecs?: {
    length?: string | number;
    width?: string | number;
    material?: string;
    shape?: string;
  };
}

interface GraphCompanionItem {
  plate: string;
  jointCount: number;
  confidence: number;
  lift: number;
  category: string;
}

const staticGraph: Record<string, GraphCompanionItem[]> = cooccurrenceData as Record<
  string,
  GraphCompanionItem[]
>;
const staticIndex: { name: string; count: number; category: string }[] = canonicalIndexData as any;

// Runtime in-memory adjacency updates for dynamic self-learning
const runtimeDynamicGraph = new Map<string, Map<string, number>>();

/**
 * Canonicalizes raw plate name for graph lookups (merges casing and workshop phonetic typos)
 */
export function canonicalizePlateName(raw?: string): string {
  if (!raw) return "";
  let s = raw.trim();
  s = s.replace(/\bbottam\b/gi, "Bottom");
  s = s.replace(/\bbottm\b/gi, "Bottom");
  s = s.replace(/\binjetor\b/gi, "Injector");
  s = s.replace(/\bkvt\b/gi, "KVT");
  s = s.replace(/\bms\b/gi, "MS");
  s = s.replace(/\bp20\b/gi, "P20");
  s = s.replace(/\ben8\b/gi, "EN8");
  s = s.replace(/\bd2\b/gi, "D2");
  s = s.replace(/\bguid\b/gi, "Guide");
  s = s.replace(/\bpilar\b/gi, "Pillar");
  s = s.replace(/\bclmp\b/gi, "Clamp");
  s = s.replace(/\bsqur\b/gi, "Square");
  s = s.replace(/\bsqure\b/gi, "Square");

  const words = s.split(/\s+/).map((w) => {
    const upper = w.toUpperCase();
    if (["MS", "KVT", "D2", "EN8", "SS", "C45", "WPS", "OD", "ID"].includes(upper)) {
      return upper;
    }
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });

  return words.join(" ");
}

/**
 * Dynamically learn and strengthen co-occurrence between two plates created together in a mould.
 */
export function learnSubplatePair(plateA: string, plateB: string) {
  const cA = canonicalizePlateName(plateA);
  const cB = canonicalizePlateName(plateB);
  if (!cA || !cB || cA.toLowerCase() === cB.toLowerCase()) return;

  if (!runtimeDynamicGraph.has(cA)) runtimeDynamicGraph.set(cA, new Map());
  if (!runtimeDynamicGraph.has(cB)) runtimeDynamicGraph.set(cB, new Map());

  const mapA = runtimeDynamicGraph.get(cA)!;
  mapA.set(cB, (mapA.get(cB) || 0) + 1);

  const mapB = runtimeDynamicGraph.get(cB)!;
  mapB.set(cA, (mapB.get(cA) || 0) + 1);
}

export interface ExistingPlateContext {
  platename?: string;
  length?: string | number | null;
  width?: string | number | null;
  height?: string | number | null;
  material?: string | null;
  shape?: string | null;
}

/**
 * Given existing plates already present in the target mould, returns top companion plate recommendations.
 * e.g., if "Hotpress Top" is already added, recommends "Hotpress Bottom" with matching Length/Width/Material.
 */
export function getRecommendedCompanionPlates(
  existingPlates: ExistingPlateContext[],
  limit = 4
): CompanionRecommendation[] {
  if (!existingPlates || existingPlates.length === 0) {
    // If mould is empty, recommend top universal base plates
    return [
      { name: "Top Clamping Plate", confidence: 95, jointCount: 150, category: "Base & Clamping Plates" },
      { name: "Bottom Clamping Plate", confidence: 90, jointCount: 140, category: "Base & Clamping Plates" },
      { name: "Cavity Plate (A-Side)", confidence: 85, jointCount: 120, category: "Core & Cavity Inserts" },
      { name: "Core Insert Set", confidence: 80, jointCount: 110, category: "Core & Cavity Inserts" },
    ].slice(0, limit);
  }

  // Canonicalize existing plate names & track already added plates
  const existingCanonicalSet = new Set<string>();
  const specMap = new Map<string, ExistingPlateContext>();

  for (const ep of existingPlates) {
    if (!ep.platename) continue;
    const cName = canonicalizePlateName(ep.platename);
    existingCanonicalSet.add(cName.toLowerCase());
    specMap.set(cName.toLowerCase(), ep);
  }

  // Candidate aggregation map: candidateName -> aggregated score & metadata
  const candidateMap = new Map<
    string,
    {
      score: number;
      maxConfidence: number;
      jointCount: number;
      category: string;
      sourcePlate: ExistingPlateContext | null;
    }
  >();

  for (const ep of existingPlates) {
    if (!ep.platename) continue;
    const canonA = canonicalizePlateName(ep.platename);

    // Look up static graph
    const staticCompanions = staticGraph[canonA] || [];
    for (const item of staticCompanions) {
      const lowerCandidate = item.plate.toLowerCase();
      if (existingCanonicalSet.has(lowerCandidate)) continue;

      const current = candidateMap.get(item.plate) || {
        score: 0,
        maxConfidence: 0,
        jointCount: 0,
        category: item.category,
        sourcePlate: ep,
      };

      current.score += item.jointCount * (item.lift || 1);
      current.maxConfidence = Math.max(current.maxConfidence, item.confidence);
      current.jointCount += item.jointCount;
      if (!current.sourcePlate) current.sourcePlate = ep;

      candidateMap.set(item.plate, current);
    }

    // Look up runtime dynamic learned graph
    const dynamicCompanions = runtimeDynamicGraph.get(canonA);
    if (dynamicCompanions) {
      for (const [candName, dynamicWeight] of dynamicCompanions.entries()) {
        const lowerCandidate = candName.toLowerCase();
        if (existingCanonicalSet.has(lowerCandidate)) continue;

        const current = candidateMap.get(candName) || {
          score: 0,
          maxConfidence: 50,
          jointCount: 0,
          category: "General Component",
          sourcePlate: ep,
        };

        current.score += dynamicWeight * 20;
        current.jointCount += dynamicWeight;
        candidateMap.set(candName, current);
      }
    }
  }

  // Sort candidates by score descending
  const sorted = Array.from(candidateMap.entries()).sort(
    (a, b) => b[1].score - a[1].score || b[1].maxConfidence - a[1].maxConfidence
  );

  const results: CompanionRecommendation[] = [];

  for (const [name, meta] of sorted) {
    const src = meta.sourcePlate;
    results.push({
      name,
      confidence: meta.maxConfidence || 75,
      jointCount: meta.jointCount,
      category: meta.category,
      sourcePlateName: src?.platename || undefined,
      mirroredSpecs: src
        ? {
            length: src.length ?? undefined,
            width: src.width ?? undefined,
            material: src.material || "MS-Bright",
            shape: src.shape || "Plate",
          }
        : undefined,
    });
    if (results.length >= limit) break;
  }

  return results;
}

/**
 * Context-Boosted Subplate Ghost Autocomplete
 * Evaluates user typed prefix + Mould's existing plate basket affinity.
 */
export function findContextualPlateGhost(
  query: string,
  existingPlateNames: string[] = []
): GhostSuggestionResult | null {
  if (!query || typeof query !== "string") return null;
  const trimmed = query.trimStart();
  if (trimmed.length < 1) return null;

  const lowerQuery = trimmed.toLowerCase();

  // Calculate existing companion boost set
  const companionBoostMap = new Map<string, number>();
  for (const pName of existingPlateNames) {
    const cName = canonicalizePlateName(pName);
    const comps = staticGraph[cName] || [];
    for (const c of comps) {
      companionBoostMap.set(c.plate.toLowerCase(), (companionBoostMap.get(c.plate.toLowerCase()) || 0) + c.jointCount);
    }
  }

  let bestMatch: { name: string; score: number } | null = null;

  for (const item of staticIndex) {
    const itemLower = item.name.toLowerCase();
    if (!itemLower.startsWith(lowerQuery) || itemLower === lowerQuery) {
      continue;
    }

    let score = 1000; // Prefix match baseline

    // Co-occurrence context boost (+450 max if companion of existing plate in mould)
    const companionAffinity = companionBoostMap.get(itemLower);
    if (companionAffinity) {
      score += Math.min(450, companionAffinity * 15);
    }

    // Historical frequency bonus (log-scaled)
    score += Math.min(250, Math.log(1 + item.count) * 40);

    // Prefer concise plate names
    score -= Math.min(item.name.length, 60);

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { name: item.name, score };
    }
  }

  if (!bestMatch) return null;

  // Harmonize suggestion casing to user's active typing (prevents caps lock / mixed case issues)
  return harmonizeSuggestionCase(query, bestMatch.name);
}

/**
 * Top contextual plate suggestions for mobile & tablet chips
 */
export function findTopContextualPlates(
  query: string,
  existingPlateNames: string[] = [],
  limit = 4
): string[] {
  if (!query || typeof query !== "string") return [];
  const trimmed = query.trimStart();
  if (trimmed.length < 1) return [];

  const lowerQuery = trimmed.toLowerCase();

  const companionBoostMap = new Map<string, number>();
  for (const pName of existingPlateNames) {
    const cName = canonicalizePlateName(pName);
    const comps = staticGraph[cName] || [];
    for (const c of comps) {
      companionBoostMap.set(c.plate.toLowerCase(), (companionBoostMap.get(c.plate.toLowerCase()) || 0) + c.jointCount);
    }
  }

  const scoredMatches: { name: string; score: number }[] = [];

  for (const item of staticIndex) {
    const itemLower = item.name.toLowerCase();
    if (!itemLower.startsWith(lowerQuery) || itemLower === lowerQuery) {
      continue;
    }

    let score = 1000;
    const companionAffinity = companionBoostMap.get(itemLower);
    if (companionAffinity) {
      score += Math.min(450, companionAffinity * 15);
    }
    score += Math.min(250, Math.log(1 + item.count) * 40);
    score -= Math.min(item.name.length, 60);

    scoredMatches.push({ name: item.name, score });
  }

  scoredMatches.sort((a, b) => b.score - a.score);

  return scoredMatches.slice(0, limit).map((m) => {
    const harmonized = harmonizeSuggestionCase(query, m.name);
    return harmonized.fullSuggestion;
  });
}
