import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { chamadoStatusLabel, formatDateBr, prioridadeLabel } from './chamados-sla';

const BRAND_PRIMARY = '#0066cc';
const TEXT_PRIMARY = '#1a1a1a';
const TEXT_MUTED = '#555555';
const BORDER = '#dddddd';

const LOGO_CANDIDATES = [
  resolve(process.cwd(), 'assets/prefeitura-franca-logo.png'),
  resolve(process.cwd(), 'frontend/public/prefeitura-franca-logo.png'),
];

const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

export type ChamadoDetalhePdfAnexo = {
  id: string;
  legenda: string;
  mimeType?: string | null;
  nomeArquivo?: string | null;
  capturadaEm?: string | null;
  usuarioNome?: string | null;
  /** Quando presente, a imagem é embutida no PDF. */
  imageBuffer?: Buffer | null;
  renderError?: string | null;
};

export type ChamadoDetalhePdfHistorico = {
  statusAnterior: string | null;
  statusNovo: string;
  motivo: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  alteradoPor?: { nome: string } | null;
  anexos?: ChamadoDetalhePdfAnexo[];
};

export type ChamadoDetalhePdfInput = {
  codigo: string;
  titulo?: string | null;
  descricao: string;
  status: string;
  prioridade: string;
  origem: string;
  createdAt: string;
  prazoEm?: string | null;
  previstaExecucaoEm?: string | null;
  concluidoEm?: string | null;
  solicitanteNome?: string | null;
  solicitanteTelefone?: string | null;
  enderecoTexto?: string | null;
  enderecoBairro?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  impedimentoMotivo?: string | null;
  secretaria?: { sigla: string; nome: string } | null;
  unidade?: { nome: string; codigoPatrimonial: string; endereco?: string; bairro?: string | null } | null;
  equipe?: { nome: string } | null;
  responsavel?: { nome: string } | null;
  tipoChamado?: { nome: string; exigeVistoriaPrevia?: boolean } | null;
  registradoPor?: { nome: string } | null;
  naoConformidade?: {
    descricao: string;
    item: { codigo: string; titulo: string };
  } | null;
  fotoAbertura?: ChamadoDetalhePdfAnexo | null;
  historico: ChamadoDetalhePdfHistorico[];
  anexosSoltos?: ChamadoDetalhePdfAnexo[];
};

export function isPdfRenderableImage(mimeType?: string | null) {
  if (!mimeType) return false;
  return IMAGE_MIMES.has(mimeType.toLowerCase());
}

