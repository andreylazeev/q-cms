# @q-cms/sdk

Type-safe client for the Q-CMS REST API. Runs in Node, Bun, browsers, and edge runtimes.

## Install

```bash
pnpm add @q-cms/sdk
```

## Quick start

```ts
import { createClient } from '@q-cms/sdk';

const cms = createClient({
  baseUrl: 'https://cms.example.com',
  token: process.env.QCMS_TOKEN!,   // or apiKey: 'qcs_...'
  locale: 'en',
});

const { data, meta } = await cms
  .entries('Article')
  .where({ status: 'published', title: { contains: 'hello' } })
  .populate(['author', 'tags'])
  .fields(['id', 'title', 'slug', 'author.name'])
  .sort('-publishedAt')
  .limit(20)
  .get();

console.log(`Returned ${data.length} of ${meta.totalCount} articles.`);
```

## CRUD

```ts
const article = await cms.entries('Article').create({
  title: 'New article',
  slug: 'new-article',
});

await cms.entries('Article').update(article.id, { title: 'Updated' });
await cms.entries('Article').publish(article.id);
await cms.entries('Article').unpublish(article.id);
await cms.entries('Article').duplicate(article.id);
await cms.entries('Article').delete(article.id);
```

## Other namespaces

```ts
await cms.media.upload(file, { alt: 'Photo' });
await cms.media.render('media-id', { width: 1280, format: 'webp' });
await cms.users.create({ email: 'admin@example.com' });
await cms.roles.create({ name: 'editor' });
await cms.webhooks.create({ name: 'Netlify', url: 'https://...', events: ['entry.publish'], secret: '...' });
const { data } = await cms.audit.list({ limit: 50 });
const result = await cms.search('hello', { collection: 'Article', locale: 'en', limit: 10 });
```

## Auth

```ts
const { token, user } = await cms.auth.login({ email, password });
cms.setToken(token);
const me = await cms.auth.me();
await cms.auth.logout();
```

## Error handling

The SDK throws a small hierarchy of typed errors — narrow with `instanceof`:

```ts
import { QcmsAuthError, QcmsNotFoundError, QcmsRateLimitError, QcmsValidationError } from '@q-cms/sdk';

try {
  await cms.users.findById('abc');
} catch (err) {
  if (err instanceof QcmsAuthError) {
    // re-authenticate
  } else if (err instanceof QcmsNotFoundError) {
    // 404
  } else if (err instanceof QcmsValidationError) {
    console.log(err.fields);  // { email: ['must be valid'] }
  } else if (err instanceof QcmsRateLimitError) {
    console.log(err.retryAfter);
  } else {
    throw err;
  }
}
```

Retries: 5xx and network failures are retried up to `maxRetries` (default 3) with exponential backoff + jitter. 4xx is never retried. Override with `cms.request(method, path, body, { noRetry: true })`.

## React

If `@tanstack/react-query` is installed, hooks will use it transparently. Otherwise, they fall back to a `useState` + `useEffect` shim.

```tsx
import { QcmsProvider, useQcmsEntries, useQcmsCreateEntry } from '@q-cms/sdk/react';

< QcmsProvider client={cms} >
  <ArticleList />
</QcmsProvider>

function ArticleList() {
  const { data, isLoading, error } = useQcmsEntries('Article', { where: { status: 'published' } });
  if (isLoading) return <Spinner />;
  if (error) return <Error error={error} />;
  return <>{data.data.map(a => <a key={a.id}>{a.data.title}</a>)}</>;
}
```

Mutation hooks: `useQcmsCreateEntry`, `useQcmsUpdateEntry`, `useQcmsDeleteEntry`, `useQcmsPublishEntry`. They invalidate the matching query keys on success.

## Low-level escape hatch

```ts
const raw = await cms.request<{ hello: string }>('GET', '/_internal/ping');
```

## Test

```bash
pnpm --filter @q-cms/sdk test
```

Tests use `msw` to mock the API and exercise:

- auth header injection (Bearer token and `apiKey`)
- paginated list response parsing
- 401 / 404 / 422 / 429 / 5xx → typed error mapping
- automatic 5xx retry with `maxRetries`
- 4xx never retried
- query builder URL serialization (filter, populate, sort, pagination, status, locale)
- `getOne` throws on 0 / 2+ matches
- `create / update / delete / publish` route to the right HTTP method + path
- React shim with custom test-injected hook dependencies

## Build

```bash
pnpm --filter @q-cms/sdk build
```

## License

MIT
