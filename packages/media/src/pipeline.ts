import type { Result } from "@q-cms/core";
import { Err, Ok } from "@q-cms/core";
import { getMetadata, processImage } from "./sharp.ts";
import type {
  ImageMetadata,
  PipelineOptions,
  PipelineOutput,
  ProcessedVariant,
  VariantError,
  VariantPresetMap,
} from "./types.ts";
import { DEFAULT_VARIANTS } from "./types.ts";

// ---------------------------------------------------------------------------
// Pipeline orchestrator
// ---------------------------------------------------------------------------

/**
 * Process an image buffer through all configured variant presets.
 *
 * Variants are processed in parallel. Individual variant failures are
 * collected in `output.errors` rather than short-circuiting the whole
 * pipeline.
 */
export async function runPipeline(
  input: Buffer,
  options: PipelineOptions = {},
): Promise<Result<PipelineOutput>> {
  const variants = options.variants ?? DEFAULT_VARIANTS;
  const signal = options.signal;

  // Step 1: extract source metadata.
  const metaResult = await getMetadata(input);
  if (!metaResult.ok) {
    return Err(metaResult.error);
  }

  const metadata: ImageMetadata = metaResult.value;

  // Step 2: process all variants concurrently, collecting both successes
  // and failures.
  const entries = Object.entries(variants);
  const results = await Promise.all(
    entries.map(([variantName, preset]) =>
      processOneVariant(input, variantName, preset, metadata, options),
    ),
  );

  const processedVariants: ProcessedVariant[] = [];
  const errors: VariantError[] = [];

  for (const r of results) {
    if (r.ok) {
      processedVariants.push(r.value);
    } else {
      errors.push(r.error);
    }
  }

  checkAborted(signal);

  return Ok({ metadata, variants: processedVariants, errors });
}

// ---------------------------------------------------------------------------
// Single variant processing
// ---------------------------------------------------------------------------

async function processOneVariant(
  input: Buffer,
  variantName: string,
  preset: VariantPresetMap[string],
  _metadata: ImageMetadata,
  options: PipelineOptions,
): Promise<Result<ProcessedVariant, VariantError>> {
  const signal = options.signal;

  try {
    checkAborted(signal);

    // `original` with `auto` format: passthrough, no processing.
    if (variantName === "original" && preset.format === "auto") {
      const meta = await getMetadata(input);
      if (!meta.ok) {
        return Err({ variantName, error: meta.error });
      }
      return Ok({
        variantName,
        buffer: input,
        width: meta.value.width,
        height: meta.value.height,
        format: meta.value.format,
        sizeBytes: input.byteLength,
      });
    }

    const result = await processImage(input, {
      width: preset.width,
      height: preset.height,
      format: preset.format,
      quality: preset.quality,
      blur: preset.blur,
      focalPoint: options.focalPoint,
      signal,
    });

    if (!result.ok) {
      return Err({ variantName, error: result.error });
    }

    return Ok({
      variantName,
      buffer: result.value.buffer,
      width: result.value.width,
      height: result.value.height,
      format: result.value.format,
      sizeBytes: result.value.buffer.byteLength,
    });
  } catch (err) {
    return Err({
      variantName,
      error: err instanceof Error ? err : new Error(String(err)),
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException("Operation was aborted", "AbortError");
  }
}
