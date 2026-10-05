import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('fiscalizacoes.service monta o PDF pelo formatador real', () => {
  it('importa resolveRespostaTexto e não devolve valorTexto cru', () => {
    const src = readFileSync(resolve('src/fiscalizacoes/fiscalizacoes.service.ts'), 'utf8');
    expect(src).toContain("from '../checklists/checklist-resposta-apresentacao'");
    expect(src).toContain('respostaTexto: resolveRespostaTexto(resposta)');
    expect(src).not.toMatch(/if \(resposta\.valorTexto\?\.trim\(\)\) return resposta\.valorTexto\.trim\(\)/);
  });
});
