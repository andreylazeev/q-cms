import { describe, expect, it } from 'vitest';
import { userId } from '@q-cms/core/branded';
import { ForbiddenError } from '@q-cms/core/errors';
import {
  classify,
  DEFAULT_ROLES,
  evaluateConditions,
  matches,
  require,
  type Permission,
} from '../src/rbac.ts';

const ANNA = userId('11111111-1111-4111-8111-111111111111');

describe('rbac', () => {
  describe('matches', () => {
    it('matches exact resource + action', () => {
      const a: Permission = { resource: { type: 'collection', name: 'Article' }, action: 'read' };
      const b: Permission = { resource: { type: 'collection', name: 'Article' }, action: 'read' };
      expect(matches(a, b)).toBe(true);
    });

    it('rejects when action differs', () => {
      const a: Permission = { resource: { type: 'collection', name: 'Article' }, action: 'read' };
      const b: Permission = { resource: { type: 'collection', name: 'Article' }, action: 'update' };
      expect(matches(a, b)).toBe(false);
    });

    it('wildcards action', () => {
      const a: Permission = { resource: { type: 'collection', name: 'Article' }, action: '*' };
      const b: Permission = { resource: { type: 'collection', name: 'Article' }, action: 'publish' };
      expect(matches(a, b)).toBe(true);
    });

    it('wildcards collection name', () => {
      const a: Permission = { resource: { type: 'collection', name: '*' }, action: 'read' };
      const b: Permission = { resource: { type: 'collection', name: 'Article' }, action: 'read' };
      expect(matches(a, b)).toBe(true);
    });

    it('rejects cross-collection name without wildcard', () => {
      const a: Permission = { resource: { type: 'collection', name: 'Article' }, action: 'read' };
      const b: Permission = { resource: { type: 'collection', name: 'Author' }, action: 'read' };
      expect(matches(a, b)).toBe(false);
    });

    it('rejects cross-resource type', () => {
      const a: Permission = { resource: { type: 'media' }, action: 'read' };
      const b: Permission = { resource: { type: 'settings' }, action: 'read' };
      expect(matches(a, b)).toBe(false);
    });

    it('global resource matches anything', () => {
      const a: Permission = { resource: { type: 'global' }, action: '*' };
      const b: Permission = { resource: { type: 'media' }, action: 'delete' };
      expect(matches(a, b)).toBe(true);
    });
  });

  describe('evaluateConditions', () => {
    it('returns true when there are no conditions', () => {
      expect(evaluateConditions(undefined, { userId: ANNA })).toBe(true);
      expect(evaluateConditions([], { userId: ANNA })).toBe(true);
    });

    it('interpolates $user.id for eq', () => {
      const conds = [{ field: 'created_by', op: 'eq' as const, value: '$user.id' }];
      expect(
        evaluateConditions(conds, { userId: ANNA, resource: { created_by: ANNA } }),
      ).toBe(true);
      expect(
        evaluateConditions(conds, { userId: ANNA, resource: { created_by: 'someone-else' } }),
      ).toBe(false);
    });

    it('supports neq', () => {
      const conds = [{ field: 'role', op: 'neq' as const, value: 'super_admin' }];
      expect(evaluateConditions(conds, { userId: ANNA, resource: { role: 'admin' } })).toBe(true);
      expect(evaluateConditions(conds, { userId: ANNA, resource: { role: 'super_admin' } })).toBe(false);
    });

    it('supports in', () => {
      const conds = [{ field: 'status', op: 'in' as const, value: ['draft', 'in_review'] }];
      expect(evaluateConditions(conds, { userId: ANNA, resource: { status: 'draft' } })).toBe(true);
      expect(evaluateConditions(conds, { userId: ANNA, resource: { status: 'published' } })).toBe(false);
    });

    it('supports contains (string)', () => {
      const conds = [{ field: 'title', op: 'contains' as const, value: 'q-cms' }];
      expect(evaluateConditions(conds, { userId: ANNA, resource: { title: 'Welcome to q-cms' } })).toBe(true);
      expect(evaluateConditions(conds, { userId: ANNA, resource: { title: 'Hello' } })).toBe(false);
    });

    it('supports contains (array)', () => {
      const conds = [{ field: 'tags', op: 'contains' as const, value: 'ts' }];
      expect(evaluateConditions(conds, { userId: ANNA, resource: { tags: ['js', 'ts'] } })).toBe(true);
      expect(evaluateConditions(conds, { userId: ANNA, resource: { tags: ['js'] } })).toBe(false);
    });

    it('returns false when any condition fails (AND semantics)', () => {
      const conds = [
        { field: 'created_by', op: 'eq' as const, value: '$user.id' },
        { field: 'status', op: 'eq' as const, value: 'draft' },
      ];
      expect(
        evaluateConditions(conds, { userId: ANNA, resource: { created_by: ANNA, status: 'draft' } }),
      ).toBe(true);
      expect(
        evaluateConditions(conds, { userId: ANNA, resource: { created_by: ANNA, status: 'published' } }),
      ).toBe(false);
    });

    it('denies when a required field is missing (permissive resolution)', () => {
      const conds = [{ field: 'created_by', op: 'eq' as const, value: '$user.id' }];
      // No `resource` → field is undefined → eq fails → deny.
      expect(evaluateConditions(conds, { userId: ANNA })).toBe(false);
    });
  });

  describe('classify / DEFAULT_ROLES', () => {
    it('super_admin can do anything', () => {
      const role = DEFAULT_ROLES['super_admin']!;
      expect(classify([role.name], { resource: { type: 'users' }, action: 'delete' })).toBe(true);
      expect(
        classify([role.name], { resource: { type: 'collection', name: 'Anything' }, action: 'publish' }),
      ).toBe(true);
    });

    it('admin can do most things, but cannot delete super_admins', () => {
      const role = DEFAULT_ROLES['admin']!;
      expect(
        classify(
          [role.name],
          { resource: { type: 'collection', name: 'Article' }, action: 'publish' },
        ),
      ).toBe(true);
      // Wildcard users:delete is NOT granted; admin can read/update only.
      expect(classify([role.name], { resource: { type: 'users' }, action: 'delete' })).toBe(false);
      expect(classify([role.name], { resource: { type: 'users' }, action: 'update' })).toBe(true);
    });

    it('admin cannot create super_admin users', () => {
      const role = DEFAULT_ROLES['admin']!;
      expect(
        classify(
          [role.name],
          { resource: { type: 'users' }, action: 'create' },
          // A user being created with role=super_admin should be denied.
          { userId: ANNA, resource: { role: 'super_admin' } },
        ),
      ).toBe(false);
      expect(
        classify(
          [role.name],
          { resource: { type: 'users' }, action: 'create' },
          { userId: ANNA, resource: { role: 'editor' } },
        ),
      ).toBe(true);
    });

    it('editor has full CRUD/publish on any collection', () => {
      const role = DEFAULT_ROLES['editor']!;
      expect(
        classify([role.name], { resource: { type: 'collection', name: 'Article' }, action: 'publish' }),
      ).toBe(true);
      expect(
        classify([role.name], { resource: { type: 'collection', name: 'Author' }, action: 'delete' }),
      ).toBe(true);
    });

    it('author can read anything but only write own rows', () => {
      const role = DEFAULT_ROLES['author']!;
      const write: Permission = { resource: { type: 'collection', name: 'Article' }, action: 'update' };
      expect(
        classify([role.name], write, { userId: ANNA, resource: { created_by: ANNA } }),
      ).toBe(true);
      expect(
        classify([role.name], write, { userId: ANNA, resource: { created_by: 'someone-else' } }),
      ).toBe(false);
    });

    it('author cannot publish', () => {
      const role = DEFAULT_ROLES['author']!;
      expect(
        classify([role.name], { resource: { type: 'collection', name: 'Article' }, action: 'publish' }),
      ).toBe(false);
    });

    it('reviewer can read and approve', () => {
      const role = DEFAULT_ROLES['reviewer']!;
      expect(
        classify([role.name], { resource: { type: 'collection', name: 'Article' }, action: 'approve' }),
      ).toBe(true);
      expect(
        classify([role.name], { resource: { type: 'collection', name: 'Article' }, action: 'update' }),
      ).toBe(false);
    });

    it('viewer is read-only across the board', () => {
      const role = DEFAULT_ROLES['viewer']!;
      expect(
        classify([role.name], { resource: { type: 'collection', name: 'Article' }, action: 'read' }),
      ).toBe(true);
      expect(
        classify([role.name], { resource: { type: 'media' }, action: 'read' }),
      ).toBe(true);
      expect(
        classify([role.name], { resource: { type: 'collection', name: 'Article' }, action: 'create' }),
      ).toBe(false);
      expect(
        classify([role.name], { resource: { type: 'settings' }, action: 'update' }),
      ).toBe(false);
    });

    it('multiple roles: any grant suffices', () => {
      expect(
        classify(
          ['viewer', 'author'],
          { resource: { type: 'collection', name: 'Article' }, action: 'update' },
          { userId: ANNA, resource: { created_by: ANNA } },
        ),
      ).toBe(true);
    });

    it('returns false for unknown roles', () => {
      expect(
        classify(['mystery-role'], { resource: { type: 'media' }, action: 'read' }),
      ).toBe(false);
    });
  });

  describe('require', () => {
    it('returns Ok on success', () => {
      const result = require(
        ['super_admin'],
        { resource: { type: 'users' }, action: 'delete' },
      );
      expect(result.ok).toBe(true);
    });

    it('returns Err(ForbiddenError) on denial', () => {
      const result = require(
        ['viewer'],
        { resource: { type: 'settings' }, action: 'update' },
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBeInstanceOf(ForbiddenError);
    });

    it('treats conditional grants as conditional', () => {
      const result = require(
        ['author'],
        { resource: { type: 'collection', name: 'Article' }, action: 'update' },
        { userId: ANNA, resource: { created_by: 'someone-else' } },
      );
      expect(result.ok).toBe(false);
    });
  });
});
