// SIGMA — operational data (chamados, OS, dashboard, auditoria, checklists). Extends window.SIGMA.
(function () {
  const G = window.SIGMA;

  const CHAMADO_STATUS = {
    ABERTO: { label: "Aberto", tone: "info" },
    EM_TRIAGEM: { label: "Em triagem", tone: "warn" },
    ENCAMINHADO: { label: "Encaminhado", tone: "neutral" },
    RESOLVIDO: { label: "Resolvido", tone: "ok" },
    CANCELADO: { label: "Cancelado", tone: "danger" },
  };

  const CHAMADOS = [
    { codigo: "CH-2026-0418", titulo: "Vazamento no banheiro do 2º andar", unidade: "EMEB Prof. Florestan Fernandes", unidadeCod: "PMF-ESC-001", bairro: "Centro", status: "ABERTO", prioridade: "ALTA", canal: "QR", aberto: "31/05/2026 08:12", solicitante: "Cidadão (anônimo)", desc: "Água acumulando no piso próximo às pias; risco de queda para os alunos." },
    { codigo: "CH-2026-0417", titulo: "Lâmpadas queimadas no corredor", unidade: "UBS Vila Imperador", unidadeCod: "PMF-UBS-011", bairro: "Vila Imperador", status: "EM_TRIAGEM", prioridade: "MÉDIA", canal: "App", aberto: "30/05/2026 17:40", solicitante: "Enf. Paulo R. Dias", desc: "Três luminárias apagadas no corredor de espera." },
    { codigo: "CH-2026-0415", titulo: "Portão de entrada não tranca", unidade: "CMEI Sonho Encantado", unidadeCod: "PMF-CMEI-022", bairro: "Jardim Paulistano", status: "ABERTO", prioridade: "URGENTE", canal: "Telefone", aberto: "30/05/2026 09:05", solicitante: "Rita F. Souza", desc: "Fechadura do portão principal quebrada — unidade sem segurança noturna." },
    { codigo: "CH-2026-0411", titulo: "Bebedouro sem água gelada", unidade: "EMEB Cecília Meireles", unidadeCod: "PMF-ESC-024", bairro: "Jardim Consolação", status: "ENCAMINHADO", prioridade: "BAIXA", canal: "QR", aberto: "29/05/2026 11:22", solicitante: "Cidadão (anônimo)", desc: "Bebedouro do pátio não refrigera há uma semana." },
    { codigo: "CH-2026-0409", titulo: "Calçada com piso solto na entrada", unidade: "Praça Nossa Senhora da Conceição", unidadeCod: "PMF-PRC-003", bairro: "Centro", status: "EM_TRIAGEM", prioridade: "MÉDIA", canal: "QR", aberto: "28/05/2026 14:51", solicitante: "Cidadão (anônimo)", desc: "Ladrilhos soltos podem causar tropeços de pedestres." },
    { codigo: "CH-2026-0404", titulo: "Ar-condicionado da sala 3 com vazamento", unidade: "EMEB Castelo Branco", unidadeCod: "PMF-ESC-002", bairro: "Cidade Nova", status: "RESOLVIDO", prioridade: "MÉDIA", canal: "App", aberto: "26/05/2026 10:10", solicitante: "Cláudia R. Nunes", desc: "Pingando água na parede; já reparado pela equipe de manutenção." },
    { codigo: "CH-2026-0401", titulo: "Pichação no muro lateral", unidade: "Ginásio Pedro Morilla", unidadeCod: "PMF-GIN-002", bairro: "City Petrópolis", status: "ENCAMINHADO", prioridade: "BAIXA", canal: "QR", aberto: "25/05/2026 16:30", solicitante: "Cidadão (anônimo)", desc: "Muro voltado para a rua precisa de repintura." },
    { codigo: "CH-2026-0399", titulo: "Extintores próximos do vencimento", unidade: "UPA 24h Norte", unidadeCod: "PMF-UPA-001", bairro: "Parque Universitário", status: "ABERTO", prioridade: "ALTA", canal: "App", aberto: "25/05/2026 07:45", solicitante: "Dr. Sérgio L. Antunes", desc: "Quatro extintores vencem em junho; agendar recarga." },
  ];

  const OS_STATUS = {
    ABERTA: { label: "Aberta", tone: "info" },
    EM_EXECUCAO: { label: "Em execução", tone: "warn" },
    AGUARDANDO: { label: "Aguardando peça", tone: "neutral" },
    CONCLUIDA: { label: "Concluída", tone: "ok" },
  };
  const PRIOR = { URGENTE: "danger", ALTA: "warn", "MÉDIA": "info", BAIXA: "neutral" };

  const ORDENS = [
    { codigo: "OS-2026-0042", titulo: "Reparo hidráulico — banheiro 2º andar", unidade: "EMEB Prof. Florestan Fernandes", unidadeCod: "PMF-ESC-001", status: "EM_EXECUCAO", prioridade: "URGENTE", prazo: "02/06/2026", prazoDias: 1, responsavel: "Equipe Hidráulica A", origem: "Chamado CH-2026-0418", aberta: "31/05/2026", sec: "SMOSP" },
    { codigo: "OS-2026-0041", titulo: "Recarga de extintores (4 un.)", unidade: "UPA 24h Norte", unidadeCod: "PMF-UPA-001", status: "ABERTA", prioridade: "ALTA", prazo: "05/06/2026", prazoDias: 4, responsavel: "Brigada / Terceiro", origem: "NC-118 · Fiscalização", aberta: "30/05/2026", sec: "SMS" },
    { codigo: "OS-2026-0039", titulo: "Troca de fechadura do portão principal", unidade: "CMEI Sonho Encantado", unidadeCod: "PMF-CMEI-022", status: "EM_EXECUCAO", prioridade: "URGENTE", prazo: "01/06/2026", prazoDias: 0, responsavel: "Serralheria Municipal", origem: "Chamado CH-2026-0415", aberta: "30/05/2026", sec: "SMOSP" },
    { codigo: "OS-2026-0036", titulo: "Substituição de luminárias LED", unidade: "UBS Vila Imperador", unidadeCod: "PMF-UBS-011", status: "AGUARDANDO", prioridade: "MÉDIA", prazo: "08/06/2026", prazoDias: 7, responsavel: "Equipe Elétrica B", origem: "NC-104 · Fiscalização", aberta: "29/05/2026", sec: "SMOSP" },
    { codigo: "OS-2026-0033", titulo: "Reparo de piso tátil na entrada", unidade: "Praça N. S. da Conceição", unidadeCod: "PMF-PRC-003", status: "ABERTA", prioridade: "MÉDIA", prazo: "10/06/2026", prazoDias: 9, responsavel: "Equipe Zeladoria C-1", origem: "NC-097 · Fiscalização", aberta: "28/05/2026", sec: "SMOSP" },
    { codigo: "OS-2026-0028", titulo: "Pintura de muro (remoção de pichação)", unidade: "Ginásio Pedro Morilla", unidadeCod: "PMF-GIN-002", status: "CONCLUIDA", prioridade: "BAIXA", prazo: "27/05/2026", prazoDias: -5, responsavel: "Equipe Pintura", origem: "Chamado CH-2026-0401", aberta: "25/05/2026", sec: "SMEL" },
  ];

  const ALERTAS = [
    { tipo: "danger", icon: "alert", titulo: "OS-2026-0039 vence hoje", desc: "Troca de fechadura · CMEI Sonho Encantado — sem confirmação da serralheria.", quando: "há 20 min" },
    { tipo: "warn", icon: "clock", titulo: "3 fiscalizações atrasadas", desc: "Escolas da SME com checklist mensal pendente há mais de 5 dias.", quando: "há 1 h" },
    { tipo: "warn", icon: "wifiOff", titulo: "2 sincronizações pendentes", desc: "Agente de campo offline desde 14:30 — fila aguardando conexão.", quando: "há 2 h" },
    { tipo: "info", icon: "inbox", titulo: "4 chamados aguardando triagem", desc: "Novos chamados via QR Code precisam de classificação.", quando: "há 3 h" },
  ];

  const AUDITORIA = [
    { quem: "Marcos A. Pereira", acao: "concluiu fiscalização", alvo: "PMF-ESC-001", quando: "09:42" },
    { quem: "Ricardo Campos", acao: "encaminhou chamado para OS", alvo: "CH-2026-0411 → OS", quando: "09:15" },
    { quem: "Ana P. Lima", acao: "registrou não conformidade", alvo: "PMF-CMEI-014", quando: "08:58" },
    { quem: "Sistema", acao: "sincronizou 6 registros offline", alvo: "Fila de campo", quando: "08:30" },
    { quem: "Paulo R. Dias", acao: "abriu chamado", alvo: "CH-2026-0417", quando: "ontem 17:40" },
  ];

  const CHECKLISTS = [
    { id: "CKL-ESCOLA", nome: "Fiscalização — Escolas / CMEI", versao: "v4", itens: 24, secretaria: "SME", status: "Publicado", atualizado: "20/05/2026" },
    { id: "CKL-SAUDE", nome: "Fiscalização — Unidades de Saúde", versao: "v3", itens: 28, secretaria: "SMS", status: "Publicado", atualizado: "12/05/2026" },
    { id: "CKL-PRACA", nome: "Vistoria — Praças e áreas verdes", versao: "v2", itens: 16, secretaria: "SMOSP", status: "Publicado", atualizado: "30/04/2026" },
    { id: "CKL-PREDIO", nome: "Inspeção predial — Prédios administrativos", versao: "v1", itens: 20, secretaria: "SEMAD", status: "Rascunho", atualizado: "29/05/2026" },
  ];

  const CHECKLIST_ITENS = [
    { sec: "Segurança", itens: [
      { t: "Extintores dentro da validade", tipo: "Sim/Não" },
      { t: "Saídas de emergência sinalizadas e desobstruídas", tipo: "Sim/Não" },
      { t: "Iluminação de emergência funcionando", tipo: "Sim/Não" },
      { t: "Registro fotográfico do quadro de força", tipo: "Foto" },
    ]},
    { sec: "Estrutura", itens: [
      { t: "Forro e telhado sem infiltração", tipo: "Sim/Não" },
      { t: "Pisos e calçadas sem dano / piso tátil íntegro", tipo: "Sim/Não" },
      { t: "Observações sobre a estrutura", tipo: "Texto" },
    ]},
    { sec: "Hidráulica e elétrica", itens: [
      { t: "Sem vazamentos aparentes", tipo: "Sim/Não" },
      { t: "Tomadas e interruptores em bom estado", tipo: "Sim/Não" },
      { t: "Bebedouros funcionando", tipo: "Sim/Não" },
    ]},
  ];

  const INTEGRACOES = [
    { nome: "Webhook — Sistema de Protocolo (SEI)", status: "ok", ultimo: "31/05 09:40", eventos: 1284, desc: "Encaminhamento de OS para o protocolo municipal." },
    { nome: "Sincronização — App de Campo", status: "warn", ultimo: "31/05 14:30", eventos: 2, desc: "2 lotes na fila aguardando reconexão do agente." },
    { nome: "Integração — Patrimônio (SIAFIC)", status: "ok", ultimo: "30/05 23:00", eventos: 165, desc: "Espelho diário de próprios e matrículas." },
    { nome: "Notificações Push (PWA)", status: "ok", ultimo: "31/05 10:02", eventos: 532, desc: "Alertas operacionais para gestores e agentes." },
  ];

  const EVENTOS = [
    { hora: "09:40", tipo: "OS.encaminhada", payload: "OS-2026-0042 → SEI", status: "200 OK" },
    { hora: "09:15", tipo: "chamado.triado", payload: "CH-2026-0411", status: "200 OK" },
    { hora: "08:30", tipo: "campo.sync", payload: "6 registros", status: "200 OK" },
    { hora: "14:30", tipo: "campo.sync", payload: "2 registros", status: "RETRY (offline)" },
    { hora: "23:00", tipo: "patrimonio.espelho", payload: "165 próprios", status: "200 OK" },
  ];

  Object.assign(G, {
    CHAMADO_STATUS, CHAMADOS, OS_STATUS, PRIOR, ORDENS, ALERTAS, AUDITORIA,
    CHECKLISTS, CHECKLIST_ITENS, INTEGRACOES, EVENTOS,
    DASH: { abertos: 18, emExec: 7, slaRisco: 3, concluidasMes: 41 },
  });
})();
