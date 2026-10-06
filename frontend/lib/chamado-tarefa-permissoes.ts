/** Chaves e rótulos da rotina de tarefas. Módulo puro (sem React e sem alias `@/`). */

export const TAREFA_BOTAO_ALTERAR_DADOS = 'Alterar dados da tarefa';
export const TAREFA_BOTAO_ANDAMENTO = 'Registrar andamento';
export const TAREFA_BOTAO_CONCLUIR = 'Concluir tarefa';
export const TAREFA_BOTAO_CANCELAR = 'Cancelar tarefa';
export const TAREFA_ABA_HISTORICO = 'Histórico da tarefa';
export const TAREFA_SECAO_ANEXOS = 'Anexos da tarefa';

export const TAREFA_PERM = {
  visualizar: 'matriz.chamados.tarefas.visualizar',
  inserir: 'matriz.chamados.tarefas.inserir',
  alterarDados: 'matriz.chamados.tarefas.alterar',
  alterarDadosExecucao: 'matriz.execucao.tarefas.alterar',
  andamento: 'matriz.chamados.tarefas_andamento.executar',
  concluir: 'matriz.chamados.tarefas_concluir.executar',
  executarTarefa: 'matriz.chamados.tarefas.executar',
  executarExecucao: 'matriz.execucao.tarefas.executar',
  cancelar: 'matriz.chamados.tarefas_cancelar.executar',
  cancelarLegado: 'matriz.chamados.tarefas.excluir',
  historico: 'matriz.chamados.tarefas_historico.visualizar',
  gerenciar: 'chamados.gerenciar',
  executarChamado: 'chamados.executar',
} as const;

export type TarefaAcaoParidadeId =
  | 'visualizar'
  | 'inserir'
  | 'alterarDados'
  | 'andamento'
  | 'concluir'
  | 'cancelar'
  | 'historico'
  | 'anexos';

export type TarefaAcaoParidade = {
  id: TarefaAcaoParidadeId;
  rotulo: string;
  botao: string | null;
  flagApi:
    | 'podeAlterarDados'
    | 'podeAndamento'
    | 'podeConcluir'
    | 'podeCancelar'
    | 'podeVerHistorico'
    | 'podeVerAnexos'
    | null;
  chavesEspecificas: string[];
  legado: string[];
  sobreposicoes: string[];
  designadoBasta: boolean;
};

export const TAREFA_PARIDADE: TarefaAcaoParidade[] = [
  {
    id: 'visualizar',
    rotulo: 'Visualizar tarefas',
    botao: null,
    flagApi: null,
    chavesEspecificas: [TAREFA_PERM.visualizar],
    legado: [],
    sobreposicoes: [TAREFA_PERM.gerenciar],
    designadoBasta: true,
  },
  {
    id: 'inserir',
    rotulo: 'Criar tarefa',
    botao: null,
    flagApi: null,
    chavesEspecificas: [TAREFA_PERM.inserir],
    legado: [],
    sobreposicoes: [TAREFA_PERM.gerenciar],
    designadoBasta: false,
  },
  {
    id: 'alterarDados',
    rotulo: TAREFA_BOTAO_ALTERAR_DADOS,
    botao: TAREFA_BOTAO_ALTERAR_DADOS,
    flagApi: 'podeAlterarDados',
    chavesEspecificas: [TAREFA_PERM.alterarDados],
    legado: [],
    sobreposicoes: [TAREFA_PERM.alterarDadosExecucao, TAREFA_PERM.gerenciar],
    designadoBasta: false,
  },
  {
    id: 'andamento',
    rotulo: TAREFA_BOTAO_ANDAMENTO,
    botao: TAREFA_BOTAO_ANDAMENTO,
    flagApi: 'podeAndamento',
    chavesEspecificas: [TAREFA_PERM.andamento],
    legado: [],
    sobreposicoes: [
      TAREFA_PERM.executarTarefa,
      TAREFA_PERM.executarExecucao,
      TAREFA_PERM.gerenciar,
      TAREFA_PERM.executarChamado,
    ],
    designadoBasta: true,
  },
  {
    id: 'concluir',
    rotulo: TAREFA_BOTAO_CONCLUIR,
    botao: TAREFA_BOTAO_CONCLUIR,
    flagApi: 'podeConcluir',
    chavesEspecificas: [TAREFA_PERM.concluir],
    legado: [],
    sobreposicoes: [
      TAREFA_PERM.executarTarefa,
      TAREFA_PERM.executarExecucao,
      TAREFA_PERM.gerenciar,
      TAREFA_PERM.executarChamado,
    ],
    designadoBasta: true,
  },
  {
    id: 'cancelar',
    rotulo: TAREFA_BOTAO_CANCELAR,
    botao: TAREFA_BOTAO_CANCELAR,
    flagApi: 'podeCancelar',
    chavesEspecificas: [TAREFA_PERM.cancelar],
    legado: [TAREFA_PERM.cancelarLegado],
    sobreposicoes: [TAREFA_PERM.gerenciar],
    designadoBasta: false,
  },
  {
    id: 'historico',
    rotulo: TAREFA_ABA_HISTORICO,
    botao: TAREFA_ABA_HISTORICO,
    flagApi: 'podeVerHistorico',
    chavesEspecificas: [TAREFA_PERM.historico],
    legado: [],
    sobreposicoes: [],
    designadoBasta: false,
  },
  {
    id: 'anexos',
    rotulo: TAREFA_SECAO_ANEXOS,
    botao: TAREFA_SECAO_ANEXOS,
    flagApi: 'podeVerAnexos',
    chavesEspecificas: [TAREFA_PERM.historico],
    legado: [],
    sobreposicoes: [],
    designadoBasta: true,
  },
];

export function temChaveTarefa(permissoes: readonly string[], chaves: readonly string[]) {
  return chaves.some((chave) => permissoes.includes(chave));
}

export function chavesQueLiberam(acao: TarefaAcaoParidade) {
  return [...acao.chavesEspecificas, ...acao.legado, ...acao.sobreposicoes];
}

export function podeAlterarDadosTarefaPorChaves(permissoes: readonly string[]) {
  const acao = TAREFA_PARIDADE.find((item) => item.id === 'alterarDados')!;
  return temChaveTarefa(permissoes, chavesQueLiberam(acao));
}

export function podeCancelarTarefaPorChaves(permissoes: readonly string[]) {
  const acao = TAREFA_PARIDADE.find((item) => item.id === 'cancelar')!;
  return temChaveTarefa(permissoes, chavesQueLiberam(acao));
}

export function podeVerHistoricoTarefaPorChaves(permissoes: readonly string[]) {
  return temChaveTarefa(permissoes, [TAREFA_PERM.historico]);
}

export function podeVerAnexosTarefa({
  permissoes,
  designado,
}: {
  permissoes: readonly string[];
  designado: boolean;
}) {
  return designado || podeVerHistoricoTarefaPorChaves(permissoes);
}

export function podeAndamentoTarefaPorChaves(permissoes: readonly string[]) {
  const acao = TAREFA_PARIDADE.find((item) => item.id === 'andamento')!;
  return temChaveTarefa(permissoes, chavesQueLiberam(acao));
}

export function podeConcluirTarefaPorChaves(permissoes: readonly string[]) {
  const acao = TAREFA_PARIDADE.find((item) => item.id === 'concluir')!;
  return temChaveTarefa(permissoes, chavesQueLiberam(acao));
}
