#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// Load allowlist
const allowlistPath = path.resolve(process.cwd(), "scripts/language-allowlist.json");
let allowlist = { allowedTerms: [], allowedNonAscii: [], allowedCodePatterns: [] };
if (fs.existsSync(allowlistPath)) {
  allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf-8"));
}

const HINGLISH_KEYWORDS = [
  "hai",
  "hain",
  "nahi",
  "nahin",
  "nhi",
  "karo",
  "kare",
  "karein",
  "sakta",
  "sakti",
  "sakte",
  "galat",
  "sahi",
  "pehle",
  "baad",
  "dobara",
  "kuch",
  "abhi",
  "gaya",
  "gayi",
  "chahiye",
  "bharo",
  "daalo",
  "wapas",
  "theek",
  "wala",
  "wali",
  "apna",
  "yaar",
  "dekho",
  "batao",
  "karna",
  "hoga",
  "hogi",
  "liye",
  "sabhi",
  "jaldi",
  "tareekh",
  "kisi",
  "yaha",
  "yahan",
  "chhedo"
];

// Check non-Latin scripts (Devanagari, Gujarati, Bengali, Gurmukhi, Tamil, etc.)
const NON_LATIN_SCRIPT_REGEX = /[\u0900-\u097F\u0A80-\u0AFF\u0980-\u09FF\u0A00-\u0A7F\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/;

// Files to check: all git-tracked files in src, .github, docs, scripts
let filesToCheck = [];
try {
  const output = execSync("git ls-files src .github docs scripts", { encoding: "utf8" });
  filesToCheck = output.split("\n").map((f) => f.trim()).filter(Boolean);
} catch (err) {
  console.error("Error listing git files:", err);
  process.exit(1);
}

const violations = [];

const allowlistPatterns = new Set(
  (allowlist.allowedCodePatterns || []).map((p) => p.toLowerCase())
);

for (const relPath of filesToCheck) {
  // Ignore binary files and check script itself
  if (
    relPath.endsWith(".png") ||
    relPath.endsWith(".jpg") ||
    relPath.endsWith(".jpeg") ||
    relPath.endsWith(".ico") ||
    relPath.endsWith(".pdf") ||
    relPath === "scripts/check-language.mjs" ||
    relPath === "scripts/detailed_scan.mjs" ||
    relPath === "scripts/scan_language.mjs" ||
    relPath === "scripts/discovery_results.json"
  ) {
    continue;
  }

  const absPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(absPath)) continue;

  const content = fs.readFileSync(absPath, "utf8");
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // 1. Check Non-Latin scripts
    const nonLatinMatch = line.match(NON_LATIN_SCRIPT_REGEX);
    if (nonLatinMatch) {
      violations.push({
        file: relPath,
        line: lineNum,
        type: "Non-Latin Script Character",
        matched: nonLatinMatch[0],
        snippet: line.trim()
      });
    }

    // 2. Check Hinglish word tokens
    for (const kw of HINGLISH_KEYWORDS) {
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      if (regex.test(line)) {
        // Verify not in allowlist
        const isAllowed = allowlistPatterns.has(kw.toLowerCase());
        if (!isAllowed) {
          violations.push({
            file: relPath,
            line: lineNum,
            type: "Hinglish Keyword",
            matched: kw,
            snippet: line.trim()
          });
        }
      }
    }
  });
}

if (violations.length > 0) {
  console.error("\x1b[31m[Language Policy Violation] Found non-English text or Hinglish in the repository:\x1b[0m\n");
  console.table(
    violations.map((v) => ({
      File: `${v.file}:${v.line}`,
      Type: v.type,
      Word: v.matched,
      Snippet: v.snippet.slice(0, 60)
    }))
  );
  console.error(`\nTotal violations: ${violations.length}. Please fix all violations to adhere to the strict English-only policy.`);
  process.exit(1);
} else {
  console.log("\x1b[32m✔ [Language Check Passed] Zero non-English or Hinglish occurrences found in checked codebase files.\x1b[0m");
  process.exit(0);
}
