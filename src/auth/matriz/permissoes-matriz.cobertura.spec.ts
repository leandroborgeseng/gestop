import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { APP_GUARD } from '@nestjs/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { listCatalogMatrixKeys } from '../../domain/permissions-catalog';
import { MatrizPermissoesGuard } from './matriz-permissoes.guard';
import { METODOS_MUTACAO, PERMISSOES_MATRIZ, rotaGetComEfeito } from './permissoes-matriz';
import { serializarMatriz } from './permissoes-matriz-json';
import { descobrirRotas, type RotaDescoberta } from './rotas-descoberta';

/**
 * 285 (a): enumera as rotas pelos metadados do Nest (scanner de módulos/controllers),
 * não por grep. Falha se rota que altera dados ou GET com efeito não tiver regra.
 */
describe('285 — cobertura da matriz de permissões', () => {
  let rotas: RotaDescoberta[];

  beforeAll(async () => {
    rotas = await descobrirRotas(AppModule);
  });

  it('descobre as rotas registradas no AppModule', () => {
    expect(rotas.length).toBeGreaterThan(200);
    expect(new Set(rotas.map((r) => r.chave)).size).toBe(rotas.length);
  });

  it('toda rota registrada tem entrada na matriz (deny-by-default não bloqueia rota existente)', () => {
    const faltando = rotas.filter((r) => !PERMISSOES_MATRIZ[r.chave]).map((r) => `${r.chave} (${r.controller.name}.${r.handlerNome})`);
    expect(faltando).toEqual([]);
  });

  it('a matriz não tem entradas órfãs', () => {
    const existentes = new Set(rotas.map((r) => r.chave));
    expect(Object.keys(PERMISSOES_MATRIZ).filter((chave) => !existentes.has(chave))).toEqual([]);
  });

  it('rota que altera dados (POST/PUT/PATCH/DELETE) tem regra explícita, nunca leitura legada', () => {
    const semRegra = rotas
      .filter((r) => METODOS_MUTACAO.has(r.metodo))
      .filter((r) => !PERMISSOES_MATRIZ[r.chave] || PERMISSOES_MATRIZ[r.chave].tipo === 'leitura-legada')
      .map((r) => r.chave);
    expect(semRegra).toEqual([]);
  });

  it('GET com efeito (exportar, relatório, download, offline) tem regra explícita', () => {
    const semRegra = rotas
      .filter((r) => r.metodo === 'GET' && rotaGetComEfeito(r.caminho))
      .filter((r) => !PERMISSOES_MATRIZ[r.chave] || PERMISSOES_MATRIZ[r.chave].tipo === 'leitura-legada')
      .map((r) => r.chave);
    expect(semRegra).toEqual([]);
  });

  it('leitura legada só existe para GET', () => {
    const invalidas = Object.entries(PERMISSOES_MATRIZ)
      .filter(([chave, e]) => e.tipo === 'leitura-legada' && !chave.startsWith('GET '))
      .map(([chave]) => chave);
    expect(invalidas).toEqual([]);
  });

  it('toda chave exigida existe no catálogo de permissões', () => {
    const catalogo = new Set(listCatalogMatrixKeys());
    const invalidas = Object.entries(PERMISSOES_MATRIZ).flatMap(([chave, e]) =>
      e.tipo === 'permissao' ? e.chaves.filter((c) => !catalogo.has(c)).map((c) => `${chave}: ${c}`) : [],
    );
    expect(invalidas).toEqual([]);
    for (const e of Object.values(PERMISSOES_MATRIZ)) if (e.tipo === 'permissao') expect(e.chaves.length).toBeGreaterThan(0);
  });

  it('D-285a/D-285b: relatório e vistoria offline exigem Executar', () => {
    for (const [chave, e] of Object.entries(PERMISSOES_MATRIZ)) {
      if (e.tipo !== 'permissao') continue;
      if (e.efeito === 'relatorio' || e.efeito === 'offline') expect(e.acao, chave).toBe('executar');
    }
    expect(PERMISSOES_MATRIZ['GET /mobile/field-package']).toMatchObject({ acao: 'executar', efeito: 'offline' });
    expect(PERMISSOES_MATRIZ['GET /relatorios/export/chamados.csv']).toMatchObject({ acao: 'executar', efeito: 'relatorio' });
  });

  it('o JSON versionado está em sincronia com a matriz tipada', () => {
    const json = readFileSync(join(__dirname, 'permissoes-matriz.json'), 'utf8');
    expect(json).toBe(serializarMatriz());
  });

  it('o guard da matriz está registrado como APP_GUARD global', () => {
    const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule) ?? []) as Array<{ provide?: unknown; useClass?: unknown }>;
    expect(providers.some((p) => p.provide === APP_GUARD && p.useClass === MatrizPermissoesGuard)).toBe(true);
  });
});
