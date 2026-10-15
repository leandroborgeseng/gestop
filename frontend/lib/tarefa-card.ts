import type { ChamadoMapPoint } from './types';
import {
  TAREFA_PRIORIDADE_LABEL,
  TAREFA_STATUS_LABEL,
  resumoDoChamado,
  tarefaExecucaoToMapPoint,
  type ChamadoTarefaResumo,
  type ChamadoTarefaStatus,
} from './chamado-tarefa';

/** 286: variante do Badge por status da tarefa (spec §2.4). */
export const TAREFA_STATUS_BADGE: Record<ChamadoTarefaStatus, 'neutral' | 'info' | 'warning' | 'ok'> = {
  NOVA: 'neutral',
  VISUALIZADA: 'info',
  EM_ANDAMENTO: 'warning',
  IMPEDIDA: 'warning',
  CONCLUIDA: 'ok',
  CANCELADA: 'neutral',
};

/** 286: "Tipo - Subtipo" quando houver tipo; senão o resumo do chamado. */
export function resumoTipoTarefa(item: Pick<ChamadoTarefaResumo, 'chamado'>) {
  return item.chamado.tipoChamado?.nome?.trim() || resumoDoChamado(item.chamado);
}

/** 286: coordenada da tarefa → do chamado → nenhuma (decisão 14/10: a tarefa usa a do chamado). */
export function coordenadaTarefa(item: Pick<ChamadoTarefaResumo, 'chamado'> & { latitude?: number | null; longitude?: number | null }) {
  if (item.latitude != null && item.longitude != null) return { latitude: item.latitude, longitude: item.longitude, origem: 'tarefa' as const };
  if (item.chamado.latitude != null && item.chamado.longitude != null) {
    return { latitude: item.chamado.latitude, longitude: item.chamado.longitude, origem: 'chamado' as const };
  }
  return null;
}

