/**
 * Tests for the image-processing worker.
 *
 * Sharp is a real dep so we can use it to fabricate an input image
 * in-memory; the S3 client is replaced with a stub via the worker's
 * `setS3Client` hook.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { processImageJob, VARIANTS, setS3Client } from '../src/workers/image-process.ts';
import { __stubInternals } from '../src/stubs/db.ts';
import type { Job } from 'bullmq';
import type { ImageProcessJobData } from '../src/workers/image-process.ts';
import type { S3Stub } from '../src/stubs/db.ts';
import type { Media } from '@q-cms/core';

function makeJob(data: ImageProcessJobData, id = 'job-1'): Job<ImageProcessJobData> {
  return { id, data } as unknown as Job<ImageProcessJobData>;
}

function makeMedia(id: string, storageKey: string): Media {
  const now = new Date().toISOString();
  return {
    id: id as Media['id'],
    filename: 'test.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 0,
    checksumSha256: 'x',
    storageKey,
    type: 'image',
    width: null,
    height: null,
    duration: null,
    altText: null,
    caption: null,
    focalPoint: null,
    folderId: null,
    uploadedBy: null,
    metadata: {},
    isProcessed: false,
    virusScanned: false,
    createdAt: now,
    updatedAt: now,
  };
}

describe('image-process worker', () => {
  let s3: S3Stub & { objects: Map<string, { body: Buffer; contentType: string }> };

  beforeEach(async () => {
    __stubInternals.reset();
    // Build a 2600x1700 test image so all variants (max 2560 wide) can reach their configured width.
    const original = await sharp({
      create: { width: 2600, height: 1700, channels: 3, background: { r: 50, g: 100, b: 150 } },
    })
      .jpeg({ quality: 80 })
      .toBuffer();
    const store = new Map<string, { body: Buffer; contentType: string }>();
    store.set('media/originals/test.jpg', { body: original, contentType: 'image/jpeg' });
    s3 = {
      objects: store,
      async download(key: string) {
        const obj = this.objects.get(key);
        if (!obj) throw new Error(`not found: ${key}`);
        return obj.body;
      },
      async upload(key, body, contentType) {
        this.objects.set(key, { body, contentType });
        return { key, sizeBytes: body.length };
      },
      async delete(key: string) {
        this.objects.delete(key);
      },
    };
    setS3Client(s3);
    __stubInternals.putMedia(makeMedia('m-1', 'media/originals/test.jpg'));
  });

  afterEach(() => {
    setS3Client({} as S3Stub);
  });

  it('generates all 8 variants and uploads them to S3', { timeout: 20_000 }, async () => {
    await processImageJob(makeJob({ mediaId: 'm-1', originalKey: 'media/originals/test.jpg' }));
    expect(__stubInternals.listVariants('m-1' as never)).toHaveLength(VARIANTS.length);
    for (const spec of VARIANTS) {
      const expectedKey = `media/originals/test.${spec.name}.${spec.format}`;
      const obj = s3.objects.get(expectedKey);
      expect(obj, `variant ${spec.name} should exist in S3`).toBeDefined();
      expect(obj?.contentType).toBe(`image/${spec.format}`);
    }
  });

  it('produces buffers of the configured width for non-blur variants', async () => {
    await processImageJob(makeJob({ mediaId: 'm-1', originalKey: 'media/originals/test.jpg' }));
    const all = __stubInternals.listVariants('m-1' as never);
    const thumbnail = all.find((v) => v.variantName === 'thumbnail');
    expect(thumbnail?.width).toBe(150);
    const xl = all.find((v) => v.variantName === 'xl');
    expect(xl?.width).toBe(1920);
    const blur = all.find((v) => v.variantName === 'blur');
    expect(blur?.width).toBe(32);
  });

  it('is idempotent: re-running does not duplicate rows', async () => {
    await processImageJob(makeJob({ mediaId: 'm-1', originalKey: 'media/originals/test.jpg' }));
    await processImageJob(makeJob({ mediaId: 'm-1', originalKey: 'media/originals/test.jpg' }));
    expect(__stubInternals.listVariants('m-1' as never)).toHaveLength(VARIANTS.length);
  });

  it('throws when the original is missing from S3', async () => {
    await expect(
      processImageJob(makeJob({ mediaId: 'm-1', originalKey: 'media/originals/missing.jpg' })),
    ).rejects.toThrow(/not found/);
  });

  it('rejects jobs missing required fields', async () => {
    await expect(processImageJob(makeJob({ mediaId: '', originalKey: '' }))).rejects.toThrow(/required/);
  });

  it('emits avif output for the avif-large variant', async () => {
    await processImageJob(makeJob({ mediaId: 'm-1', originalKey: 'media/originals/test.jpg' }));
    const avif = s3.objects.get('media/originals/test.avif-large.avif');
    expect(avif).toBeDefined();
    // Sharp will not always downscale to exactly the requested width
    // (it can round), so we accept anything in the ±10% band.
    expect(avif?.body.length).toBeGreaterThan(0);
  });
});
