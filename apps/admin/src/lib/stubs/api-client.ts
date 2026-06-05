/**
 * Local stub for `@q-cms/api-client` while the real package is being built.
 *
 * Returns rich demo data so the admin UI renders populated screens out of
 * the box. The same shapes are used by the in-memory API stub in
 * `apps/api/src/lib/stubs/db.ts` — the two stay in sync via the
 * canonical types in `@q-cms/core`.
 */

import type {
  SdkEntry,
  SdkUser,
  SdkCollection,
  SdkMedia,
  SdkRole,
} from './sdk-types.ts';

export interface StubClientConfig {
  baseUrl: string;
  token?: string;
  apiKey?: string;
}

export interface StubPaginated<T> {
  data: readonly T[];
  meta: {
    pageInfo: { hasNext: boolean; hasPrev: boolean; limit: number; total: number | null };
    totalCount: number;
  };
}

export interface StubClient {
  readonly config: { baseUrl: string; token?: string };
  setToken(token: string | undefined): void;
  entries<T = SdkEntry>(collection: string): {
    list(): Promise<StubPaginated<T>>;
    get(id: string): Promise<T | null>;
    create(data: Record<string, unknown>): Promise<T>;
    update(id: string, data: Record<string, unknown>): Promise<T>;
    delete(id: string): Promise<void>;
  };
  collections: {
    list(): Promise<readonly SdkCollection[]>;
    findBySlug(slug: string): Promise<SdkCollection | null>;
  };
  users: {
    me(): Promise<SdkUser | null>;
    list(): Promise<readonly SdkUser[]>;
  };
  media: {
    list(): Promise<readonly SdkMedia[]>;
    upload(file: File | Blob): Promise<SdkMedia>;
    delete(id: string): Promise<void>;
  };
  roles: {
    list(): Promise<readonly SdkRole[]>;
  };
  templates: {
    list(): Promise<readonly SdkTemplate[]>;
    get(id: string): Promise<SdkTemplate | null>;
    create(data: SdkTemplateInput): Promise<SdkTemplate>;
    update(id: string, data: Partial<SdkTemplateInput>): Promise<SdkTemplate>;
    delete(id: string): Promise<void>;
  };
  auth: {
    login(input: { email: string; password: string }): Promise<{ token: string; user: SdkUser }>;
    logout(): Promise<void>;
  };
}

export interface SdkTemplateSection {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: SdkTemplateSection[];
}

