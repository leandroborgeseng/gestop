import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ChamadoTarefaBarraAcoes,
  ChamadoTarefaHistoricoCabecalho,
} from '../components/chamados/chamado-tarefa-permissoes-view';
import {
  TAREFA_ABA_HISTORICO,
  TAREFA_BOTAO_ALTERAR_DADOS,
  TAREFA_BOTAO_ANDAMENTO,
  TAREFA_BOTAO_CANCELAR,
  TAREFA_BOTAO_CONCLUIR,
} from './chamado-tarefa-permissoes';

const SEM_PERMISSAO = {
  podeAlterarDados: false,
  podeAndamento: false,
  podeConcluir: false,
  podeCancelar: false,
  podeVerHistorico: false,
  historico: [
    {
      id: 'h1',
      motivo: 'Não deveria aparecer',
      statusAnterior: null,
      statusNovo: 'NOVA',
      createdAt: '2026-10-01T12:00:00.000Z',
      alteradoPor: { id: 'u1', nome: 'Admin' },
    },
  ],
  anexos: [
    {
      id: 'a1',
      nome: 'segredo.jpg',
      url: '/storage/segredo.jpg',
      mimeType: 'image/jpeg',
      tamanhoBytes: 10,
      createdAt: '2026-10-01T12:00:00.000Z',
    },
  ],
};

const COM_PERMISSAO = {
  ...SEM_PERMISSAO,
  podeAlterarDados: true,
  podeAndamento: true,
  podeConcluir: true,
  podeCancelar: true,
  podeVerHistorico: true,
};

describe('render das ações de tarefa', () => {
  it('sem permissão, não mostra Alterar dados, Cancelar nem a aba de histórico', () => {
    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(ChamadoTarefaBarraAcoes, { tarefa: SEM_PERMISSAO }),
        createElement(ChamadoTarefaHistoricoCabecalho, { podeVerHistorico: SEM_PERMISSAO.podeVerHistorico }),
      ),
    );

    expect(html).not.toContain(TAREFA_BOTAO_ALTERAR_DADOS);
    expect(html).not.toContain(TAREFA_BOTAO_CANCELAR);
    expect(html).not.toContain(TAREFA_BOTAO_ANDAMENTO);
    expect(html).not.toContain(TAREFA_BOTAO_CONCLUIR);
    expect(html).not.toContain(TAREFA_ABA_HISTORICO);
    expect(html).not.toContain('Não deveria aparecer');
    expect(html).not.toContain('segredo.jpg');
  });

  it('com as flags, mostra os botões e a aba de histórico', () => {
    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(ChamadoTarefaBarraAcoes, { tarefa: COM_PERMISSAO }),
        createElement(ChamadoTarefaHistoricoCabecalho, { podeVerHistorico: COM_PERMISSAO.podeVerHistorico }),
      ),
    );

    expect(html).toContain(TAREFA_BOTAO_ALTERAR_DADOS);
    expect(html).toContain(TAREFA_BOTAO_CANCELAR);
    expect(html).toContain(TAREFA_BOTAO_ANDAMENTO);
    expect(html).toContain(TAREFA_BOTAO_CONCLUIR);
    expect(html).toContain(TAREFA_ABA_HISTORICO);
  });
});
