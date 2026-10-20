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

function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function generateInitials(name, existingInitialsSet) {
  const words = name
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  let candidate = '';
  if (words.length >= 2) {
    candidate = words.map(w => w[0]).join('').toUpperCase().slice(0, 5);
  }
  if (!candidate || candidate.length < 2) {
    candidate = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5);
  }
  if (!candidate) {
    candidate = 'VEND';
  }

  // Ensure <= 5 chars
  candidate = candidate.slice(0, 5);

  if (!existingInitialsSet.has(candidate)) {
    existingInitialsSet.add(candidate);
    return candidate;
  }

  // Try appending numbers while keeping length <= 5
  const base = candidate.slice(0, 3);
  for (let i = 1; i <= 99; i++) {
    const test = `${base}${i}`.slice(0, 5);
    if (!existingInitialsSet.has(test)) {
      existingInitialsSet.add(test);
      return test;
    }
  }

  // Random letters fallback
  for (let i = 0; i < 100; i++) {
    const rand = Math.floor(10 + Math.random() * 89);
    const test = `V${rand}`.slice(0, 5);
    if (!existingInitialsSet.has(test)) {
      existingInitialsSet.add(test);
      return test;
    }
  }

  throw new Error(`Could not generate unique initial for "${name}"`);
}

async function run() {
  console.log('Connecting to PostgreSQL database...');
  await client.connect();
  console.log('Connected successfully.');

  // 1. Read Excel extracted JSON
  const jsonPath = path.join(__dirname, 'excel_vendors.json');
  const rawJson = fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
  const excelVendors = JSON.parse(rawJson);
  console.log(`Loaded ${excelVendors.length} vendors from Excel JSON.`);

  // 2. Fetch existing customers from DB
  const dbRes = await client.query(
    "SELECT id, customername, initials, usertype, vendor_code, city, gstin, pan, bank_name, account_no, ifsc_code FROM public.customers WHERE deleted_at IS NULL"
  );
  const existingCustomers = dbRes.rows;
  console.log(`Found ${existingCustomers.length} active total partners in DB.`);

  const existingInitialsSet = new Set(
    existingCustomers.map(c => (c.initials || '').toUpperCase()).filter(Boolean)
  );

  // Build lookup maps for existing vendors
  const exactNameMap = new Map();
  const normalizedNameMap = new Map();

  for (const c of existingCustomers) {
    if (c.usertype === 'Vendor') {
      const lower = c.customername.trim().toLowerCase();
      exactNameMap.set(lower, c);

      const norm = normalizeName(c.customername);
      if (norm) {
        normalizedNameMap.set(norm, c);
      }
    }
  }

  console.log(`Found ${exactNameMap.size} existing Vendor records in DB.`);

  let updatedCount = 0;
  let insertedCount = 0;
  const sampleUpdates = [];
  const sampleInserts = [];

  for (const ev of excelVendors) {
    const rawName = ev.customername.trim();
    const lowerName = rawName.toLowerCase();
    const normName = normalizeName(rawName);

    const matched = exactNameMap.get(lowerName) || normalizedNameMap.get(normName);

    if (matched) {
      // UPDATE matched record
      const updateFields = [];
      const values = [];
      let idx = 1;

      if (ev.vendor_code && matched.vendor_code !== ev.vendor_code) {
        updateFields.push(`vendor_code = $${idx++}`);
        values.push(ev.vendor_code);
      }
      if (ev.city && (!matched.city || matched.city !== ev.city)) {
        updateFields.push(`city = $${idx++}`);
        values.push(ev.city);
      }
      if (ev.gstin && (!matched.gstin || matched.gstin !== ev.gstin)) {
        updateFields.push(`gstin = $${idx++}`);
        values.push(ev.gstin);
      }
      if (ev.pan && (!matched.pan || matched.pan !== ev.pan)) {
        updateFields.push(`pan = $${idx++}`);
        values.push(ev.pan);
      }
      if (ev.bank_name && (!matched.bank_name || matched.bank_name !== ev.bank_name)) {
        updateFields.push(`bank_name = $${idx++}`);
        values.push(ev.bank_name);
      }
      if (ev.account_no && (!matched.account_no || matched.account_no !== ev.account_no)) {
        updateFields.push(`account_no = $${idx++}`);
        values.push(ev.account_no);
      }
      if (ev.ifsc_code && (!matched.ifsc_code || matched.ifsc_code !== ev.ifsc_code)) {
        updateFields.push(`ifsc_code = $${idx++}`);
        values.push(ev.ifsc_code);
      }

      if (updateFields.length > 0) {
        updateFields.push(`updated_at = NOW()`);
        values.push(matched.id);
        const query = `UPDATE public.customers SET ${updateFields.join(', ')} WHERE id = $${idx}`;
        await client.query(query, values);
        updatedCount++;
        if (sampleUpdates.length < 5) {
          sampleUpdates.push({ id: matched.id, name: matched.customername, code: ev.vendor_code, gstin: ev.gstin });
        }
      }
    } else {
      // INSERT new vendor
      const initials = generateInitials(rawName, existingInitialsSet);
      const query = `
        INSERT INTO public.customers (
          customername, initials, usertype, vendor_code, city, gstin, pan, bank_name, account_no, ifsc_code,
          created_at, created_by, updated_at, updated_by
        ) VALUES (
          $1, $2, 'Vendor', $3, $4, $5, $6, $7, $8, $9,
          NOW(), 0, NOW(), 0
        ) RETURNING id, customername, initials, vendor_code;
      `;
      const res = await client.query(query, [
        rawName,
        initials,
        ev.vendor_code || null,
        ev.city || null,
        ev.gstin || null,
        ev.pan || null,
        ev.bank_name || null,
        ev.account_no || null,
        ev.ifsc_code || null,
      ]);
      insertedCount++;
      if (sampleInserts.length < 5) {
        sampleInserts.push(res.rows[0]);
      }
    }
  }

  console.log('\n=================================================');
  console.log('SYNC REPORT:');
  console.log('=================================================');
  console.log(`Total Excel Vendors processed: ${excelVendors.length}`);
  console.log(`Existing DB Vendors matched & enriched with details: ${updatedCount}`);
  console.log(`New Vendors inserted from Excel: ${insertedCount}`);

  console.log('\nSample Enriched/Updated Vendors:');
  console.table(sampleUpdates);

  console.log('\nSample Newly Inserted Vendors:');
  console.table(sampleInserts);

  // Final check of total vendors
  const finalRes = await client.query(
    "SELECT count(*) as total, count(vendor_code) as with_code, count(gstin) as with_gst, count(bank_name) as with_bank FROM public.customers WHERE usertype = 'Vendor' AND deleted_at IS NULL"
  );
  console.log('\nFinal DB Vendor Statistics:');
  console.table(finalRes.rows);

  await client.end();
  console.log('\nSynchronization completed successfully.');
}

run().catch(err => {
  console.error('Error during synchronization:', err);
  process.exit(1);
});
