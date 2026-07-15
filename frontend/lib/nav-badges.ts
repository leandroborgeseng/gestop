import type { AlertasOperacionais, OperacionalResumo } from '@/lib/types';
import {
  getDefaultAuthenticatedHref,
  getVisibleNavItems,
  type NavBadgeKey,
} from '@/lib/navigation';

export type { NavBadgeKey };

export type NavBadges = Partial<Record<NavBadgeKey, number>>;

export function buildNavBadges(
  resumo: OperacionalResumo | null,
  _alertas: AlertasOperacionais | null,
  permissions: string[],
): NavBadges {
  const badges: NavBadges = {};

  if (permissions.includes('chamados.gerenciar') || permissions.includes('chamados.executar')) {
    const chamados = resumo?.chamadosAbertos ?? 0;
    if (chamados > 0) badges.chamados = chamados;
  }

  if (permissions.includes('auditoria.visualizar') || permissions.includes('dashboard.visualizar')) {
    const integracoes = resumo?.eventosSyncPendentes ?? 0;
    if (integracoes > 0) badges.integracoes = integracoes;
  }

  return badges;
}

export function resolveGlobalSearchRoute(query: string, permissions: string[] = []): string {
  const trimmed = query.trim();
  const home = getDefaultAuthenticatedHref(permissions);
  if (!trimmed) return home;

  const upper = trimmed.toUpperCase();
  const isChamadoCode =
    upper.startsWith('CH-') || upper.startsWith('CH') || upper.startsWith('OS-') || upper.startsWith('OS');

  const visible = getVisibleNavItems(permissions);
  const canChamados = visible.some((item) => item.id === 'chamados' || item.id === 'execucao');
  const canCco = visible.some((item) => item.id === 'cco');

  if (isChamadoCode && canChamados) {
    return `/chamados?search=${encodeURIComponent(trimmed)}`;
  }

  if (canCco) {
    return `/cco?search=${encodeURIComponent(trimmed)}`;
  }

  if (canChamados) {
    return `/chamados?search=${encodeURIComponent(trimmed)}`;
  }

  return home;
}
