'use client';

/**
 * PageBuilder — visual builder for user-defined page templates.
 *
 * Three-column layout: palette (left), canvas (center), inspector
 * (right). Top bar holds the template name, save state pill,
 * device switcher, theme switcher, and the save button.
 *
 * The canvas can swap between **edit** and **preview** modes. In
 * preview mode the canvas is replaced by an iframe that mounts the
 * public-site template engine and receives spec updates via
 * `postMessage` (no full reload).
 *
 * State is local; persistence happens through the API client on
 * save. Autosave is intentionally out of scope — the brief calls
 * for a visible "Save" affordance, not silent background writes.
 */

import { type BlockSpec, listBlockSpecs, registerBuiltinBlocks } from '@q-cms/templates';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiClient } from '../../lib/api-client.ts';
import { WEB_BASE_URL } from '../../lib/web-url.ts';
import type { SdkTemplate, SdkTemplateSection } from '../../lib/stubs/api-client.ts';
import { useToast } from '../Toaster.tsx';
import { BlockPalette } from './BlockPalette.tsx';
import { Canvas, type CanvasDragEvent } from './Canvas.tsx';
import { type Device } from './DeviceSwitcher.tsx';
import { Inspector } from './Inspector.tsx';
import { Preview } from './Preview.tsx';
import { type SaveState } from './SaveStatePill.tsx';
import { type ThemeId } from './ThemeSwitcher.tsx';
import { Toolbar } from './Toolbar.tsx';

registerBuiltinBlocks();

export interface PageBuilderProps {
  template: SdkTemplate;
}

