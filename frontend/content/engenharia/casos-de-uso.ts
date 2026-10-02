/** Casos de uso derivados das rotas do frontend e dos controllers NestJS existentes. */

export type AtorSistema = {
  id: string;
  nome: string;
  descricao: string;
};

export type CasoDeUso = {
  id: string;
  nome: string;
  atores: string[];
  descricao: string;
  rotas: string[];
};

export type GrupoCasosDeUso = {
  id: string;
  titulo: string;
  casos: CasoDeUso[];
};

export const ATORES: AtorSistema[] = [
  {
    id: 'administrador',
    nome: 'Administrador do Sistema',
    descricao:
      'Perfil ativo com esse nome. Enxerga a administração inteira e passa nas checagens que tratam o administrador de sistema como exceção.',
  },
  {
    id: 'gestor',
    nome: 'Gestor da secretaria',
    descricao:
      'Usuário interno com permissões de gestão (chamados, CCO, documentos, relatórios). O que ele vê fica limitado à secretaria ativa, salvo acesso a todas.',
  },
  {
    id: 'equipe',
    nome: 'Equipe de execução',
    descricao:
      'Agente de campo ou membro de equipe com execução de chamado e vistoria. Trata o que foi atribuído à sua equipe ou a ele.',
  },
  {
    id: 'solicitante',
    nome: 'Solicitante interno',
    descricao: 'Usuário autenticado que abre chamado e acompanha os próprios registros e os que observa.',
  },
  {
    id: 'externo',
    nome: 'Perfil externo',
    descricao:
      'Usuário autenticado cujo perfil ativo tem natureza EXTERNO. Na abertura, só encaminha o chamado para secretarias vinculadas ao tipo.',
  },
  {
    id: 'cidadao',
    nome: 'Cidadão',
    descricao:
      'Acesso sem login às rotas públicas: abertura pelo código da unidade, consulta de protocolo e validação de documento.',
  },
];

