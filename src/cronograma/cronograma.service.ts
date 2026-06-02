import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, CronogramaFrequencia, Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
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
} satisfies Prisma.CronogramaChecagemInclude;

@Injectable()
export class CronogramaService {
  constructor(private readonly prisma: PrismaService) {}

  listCronogramas(filters?: { secretariaId?: string; unidadeId?: string }) {
    return this.prisma.cronogramaChecagem.findMany({
      where: {
        ...(filters?.unidadeId ? { unidadeId: filters.unidadeId } : {}),
        ...(filters?.secretariaId ? { unidade: { secretariaId: filters.secretariaId } } : {}),
      },
      orderBy: [{ ativo: 'desc' }, { proximaChecagemEm: 'asc' }],
      include: cronogramaInclude,
    });
  }

  async createCronograma(dto: CronogramaDto, user: JwtPayload) {
    await this.assertVinculoValido(dto.unidadeId, dto.checklistId);

    const proximaChecagemEm = startOfDay(new Date(dto.proximaChecagemEm));
    const cronograma = await this.prisma.cronogramaChecagem.create({
      data: {
        unidadeId: dto.unidadeId,
        checklistId: dto.checklistId,
        frequencia: dto.frequencia,
        proximaChecagemEm,
        responsavelId: dto.responsavelId || null,
        ativo: dto.ativo ?? true,
        observacoes: dto.observacoes?.trim() || null,
      },
      include: cronogramaInclude,
    });

    await this.audit(user, AuditAction.CREATE, cronograma.id, null, cronograma);
    return cronograma;
  }

  async updateCronograma(id: string, dto: CronogramaDto, user: JwtPayload) {
    const before = await this.getCronogramaOrThrow(id);
    await this.assertVinculoValido(dto.unidadeId, dto.checklistId);

    const cronograma = await this.prisma.cronogramaChecagem.update({
      where: { id },
      data: {
        unidadeId: dto.unidadeId,
        checklistId: dto.checklistId,
        frequencia: dto.frequencia,
        proximaChecagemEm: startOfDay(new Date(dto.proximaChecagemEm)),
        responsavelId: dto.responsavelId || null,
        ativo: dto.ativo ?? true,
        observacoes: dto.observacoes?.trim() || null,
      },
      include: cronogramaInclude,
    });

    await this.audit(user, AuditAction.UPDATE, id, before, cronograma);
    return cronograma;
  }

  async deactivateCronograma(id: string, user: JwtPayload) {
    const before = await this.getCronogramaOrThrow(id);
    const cronograma = await this.prisma.cronogramaChecagem.update({
      where: { id },
      data: { ativo: false },
      include: cronogramaInclude,
    });

    await this.audit(user, AuditAction.DELETE, id, before, cronograma);
    return cronograma;
  }

  async getCalendario(query: CalendarioQueryDto) {
    const from = startOfDay(new Date(query.from));
    const to = startOfDay(new Date(query.to));

    if (from > to) {
      throw new BadRequestException('Periodo invalido: data inicial posterior a final.');
    }

    const hoje = startOfDay(new Date());
    const realizedKeys = new Set<string>();

    const cronogramas = await this.prisma.cronogramaChecagem.findMany({
      where: {
        ativo: true,
        ...(query.unidadeId ? { unidadeId: query.unidadeId } : {}),
        ...(query.secretariaId ? { unidade: { secretariaId: query.secretariaId } } : {}),
      },
      include: cronogramaInclude,
    });

    const fiscalizacoes = await this.prisma.fiscalizacao.findMany({
      where: {
        status: 'CONCLUIDA',
        concluidaEm: { gte: from, lte: new Date(to.getTime() + 86_399_999) },
        ...(query.unidadeId ? { unidadeId: query.unidadeId } : {}),
        ...(query.secretariaId ? { secretariaId: query.secretariaId } : {}),
      },
      select: {
        id: true,
        concluidaEm: true,
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
          agenteNome: fiscalizacao.agente.nome,
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
          responsavelNome: cronograma.responsavel?.nome ?? null,
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

  private async getCronogramaOrThrow(id: string) {
    const cronograma = await this.prisma.cronogramaChecagem.findUnique({
      where: { id },
      include: cronogramaInclude,
    });

    if (!cronograma) {
      throw new NotFoundException('Cronograma nao encontrado');
    }

    return cronograma;
  }

  private async assertVinculoValido(unidadeId: string, checklistId: string) {
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
        valorAntigo: valorAntigo === null ? Prisma.JsonNull : (JSON.parse(JSON.stringify(valorAntigo)) as Prisma.InputJsonValue),
        valorNovo: JSON.parse(JSON.stringify(valorNovo)) as Prisma.InputJsonValue,
      },
    });
  }
}

export { CronogramaFrequencia };
