# `@q-cms/admin`

The Q-CMS administration UI — a Next.js 15 / React 19 application that
provides a block-based content editor, media library, user management,
and operational dashboards for the `@q-cms/core` content model.

## Stack

| Concern              | Choice                                  |
| -------------------- | --------------------------------------- |
| Framework            | Next.js 15 (App Router) + React 19      |
| Styling              | Tailwind CSS 4 (CSS-first `@theme`)      |
| Data fetching        | TanStack Query v5                       |
| Forms                | react-hook-form + Zod                   |
| Editor               | TipTap (ProseMirror) via `@q-cms/editor`|
| Tests (unit)         | Vitest + jsdom                          |
| Tests (E2E)          | Playwright                              |
| Real-time collab     | Hocuspocus provider                     |
| Lint / format        | Biome 1.9                               |

## Scripts

| Command               | Purpose                                       |
| --------------------- | --------------------------------------------- |
| `pnpm dev`            | Run the dev server on port 3001               |
| `pnpm build`          | Production build (`output: 'standalone'`)     |
| `pnpm start`          | Serve the production build                    |
| `pnpm typecheck`      | `tsc --noEmit` against the strict tsconfig    |
| `pnpm test:unit`      | Run Vitest unit tests                         |
| `pnpm test:e2e`       | Run Playwright E2E tests (boots a dev server) |
| `pnpm test:coverage`  | Unit tests with coverage report               |
| `pnpm lint`           | Biome check                                   |

## Project layout

```
src/
├── app/                       # Next.js App Router
│   ├── (auth)/login/          # Public login screen
│   ├── (dashboard)/           # Auth-gated dashboard
│   │   ├── page.tsx           # Stats + recent activity
│   │   ├── collections/       # Collection & entry CRUD
│   │   ├── media/             # Drag-and-drop media library
│   │   ├── users/             # User & invitation mgmt
│   │   └── settings/          # Site, webhooks, API tokens
│   ├── api/health/route.ts    # 200 OK liveness probe
│   ├── globals.css            # Tailwind 4 + design tokens
│   └── layout.tsx             # Root layout (providers)
├── components/
│   ├── Editor/                # TipTap wrapper + slash menu
│   ├── DataTable.tsx          # Generic accessible table
│   ├── Header.tsx             # Top bar (search, theme, user)
│   ├── Sidebar.tsx            # Primary navigation
│   ├── StatusBadge.tsx        # Tone-aware status pill
│   ├── AuthProvider.tsx       # Rehydrates localStorage session
│   ├── Toaster.tsx            # Lightweight toast surface
│   └── ui/                    # Button, Input, Select, Modal, Card
├── hooks/
│   ├── use-api.ts             # Generic fetch helper
│   ├── use-auth.ts            # useAuth / useMe / useLogin / useLogout
│   ├── use-collections.ts     # useCollections / useCollection
│   ├── use-entries.ts         # useEntries, useEntry, useCreateEntry,
│   │                          # useUpdateEntry, useDeleteEntry, usePublishEntry
│   └── use-media.ts           # useMedia, useUploadMedia, useDeleteMedia
├── lib/
│   ├── api-client.ts          # Singleton client (stub or real SDK)
│   ├── query-client.ts        # TanStack Query singleton
│   ├── utils.ts               # `cn()` class-merging helper
│   └── stubs/                 # Local fallbacks for unbuilt packages
└── middleware.ts              # Edge auth gate
```

## Local stubs

While the `@q-cms/api-client`, `@q-cms/editor`, and `@q-cms/ui`
packages are being built in parallel, the admin app ships local
stubs in `src/lib/stubs/`. Once those packages publish, replace the
imports in `src/lib/api-client.ts` (and the editor) — no UI changes
required.

## Auth model

- `useAuth()` exposes `{ user, status, login, logout, refetch }`.
- The session is persisted in `localStorage` under the
  `q-cms-admin:auth` key. On the server, `middleware.ts` checks for
  a `qcms_token` cookie and redirects to `/login` when missing.
- The login form posts to `/api/v1/auth/login` (or the stub when the
  API isn't running).

## Theming

`globals.css` defines design tokens (colors, radii, fonts) in light
and dark variants. The active theme is toggled by adding/removing the
`dark` class on `<html>` — the `Header` component owns the toggle and
respects the `prefers-color-scheme` media query on first paint.

## Testing

- Unit tests live in `test/` and use Vitest. They cover the
  `StatusBadge` and api-client stub.
- E2E tests live in `e2e/` and use Playwright. The default config
  expects the dev server on port 3001 and uses
  `localStorage` seeding to bypass the auth gate.

## Notes

- The admin app does not run `next build` in CI for this scaffold —
  the API isn't deployed alongside. `typecheck` and `test:unit` are
  the canonical signals.
- Performance budget (per SPEC §14): initial JS ≤ 250 KB gzipped.
  TipTap + react-query + the stub client fit comfortably within that.
