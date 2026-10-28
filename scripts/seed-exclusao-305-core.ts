/**
 * 305 — seed FICTÍCIO da exclusão lógica de vistorias. Independente dos seeds 306/309.
 * Trava: só banco LOCAL com `_test` no nome e nunca NODE_ENV=production. Idempotente; só inserções.
 *
 * Cria (tudo @aion.local):
 * - Secretarias "Secretaria Fictícia 305" (T305) e "Secretaria Fictícia 305 B" (T305B), cada uma com 1 próprio;
 * - próprio extra T305-C (Secretaria T305); checklist publicado "Checklist Fictício 305" (escopo GLOBAL, 1 item booleano)
 *   e cronogramas semanais em T305-A e T305-C;
 * - perfis: "Teste 305 Excluir" (Excluir + Visualizar excluídas), "Teste 305 Só Excluir" (Excluir, sem Visualizar
 *   excluídas) e "Teste 305 Sem Excluir" (só consulta);
 * - usuários gestor.305, excluidor.305, leitor.305 (T305) e gestor.305b (T305B).
 * As vistorias de cada teste são criadas pelo próprio teste (só inserções).
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';
import { assertBancoLocal306 } from './seed-escopo-306-core';

export const T305 = {
  gestor: 'gestor.305@aion.local',
  excluidor: 'excluidor.305@aion.local',
  leitor: 'leitor.305@aion.local',
  gestorB: 'gestor.305b@aion.local',
  base: ['fiscalizacoes.executar', 'dashboard.visualizar', 'cronograma.visualizar', 'matriz.vistorias._tela.visualizar'],
  excluir: 'matriz.vistorias._tela.excluir',
  verExcluidas: 'matriz.vistorias.excluidas_visualizar.visualizar',
  checklist: 'Checklist Fictício 305',
} as const;

export type Seed305 = {
  secretariaA: string;
  secretariaB: string;
  unidadeA: string;
  unidadeB: string;
  unidadeC: string;
  cronogramaC: string;
  checklist: string;
  versao: string;
  item: string;
  cronograma: string;
  gestor: string;
  excluidor: string;
  leitor: string;
  gestorB: string;
};

export function assertBancoTeste305(databaseUrl: string | undefined) {
  assertBancoLocal306(databaseUrl);
  const nome = (() => {
    try {
      return new URL(databaseUrl ?? '').pathname.replace(/^\//, '');
    } catch {
      return '';
    }
  })();
  if (!nome.includes('_test')) {
    throw new Error('Seed 305 recusado: o nome do banco precisa conter "_test".');
  }
}

export async function seedExclusao305(prisma: PrismaClient, senha: string, databaseUrl: string): Promise<Seed305> {
  assertBancoTeste305(databaseUrl);
  if (!senha || senha.length < 12) throw new Error('Senha dos usuários fictícios precisa de >= 12 caracteres.');
  const senhaHash = hashPassword(senha);

  const secretaria = async (sigla: string, nome: string) =>
    (await prisma.secretaria.findFirst({ where: { sigla } })) ?? (await prisma.secretaria.create({ data: { sigla, nome } }));
  const secA = await secretaria('T305', 'Secretaria Fictícia 305');
  const secB = await secretaria('T305B', 'Secretaria Fictícia 305 B');

  const unidade = async (codigo: string, secretariaId: string, nome: string) =>
    (await prisma.unidadePublica.findFirst({ where: { codigoPatrimonial: codigo } })) ??
    (await prisma.unidadePublica.create({
      data: { secretariaId, codigoPatrimonial: codigo, nome, tipo: 'ESCOLA', endereco: 'Rua Fictícia, 305', latitude: -20.53, longitude: -47.4 },
    }));
  const unidadeA = await unidade('T305-A', secA.id, 'Próprio Fictício 305 A');
  const unidadeB = await unidade('T305-B', secB.id, 'Próprio Fictício 305 B');
  const unidadeC = await unidade('T305-C', secA.id, 'Próprio Fictício 305 C');

  const perfil = async (nome: string, chaves: readonly string[]) => {
    const p = await prisma.perfil.upsert({ where: { nome }, update: {}, create: { nome, descricao: 'Perfil fictício do teste 305' } });
    for (const chave of chaves) {
      const perm = await prisma.permissao.upsert({
        where: { chave },
        update: {},
        create: { chave, modulo: chave.split('.')[chave.startsWith('matriz.') ? 1 : 0] },
      });
      await prisma.perfilPermissao.upsert({
        where: { perfilId_permissaoId: { perfilId: p.id, permissaoId: perm.id } },
        update: {},
        create: { perfilId: p.id, permissaoId: perm.id },
      });
    }
    return p.id;
  };
  const pGestor = await perfil('Teste 305 Excluir', [...T305.base, T305.excluir, T305.verExcluidas]);
  const pExcluidor = await perfil('Teste 305 Só Excluir', [...T305.base, T305.excluir]);
  const pLeitor = await perfil('Teste 305 Sem Excluir', T305.base);

  const usuario = async (email: string, nome: string, perfilId: string, secretariaId: string) => {
    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) return existente.id;
    const u = await prisma.usuario.create({
      data: {
        nome,
        email,
        senhaHash,
        secretariaId,
        secretariaAtivaId: secretariaId,
        perfilAtivoId: perfilId,
        perfis: { create: [{ perfilId }] },
        secretariasVinculos: { create: [{ secretariaId, principal: true }] },
      },
    });
    return u.id;
  };
  const gestor = await usuario(T305.gestor, 'Gestor Fictício 305', pGestor, secA.id);
  const excluidor = await usuario(T305.excluidor, 'Excluidor Fictício 305 (sem ver excluídas)', pExcluidor, secA.id);
  const leitor = await usuario(T305.leitor, 'Leitor Fictício 305 (sem excluir)', pLeitor, secA.id);
  const gestorB = await usuario(T305.gestorB, 'Gestor Fictício 305 B', pGestor, secB.id);

  const existente = await prisma.checklist.findFirst({
    where: { nome: T305.checklist },
    include: { versoes: { include: { itens: true } } },
  });
  const checklist =
    existente ??
    (await prisma.checklist.create({
      data: {
        nome: T305.checklist,
        descricao: 'Modelo fictício do teste 305',
        escopo: 'GLOBAL',
        finalidades: ['VISTORIA'],
        versoes: {
          create: {
            versao: 1,
            status: 'PUBLICADA',
            publicadoAt: new Date(),
            itens: { create: [{ ordem: 1, codigo: 'T305-1', titulo: 'Item fictício 305', tipo: 'BOOLEANO' }] },
          },
        },
      },
      include: { versoes: { include: { itens: true } } },
    }));
  const versao = checklist.versoes[0];

  const cronograma = await prisma.cronogramaChecagem.upsert({
    where: { unidadeId_checklistId: { unidadeId: unidadeA.id, checklistId: checklist.id } },
    update: {},
    create: {
      unidadeId: unidadeA.id,
      checklistId: checklist.id,
      frequencia: 'SEMANAL',
      proximaChecagemEm: new Date(),
      observacoes: 'Cronograma fictício 305',
      responsaveis: { create: [{ usuarioId: gestor }] },
    },
  });

  const cronogramaC = await prisma.cronogramaChecagem.upsert({
    where: { unidadeId_checklistId: { unidadeId: unidadeC.id, checklistId: checklist.id } },
    update: {},
    create: {
      unidadeId: unidadeC.id,
      checklistId: checklist.id,
      frequencia: 'SEMANAL',
      proximaChecagemEm: new Date(),
      observacoes: 'Cronograma fictício 305 C',
      responsaveis: { create: [{ usuarioId: gestor }] },
    },
  });

  return {
    secretariaA: secA.id,
    secretariaB: secB.id,
    unidadeA: unidadeA.id,
    unidadeB: unidadeB.id,
    unidadeC: unidadeC.id,
    cronogramaC: cronogramaC.id,
    checklist: checklist.id,
    versao: versao.id,
    item: versao.itens[0].id,
    cronograma: cronograma.id,
    gestor,
    excluidor,
    leitor,
    gestorB,
  };
}
