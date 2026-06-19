import { PrismaPg } from '@prisma/adapter-pg';
import {
  AuditAction,
  ChecklistEscopo,
  ChecklistItemTipo,
  ChecklistVersaoStatus,
  ConformidadeStatus,
  DashboardEscopo,
  EntidadeSincronizavel,
  EvidenciaTipo,
  CronogramaFrequencia,
  FiscalizacaoOrigem,
  FiscalizacaoStatus,
  NaoConformidadeStatus,
  OfflineOperacao,
  OfflineSyncStatus,
  ChamadoOrigem,
  ChamadoPrioridade,
  ChamadoStatus,
  PrismaClient,
  Severidade,
  UnidadeTipo,
} from '@prisma/client';
import { hashPassword } from '../src/auth/password';
import { logError, logInfo, logStep, logWarn, maskDatabaseUrl, isProductionRuntime } from './startup-log';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://gestop:gestop@localhost:5432/gestop?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function resetDevData() {
  await prisma.$transaction([
    prisma.dashboardSnapshot.deleteMany(),
    prisma.offlineSyncEvent.deleteMany(),
    prisma.logAuditoria.deleteMany(),
    prisma.historicoStatus.deleteMany(),
    prisma.evidencia.deleteMany(),
    prisma.chamado.deleteMany(),
    prisma.naoConformidade.deleteMany(),
    prisma.respostaChecklist.deleteMany(),
    prisma.fiscalizacao.deleteMany(),
    prisma.cronogramaChecagem.deleteMany(),
    prisma.checklistItem.deleteMany(),
    prisma.checklistVersao.deleteMany(),
    prisma.checklist.deleteMany(),
    prisma.usuarioPerfil.deleteMany(),
    prisma.perfilPermissao.deleteMany(),
    prisma.permissao.deleteMany(),
    prisma.perfil.deleteMany(),
    prisma.usuario.deleteMany(),
    prisma.unidadePublica.deleteMany(),
    prisma.secretaria.deleteMany(),
  ]);
}

