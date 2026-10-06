import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TAREFA_BOTAO_ALTERAR_DADOS } from './chamado-tarefa-permissoes';
import {
  buildMatrixKey,
  canGerirTarefasChamado,
  catalogCheckboxLabel,
  type PermissionCatalogFunction,
} from './permissions-matrix';

const TAREFAS_CATALOGO: PermissionCatalogFunction = {
  id: 'tarefas',
  label: 'Tarefas do chamado',
  actions: ['visualizar', 'inserir', 'alterar', 'executar'],
  actionLabels: {
    visualizar: 'Visualizar tarefas',
    inserir: 'Criar tarefa',
    alterar: TAREFA_BOTAO_ALTERAR_DADOS,
    executar: 'Executar tarefa',
  },
};

describe('permissions-matrix — rotina de tarefas (269)', () => {
  it('quem tem só o legado tarefas.excluir continua podendo cancelar', () => {
    const soLegado = [buildMatrixKey('chamados', 'tarefas', 'excluir')];

    expect(canGerirTarefasChamado(soLegado, 'cancelar')).toBe(true);
    expect(canGerirTarefasChamado(soLegado, 'excluir')).toBe(true);
    expect(canGerirTarefasChamado([buildMatrixKey('chamados', 'tarefas_cancelar', 'executar')], 'cancelar')).toBe(
      true,
    );
    expect(canGerirTarefasChamado([buildMatrixKey('chamados', 'tarefas', 'visualizar')], 'cancelar')).toBe(false);
    expect(canGerirTarefasChamado([], 'cancelar')).toBe(false);
  });

  it('aria-label e title da matriz para tarefas/alterar usam Alterar dados da tarefa', () => {
    const rotulo = catalogCheckboxLabel(TAREFAS_CATALOGO, 'alterar');
    expect(rotulo).toBe(TAREFA_BOTAO_ALTERAR_DADOS);

    const html = renderToStaticMarkup(
      createElement('input', {
        type: 'checkbox',
        'aria-label': rotulo,
        title: rotulo,
      }),
    );

    expect(html).toContain(`aria-label="${TAREFA_BOTAO_ALTERAR_DADOS}"`);
    expect(html).toContain(`title="${TAREFA_BOTAO_ALTERAR_DADOS}"`);
    expect(html).not.toContain('Tarefas do chamado · Alterar');
  });
});
