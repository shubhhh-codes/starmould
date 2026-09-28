import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

let databaseUrl = '';
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('DATABASE_URL=')) {
    databaseUrl = trimmed.substring('DATABASE_URL='.length).trim();
    // remove optional quotes
    if ((databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) ||
        (databaseUrl.startsWith("'") && databaseUrl.endsWith("'"))) {
      databaseUrl = databaseUrl.slice(1, -1);
    }
    break;
  }
}

if (!databaseUrl) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Connecting to PostgreSQL database...');
  await client.connect();
  console.log('Connected successfully.');

  const migrationsDir = path.join(__dirname, '..', 'src', 'data', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration file(s) to execute:`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`\n========================================`);
    console.log(`Running migration: ${file}`);
    console.log(`========================================`);
    
    try {
      const res = await client.query(sql);
      console.log(`Successfully executed ${file}`);
    } catch (err) {
      console.error(`Error executing ${file}:`, err.message);
    }
  }

  // Verify app_config table
  console.log('\n--- Verifying app_config table ---');
  try {
    const resConfig = await client.query('SELECT key, updated_at FROM app_config;');
    console.log('app_config rows:', resConfig.rows);
  } catch (err) {
    console.error('Could not verify app_config:', err.message);
  }

  // Verify users must_change_password column
  console.log('\n--- Verifying users table must_change_password column ---');
  try {
    const resUsers = await client.query('SELECT id, username, role_id, must_change_password, status FROM users LIMIT 10;');
    console.log('Sample users:', resUsers.rows);
  } catch (err) {
    console.error('Could not verify users column:', err.message);
  }

  await client.end();
  console.log('\nDatabase migration completed.');
}

run().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
