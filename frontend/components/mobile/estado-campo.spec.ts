import { describe, expect, it } from 'vitest';
import { permissaoBloqueada, rotuloCamera } from './estado-campo';
import { mensagemFalhaGps } from '@/lib/checkin-gps';

describe('303 estado de campo (Designer M1/lows)', () => {
  it('bloqueado = negado ou indisponível; "ainda não perguntado" não é bloqueio', () => {
    expect(permissaoBloqueada('denied')).toBe(true);
    expect(permissaoBloqueada('indisponivel')).toBe(true);
    expect(permissaoBloqueada('prompt')).toBe(false);
    expect(permissaoBloqueada('granted')).toBe(false);
  });
  it('"Câmera bloqueada" (concordância)', () => {
    expect(rotuloCamera('denied')).toBe('Câmera bloqueada');
    expect(rotuloCamera('granted')).toBe('Câmera liberada');
  });
  it('permissão negada traz o caminho do Android', () => {
    expect(mensagemFalhaGps('PERMISSAO_NEGADA')).toContain('Toque no cadeado ao lado do endereço, depois em Permissões e em Localização');
  });
});
