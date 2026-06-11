import type { AlertasOperacionais, OperacionalResumo } from '@/lib/types';

export type NavBadgeKey = 'chamados' | 'integracoes';

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

export function resolveGlobalSearchRoute(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return '/cco';

  const upper = trimmed.toUpperCase();
  if (upper.startsWith('CH-') || upper.startsWith('CH') || upper.startsWith('OS-') || upper.startsWith('OS')) {
    return `/chamados?search=${encodeURIComponent(trimmed)}`;
  }

  return `/cco?search=${encodeURIComponent(trimmed)}`;
}
