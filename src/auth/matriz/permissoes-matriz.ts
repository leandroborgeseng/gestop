/**
 * 285 fase 1 — Matriz central de permissões por rota (legível por máquina).
 *
 * Cada rota HTTP registrada no Nest tem exatamente uma entrada, com a chave
 * canônica `MÉTODO /caminho/:param` (ver `rotas-descoberta.ts`).
 *
 * Tipos de entrada:
 * - `publico`: sem sessão (login, health, rotas públicas, webhooks com segredo próprio).
 * - `sessao`: exige só sessão válida (ações sobre a própria conta).
 * - `permissao`: exige QUALQUER uma das `chaves` da matriz (`matriz.tela.funcao.acao`),
 *   calculadas a partir do perfil ATIVO + permissões diretas do usuário.
 * - `dono-registro`: exige sessão e a verificação de permissão + escopo do registro dono
 *   é feita pelo serviço indicado (ex.: GET /storage).
 * - `leitura-legada`: GET somente-leitura, sem efeito. Na fase 1 mantém a regra atual
 *   (decoradores @RequirePermissions/@RequireAnyPermissions e checagens do serviço),
 *   avaliada pelo mesmo guard global. Migração para a matriz fina fica para a fase 2.
 *
 * Rotas que alteram dados (POST/PUT/PATCH/DELETE) e GETs com efeito (exportação,
 * relatório, download, pacote offline) NÃO podem ser `leitura-legada` — o teste de
 * cobertura falha.
 *
 * Para mudar a regra de uma ação, edite a entrada correspondente (ou as constantes
 * isoladas `REGRA_GERAR_RELATORIO` / `REGRA_VISTORIA_OFFLINE`) e rode
 * `npx tsx scripts/gerar-matriz-permissoes-json.ts` para atualizar o JSON.
 */
import type { PermissionAction } from '../../domain/permissions-catalog';

export const MENSAGEM_SEM_PERMISSAO = 'Você não possui permissão para executar esta ação.';

export type EfeitoRota = 'mutacao' | 'exportacao' | 'relatorio' | 'download' | 'offline' | 'leitura' | 'sessao';
/** `secretaria-ativa`: a sessão precisa ter ao menos uma secretaria no escopo (ou visão global). */
export type EscopoRota = 'secretaria-ativa' | 'nenhum';

export type RegraPermissao = {
  tipo: 'permissao';
  /** Rotina dona da ação (`tela.funcao`). Ações aninhadas usam a rotina dona (ex.: tarefa → chamados.tarefas). */
  rotina: string;
  acao: PermissionAction;
  /** Basta uma destas chaves (efetivas) para autorizar. */
  chaves: string[];
  efeito: EfeitoRota;
  escopo: EscopoRota;
  nota?: string;
};

export type EntradaMatriz =
  | { tipo: 'publico'; efeito: EfeitoRota; nota: string }
  | { tipo: 'sessao'; efeito: EfeitoRota; nota: string }
  | { tipo: 'dono-registro'; efeito: EfeitoRota; verificador: string; nota: string }
  | { tipo: 'leitura-legada'; efeito: 'leitura'; nota?: string }
  | RegraPermissao;

export const chaveMatriz = (tela: string, funcao: string, acao: PermissionAction) => `matriz.${tela}.${funcao}.${acao}`;

/**
 * Regra para uma ação de uma função do catálogo. Por padrão aceita também a mesma ação
 * na tela inteira (`_tela`), como a tela de Permissões apresenta.
 */
export function regra(
  tela: string,
  funcao: string,
  acao: PermissionAction,
  opts: { efeito?: EfeitoRota; escopo?: EscopoRota; tambem?: string[]; semTela?: boolean; nota?: string } = {},
): RegraPermissao {
  const chaves = [chaveMatriz(tela, funcao, acao)];
  if (!opts.semTela && funcao !== '_tela') chaves.push(chaveMatriz(tela, '_tela', acao));
  for (const extra of opts.tambem ?? []) if (!chaves.includes(extra)) chaves.push(extra);
  return {
    tipo: 'permissao',
    rotina: `${tela}.${funcao}`,
    acao,
    chaves,
    efeito: opts.efeito ?? 'mutacao',
    escopo: opts.escopo ?? 'secretaria-ativa',
    ...(opts.nota ? { nota: opts.nota } : {}),
  };
}

