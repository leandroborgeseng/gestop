import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { JwtPayload } from '../auth/jwt';
import { OperacionalService } from './operacional.service';

// Dados sintéticos (314).
const SEC_A = '00000000-0000-4000-8000-0000000000a1';
const SEC_B = '00000000-0000-4000-8000-0000000000b1';
const UN_B = { id: 'un-b', secretariaId: SEC_B };

function makeService() {
  const findFirst = vi.fn(async ({ where }: any) => {
    if (where.id !== UN_B.id) return null;
    const s = where.secretariaId;
    if (typeof s === 'string' && s !== UN_B.secretariaId) return null;
    if (s?.in && !s.in.includes(UN_B.secretariaId)) return null;
    if (where.id?.in) return null;
    throw new Error('stop-after-where'); // escopo aceito: o resto do mapeamento não interessa aqui
  });
  const service = new OperacionalService({ unidadePublica: { findFirst } } as never);
  return { service, findFirst };
}
const u = (over: Partial<JwtPayload>) => ({ sub: 'x', email: 'zz@aion.local', nome: 'ZZ', perfis: [], permissoes: ['dashboard.visualizar'], ...over }) as JwtPayload;

describe('314 · página completa do próprio respeita a Secretaria', () => {
  it('usuário só da Secretaria A recebe 404 ao abrir próprio da B pelo id', async () => {
    const { service } = makeService();
    await expect(service.getUnidadeDetalhe(UN_B.id, u({ secretariaId: SEC_A, secretariasIds: [SEC_A] }))).rejects.toBeInstanceOf(NotFoundException);
  });
  it('usuário sem Secretaria também não abre', async () => {
    const { service } = makeService();
    await expect(service.getUnidadeDetalhe(UN_B.id, u({}))).rejects.toBeInstanceOf(NotFoundException);
  });
  it('usuário da B e administrador global passam pelo filtro de escopo', async () => {
    const { service, findFirst } = makeService();
    await expect(service.getUnidadeDetalhe(UN_B.id, u({ secretariaId: SEC_B, secretariasIds: [SEC_B] }))).rejects.toThrow('stop-after-where');
    await expect(service.getUnidadeDetalhe(UN_B.id, u({ permissoes: ['usuarios.gerenciar'] }))).rejects.toThrow('stop-after-where');
    expect(findFirst.mock.calls[1][0].where).toEqual({ id: UN_B.id });
  });
});
