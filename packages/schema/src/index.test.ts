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
} from "./index.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
          title: { type: "text", required: true, maxLength: 200 },
          slug: { type: "uid", target: "title", required: true },
          excerpt: { type: "text", maxLength: 500 },
          cover: { type: "media", allowedTypes: ["image"] },
          tags: { type: "relation", target: "Tag", multiple: true },
          content: { type: "blocks", blocks: ["paragraph", "heading"] },
          seo: { type: "component", component: "SEO" },
          publishedAt: { type: "datetime" },
        },
        indexes: ["slug", ["authorId", "publishedAt"]],
      }),
      Tag: collection({
        title: "Tag",
        slug: "tags",
        fields: {
          name: { type: "text", required: true },
        },
      }),
      Settings: collection({
        title: "Settings",
        slug: "settings",
        singleton: true,
        fields: {
          siteName: { type: "text" },
        },
      }),
    },
    components: {
      SEO: component({
        fields: {
          title: { type: "text", maxLength: 70 },
          description: { type: "text", maxLength: 160 },
        },
      }),
    },
    blocks: {
      ...core,
      callout: {
        schema: {
          type: {
            type: "enum",
            options: ["info", "warning", "success", "danger"],
            required: true,
          },
          text: { type: "text", required: true },
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
    expect(config.name).toBe("test-cms");
    expect(config.defaultLocale).toBe("en");
    expect(config.locales).toEqual(["en", "ru", "de"]);
  });

  it("preserves collection metadata", () => {
    const config = makeFullConfig();
    const article = config.collections.Article!;
    expect(article.title).toBe("Article");
    expect(article.slug).toBe("articles");
    expect(article.draftAndPublish).toBe(true);
    expect(article.versioning).toBe(true);
    expect(article.fields.title.type).toBe("text");
    expect(article.indexes).toEqual(["slug", ["authorId", "publishedAt"]]);
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
              author: { type: "relation", target: "Author" },
            },
          }),
        },
      }),
    ).toThrow("relation target \"Author\" not found");
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
              seo: { type: "component", component: "SEO" },
            },
          }),
        },
      }),
    ).toThrow("component \"SEO\" not found");
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
              body: { type: "blocks", blocks: ["imaginary"] },
            },
          }),
        },
      }),
    ).toThrow("block \"imaginary\" not found");
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
              slug: { type: "uid", target: "title" },
            },
          }),
        },
      }),
    ).toThrow("target field \"title\" not found in fields");
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
      fields: { name: { type: "text" } },
    });
    expect(col.title).toBe("Simple");
    expect(col.slug).toBe("simple");
    expect(col.fields.name.type).toBe("text");
    expect(col.draftAndPublish).toBeUndefined();
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
    expect(col.draftAndPublish).toBe(true);
    expect(col.versioning).toBe(true);
    expect(col.singleton).toBe(false);
  });

  it("supports indexes", () => {
    const col = collection({
      title: "Indexed",
      slug: "indexed",
      fields: { a: { type: "text" }, b: { type: "text" } },
      indexes: ["a", ["a", "b"]],
    });
    expect(col.indexes).toHaveLength(2);
  });

  it("supports all field types in a single collection", () => {
    const col = collection({
      title: "All Fields",
      slug: "all-fields",
      fields: {
        t: { type: "text", required: true, maxLength: 100, minLength: 1 },
        rt: { type: "richtext", maxLength: 5000 },
        n: { type: "number", min: 0, max: 100, integer: true },
        b: { type: "boolean", required: true },
        d: { type: "date" },
        dt: { type: "datetime" },
        j: { type: "json" },
        e: { type: "enum", options: ["a", "b", "c"] },
        m: { type: "media", allowedTypes: ["image"] },
        rel: { type: "relation", target: "Other", multiple: true },
        rep: { type: "repeatable", fields: { sub: { type: "text" } } },
        comp: { type: "component", component: "SomeComp" },
        geo: { type: "geo" },
        col: { type: "color" },
        pw: { type: "password" },
        em: { type: "email", unique: true },
        url: { type: "url" },
        uid: { type: "uid", target: "t" },
        sl: { type: "slug", target: "t" },
        blk: { type: "blocks", blocks: ["paragraph"] },
        loc: { type: "locale" },
      },
    });
    // Verify every field type is present
    expect(Object.keys(col.fields)).toHaveLength(21);
    expect(col.fields.t.type).toBe("text");
    expect(col.fields.rt.type).toBe("richtext");
    expect(col.fields.n.type).toBe("number");
    expect(col.fields.b.type).toBe("boolean");
    expect(col.fields.d.type).toBe("date");
    expect(col.fields.dt.type).toBe("datetime");
    expect(col.fields.j.type).toBe("json");
    expect(col.fields.e.type).toBe("enum");
    expect(col.fields.m.type).toBe("media");
    expect(col.fields.rel.type).toBe("relation");
    expect(col.fields.rep.type).toBe("repeatable");
    expect(col.fields.comp.type).toBe("component");
    expect(col.fields.geo.type).toBe("geo");
    expect(col.fields.col.type).toBe("color");
    expect(col.fields.pw.type).toBe("password");
    expect(col.fields.em.type).toBe("email");
    expect(col.fields.url.type).toBe("url");
    expect(col.fields.uid.type).toBe("uid");
    expect(col.fields.sl.type).toBe("slug");
    expect(col.fields.blk.type).toBe("blocks");
    expect(col.fields.loc.type).toBe("locale");
  });
});

