import { afterEach, describe, expect, it, vi } from 'vitest';
import { listChamados, listChamadosMapa } from './api';

const urls: string[] = [];
vi.stubGlobal('fetch', vi.fn(async (url: string) => {
  urls.push(url);
  return new Response(JSON.stringify({ items: [], total: 0, truncado: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}));
afterEach(() => { urls.length = 0; });
const query = (u: string) => new URL(u, 'http://x').searchParams;

describe('295 · cliente da API', () => {
  it('chamados-mapa: rápido manda só diasMinimos; status continua em array', async () => {
    const r = await listChamadosMapa({ status: ['ABERTO', 'EM_EXECUCAO'], abertura: { rapido: 30, ate: '2026-09-16' } });
    const q = query(urls[0]);
    expect(urls[0]).toContain('/operacional/chamados-mapa?');
    expect(q.get('diasMinimos')).toBe('30');
    expect([q.has('abertoAte'), q.has('abertura'), q.getAll('status')]).toEqual([false, false, ['ABERTO', 'EM_EXECUCAO']]);
    expect(r).toEqual({ items: [], total: 0, truncado: false });
  });
  it('chamados-mapa e chamados: período manual em abertoDe/abertoAte', async () => {
    await listChamadosMapa({ abertura: { de: '2026-09-01', ate: '2026-09-30' } });
    await listChamados({ abertoDe: '2026-09-01', abertoAte: '2026-09-30', diasMinimos: undefined });
    for (const u of urls) {
      expect([query(u).get('abertoDe'), query(u).get('abertoAte'), query(u).has('diasMinimos')]).toEqual(['2026-09-01', '2026-09-30', false]);
    }
    await listChamados({ diasMinimos: '45' });
    expect(query(urls[2]).get('diasMinimos')).toBe('45');
  });
});
