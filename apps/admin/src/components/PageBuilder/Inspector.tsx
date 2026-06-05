'use client';

/**
 * Inspector — right column of the visual page builder.
 *
 * Renders a per-property form for the currently selected block.
 * Fields are grouped into accordion rows (Content / Media / CTA /
 * Style / Advanced) by walking `propSchema.properties` and
 * applying simple key-suffix heuristics. The kebab menu (Radix
 * `DropdownMenu`) duplicates / resets / deletes the section.
 *
 * Each field is rendered by a small `Field*` component that wraps
 * the right Radix primitive (Switch, Select, ToggleGroup) or a
 * plain input.
 */

import * as Accordion from '@radix-ui/react-accordion';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { BlockSpec, TemplateSection } from '@q-cms/templates';
import { AlignCenter, AlignLeft, AlignRight, Copy, MoreHorizontal, RotateCcw, Trash2 } from './icons.tsx';
import { useMemo } from 'react';
import { Input } from '../ui/Input.tsx';
import { cn } from '../../lib/utils.ts';
import { Field } from './Field.tsx';
import { FieldGroup } from './FieldGroup.tsx';
import { FieldMedia } from './FieldMedia.tsx';
import { FieldSelect } from './FieldSelect.tsx';
import { FieldSwitch } from './FieldSwitch.tsx';
import { FieldToggleGroup } from './FieldToggleGroup.tsx';
import { SaveStatePill, type SaveState } from './SaveStatePill.tsx';
import { ValidationBadge, type ValidationIssue } from './ValidationBadge.tsx';

export interface InspectorProps {
  section: TemplateSection | null;
  /** 1-based position in the template's `sections` array. */
  sectionIndex?: number | undefined;
  totalSections?: number | undefined;
  /** Block spec for `section.type`, if registered. */
  spec: BlockSpec | undefined;
  saveState: SaveState;
  savedAt: number | null;
  onChange: (next: TemplateSection) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onReset: () => void;
}

interface PropSchema {
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  title?: string;
  enum?: ReadonlyArray<string | number | boolean>;
  default?: unknown;
  format?: string;
  minimum?: number;
  maximum?: number;
  description?: string;
}

type GroupKey = 'content' | 'media' | 'cta' | 'style' | 'advanced';

function groupFor(key: string): GroupKey {
  if (/^(image|cover|avatar|media|src|asset)/i.test(key)) return 'media';
  if (/^(cta|button|label|href|action)/i.test(key)) return 'cta';
  if (/^(align|variant|layout|pattern|style|theme|size|width|height|padding|gap|color|bg)/i.test(key)) {
    return 'style';
  }
  if (/^(show|hide|enable|disable|is|has|allow)/i.test(key)) return 'advanced';
  return 'content';
}

function isImageKey(key: string): boolean {
  return /image|cover|avatar/i.test(key);
}

const GROUP_META: Record<GroupKey, { label: string; hint: string; defaultOpen: boolean }> = {
  content: { label: 'Content', hint: 'Headline, body, copy', defaultOpen: true },
  media: { label: 'Media', hint: 'Images and assets', defaultOpen: true },
  cta: { label: 'Call to action', hint: 'Button label and link', defaultOpen: true },
  style: { label: 'Style', hint: 'Layout and variant', defaultOpen: false },
  advanced: { label: 'Advanced', hint: 'Flags and settings', defaultOpen: false },
};

const GROUP_ORDER: ReadonlyArray<GroupKey> = ['content', 'media', 'cta', 'style', 'advanced'];

function isAlignedEnum(opts: ReadonlyArray<string | number | boolean> | undefined, key: string): boolean {
  if (key !== 'align') return false;
  if (!opts) return true;
  const set = new Set(opts.map(String));
  return set.has('left') && set.has('center') && set.has('right');
}

