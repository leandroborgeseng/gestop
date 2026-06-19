import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { resolveSecretariaScopeId } from '../auth/secretaria-scope';
import { PrismaService } from '../prisma/prisma.service';
import { ListFiscalizacoesQueryDto } from './fiscalizacoes.dto';

const listInclude = {
  secretaria: { select: { id: true, sigla: true, nome: true } },
  unidade: { select: { id: true, nome: true, codigoPatrimonial: true, bairro: true } },
  agente: { select: { id: true, nome: true } },
  checklistVersao: {
    select: {
      id: true,
      versao: true,
      checklist: { select: { id: true, nome: true } },
    },
  },
} satisfies Prisma.FiscalizacaoInclude;

@Injectable()
export class FiscalizacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListFiscalizacoesQueryDto, user: JwtPayload) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const where = this.buildWhere(query, user);

    const [items, total] = await Promise.all([
      this.prisma.fiscalizacao.findMany({
        where,
        orderBy: [{ concluidaEm: 'desc' }, { iniciadaEm: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        include: listInclude,
      }),
      this.prisma.fiscalizacao.count({ where }),
    ]);

    return {
      items: items.map((item) => this.serialize(item)),
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  async getById(id: string, user: JwtPayload) {
    const fiscalizacao = await this.prisma.fiscalizacao.findFirst({
      where: {
        id,
        ...this.scopeFilter(user),
      },
      include: {
        ...listInclude,
        respostas: {
          orderBy: { respondidoEm: 'asc' },
          include: {
            item: { select: { id: true, codigo: true, titulo: true, tipo: true } },
            naoConformidade: {
              select: {
                id: true,
                chamado: { select: { id: true, codigo: true } },
              },
            },
          },
        },
        evidencias: {
          orderBy: { capturadaEm: 'asc' },
          select: {
            id: true,
            tipo: true,
            url: true,
            mimeType: true,
            capturadaEm: true,
            metadata: true,
          },
        },
        naoConformidades: {
          select: {
            id: true,
            descricao: true,
            severidade: true,
            status: true,
            item: { select: { codigo: true, titulo: true } },
          },
        },
      },
    });

    if (!fiscalizacao) {
      throw new NotFoundException('Vistoria não encontrada.');
    }

    return {
      ...this.serialize(fiscalizacao),
      respostas: fiscalizacao.respostas.map((resposta) => ({
        ...resposta,
        valorNumero: resposta.valorNumero == null ? null : Number(resposta.valorNumero),
        respondidoEm: resposta.respondidoEm.toISOString(),
      })),
      evidencias: fiscalizacao.evidencias.map((evidencia) => ({
        ...evidencia,
        capturadaEm: evidencia.capturadaEm.toISOString(),
      })),
    };
  }

  private buildWhere(query: ListFiscalizacoesQueryDto, user: JwtPayload): Prisma.FiscalizacaoWhereInput {
    const scope = this.scopeFilter(user);
    const search = query.q?.trim();

    return {
      ...scope,
      ...(query.secretariaId ? { secretariaId: query.secretariaId } : {}),
      ...(query.unidadeId ? { unidadeId: query.unidadeId } : {}),
      ...(query.agenteId ? { agenteId: query.agenteId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            OR: [
              {
                concluidaEm: {
                  ...(query.from ? { gte: new Date(query.from) } : {}),
                  ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
                },
              },
              {
                AND: [
                  { concluidaEm: null },
                  {
                    iniciadaEm: {
                      ...(query.from ? { gte: new Date(query.from) } : {}),
                      ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
                    },
                  },
                ],
              },
            ],
          }
        : {}),
      ...(search
        ? {
            OR: [
              { unidade: { nome: { contains: search, mode: 'insensitive' } } },
              { unidade: { codigoPatrimonial: { contains: search, mode: 'insensitive' } } },
              { agente: { nome: { contains: search, mode: 'insensitive' } } },
              { checklistVersao: { checklist: { nome: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
  }

  private scopeFilter(user: JwtPayload): Prisma.FiscalizacaoWhereInput {
    const secretariaId = resolveSecretariaScopeId(user);
    return secretariaId ? { secretariaId } : {};
  }

  private serialize<T extends {
    distanciaCheckinMetros?: unknown;
    checkinLatitude?: unknown;
    checkinLongitude?: unknown;
    checkoutLatitude?: unknown;
    checkoutLongitude?: unknown;
    iniciadaEm?: Date | null;
    concluidaEm?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }>(fiscalizacao: T) {
    return {
      ...fiscalizacao,
      distanciaCheckinMetros:
        fiscalizacao.distanciaCheckinMetros == null ? null : Number(fiscalizacao.distanciaCheckinMetros),
      checkinLatitude: fiscalizacao.checkinLatitude == null ? null : Number(fiscalizacao.checkinLatitude),
      checkinLongitude: fiscalizacao.checkinLongitude == null ? null : Number(fiscalizacao.checkinLongitude),
      checkoutLatitude: fiscalizacao.checkoutLatitude == null ? null : Number(fiscalizacao.checkoutLatitude),
      checkoutLongitude: fiscalizacao.checkoutLongitude == null ? null : Number(fiscalizacao.checkoutLongitude),
      iniciadaEm: fiscalizacao.iniciadaEm?.toISOString() ?? null,
      concluidaEm: fiscalizacao.concluidaEm?.toISOString() ?? null,
      createdAt: fiscalizacao.createdAt?.toISOString(),
      updatedAt: fiscalizacao.updatedAt?.toISOString(),
    };
  }
}
