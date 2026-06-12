export type GuideHowTo = { t: string; s: string[] };
export type GuideGlossary = { k: string; v: string };

export type GuideContent = {
  nome: string;
  resumo: string;
  comoFazer: GuideHowTo[];
  glossario: GuideGlossary[];
};

export const GUIDE_ATALHOS = [
  { k: '/', d: 'Buscar em qualquer tela' },
  { k: '?', d: 'Abrir / fechar este guia' },
  { k: 'Esc', d: 'Fechar painéis abertos' },
] as const;

export const GUIDE_CONTENT: Record<string, GuideContent> = {
  cco: {
    nome: 'CCO — Central de Controle Operacional',
    resumo:
      'Monitore todos os próprios públicos num só lugar. O mapa e a lista estão sincronizados: filtrar, buscar ou selecionar em um reflete imediatamente no outro.',
    comoFazer: [
      {
        t: 'Encontrar um próprio',
        s: [
          'Digite na busca o nome ou o código (ex.: PMF-ESC-001).',
          'Ou combine os filtros de secretaria, bairro, tipo e situação.',
          'A lista e o mapa se atualizam juntos — o contador mostra quantos restaram.',
        ],
      },
      {
        t: 'Ver tudo sobre uma unidade',
        s: [
          'Clique numa linha da lista ou num marcador do mapa.',
          'Abre o painel com vistorias, não conformidades e chamados.',
          'Use as abas para navegar entre cada tipo de registro.',
        ],
      },
      {
        t: 'Focar no que exige ação',
        s: [
          "Clique no card 'Pendências' para ver só os próprios com problemas.",
          'No mapa, marcadores âmbar = com pendências; verdes = operacionais.',
        ],
      },
    ],
    glossario: [
      { k: 'Situação', v: 'Estado operacional: Operacional, Com pendências, Sem localização ou Inativa.' },
      { k: 'NC — Não conformidade', v: 'Item reprovado durante uma vistoria.' },
      { k: 'Chamado', v: 'Demanda operacional do cidadão, vistoria ou registro interno.' },
      { k: 'Sem GPS', v: 'Próprio sem georreferência — aparece na lista, mas não no mapa.' },
    ],
  },
  dashboard: {
    nome: 'Dashboard',
    resumo:
      'Panorama do dia: indicadores, alertas, push para vistoria e auditoria recente.',
    comoFazer: [
      {
        t: 'Priorizar o que está em risco',
        s: ['Confira os alertas operacionais.', 'Use os links rápidos para ir direto à ação.'],
      },
      {
        t: 'Avisar a equipe de vistoria',
        s: ['No painel de push, escreva o aviso.', 'Escolha o público e envie.'],
      },
    ],
    glossario: [
      { k: 'SLA', v: 'Prazo acordado para concluir um chamado.' },
      { k: 'Auditoria', v: 'Registro de quem fez o quê e quando.' },
    ],
  },
  mobile: {
    nome: 'Vistoria — PWA',
    resumo:
      'Roteiro por proximidade, check-in GPS, checklist offline-first e fila de sincronização.',
    comoFazer: [
      {
        t: 'Executar uma vistoria',
        s: [
          'Selecione a unidade mais próxima.',
          'Faça check-in com GPS.',
          'Responda o checklist e conclua.',
        ],
      },
      {
        t: 'Trabalhar offline',
        s: [
          'Conclusões offline vão para a fila de sync.',
          'Ao reconectar, use o FAB para enviar pendências.',
        ],
      },
    ],
    glossario: [
      { k: 'Check-in GPS', v: 'Confirma que você está no local da unidade.' },
      { k: 'Fila de sync', v: 'Vistorias aguardando envio ao servidor.' },
    ],
  },
  chamados: {
    nome: 'Chamados',
    resumo: 'Fila unificada de demandas — cidadão, vistoria ou registro interno. Triagem, atendimento e conclusão.',
    comoFazer: [
      {
        t: 'Triar e atender um chamado',
        s: [
          "Selecione um chamado 'Aberto'.",
          "Use 'Atualizar status' para avançar no fluxo.",
          'Acompanhe prazo, responsável e linha do tempo no painel à direita.',
        ],
      },
    ],
    glossario: [
      { k: 'Canal', v: 'Como o chamado chegou: QR Code, vistoria, app ou manual.' },
      { k: 'Prazo / SLA', v: 'Data limite para conclusão do atendimento.' },
    ],
  },
  cronograma: {
    nome: 'Cronograma de checagens',
    resumo: 'Calendário e cadastro de rotinas de vistoria por unidade.',
    comoFazer: [
      {
        t: 'Consultar o calendário',
        s: ['Navegue pelos meses.', 'Clique num dia para ver checagens previstas.'],
      },
    ],
    glossario: [{ k: 'Checagem', v: 'Vistoria programada recorrentemente.' }],
  },
  admin: {
    nome: 'Administração',
    resumo: 'Cadastros de secretarias, próprios, usuários e controles LGPD.',
    comoFazer: [
      {
        t: 'Cadastrar ou editar',
        s: ['Escolha a aba.', "Use 'Novo registro' ou edite na linha.", 'Salve o formulário.'],
      },
    ],
    glossario: [
      { k: 'RBAC', v: 'Controle de acesso por perfil.' },
      { k: 'Anonimizar', v: 'Mascarar dados pessoais (LGPD).' },
    ],
  },
  checklists: {
    nome: 'Checklists',
    resumo: 'Modelos versionados para vistorias.',
    comoFazer: [
      {
        t: 'Editar um modelo',
        s: ['Selecione o modelo.', 'Adicione ou reordene itens.', 'Publique nova versão.'],
      },
    ],
    glossario: [
      { k: 'Versão', v: 'Fotografia do modelo — histórico preservado.' },
    ],
  },
  relatorios: {
    nome: 'Relatórios',
    resumo: 'Exportações CSV/PDF por tipo e período.',
    comoFazer: [
      {
        t: 'Exportar dados',
        s: ['Defina período e secretaria.', 'Clique em CSV ou PDF no tipo desejado.'],
      },
    ],
    glossario: [
      { k: 'CSV', v: 'Planilha para análise.' },
      { k: 'PDF', v: 'Documento para arquivo oficial.' },
    ],
  },
  integracoes: {
    nome: 'Integrações',
    resumo: 'Status de webhooks, sync mobile e importação webmap.',
    comoFazer: [
      {
        t: 'Resolver fila travada',
        s: ['Identifique integração com atenção.', "Use 'Retry' se disponível."],
      },
    ],
    glossario: [{ k: 'Webhook', v: 'Aviso automático a outro sistema.' }],
  },
  conta: {
    nome: 'Minha conta',
    resumo: 'Dados de acesso e alteração de senha.',
    comoFazer: [
      {
        t: 'Alterar a senha',
        s: ['Informe a senha atual.', 'Defina nova senha forte.', 'Confirme e salve.'],
      },
    ],
    glossario: [{ k: 'Sessão', v: 'Cada dispositivo conectado à sua conta.' }],
  },
  unidade: {
    nome: 'Detalhe da unidade',
    resumo: 'Dados patrimoniais, localização e histórico operacional.',
    comoFazer: [
      {
        t: 'Navegar pelos registros',
        s: ['Use as abas de vistorias, NCs e chamados.', 'Cada item mostra data e status.'],
      },
    ],
    glossario: [
      { k: 'Matrícula patrimonial', v: 'Identificador do bem no cadastro municipal.' },
    ],
  },
  _default: {
    nome: 'SIGMA',
    resumo: 'Plataforma de gestão operacional da Prefeitura de Franca.',
    comoFazer: [
      {
        t: 'Voltar ao centro de comando',
        s: ['A CCO concentra mapa, indicadores e lista.', 'Use o menu lateral para navegar.'],
      },
    ],
    glossario: [
      { k: 'Próprio público', v: 'Bem municipal: escola, UBS, praça, prédio.' },
      { k: 'Secretaria', v: 'Órgão responsável (SME, SMS, SSMA…).' },
    ],
  },
};

export function resolveGuideKey(pathname: string): string {
  if (pathname.startsWith('/cco/unidades')) return 'unidade';
  if (pathname.startsWith('/cco')) return 'cco';
  if (pathname.startsWith('/mobile')) return 'mobile';
  if (pathname.startsWith('/chamados')) return 'chamados';
  if (pathname.startsWith('/ordens-servico')) return 'chamados';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/cronograma')) return 'cronograma';
  if (pathname.startsWith('/relatorios')) return 'relatorios';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/checklists')) return 'checklists';
  if (pathname.startsWith('/integracoes')) return 'integracoes';
  if (pathname.startsWith('/conta')) return 'conta';
  return '_default';
}

export function getGuideForPath(pathname: string): GuideContent {
  const key = resolveGuideKey(pathname);
  return GUIDE_CONTENT[key] ?? GUIDE_CONTENT._default;
}