function resolveLogoPath() {
  return LOGO_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

function timelineTitle(entry: ChamadoDetalhePdfHistorico) {
  const tipo = typeof entry.metadata.tipo === 'string' ? entry.metadata.tipo : null;
  if (tipo === 'HISTORY_UPDATE') return 'Atualização de histórico';
  if (tipo === 'programacao_update') return 'Programação de execução atualizada';
  if (tipo === 'triagem_update') return 'Triagem atualizada';
  if (tipo === 'atribuicao_update') return 'Atribuição atualizada';
  if (tipo === 'abertura_update') return 'Informações de abertura atualizadas';
  if (tipo === 'execucao_manual') return 'Execução lançada manualmente';
  if (tipo === 'execucao_conclusao') {
    return entry.statusNovo === 'IMPEDIDO' ? 'Execução impedida em campo' : 'Execução concluída em campo';
  }
  if (entry.statusAnterior && entry.statusAnterior !== entry.statusNovo) {
    return `${chamadoStatusLabel(entry.statusAnterior)} → ${chamadoStatusLabel(entry.statusNovo)}`;
  }
  return chamadoStatusLabel(entry.statusNovo);
}

function ensureSpace(doc: InstanceType<typeof PDFDocument>, y: number, needed: number, marginTop: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (y + needed <= bottom) return y;
  doc.addPage();
  return marginTop;
}

function extensionLabel(mimeType?: string | null, nomeArquivo?: string | null) {
  if (nomeArquivo?.includes('.')) {
    return nomeArquivo.split('.').pop()?.toUpperCase() ?? 'ARQUIVO';
  }
  if (!mimeType) return 'ARQUIVO';
  const part = mimeType.split('/')[1];
  return (part ?? 'arquivo').toUpperCase();
}

function drawAnexo(
  doc: InstanceType<typeof PDFDocument>,
  anexo: ChamadoDetalhePdfAnexo,
  left: number,
  width: number,
  y: number,
  marginTop: number,
) {
  y = ensureSpace(doc, y, 24, marginTop);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_PRIMARY).text(anexo.legenda, left + 8, y, { width: width - 8 });
  y += 10;

  const metaParts = [
    anexo.capturadaEm ? new Date(anexo.capturadaEm).toLocaleString('pt-BR') : null,
    anexo.usuarioNome ? `Por: ${anexo.usuarioNome}` : null,
    anexo.mimeType ? extensionLabel(anexo.mimeType, anexo.nomeArquivo) : null,
  ].filter(Boolean);
  if (metaParts.length) {
    doc.font('Helvetica').fontSize(7).fillColor(TEXT_MUTED).text(metaParts.join(' · '), left + 8, y, { width: width - 8 });
    y += 10;
  }

  const isImage = isPdfRenderableImage(anexo.mimeType);
  if (isImage && anexo.imageBuffer?.length) {
    const maxH = 220;
    y = ensureSpace(doc, y, Math.min(maxH, 160) + 8, marginTop);
    try {
      doc.image(anexo.imageBuffer, left + 8, y, {
        fit: [width - 16, maxH],
      });
      // pdfkit não retorna altura facilmente; estima por fit
      y += Math.min(maxH, 180) + 8;
    } catch {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor(TEXT_MUTED).text('Arquivo anexado não renderizável no PDF', left + 8, y);
      y += 12;
    }
    return y;
  }

  if (isImage && anexo.renderError) {
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(TEXT_MUTED).text(anexo.renderError, left + 8, y);
    y += 12;
    return y;
  }

  const fileLabel = anexo.nomeArquivo?.trim() || `Arquivo ${extensionLabel(anexo.mimeType, anexo.nomeArquivo)}`;
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(TEXT_PRIMARY)
    .text(`Arquivo anexado: ${fileLabel}${anexo.mimeType ? ` (${anexo.mimeType})` : ''}`, left + 8, y, {
      width: width - 8,
    });
  y += 12;
  return y;
}

