import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NaoConformidadeStatus,
  Prisma,
  UnidadeTipo,
} from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { resolveSecretariaScopeId } from '../auth/secretaria-scope';
import { PrismaService } from '../prisma/prisma.service';
import { CHAMADO_OPEN_STATUSES } from '../chamados/chamados.rules';
import {
  applyInMemoryUnidadeFilters,
  mapUnidadeOperacional,
  UnidadeBaseRecord,
} from './operacional.mapper';
import { UnidadeListQuery } from './operacional.types';

const NON_CONFORMITY_OPEN_STATUSES: NaoConformidadeStatus[] = [
  NaoConformidadeStatus.ABERTA,
  NaoConformidadeStatus.EM_TRIAGEM,
  NaoConformidadeStatus.CHAMADO_GERADO,
];

@Injectable()
export class OperacionalService {
  constructor(private readonly prisma: PrismaService) {}

  async getResumo(user: JwtPayload) {
    const secretariaId = resolveSecretariaScopeId(user);
    const unidadeWhere = secretariaId ? { secretariaId } : {};
    const chamadoWhere = secretariaId ? { secretariaId } : {};
    const ncWhere = secretariaId ? { unidade: { secretariaId } } : {};
    const fiscalizacaoWhere = secretariaId ? { secretariaId } : {};

    const [
      unidadesAtivas,
      totalSecretarias,
      fiscalizacoesConcluidas,
      naoConformidadesAbertas,
      chamadosAbertos,
      eventosSyncPendentes,
    ] = await Promise.all([
      this.prisma.unidadePublica.count({ where: { ...unidadeWhere, ativo: true } }),
      secretariaId
        ? this.prisma.secretaria.count({ where: { id: secretariaId, ativo: true } })
        : this.prisma.secretaria.count({ where: { ativo: true } }),
      this.prisma.fiscalizacao.count({ where: { ...fiscalizacaoWhere, status: 'CONCLUIDA' } }),
      this.prisma.naoConformidade.count({
        where: { ...ncWhere, status: { in: NON_CONFORMITY_OPEN_STATUSES } },
      }),
      this.prisma.chamado.count({
        where: { ...chamadoWhere, status: { in: CHAMADO_OPEN_STATUSES } },
      }),
      this.prisma.offlineSyncEvent.count({
        where: { status: { in: ['PENDENTE', 'PROCESSANDO', 'CONFLITO', 'FALHOU'] } },
      }),
    ]);

    return {
      totalUnidades: unidadesAtivas,
      unidadesAtivas,
      totalSecretarias,
      fiscalizacoesConcluidas,
      naoConformidadesAbertas,
      chamadosAbertos,
      eventosSyncPendentes,
    };
  }

  async listSecretarias(user: JwtPayload) {
    const secretariaId = resolveSecretariaScopeId(user);
    return this.prisma.secretaria.findMany({
      where: { ativo: true, ...(secretariaId ? { id: secretariaId } : {}) },
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

  async getOpcoesFiltro(user: JwtPayload) {
    const secretariaId = resolveSecretariaScopeId(user);
    const [secretarias, bairros, tiposRows, responsaveisRows] = await Promise.all([
      this.prisma.secretaria.findMany({
        where: {
          ativo: true,
          unidades: { some: { ativo: true } },
          ...(secretariaId ? { id: secretariaId } : {}),
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

  async listUnidades(query: UnidadeListQuery, user: JwtPayload) {
    const scopeId = resolveSecretariaScopeId(user);
    const effectiveQuery = scopeId ? { ...query, secretariaId: scopeId } : query;
    const where = this.buildUnidadeWhere(effectiveQuery);
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
            chamados: {
              where: { status: { in: CHAMADO_OPEN_STATUSES } },
            },
          },
        },
      },
    });

    const mapped = unidades.map((unidade) =>
      mapUnidadeOperacional(unidade as UnidadeBaseRecord, {
        fiscalizacoes: unidade._count.fiscalizacoes,
        naoConformidadesAbertas: unidade._count.naoConformidades,
        chamadosAbertos: unidade._count.chamados,
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
        chamados: {
          where: { status: { in: CHAMADO_OPEN_STATUSES } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            codigo: true,
            titulo: true,
            descricao: true,
            prioridade: true,
            status: true,
            createdAt: true,
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
            chamados: {
              where: { status: { in: CHAMADO_OPEN_STATUSES } },
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
      chamadosAbertos: unidade._count.chamados,
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
        chamados: unidade.chamados,
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
      ...(query.situacao === 'INATIVA' ? { ativo: false } : { ativo: true }),
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
