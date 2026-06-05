import type { ImageFormat } from "@q-cms/core";

// ---------------------------------------------------------------------------
// S3 configuration
// ---------------------------------------------------------------------------

export interface S3Config {
  /** S3-compatible endpoint (e.g. `https://s3.us-east-1.amazonaws.com`). */
  endpoint: string;
  /** Bucket name. */
  bucket: string;
  /** AWS region (e.g. `us-east-1`). */
  region: string;
  /** Access key ID. */
  accessKeyId: string;
  /** Secret access key. */
  secretAccessKey: string;
  /**
   * Force path-style addressing (required for many S3-compatible services
   * like MinIO). Defaults to `true`.
   */
  forcePathStyle?: boolean;
}

// ---------------------------------------------------------------------------
// Variant preset definition
// ---------------------------------------------------------------------------

export interface VariantPreset {
  /** Target width in pixels. Omitted for `original`. */
  width?: number;
  /** Target height in pixels. Omitted for width-only resize. */
  height?: number;
  /** Output format. `"auto"` means preserve input format. */
  format: ImageFormat;
  /** JPEG/WebP/AVIF quality (1–100). Defaults to 80. */
  quality?: number;
  /** Generate a tiny blurred placeholder instead of a sharp resize. */
  blur?: boolean;
}

/** Name-keyed map of variant presets. */
export type VariantPresetMap = Record<string, VariantPreset>;

// ---------------------------------------------------------------------------
// Pipeline types
// ---------------------------------------------------------------------------

/** Extracted image metadata. */
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  hasAlpha: boolean | undefined;
  orientation: number | undefined;
}

/** A single processed variant result. */
export interface ProcessedVariant {
  /** Preset name (e.g. `"thumbnail"`, `"original"`). */
  variantName: string;
  /** Processed image buffer. */
  buffer: Buffer;
  /** Output width in pixels. */
  width: number;
  /** Output height in pixels. */
  height: number;
  /** Output format (e.g. `"webp"`, `"avif"`). */
  format: string;
  /** Buffer byte length. */
  sizeBytes: number;
}

/** Failed variant processing result. */
export interface VariantError {
  variantName: string;
  error: Error;
}

/** Pipeline input options. */
export interface PipelineOptions {
  /** Variant map to generate. Defaults to {@link DEFAULT_VARIANTS}. */
  variants?: VariantPresetMap;
  /** Focal point for `cover` cropping (`{ x: 0.5, y: 0.5 }` = center). */
  focalPoint?: { x: number; y: number };
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

/** Pipeline output. */
export interface PipelineOutput {
  /** Overall input metadata. */
  metadata: ImageMetadata;
  /** Successfully processed variants. */
  variants: ProcessedVariant[];
  /** Failed variant processing attempts. */
  errors: VariantError[];
}

// ---------------------------------------------------------------------------
// File listing result
// ---------------------------------------------------------------------------

export interface S3ObjectInfo {
  key: string;
  size: number;
  lastModified: Date;
}

export interface S3DeleteResult {
  /** Keys successfully deleted. */
  deleted: string[];
  /** Keys whose deletion failed. */
  errors: Array<{ key: string; error: Error }>;
}

// ---------------------------------------------------------------------------
// Default variant presets
// ---------------------------------------------------------------------------

/** Standard variant presets used when no custom map is provided. */
export const DEFAULT_VARIANTS: VariantPresetMap = {
  thumbnail: { width: 150, format: "webp" },
  small: { width: 480, format: "webp" },
  medium: { width: 768, format: "webp" },
  large: { width: 1280, format: "webp" },
  xl: { width: 1920, format: "webp" },
  "avif-large": { width: 1280, format: "avif" },
  blur: { width: 32, format: "webp", blur: true },
  original: { format: "auto" },
};