export function buildChamadoDetalhePdf(chamado: ChamadoDetalhePdfInput): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });
    const chunks: Buffer[] = [];
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    let y = doc.page.margins.top;
    const marginTop = doc.page.margins.top;

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
    doc.on('error', reject);

    const logoPath = resolveLogoPath();
    if (logoPath) {
      doc.image(logoPath, left, y, { fit: [90, 32] });
      y += 38;
    }

    doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND_PRIMARY).text(`Chamado ${chamado.codigo}`, left, y);
    y += 18;
    doc.font('Helvetica').fontSize(10).fillColor(TEXT_MUTED).text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, left, y);
    y += 22;

    const titulo =
      chamado.tipoChamado?.nome?.trim() || chamado.titulo?.trim() || 'Sem tipo de chamado';
    doc.font('Helvetica-Bold').fontSize(12).fillColor(TEXT_PRIMARY).text(titulo.slice(0, 200), left, y, { width });
    y += doc.heightOfString(titulo.slice(0, 200), { width }) + 6;
    const descricao = chamado.descricao?.trim();
    if (descricao && descricao !== titulo) {
      doc.font('Helvetica').fontSize(9).fillColor(TEXT_MUTED).text(descricao.slice(0, 800), left, y, { width });
      y += doc.heightOfString(descricao.slice(0, 800), { width }) + 10;
    } else {
      y += 4;
    }

    const infoRows: Array<[string, string]> = [
      ['Status', chamadoStatusLabel(chamado.status)],
      ['Prioridade', prioridadeLabel(chamado.prioridade)],
      ['Secretaria', chamado.secretaria ? `${chamado.secretaria.sigla} — ${chamado.secretaria.nome}` : '—'],
      ['Próprio', chamado.unidade?.nome ?? '—'],
      ['Patrimônio', chamado.unidade?.codigoPatrimonial ?? '—'],
      ['Tipo', chamado.tipoChamado?.nome ?? '—'],
      ['Análise técnica prévia', chamado.tipoChamado?.exigeVistoriaPrevia ? 'Exigida' : 'Não exigida'],
      ['Equipe', chamado.equipe?.nome ?? '—'],
      ['Responsável', chamado.responsavel?.nome ?? '—'],
      ['Aberto em', formatDateBr(chamado.createdAt)],
      ['Prazo SLA', chamado.prazoEm ? formatDateBr(chamado.prazoEm) : '—'],
      ['Programado para', chamado.previstaExecucaoEm ? formatDateBr(chamado.previstaExecucaoEm) : '—'],
      ['Concluído em', chamado.concluidoEm ? formatDateBr(chamado.concluidoEm) : '—'],
      ['Solicitante', [chamado.solicitanteNome, chamado.solicitanteTelefone].filter(Boolean).join(' · ') || '—'],
      [
        'Endereço',
        (chamado.unidade?.endereco ??
          [chamado.enderecoTexto, chamado.enderecoBairro].filter(Boolean).join(' · ')) ||
          '—',
      ],
      [
        'Coordenadas',
        chamado.latitude != null && chamado.longitude != null
          ? `${chamado.latitude.toFixed(6)}, ${chamado.longitude.toFixed(6)}`
          : '—',
      ],
      ['Registrado por', chamado.registradoPor?.nome ?? '—'],
      ['Origem', chamado.origem],
    ];

    if (chamado.impedimentoMotivo) {
      infoRows.push(['Impedimento', chamado.impedimentoMotivo]);
    }

    doc.font('Helvetica-Bold').fontSize(11).fillColor(TEXT_PRIMARY).text('Informações do chamado', left, y);
    y += 14;

    for (const [label, value] of infoRows) {
      y = ensureSpace(doc, y, 14, marginTop);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_MUTED).text(`${label}:`, left, y, { width: 120 });
      doc.font('Helvetica').fontSize(8).fillColor(TEXT_PRIMARY).text(value, left + 122, y, { width: width - 122 });
      y += Math.max(12, doc.heightOfString(value, { width: width - 122 }) + 2);
    }

    y += 8;
    y = ensureSpace(doc, y, 40, marginTop);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_PRIMARY).text('Descrição', left, y);
    y += 10;
    doc.font('Helvetica').fontSize(8).fillColor(TEXT_PRIMARY).text(chamado.descricao, left, y, { width });
    y += doc.heightOfString(chamado.descricao, { width }) + 12;

    if (chamado.fotoAbertura) {
      y = ensureSpace(doc, y, 24, marginTop);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(TEXT_PRIMARY).text('Foto anexada na abertura', left, y);
      y += 14;
      y = drawAnexo(doc, chamado.fotoAbertura, left, width, y, marginTop);
      y += 6;
    }

    if (chamado.naoConformidade) {
      y = ensureSpace(doc, y, 36, marginTop);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_PRIMARY).text('Origem (NC)', left, y);
      y += 10;
      doc
        .font('Helvetica')
        .fontSize(8)
        .text(
          `${chamado.naoConformidade.item.codigo} — ${chamado.naoConformidade.item.titulo}: ${chamado.naoConformidade.descricao}`,
          left,
          y,
          { width },
        );
      y += doc.heightOfString(`${chamado.naoConformidade.descricao}`, { width }) + 12;
    }

    y = ensureSpace(doc, y, 24, marginTop);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(TEXT_PRIMARY).text('Linha do tempo', left, y);
    y += 14;

    for (const entry of chamado.historico) {
      y = ensureSpace(doc, y, 48, marginTop);
      doc.save();
      doc.rect(left, y, width, 1).fill(BORDER);
      doc.restore();
      y += 6;

      doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND_PRIMARY).text(timelineTitle(entry), left, y, { width });
      y += 12;
      doc.font('Helvetica').fontSize(8).fillColor(TEXT_MUTED).text(new Date(entry.createdAt).toLocaleString('pt-BR'), left, y);
      y += 10;

      const by = entry.alteradoPor?.nome;
      if (by) {
        doc.text(`Por: ${by}`, left, y);
        y += 10;
      }
      if (entry.motivo?.trim()) {
        doc.font('Helvetica').fontSize(8).fillColor(TEXT_PRIMARY).text(entry.motivo.trim(), left, y, { width });
        y += doc.heightOfString(entry.motivo.trim(), { width }) + 4;
      }

      const alteracoes = Array.isArray(entry.metadata.alteracoes)
        ? (entry.metadata.alteracoes as Array<{ label: string; de: string; para: string }>)
        : [];
      for (const alt of alteracoes) {
        y = ensureSpace(doc, y, 12, marginTop);
        doc.font('Helvetica').fontSize(8).fillColor(TEXT_PRIMARY).text(`${alt.label}: ${alt.de} → ${alt.para}`, left + 8, y, { width: width - 8 });
        y += doc.heightOfString(`${alt.label}: ${alt.de} → ${alt.para}`, { width: width - 8 }) + 2;
      }

      if (typeof entry.metadata.descricao === 'string' && entry.metadata.descricao.trim()) {
        y = ensureSpace(doc, y, 14, marginTop);
        doc.font('Helvetica-Bold').fontSize(8).text('Detalhe:', left + 8, y);
        y += 10;
        doc.font('Helvetica').fontSize(8).text(entry.metadata.descricao.trim(), left + 8, y, { width: width - 8 });
        y += doc.heightOfString(entry.metadata.descricao.trim(), { width: width - 8 }) + 4;
      }

      if (typeof entry.metadata.relatorio === 'string' && entry.metadata.relatorio.trim()) {
        y = ensureSpace(doc, y, 14, marginTop);
        doc.font('Helvetica-Bold').fontSize(8).text('Relatório:', left + 8, y);
        y += 10;
        doc.font('Helvetica').fontSize(8).text(entry.metadata.relatorio.trim(), left + 8, y, { width: width - 8 });
        y += doc.heightOfString(entry.metadata.relatorio.trim(), { width: width - 8 }) + 4;
      }

      const checklistMeta = entry.metadata.checklistComplementar as
        | {
            checklistNome?: string;
            respostas?: Array<{
              titulo?: string;
              naoSeAplica?: boolean;
              valorBooleano?: boolean | null;
              valorTexto?: string | null;
              valorNumero?: number | null;
              comentario?: string | null;
            }>;
          }
        | null
        | undefined;
      if (checklistMeta?.respostas?.length) {
        y = ensureSpace(doc, y, 16, marginTop);
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(`Perguntas complementares${checklistMeta.checklistNome ? ` — ${checklistMeta.checklistNome}` : ''}:`, left + 8, y, {
            width: width - 8,
          });
        y += 12;
        for (const resposta of checklistMeta.respostas) {
          const valor = resposta.naoSeAplica
            ? 'Não se aplica'
            : resposta.valorBooleano === true
              ? 'Sim'
              : resposta.valorBooleano === false
                ? 'Não'
                : resposta.valorTexto?.trim() ||
                  (resposta.valorNumero != null ? String(resposta.valorNumero) : '—');
          const line = `${resposta.titulo ?? 'Pergunta'}: ${valor}${
            resposta.comentario?.trim() ? ` (${resposta.comentario.trim()})` : ''
          }`;
          y = ensureSpace(doc, y, 12, marginTop);
          doc.font('Helvetica').fontSize(8).fillColor(TEXT_PRIMARY).text(line, left + 8, y, { width: width - 8 });
          y += doc.heightOfString(line, { width: width - 8 }) + 2;
        }
        y += 4;
      }

      for (const anexo of entry.anexos ?? []) {
        y = drawAnexo(doc, anexo, left, width, y, marginTop);
      }

      y += 8;
    }

    if (chamado.anexosSoltos?.length) {
      y = ensureSpace(doc, y, 28, marginTop);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(TEXT_PRIMARY).text('Anexos e evidências', left, y);
      y += 14;
      for (const anexo of chamado.anexosSoltos) {
        y = drawAnexo(doc, anexo, left, width, y, marginTop);
      }
    }

    doc.end();
  });
}
