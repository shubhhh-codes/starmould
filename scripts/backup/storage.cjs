const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { S3Client, PutObjectCommand, GetObjectCommand, CreateMultipartUploadCommand,
  UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
  ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { digest } = require('./archive.cjs');

function storageConfig(env = process.env) {
  const bucket = env.BACKUP_R2_BUCKET;
  const account = env.BACKUP_R2_ACCOUNT_ID;
  const accessKeyId = env.BACKUP_R2_ACCESS_KEY_ID;
  const secretAccessKey = env.BACKUP_R2_SECRET_ACCESS_KEY;
  if (!bucket || !account || !accessKeyId || !secretAccessKey) throw new Error('BACKUP_STORAGE_NOT_CONFIGURED');
  return { bucket, client: new S3Client({ region: 'auto',
    endpoint: `https://${account}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED', maxAttempts: 3,
    requestHandler: { connectionTimeout: 10000, requestTimeout: 60000 } }) };
}
class Storage {
  constructor(config = storageConfig()) { this.client = config.client; this.bucket = config.bucket; }
  async uploadFile(key, file, signal) {
    const size = (await fsp.stat(file)).size;
    const base = { Bucket: this.bucket, Key: key, ContentType: 'application/octet-stream' };
    if (size <= 8 * 1024 * 1024) {
      await this.client.send(new PutObjectCommand({ ...base, Body: fs.createReadStream(file), ContentLength: size }), { abortSignal: signal });
      return;
    }
    const { UploadId } = await this.client.send(new CreateMultipartUploadCommand(base), { abortSignal: signal });
    const handle = await fsp.open(file, 'r');
    try {
      const parts = []; let position = 0;
      while (position < size) {
        const body = Buffer.alloc(Math.min(8 * 1024 * 1024, size - position));
        const { bytesRead } = await handle.read(body, 0, body.length, position);
        if (bytesRead !== body.length) throw new Error('BACKUP_FILE_READ_FAILED');
        const PartNumber = parts.length + 1;
        const { ETag } = await this.client.send(new UploadPartCommand({ Bucket: this.bucket, Key: key,
          UploadId, PartNumber, Body: body }), { abortSignal: signal });
        parts.push({ ETag, PartNumber }); position += bytesRead;
      }
      await this.client.send(new CompleteMultipartUploadCommand({ Bucket: this.bucket, Key: key,
        UploadId, MultipartUpload: { Parts: parts } }), { abortSignal: signal });
    } catch (error) {
      await this.client.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId })).catch(() => {});
      throw error;
    } finally { await handle.close(); }
  }
  async verify(key, expected, signal) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }), { abortSignal: signal });
    const actual = await digest(response.Body);
    if (actual.sha256 !== expected.sha256 || actual.size !== expected.size) throw new Error('BACKUP_CHECKSUM_MISMATCH');
  }
  async deleteKeys(keys) {
    if (!keys.length) return;
    const result = await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket,
      Delete: { Objects: keys.map(Key => ({ Key })), Quiet: true } }));
    if (result.Errors?.length) throw new Error('BACKUP_RETENTION_DELETE_FAILED');
  }
  async cleanupOrphans(referencedPrefixes, now = Date.now()) {
    let ContinuationToken;
    do {
      const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket,
        Prefix: 'database/', ContinuationToken }));
      const keys = (page.Contents || []).filter(object => object.LastModified &&
        now - object.LastModified.getTime() > 7 * 86400000 &&
        !referencedPrefixes.some(prefix => object.Key.startsWith(prefix + '/'))).map(object => object.Key);
      await this.deleteKeys(keys);
      ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (ContinuationToken);
  }
}
module.exports = { storageConfig, Storage };
