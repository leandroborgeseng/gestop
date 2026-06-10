import { Injectable } from '@nestjs/common';
import { ChamadoStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RelatorioFiltroDto } from './relatorios.dto';
import { buildCsv, formatIsoDate } from './relatorios.csv';
import { buildTablePdf } from './relatorios.pdf';

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  exportUnidades(secretariaId?: string) {
    return this.prisma.unidadePublica.findMany({
      where: {
        ...(secretariaId ? { secretariaId } : {}),
      },
      orderBy: [{ secretaria: { sigla: 'asc' } }, { nome: 'asc' }],
      include: {
        secretaria: { select: { sigla: true, nome: true } },
      },
    });
  }

  exportChamados(filtro: RelatorioFiltroDto) {
    return this.prisma.chamado.findMany({
      where: this.chamadoWhere(filtro),
      orderBy: { createdAt: 'desc' },
      include: {
        secretaria: { select: { sigla: true } },
        unidade: { select: { codigoPatrimonial: true, nome: true } },
        responsavel: { select: { nome: true } },
      },
    });
  }

  exportOrdensServico(filtro: RelatorioFiltroDto) {
    return this.exportChamados(filtro);
  }

  exportFiscalizacoes(filtro: RelatorioFiltroDto) {
    return this.prisma.fiscalizacao.findMany({
      where: this.fiscalizacaoWhere(filtro),
      orderBy: { iniciadaEm: 'desc' },
      include: {
        unidade: {
          select: {
            codigoPatrimonial: true,
            nome: true,
            secretaria: { select: { sigla: true } },
          },
        },
        agente: { select: { nome: true } },
      },
    });
  }

  unidadesCsv(secretariaId?: string) {
    const rows = this.exportUnidades(secretariaId);
    return rows.then((items) =>
      buildCsv(
        [
          'secretaria_sigla',
          'codigo_patrimonial',
          'nome',
          'tipo',
          'endereco',
          'bairro',
          'cep',
          'latitude',
          'longitude',
          'raio_validacao_metros',
          'ativo',
        ],
        items.map((item) => [
          item.secretaria.sigla,
          item.codigoPatrimonial,
          item.nome,
          item.tipo,
          item.endereco,
          item.bairro,
          item.cep,
          item.latitude,
          item.longitude,
          item.raioValidacaoMetros,
          item.ativo,
        ]),
      ),
    );
  }

  chamadosCsv(filtro: RelatorioFiltroDto) {
    return this.exportChamados(filtro).then((items) =>
      buildCsv(
        [
          'codigo',
          'status',
          'origem',
          'prioridade',
          'secretaria_sigla',
          'unidade_codigo',
          'unidade_nome',
          'titulo',
          'descricao',
          'responsavel',
          'prazo_em',
          'concluido_em',
          'criado_em',
          'encerrado_em',
        ],
        items.map((item) => [
          item.codigo,
          item.status,
          item.origem,
          item.prioridade,
          item.secretaria.sigla,
          item.unidade.codigoPatrimonial,
          item.unidade.nome,
          item.titulo ?? '',
          item.descricao,
          item.responsavel?.nome ?? '',
          formatIsoDate(item.prazoEm),
          formatIsoDate(item.concluidoEm),
          formatIsoDate(item.createdAt),
          formatIsoDate(item.encerradoEm),
        ]),
      ),
    );
  }

  ordensServicoCsv(filtro: RelatorioFiltroDto) {
    return this.chamadosCsv(filtro);
  }

  fiscalizacoesCsv(filtro: RelatorioFiltroDto) {
    return this.exportFiscalizacoes(filtro).then((items) =>
      buildCsv(
        [
          'id',
          'status',
          'origem',
          'secretaria_sigla',
          'unidade_codigo',
          'unidade_nome',
          'agente',
          'iniciada_em',
          'concluida_em',
          'dentro_raio',
          'distancia_metros',
        ],
        items.map((item) => [
          item.id,
          item.status,
          item.origem,
          item.unidade.secretaria.sigla,
          item.unidade.codigoPatrimonial,
          item.unidade.nome,
          item.agente.nome,
          formatIsoDate(item.iniciadaEm),
          formatIsoDate(item.concluidaEm),
          item.dentroRaioPermitido,
          item.distanciaCheckinMetros,
        ]),
      ),
    );
  }

  unidadesPdf(secretariaId?: string) {
    return this.exportUnidades(secretariaId).then((items) =>
      buildTablePdf({
        title: 'GestOP — Proprios publicos',
        headers: ['Secretaria', 'Codigo', 'Nome', 'Tipo', 'Bairro', 'Ativo'],
        rows: items.map((item) => [
          item.secretaria.sigla,
          item.codigoPatrimonial,
          item.nome,
          item.tipo,
          item.bairro ?? '',
          item.ativo ? 'Sim' : 'Nao',
        ]),
      }),
    );
  }

  chamadosPdf(filtro: RelatorioFiltroDto) {
    return this.exportChamados(filtro).then((items) =>
      buildTablePdf({
        title: 'GestOP — Chamados',
        headers: ['Codigo', 'Status', 'Origem', 'Prioridade', 'Secretaria', 'Unidade', 'Titulo', 'Prazo'],
        rows: items.map((item) => [
          item.codigo,
          item.status,
          item.origem,
          item.prioridade,
          item.secretaria.sigla,
          item.unidade.nome,
          item.titulo ?? item.descricao.slice(0, 60),
          formatIsoDate(item.prazoEm),
        ]),
      }),
    );
  }

  ordensServicoPdf(filtro: RelatorioFiltroDto) {
    return this.chamadosPdf(filtro);
  }

  fiscalizacoesPdf(filtro: RelatorioFiltroDto) {
    return this.exportFiscalizacoes(filtro).then((items) =>
      buildTablePdf({
        title: 'GestOP — Fiscalizacoes',
        headers: ['Status', 'Origem', 'Secretaria', 'Unidade', 'Agente', 'Iniciada', 'Dentro raio'],
        rows: items.map((item) => [
          item.status,
          item.origem,
          item.unidade.secretaria.sigla,
          item.unidade.nome,
          item.agente.nome,
          formatIsoDate(item.iniciadaEm),
          item.dentroRaioPermitido == null ? '' : item.dentroRaioPermitido ? 'Sim' : 'Nao',
        ]),
      }),
    );
  }

  private chamadoWhere(filtro: RelatorioFiltroDto): Prisma.ChamadoWhereInput {
    return {
      ...(filtro.secretariaId ? { secretariaId: filtro.secretariaId } : {}),
      ...(filtro.status ? { status: filtro.status as ChamadoStatus } : {}),
      ...(filtro.from || filtro.to
        ? {
            createdAt: {
              ...(filtro.from ? { gte: new Date(filtro.from) } : {}),
              ...(filtro.to ? { lte: new Date(`${filtro.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };
  }

  private fiscalizacaoWhere(filtro: RelatorioFiltroDto): Prisma.FiscalizacaoWhereInput {
    return {
      ...(filtro.secretariaId ? { unidade: { secretariaId: filtro.secretariaId } } : {}),
      ...(filtro.from || filtro.to
        ? {
            iniciadaEm: {
              ...(filtro.from ? { gte: new Date(filtro.from) } : {}),
              ...(filtro.to ? { lte: new Date(`${filtro.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };
  }
}
