import { describe, it, expect } from "vitest";
import {
  // utils
  slugify,
  truncate,
  pick,
  omit,
  deepMerge,
  formatBytes,
  isDeepEqual,
  // constants
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  API_PREFIX,
  API_VERSION,
  ERROR_MESSAGES,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  MAX_SLUG_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_SHORT_TEXT_LENGTH,
  localeSchema,
  // i18n
  parseLocale,
  resolveLocale,
  parseAcceptLanguage,
  getFallbackChain,
} from "./index.ts";

// ===========================================================================
// utils
// ===========================================================================

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("removes non-alphanumeric characters", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
  });

  it("collapses consecutive hyphens", () => {
    expect(slugify("foo---bar")).toBe("foo-bar");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("-hello-world-")).toBe("hello-world");
  });

  it("preserves existing hyphens", () => {
    expect(slugify("foo-bar-baz")).toBe("foo-bar-baz");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles unicode characters", () => {
    expect(slugify("Café Münster")).toBe("café-münster");
  });

  it("handles string with only special characters", () => {
    expect(slugify("!@#$%")).toBe("");
  });
});

describe("truncate", () => {
  it("returns original string when under maxLength", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("returns original string when exactly maxLength", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates and appends ellipsis", () => {
    expect(truncate("hello world", 5)).toBe("hello…");
  });

  it("handles maxLength of 0", () => {
    expect(truncate("hello", 0)).toBe("…");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });
});

describe("pick", () => {
  const obj = { a: 1, b: "two", c: true };

  it("picks specified keys", () => {
    expect(pick(obj, ["a", "c"])).toEqual({ a: 1, c: true });
  });

  it("returns empty object for empty keys array", () => {
    expect(pick(obj, [])).toEqual({});
  });

  it("silently omits keys not in object", () => {
    expect(pick(obj, ["a", "x"] as Array<keyof typeof obj>)).toEqual({ a: 1 });
  });

  it("returns shallow copy, not original", () => {
    const result = pick(obj, ["a"]);
    expect(result).not.toBe(obj);
  });
});

describe("omit", () => {
  const obj = { a: 1, b: "two", c: true };

  it("omits specified keys", () => {
    expect(omit(obj, ["a", "c"])).toEqual({ b: "two" });
  });

  it("returns full object when no keys omitted", () => {
    expect(omit(obj, [])).toEqual(obj);
  });

  it("returns full object when keys don't exist", () => {
    expect(omit(obj, ["x"] as Array<keyof typeof obj>)).toEqual(obj);
  });

  it("returns shallow copy, not original", () => {
    const result = omit(obj, []);
    expect(result).not.toBe(obj);
  });
});

