import type { ChamadoTarefaStatus } from '@/lib/chamado-tarefa';
import {
  dataIsoValida,
  definirParam,
  enumUrl,
  flagUrl,
  idUrl,
  idsUrl,
} from '@/lib/estado-url';

const STATUS_TAREFA: ChamadoTarefaStatus[] = ['NOVA', 'VISUALIZADA', 'EM_ANDAMENTO', 'IMPEDIDA', 'CONCLUIDA', 'CANCELADA'];
const PRIORIDADES = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'] as const;

export type EstadoExecucao = {
  aba: 'chamados' | 'tarefas';
  search: string;
  sel: string | null;
  equipes: string[];
  responsaveis: string[];
  hoje: boolean;
  de: string;
  ate: string;
  painelChamados: 'mapa' | 'lista';
  painelTarefas: 'lista' | 'mapa';
  tarefa: string | null;
  status: '' | ChamadoTarefaStatus;
  atrasadas: boolean;
  historico: boolean;
  atribuidaAMim: boolean;
  minhasEquipes: boolean;
  prazoDe: string;
  prazoAte: string;
  secretaria: string;
  equipeTarefa: string;
  responsavelTarefa: string;
  tipo: string;
  prioridade: '' | (typeof PRIORIDADES)[number];
};

export function estadoExecucaoPadrao(): EstadoExecucao {
  return {
    aba: 'chamados',
    search: '',
    sel: null,
    equipes: [],
    responsaveis: [],
    hoje: false,
    de: '',
    ate: '',
    painelChamados: 'mapa',
    painelTarefas: 'lista',
    tarefa: null,
    status: '',
    atrasadas: false,
    historico: false,
    atribuidaAMim: false,
    minhasEquipes: false,
    prazoDe: '',
    prazoAte: '',
    secretaria: '',
    equipeTarefa: '',
    responsavelTarefa: '',
    tipo: '',
    prioridade: '',
  };
}

export function lerEstadoExecucao(sp: URLSearchParams): { estado: EstadoExecucao; canonico: URLSearchParams } {
  const tarefas = sp.get('aba') === 'tarefas';
  const status = enumUrl(sp.get('status'), STATUS_TAREFA);
  const prioridade = enumUrl(sp.get('prioridade'), PRIORIDADES);
  const painel = sp.get('painel');
  const estado: EstadoExecucao = {
    ...estadoExecucaoPadrao(),
    aba: tarefas ? 'tarefas' : 'chamados',
    search: sp.get('search')?.trim() ?? '',
    sel: tarefas ? null : idUrl(sp.get('sel')),
    equipes: tarefas ? [] : idsUrl(sp.get('equipe')),
    responsaveis: tarefas ? [] : idsUrl(sp.get('responsavel')),
    hoje: tarefas ? false : flagUrl(sp.get('hoje')),
    de: tarefas ? '' : (dataIsoValida(sp.get('de')) ?? ''),
    ate: tarefas ? '' : (dataIsoValida(sp.get('ate')) ?? ''),
    painelChamados: !tarefas && painel === 'lista' ? 'lista' : 'mapa',
    painelTarefas: tarefas && painel === 'mapa' ? 'mapa' : 'lista',
    tarefa: idUrl(sp.get('tarefa')),
    status: tarefas && status ? status : '',
    atrasadas: tarefas && flagUrl(sp.get('atrasadas')),
    historico: tarefas && flagUrl(sp.get('historico')),
    atribuidaAMim: tarefas && flagUrl(sp.get('atribuidaAMim')),
    minhasEquipes: tarefas && flagUrl(sp.get('minhasEquipes')),
    prazoDe: tarefas ? (dataIsoValida(sp.get('prazoDe')) ?? '') : '',
    prazoAte: tarefas ? (dataIsoValida(sp.get('prazoAte')) ?? '') : '',
    secretaria: tarefas ? (idUrl(sp.get('secretaria')) ?? '') : '',
    equipeTarefa: tarefas && !sp.get('equipe')?.includes(',') ? (idUrl(sp.get('equipe')) ?? '') : '',
    responsavelTarefa: tarefas && !sp.get('responsavel')?.includes(',') ? (idUrl(sp.get('responsavel')) ?? '') : '',
    tipo: tarefas ? (idUrl(sp.get('tipo')) ?? '') : '',
    prioridade: tarefas && prioridade ? prioridade : '',
  };
  return { estado, canonico: serializarEstadoExecucao(estado) };
}

export function serializarEstadoExecucao(estado: EstadoExecucao) {
  const params = new URLSearchParams();
  const tarefas = estado.aba === 'tarefas';
  if (tarefas) params.set('aba', 'tarefas');
  definirParam(params, 'search', estado.search.trim());
  definirParam(params, 'tarefa', estado.tarefa);
  if (!tarefas) {
    definirParam(params, 'sel', estado.sel);
    if (estado.equipes.length) params.set('equipe', estado.equipes.join(','));
    if (estado.responsaveis.length) params.set('responsavel', estado.responsaveis.join(','));
    if (estado.hoje) params.set('hoje', '1');
    definirParam(params, 'de', dataIsoValida(estado.de));
    definirParam(params, 'ate', dataIsoValida(estado.ate));
    if (estado.painelChamados === 'lista') params.set('painel', 'lista');
  } else {
    if (estado.status) params.set('status', estado.status.toLowerCase());
    if (estado.atrasadas) params.set('atrasadas', '1');
    if (estado.historico) params.set('historico', '1');
    if (estado.atribuidaAMim) params.set('atribuidaAMim', '1');
    if (estado.minhasEquipes) params.set('minhasEquipes', '1');
    definirParam(params, 'prazoDe', dataIsoValida(estado.prazoDe));
    definirParam(params, 'prazoAte', dataIsoValida(estado.prazoAte));
    definirParam(params, 'secretaria', estado.secretaria);
    definirParam(params, 'equipe', estado.equipeTarefa);
    definirParam(params, 'responsavel', estado.responsavelTarefa);
    definirParam(params, 'tipo', estado.tipo);
    if (estado.prioridade) params.set('prioridade', estado.prioridade.toLowerCase());
    if (estado.painelTarefas === 'mapa') params.set('painel', 'mapa');
  }
  return params;
}
