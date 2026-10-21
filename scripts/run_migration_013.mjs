import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeSql, query } from './db_helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const sqlFile = path.join(__dirname, '..', 'src', 'data', 'migrations', '013_mold_subplate_database_reorganization.sql');
  console.log(`Reading SQL migration from: ${sqlFile}`);
  const sql = fs.readFileSync(sqlFile, 'utf8');

  console.log('Executing Migration 013...');
  const startTime = Date.now();
  await executeSql(sql);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Migration 013 executed successfully in ${elapsed}s!`);

  console.log('\n--- Verification & Sanity Checks ---');

  const colCheck = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'subplate' 
      AND column_name IN ('mold_id', 'mold_code', 'plate_category')
    ORDER BY column_name;
  `);
  console.log('New columns present in subplate:');
  console.table(colCheck.rows);

  const backfillCheck = await query(`
    SELECT 
      count(*) as total_subplates,
      count(mold_id) as populated_mold_id,
      count(mold_code) as populated_mold_code,
      count(plate_category) as populated_category
    FROM public.subplate;
  `);
  console.log('Backfill coverage:');
  console.table(backfillCheck.rows);

  const catBreakdown = await query(`
    SELECT plate_category, count(*) as count 
    FROM public.subplate 
    GROUP BY plate_category 
    ORDER BY count DESC;
  `);
  console.log('Plate category distribution:');
  console.table(catBreakdown.rows);

  const view1Sample = await query(`
    SELECT mold_id, mold_code, mold_name, customer_name, total_subplates, completed_subplates, completion_percentage
    FROM public.view_molds_overview
    WHERE total_subplates > 0
    ORDER BY total_subplates DESC
    LIMIT 5;
  `);
  console.log('Master View 1 (view_molds_overview) sample:');
  console.table(view1Sample.rows);

  const view2Sample = await query(`
    SELECT subplate_id, mold_code, plate_name, category, dimensions, current_stage, current_location
    FROM public.view_subplates_detail
    LIMIT 5;
  `);
  console.log('Master View 2 (view_subplates_detail) sample:');
  console.table(view2Sample.rows);

  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
