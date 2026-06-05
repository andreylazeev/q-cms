'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import {
  ChartBar,
  Database,
  FileText,
  Image as ImageIcon,
  Settings,
  Users,
} from 'lucide-react';
import { cn } from '../lib/utils.ts';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Dashboard', icon: <ChartBar size={16} /> },
  { href: '/collections', label: 'Collections', icon: <Database size={16} /> },
  { href: '/media', label: 'Media', icon: <ImageIcon size={16} /> },
  { href: '/users', label: 'Users', icon: <Users size={16} /> },
  { href: '/settings', label: 'Settings', icon: <Settings size={16} /> },
];

export interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps): React.JSX.Element {
  const pathname = usePathname() ?? '/';
  return (
    <aside
      className={cn('flex h-full w-60 flex-col border-r p-4', className)}
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}
    >
      <div className="mb-6 flex items-center gap-2 px-2">
        <div
          className="grid h-8 w-8 place-items-center rounded-md text-sm font-bold"
          style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
        >
          Q
        </div>
        <span className="text-sm font-semibold">Q-CMS Admin</span>
      </div>
      <nav className="flex flex-col gap-1" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                isActive ? 'font-semibold' : '',
              )}
              style={{
                background: isActive ? 'var(--color-accent)' : 'transparent',
                color: isActive ? 'var(--color-accent-foreground)' : 'var(--color-foreground)',
              }}
              aria-current={isActive ? 'page' : undefined}
              data-testid={`nav-${item.href.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'dashboard'}`}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-2 pt-6 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
        v0.1.0
      </div>
      {/* Footer link kept for parity with reference nav in mockups. */}
      <Link
        href="/changelog"
        className="mt-1 hidden items-center gap-2 rounded-md px-3 py-1.5 text-xs"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        <FileText size={12} /> Changelog
      </Link>
    </aside>
  );
}
