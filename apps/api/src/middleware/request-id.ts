/**
 * Request-ID middleware.
 *
 * Attaches a UUID-like identifier to every request so it can be
 * echoed in the response header and referenced from logs. Honours
 * an existing `X-Request-ID` from upstream proxies when present.
 *
 * @module middleware/request-id
 */

import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';

export const REQUEST_ID_HEADER = 'X-Request-ID';

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const incoming = c.req.header(REQUEST_ID_HEADER);
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  c.set('requestId', id);
  c.header(REQUEST_ID_HEADER, id);
  await next();
};

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}
