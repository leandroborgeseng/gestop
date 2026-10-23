import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { JwtPayload } from './jwt';
import { resolveSecretariaFiltroEscopo, whereSecretariaIdIn } from './secretaria-scope';
import { escopoDashboard } from '../monitoramento/dashboard-escopo';

const base = { sub: 'u', nome: 'Fictício', email: 'f@teste306.invalid', perfis: [] as string[] };
const adminTodas: JwtPayload = { ...base, permissoes: ['usuarios.gerenciar'], secretariaId: null, acessoTodasSecretarias: true };
const gestorA: JwtPayload = { ...base, permissoes: ['dashboard.visualizar'], secretariaId: 'sec-a', secretariasIds: ['sec-a'] };
const semSecretaria: JwtPayload = { ...base, permissoes: ['dashboard.visualizar'], secretariaId: null, secretariasIds: [] };

describe('306 — resolveSecretariaFiltroEscopo (função única)', () => {
  it('sem filtro: escopo da sessão', () => {
    expect(resolveSecretariaFiltroEscopo(adminTodas)).toBeUndefined();
    expect(resolveSecretariaFiltroEscopo(gestorA)).toEqual(['sec-a']);
    expect(resolveSecretariaFiltroEscopo(semSecretaria)).toEqual([]);
  });
  it('filtro dentro do escopo refina; fora → 403', () => {
    expect(resolveSecretariaFiltroEscopo(gestorA, 'sec-a')).toEqual(['sec-a']);
    expect(() => resolveSecretariaFiltroEscopo(gestorA, 'sec-b')).toThrow(ForbiddenException);
    expect(() => resolveSecretariaFiltroEscopo(semSecretaria, 'sec-a')).toThrow(ForbiddenException);
    expect(resolveSecretariaFiltroEscopo(adminTodas, 'sec-b')).toEqual(['sec-b']);
    expect(resolveSecretariaFiltroEscopo(gestorA, '  ')).toEqual(['sec-a']);
  });
  it('wheres por entidade; [] nunca vira "sem filtro"', () => {
    expect(whereSecretariaIdIn(undefined)).toEqual({});
    expect(whereSecretariaIdIn([])).toEqual({ secretariaId: { in: [] } });
    const e = escopoDashboard(['sec-a']);
    expect(e.naoConformidade()).toEqual({ fiscalizacao: { secretariaId: { in: ['sec-a'] } } });
    expect(e.secretaria()).toEqual({ id: { in: ['sec-a'] } });
    expect(e.auditoria()).toEqual({ secretariaAtivaId: { in: ['sec-a'] } });
    expect(escopoDashboard([]).syncEvent()).not.toEqual({});
    expect(escopoDashboard(undefined).syncEvent()).toEqual({});
  });
});
