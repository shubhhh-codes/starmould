import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  HeadObjectCommand
} from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

// Environment variables for Cloudflare R2
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "starmould-movement-photos";

const isConfigured = Boolean(
  R2_ACCOUNT_ID &&
  R2_ACCESS_KEY_ID &&
  R2_SECRET_ACCESS_KEY &&
  R2_BUCKET_NAME
);

// Lazy initialized S3Client for R2
let r2ClientInstance: S3Client | null = null;

function getR2Client(): S3Client | null {
  if (!isConfigured) return null;
  if (!r2ClientInstance) {
    r2ClientInstance = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return r2ClientInstance;
}

// Local filesystem fallback directory for dev testing when R2 credentials are not yet supplied
const DEV_LOCAL_DIR = path.join(process.cwd(), ".uploads_r2_dev");

function getLocalFilePath(key: string): string {
  // Prevent directory traversal: strip leading dots/slashes and prohibit parent traversal sequences
  const sanitizedKey = key
    .replace(/\.\./g, "__")
    .replace(/[^a-zA-Z0-9_\-./]/g, "_")
    .replace(/^[./\\]+/, "");
  const fullPath = path.resolve(DEV_LOCAL_DIR, sanitizedKey);
  const baseDir = path.resolve(DEV_LOCAL_DIR);
  if (!fullPath.startsWith(baseDir + path.sep) && fullPath !== baseDir) {
    throw new Error("Invalid storage key path traversal");
  }
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return fullPath;
}

export function isR2Configured(): boolean {
  return isConfigured;
}

export function getR2BucketName(): string {
  return R2_BUCKET_NAME;
}

/** Check physical availability without downloading another copy of an image. */
export async function photoExistsInStorage(key: string): Promise<boolean> {
  const client = getR2Client();
  if (!client) return fs.existsSync(getLocalFilePath(key));
  try {
    await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch (error) {
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false;
    throw error;
  }
}

/**
 * Uploads a buffer to Cloudflare R2 (or local dev storage fallback).
 */
export async function uploadToR2(params: {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}): Promise<{ key: string; sizeBytes: number }> {
  const client = getR2Client();

  if (client) {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      Metadata: params.metadata,
    });
    await client.send(command);
    return { key: params.key, sizeBytes: params.body.length };
  }

  // Local filesystem fallback
  const localPath = getLocalFilePath(params.key);
  fs.writeFileSync(localPath, params.body);
  return { key: params.key, sizeBytes: params.body.length };
}

/**
 * Retrieves an object from Cloudflare R2 as a Buffer.
 */
export async function getFromR2Buffer(key: string): Promise<Buffer | null> {
  const client = getR2Client();

  if (client) {
    try {
      const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      });
      const response = await client.send(command);
      if (!response.Body) return null;

      // Transform Body stream to Buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as Readable;
      for await (const chunk of stream) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      return Buffer.concat(chunks);
    } catch (err: any) {
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  // Local filesystem fallback
  const localPath = getLocalFilePath(key);
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath);
  }
  return null;
}

/**
 * Deletes an object from Cloudflare R2 (or local fallback).
 */
export async function deleteFromR2(key: string): Promise<boolean> {
  const client = getR2Client();

  if (client) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      });
      await client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  // Local filesystem fallback
  const localPath = getLocalFilePath(key);
  if (fs.existsSync(localPath)) {
    fs.unlinkSync(localPath);
    return true;
  }
  return false;
}

/**
 * Deletes multiple objects from Cloudflare R2 (or local fallback).
 */
export async function deleteManyFromR2(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const client = getR2Client();

  if (client) {
    let deletedCount = 0;
    // S3 DeleteObjects can accept up to 1000 keys per call
    const batchSize = 1000;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      const command = new DeleteObjectsCommand({
        Bucket: R2_BUCKET_NAME,
        Delete: {
          Objects: batch.map((k) => ({ Key: k })),
          Quiet: true,
        },
      });
      const res = await client.send(command);
      deletedCount += (batch.length - (res.Errors?.length || 0));
    }
    return deletedCount;
  }

  // Local fallback
  let count = 0;
  for (const key of keys) {
    const localPath = getLocalFilePath(key);
    if (fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
        count++;
      } catch {
        // ignore
      }
    }
  }
  return count;
}

/**
 * Computes R2 usage statistics (total bytes and object count).
 * Iterates through objects using ListObjectsV2.
 */
export async function getR2UsageStats(): Promise<{ totalBytes: number; objectCount: number }> {
  const client = getR2Client();

  if (client) {
    let totalBytes = 0;
    let objectCount = 0;
    let continuationToken: string | undefined = undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        ContinuationToken: continuationToken,
      });
      const response: ListObjectsV2CommandOutput = await client.send(command);
      if (response.Contents) {
        for (const item of response.Contents) {
          totalBytes += item.Size || 0;
          objectCount++;
        }
      }
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return { totalBytes, objectCount };
  }

  // Local filesystem calculation
  let totalBytes = 0;
  let objectCount = 0;

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        scanDir(full);
      } else {
        totalBytes += stat.size;
        objectCount++;
      }
    }
  }

  scanDir(DEV_LOCAL_DIR);
  return { totalBytes, objectCount };
}
