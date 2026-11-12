import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = resolve(__dirname, '../..');
const specs = [
  'frontend/e2e/321-cco-barra-lateral.spec.ts',
  'frontend/e2e/322-tela-inicial.spec.ts',
  'frontend/e2e/322-regressao-menus.spec.ts',
  'frontend/e2e/322-l1-estado-url.spec.ts',
];

describe('evidências 321 e 322', () => {
  it('grava fora do git e não mexe na pasta evidencias versionada', () => {
    const ignore = readFileSync(resolve(raiz, '.gitignore'), 'utf8');
    expect(ignore).toContain('frontend/test-results/');
    for (const spec of specs) {
      const texto = readFileSync(resolve(raiz, spec), 'utf8');
      expect(texto).toContain("pastaEvidencias(");
      expect(texto).not.toContain('evidencias/321');
      expect(texto).not.toContain('evidencias/322');
    }
  });
});
