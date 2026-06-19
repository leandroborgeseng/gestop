export const PERMISSION_ACTIONS = ['visualizar', 'inserir', 'alterar', 'excluir', 'executar'] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type PermissionFunctionDef = {
  id: string;
  label: string;
  actions: PermissionAction[];
};

export type PermissionScreenDef = {
  id: string;
  label: string;
  functions: PermissionFunctionDef[];
};

export const ADMINISTRADOR_SISTEMA_NOME = 'Administrador do Sistema';

export const PERMISSIONS_CATALOG: PermissionScreenDef[] = [
  {
    id: 'cco',
    label: 'CCO',
    functions: [
      { id: '_tela', label: 'CCO', actions: [...PERMISSION_ACTIONS] },
      { id: 'mapa', label: 'Mapa operacional', actions: ['visualizar'] },
      { id: 'consultar_proprios', label: 'Consultar próprios', actions: ['visualizar'] },
    ],
  },
  {
    id: 'vistoria_campo',
    label: 'Vistoria (campo)',
    functions: [
      { id: '_tela', label: 'Vistoria (campo)', actions: [...PERMISSION_ACTIONS] },
      { id: 'iniciar_vistoria', label: 'Iniciar vistoria', actions: ['executar'] },
      { id: 'gravar_enviar', label: 'Gravar e enviar vistoria', actions: ['inserir', 'executar'] },
      { id: 'concluir_vistoria', label: 'Concluir vistoria', actions: ['executar'] },
      { id: 'sincronizar', label: 'Sincronizar', actions: ['executar'] },
      { id: 'excluir_foto', label: 'Excluir foto', actions: ['excluir'] },
    ],
  },
  {
    id: 'vistorias',
    label: 'Vistorias realizadas',
    functions: [
      { id: '_tela', label: 'Vistorias realizadas', actions: [...PERMISSION_ACTIONS] },
      { id: 'consultar', label: 'Consultar vistorias', actions: ['visualizar'] },
      { id: 'exibir_questionario', label: 'Exibir questionário', actions: ['visualizar'] },
    ],
  },
  {
    id: 'chamados',
    label: 'Chamados',
    functions: [
      { id: '_tela', label: 'Chamados', actions: [...PERMISSION_ACTIONS] },
      { id: 'abrir_chamado', label: 'Abrir chamado', actions: ['visualizar', 'inserir'] },
      { id: 'salvar_chamado', label: 'Salvar chamado', actions: ['alterar', 'inserir'] },
      { id: 'alterar_status', label: 'Alterar status', actions: ['alterar', 'executar'] },
      { id: 'notificar_equipe', label: 'Notificar equipe', actions: ['executar'] },
      { id: 'emitir_ordem_servico', label: 'Emitir ordem de serviço', actions: ['visualizar', 'executar'] },
      { id: 'registrar_historico', label: 'Registrar histórico', actions: ['inserir'] },
      { id: 'editar_abertura', label: 'Editar abertura', actions: ['alterar'] },
      { id: 'programacao', label: 'Programação', actions: ['visualizar', 'alterar'] },
      { id: 'triagem', label: 'Triagem', actions: ['alterar'] },
      { id: 'exportar_pdf', label: 'Exportar PDF do chamado', actions: ['visualizar', 'executar'] },
      { id: 'execucao_manual', label: 'Lançamento manual de execução', actions: ['executar'] },
    ],
  },
  {
    id: 'execucao',
    label: 'Execução',
    functions: [
      { id: '_tela', label: 'Execução', actions: [...PERMISSION_ACTIONS] },
      { id: 'checkin', label: 'Check-in no local', actions: ['executar'] },
      { id: 'anexar_evidencia', label: 'Anexar evidência', actions: ['inserir'] },
      { id: 'concluir_execucao', label: 'Concluir execução', actions: ['executar'] },
      { id: 'lancamento_manual', label: 'Lançamento manual', actions: ['executar'] },
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    functions: [
      { id: '_tela', label: 'Dashboard', actions: [...PERMISSION_ACTIONS] },
      { id: 'indicadores', label: 'Indicadores', actions: ['visualizar'] },
    ],
  },
  {
    id: 'cronograma',
    label: 'Cronograma',
    functions: [
      { id: '_tela', label: 'Cronograma', actions: [...PERMISSION_ACTIONS] },
      { id: 'gerenciar', label: 'Gerenciar cronograma', actions: ['visualizar', 'inserir', 'alterar', 'excluir'] },
    ],
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    functions: [
      { id: '_tela', label: 'Relatórios', actions: [...PERMISSION_ACTIONS] },
      { id: 'exportar', label: 'Exportar relatórios', actions: ['visualizar', 'executar'] },
    ],
  },
  {
    id: 'checklists',
    label: 'Checklists',
    functions: [
      { id: '_tela', label: 'Checklists', actions: [...PERMISSION_ACTIONS] },
      { id: 'gerenciar', label: 'Gerenciar checklists', actions: ['visualizar', 'inserir', 'alterar', 'excluir'] },
    ],
  },
  {
    id: 'admin',
    label: 'Administração',
    functions: [
      { id: '_tela', label: 'Administração', actions: [...PERMISSION_ACTIONS] },
      { id: 'cadastros', label: 'Cadastros (secretarias, próprios, usuários)', actions: ['visualizar', 'inserir', 'alterar', 'excluir'] },
      { id: 'importacao', label: 'Importação webmap', actions: ['executar', 'visualizar'] },
    ],
  },
  {
    id: 'permissoes',
    label: 'Permissões',
    functions: [
      { id: '_tela', label: 'Permissões', actions: [...PERMISSION_ACTIONS] },
      { id: 'configurar', label: 'Configurar permissões por perfil', actions: ['visualizar', 'alterar'] },
      { id: 'criar_perfil', label: 'Criar perfil', actions: ['inserir'] },
    ],
  },
  {
    id: 'integracoes',
    label: 'Integrações',
    functions: [
      { id: '_tela', label: 'Integrações', actions: [...PERMISSION_ACTIONS] },
      { id: 'monitorar', label: 'Monitorar integrações', actions: ['visualizar', 'executar'] },
    ],
  },
];

export function permissionMatrixKey(telaId: string, funcaoId: string, acao: PermissionAction) {
  return `matriz.${telaId}.${funcaoId}.${acao}`;
}

export function isMatrixPermissionKey(chave: string) {
  return chave.startsWith('matriz.');
}

export function listCatalogMatrixKeys() {
  const keys: string[] = [];
  for (const tela of PERMISSIONS_CATALOG) {
    for (const funcao of tela.functions) {
      for (const acao of funcao.actions) {
        keys.push(permissionMatrixKey(tela.id, funcao.id, acao));
      }
    }
  }
  return keys;
}

export function catalogEntryForKey(chave: string) {
  if (!isMatrixPermissionKey(chave)) return null;
  const parts = chave.split('.');
  if (parts.length !== 4) return null;
  const [, telaId, funcaoId, acao] = parts;
  const tela = PERMISSIONS_CATALOG.find((item) => item.id === telaId);
  const funcao = tela?.functions.find((item) => item.id === funcaoId);
  if (!tela || !funcao || !funcao.actions.includes(acao as PermissionAction)) return null;
  return { tela, funcao, acao: acao as PermissionAction };
}

export function serializeCatalog() {
  return PERMISSIONS_CATALOG.map((tela) => ({
    id: tela.id,
    label: tela.label,
    functions: tela.functions.map((funcao) => ({
      id: funcao.id,
      label: funcao.label,
      actions: funcao.actions,
    })),
  }));
}
