/**
 * Pre-paint theme bootstrap for the admin app.
 *
 * The `<ThemeProvider>` in `@q-cms/ui` runs in `useEffect`, which
 * fires **after** React hydrates — so on first load the user sees
 * the SSR HTML in the default light theme, then the JS hydrates
 * and switches to the stored dark theme. That flash hurts the eyes
 * (this file is named to match the bug report).
 *
 * The fix mirrors the public site (`apps/web/public/js/theme.js`):
 * emit a tiny, synchronous IIFE in `<head>` that reads
 * `localStorage.qcms_theme`, falls back to the OS preference, and
 * paints the right theme **before** any body content renders.
 *
 * Unlike the public site, the admin is server-rendered (Next.js
 * App Router) — so we generate the script body here from
 * `@q-cms/theme` and inline it into the SSR HTML. That keeps the
 * theme tokens in sync with the rest of the app without a build
 * step, and avoids hand-editing a separate JS file.
 *
 * The IIFE also exposes `window.QCMS_THEME` so the React provider
 * can hand off cleanly: it sees the already-applied state via
 * `readAppliedTheme()` / `readAppliedMode()` and skips a redundant
 * re-apply on mount.
 *
 * @packageDocumentation
 */

import { BUILT_IN_THEMES, type ThemeDefinition } from '@q-cms/theme';

/** The `localStorage` key the rest of the app uses. */
const STORAGE_KEY = 'qcms_theme';

/** `<style>` tag id used by `applyThemeToDocument()`. */
const STYLE_ID = 'qcms-theme';

/** `<style>` tag id for the global motion transitions. */
const MOTION_STYLE_ID = 'qcms-theme-motion';

/** Layer name the runtime uses — must match `@q-cms/theme`. */
const LAYER_NAME = 'qcms-theme';

/**
 * Minimal payload the script needs. We strip everything that
 * isn't required to render the CSS so the inlined data stays
 * small (label, description, swatch, badge, modeHint are all
 * UI-only).
 */
interface BootstrapTheme {
  name: string;
  tokens: Record<string, string>;
  dark?: Record<string, string> | undefined;
}

/**
 * Pre-paint fallback so the first paint of `<html>` is the right
 * color even before our `<style>` tag is parsed. These match the
 * built-in `default` theme's canvas + fg.
 */
const FALLBACK_BG = '#f7f7f6';
const FALLBACK_FG = '#1a1a1a';

/** Whitelist of token keys we emit. Keeps the inlined CSS small
 *  and predictable — we only ship the names the admin actually
 *  uses (mirrors the public site's flat key set). */
const PUBLIC_TOKEN_KEYS = [
  'color-bg-canvas',
  'color-bg-surface',
  'color-bg-surface-raised',
  'color-bg-overlay',
  'color-fg',
  'color-fg-muted',
  'color-fg-subtle',
  'color-fg-on-accent',
  'color-fg-on-success',
  'color-fg-on-warning',
  'color-fg-on-danger',
  'color-border',
  'color-border-strong',
  'color-focus-ring',
  'color-accent',
  'color-accent-hover',
  'color-accent-soft',
  'color-link',
  'color-link-hover',
  'color-success',
  'color-success-soft',
  'color-warning',
  'color-warning-soft',
  'color-danger',
  'color-danger-soft',
  'space-0', 'space-1', 'space-2', 'space-3', 'space-4',
  'space-6', 'space-8', 'space-12', 'space-16', 'space-24',
  'space-32', 'space-48',
  'radius-none', 'radius-sm', 'radius-md', 'radius-lg',
  'radius-xl', 'radius-full',
  'shadow-1', 'shadow-2', 'shadow-3', 'shadow-4',
  'motion-fast', 'motion-base', 'motion-slow',
  'ease-out', 'ease-in', 'ease-in-out',
  'z-base', 'z-dropdown', 'z-sticky', 'z-overlay',
  'z-modal', 'z-popover', 'z-toast',
  'font-serif', 'font-sans', 'font-mono',
  'font-size-base', 'line-height-base',
  'font-size-h1', 'font-size-h2', 'font-size-h3',
  'max-width', 'content-width',
] as const;

function pickTokens(tokens: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of PUBLIC_TOKEN_KEYS) {
    const v = tokens[key];
    if (v === undefined || v === null) continue;
    out[key] = String(v);
  }
  return out;
}

/**
 * Reduce a `ThemeDefinition` to the lean shape we embed in the
 * bootstrap. Drops label/description/swatch/badge/modeHint —
 * those are only used by the picker UI and would bloat the HTML.
 */
function toBootstrapTheme(theme: ThemeDefinition): BootstrapTheme {
  return {
    name: theme.name,
    tokens: pickTokens(theme.tokens as unknown as Record<string, unknown>),
    dark: theme.dark ? pickTokens(theme.dark as unknown as Record<string, unknown>) : undefined,
  };
}
/**
 * Escape a string for safe embedding as a JSON literal. We use
 * `JSON.stringify` to get the standard escaping, then replace `</`
 * with `<\/` so the inlined script can't be terminated early by
 * a malicious token value.
 */
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/<\//g, '<\\/');
}

/**
 * Build the bootstrap script body. Returned as a string suitable
 * for `<script dangerouslySetInnerHTML={{ __html: ... }}>`.
 *
 * The function is pure and deterministic — calling it twice with
 * the same input returns the same string. That keeps SSR output
 * stable so React doesn't flag a hydration mismatch on `<html>`'s
 * `data-*` attributes.
 */
