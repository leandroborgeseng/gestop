import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ChamadoTarefaAnexosSecao,
  ChamadoTarefaBarraAcoes,
  ChamadoTarefaHistoricoCabecalho,
} from '../components/chamados/chamado-tarefa-permissoes-view';
import {
  TAREFA_ABA_HISTORICO,
  TAREFA_BOTAO_ALTERAR_DADOS,
  TAREFA_BOTAO_ANDAMENTO,
  TAREFA_BOTAO_CANCELAR,
  TAREFA_BOTAO_CONCLUIR,
  TAREFA_SECAO_ANEXOS,
} from './chamado-tarefa-permissoes';

const ANEXO = { id: 'a1', nome: 'foto.jpg' };

const SEM_PERMISSAO = {
  podeAlterarDados: false,
  podeAndamento: false,
  podeConcluir: false,
  podeCancelar: false,
  podeVerHistorico: false,
  podeVerAnexos: false,
};

const DESIGNADO_SEM_HISTORICO = {
  ...SEM_PERMISSAO,
  podeVerAnexos: true,
};

const COM_PERMISSAO = {
  ...SEM_PERMISSAO,
  podeAlterarDados: true,
  podeAndamento: true,
  podeConcluir: true,
  podeCancelar: true,
  podeVerHistorico: true,
  podeVerAnexos: true,
};

describe('render das ações de tarefa', () => {
  it('sem permissão, não mostra Alterar dados, Cancelar nem a aba de histórico', () => {
    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(ChamadoTarefaBarraAcoes, { tarefa: SEM_PERMISSAO }),
        createElement(ChamadoTarefaHistoricoCabecalho, { podeVerHistorico: SEM_PERMISSAO.podeVerHistorico }),
        createElement(ChamadoTarefaAnexosSecao, { visivel: SEM_PERMISSAO.podeVerAnexos, anexos: [ANEXO] }),
      ),
    );

    expect(html).not.toContain(TAREFA_BOTAO_ALTERAR_DADOS);
    expect(html).not.toContain(TAREFA_BOTAO_CANCELAR);
    expect(html).not.toContain(TAREFA_BOTAO_ANDAMENTO);
    expect(html).not.toContain(TAREFA_BOTAO_CONCLUIR);
    expect(html).not.toContain(TAREFA_ABA_HISTORICO);
    expect(html).not.toContain(TAREFA_SECAO_ANEXOS);
    expect(html).not.toContain('foto.jpg');
  });

  it('designado sem histórico vê anexos e não vê a aba de histórico', () => {
    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(ChamadoTarefaHistoricoCabecalho, {
          podeVerHistorico: DESIGNADO_SEM_HISTORICO.podeVerHistorico,
        }),
        createElement(ChamadoTarefaAnexosSecao, { visivel: DESIGNADO_SEM_HISTORICO.podeVerAnexos, anexos: [ANEXO] }),
      ),
    );

    expect(html).toContain(TAREFA_SECAO_ANEXOS);
    expect(html).toContain('foto.jpg');
    expect(html).not.toContain(TAREFA_ABA_HISTORICO);
  });

  it('com as flags, mostra os botões e a aba de histórico', () => {
    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(ChamadoTarefaBarraAcoes, { tarefa: COM_PERMISSAO }),
        createElement(ChamadoTarefaHistoricoCabecalho, { podeVerHistorico: COM_PERMISSAO.podeVerHistorico }),
        createElement(ChamadoTarefaAnexosSecao, {
          visivel: COM_PERMISSAO.podeVerAnexos && !COM_PERMISSAO.podeVerHistorico,
          anexos: [ANEXO],
        }),
      ),
    );

    expect(html).toContain(TAREFA_BOTAO_ALTERAR_DADOS);
    expect(html).toContain(TAREFA_BOTAO_CANCELAR);
    expect(html).toContain(TAREFA_BOTAO_ANDAMENTO);
    expect(html).toContain(TAREFA_BOTAO_CONCLUIR);
    expect(html).toContain(TAREFA_ABA_HISTORICO);
    expect(html).not.toContain(TAREFA_SECAO_ANEXOS);
  });
});
