import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  ChamadoPrioridade,
  ChamadoStatus,
  FiscalizacaoStatus,
  NaoConformidadeStatus,
  Prisma,
  UnidadeTipo,
} from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import {
  resolveChamadoSecretariaFilter,
  resolveDirectSecretariaFilter,
  resolveSecretariaScopeIds,
  resolveUnidadeSecretariaFilter,
} from '../auth/secretaria-scope';
import { computeVistoriaNotas } from '../domain/vistoria-nota';
import { startOfDay } from '../cronograma/cronograma.rules';
import { PrismaService } from '../prisma/prisma.service';
import { CHAMADO_OPEN_STATUSES } from '../chamados/chamados.rules';
import {
  applyInMemoryUnidadeFilters,
  countPendenciasUnicas,
  DEFAULT_TIPOS_PENDENCIA,
  isChamadoForaPrazo,
  LEGACY_TIPOS_PENDENCIA,
  mapUnidadeOperacional,
  UnidadeBaseRecord,
} from './operacional.mapper';
import {
  ChamadoMapaItem,
  ChamadosMapaQuery,
  VistoriaAtrasadaResumo,
  TipoPendencia,
  UnidadeListQuery,
  UnidadeVistoriaNotaResumo,
} from './operacional.types';

/** Status de NC que ainda podem ser pendência (antes do filtro de chamado). */
const NON_CONFORMITY_CANDIDATE_STATUSES: NaoConformidadeStatus[] = [
  NaoConformidadeStatus.ABERTA,
  NaoConformidadeStatus.EM_TRIAGEM,
  NaoConformidadeStatus.CHAMADO_GERADO,
];

@Injectable()
export class OperacionalService {
  constructor(private readonly prisma: PrismaService) {}

  async getResumo(user: JwtPayload) {
    const scopeIds = resolveSecretariaScopeIds(user);
    const unidadeWhere = resolveUnidadeSecretariaFilter(user);
    const chamadoWhere = resolveChamadoSecretariaFilter(user);
    const fiscalizacaoWhere = resolveDirectSecretariaFilter(user);
    const ncWhere =
      !scopeIds
        ? {}
        : scopeIds.length === 0
          ? { id: { in: [] as string[] } }
          : scopeIds.length === 1
            ? { unidade: { secretariaId: scopeIds[0] } }
            : { unidade: { secretariaId: { in: scopeIds } } };

    const [
      unidadesAtivas,
      totalSecretarias,
      fiscalizacoesConcluidas,
      naoConformidadesAbertas,
      naoConformidadesSemChamadoAberto,
      chamadosAbertos,
      eventosSyncPendentes,
      vistoriasAtrasadas,
    ] = await Promise.all([
      this.prisma.unidadePublica.count({ where: { ...unidadeWhere, ativo: true } }),
      !scopeIds
        ? this.prisma.secretaria.count({ where: { ativo: true } })
        : scopeIds.length === 0
          ? Promise.resolve(0)
          : this.prisma.secretaria.count({ where: { id: { in: scopeIds }, ativo: true } }),
      this.prisma.fiscalizacao.count({ where: { ...fiscalizacaoWhere, status: 'CONCLUIDA' } }),
      this.prisma.naoConformidade.count({
        where: { ...ncWhere, ...this.buildNcPendenciaWhere() },
      }),
      // NC ainda sem chamado — evita somar a mesma pendência duas vezes (NC + chamado).
      this.prisma.naoConformidade.count({
        where: {
          ...ncWhere,
          status: { in: [NaoConformidadeStatus.ABERTA, NaoConformidadeStatus.EM_TRIAGEM] },
          chamado: { is: null },
        },
      }),
      this.prisma.chamado.count({
        where: { ...chamadoWhere, status: { in: CHAMADO_OPEN_STATUSES } },
      }),
      this.prisma.offlineSyncEvent.count({
        where: { status: { in: ['PENDENTE', 'PROCESSANDO', 'CONFLITO', 'FALHOU'] } },
      }),
      // ID único de cada vistoria programada atrasada (não agrupar por próprio).
      this.prisma.cronogramaChecagem.count({
        where: {
          ativo: true,
          proximaChecagemEm: { lt: startOfDay(new Date()) },
          unidade: { ...unidadeWhere, ativo: true },
        },
      }),
    ]);

    // Total único: NC sem chamado + chamados abertos + vistorias atrasadas.
    // SLA fora do prazo é só classificação visual e NÃO entra nesta soma.
    const totalPendencias = countPendenciasUnicas(
      {
        chamadosAbertos,
        naoConformidadesSemChamadoAberto,
        vistoriasAtrasadas,
      },
      DEFAULT_TIPOS_PENDENCIA,
    );

    return {
      totalUnidades: unidadesAtivas,
      unidadesAtivas,
      totalSecretarias,
      fiscalizacoesConcluidas,
      naoConformidadesAbertas,
      chamadosAbertos,
      vistoriasAtrasadas,
      totalPendencias,
      eventosSyncPendentes,
    };
  }

