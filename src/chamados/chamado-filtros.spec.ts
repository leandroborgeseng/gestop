import { describe, expect, it } from 'vitest';
import { inicioDoDiaNoFuso, offsetFusoMs, proximoDateKey } from '../common/date.utils';
import { DIAS_ABERTURA_RAPIDOS, lerFiltroAbertura, MSG_PERIODO_INVERTIDO, whereAbertura, type FiltroAbertura } from './chamado-filtros';

type Faixa = { gte?: Date; lt?: Date };
const faixa = (f: FiltroAbertura, agora?: Date) => (whereAbertura(f, agora)?.createdAt ?? null) as Faixa | null;
const dentro = (f: FiltroAbertura, iso: string, agora?: Date) => {
  const r = faixa(f, agora);
  const t = new Date(iso).getTime();
  return !r || ((!r.gte || t >= r.gte.getTime()) && (!r.lt || t < r.lt.getTime()));
};

describe('295 · dia civil em America/Sao_Paulo → instante UTC', () => {
  it('00:00 de Franca = 03:00 UTC (offset resolvido pelo Intl)', () => {
    expect(inicioDoDiaNoFuso('2026-10-01').toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(offsetFusoMs(new Date('2026-10-01T12:00:00Z'))).toBe(-3 * 3600_000);
  });
  it('item 4: 30/09 22h em Franca (= 01/10 01h UTC) é do dia 30/09', () => {
    const chamado = '2026-10-01T01:00:00.000Z';
    expect(dentro({ abertoAte: '2026-09-30' }, chamado)).toBe(true);
    expect(dentro({ abertoDe: '2026-10-01' }, chamado)).toBe(false);
    expect(dentro({ abertoDe: '2026-09-30', abertoAte: '2026-09-30' }, chamado)).toBe(true);
  });
  it('item 4: 01/10 00h30 em Franca (= 01/10 03h30 UTC) é do dia 01/10', () => {
    const chamado = '2026-10-01T03:30:00.000Z';
    expect(dentro({ abertoDe: '2026-10-01' }, chamado)).toBe(true);
    expect(dentro({ abertoAte: '2026-09-30' }, chamado)).toBe(false);
  });
  it('bordas exatas: 00:00:00.000 entra no dia; 23:59:59.999 do dia final entra; 00:00 do dia seguinte não', () => {
    const f = { abertoDe: '2026-10-01', abertoAte: '2026-10-05' };
    expect(dentro(f, '2026-10-01T03:00:00.000Z')).toBe(true);
    expect(dentro(f, '2026-10-01T02:59:59.999Z')).toBe(false);
    expect(dentro(f, '2026-10-06T02:59:59.999Z')).toBe(true);
    expect(dentro(f, '2026-10-06T03:00:00.000Z')).toBe(false);
    expect(faixa(f)).toEqual({ gte: new Date('2026-10-01T03:00:00.000Z'), lt: new Date('2026-10-06T03:00:00.000Z') });
  });
  it('mesmo dia inicial e final = um dia inteiro', () => {
    expect(faixa({ abertoDe: '2026-02-28', abertoAte: '2026-02-28' })).toEqual({
      gte: new Date('2026-02-28T03:00:00.000Z'),
      lt: new Date('2026-03-01T03:00:00.000Z'),
    });
  });
  it('independe de horário de verão: SP histórico (2018/2019) e Nova York', () => {
    // 04/11/2018: SP pulou 00:00→01:00 (-02); o dia começa às 03:00 UTC.
    expect(inicioDoDiaNoFuso('2018-11-04').toISOString()).toBe('2018-11-04T03:00:00.000Z');
    expect(inicioDoDiaNoFuso('2018-11-05').toISOString()).toBe('2018-11-05T02:00:00.000Z');
    // 17/02/2019: fim do verão (00:00 -02 → 23:00 -03 do dia 16); meia-noite do dia 17 = 03:00 UTC.
    expect(inicioDoDiaNoFuso('2019-02-16').toISOString()).toBe('2019-02-16T02:00:00.000Z');
    expect(inicioDoDiaNoFuso('2019-02-17').toISOString()).toBe('2019-02-17T03:00:00.000Z');
    expect(inicioDoDiaNoFuso('2026-03-08', 'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(inicioDoDiaNoFuso('2026-03-09', 'America/New_York').toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });
  it('não depende do TZ do processo', () => {
    const tz = process.env.TZ;
    try {
      for (const z of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles']) {
        process.env.TZ = z;
        expect(inicioDoDiaNoFuso('2026-10-01').toISOString()).toBe('2026-10-01T03:00:00.000Z');
      }
    } finally {
      process.env.TZ = tz;
    }
  });
  it('próximo dia atravessa mês e ano', () => {
    expect(proximoDateKey('2026-09-30')).toBe('2026-10-01');
    expect(proximoDateKey('2026-12-31')).toBe('2027-01-01');
    expect(proximoDateKey('2028-02-28')).toBe('2028-02-29');
  });
});

describe('295 · filtro rápido (createdAt < agora − N×24h, estrito)', () => {
  const agora = new Date('2026-10-16T19:56:00.000Z');
  it.each(DIAS_ABERTURA_RAPIDOS.map((n) => [n]))('%i dias: exatamente N dias fica fora; N dias + 1 min entra', (n) => {
    const limite = agora.getTime() - n * 86_400_000;
    expect(faixa({ diasMinimos: n }, agora)).toEqual({ lt: new Date(limite) });
    expect(dentro({ diasMinimos: n }, new Date(limite).toISOString(), agora)).toBe(false);
    expect(dentro({ diasMinimos: n }, new Date(limite - 60_000).toISOString(), agora)).toBe(true);
    expect(dentro({ diasMinimos: n }, new Date(limite - 1).toISOString(), agora)).toBe(true);
  });
  it('24h corridas, não dia civil: atravessar a meia-noite não muda nada', () => {
    const r = faixa({ diasMinimos: 30 }, new Date('2026-10-16T03:00:00.000Z'))!;
    expect(r.lt!.toISOString()).toBe('2026-09-16T03:00:00.000Z');
  });
});

describe('295 · validação', () => {
  it('sem nada: sem filtro', () => {
    expect(lerFiltroAbertura(undefined)).toEqual({ filtro: { abertoDe: undefined, abertoAte: undefined, diasMinimos: undefined } });
    expect(whereAbertura({})).toBeNull();
    expect(lerFiltroAbertura({ abertoDe: ' ', abertoAte: '', diasMinimos: '' })).toEqual({ filtro: {} as never });
  });
  it('inicial > final: mensagem da demanda; iguais é válido', () => {
    expect(lerFiltroAbertura({ abertoDe: '2026-10-02', abertoAte: '2026-10-01' })).toEqual({ erro: MSG_PERIODO_INVERTIDO });
    expect(MSG_PERIODO_INVERTIDO).toBe('A data inicial não pode ser posterior à data final.');
    expect(lerFiltroAbertura({ abertoDe: '2026-10-01', abertoAte: '2026-10-01' })).toEqual({ filtro: { abertoDe: '2026-10-01', abertoAte: '2026-10-01', diasMinimos: undefined } });
  });
  it('datas inválidas recusadas (formato e dia inexistente)', () => {
    expect(lerFiltroAbertura({ abertoDe: '01/10/2026' })).toEqual({ erro: 'Data inicial inválida.' });
    expect(lerFiltroAbertura({ abertoAte: '2026-02-30' })).toEqual({ erro: 'Data final inválida.' });
    expect(lerFiltroAbertura({ abertoDe: '2026-13-01' })).toEqual({ erro: 'Data inicial inválida.' });
  });
  it('rápido só nos valores da demanda; número vindo como texto', () => {
    expect(lerFiltroAbertura({ diasMinimos: '30' })).toEqual({ filtro: { abertoDe: undefined, abertoAte: undefined, diasMinimos: 30 } });
    for (const v of ['7', '0', '-30', '30.5', 'abc', '365']) {
      expect(lerFiltroAbertura({ diasMinimos: v })).toEqual({ erro: 'Filtro rápido inválido. Use 10, 15, 30, 45, 60, 90, 180 dias.' });
    }
    expect([...DIAS_ABERTURA_RAPIDOS]).toEqual([10, 15, 30, 45, 60, 90, 180]);
  });
  it('rápido e datas juntos é recusado', () => {
    expect(lerFiltroAbertura({ diasMinimos: '30', abertoAte: '2026-09-16' })).toEqual({ erro: 'Use o filtro rápido ou o período por datas, não os dois.' });
    expect(lerFiltroAbertura({ diasMinimos: '30', abertoDe: '2026-09-16' })).toEqual({ erro: 'Use o filtro rápido ou o período por datas, não os dois.' });
  });
});
