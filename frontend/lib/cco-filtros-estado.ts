/**
 * 299 — Estado único de filtros do CCO (sanfona + painel do mapa).
 *
 * O aplicado continua no `page.tsx` (mesmo estado da sanfona). O painel trabalha com um
 * RASCUNHO (`CcoFiltrosSnapshot`) que só vira aplicado em "Aplicar filtros". Funções puras,
 * para a 298 reaproveitar (o balão de consulta lê o aplicado, nunca o rascunho).
 */
import { CHAMADO_STATUS_NAO_FINALIZADOS } from './chamado-status';
import type { ChamadosMapaFilters, TipoPendencia, UnidadeFilters } from './types';

export type CcoTab = 'proprios' | 'chamados';
export type CcoKpiFilter = 'none' | 'pendencias';

export const DEFAULT_TIPOS_PENDENCIA: TipoPendencia[] = ['CHAMADOS', 'NAO_CONFORMIDADES', 'VISTORIAS'];

/** Primeira entrada, recarga e “Limpar filtros” da aba Chamados. */
export function defaultChamadoFilters(): ChamadosMapaFilters {
  return { status: [...CHAMADO_STATUS_NAO_FINALIZADOS], abertura: {} };
}

/** “Limpar filtros” da aba Próprios (mesmo da sanfona). */
export function defaultUnidadeFilters(): UnidadeFilters {
  return { tiposPendencia: [...DEFAULT_TIPOS_PENDENCIA] };
}

export type CcoFiltrosSnapshot = {
  filters: UnidadeFilters;
  chamadoFilters: ChamadosMapaFilters;
  kpiFilter: CcoKpiFilter;
};

function vazio(v: unknown): boolean {
  if (v == null || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).every(vazio);
  return false;
}

/** Normaliza para comparar (ordem de chaves e de listas, vazios fora). */
function norm(v: unknown): unknown {
  if (Array.isArray(v)) return [...v].map(norm).sort((a, b) => String(a).localeCompare(String(b)));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const val = (v as Record<string, unknown>)[k];
      if (!vazio(val)) out[k] = norm(val);
    }
    return out;
  }
  return typeof v === 'string' ? v.trim() : v;
}

function igual(a: unknown, b: unknown) {
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

export function snapshotsIguais(a: CcoFiltrosSnapshot, b: CcoFiltrosSnapshot) {
  return igual(a.filters, b.filters) && igual(a.chamadoFilters, b.chamadoFilters) && a.kpiFilter === b.kpiFilter;
}

function plural<T>(p: T[] | undefined, s: T | undefined): T[] {
  return p?.length ? p : s ? [s] : [];
}

/**
 * Selo do botão Filtros (UX-299-04): nº de GRUPOS que diferem do padrão do “Limpar” da aba.
 * Busca conta como grupo.
 */
export function contarFiltrosAtivos(tab: CcoTab, s: CcoFiltrosSnapshot): number {
  if (tab === 'chamados') {
    const f = s.chamadoFilters;
    const d = defaultChamadoFilters();
    return [
      !igual(f.status ?? [], d.status),
      !vazio(f.abertura),
      !vazio(f.prioridade),
      !vazio(f.tipoChamadoId),
      !vazio(f.equipeIds),
      !vazio(f.sla),
      plural(f.bairros, f.bairro).length > 0,
      !!f.comUnidade && f.comUnidade !== 'TODOS',
      !vazio(f.search),
    ].filter(Boolean).length;
  }
  const f = s.filters;
  const tipos = f.tiposPendencia?.length ? f.tiposPendencia : DEFAULT_TIPOS_PENDENCIA;
  return [
    s.kpiFilter === 'pendencias' || !vazio(f.situacao),
    !igual(tipos, DEFAULT_TIPOS_PENDENCIA),
    !vazio(f.tiposChamadoId),
    plural(f.secretariaIds, f.secretariaId).length > 0,
    plural(f.bairros, f.bairro).length > 0,
    plural(f.regioes, f.regiao).length > 0,
    plural(f.tipos, f.tipo).length > 0,
    !vazio(f.equipeIds),
    !vazio(f.sla),
    !vazio(f.search),
  ].filter(Boolean).length;
}

/** Limpa só a aba ativa, igual ao “Limpar” da sanfona. */
export function limparSnapshot(tab: CcoTab, s: CcoFiltrosSnapshot): CcoFiltrosSnapshot {
  if (tab === 'chamados') return { ...s, chamadoFilters: defaultChamadoFilters() };
  return { ...s, filters: defaultUnidadeFilters(), kpiFilter: 'none' };
}

/** “14h35” em America/Sao_Paulo (BRT). */
export function formatarHoraBrt(date: Date): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${h}h${m}`;
}

export function formatarNumero(n: number) {
  return n.toLocaleString('pt-BR');
}