export const GRUPOS_CASOS: GrupoCasosDeUso[] = [
  {
    id: 'acesso',
    titulo: 'Acesso',
    casos: [
      {
        id: 'autenticar',
        nome: 'Autenticar',
        atores: ['administrador', 'gestor', 'equipe', 'solicitante', 'externo'],
        descricao: 'Entrar com e-mail e senha e encerrar a sessão.',
        rotas: ['/login', 'POST /auth/login', 'GET /auth/me', 'POST /auth/logout'],
      },
      {
        id: 'trocar-contexto',
        nome: 'Trocar perfil e secretaria',
        atores: ['administrador', 'gestor', 'equipe', 'solicitante', 'externo'],
        descricao: 'Escolher o perfil ativo e a secretaria ativa da sessão.',
        rotas: ['/conta', 'POST /auth/perfil-ativo', 'POST /auth/secretaria-ativa'],
      },
      {
        id: 'recuperar-senha',
        nome: 'Recuperar senha',
        atores: ['administrador', 'gestor', 'equipe', 'solicitante', 'externo'],
        descricao: 'Pedir redefinição sem sessão ou trocar a senha já autenticado.',
        rotas: ['/recuperar-senha', '/redefinir-senha', 'POST /auth/forgot-password', 'POST /auth/reset-password', 'POST /auth/change-password'],
      },
    ],
  },
  {
    id: 'chamados',
    titulo: 'Chamados',
    casos: [
      {
        id: 'abrir-chamado',
        nome: 'Abrir chamado',
        atores: ['gestor', 'solicitante', 'externo', 'equipe'],
        descricao:
          'Registrar demanda interna. O perfil externo só escolhe secretaria vinculada ao tipo. A vistoria também pode abrir chamado.',
        rotas: ['/chamados/novo', 'POST /chamados', 'GET /chamados/tipos/opcoes'],
      },
      {
        id: 'abrir-publico',
        nome: 'Abrir chamado público',
        atores: ['cidadao'],
        descricao: 'Abrir demanda a partir do código patrimonial da unidade, sem autenticação.',
        rotas: ['/chamado/[codigo]', 'GET /public/unidades/:codigo', 'POST /public/unidades/:codigo/chamados'],
      },
      {
        id: 'consultar-protocolo',
        nome: 'Consultar protocolo',
        atores: ['cidadao'],
        descricao: 'Acompanhar o andamento pelo código do protocolo, sem autenticação.',
        rotas: ['/chamado/protocolo', '/chamado/protocolo/[codigo]', 'GET /public/chamados/protocolo/:codigo'],
      },
      {
        id: 'triar',
        nome: 'Triar e atribuir',
        atores: ['administrador', 'gestor'],
        descricao: 'Mudar status, triagem, atribuição, planejamento, abertura, observadores e aviso à equipe.',
        rotas: ['/chamados', 'GET /chamados', 'PUT /chamados/:id/triagem', 'PUT /chamados/:id/atribuicao', 'PUT /chamados/:id/planejamento'],
      },
      {
        id: 'meus-chamados',
        nome: 'Acompanhar meus chamados',
        atores: ['solicitante', 'gestor'],
        descricao: 'Ver chamados abertos pelo usuário ou em que ele é observador, e gerir observadores do próprio chamado.',
        rotas: ['/meus-chamados', 'GET /meus-chamados', 'PUT /meus-chamados/:id/observadores'],
      },
      {
        id: 'executar',
        nome: 'Executar chamado',
        atores: ['equipe', 'gestor'],
        descricao: 'Check-in, evidências e conclusão da ordem em execução.',
        rotas: ['/execucao', '/execucao/[id]', 'POST /chamados/:id/execucao/checkin', 'POST /chamados/:id/execucao/evidencias', 'POST /chamados/:id/execucao/concluir'],
      },
      {
        id: 'execucao-manual',
        nome: 'Lançar execução manual',
        atores: ['equipe', 'gestor'],
        descricao: 'Registrar a execução sem o fluxo de campo, quando a permissão de execução manual existe.',
        rotas: ['/execucao/[id]', 'POST /chamados/:id/execucao/manual'],
      },
      {
        id: 'excluir-chamado',
        nome: 'Excluir ou restaurar chamado',
        atores: ['administrador', 'gestor'],
        descricao: 'Exclusão lógica e restauração. O administrador de sistema sempre pode; os demais dependem da matriz.',
        rotas: ['/chamados', 'POST /chamados/:id/exclusao-logica', 'POST /chamados/:id/restaurar-exclusao'],
      },
      {
        id: 'atribuir-tarefa',
        nome: 'Atribuir tarefa',
        atores: ['administrador', 'gestor'],
        descricao: 'Criar tarefa do chamado (status Nova). Alterar título, descrição, secretaria, equipe, responsável, prazo e prioridade exige permissão específica de alterar dados.',
        rotas: ['/chamados', 'GET /chamado-tarefas/por-chamado/:chamadoId', 'POST /chamado-tarefas', 'POST /chamado-tarefas/:id/anexos'],
      },
      {
        id: 'tratar-tarefa',
        nome: 'Tratar tarefa atribuída',
        atores: ['equipe', 'gestor'],
        descricao: 'Abrir a tarefa registra visualização (Nova vira Visualizada na primeira abertura autorizada). Andamento, conclusão e cancelamento gravam texto obrigatório e anexos no histórico. Impedida não é mais atribuída; registros antigos continuam consultáveis.',
        rotas: ['/execucao', 'GET /chamado-tarefas/execucao', 'PATCH /chamado-tarefas/:id'],
      },
      {
        id: 'relatorio-tarefas',
        nome: 'Relatório de tarefas',
        atores: ['administrador', 'gestor'],
        descricao: 'Consultar o consolidado de tarefas na área de relatórios.',
        rotas: ['/relatorios', 'GET /chamado-tarefas/relatorio'],
      },
    ],
  },
  {
    id: 'vistorias',
    titulo: 'Vistorias',
    casos: [
      {
        id: 'vistoria-campo',
        nome: 'Vistoria de campo',
        atores: ['equipe'],
        descricao: 'Baixar o pacote de campo, ver vistorias programadas e preencher o checklist na unidade.',
        rotas: ['/mobile', 'GET /mobile/field-package', 'GET /mobile/vistorias-programadas'],
      },
      {
        id: 'sync-offline',
        nome: 'Sincronizar offline',
        atores: ['equipe'],
        descricao: 'Enviar fiscalizações gravadas no dispositivo.',
        rotas: ['/mobile', 'POST /mobile/sync/fiscalizacoes'],
      },
      {
        id: 'consultar-vistorias',
        nome: 'Consultar vistorias',
        atores: ['gestor', 'equipe', 'administrador'],
        descricao: 'Listar fiscalizações realizadas e abrir o PDF.',
        rotas: ['/vistorias', 'GET /fiscalizacoes', 'GET /fiscalizacoes/:id', 'GET /fiscalizacoes/:id/pdf'],
      },
      {
        id: 'vistoria-manual',
        nome: 'Lançar vistoria manual',
        atores: ['equipe'],
        descricao: 'Lançar ou imprimir vistoria manual a partir da vistoria ou do mobile.',
        rotas: ['/vistorias', '/mobile', 'POST /fiscalizacoes/lancamento-manual', 'POST /fiscalizacoes/imprimir-manual'],
      },
      {
        id: 'cronograma',
        nome: 'Programar cronograma',
        atores: ['administrador', 'gestor'],
        descricao: 'Agendar a recorrência de checagem por unidade e checklist.',
        rotas: ['/cronograma', 'GET /cronograma', 'POST /cronograma', 'PUT /cronograma/:id', 'DELETE /cronograma/:id'],
      },
      {
        id: 'nao-conformidade',
        nome: 'Tratar não conformidade',
        atores: ['administrador', 'gestor'],
        descricao: 'Vincular a não conformidade a um chamado ou registrar a baixa no CCO.',
        rotas: ['/cco', 'POST /operacional/nao-conformidades/:id/vincular-chamado', 'POST /operacional/nao-conformidades/:id/baixa'],
      },
    ],
  },
  {
    id: 'documentos',
    titulo: 'Documentos',
    casos: [
      {
        id: 'consultar-documentos',
        nome: 'Consultar documentos',
        atores: ['administrador', 'gestor', 'equipe', 'solicitante'],
        descricao: 'Listar peças, gerar PDF e ajustar vínculos com chamado ou vistoria.',
        rotas: ['/documentos', 'GET /documentos', 'GET /documentos/:id/pdf/original', 'PATCH /documentos/:id/vinculos'],
      },
      {
        id: 'documento-avulso',
        nome: 'Criar documento avulso',
        atores: ['administrador', 'gestor'],
        descricao: 'Montar documento fora da vistoria, com checklist de finalidade avulsa, e vincular zero ou mais chamados enquanto estiver em rascunho.',
        rotas: ['/documentos', 'POST /documentos/avulso', 'GET /documentos/checklists-avulso', 'GET /documentos/chamados-busca', 'PATCH /documentos/:id/vinculos'],
      },
      {
        id: 'assinatura-externa',
        nome: 'Coletar assinatura externa',
        atores: ['administrador', 'gestor', 'equipe'],
        descricao: 'Registrar a assinatura de quem não é usuário, ou marcar pendência e cancelar a assinada.',
        rotas: ['/documentos', 'POST /documentos/:id/assinatura', 'POST /documentos/:id/assinatura-pendente', 'POST /documentos/:id/cancelar-assinado'],
      },
      {
        id: 'disponibilizar-assinatura',
        nome: 'Disponibilizar assinatura interna',
        atores: ['administrador', 'gestor'],
        descricao: 'Enviar o documento a um signatário interno e, se preciso, retirar ou recusar o pedido.',
        rotas: ['/documentos', 'POST /documentos/:id/disponibilizar-assinatura', 'POST /documentos/pedidos-assinatura/:pedidoId/retirar'],
      },
      {
        id: 'assinar-interno',
        nome: 'Assinar internamente',
        atores: ['administrador', 'gestor', 'equipe'],
        descricao: 'O destinatário assina o pedido pendente. O aviso também aparece ao entrar.',
        rotas: ['/documentos', '/login', 'GET /documentos/minhas-pendencias-assinatura', 'POST /documentos/:id/assinatura-interna'],
      },
      {
        id: 'validar-documento',
        nome: 'Validar documento',
        atores: ['cidadao'],
        descricao: 'Conferir autenticidade pelo código de validação ou pelo código do documento, sem login.',
        rotas: ['/documento/validar', '/documento/validar/[codigo]', 'GET /public/documentos/validar/:codigo'],
      },
    ],
  },
  {
    id: 'gestao',
    titulo: 'Gestão e administração',
    casos: [
      {
        id: 'cco',
        nome: 'Acompanhar o CCO',
        atores: ['administrador', 'gestor', 'equipe'],
        descricao: 'Mapa operacional, próprios, filtros e chamados georreferenciados.',
        rotas: ['/cco', '/cco/unidades/[id]', 'GET /operacional/resumo', 'GET /operacional/unidades', 'GET /operacional/chamados-mapa'],
      },
      {
        id: 'dashboard',
        nome: 'Consultar dashboard',
        atores: ['administrador', 'gestor'],
        descricao: 'Indicadores e alertas de monitoramento.',
        rotas: ['/dashboard', 'GET /monitoramento/dashboard', 'GET /monitoramento/alertas'],
      },
      {
        id: 'relatorios',
        nome: 'Exportar relatórios',
        atores: ['administrador', 'gestor'],
        descricao: 'Exportar unidades, chamados, ordens, fiscalizações e cobertura do cronograma.',
        rotas: ['/relatorios', 'GET /relatorios/export/chamados.csv', 'GET /relatorios/export/fiscalizacoes.pdf'],
      },
      {
        id: 'cadastros',
        nome: 'Gerir cadastros',
        atores: ['administrador', 'gestor'],
        descricao: 'Secretarias, próprios, usuários, equipes, cargos, tipos de chamado, tipos de próprio e categorias de vistoria.',
        rotas: ['/admin', 'GET /admin/secretarias', 'GET /admin/unidades', 'GET /admin/usuarios', 'GET /admin/equipes'],
      },
      {
        id: 'permissoes',
        nome: 'Configurar permissões',
        atores: ['administrador'],
        descricao: 'Criar perfis e gravar a matriz de permissões do perfil ou do usuário.',
        rotas: ['/admin', 'GET /admin/perfis/configuraveis', 'PUT /admin/perfis/:id/matriz', 'PUT /admin/usuarios/:id/matriz'],
      },
      {
        id: 'checklists',
        nome: 'Modelar checklists',
        atores: ['administrador', 'gestor'],
        descricao: 'Criar o formulário, ordenar as perguntas pelas setas, agrupar por seção e publicar. Múltipla escolha pode aceitar uma ou várias opções.',
        rotas: ['/checklists', '/checklists/[id]', 'POST /checklists', 'POST /checklists/:id/versions', 'POST /checklists/versions/:versionId/publish'],
      },
      {
        id: 'webmap',
        nome: 'Importar webmap',
        atores: ['administrador'],
        descricao: 'Pré-visualizar e aplicar a sincronização das unidades a partir do webmap.',
        rotas: ['/admin', 'GET /admin/importacao/webmap/status', 'POST /admin/importacao/webmap/apply'],
      },
      {
        id: 'auditoria',
        nome: 'Consultar auditoria',
        atores: ['administrador'],
        descricao: 'Ler logs e a configuração do que deve ser auditado.',
        rotas: ['/admin', 'GET /admin/auditoria/logs', 'PUT /admin/auditoria/config'],
      },
      {
        id: 'backup-email',
        nome: 'Configurar backup e e-mail',
        atores: ['administrador'],
        descricao: 'Backup compatível com S3 e SMTP. Segredos não retornam nas respostas.',
        rotas: ['/admin', 'GET /admin/backup', 'POST /admin/backup/run', 'PUT /admin/email', 'POST /admin/email/teste'],
      },
      {
        id: 'lgpd',
        nome: 'Aplicar LGPD',
        atores: ['administrador'],
        descricao: 'Anonimizar usuário e aplicar a retenção da auditoria a partir da administração.',
        rotas: ['/admin', 'POST /lgpd/usuarios/:id/anonymize', 'POST /lgpd/auditoria/purge'],
      },
      {
        id: 'integracoes',
        nome: 'Monitorar integrações',
        atores: ['administrador'],
        descricao: 'Ver eventos de sincronização offline e reprocessar ou ignorar falhas.',
        rotas: ['/integracoes', 'GET /integracoes/eventos', 'POST /integracoes/sync/:id/retry', 'POST /integracoes/sync/:id/ignorar'],
      },
      {
        id: 'push',
        nome: 'Receber alertas',
        atores: ['administrador', 'gestor'],
        descricao: 'Inscrever o navegador para push a partir do dashboard.',
        rotas: ['/dashboard', 'POST /notificacoes/push/subscribe', 'POST /notificacoes/alertas/disparar'],
      },
    ],
  },
];

export const CASOS_DE_USO: CasoDeUso[] = GRUPOS_CASOS.flatMap((grupo) => grupo.casos);

export function atoresDoGrupo(grupo: GrupoCasosDeUso): AtorSistema[] {
  const ids = new Set(grupo.casos.flatMap((caso) => caso.atores));
  return ATORES.filter((ator) => ids.has(ator.id));
}
