import fs from 'fs';
import pg from 'pg';

const envContent = fs.readFileSync('.env.local', 'utf8');
let databaseUrl = '';
for (const line of envContent.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    databaseUrl = line.trim().substring('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
    break;
  }
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

const colRes = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vendors';");
console.log('Vendors columns:');
console.log(colRes.rows.map(r => r.column_name));

const sRes = await client.query("SELECT * FROM public.vendors WHERE gstin IS NOT NULL OR bank_name IS NOT NULL LIMIT 3;");
console.log('Sample vendors with details:');
console.log(sRes.rows);

await client.end();
