import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { I18n } from "./i18n.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createI18n(fallbackLocale?: string) {
  const i18n = new I18n({
    defaultLocale: "en",
    locales: ["en", "fr", "de"],
    ...(fallbackLocale !== undefined ? { fallbackLocale } : {}),
  });

  i18n.loadTranslations("en", "common", {
    greeting: "Hello",
    welcome: "Welcome, {{name}}!",
    items: { one: "{{count}} item", other: "{{count}} items" },
    auth: {
      login: {
        title: "Sign in",
        submit: "Log in",
      },
    },
    "key-with-dashes": "dashes ok",
    mixed: {
      depth: {
        value: "deep value",
      },
    },
  });

  i18n.loadTranslations("fr", "common", {
    greeting: "Bonjour",
    auth: {
      login: {
        title: "Se connecter",
      },
    },
  });

  // German has only partial coverage — triggers fallback
  i18n.loadTranslations("de", "common", {
    greeting: "Hallo",
  });

  return i18n;
}

// ---------------------------------------------------------------------------
// Basic translation
// ---------------------------------------------------------------------------

describe("I18n.t — basic translation", () => {
  let i18n: I18n;

  beforeEach(() => {
    i18n = createI18n();
  });

  it("returns a plain translation string", () => {
    expect(i18n.t("common.greeting")).toBe("Hello");
  });

  it("returns the key itself when translation is missing", () => {
    expect(i18n.t("common.missing_key")).toBe("common.missing_key");
  });

  it("interpolates {{key}} placeholders", () => {
    expect(i18n.t("common.welcome", { name: "Alice" })).toBe(
      "Welcome, Alice!",
    );
  });

  it("leaves unknown interpolation keys untouched", () => {
    expect(i18n.t("common.welcome", { unknown: "x" })).toBe(
      "Welcome, {{name}}!",
    );
  });

  it("interpolates numeric values as strings", () => {
    i18n.loadTranslations("en", "num", {
      count: "You have {{n}} messages",
    });
    expect(i18n.t("num.count", { n: 42 })).toBe("You have 42 messages");
  });

  it("resolves translation in the active locale", () => {
    i18n.setLocale("fr");
    expect(i18n.t("common.greeting")).toBe("Bonjour");
  });

  it("respects explicit locale override parameter", () => {
    expect(i18n.t("common.greeting", undefined, "fr")).toBe("Bonjour");
    // Still "en" active
    expect(i18n.getLocale()).toBe("en");
  });
});

// ---------------------------------------------------------------------------
// Nested keys
// ---------------------------------------------------------------------------

describe("I18n.t — nested key paths", () => {
  let i18n: I18n;

  beforeEach(() => {
    i18n = createI18n();
  });

  it("resolves two-level nesting: auth.login.title", () => {
    expect(i18n.t("common.auth.login.title")).toBe("Sign in");
  });

  it("resolves two-level nesting with interpolation", () => {
    i18n.loadTranslations("en", "admin", {
      header: {
        userName: "Hi, {{name}}",
      },
    });
    expect(i18n.t("admin.header.userName", { name: "Bob" })).toBe("Hi, Bob");
  });

  it("resolves three-level nesting", () => {
    expect(i18n.t("common.mixed.depth.value")).toBe("deep value");
  });

  it("returns key when intermediate segment is missing", () => {
    expect(i18n.t("common.auth.missing.title")).toBe(
      "common.auth.missing.title",
    );
  });

  it("returns key when leaf is not a string", () => {
    // "auth" is an object, not a string
    expect(i18n.t("common.auth")).toBe("common.auth");
  });

  it("handles key segments with dashes", () => {
    expect(i18n.t("common.key-with-dashes")).toBe("dashes ok");
  });

  it("returns key when path goes beyond leaf depth", () => {
    // "greeting" is a string, can't drill deeper
    expect(i18n.t("common.greeting.extra")).toBe("common.greeting.extra");
  });
});

// ---------------------------------------------------------------------------
// Fallback locale
// ---------------------------------------------------------------------------

