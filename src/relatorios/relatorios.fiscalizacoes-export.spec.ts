import { describe, expect, it } from 'vitest';
import { FISCALIZACOES_EXPORT_HEADERS } from './relatorios.fiscalizacoes-export';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('export CSV/XLSX de fiscalizações', () => {
  it('não inclui respostas de checklist (só metadados da vistoria)', () => {
    expect(FISCALIZACOES_EXPORT_HEADERS).not.toContain('valorTexto');
    expect(FISCALIZACOES_EXPORT_HEADERS).not.toContain('resposta');
    const src = readFileSync(resolve('src/relatorios/relatorios.fiscalizacoes-export.ts'), 'utf8');
    expect(src).not.toContain('valorTexto');
    expect(src).toContain('unidade_codigo');
  });
});
