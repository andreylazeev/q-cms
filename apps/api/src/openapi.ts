/**
 * OpenAPI 3.1 spec generation.
 *
 * Hand-rolled spec to avoid pulling in a heavy generator. Covers the
 * public REST surface declared in `API.md` §3.1 and is intentionally
 * conservative — components are added incrementally as new routes
 * come online.
 *
 * Exposes:
 *   GET /api/v1/openapi.json
 *   GET /api/v1/docs            (Swagger UI, gated by DOCS_ENABLED)
 *
 * @module openapi
 */

import type { Context } from 'hono';
import { getEnv } from './env.ts';

const SPEC_VERSION = '1.0.0';
const API_VERSION = 'v1';

const INFO = {
  title: 'Q-CMS API',
  version: API_VERSION,
  description:
    'Block-first, API-first headless CMS. See `API.md` for the full contract and `SPEC.md` for the implementation plan.',
  license: { name: 'MIT' },
  contact: { name: 'Q-CMS Engineering', url: 'https://q-cms.dev' },
} as const;

const SERVERS = [
  { url: 'https://{tenant}.q-cms.dev/api/v1', variables: { tenant: { default: 'demo', description: 'Tenant slug' } } },
  { url: 'http://localhost:3000/api/v1' },
] as const;

const TAGS = [
  { name: 'auth', description: 'Authentication & session management' },
  { name: 'users', description: 'Admin user CRUD' },
  { name: 'collections', description: 'Collection schemas' },
  { name: 'entries', description: 'Content entries' },
  { name: 'singletons', description: 'Singleton records' },
  { name: 'media', description: 'Media library' },
  { name: 'webhooks', description: 'Outbound webhooks' },
  { name: 'audit', description: 'Audit log' },
  { name: 'search', description: 'Full-text search' },
  { name: 'roles', description: 'Role management' },
  { name: 'system', description: 'Health, metrics, OpenAPI' },
] as const;

const COMMON_RESPONSES = {
  BadRequest: errorResponse(400, 'bad_request', 'Malformed request'),
  Unauthorized: errorResponse(401, 'unauthorized', 'Authentication required'),
  Forbidden: errorResponse(403, 'forbidden', 'Insufficient permissions'),
  NotFound: errorResponse(404, 'not_found', 'Resource not found'),
  Validation: errorResponse(422, 'validation_failed', 'Validation failed'),
  RateLimit: errorResponse(429, 'rate_limited', 'Rate limit exceeded'),
  ServerError: errorResponse(500, 'internal_error', 'Server error'),
} as const;

function errorResponse(status: number, code: string, title: string) {
  return {
    description: title,
    content: {
      'application/vnd.api+json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: { errors: [{ status: String(status), code, title }] },
      },
    },
  };
}

/**
 * Build the spec object. We construct it as a literal so that any
 * accidental `any` is caught by the type-checker.
 */