export function Inspector({
  section,
  sectionIndex,
  totalSections,
  spec,
  saveState,
  savedAt,
  onChange,
  onDuplicate,
  onRemove,
  onReset,
}: InspectorProps): React.JSX.Element {
  const properties = useMemo<Record<string, PropSchema>>(() => {
    if (!spec) return {};
    const raw = spec.propSchema as { properties?: Record<string, PropSchema> };
    return raw.properties ?? {};
  }, [spec]);

  const issues = useMemo<ReadonlyArray<ValidationIssue>>(() => {
    if (!section) return [];
    if (!spec) {
      return [{ message: `No block spec is registered for "${section.type}".` }];
    }
    const required = ((spec.propSchema as { required?: string[] }).required ?? []) as ReadonlyArray<string>;
    const out: ValidationIssue[] = [];
    for (const key of required) {
      const v = section.props[key];
      if (v === undefined || v === null || v === '') {
        const meta = properties[key];
        out.push({ field: key, message: `${meta?.title ?? key} is required.` });
      }
    }
    return out;
  }, [section, spec, properties]);

  if (!section) {
    return (
      <aside
        className="pb-inspector pb-inspector--empty"
        data-testid="block-editor-empty"
        aria-label="Block inspector"
      >
        <h2 className="pb-inspector__title">No block selected</h2>
        <p className="pb-inspector__hint">
          Click a section in the canvas to edit its props, or pick a block from the palette to add a new one.
        </p>
      </aside>
    );
  }

  if (!spec) {
    return (
      <aside className="pb-inspector" data-testid="block-editor" aria-label="Block inspector">
        <header className="pb-inspector__head">
          <h2 className="pb-inspector__title">Unknown block</h2>
          <p className="pb-inspector__hint">
            No block spec is registered for type <code>{section.type}</code>. The template will skip this section
            at render time.
          </p>
        </header>
      </aside>
    );
  }

  const propKeys = Object.keys(properties);

  function setProp(key: string, value: unknown): void {
    if (!section) return;
    const next: TemplateSection = { ...section, props: { ...section.props, [key]: value } };
    onChange(next);
  }

  const groups: Record<GroupKey, string[]> = {
    content: [],
    media: [],
    cta: [],
    style: [],
    advanced: [],
  };
  for (const key of propKeys) groups[groupFor(key)].push(key);

  const visibleGroups = GROUP_ORDER.filter((g) => groups[g].length > 0);
  const defaultValues = visibleGroups.filter((g) => GROUP_META[g].defaultOpen);

  return (
    <aside className="pb-inspector" data-testid="block-editor" aria-label="Block inspector">
      <header className="pb-inspector__head">
        <div className="pb-inspector__head-top">
          <div className="pb-inspector__title-row">
            <h2 className="pb-inspector__title">{spec.label}</h2>
            <KebabMenu onDuplicate={onDuplicate} onRemove={onRemove} onReset={onReset} />
          </div>
          {sectionIndex !== undefined && totalSections !== undefined ? (
            <p className="pb-inspector__subtitle">
              {spec.label} · Section {sectionIndex} of {totalSections}
            </p>
          ) : null}
          <div className="pb-inspector__status-row">
            <SaveStatePill state={saveState} savedAt={savedAt} />
            <ValidationBadge issues={issues} spec={spec} />
          </div>
        </div>
      </header>

      {propKeys.length === 0 ? (
        <div className="pb-inspector__empty">
          <p className="pb-inspector__hint">This block has no editable props.</p>
        </div>
      ) : (
        <Accordion.Root
          type="multiple"
          defaultValue={defaultValues}
          className="pb-accordion"
          data-testid="inspector-accordion"
        >
          {visibleGroups.map((g) => (
            <FieldGroup
              key={g}
              value={g}
              label={GROUP_META[g].label}
              description={GROUP_META[g].hint}
            >
              {groups[g].map((key) => {
                const schema = properties[key] ?? {};
                const label = schema.title ?? key;
                const description = schema.description;
                const value = section.props[key];
                return renderField({
                  keyName: key,
                  label,
                  description,
                  schema,
                  value,
                  onChange: (v) => setProp(key, v),
                  testId: `prop-${key}`,
                });
              })}
            </FieldGroup>
          ))}
        </Accordion.Root>
      )}
    </aside>
  );
}