function newSectionId(): string {
  return `sec_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function cloneSpec(template: SdkTemplate): SdkTemplate {
  return {
    ...template,
    sections: template.sections.map((s) => ({
      ...s,
      props: { ...s.props },
      ...(s.children ? { children: s.children.map((c) => ({ ...c, props: { ...c.props } })) } : {}),
    })),
    meta: { ...template.meta },
  };
}

export function PageBuilder({ template: initial }: PageBuilderProps): React.JSX.Element {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [template, setTemplate] = useState<SdkTemplate>(() => cloneSpec(initial));
  const [selectedId, setSelectedId] = useState<string | null>(initial.sections[0]?.id ?? null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [themeId, setThemeId] = useState<ThemeId>('default');
  const [showOutline, setShowOutline] = useState(false);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  // Narrow-viewport panel: 'blocks' | 'canvas' | 'inspector'.
  // Only used at <1024px — at wider widths all three are visible
  // side-by-side. Defaults to 'canvas' so a freshly-mounted editor
  // on a phone shows the most useful panel first.
  const [viewMode, setViewMode] = useState<'blocks' | 'canvas' | 'inspector'>('canvas');

  useEffect(() => {
    setTemplate(cloneSpec(initial));
    setSelectedId(initial.sections[0]?.id ?? null);
    setDirty(false);
    setSavedAt(null);
  }, [initial]);

  // When the viewport grows back to ≥1024px (desktop / tablet
  // landscape), force `viewMode` to 'canvas' so the user doesn't get
  // stuck on the inspector or palette when the side panels reappear.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent): void => {
      if (e.matches) setViewMode('canvas');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Register built-in block specs on mount (idempotent) and expose
  // a registry map on `window` for the canvas to look up specs
  // when a palette card is dropped on it.
  useEffect(() => {
    registerBuiltinBlocks();
    const map = new Map<string, BlockSpec>();
    for (const s of listBlockSpecs()) map.set(s.type, s);
    window.QCMS_BLOCK_REGISTRY = map;
  }, []);

  const selectedSection = useMemo(
    () => template.sections.find((s) => s.id === selectedId) ?? null,
    [template, selectedId],
  );
  const selectedIndex = useMemo(
    () => template.sections.findIndex((s) => s.id === selectedId),
    [template, selectedId],
  );

  const saveState: SaveState = saving ? 'saving' : dirty ? 'dirty' : savedAt ? 'saved' : 'idle';

  const update = useCallback((next: SdkTemplate): void => {
    setTemplate(next);
    setDirty(true);
  }, []);

  const addSection = useCallback(
    (spec: BlockSpec): void => {
      const id = newSectionId();
      const next: SdkTemplateSection = {
        id,
        type: spec.type,
        props: { ...spec.defaultProps },
      };
      update({ ...template, sections: [...template.sections, next] });
      setSelectedId(id);
    },
    [template, update],
  );

  const moveSection = useCallback(
    (id: string, direction: 'up' | 'down'): void => {
      const idx = template.sections.findIndex((s) => s.id === id);
      if (idx === -1) return;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= template.sections.length) return;
      const next = [...template.sections];
      const a = next[idx];
      const b = next[target];
      if (!a || !b) return;
      next[idx] = b;
      next[target] = a;
      update({ ...template, sections: next });
    },
    [template, update],
  );

  const reorderSection = useCallback(
    (fromId: string, toId: string): void => {
      if (fromId === toId) return;
      const from = template.sections.findIndex((s) => s.id === fromId);
      const to = template.sections.findIndex((s) => s.id === toId);
      if (from === -1 || to === -1) return;
      const next = [...template.sections];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(to, 0, moved);
      update({ ...template, sections: next });
    },
    [template, update],
  );

  const duplicateSection = useCallback(
    (id: string): void => {
      const idx = template.sections.findIndex((s) => s.id === id);
      if (idx === -1) return;
      const original = template.sections[idx];
      if (!original) return;
      const newId = newSectionId();
      const copy: SdkTemplateSection = {
        ...original,
        id: newId,
        props: { ...original.props },
      };
      const next = [...template.sections];
      next.splice(idx + 1, 0, copy);
      update({ ...template, sections: next });
      setSelectedId(newId);
    },
    [template, update],
  );

  const removeSection = useCallback(
    (id: string): void => {
      const next = template.sections.filter((s) => s.id !== id);
      update({ ...template, sections: next });
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
    },
    [template, selectedId, update],
  );

  const updateSection = useCallback(
    (next: SdkTemplateSection): void => {
      const sections = template.sections.map((s) => (s.id === next.id ? next : s));
      update({ ...template, sections });
    },
    [template, update],
  );

  const resetSection = useCallback(
    (id: string): void => {
      const section = template.sections.find((s) => s.id === id);
      if (!section) return;
      updateSection({ ...section, props: {} });
    },
    [template, updateSection],
  );

  const setName = useCallback(
    (value: string): void => {
      update({ ...template, name: value });
    },
    [template, update],
  );

  const save = useCallback(async (): Promise<void> => {
    setSaving(true);
    try {
      const saved = await getApiClient().templates.update(template.id, {
        name: template.name,
        slug: template.slug,
        ...(template.description ? { description: template.description } : {}),
        locale: template.locale,
        sections: template.sections,
        meta: template.meta,
      });
      setTemplate(cloneSpec(saved));
      setDirty(false);
      setSavedAt(Date.now());
      success('Template saved');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [template, success, toastError]);

  const exportJson = useCallback((): void => {
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.slug || 'template'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [template]);

  const onCanvasDrop = useCallback(
    (ev: CanvasDragEvent): void => {
      if (ev.kind === 'palette-add') {
        const insertAt = ev.position;
        const id = newSectionId();
        const next: SdkTemplateSection = {
          id,
          type: ev.spec.type,
          props: { ...ev.spec.defaultProps },
        };
        const sections = [...template.sections];
        sections.splice(insertAt, 0, next);
        update({ ...template, sections });
        setSelectedId(id);
      } else if (ev.kind === 'reorder') {
        reorderSection(ev.fromId, ev.toId);
      }
    },
    [template, update, reorderSection],
  );

  const toggleInline = useCallback((id: string): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="pb-root" data-testid="page-builder">
      <Toolbar
        templateName={template.name}
        templateSlug={template.slug}
        device={device}
        themeId={themeId}
        showOutline={showOutline}
        saveState={saveState}
        savedAt={savedAt}
        canSave={dirty && !saving}
        isSaving={saving}
        viewMode={viewMode}
        onChangeView={setViewMode}
        onBack={() => router.push('/templates')}
        onChangeName={setName}
        onChangeDevice={setDevice}
        onChangeTheme={setThemeId}
        onToggleOutline={() => setShowOutline((v) => !v)}
        onTogglePreview={() => setMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
        onSave={() => void save()}
        onExport={exportJson}
        previewHref={`${WEB_BASE_URL}/?template=${encodeURIComponent(template.id)}`}
        inPreviewMode={mode === 'preview'}
      />
      <div
        className={`pb-body pb-body--panel-${viewMode}${showOutline ? ' pb-body--outline' : ''}`}
        data-testid="page-builder-body"
      >
        <BlockPalette onAdd={addSection} />
        <div className="pb-canvas-col">
          {mode === 'edit' ? (
            <Canvas
              sections={template.sections}
              selectedId={selectedId}
              device={device}
              onSelect={setSelectedId}
              onMove={moveSection}
              onRemove={removeSection}
              onDuplicate={duplicateSection}
              onDrop={onCanvasDrop}
              expandedIds={expandedIds}
              onToggleInline={toggleInline}
            />
          ) : (
            <Preview template={template} onClose={() => setMode('edit')} />
          )}
        </div>
        <Inspector
          section={selectedSection}
          sectionIndex={selectedIndex >= 0 ? selectedIndex + 1 : undefined}
          totalSections={template.sections.length}
          spec={selectedSection ? listBlockSpecs().find((s) => s.type === selectedSection.type) : undefined}
          saveState={saveState}
          savedAt={savedAt}
          onChange={(next) => updateSection(next as SdkTemplateSection)}
          onDuplicate={() => selectedSection && duplicateSection(selectedSection.id)}
          onRemove={() => selectedSection && removeSection(selectedSection.id)}
          onReset={() => selectedSection && resetSection(selectedSection.id)}
        />
      </div>
    </div>
  );
}