function buildSpec(): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: { ...INFO, 'x-spec-version': SPEC_VERSION },
    servers: SERVERS,
    tags: TAGS,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        apiToken: { type: 'http', scheme: 'bearer', description: 'Personal access token (qcs_ prefix).' },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['errors'],
          properties: {
            errors: {
              type: 'array',
              items: {
                type: 'object',
                required: ['status', 'code', 'title'],
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                  code: { type: 'string' },
                  title: { type: 'string' },
                  detail: { type: 'string' },
                  source: {
                    type: 'object',
                    properties: { pointer: { type: 'string' }, parameter: { type: 'string' } },
                  },
                  meta: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
        PageInfo: {
          type: 'object',
          properties: {
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
            startCursor: { type: 'string', nullable: true },
            endCursor: { type: 'string', nullable: true },
          },
        },
        User: userSchema(),
        Entry: entrySchema(),
        Collection: collectionSchema(),
        Media: mediaSchema(),
        Webhook: webhookSchema(),
        Role: roleSchema(),
      },
      responses: COMMON_RESPONSES,
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/health': healthPath(),
      '/ready': readyPath(),
      '/metrics': metricsPath(),
      '/auth/login': loginPath(),
      '/auth/refresh': refreshPath(),
      '/auth/logout': logoutPath(),
      '/auth/magic-link': magicLinkPath(),
      '/auth/me': mePath(),
      '/users': usersListPath(),
      '/users/{id}': userByIdPath(),
      '/collections': collectionsListPath(),
      '/collections/{slug}': collectionBySlugPath(),
      '/collections/{slug}/entries': entriesListPath(),
      '/collections/{slug}/entries/{id}': entryByIdPath(),
      '/collections/{slug}/entries/{id}/publish': entryPublishPath(),
      '/collections/{slug}/entries/{id}/unpublish': entryUnpublishPath(),
      '/collections/{slug}/entries/{id}/duplicate': entryDuplicatePath(),
      '/collections/{slug}/entries/{id}/revisions': entryRevisionsPath(),
      '/singletons/{slug}': singletonPath(),
      '/media': mediaListPath(),
      '/media/{id}': mediaByIdPath(),
      '/media/{id}/render': mediaRenderPath(),
      '/webhooks': webhooksListPath(),
      '/webhooks/{id}': webhooksByIdPath(),
      '/webhooks/{id}/deliveries': webhookDeliveriesPath(),
      '/audit-log': auditPath(),
      '/search': searchPath(),
      '/roles': rolesPath(),
      '/bulk': bulkPath(),
    },
  };
}

// ---------------------------------------------------------------------------
// Path helpers (kept terse for the spec only)
// ---------------------------------------------------------------------------

function healthPath() {
  return {
    get: {
      tags: ['system'],
      summary: 'Liveness probe',
      security: [],
      responses: { '200': { description: 'OK' } },
    },
  };
}
function readyPath() {
  return {
    get: {
      tags: ['system'],
      summary: 'Readiness probe (pings downstream services)',
      security: [],
      responses: { '200': { description: 'OK' }, '503': COMMON_RESPONSES.ServerError },
    },
  };
}
function metricsPath() {
  return {
    get: {
      tags: ['system'],
      summary: 'Prometheus metrics',
      security: [],
      responses: { '200': { description: 'Exposition' } },
    },
  };
}

function loginPath() {
  return {
    post: {
      tags: ['auth'],
      summary: 'Email + password login',
      security: [],
      requestBody: jsonBody({ email: 'string', password: 'string', totp: 'string?' }),
      responses: {
        '200': jsonResponse({ accessToken: 'string', refreshToken: 'string' }),
        '401': COMMON_RESPONSES.Unauthorized,
        '422': COMMON_RESPONSES.Validation,
      },
    },
  };
}
function refreshPath() {
  return {
    post: {
      tags: ['auth'],
      summary: 'Refresh access token',
      security: [],
      requestBody: jsonBody({ refreshToken: 'string' }),
      responses: { '200': jsonResponse({ accessToken: 'string' }), '401': COMMON_RESPONSES.Unauthorized },
    },
  };
}
function logoutPath() {
  return {
    post: {
      tags: ['auth'],
      summary: 'Revoke the current session',
      security: [],
      requestBody: jsonBody({ refreshToken: 'string' }),
      responses: { '200': jsonResponse({ revoked: 'boolean' }) },
    },
  };
}
function magicLinkPath() {
  return {
    post: {
      tags: ['auth'],
      summary: 'Request a single-use magic link',
      security: [],
      requestBody: jsonBody({ email: 'string' }),
      responses: { '200': jsonResponse({ sent: 'boolean' }) },
    },
  };
}
function mePath() {
  return {
    get: {
      tags: ['auth'],
      summary: 'Current user',
      responses: { '200': jsonResponseRef('User'), '401': COMMON_RESPONSES.Unauthorized },
    },
  };
}

