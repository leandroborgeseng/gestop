/**
 * Perfis e chaves que o boot (sync-rbac) pode criar quando ainda não existem.
 * Vínculo inicial só entra na criação do perfil. Descrição já gravada não é reescrita.
 */

export const SYNC_RBAC_DEMO_USERS_ENV = 'SYNC_RBAC_DEMO_USERS';
export const SYNC_RBAC_DEMO_PASSWORD_ENV = 'SYNC_RBAC_DEMO_PASSWORD';

export const DEMO_GESTOR_EMAIL = 'gestor.educacao@franca.sp.gov.br';
export const DEMO_FACEF_EMAIL = 'admin@facef.br';

export function syncRbacDemoUsersEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env[SYNC_RBAC_DEMO_USERS_ENV] === 'true';
}

export const ADMINISTRADOR_SISTEMA_NOME = 'Administrador do Sistema';

/** Chaves legadas que o catálogo da matriz não materializa sozinho. */
export const PERMISSOES_FORA_DO_CATALOGO = [
  { chave: 'usuarios.gerenciar', descricao: 'Gerenciar usuarios e perfis', modulo: 'identidade' },
  { chave: 'secretarias.gerenciar', descricao: 'Gerenciar secretarias', modulo: 'cadastros' },
  { chave: 'unidades.gerenciar', descricao: 'Gerenciar proprios publicos', modulo: 'cadastros' },
  { chave: 'checklists.gerenciar', descricao: 'Criar e publicar checklists', modulo: 'fiscalizacao' },
  { chave: 'fiscalizacoes.executar', descricao: 'Executar fiscalizacoes em campo', modulo: 'fiscalizacao' },
  { chave: 'chamados.gerenciar', descricao: 'Gerenciar chamados operacionais', modulo: 'chamados' },
  { chave: 'chamados.executar', descricao: 'Executar chamados em campo', modulo: 'chamados' },
  { chave: 'chamados.editar_abertura', descricao: 'Editar informações de abertura do chamado', modulo: 'chamados' },
  { chave: 'chamados.execucao_manual', descricao: 'Lançar execução de chamado manualmente', modulo: 'chamados' },
  { chave: 'dashboard.visualizar', descricao: 'Visualizar indicadores operacionais', modulo: 'dashboard' },
  { chave: 'auditoria.visualizar', descricao: 'Visualizar trilhas de auditoria', modulo: 'auditoria' },
  { chave: 'secretaria.gerenciar', descricao: 'Gerenciar operacao da propria secretaria', modulo: 'operacao' },
] as const;

const CHAVES_ADMINISTRADOR = [
  'usuarios.gerenciar',
  'secretarias.gerenciar',
  'unidades.gerenciar',
  'checklists.gerenciar',
  'fiscalizacoes.executar',
  'chamados.gerenciar',
  'chamados.abrir',
  'chamados.executar',
  'chamados.editar_abertura',
  'chamados.execucao_manual',
  'meus_chamados.visualizar',
  'documentos.visualizar',
  'documentos.criar_avulso',
  'documentos.editar_vinculo',
  'documentos.gerar_pdf',
  'documentos.coletar_assinatura',
  'documentos.cancelar_assinado',
  'documentos.cancelar',
  'documentos.administrar',
  'dashboard.visualizar',
  'auditoria.visualizar',
] as const;

const CHAVES_GESTOR_SECRETARIA = [
  'secretaria.gerenciar',
  'chamados.gerenciar',
  'chamados.executar',
  'chamados.editar_abertura',
  'chamados.execucao_manual',
  'dashboard.visualizar',
  'documentos.visualizar',
  'documentos.gerar_pdf',
  'documentos.coletar_assinatura',
  'meus_chamados.visualizar',
  'documentos.criar_avulso',
  'documentos.editar_vinculo',
  'documentos.cancelar_assinado',
  'documentos.cancelar',
  'documentos.administrar',
] as const;

export const SOLICITACAO_CHAVES = [
  'matriz.chamados.abrir_chamado.visualizar',
  'matriz.chamados.abrir_chamado.inserir',
  'chamados.abrir',
  'matriz.meus_chamados._tela.visualizar',
  'matriz.meus_chamados.consultar.visualizar',
  'meus_chamados.visualizar',
] as const;

export type PerfilPadrao = {
  nome: string;
  descricao: string;
  administradorSistema: boolean;
  chaves: readonly string[];
};

export const PERFIS_PADRAO: readonly PerfilPadrao[] = [
  {
    nome: ADMINISTRADOR_SISTEMA_NOME,
    descricao: 'Acesso total ao SIGMA',
    administradorSistema: true,
    chaves: CHAVES_ADMINISTRADOR,
  },
  {
    nome: 'Gestor de Secretaria',
    descricao: 'Gestao operacional limitada a uma secretaria municipal',
    administradorSistema: false,
    chaves: CHAVES_GESTOR_SECRETARIA,
  },
  {
    nome: 'Solicitação',
    descricao: 'Abertura de chamados sem acesso à triagem ou gerenciamento',
    administradorSistema: false,
    chaves: SOLICITACAO_CHAVES,
  },
];

export function perfilPadraoPorNome(nome: string) {
  return PERFIS_PADRAO.find((perfil) => perfil.nome === nome);
}
