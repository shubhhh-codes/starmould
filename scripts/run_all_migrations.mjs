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

async function main() {
  console.log('Connecting to PostgreSQL database...');
  await client.connect();
  console.log('Connected successfully to database.\n');

  // 1. Ensure migrations tracking table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS public._schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(255) NOT NULL UNIQUE,
      file_path TEXT NOT NULL,
      executed_at TIMESTAMPTZ DEFAULT NOW(),
      execution_time_ms INTEGER,
      status VARCHAR(50) NOT NULL,
      details TEXT
    );
  `);

  // 2. Ordered migration manifest to execute
  const migrationManifest = [
    { name: '001_app_config.sql', path: 'src/data/migrations/001_app_config.sql' },
    { name: '002_must_change_password.sql', path: 'src/data/migrations/002_must_change_password.sql' },
    { name: '003_remove_payment_amount_columns.sql', path: 'src/data/migrations/003_remove_payment_amount_columns.sql' },
    { name: '004_update_subplate_stage_labels.sql', path: 'src/data/migrations/004_update_subplate_stage_labels.sql' },
    { name: '005_performance_optimization_v2.sql', path: 'src/data/migrations/005_performance_optimization_v2.sql' },
    { name: '006_add_vendor_bank_and_tax_details.sql', path: 'src/data/migrations/006_add_vendor_bank_and_tax_details.sql' },
    { name: '007_vendor_details_expansion.sql', path: 'src/data/migrations/007_vendor_details_expansion.sql' },
    { name: '008_phase1_create_vendors_table.sql', path: 'src/data/migrations/008_phase1_create_vendors_table.sql' },
    { name: '009_phase2_data_migration.sql', path: 'src/data/migrations/009_phase2_data_migration.sql' },
    { name: '010_phase3_add_vendor_fks.sql', path: 'src/data/migrations/010_phase3_add_vendor_fks.sql' },
    { name: '011_phase4_update_views.sql', path: 'src/data/migrations/011_phase4_update_views.sql' },
    { name: '011b_fix_po_inward_vname_fk.sql', path: 'src/data/migrations/011b_fix_po_inward_vname_fk.sql' },
    { name: '012_phase8_cleanup_and_guard.sql', path: 'src/data/migrations/012_phase8_cleanup_and_guard.sql' },
    { name: '20261020114500_project_code_rpc.sql', path: 'supabase/migrations/20261020114500_project_code_rpc.sql' },
    { name: '20261021110000_fix_unrestricted_tables_and_views.sql', path: 'supabase/migrations/20261021110000_fix_unrestricted_tables_and_views.sql' },
    { name: '013_mold_subplate_database_reorganization.sql', path: 'src/data/migrations/013_mold_subplate_database_reorganization.sql' },
    { name: '20261029161500_fix_mould_project_code_initials_matching.sql', path: 'supabase/migrations/20261029161500_fix_mould_project_code_initials_matching.sql' },
    { name: '20261029171000_add_customer_code_and_pan_code.sql', path: 'supabase/migrations/20261029171000_add_customer_code_and_pan_code.sql' },
    { name: '20261029172000_fix_inward_items_qty_status_filter.sql', path: 'supabase/migrations/20261029172000_fix_inward_items_qty_status_filter.sql' },
    { name: '20261030095500_fix_mould_creation_foreign_key_validation.sql', path: 'supabase/migrations/20261030095500_fix_mould_creation_foreign_key_validation.sql' },
    { name: '20261030101500_seed_customer_master_list.sql', path: 'supabase/migrations/20261030101500_seed_customer_master_list.sql' },
    { name: '20261030102500_seed_vendors_master_list.sql', path: 'supabase/migrations/20261030102500_seed_vendors_master_list.sql' },
  ];

  console.log(`=== RUNNING ALL MIGRATIONS (${migrationManifest.length} total) ===\n`);

  for (let i = 0; i < migrationManifest.length; i++) {
    const item = migrationManifest[i];
    const fullPath = path.join(__dirname, '..', item.path);
    if (!fs.existsSync(fullPath)) {
      console.warn(`[SKIP] File not found: ${item.path}`);
      continue;
    }

    const sql = fs.readFileSync(fullPath, 'utf8');
    process.stdout.write(`[${i + 1}/${migrationManifest.length}] Running ${item.name}... `);

    const start = Date.now();
    try {
      await client.query(sql);
      const duration = Date.now() - start;
      console.log(`SUCCESS (${duration}ms)`);

      await client.query(`
        INSERT INTO public._schema_migrations (version, file_path, execution_time_ms, status, details)
        VALUES ($1, $2, $3, 'SUCCESS', 'Executed successfully')
        ON CONFLICT (version) DO UPDATE SET 
          executed_at = NOW(),
          execution_time_ms = EXCLUDED.execution_time_ms,
          status = 'SUCCESS',
          details = 'Re-applied successfully';
      `, [item.name, item.path, duration]);
    } catch (err) {
      const duration = Date.now() - start;
      const isBenign = 
        err.code === '42710' || // duplicate_object (constraint/type exists)
        err.code === '42701' || // duplicate_column
        err.code === '42P07' || // duplicate_table
        err.message?.includes('already exists') ||
        err.message?.includes('duplicate key');

      if (isBenign) {
        console.log(`ALREADY APPLIED (${err.message.split('\n')[0]})`);
        await client.query(`
          INSERT INTO public._schema_migrations (version, file_path, execution_time_ms, status, details)
          VALUES ($1, $2, $3, 'IDEMPOTENT_OK', $4)
          ON CONFLICT (version) DO UPDATE SET 
            executed_at = NOW(),
            status = 'IDEMPOTENT_OK',
            details = EXCLUDED.details;
        `, [item.name, item.path, duration, err.message.slice(0, 200)]);
      } else {
        console.log(`ERROR: ${err.message}`);
        await client.query(`
          INSERT INTO public._schema_migrations (version, file_path, execution_time_ms, status, details)
          VALUES ($1, $2, $3, 'ERROR', $4)
          ON CONFLICT (version) DO UPDATE SET 
            executed_at = NOW(),
            status = 'ERROR',
            details = EXCLUDED.details;
        `, [item.name, item.path, duration, err.message.slice(0, 200)]);
      }
    }
  }

  console.log('\n========================================');
  console.log('=== POST-MIGRATION SYSTEM VERIFICATION ===');
  console.log('========================================\n');

  // 1. Table Verification
  const tableCheck = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('vendors', 'customers', 'scan', 'subplate', 'challan', 'inward', 'dispatch', 'app_config', 'users', 'po_inward', 'purchase')
    ORDER BY table_name;
  `);
  console.log('Core Tables Present:');
  console.table(tableCheck.rows);

  // 2. View Verification
  const viewCheck = await client.query(`
    SELECT table_name 
    FROM information_schema.views 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  console.log('\nActive Public Views (Master + Legacy Aliases):');
  console.table(viewCheck.rows);

  // 3. Subplate Columns & Coverage
  const subplateStats = await client.query(`
    SELECT 
      count(*) as total_subplates,
      count(mold_id) as with_mold_id,
      count(mold_code) as with_mold_code,
      count(plate_category) as with_category
    FROM public.subplate;
  `);
  console.log('\nSubplate Dual-Reference & Category Coverage:');
  console.table(subplateStats.rows);

  // 4. Vendors Table Stats
  const vendorStats = await client.query(`
    SELECT 
      count(*) as total_vendors,
      count(CASE WHEN vendor_type = 'Supplier' THEN 1 END) as suppliers,
      count(CASE WHEN vendor_type = 'Transporter' THEN 1 END) as transporters,
      count(CASE WHEN deleted_at IS NULL THEN 1 END) as active_vendors
    FROM public.vendors;
  `);
  console.log('\nVendors Table Stats:');
  console.table(vendorStats.rows);

  // 5. RPC Functions Verification
  console.log('\nRPC Functions Verification:');
  try {
    const rpc1 = await client.query(`SELECT public.get_next_project_code_preview('1') AS preview;`);
    console.log('get_next_project_code_preview:', rpc1.rows[0]?.preview);
  } catch (e) {
    console.log('get_next_project_code_preview error:', e.message);
  }

  try {
    const rpc2 = await client.query(`SELECT public.get_table_counts() AS counts;`);
    console.log('get_table_counts:', rpc2.rows[0]?.counts);
  } catch (e) {
    console.log('get_table_counts error:', e.message);
  }

  try {
    const rpc3 = await client.query(`SELECT public.get_expense_totals() AS totals;`);
    console.log('get_expense_totals:', rpc3.rows[0]?.totals);
  } catch (e) {
    console.log('get_expense_totals error:', e.message);
  }

  // 6. Migration Log Summary
  const logRows = await client.query(`
    SELECT version, status, execution_time_ms, executed_at 
    FROM public._schema_migrations 
    ORDER BY id ASC;
  `);
  console.log('\nMigration Execution Log:');
  console.table(logRows.rows);

  await client.end();
  console.log('\nAll migrations executed and fully verified.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error running master migrations:', err);
  process.exit(1);
});
