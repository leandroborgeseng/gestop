/**
 * 306 — seed FICTÍCIO de duas Secretarias para testar o escopo do Dashboard.
 * Tudo com marcador "T306" (siglas T306A/T306B, e-mails @teste306.invalid). Nenhum dado real.
 * Idempotente: se as Secretarias T306A/T306B já existem, só devolve os ids.
 *
 * Volumes distintos por Secretaria, para o teste distinguir vazamento:
 *   A: 1 próprio, 1 vistoria concluída, 1 NC aberta, 2 chamados (1 urgente/atrasado, 1 concluído), 1 sync com falha, 1 log
 *   B: 1 próprio, 2 vistorias concluídas, 3 NC abertas, 3 chamados (2 urgentes/atrasados, 1 concluído), 2 syncs com falha, 2 logs
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';

export const T306 = {
  siglas: { A: 'T306A', B: 'T306B' },
  emails: {
    gestorA: 'gestor.a@teste306.invalid',
    gestorB: 'gestor.b@teste306.invalid',
    multi: 'multi.ab@teste306.invalid',
    admin: 'admin.todas@teste306.invalid',
  },
  perfil: 'Teste 306 Dashboard',
  permissoes: ['dashboard.visualizar', 'auditoria.visualizar', 'chamados.gerenciar'],
  esperado: {
    A: { unidades: 1, fiscalizacoes: 1, naoConformidades: 1, chamadosAbertos: 1, chamadosConcluidos: 1, syncFalhas: 1, auditoria: 1, urgentes: 1 },
    B: { unidades: 1, fiscalizacoes: 2, naoConformidades: 3, chamadosAbertos: 2, chamadosConcluidos: 1, syncFalhas: 2, auditoria: 2, urgentes: 2 },
  },
} as const;

export type Seed306 = {
  secretarias: { A: string; B: string };
  usuarios: { gestorA: string; gestorB: string; multi: string; admin: string };
};

export async function seedEscopo306(prisma: PrismaClient, senha: string): Promise<Seed306> {
  const existentes = await prisma.secretaria.findMany({ where: { sigla: { in: [T306.siglas.A, T306.siglas.B] } } });
  if (existentes.length === 2) {
    const sec = Object.fromEntries(existentes.map((s) => [s.sigla === T306.siglas.A ? 'A' : 'B', s.id])) as Seed306['secretarias'];
    const us = await prisma.usuario.findMany({ where: { email: { in: Object.values(T306.emails) } } });
    const by = (e: string) => us.find((u) => u.email === e)!.id;
    return { secretarias: sec, usuarios: { gestorA: by(T306.emails.gestorA), gestorB: by(T306.emails.gestorB), multi: by(T306.emails.multi), admin: by(T306.emails.admin) } };
  }

  const senhaHash = hashPassword(senha);
  const agora = new Date();
  const diasAtras = (n: number) => new Date(agora.getTime() - n * 86_400_000);

  return prisma.$transaction(async (tx) => {
    const permissoes = [];
    for (const chave of T306.permissoes) {
      permissoes.push(await tx.permissao.upsert({ where: { chave }, update: {}, create: { chave, modulo: chave.split('.')[0] } }));
    }
    const perfil = await tx.perfil.upsert({ where: { nome: T306.perfil }, update: {}, create: { nome: T306.perfil, descricao: 'Perfil fictício do teste 306' } });
    for (const p of permissoes) {
      await tx.perfilPermissao.upsert({ where: { perfilId_permissaoId: { perfilId: perfil.id, permissaoId: p.id } }, update: {}, create: { perfilId: perfil.id, permissaoId: p.id } });
    }

    const secA = await tx.secretaria.create({ data: { nome: 'Secretaria Fictícia 306 A', sigla: T306.siglas.A } });
    const secB = await tx.secretaria.create({ data: { nome: 'Secretaria Fictícia 306 B', sigla: T306.siglas.B } });

    const usuario = (nome: string, email: string, secretariaId: string | null, extra: { vinculos?: string[]; todas?: boolean } = {}) =>
      tx.usuario.create({
        data: {
          nome,
          email,
          senhaHash,
          secretariaId,
          secretariaAtivaId: extra.todas ? null : secretariaId,
          acessoTodasSecretarias: Boolean(extra.todas),
          perfilAtivoId: perfil.id,
          perfis: { create: [{ perfilId: perfil.id }] },
          secretariasVinculos: { create: (extra.vinculos ?? (secretariaId ? [secretariaId] : [])).map((id, i) => ({ secretariaId: id, principal: i === 0 })) },
        },
      });
    const gestorA = await usuario('Gestor Fictício A', T306.emails.gestorA, secA.id);
    const gestorB = await usuario('Gestor Fictício B', T306.emails.gestorB, secB.id);
    const multi = await usuario('Usuário Fictício A+B', T306.emails.multi, secA.id, { vinculos: [secA.id, secB.id] });
    const admin = await usuario('Admin Fictício Todas', T306.emails.admin, null, { todas: true });

    const checklist = await tx.checklist.create({ data: { nome: 'Checklist Fictício 306' } });
    const versao = await tx.checklistVersao.create({ data: { checklistId: checklist.id, versao: 1, status: 'PUBLICADA' } });
    const itens = [];
    for (const ordem of [1, 2, 3]) {
      itens.push(
        await tx.checklistItem.create({
          data: { checklistVersaoId: versao.id, ordem, codigo: `T306-${ordem}`, titulo: `Item fictício ${ordem}`, tipo: 'BOOLEANO', geraNaoConformidade: true },
        }),
      );
    }

    let seq = 0;
    for (const [lado, sec, gestor, nFisc, nNc, nUrg] of [
      ['A', secA, gestorA, 1, 1, 1],
      ['B', secB, gestorB, 2, 3, 2],
    ] as const) {
      const unidade = await tx.unidadePublica.create({
        data: { secretariaId: sec.id, codigoPatrimonial: `T306-${lado}`, nome: `Próprio Fictício ${lado}`, tipo: 'ESCOLA', endereco: 'Rua Fictícia, 306', latitude: -20.5, longitude: -47.4 },
      });
      let ncRestantes = nNc;
      for (let f = 0; f < nFisc; f++) {
        const fisc = await tx.fiscalizacao.create({
          data: { secretariaId: sec.id, unidadeId: unidade.id, checklistVersaoId: versao.id, agenteId: gestor.id, status: 'CONCLUIDA', iniciadaEm: diasAtras(1), concluidaEm: diasAtras(1) },
        });
        // NCs da Secretaria distribuídas nas vistorias dela (a última leva o resto)
        const nesta = f === nFisc - 1 ? ncRestantes : 1;
        ncRestantes -= nesta;
        for (let n = 0; n < nesta; n++) {
          const resposta = await tx.respostaChecklist.create({ data: { fiscalizacaoId: fisc.id, itemId: itens[n].id, conformidade: 'NAO_CONFORME' } });
          await tx.naoConformidade.create({
            data: { fiscalizacaoId: fisc.id, respostaId: resposta.id, itemId: itens[n].id, unidadeId: unidade.id, registradaPorId: gestor.id, descricao: `NC fictícia ${lado}` },
          });
        }
      }
      for (let c = 0; c < nUrg; c++) {
        await tx.chamado.create({
          data: { codigo: `T306-${lado}-U${c}-${++seq}`, secretariaId: sec.id, unidadeId: unidade.id, descricao: `Chamado fictício ${lado}`, prioridade: 'URGENTE', status: 'ABERTO', prazoEm: diasAtras(1), createdAt: diasAtras(3) },
        });
      }
      await tx.chamado.create({
        data: { codigo: `T306-${lado}-C-${++seq}`, secretariaId: sec.id, unidadeId: unidade.id, descricao: `Chamado fictício concluído ${lado}`, status: 'CONCLUIDO', createdAt: diasAtras(2), concluidoEm: diasAtras(1) },
      });
      for (let s = 0; s < nUrg; s++) {
        await tx.offlineSyncEvent.create({
          data: { clientEventId: `t306-${lado}-${s}-${++seq}`, deviceId: 'dispositivo-ficticio', usuarioId: gestor.id, entidadeTipo: 'FISCALIZACAO', operacao: 'UPSERT', payload: {}, status: 'FALHOU', ocorridoEm: diasAtras(1) },
        });
        await tx.logAuditoria.create({
          data: { usuarioId: gestor.id, acao: 'UPDATE', entidadeTipo: 'Teste306', descricao: `log fictício ${lado}`, secretariaAtivaId: sec.id, secretariaAtivaSigla: sec.sigla },
        });
      }
    }

    return {
      secretarias: { A: secA.id, B: secB.id },
      usuarios: { gestorA: gestorA.id, gestorB: gestorB.id, multi: multi.id, admin: admin.id },
    };
  });
}
