import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ChamadoPrioridade,
  ChamadoStatus,
  FiscalizacaoStatus,
  NaoConformidadeStatus,
  Prisma,
  UnidadeTipo,
} from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { resolveChamadoSecretariaFilter, resolveSecretariaScopeId } from '../auth/secretaria-scope';
import { computeVistoriaNotas } from '../domain/vistoria-nota';
import { PrismaService } from '../prisma/prisma.service';
import { CHAMADO_OPEN_STATUSES } from '../chamados/chamados.rules';
import {
  applyInMemoryUnidadeFilters,
  DEFAULT_TIPOS_PENDENCIA,
  isChamadoForaPrazo,
  LEGACY_TIPOS_PENDENCIA,
  mapUnidadeOperacional,
  UnidadeBaseRecord,
} from './operacional.mapper';
import {
  ChamadoMapaItem,
  ChamadosMapaQuery,
  TipoPendencia,
  UnidadeListQuery,
  UnidadeVistoriaNotaResumo,
} from './operacional.types';

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
    const [secretarias, bairros, tiposRows, responsaveisRows, regioesRows, categoriasVistoria, equipes, tiposChamado] =
      await Promise.all([
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
        this.prisma.unidadePublica.findMany({
          where: { ativo: true, regiao: { not: null } },
          distinct: ['regiao'],
          orderBy: { regiao: 'asc' },
          select: { regiao: true },
        }),
        this.prisma.categoriaVistoria.findMany({
          where: { ativo: true },
          orderBy: { nome: 'asc' },
          select: { id: true, nome: true },
        }),
        this.prisma.equipe.findMany({
          where: { ativo: true, ...(secretariaId ? { secretariaId } : {}) },
          orderBy: { nome: 'asc' },
          select: { id: true, nome: true, codigo: true },
        }),
        this.prisma.tipoChamado.findMany({
          where: { ativo: true },
          orderBy: { nome: 'asc' },
          select: { id: true, nome: true },
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
      regioes: regioesRows.map((item) => item.regiao).filter((regiao): regiao is NonNullable<typeof regiao> => Boolean(regiao)),
      categoriasVistoria,
      responsaveis,
      emails,
      equipes,
      tiposChamado,
    };
  }

  async listUnidades(query: UnidadeListQuery, user: JwtPayload) {
    const scopeId = resolveSecretariaScopeId(user);
    const effectiveQuery = scopeId ? { ...query, secretariaId: scopeId } : query;
    const tiposPendencia = this.resolveTiposPendencia(query.tiposPendencia);
    const usesChamados = tiposPendencia.includes('CHAMADOS');
    const usesNc = tiposPendencia.includes('NAO_CONFORMIDADES');
    const usesVistorias = tiposPendencia.includes('VISTORIAS');
    const tiposChamadoId = usesChamados && query.tiposChamadoId?.length ? query.tiposChamadoId : undefined;
    const equipeIds = query.equipeIds?.length ? query.equipeIds : undefined;
    // Equipe/SLA olham chamados abertos independente do chip de tipo de pendência.
    const chamadoWhere = this.buildChamadoPendenciaWhere({ tiposChamadoId, equipeIds });

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
        regiao: true,
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
            fiscalizacoes: {
              where: { status: FiscalizacaoStatus.CONCLUIDA },
            },
            naoConformidades: {
              where: this.buildNcPendenciaWhere(),
            },
            chamados: {
              where: chamadoWhere,
            },
          },
        },
        chamados: {
          where: chamadoWhere,
          select: {
            id: true,
            prazoEm: true,
            status: true,
          },
        },
      },
    });

    const notasPorUnidade = await this.loadUltimasNotasPorUnidade(unidades.map((unidade) => unidade.id));

    const mapped = unidades.map((unidade) => {
      const chamadosSlaForaPrazo = unidade.chamados.filter((chamado) =>
        isChamadoForaPrazo(chamado.prazoEm),
      ).length;
      const semVistoria = unidade._count.fiscalizacoes === 0;
      const countsForSituacao = {
        fiscalizacoes: unidade._count.fiscalizacoes,
        naoConformidadesAbertas: usesNc ? unidade._count.naoConformidades : 0,
        chamadosAbertos: usesChamados ? unidade._count.chamados : 0,
        chamadosSlaForaPrazo: usesChamados ? chamadosSlaForaPrazo : 0,
        semVistoria: usesVistorias ? semVistoria : false,
      };

      const mappedUnidade = mapUnidadeOperacional(
        unidade as UnidadeBaseRecord,
        countsForSituacao,
        notasPorUnidade.get(unidade.id) ?? null,
        tiposPendencia,
      );

      const slaMapa =
        unidade._count.chamados > 0
          ? chamadosSlaForaPrazo > 0
            ? ('FORA' as const)
            : ('DENTRO' as const)
          : null;

      return {
        ...mappedUnidade,
        pendencias: {
          naoConformidadesAbertas: unidade._count.naoConformidades,
          chamadosAbertos: unidade._count.chamados,
          semVistoria,
        },
        totais: {
          fiscalizacoes: unidade._count.fiscalizacoes,
          naoConformidadesAbertas: unidade._count.naoConformidades,
          chamadosAbertos: unidade._count.chamados,
          chamadosSlaForaPrazo,
          semVistoria,
        },
        slaMapa,
      };
    });

    let filtered = applyInMemoryUnidadeFilters(mapped, {
      situacao: query.situacao,
      pendencias: query.pendencias,
      tiposPendencia,
      sla: query.sla,
    });

    if (equipeIds?.length || (usesChamados && tiposChamadoId?.length)) {
      filtered = filtered.filter((unidade) => unidade.pendencias.chamadosAbertos > 0);
    }

    return filtered;
  }

  async listChamadosMapa(query: ChamadosMapaQuery, user: JwtPayload): Promise<ChamadoMapaItem[]> {
    const where: Prisma.ChamadoWhereInput = {
      ...resolveChamadoSecretariaFilter(user),
      ...(query.status?.length ? { status: { in: query.status as ChamadoStatus[] } } : {}),
      ...(query.prioridade?.length ? { prioridade: { in: query.prioridade as ChamadoPrioridade[] } } : {}),
      ...(query.tipoChamadoId?.length ? { tipoChamadoId: { in: query.tipoChamadoId } } : {}),
      ...(query.equipeIds?.length ? { equipeId: { in: query.equipeIds } } : {}),
      ...(query.comUnidade === 'COM' ? { unidadeId: { not: null } } : {}),
      ...(query.comUnidade === 'SEM' ? { unidadeId: null } : {}),
      ...(query.bairro
        ? {
            OR: [
              { enderecoBairro: { equals: query.bairro, mode: 'insensitive' } },
              { unidade: { bairro: { equals: query.bairro, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { codigo: { contains: query.search, mode: 'insensitive' } },
              { titulo: { contains: query.search, mode: 'insensitive' } },
              { descricao: { contains: query.search, mode: 'insensitive' } },
              { enderecoTexto: { contains: query.search, mode: 'insensitive' } },
              { enderecoBairro: { contains: query.search, mode: 'insensitive' } },
              { unidade: { nome: { contains: query.search, mode: 'insensitive' } } },
              { unidade: { codigoPatrimonial: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const chamados = await this.prisma.chamado.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 2000,
      select: {
        id: true,
        codigo: true,
        titulo: true,
        descricao: true,
        status: true,
        prioridade: true,
        origem: true,
        prazoEm: true,
        previstaExecucaoEm: true,
        enderecoTexto: true,
        enderecoBairro: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        secretaria: { select: { id: true, nome: true, sigla: true } },
        unidade: {
          select: {
            id: true,
            nome: true,
            codigoPatrimonial: true,
            endereco: true,
            bairro: true,
            latitude: true,
            longitude: true,
          },
        },
        equipe: { select: { id: true, nome: true } },
        tipoChamado: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
      },
    });

    const now = new Date();
    const items = chamados.map((chamado): ChamadoMapaItem => {
      const latitude = chamado.latitude != null ? Number(chamado.latitude) : null;
      const longitude = chamado.longitude != null ? Number(chamado.longitude) : null;
      const unidadeLat = chamado.unidade?.latitude != null ? Number(chamado.unidade.latitude) : null;
      const unidadeLng = chamado.unidade?.longitude != null ? Number(chamado.unidade.longitude) : null;
      const mapaLatitude = latitude ?? unidadeLat;
      const mapaLongitude = longitude ?? unidadeLng;
      const open = (CHAMADO_OPEN_STATUSES as string[]).includes(chamado.status);
      const slaMapa =
        open && chamado.prazoEm
          ? isChamadoForaPrazo(chamado.prazoEm, now)
            ? ('FORA' as const)
            : ('DENTRO' as const)
          : null;

      return {
        id: chamado.id,
        codigo: chamado.codigo,
        titulo: chamado.titulo,
        descricao: chamado.descricao,
        status: chamado.status,
        prioridade: chamado.prioridade,
        origem: chamado.origem,
        prazoEm: chamado.prazoEm?.toISOString() ?? null,
        previstaExecucaoEm: chamado.previstaExecucaoEm?.toISOString() ?? null,
        enderecoTexto: chamado.enderecoTexto,
        enderecoBairro: chamado.enderecoBairro,
        latitude,
        longitude,
        mapaLatitude: Number.isFinite(mapaLatitude) ? mapaLatitude : null,
        mapaLongitude: Number.isFinite(mapaLongitude) ? mapaLongitude : null,
        slaMapa,
        createdAt: chamado.createdAt.toISOString(),
        secretaria: chamado.secretaria,
        unidade: chamado.unidade
          ? {
              id: chamado.unidade.id,
              nome: chamado.unidade.nome,
              codigoPatrimonial: chamado.unidade.codigoPatrimonial,
              endereco: chamado.unidade.endereco,
              bairro: chamado.unidade.bairro,
              latitude: unidadeLat,
              longitude: unidadeLng,
            }
          : null,
        equipe: chamado.equipe,
        tipoChamado: chamado.tipoChamado,
        responsavel: chamado.responsavel,
      };
    });

    if (!query.sla) return items;
    return items.filter((item) => item.slaMapa === query.sla);
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
        regiao: true,
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
            fiscalizacoes: {
              where: { status: FiscalizacaoStatus.CONCLUIDA },
            },
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

    const chamadosSlaForaPrazo = unidade.chamados.filter((chamado) => isChamadoForaPrazo(chamado.prazoEm)).length;
    const semVistoria = unidade._count.fiscalizacoes === 0;

    const resumo = mapUnidadeOperacional(
      unidade as UnidadeBaseRecord,
      {
        fiscalizacoes: unidade._count.fiscalizacoes,
        naoConformidadesAbertas: unidade._count.naoConformidades,
        chamadosAbertos: unidade._count.chamados,
        chamadosSlaForaPrazo,
        semVistoria,
      },
      (await this.loadUltimasNotasPorUnidade([id])).get(id) ?? null,
      LEGACY_TIPOS_PENDENCIA,
    );

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

  private resolveTiposPendencia(tipos?: TipoPendencia[]) {
    if (!tipos || tipos.length === 0) {
      return [...LEGACY_TIPOS_PENDENCIA];
    }
    const valid = tipos.filter((tipo): tipo is TipoPendencia =>
      DEFAULT_TIPOS_PENDENCIA.includes(tipo),
    );
    return valid.length > 0 ? valid : [...LEGACY_TIPOS_PENDENCIA];
  }

  private buildNcPendenciaWhere(): Prisma.NaoConformidadeWhereInput {
    // NC pendente = gerou chamado ainda aberto, ou NC aberta/em triagem ainda sem chamado.
    return {
      status: { in: NON_CONFORMITY_OPEN_STATUSES },
      OR: [
        { chamado: { status: { in: CHAMADO_OPEN_STATUSES } } },
        {
          AND: [
            { chamado: { is: null } },
            { status: { in: [NaoConformidadeStatus.ABERTA, NaoConformidadeStatus.EM_TRIAGEM] } },
          ],
        },
      ],
    };
  }

  private buildChamadoPendenciaWhere(filters: {
    tiposChamadoId?: string[];
    equipeIds?: string[];
  }): Prisma.ChamadoWhereInput {
    return {
      status: { in: CHAMADO_OPEN_STATUSES },
      ...(filters.tiposChamadoId?.length ? { tipoChamadoId: { in: filters.tiposChamadoId } } : {}),
      ...(filters.equipeIds?.length ? { equipeId: { in: filters.equipeIds } } : {}),
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
      ...(query.regiao ? { regiao: query.regiao } : {}),
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

  private async loadUltimasNotasPorUnidade(unidadeIds: string[]) {
    const map = new Map<string, UnidadeVistoriaNotaResumo>();
    if (unidadeIds.length === 0) return map;

    const fiscalizacoes = await this.prisma.fiscalizacao.findMany({
      where: {
        unidadeId: { in: unidadeIds },
        status: FiscalizacaoStatus.CONCLUIDA,
      },
      orderBy: [{ concluidaEm: 'desc' }, { createdAt: 'desc' }],
      distinct: ['unidadeId'],
      select: {
        id: true,
        unidadeId: true,
        concluidaEm: true,
        respostas: {
          select: {
            valorTexto: true,
            valorBooleano: true,
            item: {
              select: {
                tipo: true,
                opcoes: true,
                categoriaVistoriaId: true,
                categoriaVistoria: { select: { id: true, nome: true } },
              },
            },
          },
        },
      },
    });

    for (const fiscalizacao of fiscalizacoes) {
      const resumo = computeVistoriaNotas(fiscalizacao.respostas);
      map.set(fiscalizacao.unidadeId, {
        ...resumo,
        fiscalizacaoId: fiscalizacao.id,
        concluidaEm: fiscalizacao.concluidaEm?.toISOString() ?? null,
      });
    }

    return map;
  }
}
