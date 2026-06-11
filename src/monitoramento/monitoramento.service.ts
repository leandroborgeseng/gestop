import { Injectable } from '@nestjs/common';
import { ChamadoStatus, NaoConformidadeStatus, OfflineSyncStatus } from '@prisma/client';
import { CHAMADO_OPEN_STATUSES } from '../chamados/chamados.rules';
import { PrismaService } from '../prisma/prisma.service';

const CHAMADO_ALERTA_HORAS = 48;

@Injectable()
export class MonitoramentoService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const [
      totalUnidades,
      fiscalizacoes,
      naoConformidades,
      chamadosAbertos,
      chamadosEmAtendimento,
      chamadosEmExecucao,
      chamadosImpedidos,
      chamadosConcluidos,
      syncPendentes,
      pendenciasPorSecretaria,
    ] = await Promise.all([
      this.prisma.unidadePublica.count({ where: { ativo: true } }),
      this.prisma.fiscalizacao.count(),
      this.prisma.naoConformidade.count({ where: { status: { not: NaoConformidadeStatus.RESOLVIDA } } }),
      this.prisma.chamado.count({ where: { status: { in: CHAMADO_OPEN_STATUSES } } }),
      this.prisma.chamado.count({ where: { status: ChamadoStatus.EM_ATENDIMENTO } }),
      this.prisma.chamado.count({ where: { status: ChamadoStatus.EM_EXECUCAO } }),
      this.prisma.chamado.count({ where: { status: ChamadoStatus.IMPEDIDO } }),
      this.prisma.chamado.count({ where: { status: ChamadoStatus.CONCLUIDO } }),
      this.prisma.offlineSyncEvent.count({
        where: { status: { in: [OfflineSyncStatus.PENDENTE, OfflineSyncStatus.CONFLITO, OfflineSyncStatus.FALHOU] } },
      }),
      this.prisma.secretaria.findMany({
        where: { ativo: true },
        select: {
          id: true,
          sigla: true,
          nome: true,
          _count: {
            select: {
              chamados: { where: { status: { in: CHAMADO_OPEN_STATUSES } } },
              fiscalizacoes: true,
            },
          },
        },
        orderBy: { sigla: 'asc' },
      }),
    ]);

    return {
      indicadores: {
        totalUnidades,
        fiscalizacoes,
        naoConformidades,
        chamados: {
          abertos: chamadosAbertos,
          emAtendimento: chamadosEmAtendimento,
          emExecucao: chamadosEmExecucao,
          impedidos: chamadosImpedidos,
          concluidos: chamadosConcluidos,
        },
        syncPendentes,
      },
      pendenciasPorSecretaria: pendenciasPorSecretaria.map((secretaria) => ({
        id: secretaria.id,
        sigla: secretaria.sigla,
        nome: secretaria.nome,
        chamadosPendentes: secretaria._count.chamados,
        fiscalizacoes: secretaria._count.fiscalizacoes,
      })),
    };
  }

  listAuditoria() {
    return this.prisma.logAuditoria.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        usuario: { select: { id: true, nome: true, email: true } },
      },
    });
  }

  async getAlertasOperacionais() {
    const now = new Date();
    const chamadoLimite = new Date(now.getTime() - CHAMADO_ALERTA_HORAS * 60 * 60 * 1000);

    const [chamadosAtrasados, chamadosSemTriagem, syncFalhas, chamadosUrgentes] = await Promise.all([
      this.prisma.chamado.findMany({
        where: {
          prazoEm: { lt: now },
          status: { in: CHAMADO_OPEN_STATUSES },
        },
        orderBy: { prazoEm: 'asc' },
        take: 20,
        select: {
          id: true,
          codigo: true,
          titulo: true,
          descricao: true,
          prioridade: true,
          status: true,
          prazoEm: true,
          secretaria: { select: { sigla: true } },
          unidade: { select: { nome: true } },
        },
      }),
      this.prisma.chamado.findMany({
        where: {
          status: { in: [ChamadoStatus.ABERTO, ChamadoStatus.EM_TRIAGEM] },
          createdAt: { lt: chamadoLimite },
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: {
          id: true,
          codigo: true,
          status: true,
          origem: true,
          createdAt: true,
          secretaria: { select: { sigla: true } },
          unidade: { select: { nome: true } },
        },
      }),
      this.prisma.offlineSyncEvent.count({
        where: { status: { in: [OfflineSyncStatus.FALHOU, OfflineSyncStatus.CONFLITO] } },
      }),
      this.prisma.chamado.count({
        where: {
          prioridade: 'URGENTE',
          status: { in: CHAMADO_OPEN_STATUSES },
        },
      }),
    ]);

    return {
      resumo: {
        chamadosAtrasados: chamadosAtrasados.length,
        chamadosSemTriagem: chamadosSemTriagem.length,
        syncFalhas,
        chamadosUrgentes,
      },
      chamadosAtrasados,
      chamadosSemTriagem,
    };
  }
}
