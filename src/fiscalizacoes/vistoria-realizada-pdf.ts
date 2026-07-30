import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';

const BRAND_PRIMARY = '#0066cc';
const TEXT_PRIMARY = '#1a1a1a';
const TEXT_MUTED = '#555555';
const BORDER = '#dddddd';

const LOGO_CANDIDATES = [
  resolve(process.cwd(), 'assets/prefeitura-franca-logo.png'),
  resolve(process.cwd(), 'frontend/public/prefeitura-franca-logo.png'),
];

const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

export function isPdfRenderableImage(mimeType?: string | null) {
  if (!mimeType) return false;
  return IMAGE_MIMES.has(mimeType.toLowerCase());
}

function resolveLogoPath() {
  return LOGO_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

export type VistoriaRealizadaPdfAnexo = {
  id: string;
  legenda: string;
  mimeType?: string | null;
  nomeArquivo?: string | null;
  capturadaEm?: string | null;
  imageBuffer?: Buffer | null;
  renderError?: string | null;
};

export type VistoriaRealizadaPdfResposta = {
  codigo: string;
  titulo: string;
  categoriaNome?: string | null;
  tipo: string;
  respostaTexto: string;
  comentario?: string | null;
  conformidade?: string | null;
  naoConformidade?: {
    status?: string | null;
    motivoBaixa?: string | null;
    chamado?: { codigo: string; status?: string | null } | null;
  } | null;
  evidencias: VistoriaRealizadaPdfAnexo[];
};

export type VistoriaRealizadaPdfInput = {
  unidadeNome: string;
  unidadeCodigoPatrimonial: string;
  secretariaSigla: string;
  secretariaNome: string;
  endereco?: string | null;
  bairro?: string | null;
  checklistNome: string;
  checklistVersao: number;
  dataHora?: string | null;
  origemLabel: string;
  realizadaPorLabel?: string | null;
  lancamentoManual: boolean;
  lancadoPorLabel?: string | null;
  responsaveisPrevistosLabel?: string | null;
  observacoes?: string | null;
  notaGeral?: number | null;
  notasPorCategoria?: Array<{ categoriaNome: string; nota: number }>;
  respostas: VistoriaRealizadaPdfResposta[];
};

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

/** Mesma estratégia de dimensionamento do drawAnexo de chamados-detail-pdf: metade da largura útil, altura real via openImage. */
function drawAnexo(
  doc: InstanceType<typeof PDFDocument>,
  anexo: VistoriaRealizadaPdfAnexo,
  left: number,
  width: number,
  y: number,
  marginTop: number,
) {
  y = ensureSpace(doc, y, 24, marginTop);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_PRIMARY).text(anexo.legenda, left + 8, y, { width: width - 8 });
  y = doc.y + 4;

  const metaParts = [
    anexo.capturadaEm ? new Date(anexo.capturadaEm).toLocaleString('pt-BR') : null,
    anexo.mimeType ? extensionLabel(anexo.mimeType, anexo.nomeArquivo) : null,
  ].filter(Boolean);
  if (metaParts.length) {
    doc.font('Helvetica').fontSize(7).fillColor(TEXT_MUTED).text(metaParts.join(' · '), left + 8, y, { width: width - 8 });
    y = doc.y + 4;
  }

  const isImage = isPdfRenderableImage(anexo.mimeType);
  if (isImage && anexo.imageBuffer?.length) {
    const maxW = Math.max(80, (width - 16) * 0.5);
    const maxH = 240;
    try {
      const image = (
        doc as InstanceType<typeof PDFDocument> & {
          openImage: (src: Buffer) => { width: number; height: number };
        }
      ).openImage(anexo.imageBuffer);
      const naturalW = Math.max(1, image.width);
      const naturalH = Math.max(1, image.height);
      const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
      const drawW = Math.max(1, naturalW * scale);
      const drawH = Math.max(1, naturalH * scale);
      const gapAfter = 12;

      y = ensureSpace(doc, y, drawH + gapAfter, marginTop);
      doc.image(anexo.imageBuffer, left + 8, y, { width: drawW, height: drawH });
      y += drawH + gapAfter;
    } catch {
      doc
        .font('Helvetica-Oblique')
        .fontSize(8)
        .fillColor(TEXT_MUTED)
        .text('Arquivo anexado não renderizável no PDF', left + 8, y);
      y += 14;
    }
    return y;
  }

  if (isImage && anexo.renderError) {
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(TEXT_MUTED).text(anexo.renderError, left + 8, y);
    y += 14;
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
  y = doc.y + 8;
  return y;
}

function drawKeyValueRow(
  doc: InstanceType<typeof PDFDocument>,
  label: string,
  value: string,
  left: number,
  width: number,
  y: number,
  marginTop: number,
) {
  y = ensureSpace(doc, y, 14, marginTop);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_MUTED).text(`${label}:`, left, y, { width: 150 });
  doc.font('Helvetica').fontSize(8).fillColor(TEXT_PRIMARY).text(value, left + 152, y, { width: width - 152 });
  return y + Math.max(12, doc.heightOfString(value, { width: width - 152 }) + 2);
}

