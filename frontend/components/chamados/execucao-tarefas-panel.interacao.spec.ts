import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChamadoTarefaResumo, TarefasExecucaoResponse } from '@/lib/chamado-tarefa';
import type { ChamadoMapPoint } from '@/lib/types';

const resposta: { atual: TarefasExecucaoResponse } = { atual: { total: 0, contadores: { novas: 0, emAndamento: 0, atrasadas: 0 }, items: [] } };

vi.mock('@/components/ui/snackbar', () => ({ useSnackbar: () => ({ show: () => undefined }) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock('@/lib/api', () => ({
  listTarefasExecucao: () => Promise.resolve(resposta.atual),
  getSecretarias: () => Promise.resolve([]),
  listEquipesExecucao: () => Promise.resolve([]),
  listUsuariosAtivosExecucao: () => Promise.resolve([]),
  listTiposChamadoOpcoes: () => Promise.resolve([]),
}));
// Sheet: só expõe qual tarefa está aberta.
vi.mock('@/components/chamados/chamado-tarefa-sheet', () => ({
  ChamadoTarefaSheet: ({ tarefaId }: { tarefaId: string | null }) =>
    tarefaId ? createElement('div', { 'data-testid': 'sheet' }, tarefaId) : null,
}));
// Mapa: um botão por pin que dispara onSelect (clique no pin) e outro para a ação do popup.
vi.mock('@/components/chamados/chamados-execucao-map', () => ({
  ChamadosExecucaoMap: ({ pontos, onSelect, onPopupAction }: { pontos: ChamadoMapPoint[]; onSelect?: (id: string) => void; onPopupAction?: (id: string) => void }) =>
    createElement(
      'div',
      { 'data-testid': 'mapa' },
      pontos.map((p) => [
        createElement('button', { key: p.id, type: 'button', 'data-testid': `pin-${p.id}`, 'data-contagem': p.contagem ?? 1, onClick: () => onSelect?.(p.id) }, `pin ${p.id}`),
        createElement('button', { key: `${p.id}-popup`, type: 'button', 'data-testid': `popup-${p.id}`, onClick: () => onPopupAction?.(p.id) }, 'Abrir tarefa'),
      ]),
    ),
}));

import { ExecucaoTarefasPanel } from './execucao-tarefas-panel';

function tarefa(id: string, over: Partial<ChamadoTarefaResumo> = {}, chamado: Partial<ChamadoTarefaResumo['chamado']> = {}): ChamadoTarefaResumo {
  return {
    id, titulo: `Tarefa ${id}`, descricao: null, prazo: null, prioridade: 'BAIXA', status: 'NOVA', justificativa: null, conclusaoTexto: null,
    observacao: null, atrasada: false, createdAt: '2026-10-01T00:00:00.000Z', concluidaEm: null, visualizadaEm: null,
    secretaria: { id: 's1', nome: 'Secretaria Executiva', sigla: 'SEC-EX' }, equipe: { id: 'e1', nome: 'Elétrica 1' }, responsavel: { id: 'u1', nome: 'Bruno' },
    criadaPor: null, concluidaPor: null, anexos: [], podeTratar: true,
    chamado: { id: `c-${id}`, codigo: `CH-${id}`, titulo: 'Chamado', descricao: '', status: 'EM_EXECUCAO', prioridade: 'BAIXA', enderecoTexto: null, prazoEm: null,
      latitude: -20.5, longitude: -47.4, tipoChamado: { id: 'tp', nome: 'Elétrica - Lâmpada' }, unidade: null, secretaria: null, equipe: null, ...chamado },
    ...over,
  };
}

const itens = [
  tarefa('a'), // mesmo ponto que b → pin agrupado
  tarefa('b', { responsavel: { id: 'u2', nome: 'Carla Mendes' } }),
  tarefa('c', { titulo: 'Pintura', equipe: { id: 'e2', nome: 'Civil' } }, { latitude: -21, longitude: -47 }),
];

async function montar(items = itens) {
  resposta.atual = { total: items.length, contadores: { novas: items.length, emAndamento: 0, atrasadas: 0 }, items };
  render(createElement(ExecucaoTarefasPanel));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
const card = (id: string) => document.querySelector<HTMLButtonElement>(`button[data-tarefa-id="${id}"]`);
const cardsVisiveis = () => [...document.querySelectorAll<HTMLButtonElement>('button[data-tarefa-id]')].map((b) => b.dataset.tarefaId);
const destacado = (id: string) => card(id)!.className.includes('bg-[var(--brand-soft)]');

afterEach(() => cleanup());

describe('286 2º ciclo — interação real no painel', () => {
  it('carrega as tarefas em cards e agrupa a e b num pin com contador 2', async () => {
    await montar();
    expect(cardsVisiveis()).toEqual(['a', 'b', 'c']);
    const pins = within(screen.getByTestId('mapa')).getAllByRole('button').filter((b) => b.dataset.testid?.startsWith('pin-'));
    expect(pins.map((p) => p.dataset.contagem)).toEqual(['2', '1']);
  });

  it('T13: a busca local filtra os cards e os pins no painel', async () => {
    await montar();
    fireEvent.change(screen.getByLabelText('Buscar tarefa'), { target: { value: 'civil' } });
    expect(cardsVisiveis()).toEqual(['c']);
    expect(screen.queryByTestId('pin-a')).toBeNull();
    expect(screen.getByTestId('pin-c')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Buscar tarefa'), { target: { value: 'zzz' } });
    expect(cardsVisiveis()).toEqual([]);
    expect(document.body.textContent).toContain("Nenhuma tarefa encontrada para 'zzz'");
  });

  it('T7: a busca encontra pelo nome do responsável', async () => {
    await montar();
    fireEvent.change(screen.getByLabelText('Buscar tarefa'), { target: { value: 'carla' } });
    expect(cardsVisiveis()).toEqual(['b']);
  });

  it('T12: clicar no pin só seleciona — não abre o modal; o popup "Abrir tarefa" abre', async () => {
    await montar();
    fireEvent.click(screen.getByTestId('pin-c'));
    expect(screen.queryByTestId('sheet')).toBeNull();
    expect(card('c')!.getAttribute('aria-current')).toBe('true');
    expect(document.querySelector('[aria-live="polite"]')!.textContent).toBe('Tarefa Pintura selecionada no mapa');
    fireEvent.click(screen.getByTestId('popup-c'));
    expect(screen.getByTestId('sheet').textContent).toBe('c');
  });

  it('T11: o pin agrupado destaca as N tarefas do ponto na lista (sem filtrar)', async () => {
    await montar();
    fireEvent.click(screen.getByTestId('pin-a'));
    expect(screen.queryByTestId('sheet')).toBeNull();
    expect(destacado('a')).toBe(true);
    expect(destacado('b')).toBe(true);
    expect(destacado('c')).toBe(false);
    expect(cardsVisiveis()).toEqual(['a', 'b', 'c']);
    expect(document.querySelector('[aria-live="polite"]')!.textContent).toBe('2 tarefas neste local selecionadas no mapa');
  });

  it('clicar no card abre o modal da tarefa', async () => {
    await montar();
    fireEvent.click(card('b')!);
    expect(screen.getByTestId('sheet').textContent).toBe('b');
  });

  it('T5: tarefa que vence hoje mostra o prazo em tom danger', async () => {
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    await montar([tarefa('h', { prazo: hoje.toISOString() })]);
    const prazo = card('h')!.querySelector('.tarefa-prazo')!;
    expect(prazo.textContent).toContain('vence hoje');
    expect(prazo.className).toContain('text-[var(--danger)]');
  });

  it('T14: tarefa Impedida mostra o status em badge warning', async () => {
    await montar([tarefa('i', { status: 'IMPEDIDA' })]);
    const badge = [...card('i')!.querySelectorAll('.tarefa-tags span')].find((s) => s.textContent === 'Impedida')!;
    expect(badge.className).toContain('bg-[var(--warn-bg)]');
    expect(badge.className).toContain('text-[var(--warn-ink)]');
  });
});
