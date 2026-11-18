const fs=require('node:fs/promises'),path=require('node:path');
const {capture}=require('./archive.cjs');
const {prepareNativeTools}=require('./native.cjs');
async function captureApplicationBackup(directory,signal,env=process.env){
 const tools=await prepareNativeTools(env);
 const prepared={...env,...tools};
 // libpq needs a certificate FILE. Hosting keeps the PEM in an environment variable.
 if(env.BACKUP_DATABASE_CA){
  const ca=path.join(directory,'database-ca.pem');
  await fs.writeFile(ca,env.BACKUP_DATABASE_CA,{mode:0o600});
  prepared.BACKUP_PGSSLROOTCERT=ca;
 }else if(env.BACKUP_DATABASE_CA_FILE)prepared.BACKUP_PGSSLROOTCERT=env.BACKUP_DATABASE_CA_FILE;
 return capture(directory,signal,prepared);
}
module.exports={captureApplicationBackup};
