/**
 * Role-Based Access Control (RBAC) for Q-CMS.
 *
 * Q-CMS ships with a fixed set of {@link DEFAULT_ROLES} covering the
 * editorial workflow described in SPEC §6.2. Custom roles can be
 * registered by adding entries to a role map and calling
 * {@link classify} / {@link require} the same way.
 *
 * Wildcard matching rules:
 * - The action `'*'` matches any action.
 * - The resource `{ type: 'collection', name: '*' }` matches any collection.
 * - The resource `{ type: 'global' }` matches every resource type.
 *
 * @module rbac
 */

import type { UserId } from '@q-cms/core/branded';
import { Err, Ok, type Result } from '@q-cms/core/result';
import { ForbiddenError } from '@q-cms/core/errors';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** All actions a role can be granted on a resource. */
export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'publish'
  | 'approve'
  | 'manage'
  | '*';

/**
 * The target of a permission grant. The discriminated union keeps the
 * surface narrow: `collection` resources carry a name, the rest are
 * type-only.
 */
export type Resource =
  | { readonly type: 'collection'; readonly name: string }
  | { readonly type: 'media' }
  | { readonly type: 'settings' }
  | { readonly type: 'users' }
  | { readonly type: 'webhooks' }
  | { readonly type: 'audit' }
  | { readonly type: 'global' };

/** Comparison operator for a {@link PermissionCondition}. */
export type ConditionOp = 'eq' | 'neq' | 'in' | 'contains';

/**
 * A row-level condition. `value` may be a literal or a `$user.<path>`
 * expression referencing the evaluation context (currently only
 * `$user.id` is interpolated).
 */
export interface PermissionCondition {
  readonly field: string;
  readonly op: ConditionOp;
  readonly value: unknown;
}

/** A single grant: action on a resource, optionally narrowed by conditions. */
export interface Permission {
  readonly resource: Resource;
  readonly action: Action;
  readonly conditions?: readonly PermissionCondition[];
}

/** A named bundle of {@link Permission}s. */
export interface Role {
  readonly name: string;
  readonly permissions: readonly Permission[];
  readonly isSystem?: boolean;
}

