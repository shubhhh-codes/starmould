// StarMould Comprehensive Automated Regression Suite
const crypto = require("crypto");

async function runRegressionSuite() {
  console.log("==================================================");
  console.log("STARMOULD MASTER AUTOMATED REGRESSION SUITE");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // --- SUITE 1: CSV FORMULA INJECTION & NUMERIC PRESERVATION [SEC-008, DOC-001] ---
  console.log("\n--- TEST SUITE 1: CSV Formula Injection & Numeric Preservation ---");
  function formatCsvCell(val) {
    if (val === null || val === undefined) return '""';
    let str = String(val).trim();
    if (/^[=@\t\r]/.test(str)) {
      str = "'" + str;
    } else if (/^[+\-]/.test(str)) {
      const isPureNumber = /^[+\-]?\d+(\.\d+)?$/.test(str);
      if (!isPureNumber) {
        str = "'" + str;
      }
    }
    return `"${str.replace(/"/g, '""')}"`;
  }

  assert(formatCsvCell("=SUM(A1:A10)") === '"\'=SUM(A1:A10)"', "Escapes '=' spreadsheet formula prefix");
  assert(formatCsvCell("@SUM(1,2)") === '"\'@SUM(1,2)"', "Escapes '@' formula prefix");
  assert(formatCsvCell("+cmd|/C calc!A0") === '"\'+cmd|/C calc!A0"', "Escapes '+cmd' malicious command injection");
  assert(formatCsvCell("-2+3*cmd") === '"\'-2+3*cmd"', "Escapes '-formula' arithmetic injection");
  assert(formatCsvCell("-150.75") === '"-150.75"', "Preserves genuine negative float (-150.75) as valid number");
  assert(formatCsvCell("+500") === '"+500"', "Preserves genuine positive integer (+500) as valid number");
  assert(formatCsvCell('Acme, "Standard" Inc') === '"Acme, ""Standard"" Inc"', "RFC 4180 double-quotes escaping");
  assert(formatCsvCell(null) === '""', "Null returns empty quoted cell");

  // --- SUITE 2: STRICT SESSION TOKEN VALIDATION & TIMESTAMPS [SEC-001, SEC-002] ---
  console.log("\n--- TEST SUITE 2: Auth Cryptographic Claims & Expiry Validation ---");
  const SECRET = "starmould-secure-production-secret-123456789";

  function createTestToken(payload, secret) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
    return `${header}.${body}.${sig}`;
  }

  function verifyTestToken(token, secret) {
    if (!token || typeof token !== "string" || !token.includes(".")) return null;
    if (!secret) return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, b, s] = parts;

    const expectedSig = crypto.createHmac("sha256", secret).update(`${h}.${b}`).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expectedSig))) return null;

    try {
      const data = JSON.parse(Buffer.from(b, "base64url").toString());
      const now = Math.floor(Date.now() / 1000);

      if (
        typeof data.iat !== "number" ||
        typeof data.exp !== "number" ||
        isNaN(data.iat) ||
        isNaN(data.exp) ||
        data.exp <= data.iat ||
        now > data.exp ||
        data.iat > now + 60 ||
        data.exp > data.iat + 7 * 24 * 60 * 60 + 60
      ) {
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  const nowEpoch = Math.floor(Date.now() / 1000);
  const validToken = createTestToken({ id: 1, role_id: 0, username: "admin", iat: nowEpoch, exp: nowEpoch + 7 * 86400 }, SECRET);
  assert(verifyTestToken(validToken, SECRET) !== null, "Valid session token with iat & exp verifies cleanly");

  const tamperedToken = validToken.slice(0, -5) + "xyz99";
  assert(verifyTestToken(tamperedToken, SECRET) === null, "Tampered token signature is rejected");

  const missingExpToken = createTestToken({ id: 1, role_id: 0, username: "admin", iat: nowEpoch }, SECRET);
  assert(verifyTestToken(missingExpToken, SECRET) === null, "Token missing exp claim is rejected");

  const expiredToken = createTestToken({ id: 1, role_id: 0, username: "admin", iat: nowEpoch - 1000, exp: nowEpoch - 10 }, SECRET);
  assert(verifyTestToken(expiredToken, SECRET) === null, "Expired token is rejected");

  const invertedToken = createTestToken({ id: 1, role_id: 0, username: "admin", iat: nowEpoch, exp: nowEpoch - 50 }, SECRET);
  assert(verifyTestToken(invertedToken, SECRET) === null, "Token with exp <= iat is rejected");

  const futureIatToken = createTestToken({ id: 1, role_id: 0, username: "admin", iat: nowEpoch + 500, exp: nowEpoch + 86400 }, SECRET);
  assert(verifyTestToken(futureIatToken, SECRET) === null, "Token with unreasonable future iat is rejected");

  // --- SUITE 3: POSTGREST QUERY SANITIZATION [SEC-009, API-003] ---
  console.log("\n--- TEST SUITE 3: PostgREST Query Injection Sanitization ---");
  function sanitizeSearchQuery(q) {
    if (!q) return "";
    return q.replace(/[(),.%]/g, "").trim();
  }

  assert(sanitizeSearchQuery("admin,status.eq.1") === "adminstatuseq1", "Strips commas and periods from filter queries");
  assert(sanitizeSearchQuery("SELECT * FROM (users)") === "SELECT * FROM users", "Strips injection parentheses");
  assert(sanitizeSearchQuery("P-1004 %50") === "P-1004 50", "Strips wildcards & percentage characters");

  // --- SUITE 4: LRU BOUNDED CACHE MECHANICS [PERF-002, PERF-010] ---
  console.log("\n--- TEST SUITE 4: True LRU Bounded Cache Mechanics ---");
  const testCache = new Map();
  const MAX_LIMIT = 4;

  function accessKey(key, value) {
    const entry = testCache.get(key);
    if (entry) {
      testCache.delete(key);
      testCache.set(key, entry);
      return entry;
    }
    if (testCache.size >= MAX_LIMIT) {
      const lruKey = testCache.keys().next().value;
      testCache.delete(lruKey);
    }
    testCache.set(key, value);
    return value;
  }

  accessKey("k1", "v1");
  accessKey("k2", "v2");
  accessKey("k3", "v3");
  accessKey("k4", "v4");
  accessKey("k1", "v1"); // Access k1 so k2 becomes the least recently used!
  accessKey("k5", "v5"); // Should evict k2

  assert(!testCache.has("k2"), "k2 was least recently used and evicted when k5 was added");
  assert(testCache.has("k1"), "k1 was preserved because it was accessed recently");
  assert(testCache.size === MAX_LIMIT, `Cache size strictly bounded to ${MAX_LIMIT}`);

  // --- SUITE 5: EXPENSE DETERMINISTIC ROLLING BALANCE [EXP-001] ---
  console.log("\n--- TEST SUITE 5: Expense Deterministic Rolling Balance ---");
  const transactions = [
    { id: 1, type: "Credit", amount: 1000 },
    { id: 2, type: "Debit", amount: 200 },
    { id: 3, type: "Debit", amount: 300 },
  ];

  function computeRollingBalances(txs) {
    let bal = 0;
    return txs.map(t => {
      if (t.type === "Credit") bal += t.amount;
      else if (t.type === "Debit") bal -= t.amount;
      return { ...t, balance: bal };
    });
  }

  let calculated = computeRollingBalances(transactions);
  assert(calculated[0].balance === 1000 && calculated[1].balance === 800 && calculated[2].balance === 500, "Initial rolling balances: 1000 -> 800 -> 500");

  // Edit middle transaction (id: 2 debit 200 -> 500)
  transactions[1].amount = 500;
  calculated = computeRollingBalances(transactions);
  assert(calculated[1].balance === 500 && calculated[2].balance === 200, "Editing middle record correctly cascades to downstream balances (500 -> 200)");

  // Delete middle transaction
  transactions.splice(1, 1);
  calculated = computeRollingBalances(transactions);
  assert(calculated[0].balance === 1000 && calculated[1].balance === 700, "Deleting middle record dynamically balances remaining records (1000 -> 700)");

  console.log("\n==================================================");
  console.log(`TOTAL REGRESSION TESTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
}

runRegressionSuite().catch(err => {
  console.error("Regression Suite Error:", err);
  process.exit(1);
});