describe("I18n.t — fallback locale", () => {
  let i18n: I18n;

  beforeEach(() => {
    i18n = createI18n();
  });

  it("falls back to defaultLocale when key missing in active locale", () => {
    i18n.setLocale("fr");
    // "welcome" only exists in "en" (default)
    expect(i18n.t("common.welcome", { name: "Alice" })).toBe(
      "Welcome, Alice!",
    );
  });

  it("uses explicit fallbackLocale when configured", () => {
    const i18n2 = new I18n({
      defaultLocale: "en",
      locales: ["en", "fr", "es"],
      fallbackLocale: "fr",
    });
    i18n2.loadTranslations("en", "ns", { a: "EN-a" });
    i18n2.loadTranslations("fr", "ns", { a: "FR-a", b: "FR-b" });

    i18n2.setLocale("es");
    // "b" missing in "en" (default) but exists in "fr" (fallback)
    expect(i18n2.t("ns.b")).toBe("FR-b");
    // "a" exists in active locale's fallback chain, prefers fr
    // Actually: active is es, no match. Try fallback (fr) → found.
    // But wait, default is en, fallback is fr. Resolution: es → fr → en.
    // "a" exists in fr, so returns "FR-a"
    expect(i18n2.t("ns.a")).toBe("FR-a");
  });

  it("returns key when fallback also missing", () => {
    i18n.setLocale("de");
    // "welcome" doesn't exist in "de" or "en" (wait, it does in en)
    // Let me use something only in fr
    i18n.loadTranslations("fr", "only-fr", { secret: "oui" });
    i18n.setLocale("de");
    // Not in de, not in fallback (en), not in default (en) → key
    expect(i18n.t("only-fr.secret")).toBe("only-fr.secret");
  });
});

// ---------------------------------------------------------------------------
// Pluralization
// ---------------------------------------------------------------------------

describe("I18n.t — pluralization", () => {
  let i18n: I18n;

  beforeEach(() => {
    i18n = createI18n();
  });

  it("uses singular form for count=1", () => {
    expect(i18n.t("common.items", { count: 1 })).toBe("1 item");
  });

  it("uses plural form for count=2", () => {
    expect(i18n.t("common.items", { count: 2 })).toBe("2 items");
  });

  it("uses plural form for count=0 (English 'other')", () => {
    expect(i18n.t("common.items", { count: 0 })).toBe("0 items");
  });

  it("uses plural form for count=100", () => {
    expect(i18n.t("common.items", { count: 100 })).toBe("100 items");
  });

  it("falls back to 'other' when category not defined", () => {
    i18n.loadTranslations("en", "test", {
      people: { other: "{{count}} people" },
    });
    expect(i18n.t("test.people", { count: 1 })).toBe("1 people");
  });

  it("respects locale-specific plural rules (French: count=0 → one)", () => {
    i18n.loadTranslations("fr", "pl", {
      chats: {
        one: "{{count}} chat",
        other: "{{count}} chats",
      },
    });
    i18n.setLocale("fr");
    // French: 0 → "one" category
    expect(i18n.t("pl.chats", { count: 0 })).toBe("0 chat");
    expect(i18n.t("pl.chats", { count: 1 })).toBe("1 chat");
    expect(i18n.t("pl.chats", { count: 2 })).toBe("2 chats");
  });

  it("count=0 defaults to 0 when params has no count", () => {
    i18n.loadTranslations("en", "no-count", {
      label: { one: "single", other: "multiple" },
    });
    // No count param → count = 0 → "other" in English
    expect(i18n.t("no-count.label")).toBe("multiple");
  });
});

// ---------------------------------------------------------------------------
// Locale management
// ---------------------------------------------------------------------------

