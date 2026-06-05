import { describe, it, expect } from "vitest";
import {
  collection,
  component,
  core,
  defineConfig,
  zodForCollection,
  zodForComponent,
  zodForFieldMap,
  zodForBlock,
  type FieldConfig,
} from "./index.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function field<T extends FieldConfig["type"]>(
  cfg: Extract<FieldConfig, { type: T }>,
): Extract<FieldConfig, { type: T }> {
  return cfg;
}

function assertExists<T>(v: T | undefined, msg: string): T {
  if (v === undefined) throw new Error(msg);
  return v;
}

function makeFullConfig() {
  return defineConfig({
    name: "test-cms",
    defaultLocale: "en",
    locales: ["en", "ru", "de"],
    collections: {
      Article: collection({
        title: "Article",
        slug: "articles",
        draftAndPublish: true,
        versioning: true,
        fields: {
          title: field({ type: "text", required: true, maxLength: 200 }),
          slug: field({ type: "uid", target: "title", required: true }),
          excerpt: field({ type: "text", maxLength: 500 }),
          cover: field({ type: "media", allowedTypes: ["image"] }),
          tags: field({ type: "relation", target: "Tag", multiple: true }),
          content: field({ type: "blocks", blocks: ["paragraph", "heading"] }),
          seo: field({ type: "component", component: "SEO" }),
          publishedAt: field({ type: "datetime" }),
        },
        indexes: ["slug", ["authorId", "publishedAt"]],
      }),
      Tag: collection({
        title: "Tag",
        slug: "tags",
        fields: {
          name: field({ type: "text", required: true }),
        },
      }),
      Settings: collection({
        title: "Settings",
        slug: "settings",
        singleton: true,
        fields: {
          siteName: field({ type: "text" }),
        },
      }),
    },
    components: {
      SEO: component({
        fields: {
          title: field({ type: "text", maxLength: 70 }),
          description: field({ type: "text", maxLength: 160 }),
        },
      }),
    },
    blocks: {
      ...core,
      callout: {
        schema: {
          type: field({
            type: "enum",
            options: ["info", "warning", "success", "danger"],
            required: true,
          }),
          text: field({ type: "text", required: true }),
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// defineConfig
// ---------------------------------------------------------------------------

describe("defineConfig", () => {
  it("returns the config object unchanged", () => {
    const config = makeFullConfig();
    expect(config["name"]).toBe("test-cms");
    expect(config["defaultLocale"]).toBe("en");
    expect(config["locales"]).toEqual(["en", "ru", "de"]);
  });

  it("preserves collection metadata", () => {
    const config = makeFullConfig();
    const article = assertExists(
      config["collections"]["Article"],
      "Article must exist",
    );
    expect(article["title"]).toBe("Article");
    expect(article["slug"]).toBe("articles");
    expect(article["draftAndPublish"]).toBe(true);
    expect(article["versioning"]).toBe(true);
    const titleField = assertExists(
      article["fields"]["title"],
      "title field must exist",
    );
    expect(titleField["type"]).toBe("text");
    expect(article["indexes"]).toEqual(["slug", ["authorId", "publishedAt"]]);
  });

  it("throws when defaultLocale is not in locales", () => {
    expect(() =>
      defineConfig({
        name: "bad",
        defaultLocale: "fr",
        locales: ["en"],
        collections: {},
      }),
    ).toThrow("not found in locales array");
  });

  it("throws when singleton has draftAndPublish", () => {
    expect(() =>
      defineConfig({
        name: "bad",
        defaultLocale: "en",
        locales: ["en"],
        collections: {
          Bad: collection({
            title: "Bad",
            slug: "bad",
            singleton: true,
            draftAndPublish: true,
            fields: {},
          }),
        },
      }),
    ).toThrow("singleton collections cannot have draftAndPublish");
  });

  it("throws on unknown relation target", () => {
    expect(() =>
      defineConfig({
        name: "bad",
        defaultLocale: "en",
        locales: ["en"],
        collections: {
          Post: collection({
            title: "Post",
            slug: "posts",
            fields: {
              author: field({ type: "relation", target: "Author" }),
            },
          }),
        },
      }),
    ).toThrow('relation target "Author" not found');
  });

  it("throws on unknown component reference", () => {
    expect(() =>
      defineConfig({
        name: "bad",
        defaultLocale: "en",
        locales: ["en"],
        collections: {
          Post: collection({
            title: "Post",
            slug: "posts",
            fields: {
              seo: field({ type: "component", component: "SEO" }),
            },
          }),
        },
      }),
    ).toThrow('component "SEO" not found');
  });

  it("throws on unknown block reference", () => {
    expect(() =>
      defineConfig({
        name: "bad",
        defaultLocale: "en",
        locales: ["en"],
        collections: {
          Post: collection({
            title: "Post",
            slug: "posts",
            fields: {
              body: field({ type: "blocks", blocks: ["imaginary"] }),
            },
          }),
        },
      }),
    ).toThrow('block "imaginary" not found');
  });

  it("throws on uid/slug target pointing to missing field", () => {
    expect(() =>
      defineConfig({
        name: "bad",
        defaultLocale: "en",
        locales: ["en"],
        collections: {
          Post: collection({
            title: "Post",
            slug: "posts",
            fields: {
              slug: field({ type: "uid", target: "title" }),
            },
          }),
        },
      }),
    ).toThrow('target field "title" not found in fields');
  });
});

// ---------------------------------------------------------------------------
// collection() builder
// ---------------------------------------------------------------------------

describe("collection()", () => {
  it("returns identity for a minimal collection", () => {
    const col = collection({
      title: "Simple",
      slug: "simple",
      fields: { name: field({ type: "text" }) },
    });
    expect(col["title"]).toBe("Simple");
    expect(col["slug"]).toBe("simple");
    const nameField = assertExists(col["fields"]["name"], "name field");
    expect(nameField["type"]).toBe("text");
    expect(col["draftAndPublish"]).toBeUndefined();
  });

  it("supports draftAndPublish, versioning, singleton", () => {
    const col = collection({
      title: "Full",
      slug: "full",
      draftAndPublish: true,
      versioning: true,
      singleton: false,
      fields: {},
    });
    expect(col["draftAndPublish"]).toBe(true);
    expect(col["versioning"]).toBe(true);
    expect(col["singleton"]).toBe(false);
  });

  it("supports indexes", () => {
    const col = collection({
      title: "Indexed",
      slug: "indexed",
      fields: { a: field({ type: "text" }), b: field({ type: "text" }) },
      indexes: ["a", ["a", "b"]],
    });
    expect(col["indexes"]).toHaveLength(2);
  });

  it("supports all field types in a single collection", () => {
    const col = collection({
      title: "All Fields",
      slug: "all-fields",
      fields: {
        t: field({
          type: "text",
          required: true,
          maxLength: 100,
          minLength: 1,
        }),
        rt: field({ type: "richtext", maxLength: 5000 }),
        n: field({ type: "number", min: 0, max: 100, integer: true }),
        b: field({ type: "boolean", required: true }),
        d: field({ type: "date" }),
        dt: field({ type: "datetime" }),
        j: field({ type: "json" }),
        e: field({ type: "enum", options: ["a", "b", "c"] }),
        m: field({ type: "media", allowedTypes: ["image"] }),
        rel: field({ type: "relation", target: "Other", multiple: true }),
        rep: field({
          type: "repeatable",
          fields: { sub: field({ type: "text" }) },
        }),
        comp: field({ type: "component", component: "SomeComp" }),
        geo: field({ type: "geo" }),
        col: field({ type: "color" }),
        pw: field({ type: "password" }),
        em: field({ type: "email", unique: true }),
        url: field({ type: "url" }),
        uid: field({ type: "uid", target: "t" }),
        sl: field({ type: "slug", target: "t" }),
        blk: field({ type: "blocks", blocks: ["paragraph"] }),
        loc: field({ type: "locale" }),
      },
    });

    const fields = col["fields"];
    expect(Object.keys(fields)).toHaveLength(21);

    function checkField(name: string, expectedType: FieldConfig["type"]) {
      const f = assertExists(fields[name], `field ${name} must exist`);
      expect(f["type"]).toBe(expectedType);
    }

    checkField("t", "text");
    checkField("rt", "richtext");
    checkField("n", "number");
    checkField("b", "boolean");
    checkField("d", "date");
    checkField("dt", "datetime");
    checkField("j", "json");
    checkField("e", "enum");
    checkField("m", "media");
    checkField("rel", "relation");
    checkField("rep", "repeatable");
    checkField("comp", "component");
    checkField("geo", "geo");
    checkField("col", "color");
    checkField("pw", "password");
    checkField("em", "email");
    checkField("url", "url");
    checkField("uid", "uid");
    checkField("sl", "slug");
    checkField("blk", "blocks");
    checkField("loc", "locale");
  });
});

// ---------------------------------------------------------------------------
// component() builder
// ---------------------------------------------------------------------------

describe("component()", () => {
  it("returns identity with fields", () => {
    const comp = component({
      fields: {
        title: field({ type: "text", required: true }),
        count: field({ type: "number", integer: true }),
      },
    });
    const titleField = assertExists(comp["fields"]["title"], "title field");
    expect(titleField["type"]).toBe("text");
    const countField = assertExists(comp["fields"]["count"], "count field");
    expect(countField["type"]).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// blocks — core blocks
// ---------------------------------------------------------------------------

describe("blocks", () => {
  it("exports core block names", () => {
    expect(core["paragraph"]).toBeDefined();
    expect(core["heading"]).toBeDefined();
    expect(core["image"]).toBeDefined();
    expect(core["code"]).toBeDefined();
    expect(core["quote"]).toBeDefined();
    expect(core["embed"]).toBeDefined();
    expect(core["gallery"]).toBeDefined();
  });

  it("paragraph block has richtext text field", () => {
    const p = assertExists(core["paragraph"], "paragraph block");
    const text = assertExists(p["schema"]["text"], "text field");
    expect(text["type"]).toBe("richtext");
    expect(text["required"]).toBe(true);
  });

  it("heading block has enum level + text", () => {
    const h = assertExists(core["heading"], "heading block");
    const level = assertExists(h["schema"]["level"], "level field");
    if (level["type"] === "enum") {
      expect(level["options"]).toEqual([
        "h1", "h2", "h3", "h4", "h5", "h6",
      ]);
    }
    const text = assertExists(h["schema"]["text"], "text field");
    expect(text["type"]).toBe("text");
  });

  it("image block supports alt and caption", () => {
    const img = assertExists(core["image"], "image block");
    expect(
      assertExists(img["schema"]["image"], "image field")["type"],
    ).toBe("media");
    expect(
      assertExists(img["schema"]["alt"], "alt field")["type"],
    ).toBe("text");
    expect(
      assertExists(img["schema"]["caption"], "caption field")["type"],
    ).toBe("text");
  });

  it("code block supports lineNumbers flag", () => {
    const c = assertExists(core["code"], "code block");
    expect(
      assertExists(c["schema"]["language"], "language field")["type"],
    ).toBe("text");
    expect(
      assertExists(c["schema"]["code"], "code field")["type"],
    ).toBe("text");
    expect(
      assertExists(c["schema"]["lineNumbers"], "lineNumbers field")["type"],
    ).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// Zod generation (validate.ts)
// ---------------------------------------------------------------------------

describe("zodForCollection", () => {
  const config = makeFullConfig();
  const article = assertExists(
    config["collections"]["Article"],
    "Article",
  );
  const components = config["components"] ?? {};

  it("generates a valid Zod schema for Article", () => {
    const schema = zodForCollection(article, components);
    expect(schema).toBeDefined();
    expect(schema._def.typeName).toBe("ZodObject");

    const result = schema.safeParse({});
    expect(result.success).toBe(false);

    const ok = schema.safeParse({ title: "Hello" });
    expect(ok.success).toBe(true);
    expect(ok.data?.["title"]).toBe("Hello");
  });

  it("enforces maxLength on text fields", () => {
    const schema = zodForCollection(article, components);
    const result = schema.safeParse({ title: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("uid field is auto-generated and not enforced by Zod", () => {
    const schema = zodForCollection(article, components);
    // uid is auto-generated, so it passes without it
    const result = schema.safeParse({ title: "Hello" });
    expect(result.success).toBe(true);
  });

  it("resolves component fields", () => {
    const schema = zodForCollection(article, components);
    const result = schema.safeParse({
      title: "Hello",
      slug: "hello",
      seo: { title: "SEO Title" },
    });
    expect(result.success).toBe(true);
    expect(result.data?.["seo"]?.["title"]).toBe("SEO Title");
  });

  it("treats optional fields as optional", () => {
    const settings = assertExists(
      config["collections"]["Settings"],
      "Settings",
    );
    const schema = zodForCollection(settings, components);
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("zodForComponent", () => {
  it("generates Zod for a component", () => {
    const comp = component({
      fields: {
        title: field({ type: "text", maxLength: 70 }),
        count: field({ type: "number", integer: true }),
      },
    });
    const schema = zodForComponent(comp);
    const ok = schema.safeParse({ title: "Test", count: 5 });
    expect(ok.success).toBe(true);
    expect(ok.data?.["title"]).toBe("Test");
    expect(ok.data?.["count"]).toBe(5);
  });
});

describe("zodForFieldMap", () => {
  it("works with a direct field map", () => {
    const schema = zodForFieldMap(
      { name: field({ type: "text", required: true }) },
      {},
    );
    const ok = schema.safeParse({ name: "value" });
    expect(ok.success).toBe(true);
  });
});

describe("zodForBlock", () => {
  it("generates Zod for a block schema", () => {
    const quote = assertExists(core["quote"], "quote block");
    const schema = zodForBlock(quote);
    const ok = schema.safeParse({ text: "Some quote" });
    expect(ok.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// field type flavors
// ---------------------------------------------------------------------------

describe("field types", () => {
  it("email field optionally enforces uniqueness (metadata only)", () => {
    const col = collection({
      title: "Users",
      slug: "users",
      fields: {
        email: field({ type: "email", unique: true, required: true }),
      },
    });
    const emailField = assertExists(col["fields"]["email"], "email field");
    expect(emailField["type"]).toBe("email");
    if (emailField["type"] === "email") {
      expect(emailField["unique"]).toBe(true);
    }
  });

  it("relation field with multiple=true is array", () => {
    const col = collection({
      title: "Post",
      slug: "posts",
      fields: {
        tags: field({
          type: "relation",
          target: "Tag",
          multiple: true,
        }),
      },
    });
    const tagsField = assertExists(col["fields"]["tags"], "tags field");
    if (tagsField["type"] === "relation") {
      expect(tagsField["multiple"]).toBe(true);
      expect(tagsField["target"]).toBe("Tag");
    }
  });

  it("repeatable field nests fields", () => {
    const col = collection({
      title: "Form",
      slug: "form",
      fields: {
        items: field({
          type: "repeatable",
          fields: {
            label: field({ type: "text", required: true }),
            value: field({ type: "text" }),
          },
        }),
      },
    });
    const items = assertExists(col["fields"]["items"], "items field");
    if (items["type"] === "repeatable") {
      const label = assertExists(
        items["fields"]["label"],
        "label sub-field",
      );
      expect(label["type"]).toBe("text");
    }
  });

  it("blocks field accepts string and BlockRef entries", () => {
    const col = collection({
      title: "Page",
      slug: "pages",
      fields: {
        body: field({
          type: "blocks",
          blocks: [
            "paragraph",
            { ref: "heading", with: { startLevel: 2 } },
          ],
        }),
      },
    });
    const body = assertExists(col["fields"]["body"], "body field");
    if (body["type"] === "blocks") {
      expect(body["blocks"]).toHaveLength(2);
      expect(body["blocks"][0]).toBe("paragraph");
      if (typeof body["blocks"][1] === "object") {
        expect(body["blocks"][1]["ref"]).toBe("heading");
      }
    }
  });

  it("localized flag is settable on any field", () => {
    const col = collection({
      title: "Localized",
      slug: "localized",
      fields: {
        title: field({
          type: "text",
          required: true,
          localized: true,
        }),
        count: field({ type: "number", localized: false }),
      },
    });
    expect(
      assertExists(col["fields"]["title"], "title")["localized"],
    ).toBe(true);
    expect(
      assertExists(col["fields"]["count"], "count")["localized"],
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// webhooks
// ---------------------------------------------------------------------------

describe("webhooks", () => {
  it("accepts webhook configs", () => {
    const config = defineConfig({
      name: "webhook-test",
      defaultLocale: "en",
      locales: ["en"],
      collections: {},
      webhooks: [
        {
          name: "on-publish",
          events: ["entry.publish"],
          url: "https://example.com/hook",
        },
      ],
    });
    const webhooks = assertExists(config["webhooks"], "webhooks");
    expect(webhooks).toHaveLength(1);
    expect(webhooks[0]!["name"]).toBe("on-publish");
  });
});
