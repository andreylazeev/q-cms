'use client';

import { LogOut, Moon, Search, Sun, User as UserIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Input } from './ui/Input.tsx';
import { Button } from './ui/Button.tsx';
import { useAuthContext } from './AuthProvider.tsx';
import { getApiClient } from '../lib/api-client.ts';

export interface HeaderProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps): React.JSX.Element {
  const { user } = useAuthContext();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const initial = (document.documentElement.classList.contains('dark') ? 'dark' : 'light') as 'light' | 'dark';
    setTheme(initial);
  }, []);

  function toggleTheme(): void {
    const next: 'light' | 'dark' = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next === 'dark');
    }
  }

  return (
    <header
      className="flex h-14 items-center justify-between border-b px-6"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}
    >
      <div className="flex min-w-0 flex-col">
        {title ? <h1 className="truncate text-base font-semibold">{title}</h1> : null}
        {description ? (
          <p className="truncate text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <div className="hidden md:block w-64">
          <Input
            placeholder="Search…"
            aria-label="Global search"
            leftIcon={<Search size={14} aria-hidden="true" />}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </Button>
        <div className="flex items-center gap-2 text-sm">
          <span
            className="grid h-7 w-7 place-items-center rounded-full"
            style={{ background: 'var(--color-muted)' }}
            aria-hidden="true"
          >
            <UserIcon size={14} />
          </span>
          <span className="hidden md:inline" data-testid="header-user">
            {user?.email ?? 'Guest'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            getApiClient().setToken(undefined);
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem('q-cms-admin:auth');
              document.cookie = 'qcms_token=; path=/; max-age=0; SameSite=Lax';
            }
            window.location.href = '/login';
          }}
          aria-label="Sign out"
        >
          <LogOut size={16} />
        </Button>
      </div>
    </header>
  );
}
