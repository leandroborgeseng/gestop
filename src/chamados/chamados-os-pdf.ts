import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { formatDateBr, prioridadeLabel } from './chamados-sla';

export type OsPdfFuncionario = {
  nome: string;
  cargo?: string | null;
};

export type OsPdfChamado = {
  codigo: string;
  tipo?: string | null;
  prioridade: string;
  descricao: string;
  endereco: string;
  equipe?: string | null;
  funcionarios?: OsPdfFuncionario[];
  prazoSla?: string | null;
  fotoUrl?: string | null;
  abertoEm?: string | null;
  programadoEm?: string | null;
};

export type OsPdfOptions = {
  titulo: string;
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

function formatFuncionarioLine(item: OsPdfFuncionario) {
  const cargo = item.cargo?.trim();
  return cargo ? `( ) ${item.nome} — ${cargo}` : `( ) ${item.nome}`;
}

function drawOsBlock(doc: InstanceType<typeof PDFDocument>, chamado: OsPdfChamado, y: number, height: number) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const contentLeft = left + 10;
  const contentWidth = width - 20;

  doc.save();
  doc.rect(left, y, width, height).stroke(BORDER);
  doc.restore();

  let cursorY = y + 10;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND_PRIMARY).text(`Ordem de Serviço — ${chamado.codigo}`, contentLeft, cursorY);
  cursorY += 16;

  doc.font('Helvetica').fontSize(8).fillColor(TEXT_MUTED);
  doc.text(`Tipo: ${chamado.tipo ?? '—'}  ·  Prioridade: ${prioridadeLabel(chamado.prioridade)}`, contentLeft, cursorY);
  cursorY += 12;
  doc.text(`Equipe: ${chamado.equipe ?? '—'}  ·  Prazo SLA: ${chamado.prazoSla ? formatDateBr(chamado.prazoSla) : '—'}`, contentLeft, cursorY);
  cursorY += 12;
  doc.text(
    `Abertura: ${chamado.abertoEm ? formatDateBr(chamado.abertoEm) : '—'}  ·  Programado: ${chamado.programadoEm ? formatDateBr(chamado.programadoEm) : '—'}`,
    contentLeft,
    cursorY,
  );
  cursorY += 14;

  doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_PRIMARY).text('Descrição', contentLeft, cursorY);
  cursorY += 10;
  doc.font('Helvetica').fontSize(8).fillColor(TEXT_PRIMARY).text(chamado.descricao.slice(0, 220), contentLeft, cursorY, {
    width: contentWidth,
    height: 24,
  });
  cursorY += 28;

  doc.font('Helvetica-Bold').fontSize(8).text('Endereço', contentLeft, cursorY);
  cursorY += 10;
  doc.font('Helvetica').fontSize(8).text(chamado.endereco.slice(0, 120), contentLeft, cursorY, { width: contentWidth });
  cursorY += 16;

  const bottomLimit = y + height - 8;
  const manualStart = Math.min(cursorY + 4, bottomLimit - 168);

  doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_PRIMARY).text('Situação', contentLeft, manualStart);
  doc.font('Helvetica').fontSize(8).text('( ) Executado     ( ) Não executado', contentLeft, manualStart + 11);

  doc.font('Helvetica-Bold').text('Motivo / observações', contentLeft, manualStart + 26);
  doc.rect(contentLeft, manualStart + 38, contentWidth, 28).stroke(BORDER);

  let teamY = manualStart + 72;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_PRIMARY).text('Equipe executora / Funcionários da equipe', contentLeft, teamY);
  teamY += 11;

  const funcionarios = chamado.funcionarios ?? [];
  if (funcionarios.length === 0) {
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(TEXT_MUTED).text('Nenhum funcionário vinculado à equipe', contentLeft, teamY);
    teamY += 11;
  } else {
    doc.font('Helvetica').fontSize(7.5).fillColor(TEXT_PRIMARY);
    for (const funcionario of funcionarios.slice(0, 8)) {
      if (teamY > bottomLimit - 52) break;
      doc.text(formatFuncionarioLine(funcionario), contentLeft, teamY, { width: contentWidth });
      teamY += 10;
    }
    if (funcionarios.length > 8) {
      doc.font('Helvetica-Oblique').fontSize(7).fillColor(TEXT_MUTED).text(`(+ ${funcionarios.length - 8} integrante(s) — anotar no verso)`, contentLeft, teamY);
      teamY += 10;
    }
  }

  doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_PRIMARY).text('Outros funcionários:', contentLeft, teamY);
  teamY += 11;
  doc.font('Helvetica').fontSize(7.5).fillColor(TEXT_PRIMARY);
  doc.text('1) ________________________  2) ________________________  3) ________________________', contentLeft, teamY, {
    width: contentWidth,
  });
  teamY += 14;

  doc.font('Helvetica-Bold').fontSize(8).text('Assinatura do responsável pela execução:', contentLeft, teamY);
  teamY += 11;
  doc.font('Helvetica').fontSize(8).text('________________________________', contentLeft, teamY);
  teamY += 12;
  doc.text('Nome: ________________________________', contentLeft, teamY);
}

export function buildOrdensServicoLotePdf(chamados: OsPdfChamado[], options?: OsPdfOptions): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'portrait' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const usableHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
    // Mantém 2 OS/página; bloco um pouco mais alto para acomodar equipe/assinatura.
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
          .text(options?.titulo ?? 'Ordens de Serviço — Lote', left, blockY + (logoPath ? 40 : 0));
        drawOsBlock(doc, chamado, blockY + (logoPath ? 58 : 18), blockHeight - (logoPath ? 58 : 18));
      } else {
        drawOsBlock(doc, chamado, blockY, blockHeight);
      }
    });

    doc.end();
  });
}
