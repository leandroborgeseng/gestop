import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS_CATALOG, permissionMatrixKey } from '../domain/permissions-catalog';
import { TAREFAS_CANCELAR_KEY, TAREFAS_CANCELAR_LEGADO_KEY } from '../domain/permissions-matrix';
import {
  TAREFA_ABA_HISTORICO,
  TAREFA_BOTAO_ALTERAR_DADOS,
  TAREFA_BOTAO_CANCELAR,
  TAREFA_PARIDADE,
  TAREFA_PERM,
  chavesQueLiberam,
  podeAlterarDadosTarefaPorChaves,
  podeCancelarTarefaPorChaves,
  podeVerHistoricoTarefaPorChaves,
} from '../../frontend/lib/chamado-tarefa-permissoes';

const serviceSrc = readFileSync(join(__dirname, 'chamado-tarefas.service.ts'), 'utf8');
const controllerSrc = readFileSync(join(__dirname, 'chamado-tarefas.controller.ts'), 'utf8');
const sheetSrc = readFileSync(join(__dirname, '../../frontend/components/chamados/chamado-tarefa-sheet.tsx'), 'utf8');
const viewSrc = readFileSync(
  join(__dirname, '../../frontend/components/chamados/chamado-tarefa-permissoes-view.tsx'),
  'utf8',
);

function funcaoChamados(id: string) {
  const tela = PERMISSIONS_CATALOG.find((item) => item.id === 'chamados');
  return tela?.functions.find((item) => item.id === id);
}

