import { Injectable } from '@nestjs/common';
import { ChamadoStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RelatorioFiltroDto } from './relatorios.dto';
import { buildCsv, formatIsoDate } from './relatorios.csv';
import { buildTablePdf } from './relatorios.pdf';
import { CHAMADOS_EXPORT_HEADERS, mapChamadosExportRows } from './relatorios.chamados-export';
import { FISCALIZACOES_EXPORT_HEADERS, mapFiscalizacoesExportRows } from './relatorios.fiscalizacoes-export';
import { formatCoordenada, loadExecucaoCoordenadas } from './relatorios.execucao-coords';
import { UNIDADES_EXPORT_HEADERS, mapUnidadesExportRows } from './relatorios.unidades-export';
import { buildXlsx } from './relatorios.xlsx';

function chamadoUnidadeCodigo(item: { unidade: { codigoPatrimonial: string } | null }) {
  return item.unidade?.codigoPatrimonial ?? '';
}

function chamadoUnidadeNome(item: { unidade: { nome: string } | null; enderecoTexto?: string | null }) {
  if (item.unidade?.nome) return item.unidade.nome;
  if (item.enderecoTexto?.trim()) return item.enderecoTexto.trim();
  return 'Sem unidade vinculada';
}

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

  private async exportChamadosComExecucao(filtro: RelatorioFiltroDto) {
    const items = await this.exportChamados(filtro);
    const coordenadas = await loadExecucaoCoordenadas(
      this.prisma,
      items.map((item) => item.id),
    );

    return items.map((item) => ({
      ...item,
      execucao: coordenadas.get(item.id) ?? null,
    }));
  }

  exportOrdensServico(filtro: RelatorioFiltroDto) {
    return this.prisma.chamado.findMany({
      where: {
        ...this.chamadoWhere(filtro),
        status: {
          in: [ChamadoStatus.EM_ATENDIMENTO, ChamadoStatus.EM_EXECUCAO, ChamadoStatus.IMPEDIDO],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        secretaria: { select: { sigla: true } },
        unidade: { select: { codigoPatrimonial: true, nome: true } },
        responsavel: { select: { nome: true } },
      },
    });
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
        checklistVersao: {
          select: {
            versao: true,
            checklist: { select: { nome: true } },
          },
        },
      },
    });
  }

  unidadesCsv(secretariaId?: string) {
    return this.exportUnidades(secretariaId).then((items) =>
      buildCsv([...UNIDADES_EXPORT_HEADERS], mapUnidadesExportRows(items)),
    );
  }

  unidadesXlsx(secretariaId?: string) {
    return this.exportUnidades(secretariaId).then((items) =>
      buildXlsx('Proprios publicos', [...UNIDADES_EXPORT_HEADERS], mapUnidadesExportRows(items)),
    );
  }

  chamadosCsv(filtro: RelatorioFiltroDto) {
    return this.exportChamadosComExecucao(filtro).then((items) =>
      buildCsv([...CHAMADOS_EXPORT_HEADERS], mapChamadosExportRows(items)),
    );
  }

  chamadosXlsx(filtro: RelatorioFiltroDto) {
    return this.exportChamadosComExecucao(filtro).then((items) =>
      buildXlsx('Chamados', [...CHAMADOS_EXPORT_HEADERS], mapChamadosExportRows(items)),
    );
  }

  ordensServicoCsv(filtro: RelatorioFiltroDto) {
    return this.exportOrdensServico(filtro).then((items) =>
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
          chamadoUnidadeCodigo(item),
          chamadoUnidadeNome(item),
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

  fiscalizacoesCsv(filtro: RelatorioFiltroDto) {
    return this.exportFiscalizacoes(filtro).then((items) =>
      buildCsv([...FISCALIZACOES_EXPORT_HEADERS], mapFiscalizacoesExportRows(items)),
    );
  }

  fiscalizacoesXlsx(filtro: RelatorioFiltroDto) {
    return this.exportFiscalizacoes(filtro).then((items) =>
      buildXlsx('Vistorias', [...FISCALIZACOES_EXPORT_HEADERS], mapFiscalizacoesExportRows(items)),
    );
  }

  unidadesPdf(secretariaId?: string) {
    return this.exportUnidades(secretariaId).then((items) =>
      buildTablePdf({
        title: 'SIGMA — Proprios publicos',
        headers: ['Secretaria', 'Codigo', 'Nome', 'Tipo', 'Bairro', 'Endereco', 'Latitude', 'Longitude', 'Ativo'],
        columnWeights: [0.08, 0.08, 0.16, 0.08, 0.1, 0.22, 0.09, 0.09, 0.05],
        rows: items.map((item) => [
          item.secretaria.sigla,
          item.codigoPatrimonial,
          item.nome,
          item.tipo,
          item.bairro ?? '',
          item.endereco,
          formatCoordenada(item.latitude != null ? Number(item.latitude) : null),
          formatCoordenada(item.longitude != null ? Number(item.longitude) : null),
          item.ativo ? 'Sim' : 'Nao',
        ]),
      }),
    );
  }

  chamadosPdf(filtro: RelatorioFiltroDto) {
    return this.exportChamadosComExecucao(filtro).then((items) =>
      buildTablePdf({
        title: 'SIGMA — Chamados',
        headers: [
          'Codigo',
          'Status',
          'Prioridade',
          'Secretaria',
          'Unidade',
          'Titulo',
          'Responsavel',
          'Prazo',
          'Exec. Lat',
          'Exec. Long',
        ],
        columnWeights: [0.09, 0.09, 0.08, 0.07, 0.14, 0.2, 0.1, 0.08, 0.075, 0.075],
        rows: items.map((item) => [
          item.codigo,
          item.status,
          item.prioridade,
          item.secretaria.sigla,
          chamadoUnidadeNome(item),
          item.titulo ?? item.descricao,
          item.responsavel?.nome ?? '',
          formatIsoDate(item.prazoEm),
          formatCoordenada(item.execucao?.latitude),
          formatCoordenada(item.execucao?.longitude),
        ]),
      }),
    );
  }

  ordensServicoPdf(filtro: RelatorioFiltroDto) {
    return this.exportOrdensServico(filtro).then((items) =>
      buildTablePdf({
        title: 'SIGMA — Chamados em operacao',
        headers: ['Codigo', 'Status', 'Prioridade', 'Secretaria', 'Unidade', 'Responsavel', 'Prazo'],
        rows: items.map((item) => [
          item.codigo,
          item.status,
          item.prioridade,
          item.secretaria.sigla,
          chamadoUnidadeNome(item),
          item.responsavel?.nome ?? '',
          formatIsoDate(item.prazoEm),
        ]),
      }),
    );
  }

  fiscalizacoesPdf(filtro: RelatorioFiltroDto) {
    return this.exportFiscalizacoes(filtro).then((items) =>
      buildTablePdf({
        title: 'SIGMA — Vistorias',
        headers: [
          'Status',
          'Secretaria',
          'Unidade',
          'Checklist',
          'Agente',
          'Iniciada',
          'Check-in Lat',
          'Check-in Long',
          'Dentro raio',
        ],
        columnWeights: [0.08, 0.07, 0.14, 0.14, 0.1, 0.1, 0.09, 0.09, 0.07],
        rows: items.map((item) => [
          item.status,
          item.unidade.secretaria.sigla,
          item.unidade.nome,
          item.checklistVersao?.checklist.nome ?? '',
          item.agente.nome,
          formatIsoDate(item.iniciadaEm),
          formatCoordenada(item.checkinLatitude != null ? Number(item.checkinLatitude) : null),
          formatCoordenada(item.checkinLongitude != null ? Number(item.checkinLongitude) : null),
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