describe("deepMerge", () => {
  it("merges flat objects", () => {
    const target = { a: 1, b: 2 };
    deepMerge(target, { b: 3, c: 4 });
    expect(target).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("merges nested objects recursively", () => {
    const target = { a: { x: 1, y: 2 }, b: 3 };
    deepMerge(target, { a: { y: 10, z: 20 } });
    expect(target).toEqual({ a: { x: 1, y: 10, z: 20 }, b: 3 });
  });

  it("replaces arrays instead of merging", () => {
    const target = { items: [1, 2, 3] };
    deepMerge(target, { items: [4, 5] });
    expect(target).toEqual({ items: [4, 5] });
  });

  it("mutates and returns target", () => {
    const target = { a: 1 };
    const result = deepMerge(target, { b: 2 });
    expect(result).toBe(target);
  });

  it("handles empty source", () => {
    const target = { a: 1 };
    deepMerge(target, {});
    expect(target).toEqual({ a: 1 });
  });

  it("replaces non-plain-object values", () => {
    const target = { a: null };
    deepMerge(target, { a: { b: 1 } });
    expect(target).toEqual({ a: { b: 1 } });
  });
});

describe("formatBytes", () => {
  it('returns "0 B" for 0', () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("returns B for small values", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("formats MB with one decimal when < 10", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats MB with no decimals when >= 10", () => {
    expect(formatBytes(15 * 1024 * 1024)).toBe("15 MB");
  });

  it("formats GB", () => {
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe("2.5 GB");
  });

  it('returns "0 B" for negative values', () => {
    expect(formatBytes(-1)).toBe("0 B");
  });
});

describe("isDeepEqual", () => {
  it("compares primitives", () => {
    expect(isDeepEqual(1, 1)).toBe(true);
    expect(isDeepEqual(1, 2)).toBe(false);
    expect(isDeepEqual("a", "a")).toBe(true);
    expect(isDeepEqual("a", "b")).toBe(false);
  });

  it("handles null vs undefined", () => {
    expect(isDeepEqual(null, null)).toBe(true);
    expect(isDeepEqual(undefined, undefined)).toBe(true);
    expect(isDeepEqual(null, undefined)).toBe(false);
  });

  it("handles NaN equality", () => {
    expect(isDeepEqual(NaN, NaN)).toBe(true);
  });

  it("compares flat objects", () => {
    expect(isDeepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(isDeepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("compares nested objects", () => {
    expect(
      isDeepEqual({ a: { x: 1, y: 2 } }, { a: { x: 1, y: 2 } }),
    ).toBe(true);
    expect(
      isDeepEqual({ a: { x: 1 } }, { a: { x: 2 } }),
    ).toBe(false);
  });

  it("compares arrays", () => {
    expect(isDeepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(isDeepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it("returns false for array vs object", () => {
    expect(isDeepEqual([1], { 0: 1 })).toBe(false);
  });

  it("handles different property counts", () => {
    expect(isDeepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

// ===========================================================================
// constants
// ===========================================================================

describe("constants", () => {
  it("has sensible DEFAULT_PAGE_SIZE", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20);
  });

  it("has MAX_PAGE_SIZE larger than DEFAULT", () => {
    expect(MAX_PAGE_SIZE).toBeGreaterThan(DEFAULT_PAGE_SIZE);
  });

  it("has /api prefix", () => {
    expect(API_PREFIX).toBe("/api");
  });

  it("has valid API version", () => {
    expect(API_VERSION).toBe("v1");
  });

  it("has all expected error messages", () => {
    expect(ERROR_MESSAGES.INTERNAL).toBe("Internal server error");
    expect(ERROR_MESSAGES.NOT_FOUND).toBe("Not found");
    expect(ERROR_MESSAGES.VALIDATION).toBe("Validation failed");
    expect(ERROR_MESSAGES.UNAUTHORIZED).toBe("Unauthorized");
    expect(ERROR_MESSAGES.FORBIDDEN).toBe("Forbidden");
    expect(ERROR_MESSAGES.RATE_LIMITED).toBe("Too many requests");
    expect(ERROR_MESSAGES.CONFLICT).toBe("Resource already exists");
    expect(ERROR_MESSAGES.BAD_REQUEST).toBe("Bad request");
    expect(ERROR_MESSAGES.SERVICE_UNAVAILABLE).toBe(
      "Service temporarily unavailable",
    );
  });

  it("has sensible timeout values", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(30_000);
    expect(MAX_TIMEOUT_MS).toBe(300_000);
    expect(MAX_TIMEOUT_MS).toBeGreaterThan(DEFAULT_TIMEOUT_MS);
  });

  it("has content limit constants", () => {
    expect(MAX_SLUG_LENGTH).toBeGreaterThan(0);
    expect(MAX_TITLE_LENGTH).toBeGreaterThan(0);
    expect(MAX_SHORT_TEXT_LENGTH).toBeGreaterThan(0);
  });

  it("validates locale strings with schema", () => {
    expect(localeSchema.safeParse("en").success).toBe(true);
    expect(localeSchema.safeParse("en-US").success).toBe(true);
    expect(localeSchema.safeParse("zh-Hans-CN").success).toBe(true);
    expect(localeSchema.safeParse("").success).toBe(false);
    expect(localeSchema.safeParse("123").success).toBe(false);
  });
});

// ===========================================================================
// i18n
// ===========================================================================

describe("parseLocale", () => {
  it("parses language only", () => {
    expect(parseLocale("en")).toEqual({ language: "en" });
  });

  it("parses language-region", () => {
    expect(parseLocale("en-US")).toEqual({ language: "en", region: "US" });
  });

  it("parses language-script-region", () => {
    expect(parseLocale("zh-Hans-CN")).toEqual({
      language: "zh",
      script: "Hans",
      region: "CN",
    });
  });

  it("detects script subtag by title-case pattern", () => {
    expect(parseLocale("az-Latn")).toEqual({
      language: "az",
      script: "Latn",
    });
  });

  it("throws for empty string", () => {
    expect(() => parseLocale("")).toThrow();
  });

  it("throws for malformed locale", () => {
    expect(() => parseLocale("!!!")).toThrow();
  });

  it("throws for numeric", () => {
    expect(() => parseLocale("123")).toThrow();
  });
});

describe("parseAcceptLanguage", () => {
  it("parses a single locale", () => {
    const result = parseAcceptLanguage("en-US");
    expect(result).toEqual([{ locale: "en-US", quality: 1 }]);
  });

  it("parses multiple locales with quality values", () => {
    const result = parseAcceptLanguage("en-US,en;q=0.9,fr;q=0.8");
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ locale: "en-US", quality: 1 });
    expect(result[1]).toEqual({ locale: "en", quality: 0.9 });
    expect(result[2]).toEqual({ locale: "fr", quality: 0.8 });
  });

  it("sorts by quality descending", () => {
    const result = parseAcceptLanguage("fr;q=0.8,en;q=1.0,de;q=0.5");
    expect(result[0].locale).toBe("en");
    expect(result[1].locale).toBe("fr");
    expect(result[2].locale).toBe("de");
  });

  it("ignores wildcard locale", () => {
    const result = parseAcceptLanguage("*,en;q=0.9");
    expect(result).toHaveLength(1);
    expect(result[0].locale).toBe("en");
  });

  it("handles whitespace in header", () => {
    const result = parseAcceptLanguage("  en-US ,  en ; q=0.5 ");
    expect(result[0]).toEqual({ locale: "en-US", quality: 1 });
    expect(result[1]).toEqual({ locale: "en", quality: 0.5 });
  });

  it("returns empty array for empty header", () => {
    expect(parseAcceptLanguage("")).toEqual([]);
  });
});

describe("resolveLocale", () => {
  const supported = ["en-US", "fr-FR", "de", "ja-JP"] as const;

  it("returns exact match", () => {
    expect(resolveLocale("en-US", supported, "en-US")).toBe("en-US");
  });

  it("prefers higher quality match", () => {
    expect(resolveLocale("fr-FR;q=0.8,en-US;q=1.0", supported, "en-US")).toBe(
      "en-US",
    );
  });

  it("falls back to language-only match", () => {
    // "de-DE" is not in supported, but "de" (language-only) is
    expect(resolveLocale("de-DE", supported, "en-US")).toBe("de");
  });

  it("falls back to default when no match", () => {
    expect(resolveLocale("zh-CN", supported, "en-US")).toBe("en-US");
  });

  it("handles empty supported list", () => {
    expect(resolveLocale("en-US", [], "en-US")).toBe("en-US");
  });
});

describe("getFallbackChain", () => {
  it("returns single element for language-only locale", () => {
    expect(getFallbackChain("en")).toEqual(["en"]);
  });

  it("returns language-region → language chain", () => {
    expect(getFallbackChain("en-US")).toEqual(["en-US", "en"]);
  });

  it("returns full chain for language-script-region", () => {
    expect(getFallbackChain("zh-Hans-CN")).toEqual([
      "zh-Hans-CN",
      "zh-Hans",
      "zh",
    ]);
  });

  it("returns language-script chain for language-script locale", () => {
    expect(getFallbackChain("az-Latn")).toEqual(["az-Latn", "az"]);
  });
});
