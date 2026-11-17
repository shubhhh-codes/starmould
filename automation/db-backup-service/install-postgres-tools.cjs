/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS operations tool. */
// Portable client tools only: no database server/service is installed.
const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const { promisify } = require('node:util');
const exec = promisify(require('node:child_process').execFile);
const URL = 'https://get.enterprisedb.com/postgresql/postgresql-17.12-1-windows-x64-binaries.zip';
async function range(start, end) {
  const response = await fetch(URL, { headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(60000) });
  if (response.status !== 206) { await response.body?.cancel(); throw new Error('Official archive does not support partial download'); }
  return Buffer.from(await response.arrayBuffer());
}
async function install(destination = path.resolve(__dirname, '../../.backup-tools/postgres17/bin')) {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('This installer targets Windows x64');
  const root = path.resolve(__dirname, '../../.backup-tools');
  destination = path.resolve(destination);
  if (!destination.startsWith(root + path.sep)) throw new Error('Tool destination must be inside .backup-tools');
  const head = await fetch(URL, { method: 'HEAD', signal: AbortSignal.timeout(20000) });
  const size = Number(head.headers.get('content-length'));
  if (!head.ok || !size) throw new Error('Official PostgreSQL archive is unavailable');
  const tail = await range(size - 131072, size - 1);
  let end = tail.length - 22;
  while (end >= 0 && tail.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('Invalid archive directory');
  const offset = tail.readUInt32LE(end + 16), length = tail.readUInt32LE(end + 12);
  const directory = await range(offset, offset + length - 1);
  const entries = []; let cursor = 0;
  while (cursor + 46 <= directory.length && directory.readUInt32LE(cursor) === 0x02014b50) {
    const nameLength = directory.readUInt16LE(cursor + 28), extra = directory.readUInt16LE(cursor + 30), comment = directory.readUInt16LE(cursor + 32);
    const name = directory.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    if (/^pgsql\/bin\/(pg_dump\.exe|pg_restore\.exe|[^/\\]+\.dll)$/.test(name)) {
      entries.push({ name: path.basename(name), method: directory.readUInt16LE(cursor + 10),
        crc: directory.readUInt32LE(cursor + 16), compressed: directory.readUInt32LE(cursor + 20),
        size: directory.readUInt32LE(cursor + 24), offset: directory.readUInt32LE(cursor + 42) });
    }
    cursor += 46 + nameLength + extra + comment;
  }
  if (!entries.some(entry => entry.name === 'pg_dump.exe') || !entries.some(entry => entry.name === 'pg_restore.exe')) throw new Error('Required tools are absent');
  await fs.mkdir(destination, { recursive: true });
  for (const entry of entries) {
    if (entry.size > 100 * 1024 * 1024) throw new Error('Unexpected tool archive size');
    const header = await range(entry.offset, entry.offset + 29);
    const start = entry.offset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
    const compressed = await range(start, start + entry.compressed - 1);
    if (![0, 8].includes(entry.method)) throw new Error('Unsupported archive compression');
    const body = entry.method === 8 ? zlib.inflateRawSync(compressed, { maxOutputLength: 100 * 1024 * 1024 }) : compressed;
    if (body.length !== entry.size || zlib.crc32(body) !== entry.crc) throw new Error('Tool archive integrity check failed');
    await fs.writeFile(path.join(destination, entry.name), body);
  }
  await exec(path.join(destination, 'pg_dump.exe'), ['--version'], { windowsHide: true });
  await exec(path.join(destination, 'pg_restore.exe'), ['--version'], { windowsHide: true });
  await require('../../scripts/backup/certificates.cjs').install(path.join(root, 'supabase-ca.crt'));
  console.log('Portable PostgreSQL 17 dump/restore tools installed and verified.');
  return destination;
}
if (require.main === module) install().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { install };
