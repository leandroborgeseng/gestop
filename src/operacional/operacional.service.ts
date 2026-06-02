import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NaoConformidadeStatus,
  OrdemServicoStatus,
  Prisma,
  UnidadeTipo,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  applyInMemoryUnidadeFilters,
  mapUnidadeOperacional,
  UnidadeBaseRecord,
} from './operacional.mapper';
import { UnidadeListQuery } from './operacional.types';

const NON_CONFORMITY_OPEN_STATUSES: NaoConformidadeStatus[] = [
  NaoConformidadeStatus.ABERTA,
  NaoConformidadeStatus.EM_TRIAGEM,
  NaoConformidadeStatus.OS_GERADA,
];

const WORK_ORDER_OPEN_STATUSES: OrdemServicoStatus[] = [
  OrdemServicoStatus.ABERTA,
  OrdemServicoStatus.EM_TRIAGEM,
  OrdemServicoStatus.ATRIBUIDA,
  OrdemServicoStatus.EM_EXECUCAO,
  OrdemServicoStatus.IMPEDIDA,
];

@Injectable()
export class OperacionalService {
  constructor(private readonly prisma: PrismaService) {}

  async getResumo() {
    const [
      totalUnidades,
      unidadesAtivas,
      totalSecretarias,
      fiscalizacoesConcluidas,
      naoConformidadesAbertas,
      ordensServicoAbertas,
      eventosSyncPendentes,
    ] = await Promise.all([
      this.prisma.unidadePublica.count(),
      this.prisma.unidadePublica.count({ where: { ativo: true } }),
      this.prisma.secretaria.count({ where: { ativo: true } }),
      this.prisma.fiscalizacao.count({ where: { status: 'CONCLUIDA' } }),
      this.prisma.naoConformidade.count({
        where: { status: { in: NON_CONFORMITY_OPEN_STATUSES } },
      }),
      this.prisma.ordemServico.count({
        where: { status: { in: WORK_ORDER_OPEN_STATUSES } },
      }),
      this.prisma.offlineSyncEvent.count({
        where: { status: { in: ['PENDENTE', 'PROCESSANDO', 'CONFLITO', 'FALHOU'] } },
      }),
    ]);

    return {
      totalUnidades,
      unidadesAtivas,
      totalSecretarias,
      fiscalizacoesConcluidas,
      naoConformidadesAbertas,
      ordensServicoAbertas,
      eventosSyncPendentes,
    };
  }

