import { Injectable } from '@nestjs/common';
import { ChamadoStatus, NaoConformidadeStatus, OfflineSyncStatus, OrdemServicoStatus } from '@prisma/client';
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
      osAbertas,
      osExecucao,
      osConcluidas,
      syncPendentes,
      pendenciasPorSecretaria,
    ] = await Promise.all([
      this.prisma.unidadePublica.count({ where: { ativo: true } }),
      this.prisma.fiscalizacao.count(),
      this.prisma.naoConformidade.count({ where: { status: { not: NaoConformidadeStatus.RESOLVIDA } } }),
      this.prisma.ordemServico.count({ where: { status: { in: [OrdemServicoStatus.ABERTA, OrdemServicoStatus.EM_TRIAGEM, OrdemServicoStatus.ATRIBUIDA] } } }),
      this.prisma.ordemServico.count({ where: { status: OrdemServicoStatus.EM_EXECUCAO } }),
      this.prisma.ordemServico.count({ where: { status: OrdemServicoStatus.CONCLUIDA } }),
      this.prisma.offlineSyncEvent.count({ where: { status: { in: [OfflineSyncStatus.PENDENTE, OfflineSyncStatus.CONFLITO, OfflineSyncStatus.FALHOU] } } }),
      this.prisma.secretaria.findMany({
        where: { ativo: true },
        select: {
          id: true,
          sigla: true,
          nome: true,
          _count: {
            select: {
              ordensServico: { where: { status: { not: OrdemServicoStatus.CONCLUIDA } } },
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
        ordensServico: {
          abertas: osAbertas,
          emExecucao: osExecucao,
          concluidas: osConcluidas,
        },
        syncPendentes,
      },
      pendenciasPorSecretaria: pendenciasPorSecretaria.map((secretaria) => ({
        id: secretaria.id,
        sigla: secretaria.sigla,
        nome: secretaria.nome,
        ordensPendentes: secretaria._count.ordensServico,
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

    const [osAtrasadas, chamadosSemTriagem, syncFalhas, osUrgentes] = await Promise.all([
      this.prisma.ordemServico.findMany({
        where: {
          prazoEm: { lt: now },
          status: { notIn: [OrdemServicoStatus.CONCLUIDA, OrdemServicoStatus.CANCELADA] },
        },
        orderBy: { prazoEm: 'asc' },
        take: 20,
        select: {
          id: true,
          codigo: true,
          titulo: true,
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
      this.prisma.ordemServico.count({
        where: {
          prioridade: 'URGENTE',
          status: { notIn: [OrdemServicoStatus.CONCLUIDA, OrdemServicoStatus.CANCELADA] },
        },
      }),
    ]);

    return {
      resumo: {
        osAtrasadas: osAtrasadas.length,
        chamadosSemTriagem: chamadosSemTriagem.length,
        syncFalhas,
        osUrgentes,
      },
      osAtrasadas,
      chamadosSemTriagem,
    };
  }
}
