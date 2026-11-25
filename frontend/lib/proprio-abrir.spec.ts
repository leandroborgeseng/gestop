import { describe, expect, it } from 'vitest';
import { urlComAba, consumirRetornoAdminProprios, hrefAbrirProprio, salvarRetornoAdminProprios, voltarSeguro } from './proprio-abrir';

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
  it('troca de aba grava ?aba= preservando outros parâmetros e o hash', () => {
    expect(urlComAba('http://x.local/admin', 'unidades')).toBe('/admin?aba=unidades');
    expect(urlComAba('http://x.local/admin?aba=usuarios&k=1#t', 'unidades')).toBe('/admin?aba=unidades&k=1#t');
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('314 · página completa do próprio (fonte)', () => {
  const src = readFileSync(resolve('frontend/app/(authenticated)/cco/unidades/[id]/page.tsx'), 'utf8');
  it('mostra aviso Inativo no topo quando o próprio está inativo', () => {
    expect(src).toMatch(/!unidade\.ativo[\s\S]*aviso-proprio-inativo/);
    expect(src.indexOf('aviso-proprio-inativo')).toBeLessThan(src.indexOf('<TipBanner'));
  });
  it('abre sempre no topo', () => {
    expect(src).toMatch(/window\.scrollTo\(0, 0\)/);
  });
});