describe('paridade front × guard das ações de tarefa', () => {
  it('catálogo rotula alterar dados e expõe cancelar fora da coluna excluir', () => {
    const tarefas = funcaoChamados('tarefas');
    const cancelar = funcaoChamados('tarefas_cancelar');
    expect(tarefas?.actionLabels?.alterar).toBe(TAREFA_BOTAO_ALTERAR_DADOS);
    expect(tarefas?.actions).not.toContain('excluir');
    expect(cancelar?.label).toBe(TAREFA_BOTAO_CANCELAR);
    expect(cancelar?.actions).toEqual(['executar']);
    expect(TAREFAS_CANCELAR_KEY).toBe(TAREFA_PERM.cancelar);
    expect(TAREFAS_CANCELAR_LEGADO_KEY).toBe(TAREFA_PERM.cancelarLegado);
  });

  it('PATCH da tarefa não tem decorator de permissão: o serviço é o guard', () => {
    expect(controllerSrc).toMatch(/@Patch\(':id'\)/);
    expect(controllerSrc).not.toMatch(/@Require(Any)?Permissions[\s\S]{0,80}@Patch\(':id'\)/);
    expect(serviceSrc).toContain("throw new ForbiddenException('Sem permissão para alterar os dados da tarefa.')");
    expect(serviceSrc).toContain("throw new ForbiddenException('Sem permissão para cancelar a tarefa.')");
  });

  it.each(TAREFA_PARIDADE.filter((acao) => acao.botao && acao.flagApi))(
    '$id: botão/aba do front só aparece com a flag da API',
    (acao) => {
      expect(sheetSrc + viewSrc).toContain(acao.flagApi!);
      expect(viewSrc).toContain(
        acao.id === 'historico'
          ? 'TAREFA_ABA_HISTORICO'
          : acao.id === 'alterarDados'
            ? 'TAREFA_BOTAO_ALTERAR_DADOS'
            : acao.id === 'cancelar'
              ? 'TAREFA_BOTAO_CANCELAR'
              : acao.id === 'andamento'
                ? 'TAREFA_BOTAO_ANDAMENTO'
                : 'TAREFA_BOTAO_CONCLUIR',
      );
      if (acao.id === 'alterarDados' || acao.id === 'cancelar' || acao.id === 'historico') {
        expect(acao.designadoBasta).toBe(false);
      }
    },
  );

  it('alterar dados: helper, serviço e ficha usam a mesma chave específica', () => {
    expect(TAREFA_PERM.alterarDados).toBe(permissionMatrixKey('chamados', 'tarefas', 'alterar'));
    expect(serviceSrc).toContain("chave('chamados', 'tarefas', 'alterar')");
    expect(viewSrc).toContain('podeAlterarDados');
    expect(viewSrc).toContain('TAREFA_BOTAO_ALTERAR_DADOS');
    expect(podeAlterarDadosTarefaPorChaves([TAREFA_PERM.alterarDados])).toBe(true);
    expect(podeAlterarDadosTarefaPorChaves([])).toBe(false);
    expect(podeAlterarDadosTarefaPorChaves([TAREFA_PERM.visualizar])).toBe(false);
  });

  it('cancelar: aceita a chave nova e a legada tarefas.excluir', () => {
    expect(serviceSrc).toContain("chave('chamados', 'tarefas_cancelar', 'executar')");
    expect(serviceSrc).toContain("chave('chamados', 'tarefas', 'excluir')");
    expect(viewSrc).toContain('podeCancelar');
    expect(viewSrc).toContain('TAREFA_BOTAO_CANCELAR');
    expect(podeCancelarTarefaPorChaves([TAREFA_PERM.cancelar])).toBe(true);
    expect(podeCancelarTarefaPorChaves([TAREFA_PERM.cancelarLegado])).toBe(true);
    expect(podeCancelarTarefaPorChaves([])).toBe(false);
  });

  it('histórico: helper e serviço usam tarefas_historico.visualizar; sem a chave a aba some', () => {
    expect(TAREFA_PERM.historico).toBe(permissionMatrixKey('chamados', 'tarefas_historico', 'visualizar'));
    expect(serviceSrc).toContain("chave('chamados', 'tarefas_historico', 'visualizar')");
    expect(serviceSrc).toContain('podeVerHistorico: this.podeVerHistorico(user)');
    expect(sheetSrc).toContain('tarefa.podeVerHistorico');
    expect(viewSrc).toContain('TAREFA_ABA_HISTORICO');
    expect(TAREFA_ABA_HISTORICO).toBe('Histórico da tarefa');
    expect(podeVerHistoricoTarefaPorChaves([TAREFA_PERM.historico])).toBe(true);
    expect(podeVerHistoricoTarefaPorChaves([TAREFA_PERM.visualizar])).toBe(false);
  });

  it('tabela de paridade: chaves específicas + legado + sobreposições batem com o serviço', () => {
    const linhas = TAREFA_PARIDADE.map((acao) => ({
      acao: acao.id,
      rotulo: acao.rotulo,
      flag: acao.flagApi,
      botao: acao.botao,
      especificas: acao.chavesEspecificas,
      legado: acao.legado,
      sobreposicoes: acao.sobreposicoes,
      designadoBasta: acao.designadoBasta,
      chavesQueLiberam: chavesQueLiberam(acao),
    }));

    expect(linhas).toEqual([
      {
        acao: 'visualizar',
        rotulo: 'Visualizar tarefas',
        flag: null,
        botao: null,
        especificas: [TAREFA_PERM.visualizar],
        legado: [],
        sobreposicoes: [TAREFA_PERM.gerenciar],
        designadoBasta: true,
        chavesQueLiberam: [TAREFA_PERM.visualizar, TAREFA_PERM.gerenciar],
      },
      {
        acao: 'inserir',
        rotulo: 'Criar tarefa',
        flag: null,
        botao: null,
        especificas: [TAREFA_PERM.inserir],
        legado: [],
        sobreposicoes: [TAREFA_PERM.gerenciar],
        designadoBasta: false,
        chavesQueLiberam: [TAREFA_PERM.inserir, TAREFA_PERM.gerenciar],
      },
      {
        acao: 'alterarDados',
        rotulo: TAREFA_BOTAO_ALTERAR_DADOS,
        flag: 'podeAlterarDados',
        botao: TAREFA_BOTAO_ALTERAR_DADOS,
        especificas: [TAREFA_PERM.alterarDados],
        legado: [],
        sobreposicoes: [TAREFA_PERM.alterarDadosExecucao, TAREFA_PERM.gerenciar],
        designadoBasta: false,
        chavesQueLiberam: [TAREFA_PERM.alterarDados, TAREFA_PERM.alterarDadosExecucao, TAREFA_PERM.gerenciar],
      },
      {
        acao: 'andamento',
        rotulo: 'Registrar andamento',
        flag: 'podeAndamento',
        botao: 'Registrar andamento',
        especificas: [TAREFA_PERM.andamento],
        legado: [],
        sobreposicoes: [
          TAREFA_PERM.executarTarefa,
          TAREFA_PERM.executarExecucao,
          TAREFA_PERM.gerenciar,
          TAREFA_PERM.executarChamado,
        ],
        designadoBasta: true,
        chavesQueLiberam: [
          TAREFA_PERM.andamento,
          TAREFA_PERM.executarTarefa,
          TAREFA_PERM.executarExecucao,
          TAREFA_PERM.gerenciar,
          TAREFA_PERM.executarChamado,
        ],
      },
      {
        acao: 'concluir',
        rotulo: 'Concluir tarefa',
        flag: 'podeConcluir',
        botao: 'Concluir tarefa',
        especificas: [TAREFA_PERM.concluir],
        legado: [],
        sobreposicoes: [
          TAREFA_PERM.executarTarefa,
          TAREFA_PERM.executarExecucao,
          TAREFA_PERM.gerenciar,
          TAREFA_PERM.executarChamado,
        ],
        designadoBasta: true,
        chavesQueLiberam: [
          TAREFA_PERM.concluir,
          TAREFA_PERM.executarTarefa,
          TAREFA_PERM.executarExecucao,
          TAREFA_PERM.gerenciar,
          TAREFA_PERM.executarChamado,
        ],
      },
      {
        acao: 'cancelar',
        rotulo: TAREFA_BOTAO_CANCELAR,
        flag: 'podeCancelar',
        botao: TAREFA_BOTAO_CANCELAR,
        especificas: [TAREFA_PERM.cancelar],
        legado: [TAREFA_PERM.cancelarLegado],
        sobreposicoes: [TAREFA_PERM.gerenciar],
        designadoBasta: false,
        chavesQueLiberam: [TAREFA_PERM.cancelar, TAREFA_PERM.cancelarLegado, TAREFA_PERM.gerenciar],
      },
      {
        acao: 'historico',
        rotulo: TAREFA_ABA_HISTORICO,
        flag: 'podeVerHistorico',
        botao: TAREFA_ABA_HISTORICO,
        especificas: [TAREFA_PERM.historico],
        legado: [],
        sobreposicoes: [],
        designadoBasta: false,
        chavesQueLiberam: [TAREFA_PERM.historico],
      },
    ]);

    expect(serviceSrc).toContain("chave('chamados', 'tarefas', 'executar')");
    expect(serviceSrc).toContain("chave('execucao', 'tarefas', 'executar')");
    expect(serviceSrc).toContain("chave('execucao', 'tarefas', 'alterar')");
    expect(serviceSrc).toContain("'chamados.executar'");
    expect(serviceSrc).toContain("'chamados.gerenciar'");
  });
});
