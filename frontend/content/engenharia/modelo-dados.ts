/** Diagrama lógico derivado de prisma/schema.prisma (PostgreSQL, sem @@map). */

export type ArestaModelo = {
  de: string;
  para: string;
  rotulo: string;
};

export type TabelaModelo = {
  nome: string;
  resumo: string;
  campos: string[];
  relacoes: string[];
};

export type DominioModelo = {
  id: string;
  titulo: string;
  descricao: string;
  tabelas: TabelaModelo[];
  arestas: ArestaModelo[];
};

export const DOMINIOS_DADOS: DominioModelo[] = [
  {
    id: 'identidade',
    titulo: 'Identidade e acesso',
    descricao:
      'Quem entra no sistema, com qual perfil, em quais secretarias e com quais permissões. O escopo operacional usa a secretaria ativa da sessão.',
    tabelas: [
      {
        nome: 'Secretaria',
        resumo: 'Órgão responsável. Âncora de escopo de chamados, vistorias, documentos e equipes.',
        campos: ['nome', 'sigla (única)', 'responsavelNome', 'responsavelEmail', 'ativo'],
        relacoes: [
          '1:N UnidadePublica, Usuario (principal e ativa), UsuarioSecretaria',
          '1:N Checklist, Fiscalizacao, Chamado, Documento, Equipe, DashboardSnapshot',
          '1:N TipoChamadoSecretaria, ChamadoTarefa',
        ],
      },
      {
        nome: 'Usuario',
        resumo: 'Conta interna. A senha fica apenas como hash. Perfil ativo e secretaria ativa definem a sessão.',
        campos: ['nome', 'email (único)', 'cpf', 'senhaHash', 'acessoTodasSecretarias', 'ativo', 'ultimoLoginAt'],
        relacoes: [
          'N:1 Secretaria (secretariaId e secretariaAtivaId)',
          'N:1 Perfil (perfilAtivoId), N:1 Cargo',
          'N:N Perfil, Permissao e Secretaria',
          '1:N PasswordResetToken, PushSubscription',
        ],
      },
      {
        nome: 'Perfil',
        resumo: 'Papel de acesso. Natureza INTERNO ou EXTERNO. O perfil de sistema “Administrador do Sistema” não é um model à parte.',
        campos: ['nome (único)', 'natureza (PerfilNatureza)', 'sistema', 'ativo'],
        relacoes: ['1:N UsuarioPerfil, PerfilPermissao', '1:N Usuario.perfilAtivo'],
      },
      {
        nome: 'Permissao',
        resumo: 'Chave de autorização (legada ou matriz), agrupada por módulo.',
        campos: ['chave (única)', 'modulo', 'descricao'],
        relacoes: ['1:N PerfilPermissao, UsuarioPermissao'],
      },
      {
        nome: 'UsuarioPerfil',
        resumo: 'Vínculo N:N entre usuário e perfil.',
        campos: ['usuarioId', 'perfilId', 'createdAt'],
        relacoes: ['N:1 Usuario', 'N:1 Perfil'],
      },
      {
        nome: 'PerfilPermissao',
        resumo: 'Permissões concedidas ao perfil.',
        campos: ['perfilId', 'permissaoId'],
        relacoes: ['N:1 Perfil', 'N:1 Permissao'],
      },
      {
        nome: 'UsuarioPermissao',
        resumo: 'Permissão individual, além das do perfil.',
        campos: ['usuarioId', 'permissaoId'],
        relacoes: ['N:1 Usuario', 'N:1 Permissao'],
      },
      {
        nome: 'UsuarioSecretaria',
        resumo: 'Secretarias em que o usuário pode atuar. Uma pode ser marcada como principal.',
        campos: ['usuarioId', 'secretariaId', 'principal'],
        relacoes: ['N:1 Usuario', 'N:1 Secretaria'],
      },
      {
        nome: 'Cargo',
        resumo: 'Catálogo de cargos usado no cadastro de usuários.',
        campos: ['nome (único)', 'ativo'],
        relacoes: ['1:N Usuario'],
      },
      {
        nome: 'PasswordResetToken',
        resumo: 'Token de redefinição. Persiste o hash do token, não o token em claro.',
        campos: ['tokenHash (único)', 'expiresAt', 'usedAt'],
        relacoes: ['N:1 Usuario'],
      },
      {
        nome: 'PushSubscription',
        resumo: 'Inscrição Web Push do usuário (endpoint e chaves do navegador).',
        campos: ['endpoint (único)', 'p256dh', 'auth'],
        relacoes: ['N:1 Usuario'],
      },
    ],
    arestas: [
      { de: 'Usuario', para: 'Secretaria', rotulo: 'secretaria' },
      { de: 'Usuario', para: 'Perfil', rotulo: 'perfil ativo' },
      { de: 'Usuario', para: 'Cargo', rotulo: 'cargo' },
      { de: 'UsuarioPerfil', para: 'Usuario', rotulo: 'usuarioId' },
      { de: 'UsuarioPerfil', para: 'Perfil', rotulo: 'perfilId' },
      { de: 'PerfilPermissao', para: 'Perfil', rotulo: 'perfilId' },
      { de: 'PerfilPermissao', para: 'Permissao', rotulo: 'permissaoId' },
      { de: 'UsuarioPermissao', para: 'Usuario', rotulo: 'usuarioId' },
      { de: 'UsuarioPermissao', para: 'Permissao', rotulo: 'permissaoId' },
      { de: 'UsuarioSecretaria', para: 'Usuario', rotulo: 'usuarioId' },
      { de: 'UsuarioSecretaria', para: 'Secretaria', rotulo: 'secretariaId' },
      { de: 'PasswordResetToken', para: 'Usuario', rotulo: 'usuarioId' },
      { de: 'PushSubscription', para: 'Usuario', rotulo: 'usuarioId' },
    ],
  },
  {
    id: 'mapas',
    titulo: 'Mapas e unidades',
    descricao: 'Próprios públicos georreferenciados, catálogo de tipos e o registro da importação do webmap.',
    tabelas: [
      {
        nome: 'UnidadePublica',
        resumo: 'Próprio municipal. Coordenadas e raio de validação sustentam o mapa e o check-in.',
        campos: ['codigoPatrimonial (único)', 'nome', 'tipo', 'endereco', 'regiao', 'latitude', 'longitude', 'raioValidacaoMetros', 'ativo'],
        relacoes: [
          'N:1 Secretaria',
          '1:N Fiscalizacao, NaoConformidade, Chamado, Documento, Checklist, CronogramaChecagem, DashboardSnapshot',
        ],
      },
      {
        nome: 'TipoProprio',
        resumo: 'Catálogo parametrizável do tipo da unidade (código usado em UnidadePublica.tipo).',
        campos: ['codigo (único)', 'nome', 'ativo', 'sistema', 'ordem'],
        relacoes: ['Sem chave estrangeira. O vínculo com UnidadePublica e Checklist.unidadeTipo é pelo código.'],
      },
      {
        nome: 'WebmapImport',
        resumo: 'Execução da sincronização QGIS/webmap: contagens, commit e resultado em JSON.',
        campos: ['githubCommitSha', 'dryRun', 'triggeredBy', 'created', 'updated', 'deactivated', 'result (Json)'],
        relacoes: ['N:1 Usuario (quem disparou, opcional)'],
      },
      {
        nome: 'DashboardSnapshot',
        resumo: 'Métricas materializadas por escopo geral, secretaria ou unidade.',
        campos: ['escopo (DashboardEscopo)', 'chave', 'periodoInicio', 'periodoFim', 'metricas (Json)', 'geradoEm'],
        relacoes: ['N:1 Secretaria', 'N:1 UnidadePublica'],
      },
    ],
    arestas: [
      { de: 'UnidadePublica', para: 'Secretaria', rotulo: 'secretariaId' },
      { de: 'WebmapImport', para: 'Usuario', rotulo: 'usuarioId' },
      { de: 'DashboardSnapshot', para: 'Secretaria', rotulo: 'secretariaId' },
      { de: 'DashboardSnapshot', para: 'UnidadePublica', rotulo: 'unidadeId' },
    ],
  },
  {
    id: 'chamados',
    titulo: 'Chamados',
    descricao:
      'Abertura, triagem, execução, observadores, tarefas e o histórico de status. ChamadoTarefa e ChamadoTarefaAnexo fazem parte deste schema.',
    tabelas: [
      {
        nome: 'TipoChamado',
        resumo: 'Catálogo do tipo, com prazos de SLA por prioridade e flag de vistoria prévia.',
        campos: ['nome (único)', 'slaBaixaDias', 'slaMediaDias', 'slaAltaDias', 'slaUrgenteDias', 'exigeVistoriaPrevia', 'ativo'],
        relacoes: ['1:N Chamado, TipoChamadoSecretaria, ChecklistTipoChamado'],
      },
      {
        nome: 'TipoChamadoSecretaria',
        resumo: 'Secretarias que podem executar um tipo. O perfil EXTERNO só encaminha para este vínculo.',
        campos: ['tipoChamadoId', 'secretariaId'],
        relacoes: ['N:1 TipoChamado', 'N:1 Secretaria'],
      },
      {
        nome: 'Equipe',
        resumo: 'Equipe própria ou terceirizada, opcionalmente de uma secretaria.',
        campos: ['codigo (único)', 'nome', 'tipo (EquipeTipo)', 'emailEquipe', 'ativo'],
        relacoes: ['N:1 Secretaria', '1:N EquipeUsuario, Chamado, ChamadoTarefa'],
      },
      {
        nome: 'EquipeUsuario',
        resumo: 'Membros da equipe.',
        campos: ['equipeId', 'usuarioId'],
        relacoes: ['N:1 Equipe', 'N:1 Usuario'],
      },
      {
        nome: 'ChamadoSequencia',
        resumo: 'Contador anual usado na geração do código do chamado.',
        campos: ['ano', 'ultimo'],
        relacoes: ['Sem chave estrangeira.'],
      },
      {
        nome: 'Chamado',
        resumo: 'Demanda operacional. Pode nascer de unidade, endereço, geolocalização, QR ou não conformidade. A exclusão é lógica.',
        campos: [
          'codigo (único)',
          'status (ChamadoStatus)',
          'origem (ChamadoOrigem)',
          'prioridade',
          'modoLocalizacao',
          'descricao',
          'prazoEm',
          'previstaExecucaoEm',
          'excluidoEm',
        ],
        relacoes: [
          'N:1 Secretaria, UnidadePublica, TipoChamado, Equipe, Usuario (responsável, registrador e exclusão)',
          'N:1 NaoConformidade (opcional, única)',
          '1:N Evidencia, ChamadoObservador, Documento, ChamadoTarefa',
        ],
      },
      {
        nome: 'ChamadoObservador',
        resumo: 'Usuários que acompanham um chamado em Meus chamados.',
        campos: ['chamadoId', 'usuarioId', 'origem', 'createdById'],
        relacoes: ['N:1 Chamado', 'N:1 Usuario (observador e autor)'],
      },
      {
        nome: 'ChamadoTarefa',
        resumo: 'Pendência atribuída dentro do chamado, com status próprio e prazo.',
        campos: ['titulo', 'prazo', 'prioridade', 'status (ChamadoTarefaStatus)', 'justificativa', 'conclusaoTexto', 'concluidaEm'],
        relacoes: ['N:1 Chamado, Secretaria, Equipe, Usuario (responsável, criador e quem concluiu)', '1:N ChamadoTarefaAnexo'],
      },
      {
        nome: 'ChamadoTarefaAnexo',
        resumo: 'Arquivo da tarefa. O binário fica no armazenamento; aqui ficam URL, chave e metadados.',
        campos: ['nome', 'url', 'storageKey', 'mimeType', 'tamanhoBytes'],
        relacoes: ['N:1 ChamadoTarefa', 'N:1 Usuario (criadoPor)'],
      },
      {
        nome: 'HistoricoStatus',
        resumo: 'Trilha genérica de mudança de status (entidade e identificador em texto).',
        campos: ['entidadeTipo', 'entidadeId', 'statusAnterior', 'statusNovo', 'motivo', 'metadata (Json)'],
        relacoes: ['N:1 Usuario (alteradoPor)'],
      },
    ],
    arestas: [
      { de: 'TipoChamadoSecretaria', para: 'TipoChamado', rotulo: 'tipo' },
      { de: 'TipoChamadoSecretaria', para: 'Secretaria', rotulo: 'secretaria' },
      { de: 'Equipe', para: 'Secretaria', rotulo: 'secretaria' },
      { de: 'EquipeUsuario', para: 'Equipe', rotulo: 'equipe' },
      { de: 'EquipeUsuario', para: 'Usuario', rotulo: 'membro' },
      { de: 'Chamado', para: 'Secretaria', rotulo: 'secretaria' },
      { de: 'Chamado', para: 'UnidadePublica', rotulo: 'unidade' },
      { de: 'Chamado', para: 'TipoChamado', rotulo: 'tipo' },
      { de: 'Chamado', para: 'Equipe', rotulo: 'equipe' },
      { de: 'ChamadoObservador', para: 'Chamado', rotulo: 'chamado' },
      { de: 'ChamadoObservador', para: 'Usuario', rotulo: 'observador' },
      { de: 'ChamadoTarefa', para: 'Chamado', rotulo: 'chamado' },
      { de: 'ChamadoTarefa', para: 'Secretaria', rotulo: 'secretaria' },
      { de: 'ChamadoTarefa', para: 'Equipe', rotulo: 'equipe' },
      { de: 'ChamadoTarefaAnexo', para: 'ChamadoTarefa', rotulo: 'tarefa' },
      { de: 'HistoricoStatus', para: 'Usuario', rotulo: 'alterado por' },
    ],
  },
  {
    id: 'vistorias',
    titulo: 'Checklists e vistorias',
    descricao: 'Modelo do checklist, agenda, fiscalização em campo, respostas, evidências e não conformidades.',
    tabelas: [
      {
        nome: 'CategoriaVistoria',
        resumo: 'Agrupador dos itens de checklist.',
        campos: ['nome (único)', 'ativo'],
        relacoes: ['1:N ChecklistItem'],
      },
      {
        nome: 'Checklist',
        resumo: 'Formulário reutilizável. Escopo global, secretaria, tipo de próprio ou unidade. Finalidade vistoria, chamado ou documento avulso.',
        campos: ['nome', 'finalidade', 'finalidades[]', 'escopo', 'unidadeTipo', 'ativo'],
        relacoes: ['N:1 Secretaria, UnidadePublica', '1:N ChecklistVersao, CronogramaChecagem, ChecklistTipoChamado'],
      },
      {
        nome: 'ChecklistTipoChamado',
        resumo: 'Quais tipos de chamado usam o checklist.',
        campos: ['checklistId', 'tipoChamadoId'],
        relacoes: ['N:1 Checklist', 'N:1 TipoChamado'],
      },
      {
        nome: 'ChecklistVersao',
        resumo: 'Versão publicada ou rascunho. A fiscalização aponta para a versão, não para o checklist vivo.',
        campos: ['versao', 'status (ChecklistVersaoStatus)', 'estrutura (Json)', 'publicadoAt'],
        relacoes: ['N:1 Checklist, Usuario (publicadoPor)', '1:N ChecklistItem, Fiscalizacao, Documento'],
      },
      {
        nome: 'ChecklistItem',
        resumo: 'Pergunta da versão: texto, número, foto, escala Likert, assinatura, entre outros tipos.',
        campos: ['ordem', 'codigo', 'titulo', 'tipo (ChecklistItemTipo)', 'obrigatorio', 'geraNaoConformidade', 'exigeEvidencia'],
        relacoes: ['N:1 ChecklistVersao, CategoriaVistoria', '1:N RespostaChecklist, DocumentoResposta, NaoConformidade'],
      },
      {
        nome: 'CronogramaChecagem',
        resumo: 'Recorrência de vistoria de um checklist em uma unidade.',
        campos: ['frequencia (CronogramaFrequencia)', 'proximaChecagemEm', 'ultimaChecagemEm', 'ativo'],
        relacoes: ['N:1 UnidadePublica, Checklist, Usuario', '1:N CronogramaChecagemResponsavel, Fiscalizacao'],
      },
      {
        nome: 'CronogramaChecagemResponsavel',
        resumo: 'Responsáveis previstos da checagem (N:N).',
        campos: ['cronogramaId', 'usuarioId'],
        relacoes: ['N:1 CronogramaChecagem', 'N:1 Usuario'],
      },
      {
        nome: 'Fiscalizacao',
        resumo: 'Vistoria realizada ou prevista. Guarda check-in, origem (rotina, chamado, avulsa, offline, manual) e o agente.',
        campos: ['status (FiscalizacaoStatus)', 'origem', 'iniciadaEm', 'concluidaEm', 'dentroRaioPermitido', 'dataVistoriaInformada', 'cronogramaId'],
        relacoes: ['N:1 Secretaria, UnidadePublica, ChecklistVersao, Usuario (agente e lançamento), CronogramaChecagem', '1:N RespostaChecklist, Evidencia, NaoConformidade, Documento'],
      },
      {
        nome: 'RespostaChecklist',
        resumo: 'Resposta de um item numa fiscalização.',
        campos: ['conformidade', 'valorTexto', 'valorNumero', 'valorBooleano', 'valorJson', 'comentario'],
        relacoes: ['N:1 Fiscalizacao, ChecklistItem', '1:N Evidencia', '1:1 NaoConformidade (opcional)'],
      },
      {
        nome: 'Evidencia',
        resumo: 'Arquivo de campo (foto, vídeo, áudio, documento ou assinatura). O conteúdo fica no armazenamento apontado por storageKey.',
        campos: ['tipo (EvidenciaTipo)', 'url', 'storageKey', 'mimeType', 'checksum', 'latitude', 'longitude', 'capturadaEm'],
        relacoes: ['N:1 Fiscalizacao, RespostaChecklist, NaoConformidade, Chamado'],
      },
      {
        nome: 'NaoConformidade',
        resumo: 'Desvio gerado por item de vistoria. Pode originar chamado ou ser baixada manualmente.',
        campos: ['severidade', 'status (NaoConformidadeStatus)', 'descricao', 'motivoBaixa', 'baixadaEm'],
        relacoes: ['N:1 Fiscalizacao, RespostaChecklist, ChecklistItem, UnidadePublica, Usuario', '1:1 Chamado (opcional)', '1:N Evidencia'],
      },
    ],
    arestas: [
      { de: 'ChecklistItem', para: 'CategoriaVistoria', rotulo: 'categoria' },
      { de: 'ChecklistVersao', para: 'Checklist', rotulo: 'checklist' },
      { de: 'ChecklistItem', para: 'ChecklistVersao', rotulo: 'versão' },
      { de: 'ChecklistTipoChamado', para: 'Checklist', rotulo: 'checklist' },
      { de: 'CronogramaChecagem', para: 'Checklist', rotulo: 'checklist' },
      { de: 'CronogramaChecagemResponsavel', para: 'CronogramaChecagem', rotulo: 'agenda' },
      { de: 'Fiscalizacao', para: 'ChecklistVersao', rotulo: 'versão' },
      { de: 'Fiscalizacao', para: 'CronogramaChecagem', rotulo: 'agenda' },
      { de: 'RespostaChecklist', para: 'Fiscalizacao', rotulo: 'vistoria' },
      { de: 'RespostaChecklist', para: 'ChecklistItem', rotulo: 'item' },
      { de: 'Evidencia', para: 'Fiscalizacao', rotulo: 'vistoria' },
      { de: 'Evidencia', para: 'RespostaChecklist', rotulo: 'resposta' },
      { de: 'NaoConformidade', para: 'Fiscalizacao', rotulo: 'vistoria' },
      { de: 'NaoConformidade', para: 'RespostaChecklist', rotulo: 'resposta' },
      { de: 'NaoConformidade', para: 'ChecklistItem', rotulo: 'item' },
      { de: 'Evidencia', para: 'NaoConformidade', rotulo: 'NC' },
      { de: 'Evidencia', para: 'Chamado', rotulo: 'chamado' },
      { de: 'Fiscalizacao', para: 'UnidadePublica', rotulo: 'unidade' },
      { de: 'Fiscalizacao', para: 'Secretaria', rotulo: 'secretaria' },
      { de: 'Checklist', para: 'Secretaria', rotulo: 'secretaria' },
      { de: 'NaoConformidade', para: 'UnidadePublica', rotulo: 'unidade' },
      { de: 'CronogramaChecagem', para: 'UnidadePublica', rotulo: 'unidade' },
    ],
  },
  {
    id: 'documentos',
    titulo: 'Documentos',
    descricao:
      'Peças geradas pela vistoria, pela execução ou avulsas, com respostas, assinatura coletada e pedido de assinatura interna.',
    tabelas: [
      {
        nome: 'DocumentoSequencia',
        resumo: 'Contador anual do código do documento.',
        campos: ['ano', 'ultimo'],
        relacoes: ['Sem chave estrangeira.'],
      },
      {
        nome: 'Documento',
        resumo: 'Peça com código público e código de validação. PDFs original e assinado ficam no armazenamento, com hash.',
        campos: ['codigo (único)', 'codigoValidacao (único)', 'tipo', 'situacao', 'origem', 'titulo', 'pdfOriginalSha256', 'pdfAssinadoSha256'],
        relacoes: [
          'N:1 Secretaria, UnidadePublica, Chamado, Fiscalizacao, ChecklistVersao, Usuario',
          'N:1 Documento (substituidoPor)',
          '1:N DocumentoAssinatura, DocumentoAssinaturaPedido, DocumentoResposta',
        ],
      },
      {
        nome: 'DocumentoResposta',
        resumo: 'Resposta de checklist copiada ou preenchida no documento avulso.',
        campos: ['conformidade', 'valorTexto', 'valorNumero', 'valorBooleano', 'valorJson', 'comentario'],
        relacoes: ['N:1 Documento', 'N:1 ChecklistItem'],
      },
      {
        nome: 'DocumentoAssinatura',
        resumo: 'Assinatura externa ou interna já coletada, com evidência, contexto do dispositivo e hashes do PDF.',
        campos: ['assinanteNome', 'canal', 'evidenciaStorageKey', 'coletadaEm', 'invalida', 'pdfAssinadoSha256'],
        relacoes: ['N:1 Documento', 'N:1 Usuario (assinante e quem coletou)'],
      },
      {
        nome: 'DocumentoAssinaturaPedido',
        resumo: 'Pedido de assinatura interna ainda pendente, assinado, cancelado ou retirado. O registro da assinatura continua em DocumentoAssinatura.',
        campos: ['status (DocumentoAssinaturaPedidoStatus)', 'requestedAt', 'signedAt', 'canceladoMotivo', 'retiradoEm'],
        relacoes: ['N:1 Documento', 'N:1 Usuario (destinatario e solicitante)'],
      },
    ],
    arestas: [
      { de: 'Documento', para: 'Documento', rotulo: 'substitui' },
      { de: 'DocumentoResposta', para: 'Documento', rotulo: 'documento' },
      { de: 'DocumentoAssinatura', para: 'Documento', rotulo: 'documento' },
      { de: 'DocumentoAssinaturaPedido', para: 'Documento', rotulo: 'documento' },
      { de: 'Documento', para: 'Chamado', rotulo: 'chamado' },
      { de: 'Documento', para: 'Fiscalizacao', rotulo: 'vistoria' },
      { de: 'Documento', para: 'Secretaria', rotulo: 'secretaria' },
      { de: 'DocumentoAssinaturaPedido', para: 'Usuario', rotulo: 'destinatário' },
    ],
  },
  {
    id: 'plataforma',
    titulo: 'Auditoria e plataforma',
    descricao:
      'Trilha de auditoria, fila offline, backup e e-mail. Credenciais de S3 e SMTP são colunas criptografadas e não voltam na API.',
    tabelas: [
      {
        nome: 'LogAuditoria',
        resumo: 'Evento de auditoria com ação, entidade, valores, perfil e secretaria ativos no momento.',
        campos: ['acao (AuditAction)', 'entidadeTipo', 'entidadeId', 'tela', 'funcao', 'descricao', 'correlationId'],
        relacoes: ['N:1 Usuario'],
      },
      {
        nome: 'AuditoriaConfig',
        resumo: 'Liga ou desliga a auditoria fina por tela, função e ação.',
        campos: ['chave (única)', 'telaId', 'funcaoId', 'acao', 'ativo'],
        relacoes: ['Sem chave estrangeira.'],
      },
      {
        nome: 'OfflineSyncEvent',
        resumo: 'Evento enviado pelo dispositivo de campo. Pode ficar pendente, em conflito ou ignorado.',
        campos: ['clientEventId (único)', 'deviceId', 'entidadeTipo', 'operacao', 'status', 'payload (Json)', 'tentativas'],
        relacoes: ['N:1 Usuario (autor e quem ignorou)'],
      },
      {
        nome: 'BackupS3Config',
        resumo: 'Configuração única do backup. A chave secreta fica cifrada em secretAccessKeyEnc e não é devolvida pela API.',
        campos: ['enabled', 'bucket', 'endpoint', 'dailyHour', 'keepDaily', 'lastRunStatus', 'lastRunObjectKey'],
        relacoes: ['Registro único (id fixo). Sem chave estrangeira.'],
      },
      {
        nome: 'ConfiguracaoEmail',
        resumo: 'SMTP único do SIGMA. A senha fica cifrada em senhaEnc e não é devolvida pela API.',
        campos: ['ativo', 'remetenteEmail', 'smtpHost', 'smtpPort', 'seguranca', 'assuntoEquipe'],
        relacoes: ['Registro único (id fixo). Sem chave estrangeira.'],
      },
    ],
    arestas: [
      { de: 'LogAuditoria', para: 'Usuario', rotulo: 'usuario' },
      { de: 'OfflineSyncEvent', para: 'Usuario', rotulo: 'usuario' },
    ],
  },
];

export const TOTAL_TABELAS = DOMINIOS_DADOS.reduce((total, dominio) => total + dominio.tabelas.length, 0);

export const FONTE_SCHEMA = 'prisma/schema.prisma';