function drawPergunta(
  doc: InstanceType<typeof PDFDocument>,
  resposta: VistoriaRealizadaPdfResposta,
  index: number,
  left: number,
  width: number,
  y: number,
  marginTop: number,
): number {
  y = ensureSpace(doc, y, 40, marginTop);
  doc.save();
  doc.rect(left, y, width, 1).fill(BORDER);
  doc.restore();
  y += 6;

  const title = `${index + 1}. ${resposta.codigo} — ${resposta.titulo}`;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND_PRIMARY).text(title, left, y, { width });
  y = doc.y + 4;

  const metaLine = [
    resposta.categoriaNome ? `Categoria: ${resposta.categoriaNome}` : null,
    `Tipo: ${resposta.tipo}`,
  ]
    .filter(Boolean)
    .join(' · ');
  doc.font('Helvetica').fontSize(8).fillColor(TEXT_MUTED).text(metaLine, left, y, { width });
  y = doc.y + 6;

  const respostaLine = `Resposta: ${resposta.respostaTexto}${
    resposta.conformidade ? ` (${resposta.conformidade})` : ''
  }`;
  y = ensureSpace(doc, y, 14, marginTop);
  doc.font('Helvetica').fontSize(9).fillColor(TEXT_PRIMARY).text(respostaLine, left, y, { width });
  y = doc.y + 4;

  if (resposta.comentario?.trim()) {
    y = ensureSpace(doc, y, 14, marginTop);
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(TEXT_MUTED).text(`Observação: ${resposta.comentario.trim()}`, left, y, {
      width,
    });
    y = doc.y + 4;
  }

  if (resposta.naoConformidade) {
    const nc = resposta.naoConformidade;
    const ncLine = nc.chamado
      ? `Não conformidade → chamado ${nc.chamado.codigo}${nc.chamado.status ? ` (${nc.chamado.status})` : ''}`
      : nc.status === 'BAIXADA_MANUAL'
        ? `Não conformidade baixada manualmente${nc.motivoBaixa ? `: ${nc.motivoBaixa}` : ''}`
        : 'Não conformidade pendente sem chamado';
    y = ensureSpace(doc, y, 14, marginTop);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#b45309').text(ncLine, left, y, { width });
    y = doc.y + 4;
  }

  for (const evidencia of resposta.evidencias) {
    y = drawAnexo(doc, evidencia, left, width, y, marginTop);
  }

  y += 6;
  return y;
}

export function buildVistoriaRealizadaPdf(input: VistoriaRealizadaPdfInput): Promise<Buffer> {
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

    doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND_PRIMARY).text('Vistoria realizada', left, y);
    y += 18;
    doc.font('Helvetica').fontSize(10).fillColor(TEXT_MUTED).text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, left, y);
    y += 22;

    doc.font('Helvetica-Bold').fontSize(11).fillColor(TEXT_PRIMARY).text('Dados gerais', left, y);
    y += 14;

    const infoRows: Array<[string, string]> = [
      ['Próprio', input.unidadeNome],
      ['Código patrimonial', input.unidadeCodigoPatrimonial],
      ['Secretaria', `${input.secretariaSigla} — ${input.secretariaNome}`],
      ['Endereço', [input.endereco, input.bairro].filter(Boolean).join(' · ') || '—'],
      ['Checklist', `${input.checklistNome} (v${input.checklistVersao})`],
      ['Data/hora', input.dataHora ? new Date(input.dataHora).toLocaleString('pt-BR') : '—'],
      ['Origem', input.origemLabel],
      ['Realizada por', input.realizadaPorLabel ?? '—'],
    ];
    if (input.lancamentoManual) {
      infoRows.push(['Lançada por', input.lancadoPorLabel ?? '—']);
    }
    if (input.responsaveisPrevistosLabel) {
      infoRows.push(['Responsáveis previstos', input.responsaveisPrevistosLabel]);
    }

    for (const [label, value] of infoRows) {
      y = drawKeyValueRow(doc, label, value, left, width, y, marginTop);
    }

    if (input.observacoes?.trim()) {
      y += 4;
      y = ensureSpace(doc, y, 30, marginTop);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_PRIMARY).text('Observações', left, y);
      y += 10;
      doc.font('Helvetica').fontSize(8).fillColor(TEXT_PRIMARY).text(input.observacoes.trim(), left, y, { width });
      y += doc.heightOfString(input.observacoes.trim(), { width }) + 10;
    }

    if (input.notaGeral != null) {
      y += 6;
      y = ensureSpace(doc, y, 30, marginTop);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(TEXT_PRIMARY).text('Notas', left, y);
      y += 14;
      y = drawKeyValueRow(doc, 'Nota do próprio', input.notaGeral.toFixed(1).replace('.', ','), left, width, y, marginTop);
      for (const categoria of input.notasPorCategoria ?? []) {
        y = drawKeyValueRow(
          doc,
          `Nota — ${categoria.categoriaNome}`,
          categoria.nota.toFixed(1).replace('.', ','),
          left,
          width,
          y,
          marginTop,
        );
      }
    }

    y += 10;
    y = ensureSpace(doc, y, 24, marginTop);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(TEXT_PRIMARY).text('Perguntas e respostas', left, y);
    y += 14;

    input.respostas.forEach((resposta, index) => {
      y = drawPergunta(doc, resposta, index, left, width, y, marginTop);
    });

    doc.end();
  });
}
