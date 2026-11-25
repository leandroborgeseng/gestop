import type { ChamadosFiltrosValue } from '@/components/chamados/chamados-filtros-panel';
import type { AtribuicaoFilter, SlaFilter } from '@/lib/chamado-filtros';
import { DIAS_ABERTURA_RAPIDOS, type DiasAberturaRapido, type FiltroDataAberturaValue } from '@/lib/filtro-data-abertura';
import type { ChamadoStatus } from '@/lib/types';
import {
  dataIsoValida,
  definirParam,
  enumUrl,
  enumsUrl,
  flagUrl,
  hojeIso,
  idUrl,
  inicioSemanaIso,
  inteiroUrl,
  mesAtualIso,
  mesIsoValido,
} from '@/lib/estado-url';

const STATUS: ChamadoStatus[] = [
  'ABERTO',
  'EM_TRIAGEM',
  'EM_AVALIACAO_TECNICA',
  'EM_ATENDIMENTO',
  'EM_EXECUCAO',
  'IMPEDIDO',
  'CONCLUIDO',
  'CANCELADO',
];

const PRIORIDADES = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'] as const;
const SLAS = ['DENTRO', 'FORA', 'SEM'] as const;
const ATRIBUICOES = ['MIM', 'MINHA_EQUIPE'] as const;
const POR_PAGINA = [50, 100, 200, 500, 1000] as const;

const ATRIBUICAO_URL: Record<string, AtribuicaoFilter> = {
  mim: 'MIM',
  minha_equipe: 'MINHA_EQUIPE',
};

export type EstadoChamados = {
  aba: 'triagem' | 'programacao';
  search: string;
  id: string | null;
  statuses: Set<ChamadoStatus> | 'TODOS';
  prioridade: 'TODAS' | (typeof PRIORIDADES)[number];
  sla: SlaFilter;
  atribuicao: AtribuicaoFilter;
  equipeId: string;
  secProprio: string;
  secExecucao: string;
  tipo: string;
  abertura: FiltroDataAberturaValue;
  excluidos: boolean;
  pagina: number;
  porPagina: number | 'todos';
  visao: 'mensal' | 'semanal';
  mes: string | null;
  semana: string | null;
  dia: string | null;
};

export function estadoChamadosPadrao(): EstadoChamados {
  return {
    aba: 'triagem',
    search: '',
    id: null,
    statuses: 'TODOS',
    prioridade: 'TODAS',
    sla: 'TODOS',
    atribuicao: 'TODOS',
    equipeId: '',
    secProprio: '',
    secExecucao: '',
    tipo: '',
    abertura: {},
    excluidos: false,
    pagina: 1,
    porPagina: 50,
    visao: 'mensal',
    mes: null,
    semana: null,
    dia: null,
  };
}

function lerAbertura(sp: URLSearchParams): FiltroDataAberturaValue {
  const rapido = /^(\d+)d$/.exec(sp.get('abertura')?.trim() ?? '');
  if (rapido) {
    const dias = Number(rapido[1]);
    if ((DIAS_ABERTURA_RAPIDOS as readonly number[]).includes(dias)) {
      return { rapido: dias as DiasAberturaRapido };
    }
  }
  const de = dataIsoValida(sp.get('aberturaDe'));
  const ate = dataIsoValida(sp.get('aberturaAte'));
  return { ...(de ? { de } : {}), ...(ate ? { ate } : {}) };
}

export function lerEstadoChamados(sp: URLSearchParams, agora = new Date()): { estado: EstadoChamados; canonico: URLSearchParams } {
  const statuses = enumsUrl(sp.get('status'), STATUS);
  const prioridade = enumUrl(sp.get('prioridade'), PRIORIDADES);
  const sla = enumUrl(sp.get('sla'), SLAS);
  const atribuicaoBruta = sp.get('atribuicao')?.trim().toLowerCase() ?? '';
  const atribuicao = ATRIBUICAO_URL[atribuicaoBruta] ?? 'TODOS';
  const porPaginaBruto = sp.get('porPagina')?.trim().toLowerCase() ?? '';
  const porPaginaNumero = POR_PAGINA.find((item) => String(item) === porPaginaBruto);
  const mes = mesIsoValido(sp.get('mes'));
  const semana = dataIsoValida(sp.get('semana'));
  const dia = dataIsoValida(sp.get('dia'));
  const hoje = hojeIso(agora);
  const mesAtual = mesAtualIso(agora);
  const semanaAtual = inicioSemanaIso(agora);

  const estado: EstadoChamados = {
    aba: sp.get('aba') === 'programacao' ? 'programacao' : 'triagem',
    search: sp.get('search')?.trim() ?? '',
    id: idUrl(sp.get('id')),
    statuses: statuses.length ? new Set(statuses) : 'TODOS',
    prioridade: prioridade ?? 'TODAS',
    sla: sla ?? 'TODOS',
    atribuicao,
    equipeId: idUrl(sp.get('equipe')) ?? (sp.get('equipe') === 'sem-equipe' ? 'sem-equipe' : ''),
    secProprio: idUrl(sp.get('secProprio')) ?? '',
    secExecucao: idUrl(sp.get('secExecucao')) ?? '',
    tipo: idUrl(sp.get('tipo')) ?? '',
    abertura: lerAbertura(sp),
    excluidos: flagUrl(sp.get('excluidos')),
    pagina: inteiroUrl(sp.get('pagina'), 1) ?? 1,
    porPagina: porPaginaBruto === 'todos' ? 'todos' : (porPaginaNumero ?? 50),
    visao: sp.get('visao') === 'semanal' ? 'semanal' : 'mensal',
    mes: mes && mes !== mesAtual ? mes : null,
    semana: semana && semana !== semanaAtual ? semana : null,
    dia: dia && dia !== hoje ? dia : null,
  };
  return { estado, canonico: serializarEstadoChamados(estado, agora) };
}

