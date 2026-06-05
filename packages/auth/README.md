# `@q-cms/auth`

Authentication, authorization, and session helpers for Q-CMS.

This package wraps three concerns:

1. **Password hashing** — bcrypt at cost 12 (`password.ts`).
2. **Token primitives** — JWT (HS256) via `jose`, server sessions, and
   long-lived Personal Access Tokens (`jwt.ts`, `sessions.ts`, `api-tokens.ts`).
3. **Authorization** — Role-Based Access Control with conditions,
   including a fixed set of default roles and a TOTP implementation
   for two-factor authentication (`rbac.ts`, `totp.ts`).

It is built on top of `@q-cms/core` (branded types, `Result<T, E>`,
`DomainError` hierarchy).

## Install

```bash
pnpm add @q-cms/auth
```

## Quick start

```ts
import {
  hashPassword,
  verifyPassword,
  isStrongPassword,
  signAccessToken,
  verifyAccessToken,
  extractBearerToken,
  DEFAULT_ROLES,
  classify,
  require,
  generateApiToken,
  validateApiTokenScopes,
  generateTotpSecret,
  buildTotpUri,
  verifyTotpCode,
} from '@q-cms/auth';
import { Ok, Err } from '@q-cms/core/result';

// Passwords
const hash = await hashPassword('correct horse battery staple');
await verifyPassword('correct horse battery staple', hash); // → true
isStrongPassword('hunter2'); // → true

// JWT
const token = await signAccessToken(
  { sub: 'u1', email: 'a@b.com', roles: ['editor'], scopes: [] },
  { secret: process.env.JWT_SECRET!, ttl: 900 },
);
const claims = await verifyAccessToken(token, { secret: process.env.JWT_SECRET! });
if (claims.ok) console.log(claims.value);

// Bearer header
const t = extractBearerToken(request.headers.get('Authorization'));

// RBAC
classify(['editor'], { resource: { type: 'collection', name: 'Article' }, action: 'publish' });
// → true
const guard = require(
  ['viewer'],
  { resource: { type: 'settings' }, action: 'update' },
);
// → Err(ForbiddenError)

// API tokens
const { token, hash, prefix } = generateApiToken();
validateApiTokenScopes({ scopes: ['read:entries', 'write:*'] }, 'write:media'); // → true

// 2FA
const secret = generateTotpSecret();
const uri = buildTotpUri(secret, 'alice@example.com', 'Q-CMS');
verifyTotpCode(secret, '123456'); // → true | false
```

## API surface

| Module | Exports |
|---|---|
| `password` | `hashPassword`, `verifyPassword`, `isStrongPassword`, `generateRandomPassword`, `needsRehash`, `BCRYPT_COST` |
| `jwt` | `signAccessToken`, `verifyAccessToken`, `signRefreshToken`, `verifyRefreshToken`, `extractBearerToken`, `JwtPayload` |
| `sessions` | `createSessionId`, `hashToken`, `validateSession` |
| `api-tokens` | `generateApiToken`, `validateApiTokenScopes`, `parseScopes`, `parseScopesResult` |
| `totp` | `generateTotpSecret`, `buildTotpUri`, `verifyTotpCode` |
| `rbac` | `DEFAULT_ROLES`, `matches`, `evaluateConditions`, `classify`, `require` |

## Design choices

- **HS256** is the only signing algorithm. `jose` is used under the
  hood because it works in Node, Bun, and edge runtimes without
  crypto-polyfill gymnastics.
- **`Result<T, E>`** is returned from every fallible call. `UnauthorizedError`
  is the default failure type for token verification; `ForbiddenError`
  for authorization denials.
- **Default roles are frozen.** They mirror SPEC §6.2 verbatim
  (`super_admin`, `admin`, `editor`, `author`, `reviewer`, `viewer`).
  Custom roles can be passed to `classify`/`require` via the resolver
  argument.
- **TOTP is RFC 6238** — SHA-1, 6 digits, 30 s step, ±1 step window.
  Compatible with Google Authenticator, 1Password, Authy, Bitwarden.

## Scripts

```bash
pnpm --filter @q-cms/auth typecheck
pnpm --filter @q-cms/auth test
pnpm --filter @q-cms/auth test:coverage
```
