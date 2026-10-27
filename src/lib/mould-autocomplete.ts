import dataset from "@/data/mould-descriptions-dataset.json";

export interface MouldDescriptionItem {
  text: string;
  count: number;
  worktype: string;
}

export interface GhostSuggestionResult {
  fullSuggestion: string;
  remainingText: string;
}

// In-memory runtime cache that includes pre-trained dataset + dynamically learned descriptions
const staticDataset: MouldDescriptionItem[] = dataset as MouldDescriptionItem[];
const runtimeLearnedSet = new Map<string, MouldDescriptionItem>();

function toTitleCase(str: string): string {
  return str.replace(/\b[a-zA-Z]/g, (char) => char.toUpperCase());
}

function detectUserCase(input: string): "upper" | "lower" | "title" {
  const letters = input.replace(/[^a-zA-Z]/g, "");
  if (!letters) return "upper";
  if (letters === letters.toUpperCase()) return "upper";
  if (letters === letters.toLowerCase()) return "lower";
  if (letters[0] === letters[0].toUpperCase() && letters.slice(1) === letters.slice(1).toLowerCase()) {
    return "title";
  }
  return "lower";
}

export function harmonizeSuggestionCase(
  userInput: string,
  fullMatchText: string
): GhostSuggestionResult {
  const userCase = detectUserCase(userInput);
  const trimmed = userInput.trimStart();

  let formattedMatch = fullMatchText;

  if (userCase === "lower") {
    formattedMatch = fullMatchText.toLowerCase();
  } else if (userCase === "upper") {
    formattedMatch = fullMatchText.toUpperCase();
  } else if (userCase === "title") {
    formattedMatch = toTitleCase(fullMatchText.toLowerCase());
  }

  const remaining = formattedMatch.slice(trimmed.length);

  return {
    fullSuggestion: userInput + remaining,
    remainingText: remaining,
  };
}

/**
 * Register newly created/edited mould descriptions into the runtime autocomplete library.
 */
export function learnMouldDescription(text: string, worktype = "Pulp Mould") {
  if (!text || typeof text !== "string") return;
  const clean = text.trim();
  if (clean.length < 3) return;

  const key = clean.toLowerCase();
  const existing = runtimeLearnedSet.get(key);
  if (existing) {
    existing.count += 1;
  } else {
    runtimeLearnedSet.set(key, {
      text: clean,
      count: 5, // Give freshly learned user descriptions healthy priority
      worktype,
    });
  }
}

/**
 * Finds the single best Copilot-style ghost suggestion for the current input.
 * Strictly adheres to inline ghost text principles:
 * - Prefix matching so remainingText seamlessly attaches to the user's cursor
 * - Prioritizes the active Work Type (Pulp Mould, TF, Rework, Machine part, etc.)
 * - Weighted by historical usage frequency
 * - Dynamically harmonizes casing to match user's active Caps Lock / typing case
 */
export function findGhostSuggestion(
  query: string,
  activeWorktype?: string,
  extraLiveDescriptions: string[] = []
): GhostSuggestionResult | null {
  if (!query || typeof query !== "string") return null;
  const trimmed = query.trimStart();
  if (trimmed.length < 2) return null;

  const lowerQuery = trimmed.toLowerCase();
  const activeWtLower = (activeWorktype || "").toLowerCase().trim();

  // Combine dynamic live descriptions, runtime learned, and static dataset
  const candidates: MouldDescriptionItem[] = [
    ...extraLiveDescriptions.map((txt) => ({
      text: txt,
      count: 10,
      worktype: activeWorktype || "Pulp Mould",
    })),
    ...Array.from(runtimeLearnedSet.values()),
    ...staticDataset,
  ];

  let bestMatch: MouldDescriptionItem | null = null;
  let bestScore = -Infinity;

  for (const item of candidates) {
    const itemText = item.text.trim();
    const itemLower = itemText.toLowerCase();

    // Must start with the query (or query is a prefix) to allow clean ghost completion
    if (!itemLower.startsWith(lowerQuery)) {
      continue;
    }

    // Exact match already typed - no ghost text needed
    if (itemLower === lowerQuery) {
      continue;
    }

    let score = 1000;

    // Bonus for matching the active work type
    if (activeWtLower && item.worktype && item.worktype.toLowerCase() === activeWtLower) {
      score += 500;
    }

    // Frequency bonus
    score += Math.min(item.count * 15, 300);

    // Prefer shorter, tighter descriptions when scores are close
    score -= Math.min(itemText.length, 100);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  if (!bestMatch) {
    return null;
  }

  // Harmonize suggestion casing to match user's active typing style (prevents cofFE caps-lock mismatches)
  const harmonized = harmonizeSuggestionCase(query, bestMatch.text);
  if (!harmonized.remainingText) return null;

  return harmonized;
}

/**
 * Returns top N suggestions matching query, harmonized to user's casing.
 * Perfect for mobile predictive chips (QuickType / GBoard style).
 */
export function findTopSuggestions(
  query: string,
  activeWorktype?: string,
  extraLiveDescriptions: string[] = [],
  limit = 3
): string[] {
  if (!query || typeof query !== "string") return [];
  const trimmed = query.trimStart();
  if (trimmed.length < 2) return [];

  const lowerQuery = trimmed.toLowerCase();
  const activeWtLower = (activeWorktype || "").toLowerCase().trim();

  const candidates: MouldDescriptionItem[] = [
    ...extraLiveDescriptions.map((txt) => ({
      text: txt,
      count: 10,
      worktype: activeWorktype || "Pulp Mould",
    })),
    ...Array.from(runtimeLearnedSet.values()),
    ...staticDataset,
  ];

  const scored: { item: MouldDescriptionItem; score: number }[] = [];

  for (const item of candidates) {
    const itemLower = item.text.trim().toLowerCase();
    if (!itemLower.startsWith(lowerQuery) || itemLower === lowerQuery) {
      continue;
    }

    let score = 1000;
    if (activeWtLower && item.worktype && item.worktype.toLowerCase() === activeWtLower) {
      score += 500;
    }
    score += Math.min(item.count * 15, 300);
    score -= Math.min(item.text.length, 100);

    scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const results: string[] = [];

  for (const { item } of scored) {
    const harmonized = harmonizeSuggestionCase(query, item.text);
    const text = harmonized.fullSuggestion;
    const lower = text.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      results.push(text);
      if (results.length >= limit) break;
    }
  }

  return results;
}
