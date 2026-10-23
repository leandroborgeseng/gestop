/**
 * 303/304 — seed FICTÍCIO de campo/offline, em cima do seed 306+307 (T306A/T306B, @teste306.invalid).
 * Só inserções/atualizações de dados fictícios (nada é apagado). Mesma trava de banco local do 306.
 * - permissão `fiscalizacoes.executar` no perfil fictício "Teste 306 Dashboard" (app de vistoria);
 * - "Checklist Fictício 304" (GLOBAL, publicado, 2 itens booleanos sem NC/evidência obrigatória);
 * - Secretarias PRÓPRIAS T304A/T304B ("Próprio Fictício 304 A/B", gestor.a.304/gestor.b.304@teste306.invalid), para que as
 *   vistorias/falhas de sync geradas pelos testes 304 NÃO alterem as contagens exatas do Dashboard 306 (T306A/T306B);
 * - "Cronograma fictício 304 A" (semanal) no Próprio Fictício 304 A, responsável gestor.a.304;
 *   "Cronograma fictício 304 B" no Próprio Fictício 304 B, responsável gestor.b.304.
 * A cada execução as programações 304 voltam para "próxima = 7 dias atrás (atrasada), sem baixa" (para o Tester repetir o fluxo).
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';
import { assertBancoLocal306 } from './seed-escopo-306-core';
import { seedResponsaveis307, Seed307 } from './seed-responsaveis-307-core';

export const T304 = {
  checklist: 'Checklist Fictício 304',
  observacaoA: 'Cronograma fictício 304 A',
  observacaoB: 'Cronograma fictício 304 B',
  permissoes: ['fiscalizacoes.executar'],
  siglas: { A: 'T304A', B: 'T304B' },
  emails: { gestorA: 'gestor.a.304@teste306.invalid', gestorB: 'gestor.b.304@teste306.invalid' },
} as const;

export type Seed304 = Seed307 & {
  checklist304: string;
  checklistVersao304: string;
  itens304: string[];
  secretarias304: { A: string; B: string };
  unidade304A: string;
  unidade304B: string;
  usuarios304: { gestorA: string; gestorB: string };
  cronograma304A: string;
  cronograma304B: string;
};

/** Programação ATRASADA de 7 dias (aparece na lista mesmo se já houver vistoria fictícia hoje). */
function seteDiasAtras() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 7);
  return d;
}

export async function seedCampo304(prisma: PrismaClient, senha: string, databaseUrl: string): Promise<Seed304> {
  assertBancoLocal306(databaseUrl);
  const base = await seedResponsaveis307(prisma, senha, databaseUrl);
  const perfil = await prisma.perfil.findUniqueOrThrow({ where: { nome: 'Teste 306 Dashboard' } });
  for (const chave of T304.permissoes) {
    const p = await prisma.permissao.upsert({ where: { chave }, update: {}, create: { chave, modulo: 'fiscalizacoes' } });
    await prisma.perfilPermissao.upsert({
      where: { perfilId_permissaoId: { perfilId: perfil.id, permissaoId: p.id } },
      update: {},
      create: { perfilId: perfil.id, permissaoId: p.id },
    });
  }

  let checklist = await prisma.checklist.findFirst({ where: { nome: T304.checklist }, include: { versoes: { include: { itens: true } } } });
  if (!checklist) {
    checklist = await prisma.checklist.create({
      data: {
        nome: T304.checklist,
        versoes: {
          create: [
            {
              versao: 1,
              status: 'PUBLICADA',
              itens: {
                create: [1, 2].map((ordem) => ({ ordem, codigo: `T304-${ordem}`, titulo: `Item fictício 304 ${ordem}`, tipo: 'BOOLEANO' as const })),
              },
            },
          ],
        },
      },
      include: { versoes: { include: { itens: true } } },
    });
  }
  const versao = checklist.versoes.find((v) => v.status === 'PUBLICADA')!;

  const cronograma = async (unidadeId: string, responsavelId: string, observacoes: string) => {
    const c = await prisma.cronogramaChecagem.upsert({
      where: { unidadeId_checklistId: { unidadeId, checklistId: checklist!.id } },
      update: { ativo: true, frequencia: 'SEMANAL', proximaChecagemEm: seteDiasAtras(), ultimaChecagemEm: null, observacoes },
      create: { unidadeId, checklistId: checklist!.id, frequencia: 'SEMANAL', proximaChecagemEm: seteDiasAtras(), observacoes },
    });
    await prisma.cronogramaChecagemResponsavel.upsert({
      where: { cronogramaId_usuarioId: { cronogramaId: c.id, usuarioId: responsavelId } },
      update: {},
      create: { cronogramaId: c.id, usuarioId: responsavelId },
    });
    return c.id;
  };

  const lado = async (l: 'A' | 'B') => {
    const sigla = T304.siglas[l];
    const sec =
      (await prisma.secretaria.findFirst({ where: { sigla } })) ??
      (await prisma.secretaria.create({ data: { nome: `Secretaria Fictícia 304 ${l}`, sigla } }));
    const codigoPatrimonial = `T304-${l}`;
    const unidade =
      (await prisma.unidadePublica.findFirst({ where: { codigoPatrimonial } })) ??
      (await prisma.unidadePublica.create({
        data: { secretariaId: sec.id, codigoPatrimonial, nome: `Próprio Fictício 304 ${l}`, tipo: 'ESCOLA', endereco: 'Rua Fictícia, 304', latitude: -20.5, longitude: -47.4 },
      }));
    const email = l === 'A' ? T304.emails.gestorA : T304.emails.gestorB;
    const usuario =
      (await prisma.usuario.findUnique({ where: { email } })) ??
      (await prisma.usuario.create({
        data: {
          nome: `Gestor Fictício 304 ${l}`,
          email,
          senhaHash: hashPassword(senha),
          secretariaId: sec.id,
          secretariaAtivaId: sec.id,
          perfilAtivoId: perfil.id,
          perfis: { create: [{ perfilId: perfil.id }] },
          secretariasVinculos: { create: [{ secretariaId: sec.id, principal: true }] },
        },
      }));
    return { sec: sec.id, unidade: unidade.id, usuario: usuario.id };
  };
  const A = await lado('A');
  const B = await lado('B');

  return {
    ...base,
    secretarias304: { A: A.sec, B: B.sec },
    unidade304A: A.unidade,
    unidade304B: B.unidade,
    usuarios304: { gestorA: A.usuario, gestorB: B.usuario },
    checklist304: checklist.id,
    checklistVersao304: versao.id,
    itens304: versao.itens.sort((a, b) => a.ordem - b.ordem).map((i) => i.id),
    cronograma304A: await cronograma(A.unidade, A.usuario, T304.observacaoA),
    cronograma304B: await cronograma(B.unidade, B.usuario, T304.observacaoB),
  };
}
