/** Visão de arquitetura lida dos módulos reais (frontend Next.js, API NestJS, Prisma, armazenamento). */

export type BlocoArquitetura = {
  id: string;
  nome: string;
  papel: string;
  onde: string;
};

export const BLOCOS_ARQUITETURA: BlocoArquitetura[] = [
  {
    id: 'frontend',
    nome: 'Frontend Next.js',
    papel: 'App Router com telas autenticadas, rotas públicas de chamado e validação de documento, e a área administrativa. O painel de documentos do chamado usa canColetarAssinatura / resolvePodeColetar, não só o acesso ao módulo.',
    onde: 'frontend/app. Sessão e menu em frontend/lib/navigation.ts e frontend/lib/permissions-matrix.ts.',
  },
  {
    id: 'api',
    nome: 'API NestJS',
    papel: 'Controllers por módulo (auth, chamados, tarefas, fiscalizações, documentos, operacional, admin, mobile, cronograma, relatórios, integrações, backup, e-mail, LGPD). AuthGuard e PermissionsGuard nas rotas privadas.',
    onde: 'src/app.module.ts e os controllers em src/.',
  },
  {
    id: 'prisma',
    nome: 'Prisma e PostgreSQL',
    papel: 'Persistência relacional. O schema não usa @@map: o nome do model é o nome da tabela. Enums cobrem status, origens e tipos.',
    onde: 'prisma/schema.prisma, PrismaModule em src/prisma.',
  },
  {
    id: 'evidencias',
    nome: 'Armazenamento de evidências',
    papel: 'Abertura, histórico do chamado e anexos de tarefa aceitam JPG, JPEG, PNG, WEBP, PDF, MP4, MOV, M4V, 3GP e WEBM. O binário fica no armazenamento; GET /storage exige sessão. Backup S3 é outro fluxo.',
    onde: 'src/storage. Modelos Evidencia, Chamado, ChamadoTarefaAnexo, Documento e DocumentoAssinatura.',
  },
];

export const FLUXO_ARQUITETURA = [
  'O navegador fala com o Next.js.',
  'As telas chamam a API NestJS com o token da sessão.',
  'A API aplica perfil, permissão e escopo de secretaria.',
  'O Prisma grava e lê o PostgreSQL.',
  'Arquivos grandes seguem para o armazenamento; o banco fica com a referência.',
] as const;

export const INDICE_DOCUMENTACAO = [
  {
    id: 'arquitetura',
    titulo: 'Visão de arquitetura',
    resumo: 'Como o frontend, a API, o banco e o armazenamento de evidências se encontram.',
  },
  {
    id: 'banco',
    titulo: 'Diagrama do banco',
    resumo: 'Tabelas do schema Prisma, campos principais e relacionamentos, agrupados por domínio.',
  },
  {
    id: 'casos',
    titulo: 'Diagrama de casos de uso',
    resumo: 'Atores encontrados no código e os casos de uso ligados a rotas e controllers existentes.',
  },
  {
    id: 'matriz',
    titulo: 'Matriz de rastreabilidade',
    resumo: 'Cada capacidade aponta o ator, a tela, a API, as tabelas e a regra de permissão.',
  },
] as const;
