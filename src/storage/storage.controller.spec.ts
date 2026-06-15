import { describe, expect, it } from 'vitest';
import { normalizeStorageRoutePath } from './storage-url';

describe('normalizeStorageRoutePath', () => {
  it('aceita caminho aninhado como string', () => {
    expect(normalizeStorageRoutePath('evidencias/2026-06-15/uuid.jpg')).toBe(
      'evidencias/2026-06-15/uuid.jpg',
    );
  });

  it('junta segmentos quando splat vem como array', () => {
    expect(normalizeStorageRoutePath(['evidencias', '2026-06-15', 'uuid.jpg'])).toBe(
      'evidencias/2026-06-15/uuid.jpg',
    );
  });

  it('rejeita path traversal', () => {
    expect(normalizeStorageRoutePath('../etc/passwd')).toBeNull();
  });
});
