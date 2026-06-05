/**
 * `q-cms init <name>` — scaffold a new Q-CMS project.
 *
 * Creates a directory with:
 *   - `schema.ts`         — content schema definition
 *   - `package.json`      — workspace-ready manifest
 *   - `tsconfig.json`     — extends @q-cms/config/tsconfig.lib
 *   - `docker-compose.yml` — Postgres, Redis, Meilisearch, MinIO
 *   - `.env.example`      — copy to .env
 *   - `README.md`         — quickstart
 */

import { Command } from 'commander';
import { mkdirSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { success, error, info, header, Spinner } from '../utils/output.ts';

const SCHEMA_TEMPLATE = `import { defineConfig, collection, component, blocks } from '@q-cms/schema';

export default defineConfig({
  name: '{{name}}',
  defaultLocale: 'en',
  locales: ['en', 'ru'],

  collections: {
    Article: collection({
      title: 'Article',
      slug: 'articles',
      draftAndPublish: true,
      fields: {
        title: { type: 'text', required: true, maxLength: 200 },
        slug:  { type: 'uid', target: 'title' },
        excerpt: { type: 'text', maxLength: 500 },
        content: { type: 'blocks', blocks: ['paragraph', 'heading', 'image', 'code', 'quote', 'embed'] },
        author: { type: 'relation', target: 'Author' },
        tags: { type: 'relation', target: 'Tag', multiple: true },
        publishedAt: { type: 'datetime' },
      },
    }),

    Author: collection({
      title: 'Author',
      slug: 'authors',
      fields: {
        name: { type: 'text', required: true },
        email: { type: 'email', required: true, unique: true },
        bio: { type: 'richtext' },
      },
    }),

    Tag: collection({
      title: 'Tag',
      slug: 'tags',
      fields: {
        name: { type: 'text', required: true },
        slug: { type: 'uid', target: 'name' },
      },
    }),
  },

  components: {
    SEO: component({
      fields: {
        title: { type: 'text', maxLength: 70 },
        description: { type: 'text', maxLength: 160 },
        image: { type: 'media' },
      },
    }),
  },

  blocks: {
    ...blocks.core,
  },

  webhooks: [],
});
`;

const PACKAGE_JSON_TEMPLATE = (name: string) => JSON.stringify({
  name,
  version: '0.1.0',
  private: true,
  type: 'module',
  scripts: {
    dev: 'q-cms dev',
    'db:migrate': 'q-cms db:migrate',
    'db:seed': 'q-cms db:seed',
    'db:studio': 'q-cms db:studio',
    codegen: 'q-cms codegen',
  },
}, null, 2);

const TSCONFIG_TEMPLATE = `{
  "extends": "@q-cms/config/tsconfig.lib",
  "include": ["schema.ts"]
}
`;

const COMPOSE_TEMPLATE = `version: '3.9'

services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: qcms
      POSTGRES_USER: qcms
      POSTGRES_PASSWORD: qcms
    ports: ['5432:5432']
    volumes: ['pgdata:/var/lib/postgresql/data']

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']

  meilisearch:
    image: getmeili/meilisearch:v1.10
    environment:
      MEILI_MASTER_KEY: masterKey
    ports: ['7700:7700']

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ['9000:9000', '9001:9001']

volumes:
  pgdata:
`;

const ENV_TEMPLATE = `DATABASE_URL=postgres://qcms:qcms@localhost:5432/qcms
REDIS_URL=redis://localhost:6379
MEILI_URL=http://localhost:7700
MEILI_MASTER_KEY=masterKey
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=qcms-media
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
JWT_SECRET=change-me-32-chars-minimum-1234567890ab
`;

const README_TEMPLATE = (name: string) => `# ${name}

A Q-CMS project.

## Quick start

\`\`\`bash
# 1. Boot the local stack
docker compose up -d

# 2. Set up env
cp .env.example .env
$EDITOR .env

# 3. Migrate & seed
q-cms db:migrate
q-cms db:seed

# 4. Start dev
q-cms dev
\`\`\`

API:        http://localhost:3000
Admin UI:   http://localhost:3001

## Schema

Edit \`schema.ts\` to define your content model, then run:

\`\`\`bash
q-cms codegen
q-cms db:migrate
\`\`\`

## Login

\`\`\`bash
q-cms login --url http://localhost:3000 --email admin@q-cms.local --password changeme
\`\`\`
`;

export function registerInitCommand(program: Command): void {
  program
    .command('init <name>')
    .description('Scaffold a new Q-CMS project in a new directory')
    .option('-d, --dir <path>', 'Target directory (default: ./<name>)')
    .option('--no-git', 'Skip git init')
    .action((name: string, opts: { dir?: string; git?: boolean }) => {
      const target = resolve(opts.dir ?? `./${name}`);
      if (existsSync(target)) {
        error(`Directory already exists: ${target}`);
        process.exitCode = 1;
        return;
      }
      if (!/^[a-z0-9-]{1,64}$/.test(name)) {
        error(`Invalid project name: '${name}' (allowed: a-z, 0-9, -, max 64 chars)`);
        process.exitCode = 1;
        return;
      }

      const spinner = new Spinner('Scaffolding project...').start();
      try {
        mkdirSync(target, { recursive: true });
        mkdirSync(join(target, '.q-cms'), { recursive: true });

        writeFileSync(join(target, 'schema.ts'), SCHEMA_TEMPLATE.replaceAll('{{name}}', name));
        writeFileSync(join(target, 'package.json'), PACKAGE_JSON_TEMPLATE(name));
        writeFileSync(join(target, 'tsconfig.json'), TSCONFIG_TEMPLATE);
        writeFileSync(join(target, 'docker-compose.yml'), COMPOSE_TEMPLATE);
        writeFileSync(join(target, '.env.example'), ENV_TEMPLATE);
        writeFileSync(join(target, 'README.md'), README_TEMPLATE(name));
        writeFileSync(join(target, '.gitignore'), 'node_modules\n.env\n.q-cms/\ndist/\n');

        if (opts.git !== false) {
          try {
            // Lazy require so this works on systems without git
            const { execSync } = require('node:child_process') as typeof import('node:child_process');
            execSync('git init', { cwd: target, stdio: 'ignore' });
          } catch {
            // ignore
          }
        }

        spinner.succeed(`Created project in ${target}`);
        header('Next steps');
        info(`  cd ${target}`);
        info('  docker compose up -d');
        info('  cp .env.example .env');
        info('  q-cms db:migrate && q-cms db:seed');
        info('  q-cms dev');
        console.log('');
        success('Happy building! 🚀');
        void chmodSync;
      } catch (err) {
        spinner.fail();
        error((err as Error).message);
        process.exitCode = 1;
      }
    });
}