interface RenderFieldArgs {
  keyName: string;
  label: string;
  description: string | undefined;
  schema: PropSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  testId: string;
}

function renderField({
  keyName,
  label,
  description,
  schema,
  value,
  onChange,
  testId,
}: RenderFieldArgs): React.JSX.Element {
  // image-id field
  if (isImageKey(keyName)) {
    return (
      <FieldMedia
        key={keyName}
        id={testId}
        label={label}
        description={description}
        value={typeof value === 'string' ? value : undefined}
        onChange={(v) => onChange(v)}
      />
    );
  }
  // align-style toggle group
  if (isAlignedEnum(schema.enum, keyName)) {
    return (
      <FieldToggleGroup
        key={keyName}
        id={testId}
        label={label}
        description={description}
        value={typeof value === 'string' ? value : undefined}
        options={[
          { value: 'left', label: 'Align left', icon: <AlignLeft size={14} /> },
          { value: 'center', label: 'Align center', icon: <AlignCenter size={14} /> },
          { value: 'right', label: 'Align right', icon: <AlignRight size={14} /> },
        ]}
        onChange={(v) => onChange(v)}
      />
    );
  }
  // enum → Radix Select
  if (schema.enum && schema.enum.length > 0) {
    return (
      <FieldSelect
        key={keyName}
        id={testId}
        label={label}
        description={description}
        value={typeof value === 'string' ? value : undefined}
        options={schema.enum.map((e) => ({ value: String(e), label: String(e) }))}
        onChange={(v) => onChange(v)}
      />
    );
  }
  // boolean → Radix Switch
  if (schema.type === 'boolean') {
    return (
      <FieldSwitch
        key={keyName}
        id={testId}
        label={label}
        description={description}
        value={value === true || value === 'true'}
        onChange={(v) => onChange(v)}
      />
    );
  }
  // number → number input
  if (schema.type === 'number') {
    return (
      <Input
        key={keyName}
        id={testId}
        type="number"
        label={label}
        value={value === undefined || value === null ? '' : String(value)}
        min={schema.minimum}
        max={schema.maximum}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        data-testid={testId}
      />
    );
  }
  // textarea
  if (schema.format === 'textarea') {
    return (
      <Field key={keyName} label={label} description={description} htmlFor={testId}>
        <textarea
          id={testId}
          className="input pb-textarea"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testId}
          rows={3}
        />
      </Field>
    );
  }
  // default → text input
  return (
    <Input
      key={keyName}
      id={testId}
      label={label}
      value={typeof value === 'string' ? value : value == null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId}
    />
  );
}

/* ---------------------------------------------------------------------------
 * KebabMenu — Radix DropdownMenu wrapper for the inspector actions.
 * ------------------------------------------------------------------------- */

interface KebabMenuProps {
  onDuplicate: () => void;
  onRemove: () => void;
  onReset: () => void;
}

function KebabMenu({ onDuplicate, onRemove, onReset }: KebabMenuProps): React.JSX.Element {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="pb-icon-btn"
          aria-label="More actions"
          data-testid="inspector-kebab"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="pb-dropdown" sideOffset={4} align="end">
          <DropdownMenu.Item className="pb-dropdown__item" onSelect={onDuplicate} data-testid="inspector-duplicate">
            <Copy size={14} />
            <span>Duplicate</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item className="pb-dropdown__item" onSelect={onReset} data-testid="inspector-reset">
            <RotateCcw size={14} />
            <span>Reset to defaults</span>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="pb-dropdown__separator" />
          <DropdownMenu.Item
            className="pb-dropdown__item pb-dropdown__item--danger"
            onSelect={onRemove}
            data-testid="inspector-delete"
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* Re-export the icon to avoid an unused import. */
void cn;
