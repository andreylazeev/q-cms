/**
 * Zod schema generation from field configs.
 *
 * Converts field-type discriminated unions into Zod schemas suitable
 * for runtime entry validation. Respects `required`, `localized`,
 * min/max constraints, and relation cardinality.
 */

import { z } from "zod";
import type {
  BlockConfig,
  CollectionConfig,
  ComponentConfig,
  FieldConfig,
  FieldMap,
} from "./index.ts";

// ---------------------------------------------------------------------------
// Field → Zod
// ---------------------------------------------------------------------------

function zodForField(field: FieldConfig): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (field.type) {
    // --- scalar ---
    case "text": {
      let s = z.string();
      if (field.minLength !== undefined) s = s.min(field.minLength);
      if (field.maxLength !== undefined) s = s.max(field.maxLength);
      if (field.pattern !== undefined) s = s.regex(new RegExp(field.pattern));
      schema = s;
      break;
    }
    case "richtext": {
      let s = z.string();
      if (field.maxLength !== undefined) s = s.max(field.maxLength);
      schema = s;
      break;
    }
    case "number": {
      let s = z.number();
      if (field.integer) s = s.int();
      if (field.min !== undefined) s = s.min(field.min);
      if (field.max !== undefined) s = s.max(field.max);
      schema = s;
      break;
    }
    case "boolean":
      schema = z.boolean();
      break;
    case "date":
      schema = z.string();
      break;
    case "datetime":
      schema = z.string();
      break;
    case "json":
      schema = z.unknown();
      break;
    case "enum": {
      const [first, ...rest] = field.options;
      if (first === undefined) {
        schema = z.string();
      } else {
        schema = z.enum([first, ...rest]);
      }
      break;
    }
    case "media": {
      // Media fields store a media ID string (or array for multiple).
      schema = z.string().uuid();
      break;
    }
    case "color":
      schema = z.string();
      break;
    case "password":
      schema = z.string();
      break;
    case "email":
      schema = z.string().email();
      break;
    case "url":
      schema = z.string().url();
      break;
    case "geo": {
      schema = z.object({
        lat: z.number(),
        lng: z.number(),
      });
      break;
    }

    // --- relational / structured ---
    case "relation":
      if (field.multiple) {
        schema = z.array(z.string().uuid());
      } else {
        schema = z.string().uuid();
      }
      break;

    case "repeatable": {
      schema = z.array(zodForFieldMap(field.fields, {}));
      break;
    }

    case "component":
      // Component schemas are generated with full context; here we
      // emit z.unknown() — callers should call `zodForComponent()` instead.
      schema = z.unknown();
      break;

    // --- identifiers ---
    case "uid":
      schema = z.string();
      break;
    case "slug":
      schema = z.string();
      break;

    // --- dynamic zone ---
    case "blocks": {
      schema = z.array(
        z.object({
          type: z.string(),
          data: z.unknown(),
          children: z.array(z.unknown()).optional(),
        }),
      );
      break;
    }

    // --- meta ---
    case "locale":
      schema = z.string();
      break;

    default:
      schema = z.unknown();
  }

  // Apply common modifiers
  if (!field.required) {
    schema = schema.optional();
  }
  if (field.default !== undefined) {
    schema = schema.default(field.default);
  }

  return schema;
}

// ---------------------------------------------------------------------------
// Field map → Zod object
// ---------------------------------------------------------------------------

/**
 * Build a Zod object schema from a field map.
 *
 * @param fields  Field definitions
 * @param components  Component definitions (needed for `component` fields)
 */
export function zodForFieldMap(
  fields: FieldMap,
  components: Record<string, ComponentConfig>,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, field] of Object.entries(fields)) {
    if (field.type === "component") {
      const comp = components[field.component];
      if (comp) {
        shape[key] = zodForFieldMap(comp.fields, components);
        if (!field.required) {
          shape[key] = shape[key]!.optional();
        }
        if (field.default !== undefined) {
          shape[key] = shape[key]!.default(field.default);
        }
      } else {
        shape[key] = z.unknown();
      }
    } else {
      shape[key] = zodForField(field);
    }
  }

  return z.object(shape);
}

// ---------------------------------------------------------------------------
// Collection → Zod
// ---------------------------------------------------------------------------

/**
 * Generate a Zod schema for entries of a given collection.
 *
 * Returns a Zod object that validates the `data` portion of an entry.
 */
export function zodForCollection(
  collection: CollectionConfig,
  components: Record<string, ComponentConfig> = {},
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  return zodForFieldMap(collection.fields, components);
}

// ---------------------------------------------------------------------------
// Component → Zod
// ---------------------------------------------------------------------------

/**
 * Generate a Zod schema for a reusable component.
 */
export function zodForComponent(
  component: ComponentConfig,
  components: Record<string, ComponentConfig> = {},
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  return zodForFieldMap(component.fields, components);
}

// ---------------------------------------------------------------------------
// Block → Zod
// ---------------------------------------------------------------------------

/**
 * Generate a Zod schema for a block's data payload.
 */
export function zodForBlock(
  block: BlockConfig,
  components: Record<string, ComponentConfig> = {},
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  return zodForFieldMap(block.schema, components);
}
