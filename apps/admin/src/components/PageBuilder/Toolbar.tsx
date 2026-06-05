'use client';

/**
 * Toolbar — top bar of the visual page builder.
 *
 * Left side:  ← Back, template name (inline-editable), slug,
 *              status pill, save button.
 * Right side: device switcher, theme switcher, outline toggle,
 *              preview toggle, save.
 *
 * The status pill and the save button share a single `SaveState`
 * derived from props. The pill is the same component used in the
 * inspector header, so both stay in lock-step.
 */

import { ArrowLeft, Download, ExternalLink, Save } from './icons.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { type Device, DeviceSwitcher } from './DeviceSwitcher.tsx';
import { SaveStatePill, type SaveState } from './SaveStatePill.tsx';
import { ThemeSwitcher, type ThemeId } from './ThemeSwitcher.tsx';
import { cn } from '../../lib/utils.ts';

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
          <ArrowLeft size={14} aria-hidden="true" /> Templates
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
      </div>
      <div className="pb-toolbar__group pb-toolbar__group--end">
        <DeviceSwitcher value={device} onChange={onChangeDevice} />
        <ThemeSwitcher value={themeId} onChange={onChangeTheme} />
        <button
          type="button"
          onClick={onToggleOutline}
          className={cn('pb-btn', 'pb-btn--ghost', showOutline && 'pb-btn--active')}
          aria-pressed={showOutline}
          data-testid="page-builder-outline"
        >
          Outline
        </button>
        <a
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="pb-btn pb-btn--ghost"
          data-testid="page-builder-view-public"
        >
          <ExternalLink size={14} aria-hidden="true" /> Public
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
          {inPreviewMode ? 'Edit' : 'Preview'}
        </Button>
        <Button
          size="sm"
          isLoading={isSaving}
          disabled={!canSave}
          onClick={onSave}
          data-testid="page-builder-save"
        >
          {!isSaving ? <Save size={14} aria-hidden="true" /> : null}
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </header>
  );
}
