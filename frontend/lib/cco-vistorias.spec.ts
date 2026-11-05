import { describe, expect, it } from 'vitest';
import { ordenarVistoriasRecentes, rotuloCardVistoria } from './cco-vistorias';
import { hrefVistoriaRealizada, lerIdVistoriaDaUrl } from './vistoria-deep-link';

const v = (id: string, concluidaEm: string | null, iniciadaEm: string | null = null) => ({
  id,
  concluidaEm,
  iniciadaEm,
  checklistVersao: { versao: 3, checklist: { nome: 'ZZTESTE Checklist' } },
});

describe('#311 CCO-V13 — ordem da aba Vistorias', () => {
  it('mais recente → mais antiga; usa iniciadaEm sem conclusão; sem data no fim', () => {
    const out = ordenarVistoriasRecentes([
      v('a', '2026-01-01T12:00:00Z'),
      v('sem', null),
      v('c', '2026-03-01T12:00:00Z'),
      v('b', null, '2026-02-01T12:00:00Z'),
    ]);
    expect(out.map((x) => x.id)).toEqual(['c', 'b', 'a', 'sem']);
  });
});

describe('#311 microcopy do card', () => {
  it('aria-label segue o esboço UX', () => {
    expect(rotuloCardVistoria(v('a', '2026-11-05T15:00:00Z'))).toBe('Abrir vistoria ZZTESTE Checklist v3, 05/11/2026');
  });
});

describe('#311 CCO-V1 — deep-link por id', () => {
  const id = '3f2b8c1e-1a2b-4c3d-9e8f-0a1b2c3d4e5f';
  it('href e leitura batem no mesmo id', () => {
    const href = hrefVistoriaRealizada(id);
    expect(href).toBe(`/vistorias?id=${id}`);
    expect(lerIdVistoriaDaUrl(href.slice(href.indexOf('?')))).toBe(id);
  });
  it('ignora id inválido', () => {
    expect(lerIdVistoriaDaUrl('?id=../../x')).toBeNull();
    expect(lerIdVistoriaDaUrl('')).toBeNull();
  });
});