function diaLocal(iso: string) {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

export type PrazoTarefa = { texto: string; tom: 'danger' | 'warning' | 'neutral' | 'success'; diasAtraso: number | null };

/** 286: texto/tom do prazo; atraso diz os dias (não depende só da cor); encerradas mostram a data de encerramento. */
export function prazoTarefaInfo(
  item: Pick<ChamadoTarefaResumo, 'prazo' | 'status' | 'atrasada' | 'concluidaEm'>,
  hoje: Date = new Date(),
): PrazoTarefa {
  const ref = new Date(hoje);
  ref.setHours(0, 0, 0, 0);
  if (item.status === 'CONCLUIDA' || item.status === 'CANCELADA') {
    const quando = item.concluidaEm ? diaLocal(item.concluidaEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;
    const rotulo = item.status === 'CONCLUIDA' ? 'Concluída' : 'Cancelada';
    return { texto: quando ? `${rotulo} em ${quando}` : rotulo, tom: item.status === 'CONCLUIDA' ? 'success' : 'neutral', diasAtraso: null };
  }
  if (!item.prazo) return { texto: 'Sem prazo', tom: 'neutral', diasAtraso: null };
  const prazo = diaLocal(item.prazo);
  const dias = Math.round((prazo.getTime() - ref.getTime()) / 86_400_000);
  const data = prazo.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  if (item.atrasada || dias < 0) {
    const n = Math.max(1, Math.abs(Math.min(dias, -1)));
    return { texto: `Prazo ${data} · atrasada ${n} dia${n > 1 ? 's' : ''}`, tom: 'danger', diasAtraso: n };
  }
  if (dias === 0) return { texto: `Prazo ${data} · vence hoje`, tom: 'danger', diasAtraso: null };
  if (dias <= 2) return { texto: `Prazo ${data}`, tom: 'warning', diasAtraso: null };
  return { texto: `Prazo ${data}`, tom: 'neutral', diasAtraso: null };
}

/** 286: aria-label completo do card (spec §5). */
export function tarefaAriaLabel(item: ChamadoTarefaResumo, hoje?: Date) {
  const prazo = prazoTarefaInfo(item, hoje);
  const partes = [
    `Tarefa ${item.titulo}, do chamado ${item.chamado.codigo}, ${resumoTipoTarefa(item)}.`,
    `Status ${TAREFA_STATUS_LABEL[item.status] ?? item.status}, prioridade ${TAREFA_PRIORIDADE_LABEL[item.prioridade] ?? item.prioridade}, ${prazo.texto}.`,
  ];
  if (item.atrasada || prazo.diasAtraso) partes.push('Atrasada.');
  partes.push(
    `Secretaria ${item.secretaria?.sigla ?? 'não informada'}, ${item.equipe ? `equipe ${item.equipe.nome}` : 'sem equipe'}, ${
      item.responsavel ? `responsável ${item.responsavel.nome}` : 'sem responsável'
    }.`,
  );
  if (!coordenadaTarefa(item)) partes.push('Sem localização.');
  return partes.join(' ');
}

export type PinTarefas = ChamadoMapPoint & { tarefaIds: string[]; contagem: number };

/** 286: tarefas no mesmo ponto viram um pin só, com contador (decisão 14/10). */
export function agruparPinsTarefas(items: ChamadoTarefaResumo[]): PinTarefas[] {
  const porChave = new Map<string, PinTarefas>();
  for (const item of items) {
    const base = tarefaExecucaoToMapPoint(item);
    if (!base) continue;
    const chave = `${base.latitude.toFixed(6)},${base.longitude.toFixed(6)}`;
    const atual = porChave.get(chave);
    if (atual) {
      atual.tarefaIds.push(item.id);
      atual.contagem += 1;
      atual.titulo = `${atual.contagem} tarefas neste local`;
    } else {
      porChave.set(chave, { ...base, tarefaIds: [item.id], contagem: 1 });
    }
  }
  return [...porChave.values()];
}

/** 286: id do pin que contém a tarefa (para destacar o pin agrupado). */
export function pinDaTarefa(pins: PinTarefas[], tarefaId: string | null) {
  if (!tarefaId) return null;
  return pins.find((pin) => pin.tarefaIds.includes(tarefaId))?.id ?? null;
}

/** 286: busca local (título, código, resumo, Secretaria, equipe, responsável). Não altera filtros nem contadores. */
export function filtrarTarefasBusca(items: ChamadoTarefaResumo[], termo: string) {
  const q = termo.trim().toLocaleLowerCase('pt-BR');
  if (!q) return items;
  return items.filter((item) =>
    [
      item.titulo,
      item.chamado.codigo,
      resumoTipoTarefa(item),
      resumoDoChamado(item.chamado),
      item.secretaria?.sigla,
      item.secretaria?.nome,
      item.equipe?.nome,
      item.responsavel?.nome,
    ]
      .filter(Boolean)
      .some((campo) => String(campo).toLocaleLowerCase('pt-BR').includes(q)),
  );
}

export type FiltrosTarefasExecucaoEstado = {
  status: string;
  atribuidaAMim: boolean;
  minhasEquipes: boolean;
  atrasadas: boolean;
  historico: boolean;
  prazoFrom: string;
  prazoTo: string;
  secretariaId: string;
  equipeId: string;
  responsavelId: string;
  tipoChamadoId: string;
  prioridade: string;
};

/** 286: parâmetros da API extraídos sem mudança do inline anterior (regressão do critério 11). */
export function montarParametrosTarefasExecucao(f: FiltrosTarefasExecucaoEstado) {
  return {
    status: f.status || undefined,
    atribuidaAMim: f.atribuidaAMim ? '1' : undefined,
    minhasEquipes: f.minhasEquipes ? '1' : undefined,
    atrasadas: f.atrasadas ? '1' : undefined,
    historico: f.historico ? '1' : undefined,
    prazoFrom: f.prazoFrom ? new Date(f.prazoFrom).toISOString() : undefined,
    prazoTo: f.prazoTo ? new Date(f.prazoTo).toISOString() : undefined,
    secretariaId: f.secretariaId || undefined,
    equipeId: f.equipeId || undefined,
    responsavelId: f.responsavelId || undefined,
    tipoChamadoId: f.tipoChamadoId || undefined,
    prioridade: f.prioridade || undefined,
  };
}

/** WCAG 2.x: razão de contraste entre duas cores #rrggbb. */
export function razaoContraste(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