  async listSecretarias(user: JwtPayload) {
    const scopeIds = resolveSecretariaScopeIds(user);
    if (scopeIds && scopeIds.length === 0) return [];
    return this.prisma.secretaria.findMany({
      where: {
        ativo: true,
        ...(scopeIds ? { id: scopeIds.length === 1 ? scopeIds[0] : { in: scopeIds } } : {}),
      },
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
    const scopeIds = resolveSecretariaScopeIds(user);
    const secretariaIdFilter =
      !scopeIds ? {} : scopeIds.length === 1 ? { id: scopeIds[0] } : { id: { in: scopeIds } };
    const equipeScope = resolveDirectSecretariaFilter(user);
    const [secretarias, bairros, tiposRows, responsaveisRows, regioesRows, categoriasVistoria, equipes, tiposChamado] =
      await Promise.all([
        scopeIds && scopeIds.length === 0
          ? Promise.resolve([])
          : this.prisma.secretaria.findMany({
              where: {
                ativo: true,
                unidades: { some: { ativo: true } },
                ...secretariaIdFilter,
              },
              orderBy: { nome: 'asc' },
              select: { id: true, nome: true, sigla: true },
            }),
        this.listBairros(),
        this.prisma.unidadePublica.findMany({
          where: { ativo: true, ...resolveUnidadeSecretariaFilter(user) },
          distinct: ['tipo'],
          orderBy: { tipo: 'asc' },
          select: { tipo: true },
        }),
        scopeIds && scopeIds.length === 0
          ? Promise.resolve([])
          : this.prisma.secretaria.findMany({
              where: {
                ativo: true,
                unidades: { some: { ativo: true } },
                OR: [{ responsavelNome: { not: null } }, { responsavelEmail: { not: null } }],
                ...secretariaIdFilter,
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
          where: { ativo: true, regiao: { not: null }, ...resolveUnidadeSecretariaFilter(user) },
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
          where: { ativo: true, ...equipeScope },
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
    const scopeIds = resolveSecretariaScopeIds(user);
    if (scopeIds && scopeIds.length === 0) {
      return [];
    }
    const effectiveQuery =
      scopeIds && scopeIds.length === 1 ? { ...query, secretariaId: scopeIds[0] } : query;
    const tiposPendencia = this.resolveTiposPendencia(query.tiposPendencia);
    const usesChamados = tiposPendencia.includes('CHAMADOS');
    const usesNc = tiposPendencia.includes('NAO_CONFORMIDADES');
    const usesVistorias = tiposPendencia.includes('VISTORIAS');
    const tiposChamadoId = usesChamados && query.tiposChamadoId?.length ? query.tiposChamadoId : undefined;
    const equipeIds = query.equipeIds?.length ? query.equipeIds : undefined;
    // Equipe/SLA olham chamados abertos independente do chip de tipo de pendência.
    const chamadoWhere = this.buildChamadoPendenciaWhere({ tiposChamadoId, equipeIds });

    const where: Prisma.UnidadePublicaWhereInput = {
      ...this.buildUnidadeWhere(effectiveQuery),
      ...(scopeIds && scopeIds.length > 1 ? { secretariaId: { in: scopeIds } } : {}),
    };
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
    const vistoriasAtrasadas = await this.loadVistoriasAtrasadasPorUnidade(unidades.map((unidade) => unidade.id));
    const ncsSemChamadoPorUnidade = await this.loadNcsSemChamadoCountPorUnidade(
      unidades.map((unidade) => unidade.id),
    );

    const mapped = unidades.map((unidade) => {
      const chamadosSlaForaPrazo = unidade.chamados.filter((chamado) =>
        isChamadoForaPrazo(chamado.prazoEm),
      ).length;
      const vistoriaAtrasada = vistoriasAtrasadas.get(unidade.id) ?? null;
      const semVistoria = vistoriaAtrasada !== null;
      const naoConformidadesSemChamadoAberto = ncsSemChamadoPorUnidade.get(unidade.id) ?? 0;
      const countsForSituacao = {
        fiscalizacoes: unidade._count.fiscalizacoes,
        naoConformidadesAbertas: usesNc ? unidade._count.naoConformidades : 0,
        naoConformidadesSemChamadoAberto: usesNc ? naoConformidadesSemChamadoAberto : 0,
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
          naoConformidadesSemChamadoAberto,
          chamadosAbertos: unidade._count.chamados,
          semVistoria,
          vistoriaAtrasada,
        },
        // Recalcula com totais reais (não mascarados pelo chip de tipo) + tipos ativos.
        pendenciasUnicas: countPendenciasUnicas(
          {
            chamadosAbertos: usesChamados ? unidade._count.chamados : 0,
            naoConformidadesSemChamadoAberto: usesNc ? naoConformidadesSemChamadoAberto : 0,
            vistoriasAtrasadas: usesVistorias && semVistoria ? 1 : 0,
          },
          tiposPendencia,
        ),
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
          orderBy: { registradaEm: 'desc' },
          take: 50,
          select: {
            id: true,
            descricao: true,
            severidade: true,
            status: true,
            registradaEm: true,
            resolvidaEm: true,
            motivoBaixa: true,
            baixadaEm: true,
            item: {
              select: {
                id: true,
                codigo: true,
                titulo: true,
              },
            },
            resposta: {
              select: {
                id: true,
                conformidade: true,
                valorTexto: true,
                valorBooleano: true,
                valorNumero: true,
                comentario: true,
              },
            },
            fiscalizacao: {
              select: {
                id: true,
                concluidaEm: true,
                iniciadaEm: true,
                checklistVersao: {
                  select: {
                    versao: true,
                    checklist: { select: { id: true, nome: true } },
                  },
                },
              },
            },
            evidencias: {
              orderBy: { capturadaEm: 'asc' },
              take: 8,
              select: {
                id: true,
                tipo: true,
                url: true,
                mimeType: true,
                capturadaEm: true,
              },
            },
            registradaPor: {
              select: { id: true, nome: true },
            },
            baixadaPor: {
              select: { id: true, nome: true },
            },
            chamado: {
              select: {
                id: true,
                codigo: true,
                status: true,
                prioridade: true,
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
            tipoChamado: { select: { id: true, nome: true } },
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
              where: this.buildNcPendenciaWhere(),
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
    const vistoriaAtrasada =
      (await this.loadVistoriasAtrasadasPorUnidade([id])).get(id) ?? null;
    const semVistoria = vistoriaAtrasada !== null;
    const naoConformidadesSemChamadoAberto =
      (await this.loadNcsSemChamadoCountPorUnidade([id])).get(id) ?? 0;

    const resumo = mapUnidadeOperacional(
      unidade as UnidadeBaseRecord,
      {
        fiscalizacoes: unidade._count.fiscalizacoes,
        naoConformidadesAbertas: unidade._count.naoConformidades,
        naoConformidadesSemChamadoAberto,
        chamadosAbertos: unidade._count.chamados,
        chamadosSlaForaPrazo,
        semVistoria,
      },
      (await this.loadUltimasNotasPorUnidade([id])).get(id) ?? null,
      LEGACY_TIPOS_PENDENCIA,
    );

    return {
      ...resumo,
      pendencias: {
        ...resumo.pendencias,
        naoConformidadesSemChamadoAberto,
        semVistoria,
        vistoriaAtrasada,
      },
      pendenciasUnicas: countPendenciasUnicas(
        {
          chamadosAbertos: unidade._count.chamados,
          naoConformidadesSemChamadoAberto,
          vistoriasAtrasadas: semVistoria ? 1 : 0,
        },
        LEGACY_TIPOS_PENDENCIA,
      ),
      secretaria: unidade.secretaria,
      ultimasFiscalizacoes: unidade.fiscalizacoes.map((fiscalizacao) => ({
        ...fiscalizacao,
        distanciaCheckinMetros:
          fiscalizacao.distanciaCheckinMetros === null
            ? null
            : Number(fiscalizacao.distanciaCheckinMetros),
      })),
      pendenciasDetalhadas: {
        naoConformidades: unidade.naoConformidades.map((nc) => this.serializeNaoConformidadeDetalhe(nc)),
        chamados: unidade.chamados,
      },
    };
  }

  async listChamadosParaVincularNc(
    unidadeId: string,
    user: JwtPayload,
    filters?: { search?: string; status?: string; tipoChamadoId?: string },
  ) {
    const scope = resolveUnidadeSecretariaFilter(user);
    const unidade = await this.prisma.unidadePublica.findFirst({
      where: { id: unidadeId, ...scope },
      select: { id: true },
    });
    if (!unidade) {
      throw new NotFoundException('Próprio não encontrado.');
    }

    const search = filters?.search?.trim();
    const statusFilter = filters?.status?.trim() as ChamadoStatus | undefined;
    const chamados = await this.prisma.chamado.findMany({
      where: {
        unidadeId,
        naoConformidadeId: null,
        ...(statusFilter ? { status: statusFilter } : { status: { in: CHAMADO_OPEN_STATUSES } }),
        ...(filters?.tipoChamadoId ? { tipoChamadoId: filters.tipoChamadoId } : {}),
        ...(search
          ? {
              OR: [
                { codigo: { contains: search, mode: 'insensitive' } },
                { titulo: { contains: search, mode: 'insensitive' } },
                { descricao: { contains: search, mode: 'insensitive' } },
                { tipoChamado: { nome: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 40,
      select: {
        id: true,
        codigo: true,
        titulo: true,
        descricao: true,
        status: true,
        prioridade: true,
        createdAt: true,
        tipoChamado: { select: { id: true, nome: true } },
      },
    });

    return {
      items: chamados.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async vincularChamadoNc(naoConformidadeId: string, chamadoId: string, user: JwtPayload) {
    const nc = await this.prisma.naoConformidade.findUnique({
      where: { id: naoConformidadeId },
      include: {
        chamado: true,
        unidade: { select: { id: true, secretariaId: true } },
      },
    });
    if (!nc) {
      throw new NotFoundException('Não conformidade não encontrada.');
    }
    this.assertUnidadeInScope(nc.unidade.secretariaId, user);

    if (nc.status === NaoConformidadeStatus.BAIXADA_MANUAL || nc.status === NaoConformidadeStatus.RESOLVIDA) {
      throw new BadRequestException('Não conformidade já encerrada.');
    }
    if (nc.chamado) {
      throw new BadRequestException('Não conformidade já possui chamado vinculado.');
    }

    const chamado = await this.prisma.chamado.findUnique({
      where: { id: chamadoId },
      select: {
        id: true,
        codigo: true,
        unidadeId: true,
        naoConformidadeId: true,
        status: true,
      },
    });
    if (!chamado) {
      throw new NotFoundException('Chamado não encontrado.');
    }
    if (chamado.unidadeId !== nc.unidadeId) {
      throw new BadRequestException('O chamado deve pertencer ao mesmo próprio da NC.');
    }
    if (chamado.naoConformidadeId) {
      throw new BadRequestException('Chamado já vinculado a outra não conformidade.');
    }
    if (chamado.status === ChamadoStatus.CONCLUIDO || chamado.status === ChamadoStatus.CANCELADO) {
      throw new BadRequestException('Não é possível vincular a chamado concluído ou cancelado.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.chamado.update({
        where: { id: chamado.id },
        data: { naoConformidadeId: nc.id },
      });
      await tx.evidencia.updateMany({
        where: { naoConformidadeId: nc.id },
        data: { chamadoId: chamado.id },
      });
      const ncUpdated = await tx.naoConformidade.update({
        where: { id: nc.id },
        data: { status: NaoConformidadeStatus.CHAMADO_GERADO },
        include: {
          chamado: { select: { id: true, codigo: true, status: true } },
          item: { select: { codigo: true, titulo: true } },
        },
      });
      await tx.logAuditoria.create({
        data: {
          usuarioId: user.sub,
          acao: AuditAction.UPDATE,
          entidadeTipo: 'NaoConformidade',
          entidadeId: nc.id,
          valorAntigo: { status: nc.status, chamadoId: null } as Prisma.InputJsonValue,
          valorNovo: {
            status: NaoConformidadeStatus.CHAMADO_GERADO,
            chamadoId: chamado.id,
            chamadoCodigo: chamado.codigo,
          } as Prisma.InputJsonValue,
        },
      });
      await tx.historicoStatus.create({
        data: {
          entidadeTipo: 'NaoConformidade',
          entidadeId: nc.id,
          statusAnterior: nc.status,
          statusNovo: NaoConformidadeStatus.CHAMADO_GERADO,
          motivo: `Vinculada ao chamado ${chamado.codigo}.`,
          alteradoPorId: user.sub,
          metadata: { chamadoId: chamado.id },
        },
      });
      return ncUpdated;
    });

    return updated;
  }

  async baixarNaoConformidade(naoConformidadeId: string, motivo: string, user: JwtPayload) {
    const justificativa = motivo?.trim();
    if (!justificativa) {
      throw new BadRequestException('Informe a justificativa da baixa.');
    }

    const nc = await this.prisma.naoConformidade.findUnique({
      where: { id: naoConformidadeId },
      include: {
        chamado: { select: { id: true, codigo: true, status: true } },
        unidade: { select: { id: true, secretariaId: true } },
      },
    });
    if (!nc) {
      throw new NotFoundException('Não conformidade não encontrada.');
    }
    this.assertUnidadeInScope(nc.unidade.secretariaId, user);

    if (
      nc.status === NaoConformidadeStatus.BAIXADA_MANUAL ||
      nc.status === NaoConformidadeStatus.RESOLVIDA ||
      nc.status === NaoConformidadeStatus.CANCELADA
    ) {
      throw new BadRequestException('Não conformidade já encerrada.');
    }

    if (nc.chamado && CHAMADO_OPEN_STATUSES.includes(nc.chamado.status as (typeof CHAMADO_OPEN_STATUSES)[number])) {
      throw new BadRequestException(
        `NC vinculada ao chamado ${nc.chamado.codigo} em andamento. Conclua o chamado ou desvincule antes da baixa manual.`,
      );
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const ncUpdated = await tx.naoConformidade.update({
        where: { id: nc.id },
        data: {
          status: NaoConformidadeStatus.BAIXADA_MANUAL,
          motivoBaixa: justificativa,
          baixadaEm: now,
          baixadaPorId: user.sub,
          resolvidaEm: now,
        },
        include: {
          baixadaPor: { select: { id: true, nome: true } },
          item: { select: { codigo: true, titulo: true } },
        },
      });
      await tx.logAuditoria.create({
        data: {
          usuarioId: user.sub,
          acao: AuditAction.STATUS_CHANGE,
          entidadeTipo: 'NaoConformidade',
          entidadeId: nc.id,
          valorAntigo: { status: nc.status } as Prisma.InputJsonValue,
          valorNovo: {
            status: NaoConformidadeStatus.BAIXADA_MANUAL,
            motivoBaixa: justificativa,
          } as Prisma.InputJsonValue,
        },
      });
      await tx.historicoStatus.create({
        data: {
          entidadeTipo: 'NaoConformidade',
          entidadeId: nc.id,
          statusAnterior: nc.status,
          statusNovo: NaoConformidadeStatus.BAIXADA_MANUAL,
          motivo: justificativa,
          alteradoPorId: user.sub,
        },
      });
      return ncUpdated;
    });

    return updated;
  }

  private assertUnidadeInScope(secretariaId: string, user: JwtPayload) {
    const scopeIds = resolveSecretariaScopeIds(user);
    if (scopeIds && !scopeIds.includes(secretariaId)) {
      throw new NotFoundException('Próprio não encontrado.');
    }
  }

  private serializeNaoConformidadeDetalhe(nc: {
    id: string;
    descricao: string;
    severidade: string;
    status: NaoConformidadeStatus;
    registradaEm: Date;
    resolvidaEm: Date | null;
    motivoBaixa: string | null;
    baixadaEm: Date | null;
    item: { id: string; codigo: string; titulo: string };
    resposta: {
      id: string;
      conformidade: string | null;
      valorTexto: string | null;
      valorBooleano: boolean | null;
      valorNumero: Prisma.Decimal | number | null;
      comentario: string | null;
    };
    fiscalizacao: {
      id: string;
      concluidaEm: Date | null;
      iniciadaEm: Date | null;
      checklistVersao: {
        versao: number;
        checklist: { id: string; nome: string };
      };
    };
    evidencias: Array<{
      id: string;
      tipo: string;
      url: string;
      mimeType: string | null;
      capturadaEm: Date;
    }>;
    registradaPor: { id: string; nome: string };
    baixadaPor: { id: string; nome: string } | null;
    chamado: {
      id: string;
      codigo: string;
      status: string;
      prioridade: string;
      titulo: string | null;
    } | null;
  }) {
    const chamadoAberto =
      nc.chamado != null &&
      CHAMADO_OPEN_STATUSES.includes(nc.chamado.status as (typeof CHAMADO_OPEN_STATUSES)[number]);
    let situacaoVisual: 'ABERTA' | 'VINCULADA_EM_ANDAMENTO' | 'RESOLVIDA_CHAMADO' | 'BAIXADA_MANUAL' | 'ENCERRADA';
    if (nc.status === NaoConformidadeStatus.BAIXADA_MANUAL) {
      situacaoVisual = 'BAIXADA_MANUAL';
    } else if (nc.status === NaoConformidadeStatus.RESOLVIDA) {
      situacaoVisual = 'RESOLVIDA_CHAMADO';
    } else if (nc.chamado && chamadoAberto) {
      situacaoVisual = 'VINCULADA_EM_ANDAMENTO';
    } else if (nc.chamado && !chamadoAberto) {
      situacaoVisual = 'RESOLVIDA_CHAMADO';
    } else if (
      nc.status === NaoConformidadeStatus.ABERTA ||
      nc.status === NaoConformidadeStatus.EM_TRIAGEM
    ) {
      situacaoVisual = 'ABERTA';
    } else {
      situacaoVisual = 'ENCERRADA';
    }

    const pendenteAtiva =
      situacaoVisual === 'ABERTA' || situacaoVisual === 'VINCULADA_EM_ANDAMENTO';

    return {
      id: nc.id,
      descricao: nc.descricao,
      severidade: nc.severidade,
      status: nc.status,
      situacaoVisual,
      pendenteAtiva,
      registradaEm: nc.registradaEm.toISOString(),
      resolvidaEm: nc.resolvidaEm?.toISOString() ?? null,
      motivoBaixa: nc.motivoBaixa,
      baixadaEm: nc.baixadaEm?.toISOString() ?? null,
      dataVistoria:
        nc.fiscalizacao.concluidaEm?.toISOString() ??
        nc.fiscalizacao.iniciadaEm?.toISOString() ??
        nc.registradaEm.toISOString(),
      checklist: {
        id: nc.fiscalizacao.checklistVersao.checklist.id,
        nome: nc.fiscalizacao.checklistVersao.checklist.nome,
        versao: nc.fiscalizacao.checklistVersao.versao,
      },
      fiscalizacaoId: nc.fiscalizacao.id,
      item: nc.item,
      resposta: {
        ...nc.resposta,
        valorNumero: nc.resposta.valorNumero == null ? null : Number(nc.resposta.valorNumero),
      },
      evidencias: nc.evidencias.map((ev) => ({
        ...ev,
        capturadaEm: ev.capturadaEm.toISOString(),
      })),
      registradaPor: nc.registradaPor,
      baixadaPor: nc.baixadaPor,
      chamado: nc.chamado,
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
      status: { in: NON_CONFORMITY_CANDIDATE_STATUSES },
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

  private async loadNcsSemChamadoCountPorUnidade(unidadeIds: string[]) {
    const map = new Map<string, number>();
    if (unidadeIds.length === 0) return map;

    const rows = await this.prisma.naoConformidade.groupBy({
      by: ['unidadeId'],
      where: {
        unidadeId: { in: unidadeIds },
        status: { in: [NaoConformidadeStatus.ABERTA, NaoConformidadeStatus.EM_TRIAGEM] },
        chamado: { is: null },
      },
      _count: { _all: true },
    });

    for (const row of rows) {
      map.set(row.unidadeId, row._count._all);
    }
    return map;
  }

  private async loadVistoriasAtrasadasPorUnidade(unidadeIds: string[]) {
    const map = new Map<string, VistoriaAtrasadaResumo>();
    if (unidadeIds.length === 0) return map;

    // Alinhado a resolveEventoTipo do cronograma: atrasada = próxima data < início do dia de hoje.
    const hoje = startOfDay(new Date());
    const atrasados = await this.prisma.cronogramaChecagem.findMany({
      where: {
        ativo: true,
        unidadeId: { in: unidadeIds },
        proximaChecagemEm: { lt: hoje },
      },
      orderBy: { proximaChecagemEm: 'asc' },
      select: {
        unidadeId: true,
        proximaChecagemEm: true,
        checklist: { select: { nome: true } },
      },
    });

    for (const item of atrasados) {
      if (map.has(item.unidadeId)) continue;
      map.set(item.unidadeId, {
        proximaChecagemEm: item.proximaChecagemEm.toISOString(),
        checklistNome: item.checklist.nome,
      });
    }

    return map;
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
