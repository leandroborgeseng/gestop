import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';

const BRAND = '#0066cc';
const TEXT = '#1a1a1a';
const MUTED = '#555555';

const LOGO_CANDIDATES = [
  resolve(process.cwd(), 'assets/prefeitura-franca-logo.png'),
  resolve(process.cwd(), 'frontend/public/prefeitura-franca-logo.png'),
];

const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

export type RelatorioExecucaoPdfAnexo = {
  legenda: string;
  mimeType?: string | null;
  nomeArquivo?: string | null;
  imageBuffer?: Buffer | null;
};

export type RelatorioExecucaoPdfResposta = {
  codigo: string;
  titulo: string;
  tipo?: string | null;
  respostaTexto: string;
  comentario?: string | null;
  conformidade?: string | null;
  naoSeAplica?: boolean;
  evidencias: RelatorioExecucaoPdfAnexo[];
};

export type RelatorioExecucaoPdfInput = {
  documentoCodigo?: string | null;
  chamadoCodigo: string;
  tipoChamadoNome?: string | null;
  secretariaLabel: string;
  localLabel: string;
  endereco?: string | null;
  statusLabel: string;
  responsavelLabel?: string | null;
  equipeLabel?: string | null;
  executadoEm: string;
  registradoPorLabel?: string | null;
  origemExecucaoLabel: string;
  relatorio: string;
  impedimento?: boolean;
  impedimentoMotivo?: string | null;
  participantesLabel?: string | null;
  checklistNome?: string | null;
  checklistVersao?: number | null;
  respostas: RelatorioExecucaoPdfResposta[];
  evidenciasGerais: RelatorioExecucaoPdfAnexo[];
};

function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number, marginTop: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (y + needed <= bottom) return y;
  doc.addPage();
  return marginTop;
}

function resolveLogoPath() {
  return LOGO_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

function isImage(mimeType?: string | null) {
  return Boolean(mimeType && IMAGE_MIMES.has(mimeType.toLowerCase()));
}

function drawAnexo(
  doc: PDFKit.PDFDocument,
  anexo: RelatorioExecucaoPdfAnexo,
  left: number,
  width: number,
  y: number,
  marginTop: number,
) {
  y = ensureSpace(doc, y, 20, marginTop);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT).text(anexo.legenda, left, y, { width });
  y = doc.y + 3;

  if (isImage(anexo.mimeType) && anexo.imageBuffer?.length) {
    try {
      const img = (
        doc as PDFKit.PDFDocument & { openImage: (b: Buffer) => { width: number; height: number } }
      ).openImage(anexo.imageBuffer);
      const maxW = Math.max(80, (width - 8) * 0.5);
      const maxH = 220;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const drawW = Math.max(1, img.width * scale);
      const drawH = Math.max(1, img.height * scale);
      y = ensureSpace(doc, y, drawH + 12, marginTop);
      doc.image(anexo.imageBuffer, left, y, { width: drawW, height: drawH });
      return y + drawH + 12;
    } catch {
      // fallthrough
    }
  }

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(MUTED)
    .text(
      `Anexo: ${anexo.nomeArquivo ?? 'arquivo'}${anexo.mimeType ? ` (${anexo.mimeType})` : ''}`,
      left,
      y,
      { width },
    );
  return doc.y + 8;
}

function drawRow(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  left: number,
  width: number,
  y: number,
  marginTop: number,
) {
  y = ensureSpace(doc, y, 16, marginTop);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(label, left, y, { width: 120 });
  doc.font('Helvetica').fontSize(9).fillColor(TEXT).text(value || '—', left + 125, y, { width: width - 125 });
  return Math.max(doc.y, y) + 4;
}

