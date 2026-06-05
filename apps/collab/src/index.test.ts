import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

import { loadConfig, resetConfig, collabConfigSchema, DEFAULTS } from "./config.js";

describe("config", () => {
  beforeEach(() => {
    resetConfig();
  });

  describe("DEFAULTS", () => {
    it("has port 1234 and a data dir", () => {
      expect(DEFAULTS.port).toBe(1234);
      expect(DEFAULTS.dataDir).toBe("./.collab-data");
    });
  });

  describe("collabConfigSchema", () => {
    it("parses a valid env with all fields", () => {
      const result = collabConfigSchema.parse({
        PORT: "3000",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "secret",
        DATA_DIR: "/tmp/collab",
      });
      expect(result.PORT).toBe(3000);
      expect(result.REDIS_URL).toBe("redis://localhost:6379");
      expect(result.JWT_SECRET).toBe("secret");
      expect(result.DATA_DIR).toBe("/tmp/collab");
    });

    it("applies defaults for optional fields", () => {
      const result = collabConfigSchema.parse({
        JWT_SECRET: "secret",
      });
      expect(result.PORT).toBe(1234);
      expect(result.REDIS_URL).toBeUndefined();
      expect(result.DATA_DIR).toBe("./.collab-data");
    });

    it("fails when JWT_SECRET is missing", () => {
      expect(() => collabConfigSchema.parse({})).toThrow();
    });

    it("fails when JWT_SECRET is empty", () => {
      expect(() => collabConfigSchema.parse({ JWT_SECRET: "" })).toThrow();
    });

    it("fails when PORT is not a positive integer", () => {
      expect(() =>
        collabConfigSchema.parse({ JWT_SECRET: "x", PORT: "0" }),
      ).toThrow();
    });
  });

  describe("loadConfig", () => {
    it("parses the provided env object", () => {
      const config = loadConfig({
        JWT_SECRET: "test-secret",
        COLLAB_PORT: "5000",
      });
      expect(config.JWT_SECRET).toBe("test-secret");
      expect(config.PORT).toBe(5000);
    });

    it("ignores the shared API PORT env var", () => {
      const config = loadConfig({
        JWT_SECRET: "test-secret",
        PORT: "3000",
      });
      expect(config.PORT).toBe(1234);
    });

    it("caches the result on second call", () => {
      const a = loadConfig({ JWT_SECRET: "first" });
      const b = loadConfig({ JWT_SECRET: "second" });
      // Cached — second call's env is ignored
      expect(b.JWT_SECRET).toBe("first");
    });

    it("resetConfig clears the cache", () => {
      const a = loadConfig({ JWT_SECRET: "first" });
      resetConfig();
      const b = loadConfig({ JWT_SECRET: "second" });
      expect(b.JWT_SECRET).toBe("second");
    });
  });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

import { extractToken, authenticateConnection, type CollabUserContext } from "./auth.js";

// Mock the auth package's verifyAccessToken
vi.mock("@q-cms/auth", () => ({
  verifyAccessToken: vi.fn(),
}));

import { verifyAccessToken } from "@q-cms/auth";
import { Ok, Err } from "@q-cms/core/result";
import { UnauthorizedError } from "@q-cms/core/errors";

const mockVerify = vi.mocked(verifyAccessToken);

describe("auth", () => {
  describe("extractToken", () => {
    it("returns token from params.token (string)", () => {
      expect(extractToken({ token: "abc123" })).toBe("abc123");
    });

    it("returns token from params.connectionParams.token", () => {
      expect(
        extractToken({ connectionParams: { token: "nested-token" } }),
      ).toBe("nested-token");
    });

    it("prefers params.token over connectionParams.token", () => {
      expect(
        extractToken({
          token: "direct",
          connectionParams: { token: "nested" },
        }),
      ).toBe("direct");
    });

    it("returns null when token is missing", () => {
      expect(extractToken({})).toBeNull();
    });

    it("returns null when token is empty string", () => {
      expect(extractToken({ token: "" })).toBeNull();
    });

    it("returns null when connectionParams has no token", () => {
      expect(extractToken({ connectionParams: { other: true } })).toBeNull();
    });

    it("returns null when connectionParams is not an object", () => {
      expect(extractToken({ connectionParams: "string" })).toBeNull();
    });

    it("returns null when token is not a string", () => {
      expect(extractToken({ token: 123 })).toBeNull();
    });
  });

  describe("authenticateConnection", () => {
    const config = { JWT_SECRET: "test-secret" };

    it("returns user context on successful verification", async () => {
      mockVerify.mockResolvedValueOnce(
        Ok({
          sub: "user-1",
          email: "a@b.com",
          roles: ["admin"],
          scopes: [],
          iat: 1,
          exp: 9999999999,
        }),
      );

      const ctx = await authenticateConnection("valid-token", config);
      expect(ctx).toEqual<CollabUserContext>({
        userId: "user-1",
        email: "a@b.com",
        roles: ["admin"],
      });
    });

    it("throws when verification fails", async () => {
      mockVerify.mockResolvedValueOnce(
        Err(new UnauthorizedError("bad token")),
      );

      await expect(
        authenticateConnection("bad-token", config),
      ).rejects.toThrow("bad token");
    });

    it("passes the JWT_SECRET to verifyAccessToken", async () => {
      mockVerify.mockResolvedValueOnce(
        Ok({
          sub: "u",
          email: "e",
          roles: [],
          scopes: [],
          iat: 1,
          exp: 9999999999,
        }),
      );

      await authenticateConnection("t", config);
      expect(mockVerify).toHaveBeenCalledWith("t", {
        secret: "test-secret",
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

import { fetchDocument, storeDocument, deleteDocument } from "./persistence.js";
import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

describe("persistence", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = join(tmpdir(), `q-cms-collab-test-${randomUUID()}`);
    await mkdir(dataDir, { recursive: true });
  });

  describe("fetchDocument", () => {
    it("returns null for a non-existent document", async () => {
      const result = await fetchDocument(dataDir, "nonexistent");
      expect(result).toBeNull();
    });

    it("returns Uint8Array for a stored document", async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      await storeDocument(dataDir, "test-doc", data);
      const result = await fetchDocument(dataDir, "test-doc");
      expect(result).toBeInstanceOf(Uint8Array);
      expect([...result!]).toEqual([1, 2, 3, 4]);
    });
  });

  describe("storeDocument", () => {
    it("writes the document to a file", async () => {
      const data = new Uint8Array([5, 6, 7]);
      await storeDocument(dataDir, "my-entry", data);

      // Verify the file exists with correct content
      const files = await readFile(join(dataDir, "my-entry.yjs"));
      expect(new Uint8Array(files)).toEqual(data);
    });

    it("creates the data directory if missing", async () => {
      const nestedDir = join(dataDir, "deep", "path");
      const data = new Uint8Array([8]);
      await storeDocument(nestedDir, "doc", data);
      expect(existsSync(nestedDir)).toBe(true);
    });

    it("sanitises document names with special chars", async () => {
      const data = new Uint8Array([9]);
      await storeDocument(dataDir, "articles:abc-123", data);
      const result = await fetchDocument(dataDir, "articles:abc-123");
      expect(result).not.toBeNull();
    });
  });

  describe("deleteDocument", () => {
    it("removes a stored document", async () => {
      const data = new Uint8Array([10]);
      await storeDocument(dataDir, "to-delete", data);
      await deleteDocument(dataDir, "to-delete");
      const result = await fetchDocument(dataDir, "to-delete");
      expect(result).toBeNull();
    });

    it("does not throw when deleting a non-existent document", async () => {
      await expect(
        deleteDocument(dataDir, "no-such-doc"),
      ).resolves.toBeUndefined();
    });
  });

  describe("round-trip", () => {
    it("preserves binary data through store → fetch", async () => {
      const original = new Uint8Array(256);
      for (let i = 0; i < 256; i++) original[i] = i;

      await storeDocument(dataDir, "roundtrip", original);
      const fetched = await fetchDocument(dataDir, "roundtrip");

      expect(fetched).not.toBeNull();
      expect([...fetched!]).toEqual([...original]);
    });

    it("preserves empty document", async () => {
      const empty = new Uint8Array(0);
      await storeDocument(dataDir, "empty", empty);
      const fetched = await fetchDocument(dataDir, "empty");
      expect(fetched).not.toBeNull();
      expect(fetched!.length).toBe(0);
    });
  });
});
