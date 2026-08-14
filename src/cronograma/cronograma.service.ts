import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, CronogramaFrequencia, Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import {
  assertSecretariaNoEscopo,
  resolveSecretariaScopeIds,
  resolveUnidadeSecretariaFilter,
} from '../auth/secretaria-scope';
import { checklistAppliesToUnidade } from '../checklists/checklist-matching';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarioQueryDto, CronogramaDto } from './cronograma.dto';
import {
  addFrequency,
  CalendarioEventoTipo,
  projectChecagensNoPeriodo,
  resolveEventoTipo,
  startOfDay,
  toDateKey,
} from './cronograma.rules';

type CalendarioEvento = {
  id: string;
  tipo: CalendarioEventoTipo;
  data: string;
  unidade: {
    id: string;
    nome: string;
    secretariaSigla: string;
  };
  checklist: {
    id: string;
    nome: string;
  };
  cronogramaId?: string;
  fiscalizacaoId?: string;
  frequencia?: CronogramaFrequencia;
  responsavelNome?: string | null;
  responsaveisNomes?: string[];
  agenteNome?: string;
};

const cronogramaInclude = {
  unidade: {
    select: {
      id: true,
      nome: true,
      tipo: true,
      secretariaId: true,
      secretaria: { select: { id: true, nome: true, sigla: true } },
    },
  },
  checklist: { select: { id: true, nome: true, escopo: true, unidadeTipo: true } },
  responsavel: { select: { id: true, nome: true, email: true } },
  responsaveis: {
    include: {
      usuario: { select: { id: true, nome: true, email: true, ativo: true } },
    },
  },
} satisfies Prisma.CronogramaChecagemInclude;

function formatResponsaveis(
  responsaveis: Array<{ usuario: { id: string; nome: string; email: string } }>,
  legacy?: { id: string; nome: string; email: string } | null,
) {
  const fromJunction = responsaveis.map((item) => item.usuario);
  if (fromJunction.length > 0) return fromJunction;
  return legacy ? [legacy] : [];
}

function responsaveisLabel(
  responsaveis: Array<{ usuario: { id: string; nome: string; email: string } }>,
  legacy?: { id: string; nome: string; email: string } | null,
) {
  const users = formatResponsaveis(responsaveis, legacy);
  if (!users.length) return null;
  return users.map((user) => user.nome).join(', ');
}

@Injectable()
export class CronogramaService {
  constructor(private readonly prisma: PrismaService) {}

  listChecklistsParaCronograma(user: JwtPayload) {
    const scopeIds = resolveSecretariaScopeIds(user);
    return this.prisma.checklist.findMany({
      where: {
        ativo: true,
        ...(scopeIds
          ? scopeIds.length === 0
            ? { id: { in: [] } }
            : {
                OR: [{ secretariaId: null }, { secretariaId: { in: scopeIds } }],
              }
          : {}),
      },
      orderBy: [{ nome: 'asc' }],
      include: {
        secretaria: { select: { id: true, nome: true, sigla: true } },
        tiposChamado: {
          include: { tipoChamado: { select: { id: true, nome: true, ativo: true } } },
        },
        versoes: {
          orderBy: { versao: 'desc' as const },
          take: 1,
          select: { id: true, versao: true, status: true },
        },
      },
    });
  }

  listCronogramas(filters: { secretariaId?: string; unidadeId?: string } | undefined, user: JwtPayload) {
    const secretariaId = this.resolveFiltroSecretaria(user, filters?.secretariaId);
    return this.prisma.cronogramaChecagem.findMany({
      where: {
        unidade: {
          ...resolveUnidadeSecretariaFilter(user),
          ...(secretariaId ? { secretariaId } : {}),
        },
        ...(filters?.unidadeId ? { unidadeId: filters.unidadeId } : {}),
      },
      orderBy: [{ ativo: 'desc' }, { proximaChecagemEm: 'asc' }],
      include: cronogramaInclude,
    });
  }

