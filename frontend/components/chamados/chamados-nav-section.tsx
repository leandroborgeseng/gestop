'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown, Megaphone } from 'lucide-react';
import { cn } from '@/lib/cn';
import { listChamadosEmExecucao } from '@/lib/api';
import { isChamadosSectionActive, isNavActive, type NavItem } from '@/lib/navigation';

export function ChamadosNavSection({
  item,
  collapsed,
  badge,
}: {
  item: NavItem;
  collapsed: boolean;
  badge?: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeEquipe = searchParams.get('equipe');
  const sectionActive = isChamadosSectionActive(pathname);
  const [open, setOpen] = useState(sectionActive);
  const [execOpen, setExecOpen] = useState(pathname.startsWith('/chamados/em-execucao'));
  const [execTotal, setExecTotal] = useState(0);
  const [grupos, setGrupos] = useState<Array<{ key: string; label: string; count: number }>>([]);

  useEffect(() => {
    if (sectionActive) setOpen(true);
    if (pathname.startsWith('/chamados/em-execucao')) setExecOpen(true);
  }, [pathname, sectionActive]);

  useEffect(() => {
    let active = true;
    listChamadosEmExecucao()
      .then((data) => {
        if (!active) return;
        setExecTotal(data.total);
        setGrupos(
          data.grupos.map((grupo) => ({
            key: grupo.equipe?.id ?? 'sem-equipe',
            label: grupo.equipe?.nome ?? 'Sem equipe',
            count: grupo.chamados.length,
          })),
        );
      })
      .catch(() => {
        if (active) {
          setExecTotal(0);
          setGrupos([]);
        }
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  const Icon = item.icon;
  const todosActive = isNavActive(pathname, '/chamados');
  const execucaoActive = pathname.startsWith('/chamados/em-execucao');

  const subLinkClass = (active: boolean) =>
    cn(
      'mb-0.5 flex w-full items-center justify-between gap-2 rounded-[var(--r-md)] py-1.5 pr-2.5 text-[12.5px] font-medium transition-colors',
      active
        ? 'bg-[var(--brand-soft)] font-semibold text-[var(--brand-hover)]'
        : 'text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
    );

  if (collapsed) {
    return (
      <Link
        href="/chamados"
        prefetch
        title={item.label}
        className={cn(
          'relative mb-0.5 flex w-full items-center justify-center rounded-[var(--r-md)] px-0 py-2.5 text-[13.5px] font-medium transition-colors',
          sectionActive
            ? 'bg-[var(--brand-soft)] font-semibold text-[var(--brand-hover)]'
            : 'text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
        )}
        aria-current={sectionActive ? 'page' : undefined}
      >
        <span className="relative shrink-0">
          <Icon className="h-[19px] w-[19px]" strokeWidth={sectionActive ? 2.2 : 1.9} />
          {(badge ?? 0) + execTotal > 0 ? (
            <span className="mono absolute -top-1.5 -right-2 flex h-[15px] min-w-[15px] items-center justify-center rounded-[var(--r-pill)] bg-[var(--warn)] px-1 text-[9px] font-bold text-white">
              {(badge ?? 0) + execTotal > 99 ? '99+' : (badge ?? 0) + execTotal}
            </span>
          ) : null}
        </span>
      </Link>
    );
  }

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'relative flex w-full items-center gap-[11px] rounded-[var(--r-md)] px-2.5 py-2 text-[13.5px] font-medium transition-colors',
          sectionActive
            ? 'bg-[var(--brand-soft)] font-semibold text-[var(--brand-hover)]'
            : 'text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
        )}
        aria-expanded={open}
      >
        {sectionActive ? (
          <span
            className="absolute top-1/2 -left-3 h-5 w-[3px] -translate-y-1/2 rounded-r bg-[var(--brand)]"
            aria-hidden
          />
        ) : null}
        <span className="relative shrink-0">
          <Megaphone className="h-[19px] w-[19px]" strokeWidth={sectionActive ? 2.2 : 1.9} />
          {(badge ?? 0) + execTotal > 0 ? (
            <span className="mono absolute -top-1.5 -right-2 flex h-[15px] min-w-[15px] items-center justify-center rounded-[var(--r-pill)] bg-[var(--warn)] px-1 text-[9px] font-bold text-white">
              {(badge ?? 0) + execTotal > 99 ? '99+' : (badge ?? 0) + execTotal}
            </span>
          ) : null}
        </span>
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="mt-0.5 ml-3 border-l border-[var(--line-2)] pl-2">
          <Link href="/chamados" prefetch className={subLinkClass(todosActive)} aria-current={todosActive ? 'page' : undefined}>
            <span>Todos os chamados</span>
            {badge != null && badge > 0 ? (
              <span className="mono rounded-[var(--r-pill)] bg-[var(--surface-2)] px-1.5 text-[10px]">{badge}</span>
            ) : null}
          </Link>

          <div>
            <button
              type="button"
              onClick={() => setExecOpen((value) => !value)}
              className={cn(subLinkClass(execucaoActive), 'w-full')}
              aria-expanded={execOpen}
            >
              <span className="flex items-center gap-1.5">
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', execOpen && 'rotate-180')} />
                Em execução
              </span>
              {execTotal > 0 ? (
                <span className="mono rounded-[var(--r-pill)] bg-[var(--warn-bg)] px-1.5 text-[10px] text-[var(--warn)]">
                  {execTotal}
                </span>
              ) : null}
            </button>

            {execOpen ? (
              <div className="ml-2 border-l border-[var(--line-2)] pl-2">
                <Link
                  href="/chamados/em-execucao"
                  prefetch
                  className={subLinkClass(execucaoActive && !activeEquipe)}
                  aria-current={execucaoActive && !activeEquipe ? 'page' : undefined}
                >
                  <span>Todas as equipes</span>
                  <span className="mono text-[10px] text-[var(--ink-3)]">{execTotal}</span>
                </Link>
                {grupos.map((grupo) => {
                  const href = `/chamados/em-execucao?equipe=${grupo.key}`;
                  const active = execucaoActive && activeEquipe === grupo.key;
                  return (
                    <Link
                      key={grupo.key}
                      href={href}
                      prefetch
                      className={subLinkClass(active)}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className="truncate">{grupo.label}</span>
                      <span className="mono text-[10px] text-[var(--ink-3)]">{grupo.count}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
