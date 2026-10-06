import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  BOTOES_GESTAO_CHAMADO,
  ChamadoTarefaChamadoLeituraView,
} from '../components/chamados/chamado-tarefa-chamado-leitura';

describe('ChamadoTarefaChamadoLeituraView', () => {
  it('via tarefa, não aparece botão de gestão do chamado', () => {
    const html = renderToStaticMarkup(
      createElement(ChamadoTarefaChamadoLeituraView, {
        leitura: {
          codigo: 'CH-001',
          somenteLeitura: true,
          anexosAbertura: [{ id: 'a1', nome: 'fachada.jpg', url: '/storage/fachada.jpg', categoria: 'imagem' }],
          historico: [
            {
              id: 'h1',
              motivo: 'Chamado aberto',
              statusAnterior: null,
              statusNovo: 'ABERTO',
              createdAt: '2026-10-01T12:00:00.000Z',
              alteradoPor: { id: 'u1', nome: 'Admin' },
              anexos: [{ id: 'a1', url: '/storage/fachada.jpg', nome: 'fachada.jpg' }],
            },
          ],
        },
      }),
    );

    expect(html).toContain('Anexos do chamado');
    expect(html).toContain('Histórico do chamado');
    expect(html).toContain('fachada.jpg');
    expect(html).toContain('Chamado aberto');
    expect(html).toContain('somente leitura');
    for (const rotulo of BOTOES_GESTAO_CHAMADO) {
      expect(html).not.toContain(rotulo);
    }
  });
});
