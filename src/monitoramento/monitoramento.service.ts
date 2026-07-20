import { Injectable } from '@nestjs/common';
import {
  ChamadoPrioridade,
  ChamadoStatus,
  NaoConformidadeStatus,
  OfflineSyncStatus,
  Prisma,
} from '@prisma/client';
import { CHAMADO_OPEN_STATUSES } from '../chamados/chamados.rules';
import { PrismaService } from '../prisma/prisma.service';
import { loadExecucaoParticipantes } from '../relatorios/relatorios.execucao-participantes';
import { DashboardFiltroDto } from './monitoramento.dto';

const CHAMADO_ALERTA_HORAS = 48;

type RankingItem = { chave: string; label: string; detalhe?: string | null; total: number };

function periodBounds(filtro: DashboardFiltroDto) {
  const from = filtro.from ? new Date(filtro.from) : null;
  const to = filtro.to ? new Date(`${filtro.to}T23:59:59.999Z`) : null;
  return { from, to };
}

function bump(map: Map<string, RankingItem>, chave: string, label: string, detalhe?: string | null) {
  const current = map.get(chave);
  if (current) {
    current.total += 1;
    return;
  }
  map.set(chave, { chave, label, detalhe: detalhe ?? null, total: 1 });
}

function sortedRanking(map: Map<string, RankingItem>): RankingItem[] {
  return [...map.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'));
}

@Injectable()
export class MonitoramentoService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(filtro: DashboardFiltroDto = {}) {
    const { from, to } = periodBounds(filtro);
    const chamadoWhere = this.chamadoWhere(filtro, from, to, 'createdAt');
    const chamadoConcluidoWhere = this.chamadoWhere(
      { ...filtro, status: ChamadoStatus.CONCLUIDO },
      from,
      to,
      'concluidoEm',
    );

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
      analise,
    ] = await Promise.all([
      this.prisma.unidadePublica.count({
        where: {
          ativo: true,
          ...(filtro.secretariaId ? { secretariaId: filtro.secretariaId } : {}),
        },
      }),
      this.prisma.fiscalizacao.count({
        where: {
          ...(filtro.secretariaId ? { secretariaId: filtro.secretariaId } : {}),
          ...(from || to
            ? {
                iniciadaEm: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : {}),
        },
      }),
      this.prisma.naoConformidade.count({
        where: {
          status: { not: NaoConformidadeStatus.RESOLVIDA },
          ...(filtro.secretariaId ? { secretariaId: filtro.secretariaId } : {}),
        },
      }),
      this.prisma.chamado.count({
        where: { ...chamadoWhere, status: { in: CHAMADO_OPEN_STATUSES } },
      }),
      this.prisma.chamado.count({
        where: { ...chamadoWhere, status: ChamadoStatus.EM_ATENDIMENTO },
      }),
      this.prisma.chamado.count({
        where: { ...chamadoWhere, status: ChamadoStatus.EM_EXECUCAO },
      }),
      this.prisma.chamado.count({
        where: { ...chamadoWhere, status: ChamadoStatus.IMPEDIDO },
      }),
      this.prisma.chamado.count({ where: chamadoConcluidoWhere }),
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
      this.buildAnaliseChamados(filtro, chamadoWhere, chamadoConcluidoWhere),
    ]);

    return {
      filtrosAplicados: {
        from: filtro.from ?? null,
        to: filtro.to ?? null,
        secretariaId: filtro.secretariaId ?? null,
        equipeId: filtro.equipeId ?? null,
        cargo: filtro.cargo ?? null,
        tipoChamadoId: filtro.tipoChamadoId ?? null,
        prioridade: filtro.prioridade ?? null,
        status: filtro.status ?? null,
      },
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
      analise,
      pendenciasPorSecretaria: pendenciasPorSecretaria.map((secretaria) => ({
        id: secretaria.id,
        sigla: secretaria.sigla,
        nome: secretaria.nome,
        chamadosPendentes: secretaria._count.chamados,
        fiscalizacoes: secretaria._count.fiscalizacoes,
      })),
    };
  }

  private chamadoWhere(
    filtro: DashboardFiltroDto,
    from: Date | null,
    to: Date | null,
    dateField: 'createdAt' | 'concluidoEm',
  ): Prisma.ChamadoWhereInput {
    const dateFilter =
      from || to
        ? {
            [dateField]: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {};

    return {
      ...(filtro.secretariaId ? { secretariaId: filtro.secretariaId } : {}),
      ...(filtro.tipoChamadoId ? { tipoChamadoId: filtro.tipoChamadoId } : {}),
      ...(filtro.prioridade ? { prioridade: filtro.prioridade as ChamadoPrioridade } : {}),
      ...(filtro.status ? { status: filtro.status as ChamadoStatus } : {}),
      ...(filtro.equipeId === 'sem-equipe'
        ? { equipeId: null }
        : filtro.equipeId
          ? { equipeId: filtro.equipeId }
          : {}),
      ...dateFilter,
    };
  }

  private async buildAnaliseChamados(
    filtro: DashboardFiltroDto,
    chamadoWhere: Prisma.ChamadoWhereInput,
    chamadoConcluidoWhere: Prisma.ChamadoWhereInput,
  ) {
    const [concluidos, porTipoRows, porSecretariaRows] = await Promise.all([
      this.prisma.chamado.findMany({
        where: chamadoConcluidoWhere,
        select: {
          id: true,
          codigo: true,
          secretaria: { select: { sigla: true } },
          tipoChamado: { select: { nome: true } },
        },
        orderBy: [{ concluidoEm: 'asc' }, { codigo: 'asc' }],
        take: 5000,
      }),
      this.prisma.chamado.groupBy({
        by: ['tipoChamadoId'],
        where: chamadoWhere,
        _count: { _all: true },
      }),
      this.prisma.chamado.groupBy({
        by: ['secretariaId'],
        where: chamadoWhere,
        _count: { _all: true },
      }),
    ]);

    const participantesMap = await loadExecucaoParticipantes(
      this.prisma,
      concluidos.map((item) => item.id),
    );

    const porFuncionario = new Map<string, RankingItem>();
    const porEquipe = new Map<string, RankingItem>();
    const porCargo = new Map<string, RankingItem>();

    for (const chamado of concluidos) {
      const resumo = participantesMap.get(chamado.id);
      const equipeNome = resumo?.equipeExecutoraNome?.trim() || 'Sem equipe';
      bump(porEquipe, equipeNome.toLowerCase(), equipeNome);

      const participantes = resumo?.participantes?.length
        ? resumo.participantes
        : [{ id: undefined, nome: 'Sem funcionário', cargo: null, origem: 'equipe' as const }];

      for (const participante of participantes) {
        if (filtro.cargo?.trim()) {
          const cargoNorm = (participante.cargo ?? 'Sem cargo').trim().toLowerCase();
          if (cargoNorm !== filtro.cargo.trim().toLowerCase()) continue;
        }
        const nome = participante.nome?.trim() || 'Sem funcionário';
        const cargo = participante.cargo?.trim() || 'Sem cargo';
        const chave = `${participante.id ?? nome}::${cargo}`.toLowerCase();
        bump(porFuncionario, chave, nome, cargo);
        bump(porCargo, cargo.toLowerCase(), cargo);
      }
    }

    const tipoIds = porTipoRows.map((row) => row.tipoChamadoId).filter((id): id is string => Boolean(id));
    const tipos = tipoIds.length
      ? await this.prisma.tipoChamado.findMany({
          where: { id: { in: tipoIds } },
          select: { id: true, nome: true },
        })
      : [];
    const tipoNome = new Map(tipos.map((item) => [item.id, item.nome]));

    const secretariaIds = porSecretariaRows.map((row) => row.secretariaId);
    const secretarias = secretariaIds.length
      ? await this.prisma.secretaria.findMany({
          where: { id: { in: secretariaIds } },
          select: { id: true, sigla: true },
        })
      : [];
    const secretariaSigla = new Map(secretarias.map((item) => [item.id, item.sigla]));

    const porTipo: RankingItem[] = porTipoRows
      .map((row) => ({
        chave: row.tipoChamadoId ?? 'sem-tipo',
        label: row.tipoChamadoId ? tipoNome.get(row.tipoChamadoId) ?? 'Sem tipo' : 'Sem tipo',
        total: row._count._all,
      }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'));

    const porSecretaria: RankingItem[] = porSecretariaRows
      .map((row) => ({
        chave: row.secretariaId,
        label: secretariaSigla.get(row.secretariaId) ?? 'Sem Secretaria',
        total: row._count._all,
      }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'));

    return {
      produtividadePorFuncionario: sortedRanking(porFuncionario),
      produtividadePorEquipe: sortedRanking(porEquipe),
      produtividadePorCargo: sortedRanking(porCargo),
      chamadosPorTipo: porTipo,
      chamadosPorSecretaria: porSecretaria,
      totalConcluidosAnalisados: concluidos.length,
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
