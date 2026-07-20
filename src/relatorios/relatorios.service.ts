import { Injectable } from '@nestjs/common';
import { ChamadoPrioridade, ChamadoStatus, Prisma } from '@prisma/client';
import { resolveChamadoTituloDisplay } from '../chamados/chamados.rules';
import { PrismaService } from '../prisma/prisma.service';
import { RelatorioFiltroDto } from './relatorios.dto';
import { buildCsv, formatIsoDate } from './relatorios.csv';
import { buildTablePdf } from './relatorios.pdf';
import { CHAMADOS_EXPORT_HEADERS, mapChamadosExportRows } from './relatorios.chamados-export';
import {
  CHAMADOS_PRODUTIVIDADE_HEADERS,
  computeProdutividadeTotais,
  formatProdutividadeSummaryLines,
  mapChamadosProdutividadeExportRows,
} from './relatorios.chamados-produtividade';
import { FISCALIZACOES_EXPORT_HEADERS, mapFiscalizacoesExportRows } from './relatorios.fiscalizacoes-export';
import { formatCoordenada, loadExecucaoCoordenadas } from './relatorios.execucao-coords';
import { loadExecucaoParticipantes } from './relatorios.execucao-participantes';
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
        equipe: { select: { nome: true } },
        tipoChamado: { select: { nome: true } },
      },
    });
  }

  private async exportChamadosComExecucao(filtro: RelatorioFiltroDto) {
    const items = await this.exportChamados(filtro);
    const ids = items.map((item) => item.id);
    const [coordenadas, participantes] = await Promise.all([
      loadExecucaoCoordenadas(this.prisma, ids),
      loadExecucaoParticipantes(this.prisma, ids),
    ]);

    return items.map((item) => ({
      ...item,
      execucao: coordenadas.get(item.id) ?? null,
      participantesExecucao: participantes.get(item.id) ?? null,
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
        tipoChamado: { select: { nome: true } },
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

  private async exportChamadosProdutividade(filtro: RelatorioFiltroDto) {
    const items = await this.prisma.chamado.findMany({
      where: this.chamadoProdutividadeWhere(filtro),
      orderBy: [{ concluidoEm: 'asc' }, { codigo: 'asc' }],
      include: {
        secretaria: { select: { sigla: true } },
        unidade: { select: { nome: true, endereco: true } },
        tipoChamado: { select: { nome: true } },
      },
    });

    const participantes = await loadExecucaoParticipantes(
      this.prisma,
      items.map((item) => item.id),
    );

    return items.map((item) => ({
      ...item,
      participantesExecucao: participantes.get(item.id) ?? null,
    }));
  }

  chamadosProdutividadeCsv(filtro: RelatorioFiltroDto) {
    return this.exportChamadosProdutividade(filtro).then((items) => {
      const rows = mapChamadosProdutividadeExportRows(items);
      const summary = formatProdutividadeSummaryLines(computeProdutividadeTotais(items));
      const body = buildCsv([...CHAMADOS_PRODUTIVIDADE_HEADERS], rows);
      if (!summary.length) return body;
      return `${body}\n\n${summary.map((line) => `"${line.replace(/"/g, '""')}"`).join('\n')}`;
    });
  }

  chamadosProdutividadeXlsx(filtro: RelatorioFiltroDto) {
    return this.exportChamadosProdutividade(filtro).then((items) =>
      buildXlsx(
        'Produtividade',
        [...CHAMADOS_PRODUTIVIDADE_HEADERS],
        mapChamadosProdutividadeExportRows(items),
        {
          wrapText: true,
          summaryLines: formatProdutividadeSummaryLines(computeProdutividadeTotais(items)),
        },
      ),
    );
  }

  chamadosProdutividadePdf(filtro: RelatorioFiltroDto) {
    return this.exportChamadosProdutividade(filtro).then((items) => {
      const totais = computeProdutividadeTotais(items);
      return buildTablePdf({
        title: 'SIGMA — Chamados concluídos (produtividade)',
        subtitle: `Gerado em ${new Date().toLocaleString('pt-BR')} · período por data de conclusão`,
        headers: [
          'Código',
          'Título/descrição',
          'Conclusão',
          'Equipe',
          'Funcionários',
          'Cargos',
          'SLA',
          'Sec.',
          'Local',
          'Tipo',
        ],
        columnWeights: [0.08, 0.16, 0.09, 0.1, 0.12, 0.1, 0.08, 0.05, 0.14, 0.08],
        wrapFully: true,
        summaryLines: formatProdutividadeSummaryLines(totais),
        rows: mapChamadosProdutividadeExportRows(items).map((row) => row.map((cell) => String(cell ?? ''))),
      });
    });
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
          resolveChamadoTituloDisplay(item),
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
          resolveChamadoTituloDisplay(item),
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
      ...(filtro.tipoChamadoId ? { tipoChamadoId: filtro.tipoChamadoId } : {}),
      ...(filtro.prioridade ? { prioridade: filtro.prioridade as ChamadoPrioridade } : {}),
      ...(filtro.equipeId === 'sem-equipe'
        ? { equipeId: null }
        : filtro.equipeId
          ? { equipeId: filtro.equipeId }
          : {}),
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

  /** Período por data de conclusão; somente chamados CONCLUIDO. */
  private chamadoProdutividadeWhere(filtro: RelatorioFiltroDto): Prisma.ChamadoWhereInput {
    return {
      status: ChamadoStatus.CONCLUIDO,
      ...(filtro.secretariaId ? { secretariaId: filtro.secretariaId } : {}),
      ...(filtro.tipoChamadoId ? { tipoChamadoId: filtro.tipoChamadoId } : {}),
      ...(filtro.from || filtro.to
        ? {
            concluidoEm: {
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
