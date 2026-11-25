import { describe, expect, it } from 'vitest';
import { precisaoMaxCheckinMetros, validadePacoteDias } from './mobile.config';
import { validateMobileCheckin } from './mobile.rules';

describe('303 G2a / 304 O9 — configuração de campo', () => {
  it('precisão do check-in: padrão 50 m (D2), configurável por ambiente, valores inválidos voltam ao padrão', () => {
    expect(precisaoMaxCheckinMetros({})).toBe(50);
    expect(precisaoMaxCheckinMetros({ MOBILE_CHECKIN_PRECISAO_MAX_METROS: '30' })).toBe(30);
    for (const v of ['', 'abc', '0', '-5', '5000']) expect(precisaoMaxCheckinMetros({ MOBILE_CHECKIN_PRECISAO_MAX_METROS: v })).toBe(50);
  });
  it('validade do pacote offline: padrão 7 dias (D3), configurável', () => {
    expect(validadePacoteDias({})).toBe(7);
    expect(validadePacoteDias({ MOBILE_PACOTE_VALIDADE_DIAS: '3' })).toBe(3);
    expect(validadePacoteDias({ MOBILE_PACOTE_VALIDADE_DIAS: 'x' })).toBe(7);
  });
  it('check-in usa o limite configurado (não mais fixo em 50 m) e a mensagem cita o limite', () => {
    const base = { unidade: { latitude: -20.5, longitude: -47.4, raioValidacaoMetros: 200 }, checkin: { latitude: -20.5, longitude: -47.4, precisaoMetros: 40 } };
    expect(validateMobileCheckin(base).valid).toBe(true);
    const r = validateMobileCheckin({ ...base, precisaoMaxMetros: 30 });
    expect(r.valid).toBe(false);
    expect(r.reasons).toEqual(['Precisao do GPS acima de 30 m']);
    expect(validateMobileCheckin({ ...base, checkin: { ...base.checkin, precisaoMetros: 60 } }).reasons).toEqual(['Precisao do GPS acima de 50 m']);
  });
});
