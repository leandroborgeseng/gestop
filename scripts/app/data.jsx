// SIGMA — mock domain data (Franca/SP). Exposed on window.
// Coordinates scattered around Franca city center (-20.5386, -47.4006).

const SECRETARIAS = [
  { id: "SME", nome: "Educação", full: "Secretaria Municipal de Educação" },
  { id: "SMS", nome: "Saúde", full: "Secretaria Municipal de Saúde" },
  { id: "SMOSP", nome: "Obras e Serviços", full: "Secretaria de Obras e Serviços Públicos" },
  { id: "SEMAD", nome: "Administração", full: "Secretaria Municipal de Administração" },
  { id: "SMEL", nome: "Esporte e Lazer", full: "Secretaria de Esporte e Lazer" },
  { id: "SMC", nome: "Cultura", full: "Secretaria Municipal de Cultura" },
];

const BAIRROS = [
  "Centro", "Cidade Nova", "Jardim Aeroporto", "City Petrópolis",
  "Vila Aparecida", "Parque Universitário", "São Joaquim",
  "Jardim Paulistano", "Vila Imperador", "Estação", "Jardim Consolação",
];

const TIPOS = ["Escola", "CMEI", "UBS", "UPA", "Praça", "Prédio Administrativo", "Ginásio", "Centro Cultural"];

// situacao keys → label/color role
const SITUACOES = {
  OPERACIONAL: { label: "Operacional", role: "ok" },
  COM_PENDENCIAS: { label: "Com pendências", role: "warn" },
  SEM_LOCALIZACAO: { label: "Sem localização", role: "muted" },
  INATIVA: { label: "Inativa", role: "off" },
};

let _id = 0;
function u(codigo, nome, tipo, sec, bairro, situacao, lat, lng, extra = {}) {
  _id += 1;
  return {
    id: _id, codigo, nome, tipo, secretaria: sec, bairro, situacao, lat, lng,
    endereco: extra.endereco || `${bairro}, Franca - SP`,
    responsavel: extra.responsavel || "—",
    fisc: extra.fisc ?? 0, nc: extra.nc ?? 0, os: extra.os ?? 0,
    ultima: extra.ultima || "—",
    area: extra.area || (1200 + ((_id * 137) % 4000)),
    matricula: extra.matricula || `${10000 + _id * 7}`,
  };
}

