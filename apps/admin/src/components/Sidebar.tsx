'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import {
  ChartBar,
  Database,
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  PanelLeftClose,
  PanelLeftOpen,
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
  { href: '/templates', label: 'Templates', icon: <LayoutTemplate size={16} /> },
  { href: '/media', label: 'Media', icon: <ImageIcon size={16} /> },
  { href: '/users', label: 'Users', icon: <Users size={16} /> },
  { href: '/settings', label: 'Settings', icon: <Settings size={16} /> },
];

export interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ className, collapsed = false, onCollapsedChange }: SidebarProps): React.JSX.Element {
  const pathname = usePathname() ?? '/';

  function toggle(): void {
    onCollapsedChange?.(!collapsed);
  }

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r p-4 transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-60',
        className,
      )}
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div
        className={cn(
          'mb-6 flex items-center gap-2 px-2',
          collapsed ? 'justify-center px-0' : '',
        )}
      >
        <div
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-sm font-bold"
          style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
          aria-hidden={collapsed ? 'true' : undefined}
        >
          Q
        </div>
        {!collapsed ? <span className="text-sm font-semibold">Q-CMS Admin</span> : null}
      </div>
      <nav className="flex flex-col gap-1" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const testId = `nav-${item.href.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'dashboard'}`;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                collapsed ? 'justify-center px-0' : '',
                isActive ? 'font-semibold' : '',
              )}
              style={{
                background: isActive ? 'var(--color-primary)' : 'transparent',
                color: isActive ? 'var(--color-primary-foreground)' : 'var(--color-foreground)',
              }}
              aria-current={isActive ? 'page' : undefined}
              data-testid={testId}
            >
              <span aria-hidden="true">{item.icon}</span>
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-1">
        {!collapsed ? (
          <div className="px-2 pt-4 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            v0.1.0
          </div>
        ) : null}
        {/* Footer link kept for parity with reference nav in mockups. */}
        <Link
          href="/changelog"
          title={collapsed ? 'Changelog' : undefined}
          aria-label={collapsed ? 'Changelog' : undefined}
          className={cn(
            'hidden items-center gap-2 rounded-md px-3 py-1.5 text-xs',
            collapsed ? 'justify-center px-0' : '',
          )}
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          <FileText size={12} aria-hidden="true" />
          {!collapsed ? <span>Changelog</span> : null}
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          data-testid="sidebar-toggle"
          className={cn(
            'mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors',
            collapsed ? 'justify-center px-0' : '',
          )}
          style={{
            color: 'var(--color-muted-foreground)',
            background: 'transparent',
            border: '1px solid var(--color-border)',
          }}
        >
          {collapsed ? (
            <PanelLeftOpen size={14} aria-hidden="true" />
          ) : (
            <>
              <PanelLeftClose size={14} aria-hidden="true" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
