/**
 * PageBuilder CSS regression net.
 *
 * PageBuilder's layout is a fragile grid + viewport chain — three
 * fixed columns that collapse to a single panel at <1024px. A
 * well-meaning refactor that drops the `100vh - 56px` or removes a
 * breakpoint will silently break the editor. This test reads the
 * CSS source directly and asserts the contract the layout depends
 * on, so changes that would regress the responsive behaviour fail
 * loudly.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  join(process.cwd(), 'src/app/globals.css'),
  'utf-8',
);

describe('PageBuilder CSS', () => {
  it('does not double-subtract the 56px header from pb-root', () => {
    // `<main>` in the dashboard grid already excludes the 56px header.
    // Subtracting it again on `.pb-root` causes a vertical scroll.
    expect(css).not.toMatch(/\.pb-root\s*\{[^}]*height:\s*calc\(100vh\s*-\s*56px\)/);
  });

  it('keeps pb-root as a 100% block so it lives inside <main>', () => {
    expect(css).toMatch(/\.pb-root\s*\{[^}]*height:\s*100%/);
  });

  it('defines the compact 240/320 layout between 1024 and 1280', () => {
    expect(css).toMatch(
      /@media\s*\(max-width:\s*1279\.98px\)\s*\{[\s\S]*?\.pb-body\s*\{[\s\S]*?grid-template-columns:\s*240px\s+1fr\s+320px/,
    );
  });

  it('hides the palette and inspector below 1024', () => {
    expect(css).toMatch(
      /@media\s*\(max-width:\s*1023\.98px\)\s*\{[\s\S]*?\.pb-palette,\s*\.pb-inspector\s*\{[\s\S]*?display:\s*none/,
    );
  });

  it('reveals the active panel via pb-body--panel-* modifiers', () => {
    expect(css).toMatch(/\.pb-body--panel-blocks\s*>\s*\.pb-palette/);
    expect(css).toMatch(/\.pb-body--panel-inspector\s*>\s*\.pb-inspector/);
  });

  it('hides toolbar text labels below 1280', () => {
    expect(css).toMatch(
      /@media\s*\(max-width:\s*1279\.98px\)\s*\{[\s\S]*?\.pb-toolbar__label\s*\{\s*display:\s*none/,
    );
  });

  it('shows the toolbar view segment below 1024', () => {
    expect(css).toMatch(
      /@media\s*\(max-width:\s*1023\.98px\)\s*\{[\s\S]*?\.pb-toolbar__view-segment\s*\{[\s\S]*?display:\s*inline-flex/,
    );
  });
});
