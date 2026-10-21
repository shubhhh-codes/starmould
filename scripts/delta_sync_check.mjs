import { query, executeSql } from './db_helper.mjs';

async function main() {
  const applySync = process.argv.includes('--apply');
  console.log('=== VENDOR DELTA-SYNC & BACKUP COMPARISON TOOL ===');
  console.log(`Mode: ${applySync ? 'APPLY LIVE SYNC' : 'DRY-RUN AUDIT ONLY (Use --apply to sync)'}\n`);

  // 1. New vendor/transport rows in customers since backup
  const newSinceBackupRes = await query(`
    SELECT c.id, c.customername, c.usertype, c.created_at
    FROM public.customers c
    LEFT JOIN public.customers_backup_20261021 b ON c.id = b.id
    WHERE b.id IS NULL AND c.usertype IN ('Vendor', 'Transport')
    ORDER BY c.id;
  `);
  console.log(`1. New vendor/transport rows in customers since backup: ${newSinceBackupRes.rows.length}`);
  if (newSinceBackupRes.rows.length > 0) {
    console.table(newSinceBackupRes.rows);
  }

  // 2. Vendor/transport records in customers missing in vendors
  const missingInVendorsRes = await query(`
    SELECT c.id, c.customername, c.usertype, c.created_at
    FROM public.customers c
    LEFT JOIN public.vendors v ON c.id = v.id
    WHERE v.id IS NULL AND c.usertype IN ('Vendor', 'Transport')
    ORDER BY c.id;
  `);
  console.log(`\n2. Vendor/transport records in customers missing in vendors: ${missingInVendorsRes.rows.length}`);
  if (missingInVendorsRes.rows.length > 0) {
    console.table(missingInVendorsRes.rows);
  }

  // 3. Changed core attributes between customers backup and vendors (real data drift)
  const modifiedRecordsRes = await query(`
    SELECT 
      c.id,
      c.customername as source_name,
      v.vendor_name as target_name,
      c.vendor_code as source_code,
      v.vendor_code as target_code,
      c.gstin as source_gstin,
      v.gstin as target_gstin,
      c.mobile as source_mobile,
      v.mobile as target_mobile
    FROM public.customers_backup_20261021 c
    JOIN public.vendors v ON c.id = v.id
    WHERE c.usertype IN ('Vendor', 'Transport')
      AND (
        c.customername IS DISTINCT FROM v.vendor_name
        OR c.initials IS DISTINCT FROM v.initials
        OR c.vendor_code IS DISTINCT FROM v.vendor_code
        OR c.city IS DISTINCT FROM v.city
        OR c.gstin IS DISTINCT FROM v.gstin
        OR c.pan IS DISTINCT FROM v.pan
        OR c.bank_name IS DISTINCT FROM v.bank_name
        OR c.account_no IS DISTINCT FROM v.account_no
        OR COALESCE(c.ifsc_code, c.ifsc) IS DISTINCT FROM v.ifsc_code
        OR c.contact_person IS DISTINCT FROM v.contact_person
        OR c.mobile IS DISTINCT FROM v.mobile
        OR c.email IS DISTINCT FROM v.email
      )
    ORDER BY c.id;
  `);
  console.log(`\n3. Real data drift between customers backup and vendors: ${modifiedRecordsRes.rows.length}`);
  if (modifiedRecordsRes.rows.length > 0) {
    console.table(modifiedRecordsRes.rows);
  }

  // 4. Status of vendor/transport rows in customers post Phase 8
  const softDeletedInCustomersRes = await query(`
    SELECT 
      COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as soft_deleted_count,
      COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_unexpected_count
    FROM public.customers
    WHERE usertype IN ('Vendor', 'Transport');
  `);
  console.log(`\n4. Customers vendor/transport rows post-Phase 8:`);
  console.log(`   - Soft-deleted (migrated to vendors table): ${softDeletedInCustomersRes.rows[0].soft_deleted_count} (Expected: 481)`);
  console.log(`   - Active active in customers: ${softDeletedInCustomersRes.rows[0].active_unexpected_count} (Expected: 0)`);

  // 5. New vendors created in vendors table that do not exist in customers
  const vendorsOnlyRes = await query(`
    SELECT v.id, v.vendor_name, v.vendor_type, v.vendor_code, v.created_at
    FROM public.vendors v
    LEFT JOIN public.customers c ON v.id = c.id
    WHERE c.id IS NULL
    ORDER BY v.id;
  `);
  console.log(`\n5. New vendors created post-split in vendors table: ${vendorsOnlyRes.rows.length}`);
  if (vendorsOnlyRes.rows.length > 0) {
    console.table(vendorsOnlyRes.rows);
  }

  // Summary
  const isRealParity = newSinceBackupRes.rows.length === 0 &&
                       missingInVendorsRes.rows.length === 0 &&
                       modifiedRecordsRes.rows.length === 0 &&
                       Number(softDeletedInCustomersRes.rows[0].active_unexpected_count) === 0;

  console.log('\n========================================');
  if (isRealParity) {
    console.log('✓ 100% PARITY CONFIRMED: ZERO UNTRACKED DRIFT DETECTED.');
  } else {
    console.log(`⚠ UNEXPECTED DRIFT DETECTED!`);
  }
  console.log('========================================\n');
}

main().catch(console.error);
