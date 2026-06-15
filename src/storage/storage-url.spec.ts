import { describe, expect, it } from 'vitest';
import { buildStoragePublicUrl, extractStorageKeyFromUrl } from './storage-url';

describe('storage-url', () => {
  it('extrai storageKey de URL com api-sigma', () => {
    expect(
      extractStorageKeyFromUrl(
        'https://gestop.up.railway.app/api-sigma/storage/evidencias/2026-06-15/file.jpg',
      ),
    ).toBe('evidencias/2026-06-15/file.jpg');
  });

  it('extrai storageKey de URL com api-gestop', () => {
    expect(
      extractStorageKeyFromUrl(
        'https://gestop.up.railway.app/api-gestop/storage/evidencias/2026-06-12/file.png',
      ),
    ).toBe('evidencias/2026-06-12/file.png');
  });

  it('monta URL publica a partir do storageKey', () => {
    process.env.STORAGE_PUBLIC_URL_BASE = 'https://gestop.up.railway.app/api-sigma';
    expect(buildStoragePublicUrl('evidencias/2026-06-15/file.jpg')).toBe(
      'https://gestop.up.railway.app/api-sigma/storage/evidencias/2026-06-15/file.jpg',
    );
    delete process.env.STORAGE_PUBLIC_URL_BASE;
  });
});
