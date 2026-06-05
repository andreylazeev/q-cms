/**
 * API code generation script.
 *
 * Reads the OpenAPI spec from `../openapi.ts` and emits:
 *   - `apps/api/src/generated/openapi.json` — full OpenAPI 3.1 spec
 *   - `apps/api/src/generated/routes.ts`   — typed route path exports
 *
 * Usage: bun run src/scripts/codegen.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// buildSpec is the single source of truth for the API surface.
// It is imported statically so tree-shaking / type-checking work
// and so this script fails at build time if the module is broken.
import { buildSpec } from '../openapi.js';

interface OpenApiPathItem {
  get?: Record<string, unknown>;
  post?: Record<string, unknown>;
  put?: Record<string, unknown>;
  patch?: Record<string, unknown>;
  delete?: Record<string, unknown>;
  options?: Record<string, unknown>;
  head?: Record<string, unknown>;
}

interface OpenApiSpec {
  paths?: Record<string, OpenApiPathItem>;
  [key: string]: unknown;
}

const GENERATED_DIR = resolve(import.meta.dirname!, '..', 'generated');

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

function main(): void {
  let spec: unknown;
  try {
    spec = buildSpec();
  } catch (err) {
    console.error('Failed to build OpenAPI spec:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const api = spec as OpenApiSpec;

  mkdirSync(GENERATED_DIR, { recursive: true });

  // ---- openapi.json -------------------------------------------------------
  const jsonPath = resolve(GENERATED_DIR, 'openapi.json');
  try {
    writeFileSync(jsonPath, JSON.stringify(api, null, 2), 'utf-8');
    console.log('Wrote', jsonPath);
  } catch (err) {
    console.error('Failed to write openapi.json:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // ---- routes.ts ----------------------------------------------------------
  const routePath = resolve(GENERATED_DIR, 'routes.ts');
  try {
    const routesSource = generateRoutes(api.paths ?? {});
    writeFileSync(routePath, routesSource, 'utf-8');
    console.log('Wrote', routePath);
  } catch (err) {
    console.error('Failed to write routes.ts:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

/**
 * Derive a stable camelCase identifier from a URL path segment.
 *
 * Strips leading/trailing slashes and braces, then converts
 * hyphenated words to camelCase (e.g. "magic-link" → "magicLink").
 */
function segmentToId(segment: string): string {
  const raw = segment.replace(/^[/]+|[/]+$/g, '').replace(/[{}]/g, '');
  return raw.replace(/-([a-z])/g, (_m, c) => (c as string).toUpperCase());
}

/**
 * Derive a readable export name from an OpenAPI path.
 *
 * Examples:
 *   /health                          → 'health'
 *   /auth/login                      → 'authLogin'
 *   /users/{id}                      → 'usersById'
 *   /collections/{slug}/entries/{id} → 'collectionsBySlugEntriesById'
 */
function pathToName(path: string): string {
  const parts = path.replace(/^\//, '').split('/').filter((s) => s.length > 0);

  let name = '';
  let i = 0;
  while (i < parts.length) {
    const seg = parts[i];
    if (seg === undefined) break;
    if (seg.startsWith('{') && seg.endsWith('}')) {
      const paramName = segmentToId(seg);
      name += `By${capitalize(paramName)}`;
    } else {
      name += capitalize(segmentToId(seg));
    }
    i++;
  }

  if (!name) return 'root';
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Convert OpenAPI path params (e.g. `/users/{id}`) to Hono-style params
 * (e.g. `/users/:id`).
 */
function toHonoPath(path: string): string {
  return path.replace(/\{(\w+)\}/g, ':$1');
}

// ---------------------------------------------------------------------------
// Route type generation
// ---------------------------------------------------------------------------

function generateRoutes(paths: Record<string, OpenApiPathItem>): string {
  const pathKeys = Object.keys(paths).sort();

  // Collect one entry per (path, method) pair.
  const entries: Array<{
    path: string;
    method: HttpMethod;
    operationId: string;
    responseRefs: string[];
  }> = [];

  for (const path of pathKeys) {
    const item = paths[path];
    if (item === undefined) continue;
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (!operation) continue;

      const rawOperationId = operation['operationId'] as string | undefined;
      const opId = rawOperationId ?? pathToMethodName(path, method);
      const responseRefs = extractResponseRefs(operation);

      entries.push({ path, method, operationId: opId, responseRefs });
    }
  }

  // Group by path for the per-path exports
  const pathGroups = new Map<string, typeof entries>();
  for (const e of entries) {
    const group = pathGroups.get(e.path) ?? [];
    group.push(e);
    pathGroups.set(e.path, group);
  }

  const lines: string[] = [
    '// Auto-generated by scripts/codegen.ts — DO NOT EDIT.',
    '//',
    '// Maps the API surface discovered from the OpenAPI spec.',
    '',
  ];

  // Per-path const exports with method documentation
  for (const [path, group] of pathGroups) {
    const id = pathToName(path);
    const comment = group.map((m) => `  // ${m.method.toUpperCase()}`).join('\n');
    lines.push(`/**`);
    if (comment) lines.push(comment.replace(/^  /, ''));
    lines.push(` */`);
    lines.push(`export const ${id}Path = '${path}' as const;`);
    lines.push(`export const ${id}HonoPath = '${toHonoPath(path)}' as const;`);
    lines.push('');
  }

  // All paths record
  lines.push(`/** All API route paths (OpenAPI format). */`);
  lines.push(`export const API_PATHS = {`);
  for (const path of pathKeys) {
    const id = pathToName(path);
    lines.push(`  ${id}: '${path}',`);
  }
  lines.push(`} as const;`);
  lines.push('');
  lines.push(`/** Union of all API route path strings. */`);
  lines.push(`export type ApiPath = (typeof API_PATHS)[keyof typeof API_PATHS];`);
  lines.push('');

  // Methods map
  lines.push(`/** HTTP methods exposed on each path. */`);
  lines.push(`export const API_METHODS = {`);
  for (const path of pathKeys) {
    const item = paths[path];
    if (item === undefined) continue;
    const methods = HTTP_METHODS.filter((m) => item[m]);
    const id = pathToName(path);
    lines.push(`  ${id}: [`);
    for (const m of methods) {
      lines.push(`    '${m}',`);
    }
    lines.push(`  ] as const,`);
  }
  lines.push(`} as const;`);
  lines.push('');

  // Response refs map
  lines.push(`/** Response schema refs per (path, method) — empty when unspecified. */`);
  lines.push(`export const API_RESPONSES = {`);
  for (const e of entries) {
    const refs = e.responseRefs.length
      ? `[${e.responseRefs.map((r) => `'${r}'`).join(', ')}]`
      : '[]';
    lines.push(`  ${e.operationId}: ${refs} as const,`);
  }
  lines.push(`} as const;`);
  lines.push('');

  return lines.join('\n') + '\n';
}

function pathToMethodName(path: string, method: HttpMethod): string {
  return `${method}${capitalize(pathToName(path))}`;
}

/**
 * Extract `$ref` strings from response schemas so the generated type file
 * carries linkage back to the component schemas.
 */
function extractResponseRefs(operation: Record<string, unknown>): string[] {
  const responses = operation['responses'] as
    | Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>
    | undefined;
  if (!responses) return [];

  const refs: string[] = [];
  for (const statusCode of Object.keys(responses)) {
    if (!statusCode.startsWith('2')) continue;
    const response = responses[statusCode];
    if (response === undefined) continue;
    const ref = response.content?.['application/json']?.schema?.$ref;
    if (ref && refs.indexOf(ref) === -1) refs.push(ref);
  }
  return refs.sort();
}

main();