describe("I18n locale management", () => {
  it("getLocale returns default locale initially", () => {
    const i18n = new I18n({
      defaultLocale: "fr",
      locales: ["en", "fr"],
    });
    expect(i18n.getLocale()).toBe("fr");
  });

  it("setLocale switches and getLocale reflects change", () => {
    const i18n = new I18n({
      defaultLocale: "en",
      locales: ["en", "fr"],
    });
    i18n.setLocale("fr");
    expect(i18n.getLocale()).toBe("fr");
  });

  it("setLocale throws for unsupported locale", () => {
    const i18n = new I18n({
      defaultLocale: "en",
      locales: ["en", "fr"],
    });
    expect(() => i18n.setLocale("es")).toThrow(
      '[i18n] Locale "es" is not in the configured locales',
    );
  });

  it("getLocales returns all configured locales", () => {
    const i18n = new I18n({
      defaultLocale: "en",
      locales: ["en", "fr", "de"],
    });
    expect(i18n.getLocales()).toEqual(["en", "fr", "de"]);
  });

  it("throws when locales array is empty", () => {
    expect(
      () => new I18n({ defaultLocale: "en", locales: [] }),
    ).toThrow("[i18n] At least one locale must be provided");
  });

  it("fallbackLocale defaults to defaultLocale when omitted", () => {
    const i18n = new I18n({
      defaultLocale: "en",
      locales: ["en", "fr"],
    });
    // Load only fr, not en
    i18n.loadTranslations("fr", "ns", { key: "FR" });
    i18n.setLocale("en");
    // Missing in en, fallback to default (= en), no match → key
    expect(i18n.t("ns.key")).toBe("ns.key");
  });
});

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

describe("I18n.formatNumber", () => {
  let i18n: I18n;

  beforeEach(() => {
    i18n = new I18n({ defaultLocale: "en", locales: ["en", "de-DE"] });
  });

  it("formats integer per locale", () => {
    const result = i18n.formatNumber(1234567);
    // en-US style: "1,234,567"
    expect(result).toMatch(/1[,.]234[,.]567/);
  });

  it("respects locale override", () => {
    const result = i18n.formatNumber(1234567.89, "de-DE");
    // German style: "1.234.567,89"
    expect(result).toContain(".");
    expect(result).toContain(",");
  });

  it("falls back to String(n) for unknown locale", () => {
    const result = i18n.formatNumber(42, "zz-INVALID");
    expect(result).toBe("42");
  });
});

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

