/* Explicit live maintenance command. Default is a read-only preview. */
const fs=require('node:fs');
const path=require('node:path');
const {Client}=require('pg');
const {createClient}=require('@supabase/supabase-js');
const {createTypeScriptLoader}=require('./lib/load-typescript.cjs');

async function main(){
  try {process.loadEnvFile('.env.local');} catch {}
  const apply=process.argv.includes('--apply');
  const run=apply || process.argv.includes('--run');
  const client=new Client({connectionString:process.env.DATABASE_URL?.replace(/^['"]|['"]$/g,''),ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
  await client.connect();
  try{
    if(apply){
      await client.query("SELECT pg_advisory_lock(hashtext('starmould-photo-storage-layout-v1'))");
      for(const [version,name] of [['20261116180000','photo_storage_layout'],['20261116181000','flat_unlinked_photo_folders'],['20261116182000','photo_storage_delete_race']]){
      const exists=await client.query('SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=$1',[version]);
      if(!exists.rowCount){
        const sql=fs.readFileSync(path.resolve(__dirname,`../supabase/migrations/${version}_${name}.sql`),'utf8').replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,'');
        await client.query('BEGIN');
        try{
          await client.query(sql);
          await client.query("INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)",[version,name,[sql]]);
          await client.query('COMMIT');
          console.log(`Applied ${name} migration.`);
        }catch(error){await client.query('ROLLBACK');throw error;}
      }
      }
      await client.query("SELECT pg_advisory_unlock(hashtext('starmould-photo-storage-layout-v1'))");
    }
    if(run){
      // Explicitly inject the live server client into the shared TS loader. Offline tests retain their DB guard.
      const supabaseAdmin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      for(let attempt=0;attempt<10;attempt++){
        const ready=await supabaseAdmin.from('photo_storage_moves').select('photo_id').limit(0);
        if(!ready.error)break;
        if(attempt===9)throw new Error('Storage schema is not available yet; rerun with --run after schema reload.');
        await new Promise(resolve=>setTimeout(resolve,500));
      }
      const load=createTypeScriptLoader(path.resolve(__dirname,'..'),{'@/lib/supabase/admin':{supabaseAdmin}});
      const {runPhotoStorageMoves}=load(path.resolve(__dirname,'../src/lib/photos/storage-moves.ts'));
      const totals={moved:0,unchanged:0,failed:0,cleaned:0};
      for(let i=0;i<100;i++){
        const result=await runPhotoStorageMoves(20);
        for(const key of Object.keys(totals))totals[key]+=result[key];
        if(!result.moved&&!result.unchanged&&!result.failed&&!result.cleaned)break;
      }
      console.log('Storage maintenance:',totals);
    }
    console.log('Active photo folders:',(await client.query("SELECT split_part(r2_key,'/',1) folder,count(*)::int photos FROM public.movement_photos WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 1")).rows);
    const installed=await client.query("SELECT to_regclass('public.photo_storage_moves') present");
    if(installed.rows[0].present){
      console.log('Queue:',(await client.query('SELECT count(*) FILTER(WHERE revision>applied_revision)::int pending,count(*) FILTER(WHERE last_error IS NOT NULL)::int errors FROM public.photo_storage_moves')).rows[0]);
      console.log('Old copies awaiting cleanup:',(await client.query('SELECT count(*)::int total FROM public.photo_storage_old_keys')).rows[0].total);
    }
  }finally{await client.end();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
