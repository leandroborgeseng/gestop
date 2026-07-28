import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { chamadoStatusLabel, formatDateBr, prioridadeLabel } from '../chamados/chamados-sla';

const BRAND_PRIMARY = '#0066cc';
const TEXT_PRIMARY = '#1a1a1a';
const TEXT_MUTED = '#555555';
const BORDER = '#dddddd';
const BOX_FILL = '#f7f9fc';

const LOGO_CANDIDATES = [
  resolve(process.cwd(), 'assets/prefeitura-franca-logo.png'),
  resolve(process.cwd(), 'frontend/public/prefeitura-franca-logo.png'),
];

const LIKERT_DEFAULT = ['Péssimo', 'Ruim', 'Regular', 'Bom', 'Ótimo'];

function resolveLogoPath() {
  return LOGO_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

export type VistoriaManualPdfItem = {
  ordem: number;
  codigo: string;
  titulo: string;
  descricao?: string | null;
  tipo: string;
  obrigatorio: boolean;
  exigeEvidencia: boolean;
  geraNaoConformidade: boolean;
  opcoes?: unknown;
};

export type VistoriaManualPdfChamado = {
  codigo: string;
  tipo?: string | null;
  descricao: string;
  status: string;
  prioridade: string;
  abertura: string;
  equipe?: string | null;
  responsavel?: string | null;
  temFoto: boolean;
};

export type VistoriaManualPdfUnidade = {
  nome: string;
  codigoPatrimonial: string;
  tipo: string;
  endereco: string;
  bairro?: string | null;
  secretariaSigla: string;
  secretariaNome: string;
  chamadosPendentes: VistoriaManualPdfChamado[];
};

export type VistoriaManualPdfInput = {
  checklistNome: string;
  checklistVersao: number;
  ondeEncaminharFotos: string;
  geradoEm: string;
  geradoPor?: string | null;
  unidades: VistoriaManualPdfUnidade[];
  itens: VistoriaManualPdfItem[];
};

function ensureSpace(doc: InstanceType<typeof PDFDocument>, y: number, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (y + needed <= bottom) return y;
  doc.addPage();
  return doc.page.margins.top;
}

function drawCheckbox(doc: InstanceType<typeof PDFDocument>, x: number, y: number, size = 10) {
  doc.rect(x, y, size, size).stroke(BORDER);
}

function drawSectionTitle(doc: InstanceType<typeof PDFDocument>, title: string, y: number) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND_PRIMARY).text(title, left, y);
  const nextY = y + 16;
  doc
    .moveTo(left, nextY)
    .lineTo(left + width, nextY)
    .strokeColor(BORDER)
    .stroke();
  return nextY + 10;
}

function drawKeyValue(doc: InstanceType<typeof PDFDocument>, label: string, value: string, x: number, y: number, width: number) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_MUTED).text(label, x, y, { width });
  doc.font('Helvetica').fontSize(9).fillColor(TEXT_PRIMARY).text(value || '—', x, y + 11, { width });
  return y + 28;
}

function drawChamadoBlock(
  doc: InstanceType<typeof PDFDocument>,
  chamado: VistoriaManualPdfChamado,
  y: number,
): number {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const descricaoPreview = chamado.descricao.trim().slice(0, 180) || '—';
  const blockHeight = 62;

  y = ensureSpace(doc, y, blockHeight + 8);

  doc.save();
  doc.roundedRect(left, y, width, blockHeight, 4).fillAndStroke(BOX_FILL, BORDER);
  doc.restore();

  const pad = 8;
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(BRAND_PRIMARY)
    .text(chamado.codigo, left + pad, y + pad, { width: width * 0.35 });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(TEXT_MUTED)
    .text(
      `${chamadoStatusLabel(chamado.status)} · ${prioridadeLabel(chamado.prioridade)}`,
      left + width * 0.35,
      y + pad,
      { width: width * 0.65 - pad, align: 'right' },
    );

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(TEXT_PRIMARY)
    .text(`Tipo: ${chamado.tipo ?? '—'}`, left + pad, y + pad + 14, { width: width - pad * 2 });

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(TEXT_PRIMARY)
    .text(descricaoPreview, left + pad, y + pad + 26, {
      width: width - pad * 2,
      height: 18,
      ellipsis: true,
    });

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(TEXT_MUTED)
    .text(
      `Abertura: ${formatDateBr(chamado.abertura)} · Equipe: ${chamado.equipe ?? '—'} · Responsável: ${chamado.responsavel ?? '—'} · Foto: ${chamado.temFoto ? 'Sim' : 'Não'}`,
      left + pad,
      y + blockHeight - 16,
      { width: width - pad * 2 },
    );

  return y + blockHeight + 6;
}

