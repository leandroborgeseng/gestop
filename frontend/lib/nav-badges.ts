import type { AlertasOperacionais, OperacionalResumo } from '@/lib/types';

export type NavBadgeKey = 'chamados' | 'integracoes';

export type NavBadges = Partial<Record<NavBadgeKey, number>>;

export function buildNavBadges(
  resumo: OperacionalResumo | null,
  alertas: AlertasOperacionais | null,
  permissions: string[],
): NavBadges {
  const badges: NavBadges = {};

  if (permissions.includes('chamados.gerenciar') || permissions.includes('dashboard.visualizar')) {
    const chamados =
      (alertas?.resumo.chamadosSemTriagem ?? 0) +
      (alertas?.resumo.chamadosUrgentes ?? 0) +
      (resumo?.chamadosAbertos ?? 0);
    if (chamados > 0) badges.chamados = chamados;
  }

  if (permissions.includes('auditoria.visualizar') || permissions.includes('dashboard.visualizar')) {
    const falhas = (alertas?.resumo.syncFalhas ?? 0) + (resumo?.eventosSyncPendentes ?? 0);
    if (falhas > 0) badges.integracoes = falhas;
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