function usersListPath() {
  return {
    get: {
      tags: ['users'],
      summary: 'List users',
      parameters: [cursorParam(), limitParam()],
      responses: { '200': jsonCollection('User') },
    },
    post: {
      tags: ['users'],
      summary: 'Create a user',
      requestBody: jsonBody({ email: 'string', password: 'string', username: 'string?' }),
      responses: { '201': jsonResponseRef('User'), '409': COMMON_RESPONSES.Validation },
    },
  };
}
function userByIdPath() {
  return {
    parameters: [idParam()],
    get: {
      tags: ['users'],
      summary: 'Get a user',
      responses: { '200': jsonResponseRef('User'), '404': COMMON_RESPONSES.NotFound },
    },
    patch: {
      tags: ['users'],
      summary: 'Update a user',
      requestBody: jsonBody({ email: 'string?', firstName: 'string?' }),
      responses: { '200': jsonResponseRef('User') },
    },
    delete: { tags: ['users'], summary: 'Delete a user', responses: { '204': { description: 'No content' } } },
  };
}

function collectionsListPath() {
  return {
    get: { tags: ['collections'], summary: 'List collections', responses: { '200': jsonCollection('Collection') } },
  };
}
function collectionBySlugPath() {
  return {
    parameters: [slugParam()],
    get: {
      tags: ['collections'],
      summary: 'Get a collection schema',
      responses: { '200': jsonResponseRef('Collection'), '404': COMMON_RESPONSES.NotFound },
    },
  };
}
function entriesListPath() {
  return {
    parameters: [slugParam()],
    get: {
      tags: ['entries'],
      summary: 'List entries',
      parameters: [cursorParam(), limitParam(), statusParam(), localeParam()],
      responses: { '200': jsonCollection('Entry') },
    },
    post: {
      tags: ['entries'],
      summary: 'Create an entry',
      requestBody: jsonBody({ slug: 'string?', locale: 'string?', data: 'object' }),
      responses: { '201': jsonResponseRef('Entry'), '409': COMMON_RESPONSES.Validation },
    },
  };
}
function entryByIdPath() {
  return {
    parameters: [slugParam(), idParam()],
    get: { tags: ['entries'], summary: 'Get an entry', responses: { '200': jsonResponseRef('Entry') } },
    patch: {
      tags: ['entries'],
      summary: 'Update an entry',
      requestBody: jsonBody({ data: 'object?', status: 'string?' }),
      responses: { '200': jsonResponseRef('Entry') },
    },
    delete: { tags: ['entries'], summary: 'Delete an entry', responses: { '204': { description: 'No content' } } },
  };
}
function entryPublishPath() {
  return {
    parameters: [slugParam(), idParam()],
    post: { tags: ['entries'], summary: 'Publish', responses: { '200': jsonResponseRef('Entry') } },
  };
}
function entryUnpublishPath() {
  return {
    parameters: [slugParam(), idParam()],
    post: { tags: ['entries'], summary: 'Unpublish', responses: { '200': jsonResponseRef('Entry') } },
  };
}
function entryDuplicatePath() {
  return {
    parameters: [slugParam(), idParam()],
    post: { tags: ['entries'], summary: 'Duplicate', responses: { '201': jsonResponseRef('Entry') } },
  };
}
function entryRevisionsPath() {
  return {
    parameters: [slugParam(), idParam()],
    get: { tags: ['entries'], summary: 'List revisions', responses: { '200': jsonCollection('EntryRevision') } },
  };
}
function singletonPath() {
  return {
    parameters: [slugParam()],
    get: { tags: ['singletons'], summary: 'Get a singleton', responses: { '200': jsonResponseRef('Entry') } },
    put: { tags: ['singletons'], summary: 'Upsert a singleton', responses: { '200': jsonResponseRef('Entry') } },
  };
}
function mediaListPath() {
  return {
    get: { tags: ['media'], summary: 'List media', responses: { '200': jsonCollection('Media') } },
    post: {
      tags: ['media'],
      summary: 'Upload (multipart/form-data)',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: { type: 'string', format: 'binary' },
                alt: { type: 'string' },
                caption: { type: 'string' },
                folderId: { type: 'string' },
              },
              required: ['file'],
            },
          },
        },
      },
      responses: { '201': jsonResponseRef('Media') },
    },
  };
}
function mediaByIdPath() {
  return {
    parameters: [idParam()],
    get: { tags: ['media'], summary: 'Get media metadata', responses: { '200': jsonResponseRef('Media') } },
    patch: { tags: ['media'], summary: 'Update media', responses: { '200': jsonResponseRef('Media') } },
    delete: { tags: ['media'], summary: 'Delete media', responses: { '204': { description: 'No content' } } },
  };
}
function mediaRenderPath() {
  return {
    parameters: [idParam(), { name: 'w', in: 'query', schema: { type: 'integer' } }, { name: 'h', in: 'query', schema: { type: 'integer' } }, { name: 'fit', in: 'query', schema: { type: 'string', enum: ['cover', 'contain', 'fill', 'inside', 'outside'] } }, { name: 'format', in: 'query', schema: { type: 'string', enum: ['webp', 'avif', 'jpeg', 'png', 'auto'] } }, { name: 'q', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }],
    get: {
      tags: ['media'],
      summary: 'Render a transformed image',
      responses: { '200': { description: 'Image bytes', content: { 'image/webp': { schema: { type: 'string', format: 'binary' } } } } },
    },
  };
}
function webhooksListPath() {
  return {
    get: { tags: ['webhooks'], summary: 'List webhooks', responses: { '200': jsonCollection('Webhook') } },
    post: {
      tags: ['webhooks'],
      summary: 'Create a webhook',
      requestBody: jsonBody({ name: 'string', url: 'string', events: 'string[]', secret: 'string' }),
      responses: { '201': jsonResponseRef('Webhook') },
    },
  };
}
function webhooksByIdPath() {
  return {
    parameters: [idParam()],
    patch: { tags: ['webhooks'], summary: 'Update a webhook', responses: { '200': jsonResponseRef('Webhook') } },
    delete: { tags: ['webhooks'], summary: 'Delete a webhook', responses: { '204': { description: 'No content' } } },
  };
}
function webhookDeliveriesPath() {
  return {
    parameters: [idParam()],
    get: { tags: ['webhooks'], summary: 'List deliveries', responses: { '200': jsonCollection('WebhookDelivery') } },
  };
}
function auditPath() {
  return {
    get: {
      tags: ['audit'],
      summary: 'Query the audit log',
      parameters: [actorIdParam(), actionParam(), resourceTypeParam(), cursorParam()],
      responses: { '200': jsonCollection('AuditLog') },
    },
  };
}
function searchPath() {
  return {
    get: {
      tags: ['search'],
      summary: 'Full-text search',
      security: [],
      parameters: [
        { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
        { name: 'collection', in: 'query', schema: { type: 'string' } },
        { name: 'locale', in: 'query', schema: { type: 'string' } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
        { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } },
      ],
      responses: { '200': { description: 'Results' } },
    },
  };
}
function rolesPath() {
  return {
    get: { tags: ['roles'], summary: 'List roles', responses: { '200': jsonCollection('Role') } },
    post: {
      tags: ['roles'],
      summary: 'Create a role',
      requestBody: jsonBody({ name: 'string', description: 'string?' }),
      responses: { '201': jsonResponseRef('Role') },
    },
  };
}
function bulkPath() {
  return {
    post: {
      tags: ['entries'],
      summary: 'Bulk operations (≤ 100 per request)',
      requestBody: jsonBody({ atomic: 'boolean', operations: 'array' }),
      responses: { '200': { description: 'Per-op results' } },
    },
  };
}

// ---------------------------------------------------------------------------
// Schema helpers
// ---------------------------------------------------------------------------

function userSchema() {
  return {
    type: 'object',
    properties: {
      id: { type: 'string' },
      email: { type: 'string' },
      username: { type: 'string', nullable: true },
      isActive: { type: 'boolean' },
      isSuperAdmin: { type: 'boolean' },
      totpEnabled: { type: 'boolean' },
    },
  };
}
function entrySchema() {
  return {
    type: 'object',
    properties: {
      id: { type: 'string' },
      slug: { type: 'string', nullable: true },
      status: { type: 'string', enum: ['draft', 'in_review', 'approved', 'published', 'archived'] },
      locale: { type: 'string' },
      data: { type: 'object', additionalProperties: true },
      publishedAt: { type: 'string', nullable: true, format: 'date-time' },
    },
  };
}
function collectionSchema() {
  return {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      isSingleton: { type: 'boolean' },
      draftAndPublish: { type: 'boolean' },
      versioning: { type: 'boolean' },
    },
  };
}
function mediaSchema() {
  return {
    type: 'object',
    properties: {
      id: { type: 'string' },
      filename: { type: 'string' },
      mimeType: { type: 'string' },
      sizeBytes: { type: 'integer' },
      width: { type: 'integer', nullable: true },
      height: { type: 'integer', nullable: true },
    },
  };
}
function webhookSchema() {
  return {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      url: { type: 'string' },
      events: { type: 'array', items: { type: 'string' } },
      isActive: { type: 'boolean' },
    },
  };
}
function roleSchema() {
  return {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string', nullable: true },
      isSystem: { type: 'boolean' },
    },
  };
}