async function main() {
  logStep('seed', 'Iniciando seed do banco');
  logInfo('seed', `NODE_ENV=${process.env.NODE_ENV ?? '(nao definido)'}`);
  logInfo('seed', `DATABASE_URL=${maskDatabaseUrl(process.env.DATABASE_URL)}`);

  const isProduction = isProductionRuntime();
  const forceSeed = process.env.FORCE_SEED_ON_START === 'true';

  let existingUsers = 0;
  try {
    existingUsers = await prisma.usuario.count();
    logInfo('seed', `Usuarios existentes: ${existingUsers}`);
  } catch (error) {
    logError('seed', 'Falha ao consultar tabela Usuario. As migrations foram aplicadas?', error);
    throw error;
  }

  if (isProduction && existingUsers > 0 && !forceSeed) {
    logWarn('seed', 'Seed de producao ignorado: banco ja possui usuarios.');
    return;
  }

  if (forceSeed && existingUsers > 0) {
    logWarn('seed', 'FORCE_SEED_ON_START=true: seed sera executado mesmo com usuarios existentes.');
  }

  if (!isProduction) {
    logInfo('seed', 'Ambiente de desenvolvimento: limpando dados anteriores.');
    await resetDevData();
  }

  const initialPassword = isProduction
    ? process.env.INITIAL_ADMIN_PASSWORD?.trim()
    : process.env.INITIAL_ADMIN_PASSWORD?.trim() || 'Gestop@123';

  if (isProduction && existingUsers === 0 && !initialPassword) {
    throw new Error('INITIAL_ADMIN_PASSWORD obrigatoria no primeiro seed de producao.');
  }

  if (isProduction && initialPassword && initialPassword.length < 12) {
    throw new Error('INITIAL_ADMIN_PASSWORD deve ter pelo menos 12 caracteres.');
  }

  const defaultPasswordHash = hashPassword(initialPassword ?? 'Gestop@123', isProduction ? undefined : 'gestop-dev-seed-salt');

  const secretariasSeed = [
    { nome: 'Secretaria Municipal de Educacao', sigla: 'SME', responsavelNome: 'Mariana Costa', responsavelEmail: 'mariana.costa@franca.sp.gov.br' },
    { nome: 'Secretaria Municipal de Saude', sigla: 'SMS', responsavelNome: 'Roberto Lima', responsavelEmail: 'roberto.lima@franca.sp.gov.br' },
    { nome: 'Secretaria de Servicos Urbanos e Meio Ambiente', sigla: 'SSMA', responsavelNome: 'Ana Paula Martins', responsavelEmail: 'ana.martins@franca.sp.gov.br' },
    { nome: 'Secretaria Municipal de Obras', sigla: 'SMO', responsavelNome: 'Carlos Eduardo Silva', responsavelEmail: 'carlos.silva@franca.sp.gov.br' },
    { nome: 'Secretaria Municipal de Financas', sigla: 'SMF', responsavelNome: 'Patricia Alves', responsavelEmail: 'patricia.alves@franca.sp.gov.br' },
    { nome: 'Secretaria Municipal de Transportes e Transito', sigla: 'SMT', responsavelNome: 'Renato Gomes', responsavelEmail: 'renato.gomes@franca.sp.gov.br' },
    { nome: 'Secretaria Municipal de Desenvolvimento Humano e Cidadania', sigla: 'SMDHC', responsavelNome: 'Juliana Freitas', responsavelEmail: 'juliana.freitas@franca.sp.gov.br' },
    { nome: 'Secretaria Municipal de Cultura e Turismo', sigla: 'SMCT', responsavelNome: 'Fabio Nascimento', responsavelEmail: 'fabio.nascimento@franca.sp.gov.br' },
    { nome: 'Secretaria Municipal de Esporte e Lazer', sigla: 'SMEL', responsavelNome: 'Helio Mendes', responsavelEmail: 'helio.mendes@franca.sp.gov.br' },
  ];

  const secretariasCriadas = await Promise.all(
    secretariasSeed.map((secretaria) => prisma.secretaria.create({ data: secretaria })),
  );

  const educacao = secretariasCriadas.find((item) => item.sigla === 'SME')!;
  const saude = secretariasCriadas.find((item) => item.sigla === 'SMS')!;
  const servicos = secretariasCriadas.find((item) => item.sigla === 'SSMA')!;

  const unidades = await Promise.all([
    prisma.unidadePublica.create({
      data: {
        secretariaId: educacao.id,
        codigoPatrimonial: 'PMF-ESC-001',
        nome: 'EMEB Prof. Florestan Fernandes',
        tipo: UnidadeTipo.ESCOLA,
        endereco: 'Rua Major Claudiano, 1840',
        bairro: 'Centro',
        cep: '14400-690',
        latitude: -20.53936,
        longitude: -47.40081,
        raioValidacaoMetros: 200,
      },
    }),
    prisma.unidadePublica.create({
      data: {
        secretariaId: saude.id,
        codigoPatrimonial: 'PMF-UBS-001',
        nome: 'UBS Jardim Aeroporto',
        tipo: UnidadeTipo.UBS,
        endereco: 'Avenida Brasil, 2500',
        bairro: 'Jardim Aeroporto',
        cep: '14404-063',
        latitude: -20.55142,
        longitude: -47.42406,
        raioValidacaoMetros: 200,
      },
    }),
    prisma.unidadePublica.create({
      data: {
        secretariaId: servicos.id,
        codigoPatrimonial: 'PMF-PRC-001',
        nome: 'Praca Nossa Senhora da Conceicao',
        tipo: UnidadeTipo.PRACA,
        endereco: 'Praca Nossa Senhora da Conceicao',
        bairro: 'Centro',
        cep: '14400-730',
        latitude: -20.53873,
        longitude: -47.40039,
        raioValidacaoMetros: 200,
      },
    }),
  ]);

  const permissoes = await Promise.all(
    [
      ['usuarios.gerenciar', 'Gerenciar usuarios e perfis', 'identidade'],
      ['secretarias.gerenciar', 'Gerenciar secretarias', 'cadastros'],
      ['unidades.gerenciar', 'Gerenciar proprios publicos', 'cadastros'],
      ['checklists.gerenciar', 'Criar e publicar checklists', 'fiscalizacao'],
      ['fiscalizacoes.executar', 'Executar fiscalizacoes em campo', 'fiscalizacao'],
      ['chamados.gerenciar', 'Gerenciar chamados operacionais', 'chamados'],
      ['chamados.executar', 'Executar chamados em campo', 'chamados'],
      ['chamados.editar_abertura', 'Editar informações de abertura do chamado', 'chamados'],
      ['chamados.execucao_manual', 'Lançar execução de chamado manualmente', 'chamados'],
      ['dashboard.visualizar', 'Visualizar indicadores operacionais', 'dashboard'],
      ['auditoria.visualizar', 'Visualizar trilhas de auditoria', 'auditoria'],
    ].map(([chave, descricao, modulo]) =>
      prisma.permissao.create({
        data: { chave, descricao, modulo },
      }),
    ),
  );

  const [adminPerfil, gestorPerfil, fiscalPerfil, manutencaoPerfil] = await Promise.all([
    prisma.perfil.create({
      data: { nome: 'Administrador do Sistema', sistema: true, descricao: 'Acesso total ao SIGMA' },
    }),
    prisma.perfil.create({
      data: { nome: 'Gestor CCO', sistema: true, descricao: 'Operacao da Central de Controle' },
    }),
    prisma.perfil.create({
      data: { nome: 'Agente de Campo', sistema: true, descricao: 'Execucao de vistorias em campo' },
    }),
    prisma.perfil.create({
      data: { nome: 'Operador de Manutencao', sistema: true, descricao: 'Execucao de ordens de servico' },
    }),
  ]);

  await prisma.perfilPermissao.createMany({
    data: [
      ...permissoes.map((permissao) => ({ perfilId: adminPerfil.id, permissaoId: permissao.id })),
      ...permissoes
        .filter((permissao) => permissao.chave !== 'usuarios.gerenciar')
        .map((permissao) => ({ perfilId: gestorPerfil.id, permissaoId: permissao.id })),
      ...permissoes
        .filter((permissao) => permissao.chave === 'fiscalizacoes.executar')
        .map((permissao) => ({ perfilId: fiscalPerfil.id, permissaoId: permissao.id })),
      ...permissoes
        .filter((permissao) => permissao.chave === 'chamados.executar')
        .map((permissao) => ({ perfilId: manutencaoPerfil.id, permissaoId: permissao.id })),
    ],
  });

  const [admin, gestor, fiscal, operador] = await Promise.all([
    prisma.usuario.create({
      data: {
        nome: 'Administrador SIGMA',
        email: 'admin.gestop@franca.sp.gov.br',
        cpf: '00000000000',
        senhaHash: defaultPasswordHash,
        cargo: 'Administrador do Sistema',
      },
    }),
    prisma.usuario.create({
      data: {
        secretariaId: servicos.id,
        nome: 'Carla Mendes',
        email: 'carla.mendes@franca.sp.gov.br',
        cpf: '11111111111',
        senhaHash: defaultPasswordHash,
        cargo: 'Gestora CCO',
      },
    }),
    prisma.usuario.create({
      data: {
        secretariaId: educacao.id,
        nome: 'Joao Pereira',
        email: 'joao.pereira@franca.sp.gov.br',
        cpf: '22222222222',
        senhaHash: defaultPasswordHash,
        cargo: 'Agente de Campo',
      },
    }),
    prisma.usuario.create({
      data: {
        secretariaId: servicos.id,
        nome: 'Lucas Almeida',
        email: 'lucas.almeida@franca.sp.gov.br',
        cpf: '33333333333',
        senhaHash: defaultPasswordHash,
        cargo: 'Operador de Manutencao',
      },
    }),
  ]);

  await prisma.usuarioPerfil.createMany({
    data: [
      { usuarioId: admin.id, perfilId: adminPerfil.id },
      { usuarioId: gestor.id, perfilId: gestorPerfil.id },
      { usuarioId: fiscal.id, perfilId: fiscalPerfil.id },
      { usuarioId: operador.id, perfilId: manutencaoPerfil.id },
    ],
  });

  const equipeManutencao = await prisma.equipe.create({
    data: {
      secretariaId: servicos.id,
      nome: 'Manutencao Escolar',
      descricao: 'Equipe de manutencao predial das escolas municipais.',
      membros: {
        create: [{ usuarioId: operador.id }],
      },
    },
  });

  const checklist = await prisma.checklist.create({
    data: {
      secretariaId: educacao.id,
      nome: 'Vistoria Predial Escolar',
      descricao: 'Checklist basico para fiscalizacao de escolas municipais.',
      escopo: ChecklistEscopo.UNIDADE_TIPO,
      unidadeTipo: UnidadeTipo.ESCOLA,
    },
  });

  const checklistVersao = await prisma.checklistVersao.create({
    data: {
      checklistId: checklist.id,
      versao: 1,
      status: ChecklistVersaoStatus.PUBLICADA,
      publicadoAt: new Date(),
      publicadoPorId: admin.id,
      estrutura: {
        regraEvidenciaNaoConformidade: true,
        raioPadraoMetros: 200,
      },
    },
  });

  const [iluminacao, hidraulica, acessibilidade] = await Promise.all([
    prisma.checklistItem.create({
      data: {
        checklistVersaoId: checklistVersao.id,
        ordem: 1,
        codigo: 'ILU-001',
        titulo: 'Iluminacao das areas comuns',
        tipo: ChecklistItemTipo.BOOLEANO,
        obrigatorio: true,
        geraNaoConformidade: true,
        exigeEvidencia: true,
      },
    }),
    prisma.checklistItem.create({
      data: {
        checklistVersaoId: checklistVersao.id,
        ordem: 2,
        codigo: 'HID-001',
        titulo: 'Banheiros e pontos hidraulicos sem vazamento',
        tipo: ChecklistItemTipo.BOOLEANO,
        obrigatorio: true,
        geraNaoConformidade: true,
        exigeEvidencia: true,
      },
    }),
    prisma.checklistItem.create({
      data: {
        checklistVersaoId: checklistVersao.id,
        ordem: 3,
        codigo: 'ACE-001',
        titulo: 'Rotas acessiveis desobstruidas',
        tipo: ChecklistItemTipo.BOOLEANO,
        obrigatorio: true,
        geraNaoConformidade: true,
        exigeEvidencia: true,
      },
    }),
  ]);

  const escola = unidades[0];

  await prisma.cronogramaChecagem.create({
    data: {
      unidadeId: escola.id,
      checklistId: checklist.id,
      frequencia: CronogramaFrequencia.MENSAL,
      proximaChecagemEm: new Date('2026-06-18T00:00:00.000Z'),
      responsavelId: fiscal.id,
      observacoes: 'Rotina mensal de vistoria predial escolar.',
    },
  });

  const fiscalizacao = await prisma.fiscalizacao.create({
    data: {
      secretariaId: educacao.id,
      unidadeId: escola.id,
      checklistVersaoId: checklistVersao.id,
      agenteId: fiscal.id,
      status: FiscalizacaoStatus.CONCLUIDA,
      origem: FiscalizacaoOrigem.ROTINA,
      iniciadaEm: new Date('2026-05-18T11:30:00.000Z'),
      concluidaEm: new Date('2026-05-18T12:05:00.000Z'),
      checkinLatitude: -20.5394,
      checkinLongitude: -47.4008,
      checkinPrecisaoMetros: 12,
      distanciaCheckinMetros: 5,
      dentroRaioPermitido: true,
      observacoes: 'Vistoria inicial de desenvolvimento.',
    },
  });

  await prisma.respostaChecklist.create({
    data: {
      fiscalizacaoId: fiscalizacao.id,
      itemId: iluminacao.id,
      conformidade: ConformidadeStatus.CONFORME,
      valorBooleano: true,
    },
  });

  const respostaNaoConforme = await prisma.respostaChecklist.create({
    data: {
      fiscalizacaoId: fiscalizacao.id,
      itemId: hidraulica.id,
      conformidade: ConformidadeStatus.NAO_CONFORME,
      valorBooleano: false,
      comentario: 'Vazamento identificado no banheiro do bloco B.',
    },
  });

  await prisma.respostaChecklist.create({
    data: {
      fiscalizacaoId: fiscalizacao.id,
      itemId: acessibilidade.id,
      conformidade: ConformidadeStatus.CONFORME,
      valorBooleano: true,
    },
  });

  const naoConformidade = await prisma.naoConformidade.create({
    data: {
      fiscalizacaoId: fiscalizacao.id,
      respostaId: respostaNaoConforme.id,
      itemId: hidraulica.id,
      unidadeId: escola.id,
      registradaPorId: fiscal.id,
      severidade: Severidade.ALTA,
      status: NaoConformidadeStatus.CHAMADO_GERADO,
      descricao: 'Vazamento ativo em banheiro escolar.',
      latitude: -20.5394,
      longitude: -47.4008,
      evidenciaObrigatoriaAtendida: true,
    },
  });

  await prisma.evidencia.create({
    data: {
      fiscalizacaoId: fiscalizacao.id,
      respostaId: respostaNaoConforme.id,
      naoConformidadeId: naoConformidade.id,
      tipo: EvidenciaTipo.FOTO,
      url: 'https://storage.example.local/gestop/dev/vazamento-banheiro.jpg',
      storageKey: 'dev/vazamento-banheiro.jpg',
      mimeType: 'image/jpeg',
      tamanhoBytes: 348210,
      checksum: 'dev-checksum-vazamento-banheiro',
      latitude: -20.5394,
      longitude: -47.4008,
      precisaoMetros: 12,
      capturadaEm: new Date('2026-05-18T11:50:00.000Z'),
      enviadaEm: new Date('2026-05-18T12:06:00.000Z'),
      marcaDagua: 'SIGMA - 18/05/2026 08:50 - Joao Pereira',
    },
  });

  const chamado = await prisma.chamado.create({
    data: {
      codigo: 'CH-2026-000001',
      secretariaId: servicos.id,
      unidadeId: escola.id,
      naoConformidadeId: naoConformidade.id,
      registradoPorId: gestor.id,
      responsavelId: operador.id,
      equipeId: equipeManutencao.id,
      origem: ChamadoOrigem.FISCALIZACAO,
      titulo: 'Reparo de vazamento em banheiro escolar',
      descricao: 'Corrigir vazamento identificado durante vistoria predial escolar.',
      prioridade: ChamadoPrioridade.ALTA,
      status: ChamadoStatus.EM_EXECUCAO,
      prazoEm: new Date('2026-05-20T20:00:00.000Z'),
    },
  });

  await prisma.historicoStatus.createMany({
    data: [
      {
        entidadeTipo: 'Chamado',
        entidadeId: chamado.id,
        statusNovo: ChamadoStatus.ABERTO,
        motivo: 'Chamado criado automaticamente a partir de nao conformidade.',
        alteradoPorId: gestor.id,
      },
      {
        entidadeTipo: 'Chamado',
        entidadeId: chamado.id,
        statusAnterior: ChamadoStatus.ABERTO,
        statusNovo: ChamadoStatus.EM_TRIAGEM,
        motivo: 'Triagem iniciada pelo CCO.',
        alteradoPorId: gestor.id,
      },
      {
        entidadeTipo: 'Chamado',
        entidadeId: chamado.id,
        statusAnterior: ChamadoStatus.EM_TRIAGEM,
        statusNovo: ChamadoStatus.EM_ATENDIMENTO,
        motivo: 'Responsavel de manutencao definido.',
        alteradoPorId: gestor.id,
      },
      {
        entidadeTipo: 'Chamado',
        entidadeId: chamado.id,
        statusAnterior: ChamadoStatus.EM_ATENDIMENTO,
        statusNovo: ChamadoStatus.EM_EXECUCAO,
        motivo: 'Encaminhado para equipe de manutencao em campo.',
        alteradoPorId: gestor.id,
        metadata: { equipeId: equipeManutencao.id },
      },
    ],
  });

  await prisma.chamadoSequencia.upsert({
    where: { ano: 2026 },
    create: { ano: 2026, ultimo: 1 },
    update: { ultimo: 1 },
  });

  await prisma.offlineSyncEvent.create({
    data: {
      clientEventId: 'dev-device-001:evento-fiscalizacao-001',
      deviceId: 'dev-device-001',
      usuarioId: fiscal.id,
      entidadeTipo: EntidadeSincronizavel.FISCALIZACAO,
      entidadeId: fiscalizacao.id,
      operacao: OfflineOperacao.UPSERT,
      payload: {
        fiscalizacaoId: fiscalizacao.id,
        checklistVersaoId: checklistVersao.id,
        totalEvidencias: 1,
      },
      status: OfflineSyncStatus.SINCRONIZADO,
      ocorridoEm: new Date('2026-05-18T12:05:00.000Z'),
      sincronizadoEm: new Date('2026-05-18T12:06:00.000Z'),
    },
  });

  await prisma.dashboardSnapshot.createMany({
    data: [
      {
        escopo: DashboardEscopo.GERAL,
        chave: 'operacional-dia',
        metricas: {
          fiscalizacoesConcluidas: 1,
          naoConformidadesAbertas: 1,
          chamadosAbertos: 1,
          percentualConformidade: 66.7,
        },
      },
      {
        escopo: DashboardEscopo.SECRETARIA,
        secretariaId: educacao.id,
        chave: 'educacao-dia',
        metricas: {
          unidadesFiscalizadas: 1,
          itensConformes: 2,
          itensNaoConformes: 1,
        },
      },
    ],
  });

  await prisma.logAuditoria.create({
    data: {
      usuarioId: admin.id,
      acao: AuditAction.CREATE,
      entidadeTipo: 'Seed',
      valorNovo: {
        secretarias: 9,
        unidades: unidades.length,
        usuarios: 4,
        checklistVersao: checklistVersao.versao,
      },
      correlationId: 'seed-dev-inicial',
    },
  });

  const [secretarias, usuarios, unidadesCount] = await Promise.all([
    prisma.secretaria.count(),
    prisma.usuario.count(),
    prisma.unidadePublica.count(),
  ]);

  logInfo('seed', `Seed concluido: ${secretarias} secretarias, ${unidadesCount} unidades, ${usuarios} usuarios.`);
  if (!isProduction) {
    logInfo('seed', 'Login inicial de desenvolvimento: admin.gestop@franca.sp.gov.br / Gestop@123');
    logInfo('seed', 'Operador de campo (execucao): lucas.almeida@franca.sp.gov.br / Gestop@123');
  } else {
    logInfo('seed', 'Administrador inicial: admin.gestop@franca.sp.gov.br (senha definida via INITIAL_ADMIN_PASSWORD).');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    logError('seed', 'Falha ao executar seed', error);
    await prisma.$disconnect();
    process.exit(1);
  });