function parseMcOptions(opcoes: unknown): string[] {
  if (!opcoes || typeof opcoes !== 'object' || Array.isArray(opcoes)) {
    if (Array.isArray(opcoes)) {
      return opcoes.map((item) => String(item).trim()).filter(Boolean);
    }
    return [];
  }
  const raw = (opcoes as { opcoes?: unknown }).opcoes;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item).trim()).filter(Boolean);
}

function parseLikertLabels(opcoes: unknown): string[] {
  const map: Record<string, string> = {
    PESSIMO: 'Péssimo',
    RUIM: 'Ruim',
    REGULAR: 'Regular',
    BOM: 'Bom',
    OTIMO: 'Ótimo',
  };
  if (!opcoes || typeof opcoes !== 'object' || Array.isArray(opcoes)) return LIKERT_DEFAULT;
  const niveis = (opcoes as { niveis?: unknown }).niveis;
  if (!Array.isArray(niveis) || niveis.length === 0) return LIKERT_DEFAULT;
  return niveis.map((nivel) => map[String(nivel)] ?? String(nivel));
}

function isTextoLongo(opcoes: unknown) {
  if (!opcoes || typeof opcoes !== 'object' || Array.isArray(opcoes)) return true;
  return (opcoes as { formato?: string }).formato !== 'CURTO';
}

function estimateOptionRows(doc: InstanceType<typeof PDFDocument>, labels: string[], width: number) {
  doc.font('Helvetica').fontSize(8);
  let x = 0;
  let rows = 1;
  const gap = 12;
  const box = 10;

  for (const label of labels) {
    const labelWidth = Math.min(doc.widthOfString(label) + box + 6, width);
    if (x + labelWidth > width && x > 0) {
      x = 0;
      rows += 1;
    }
    x += labelWidth + gap;
  }

  return rows;
}

function drawOptionRow(
  doc: InstanceType<typeof PDFDocument>,
  labels: string[],
  left: number,
  width: number,
  y: number,
): number {
  let x = left;
  let rowY = y;
  const gap = 12;
  const box = 10;
  const rowHeight = 16;

  doc.font('Helvetica').fontSize(8);

  for (const label of labels) {
    const labelWidth = Math.min(doc.widthOfString(label) + box + 6, width);
    if (x + labelWidth > left + width && x > left) {
      x = left;
      rowY += rowHeight;
      rowY = ensureSpace(doc, rowY, rowHeight);
    }
    drawCheckbox(doc, x, rowY, box);
    doc.font('Helvetica').fontSize(8).fillColor(TEXT_PRIMARY).text(label, x + box + 4, rowY + 1, {
      width: labelWidth - box - 4,
      lineBreak: false,
    });
    x += labelWidth + gap;
  }

  return rowY + rowHeight;
}

function drawAnswerLines(
  doc: InstanceType<typeof PDFDocument>,
  left: number,
  width: number,
  y: number,
  lines: number,
): number {
  for (let i = 0; i < lines; i += 1) {
    y = ensureSpace(doc, y, 16);
    doc
      .moveTo(left, y + 12)
      .lineTo(left + width, y + 12)
      .strokeColor(BORDER)
      .stroke();
    y += 16;
  }
  return y;
}

function resolveOptionLabels(item: VistoriaManualPdfItem): string[] | null {
  const tipo = item.tipo;
  if (tipo === 'BOOLEANO') return ['Sim', 'Não', 'Não aplicável'];
  if (tipo === 'ESCALA_LIKERT') return parseLikertLabels(item.opcoes);
  if (tipo === 'MULTIPLA_ESCOLHA') {
    const options = parseMcOptions(item.opcoes);
    return options.length ? options : ['Opção 1', 'Opção 2', 'Opção 3'];
  }
  if (tipo === 'TEXTO' || tipo === 'NUMERO' || tipo === 'DATA' || tipo === 'FOTO' || tipo === 'ASSINATURA') {
    return null;
  }
  return ['Conforme', 'Não conforme', 'N/A'];
}

