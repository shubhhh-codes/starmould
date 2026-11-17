const fs = require('node:fs/promises');
const path = require('node:path');
const { X509Certificate } = require('node:crypto');
const tls = require('node:tls');
async function install(destination) {
  const response = await fetch('https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt', { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('BACKUP_DATABASE_CA_DOWNLOAD_FAILED');
  const certificate = await response.text();
  const parsed = new X509Certificate(certificate);
  if (!parsed.ca || new Date(parsed.validTo) < new Date()) throw new Error('BACKUP_DATABASE_CA_INVALID');
  const certificates = typeof tls.getCACertificates === 'function' ? tls.getCACertificates('default') : tls.rootCertificates;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, [...certificates, certificate].join('\n'));
}
if (require.main === module) install(process.argv[2]).catch(() => { console.error('Database CA setup failed.'); process.exitCode = 1; });
module.exports = { install };