/** Optional context used when evaluating {@link PermissionCondition}s. */
export interface RbacContext {
  readonly userId: UserId;
  readonly resource?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Default roles (SPEC §6.2)
// ---------------------------------------------------------------------------

/**
 * Wildcard permission over a single resource. Convenience for the
 * default-role table below; keeps the data definition terse.
 */
function allActions(resource: Resource): Permission {
  return { resource, action: '*' };
}

const COLLECTION_TYPES: readonly Resource[] = [
  { type: 'global' },
  { type: 'media' },
  { type: 'settings' },
  { type: 'users' },
  { type: 'webhooks' },
  { type: 'audit' },
];

const VIEWER_RESOURCES: readonly Resource[] = [
  { type: 'global' },
  { type: 'media' },
  { type: 'settings' },
  { type: 'users' },
  { type: 'webhooks' },
];

/** System roles shipped with every Q-CMS install. */
export const DEFAULT_ROLES: Readonly<Record<string, Role>> = Object.freeze({
  /** All resources, all actions — root of trust. */
  super_admin: {
    name: 'super_admin',
    isSystem: true,
    permissions: COLLECTION_TYPES.map((r) => allActions(r)),
  },
  /**
   * Everything except destructive ops on other super-admins. Admin can
   * create / read / update users but never delete them; and can never
   * create a user with the `super_admin` role.
   */
  admin: {
    name: 'admin',
    isSystem: true,
    permissions: [
      { resource: { type: 'media' }, action: '*' },
      { resource: { type: 'settings' }, action: '*' },
      { resource: { type: 'webhooks' }, action: '*' },
      { resource: { type: 'audit' }, action: 'read' },
      // Users: read / update / conditional create. No delete grant.
      { resource: { type: 'users' }, action: 'read' },
      { resource: { type: 'users' }, action: 'update' },
      {
        resource: { type: 'users' },
        action: 'create',
        conditions: [
          { field: 'role', op: 'neq', value: 'super_admin' },
        ],
      },
      // Collections: full CRUD/publish/approve (no delete).
      { resource: { type: 'collection', name: '*' }, action: 'read' },
      { resource: { type: 'collection', name: '*' }, action: 'create' },
      { resource: { type: 'collection', name: '*' }, action: 'update' },
      { resource: { type: 'collection', name: '*' }, action: 'publish' },
      { resource: { type: 'collection', name: '*' }, action: 'approve' },
    ],
  },
  /** Editor: full CRUD/publish on any collection. */
  editor: {
    name: 'editor',
    isSystem: true,
    permissions: [
      { resource: { type: 'media' }, action: 'read' },
      { resource: { type: 'media' }, action: 'create' },
      { resource: { type: 'media' }, action: 'update' },
      { resource: { type: 'media' }, action: 'delete' },
      { resource: { type: 'collection', name: '*' }, action: 'read' },
      { resource: { type: 'collection', name: '*' }, action: 'create' },
      { resource: { type: 'collection', name: '*' }, action: 'update' },
      { resource: { type: 'collection', name: '*' }, action: 'delete' },
      { resource: { type: 'collection', name: '*' }, action: 'publish' },
    ],
  },
  /**
   * Author: read + create + update on any collection, but only on rows
   * where `created_by` equals the current user. (See SPEC §6.2.)
   */
  author: {
    name: 'author',
    isSystem: true,
    permissions: [
      { resource: { type: 'media' }, action: 'read' },
      { resource: { type: 'collection', name: '*' }, action: 'read' },
      {
        resource: { type: 'collection', name: '*' },
        action: 'create',
        conditions: [{ field: 'created_by', op: 'eq', value: '$user.id' }],
      },
      {
        resource: { type: 'collection', name: '*' },
        action: 'update',
        conditions: [{ field: 'created_by', op: 'eq', value: '$user.id' }],
      },
    ],
  },
  /** Reviewer: read all + approve collection entries. */
  reviewer: {
    name: 'reviewer',
    isSystem: true,
    permissions: [
      { resource: { type: 'media' }, action: 'read' },
      { resource: { type: 'collection', name: '*' }, action: 'read' },
      { resource: { type: 'collection', name: '*' }, action: 'approve' },
    ],
  },
  /** Viewer: read-only across the board (no audit access). */
  viewer: {
    name: 'viewer',
    isSystem: true,
    permissions: VIEWER_RESOURCES.map((resource) => ({ resource, action: 'read' as Action })),
  },
});

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * Resource type-rank used by `matches` for the global wildcard.
 * Higher number = broader scope. A grant with type `'global'` matches
 * any required resource.
 */
function resourceTypeRank(type: Resource['type']): number {
  if (type === 'global') return 100;
  return 1;
}

/**
 * Returns `true` if a held permission (`perm`) is sufficient to satisfy
 * a requirement (`required`).
 *
 * Match rules:
 * - Action must equal, or be `'*'`.
 * - Resources must be of the same type, except `'global'` grants match
 *   any required resource type.
 * - For `collection` resources, names must match or the held name must
 *   be `'*'`.
 */
export function matches(perm: Permission, required: Permission): boolean {
  // Action check
  if (perm.action !== required.action && perm.action !== '*') return false;

  // Resource check
  if (perm.resource.type === 'global') return true;
  if (perm.resource.type !== required.resource.type) return false;

  if (perm.resource.type === 'collection' && required.resource.type === 'collection') {
    if (perm.resource.name === '*') return true;
    return perm.resource.name === required.resource.name;
  }

  return true;
}

/**
 * Silences the unused-`rank` helper for the day we want a numeric
 * "is this grant broader" check. Exported for downstream packages.
 */
export function isBroaderOrEqual(perm: Permission, required: Permission): boolean {
  return matches(perm, required) && resourceTypeRank(perm.resource.type) >= resourceTypeRank(required.resource.type);
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

/**
 * Resolve a `$user.<path>` reference from the evaluation context, or
 * return the literal value when no reference is present.
 */
function resolveValue(value: unknown, context: RbacContext): unknown {
  if (typeof value !== 'string') return value;
  if (value === '$user.id') return context.userId;
  if (value.startsWith('$user.')) {
    const path = value.slice('$user.'.length);
    return path === 'id' ? context.userId : undefined;
  }
  return value;
}

/**
 * Walk a dot-path on a record. Returns `undefined` when any segment is
 * missing rather than throwing — RBAC checks should be permissive about
 * missing fields (a stricter check would deny on missing data).
 */
function readField(record: Record<string, unknown> | undefined, path: string): unknown {
  if (!record) return undefined;
  const segments = path.split('.');
  let cur: unknown = record;
  for (const seg of segments) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * Evaluate the conditions on a permission grant. Conditions are AND-ed
 * (every condition must hold). If `conditions` is empty/missing, the
 * grant is unconditional and returns `true`.
 *
 * `$user.id` in a condition value is interpolated from the context.
 */
export function evaluateConditions(
  conditions: readonly PermissionCondition[] | undefined,
  context: RbacContext,
): boolean {
  if (!conditions || conditions.length === 0) return true;
  for (const cond of conditions) {
    const fieldValue = readField(context.resource, cond.field);
    const conditionValue = resolveValue(cond.value, context);
    if (!evaluateOne(cond.op, fieldValue, conditionValue)) return false;
  }
  return true;
}

function evaluateOne(op: ConditionOp, fieldValue: unknown, condValue: unknown): boolean {
  switch (op) {
    case 'eq':
      return fieldValue === condValue;
    case 'neq':
      return fieldValue !== condValue;
    case 'in':
      return Array.isArray(condValue) && condValue.includes(fieldValue);
    case 'contains':
      if (typeof fieldValue === 'string' && typeof condValue === 'string') {
        return fieldValue.includes(condValue);
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(condValue);
      }
      return false;
    default: {
      // Exhaustiveness guard.
      const _never: never = op;
      void _never;
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Default role resolver: looks up roles in {@link DEFAULT_ROLES}. */
export function defaultRoleResolver(roleName: string): Role | undefined {
  return DEFAULT_ROLES[roleName];
}

/**
 * Check whether *any* of the user's roles grants the required permission
 * and (if it has conditions) the conditions hold for `context`.
 *
 * @param roles - Role names the user holds.
 * @param required - The permission to check.
 * @param context - Optional RBAC context; required when any matching
 *                  grant carries conditions.
 * @param resolve - Optional role resolver (defaults to {@link DEFAULT_ROLES}).
 */
export function classify(
  roles: readonly string[],
  required: Permission,
  context?: RbacContext,
  resolve: (name: string) => Role | undefined = defaultRoleResolver,
): boolean {
  for (const name of roles) {
    const role = resolve(name);
    if (!role) continue;
    for (const perm of role.permissions) {
      if (!matches(perm, required)) continue;
      if (perm.conditions && perm.conditions.length > 0) {
        if (!context) continue;
        if (!evaluateConditions(perm.conditions, context)) continue;
      }
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public guard
// ---------------------------------------------------------------------------

/**
 * Strict variant of {@link classify} that returns a `Result`. Use this
 * at API boundaries to translate denials into a {@link ForbiddenError}.
 */
export function require(
  roles: readonly string[],
  required: Permission,
  context?: RbacContext,
  resolve: (name: string) => Role | undefined = defaultRoleResolver,
): Result<void, ForbiddenError> {
  if (classify(roles, required, context, resolve)) return Ok(undefined);
  return Err(
    new ForbiddenError('Insufficient permissions', {
      roles: [...roles],
      required,
    }),
  );
}
