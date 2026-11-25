import { describe, expect, it } from 'vitest';
import { classificarErroGeo, fazerCheckinGps, MENSAGEM_SEM_CONEXAO, mensagemFalhaGps, validarLeituraGps } from './checkin-gps';

const geo = (impl: (ok: PositionCallback, err: PositionErrorCallback) => void) => ({ getCurrentPosition: impl as never });
const pos = (latitude: number, longitude: number, accuracy: number) => ({ coords: { latitude, longitude, accuracy } }) as GeolocationPosition;

describe('303 G2/G2a/G3/G4 — check-in com GPS', () => {
  it('mensagens distintas para cada falha, e "sem conexão" ≠ "GPS desligado"', () => {
    const tipos = ['PERMISSAO_NEGADA', 'SERVICO_DESLIGADO', 'TEMPO_ESGOTADO', 'PRECISAO_BAIXA', 'COORDENADAS_INVALIDAS', 'INDISPONIVEL'] as const;
    const msgs = tipos.map((t) => mensagemFalhaGps(t, { precisaoMetros: 80, limiteMetros: 50 }));
    expect(new Set(msgs).size).toBe(tipos.length);
    expect(msgs).not.toContain(MENSAGEM_SEM_CONEXAO);
    expect(MENSAGEM_SEM_CONEXAO).toMatch(/funciona/);
  });
  it('classifica os códigos do navegador', () => {
    expect([1, 2, 3, undefined].map(classificarErroGeo)).toEqual(['PERMISSAO_NEGADA', 'SERVICO_DESLIGADO', 'TEMPO_ESGOTADO', 'INDISPONIVEL']);
  });
  it('valida coordenadas e precisão com o limite configurado', () => {
    expect(validarLeituraGps({ latitude: -20.5, longitude: -47.4, accuracy: 12 })).toBeNull();
    expect(validarLeituraGps({ latitude: -20.5, longitude: -47.4, accuracy: 51 })).toBe('PRECISAO_BAIXA');
    expect(validarLeituraGps({ latitude: -20.5, longitude: -47.4, accuracy: 40 }, 30)).toBe('PRECISAO_BAIXA');
    for (const l of [{ latitude: 0, longitude: 0, accuracy: 5 }, { latitude: 95, longitude: 0, accuracy: 5 }, { latitude: NaN, longitude: 1, accuracy: 5 }, { latitude: 1, longitude: 1, accuracy: 0 }]) {
      expect(validarLeituraGps(l)).toBe('COORDENADAS_INVALIDAS');
    }
  });
  it('sucesso guarda lat/long/precisão/horário do check-in', async () => {
    const r = await fazerCheckinGps({ geolocation: geo((ok) => ok(pos(-20.5, -47.4, 12.4))), agora: () => new Date('2026-10-23T12:00:00.000Z') });
    expect(r).toEqual({ ok: true, checkin: { latitude: -20.5, longitude: -47.4, precisaoMetros: 12, capturadoEm: '2026-10-23T12:00:00.000Z' } });
  });
  it('erros do navegador e leitura imprecisa viram falhas distintas', async () => {
    const err = (code: number) => fazerCheckinGps({ geolocation: geo((_ok, e) => e({ code } as GeolocationPositionError)) });
    expect((await err(1)).ok === false && (await err(1) as { falha: string }).falha).toBe('PERMISSAO_NEGADA');
    expect(((await err(2)) as { falha: string }).falha).toBe('SERVICO_DESLIGADO');
    expect(((await err(3)) as { falha: string }).falha).toBe('TEMPO_ESGOTADO');
    const imp = await fazerCheckinGps({ limiteMetros: 50, geolocation: geo((ok) => ok(pos(-20.5, -47.4, 120))) });
    expect(imp).toMatchObject({ ok: false, falha: 'PRECISAO_BAIXA' });
    expect((imp as { mensagem: string }).mensagem).toContain('120 m');
    expect(await fazerCheckinGps({ geolocation: null })).toMatchObject({ ok: false, falha: 'INDISPONIVEL' });
  });
});
