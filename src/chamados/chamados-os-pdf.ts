import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { formatDateBr, prioridadeLabel } from './chamados-sla';

export type OsPdfChamado = {
  codigo: string;
  tipo?: string | null;
  prioridade: string;
  descricao: string;
  endereco: string;
  equipe?: string | null;
  prazoSla?: string | null;
  fotoUrl?: string | null;
};

const BRAND_PRIMARY = '#0066cc';
const TEXT_PRIMARY = '#1a1a1a';
const TEXT_MUTED = '#555555';
const BORDER = '#dddddd';

const LOGO_CANDIDATES = [
  resolve(process.cwd(), 'assets/prefeitura-franca-logo.png'),
  resolve(process.cwd(), 'frontend/public/prefeitura-franca-logo.png'),
];

function resolveLogoPath() {
  return LOGO_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

function drawOsBlock(doc: InstanceType<typeof PDFDocument>, chamado: OsPdfChamado, y: number, height: number) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.save();
  doc.rect(left, y, width, height).stroke(BORDER);
  doc.restore();

  let cursorY = y + 10;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND_PRIMARY).text(`Ordem de Serviço — ${chamado.codigo}`, left + 10, cursorY);
  cursorY += 16;

  doc.font('Helvetica').fontSize(8).fillColor(TEXT_MUTED);
  doc.text(`Tipo: ${chamado.tipo ?? '—'}  ·  Prioridade: ${prioridadeLabel(chamado.prioridade)}`, left + 10, cursorY);
  cursorY += 12;
  doc.text(`Equipe: ${chamado.equipe ?? '—'}  ·  Prazo SLA: ${chamado.prazoSla ? formatDateBr(chamado.prazoSla) : '—'}`, left + 10, cursorY);
  cursorY += 14;

  doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_PRIMARY).text('Descrição', left + 10, cursorY);
  cursorY += 10;
  doc.font('Helvetica').fontSize(8).fillColor(TEXT_PRIMARY).text(chamado.descricao.slice(0, 280), left + 10, cursorY, {
    width: width - 20,
    height: 30,
  });
  cursorY += 34;

  doc.font('Helvetica-Bold').fontSize(8).text('Endereço', left + 10, cursorY);
  cursorY += 10;
  doc.font('Helvetica').fontSize(8).text(chamado.endereco.slice(0, 120), left + 10, cursorY, { width: width - 20 });

  const manualY = y + height - 100;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_PRIMARY).text('Situação', left + 10, manualY);
  doc.font('Helvetica').fontSize(8).text('( ) Executado     ( ) Não executado', left + 10, manualY + 12);
  doc.font('Helvetica-Bold').text('Motivo / observações', left + 10, manualY + 28);
  doc.rect(left + 10, manualY + 42, width - 20, 50).stroke(BORDER);
}

export function buildOrdensServicoLotePdf(chamados: OsPdfChamado[]): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'portrait' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const usableHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
    const blockHeight = (usableHeight - 8) / 2;

    chamados.forEach((chamado, index) => {
      if (index > 0 && index % 2 === 0) {
        doc.addPage({ size: 'A4', layout: 'portrait', margin: 36 });
      }

      const slot = index % 2;
      const blockY = doc.page.margins.top + slot * (blockHeight + 8);

      if (index === 0) {
        const logoPath = resolveLogoPath();
        if (logoPath) {
          doc.image(logoPath, left, blockY, { fit: [100, 36] });
        }
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor(BRAND_PRIMARY)
          .text('Ordens de Serviço — Lote', left, blockY + (logoPath ? 40 : 0));
        drawOsBlock(doc, chamado, blockY + (logoPath ? 58 : 18), blockHeight - (logoPath ? 58 : 18));
      } else {
        drawOsBlock(doc, chamado, blockY, blockHeight);
      }
    });

    doc.end();
  });
}
