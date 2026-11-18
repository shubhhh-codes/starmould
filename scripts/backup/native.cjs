const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createHash}=require('node:crypto'),{gunzipSync}=require('node:zlib');
let installation;
async function prepareNativeTools(env=process.env,platform=process.platform,arch=process.arch){
 if(env.PG_DUMP_BIN&&env.PG_RESTORE_BIN)return{PG_DUMP_BIN:env.PG_DUMP_BIN,PG_RESTORE_BIN:env.PG_RESTORE_BIN};
 if(!['linux','win32'].includes(platform)||arch!=='x64')throw Error('BACKUP_NATIVE_PLATFORM_UNSUPPORTED');
 if(!installation)installation=install(platform).catch(error=>{installation=undefined;throw error;});
 return installation;
}
async function install(platform){
 const asset=path.join(process.cwd(),'scripts','backup','native',platform==='win32'?'windows-x64':'linux-x64');
 const manifest=JSON.parse(await fs.readFile(path.join(asset,'manifest.json'),'utf8'));
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'starmould-pg17-'));
 for(const file of manifest.files){
  if(!/^[a-zA-Z0-9_.-]+$/.test(file.name))throw Error('BACKUP_NATIVE_MANIFEST_INVALID');
  const bytes=gunzipSync(await fs.readFile(path.join(asset,file.name+'.gz')));
  if(bytes.length!==file.size||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('BACKUP_NATIVE_INTEGRITY_FAILED');
  await fs.writeFile(path.join(directory,file.name),bytes,{mode:0o700});
 }
 const suffix=platform==='win32'?'.exe':'';
 return{PG_DUMP_BIN:path.join(directory,'pg_dump'+suffix),PG_RESTORE_BIN:path.join(directory,'pg_restore'+suffix)};
}
module.exports={prepareNativeTools};