function estimateAnswerHeight(doc: InstanceType<typeof PDFDocument>, item: VistoriaManualPdfItem, width: number) {
  const tipo = item.tipo;
  const optionLabels = resolveOptionLabels(item);
  if (optionLabels) {
    return estimateOptionRows(doc, optionLabels, width) * 16 + 4;
  }
  if (tipo === 'TEXTO' || tipo === 'NUMERO' || tipo === 'DATA') {
    const lines = tipo === 'TEXTO' && isTextoLongo(item.opcoes) ? 3 : 1;
    return 12 + lines * 16 + 4;
  }
  if (tipo === 'FOTO' || tipo === 'ASSINATURA') {
    return 16 + 4;
  }
  return 20;
}

function drawPergunta(
  doc: InstanceType<typeof PDFDocument>,
  item: VistoriaManualPdfItem,
  index: number,
  y: number,
): number {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const contentWidth = width - 16;
  const tags: string[] = [];
  if (item.obrigatorio) tags.push('Obrigatório');
  if (item.exigeEvidencia) tags.push('Exige foto');
  if (item.geraNaoConformidade) tags.push('Gera NC');
  const tagLine = tags.length ? ` [${tags.join(' · ')}]` : '';
  const title = `${index + 1}. ${item.codigo} — ${item.titulo}${tagLine}`;
  const tipo = item.tipo;

  doc.font('Helvetica-Bold').fontSize(9);
  const titleHeight = doc.heightOfString(title, { width: contentWidth });
  doc.font('Helvetica').fontSize(8);
  const descHeight = item.descricao
    ? doc.heightOfString(item.descricao, { width: contentWidth })
    : 0;
  const answerHeight = estimateAnswerHeight(doc, item, width);
  const photoHintHeight = item.exigeEvidencia || tipo === 'FOTO' ? 14 : 0;
  const obsHeight = 12 + 18 + 8;
  const blockGap = 6;
  const needed =
    titleHeight +
    4 +
    (descHeight ? descHeight + 4 : 0) +
    answerHeight +
    photoHintHeight +
    obsHeight +
    blockGap;

  // Quebra de página antes do bloco inteiro quando não cabe (evita cortar pergunta no meio).
  y = ensureSpace(doc, y, Math.min(needed, doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 20));

  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT_PRIMARY).text(title, left, y, {
    width: contentWidth,
  });
  y = doc.y + 4;

  if (item.descricao) {
    doc.font('Helvetica').fontSize(8).fillColor(TEXT_MUTED).text(item.descricao, left, y, {
      width: contentWidth,
    });
    y = doc.y + 4;
  }

  const optionLabels = resolveOptionLabels(item);
  if (optionLabels) {
    y = ensureSpace(doc, y, estimateOptionRows(doc, optionLabels, width) * 16);
    y = drawOptionRow(doc, optionLabels, left, width, y);
    y += 2;
  } else if (tipo === 'TEXTO' || tipo === 'NUMERO' || tipo === 'DATA') {
    const lines = tipo === 'TEXTO' && isTextoLongo(item.opcoes) ? 3 : 1;
    y = ensureSpace(doc, y, 12 + lines * 16);
    doc.font('Helvetica').fontSize(8).fillColor(TEXT_MUTED).text('Resposta:', left, y);
    y += 12;
    y = drawAnswerLines(doc, left, width, y, lines);
    y += 2;
  } else if (tipo === 'FOTO' || tipo === 'ASSINATURA') {
    y = ensureSpace(doc, y, 16);
    drawCheckbox(doc, left, y, 10);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(TEXT_PRIMARY)
      .text(tipo === 'ASSINATURA' ? 'Assinatura anexada / registrada' : 'Foto anexada / encaminhada', left + 14, y + 1);
    y += 18;
  }

  if (item.exigeEvidencia || tipo === 'FOTO') {
    y = ensureSpace(doc, y, 14);
    doc
      .font('Helvetica-Oblique')
      .fontSize(7.5)
      .fillColor(BRAND_PRIMARY)
      .text('⚠ Este item exige foto — encaminhar conforme instrução do cabeçalho.', left, y, {
        width,
      });
    y = doc.y + 4;
  }

  y = ensureSpace(doc, y, obsHeight);
  doc.font('Helvetica').fontSize(8).fillColor(TEXT_MUTED).text('Observações:', left, y);
  y += 12;
  doc.rect(left, y, width, 18).stroke(BORDER);
  y += 26;

  return y;
}

