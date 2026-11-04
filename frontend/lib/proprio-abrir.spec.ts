import { describe, expect, it } from 'vitest';
import { consumirRetornoAdminProprios, hrefAbrirProprio, salvarRetornoAdminProprios, voltarSeguro } from './proprio-abrir';

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe('314 · Abrir próprio a partir da Administração', () => {
  it('monta o link para a mesma página completa do CCO pelo id, com retorno', () => {
    expect(hrefAbrirProprio('abc-1')).toBe('/cco/unidades/abc-1?voltar=%2Fadmin%3Faba%3Dunidades');
  });
  it('voltar aceita só caminho interno', () => {
    expect(voltarSeguro('/admin?aba=unidades')).toBe('/admin?aba=unidades');
    expect(voltarSeguro('//evil.example')).toBeNull();
    expect(voltarSeguro('https://evil.example')).toBeNull();
    expect(voltarSeguro('/x?u=https://a')).toBeNull();
    expect(voltarSeguro('')).toBeNull();
  });
  it('preserva filtros e rolagem uma única vez', () => {
    const s = mem();
    salvarRetornoAdminProprios({ filtros: { codigo: 'ZZ', nome: '', origem: '', tipo: 'ESCOLA', secretaria: 'ZZTA', status: 'ativo' }, scrollY: 640 }, s);
    const r = consumirRetornoAdminProprios(s);
    expect(r?.filtros.tipo).toBe('ESCOLA');
    expect(r?.scrollY).toBe(640);
    expect(consumirRetornoAdminProprios(s)).toBeNull();
  });
  it('ignora conteúdo inválido no storage', () => {
    const s = mem();
    s.setItem('sigma.admin.proprios.retorno', '{quebrado');
    expect(consumirRetornoAdminProprios(s)).toBeNull();
  });
});
