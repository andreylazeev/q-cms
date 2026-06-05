'use client';

/**
 * Toolbar — top bar of the visual page builder.
 *
 * Left side:  ← Back, template name (inline-editable), slug,
 *              status pill, save button.
 * Right side: device switcher, theme switcher, outline toggle,
 *              preview toggle, save.
 *
 * On viewports <1024px the toolbar grows a `View` segmented
 * control (`Blocks / Canvas / Inspector`) so the user can flip
 * between the three columns that would otherwise not fit. The
 * segment is rendered in the DOM at every width; CSS hides it
 * above the breakpoint and reveals it below. Labels on Outline /
 * Public / Save / Edit / Preview are similarly wrapped in
 * `<span class="pb-toolbar__label">` and hidden below 1280.
 *
 * The status pill and the save button share a single `SaveState`
 * derived from props. The pill is the same component used in the
 * inspector header, so both stay in lock-step.
 */

import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { ArrowLeft, Download, ExternalLink, Save } from './icons.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { type Device, DeviceSwitcher } from './DeviceSwitcher.tsx';
import { SaveStatePill, type SaveState } from './SaveStatePill.tsx';
import { ThemeSwitcher, type ThemeId } from './ThemeSwitcher.tsx';
import { cn } from '../../lib/utils.ts';

export type ViewMode = 'blocks' | 'canvas' | 'inspector';

export interface ToolbarProps {
  templateName: string;
  templateSlug: string;
  device: Device;
  themeId: ThemeId;
  showOutline: boolean;
  saveState: SaveState;
  savedAt: number | null;
  canSave: boolean;
  isSaving: boolean;
  /** Narrow-viewport panel selector. Only relevant at <1024px. */
  viewMode?: ViewMode;
  onChangeView?: (mode: ViewMode) => void;
  onBack: () => void;
  onChangeName: (name: string) => void;
  onChangeDevice: (device: Device) => void;
  onChangeTheme: (theme: ThemeId) => void;
  onToggleOutline: () => void;
  onTogglePreview: () => void;
  onSave: () => void;
  onExport: () => void;
  previewHref: string;
  inPreviewMode: boolean;
}

export function Toolbar({
  templateName,
  templateSlug,
  device,
  themeId,
  showOutline,
  saveState,
  savedAt,
  canSave,
  isSaving,
  viewMode,
  onChangeView,
  onBack,
  onChangeName,
  onChangeDevice,
  onChangeTheme,
  onToggleOutline,
  onTogglePreview,
  onSave,
  onExport,
  previewHref,
  inPreviewMode,
}: ToolbarProps): React.JSX.Element {
  return (
    <header className="pb-toolbar" data-testid="page-builder-toolbar">
      <div className="pb-toolbar__group pb-toolbar__group--start">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="page-builder-back">
          <ArrowLeft size={14} aria-hidden="true" />
          <span className="pb-toolbar__label">Templates</span>
        </Button>
        <Input
          value={templateName}
          onChange={(e) => onChangeName(e.target.value)}
          className="pb-toolbar__name-input"
          aria-label="Template name"
          data-testid="page-builder-name"
        />
        <code className="pb-toolbar__slug" data-testid="page-builder-slug">
          {templateSlug}
        </code>
        <SaveStatePill state={saveState} savedAt={savedAt} className="pb-toolbar__pill" />
        {viewMode !== undefined && onChangeView ? (
          <ToggleGroup.Root
            type="single"
            value={viewMode}
            onValueChange={(v) => {
              if (v) onChangeView(v as ViewMode);
            }}
            className="pb-toolbar__view-segment"
            aria-label="Active panel"
            data-testid="page-builder-view-segment"
          >
            <ToggleGroup.Item
              value="blocks"
              className="pb-toolbar__view-segment__btn"
              aria-label="Show blocks panel"
              data-testid="page-builder-view-blocks"
            >
              Blocks
            </ToggleGroup.Item>
            <ToggleGroup.Item
              value="canvas"
              className="pb-toolbar__view-segment__btn"
              aria-label="Show canvas"
              data-testid="page-builder-view-canvas"
            >
              Canvas
            </ToggleGroup.Item>
            <ToggleGroup.Item
              value="inspector"
              className="pb-toolbar__view-segment__btn"
              aria-label="Show inspector"
              data-testid="page-builder-view-inspector"
            >
              Inspector
            </ToggleGroup.Item>
          </ToggleGroup.Root>
        ) : null}
      </div>
      <div className="pb-toolbar__group pb-toolbar__group--end">
        <DeviceSwitcher value={device} onChange={onChangeDevice} />
        <ThemeSwitcher value={themeId} onChange={onChangeTheme} />
        <button
          type="button"
          onClick={onToggleOutline}
          className={cn('pb-btn', 'pb-btn--ghost', showOutline && 'pb-btn--active')}
          aria-pressed={showOutline}
          aria-label="Toggle block outlines"
          data-testid="page-builder-outline"
        >
          <span className="pb-toolbar__label">Outline</span>
        </button>
        <a
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="pb-btn pb-btn--ghost"
          data-testid="page-builder-view-public"
        >
          <ExternalLink size={14} aria-hidden="true" />
          <span className="pb-toolbar__label">Public</span>
        </a>
        <button
          type="button"
          onClick={onExport}
          className="pb-btn pb-btn--ghost"
          aria-label="Export JSON"
          data-testid="page-builder-export"
        >
          <Download size={14} aria-hidden="true" />
        </button>
        <Button
          variant={inPreviewMode ? 'secondary' : 'ghost'}
          size="sm"
          onClick={onTogglePreview}
          data-testid="page-builder-toggle-mode"
          aria-pressed={inPreviewMode}
        >
          <span className="pb-toolbar__label">{inPreviewMode ? 'Edit' : 'Preview'}</span>
        </Button>
        <Button
          size="sm"
          isLoading={isSaving}
          disabled={!canSave}
          onClick={onSave}
          data-testid="page-builder-save"
        >
          {!isSaving ? <Save size={14} aria-hidden="true" /> : null}
          <span className="pb-toolbar__label">{isSaving ? 'Saving…' : 'Save'}</span>
        </Button>
      </div>
    </header>
  );
}
