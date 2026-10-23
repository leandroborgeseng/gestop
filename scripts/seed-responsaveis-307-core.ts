/**
 * 307 — seed FICTÍCIO para os responsáveis do cronograma, em cima do seed 306 (T306A/T306B).
 * Antes de rodar: npx prisma generate (e npx prisma migrate deploy no banco local).
 * Mesma trava do 306: só banco LOCAL e nunca NODE_ENV=production.
 * Idempotente (upsert por e-mail e pela chave unidade+checklist).
 *
 * Cria:
 * - permissões de cronograma (visualizar/inserir/alterar) no perfil fictício "Teste 306 Dashboard";
 * - 8 usuários ativos em A (lista com mais de 6 → rolagem) e 1 INATIVO em A (`inativo.307`);
 * - um cronograma no "Próprio Fictício A" com responsáveis: gestor.a, inativo.307 e gestor.b (de B),
 *   para o R4 (editar mostra "Inativo" e "Outra Secretaria");
 * - ciclo 2 (R5b pela UI): usuário `todas.307` com acesso a "Todas as Secretarias" (vínculos A e B, sem
 *   permissão de admin) e o cronograma "Cronograma fictício 307 B" no Próprio Fictício B com gestor.a e gestor.b.
 *   Em "Todas" os dois estão OK; trocando para T306B o cronograma continua no escopo e gestor.a vira
 *   "Outra Secretaria" → confirmar "manter" e salvar grava a auditoria.
 *   (Não existe próprio compartilhado entre Secretarias no modelo: `UnidadePublica.secretariaId` é único.)
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';
import { assertBancoLocal306, seedEscopo306, Seed306, T306 } from './seed-escopo-306-core';

export const T307 = {
  dominio: '@teste306.invalid',
  inativo: 'inativo.307@teste306.invalid',
  extrasA: Array.from({ length: 8 }, (_, i) => `extra${i + 1}.a.307@teste306.invalid`),
  permissoes: ['cronograma.visualizar', 'cronograma.inserir', 'cronograma.alterar'],
  observacao: 'Cronograma fictício 307',
  todas: 'todas.307@teste306.invalid',
  observacaoB: 'Cronograma fictício 307 B',
} as const;

export type Seed307 = Seed306 & {
  inativo: string;
  extrasA: string[];
  cronogramaA: string;
  unidadeA: string;
  checklist: string;
  todas: string;
  cronogramaB: string;
  unidadeB: string;
};

export async function seedResponsaveis307(prisma: PrismaClient, senha: string, databaseUrl: string): Promise<Seed307> {
  assertBancoLocal306(databaseUrl);
  const base = await seedEscopo306(prisma, senha, databaseUrl);
  const senhaHash = hashPassword(senha);

  const perfil = await prisma.perfil.findUniqueOrThrow({ where: { nome: T306.perfil } });
  for (const chave of T307.permissoes) {
    const p = await prisma.permissao.upsert({ where: { chave }, update: {}, create: { chave, modulo: 'cronograma' } });
    await prisma.perfilPermissao.upsert({
      where: { perfilId_permissaoId: { perfilId: perfil.id, permissaoId: p.id } },
      update: {},
      create: { perfilId: perfil.id, permissaoId: p.id },
    });
  }

  const usuarioA = async (email: string, nome: string, ativo: boolean) => {
    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) return existente.id;
    const u = await prisma.usuario.create({
      data: {
        nome,
        email,
        senhaHash,
        ativo,
        secretariaId: base.secretarias.A,
        secretariaAtivaId: base.secretarias.A,
        perfilAtivoId: perfil.id,
        perfis: { create: [{ perfilId: perfil.id }] },
        secretariasVinculos: { create: [{ secretariaId: base.secretarias.A, principal: true }] },
      },
    });
    return u.id;
  };
  const inativo = await usuarioA(T307.inativo, 'Responsável Fictício Inativo 307', false);
  const extrasA: string[] = [];
  for (const [i, email] of T307.extrasA.entries()) extrasA.push(await usuarioA(email, `Usuário Fictício A ${String(i + 1).padStart(2, '0')}`, true));

  const unidadeA = await prisma.unidadePublica.findFirstOrThrow({ where: { codigoPatrimonial: 'T306-A' } });
  const checklist = await prisma.checklist.findFirstOrThrow({ where: { nome: 'Checklist Fictício 306' } });
  const cronograma = await prisma.cronogramaChecagem.upsert({
    where: { unidadeId_checklistId: { unidadeId: unidadeA.id, checklistId: checklist.id } },
    update: {},
    create: {
      unidadeId: unidadeA.id,
      checklistId: checklist.id,
      frequencia: 'MENSAL',
      proximaChecagemEm: new Date(Date.UTC(2026, 11, 1)),
      responsavelId: base.usuarios.gestorA,
      observacoes: T307.observacao,
      responsaveis: {
        create: [base.usuarios.gestorA, inativo, base.usuarios.gestorB].map((usuarioId) => ({ usuarioId })),
      },
    },
  });

  // Ciclo 2: usuário "Todas" (não admin) + cronograma em B com gestor.a (A) e gestor.b (B).
  let todas = (await prisma.usuario.findUnique({ where: { email: T307.todas } }))?.id;
  if (!todas) {
    todas = (
      await prisma.usuario.create({
        data: {
          nome: 'Usuário Fictício Todas 307',
          email: T307.todas,
          senhaHash,
          secretariaId: base.secretarias.A,
          secretariaAtivaId: null,
          acessoTodasSecretarias: true,
          perfilAtivoId: perfil.id,
          perfis: { create: [{ perfilId: perfil.id }] },
          secretariasVinculos: {
            create: [
              { secretariaId: base.secretarias.A, principal: true },
              { secretariaId: base.secretarias.B, principal: false },
            ],
          },
        },
      })
    ).id;
  }
  const unidadeB = await prisma.unidadePublica.findFirstOrThrow({ where: { codigoPatrimonial: 'T306-B' } });
  const cronogramaB = await prisma.cronogramaChecagem.upsert({
    where: { unidadeId_checklistId: { unidadeId: unidadeB.id, checklistId: checklist.id } },
    update: {},
    create: {
      unidadeId: unidadeB.id,
      checklistId: checklist.id,
      frequencia: 'MENSAL',
      proximaChecagemEm: new Date(Date.UTC(2026, 11, 1)),
      responsavelId: base.usuarios.gestorB,
      observacoes: T307.observacaoB,
      responsaveis: { create: [base.usuarios.gestorA, base.usuarios.gestorB].map((usuarioId) => ({ usuarioId })) },
    },
  });

  return {
    ...base,
    inativo,
    extrasA,
    cronogramaA: cronograma.id,
    unidadeA: unidadeA.id,
    checklist: checklist.id,
    todas,
    cronogramaB: cronogramaB.id,
    unidadeB: unidadeB.id,
  };
}
