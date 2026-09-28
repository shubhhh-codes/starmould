import { signSession, verifySessionToken, SessionUser } from "../src/lib/auth";
import { checkRateLimit, resetRateLimit } from "../src/lib/rate-limit";
import {
  calculateSubplateWeight,
  getMaterialDensity,
  MATERIAL_DENSITIES,
  UNIT_MULTIPLIERS,
  isHeightDisabled,
} from "../src/lib/weight-calculator";
import { roleHasPermission } from "../src/lib/permissions/loader";
import { DEFAULT_ROLE_PERMISSIONS } from "../src/lib/permissions/defaults";

// Ensure required environment variables for test execution
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "starmould_test_session_secret_1234567890_min_32_chars";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-key";

async function run() {
  console.log("================================================================");
  console.log("STAR MOULD ERP - AUTHENTIC PRODUCTION REGRESSION TEST SUITE");
  console.log("Direct imports from src/lib/ modules (Auth, RateLimit, Weight, Perms)");
  console.log("================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${detail ? " -> " + detail : ""}`);
      failed++;
    }
  }

  // ==========================================
  // SUITE 1: Real Auth Token Cryptography & Claims Validation (src/lib/auth.ts)
  // ==========================================
  console.log("--- Suite 1: Cryptographic Session Claims & Tamper Resistance (src/lib/auth.ts) ---");

  const testUser: SessionUser = {
    id: 101,
    name: "Rajesh Sharma",
    email: "rajesh@starmould.in",
    username: "rajesh",
    role_id: 1,
    role: "Manager",
    initials: "RS",
    must_change_password: true,
  };

  const validToken = signSession(testUser);
  assert(typeof validToken === "string" && validToken.includes("."), "signSession produces valid payload.signature string");

  const decoded = verifySessionToken(validToken);
  assert(decoded !== null, "verifySessionToken successfully decodes genuine signed token");
  assert(decoded?.id === 101, "Preserves user ID claim (101)");
  assert(decoded?.role_id === 1, "Preserves role_id claim (1)");
  assert(decoded?.role === "Manager", "Preserves role string claim ('Manager')");
  assert(decoded?.username === "rajesh", "Preserves username ('rajesh')");
  assert(decoded?.must_change_password === true, "Preserves must_change_password flag (true)");

  // Tamper detection
  const [payload, signature] = validToken.split(".");
  const tamperedPayload = Buffer.from(JSON.stringify({ ...testUser, role_id: 0 })).toString("base64url");
  const forgedToken = `${tamperedPayload}.${signature}`;
  const tamperedDecoded = verifySessionToken(forgedToken);
  assert(tamperedDecoded === null, "Rejects forged / tampered role elevation token (HMAC mismatch)");

  // Expired token rejection
  const expiredPayloadData = {
    ...testUser,
    iat: Math.floor(Date.now() / 1000) - 800000,
    exp: Math.floor(Date.now() / 1000) - 100, // already expired
  };
  const expPayloadB64 = Buffer.from(JSON.stringify(expiredPayloadData)).toString("base64url");
  // sign with crypto
  const crypto = await import("crypto");
  const expSig = crypto.createHmac("sha256", process.env.SESSION_SECRET!).update(expPayloadB64).digest("base64url");
  const expiredToken = `${expPayloadB64}.${expSig}`;
  assert(verifySessionToken(expiredToken) === null, "Rejects expired session tokens");

  // Missing/invalid inputs
  assert(verifySessionToken("") === null, "Rejects empty token string");
  assert(verifySessionToken("invalid-format-without-dot") === null, "Rejects unformatted token string");

  // ==========================================
  // SUITE 2: IP-Based Login Rate Limiting (src/lib/rate-limit.ts)
  // ==========================================
  console.log("\n--- Suite 2: Login Rate Limiting & Lockout (src/lib/rate-limit.ts) ---");

  const testIp = "192.168.1.99";
  resetRateLimit(testIp);

  // 10 allowed attempts
  let allAllowed = true;
  for (let i = 1; i <= 10; i++) {
    const res = checkRateLimit(testIp);
    if (!res.allowed) allAllowed = false;
  }
  assert(allAllowed, "Allows up to 10 consecutive attempts within window");

  // 11th attempt triggers lockout
  const lockoutRes = checkRateLimit(testIp);
  assert(!lockoutRes.allowed, "11th attempt triggers rate limit block (allowed = false)");
  assert((lockoutRes.retryAfterSeconds ?? 0) > 0, "Returns positive retryAfterSeconds on lockout");

  // Reset clears lockout
  resetRateLimit(testIp);
  const postResetRes = checkRateLimit(testIp);
  assert(postResetRes.allowed, "resetRateLimit() immediately unblocks the IP address on successful login");

  // ==========================================
  // SUITE 3: Authentic Weight Calculator & Legacy Densities (src/lib/weight-calculator.ts)
  // ==========================================
  console.log("\n--- Suite 3: Authentic Legacy Weight Calculations (src/lib/weight-calculator.ts) ---");

  // Test authentic legacy material densities
  assert(getMaterialDensity("Aluminium") === 2.71, "Aluminium density = 2.71");
  assert(getMaterialDensity("MS-Bright") === 7.81, "MS-Bright density = 7.81");
  assert(getMaterialDensity("MS-Black") === 7.81, "MS-Black density = 7.81");
  assert(getMaterialDensity("D-2") === 7.70, "D-2 density = 7.70");
  assert(getMaterialDensity("EN8") === 7.85, "EN8 density = 7.85");
  assert(getMaterialDensity("C45") === 7.80, "C45 density = 7.80");
  assert(getMaterialDensity("WPS") === 7.80, "WPS density = 7.80");
  assert(getMaterialDensity("Derlin") === 1.41, "Derlin density = 1.41");
  assert(getMaterialDensity("Nylon") === 1.14, "Nylon density = 1.14");
  assert(getMaterialDensity("Brass") === 8.73, "Brass density = 8.73");
  assert(getMaterialDensity("Copper") === 8.96, "Copper density = 8.96");
  assert(getMaterialDensity("SS-304") === 7.93, "SS-304 density = 7.93");
  assert(getMaterialDensity("SS-202") === 7.86, "SS-202 density = 7.86");
  assert(getMaterialDensity("Gun Metal") === 8.719, "Gun Metal density = 8.719");

  // Zero density for non-metal accessories (legacy behavior)
  assert(getMaterialDensity("SS") === 0, "SS density = 0 (legacy definition)");
  assert(getMaterialDensity("U-seal") === 0, "U-seal density = 0 (legacy definition)");
  assert(getMaterialDensity("Rubber") === 0, "Rubber density = 0 (legacy definition)");

  // Default density for unknown / unlisted materials must be 0 (NOT 7.81)
  assert(getMaterialDensity("Acralic") === 0, "Acralic returns 0 (unlisted material)");
  assert(getMaterialDensity("Wood") === 0, "Wood returns 0 (unlisted material)");
  assert(getMaterialDensity("Unknown_XYZ") === 0, "Unknown material returns 0 default");
  assert(getMaterialDensity("") === 0, "Empty material returns 0 default");

  // Invented materials are not present
  assert(!("MS" in MATERIAL_DENSITIES), "Invented 'MS' is not in MATERIAL_DENSITIES");
  assert(!("P-20" in MATERIAL_DENSITIES), "Invented 'P-20' is not in MATERIAL_DENSITIES");

  // Calculation Test 1: Rectangle / Plate (MS-Bright: 100 x 50 x 20 mm, qty 1)
  // Expected: (7.81 * 100 * 50 * 20) / 1,000,000 = 0.781 kg
  const rectWeight = calculateSubplateWeight({
    shape: "Rectangle",
    material: "MS-Bright",
    length: 100,
    width: 50,
    height: 20,
    unit: "mm",
    quantity: 1,
  });
  assert(rectWeight === 0.781, `Rectangle 100x50x20 MS-Bright = 0.781 kg (got ${rectWeight})`);

  // Calculation Test 2: Unit conversion (cm -> mm)
  // 10 cm x 5 cm x 2 cm = 100 mm x 50 mm x 20 mm = 0.781 kg
  const cmWeight = calculateSubplateWeight({
    shape: "Rectangle",
    material: "MS-Bright",
    length: 10,
    width: 5,
    height: 2,
    unit: "cm",
    quantity: 1,
  });
  assert(cmWeight === 0.781, `Rectangle in cm matches equivalent in mm (got ${cmWeight})`);

  // Calculation Test 3: Zero density material returns 0 weight
  const zeroWeight = calculateSubplateWeight({
    shape: "Rectangle",
    material: "Rubber",
    length: 100,
    width: 50,
    height: 20,
    unit: "mm",
    quantity: 1,
  });
  assert(zeroWeight === 0, `Zero-density material (Rubber) returns 0.000 kg (got ${zeroWeight})`);

  // Calculation Test 4: Height disabled for Round Bar
  assert(isHeightDisabled("Round") === true, "isHeightDisabled('Round') = true");
  assert(isHeightDisabled("Rectangle") === false, "isHeightDisabled('Rectangle') = false");

  // ==========================================
  // SUITE 4: Role Permissions Evaluation (src/lib/permissions/loader.ts)
  // ==========================================
  console.log("\n--- Suite 4: Dynamic & Default Role Permissions (src/lib/permissions/loader.ts) ---");

  // Admin (Role 0) always has all permissions
  assert(roleHasPermission(0, "nav_expense", DEFAULT_ROLE_PERMISSIONS) === true, "Admin (0) has nav_expense");
  assert(roleHasPermission(0, "action_manage_users", DEFAULT_ROLE_PERMISSIONS) === true, "Admin (0) has action_manage_users");
  assert(roleHasPermission(0, "non_existent_key", DEFAULT_ROLE_PERMISSIONS) === true, "Admin (0) has unrestricted access to all keys");

  // Manager (Role 1)
  assert(roleHasPermission(1, "nav_expense", DEFAULT_ROLE_PERMISSIONS) === true, "Manager (1) has nav_expense by default");
  assert(roleHasPermission(1, "action_manage_users", DEFAULT_ROLE_PERMISSIONS) === false, "Manager (1) does not have action_manage_users by default");

  // Worker (Role 4)
  assert(roleHasPermission(4, "nav_work", DEFAULT_ROLE_PERMISSIONS) === true, "Worker (4) has nav_work by default");
  assert(roleHasPermission(4, "nav_expense", DEFAULT_ROLE_PERMISSIONS) === false, "Worker (4) does not have nav_expense");

  console.log("\n================================================================");
  console.log(`TOTAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