const publico = (nota: string, efeito: EfeitoRota = 'leitura'): EntradaMatriz => ({ tipo: 'publico', efeito, nota });
const sessao = (nota: string): EntradaMatriz => ({ tipo: 'sessao', efeito: 'sessao', nota });
const leitura = (nota?: string): EntradaMatriz => ({ tipo: 'leitura-legada', efeito: 'leitura', ...(nota ? { nota } : {}) });
const admin = (funcao: string, acao: PermissionAction, tambem: string[] = []) =>
  regra('admin', funcao, acao, { escopo: 'nenhum', tambem });
const adminCadastro = (funcao: string, acao: PermissionAction) =>
  admin(funcao, acao, [chaveMatriz('admin', 'cadastros', acao)]);

/** D-285a: gerar relatório exige Executar. Entrada isolada para ajuste fácil. */
export const REGRA_GERAR_RELATORIO = (): RegraPermissao =>
  regra('relatorios', 'exportar', 'executar', { efeito: 'relatorio', nota: 'D-285a: gerar relatório exige Executar.' });

/** D-285b: baixar dados para uso offline (pacote de campo) exige Executar. Entrada isolada. */
export const REGRA_VISTORIA_OFFLINE = (): RegraPermissao =>
  regra('vistoria_campo', 'sincronizar', 'executar', {
    efeito: 'offline',
    tambem: [chaveMatriz('vistoria_campo', 'iniciar_vistoria', 'executar')],
    nota: 'D-285b: baixar dados para vistoria offline exige Executar.',
  });

/** D-285b: realizar (gravar/enviar/sincronizar) vistoria exige Executar. */
export const REGRA_REALIZAR_VISTORIA = (): RegraPermissao =>
  regra('vistoria_campo', 'gravar_enviar', 'executar', {
    tambem: [chaveMatriz('vistoria_campo', 'sincronizar', 'executar')],
    nota: 'D-285b: realizar vistoria exige Executar.',
  });

/**
 * Tarefas do chamado: a rotina dona é `chamados.tarefas`. A aba Tarefas da Execução
 * (`execucao.tarefas`) é um ponto de entrada da mesma rotina e aceita as mesmas ações.
 * O legado `chamados.executar` NÃO autoriza diretamente: ele só vale pela expansão
 * legada→matriz (que concede `execucao.tarefas.executar`). Resolve a sobreposição
 * tarefas.executar × chamados.* em um só lugar.
 */
const TAREFAS_TRATAR = [
  chaveMatriz('chamados', 'tarefas', 'executar'),
  chaveMatriz('chamados', 'tarefas', 'alterar'),
  chaveMatriz('chamados', 'tarefas_andamento', 'executar'),
  chaveMatriz('chamados', 'tarefas_concluir', 'executar'),
  chaveMatriz('chamados', 'tarefas_cancelar', 'executar'),
  chaveMatriz('execucao', 'tarefas', 'alterar'),
  chaveMatriz('execucao', 'tarefas', 'executar'),
];
const TAREFAS_ANDAMENTO = [
  chaveMatriz('chamados', 'tarefas', 'executar'),
  chaveMatriz('chamados', 'tarefas_andamento', 'executar'),
  chaveMatriz('chamados', 'tarefas_concluir', 'executar'),
  chaveMatriz('execucao', 'tarefas', 'executar'),
];

/** Documento preenchido/concluído (avulso ou vinculado a chamado/vistoria) pertence à rotina Documentos. */
const DOCUMENTO_PREENCHER = [chaveMatriz('documentos', 'administrar', 'alterar'), chaveMatriz('documentos', '_tela', 'alterar')];
const DOCUMENTO_VER = [
  chaveMatriz('documentos', '_tela', 'visualizar'),
  chaveMatriz('meus_chamados', 'consultar_documentos', 'visualizar'),
];