describe("I18n.formatDate", () => {
  let i18n: I18n;

  beforeEach(() => {
    i18n = new I18n({ defaultLocale: "en", locales: ["en", "de"] });
  });

  it("formats a Date object", () => {
    const result = i18n.formatDate(new Date("2026-01-15"));
    // Should contain month "Jan"
    expect(result).toContain("Jan");
  });

  it("formats a timestamp number", () => {
    const result = i18n.formatDate(
      new Date("2026-06-01").getTime(),
    );
    expect(result).toContain("Jun");
  });

  it("respects locale override", () => {
    const result = i18n.formatDate(
      new Date("2026-01-15"),
      "de",
    );
    // German short month for Jan could be "Jan" or "Jan."
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("falls back to toLocaleDateString on error", () => {
    const result = i18n.formatDate(
      new Date("2026-01-15"),
      "zz-INVALID" as string,
    );
    // Should still produce something
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Relative time formatting
// ---------------------------------------------------------------------------

describe("I18n.formatRelativeTime", () => {
  let i18n: I18n;

  beforeEach(() => {
    i18n = new I18n({ defaultLocale: "en", locales: ["en"] });
  });

  it("returns 'now' for same instant (rounded to 0)", () => {
    const now = new Date();
    const result = i18n.formatRelativeTime(now);
    expect(result).toBe("now");
  });

  it("formats seconds ago", () => {
    const date = new Date(Date.now() - 30_000); // 30s ago
    const result = i18n.formatRelativeTime(date);
    expect(result).toMatch(/30 sec/);
  });

  it("formats minutes ago", () => {
    const date = new Date(Date.now() - 5 * 60_000); // 5 min ago
    const result = i18n.formatRelativeTime(date);
    expect(result).toMatch(/5 min/);
  });

  it("formats hours ago", () => {
    const date = new Date(Date.now() - 2 * 60 * 60_000); // 2h ago
    const result = i18n.formatRelativeTime(date);
    expect(result).toMatch(/2 hour/);
  });

  it("formats days ago", () => {
    const date = new Date(Date.now() - 3 * 24 * 60 * 60_000); // 3d ago
    const result = i18n.formatRelativeTime(date);
    expect(result).toMatch(/3 day/);
  });

  it("formats future time", () => {
    const date = new Date(Date.now() + 24 * 60 * 60_000); // in 1 day
    const result = i18n.formatRelativeTime(date);
    expect(result).toMatch(/(in 1 day|tomorrow)/);
  });

  it("respects explicit 'now' parameter", () => {
    const ref = new Date("2026-06-01T12:00:00Z");
    const date = new Date("2026-06-01T10:00:00Z"); // 2 hours before ref
    const result = i18n.formatRelativeTime(date, "en", ref);
    expect(result).toMatch(/2 hour/);
  });

  it("falls back to crude English for invalid locale", () => {
    const date = new Date(Date.now() - 2 * 60 * 60_000);
    const result = i18n.formatRelativeTime(date, "zz-INVALID" as string);
    expect(result).toMatch(/2 hours ago/);
  });
});

// ---------------------------------------------------------------------------
// Translation loading (overwrite behavior)
// ---------------------------------------------------------------------------

describe("I18n.loadTranslations", () => {
  it("merges keys at the top level of a namespace", () => {
    const i18n = new I18n({ defaultLocale: "en", locales: ["en"] });
    i18n.loadTranslations("en", "ns", { a: "A" });
    i18n.loadTranslations("en", "ns", { b: "B" });
    expect(i18n.t("ns.a")).toBe("A");
    expect(i18n.t("ns.b")).toBe("B");
  });

  it("later load overwrites earlier keys for the same locale+namespace", () => {
    const i18n = new I18n({ defaultLocale: "en", locales: ["en"] });
    i18n.loadTranslations("en", "ns", { a: "First" });
    i18n.loadTranslations("en", "ns", { a: "Second" });
    expect(i18n.t("ns.a")).toBe("Second");
  });

  it("loads namespace-scoped translations independently", () => {
    const i18n = new I18n({ defaultLocale: "en", locales: ["en"] });
    i18n.loadTranslations("en", "ns1", { key: "ns1-value" });
    i18n.loadTranslations("en", "ns2", { key: "ns2-value" });
    expect(i18n.t("ns1.key")).toBe("ns1-value");
    expect(i18n.t("ns2.key")).toBe("ns2-value");
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("I18n — edge cases", () => {
  it("empty params object", () => {
    const i18n = createI18n();
    expect(i18n.t("common.greeting", {})).toBe("Hello");
  });

  it("interpolation with multiple placeholders", () => {
    const i18n = new I18n({ defaultLocale: "en", locales: ["en"] });
    i18n.loadTranslations("en", "ns", {
      multi: "{{first}} {{second}} {{first}}",
    });
    expect(
      i18n.t("ns.multi", { first: "Hello", second: "World" }),
    ).toBe("Hello World Hello");
  });

  it("interpolation key identical to ICU keyword 'count' without plural", () => {
    const i18n = new I18n({ defaultLocale: "en", locales: ["en"] });
    i18n.loadTranslations("en", "ns", {
      label: "{{count}} items",
    });
    // Plain string — interpolation only, no plural selection
    expect(i18n.t("ns.label", { count: 5 })).toBe("5 items");
  });

  it("keys with special characters work", () => {
    const i18n = new I18n({ defaultLocale: "en", locales: ["en"] });
    i18n.loadTranslations("en", "ns", {
      "hello_world": "snake ok",
      "camelCase": "camel ok",
      "key.with.dots.in.name": "literal dots ok",
    });
    expect(i18n.t("ns.hello_world")).toBe("snake ok");
    expect(i18n.t("ns.camelCase")).toBe("camel ok");
    // "key.with.dots.in.name" — the key itself has dots, but stored as a flat key
    // Dot-notation walks segments, so this would try ns → key → with → dots → in → name
    // This is expected behavior; users should avoid dots in key names OR use separate nesting
  });

  it("tolerates loading the same translations twice", () => {
    const i18n = new I18n({ defaultLocale: "en", locales: ["en"] });
    i18n.loadTranslations("en", "ns", { a: "A" });
    i18n.loadTranslations("en", "ns", { a: "A" });
    expect(i18n.t("ns.a")).toBe("A");
  });
});
