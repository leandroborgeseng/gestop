/**
 * 319 — integração com Postgres LOCAL descartável: categorias do filtro "Mapa: Notas" da CCO.
 * Só roda com ESCOPO_306_TEST_DATABASE_URL. Cria dados fictícios próprios (ZZTESTE 319 <sufixo>) e remove no fim.
 */
import { randomBytes } from 'node:crypto';
import { ChecklistItemTipo, FiscalizacaoStatus, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertBancoLocal306 } from '../../scripts/seed-escopo-306-core';
import { JwtPayload } from '../auth/jwt';
import { OperacionalController } from './operacional.controller';
import { OperacionalService, montarCategoriasNotaDisponiveis } from './operacional.service';

const URL = process.env.ESCOPO_306_TEST_DATABASE_URL;

describe.skipIf(!URL)('319 — categorias com nota válida no Mapa: Notas (Postgres local)', () => {
  let prisma: PrismaClient;
  let svc: OperacionalService;
  const suf = randomBytes(3).toString('hex').toUpperCase();
  const pre = `ZZTESTE 319 ${suf}`;
  const ids = { sec: [] as string[], uni: [] as string[], cat: [] as string[], chk: [] as string[], usr: [] as string[], fis: [] as string[] };
  let X: string, Y: string;
  const global = { sub: 'g', nome: 'G', email: 'g@aion.local', permissoes: ['usuarios.gerenciar'] } as unknown as JwtPayload;
  const soX = () => ({ sub: 'x', nome: 'X', email: 'x@aion.local', permissoes: [], secretariaId: X }) as unknown as JwtPayload;
  const nomes = (r: Array<{ nome: string }>) => r.map((c) => c.nome.replace(`${pre} `, ''));

  beforeAll(async () => {
    assertBancoLocal306(URL);
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL! }) });
    svc = new OperacionalService(prisma as never);
    const sec = async (s: string) => (await prisma.secretaria.create({ data: { sigla: `${s}${suf}`, nome: `${pre} Secretaria ${s}` } })).id;
    X = await sec('X'); Y = await sec('Y'); ids.sec.push(X, Y);
    const uni = async (secretariaId: string, nome: string) =>
      (await prisma.unidadePublica.create({ data: { secretariaId, codigoPatrimonial: `ZZ319${suf}-${nome}`, nome: `${pre} ${nome}`, tipo: 'ESCOLA', endereco: 'Rua Fictícia', latitude: -20.5, longitude: -47.4 } })).id;
    const U1 = await uni(X, 'Escola'), U2 = await uni(X, 'Creche'), U3 = await uni(Y, 'UBS'), U4 = await uni(X, 'SemVistoria');
    ids.uni.push(U1, U2, U3, U4);
    // nomes fora de ordem e com acento para provar a ordenação pt-BR
    const cat = async (n: string) => (await prisma.categoriaVistoria.create({ data: { nome: `${pre} ${n}` } })).id;
    const C = { agua: await cat('Água'), banheiro: await cat('banheiro'), eletrica: await cat('Elétrica'), telhado: await cat('Telhado'), zinco: await cat('Zinco'), pintura: await cat('Pintura') };
    // inativas no catálogo, mas com nota válida (Alambrado viria antes de Água no alfabeto)
    const catInativa = async (n: string) => (await prisma.categoriaVistoria.create({ data: { nome: `${pre} ${n}`, ativo: false } })).id;
    const CI = { muro: await catInativa('Muro'), alambrado: await catInativa('Alambrado'), semNota: await catInativa('Calçada') };
    ids.cat.push(...Object.values(C), ...Object.values(CI));
    const agente = (await prisma.usuario.create({ data: { nome: `${pre} Agente`, email: `zzteste.319.${suf.toLowerCase()}@aion.local`, senhaHash: 'x' } })).id;
    ids.usr.push(agente);
    const chk = await prisma.checklist.create({ data: { nome: `${pre} Checklist` } });
    ids.chk.push(chk.id);
    const versao = await prisma.checklistVersao.create({ data: { checklistId: chk.id, versao: 1 } });
    let ordem = 0;
    const item = async (categoriaVistoriaId: string) =>
      (await prisma.checklistItem.create({ data: { checklistVersaoId: versao.id, ordem: ++ordem, codigo: `I${ordem}`, titulo: `Item ${ordem}`, tipo: ChecklistItemTipo.ESCALA_LIKERT, categoriaVistoriaId } })).id;
    const I = { agua: await item(C.agua), banheiro: await item(C.banheiro), eletrica: await item(C.eletrica), telhado: await item(C.telhado), zinco: await item(C.zinco), pintura: await item(C.pintura) };
    const II = { muro: await item(CI.muro), alambrado: await item(CI.alambrado), semNota: await item(CI.semNota) };
    const dia = (d: number) => new Date(Date.UTC(2026, 9, d, 12));
    const vistoria = async (unidadeId: string, secretariaId: string, status: FiscalizacaoStatus, concluidaEm: Date | null, respostas: Array<[string, string]>) => {
      const f = await prisma.fiscalizacao.create({ data: { secretariaId, unidadeId, checklistVersaoId: versao.id, agenteId: agente, status, concluidaEm,
        respostas: { create: respostas.map(([itemId, valorTexto]) => ({ itemId, valorTexto })) } } });
      ids.fis.push(f.id);
    };
    // U1: a última concluída tem Água (válida) e Elétrica (resposta inválida → sem nota)
    await vistoria(U1, X, FiscalizacaoStatus.CONCLUIDA, dia(20), [[I.agua, 'BOM'], [I.eletrica, 'valor inválido']]);
    // U1: concluída mais antiga com Telhado — o mapa mostra só a última, então Telhado não é opção
    await vistoria(U1, X, FiscalizacaoStatus.CONCLUIDA, dia(10), [[I.telhado, 'OTIMO']]);
    // U1: cancelada e em andamento (mais novas) com Zinco — ficam de fora
    await vistoria(U1, X, FiscalizacaoStatus.CANCELADA, dia(25), [[I.zinco, 'BOM']]);
    await vistoria(U1, X, FiscalizacaoStatus.EM_ANDAMENTO, null, [[I.zinco, 'BOM']]);
    await vistoria(U2, X, FiscalizacaoStatus.CONCLUIDA, dia(15), [[I.banheiro, 'RUIM'], [I.agua, 'REGULAR'], [II.muro, 'BOM'], [II.alambrado, 'RUIM'], [II.semNota, 'inválido']]);
    await vistoria(U3, Y, FiscalizacaoStatus.CONCLUIDA, dia(15), [[I.pintura, 'PESSIMO']]);
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.respostaChecklist.deleteMany({ where: { fiscalizacaoId: { in: ids.fis } } });
      await prisma.fiscalizacao.deleteMany({ where: { id: { in: ids.fis } } });
      await prisma.checklist.deleteMany({ where: { id: { in: ids.chk } } });
      await prisma.categoriaVistoria.deleteMany({ where: { id: { in: ids.cat } } });
      await prisma.usuario.deleteMany({ where: { id: { in: ids.usr } } });
      await prisma.unidadePublica.deleteMany({ where: { id: { in: ids.uni } } });
      await prisma.secretaria.deleteMany({ where: { id: { in: ids.sec } } });
    }
    await prisma?.$disconnect();
  });

  it('só categorias com nota válida na vistoria mostrada (última concluída); sem cancelada/em andamento/antiga; ordem alfabética pt-BR', async () => {
    const r = await svc.listCategoriasNotaDisponiveis({ search: pre }, global);
    expect(nomes(r)).toEqual(['Água', 'banheiro', 'Pintura', 'Alambrado', 'Muro']);
    expect(r.map((c) => c.ativa)).toEqual([true, true, true, false, false]);
    expect(r.find((c) => c.nome.endsWith('Água'))?.total).toBe(2); // U1 e U2
  });

  it('considera os filtros dos próprios (busca / Secretaria)', async () => {
    expect(nomes(await svc.listCategoriasNotaDisponiveis({ search: `${pre} Creche` }, global))).toEqual(['Água', 'banheiro', 'Alambrado', 'Muro']);
    expect(nomes(await svc.listCategoriasNotaDisponiveis({ search: `${pre} Escola` }, global))).toEqual(['Água']);
    expect(nomes(await svc.listCategoriasNotaDisponiveis({ search: pre, secretariaIds: [Y] }, global))).toEqual(['Pintura']);
    expect(await svc.listCategoriasNotaDisponiveis({ search: `${pre} SemVistoria` }, global)).toEqual([]);
  });

  it('escopo de Secretaria: X não vê categoria só avaliada na Y; pedido forçado da Y → vazio; sem Secretaria → vazio', async () => {
    expect(nomes(await svc.listCategoriasNotaDisponiveis({ search: pre }, soX()))).toEqual(['Água', 'banheiro', 'Alambrado', 'Muro']);
    expect(await svc.listCategoriasNotaDisponiveis({ search: pre, secretariaIds: [Y] }, soX())).toEqual([]);
    const semSec = { sub: 'z', nome: 'Z', email: 'z@aion.local', permissoes: [] } as unknown as JwtPayload;
    expect(await svc.listCategoriasNotaDisponiveis({ search: pre }, semSec)).toEqual([]);
  });

  it('endpoint HTTP lê a query (valor único e lista)', async () => {
    const ctrl = new OperacionalController(svc);
    expect(nomes(await ctrl.listCategoriasNotaDisponiveis(global, { search: pre, secretariaIds: Y }))).toEqual(['Pintura']);
  });

  it('montarCategoriasNotaDisponiveis: ignora nota nula/NaN, não duplica', () => {
    expect(montarCategoriasNotaDisponiveis([
      { notasPorCategoria: [{ categoriaId: 'a', categoriaNome: 'Água', nota: 5 }, { categoriaId: 'n', categoriaNome: 'Nula', nota: null }] },
      { notasPorCategoria: [{ categoriaId: 'a', categoriaNome: 'Água', nota: 0 }, { categoriaId: 'x', categoriaNome: 'NaN', nota: Number.NaN }] },
      null,
    ])).toEqual([{ id: 'a', nome: 'Água', total: 2, ativa: true }]);
  });

  it('montarCategoriasNotaDisponiveis: inativas no fim, alfabética pt-BR em cada grupo', () => {
    const n = (categoriaId: string, categoriaNome: string) => ({ categoriaId, categoriaNome, nota: 3 });
    const r = montarCategoriasNotaDisponiveis(
      [{ notasPorCategoria: [n('z', 'Zinco'), n('al', 'Alambrado'), n('e', 'Elétrica'), n('ag', 'água'), n('m', 'Muro')] }],
      new Set(['al', 'm']),
    );
    expect(r.map((c) => [c.nome, c.ativa])).toEqual([['água', true], ['Elétrica', true], ['Zinco', true], ['Alambrado', false], ['Muro', false]]);
  });
});