export const PERMISSOES_MATRIZ: Record<string, EntradaMatriz> = {
  // ── Raiz / health / públicos ────────────────────────────────────────────────
  'GET /': publico('Raiz da API.'),
  'GET /health': publico('Health check.'),
  'GET /health/db': publico('Health check do banco.'),
  'GET /health/storage': publico('Health check do storage.'),
  'GET /notificacoes/push/vapid-public-key': publico('Chave pública VAPID.'),
  'GET /public/chamados/protocolo/:codigo': publico('Consulta pública por protocolo.'),
  'GET /public/documentos/validar-por-documento': publico('Validação pública de documento.'),
  'GET /public/documentos/validar/:codigo': publico('Validação pública de documento.'),
  'GET /public/tipos-chamado': publico('Tipos de chamado públicos.'),
  'GET /public/unidades/:codigo': publico('Próprio público (QR code).'),
  'POST /public/unidades/:codigo/chamados': publico('Abertura pública de chamado (cidadão).', 'mutacao'),
  'POST /admin/importacao/webmap/automation/cron': publico('Automação: protegida por segredo próprio (cron).', 'mutacao'),
  'POST /admin/importacao/webmap/automation/webhook': publico('Automação: protegida por assinatura do webhook.', 'mutacao'),

  // ── Auth (própria conta) ────────────────────────────────────────────────────
  'POST /auth/login': publico('Login.', 'sessao'),
  'POST /auth/forgot-password': publico('Recuperação de senha.', 'sessao'),
  'POST /auth/reset-password': publico('Redefinição de senha por token.', 'sessao'),
  'GET /auth/me': sessao('Dados da própria sessão.'),
  'POST /auth/change-password': sessao('Troca da própria senha.'),
  'POST /auth/logout': sessao('Logoff.'),
  'POST /auth/perfil-ativo': sessao('Troca do perfil ativo entre perfis ATIVOS do próprio usuário.'),
  'POST /auth/secretaria-ativa': sessao('Troca da secretaria ativa entre as autorizadas.'),
  'POST /notificacoes/push/subscribe': sessao('Inscrição push do próprio dispositivo.'),
  'POST /notificacoes/push/unsubscribe': sessao('Cancelamento push do próprio dispositivo.'),

  // ── Administração ───────────────────────────────────────────────────────────
  'GET /admin/auditoria/config': leitura(),
  'GET /admin/auditoria/logs': leitura(),
  'PUT /admin/auditoria/config': admin('auditoria', 'alterar'),
  'GET /admin/backup': leitura(),
  'GET /admin/backup/objects': leitura(),
  'PUT /admin/backup': admin('backup', 'alterar'),
  'POST /admin/backup/run': admin('backup', 'executar'),
  'POST /admin/backup/restore': admin('backup', 'executar'),
  'GET /admin/email': leitura(),
  'PUT /admin/email': admin('email', 'alterar'),
  'POST /admin/email/teste': admin('email', 'executar'),
  'GET /admin/cargos': leitura(),
  'POST /admin/cargos': admin('cargos', 'inserir'),
  'PUT /admin/cargos/:id': admin('cargos', 'alterar'),
  'DELETE /admin/cargos/:id': admin('cargos', 'excluir'),
  'GET /admin/categorias-vistoria': leitura(),
  'POST /admin/categorias-vistoria': admin('categorias_vistoria', 'inserir'),
  'PUT /admin/categorias-vistoria/:id': admin('categorias_vistoria', 'alterar'),
  'DELETE /admin/categorias-vistoria/:id': admin('categorias_vistoria', 'excluir'),
  'GET /admin/equipes': leitura(),
  'POST /admin/equipes': admin('equipes', 'inserir'),
  'PUT /admin/equipes/:id': admin('equipes', 'alterar'),
  'DELETE /admin/equipes/:id': admin('equipes', 'excluir'),
  'GET /admin/secretarias': leitura(),
  'POST /admin/secretarias': adminCadastro('secretarias', 'inserir'),
  'PUT /admin/secretarias/:id': adminCadastro('secretarias', 'alterar'),
  'DELETE /admin/secretarias/:id': adminCadastro('secretarias', 'excluir'),
  'GET /admin/tipos-chamado': leitura(),
  'POST /admin/tipos-chamado': admin('tipos_chamado', 'inserir'),
  'PUT /admin/tipos-chamado/:id': admin('tipos_chamado', 'alterar'),
  'DELETE /admin/tipos-chamado/:id': admin('tipos_chamado', 'excluir'),
  'GET /admin/tipos-proprio': leitura(),
  'POST /admin/tipos-proprio': admin('tipos_proprio', 'inserir'),
  'PUT /admin/tipos-proprio/:id': admin('tipos_proprio', 'alterar'),
  'DELETE /admin/tipos-proprio/:id': admin('tipos_proprio', 'excluir'),
  'GET /admin/unidades': leitura(),
  'POST /admin/unidades': adminCadastro('proprios', 'inserir'),
  'PUT /admin/unidades/:id': adminCadastro('proprios', 'alterar'),
  'DELETE /admin/unidades/:id': adminCadastro('proprios', 'excluir'),
  'GET /admin/usuarios': leitura(),
  'GET /admin/usuarios/:id/matriz': leitura(),
  'POST /admin/usuarios': adminCadastro('usuarios', 'inserir'),
  'PUT /admin/usuarios/:id': adminCadastro('usuarios', 'alterar'),
  'DELETE /admin/usuarios/:id': adminCadastro('usuarios', 'excluir'),
  'PUT /admin/usuarios/:id/matriz': admin('usuarios', 'alterar', [chaveMatriz('permissoes', 'configurar', 'alterar')]),
  'GET /admin/perfis': leitura(),
  'GET /admin/perfis/configuraveis': leitura(),
  'GET /admin/perfis/:id/matriz': leitura(),
  'GET /admin/permissoes/catalogo': leitura(),
  'POST /admin/perfis': admin('permissoes', 'inserir', [chaveMatriz('permissoes', 'criar_perfil', 'inserir')]),
  'PUT /admin/perfis/:id': admin('permissoes', 'alterar', [chaveMatriz('permissoes', 'configurar', 'alterar')]),
  'PUT /admin/perfis/:id/ativo': admin('permissoes', 'alterar', [chaveMatriz('permissoes', 'configurar', 'alterar')]),
  'PUT /admin/perfis/:id/matriz': admin('permissoes', 'alterar', [chaveMatriz('permissoes', 'configurar', 'alterar')]),
  'GET /admin/importacao/webmap/status': leitura(),
  'POST /admin/importacao/secretarias/sync': admin('importacao', 'executar'),
  'POST /admin/importacao/webmap/preview': admin('importacao', 'executar'),
  'POST /admin/importacao/webmap/apply': admin('importacao', 'executar'),
  'POST /admin/importacao/webmap/sync': admin('importacao', 'executar'),
  'POST /admin/importacao/webmap/sync-all': admin('importacao', 'executar'),
  'POST /lgpd/auditoria/purge': admin('auditoria', 'executar'),
  'POST /lgpd/usuarios/:id/anonymize': admin('usuarios', 'excluir'),

  // ── Chamados ────────────────────────────────────────────────────────────────
  'GET /chamados': leitura(),
  'GET /chamados/:id': leitura(),
  'GET /chamados/:id/execucao': leitura(),
  'GET /chamados/em-execucao': leitura(),
  'GET /chamados/equipes/execucao': leitura(),
  'GET /chamados/equipes/opcoes': leitura(),
  'GET /chamados/programacao': leitura(),
  'GET /chamados/secretarias/execucao': leitura(),
  'GET /chamados/tipos/opcoes': leitura(),
  'GET /chamados/usuarios/ativos': leitura(),
  'GET /chamados/:id/pdf': regra('chamados', 'exportar_pdf', 'executar', { efeito: 'exportacao' }),
  'POST /chamados/ordens-servico/lote.pdf': regra('chamados', 'emitir_ordem_servico', 'executar', { efeito: 'exportacao' }),
  'POST /chamados': regra('chamados', 'abrir_chamado', 'inserir'),
  'PUT /chamados/:id/abertura': regra('chamados', 'editar_abertura', 'alterar'),
  'PUT /chamados/:id/atribuicao': regra('chamados', 'triagem', 'alterar', {
    tambem: [chaveMatriz('chamados', 'salvar_chamado', 'alterar')],
  }),
  'PUT /chamados/:id/observadores': regra('chamados', 'salvar_chamado', 'alterar'),
  'PUT /chamados/:id/planejamento': regra('chamados', 'programacao', 'alterar'),
  'PUT /chamados/:id/status': regra('chamados', 'alterar_status', 'alterar', {
    tambem: [chaveMatriz('chamados', 'alterar_status', 'executar')],
  }),
  'PUT /chamados/:id/triagem': regra('chamados', 'triagem', 'alterar'),
  'POST /chamados/:id/historico': regra('chamados', 'registrar_historico', 'inserir'),
  'POST /chamados/:id/notificar-equipe': regra('chamados', 'notificar_equipe', 'executar'),
  'POST /chamados/:id/exclusao-logica': regra('chamados', 'excluir_logicamente', 'excluir', { semTela: true }),
  'POST /chamados/:id/restaurar-exclusao': regra('chamados', 'restaurar_excluido', 'alterar', { semTela: true }),
  'POST /chamados/:id/execucao/checkin': regra('execucao', 'checkin', 'executar'),
  'POST /chamados/:id/execucao/concluir': regra('execucao', 'concluir_execucao', 'executar'),
  'POST /chamados/:id/execucao/evidencias': regra('execucao', 'anexar_evidencia', 'inserir'),
  'DELETE /chamados/:id/execucao/evidencias/:evidenciaId': regra('execucao', 'anexar_evidencia', 'inserir', {
    tambem: [chaveMatriz('execucao', '_tela', 'excluir')],
    nota: 'Remover a própria evidência durante a execução.',
  }),
  'POST /chamados/:id/execucao/manual': regra('chamados', 'execucao_manual', 'executar', {
    tambem: [chaveMatriz('execucao', 'lancamento_manual', 'executar')],
  }),

  // ── Tarefas do chamado (rotina chamados.tarefas) ───────────────────────────
  'GET /chamado-tarefas/opcoes': leitura('Checagem fina no serviço.'),
  'GET /chamado-tarefas/execucao': leitura('Checagem fina no serviço.'),
  'GET /chamado-tarefas/por-chamado/:chamadoId': leitura('Checagem fina no serviço.'),
  'GET /chamado-tarefas/:id': leitura('Checagem fina no serviço.'),
  'GET /chamado-tarefas/:id/chamado/:chamadoId': leitura('Checagem fina no serviço.'),
  'GET /chamado-tarefas/relatorio': REGRA_GERAR_RELATORIO(),
  'GET /chamado-tarefas/relatorio.csv': REGRA_GERAR_RELATORIO(),
  'GET /chamado-tarefas/relatorio.pdf': REGRA_GERAR_RELATORIO(),
  'GET /chamado-tarefas/relatorio.xlsx': REGRA_GERAR_RELATORIO(),
  'POST /chamado-tarefas': regra('chamados', 'tarefas', 'inserir'),
  'PATCH /chamado-tarefas/:id': {
    ...regra('chamados', 'tarefas', 'executar', { tambem: TAREFAS_TRATAR }),
    nota: 'Tratar tarefa (inclusive pela Execução). O serviço refina por campo/transição.',
  },
  'POST /chamado-tarefas/:id/anexos': regra('chamados', 'tarefas_andamento', 'executar', { tambem: TAREFAS_ANDAMENTO }),

  // ── Meus chamados ───────────────────────────────────────────────────────────
  'GET /meus-chamados': leitura(),
  'GET /meus-chamados/:id': leitura(),
  'GET /meus-chamados/usuarios/opcoes': leitura(),
  'POST /meus-chamados/:id/observadores': regra('meus_chamados', 'cadastrar_observadores', 'inserir', { semTela: true }),
  'PUT /meus-chamados/:id/observadores': regra('meus_chamados', 'cadastrar_observadores', 'inserir', { semTela: true }),
  'DELETE /meus-chamados/:id/observadores/:usuarioId': regra('meus_chamados', 'cadastrar_observadores', 'inserir', {
    semTela: true,
  }),

  // ── Checklists ──────────────────────────────────────────────────────────────
  'GET /checklists': leitura(),
  'GET /checklists/:id': leitura(),
  'GET /checklists/secretarias': leitura(),
  'GET /checklists/tipos-proprio/opcoes': leitura(),
  'POST /checklists': regra('checklists', 'gerenciar', 'inserir', { escopo: 'nenhum' }),
  'POST /checklists/:id/versions': regra('checklists', 'gerenciar', 'inserir', { escopo: 'nenhum' }),
  'PUT /checklists/:id': regra('checklists', 'gerenciar', 'alterar', { escopo: 'nenhum' }),
  'PUT /checklists/versions/:versionId': regra('checklists', 'gerenciar', 'alterar', { escopo: 'nenhum' }),
  'POST /checklists/versions/:versionId/publish': regra('checklists', 'gerenciar', 'alterar', { escopo: 'nenhum' }),
  'DELETE /checklists/:id': regra('checklists', 'gerenciar', 'excluir', { escopo: 'nenhum' }),

  // ── Cronograma ──────────────────────────────────────────────────────────────
  'GET /cronograma': leitura(),
  'GET /cronograma/calendario': leitura(),
  'GET /cronograma/checklists': leitura(),
  'POST /cronograma': regra('cronograma', 'gerenciar', 'inserir'),
  'PUT /cronograma/:id': regra('cronograma', 'gerenciar', 'alterar'),
  'DELETE /cronograma/:id': regra('cronograma', 'gerenciar', 'excluir'),

  // ── Documentos (ações aninhadas em chamado/vistoria também caem aqui) ──────
  'GET /documentos': leitura(),
  'GET /documentos/:id': leitura('Checagem de escopo no serviço.'),
  'GET /documentos/chamados-busca': leitura(),
  'GET /documentos/checklists-avulso': leitura(),
  'GET /documentos/minhas-pendencias-assinatura': leitura('Pendências do próprio usuário.'),
  'GET /documentos/pendencias-resumo': leitura('Pendências do próprio usuário.'),
  'GET /documentos/por-chamado/:chamadoId': leitura(),
  'GET /documentos/por-fiscalizacao/:fiscalizacaoId': leitura(),
  'GET /documentos/signatarios-internos': leitura(),
  'GET /documentos/:id/pdf/original': regra('documentos', 'consultar', 'visualizar', {
    efeito: 'download',
    tambem: DOCUMENTO_VER,
    nota: 'Download do PDF; escopo do documento conferido no serviço.',
  }),
  'GET /documentos/:id/pdf/assinado': regra('documentos', 'consultar', 'visualizar', {
    efeito: 'download',
    tambem: DOCUMENTO_VER,
    nota: 'Download do PDF; escopo do documento conferido no serviço.',
  }),
  'POST /documentos/avulso': regra('documentos', 'avulso', 'inserir', {
    nota: 'Criar documento (avulso ou dentro de chamado/vistoria) exige Documentos › Inserir.',
  }),
  'PATCH /documentos/:id/respostas': regra('documentos', 'avulso', 'inserir', { tambem: DOCUMENTO_PREENCHER }),
  'POST /documentos/:id/concluir': regra('documentos', 'avulso', 'inserir', { tambem: DOCUMENTO_PREENCHER }),
  'PATCH /documentos/:id/vinculos': regra('documentos', 'editar_vinculo', 'alterar'),
  'POST /documentos/:id/gerar-pdf': regra('documentos', 'gerar_pdf', 'executar', { efeito: 'exportacao' }),
  'POST /documentos/:id/assinatura': regra('documentos', 'coletar_assinatura', 'executar'),
  'POST /documentos/:id/assinatura-pendente': regra('documentos', 'coletar_assinatura', 'executar'),
  'POST /documentos/:id/assinatura-interna': regra('documentos', 'assinar_interno', 'executar', {
    nota: 'Assinar internamente. O serviço confere se o usuário é o signatário do pedido.',
  }),
  'POST /documentos/pedidos-assinatura/:pedidoId/recusar': regra('documentos', 'assinar_interno', 'executar'),
  'POST /documentos/:id/disponibilizar-assinatura': regra('documentos', 'disponibilizar_assinatura', 'executar'),
  'POST /documentos/pedidos-assinatura/:pedidoId/retirar': regra('documentos', 'disponibilizar_assinatura', 'executar'),
  'POST /documentos/:id/cancelar-assinado': regra('documentos', 'cancelar_assinado', 'executar'),
  // 287 (fase futura): 'POST /documentos/:id/cancelar': regra('documentos', 'cancelar', 'executar'),

  // ── Vistorias / campo ───────────────────────────────────────────────────────
  'GET /fiscalizacoes': leitura(),
  'GET /fiscalizacoes/:id': leitura(),
  'GET /fiscalizacoes/opcoes-manuais': leitura(),
  'GET /fiscalizacoes/:id/pdf': regra('vistorias', 'exibir_questionario', 'visualizar', {
    efeito: 'exportacao',
    tambem: [chaveMatriz('vistorias', 'consultar', 'visualizar')],
  }),
  'POST /fiscalizacoes/imprimir-manual': regra('vistoria_campo', 'iniciar_vistoria', 'executar', { efeito: 'exportacao' }),
  'POST /fiscalizacoes/lancamento-manual': REGRA_REALIZAR_VISTORIA(),
  'POST /mobile/sync/fiscalizacoes': REGRA_REALIZAR_VISTORIA(),
  'GET /mobile/field-package': REGRA_VISTORIA_OFFLINE(),
  'GET /mobile/unidades/:id/chamados-pendentes': leitura(),
  'GET /mobile/vistorias-programadas': leitura(),

  // ── Operacional / monitoramento / integrações ──────────────────────────────
  'GET /operacional/bairros': leitura(),
  'GET /operacional/chamados-mapa': leitura(),
  'GET /operacional/opcoes-filtro': leitura(),
  'GET /operacional/resumo': leitura(),
  'GET /operacional/secretarias': leitura(),
  'GET /operacional/unidades': leitura(),
  'GET /operacional/unidades/:id': leitura(),
  'GET /operacional/unidades/:id/chamados-para-vincular': leitura(),
  'POST /operacional/nao-conformidades/:id/baixa': regra('cco', '_tela', 'executar', {
    tambem: [chaveMatriz('chamados', 'triagem', 'alterar')],
  }),
  'POST /operacional/nao-conformidades/:id/vincular-chamado': regra('chamados', 'salvar_chamado', 'alterar', {
    tambem: [chaveMatriz('cco', '_tela', 'executar')],
  }),
  'GET /monitoramento/alertas': leitura(),
  'GET /monitoramento/auditoria': leitura(),
  'GET /monitoramento/dashboard': leitura(),
  'POST /notificacoes/alertas/disparar': regra('dashboard', '_tela', 'executar'),
  'GET /integracoes/eventos': leitura(),
  'POST /integracoes/notificar': regra('integracoes', 'monitorar', 'executar', { escopo: 'nenhum' }),
  'POST /integracoes/sync/retry': regra('integracoes', 'monitorar', 'executar', { escopo: 'nenhum' }),
  'POST /integracoes/sync/:id/retry': regra('integracoes', 'monitorar', 'executar', { escopo: 'nenhum' }),
  'POST /integracoes/sync/:id/ignorar': regra('integracoes', 'monitorar', 'executar', { escopo: 'nenhum' }),

  // ── Relatórios (D-285a) ─────────────────────────────────────────────────────
  ...Object.fromEntries(
    ['chamados', 'chamados-produtividade', 'cronograma-cobertura', 'fiscalizacoes', 'ordens-servico', 'unidades'].flatMap(
      (nome) =>
        ['csv', 'pdf', 'xlsx']
          .filter((ext) => !(nome === 'ordens-servico' && ext === 'xlsx'))
          .map((ext) => [`GET /relatorios/export/${nome}.${ext}`, REGRA_GERAR_RELATORIO()] as const),
    ),
  ),

  // ── Storage (download de anexos) ────────────────────────────────────────────
  'GET /storage/{*splat}': {
    tipo: 'dono-registro',
    efeito: 'download',
    verificador: 'StorageAcessoService.assertPodeBaixar',
    nota: 'Exige permissão de visualizar a rotina do registro dono do arquivo e o escopo de Secretaria dele.',
  },
};

export const METODOS_MUTACAO = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Entrada exige alguma checagem além de leitura legada? (para o teste de cobertura). */
export function entradaCobreEfeito(entrada: EntradaMatriz) {
  return entrada.tipo !== 'leitura-legada';
}

/** GETs considerados com efeito (exportar, gerar relatório, download, offline) — por padrão de caminho. */
export function rotaGetComEfeito(caminho: string) {
  return (
    /\.(csv|pdf|xlsx)$/.test(caminho) ||
    /\/pdf(\/|$)/.test(caminho) ||
    /\/relatorio(\.|$)/.test(caminho) ||
    /\/export(\/|$)/.test(caminho) ||
    caminho.startsWith('/storage') ||
    caminho === '/mobile/field-package'
  );
}
