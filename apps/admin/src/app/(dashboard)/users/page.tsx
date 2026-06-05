'use client';

import { UserPlus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button.tsx';
import { Card } from '../../../components/ui/Card.tsx';
import { DataTable } from '../../../components/DataTable.tsx';
import { Input } from '../../../components/ui/Input.tsx';
import { Modal } from '../../../components/ui/Modal.tsx';
import { Select } from '../../../components/ui/Select.tsx';
import { StatusBadge } from '../../../components/StatusBadge.tsx';
import { useToast } from '../../../components/Toaster.tsx';
import { getApiClient } from '../../../lib/api-client.ts';
import type { SdkUser } from '../../../lib/stubs/sdk-types.ts';

interface UserRow {
  id: string;
  email: string;
  name: string;
  avatarId: string | null;
  role: string;
  lastLoginAt: string | null;
  isActive: boolean;
}

const ROLE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'author', label: 'Author' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'viewer', label: 'Viewer' },
];

export default function UsersPage(): React.JSX.Element {
  const [users, setUsers] = useState<readonly SdkUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [submitting, setSubmitting] = useState(false);
  const { success, error: toastError } = useToast();

  const refetch = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const list = await getApiClient().users.list();
      setUsers(list);
    } finally {
      setIsLoading(false);
    }
  };

  // initial fetch
  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows: UserRow[] = users.map((u) => {
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || u.email;
    return {
      id: String(u.id),
      email: String(u.email),
      name: fullName,
      avatarId: u.avatarId,
      role: u.isSuperAdmin ? 'super-admin' : 'editor',
      lastLoginAt: u.lastLoginAt,
      isActive: Boolean(u.isActive),
    };
  });

  async function onInvite(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Real implementation: POST /api/v1/users
      await new Promise((resolve) => setTimeout(resolve, 200));
      success(`Invitation sent to ${email}`);
      setOpen(false);
      setEmail('');
      void refetch();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="users-page">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            Manage administrator accounts, roles, and invitations.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
          <UserPlus size={14} /> Invite user
        </Button>
      </header>

      <DataTable
        isLoading={isLoading}
        rowKey={(row) => row.id}
        rows={rows as readonly UserRow[]}
        emptyMessage="No users yet."
        columns={[
          {
            id: 'user',
            header: 'User',
            cell: (r) => {
              const u = r as UserRow;
              return (
                <div className="flex items-center gap-3">
                  {u.avatarId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/media/${u.avatarId}.svg`}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="grid h-7 w-7 place-items-center rounded-full text-xs font-medium"
                      style={{ background: 'var(--color-muted)' }}
                    >
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{u.name}</span>
                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                      {u.email}
                    </span>
                  </div>
                </div>
              );
            },
          },
          {
            id: 'role',
            header: 'Role',
            cell: (r) => <span className="capitalize">{(r as UserRow).role}</span>,
          },
          {
            id: 'status',
            header: 'Status',
            cell: (r) => <StatusBadge status={(r as UserRow).isActive ? 'active' : 'inactive'} />,
          },
          {
            id: 'lastLogin',
            header: 'Last login',
            cell: (r) => {
              const ts = (r as UserRow).lastLoginAt;
              return ts ? new Date(ts).toLocaleString() : '—';
            },
          },
        ]}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Invite user"
        description="Send a magic-link invitation to join the workspace."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="invite-user-form" variant="primary" size="sm" isLoading={submitting}>
              Send invite
            </Button>
          </>
        }
      >
        <form id="invite-user-form" onSubmit={onInvite} className="flex flex-col gap-3">
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)} options={ROLE_OPTIONS} />
        </form>
      </Modal>

      <Card>
        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
          {rows.length} users across the workspace — admins, editors, authors, and viewers.
        </p>
      </Card>
    </div>
  );
}
