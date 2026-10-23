import { describe, expect, it } from 'vitest';
import { agruparResponsaveis, avisoRegularizacao, bloqueioSalvar, pendentesRegularizacao } from './cronograma-responsaveis';

const A = { id: 'a', nome: 'A', sigla: 'A' };
const B = { id: 'b', nome: 'B', sigla: 'B' };
const u = (id: string, secretarias: (typeof A)[]) => ({ id, nome: id, email: '', cpf: null, cargo: null, secretarias });

describe('307 — responsáveis (front, puro)', () => {
  it('"Todas": agrupa por Secretaria e não duplica quem tem 2 vínculos', () => {
    const g = agruparResponsaveis([u('x', [A, B]), u('y', [B]), u('x', [A, B])], true);
    expect(g.map((x) => x.titulo)).toEqual(['A', 'B']);
    expect(g.flatMap((x) => x.usuarios.map((y) => y.id))).toEqual(['x', 'y']);
  });
  it('Secretaria ativa: lista única', () => {
    expect(agruparResponsaveis([u('x', [A])], false)).toHaveLength(1);
  });
  it('pendentes e bloqueio só após troca de contexto (R5) e sem confirmação', () => {
    const p = pendentesRegularizacao(['a', 'b', 'c'], { a: 'OK', b: 'INATIVO', c: 'OUTRA_SECRETARIA' });
    expect(p).toEqual(['b', 'c']);
    expect(bloqueioSalvar({ pendentes: 2, escopoTrocado: false, confirmado: false })).toBe(false);
    expect(bloqueioSalvar({ pendentes: 2, escopoTrocado: true, confirmado: false })).toBe(true);
    expect(bloqueioSalvar({ pendentes: 2, escopoTrocado: true, confirmado: true })).toBe(false);
    expect(avisoRegularizacao(1)).toBe('1 responsável precisa ser regularizado.');
  });
});
