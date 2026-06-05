/**
 * Hocuspocus real-time collaboration server entry point.
 *
 * Starts a WebSocket server with JWT authentication, file-based
 * document persistence, optional Redis scaling, and a health-check
 * HTTP endpoint.
 */


import { Redis } from "@hocuspocus/extension-redis";
import { Database } from "@hocuspocus/extension-database";
import { Logger } from "@hocuspocus/extension-logger";
import { Server } from "@hocuspocus/server";
import { authenticateConnection } from "./auth.js";
import { loadConfig, type CollabConfig } from "./config.js";
import { fetchDocument, storeDocument } from "./persistence.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StartServerResult {
  server: Server;
  config: CollabConfig;
  /** Shut down gracefully: close connections, persist, exit. */
  shutdown: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create and start the Hocuspocus collaboration server.
 *
 * Reads configuration from environment variables via {@link loadConfig}.
 * Call `shutdown()` on the returned result to tear down gracefully.
 */
export async function startServer(
  overrides?: Partial<CollabConfig>,
): Promise<StartServerResult> {
  const config = { ...loadConfig(), ...overrides };

  const extensions: Array<Database | Logger | Redis> = [
    new Logger(),
    new Database({
      fetch: ({ documentName }: { documentName: string }) =>
        fetchDocument(config.DATA_DIR, documentName),
      store: ({
        documentName,
        state,
      }: {
        documentName: string;
        state: Uint8Array;
      }) => storeDocument(config.DATA_DIR, documentName, state),
    }),
  ];

  if (config.REDIS_URL) {
    const redisConfig = parseRedisUrl(config.REDIS_URL);
    extensions.push(new Redis(redisConfig));
  }

  const server = new Server({
    name: "q-cms-collab",
    port: config.PORT,
    quiet: true,
    stopOnSignals: false, // we handle signals ourselves for graceful shutdown

    async onAuthenticate({ token, requestParameters }) {
      // Token may arrive via Hocuspocus provider's `token` field
      // or as a `token` query parameter on the WebSocket URL.
      const raw = token || requestParameters.get("token");

      if (!raw) {
        throw new Error("Authentication required");
      }

      return authenticateConnection(raw, config);
    },

    async onStoreDocument({ clientsCount }) {
      // Post-processing hook: called after document changes are persisted.
      // Future: trigger webhooks, update search index, invalidate cache, etc.
      // `documentName` available in payload when needed.
      void clientsCount;
    },

    async onRequest({ request, response }) {
      if (
        request.method === "GET" &&
        (request.url === "/health" || request.url === "/healthz")
      ) {
        response.writeHead(200, {
          "content-type": "application/json",
        });
        response.end(
          JSON.stringify({
            status: "ok",
            uptime: process.uptime(),
            documents: server.hocuspocus.getDocumentsCount(),
            connections: server.hocuspocus.getConnectionsCount(),
          }),
        );
        // Prevent the default "Welcome to Hocuspocus!" response
        throw undefined;
      }
    },
  });

  await server.listen();

  const shutdown = createShutdown(server, config);

  if (!config.REDIS_URL) {
    console.log(
      `[collab] Hocuspocus server listening on http://0.0.0.0:${config.PORT}`,
    );
  } else {
    console.log(
      `[collab] Hocuspocus server listening on http://0.0.0.0:${config.PORT} (Redis: ${config.REDIS_URL})`,
    );
  }

  return { server, config, shutdown };
}

// ---------------------------------------------------------------------------
// Shutdown
// ---------------------------------------------------------------------------

function createShutdown(
  server: Server,
  _config: CollabConfig,
): () => Promise<void> {
  let shuttingDown = false;

  return async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log("[collab] Shutting down gracefully…");

    const timeout = setTimeout(() => {
      console.error("[collab] Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
    timeout.unref();

    try {
      await server.destroy();
      console.log("[collab] Shutdown complete");
    } catch (err) {
      console.error("[collab] Error during shutdown:", err);
      process.exit(1);
    } finally {
      clearTimeout(timeout);
    }

    process.exit(0);
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a `redis://…` URL into host/port for the Redis extension. */
function parseRedisUrl(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
  };
}

// ---------------------------------------------------------------------------
// Auto-start when run directly
// ---------------------------------------------------------------------------

const isMain = process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js");

if (isMain) {
  const { shutdown } = await startServer();

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
