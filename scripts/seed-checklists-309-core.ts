/**
 * 309 — seed FICTÍCIO dos checklists inativos, em cima do seed 306 (T306A/T306B).
 * Antes de rodar: npx prisma generate (e npx prisma migrate deploy no banco local).
 * Mesma trava do 306: só banco LOCAL e nunca NODE_ENV=production. Idempotente; só inserções (nada é apagado).
 *
 * Cria:
 * - perfil "Teste 309 Checklists" (checklists.gerenciar + documentos.criar_avulso) e perfil "Teste 309 Sem Excluir"
 *   (matriz de checklists só com visualizar/alterar → não pode Inativar/Reativar);
 * - usuários `gestor.309@aion.local` (T309), `todas.309@aion.local` (Todas, vínculos T309 e T306B) e `leitor.309@aion.local` (T309, sem excluir);
 * - Secretaria própria "Secretaria Fictícia 309" (T309) com o "Próprio Fictício 309" (T309-A), para não alterar
 *   os contadores do Dashboard do 306 (T306A/T306B) quando os dois seeds rodam no mesmo banco;
 * - em T309: "Checklist Fictício 309 Ativo" e "Checklist Fictício 309 Inativo" (publicados, 2 itens),
 *   1 vistoria CONCLUÍDA já existente no inativo e o cronograma "Cronograma fictício 309" usando o inativo (C5).
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';
import { assertBancoLocal306, seedEscopo306, Seed306 } from './seed-escopo-306-core';

export const T309 = {
  dominio: '@aion.local',
  gestor: 'gestor.309@aion.local',
  todas: 'todas.309@aion.local',
  leitor: 'leitor.309@aion.local',
  perfil: 'Teste 309 Checklists',
  perfilSemExcluir: 'Teste 309 Sem Excluir',
  permissoes: ['checklists.gerenciar', 'documentos.criar_avulso', 'cronograma.visualizar'],
  permissoesSemExcluir: ['matriz.checklists._tela.visualizar', 'matriz.checklists._tela.alterar'],
  ativo: 'Checklist Fictício 309 Ativo',
  inativo: 'Checklist Fictício 309 Inativo',
  observacao: 'Cronograma fictício 309',
} as const;

export type Seed309 = Seed306 & {
  secretaria309: string;
  gestor: string;
  todas: string;
  leitor: string;
  unidadeA: string;
  checklistAtivo: string;
  checklistInativo: string;
  versaoInativo: string;
  fiscalizacaoExistente: string;
  cronograma: string;
};

export async function seedChecklists309(prisma: PrismaClient, senha: string, databaseUrl: string): Promise<Seed309> {
  assertBancoLocal306(databaseUrl);
  const base = await seedEscopo306(prisma, senha, databaseUrl);
  const senhaHash = hashPassword(senha);

  const sec309 =
    (await prisma.secretaria.findFirst({ where: { sigla: 'T309' } })) ??
    (await prisma.secretaria.create({ data: { nome: 'Secretaria Fictícia 309', sigla: 'T309' } }));

  const perfil = async (nome: string, chaves: readonly string[]) => {
    const p = await prisma.perfil.upsert({ where: { nome }, update: {}, create: { nome, descricao: 'Perfil fictício do teste 309' } });
    for (const chave of chaves) {
      const perm = await prisma.permissao.upsert({ where: { chave }, update: {}, create: { chave, modulo: chave.split('.')[chave.startsWith('matriz.') ? 1 : 0] } });
      await prisma.perfilPermissao.upsert({
        where: { perfilId_permissaoId: { perfilId: p.id, permissaoId: perm.id } },
        update: {},
        create: { perfilId: p.id, permissaoId: perm.id },
      });
    }
    return p.id;
  };
  const perfilGestor = await perfil(T309.perfil, T309.permissoes);
  const perfilLeitor = await perfil(T309.perfilSemExcluir, T309.permissoesSemExcluir);

  const usuario = async (email: string, nome: string, perfilId: string, opts: { todas?: boolean } = {}) => {
    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) return existente.id;
    const vinculos = opts.todas ? [sec309.id, base.secretarias.B] : [sec309.id];
    const u = await prisma.usuario.create({
      data: {
        nome,
        email,
        senhaHash,
        secretariaId: sec309.id,
        secretariaAtivaId: opts.todas ? null : sec309.id,
        acessoTodasSecretarias: Boolean(opts.todas),
        perfilAtivoId: perfilId,
        perfis: { create: [{ perfilId }] },
        secretariasVinculos: { create: vinculos.map((secretariaId, i) => ({ secretariaId, principal: i === 0 })) },
      },
    });
    return u.id;
  };
  const gestor = await usuario(T309.gestor, 'Gestor Fictício 309', perfilGestor);
  const todas = await usuario(T309.todas, 'Gestor Fictício 309 Todas', perfilGestor, { todas: true });
  const leitor = await usuario(T309.leitor, 'Leitor Fictício 309 (sem excluir)', perfilLeitor);

  const unidadeA =
    (await prisma.unidadePublica.findFirst({ where: { codigoPatrimonial: 'T309-A' } })) ??
    (await prisma.unidadePublica.create({
      data: { secretariaId: sec309.id, codigoPatrimonial: 'T309-A', nome: 'Próprio Fictício 309', tipo: 'ESCOLA', endereco: 'Rua Fictícia, 309', latitude: -20.5, longitude: -47.4 },
    }));

  const checklist = async (nome: string, ativo: boolean) => {
    const existente = await prisma.checklist.findFirst({ where: { nome, secretariaId: sec309.id }, include: { versoes: true } });
    if (existente) return { id: existente.id, versao: existente.versoes[0].id };
    const c = await prisma.checklist.create({
      data: {
        nome,
        descricao: 'Modelo fictício do teste 309',
        escopo: 'SECRETARIA',
        secretariaId: sec309.id,
        finalidades: ['VISTORIA', 'DOCUMENTO_AVULSO'],
        ativo: true,
        versoes: {
          create: {
            versao: 1,
            status: 'PUBLICADA',
            publicadoAt: new Date(),
            itens: {
              create: [1, 2].map((ordem) => ({ ordem, codigo: `T309-${ordem}`, titulo: `Item fictício 309 ${ordem}`, tipo: 'BOOLEANO' as const })),
            },
          },
        },
      },
      include: { versoes: true },
    });
    if (!ativo) await prisma.checklist.update({ where: { id: c.id }, data: { ativo: false } });
    return { id: c.id, versao: c.versoes[0].id };
  };
  const ativo = await checklist(T309.ativo, true);
  const inativo = await checklist(T309.inativo, false);

  const fiscExistente =
    (await prisma.fiscalizacao.findFirst({ where: { checklistVersaoId: inativo.versao, unidadeId: unidadeA.id } })) ??
    (await prisma.fiscalizacao.create({
      data: {
        secretariaId: sec309.id,
        unidadeId: unidadeA.id,
        checklistVersaoId: inativo.versao,
        agenteId: gestor,
        status: 'CONCLUIDA',
        iniciadaEm: new Date(Date.now() - 2 * 86_400_000),
        concluidaEm: new Date(Date.now() - 2 * 86_400_000),
      },
    }));

  const cronograma = await prisma.cronogramaChecagem.upsert({
    where: { unidadeId_checklistId: { unidadeId: unidadeA.id, checklistId: inativo.id } },
    update: {},
    create: {
      unidadeId: unidadeA.id,
      checklistId: inativo.id,
      frequencia: 'MENSAL',
      proximaChecagemEm: new Date(Date.UTC(2026, 10, 10)),
      observacoes: T309.observacao,
      responsaveis: { create: [{ usuarioId: gestor }] },
    },
  });

  return {
    ...base,
    secretaria309: sec309.id,
    gestor,
    todas,
    leitor,
    unidadeA: unidadeA.id,
    checklistAtivo: ativo.id,
    checklistInativo: inativo.id,
    versaoInativo: inativo.versao,
    fiscalizacaoExistente: fiscExistente.id,
    cronograma: cronograma.id,
  };
}