export interface SdkTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  locale: string;
  sections: SdkTemplateSection[];
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SdkTemplateInput {
  name: string;
  slug: string;
  description?: string;
  locale?: string;
  sections?: SdkTemplateSection[];
  meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const NOW = '2026-06-05T11:00:00.000Z';

const COLLECTIONS: readonly SdkCollection[] = [
  {
    id: 'articles',
    name: 'Article',
    slug: 'articles',
    isSingleton: false,
    draftAndPublish: true,
    versioning: true,
    schema: { type: 'object', required: ['title'], properties: { title: { type: 'string' } } },
    settings: {},
    displayName: 'Articles',
    displayNameI18n: {},
    createdAt: '2026-04-01T09:00:00.000Z',
    updatedAt: NOW,
  },
  {
    id: 'authors',
    name: 'Author',
    slug: 'authors',
    isSingleton: false,
    draftAndPublish: false,
    versioning: false,
    schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
    settings: {},
    displayName: 'Authors',
    displayNameI18n: {},
    createdAt: '2026-04-01T09:00:00.000Z',
    updatedAt: NOW,
  },
  {
    id: 'categories',
    name: 'Category',
    slug: 'categories',
    isSingleton: false,
    draftAndPublish: false,
    versioning: false,
    schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
    settings: {},
    displayName: 'Categories',
    displayNameI18n: {},
    createdAt: '2026-04-01T09:00:00.000Z',
    updatedAt: NOW,
  },
];

const USERS: readonly SdkUser[] = [
  {
    id: 'u_admin',
    email: 'admin@q-cms.local',
    username: 'admin',
    firstName: 'Anya',
    lastName: 'Lazareva',
    passwordHash: null,
    isActive: true,
    isSuperAdmin: true,
    totpEnabled: false,
    emailVerifiedAt: '2026-04-01T00:00:00.000Z',
    lastLoginAt: '2026-06-05T08:14:00.000Z',
    avatarId: 'm_avatar3',
    metadata: {},
    createdAt: '2026-04-01T09:00:00.000Z',
    updatedAt: NOW,
  },
  {
    id: 'u_editor',
    email: 'editor@q-cms.local',
    username: 'editor',
    firstName: 'Mark',
    lastName: 'Chen',
    passwordHash: null,
    isActive: true,
    isSuperAdmin: false,
    totpEnabled: false,
    emailVerifiedAt: '2026-04-02T00:00:00.000Z',
    lastLoginAt: '2026-06-04T17:42:00.000Z',
    avatarId: 'm_avatar2',
    metadata: {},
    createdAt: '2026-04-02T09:00:00.000Z',
    updatedAt: NOW,
  },
  {
    id: 'u_author',
    email: 'author@q-cms.local',
    username: 'author',
    firstName: 'Sofia',
    lastName: 'Volkova',
    passwordHash: null,
    isActive: true,
    isSuperAdmin: false,
    totpEnabled: false,
    emailVerifiedAt: '2026-04-03T00:00:00.000Z',
    lastLoginAt: '2026-06-05T07:01:00.000Z',
    avatarId: 'm_avatar1',
    metadata: {},
    createdAt: '2026-04-03T09:00:00.000Z',
    updatedAt: NOW,
  },
  {
    id: 'u_reviewer',
    email: 'reviewer@q-cms.local',
    username: 'reviewer',
    firstName: 'Daniel',
    lastName: 'Park',
    passwordHash: null,
    isActive: true,
    isSuperAdmin: false,
    totpEnabled: false,
    emailVerifiedAt: '2026-04-05T00:00:00.000Z',
    lastLoginAt: '2026-06-03T13:20:00.000Z',
    avatarId: null,
    metadata: {},
    createdAt: '2026-04-05T09:00:00.000Z',
    updatedAt: NOW,
  },
  {
    id: 'u_viewer',
    email: 'viewer@q-cms.local',
    username: 'viewer',
    firstName: 'Lina',
    lastName: 'Petrova',
    passwordHash: null,
    isActive: false,
    isSuperAdmin: false,
    totpEnabled: false,
    emailVerifiedAt: null,
    lastLoginAt: '2026-05-12T11:00:00.000Z',
    avatarId: null,
    metadata: {},
    createdAt: '2026-05-01T09:00:00.000Z',
    updatedAt: NOW,
  },
];

const MEDIA: readonly SdkMedia[] = [
  makeMedia('m_hero', 'hero-mountain.jpg', 'image/jpeg', 482_113, 1920, 1080, '#6b7d8e'),
  makeMedia('m_cover1', 'aurora-borealis.jpg', 'image/jpeg', 612_940, 1920, 1280, '#1e3a8a'),
  makeMedia('m_cover2', 'forest-trail.jpg', 'image/jpeg', 528_004, 1920, 1280, '#2d5a2d'),
  makeMedia('m_cover3', 'desert-dunes.jpg', 'image/jpeg', 397_821, 1920, 1280, '#c2956b'),
  makeMedia('m_cover4', 'city-night.jpg', 'image/jpeg', 445_670, 1920, 1280, '#1f1f3a'),
  makeMedia('m_cover5', 'ocean-cliffs.jpg', 'image/jpeg', 521_004, 1920, 1280, '#3a6b8a'),
  makeMedia('m_cover6', 'aut-forest.jpg', 'image/jpeg', 489_220, 1920, 1280, '#a85d2b'),
  makeMedia('m_avatar1', 'avatar-sofia.png', 'image/png', 24_512, 256, 256, '#d4a574'),
  makeMedia('m_avatar2', 'avatar-mark.png', 'image/png', 28_104, 256, 256, '#7a9d96'),
  makeMedia('m_avatar3', 'avatar-anya.png', 'image/png', 22_870, 256, 256, '#b07a7a'),
  makeMedia('m_doc1', 'release-notes-v0-1.pdf', 'application/pdf', 184_002, null, null, '#888888'),
  makeMedia('m_doc2', 'architecture-overview.pdf', 'application/pdf', 312_441, null, null, '#888888'),
];

const ENTRIES: readonly SdkEntry[] = [
  makeEntry('e_intro', 'articles', 'Welcome to Q-CMS', 'welcome-to-q-cms', 'published', {
    title: 'Welcome to Q-CMS',
    slug: 'welcome-to-q-cms',
    excerpt: 'A block-first, API-first headless CMS — designed for teams that move fast.',
    body: 'Q-CMS is a next-generation headless CMS with an integrated admin panel and block-based editor. Built for speed, flexibility, and predictable performance on the edge.',
    coverId: 'm_hero',
    authorId: 'u_admin',
  }, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
  makeEntry('e_changelog', 'articles', 'v0.1 Seed — what is included', 'v0-1-seed', 'published', {
    title: 'v0.1 Seed — what is included',
    slug: 'v0-1-seed',
    excerpt: 'Roles, permissions, collections, the admin shell, and the API contract — all wired up and ready to extend.',
    body: 'The first public seed of Q-CMS.',
    coverId: 'm_cover1',
    authorId: 'u_editor',
  }, '2026-06-02T14:30:00.000Z', '2026-06-04T09:15:00.000Z'),
  makeEntry('e_arch', 'articles', 'Architecture in one diagram', 'architecture', 'published', {
    title: 'Architecture in one diagram',
    slug: 'architecture',
    excerpt: 'Hono at the edge, Next.js for admin, BullMQ for jobs, Postgres for truth.',
    body: 'A guided tour through the runtime topology.',
    coverId: 'm_cover2',
    authorId: 'u_author',
  }, '2026-06-03T09:15:00.000Z', '2026-06-05T07:01:00.000Z'),
  makeEntry('e_blocks', 'articles', 'Block-first authoring', 'block-first', 'in_review', {
    title: 'Block-first authoring',
    slug: 'block-first',
    excerpt: 'Why we built the editor around blocks — and what it lets content teams ship without waiting on engineering.',
    body: 'Blocks trade rigid templates for composable primitives.',
    coverId: 'm_cover3',
    authorId: 'u_author',
  }, null, '2026-06-04T16:22:00.000Z'),
  makeEntry('e_draft', 'articles', 'Edge cache primer', 'edge-cache-primer', 'draft', {
    title: 'Edge cache primer',
    slug: 'edge-cache-primer',
    excerpt: 'Cache strategies for public content. Stale-while-revalidate, tag invalidation, and the trade-offs.',
    body: 'In progress. Drafted in the open.',
    coverId: 'm_cover5',
    authorId: 'u_editor',
  }, null, '2026-06-05T09:48:00.000Z'),
  makeEntry('e_archived', 'articles', 'Deprecated: API tokens legacy', 'api-tokens-legacy', 'archived', {
    title: 'Deprecated: API tokens legacy',
    slug: 'api-tokens-legacy',
    excerpt: 'The old qcs_legacy_ prefix is no longer accepted. Migrate to the new format.',
    body: 'Historical context for the migration.',
    coverId: null,
    authorId: 'u_admin',
  }, '2026-04-12T08:00:00.000Z', '2026-05-20T10:00:00.000Z'),
  makeEntry('e_roadmap', 'articles', 'Roadmap: H2 2026', 'roadmap-h2-2026', 'published', {
    title: 'Roadmap: H2 2026',
    slug: 'roadmap-h2-2026',
    excerpt: 'Webhooks v2, real-time collaboration, and the public GraphQL gateway.',
    body: 'Our plans for the second half of 2026.',
    coverId: 'm_cover4',
    authorId: 'u_admin',
  }, '2026-05-22T11:00:00.000Z', '2026-05-22T11:00:00.000Z'),
  makeEntry('e_authors', 'authors', 'Sofia Volkova', 'sofia-volkova', 'published', {
    name: 'Sofia Volkova',
    bio: 'Field journalist turned technical writer. Currently documenting the architecture track at Q-CMS.',
    avatarId: 'm_avatar1',
  }, '2026-04-03T09:00:00.000Z', '2026-04-03T09:00:00.000Z'),
  makeEntry('e_authors2', 'authors', 'Mark Chen', 'mark-chen', 'published', {
    name: 'Mark Chen',
    bio: 'Editor-in-chief. Edits everything that ships to docs.q-cms.dev.',
    avatarId: 'm_avatar2',
  }, '2026-04-02T09:00:00.000Z', '2026-04-02T09:00:00.000Z'),
  makeEntry('e_authors3', 'authors', 'Anya Lazareva', 'anya-lazareva', 'published', {
    name: 'Anya Lazareva',
    bio: 'Product lead. Owns the editor roadmap and ships in the admin app every Friday.',
    avatarId: 'm_avatar3',
  }, '2026-04-01T09:00:00.000Z', '2026-04-01T09:00:00.000Z'),
  makeEntry('e_cat_eng', 'categories', 'Engineering', 'engineering', 'published', {
    name: 'Engineering',
    description: 'Deep dives into runtime, schema, and infrastructure.',
  }, '2026-04-01T09:00:00.000Z', '2026-04-01T09:00:00.000Z'),
  makeEntry('e_cat_prod', 'categories', 'Product', 'product', 'published', {
    name: 'Product',
    description: 'Roadmap, release notes, and how we work.',
  }, '2026-04-01T09:00:00.000Z', '2026-04-01T09:00:00.000Z'),
  makeEntry('e_cat_company', 'categories', 'Company', 'company', 'published', {
    name: 'Company',
    description: 'Hiring, mission, and the people behind Q-CMS.',
  }, '2026-04-01T09:00:00.000Z', '2026-04-01T09:00:00.000Z'),
];

const ROLES: readonly SdkRole[] = [
  { id: 'super-admin', name: 'super-admin', description: 'Full access to everything.', isSystem: true, createdAt: '2026-04-01T09:00:00.000Z' },
  { id: 'admin', name: 'admin', description: 'Manage users, roles, and settings.', isSystem: true, createdAt: '2026-04-01T09:00:00.000Z' },
  { id: 'editor', name: 'editor', description: 'Manage and publish content in assigned collections.', isSystem: true, createdAt: '2026-04-01T09:00:00.000Z' },
  { id: 'author', name: 'author', description: 'Create and edit own content.', isSystem: true, createdAt: '2026-04-01T09:00:00.000Z' },
  { id: 'reviewer', name: 'reviewer', description: 'Read content and approve drafts.', isSystem: true, createdAt: '2026-04-01T09:00:00.000Z' },
  { id: 'viewer', name: 'viewer', description: 'Read-only access.', isSystem: true, createdAt: '2026-04-01T09:00:00.000Z' },
];

const TEMPLATES: SdkTemplate[] = [
  {
    id: 'tpl_home',
    slug: 'home-default',
    name: 'Home default',
    description: 'Landing page: hero + feature grid + article grid + category list + CTA.',
    locale: 'en',
    sections: [
      {
        id: 'sec_hero',
        type: 'hero',
        props: {
          eyebrow: 'Welcome',
          headline: 'Building the next-generation headless CMS',
          description: 'Engineering, product, and process notes from the team behind Q-CMS.',
          ctaLabel: 'Browse articles',
          ctaHref: '/articles/',
          imageId: 'm_hero',
          align: 'left',
        },
      },
      {
        id: 'sec_features',
        type: 'featureGrid',
        props: {
          title: 'Why Q-CMS',
          columns: 3,
          items: [
            { icon: 'zap', title: 'Fast', body: 'Edge-native runtime.' },
            { icon: 'shield', title: 'Safe', body: 'Type-safe contracts end-to-end.' },
            { icon: 'globe', title: 'Global', body: 'Localized out of the box.' },
          ],
        },
      },
      {
        id: 'sec_latest',
        type: 'articleGrid',
        props: { title: 'Latest articles', limit: 6, showCover: true, showExcerpt: true, showMeta: true },
      },
      {
        id: 'sec_categories',
        type: 'categoryList',
        props: { title: 'Browse by topic' },
      },
      {
        id: 'sec_cta',
        type: 'callToAction',
        props: {
          headline: 'Want to follow along?',
          description: 'Read the architecture notes, changelog, and roadmap.',
          buttonLabel: 'Read the changelog',
          buttonHref: '/articles/v0-1-seed/',
          variant: 'primary',
        },
      },
    ],
    meta: {},
    createdAt: '2026-06-05T11:00:00.000Z',
    updatedAt: '2026-06-05T11:00:00.000Z',
  },
  {
    id: 'tpl_article',
    slug: 'article-default',
    name: 'Article default',
    description: 'Article page: rich-text body + author bio + related grid.',
    locale: 'en',
    sections: [
      {
        id: 'sec_article_richtext',
        type: 'richText',
        props: { body: '## Body\n\nArticle body is rendered by the entry data binding.' },
      },
      {
        id: 'sec_article_author',
        type: 'authorBio',
        props: { authorSlug: 'sofia-volkova' },
      },
      {
        id: 'sec_article_related',
        type: 'articleGrid',
        props: { title: 'Related', limit: 3, showCover: true, showExcerpt: false, showMeta: true },
      },
    ],
    meta: {},
    createdAt: '2026-06-05T11:00:00.000Z',
    updatedAt: '2026-06-05T11:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMedia(
  id: string,
  filename: string,
  mimeType: string,
  size: number,
  width: number | null,
  height: number | null,
  color: string,
): SdkMedia {
  return {
    id,
    filename,
    mimeType,
    sizeBytes: size,
    checksumSha256: id.padEnd(64, '0'),
    storageKey: mimeType.startsWith('image/') ? `/media/${id}.svg` : `media/${id}/${filename}`,
    type: mimeType.startsWith('image/') ? 'image' : 'document',
    width,
    height,
    duration: null,
    altText: filename.replace(/\.[^.]+$/, '').replace(/-/g, ' '),
    caption: null,
    focalPoint: null,
    folderId: null,
    uploadedBy: 'u_admin',
    metadata: { swatch: color },
    isProcessed: true,
    virusScanned: true,
    createdAt: '2026-04-10T12:00:00.000Z',
    updatedAt: NOW,
  };
}

function makeEntry(
  id: string,
  collectionId: string,
  title: string,
  slug: string,
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'archived',
  data: Record<string, unknown>,
  publishedAt: string | null,
  updatedAt: string,
): SdkEntry {
  return {
    id,
    collectionId,
    slug,
    status,
    locale: 'en',
    isDefaultLocale: true,
    data,
    publishedAt,
    scheduledPublishAt: null,
    scheduledUnpublishAt: null,
    createdBy: 'u_admin',
    updatedBy: 'u_admin',
    createdAt: '2026-04-01T09:00:00.000Z',
    updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const EMPTY_PAGINATED = <T,>(): StubPaginated<T> => ({
  data: [],
  meta: { pageInfo: { hasNext: false, hasPrev: false, limit: 0, total: 0 }, totalCount: 0 },
});

function paginated<T>(items: readonly T[], total: number): StubPaginated<T> {
  return {
    data: items,
    meta: {
      pageInfo: { hasNext: false, hasPrev: false, limit: items.length, total },
      totalCount: total,
    },
  };
}

/** Create a stub Q-CMS API client. */
export function createClient(config: StubClientConfig): StubClient {
  let token: string | undefined = config.token;
  return {
    config: { baseUrl: config.baseUrl, ...(token !== undefined ? { token } : {}) },
    setToken(next) {
      token = next;
      (this.config as { token?: string }).token = next;
    },
    entries<T = SdkEntry>(collection: string) {
      const filtered = ENTRIES.filter((e) => e.collectionId === collection);
      return {
        list: async () => paginated<T>(filtered as readonly T[], filtered.length),
        get: async (id) => (ENTRIES.find((e) => e.id === id) as T | undefined) ?? null,
        create: async (data) => ({ id: `e_new_${Date.now()}`, data } as unknown as T),
        update: async (id, data) => ({ id, data } as unknown as T),
        delete: async () => {
          /* no-op */
        },
      };
    },
    collections: {
      list: async () => COLLECTIONS,
      findBySlug: async (slug) => COLLECTIONS.find((c) => c.slug === slug) ?? null,
    },
    users: {
      me: async () => USERS[0] ?? null,
      list: async () => USERS,
    },
    media: {
      list: async () => MEDIA,
      upload: async () => ({} as SdkMedia),
      delete: async () => {
        /* no-op */
      },
    },
    roles: {
      list: async () => ROLES,
    },
    templates: {
      list: async () => TEMPLATES,
      get: async (id) => TEMPLATES.find((t) => t.id === id) ?? null,
      create: async (data) => {
        if (TEMPLATES.some((t) => t.slug === data.slug)) {
          throw new Error(`Template slug '${data.slug}' is already in use`);
        }
        const created: SdkTemplate = {
          id: `tpl_${Date.now()}`,
          slug: data.slug,
          name: data.name,
          description: data.description ?? null,
          locale: data.locale ?? 'en',
          sections: data.sections ?? [],
          meta: data.meta ?? {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        // Push to the in-memory store so subsequent `get` and `list` calls
        // (e.g. when the builder redirects to `/templates/:id`) see the
        // newly created record instead of 404ing.
        TEMPLATES.push(created);
        return created;
      },
      update: async (id, data) => {
        const idx = TEMPLATES.findIndex((t) => t.id === id);
        if (idx === -1) throw new Error('Template not found');
        const existing = TEMPLATES[idx] as SdkTemplate;
        const updated: SdkTemplate = {
          ...existing,
          ...data,
          description: data.description ?? existing.description,
          updatedAt: new Date().toISOString(),
        };
        // Write back into the in-memory store so subsequent `get` / `list`
        // calls see the latest sections (otherwise the editor's "Save"
        // is a no-op across a reload or navigation).
        TEMPLATES[idx] = updated;
        return updated;
      },
      delete: async () => {
        /* no-op */
      },
    },
    auth: {
      login: async (input) => {
        const user = USERS.find((u) => u.email === input.email) ?? USERS[0];
        return { token: 'demo-token', user: user ?? ({} as SdkUser) };
      },
      logout: async () => {
        /* no-op */
      },
    },
  };
}

export type { SdkEntry, SdkUser, SdkCollection, SdkMedia, SdkRole, SdkTemplate, SdkTemplateSection, SdkTemplateInput };
