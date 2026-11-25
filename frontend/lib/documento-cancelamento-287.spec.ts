import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CANCELAR_DOCUMENTO_SNACKBAR,
  CANCELAR_DOCUMENTO_TEXTO,
  documentoSomenteLeitura,
  mostrarBotaoCancelarDocumento,
  rotuloCancelamento,
  tituloCancelarDocumento,
} from './documento-cancelamento';

const raiz = join(__dirname, '..');
const pagina = readFileSync(join(raiz, 'app/(authenticated)/documentos/page.tsx'), 'utf8');
const dialogo = readFileSync(join(raiz, 'components/documentos/cancelar-documento-dialog.tsx'), 'utf8');
const api = readFileSync(join(raiz, 'lib/api.ts'), 'utf8');

describe('287 · regras do front', () => {
  it('textos exatos da UX', () => {
    expect(tituloCancelarDocumento('DOC-1')).toBe('Cancelar documento DOC-1?');
    expect(CANCELAR_DOCUMENTO_TEXTO).toBe('O documento sai das pendências, mas continua no histórico.');
    expect(CANCELAR_DOCUMENTO_SNACKBAR).toBe('Documento cancelado.');
  });
  it('botão só com podeCancelar e documento não final', () => {
    expect(mostrarBotaoCancelarDocumento({ situacao: 'GERADO', podeCancelar: true })).toBe(true);
    expect(mostrarBotaoCancelarDocumento({ situacao: 'GERADO', podeCancelar: false })).toBe(false);
    expect(mostrarBotaoCancelarDocumento({ situacao: 'GERADO' })).toBe(false);
    for (const s of ['CANCELADO', 'SUBSTITUIDO', 'INVALIDO']) {
      expect(mostrarBotaoCancelarDocumento({ situacao: s, podeCancelar: true })).toBe(false);
    }
  });
  it('cancelado é somente leitura', () => {
    expect(documentoSomenteLeitura({ situacao: 'CANCELADO' })).toBe(true);
    expect(documentoSomenteLeitura({ situacao: 'RASCUNHO' })).toBe(false);
  });
  it('rótulo traz data (horário SP) e usuário', () => {
    const r = rotuloCancelamento({ situacao: 'CANCELADO', cancelamento: { em: '2026-10-15T13:20:00Z', por: { nome: 'Ana' } } });
    expect(r).toContain('15/10/2026');
    expect(r).toContain('10:20');
    expect(r).toContain('Ana');
    expect(rotuloCancelamento({ situacao: 'GERADO', cancelamento: null })).toBeNull();
  });
});

describe('287 · contrato da tela', () => {
  it('lista: badge cinza --ink-3 com data-testid, data/usuário, sem riscado', () => {
    const bloco = pagina.slice(pagina.indexOf("item.situacao === 'CANCELADO'"), pagina.indexOf("item.situacao === 'CANCELADO'") + 800);
    expect(bloco).toContain('data-testid="badge-cancelado"');
    expect(bloco).toContain('text-[var(--ink-3)]');
    expect(bloco).toContain('rotuloCancelamento(item)');
    expect(pagina).not.toMatch(/line-through/);
  });
  it('toggle de histórico envia historico=1', () => {
    expect(pagina).toContain('Mostrar histórico (cancelados)');
    expect(pagina.match(/historico: historico \? '1' : undefined/g)?.length).toBe(2);
    expect(api).toContain("query.set('historico', params.historico)");
  });
  it('botão danger "Cancelar documento" condicionado a mostrarBotaoCancelarDocumento', () => {
    const i = pagina.indexOf('mostrarBotaoCancelarDocumento(documento) ?');
    expect(i).toBeGreaterThan(0);
    const bloco = pagina.slice(i, i + 500);
    expect(bloco).toContain('text-[var(--danger)]');
    expect(bloco).toContain('Cancelar documento');
  });
  it('detalhe cancelado: ações de edição sob editavel', () => {
    for (const marca of ['podePreencherAvulso ?', 'podeGerarPdfOriginal ?', 'onColetar}', 'onPendente}', 'onAssinarInterno}', 'onDisponibilizar}']) {
      const i = pagina.lastIndexOf(marca);
      expect(i, marca).toBeGreaterThan(0);
      const antes = pagina.slice(Math.max(0, i - 400), i);
      expect(antes, marca).toContain('editavel &&');
    }
    expect(pagina).toContain('podeEditarChamados: false');
  });
  it('modal: Voltar recebe foco, confirmação vermelha, motivo opcional, snackbar', () => {
    expect(dialogo).toContain('voltarRef.current?.focus()');
    expect(dialogo).toMatch(/ref=\{voltarRef\}[\s\S]*Voltar/);
    expect(dialogo).toContain('bg-[var(--danger)]');
    expect(dialogo).toContain('Motivo (opcional)');
    expect(dialogo).not.toMatch(/required/);
    expect(pagina).toContain('cancelarDocumento(detail.id, motivo), CANCELAR_DOCUMENTO_SNACKBAR');
    expect(api).toContain('`/documentos/${id}/cancelar`');
  });
});
