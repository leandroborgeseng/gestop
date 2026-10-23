import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { JwtPayload } from './jwt';
import { normalizarSecretariaIds, resolveSecretariaFiltroEscopo, secretariaIdsDaQuery } from './secretaria-scope';

const gestorA = { sub: 'u', permissoes: [], secretariaId: 'A', secretariasIds: ['A'] } as unknown as JwtPayload;
const admin = { sub: 'adm', permissoes: ['usuarios.gerenciar'], acessoTodasSecretarias: true } as unknown as JwtPayload;

describe('R3 (306) — secretariaId sempre como array', () => {
  it('normaliza valor único, repetido e vazio; outro tipo → 400', () => {
    expect(normalizarSecretariaIds(undefined)).toEqual([]);
    expect(normalizarSecretariaIds(' A ')).toEqual(['A']);
    expect(normalizarSecretariaIds(['A', 'A', '', 'B'])).toEqual(['A', 'B']);
    expect(() => normalizarSecretariaIds({ x: 1 })).toThrow(BadRequestException);
    expect(() => normalizarSecretariaIds([1])).toThrow(BadRequestException);
  });
  it('lê secretariaId e secretariaId[] da query', () => {
    expect(secretariaIdsDaQuery({ secretariaId: 'A' })).toEqual(['A']);
    expect(secretariaIdsDaQuery({ secretariaId: ['A', 'B'] })).toEqual(['A', 'B']);
    expect(secretariaIdsDaQuery({ 'secretariaId[]': 'B' })).toEqual(['B']);
    expect(secretariaIdsDaQuery({ secretariaId: 'A', 'secretariaId[]': ['A', 'B'] })).toEqual(['A', 'B']);
    expect(secretariaIdsDaQuery({})).toEqual([]);
    // F2: chaves indexadas ou nomeadas → 400
    expect(() => secretariaIdsDaQuery({ 'secretariaId[x]': 'A' })).toThrow(BadRequestException);
    expect(() => secretariaIdsDaQuery({ 'secretariaId[0]': 'A' })).toThrow(BadRequestException);
  });
  it('mesma resposta para as 3 formas: fora do escopo → 403; dentro → array', () => {
    for (const forma of [['B'], 'B', ['A', 'B']]) {
      expect(() => resolveSecretariaFiltroEscopo(gestorA, forma)).toThrow(ForbiddenException);
    }
    expect(resolveSecretariaFiltroEscopo(gestorA, ['A', 'A'])).toEqual(['A']);
    expect(resolveSecretariaFiltroEscopo(gestorA, [])).toEqual(['A']);
    expect(resolveSecretariaFiltroEscopo(admin, ['A', 'B'])).toEqual(['A', 'B']);
    expect(resolveSecretariaFiltroEscopo(admin, [])).toBeUndefined();
  });
});
