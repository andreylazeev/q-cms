/**
 * Field type definitions for @q-cms/schema.
 *
 * Every field type is a discriminated union member keyed on `type`.
 * The `localized` flag marks fields that vary per locale.
 */

import type { MediaType } from "@q-cms/core";

// ---------------------------------------------------------------------------
// Base field
// ---------------------------------------------------------------------------

export interface BaseFieldConfig {
  /** Allow per-locale values for this field. */
  localized?: boolean;
  /** Require a non-null, non-undefined value. */
  required?: boolean;
  /** Hide from the default admin list view. */
  hidden?: boolean;
  /** Optional default value applied when the field is empty. */
  default?: unknown;
}

// ---------------------------------------------------------------------------
// Scalar fields
// ---------------------------------------------------------------------------

export interface TextField extends BaseFieldConfig {
  type: "text";
  minLength?: number;
  maxLength?: number;
  /** Regex pattern the value must match. */
  pattern?: string;
}

export interface RichTextField extends BaseFieldConfig {
  type: "richtext";
  maxLength?: number;
}

export interface NumberField extends BaseFieldConfig {
  type: "number";
  min?: number;
  max?: number;
  /** Restrict to integers only. */
  integer?: boolean;
}

export interface BooleanField extends BaseFieldConfig {
  type: "boolean";
}

export interface DateField extends BaseFieldConfig {
  type: "date";
}

export interface DateTimeField extends BaseFieldConfig {
  type: "datetime";
}

export interface JsonField extends BaseFieldConfig {
  type: "json";
}

export interface EnumField extends BaseFieldConfig {
  type: "enum";
  options: readonly string[];
}

export interface MediaField extends BaseFieldConfig {
  type: "media";
  allowedTypes?: readonly MediaType[];
}

export interface ColorField extends BaseFieldConfig {
  type: "color";
}

export interface PasswordField extends BaseFieldConfig {
  type: "password";
}

export interface EmailField extends BaseFieldConfig {
  type: "email";
  /** Enforce uniqueness across entries in the same collection. */
  unique?: boolean;
}

export interface UrlField extends BaseFieldConfig {
  type: "url";
}

export interface GeoField extends BaseFieldConfig {
  type: "geo";
}

// ---------------------------------------------------------------------------
// Relational / structured fields
// ---------------------------------------------------------------------------

export interface RelationField extends BaseFieldConfig {
  type: "relation";
  /** Target collection name (key in `collections` map). */
  target: string;
  /** Allow multiple relations (one-to-many / many-to-many). */
  multiple?: boolean;
}

export interface RepeatableField extends BaseFieldConfig {
  type: "repeatable";
  fields: FieldMap;
}

export interface ComponentField extends BaseFieldConfig {
  type: "component";
  /** Key in the `components` map. */
  component: string;
}

// ---------------------------------------------------------------------------
// Identifier fields
// ---------------------------------------------------------------------------

export interface UidField extends BaseFieldConfig {
  type: "uid";
  /** Source field whose value the UID is derived from. */
  target: string;
}

export interface SlugField extends BaseFieldConfig {
  type: "slug";
  /** Source field whose value the slug is derived from. */
  target: string;
}

// ---------------------------------------------------------------------------
// Dynamic zone
// ---------------------------------------------------------------------------

/** Reference to a block definition, optionally with overrides. */
export interface BlockRef {
  ref: string;
  with?: Record<string, unknown>;
}

export interface BlocksField extends BaseFieldConfig {
  type: "blocks";
  /** Block keys (from the `blocks` map) or block refs with overrides. */
  blocks: readonly (string | BlockRef)[];
}

// ---------------------------------------------------------------------------
// Meta fields
// ---------------------------------------------------------------------------

export interface LocaleField extends BaseFieldConfig {
  type: "locale";
}

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

export type FieldConfig =
  | TextField
  | RichTextField
  | NumberField
  | BooleanField
  | DateField
  | DateTimeField
  | JsonField
  | EnumField
  | MediaField
  | ColorField
  | PasswordField
  | EmailField
  | UrlField
  | GeoField
  | RelationField
  | RepeatableField
  | ComponentField
  | UidField
  | SlugField
  | BlocksField
  | LocaleField;

/** Named map of fields used in collections and components. */
export type FieldMap = Record<string, FieldConfig>;