function drawUnidadePage(
  doc: InstanceType<typeof PDFDocument>,
  input: VistoriaManualPdfInput,
  unidade: VistoriaManualPdfUnidade,
  pageIndex: number,
) {
  if (pageIndex > 0) {
    doc.addPage();
  }

  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = doc.page.margins.top;

  const logoPath = resolveLogoPath();
  if (logoPath) {
    doc.image(logoPath, left, y, { fit: [90, 32] });
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(BRAND_PRIMARY)
    .text('Vistoria manual — checklist impresso', left + (logoPath ? 100 : 0), y + 4, {
      width: width - (logoPath ? 100 : 0),
    });
  y += logoPath ? 40 : 22;

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(TEXT_MUTED)
    .text(
      `Checklist: ${input.checklistNome} (v${input.checklistVersao}) · Emissão: ${formatDateBr(input.geradoEm)}${input.geradoPor ? ` · Usuário: ${input.geradoPor}` : ''}`,
      left,
      y,
      { width },
    );
  y += 18;

  y = drawSectionTitle(doc, 'Onde encaminhar as fotos', y);
  doc.save();
  doc.roundedRect(left, y, width, 36, 4).fillAndStroke('#fff8e6', BORDER);
  doc.restore();
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(TEXT_PRIMARY)
    .text(input.ondeEncaminharFotos.trim() || '—', left + 8, y + 10, { width: width - 16, height: 20 });
  y += 48;

  y = drawSectionTitle(doc, 'Dados do próprio', y);
  const colW = (width - 12) / 2;
  let leftY = drawKeyValue(doc, 'Nome', unidade.nome, left, y, colW);
  let rightY = drawKeyValue(doc, 'Código patrimonial', unidade.codigoPatrimonial, left + colW + 12, y, colW);
  y = Math.max(leftY, rightY);
  leftY = drawKeyValue(doc, 'Tipo', unidade.tipo, left, y, colW);
  rightY = drawKeyValue(doc, 'Secretaria', `${unidade.secretariaSigla} — ${unidade.secretariaNome}`, left + colW + 12, y, colW);
  y = Math.max(leftY, rightY);
  leftY = drawKeyValue(doc, 'Endereço', unidade.endereco, left, y, colW);
  rightY = drawKeyValue(doc, 'Bairro', unidade.bairro ?? '—', left + colW + 12, y, colW);
  y = Math.max(leftY, rightY) + 4;

  y = drawSectionTitle(doc, 'Dados da vistoria', y);
  leftY = drawKeyValue(doc, 'Checklist', `${input.checklistNome} (v${input.checklistVersao})`, left, y, colW);
  rightY = drawKeyValue(doc, 'Data de emissão', formatDateBr(input.geradoEm), left + colW + 12, y, colW);
  y = Math.max(leftY, rightY);
  leftY = drawKeyValue(doc, 'Usuário', input.geradoPor ?? '—', left, y, colW);
  rightY = drawKeyValue(doc, 'Data da vistoria (preencher)', '____/____/________', left + colW + 12, y, colW);
  y = Math.max(leftY, rightY) + 4;

  y = drawSectionTitle(doc, 'Chamados pendentes do próprio', y);
  if (unidade.chamadosPendentes.length === 0) {
    y = ensureSpace(doc, y, 24);
    doc
      .font('Helvetica-Oblique')
      .fontSize(9)
      .fillColor(TEXT_MUTED)
      .text('Não há chamados pendentes para este próprio.', left, y);
    y += 22;
  } else {
    for (const chamado of unidade.chamadosPendentes) {
      y = drawChamadoBlock(doc, chamado, y);
    }
  }

  y = drawSectionTitle(doc, 'Perguntas do checklist (marque com caneta)', y);
  input.itens.forEach((item, index) => {
    y = drawPergunta(doc, item, index, y);
  });

  y = ensureSpace(doc, y, 70);
  y = drawSectionTitle(doc, 'Assinaturas', y);
  doc.font('Helvetica').fontSize(8).fillColor(TEXT_PRIMARY);
  doc.text('Agente / vistoriador: ________________________________  Data: ____/____/________', left, y);
  y += 18;
  doc.text('Responsável pelo próprio: ______________________________  Data: ____/____/________', left, y);
}

export function buildVistoriaManualPdf(input: VistoriaManualPdfInput): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (input.unidades.length === 0) {
      doc.font('Helvetica').fontSize(12).fillColor(TEXT_PRIMARY).text('Nenhum próprio selecionado.', 40, 40);
      doc.end();
      return;
    }

    input.unidades.forEach((unidade, index) => {
      drawUnidadePage(doc, input, unidade, index);
    });

    doc.end();
  });
}
