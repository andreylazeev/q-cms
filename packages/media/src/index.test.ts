import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VARIANTS,
  createS3Client,
  createS3Store,
  generateBlurPlaceholder,
  getMetadata,
  processImage,
  runPipeline,
} from "./index.ts";
import type { S3Config } from "./types.ts";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Minimal valid JPEG (1x1 pixel, orange). */
function createTestJpeg(): Buffer {
  // Base64-encoded 8x8 orange JPEG. Sharp can process this.
  const b64 =
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYI4Q/SFBSR0RcYDkaJSYnKCkqNTU5OTlDR0R1ZWSlZXWFhZUmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlbaWmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCfsn/2Q==";
  return Buffer.from(b64, "base64");
}

/** Create an S3Client for local testing (MinIO or mock). */
function testS3Config(): S3Config {
  return {
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:4566",
    bucket: process.env.S3_BUCKET ?? "q-cms-test",
    region: process.env.S3_REGION ?? "us-east-1",
    accessKeyId: process.env.S3_ACCESS_KEY ?? "test",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "test",
    forcePathStyle: true,
  };
}

// ---------------------------------------------------------------------------
// build-time / export tests
// ---------------------------------------------------------------------------

describe("@q-cms/media exports", () => {
  it("exports createS3Client", () => {
    expect(createS3Client).toBeInstanceOf(Function);
  });

  it("exports createS3Store", () => {
    expect(createS3Store).toBeInstanceOf(Function);
  });

  it("exports DEFAULT_VARIANTS with expected preset names", () => {
    const names = Object.keys(DEFAULT_VARIANTS);
    expect(names).toContain("thumbnail");
    expect(names).toContain("small");
    expect(names).toContain("medium");
    expect(names).toContain("large");
    expect(names).toContain("xl");
    expect(names).toContain("avif-large");
    expect(names).toContain("blur");
    expect(names).toContain("original");
  });

  it("exports image processing functions", () => {
    expect(processImage).toBeInstanceOf(Function);
    expect(getMetadata).toBeInstanceOf(Function);
    expect(generateBlurPlaceholder).toBeInstanceOf(Function);
    expect(runPipeline).toBeInstanceOf(Function);
  });
});

// ---------------------------------------------------------------------------
// S3 factory tests (no network)
// ---------------------------------------------------------------------------

describe("createS3Client", () => {
  it("creates a client without throwing", () => {
    const client = createS3Client(testS3Config());
    expect(client).toBeDefined();
    client.destroy();
  });
});

describe("createS3Store", () => {
  it("creates a store wrapper without throwing", () => {
    const client = createS3Client(testS3Config());
    const store = createS3Store(client, "test-bucket");
    expect(store).toBeDefined();
    expect(store.upload).toBeInstanceOf(Function);
    expect(store.download).toBeInstanceOf(Function);
    expect(store.deleteMany).toBeInstanceOf(Function);
    expect(store.getSignedUrl).toBeInstanceOf(Function);
    expect(store.list).toBeInstanceOf(Function);
    client.destroy();
  });
});

// ---------------------------------------------------------------------------
// Sharp metadata extraction (real)
// ---------------------------------------------------------------------------

