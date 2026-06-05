import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Result } from "@q-cms/core";
import { Err, Ok } from "@q-cms/core";
import type { S3Config, S3DeleteResult, S3ObjectInfo } from "./types.ts";

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/** Create a configured S3 client from {@link S3Config}. */
export function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle ?? true,
  });
}

// ---------------------------------------------------------------------------
// S3 wrapper
// ---------------------------------------------------------------------------

export interface S3Store {
  upload(key: string, body: Buffer, contentType?: string): Promise<Result<string>>;
  download(key: string): Promise<Result<Buffer>>;
  deleteMany(keys: string[]): Promise<Result<S3DeleteResult>>;
  getSignedUrl(key: string, ttlSeconds?: number): Promise<Result<string>>;
  list(prefix?: string): Promise<Result<S3ObjectInfo[]>>;
}

/**
 * Build a typed S3 storage wrapper.
 *
 * All operations return {@link Result} so callers must handle errors
 * explicitly — no thrown exceptions leak from this module.
 */
export function createS3Store(client: S3Client, bucket: string): S3Store {
  return {
    upload(key, body, contentType) {
      return uploadObject(client, bucket, key, body, contentType);
    },
    download(key) {
      return downloadObject(client, bucket, key);
    },
    deleteMany(keys) {
      return deleteObjects(client, bucket, keys);
    },
    getSignedUrl(key, ttlSeconds) {
      return createSignedUrl(client, bucket, key, ttlSeconds);
    },
    list(prefix) {
      return listObjects(client, bucket, prefix);
    },
  } satisfies S3Store;
}

// ---------------------------------------------------------------------------
// Individual operations
// ---------------------------------------------------------------------------

async function uploadObject(
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer,
  contentType?: string,
): Promise<Result<string>> {
  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    await client.send(command);
    return Ok(key);
  } catch (err) {
    return Err(toError(err, `upload s3://${bucket}/${key}`));
  }
}

async function downloadObject(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<Result<Buffer>> {
  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await client.send(command);
    if (!response.Body) {
      return Err(new Error(`Empty body for s3://${bucket}/${key}`));
    }
    const bodyBytes = await response.Body.transformToByteArray();
    return Ok(Buffer.from(bodyBytes));
  } catch (err) {
    return Err(toError(err, `download s3://${bucket}/${key}`));
  }
}

async function deleteObjects(
  client: S3Client,
  bucket: string,
  keys: string[],
): Promise<Result<S3DeleteResult>> {
  const result: S3DeleteResult = { deleted: [], errors: [] };

  // Delete sequentially — S3 DeleteObjects API can delete up to 1000 at
  // once, but for simplicity we do one-by-one with error isolation.
  for (const key of keys) {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      result.deleted.push(key);
    } catch (err) {
      result.errors.push({ key, error: toError(err, `delete s3://${bucket}/${key}`) });
    }
  }

  return Ok(result);
}

async function createSignedUrl(
  client: S3Client,
  bucket: string,
  key: string,
  ttlSeconds = 3600,
): Promise<Result<string>> {
  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(client, command, {
      expiresIn: ttlSeconds,
    });
    return Ok(url);
  } catch (err) {
    return Err(toError(err, `sign-url s3://${bucket}/${key}`));
  }
}

async function listObjects(
  client: S3Client,
  bucket: string,
  prefix?: string,
): Promise<Result<S3ObjectInfo[]>> {
  try {
    const objects: S3ObjectInfo[] = [];
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });
      const response = await client.send(command);

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key && obj.Size !== undefined && obj.LastModified) {
            objects.push({
              key: obj.Key,
              size: obj.Size,
              lastModified: obj.LastModified,
            });
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return Ok(objects);
  } catch (err) {
    return Err(toError(err, `list s3://${bucket}/${prefix ?? ""}`));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toError(err: unknown, context: string): Error {
  if (err instanceof Error) {
    err.message = `${err.message} (${context})`;
    return err;
  }
  return new Error(`${String(err)} (${context})`);
}
