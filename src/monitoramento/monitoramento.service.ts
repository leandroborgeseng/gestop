import { Injectable } from '@nestjs/common';
import { NaoConformidadeStatus, OfflineSyncStatus, OrdemServicoStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
}