  async listSecretarias() {
    return this.prisma.secretaria.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        sigla: true,
      },
    });
  }

  async listBairros() {
    const bairros = await this.prisma.unidadePublica.findMany({
      where: {
        ativo: true,
        bairro: { not: null },
      },
      distinct: ['bairro'],
      orderBy: { bairro: 'asc' },
      select: { bairro: true },
    });

    return bairros.map((item) => item.bairro).filter((bairro): bairro is string => Boolean(bairro));
  }

  async getOpcoesFiltro() {
    const [secretarias, bairros, tiposRows, responsaveisRows] = await Promise.all([
      this.prisma.secretaria.findMany({
        where: {
          ativo: true,
          unidades: { some: { ativo: true } },
        },
        orderBy: { nome: 'asc' },
        select: { id: true, nome: true, sigla: true },
      }),
      this.listBairros(),
      this.prisma.unidadePublica.findMany({
        where: { ativo: true },
        distinct: ['tipo'],
        orderBy: { tipo: 'asc' },
        select: { tipo: true },
      }),
      this.prisma.secretaria.findMany({
        where: {
          ativo: true,
          unidades: { some: { ativo: true } },
          OR: [{ responsavelNome: { not: null } }, { responsavelEmail: { not: null } }],
        },
        orderBy: [{ responsavelNome: 'asc' }, { sigla: 'asc' }],
        select: {
          id: true,
          sigla: true,
          responsavelNome: true,
          responsavelEmail: true,
        },
      }),
    ]);

    const responsaveis = responsaveisRows
      .filter((item) => item.responsavelNome?.trim())
      .map((item) => ({
        nome: item.responsavelNome!.trim(),
        email: item.responsavelEmail?.trim().toLowerCase() ?? null,
        secretariaId: item.id,
        secretariaSigla: item.sigla,
      }));

    const emails = [...new Set(responsaveis.map((item) => item.email).filter((email): email is string => Boolean(email)))].sort(
      (a, b) => a.localeCompare(b),
    );

    return {
      secretarias,
      bairros,
      tipos: tiposRows.map((item) => item.tipo),
      responsaveis,
      emails,
    };
  }

  async listUnidades(query: UnidadeListQuery) {
    const where = this.buildUnidadeWhere(query);
    const unidades = await this.prisma.unidadePublica.findMany({
      where,
      orderBy: [{ secretaria: { sigla: 'asc' } }, { nome: 'asc' }],
      select: {
        id: true,
        codigoPatrimonial: true,
        nome: true,
        tipo: true,
        endereco: true,
        bairro: true,
        cep: true,
        latitude: true,
        longitude: true,
        raioValidacaoMetros: true,
        ativo: true,
        secretaria: {
          select: {
            id: true,
            nome: true,
            sigla: true,
            responsavelNome: true,
            responsavelEmail: true,
          },
        },
        _count: {
          select: {
            fiscalizacoes: true,
            naoConformidades: {
              where: { status: { in: NON_CONFORMITY_OPEN_STATUSES } },
            },
            ordensServico: {
              where: { status: { in: WORK_ORDER_OPEN_STATUSES } },
            },
          },
        },
      },
    });

    const mapped = unidades.map((unidade) =>
      mapUnidadeOperacional(unidade as UnidadeBaseRecord, {
        fiscalizacoes: unidade._count.fiscalizacoes,
        naoConformidadesAbertas: unidade._count.naoConformidades,
        ordensServicoAbertas: unidade._count.ordensServico,
      }),
    );

    return applyInMemoryUnidadeFilters(mapped, {
      situacao: query.situacao,
      pendencias: query.pendencias,
    });
  }

  async getUnidadeDetalhe(id: string) {
    const unidade = await this.prisma.unidadePublica.findUnique({
      where: { id },
      select: {
        id: true,
        codigoPatrimonial: true,
        nome: true,
        tipo: true,
        endereco: true,
        bairro: true,
        cep: true,
        latitude: true,
        longitude: true,
        raioValidacaoMetros: true,
        ativo: true,
        secretaria: {
          select: {
            id: true,
            nome: true,
            sigla: true,
            responsavelNome: true,
            responsavelEmail: true,
          },
        },
        fiscalizacoes: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            origem: true,
            iniciadaEm: true,
            concluidaEm: true,
            dentroRaioPermitido: true,
            distanciaCheckinMetros: true,
            agente: {
              select: {
                id: true,
                nome: true,
              },
            },
            checklistVersao: {
              select: {
                id: true,
                versao: true,
                checklist: {
                  select: {
                    id: true,
                    nome: true,
                  },
                },
              },
            },
          },
        },
        naoConformidades: {
          where: { status: { in: NON_CONFORMITY_OPEN_STATUSES } },
          orderBy: { registradaEm: 'desc' },
          take: 10,
          select: {
            id: true,
            descricao: true,
            severidade: true,
            status: true,
            registradaEm: true,
            item: {
              select: {
                codigo: true,
                titulo: true,
              },
            },
          },
        },
        ordensServico: {
          where: { status: { in: WORK_ORDER_OPEN_STATUSES } },
          orderBy: { abertaEm: 'desc' },
          take: 10,
          select: {
            id: true,
            codigo: true,
            titulo: true,
            prioridade: true,
            status: true,
            abertaEm: true,
            prazoEm: true,
            responsavel: {
              select: {
                id: true,
                nome: true,
              },
            },
          },
        },
        _count: {
          select: {
            fiscalizacoes: true,
            naoConformidades: {
              where: { status: { in: NON_CONFORMITY_OPEN_STATUSES } },
            },
            ordensServico: {
              where: { status: { in: WORK_ORDER_OPEN_STATUSES } },
            },
          },
        },
      },
    });

    if (!unidade) {
      throw new NotFoundException('Proprio publico nao encontrado');
    }

    const resumo = mapUnidadeOperacional(unidade as UnidadeBaseRecord, {
      fiscalizacoes: unidade._count.fiscalizacoes,
      naoConformidadesAbertas: unidade._count.naoConformidades,
      ordensServicoAbertas: unidade._count.ordensServico,
    });

    return {
      ...resumo,
      secretaria: unidade.secretaria,
      ultimasFiscalizacoes: unidade.fiscalizacoes.map((fiscalizacao) => ({
        ...fiscalizacao,
        distanciaCheckinMetros:
          fiscalizacao.distanciaCheckinMetros === null
            ? null
            : Number(fiscalizacao.distanciaCheckinMetros),
      })),
      pendenciasDetalhadas: {
        naoConformidades: unidade.naoConformidades,
        ordensServico: unidade.ordensServico,
      },
    };
  }

  private buildUnidadeWhere(query: UnidadeListQuery): Prisma.UnidadePublicaWhereInput {
    const secretariaFilter: Prisma.SecretariaWhereInput = {
      ...(query.responsavel
        ? { responsavelNome: { equals: query.responsavel, mode: 'insensitive' } }
        : {}),
      ...(query.responsavelEmail
        ? { responsavelEmail: { equals: query.responsavelEmail, mode: 'insensitive' } }
        : {}),
    };

    return {
      ...(query.secretariaId ? { secretariaId: query.secretariaId } : {}),
      ...(query.tipo ? { tipo: query.tipo as UnidadeTipo } : {}),
      ...(query.bairro ? { bairro: { equals: query.bairro, mode: 'insensitive' } } : {}),
      ...(Object.keys(secretariaFilter).length > 0 ? { secretaria: secretariaFilter } : {}),
      ...(query.search
        ? {
            OR: [
              { nome: { contains: query.search, mode: 'insensitive' } },
              { codigoPatrimonial: { contains: query.search, mode: 'insensitive' } },
              { endereco: { contains: query.search, mode: 'insensitive' } },
              { bairro: { contains: query.search, mode: 'insensitive' } },
              { secretaria: { nome: { contains: query.search, mode: 'insensitive' } } },
              { secretaria: { sigla: { contains: query.search, mode: 'insensitive' } } },
              { secretaria: { responsavelNome: { contains: query.search, mode: 'insensitive' } } },
              { secretaria: { responsavelEmail: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }
}
