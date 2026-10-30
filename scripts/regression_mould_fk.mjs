import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

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

async function runRegressionSuite() {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== REGRESSION TEST SUITE: MOULD FOREIGN KEY INTEGRITY ===");

  let passed = 0;
  let failed = 0;

  // Test 1: get_next_project_code_preview with invalid customer ID
  try {
    const res = await client.query(`SELECT public.get_next_project_code_preview('999999') AS res;`);
    if (res.rows[0].res.isComplete === false && res.rows[0].res.error === 'Customer not found') {
      console.log("✓ Test 1 PASSED: Preview correctly rejects invalid customer ID.");
      passed++;
    } else {
      console.error("✗ Test 1 FAILED: Expected isComplete=false for invalid customer ID.");
      failed++;
    }
  } catch (err) {
    console.error("✗ Test 1 FAILED with exception:", err.message);
    failed++;
  }

  // Test 2: get_next_project_code_preview with valid customer ID
  try {
    const res = await client.query(`SELECT public.get_next_project_code_preview('1') AS res;`);
    if (res.rows[0].res.isComplete === true && res.rows[0].res.initials === 'ARJVM') {
      console.log("✓ Test 2 PASSED: Preview correctly resolves valid customer.");
      passed++;
    } else {
      console.error("✗ Test 2 FAILED: Expected isComplete=true and initials 'ARJVM'.");
      failed++;
    }
  } catch (err) {
    console.error("✗ Test 2 FAILED with exception:", err.message);
    failed++;
  }

  // Test 3: create_project_with_code with invalid customer ID must reject with 23503
  try {
    await client.query('BEGIN;');
    await client.query(`
      SELECT public.create_project_with_code(
        '999999',
        'Regression Test Nonexistent Customer',
        'Pulp Mould',
        CURRENT_DATE,
        CURRENT_DATE,
        CURRENT_DATE,
        '',
        '',
        1
      );
    `);
    console.error("✗ Test 3 FAILED: Invalid customer was unexpectedly created.");
    failed++;
  } catch (err) {
    if (err.code === '23503' && err.message.includes('does not exist in customers master')) {
      console.log("✓ Test 3 PASSED: Invalid customer rejected before insert with clean 23503.");
      passed++;
    } else {
      console.error("✗ Test 3 FAILED with unexpected error:", err.code, err.message);
      failed++;
    }
  } finally {
    await client.query('ROLLBACK;');
  }

  // Test 4: create_project_with_code with valid customer ID creates record properly
  try {
    await client.query('BEGIN;');
    const res = await client.query(`
      SELECT public.create_project_with_code(
        '1',
        'Regression Test Valid Customer',
        'Pulp Mould',
        CURRENT_DATE,
        CURRENT_DATE,
        CURRENT_DATE,
        '',
        '',
        1
      );
    `);
    const p = res.rows[0].create_project_with_code;
    if (p.customer_id === 1 && p.cname === 'Aarjavam Polysquare Private Limited') {
      console.log("✓ Test 4 PASSED: Valid mould created with foreign key customer_id=1 intact.");
      passed++;
    } else {
      console.error("✗ Test 4 FAILED: Project record data mismatch.");
      failed++;
    }
  } catch (err) {
    console.error("✗ Test 4 FAILED with exception:", err.message);
    failed++;
  } finally {
    await client.query('ROLLBACK;');
  }

  // Test 5: create_project_with_code with customer code
  try {
    await client.query('BEGIN;');
    const res = await client.query(`
      SELECT public.create_project_with_code(
        'STC52WQ7',
        'Regression Test Customer Code',
        'Pulp Mould',
        CURRENT_DATE,
        CURRENT_DATE,
        CURRENT_DATE,
        '',
        '',
        1
      );
    `);
    const p = res.rows[0].create_project_with_code;
    if (p.customer_id === 1 && p.cname === 'Aarjavam Polysquare Private Limited') {
      console.log("✓ Test 5 PASSED: Customer Code 'STC52WQ7' successfully resolved to customer_id=1.");
      passed++;
    } else {
      console.error("✗ Test 5 FAILED: Customer code not resolved.");
      failed++;
    }
  } catch (err) {
    console.error("✗ Test 5 FAILED with exception:", err.message);
    failed++;
  } finally {
    await client.query('ROLLBACK;');
    await client.end();
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runRegressionSuite();
