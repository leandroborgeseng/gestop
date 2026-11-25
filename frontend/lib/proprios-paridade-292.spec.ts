import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasAdminTabAccess } from './permissions-matrix';

type Caso = { nome: string; permissoes: string[]; acao: 'visualizar' | 'inserir' | 'alterar' | 'excluir'; esperado: boolean };
const { casos } = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../test/fixtures/proprios-paridade-292.json'), 'utf8'),
) as { casos: Caso[] };

describe('292 · paridade Próprios (front) · tabela compartilhada com a API', () => {
  it('tabela tem os três casos de cadastros.* com proprios.visualizar', () => {
    for (const acao of ['alterar', 'inserir', 'excluir']) {
      expect(casos.some((c) => c.acao === acao && c.permissoes.includes(`matriz.admin.cadastros.${acao}`) && !c.esperado)).toBe(true);
    }
  });
  for (const c of casos) {
    it(c.nome, () => expect(hasAdminTabAccess('proprios', c.acao, c.permissoes)).toBe(c.esperado));
  }
});
