/**
 * Dados sintéticos do teste real do R-1 (Playwright sem mock).
 * Exige o seed de desenvolvimento já aplicado. Não apaga o banco.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ChamadoOrigem,
  ChamadoPrioridade,
  ChamadoStatus,
  ChamadoTarefaStatus,
  DocumentoOrigem,
  DocumentoTipo,
  FiscalizacaoOrigem,
  FiscalizacaoStatus,
  PrismaClient,
} from '@prisma/client';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://gestop:gestop@127.0.0.1:5432/gestop_test?schema=public';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const admin = await prisma.usuario.findUnique({ where: { email: 'admin.gestop@franca.sp.gov.br' } });
  const secretaria = await prisma.secretaria.findFirst({ where: { sigla: 'SME' } });
  const checklist = await prisma.checklistVersao.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!admin || !secretaria || !checklist) {
    throw new Error('Seed de desenvolvimento ausente. Rode prisma db seed antes deste script.');
  }

  const unidade = await prisma.unidadePublica.upsert({
    where: { codigoPatrimonial: 'ZZR1-ESC' },
    update: { nome: 'ZZR1 Unidade', tipo: 'ESCOLA', secretariaId: secretaria.id },
    create: {
      secretariaId: secretaria.id,
      codigoPatrimonial: 'ZZR1-ESC',
      nome: 'ZZR1 Unidade',
      tipo: 'ESCOLA',
      endereco: 'Rua do teste 322',
      bairro: 'Centro',
      latitude: -20.53936,
      longitude: -47.40081,
    },
  });

  const chamado = await prisma.chamado.upsert({
    where: { codigo: 'ZZR1-001' },
    update: {
      status: ChamadoStatus.ABERTO,
      prioridade: ChamadoPrioridade.ALTA,
      titulo: 'ZZR1 chamado aberto',
      secretariaId: secretaria.id,
      unidadeId: unidade.id,
      excluidoEm: null,
    },
    create: {
      codigo: 'ZZR1-001',
      secretariaId: secretaria.id,
      unidadeId: unidade.id,
      registradoPorId: admin.id,
      origem: ChamadoOrigem.MANUAL,
      titulo: 'ZZR1 chamado aberto',
      descricao: 'Registro sintético do teste R-1.',
      prioridade: ChamadoPrioridade.ALTA,
      status: ChamadoStatus.ABERTO,
    },
  });

  await prisma.documento.upsert({
    where: { codigo: 'ZZR1-DOC' },
    update: { tipo: DocumentoTipo.NOTIFICACAO, titulo: 'ZZR1 notificação', canceladoEm: null },
    create: {
      codigo: 'ZZR1-DOC',
      codigoValidacao: 'zzr1-doc-validacao',
      tipo: DocumentoTipo.NOTIFICACAO,
      origem: DocumentoOrigem.AVULSO,
      titulo: 'ZZR1 notificação',
      secretariaId: secretaria.id,
      unidadeId: unidade.id,
      criadoPorId: admin.id,
    },
  });

  const vistoria = await prisma.fiscalizacao.findFirst({
    where: { observacoes: 'ZZR1 vistoria' },
  });
  if (!vistoria) {
    await prisma.fiscalizacao.create({
      data: {
        secretariaId: secretaria.id,
        unidadeId: unidade.id,
        checklistVersaoId: checklist.id,
        agenteId: admin.id,
        status: FiscalizacaoStatus.CONCLUIDA,
        origem: FiscalizacaoOrigem.ROTINA,
        concluidaEm: new Date('2026-11-01T12:00:00.000Z'),
        observacoes: 'ZZR1 vistoria',
      },
    });
  }

  const tarefa = await prisma.chamadoTarefa.findFirst({ where: { titulo: 'ZZR1 tarefa' } });
  if (!tarefa) {
    await prisma.chamadoTarefa.create({
      data: {
        chamadoId: chamado.id,
        titulo: 'ZZR1 tarefa',
        secretariaId: secretaria.id,
        status: ChamadoTarefaStatus.NOVA,
        prioridade: ChamadoPrioridade.ALTA,
        responsavelId: admin.id,
        criadaPorId: admin.id,
      },
    });
  } else if (tarefa.responsavelId !== admin.id) {
    await prisma.chamadoTarefa.update({ where: { id: tarefa.id }, data: { responsavelId: admin.id } });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
