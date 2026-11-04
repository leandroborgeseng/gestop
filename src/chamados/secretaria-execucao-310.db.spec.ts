/**
 * 310 — integração com Postgres LOCAL descartável: troca da Secretaria responsável pela execução.
 * Só roda com ESCOPO_306_TEST_DATABASE_URL (seed fictício 306 + 307). Só inserções novas por execução.
 */
import { randomBytes } from 'node:crypto';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedResponsaveis307, Seed307 } from '../../scripts/seed-responsaveis-307-core';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/jwt';
import { ChamadosController } from './chamados.controller';
import { ChamadosService } from './chamados.service';
import { MSG_REVISAR_EQUIPE } from './secretaria-execucao-310';

const URL = process.env.ESCOPO_306_TEST_DATABASE_URL;

describe.skipIf(!URL)('310 — Secretaria responsável pela execução (Postgres local)', () => {
  let prisma: PrismaClient;
  let seed: Seed307;
  let svc: ChamadosService;
  let auth: AuthService;
  // Chamados/equipes/Secretarias criados aqui são removidos no fim: o Dashboard (306) conta chamados das Secretarias do seed.
  const criados = { chamados: [] as string[], equipes: [] as string[], secretarias: [] as string[] };
  const sessao = async (usuarioId: string, permissoes = ['chamados.gerenciar']): Promise<JwtPayload> => {
    const s = await auth.resolveActiveSession(usuarioId);
    return { sub: usuarioId, nome: 'Fictício', email: 'x@teste306.invalid', ...s, permissoes } as JwtPayload;
  };
  const novoChamado = async (opts: { equipeA?: boolean; equipeSemSecretaria?: boolean; responsavelId?: string; unidadeId?: string; secretariaId?: string } = {}) => {
    const suf = randomBytes(4).toString('hex');
    const equipe = opts.equipeA || opts.equipeSemSecretaria
      ? await prisma.equipe.create({ data: { codigo: `EQ310-${suf}`, nome: `Equipe Fictícia 310 ${suf}`, secretariaId: opts.equipeA ? seed.secretarias.A : null } })
      : null;
    if (equipe) criados.equipes.push(equipe.id);
    const ch = await prisma.chamado.create({
      data: {
        codigo: `CH-310-${suf}`,
        secretariaId: opts.secretariaId ?? seed.secretarias.A,
        unidadeId: opts.unidadeId ?? seed.unidadeA,
        descricao: 'Chamado fictício 310',
        equipeId: equipe?.id ?? null,
        responsavelId: opts.responsavelId ?? null,
      },
    });
    criados.chamados.push(ch.id);
    return ch;
  };

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL! }) });
    seed = await seedResponsaveis307(prisma, randomBytes(24).toString('base64url'), URL!);
    svc = new ChamadosService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    auth = new AuthService(prisma as never, {} as never, {} as never, {} as never);
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.historicoStatus.deleteMany({ where: { entidadeId: { in: criados.chamados } } });
      await prisma.logAuditoria.deleteMany({ where: { entidadeId: { in: criados.chamados } } });
      await prisma.chamado.deleteMany({ where: { id: { in: criados.chamados } } });
      await prisma.equipe.deleteMany({ where: { id: { in: criados.equipes } } });
      await prisma.secretaria.deleteMany({ where: { id: { in: criados.secretarias } } });
    }
    await prisma?.$disconnect();
  });

  it('lista de destino traz TODAS as Secretarias ativas, mesmo com a sessão na Secretaria A', async () => {
    const inativa = await prisma.secretaria.create({ data: { sigla: `T310X${randomBytes(2).toString('hex')}`, nome: 'Secretaria Fictícia Inativa 310', ativo: false } });
    criados.secretarias.push(inativa.id);
    const ids = (await svc.listSecretariasDestinoExecucao()).map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([seed.secretarias.A, seed.secretarias.B]));
    expect(ids).not.toContain(inativa.id);
    expect(ids.length).toBe(await prisma.secretaria.count({ where: { ativo: true } }));
  });

  it('gestor de A transfere para B: aceita, histórico e auditoria com origem → destino, próprio intacto, orienta revisar equipe e responsável', async () => {
    const c = await novoChamado({ equipeA: true, responsavelId: seed.usuarios.gestorA });
    const u = await sessao(seed.usuarios.gestorA);
    const unidadeAntes = await prisma.unidadePublica.findUniqueOrThrow({ where: { id: seed.unidadeA } });
    const r = (await svc.updateAbertura(c.id, { secretariaId: seed.secretarias.B }, u)) as unknown as {
      secretaria: { id: string };
      transferenciaExecucao: { origem: { id: string }; destino: { id: string }; revisar: { equipe?: unknown; responsavel?: { id: string } }; saiuDoEscopo: boolean };
    };
    expect(r.secretaria.id).toBe(seed.secretarias.B);
    expect(r.transferenciaExecucao.origem.id).toBe(seed.secretarias.A);
    expect(r.transferenciaExecucao.destino.id).toBe(seed.secretarias.B);
    expect(r.transferenciaExecucao.revisar.equipe).toBeTruthy();
    expect(r.transferenciaExecucao.revisar.responsavel?.id).toBe(seed.usuarios.gestorA);
    expect(r.transferenciaExecucao.saiuDoEscopo).toBe(false); // TL #48: próprio/equipe de A mantêm a visualização
    expect((r.transferenciaExecucao as unknown as { somenteExecucao: boolean }).somenteExecucao).toBe(true); // mas sem gestão da abertura

    const depois = await prisma.chamado.findUniqueOrThrow({ where: { id: c.id } });
    expect(depois.secretariaId).toBe(seed.secretarias.B);
    expect(depois.equipeId).toBe(c.equipeId); // só orienta, não limpa
    expect(depois.responsavelId).toBe(seed.usuarios.gestorA);
    expect((await prisma.unidadePublica.findUniqueOrThrow({ where: { id: seed.unidadeA } })).secretariaId).toBe(unidadeAntes.secretariaId);

    const hist = await prisma.historicoStatus.findFirstOrThrow({ where: { entidadeId: c.id }, orderBy: { createdAt: 'desc' } });
    const meta = hist.metadata as { alteracoes: Array<{ de: string; para: string; label: string }>; secretariaExecucao: { origem: { id: string }; destino: { id: string } } };
    expect(meta.secretariaExecucao.origem.id).toBe(seed.secretarias.A);
    expect(meta.secretariaExecucao.destino.id).toBe(seed.secretarias.B);
    expect(meta.alteracoes.some((a) => a.label === 'Secretaria responsável pela execução')).toBe(true);

    const log = await prisma.logAuditoria.findFirstOrThrow({ where: { entidadeId: c.id, funcao: 'secretaria_execucao' } });
    expect(log.usuarioId).toBe(seed.usuarios.gestorA);
    expect(log.descricao).toMatch(/→/);
    expect((log.valorAntigo as { secretariaId: string }).secretariaId).toBe(seed.secretarias.A);
    expect((log.valorNovo as { secretariaId: string }).secretariaId).toBe(seed.secretarias.B);
    expect(MSG_REVISAR_EQUIPE).toContain('Revise a equipe');
  });

  it('responsável com vínculo na Secretaria de destino não precisa de revisão; sem equipe nada a revisar', async () => {
    const c = await novoChamado({ responsavelId: seed.usuarios.multi });
    const r = (await svc.updateAbertura(c.id, { secretariaId: seed.secretarias.B }, await sessao(seed.usuarios.gestorA))) as unknown as {
      transferenciaExecucao: { revisar: Record<string, unknown> };
    };
    expect(r.transferenciaExecucao.revisar).toEqual({});
    expect((r.transferenciaExecucao as unknown as { saiuDoEscopo: boolean }).saiuDoEscopo).toBe(false); // próprio de A: continua vendo (só leitura)
  });

  it('sem permissão de alterar → 403; Secretaria inativa → 400; outra Secretaria sem acesso ao chamado → 403', async () => {
    const c = await novoChamado();
    await expect(svc.updateAbertura(c.id, { secretariaId: seed.secretarias.B }, await sessao(seed.usuarios.gestorA, ['chamados.visualizar']))).rejects.toBeInstanceOf(ForbiddenException);
    const inativa = await prisma.secretaria.create({ data: { sigla: `T310Y${randomBytes(2).toString('hex')}`, nome: 'Secretaria Fictícia Inativa 310 B', ativo: false } });
    criados.secretarias.push(inativa.id);
    await expect(svc.updateAbertura(c.id, { secretariaId: inativa.id }, await sessao(seed.usuarios.gestorA))).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.updateAbertura(c.id, { secretariaId: seed.secretarias.B }, await sessao(seed.usuarios.gestorB))).rejects.toBeInstanceOf(ForbiddenException);
    expect((await prisma.chamado.findUniqueOrThrow({ where: { id: c.id } })).secretariaId).toBe(seed.secretarias.A);
  });

  it('sem troca de Secretaria não grava auditoria de transferência', async () => {
    const c = await novoChamado();
    const r = (await svc.updateAbertura(c.id, { secretariaId: seed.secretarias.A, solicitanteNome: 'Fictício' }, await sessao(seed.usuarios.gestorA))) as unknown as { transferenciaExecucao?: unknown };
    expect(r.transferenciaExecucao).toBeUndefined();
    expect(await prisma.logAuditoria.count({ where: { entidadeId: c.id, funcao: 'secretaria_execucao' } })).toBe(0);
  });
  describe('TL #48 — visualização/execução por Secretaria, próprio ou equipe; gestão da abertura só pela Secretaria de execução', () => {
    let ctrl: ChamadosController;
    beforeAll(() => { ctrl = new ChamadosController(svc); });
    const MSG = /Secretaria responsável pela execução deste chamado é outra/;
    const erro = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);
    const amanha = () => new Date(Date.now() + 86_400_000).toISOString();

    it('gestor de origem presente só pela equipe: vê e executa; 403 com mensagem ao editar, devolver e transferir', async () => {
      const c = await novoChamado({ equipeA: true, unidadeId: seed.unidadeB }); // próprio B, equipe A, execução A
      const gA = await sessao(seed.usuarios.gestorA);
      const r = (await svc.updateAbertura(c.id, { secretariaId: seed.secretarias.B }, gA)) as unknown as { transferenciaExecucao: { saiuDoEscopo: boolean; somenteExecucao: boolean; revisar: { equipe?: unknown } } };
      expect(r.transferenciaExecucao).toMatchObject({ saiuDoEscopo: false, somenteExecucao: true });
      expect(r.transferenciaExecucao.revisar.equipe).toBeTruthy();

      const ver = (await ctrl.get(c.id, gA)) as unknown as { id: string; podeGerirAbertura: boolean };
      expect(ver.id).toBe(c.id);
      expect(ver.podeGerirAbertura).toBe(false);
      const lista = (await svc.listChamados({} as never, gA)) as unknown as { items: Array<{ id: string }> };
      expect(lista.items.some((i) => i.id === c.id)).toBe(true);
      await svc.updatePlanejamento(c.id, { previstaExecucaoEm: amanha() } as never, gA); // execução permitida pela equipe

      const terceira = await prisma.secretaria.create({ data: { sigla: `T310T${randomBytes(2).toString('hex')}`, nome: 'Secretaria Fictícia 310 Terceira' } });
      criados.secretarias.push(terceira.id);
      // editar, devolver (→ A) e transferir (→ terceira)
      for (const dto of [{ solicitanteNome: 'Fictício edição' }, { secretariaId: seed.secretarias.A }, { secretariaId: terceira.id }]) {
        const e = await erro(svc.updateAbertura(c.id, dto, gA));
        expect(e).toBeInstanceOf(ForbiddenException);
        expect((e as ForbiddenException).getStatus()).toBe(403);
        expect((e as Error).message).toMatch(MSG);
      }
      expect((await prisma.chamado.findUniqueOrThrow({ where: { id: c.id } })).secretariaId).toBe(seed.secretarias.B);
    });

    it('sem transferência: chamado de B com equipe de A → gestor de A vê (200, na lista), executa (200) e recebe 403 com mensagem ao editar, devolver e transferir', async () => {
      const c = await novoChamado({ equipeA: true, secretariaId: seed.secretarias.B, unidadeId: seed.unidadeB });
      const gA = await sessao(seed.usuarios.gestorA);
      expect(await prisma.historicoStatus.count({ where: { entidadeId: c.id } })).toBe(0); // nenhum histórico de transferência
      const ver = (await ctrl.get(c.id, gA)) as unknown as { id: string; podeGerirAbertura: boolean };
      expect(ver).toMatchObject({ id: c.id, podeGerirAbertura: false });
      const lista = (await svc.listChamados({} as never, gA)) as unknown as { items: Array<{ id: string }> };
      expect(lista.items.some((i) => i.id === c.id)).toBe(true);
      await svc.updatePlanejamento(c.id, { previstaExecucaoEm: amanha() } as never, gA);
      const terceira = await prisma.secretaria.create({ data: { sigla: `T310U${randomBytes(2).toString('hex')}`, nome: 'Secretaria Fictícia 310 Terceira U' } });
      criados.secretarias.push(terceira.id);
      for (const dto of [{ solicitanteNome: 'Fictício edição' }, { secretariaId: seed.secretarias.A }, { secretariaId: terceira.id }]) {
        const e = await erro(svc.updateAbertura(c.id, dto, gA));
        expect(e).toBeInstanceOf(ForbiddenException);
        expect((e as ForbiddenException).getStatus()).toBe(403);
        expect((e as Error).message).toMatch(MSG);
      }
      const depois = await prisma.chamado.findUniqueOrThrow({ where: { id: c.id } });
      expect(depois.secretariaId).toBe(seed.secretarias.B);
      expect(depois.solicitanteNome).toBe(c.solicitanteNome);
    });

    it('sem nenhum caminho (Secretaria, próprio ou equipe): 404 ao ver, some da lista, 403 ao editar/devolver', async () => {
      const c = await novoChamado({ unidadeId: seed.unidadeB }); // próprio B, sem equipe
      const gA = await sessao(seed.usuarios.gestorA);
      const r = (await svc.updateAbertura(c.id, { secretariaId: seed.secretarias.B }, gA)) as unknown as { transferenciaExecucao: { saiuDoEscopo: boolean } };
      expect(r.transferenciaExecucao.saiuDoEscopo).toBe(true);
      const ver = await erro(ctrl.get(c.id, gA));
      expect(ver).toBeInstanceOf(NotFoundException);
      expect((ver as Error).message).toBe('Chamado não encontrado na sua Secretaria ativa.');
      const lista = (await svc.listChamados({} as never, gA)) as unknown as { items: Array<{ id: string }> };
      expect(lista.items.some((i) => i.id === c.id)).toBe(false);
      const devolver = await erro(svc.updateAbertura(c.id, { secretariaId: seed.secretarias.A }, gA));
      expect(devolver).toBeInstanceOf(ForbiddenException);
      expect(await erro(svc.updatePlanejamento(c.id, { previstaExecucaoEm: amanha() } as never, gA))).toBeInstanceOf(ForbiddenException);
    });

    it('próprio de A transferido para B: gestor de A vê só leitura (sem executar), 403 ao editar/devolver', async () => {
      const c = await novoChamado();
      const gA = await sessao(seed.usuarios.gestorA);
      await svc.updateAbertura(c.id, { secretariaId: seed.secretarias.B }, gA);
      const ver = (await ctrl.get(c.id, gA)) as unknown as { id: string; podeGerirAbertura: boolean };
      expect(ver).toMatchObject({ id: c.id, podeGerirAbertura: false });
      const e = await erro(svc.updateAbertura(c.id, { secretariaId: seed.secretarias.A }, gA));
      expect((e as Error).message).toMatch(MSG);
      expect(await erro(svc.updatePlanejamento(c.id, { previstaExecucaoEm: amanha() } as never, gA))).toBeInstanceOf(ForbiddenException);
    });

    it('usuário com acesso ao destino vê, edita e pode devolver', async () => {
      const c = await novoChamado({ equipeA: true, unidadeId: seed.unidadeB });
      await svc.updateAbertura(c.id, { secretariaId: seed.secretarias.B }, await sessao(seed.usuarios.gestorA));
      const gB = await sessao(seed.usuarios.gestorB);
      expect(((await ctrl.get(c.id, gB)) as unknown as { podeGerirAbertura: boolean }).podeGerirAbertura).toBe(true);
      await svc.updateAbertura(c.id, { solicitanteNome: 'Fictício B' }, gB);
      const r = (await svc.updateAbertura(c.id, { secretariaId: seed.secretarias.A }, gB)) as unknown as { transferenciaExecucao: { destino: { id: string } } };
      expect(r.transferenciaExecucao.destino.id).toBe(seed.secretarias.A);
    });

    it('compatível: responsável com acesso a todas as Secretarias não pede revisão', async () => {
      const c = await novoChamado({ responsavelId: seed.todas });
      const r = (await svc.updateAbertura(c.id, { secretariaId: seed.secretarias.B }, await sessao(seed.usuarios.gestorA))) as unknown as { transferenciaExecucao: { revisar: Record<string, unknown> } };
      expect(r.transferenciaExecucao.revisar.responsavel).toBeUndefined();
    });

    it('compatível: equipe sem Secretaria não pede revisão', async () => {
      const c = await novoChamado({ equipeSemSecretaria: true });
      const r = (await svc.updateAbertura(c.id, { secretariaId: seed.secretarias.B }, await sessao(seed.usuarios.gestorA))) as unknown as { transferenciaExecucao: { revisar: Record<string, unknown> } };
      expect(r.transferenciaExecucao.revisar).toEqual({});
    });
  });
});
