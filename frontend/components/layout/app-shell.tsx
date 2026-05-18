'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { logout } from '@/lib/api';
import {
  getPrimaryNavItems,
  getSecondaryNavItems,
  getVisibleNavItems,
  MORE_NAV_ICON,
  type NavItem,
} from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Logo, ProductLabel } from '@/components/brand/logo';

function NavLink({
  item,
  active,
  compact = false,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
        active
          ? 'bg-[var(--color-brand-primary)] text-white shadow-sm'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-primary-subtle)] hover:text-[var(--color-brand-primary)]',
        compact && 'flex-col gap-1 px-2 py-2 text-[11px]',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className={cn('shrink-0', compact ? 'h-5 w-5' : 'h-4 w-4')} />
      <span className={cn(compact && 'truncate')}>{compact ? item.shortLabel ?? item.label : item.label}</span>
    </Link>
  );
}

export function DesktopSidebar({
  userName,
  userRoles,
  permissions,
}: {
  userName: string;
  userRoles: string[];
  permissions: string[];
}) {
  const pathname = usePathname();
  const items = getVisibleNavItems(permissions);

  return (
    <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-[var(--color-border-subtle)] lg:bg-white/85 lg:backdrop-blur-xl">
      <div className="border-b border-[var(--color-border-subtle)] px-5 py-6">
        <Logo href="/cco" priority />
        <ProductLabel className="mt-4" />
        <p className="mt-3 text-sm font-medium text-[var(--color-text-primary)]">{userName}</p>
        <p className="text-xs text-[var(--color-text-secondary)]">{userRoles.join(' · ')}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-4" aria-label="Navegação principal">
        {items.map((item) => (
          <NavLink key={item.id} item={item} active={pathname.startsWith(item.href)} />
        ))}
      </nav>

      <div className="border-t border-[var(--color-border-subtle)] p-4">
        <Button
          variant="secondary"
          className="w-full justify-start"
          onClick={() => {
            logout();
            window.location.href = '/login?reason=logout';
          }}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}

export function MobileHeader({ userName }: { userName: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border-subtle)] bg-white/90 px-4 py-3 backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo variant="mark" href="/cco" />
          <ProductLabel />
        </div>
        <div className="rounded-full bg-[var(--color-brand-accent-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-brand-accent)] ring-1 ring-[color-mix(in_srgb,var(--color-brand-accent)_20%,transparent)]">
          Online
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav({
  permissions,
  moreOpen,
  onMoreOpen,
}: {
  permissions: string[];
  moreOpen: boolean;
  onMoreOpen: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const primary = getPrimaryNavItems(permissions);
  const secondary = getSecondaryNavItems(permissions);
  const MoreIcon = MORE_NAV_ICON;
  const hasMore = secondary.length > 0;

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-border-subtle)] bg-white/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"
        aria-label="Navegação mobile"
      >
        <div
          className={cn('grid gap-1', hasMore ? 'grid-cols-4' : `grid-cols-${Math.min(primary.length, 4)}`)}
          style={{ gridTemplateColumns: `repeat(${hasMore ? 4 : Math.max(primary.length, 1)}, minmax(0, 1fr))` }}
        >
          {primary.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition-all duration-200',
                  active ? 'bg-[var(--color-brand-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-primary-subtle)] hover:text-[var(--color-brand-primary)]',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-5 w-5" />
                <span>{item.shortLabel ?? item.label}</span>
              </Link>
            );
          })}

          {hasMore ? (
            <button
              type="button"
              onClick={() => onMoreOpen(true)}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition-all duration-200',
                moreOpen ? 'bg-[var(--color-brand-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-primary-subtle)] hover:text-[var(--color-brand-primary)]',
              )}
              aria-label="Abrir mais opções"
            >
              <MoreIcon className="h-5 w-5" />
              <span>Mais</span>
            </button>
          ) : null}
        </div>
      </nav>

      <Sheet open={moreOpen} onClose={() => onMoreOpen(false)} title="Mais opções">
        <div className="space-y-2">
          {secondary.map((item) => (
            <NavLink
              key={item.id}
              item={item}
              active={pathname.startsWith(item.href)}
              onClick={() => onMoreOpen(false)}
            />
          ))}
          <Button
            variant="secondary"
            className="mt-4 w-full justify-start"
            onClick={() => {
              logout();
              window.location.href = '/login?reason=logout';
            }}
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </Button>
        </div>
      </Sheet>
    </>
  );
}

export function AppShell({
  userName,
  userRoles,
  permissions,
  children,
}: {
  userName: string;
  userRoles: string[];
  permissions: string[];
  children: React.ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="gestop-app flex min-h-screen bg-[var(--color-bg-surface)]">
      <DesktopSidebar userName={userName} userRoles={userRoles} permissions={permissions} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader userName={userName} />
        <main className="gestop-main flex-1">{children}</main>
        <MobileBottomNav permissions={permissions} moreOpen={moreOpen} onMoreOpen={setMoreOpen} />
      </div>
    </div>
  );
}
