import { describe, expect, it } from 'vitest';
import { formatRespostaValor, deveExibirCabecalhoSecao } from './checklist-item-opcoes';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('tela de detalhe da vistoria e leitura de documento', () => {
  it('formatRespostaValor cobre múltipla nova, única antiga e vazia', () => {
    expect(formatRespostaValor({ valorTexto: '["Bom","Ótimo"]' })).toBe('Bom, Ótimo');
    expect(formatRespostaValor({ valorTexto: 'Regular' })).toBe('Regular');
    expect(formatRespostaValor({})).toBe('—');
  });

  it('agrupa seção só no primeiro item consecutivo', () => {
    expect(deveExibirCabecalhoSecao('Infraestrutura básica', undefined)).toBe(true);
    expect(deveExibirCabecalhoSecao('Infraestrutura básica', 'Infraestrutura básica')).toBe(false);
  });

  it('vistorias/page.tsx usa formatRespostaValor e não concatena código no título da pergunta', () => {
    const src = readFileSync(resolve('frontend/app/(authenticated)/vistorias/page.tsx'), 'utf8');
    expect(src).toContain('formatRespostaValor');
    expect(src).not.toMatch(/item\.codigo} — \{resposta\.item\.titulo/);
  });

  it('DocumentoAvulsoRespostasLeitura usa formatRespostaValor', () => {
    const src = readFileSync(resolve('frontend/components/documentos/documento-avulso-form.tsx'), 'utf8');
    expect(src).toContain('formatRespostaValor');
  });

  it('histórico da execução (chamado-status) usa formatRespostaValor', () => {
    const src = readFileSync(resolve('frontend/lib/chamado-status.ts'), 'utf8');
    expect(src).toContain('formatRespostaValor');
  });

  it('CCO da unidade formata valor da resposta da NC', () => {
    const src = readFileSync(resolve('frontend/app/(authenticated)/cco/unidades/[id]/page.tsx'), 'utf8');
    expect(src).toContain('formatRespostaValor');
  });
});