describe("getMetadata", () => {
  it("extracts width, height, and format from a JPEG buffer", async () => {
    const buf = createTestJpeg();
    const result = await getMetadata(buf);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.width).toBeGreaterThan(0);
      expect(result.value.height).toBeGreaterThan(0);
      expect(result.value.format).toBe("jpeg");
    }
  });

  it("returns Err for an empty buffer", async () => {
    const result = await getMetadata(Buffer.alloc(0));
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// processImage (real Sharp)
// ---------------------------------------------------------------------------

describe("processImage", () => {
  const jpeg = createTestJpeg();

  it("resizes to WebP", async () => {
    const result = await processImage(jpeg, { width: 48, format: "webp" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.width).toBeGreaterThan(0);
      expect(result.value.format).toBe("webp");
      expect(result.value.buffer.byteLength).toBeGreaterThan(0);
    }
  });

  it("converts to AVIF", async () => {
    const result = await processImage(jpeg, { format: "avif" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.format).toBe("avif");
    }
  });

  it("converts to PNG", async () => {
    const result = await processImage(jpeg, { format: "png" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.format).toBe("png");
    }
  });

  it("preserves JPEG when format is auto", async () => {
    const result = await processImage(jpeg, { format: "auto" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.format).toBe("jpeg");
    }
  });

  it("generates a blur placeholder", async () => {
    const result = await processImage(jpeg, {
      width: 32,
      blur: true,
      format: "webp",
      quality: 20,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.width).toBeLessThanOrEqual(32);
      expect(result.value.format).toBe("webp");
      // Blurred image should be tiny for a small input.
      expect(result.value.buffer.byteLength).toBeLessThan(2000);
    }
  });

  it("fails on nonsensical input", async () => {
    const result = await processImage(Buffer.from("not-an-image"), {
      width: 100,
      format: "webp",
    });
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateBlurPlaceholder (real Sharp)
// ---------------------------------------------------------------------------

describe("generateBlurPlaceholder", () => {
  it("returns a small WebP buffer", async () => {
    const result = await generateBlurPlaceholder(createTestJpeg());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.format).toBe("webp");
      expect(result.value.width).toBeLessThanOrEqual(32);
      expect(result.value.buffer.byteLength).toBeLessThan(2048);
    }
  });
});

// ---------------------------------------------------------------------------
// runPipeline (real Sharp, no S3 dependency)
// ---------------------------------------------------------------------------

describe("runPipeline", () => {
  const jpeg = createTestJpeg();

  it("processes all default variants", async () => {
    const result = await runPipeline(jpeg);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { metadata, variants, errors } = result.value;
    expect(metadata.format).toBe("jpeg");

    const variantNames = variants.map((v) => v.variantName);
    expect(variantNames).toContain("thumbnail");
    expect(variantNames).toContain("small");
    expect(variantNames).toContain("medium");
    expect(variantNames).toContain("large");
    expect(variantNames).toContain("xl");
    expect(variantNames).toContain("avif-large");
    expect(variantNames).toContain("blur");
    expect(variantNames).toContain("original");

    // Each variant should have correct dimensions.
    for (const v of variants) {
      expect(v.buffer.byteLength).toBeGreaterThan(0);
      expect(v.width).toBeGreaterThan(0);
      expect(v.height).toBeGreaterThan(0);
      expect(typeof v.format).toBe("string");
    }

    // Original should pass through unchanged.
    const orig = variants.find((v) => v.variantName === "original");
    expect(orig?.buffer).toEqual(jpeg);
    expect(orig?.format).toBe("jpeg");

    // Thumbnail should be ≤150px wide.
    const thumb = variants.find((v) => v.variantName === "thumbnail");
    expect(thumb?.width).toBeLessThanOrEqual(150);
    expect(thumb?.format).toBe("webp");

    // Blur should be tiny.
    const blur = variants.find((v) => v.variantName === "blur");
    expect(blur?.width).toBeLessThanOrEqual(32);
    expect(blur?.format).toBe("webp");

    // AVIF large should be AVIF.
    const avifLarge = variants.find((v) => v.variantName === "avif-large");
    expect(avifLarge?.format).toBe("avif");

    // Errors should be empty for valid input.
    expect(errors).toHaveLength(0);
  });

  it("collets per-variant errors without short-circuiting", async () => {
    // Custom variants: one valid, one with an impossible size that
    // should still succeed gracefully.
    const customVariants = {
      good: { width: 100, format: "webp" as const },
      bad: { width: 100, format: "bmp" as const }, // unsupported format
    };

    const result = await runPipeline(jpeg, { variants: customVariants });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.variants).toHaveLength(1);
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0]?.variantName).toBe("bad");
  });

  it("returns Err when input is not an image", async () => {
    const result = await runPipeline(Buffer.from("garbage"));
    expect(result.ok).toBe(false);
  });

  it("respects AbortSignal", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await runPipeline(jpeg, { signal: controller.signal });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // All variants should have errored due to abort.
    expect(result.value.variants).toHaveLength(0);
    expect(result.value.errors.length).toBeGreaterThan(0);
    for (const e of result.value.errors) {
      expect(e.error.message).toMatch(/abort/i);
    }
  });
});
