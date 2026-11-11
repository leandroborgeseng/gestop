/**
 * R-1 — integração com Postgres local. Sem DATABASE_URL em localhost, o teste é pulado.
 * Cria só dados sintéticos (prefixo ZZP31) e filtra por esse código, para não misturar com o resto do banco.
 *   DATABASE_URL=postgresql://gestop:gestop@127.0.0.1:5432/gestop_test npx vitest run src/chamados/relatorio-tarefas-agregacao.int.spec.ts
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { ChamadoTarefaStatus, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { JwtPayload } from '../auth/jwt';
import { extrairTextoPdf } from '../checklists/pdf-texto';
import { ChamadoTarefasService } from './chamado-tarefas.service';
import { somaGrupos } from './relatorio-tarefas-agregacao';

const url = process.env.DATABASE_URL ?? '';
const local = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);

describe.skipIf(!local)('R-1 — agregação do relatório no Postgres local', () => {
  let prisma: PrismaClient;
  let service: ChamadoTarefasService;
  const tag = `ZZP31${randomUUID().slice(0, 8)}`;
  let secEdu = '';
  let secSau = '';
  let usuarioId = '';
  let chEdu = '';
  let chSau = '';
  const agora = new Date('2026-11-11T15:00:00.000Z');

  const admin: JwtPayload = {
    sub: '',
    email: `${tag}@exemplo.local`,
    nome: 'ZZ Admin P31',
    perfis: ['Administrador do Sistema'],
    permissoes: ['dashboard.visualizar'],
    acessoTodasSecretarias: true,
    secretariaId: null,
    perfilAtivoId: null,
  };

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    service = new ChamadoTarefasService(prisma as never, { persistBuffer: async () => ({}) } as never, { record: async () => undefined } as never);
    const edu = await prisma.secretaria.create({ data: { nome: `Educação ${tag}`, sigla: `E${tag}`.slice(0, 20) } });
    const sau = await prisma.secretaria.create({ data: { nome: `Saúde ${tag}`, sigla: `S${tag}`.slice(0, 20) } });
    secEdu = edu.id;
    secSau = sau.id;
    const usuario = await prisma.usuario.create({
      data: { nome: 'ZZ Admin P31', email: `${tag}@exemplo.local`, senhaHash: 'x', secretariaId: secEdu },
    });
    usuarioId = usuario.id;
    admin.sub = usuarioId;
    const tipo = await prisma.tipoChamado.create({ data: { nome: `Vazamento ${tag}`, ativo: true } });
    const chamadoEdu = await prisma.chamado.create({
      data: { codigo: `${tag}-EDU`, secretariaId: secEdu, descricao: 'Chamado sintético P31', tipoChamadoId: tipo.id },
    });
    const chamadoSau = await prisma.chamado.create({
      data: { codigo: `${tag}-SAU`, secretariaId: secSau, descricao: 'Chamado sintético P31' },
    });
    chEdu = chamadoEdu.id;
    chSau = chamadoSau.id;
    const base = { criadaPorId: usuarioId, titulo: 'Tarefa sintética P31' };
    const lote: Array<Parameters<PrismaClient['chamadoTarefa']['createMany']>[0]['data']> = [];
    const add = (qtd: number, data: Record<string, unknown>) => {
      lote.push(Array.from({ length: qtd }, () => ({ ...base, ...data })));
    };
    add(200, { chamadoId: chEdu, secretariaId: secEdu, status: ChamadoTarefaStatus.NOVA, prazo: new Date('2020-01-01T00:00:00.000Z') });
    add(50, { chamadoId: chEdu, secretariaId: secEdu, status: ChamadoTarefaStatus.NOVA, prazo: new Date('2099-01-01T00:00:00.000Z') });
    add(80, { chamadoId: chEdu, secretariaId: secEdu, status: ChamadoTarefaStatus.CONCLUIDA, prazo: new Date('2020-01-01T00:00:00.000Z'), concluidaEm: agora });
    add(100, { chamadoId: chSau, secretariaId: secSau, status: ChamadoTarefaStatus.EM_ANDAMENTO, prazo: new Date('2099-01-01T00:00:00.000Z') });
    add(50, { chamadoId: chSau, secretariaId: secSau, status: ChamadoTarefaStatus.VISUALIZADA, prazo: new Date('2020-01-01T00:00:00.000Z') });
    add(4, { chamadoId: chSau, secretariaId: secSau, status: ChamadoTarefaStatus.IMPEDIDA, prazo: new Date('2020-01-01T00:00:00.000Z') });
    add(100, { chamadoId: chSau, secretariaId: secSau, status: ChamadoTarefaStatus.CONCLUIDA, prazo: new Date('2020-01-01T00:00:00.000Z'), concluidaEm: agora });
    add(20, { chamadoId: chSau, secretariaId: secSau, status: ChamadoTarefaStatus.CANCELADA, prazo: new Date('2020-01-01T00:00:00.000Z') });
    for (const data of lote) {
      await prisma.chamadoTarefa.createMany({ data: data as never });
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.chamadoTarefa.deleteMany({ where: { chamado: { codigo: { startsWith: tag } } } });
    await prisma.chamado.deleteMany({ where: { codigo: { startsWith: tag } } });
    await prisma.tipoChamado.deleteMany({ where: { nome: `Vazamento ${tag}` } });
    await prisma.usuario.deleteMany({ where: { email: `${tag}@exemplo.local` } });
    await prisma.secretaria.deleteMany({ where: { id: { in: [secEdu, secSau].filter(Boolean) } } });
    await prisma.$disconnect();
  });

  it('604 tarefas: pendentes por secretaria e o PDF formal batem com o banco; a grade corta em 500', async () => {
    const noBanco = await prisma.chamadoTarefa.count({ where: { chamado: { codigo: { startsWith: tag } } } });
    expect(noBanco).toBe(604);
    const relatorio = await service.relatorio({ numero: tag }, admin);
    expect(relatorio.total).toBe(604);
    expect(relatorio.items).toHaveLength(500);
    expect(somaGrupos(relatorio.indicadores.porSecretaria, 'total')).toBe(604);
    expect(somaGrupos(relatorio.indicadores.porSecretaria, 'pendentes')).toBe(400);
    expect(relatorio.indicadores.abertas).toBe(404);
    expect(relatorio.indicadores.concluidas).toBe(180);
    expect(relatorio.indicadores.atrasadas).toBe(254);

    const pdf = await service.exportarPdf({ numero: tag, capa: 'formal' }, admin);
    const texto = await extrairTextoPdf(pdf);
    expect(texto).toContain('Mostrando 500 de 604 tarefas');
    expect(texto).toContain('Total de registros: 500');
    for (const linha of [
      'Abertas: 404',
      'Novas: 250',
      'Em andamento: 150',
      'Impedidas: 4',
      'Concluídas: 180',
      'Atrasadas: 254',
    ]) {
      expect(texto).toContain(linha);
    }
    expect(texto).toContain('Pendentes por secretaria:');
    const siglaEdu = (await prisma.secretaria.findUniqueOrThrow({ where: { id: secEdu } })).sigla;
    const siglaSau = (await prisma.secretaria.findUniqueOrThrow({ where: { id: secSau } })).sigla;
    expect(texto).toContain(`${siglaEdu} 250`);
    expect(texto).toContain(`${siglaSau} 150`);
  });
});
