'use client';

import { ArrowRight, Eye, FileText, Hash, Layers, Type } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../../../components/Toaster.tsx';
import { Button } from '../../../../components/ui/Button.tsx';
import { Card } from '../../../../components/ui/Card.tsx';
import { Input } from '../../../../components/ui/Input.tsx';
import { getApiClient } from '../../../../lib/api-client.ts';

const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * Base templates a user can start from. The actual `sections` are
 * applied server-side on `create`; the values here mirror the seed
 * data in `apps/api/src/lib/stubs/db.ts`.
 */
const BASE_TEMPLATES: ReadonlyArray<{ value: string; label: string; description: string }> = [
  {
    value: 'home-default',
    label: 'Home default',
    description: 'Hero + feature grid + article grid + categories + CTA.',
  },
  {
    value: 'article-default',
    label: 'Article default',
    description: 'Rich text body + author bio + related grid.',
  },
  { value: 'blank', label: 'Blank', description: 'Empty template — start from scratch.' },
];

const previewDoc = (title: string, slug: string): string => `
<!doctype html>
<html><head><meta charset="utf-8" /><title>${title}</title>
<link rel="stylesheet" href="/css/site.css" />
<style>html,body{margin:0;background:var(--color-bg,#f7f7f6);color:var(--color-fg,#1a1a1a);font-family:var(--font-sans,ui-sans-serif);}
.shell{padding:2rem;display:flex;flex-direction:column;gap:1rem;align-items:center;justify-content:center;min-height:100vh;}
.shell h1{font-family:var(--font-serif,ui-serif);font-size:1.5rem;margin:0;}
.shell p{color:var(--color-fg-muted,#6b6b6b);margin:0;}
.shell .slug{font-family:var(--font-mono,ui-monospace);background:var(--color-muted,#f4f4f5);padding:0.2rem 0.5rem;border-radius:4px;font-size:0.8rem;}
</style></head>
<body><div class="shell">
  <p>New template preview</p>
  <h1>${title || 'Untitled template'}</h1>
  <p>The template slug will be</p>
  <code class="slug">${slug || 'untitled'}</code>
  <p>Choose a base on the left, then click <strong>Create &amp; open builder</strong> to start editing.</p>
</div></body></html>
`;

function buildPreviewUrl(title: string, slug: string): string {
  const html = previewDoc(title, slug);
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

export default function NewTemplatePage(): React.JSX.Element {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [base, setBase] = useState<string>(BASE_TEMPLATES[0]?.value ?? 'blank');
  const [submitting, setSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(0);

  function onNameChange(value: string): void {
    setName(value);
    if (!slugTouched) {
      setSlug(
        value
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, ''),
      );
    }
  }

  const previewSrc = useMemo(() => buildPreviewUrl(name, slug), [name, slug]);

  // Bump the preview iframe src whenever the form changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger on every change of previewSrc
  useEffect(() => {
    setPreviewLoaded((n) => n + 1);
  }, [previewSrc]);

  const slugError =
    slug.length === 0
      ? 'Slug is required'
      : !SLUG_PATTERN.test(slug)
        ? 'Slug must be lowercase, digits, or dashes'
        : null;

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (slugError) {
      toastError(slugError);
      return;
    }
    setSubmitting(true);
    try {
      // The stub API doesn't take a `base` field; the seed ships the
      // canonical home-default + article-default. We pass the slug
      // and let the user edit the spec in the builder.
      const created = await getApiClient().templates.create({
        name: name.trim(),
        slug: slug.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        sections:
          base === 'blank'
            ? []
            : base === 'home-default'
              ? [
                  { id: 'sec_hero', type: 'hero', props: { headline: name || 'Hero' } },
                  { id: 'sec_features', type: 'featureGrid', props: { title: 'Features', columns: 3 } },
                  { id: 'sec_latest', type: 'articleGrid', props: { limit: 6 } },
                  { id: 'sec_cta', type: 'callToAction', props: { headline: 'Get started' } },
                ]
              : [
                  { id: 'sec_body', type: 'richText', props: { body: '## Body\n\nArticle body.' } },
                  { id: 'sec_author', type: 'authorBio', props: { authorSlug: 'sofia-volkova' } },
                  { id: 'sec_related', type: 'articleGrid', props: { limit: 3, title: 'Related' } },
                ],
      });
      success(`Created template ${created.name}`);
      router.push(`/templates/${created.id}`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Create failed');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="template-new-page">
      <header>
        <h1 className="text-2xl font-semibold">New template</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          Pick a base, name your template, and you will be redirected to the visual builder to add sections.
        </p>
      </header>

      <div className="new-template-grid">
        <Card>
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="flex flex-col gap-4"
            data-testid="template-new-form"
          >
            <Input
              label="Name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Landing v2"
              required
              leftIcon={<Type size={14} />}
              data-testid="template-name-input"
            />
            <Input
              label="Slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="landing-v2"
              hint="Lowercase, digits, dashes. Used to bind the template to a public page."
              {...(slugError ? { error: slugError } : {})}
              leftIcon={<Hash size={14} />}
              required
              data-testid="template-slug-input"
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="template-description" className="text-sm font-medium flex items-center gap-1.5">
                <FileText size={12} aria-hidden="true" /> Description
              </label>
              <textarea
                id="template-description"
                className="input min-h-[80px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this template is for."
                data-testid="template-description-input"
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Layers size={12} aria-hidden="true" /> Base template
              </span>
              <div className="grid grid-cols-1 gap-2">
                {BASE_TEMPLATES.map((b) => (
                  <label
                    key={b.value}
                    className="flex items-start gap-2 rounded-md border p-3 text-sm cursor-pointer transition-colors"
                    style={{
                      borderColor: base === b.value ? 'var(--color-primary)' : 'var(--color-border)',
                      background:
                        base === b.value
                          ? 'color-mix(in srgb, var(--color-primary) 6%, var(--color-background))'
                          : 'var(--color-background)',
                    }}
                  >
                    <input
                      type="radio"
                      name="base"
                      value={b.value}
                      checked={base === b.value}
                      onChange={() => setBase(b.value)}
                      data-testid={`template-base-${b.value}`}
                    />
                    <span>
                      <span className="block font-medium">{b.label}</span>
                      <span className="block text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                        {b.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push('/templates')}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={submitting}
                disabled={submitting || name.length === 0 || Boolean(slugError)}
                data-testid="template-create-submit"
              >
                {submitting ? (
                  'Creating…'
                ) : (
                  <>
                    Create &amp; open builder
                    <ArrowRight size={14} />
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>

        <div className="new-template-preview" data-testid="template-new-preview">
          <header
            className="flex items-center gap-2 text-sm"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            <Eye size={14} aria-hidden="true" /> Live preview
            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
              · updates as you type
            </span>
          </header>
          <div className="new-template-preview__shell">
            <iframe
              key={previewLoaded}
              title="Template preview"
              src={previewSrc}
              data-testid="template-new-preview-iframe"
            />
          </div>
          <p className="new-template-preview__hint">
            The full block-rendered preview is available in the builder. This pane shows the live-updated name
            and slug as you fill in the form.
          </p>
        </div>
      </div>
    </div>
  );
}
