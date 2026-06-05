/**
 * Internationalization utility functions for locale parsing and negotiation.
 */

import { z } from "zod";
import { localeSchema } from "./constants.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed locale components. */
export interface ParsedLocale {
  /** ISO 639 language code (2-3 lowercase letters). */
  language: string;
  /** Optional ISO 15924 script subtag (4 letters, title-case). */
  script?: string;
  /** Optional ISO 3166-1 region code (2-3 uppercase letters). */
  region?: string;
}

/** Result of parsing an Accept-Language header entry. */
export interface AcceptLanguageEntry {
  locale: string;
  quality: number;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const acceptLanguageEntrySchema = z.object({
  locale: z.string().min(1),
  quality: z.number().min(0).max(1).default(1),
});

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a BCP-47 locale tag into its components.
 *
 * Accepts tags like "en", "en-US", "zh-Hans-CN".
 * Throws for malformed locale strings.
 */
export function parseLocale(locale: string): ParsedLocale {
  localeSchema.parse(locale);

  const parts = locale.split("-");
  const language = parts[0]!;

  let script: string | undefined;
  let region: string | undefined;

  if (parts.length === 2) {
    const second = parts[1]!;
    // Script subtags are 4 letters and title-case; region codes are 2-3 uppercase
    if (second.length === 4 && /^[A-Z][a-z]{3}$/.test(second)) {
      script = second;
    } else {
      region = second;
    }
  } else if (parts.length === 3) {
    script = parts[1]!;
    region = parts[2]!;
  }

  const parsed: ParsedLocale = { language };
  if (script !== undefined) parsed.script = script;
  if (region !== undefined) parsed.region = region;
  return parsed;
}

/**
 * Parse an Accept-Language header value into a sorted list of locale entries.
 *
 * Entries are sorted by quality (descending), then by position.
 *
 * @example
 * parseAcceptLanguage("en-US,en;q=0.9,fr;q=0.8")
 * // [{ locale: "en-US", quality: 1 }, { locale: "en", quality: 0.9 }, …]
 */
export function parseAcceptLanguage(header: string): AcceptLanguageEntry[] {
  const entries: AcceptLanguageEntry[] = [];

  const ranges = header.split(",");
  for (const range of ranges) {
    const [localePart, ...paramParts] = range.trim().split(";");
    const locale = localePart?.trim();
    if (!locale || locale === "*") continue;

    let quality = 1;
    for (const param of paramParts) {
      const trimmed = param.trim();
      if (trimmed.startsWith("q=")) {
        const parsed = Number.parseFloat(trimmed.slice(2));
        if (!Number.isNaN(parsed)) {
          quality = parsed;
        }
        break; // q= is the only weight parameter we care about
      }
    }

    entries.push({ locale, quality });
  }

  // Validate entries
  for (const entry of entries) {
    acceptLanguageEntrySchema.parse(entry);
  }

  // Sort by quality descending, stable (preserve original order for equal quality)
  return entries.sort((a, b) => b.quality - a.quality);
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the best matching locale from the Accept-Language header against a
 * set of supported locales.
 *
 * Falls back to `defaultLocale` when no match is found.
 * Supports exact matches and language-only matches.
 */
export function resolveLocale(
  acceptLanguage: string,
  supported: readonly string[],
  defaultLocale: string,
): string {
  if (supported.length === 0) return defaultLocale;
  localeSchema.parse(defaultLocale);

  const accepted = parseAcceptLanguage(acceptLanguage);
  const supportedSet = new Set(supported);

  // Try exact match first
  for (const entry of accepted) {
    if (supportedSet.has(entry.locale)) return entry.locale;
  }

  // Try language-only match
  for (const entry of accepted) {
    const parsed = parseLocale(entry.locale);
    const langMatch = supported.find((s) => {
      const sParsed = parseLocale(s);
      return sParsed.language === parsed.language;
    });
    if (langMatch) return langMatch;
  }

  return defaultLocale;
}

// ---------------------------------------------------------------------------
// Fallback chain
// ---------------------------------------------------------------------------

/**
 * Generate the locale fallback chain for a given locale.
 *
 * Builds progressively less specific variants, ending with the bare language.
 *
 * @example
 * getFallbackChain("zh-Hans-CN") // ["zh-Hans-CN", "zh-Hans", "zh"]
 * getFallbackChain("en-US")      // ["en-US", "en"]
 * getFallbackChain("en")         // ["en"]
 */
export function getFallbackChain(locale: string): string[] {
  const parsed = parseLocale(locale);
  const chain: string[] = [locale];

  // Build intermediate fallbacks by stripping trailing subtags
  const nonLangParts: string[] = [];
  if (parsed.script) nonLangParts.push(parsed.script);
  if (parsed.region) nonLangParts.push(parsed.region);

  while (nonLangParts.length > 0) {
    nonLangParts.pop();
    const fallback =
      nonLangParts.length === 0
        ? parsed.language
        : [parsed.language, ...nonLangParts].join("-");
    chain.push(fallback);
  }

  return chain;
}
