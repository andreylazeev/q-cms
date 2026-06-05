# ADR-0002: Hono as the HTTP framework

**Status:** Accepted (2026-06-05)
**Deciders:** Eng Lead
**Context:** Need a fast, edge-ready HTTP framework for the Q-CMS API.

## Decision

We use **Hono 4.x** as the HTTP framework for the API server.

## Context

Requirements:
- p99 latency < 80 ms for API reads (NFR-PERF-02)
- Edge runtime support (Cloudflare Workers, Vercel Edge, Deno Deploy)
- First-class TypeScript
- Middleware composition
- Small bundle size (we target edge)
- Active maintenance

## Options Considered

### Option A: Hono (chosen)
- ✅ ~14 KB bundle
- ✅ Top-tier performance benchmarks
- ✅ Runs everywhere (Node, Bun, Deno, edge)
- ✅ Excellent TypeScript types
- ✅ Type-safe RPC for internal monorepo clients
- ✅ Active development, growing community

### Option B: Fastify
- ✅ Fast (within 10-20% of Hono)
- ✅ Mature, huge plugin ecosystem
- ❌ Not edge-ready
- ❌ Larger bundle
- ❌ Schema-first (good, but heavier than Zod)

### Option C: Express
- ❌ Legacy middleware model
- ❌ No native async/await-first
- ❌ Slow

### Option D: NestJS
- ❌ Heavyweight, opinionated DI
- ❌ Not edge-ready
- ❌ Too much boilerplate

## Consequences

- API uses Hono router + middleware chain.
- Public SDK is generated from route types via `hc.client<typeof routes>()`.
- Edge deployment is straightforward (Cloudflare Workers, etc.).
- Less community knowledge of Hono vs Express; mitigate with thorough docs.