export function buildThemeBootstrapScript(): string {
  const themes = BUILT_IN_THEMES.map(toBootstrapTheme);
  const themesJson = safeJson(themes);

  return `(function(){
"use strict";
var STORAGE_KEY=${safeJson(STORAGE_KEY)};
var STYLE_ID=${safeJson(STYLE_ID)};
var MOTION_STYLE_ID=${safeJson(MOTION_STYLE_ID)};
var LAYER_NAME=${safeJson(LAYER_NAME)};
var FALLBACK_BG=${safeJson(FALLBACK_BG)};
var FALLBACK_FG=${safeJson(FALLBACK_FG)};
var THEMES=${themesJson};
function hasTheme(n){for(var i=0;i<THEMES.length;i++){if(THEMES[i].name===n)return true;}return false;}
function getTheme(n){for(var i=0;i<THEMES.length;i++){if(THEMES[i].name===n)return THEMES[i];}return null;}
function readStored(){try{var raw=window.localStorage.getItem(STORAGE_KEY);if(!raw)return null;var p=JSON.parse(raw);if(typeof p.theme!=="string")return null;var m=(p.mode==="dark"||p.mode==="light"||p.mode==="auto")?p.mode:"auto";return{theme:p.theme,mode:m};}catch(e){return null;}}
function writeStored(v){try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(v));}catch(e){}}
function resolveMode(s){if(s.mode==="light"||s.mode==="dark")return s.mode;if(typeof window.matchMedia==="function"&&window.matchMedia("(prefers-color-scheme: dark)").matches)return"dark";return"light";}
function resolveInitial(){var s=readStored();if(s){var m=(s.mode==="dark"||s.mode==="light"||s.mode==="auto")?s.mode:"auto";if(hasTheme(s.theme))return{theme:s.theme,mode:m};return{theme:"default",mode:m};}return{theme:"default",mode:"auto"};}
function renderBlock(t,ind){var lines=[];for(var k in t){if(Object.prototype.hasOwnProperty.call(t,k)){lines.push(ind+"--"+k+": "+String(t[k]).replace(/"/g,'\\\\"')+";");}}return lines.join("\\n");}
function buildCSS(theme,mode){var set=getTheme(theme)||THEMES[0];var light=set.tokens;var dark=set.dark||light;var lb=renderBlock(light,"  ");var db=renderBlock(dark,"  ");return"@layer "+LAYER_NAME+" {\\n:root {\\n"+lb+"\\n}\\n\\n[data-mode=\\"dark\\"] {\\n"+db+"\\n}";}
function upsertStyle(id,css,marker){var ex=document.getElementById(id);if(ex){if(ex.textContent!==css)ex.textContent=css;return ex;}var s=document.createElement("style");s.id=id;s.setAttribute("data-qcms-theme",marker);s.textContent=css;(document.head||document.documentElement).appendChild(s);return s;}
function applyTheme(theme,mode){var set=getTheme(theme)||THEMES[0];var safe=set.name;var tokens=(mode==="dark"?(set.dark||set.tokens):set.tokens);var root=document.documentElement;if(!root)return;root.setAttribute("data-theme",safe);root.setAttribute("data-mode",mode);root.style.colorScheme=mode;var bg=tokens["color-bg-canvas"]||FALLBACK_BG;var fg=tokens["color-fg"]||FALLBACK_FG;root.style.backgroundColor=bg;root.style.color=fg;upsertStyle(STYLE_ID,buildCSS(safe,mode),"tokens");upsertStyle(MOTION_STYLE_ID,"*, *::before, *::after { transition: background-color var(--motion-base, 200ms) var(--ease-out, ease-out), color var(--motion-base, 200ms) var(--ease-out, ease-out), border-color var(--motion-base, 200ms) var(--ease-out, ease-out), box-shadow var(--motion-base, 200ms) var(--ease-out, ease-out); } input, textarea, select, [contenteditable=\\"true\\"] { transition: none !important; }","motion");}
var initial=resolveInitial();applyTheme(initial.theme,resolveMode(initial));
if(typeof window.matchMedia==="function"){var mql=window.matchMedia("(prefers-color-scheme: dark)");var onChange=function(){var s=readStored();if(!s){applyTheme("default",mql.matches?"dark":"light");return;}if(s.mode==="auto"){applyTheme(s.theme,mql.matches?"dark":"light");}};if(mql.addEventListener){mql.addEventListener("change",onChange);}else if(mql.addListener){mql.addListener(onChange);}}
window.addEventListener("storage",function(ev){if(ev.key!==STORAGE_KEY)return;var s=readStored();if(s&&hasTheme(s.theme)){applyTheme(s.theme,resolveMode(s));}});
window.QCMS_THEME={get:function(){return readStored()||{theme:"default",mode:"auto"};},set:function(v){if(!v||typeof v!=="object")return;var t=hasTheme(v.theme)?v.theme:"default";var m=(v.mode==="dark"||v.mode==="light"||v.mode==="auto")?v.mode:"auto";var n={theme:t,mode:m};writeStored(n);applyTheme(t,resolveMode(n));},list:function(){return THEMES.map(function(t){return t.name;});},cycle:function(){var s=readStored()||{theme:"default",mode:"auto"};var names=THEMES.map(function(t){return t.name;});var idx=names.indexOf(s.theme);var next=names[(idx+1+names.length)%names.length]||"default";var n={theme:next,mode:s.mode||"auto"};writeStored(n);applyTheme(next,resolveMode(n));return next;}};
})();`;
}