const UNIDADES = [
  u("PMF-ESC-001", "EMEB Prof. Florestan Fernandes", "Escola", "SME", "Centro", "COM_PENDENCIAS", -20.5365, -47.4012, { fisc: 6, nc: 3, os: 2, ultima: "28/05/2026", responsavel: "Marcos A. Pereira", endereco: "R. Voluntários da Franca, 1240 — Centro" }),
  u("PMF-ESC-002", "EMEB Castelo Branco", "Escola", "SME", "Cidade Nova", "OPERACIONAL", -20.5288, -47.3924, { fisc: 4, nc: 0, os: 0, ultima: "21/05/2026", responsavel: "Cláudia R. Nunes" }),
  u("PMF-CMEI-014", "CMEI Pingo de Gente", "CMEI", "SME", "Vila Aparecida", "OPERACIONAL", -20.5471, -47.4109, { fisc: 3, nc: 1, os: 0, ultima: "19/05/2026", responsavel: "Ana P. Lima" }),
  u("PMF-CMEI-022", "CMEI Sonho Encantado", "CMEI", "SME", "Jardim Paulistano", "COM_PENDENCIAS", -20.5212, -47.4156, { fisc: 5, nc: 2, os: 1, ultima: "27/05/2026", responsavel: "Rita F. Souza" }),
  u("PMF-UBS-007", "UBS Jardim Aeroporto", "UBS", "SMS", "Jardim Aeroporto", "OPERACIONAL", -20.5602, -47.3848, { fisc: 7, nc: 0, os: 0, ultima: "30/05/2026", responsavel: "Dr. Helena M. Castro" }),
  u("PMF-UBS-011", "UBS Vila Imperador", "UBS", "SMS", "Vila Imperador", "COM_PENDENCIAS", -20.5158, -47.3892, { fisc: 5, nc: 4, os: 3, ultima: "29/05/2026", responsavel: "Enf. Paulo R. Dias" }),
  u("PMF-UPA-001", "UPA 24h Norte", "UPA", "SMS", "Parque Universitário", "OPERACIONAL", -20.5089, -47.4028, { fisc: 9, nc: 1, os: 1, ultima: "31/05/2026", responsavel: "Dr. Sérgio L. Antunes" }),
  u("PMF-PRC-003", "Praça Nossa Senhora da Conceição", "Praça", "SMOSP", "Centro", "COM_PENDENCIAS", -20.5398, -47.4039, { fisc: 2, nc: 2, os: 1, ultima: "24/05/2026", responsavel: "Equipe Zeladoria C-1" }),
  u("PMF-PRC-009", "Praça do Bosque Municipal", "Praça", "SMOSP", "São Joaquim", "OPERACIONAL", -20.5331, -47.4138, { fisc: 3, nc: 0, os: 0, ultima: "18/05/2026", responsavel: "Equipe Zeladoria C-3" }),
  u("PMF-GIN-002", "Ginásio Poliesportivo Pedro Morilla", "Ginásio", "SMEL", "City Petrópolis", "OPERACIONAL", -20.5247, -47.4221, { fisc: 4, nc: 1, os: 0, ultima: "22/05/2026", responsavel: "José C. Almeida" }),
  u("PMF-ADM-001", "Paço Municipal — Sede", "Prédio Administrativo", "SEMAD", "Centro", "OPERACIONAL", -20.5377, -47.4001, { fisc: 6, nc: 0, os: 0, ultima: "26/05/2026", responsavel: "Gestão Predial SEMAD" }),
  u("PMF-CUL-004", "Centro Cultural José Chiachiri", "Centro Cultural", "SMC", "Centro", "OPERACIONAL", -20.5352, -47.3987, { fisc: 2, nc: 0, os: 0, ultima: "15/05/2026", responsavel: "Beatriz O. Ramos" }),
  u("PMF-ESC-018", "EMEB Monteiro Lobato", "Escola", "SME", "Estação", "OPERACIONAL", -20.5446, -47.3951, { fisc: 4, nc: 0, os: 0, ultima: "20/05/2026", responsavel: "Fernando G. Teixeira" }),
  u("PMF-ESC-024", "EMEB Cecília Meireles", "Escola", "SME", "Jardim Consolação", "COM_PENDENCIAS", -20.5512, -47.4067, { fisc: 5, nc: 3, os: 2, ultima: "28/05/2026", responsavel: "Luciana M. Prado" }),
  u("PMF-UBS-015", "UBS São Joaquim", "UBS", "SMS", "São Joaquim", "OPERACIONAL", -20.5301, -47.4185, { fisc: 6, nc: 0, os: 0, ultima: "25/05/2026", responsavel: "Enf. Carla D. Moura" }),
  u("PMF-PRC-012", "Praça da Estação", "Praça", "SMOSP", "Estação", "COM_PENDENCIAS", -20.5421, -47.3919, { fisc: 1, nc: 1, os: 1, ultima: "23/05/2026", responsavel: "Equipe Zeladoria C-2" }),
  u("PMF-ESC-031", "EMEB Tarsila do Amaral", "Escola", "SME", "Parque Universitário", "OPERACIONAL", -20.5052, -47.3987, { fisc: 3, nc: 0, os: 0, ultima: "17/05/2026", responsavel: "Marília S. Couto" }),
  u("PMF-GIN-005", "Centro Esportivo Vila Aparecida", "Ginásio", "SMEL", "Vila Aparecida", "INATIVA", -20.5489, -47.4071, { fisc: 0, nc: 0, os: 1, ultima: "02/2026", responsavel: "—" }),
  // Sem localização (não plotadas no mapa)
  u("PMF-CMEI-040", "CMEI Recanto Feliz", "CMEI", "SME", "Cidade Nova", "SEM_LOCALIZACAO", null, null, { fisc: 1, nc: 1, os: 0, ultima: "12/05/2026", responsavel: "Sandra A. Vieira" }),
  u("PMF-PRC-021", "Praça Comunitária City Petrópolis", "Praça", "SMOSP", "City Petrópolis", "SEM_LOCALIZACAO", null, null, { fisc: 0, nc: 1, os: 0, ultima: "—", responsavel: "—" }),
];

const KPIS = {
  total: 165, ativos: 142, fiscMes: 23, pendencias: 8, syncPend: 2,
};

window.SIGMA = { SECRETARIAS, BAIRROS, TIPOS, SITUACOES, UNIDADES, KPIS };
