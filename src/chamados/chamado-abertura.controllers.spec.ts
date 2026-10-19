import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ChamadosController } from './chamados.controller';
import { OperacionalController } from '../operacional/operacional.controller';

/**
 * 295 · T24: os três parâmetros do filtro de Data de abertura chegam ao service nos dois endpoints
 * (GET /chamados — Triagem; GET /operacional/chamados-mapa — CCO).
 */
const user = { sub: 'u1' } as never;
const u = undefined;

describe('295 · controllers repassam abertoDe / abertoAte / diasMinimos ao service', () => {
  it('GET /chamados (Triagem): período', () => {
    const listChamados = vi.fn().mockReturnValue('ok');
    const c = new ChamadosController({ listChamados } as never);
    // limit, offset, all, search, statuses, prioridade, sla, atribuicao, equipeId, secProprio, secExec, tipo, incluirExcluidos, abertoDe, abertoAte, diasMinimos
    expect(c.list(user, u, u, u, u, u, u, u, u, u, u, u, u, u, '2026-09-01', '2026-09-30', u)).toBe('ok');
    expect(listChamados).toHaveBeenCalledTimes(1);
    const [q, quem] = listChamados.mock.calls[0];
    expect(q).toMatchObject({ abertoDe: '2026-09-01', abertoAte: '2026-09-30', diasMinimos: undefined });
    expect(quem).toBe(user);
  });
  it('GET /chamados (Triagem): diasMinimos', () => {
    const listChamados = vi.fn();
    const c = new ChamadosController({ listChamados } as never);
    c.list(user, u, u, u, u, u, u, u, u, u, u, u, u, u, u, u, '30');
    expect(listChamados.mock.calls[0][0]).toMatchObject({ abertoDe: undefined, abertoAte: undefined, diasMinimos: '30' });
  });
  it('GET /operacional/chamados-mapa (CCO): período', () => {
    const listChamadosMapa = vi.fn().mockReturnValue('ok');
    const c = new OperacionalController({ listChamadosMapa } as never);
    // search, status, prioridade, tipoChamadoId, equipeIds, sla, bairro, bairros, comUnidade, abertoDe, abertoAte, diasMinimos
    expect(c.listChamadosMapa(user, u, u, u, u, u, u, u, u, u, '2026-09-01', '2026-09-30', u)).toBe('ok');
    const [q, quem] = listChamadosMapa.mock.calls[0];
    expect(q).toMatchObject({ abertoDe: '2026-09-01', abertoAte: '2026-09-30' });
    expect(q.diasMinimos).toBeUndefined();
    expect(quem).toBe(user);
  });
  it('GET /operacional/chamados-mapa (CCO): diasMinimos', () => {
    const listChamadosMapa = vi.fn();
    const c = new OperacionalController({ listChamadosMapa } as never);
    c.listChamadosMapa(user, u, u, u, u, u, u, u, u, u, u, u, '90');
    const q = listChamadosMapa.mock.calls[0][0];
    expect(q.diasMinimos).toBe('90');
    expect(q.abertoDe).toBeUndefined();
    expect(q.abertoAte).toBeUndefined();
  });
});