  async createCronograma(dto: CronogramaDto, user: JwtPayload) {
    await this.assertVinculoValido(dto.unidadeId, dto.checklistId, user);
    const responsavelIds = await this.resolveResponsavelIds(dto);

    const proximaChecagemEm = startOfDay(new Date(dto.proximaChecagemEm));
    const cronograma = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cronogramaChecagem.create({
        data: {
          unidadeId: dto.unidadeId,
          checklistId: dto.checklistId,
          frequencia: dto.frequencia,
          proximaChecagemEm,
          responsavelId: responsavelIds[0] ?? null,
          ativo: dto.ativo ?? true,
          observacoes: dto.observacoes?.trim() || null,
        },
      });

      if (responsavelIds.length) {
        await tx.cronogramaChecagemResponsavel.createMany({
          data: responsavelIds.map((usuarioId) => ({
            cronogramaId: created.id,
            usuarioId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.cronogramaChecagem.findUniqueOrThrow({
        where: { id: created.id },
        include: cronogramaInclude,
      });
    });

    await this.audit(user, AuditAction.CREATE, cronograma.id, null, this.auditSnapshot(cronograma, user));
    return cronograma;
  }

  async updateCronograma(id: string, dto: CronogramaDto, user: JwtPayload) {
    const before = await this.getCronogramaOrThrow(id, user);
    await this.assertVinculoValido(dto.unidadeId, dto.checklistId, user);
    const responsavelIds = await this.resolveResponsavelIds(dto);

    const cronograma = await this.prisma.$transaction(async (tx) => {
      await tx.cronogramaChecagem.update({
        where: { id },
        data: {
          unidadeId: dto.unidadeId,
          checklistId: dto.checklistId,
          frequencia: dto.frequencia,
          proximaChecagemEm: startOfDay(new Date(dto.proximaChecagemEm)),
          responsavelId: responsavelIds[0] ?? null,
          ativo: dto.ativo ?? true,
          observacoes: dto.observacoes?.trim() || null,
        },
      });

      await tx.cronogramaChecagemResponsavel.deleteMany({ where: { cronogramaId: id } });
      if (responsavelIds.length) {
        await tx.cronogramaChecagemResponsavel.createMany({
          data: responsavelIds.map((usuarioId) => ({
            cronogramaId: id,
            usuarioId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.cronogramaChecagem.findUniqueOrThrow({
        where: { id },
        include: cronogramaInclude,
      });
    });

    await this.audit(
      user,
      AuditAction.UPDATE,
      id,
      this.auditSnapshot(before, user),
      this.auditSnapshot(cronograma, user),
    );
    return cronograma;
  }

  async deactivateCronograma(id: string, user: JwtPayload) {
    const before = await this.getCronogramaOrThrow(id, user);
    const cronograma = await this.prisma.cronogramaChecagem.update({
      where: { id },
      data: { ativo: false },
      include: cronogramaInclude,
    });

    await this.audit(
      user,
      AuditAction.DELETE,
      id,
      this.auditSnapshot(before, user),
      this.auditSnapshot(cronograma, user),
    );
    return cronograma;
  }

  async getCalendario(query: CalendarioQueryDto, user: JwtPayload) {
    const from = startOfDay(new Date(query.from));
    const to = startOfDay(new Date(query.to));

    if (from > to) {
      throw new BadRequestException('Periodo invalido: data inicial posterior a final.');
    }

    const hoje = startOfDay(new Date());
    const realizedKeys = new Set<string>();
    const secretariaId = this.resolveFiltroSecretaria(user, query.secretariaId);
    const unidadeScope = resolveUnidadeSecretariaFilter(user);

    const cronogramas = await this.prisma.cronogramaChecagem.findMany({
      where: {
        ativo: true,
        ...(query.unidadeId ? { unidadeId: query.unidadeId } : {}),
        unidade: {
          ...unidadeScope,
          ...(secretariaId ? { secretariaId } : {}),
        },
      },
      include: cronogramaInclude,
    });

    const fiscalizacoes = await this.prisma.fiscalizacao.findMany({
      where: {
        status: 'CONCLUIDA',
        concluidaEm: { gte: from, lte: new Date(to.getTime() + 86_399_999) },
        ...(query.unidadeId ? { unidadeId: query.unidadeId } : {}),
        ...(secretariaId
          ? { secretariaId }
          : (() => {
              const ids = resolveSecretariaScopeIds(user);
              if (!ids) return {};
              if (ids.length === 0) return { id: { in: [] as string[] } };
              return ids.length === 1 ? { secretariaId: ids[0] } : { secretariaId: { in: ids } };
            })()),
      },
      select: {
        id: true,
        concluidaEm: true,
        realizadaPorNome: true,
        unidade: { select: { id: true, nome: true, secretaria: { select: { sigla: true } } } },
        checklistVersao: {
          select: {
            checklist: { select: { id: true, nome: true } },
          },
        },
        agente: { select: { id: true, nome: true } },
      },
      orderBy: { concluidaEm: 'asc' },
    });

    const eventos: CalendarioEvento[] = fiscalizacoes.flatMap((fiscalizacao) => {
      if (!fiscalizacao.concluidaEm) return [];
      const data = startOfDay(fiscalizacao.concluidaEm);
      const checklist = fiscalizacao.checklistVersao.checklist;
      realizedKeys.add(`${checklist.id}:${fiscalizacao.unidade.id}:${toDateKey(data)}`);

      return [
        {
          id: `realizada-${fiscalizacao.id}`,
          tipo: 'REALIZADA' as const,
          data: toDateKey(data),
          unidade: {
            id: fiscalizacao.unidade.id,
            nome: fiscalizacao.unidade.nome,
            secretariaSigla: fiscalizacao.unidade.secretaria.sigla,
          },
          checklist: { id: checklist.id, nome: checklist.nome },
          fiscalizacaoId: fiscalizacao.id,
          agenteNome: fiscalizacao.realizadaPorNome?.trim() || fiscalizacao.agente.nome,
        },
      ];
    });

    for (const cronograma of cronogramas) {
      const projected = projectChecagensNoPeriodo({
        proximaChecagemEm: cronograma.proximaChecagemEm,
        frequencia: cronograma.frequencia,
        from,
        to,
      });

      for (const date of projected) {
        const dataKey = toDateKey(date);
        const dedupeKey = `${cronograma.checklistId}:${cronograma.unidadeId}:${dataKey}`;
        if (realizedKeys.has(dedupeKey)) {
          continue;
        }

        const tipo = resolveEventoTipo(date, hoje);
        const nomes = formatResponsaveis(cronograma.responsaveis, cronograma.responsavel).map(
          (item) => item.nome,
        );
        eventos.push({
          id: `agendada-${cronograma.id}-${dataKey}`,
          tipo,
          data: dataKey,
          unidade: {
            id: cronograma.unidade.id,
            nome: cronograma.unidade.nome,
            secretariaSigla: cronograma.unidade.secretaria.sigla,
          },
          checklist: { id: cronograma.checklist.id, nome: cronograma.checklist.nome },
          cronogramaId: cronograma.id,
          frequencia: cronograma.frequencia,
          responsavelNome: responsaveisLabel(cronograma.responsaveis, cronograma.responsavel),
          responsaveisNomes: nomes,
          fiscalizacaoId: undefined,
          agenteNome: undefined,
        });
      }
    }

    eventos.sort((a, b) => a.data.localeCompare(b.data) || a.unidade.nome.localeCompare(b.unidade.nome));

    const resumo = {
      total: eventos.length,
      agendadas: eventos.filter((evento) => evento.tipo === 'AGENDADA').length,
      realizadas: eventos.filter((evento) => evento.tipo === 'REALIZADA').length,
      atrasadas: eventos.filter((evento) => evento.tipo === 'ATRASADA').length,
    };

    return { from: toDateKey(from), to: toDateKey(to), resumo, eventos };
  }

  async listVistoriasProgramadas(
    query: {
      from?: string;
      to?: string;
      atribuidoAMim?: boolean;
      tipo?: string;
      unidadeId?: string;
      incluirRealizadas?: boolean;
    },
    user: JwtPayload,
  ) {
    const hoje = startOfDay(new Date());
    const hasPeriod = Boolean(query.from?.trim() && query.to?.trim());
    const from = hasPeriod ? startOfDay(new Date(query.from!)) : new Date(hoje.getTime() - 365 * 86_400_000);
    const to = hasPeriod ? startOfDay(new Date(query.to!)) : new Date(hoje.getTime() + 365 * 86_400_000);
    if (from > to) {
      throw new BadRequestException('Periodo invalido: data inicial posterior a final.');
    }

    const unidadeScope = resolveUnidadeSecretariaFilter(user);
    const cronogramas = await this.prisma.cronogramaChecagem.findMany({
      where: {
        ativo: true,
        ...(query.unidadeId ? { unidadeId: query.unidadeId } : {}),
        ...(query.tipo ? { unidade: { ...unidadeScope, tipo: query.tipo } } : { unidade: unidadeScope }),
        ...(query.atribuidoAMim
          ? {
              OR: [{ responsavelId: user.sub }, { responsaveis: { some: { usuarioId: user.sub } } }],
            }
          : {}),
      },
      include: {
        unidade: {
          select: {
            id: true,
            nome: true,
            tipo: true,
            endereco: true,
            bairro: true,
            latitude: true,
            longitude: true,
            secretariaId: true,
            secretaria: { select: { id: true, nome: true, sigla: true } },
          },
        },
        checklist: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true, email: true } },
        responsaveis: {
          include: { usuario: { select: { id: true, nome: true, email: true, ativo: true } } },
        },
      },
    });

    const realizedKeys = new Set<string>();
    if (!query.incluirRealizadas) {
      const fiscalizacoes = await this.prisma.fiscalizacao.findMany({
        where: {
          status: 'CONCLUIDA',
          concluidaEm: { gte: from, lte: new Date(to.getTime() + 86_399_999) },
          unidadeId: { in: cronogramas.map((item) => item.unidadeId) },
        },
        select: {
          unidadeId: true,
          concluidaEm: true,
          checklistVersao: { select: { checklistId: true } },
        },
      });
      for (const item of fiscalizacoes) {
        if (!item.concluidaEm) continue;
        realizedKeys.add(
          `${item.checklistVersao.checklistId}:${item.unidadeId}:${toDateKey(startOfDay(item.concluidaEm))}`,
        );
      }
    }

    const items = [];
    for (const cronograma of cronogramas) {
      const dates = projectChecagensNoPeriodo({
        proximaChecagemEm: cronograma.proximaChecagemEm,
        frequencia: cronograma.frequencia,
        from,
        to,
      });

      for (const date of dates) {
        const dataKey = toDateKey(date);
        if (realizedKeys.has(`${cronograma.checklistId}:${cronograma.unidadeId}:${dataKey}`)) {
          continue;
        }
        const tipo = resolveEventoTipo(date, hoje);
        if (!query.incluirRealizadas && tipo === 'REALIZADA') continue;
        const responsaveis = formatResponsaveis(cronograma.responsaveis, cronograma.responsavel);
        items.push({
          id: `${cronograma.id}:${dataKey}`,
          cronogramaId: cronograma.id,
          data: dataKey,
          tipo,
          frequencia: cronograma.frequencia,
          checklist: cronograma.checklist,
          unidade: {
            id: cronograma.unidade.id,
            nome: cronograma.unidade.nome,
            tipo: cronograma.unidade.tipo,
            endereco: cronograma.unidade.endereco,
            bairro: cronograma.unidade.bairro,
            latitude: cronograma.unidade.latitude != null ? Number(cronograma.unidade.latitude) : null,
            longitude: cronograma.unidade.longitude != null ? Number(cronograma.unidade.longitude) : null,
            secretaria: cronograma.unidade.secretaria,
          },
          responsaveis: responsaveis.map((item) => ({ id: item.id, nome: item.nome })),
        });
      }
    }

    items.sort((a, b) => a.data.localeCompare(b.data) || a.unidade.nome.localeCompare(b.unidade.nome));
    return { items };
  }

  async registrarChecagemRealizada(input: {
    unidadeId: string;
    checklistId: string;
    concluidaEm: Date;
  }) {
    const cronograma = await this.prisma.cronogramaChecagem.findUnique({
      where: {
        unidadeId_checklistId: {
          unidadeId: input.unidadeId,
          checklistId: input.checklistId,
        },
      },
    });

    if (!cronograma || !cronograma.ativo) {
      return null;
    }

    const concluidaEm = startOfDay(input.concluidaEm);
    return this.prisma.cronogramaChecagem.update({
      where: { id: cronograma.id },
      data: {
        ultimaChecagemEm: concluidaEm,
        proximaChecagemEm: addFrequency(concluidaEm, cronograma.frequencia),
      },
    });
  }

  private async resolveResponsavelIds(dto: CronogramaDto) {
    const rawIds = [
      ...(dto.responsavelIds ?? []),
      ...(dto.responsavelId ? [dto.responsavelId] : []),
    ];
    const uniqueIds = [...new Set(rawIds.map((id) => id.trim()).filter(Boolean))];
    if (!uniqueIds.length) return [];

    const users = await this.prisma.usuario.findMany({
      where: { id: { in: uniqueIds }, ativo: true },
      select: { id: true },
    });
    if (users.length !== uniqueIds.length) {
      throw new BadRequestException('Um ou mais responsaveis sao invalidos ou inativos.');
    }
    return uniqueIds;
  }

  private auditSnapshot(
    cronograma: Prisma.CronogramaChecagemGetPayload<{ include: typeof cronogramaInclude }>,
    user: JwtPayload,
  ) {
    const responsaveis = formatResponsaveis(cronograma.responsaveis, cronograma.responsavel);
    return {
      id: cronograma.id,
      unidadeId: cronograma.unidadeId,
      unidadeNome: cronograma.unidade.nome,
      secretariaId: cronograma.unidade.secretariaId,
      secretariaSigla: cronograma.unidade.secretaria.sigla,
      checklistId: cronograma.checklistId,
      checklistNome: cronograma.checklist.nome,
      frequencia: cronograma.frequencia,
      proximaChecagemEm: cronograma.proximaChecagemEm,
      ativo: cronograma.ativo,
      observacoes: cronograma.observacoes,
      responsavelIds: responsaveis.map((item) => item.id),
      responsaveisNomes: responsaveis.map((item) => item.nome),
      secretariaAtivaId: user.secretariaId ?? null,
      secretariaEscopoTodas: !user.secretariaId?.trim() && Boolean(user.acessoTodasSecretarias),
    };
  }

  private async getCronogramaOrThrow(id: string, user: JwtPayload) {
    const cronograma = await this.prisma.cronogramaChecagem.findFirst({
      where: {
        id,
        unidade: resolveUnidadeSecretariaFilter(user),
      },
      include: cronogramaInclude,
    });

    if (!cronograma) {
      throw new NotFoundException('Cronograma nao encontrado');
    }

    return cronograma;
  }

  private resolveFiltroSecretaria(user: JwtPayload, secretariaId?: string) {
    const requested = secretariaId?.trim();
    if (requested) {
      assertSecretariaNoEscopo(user, requested);
      return requested;
    }
    const scopeIds = resolveSecretariaScopeIds(user);
    if (scopeIds?.length === 1) return scopeIds[0];
    return undefined;
  }

  private async assertVinculoValido(unidadeId: string, checklistId: string, user: JwtPayload) {
    const [unidade, checklist] = await Promise.all([
      this.prisma.unidadePublica.findUnique({
        where: { id: unidadeId },
        select: { id: true, tipo: true, secretariaId: true, ativo: true },
      }),
      this.prisma.checklist.findUnique({
        where: { id: checklistId },
        select: { id: true, escopo: true, secretariaId: true, unidadeId: true, unidadeTipo: true, ativo: true },
      }),
    ]);

    if (!unidade || !unidade.ativo) {
      throw new BadRequestException('Proprio publico invalido ou inativo.');
    }

    assertSecretariaNoEscopo(user, unidade.secretariaId);

    if (!checklist || !checklist.ativo) {
      throw new BadRequestException('Checklist invalido ou inativo.');
    }

    if (
      !checklistAppliesToUnidade(checklist, {
        id: unidade.id,
        tipo: unidade.tipo,
        secretariaId: unidade.secretariaId,
      })
    ) {
      throw new BadRequestException('Checklist nao se aplica ao tipo ou secretaria deste proprio.');
    }
  }

  private audit(
    user: JwtPayload,
    acao: AuditAction,
    entidadeId: string,
    valorAntigo: unknown,
    valorNovo: unknown,
  ) {
    return this.prisma.logAuditoria.create({
      data: {
        usuarioId: user.sub,
        acao,
        entidadeTipo: 'CronogramaChecagem',
        entidadeId,
        valorAntigo:
          valorAntigo === null
            ? Prisma.JsonNull
            : (JSON.parse(JSON.stringify(valorAntigo)) as Prisma.InputJsonValue),
        valorNovo: JSON.parse(JSON.stringify(valorNovo)) as Prisma.InputJsonValue,
      },
    });
  }
}

export { CronogramaFrequencia };
