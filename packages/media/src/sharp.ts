import type { ImageFormat } from "@q-cms/core";
import type { Result } from "@q-cms/core";
import { Err, Ok } from "@q-cms/core";
import sharp from "sharp";
import type { ImageMetadata } from "./types.ts";

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

/** Extract image metadata without re-encoding. */
export async function getMetadata(input: Buffer): Promise<Result<ImageMetadata>> {
  try {
    const meta = await sharp(input).metadata();
    return Ok({
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      format: meta.format ?? "unknown",
      hasAlpha: meta.hasAlpha ?? undefined,
      orientation: meta.orientation ?? undefined,
    });
  } catch (err) {
    return Err(toError(err, "extract metadata"));
  }
}

// ---------------------------------------------------------------------------
// Image processing
// ---------------------------------------------------------------------------

export interface ProcessOptions {
  /** Target width. */
  width?: number;
  /** Target height. */
  height?: number;
  /** Output format. `"auto"` preserves input format. */
  format?: ImageFormat;
  /** JPEG/WebP/AVIF quality (1–100). */
  quality?: number;
  /** Focal point for `cover` fit: `{ x: 0.5, y: 0.5 }` = center. */
  focalPoint?: { x: number; y: number };
  /** Optional resize fit strategy (defaults to `"inside"`). */
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  /** Blur the output (for placeholders). Disables sharp resize. */
  blur?: boolean;
  /** Abort signal. */
  signal?: AbortSignal;
}

export interface ProcessResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
}

/** Resize, crop, reformat an image buffer. */
export async function processImage(
  input: Buffer,
  options: ProcessOptions,
): Promise<Result<ProcessResult>> {
  const { signal } = options;

  try {
    checkAborted(signal);

    let pipeline = sharp(input);

    checkAborted(signal);

    // Extract metadata for focal-point / blur logic.
    const meta = await pipeline.metadata();
    const srcWidth = meta.width ?? 0;
    const srcHeight = meta.height ?? 0;
    const srcFormat = meta.format ?? "unknown";

    checkAborted(signal);

    if (options.blur) {
      // Tiny, low-quality, heavily blurred thumbnail for placeholders.
      const blurWidth = Math.min(options.width ?? 32, srcWidth || 32);
      pipeline = pipeline.resize(blurWidth, undefined, {
        fit: "inside",
        withoutEnlargement: true,
      });
      pipeline = pipeline.blur(20);
    } else {
      // Normal resize.
      const targetWidth = options.width;
      const targetHeight = options.height;
      const fit = options.fit ?? "inside";

      if (targetWidth !== undefined || targetHeight !== undefined) {
        if (options.focalPoint && fit === "cover") {
          // Convert fractional focal point to pixel coordinates for
          // Sharp's `extract` + `resize` pipeline.
          const extractWidth = Math.min(
            targetWidth ?? srcWidth,
            srcWidth,
          );
          const extractHeight = Math.min(
            targetHeight ?? Math.round(extractWidth / (targetWidth ? targetWidth / (targetHeight ?? extractWidth) : 1)),
            srcHeight,
          );

          const left = Math.round(
            Math.max(0, Math.min(srcWidth * options.focalPoint.x - extractWidth / 2, srcWidth - extractWidth)),
          );
          const top = Math.round(
            Math.max(0, Math.min(srcHeight * options.focalPoint.y - extractHeight / 2, srcHeight - extractHeight)),
          );

          pipeline = pipeline.extract({
            left,
            top,
            width: extractWidth,
            height: extractHeight,
          });

          checkAborted(signal);
        }

        pipeline = pipeline.resize(targetWidth, targetHeight, {
          fit,
          withoutEnlargement: true,
        });
      }
    }

    checkAborted(signal);

    // Format conversion.
    const format = resolveFormat(options.format, srcFormat);
    const quality = options.quality ?? 80;
    pipeline = applyFormat(pipeline, format, quality);

    checkAborted(signal);

    const buffer = await pipeline.toBuffer();
    const outMeta = await sharp(buffer).metadata();

    return Ok({
      buffer,
      width: outMeta.width ?? 0,
      height: outMeta.height ?? 0,
      format: outMeta.format ?? format,
    });
  } catch (err) {
    return Err(toError(err, "process image"));
  }
}

// ---------------------------------------------------------------------------
// Convenience: blur placeholder
// ---------------------------------------------------------------------------

/** Generate a tiny blurred placeholder (defaults to 32px wide, WebP). */
export async function generateBlurPlaceholder(
  input: Buffer,
  width = 32,
): Promise<Result<ProcessResult>> {
  return processImage(input, { width, blur: true, format: "webp", quality: 20 });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveFormat(requested: string | undefined, srcFormat: string): string {
  if (!requested || requested === "auto") return mapFormat(srcFormat);
  return requested;
}

function mapFormat(src: string): string {
  switch (src) {
    case "jpeg":
      return "jpeg";
    case "png":
      return "png";
    case "webp":
      return "webp";
    case "avif":
      return "avif";
    case "gif":
      return "png"; // GIF → PNG (sharp can't output GIF)
    default:
      return "jpeg"; // safest fallback
  }
}

function applyFormat(
  pipeline: sharp.Sharp,
  format: string,
  quality: number,
): sharp.Sharp {
  switch (format) {
    case "webp":
      return pipeline.webp({ quality });
    case "avif":
      return pipeline.avif({ quality });
    case "jpeg":
      return pipeline.jpeg({ quality });
    case "png":
      return pipeline.png({ quality });
    default:
      return pipeline.webp({ quality });
  }
}

function checkAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException("Operation was aborted", "AbortError");
  }
}

function toError(err: unknown, context: string): Error {
  if (err instanceof Error) {
    err.message = `${err.message} (${context})`;
    return err;
  }
  return new Error(`${String(err)} (${context})`);
}
