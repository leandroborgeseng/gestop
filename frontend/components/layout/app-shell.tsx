'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  KeyRound,
  LogOut,
  RefreshCw,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { getAlertasOperacionais, getResumoOperacional, logout } from '@/lib/api';
import { buildNavBadges, resolveGlobalSearchRoute, type NavBadges } from '@/lib/nav-badges';
import {
  getGroupedNavItems,
  getMobileNav,
  getVisibleNavItems,
  isNavActive,
  MORE_NAV_ICON,
  type NavItem,
} from '@/lib/navigation';
import { useGuide } from '@/components/help/guide-provider';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';

function NavLink({
  item,
  active,
  compact = false,
  collapsed = false,
  badge,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  compact?: boolean;
  collapsed?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      prefetch
      onClick={onClick}
      title={item.label}
      className={cn(
        'relative mb-0.5 flex w-full items-center gap-[11px] rounded-[var(--r-md)] px-2.5 py-2 text-[13.5px] font-medium transition-colors',
        active
          ? 'bg-[var(--brand-soft)] font-semibold text-[var(--brand-hover)]'
          : 'text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
        compact && 'min-h-11 flex-col justify-center gap-1 px-2 py-2 text-xs',
        collapsed && !compact && 'justify-center px-0 py-2.5',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {active && !compact && !collapsed ? (
        <span
          className="absolute top-1/2 -left-3 h-5 w-[3px] -translate-y-1/2 rounded-r bg-[var(--brand)]"
          aria-hidden
        />
      ) : null}
      <span className="relative shrink-0">
        <Icon className={cn(compact ? 'h-6 w-6' : 'h-[19px] w-[19px]')} strokeWidth={active ? 2.2 : 1.9} />
        {badge != null && badge > 0 ? (
          <span className="mono absolute -top-1.5 -right-2 flex h-[15px] min-w-[15px] items-center justify-center rounded-[var(--r-pill)] bg-[var(--warn)] px-1 text-[9px] font-bold text-white">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </span>
      {!collapsed || compact ? (
        <span className={cn('truncate', compact && 'max-w-full')}>
          {compact ? item.shortLabel ?? item.label : item.label}
        </span>
      ) : null}
    </Link>
  );
}

function DesktopSidebar({
  userName,
  userRoles,
  permissions,
  collapsed,
  badges,
  onToggleCollapsed,
}: {
  userName: string;
  userRoles: string[];
  permissions: string[];
  collapsed: boolean;
  badges: NavBadges;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const groups = getGroupedNavItems(permissions);
  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)] transition-[width] duration-[220ms] lg:flex',
        collapsed ? 'w-[var(--sb-w-collapsed)]' : 'w-[var(--sb-w)]',
      )}
    >
      <div
        className={cn(
          'flex h-[var(--topbar-h)] shrink-0 items-center border-b border-[var(--line-2)]',
          collapsed ? 'flex-col justify-center gap-2 py-3' : 'gap-2.5 px-3.5 pl-4',
        )}
      >
        <div className={cn('flex min-w-0 items-center gap-2.5', collapsed ? 'justify-center' : 'flex-1')}>
          <Image src="/franca-mark.png" alt="Prefeitura de Franca" width={30} height={36} className="h-9 w-[30px] object-contain" priority />
          {!collapsed ? (
            <div className="min-w-0 leading-tight">
              <div className="text-[17px] font-bold tracking-[-0.02em] text-[var(--ink)]">GestOP</div>
              <div className="text-[11px] font-medium text-[var(--ink-3)]">Central Operacional</div>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Navegação principal">
        {groups.map((group) => (
          <div key={group.title} className="mb-4">
            {!collapsed ? (
              <div className="px-2.5 pb-2 text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[var(--ink-4)]">
                {group.title}
              </div>
            ) : (
              <div className="pb-1 text-center text-[9px] tracking-widest text-[var(--ink-4)]" aria-hidden>
                •••
              </div>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.id}
                item={item}
                active={isNavActive(pathname, item.href)}
                collapsed={collapsed}
                badge={item.badgeKey ? badges[item.badgeKey] : undefined}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--line-2)] p-3">
        {!collapsed ? (
          <div className="mb-2 flex items-center gap-2.5 rounded-[var(--r-md)] px-2 py-1.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)] to-[var(--brand-bright)] text-[11px] font-bold text-white">
              {initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-[var(--ink)]">{userName}</span>
              <span className="block truncate text-[11px] text-[var(--ink-3)]">{userRoles[0] ?? 'Usuário'}</span>
            </span>
          </div>
        ) : null}
        <Link
          href="/conta"
          className={cn(
            'mb-1 flex min-h-10 w-full items-center gap-2 rounded-[var(--r-md)] px-2.5 text-[13px] font-medium text-[var(--ink-2)] hover:bg-[var(--surface-2)]',
            collapsed && 'justify-center px-0',
          )}
        >
          <KeyRound className="h-[19px] w-[19px] shrink-0" />
          {!collapsed ? 'Minha conta' : null}
        </Link>
        <button
          type="button"
          onClick={() => {
            logout();
            window.location.href = '/login?reason=logout';
          }}
          className={cn(
            'flex min-h-10 w-full items-center gap-2 rounded-[var(--r-md)] px-2.5 text-[13px] font-medium text-[var(--ink-3)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]',
            collapsed && 'justify-center px-0',
          )}
        >
          <LogOut className="h-[19px] w-[19px] shrink-0" />
          {!collapsed ? 'Sair' : null}
        </button>
      </div>
    </aside>
  );
}

function DesktopTopbar({ syncPending }: { syncPending: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const { openGuide } = useGuide();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function submitSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(resolveGlobalSearchRoute(trimmed));
  }

  useEffect(() => {
    if (pathname.startsWith('/cco') || pathname.startsWith('/chamados') || pathname.startsWith('/ordens-servico')) {
      return;
    }
    setQuery('');
  }, [pathname]);

  return (
    <header className="hidden h-[var(--topbar-h)] shrink-0 items-center gap-4 border-b border-[var(--line)] bg-[var(--surface)] px-[var(--content-px)] lg:flex">
      <div className="flex h-[38px] max-w-[440px] flex-1 items-center gap-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] px-3 focus-within:border-[var(--brand)] focus-within:bg-[var(--surface)] focus-within:shadow-[0_0_0_3px_var(--brand-soft)]">
        <Search className="h-[17px] w-[17px] shrink-0 text-[var(--ink-3)]" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submitSearch();
          }}
          placeholder="Buscar unidade, CH-…"
          className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-4)]"
        />
        <kbd className="mono hidden rounded border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] text-[var(--ink-3)] sm:inline">
          /
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <button
          type="button"
          onClick={openGuide}
          className="flex h-8 items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[12.5px] font-semibold text-[var(--ink-2)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
        >
          <FileText className="h-4 w-4 text-[var(--brand)]" />
          Guia
          <kbd className="mono rounded border border-[var(--line)] bg-[var(--surface-2)] px-1 text-[10.5px] text-[var(--ink-3)]">
            ?
          </kbd>
        </button>

        {syncPending > 0 ? (
          <div className="flex h-[30px] items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--warn-bd)] bg-[var(--warn-bg)] px-2.5 text-xs font-semibold text-[var(--warn)]">
            <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-[var(--warn)]" />
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="mono">{syncPending}</span>
            <span className="hidden xl:inline">sync pendentes</span>
          </div>
        ) : null}

        <div className="flex h-[30px] items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--ok-bd)] bg-[var(--ok-bg)] px-2.5 text-xs font-semibold text-[var(--ok)]">
          <span className="h-[7px] w-[7px] rounded-full bg-[var(--ok)]" />
          Online
        </div>
      </div>
    </header>
  );
}

export function MobileAppBar({ userName, syncPending }: { userName: string; syncPending: number }) {
  const { openGuide } = useGuide();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-md lg:hidden">
      <div className="flex min-h-[58px] items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/franca-mark.png" alt="" width={28} height={34} className="h-8 w-7 object-contain" />
          <div className="min-w-0 border-l border-[var(--line-2)] pl-3">
            <p className="text-sm font-bold text-[var(--ink)]">GestOP</p>
            <p className="truncate text-xs text-[var(--ink-3)]">{userName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Abrir guia"
            onClick={openGuide}
            className="flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] border border-[var(--line)] text-[var(--brand)]"
          >
            <FileText className="h-4 w-4" />
          </button>
          <span className="inline-flex h-7 items-center rounded-[var(--r-pill)] border border-[var(--ok-bd)] bg-[var(--ok-bg)] px-2 text-[11px] font-semibold text-[var(--ok)]">
            Online
          </span>
          {syncPending > 0 ? (
            <span className="mono inline-flex h-7 min-w-7 items-center justify-center rounded-[var(--r-pill)] bg-[var(--warn-bg)] px-2 text-[11px] font-bold text-[var(--warn)]">
              {syncPending}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav({
  permissions,
  badges,
  moreOpen,
  onMoreOpen,
}: {
  permissions: string[];
  badges: NavBadges;
  moreOpen: boolean;
  onMoreOpen: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const { openGuide } = useGuide();
  const { primary, secondary, hasMore } = getMobileNav(permissions);
  const MoreIcon = MORE_NAV_ICON;
  const slotCount = hasMore ? primary.length + 1 : primary.length;

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--surface)]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-md lg:hidden"
        aria-label="Navegação mobile"
      >
        <div
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `repeat(${Math.max(slotCount, 1)}, minmax(0, 1fr))` }}
        >
          {primary.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);
            const badge = item.badgeKey ? badges[item.badgeKey] : undefined;

            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch
                className={cn(
                  'relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-[var(--r-md)] px-1 text-xs font-medium',
                  active ? 'text-[var(--brand)]' : 'text-[var(--ink-3)]',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {active ? (
                  <span className="pointer-events-none absolute inset-x-3 top-1 h-8 rounded-full bg-[var(--brand-soft)]" aria-hidden />
                ) : null}
                <span className="relative z-[1]">
                  <Icon className="h-6 w-6" />
                  {badge != null && badge > 0 ? (
                    <span className="mono absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--warn)] px-1 text-[9px] font-bold text-white">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  ) : null}
                </span>
                <span className="relative z-[1] max-w-full truncate">{item.shortLabel ?? item.label}</span>
              </Link>
            );
          })}

          {hasMore ? (
            <button
              type="button"
              onClick={() => onMoreOpen(true)}
              className={cn(
                'relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-[var(--r-md)] px-1 text-xs font-medium',
                moreOpen ? 'text-[var(--brand)]' : 'text-[var(--ink-3)]',
              )}
              aria-label="Abrir mais opções"
            >
              <MoreIcon className="relative z-[1] h-6 w-6" />
              <span className="relative z-[1]">Mais</span>
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
              active={isNavActive(pathname, item.href)}
              badge={item.badgeKey ? badges[item.badgeKey] : undefined}
              onClick={() => onMoreOpen(false)}
            />
          ))}
          <button
            type="button"
            onClick={openGuide}
            className="flex w-full items-center gap-3 rounded-[var(--r-md)] px-4 py-2.5 text-[13.5px] font-medium text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
          >
            <FileText className="h-5 w-5 text-[var(--brand)]" />
            Guia do sistema
          </button>
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
  const [collapsed, setCollapsed] = useState(false);
  const [syncPending, setSyncPending] = useState(0);
  const [navBadges, setNavBadges] = useState<NavBadges>({});

  useEffect(() => {
    Promise.all([
      getResumoOperacional().catch(() => null),
      getAlertasOperacionais().catch(() => null),
    ]).then(([resumo, alertas]) => {
      if (resumo) setSyncPending(resumo.eventosSyncPendentes ?? 0);
      setNavBadges(buildNavBadges(resumo, alertas, permissions));
    });
  }, [permissions]);

  return (
    <div className="gestop-app flex min-h-dvh bg-[var(--canvas)]">
      <DesktopSidebar
        userName={userName}
        userRoles={userRoles}
        permissions={permissions}
        collapsed={collapsed}
        badges={navBadges}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileAppBar userName={userName} syncPending={syncPending} />
        <DesktopTopbar syncPending={syncPending} />
        <main className="gestop-main relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
        <MobileBottomNav permissions={permissions} badges={navBadges} moreOpen={moreOpen} onMoreOpen={setMoreOpen} />
      </div>
    </div>
  );
}
