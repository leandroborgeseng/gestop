/**
 * 293 · integração REAL (Postgres local): o texto digitado em "Registrar andamento" / "Concluir tarefa"
 * fica gravado no banco (HistoricoStatus.metadata.texto, por evento) e volta pela API
 * (detalhe da tarefa e linha do tempo do chamado). Só roda com DATABASE_URL em localhost.
 *   DATABASE_URL=postgresql://gestop:gestop@localhost:5432/gestop293 npx vitest run src/chamados/chamado-tarefas.historico-texto.int.spec.ts
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { ChamadoTarefaStatus, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { JwtPayload } from '../auth/jwt';
import { ChamadoTarefasService } from './chamado-tarefas.service';

const url = process.env.DATABASE_URL ?? '';
const local = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
// PNG 1x1 válido
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe.skipIf(!local)('293 · texto do andamento/conclusão no histórico (Postgres local)', () => {
  let prisma: PrismaClient;
  let service: ChamadoTarefasService;
  const tag = randomUUID().slice(0, 8);
  let secretariaId = '';
  let chamadoId = '';
  let user: JwtPayload;
  const tarefaIds: string[] = [];

  async function novaTarefa(titulo: string) {
    const t = await prisma.chamadoTarefa.create({
      data: { chamadoId, titulo, secretariaId, criadaPorId: user.sub, responsavelId: user.sub },
    });
    tarefaIds.push(t.id);
    return t.id;
  }
  type Hist = { acao: string | null; texto: string | null; anexoIds: string[]; alteradoPor: { nome: string } | null; createdAt: string };
  async function historico(id: string) {
    const d = (await service.getById(id, user)) as unknown as { historico: Hist[]; anexos: Array<{ id: string; nome: string }> };
    return d;
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    const storage = {
      persistBuffer: async (buf: Buffer, mime: string) => ({ url: `/storage/t/${randomUUID()}`, storageKey: `t/${randomUUID()}`, mimeType: mime, tamanhoBytes: buf.length }),
    };
    service = new ChamadoTarefasService(prisma as never, storage as never, { record: async () => undefined } as never);
    const sec = await prisma.secretaria.create({ data: { nome: `Sec 293 ${tag}`, sigla: `S293${tag}` } });
    secretariaId = sec.id;
    const u = await prisma.usuario.create({ data: { nome: 'Executor 293', email: `exec293-${tag}@aion.local`, senhaHash: 'x', secretariaId } });
    user = {
      sub: u.id, nome: u.nome, email: u.email, perfis: ['Executor 293'], secretariaId, secretariasIds: [secretariaId],
      permissoes: ['matriz.chamados.tarefas.visualizar', 'matriz.chamados.tarefas_historico.visualizar'],
    } as JwtPayload;
    const c = await prisma.chamado.create({ data: { codigo: `CH-293-${tag}`, secretariaId, descricao: 'Chamado de teste 293' } });
    chamadoId = c.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.historicoStatus.deleteMany({ where: { entidadeId: { in: [...tarefaIds, chamadoId] } } });
    await prisma.chamadoTarefaAnexo.deleteMany({ where: { tarefaId: { in: tarefaIds } } });
    await prisma.chamadoTarefa.deleteMany({ where: { id: { in: tarefaIds } } });
    await prisma.chamado.deleteMany({ where: { id: chamadoId } });
    await prisma.usuario.deleteMany({ where: { email: `exec293-${tag}@aion.local` } });
    await prisma.secretaria.deleteMany({ where: { id: secretariaId } });
    await prisma.$disconnect();
  });

  it('andamento multilinha: gravado íntegro no banco e devolvido no detalhe com usuário e data', async () => {
    const id = await novaTarefa('Trocar lâmpadas');
    const texto = 'Linha 1 do andamento\nLinha 2\n\n  Linha 4 indentada';
    await service.update(id, { status: ChamadoTarefaStatus.EM_ANDAMENTO, observacao: `  ${texto}  ` } as never, user);
    const row = await prisma.historicoStatus.findFirstOrThrow({ where: { entidadeTipo: 'ChamadoTarefa', entidadeId: id } });
    expect((row.metadata as { texto?: string }).texto).toBe(texto);
    const d = await historico(id);
    const ev = d.historico.filter((h) => h.acao === 'andamento');
    expect(ev).toHaveLength(1);
    expect(ev[0].texto).toBe('Linha 1 do andamento\nLinha 2\n\n  Linha 4 indentada');
    expect(ev[0].alteradoPor?.nome).toBe('Executor 293');
    expect(Number.isNaN(Date.parse(ev[0].createdAt))).toBe(false);
  });

  it('dois andamentos seguidos: dois registros, nenhum sobrescreve, na ordem', async () => {
    const id = await novaTarefa('Pintar parede');
    await service.update(id, { status: ChamadoTarefaStatus.EM_ANDAMENTO, observacao: 'Primeiro andamento' } as never, user);
    await service.update(id, { status: ChamadoTarefaStatus.EM_ANDAMENTO, observacao: 'Segundo andamento' } as never, user);
    const d = await historico(id);
    expect(d.historico.filter((h) => h.acao === 'andamento').map((h) => h.texto)).toEqual(['Primeiro andamento', 'Segundo andamento']);
    const rows = await prisma.historicoStatus.findMany({ where: { entidadeTipo: 'ChamadoTarefa', entidadeId: id }, orderBy: { createdAt: 'asc' } });
    expect(rows.filter((r) => (r.metadata as { acao?: string }).acao === 'andamento').map((r) => (r.metadata as { texto?: string }).texto)).toEqual(['Primeiro andamento', 'Segundo andamento']);
  });

  it('conclusão com texto e anexo: mesmo evento traz texto e o anexo; status/data de conclusão inalterados', async () => {
    const id = await novaTarefa('Consertar portão');
    await service.update(
      id,
      { status: ChamadoTarefaStatus.CONCLUIDA, conclusaoTexto: 'Concluído:\n- portão soldado\n- trinco novo', anexos: [{ dataUrl: PNG, nome: 'foto.png' }] } as never,
      user,
    );
    const d = await historico(id);
    const ev = d.historico.filter((h) => h.acao === 'concluida');
    expect(ev).toHaveLength(1);
    expect(ev[0].texto).toBe('Concluído:\n- portão soldado\n- trinco novo');
    expect(ev[0].anexoIds).toHaveLength(1);
    expect(d.anexos.find((a) => a.id === ev[0].anexoIds[0])?.nome).toBe('foto.png');
    const t = await prisma.chamadoTarefa.findUniqueOrThrow({ where: { id } });
    expect(t.status).toBe('CONCLUIDA');
    expect(t.conclusaoTexto).toBe('Concluído:\n- portão soldado\n- trinco novo');
    expect(t.concluidaEm).toBeInstanceOf(Date);
    expect(t.concluidaPorId).toBe(user.sub);
  });

  it('linha do tempo do chamado: mesmo texto e identifica a tarefa', async () => {
    const id = await novaTarefa('Limpar calha');
    await service.update(id, { status: ChamadoTarefaStatus.EM_ANDAMENTO, observacao: 'Calha desentupida\nfalta vedar' } as never, user);
    const leitura = await service.getChamadoLeituraViaTarefa(id, chamadoId, user);
    const ev = leitura.historico.filter((h) => h.metadata.tarefaId === id);
    expect(ev).toHaveLength(1);
    expect(ev[0].metadata).toMatchObject({ tipo: 'tarefa', tarefaId: id, tarefaTitulo: 'Limpar calha', acao: 'andamento', texto: 'Calha desentupida\nfalta vedar' });
  });

  it('registro antigo sem texto: texto null (sem backfill/placeholder)', async () => {
    const id = await novaTarefa('Tarefa legada');
    await prisma.historicoStatus.create({
      data: { entidadeTipo: 'ChamadoTarefa', entidadeId: id, statusNovo: 'EM_ANDAMENTO', motivo: 'Andamento da tarefa: Tarefa legada', alteradoPorId: user.sub, metadata: { tipo: 'tarefa', acao: 'andamento', resumo: 'Status: EM_ANDAMENTO · antigo' } },
    });
    const d = await historico(id);
    const ev = d.historico.filter((h) => h.acao === 'andamento');
    expect(ev).toHaveLength(1);
    expect(ev[0].texto).toBeNull();
  });
});
