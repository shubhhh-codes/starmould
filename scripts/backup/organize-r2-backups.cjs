const { storageConfig } = require('./storage.cjs');
const { createPool } = require('./control.cjs');
const {
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand
} = require('@aws-sdk/client-s3');

async function organizeR2Backups() {
  if (process.loadEnvFile) {
    try { process.loadEnvFile('.env.local'); } catch {}
  }

  const { client, bucket } = storageConfig();
  console.log(`[R2 Organize] Connecting to bucket: ${bucket}...`);

  // 1. List all objects
  let continuationToken;
  const allObjects = [];
  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken
    }));
    allObjects.push(...(res.Contents || []));
    continuationToken = res.IsTruncated ? res.NextContinuationToken : null;
  } while (continuationToken);

  console.log(`[R2 Organize] Found ${allObjects.length} total objects in bucket.`);

  const keyMapping = new Map(); // oldKey -> newKey
  const toDelete = [];

  for (const item of allObjects) {
    const key = item.Key;
    if (!key) continue;

    // Check if it's staging
    if (key.startsWith('database-staging/')) {
      console.log(`[R2 Organize] Cleaning staging artifact: ${key}`);
      toDelete.push(key);
      continue;
    }

    // Check if it's in database/
    if (key.startsWith('database/')) {
      const filename = key.split('/').at(-1);
      if (!filename || !filename.endsWith('.sql')) {
        continue;
      }

      // Check if it's already clean:
      // Pattern 1: database/manual/starmould_backup_...
      // Pattern 2: database/YYYY-MM-DD/starmould_backup_...
      const parts = key.split('/');
      const isClean = (parts.length === 3) && (parts[1] === 'manual' || /^\d{4}-\d{2}-\d{2}$/.test(parts[1]));

      if (isClean) {
        console.log(`[R2 Organize] Already clean: ${key}`);
        continue;
      }

      // Determine clean key
      let targetFolder = 'database/manual';
      if (key.includes('/manual/')) {
        targetFolder = 'database/manual';
      } else {
        const dateMatch = key.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          targetFolder = `database/${dateMatch[1]}`;
        }
      }

      const newKey = `${targetFolder}/${filename}`;
      console.log(`[R2 Organize] Mapping:\n  FROM: ${key}\n  TO:   ${newKey}`);
      keyMapping.set(key, newKey);
    }
  }

  // 2. Copy and delete for each mapped key
  for (const [oldKey, newKey] of keyMapping.entries()) {
    console.log(`[R2 Organize] Copying ${oldKey} -> ${newKey}...`);
    await client.send(new CopyObjectCommand({
      Bucket: bucket,
      CopySource: encodeURIComponent(`${bucket}/${oldKey}`),
      Key: newKey
    }));
    console.log(`[R2 Organize] Deleting old key: ${oldKey}...`);
    await client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: oldKey
    }));
  }

  // 3. Delete staging objects
  for (const key of toDelete) {
    await client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    }));
  }

  // 4. Update backup_control.jobs in PostgreSQL
  let pool;
  try {
    pool = createPool();
    const { rows: jobs } = await pool.query(
      `SELECT id, manifest FROM backup_control.jobs WHERE status='completed' AND manifest IS NOT NULL`
    );

    let updatedCount = 0;
    for (const job of jobs) {
      let modified = false;
      const manifest = job.manifest;
      if (manifest && Array.isArray(manifest.files)) {
        for (const file of manifest.files) {
          if (file.key && keyMapping.has(file.key)) {
            const cleanKey = keyMapping.get(file.key);
            console.log(`[DB Update] Job ${job.id}: updating ${file.key} -> ${cleanKey}`);
            file.key = cleanKey;
            modified = true;
          }
        }
        if (manifest.prefix && keyMapping.has(manifest.prefix)) {
          manifest.prefix = keyMapping.get(manifest.prefix).split('/').slice(0, -1).join('/');
          modified = true;
        }
      }

      if (modified) {
        await pool.query(
          `UPDATE backup_control.jobs SET manifest=$1 WHERE id=$2`,
          [JSON.stringify(manifest), job.id]
        );
        updatedCount++;
      }
    }
    console.log(`[DB Update] Updated manifests for ${updatedCount} completed jobs in database.`);
  } catch (dbErr) {
    console.error(`[DB Update] Warning: Could not update database jobs:`, dbErr.message);
  } finally {
    if (pool) await pool.end();
  }

  console.log(`[R2 Organize] Reorganization complete!`);
}

if (require.main === module) {
  organizeR2Backups().catch(err => {
    console.error('[R2 Organize] Failed:', err);
    process.exit(1);
  });
}

module.exports = { organizeR2Backups };
