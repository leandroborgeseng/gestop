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
          ? 'bg-zinc-900 text-white shadow-sm'
          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950',
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
    <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-zinc-200/80 lg:bg-white/80 lg:backdrop-blur-xl">
      <div className="border-b border-zinc-100 px-5 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">GestOP</p>
        <h1 className="mt-2 text-lg font-semibold tracking-tight text-zinc-950">Central Operacional</h1>
        <p className="mt-1 text-sm text-zinc-500">{userName}</p>
        <p className="text-xs text-zinc-400">{userRoles.join(' · ')}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-4" aria-label="Navegação principal">
        {items.map((item) => (
          <NavLink key={item.id} item={item} active={pathname.startsWith(item.href)} />
        ))}
      </nav>

      <div className="border-t border-zinc-100 p-4">
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
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/85 px-4 py-3 backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">GestOP</p>
          <p className="truncate text-sm font-medium text-zinc-950">{userName}</p>
        </div>
        <div className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/10">
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
        className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200/80 bg-white/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"
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
                  active ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950',
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
                moreOpen ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950',
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
    <div className="gestop-app flex min-h-screen bg-zinc-50">
      <DesktopSidebar userName={userName} userRoles={userRoles} permissions={permissions} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader userName={userName} />
        <main className="gestop-main flex-1">{children}</main>
        <MobileBottomNav permissions={permissions} moreOpen={moreOpen} onMoreOpen={setMoreOpen} />
      </div>
    </div>
  );
}