export function buildRelatorioExecucaoPdf(input: RelatorioExecucaoPdfInput): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const marginTop = doc.page.margins.top;
    let y = marginTop;

    const logoPath = resolveLogoPath();
    if (logoPath) doc.image(logoPath, left, y, { fit: [90, 32] });
    doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND).text('Relatório de execução', left + 100, y);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(input.documentoCodigo ? `${input.documentoCodigo} · ${input.chamadoCodigo}` : input.chamadoCodigo, left + 100, y + 18);
    y += 48;

    y = drawRow(doc, 'Chamado', input.chamadoCodigo, left, width, y, marginTop);
    y = drawRow(doc, 'Tipo', input.tipoChamadoNome || '—', left, width, y, marginTop);
    y = drawRow(doc, 'Secretaria', input.secretariaLabel, left, width, y, marginTop);
    y = drawRow(doc, 'Local', input.localLabel, left, width, y, marginTop);
    y = drawRow(doc, 'Endereço', input.endereco || '—', left, width, y, marginTop);
    y = drawRow(doc, 'Status', input.statusLabel, left, width, y, marginTop);
    y = drawRow(doc, 'Responsável', input.responsavelLabel || '—', left, width, y, marginTop);
    y = drawRow(doc, 'Equipe', input.equipeLabel || '—', left, width, y, marginTop);
    y = drawRow(doc, 'Executado em', input.executadoEm, left, width, y, marginTop);
    y = drawRow(doc, 'Registrado por', input.registradoPorLabel || '—', left, width, y, marginTop);
    y = drawRow(doc, 'Origem', input.origemExecucaoLabel, left, width, y, marginTop);
    y = drawRow(doc, 'Participantes', input.participantesLabel || '—', left, width, y, marginTop);
    if (input.checklistNome) {
      y = drawRow(
        doc,
        'Checklist',
        `${input.checklistNome}${input.checklistVersao != null ? ` (v${input.checklistVersao})` : ''}`,
        left,
        width,
        y,
        marginTop,
      );
    }

    if (input.impedimento) {
      y = ensureSpace(doc, y, 28, marginTop);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#b45309').text('Execução com impedimento', left, y);
      y = doc.y + 4;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(TEXT)
        .text(input.impedimentoMotivo || 'Motivo não informado.', left, y, { width });
      y = doc.y + 10;
    }

    y = ensureSpace(doc, y, 30, marginTop);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND).text('Relatório / observações da execução', left, y);
    y = doc.y + 6;
    doc.font('Helvetica').fontSize(9).fillColor(TEXT).text(input.relatorio || '—', left, y, { width });
    y = doc.y + 12;

    if (input.evidenciasGerais.length) {
      y = ensureSpace(doc, y, 24, marginTop);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND).text('Evidências da execução', left, y);
      y = doc.y + 8;
      for (const evidencia of input.evidenciasGerais) {
        y = drawAnexo(doc, evidencia, left, width, y, marginTop);
      }
    }

    if (input.respostas.length) {
      y = ensureSpace(doc, y, 28, marginTop);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND).text('Checklist preenchido na execução', left, y);
      y = doc.y + 8;
      for (const resposta of input.respostas) {
        y = ensureSpace(doc, y, 36, marginTop);
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(TEXT)
          .text(`${resposta.codigo} · ${resposta.titulo}`, left, y, { width });
        y = doc.y + 2;
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(TEXT)
          .text(
            resposta.naoSeAplica ? 'Resposta: Não se aplica' : `Resposta: ${resposta.respostaTexto}`,
            left,
            y,
            { width },
          );
        y = doc.y + 2;
        if (resposta.conformidade) {
          doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`Conformidade: ${resposta.conformidade}`, left, y);
          y = doc.y + 2;
        }
        if (resposta.comentario) {
          doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`Obs.: ${resposta.comentario}`, left, y, { width });
          y = doc.y + 2;
        }
        for (const evidencia of resposta.evidencias) {
          y = drawAnexo(doc, evidencia, left, width, y, marginTop);
        }
        y += 8;
      }
    }

    doc.end();
  });
}
