import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/zoomable-authenticated-image', () => ({ ZoomableAuthenticatedImage: () => null }));
vi.mock('@/components/ui/authenticated-image', () => ({ AuthenticatedImage: () => null }));
vi.mock('@/components/ui/authenticated-storage-link', () => ({ AuthenticatedStorageLink: () => null }));

import { buildChamadoTimelineFromHistorico } from '@/lib/chamado-status';
import { ChamadoTimeline } from './chamado-timeline';

afterEach(() => cleanup());

const meta = (over: Record<string, unknown>) => ({ tipo: 'tarefa', tarefaId: 't9', tarefaTitulo: 'Limpar calha', acao: 'andamento', resumo: 'Status: EM_ANDAMENTO · Calha ok\nfalta vedar', ...over });

describe('293 · linha do tempo do chamado', () => {
  it('evento de tarefa: "Tarefa: {nome}" com link e o mesmo texto com quebras', () => {
    const steps = buildChamadoTimelineFromHistorico(
      [{ id: 'h1', statusNovo: 'EM_EXECUCAO', statusAnterior: 'EM_EXECUCAO', motivo: 'Andamento da tarefa: Limpar calha', createdAt: '2026-10-15T13:00:00.000Z', alteradoPor: { nome: 'Bruno' }, metadata: meta({ texto: 'Calha ok\nfalta vedar' }) }],
      'EM_EXECUCAO',
      '2026-10-01T12:00:00.000Z',
    );
    const step = steps.find((s) => s.id === 'h1')!;
    expect(step.tarefa).toEqual({ id: 't9', titulo: 'Limpar calha' });
    expect(step.texto).toBe('Calha ok\nfalta vedar');
    expect(step.sub).toBe('Bruno');
    render(createElement(ChamadoTimeline, { steps: [step] }));
    const link = screen.getByTestId('timeline-tarefa');
    expect(link.textContent).toBe('Tarefa: Limpar calha');
    expect(link.getAttribute('href')).toBe('/execucao?aba=tarefas&tarefa=t9');
    expect(screen.getByTestId('timeline-texto').textContent).toBe('Calha ok\nfalta vedar');
  });
  it('registro antigo sem texto: mantém o resumo de antes, sem bloco de texto', () => {
    const steps = buildChamadoTimelineFromHistorico(
      [{ id: 'h2', statusNovo: 'EM_EXECUCAO', motivo: 'Andamento da tarefa: Limpar calha', createdAt: '2026-01-01T10:00:00.000Z', alteradoPor: { nome: 'Bruno' }, metadata: meta({}) }],
      'EM_EXECUCAO',
      '2026-01-01T09:00:00.000Z',
    );
    const step = steps.find((s) => s.id === 'h2')!;
    expect(step.texto).toBeUndefined();
    render(createElement(ChamadoTimeline, { steps: [step] }));
    expect(screen.queryByTestId('timeline-texto')).toBeNull();
    expect(step.sub).toBe('Bruno · Status: EM_ANDAMENTO · Calha ok\nfalta vedar');
  });
  it('293b: andamento legado na linha do tempo — "Registro anterior" + resumo inteiro, tarefa identificada', () => {
    const resumo = 'Status: EM_ANDAMENTO · Calha ok · falta vedar';
    const steps = buildChamadoTimelineFromHistorico(
      [{ id: 'h3', statusNovo: 'EM_EXECUCAO', motivo: 'Andamento da tarefa: Limpar calha', createdAt: '2026-01-01T10:00:00.000Z', alteradoPor: { nome: 'Bruno' }, metadata: meta({ resumo, texto: resumo, textoOrigem: 'registro_anterior' }) }],
      'EM_EXECUCAO',
      '2026-01-01T09:00:00.000Z',
    );
    const step = steps.find((s) => s.id === 'h3')!;
    expect(step.registroAnterior).toBe(true);
    expect(step.sub).toBe('Bruno');
    render(createElement(ChamadoTimeline, { steps: [step] }));
    expect(screen.getByTestId('timeline-tarefa').textContent).toBe('Tarefa: Limpar calha');
    expect(screen.getByTestId('timeline-registro-anterior').textContent).toBe('Registro anterior');
    expect(screen.getByTestId('timeline-texto').textContent).toBe(resumo);
  });
  it('293b: conclusão legada (conclusaoTexto) e evento novo não mostram "Registro anterior"', () => {
    const steps = buildChamadoTimelineFromHistorico(
      [
        { id: 'h4', statusNovo: 'EM_EXECUCAO', motivo: 'm', createdAt: '2026-01-01T10:00:00.000Z', alteradoPor: { nome: 'Bruno' }, metadata: meta({ acao: 'concluida', texto: 'Conclusão antiga', textoOrigem: 'conclusao' }) },
        { id: 'h5', statusNovo: 'EM_EXECUCAO', motivo: 'm', createdAt: '2026-01-02T10:00:00.000Z', alteradoPor: { nome: 'Bruno' }, metadata: meta({ texto: 'Novo', textoOrigem: 'evento' }) },
      ],
      'EM_EXECUCAO',
      '2026-01-01T09:00:00.000Z',
    );
    const tl = steps.filter((s) => s.id === 'h4' || s.id === 'h5');
    expect(tl.map((s) => [s.texto, s.registroAnterior ?? false])).toEqual([['Conclusão antiga', false], ['Novo', false]]);
    render(createElement(ChamadoTimeline, { steps: tl }));
    expect(screen.queryAllByTestId('timeline-registro-anterior')).toHaveLength(0);
    expect(screen.getAllByTestId('timeline-texto').map((e) => e.textContent)).toEqual(['Conclusão antiga', 'Novo']);
  });
});
