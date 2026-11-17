/* Integration test: all DDL/fixtures live in an isolated schema and are rolled back. No R2 access. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { Client } = require('pg');

async function main() {
  try { process.loadEnvFile('.env.local'); } catch {}
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required for isolated SQL tests');
  const client = new Client({ connectionString: process.env.DATABASE_URL.replace(/^['"]|['"]$/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  const schema = 'photo_history_test_' + crypto.randomBytes(6).toString('hex');
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout='30s'; CREATE SCHEMA ${schema}; SET LOCAL search_path=${schema},pg_temp`);
    for (const table of ['users','vendors','customers','scan','subplate','purchase','po_inward','challan','inward','dispatch','movement_photos','photo_project_associations','photo_event_associations','inventory_requests']) {
      await client.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
    }
    // The real core RPC is not rewritten by the migration. Stub only its return contract here.
    const stubCore = `CREATE OR REPLACE FUNCTION ${schema}.create_inventory_document_before_photo_history(p_operation text,p_actor bigint,p_key text,p_body jsonb)
      RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE result jsonb; BEGIN
      SELECT to_jsonb(d) || jsonb_build_object('items','[]'::jsonb) INTO result FROM ${schema}.po_inward d WHERE id=(p_body->>'fixtureDocumentId')::bigint;
      INSERT INTO ${schema}.inventory_requests(actor_id,operation,request_key,request_payload,result) VALUES(p_actor,p_operation,p_key,p_body,result);
      RETURN result; END $$`;
    const sql = fs.readFileSync('supabase/migrations/20261116170000_photo_history_gallery.sql', 'utf8')
      .replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '').replaceAll('public.', schema + '.').replaceAll('search_path=public,pg_temp', `search_path=${schema},pg_temp`);
    await client.query(sql);
    await client.query(stubCore);
    const insert = async (table, values) => {
      const required = await client.query(`SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND is_nullable='NO' AND column_default IS NULL AND is_identity='NO'`, [schema, table]);
      for (const c of required.rows) if (!(c.column_name in values)) values[c.column_name] = c.data_type.includes('int') || c.data_type === 'numeric' ? 1 : c.data_type === 'date' ? '2026-11-16' : c.data_type === 'jsonb' ? {} : 'Fixture';
      const keys = Object.keys(values);
      await client.query(`INSERT INTO ${schema}.${table}(${keys.join(',')}) OVERRIDING SYSTEM VALUE VALUES(${keys.map((_, i) => '$' + (i + 1)).join(',')})`, Object.values(values));
    };
    await insert('users', { id: 1, name: 'Gallery tester', email: 'gallery@test.invalid', username: 'gallery_test', initials: 'GT', role_id: 0 });
    await insert('vendors', { id: 1, vendor_name: 'Test jobber' });
    await insert('customers', { id: 1, customername: 'Test customer' });
    await insert('scan', { id: 1, projectid: 'TEST_PROJECT' });
    await insert('subplate', { id: 1, platename: 'Plate one', projectid: 'TEST_PROJECT' });
    await insert('purchase', { id: 1, srno: 'PO_ONE', projectid: 'TEST_PROJECT' });
    for (const id of [1,2]) await insert('po_inward', { id, pid: 1, insrno: 'RECEIPT_' + id, projectid: 'TEST_PROJECT', vname: 1, cname: 1 });
    await insert('challan', { id: 1, challanno: 'OUT_ONE', vendorid: 1, customerid: 1, vendortid: 1 });
    for (const id of [1,2]) await insert('inward', { id, challanid: 1, inchallanno: 'RETURN_' + id, vendorid: 1, vendortid: 1 });
    const photo = async (id, type, extra = {}) => insert('movement_photos', { id, r2_key: 'test/' + id, original_filename: id + '.webp', file_size_bytes: 100, movement_type: type, watermark_text: 'fixture', uploaded_by: 1, ...extra });
    await photo(1, 'purchase_inward'); await photo(2, 'purchase_inward');
    await photo(3, 'jobwork_outward'); await photo(4, 'jobwork_inward'); await photo(5, 'jobwork_inward');
    await photo(6, 'subplate_qc', { subplate_id: 1, stage_key: 'vmc_qcby' });
    await photo(7, 'subplate_qc', { subplate_id: 1, stage_key: 'final_qcby' });
    await photo(8, 'packing', { subplate_id: 1, stage_key: 'packing_workby' });
    const link = (id, type, document) => client.query(`INSERT INTO ${schema}.photo_event_associations(photo_id,event_id,movement_type,document_id) VALUES($1,$2,$3,$4)`, [id, type + ':' + document, type, document]);
    await link(1,'purchase_inward',1); await link(1,'purchase_inward',2); await link(2,'purchase_inward',2);
    await link(3,'jobwork_outward',1); await link(4,'jobwork_inward',1); await link(5,'jobwork_inward',2);
    const page = async (scope, children = true, args = {}) => (await client.query(`SELECT ${schema}.photo_history_page($1,$2,$3,$4,$5) AS value`, [scope, children, args.groupOffset || 0, args.groupId || null, args.photoOffset || 0])).rows[0].value;
    const scope = (kind, id = 1, stageKey) => ({kind,id,...(stageKey ? {stageKey} : {})});
    let p = await page(scope('purchase_order'));
    assert.equal(p.summary.availableCount, 2); assert.equal(p.groups.length, 2);
    assert.equal((await page(scope('purchase_receipt'))).summary.availableCount,1);
    assert.equal((await page(scope('purchase_order'),false)).summary.availableCount,0);
    p = await page(scope('jobwork_outward')); assert.equal(p.groups.length,3); assert.equal(p.summary.availableCount,3); assert.match(p.groups[0].title,/Sent/);
    assert.equal((await page(scope('jobwork_receipt'))).summary.availableCount,1);
    assert.equal((await page(scope('jobwork_outward'),false)).summary.availableCount,1);
    for (const stage of ['vmc_qcby','final_qcby','packing_workby']) assert.equal((await page(scope('stage',1,stage))).summary.availableCount,1);
    await client.query(`UPDATE ${schema}.movement_photos SET deleted_at=now(),deletion_reason='Automatic retention expired' WHERE id=1`);
    p = await page(scope('purchase_order')); assert.equal(p.summary.availableCount,1); assert.equal(p.summary.expiredCount,1);
    await client.query(`UPDATE ${schema}.movement_photos SET deleted_at=now(),deletion_reason='Manual removal' WHERE id=2`);
    p = await page(scope('purchase_order')); assert.equal(p.summary.removedCount,1);
    for (let id=10;id<40;id++) { await photo(id,'purchase_inward'); await link(id,'purchase_inward',1); }
    p = await page(scope('purchase_receipt')); assert.equal(p.summary.availableCount,30); assert.equal(p.groups[0].photos.length,24); assert.equal(p.groups[0].nextPhotoOffset,24);
    p = await page(scope('purchase_receipt'),true,{groupId:'purchase_inward:1',photoOffset:24}); assert.equal(p.groups[0].photos.length,6); assert.equal(p.groups[0].nextPhotoOffset,null);
    await photo(50,'purchase_inward');
    const payload = {fixtureDocumentId:1,photoIds:[50],photoBatchId:'batch_test_0001'};
    const create = (key, body) => client.query(`SELECT ${schema}.create_inventory_document('purchase-receipt',1,$1,$2) AS value`,[key,body]);
    await create('request_test_0001',payload);
    assert.equal((await page(scope('purchase_receipt'))).summary.availableCount,31);
    await client.query(`UPDATE ${schema}.movement_photos SET deleted_at=now() WHERE id=50`);
    assert.equal((await create('request_test_0001',payload)).rows[0].value.id,1,'successful replay survives later photo expiry');
    await client.query('SAVEPOINT invalid_evidence');
    await assert.rejects(create('request_test_0002',{...payload,photoIds:[]}),/At least one valid photo/);
    await client.query('ROLLBACK TO SAVEPOINT invalid_evidence');
    await photo(51,'purchase_inward');
    await client.query(`CREATE FUNCTION ${schema}.reject_test_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.photo_id=51 THEN RAISE EXCEPTION 'Injected linking failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_test_link BEFORE INSERT ON ${schema}.photo_event_associations FOR EACH ROW EXECUTE FUNCTION ${schema}.reject_test_link()`);
    await client.query('SAVEPOINT failed_link');
    await assert.rejects(create('request_test_rollback',{...payload,photoIds:[51]}),/Injected linking failure/);
    await client.query('ROLLBACK TO SAVEPOINT failed_link');
    assert.equal((await client.query(`SELECT count(*)::int AS n FROM ${schema}.inventory_requests WHERE request_key='request_test_rollback'`)).rows[0].n,0);
    await photo(60,'purchase_inward');
    const unlinked = (await client.query(`SELECT ${schema}.photo_history_unlinked(0) AS value`)).rows[0].value;
    assert.ok(unlinked.photos.some(p=>p.id===60));
    await client.query(`SELECT ${schema}.photo_history_recover(60,ARRAY[1,2]::bigint[],1,'Verified fixture receipts')`);
    assert.equal((await client.query(`SELECT count(*)::int AS n FROM ${schema}.photo_event_associations WHERE photo_id=60 AND document_id IS NOT NULL`)).rows[0].n,2);
    assert.equal((await client.query(`SELECT count(*)::int AS n FROM ${schema}.photo_history_recovery_log WHERE photo_id=60`)).rows[0].n,1);
    await client.query('SAVEPOINT duplicate_recovery');
    await assert.rejects(client.query(`SELECT ${schema}.photo_history_recover(60,ARRAY[1]::bigint[],1,'Duplicate recovery')`),/already linked/);
    await client.query('ROLLBACK TO SAVEPOINT duplicate_recovery');
    for(let id=3;id<25;id++) await insert('po_inward',{id,pid:1,insrno:'RECEIPT_'+id,projectid:'TEST_PROJECT',vname:1,cname:1});
    p=await page(scope('purchase_order')); assert.equal(p.groups.length,20); assert.equal(p.nextGroupOffset,20);
    p=await page(scope('purchase_order'),true,{groupOffset:20});assert.equal(p.groups.length,4);assert.equal(p.nextGroupOffset,null);
    console.log('PASS: isolated SQL migration, receipt/PO and outward/return isolation, shared counts, child access mask, stage separation, expired/removed states, photo/group pagination, atomic linking/replay/rollback and audited recovery.');
  } finally { await client.query('ROLLBACK').catch(()=>{}); await client.end(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
