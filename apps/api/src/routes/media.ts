/**
 * Media routes.
 *
 * Endpoints:
 *   GET    /api/v1/media            — list media
 *   POST   /api/v1/media            — upload (multipart/form-data)
 *   GET    /api/v1/media/{id}       — metadata
 *   PATCH  /api/v1/media/{id}       — update alt / tags
 *   DELETE /api/v1/media/{id}
 *   GET    /api/v1/media/{id}/variants
 *   GET    /api/v1/media/{id}/render?w=...&h=...&fit=...&format=...
 *
 * Upload accepts a single file via multipart/form-data with optional
 * `alt`, `caption`, `folderId` fields.
 *
 * @module routes/media
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { NotFoundError, type Media, type MediaId, type UserId } from '../lib/stubs/core-shim.ts';
import { mediaRepo } from '../lib/stubs/index.ts';
import { serializeResource, serializeCollection } from '../lib/jsonapi.ts';
import { cursorPaginationSchema } from '../lib/zod-helpers.ts';
import { enqueue, QUEUE_NAMES } from '../services/queue.ts';

export const mediaRouter = new Hono();

const updateMediaSchema = z.object({
  altText: z.string().max(500).optional(),
  caption: z.string().max(2000).optional(),
  folderId: z.string().min(1).optional(),
});

const renderQuerySchema = z.object({
  w: z.coerce.number().int().positive().optional(),
  h: z.coerce.number().int().positive().optional(),
  fit: z.enum(['cover', 'contain', 'fill', 'inside', 'outside']).default('cover'),
  format: z.enum(['webp', 'avif', 'jpeg', 'png', 'auto']).default('auto'),
  q: z.coerce.number().int().min(1).max(100).default(85),
  blur: z.coerce.number().int().min(1).max(100).optional(),
  focal: z.string().regex(/^\d+(\.\d+)?,\d+(\.\d+)?$/).optional(),
});

/** GET /media */
mediaRouter.get('/', async (c) => {
  const page = cursorPaginationSchema.parse(c.req.query());
  const result = await mediaRepo.list({
    limit: page.limit,
    cursor: page.cursor ?? null,
    withTotal: page.withTotal ?? false,
  });
  return c.json(serializeCollection('Media', result.data, {
    pageInfo: {
      hasNext: result.page.nextCursor !== null,
      hasPrev: result.page.prevCursor !== null,
      startCursor: result.page.prevCursor,
      endCursor: result.page.nextCursor,
    },
    totalCount: result.page.total ?? undefined,
  }));
});

/**
 * POST /media (multipart upload)
 * Accepts a single `file` field plus optional metadata. Stores the
 * raw bytes in a stubbed in-memory key-value map keyed by SHA-256.
 */
mediaRouter.post('/', async (c) => {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.startsWith('multipart/form-data')) {
    return c.json(
      { errors: [{ status: '400', code: 'bad_request', title: 'Expected multipart/form-data' }] },
      400,
    );
  }
  const form = await c.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return c.json(
      { errors: [{ status: '400', code: 'bad_request', title: 'Missing file' }] },
      400,
    );
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const checksum = createHash('sha256').update(buf).digest('hex');
  const storageKey = `${randomBytes(8).toString('hex')}/${checksum}`;
  let width: number | null = null;
  let height: number | null = null;
  let type: Media['type'] = 'other';
  if (file.type.startsWith('image/')) {
    try {
      const meta = await sharp(buf).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      type = 'image';
    } catch {
      // Non-image upload — keep null dimensions.
    }
  } else if (file.type.startsWith('video/')) {
    type = 'video';
  } else if (file.type.startsWith('audio/')) {
    type = 'audio';
  } else {
    type = 'document';
  }
  const altText = (form.get('alt') as string | null) ?? null;
  const caption = (form.get('caption') as string | null) ?? null;
  const folderId = (form.get('folderId') as string | null) ?? null;
  const actor = c.get('user')?.id ?? null;
  const media = await mediaRepo.create({
    filename: file.name,
    mimeType: file.type,
    sizeBytes: buf.length,
    checksumSha256: checksum,
    storageKey,
    type,
    width,
    height,
    duration: null,
    altText,
    caption,
    focalPoint: null,
    folderId,
    uploadedBy: (actor as UserId | null) ?? null,
    metadata: {},
    isProcessed: false,
    virusScanned: false,
  });
  await enqueue(QUEUE_NAMES.imageProcess, {
    mediaId: media.id,
    storageKey,
    variants: ['thumbnail', 'small', 'medium', 'large', 'xl'],
  }).catch(() => undefined);
  return c.json(serializeResource('Media', media.id, publicMedia(media)), 201);
});

/** GET /media/{id} */
mediaRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const media = await mediaRepo.findById(id);
  if (!media) throw new NotFoundError('Media not found');
  return c.json(serializeResource('Media', media.id, publicMedia(media)));
});

/** PATCH /media/{id} */
mediaRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = updateMediaSchema.parse(await c.req.json().catch(() => ({})));
  const media = await mediaRepo.update(id, {
    ...(body.altText !== undefined ? { altText: body.altText } : {}),
    ...(body.caption !== undefined ? { caption: body.caption } : {}),
    ...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
  });
  return c.json(serializeResource('Media', media.id, publicMedia(media)));
});

/** DELETE /media/{id} */
mediaRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await mediaRepo.delete(id);
  return c.body(null, 204);
});

/** GET /media/{id}/variants */
mediaRouter.get('/:id/variants', async (c) => {
  const id = c.req.param('id');
  const media = await mediaRepo.findById(id);
  if (!media) throw new NotFoundError('Media not found');
  // Stub: real implementation queries media_variants.
  return c.json({
    data: [
      { id: `${id}-thumb`, type: 'MediaVariant', attributes: { name: 'thumbnail', width: 150, format: 'webp' } },
      { id: `${id}-small`, type: 'MediaVariant', attributes: { name: 'small', width: 480, format: 'webp' } },
      { id: `${id}-medium`, type: 'MediaVariant', attributes: { name: 'medium', width: 768, format: 'webp' } },
      { id: `${id}-large`, type: 'MediaVariant', attributes: { name: 'large', width: 1280, format: 'webp' } },
    ],
    meta: { mediaId: id as MediaId, count: 4 },
  });
});

/**
 * GET /media/{id}/render
 * Returns a transformed image. In the stub we generate a synthetic
 * WebP with `sharp` so the route is exercisable end-to-end.
 */
mediaRouter.get('/:id/render', async (c) => {
  const id = c.req.param('id');
  const media = await mediaRepo.findById(id);
  if (!media) throw new NotFoundError('Media not found');
  const query = renderQuerySchema.parse(c.req.query());
  const width = query.w ?? media.width ?? 512;
  const height = query.h ?? media.height ?? Math.round(width * 0.75);
  const format = query.format === 'auto' ? 'webp' : query.format;
  const pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 200, b: 200 },
    },
  });
  const buf = await pipeline.toFormat(format, { quality: query.q }).toBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      'content-type': `image/${format}`,
      'cache-control': 'public, max-age=31536000, immutable',
      etag: `"${id}-${width}x${height}-${format}-${query.q}"`,
    },
  });
});

function publicMedia(m: Media): Record<string, unknown> {
  return {
    filename: m.filename,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    type: m.type,
    width: m.width,
    height: m.height,
    altText: m.altText,
    caption: m.caption,
    folderId: m.folderId,
    uploadedBy: m.uploadedBy,
    isProcessed: m.isProcessed,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}