// ---------------------------------------------------------------------------
// component() builder
// ---------------------------------------------------------------------------

describe("component()", () => {
  it("returns identity with fields", () => {
    const comp = component({
      fields: {
        title: { type: "text", required: true },
        count: { type: "number", integer: true },
      },
    });
    expect(comp.fields.title.type).toBe("text");
    expect(comp.fields.count.type).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// blocks — core blocks
// ---------------------------------------------------------------------------

describe("blocks", () => {
  it("exports core block names", () => {
    expect(core).toHaveProperty("paragraph");
    expect(core).toHaveProperty("heading");
    expect(core).toHaveProperty("image");
    expect(core).toHaveProperty("code");
    expect(core).toHaveProperty("quote");
    expect(core).toHaveProperty("embed");
    expect(core).toHaveProperty("gallery");
  });

  it("paragraph block has richtext text field", () => {
    expect(core.paragraph.schema.text.type).toBe("richtext");
    expect(core.paragraph.schema.text.required).toBe(true);
  });

  it("heading block has enum level + text", () => {
    const level = core.heading.schema.level;
    if (level.type === "enum") {
      expect(level.options).toEqual(["h1", "h2", "h3", "h4", "h5", "h6"]);
    }
    expect(core.heading.schema.text.type).toBe("text");
  });

  it("image block supports alt and caption", () => {
    expect(core.image.schema.image.type).toBe("media");
    expect(core.image.schema.alt.type).toBe("text");
    expect(core.image.schema.caption.type).toBe("text");
  });

  it("code block supports lineNumbers flag", () => {
    expect(core.code.schema.language.type).toBe("text");
    expect(core.code.schema.code.type).toBe("text");
    expect(core.code.schema.lineNumbers.type).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// Zod generation (validate.ts)
// ---------------------------------------------------------------------------

describe("zodForCollection", () => {
  const config = makeFullConfig();

  it("generates a valid Zod schema for Article", () => {
    const schema = zodForCollection(config.collections.Article, config.components);
    expect(schema).toBeDefined();
    expect(schema._def.typeName).toBe("ZodObject");

    // Required field must fail on missing
    const result = schema.safeParse({});
    expect(result.success).toBe(false);

    // Required field must pass
    const ok = schema.safeParse({ title: "Hello" });
    expect(ok.success).toBe(true);
    expect(ok.data?.title).toBe("Hello");
  });

  it("enforces maxLength on text fields", () => {
    const schema = zodForCollection(config.collections.Article, config.components);
    const result = schema.safeParse({ title: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("enforces required on uid field", () => {
    const schema = zodForCollection(config.collections.Article, config.components);
    const result = schema.safeParse({ title: "Hello" });
    // slug is required uid — missing should fail
    expect(result.success).toBe(false);
  });

  it("resolves component fields", () => {
    const schema = zodForCollection(config.collections.Article, config.components);
    const result = schema.safeParse({
      title: "Hello",
      slug: "hello",
      seo: { title: "SEO Title" },
    });
    expect(result.success).toBe(true);
    expect(result.data?.seo.title).toBe("SEO Title");
  });

  it("treats optional fields as optional", () => {
    const schema = zodForCollection(config.collections.Settings, config.components);
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("zodForComponent", () => {
  it("generates Zod for a component", () => {
    const comp = component({
      fields: {
        title: { type: "text", maxLength: 70 },
        count: { type: "number", integer: true },
      },
    });
    const schema = zodForComponent(comp);
    const ok = schema.safeParse({ title: "Test", count: 5 });
    expect(ok.success).toBe(true);
    expect(ok.data?.title).toBe("Test");
    expect(ok.data?.count).toBe(5);
  });
});

describe("zodForFieldMap", () => {
  it("works with a direct field map", () => {
    const schema = zodForFieldMap(
      { name: { type: "text", required: true } },
      {},
    );
    const ok = schema.safeParse({ name: "value" });
    expect(ok.success).toBe(true);
  });
});

describe("zodForBlock", () => {
  it("generates Zod for a block schema", () => {
    const schema = zodForBlock(core.quote);
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
        email: { type: "email", unique: true, required: true },
      },
    });
    expect(col.fields.email.type).toBe("email");
    if (col.fields.email.type === "email") {
      expect(col.fields.email.unique).toBe(true);
    }
  });

  it("relation field with multiple=true is array", () => {
    const col = collection({
      title: "Post",
      slug: "posts",
      fields: {
        tags: { type: "relation", target: "Tag", multiple: true },
      },
    });
    const tags = col.fields.tags;
    if (tags.type === "relation") {
      expect(tags.multiple).toBe(true);
      expect(tags.target).toBe("Tag");
    }
  });

  it("repeatable field nests fields", () => {
    const col = collection({
      title: "Form",
      slug: "form",
      fields: {
        items: {
          type: "repeatable",
          fields: {
            label: { type: "text", required: true },
            value: { type: "text" },
          },
        },
      },
    });
    const items = col.fields.items;
    if (items.type === "repeatable") {
      expect(items.fields.label.type).toBe("text");
    }
  });

  it("blocks field accepts string and BlockRef entries", () => {
    const col = collection({
      title: "Page",
      slug: "pages",
      fields: {
        body: {
          type: "blocks",
          blocks: ["paragraph", { ref: "heading", with: { startLevel: 2 } }],
        },
      },
    });
    const body = col.fields.body;
    if (body.type === "blocks") {
      expect(body.blocks).toHaveLength(2);
      expect(body.blocks[0]).toBe("paragraph");
      if (typeof body.blocks[1] === "object") {
        expect(body.blocks[1].ref).toBe("heading");
      }
    }
  });

  it("localized flag is settable on any field", () => {
    const col = collection({
      title: "Localized",
      slug: "localized",
      fields: {
        title: { type: "text", required: true, localized: true },
        count: { type: "number", localized: false },
      },
    });
    expect(col.fields.title.localized).toBe(true);
    expect(col.fields.count.localized).toBe(false);
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
    expect(config.webhooks).toHaveLength(1);
    expect(config.webhooks![0]!.name).toBe("on-publish");
  });
});
