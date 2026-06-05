/**
 * Image-processing worker.
 *
 * Consumes the `image-process` queue. For each job it:
 *   1. Downloads the original object from S3.
 *   2. Generates 8 variants (5 webp sizes, 1 avif, 1 blur) using Sharp.
 *   3. Uploads each variant back to S3.
 *   4. Inserts a `media_variants` row per variant.
 *
 * Variants are idempotent: re-running the job overwrites the
 * variant S3 keys (sharp returns deterministic buffers per input)
 * and the `media_variants` row uses `(mediaId, variantName, format)`
 * as a unique key.
 *
 * @module workers/image-process
 */

import type { Job } from 'bullmq';
import sharp from 'sharp';
import { makeS3Stub, mediaRepo, type S3Stub } from '../stubs/db.ts';
import { startJobTimer, withLogger } from '../observability.ts';
import { QUEUES } from '../queues.ts';

/**
 * Payload accepted by the image-processing worker.
 *
 * @property mediaId - UUID of the `media` row to update.
 * @property originalKey - S3 storage key of the original upload.
 * @property mimeType - Original MIME type (e.g. `image/jpeg`).
 */
export interface ImageProcessJobData {
  mediaId: string;
  originalKey: string;
  mimeType?: string;
}

/** Description of a single output variant. */
interface VariantSpec {
  name: string;
  format: 'webp' | 'avif' | 'jpeg';
  width: number;
  quality: number;
  /** If true, generate a tiny blurred placeholder. */
  blur?: boolean;
}

/** The 8 variants generated for every image upload. */
export const VARIANTS: readonly VariantSpec[] = [
  { name: 'thumbnail', format: 'webp', width: 150, quality: 75 },
  { name: 'small', format: 'webp', width: 480, quality: 75 },
  { name: 'medium', format: 'webp', width: 768, quality: 80 },
  { name: 'large', format: 'webp', width: 1280, quality: 80 },
  { name: 'xl', format: 'webp', width: 1920, quality: 82 },
  { name: '2xl', format: 'webp', width: 2560, quality: 82 },
  { name: 'avif-large', format: 'avif', width: 1920, quality: 60 },
  { name: 'blur', format: 'webp', width: 32, quality: 40, blur: true },
];

/** S3 client injection point. Tests can override this. */
let s3Override: S3Stub | undefined;
export function setS3Client(client: S3Stub): void {
  s3Override = client;
}
function getS3(): S3Stub {
  return s3Override ?? makeS3Stub();
}

/**
 * Generate a single variant buffer from the original. The function
 * is exported so the tests can drive it directly without a real S3.
 */
export async function generateVariant(
  original: Buffer,
  spec: VariantSpec,
): Promise<{ buffer: Buffer; width: number | null; height: number | null }> {
  let pipeline = sharp(original).rotate(); // auto-orient via EXIF
  if (spec.blur) {
    pipeline = pipeline.resize({ width: spec.width }).blur(2);
  } else {
    pipeline = pipeline.resize({ width: spec.width, withoutEnlargement: true });
  }
  if (spec.format === 'webp') {
    pipeline = pipeline.webp({ quality: spec.quality });
  } else if (spec.format === 'avif') {
    pipeline = pipeline.avif({ quality: spec.quality });
  } else {
    pipeline = pipeline.jpeg({ quality: spec.quality });
  }
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    width: info.width ?? null,
    height: info.height ?? null,
  };
}

/** Derive the storage key for a variant. */
function variantKey(originalKey: string, spec: VariantSpec): string {
  const dot = originalKey.lastIndexOf('.');
  const base = dot > 0 ? originalKey.slice(0, dot) : originalKey;
  return `${base}.${spec.name}.${spec.format}`;
}

/** Process a single image job. Throws on irrecoverable failure. */
export async function processImageJob(job: Job<ImageProcessJobData>): Promise<void> {
  const log = withLogger({ queue: QUEUES.image, jobId: job.id, ...job.data });
  const stop = startJobTimer(QUEUES.image);
  const s3 = getS3();
  try {
    const { mediaId, originalKey } = job.data;
    if (!mediaId || !originalKey) {
      throw new Error('Image job missing required fields: mediaId, originalKey');
    }
    const original = await s3.download(originalKey);
    for (const spec of VARIANTS) {
      const key = variantKey(originalKey, spec);
      const existing = await mediaRepo.findVariantByKey(key);
      if (existing) {
        log.debug({ mediaId, variant: spec.name, key }, 'Variant already exists; skipping');
        continue;
      }
      const { buffer, width, height } = await generateVariant(original, spec);
      await s3.upload(key, buffer, `image/${spec.format}`);
      await mediaRepo.insertVariant({
        mediaId: mediaId as never,
        variantName: spec.name,
        width,
        height,
        format: spec.format,
        sizeBytes: buffer.length,
        storageKey: key,
      });
    }
    log.info({ mediaId }, 'Image variants generated');
    stop('ok');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, 'Image job failed');
    stop('error', err);
    throw err;
  }
}
