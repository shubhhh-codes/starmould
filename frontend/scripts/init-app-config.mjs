import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const client = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log('Connecting to Supabase...');
  const { data, error } = await client.from('app_config').select('*');
  if (error) {
    console.error('Error querying app_config:', error);
    process.exit(1);
  }
  console.log('Current app_config entries:', data.map(d => ({ key: d.key, updated_at: d.updated_at })));

  // If role_permissions has only test or empty, verify it has valid structure
  const permRow = data.find(d => d.key === 'role_permissions');
  console.log('role_permissions value keys:', permRow ? Object.keys(permRow.value || {}) : 'None');

  // Let's ensure default role_menu_orders and role_permissions have valid entries for roles 0..4
  const defaultMenuOrders = {
    0: ["nav_dashboard","nav_customer_creator","nav_vendor_transport","nav_subplate","nav_scanning","nav_printing","nav_purchase","nav_purchase_inward","nav_challan","nav_dispatch","nav_inward","nav_work","nav_sample","nav_expense","nav_gram","nav_user_mgmt","nav_settings","nav_reports","nav_export"],
    1: ["nav_dashboard","nav_vendor_transport","nav_purchase","nav_purchase_inward","nav_challan","nav_dispatch","nav_inward","nav_expense","nav_reports","nav_export"],
    2: ["nav_dashboard","nav_subplate","nav_scanning","nav_printing","nav_purchase_inward","nav_challan","nav_dispatch","nav_inward","nav_work","nav_sample"],
    3: ["nav_dashboard","nav_subplate","nav_customer_creator","nav_scanning","nav_work","nav_sample"],
    4: ["nav_dashboard","nav_scanning","nav_work"]
  };

  // Only update if role_permissions has { test: true } from our prior check
  if (permRow && permRow.value && permRow.value.test === true) {
    console.log('Cleaning up temporary test value in role_permissions...');
    await client.from('app_config').upsert(
      { key: 'role_permissions', value: {}, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  }

  const orderRow = data.find(d => d.key === 'role_menu_orders');
  if (!orderRow || !orderRow.value || Object.keys(orderRow.value).length === 0) {
    console.log('Seeding initial default menu orders in app_config...');
    await client.from('app_config').upsert(
      { key: 'role_menu_orders', value: defaultMenuOrders, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  }

  const finalCheck = await client.from('app_config').select('key, updated_at');
  console.log('Updated app_config rows:', finalCheck.data);
  console.log('Done!');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
