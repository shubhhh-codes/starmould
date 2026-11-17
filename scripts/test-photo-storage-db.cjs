/* All schema changes and fixture rows are rolled back. No R2 calls. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {Client}=require('pg');
async function main(){
  process.loadEnvFile('.env.local');
  const db=new Client({connectionString:process.env.DATABASE_URL.replace(/^['"]|['"]$/g,''),ssl:{rejectUnauthorized:false}});
  await db.connect();const schema='photo_storage_test_'+Date.now();
  try{
    await db.query('BEGIN');
    await db.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path=${schema}; SET LOCAL statement_timeout='30s'`);
    await db.query(`CREATE TABLE ${schema}.movement_photos(id bigint PRIMARY KEY,r2_key text,deleted_at timestamptz,subplate_id bigint,stage_key text,movement_type text);
      CREATE TABLE ${schema}.photo_upload_attempts(photo_id bigint,reserved_r2_key text);
      CREATE TABLE ${schema}.photo_project_associations(photo_id bigint,project_code text);
      CREATE TABLE ${schema}.photo_event_associations(photo_id bigint,event_id text);`);
    let sql=fs.readFileSync('supabase/migrations/20261116180000_photo_storage_layout.sql','utf8').replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,'').replace(/\bpublic\b/g,schema).replace("NOTIFY pgrst,'reload schema';",'');
    await db.query(sql);
    const deletionSql=fs.readFileSync('supabase/migrations/20261116182000_photo_storage_delete_race.sql','utf8').replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,'').replace(/\bpublic\b/g,schema);
    await db.query(deletionSql);
    await db.query(`INSERT INTO ${schema}.movement_photos(id,r2_key) VALUES(1,'old/1'),(2,'old/2'); INSERT INTO ${schema}.photo_upload_attempts VALUES(1,'old/1')`);
    const claim=async(ids)=> (await db.query(`SELECT ${schema}.claim_photo_storage_move($1) value`,[ids])).rows[0].value;
    const finish=async(j,target,error=null)=>(await db.query(`SELECT ${schema}.finish_photo_storage_move($1,$2,$3,$4,$5,$6) value`,[j.photo.id,j.token,j.revision,j.photo.r2_key,target,error])).rows[0].value;
    const release=j=>db.query(`SELECT ${schema}.release_photo_storage_move($1,$2)`,[j.photo.id,j.token]);
    let j=await claim([1]);assert.ok(j);assert.equal(await claim([1]),null,'active lease prevents duplicate workers');
    await db.query(`INSERT INTO ${schema}.photo_project_associations VALUES(1,'MOULD-A')`);
    assert.equal(await finish(j,'new/stale'),false,'changed associations cannot publish stale folder');
    assert.equal((await db.query(`SELECT r2_key FROM ${schema}.movement_photos WHERE id=1`)).rows[0].r2_key,'old/1');
    await release(j);j=await claim([1]);
    assert.equal((await db.query(`SELECT ${schema}.prepare_photo_storage_move($1,$2,$3) value`,[1,j.token,'new/1'])).rows[0].value,true);
    assert.equal(await finish(j,'new/1'),true);
    assert.equal((await db.query(`SELECT reserved_r2_key FROM ${schema}.photo_upload_attempts WHERE photo_id=1`)).rows[0].reserved_r2_key,'new/1');
    assert.equal(await claim([1]),null,'lease remains held throughout old-object cleanup');
    assert.ok((await db.query(`SELECT 1 FROM ${schema}.photo_storage_old_keys WHERE object_key='old/1'`)).rowCount);
    assert.equal((await db.query(`SELECT 1 FROM ${schema}.photo_storage_old_keys WHERE object_key='new/1'`)).rowCount,0);
    await release(j);
    let other=await claim([2]);assert.equal(await finish({...other,token:'00000000-0000-0000-0000-000000000000'},'bad'),false);
    await db.query(`UPDATE ${schema}.movement_photos SET deleted_at=now() WHERE id=2`);
    assert.equal((await db.query(`SELECT revision FROM ${schema}.photo_storage_moves WHERE photo_id=2`)).rows[0].revision,'2','deletion requeues final object cleanup even if the pointer moved');
    assert.equal(await finish(other,'new/2'),false,'retention deletion cannot be resurrected by migration');await release(other);
    await db.query(`UPDATE ${schema}.photo_storage_moves SET retry_at=now() WHERE photo_id=1`);j=await claim([1]);
    assert.equal(await finish(j,'new/retry','network failure'),false);
    assert.equal((await db.query(`SELECT r2_key FROM ${schema}.movement_photos WHERE id=1`)).rows[0].r2_key,'new/1');
    assert.equal(await claim([1]),null,'failed moves back off');
    assert.equal((await db.query(`SELECT has_function_privilege('authenticated',$1,'EXECUTE') value`,[`${schema}.claim_photo_storage_move(bigint[])`])).rows[0].value,false);
    await db.query(`INSERT INTO ${schema}.movement_photos(id,r2_key) VALUES(3,'MOULD-A/purchase_inward/_unlinked-PHOTO-3/file.webp')`);
    const flatten=fs.readFileSync('supabase/migrations/20261116181000_flat_unlinked_photo_folders.sql','utf8').replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,'').replace(/\bpublic\b/g,schema);
    await db.query(flatten);
    assert.equal((await db.query(`SELECT revision FROM ${schema}.photo_storage_moves WHERE photo_id=3`)).rows[0].revision,'2','flatten migration requeues legacy per-photo folders');
    console.log('PASS: isolated SQL queue, trigger revisions, leases, atomic pointer/retry updates, stale-context rejection, retention race, durable cleanup, backoff and service-only access.');
  } finally {await db.query('ROLLBACK');await db.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
