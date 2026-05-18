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
        'relative flex items-center gap-3 rounded-[var(--md-shape-full)] px-4 py-2.5 md-label-lg transition-all duration-[var(--md-duration-short)]',
        active
          ? 'bg-[var(--color-brand-primary-subtle)] text-[var(--color-brand-primary)]'
          : 'text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container-low)] hover:text-[var(--md-on-surface)]',
        compact && 'min-h-14 flex-col justify-center gap-1 px-2 py-2 md-label-md',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className={cn('shrink-0', compact ? 'h-6 w-6' : 'h-5 w-5')} />
      <span className={cn(compact && 'max-w-full truncate')}>
        {compact ? item.shortLabel ?? item.label : item.label}
      </span>
      {active && !compact ? (
        <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-[var(--color-brand-primary)]" aria-hidden />
      ) : null}
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
    <aside className="hidden lg:flex lg:w-[17.5rem] lg:flex-col lg:border-r lg:border-[var(--md-outline-variant)] lg:bg-[var(--md-surface)]">
      <div className="border-b border-[var(--md-outline-variant)] px-5 py-6">
        <Logo href="/cco" priority />
        <ProductLabel className="mt-4" />
        <div className="mt-4 rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] px-3 py-2.5">
          <p className="md-title-md truncate text-[var(--md-on-surface)]">{userName}</p>
          <p className="md-body-md mt-0.5 truncate text-[var(--md-on-surface-variant)]">
            {userRoles.join(' · ')}
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Navegação principal">
        {items.map((item) => (
          <NavLink key={item.id} item={item} active={pathname.startsWith(item.href)} />
        ))}
      </nav>

      <div className="border-t border-[var(--md-outline-variant)] p-4">
        <Button
          variant="tonal"
          className="w-full justify-start"
          onClick={() => {
            logout();
            window.location.href = '/login?reason=logout';
          }}
        >
          <LogOut className="h-5 w-5" />
          Sair
        </Button>
      </div>
    </aside>
  );
}

export function MobileAppBar({ userName }: { userName: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--md-outline-variant)] bg-[var(--md-surface)]/95 backdrop-blur-md lg:hidden">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Logo variant="mark" href="/cco" />
          <div className="min-w-0">
            <ProductLabel />
            <p className="md-body-md mt-0.5 truncate text-[var(--md-on-surface-variant)]">{userName}</p>
          </div>
        </div>
        <span className="inline-flex min-h-8 items-center rounded-[var(--md-shape-full)] bg-[var(--color-brand-accent-subtle)] px-3 md-label-md font-medium text-[var(--color-brand-accent)]">
          Online
        </span>
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
  const slotCount = hasMore ? 4 : Math.max(primary.length, 1);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--md-outline-variant)] bg-[var(--md-surface)]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-md lg:hidden"
        aria-label="Navegação mobile"
      >
        <div
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
        >
          {primary.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  'relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-[var(--md-shape-lg)] px-1 md-label-md font-medium transition-all duration-[var(--md-duration-short)]',
                  active
                    ? 'text-[var(--color-brand-primary)]'
                    : 'text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container-low)]',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {active ? (
                  <span className="absolute inset-x-3 top-1 h-8 rounded-[var(--md-shape-full)] bg-[var(--color-brand-primary-subtle)]" aria-hidden />
                ) : null}
                <Icon className="relative h-6 w-6" />
                <span className="relative max-w-full truncate">{item.shortLabel ?? item.label}</span>
              </Link>
            );
          })}

          {hasMore ? (
            <button
              type="button"
              onClick={() => onMoreOpen(true)}
              className={cn(
                'relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-[var(--md-shape-lg)] px-1 md-label-md font-medium transition-all duration-[var(--md-duration-short)]',
                moreOpen
                  ? 'text-[var(--color-brand-primary)]'
                  : 'text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container-low)]',
              )}
              aria-label="Abrir mais opções"
            >
              {moreOpen ? (
                <span className="absolute inset-x-3 top-1 h-8 rounded-[var(--md-shape-full)] bg-[var(--color-brand-primary-subtle)]" aria-hidden />
              ) : null}
              <MoreIcon className="relative h-6 w-6" />
              <span className="relative">Mais</span>
            </button>
          ) : null}
        </div>
      </nav>

      <Sheet open={moreOpen} onClose={() => onMoreOpen(false)} title="Mais opções">
        <div className="space-y-1">
          {secondary.map((item) => (
            <NavLink
              key={item.id}
              item={item}
              active={pathname.startsWith(item.href)}
              onClick={() => onMoreOpen(false)}
            />
          ))}
          <Button
            variant="tonal"
            className="mt-4 w-full justify-start"
            onClick={() => {
              logout();
              window.location.href = '/login?reason=logout';
            }}
          >
            <LogOut className="h-5 w-5" />
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
    <div className="gestop-app flex min-h-screen bg-[var(--md-surface-dim)]">
      <DesktopSidebar userName={userName} userRoles={userRoles} permissions={permissions} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileAppBar userName={userName} />
        <main className="gestop-main flex-1 overflow-x-hidden">{children}</main>
        <MobileBottomNav permissions={permissions} moreOpen={moreOpen} onMoreOpen={setMoreOpen} />
      </div>
    </div>
  );
}