function idParam() {
  return { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
}
function slugParam() {
  return { name: 'slug', in: 'path', required: true, schema: { type: 'string' } };
}
function cursorParam() {
  return { name: 'cursor', in: 'query', schema: { type: 'string' } };
}
function limitParam() {
  return { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } };
}
function statusParam() {
  return { name: 'status', in: 'query', schema: { type: 'string' } };
}
function localeParam() {
  return { name: 'locale', in: 'query', schema: { type: 'string' } };
}
function actorIdParam() {
  return { name: 'actorId', in: 'query', schema: { type: 'string' } };
}
function actionParam() {
  return { name: 'action', in: 'query', schema: { type: 'string' } };
}
function resourceTypeParam() {
  return { name: 'resourceType', in: 'query', schema: { type: 'string' } };
}

function jsonBody(fields: Record<string, string>) {
  return {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(fields).map(([k, v]) => [k, hintToSchema(v)]),
          ),
          required: Object.entries(fields)
            .filter(([, v]) => !v.endsWith('?'))
            .map(([k]) => k),
        },
      },
    },
  };
}
function jsonResponseRef(ref: string) {
  return jsonResponse({ $ref: `#/components/schemas/${ref}` });
}
function jsonResponse(properties: Record<string, unknown> | object) {
  return {
    description: 'OK',
    content: {
      'application/vnd.api+json': {
        schema: {
          type: 'object',
          properties,
        },
      },
    },
  };
}
function jsonCollection(ref: string) {
  return {
    description: 'OK',
    content: {
      'application/vnd.api+json': {
        schema: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: `#/components/schemas/${ref}` } },
            meta: { type: 'object' },
          },
        },
      },
    },
  };
}
function hintToSchema(hint: string): Record<string, unknown> {
  const isOptional = hint.endsWith('?');
  const base = isOptional ? hint.slice(0, -1) : hint;
  if (base === 'object') return { type: 'object', additionalProperties: true };
  if (base === 'boolean') return { type: 'boolean' };
  if (base.endsWith('[]')) return { type: 'array', items: { type: 'string' } };
  return { type: 'string' };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** Return the generated OpenAPI spec as JSON. */
export function openApiSpecHandler(c: Context): Response {
  return c.json(buildSpec());
}

const SWAGGER_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Q-CMS API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({ url: '/api/v1/openapi.json', dom_id: '#swagger' });
      };
    </script>
  </body>
</html>`;

/** Serve the Swagger UI when DOCS_ENABLED=true. */
export function docsHandler(c: Context): Response {
  const env = getEnv();
  if (!env.DOCS_ENABLED) {
    return c.json({ errors: [{ status: '404', code: 'not_found', title: 'Not Found' }] }, 404);
  }
  return new Response(SWAGGER_HTML, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
