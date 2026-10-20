import { describe, expect, it } from 'vitest';
import { dataHoraBrt } from './webmap-camadas.service';

describe('296 · A3 · dataHoraBrt', () => {
  it('dd/mm/aaaa HH:mm:ss (BRT), sem vírgula, em America/Sao_Paulo', () => {
    expect(dataHoraBrt(new Date('2026-10-20T19:23:05Z'))).toBe('20/10/2026 16:23:05 (BRT)');
    expect(dataHoraBrt(new Date('2026-01-02T03:04:05Z'))).toBe('02/01/2026 00:04:05 (BRT)');
    expect(dataHoraBrt(new Date())).not.toContain(',');
  });
});