export function serializarEstadoChamados(estado: EstadoChamados, agora = new Date()) {
  const params = new URLSearchParams();
  if (estado.aba === 'programacao') params.set('aba', 'programacao');
  definirParam(params, 'search', estado.search.trim());
  definirParam(params, 'id', estado.id);
  if (estado.statuses !== 'TODOS' && estado.statuses.size > 0) {
    const ordem = STATUS.filter((item) => estado.statuses !== 'TODOS' && estado.statuses.has(item));
    params.set('status', ordem.map((item) => item.toLowerCase()).join(','));
  }
  if (estado.prioridade !== 'TODAS') params.set('prioridade', estado.prioridade.toLowerCase());
  if (estado.sla !== 'TODOS') params.set('sla', estado.sla.toLowerCase());
  if (estado.atribuicao === 'MIM') params.set('atribuicao', 'mim');
  else if (estado.atribuicao === 'MINHA_EQUIPE') params.set('atribuicao', 'minha_equipe');
  definirParam(params, 'equipe', estado.equipeId);
  definirParam(params, 'secProprio', estado.secProprio);
  definirParam(params, 'secExecucao', estado.secExecucao);
  definirParam(params, 'tipo', estado.tipo);
  if (estado.abertura.rapido) params.set('abertura', `${estado.abertura.rapido}d`);
  else {
    definirParam(params, 'aberturaDe', dataIsoValida(estado.abertura.de));
    definirParam(params, 'aberturaAte', dataIsoValida(estado.abertura.ate));
  }
  if (estado.excluidos) params.set('excluidos', '1');
  if (estado.pagina > 1) params.set('pagina', String(estado.pagina));
  if (estado.porPagina === 'todos') params.set('porPagina', 'todos');
  else if (estado.porPagina !== 50) params.set('porPagina', String(estado.porPagina));
  if (estado.visao === 'semanal') params.set('visao', 'semanal');
  const mes = estado.mes && estado.mes !== mesAtualIso(agora) ? mesIsoValido(estado.mes) : null;
  definirParam(params, 'mes', mes);
  if (estado.visao === 'semanal') {
    const semana = estado.semana && estado.semana !== inicioSemanaIso(agora) ? dataIsoValida(estado.semana) : null;
    definirParam(params, 'semana', semana);
  }
  const dia = estado.dia && estado.dia !== hojeIso(agora) ? dataIsoValida(estado.dia) : null;
  definirParam(params, 'dia', dia);
  return params;
}

export function filtrosDeEstado(estado: EstadoChamados, comAbertura: boolean): ChamadosFiltrosValue {
  const base: ChamadosFiltrosValue = {
    statuses: estado.statuses,
    prioridade: estado.prioridade,
    sla: estado.sla,
    atribuicao: estado.atribuicao,
    equipeId: estado.equipeId,
    secretariaProprioId: estado.secProprio,
    secretariaExecucaoId: estado.secExecucao,
    tipoChamadoId: estado.tipo,
  };
  if (!comAbertura) return base;
  return { ...base, abertura: estado.abertura };
}

/** Traduz a sanfona para a query. Não mexe na abertura quando a sanfona não a tem (Programação). */
export function patchDeFiltros(value: ChamadosFiltrosValue): Partial<EstadoChamados> {
  const patch: Partial<EstadoChamados> = {
    statuses: value.statuses,
    prioridade: value.prioridade === 'BAIXA' || value.prioridade === 'MEDIA' || value.prioridade === 'ALTA' || value.prioridade === 'URGENTE' ? value.prioridade : 'TODAS',
    sla: value.sla,
    atribuicao: value.atribuicao,
    equipeId: value.equipeId,
    secProprio: value.secretariaProprioId,
    secExecucao: value.secretariaExecucaoId,
    tipo: value.tipoChamadoId,
    pagina: 1,
  };
  if (value.abertura) patch.abertura = value.abertura;
  return patch;
}

export function patchLimparFiltros(): Partial<EstadoChamados> {
  return {
    statuses: 'TODOS',
    prioridade: 'TODAS',
    sla: 'TODOS',
    atribuicao: 'TODOS',
    equipeId: '',
    secProprio: '',
    secExecucao: '',
    tipo: '',
    abertura: {},
    pagina: 1,
  };
}
