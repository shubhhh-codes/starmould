import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

// Determine target env file:
// Priority:
// 1. Explicit argument pointing to an env file or '--staging' / '--prod'
// 2. TARGET_ENV or ENV environment variable
// 3. Active .env.local
let targetEnvFile = '.env.local';
const args = process.argv.slice(2);

if (args.includes('--staging') || args.includes('staging') || process.env.TARGET_ENV === 'staging' || process.env.ENV === 'staging') {
  targetEnvFile = '.env.staging.local';
} else if (args.includes('--prod') || args.includes('--production') || args.includes('prod') || process.env.TARGET_ENV === 'prod') {
  targetEnvFile = '.env.production.local';
} else {
  // Check if any arg looks like an env file
  const customFile = args.find(a => a.startsWith('.env') || a.endsWith('.env'));
  if (customFile) {
    targetEnvFile = customFile;
  }
}

const envPath = path.resolve(root, targetEnvFile);
if (!fs.existsSync(envPath)) {
  console.error(`Environment file not found: ${envPath}`);
  process.exit(1);
}

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

if (!databaseUrl) {
  console.error(`DATABASE_URL not found in ${targetEnvFile}`);
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(databaseUrl);
} catch {
  parsedUrl = { hostname: 'unknown', pathname: 'unknown' };
}

const isStaging = targetEnvFile.includes('staging') || databaseUrl.includes('vyhtiwqvblwnbaiqhewh');
const isProd = targetEnvFile.includes('prod') || databaseUrl.includes('tvfqhdhxwnpkhhrvxvfi');
const envLabel = isStaging ? 'STAGING' : isProd ? 'PRODUCTION' : 'CUSTOM';

console.log('========================================================');
console.log(` Target Environment : ${envLabel} (${targetEnvFile})`);
console.log(` Database Host      : ${parsedUrl.hostname}`);
console.log(` Database Name      : ${parsedUrl.pathname}`);
console.log('========================================================\n');

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Connecting to PostgreSQL database...');
  await client.connect();
  console.log('Connected successfully.\n');

  const migrationsDir = path.join(__dirname, '..', 'src', 'data', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration file(s) to execute:`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`\n========================================`);
    console.log(`Running migration: ${file}`);
    console.log(`========================================`);
    
    try {
      await client.query(sql);
      console.log(`Successfully executed ${file}`);
      successCount++;
    } catch (err) {
      console.error(`Error executing ${file}:`, err.message);
      errorCount++;
      errors.push({ file, error: err.message });
    }
  }

  console.log('\n========================================');
  console.log(`Migration Run Summary: ${successCount} succeeded, ${errorCount} errors`);
  if (errors.length > 0) {
    console.log('Errors encountered:');
    errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`));
  }
  console.log('========================================\n');

  // Verify app_config table
  console.log('--- Verifying app_config table ---');
  try {
    const resConfig = await client.query('SELECT key, updated_at FROM app_config;');
    console.log('app_config rows:', resConfig.rows.length);
  } catch (err) {
    console.error('Could not verify app_config:', err.message);
  }

  // Verify users must_change_password column
  console.log('\n--- Verifying users table must_change_password column ---');
  try {
    const resUsers = await client.query('SELECT id, username, role_id, must_change_password, status FROM users LIMIT 5;');
    console.log('Sample users count:', resUsers.rows.length);
  } catch (err) {
    console.error('Could not verify users column:', err.message);
  }

  // Verify 028 subplate_type column
  console.log('\n--- Verifying subplate table subplate_type column (Migration 028) ---');
  try {
    const resSubplate = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'subplate' AND column_name = 'subplate_type';
    `);
    console.log('subplate_type column:', resSubplate.rows);
  } catch (err) {
    console.error('Could not verify subplate_type:', err.message);
  }

  // Verify 029 rework optional purchase & register gates
  console.log('\n--- Verifying po_bypassed & register columns (Migration 029) ---');
  try {
    const res029Subplate = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'subplate' AND column_name = 'po_bypassed';
    `);
    console.log('po_bypassed column:', res029Subplate.rows);

    const res029Scan = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'scan' AND column_name IN ('register_closure_reason', 'register_closure_notes');
    `);
    console.log('scan closure columns:', res029Scan.rows.map(r => r.column_name));
  } catch (err) {
    console.error('Could not verify migration 029 columns:', err.message);
  }

  // Verify 027 view_subplate_jobwork_balance
  console.log('\n--- Verifying view_subplate_jobwork_balance (Migration 027) ---');
  try {
    const resView = await client.query(`SELECT COUNT(*) FROM view_subplate_jobwork_balance;`);
    console.log('view_subplate_jobwork_balance row count:', resView.rows[0]?.count);
  } catch (err) {
    console.error('Could not verify view_subplate_jobwork_balance:', err.message);
  }

  // Verify performance RPC functions
  console.log('\n--- Verifying performance RPC functions ---');
  try {
    const resTableCounts = await client.query('SELECT public.get_table_counts() AS counts;');
    console.log('get_table_counts():', resTableCounts.rows[0]?.counts);
  } catch (err) {
    console.error('Could not verify get_table_counts():', err.message);
  }

  try {
    const resExpenseTotals = await client.query('SELECT public.get_expense_totals() AS totals;');
    console.log('get_expense_totals():', resExpenseTotals.rows[0]?.totals);
  } catch (err) {
    console.error('Could not verify get_expense_totals():', err.message);
  }

  try {
    const resWorkflow = await client.query('SELECT public.get_report_workflow_summary() AS summary;');
    console.log('get_report_workflow_summary():', resWorkflow.rows[0]?.summary);
  } catch (err) {
    console.error('Could not verify get_report_workflow_summary():', err.message);
  }

  await client.end();
  console.log(`\nDatabase migration completed for ${envLabel}.`);
}

run().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
