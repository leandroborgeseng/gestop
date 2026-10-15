import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/snackbar', () => ({ useSnackbar: () => ({ show: () => undefined }) }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/lib/api', () => ({
  listTarefasExecucao: () => new Promise(() => undefined),
  getSecretarias: () => new Promise(() => undefined),
  listEquipesExecucao: () => new Promise(() => undefined),
  listUsuariosAtivosExecucao: () => new Promise(() => undefined),
  listTiposChamadoOpcoes: () => new Promise(() => undefined),
}));
vi.mock('@/components/chamados/chamado-tarefa-sheet', () => ({ ChamadoTarefaSheet: () => null }));
vi.mock('@/components/chamados/chamados-execucao-map', () => ({ ChamadosExecucaoMap: () => null }));

import { TarefasExecucaoList } from './tarefas-execucao-list';
import { ExecucaoTarefasPanel, FilaTarefasConteudo, estadoFila } from './execucao-tarefas-panel';
import type { ChamadoTarefaResumo } from '@/lib/chamado-tarefa';
import {
  agruparPinsTarefas,
  coordenadaTarefa,
  filtrarTarefasBusca,
  montarParametrosTarefasExecucao,
  pinDaTarefa,
  prazoTarefaInfo,
  razaoContraste,
  tarefaAriaLabel,
  type FiltrosTarefasExecucaoEstado,
} from '@/lib/tarefa-card';

const HOJE = new Date(2026, 9, 15, 10, 0, 0);
const panelSrc = readFileSync(join(__dirname, 'execucao-tarefas-panel.tsx'), 'utf8');
const listSrc = readFileSync(join(__dirname, 'tarefas-execucao-list.tsx'), 'utf8');
const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');
const badgeSrc = readFileSync(join(__dirname, '../ui/badge.tsx'), 'utf8');

function tarefa(over: Partial<ChamadoTarefaResumo> = {}, chamado: Partial<ChamadoTarefaResumo['chamado']> = {}): ChamadoTarefaResumo {
  return {
    id: 't1',
    titulo: 'Fazer laudo',
    descricao: null,
    prazo: '2026-10-20T12:00:00.000Z',
    prioridade: 'MEDIA',
    status: 'NOVA',
    justificativa: null,
    conclusaoTexto: null,
    observacao: null,
    atrasada: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    concluidaEm: null,
    visualizadaEm: null,
    secretaria: { id: 's1', nome: 'Secretaria Executiva', sigla: 'SEC-EX' },
    equipe: { id: 'e1', nome: 'Elétrica 1' },
    responsavel: { id: 'u1', nome: 'Bruno' },
    criadaPor: null,
    concluidaPor: null,
    anexos: [],
    podeTratar: true,
    chamado: {
      id: 'c1',
      codigo: 'CH-2026-0001',
      titulo: 'Troca de lâmpada',
      descricao: 'Lâmpada queimada',
      status: 'EM_EXECUCAO',
      prioridade: 'MEDIA',
      enderecoTexto: 'Rua A',
      prazoEm: null,
      latitude: -20.5,
      longitude: -47.4,
      tipoChamado: { id: 'tp', nome: 'Elétrica - Troca de Lâmpada' },
      unidade: null,
      secretaria: null,
      equipe: null,
      ...chamado,
    },
    ...over,
  };
}

const lista = (tarefas: ChamadoTarefaResumo[], extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(TarefasExecucaoList, { tarefas, onOpen: () => undefined, hoje: HOJE, ...extra }));

function token(nome: string) {
  const m = css.match(new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${nome} ausente`);
  return m[1];
}

describe('286 §8.1 — layout fila + mapa, sem <table>', () => {
  it('a aba não renderiza <table> e usa o grid 300–360px | mapa com mesma altura (cco-workspace)', () => {
    const html = renderToStaticMarkup(createElement(ExecucaoTarefasPanel));
    expect(html).not.toMatch(/<table/i);
    expect(panelSrc).not.toMatch(/<table|<thead|<tbody|<tr\b|<td\b/);
    expect(html).toContain('xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]');
    expect(html).toContain('cco-workspace');
    expect(html).toContain('xl:items-stretch');
    expect(html).toContain('Mapa de tarefas');
  });
});

describe('286 §8.2 — anatomia do card', () => {
  it('ordem: código, "Tarefa do chamado", título, resumo/tipo, tags, prazo, meta; ul/li/button', () => {
    const html = lista([tarefa()]);
    const ordem = ['CH-2026-0001', 'Tarefa do chamado', 'Fazer laudo', 'Elétrica - Troca de Lâmpada', 'tarefa-tags', 'tarefa-prazo', 'unit-meta'].map((t) =>
      html.indexOf(t, html.indexOf('>', html.indexOf('<button'))),
    );
    ordem.forEach((pos) => expect(pos).toBeGreaterThan(-1));
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    const tags = html.slice(html.indexOf('tarefa-tags'), html.indexOf('tarefa-prazo'));
    expect(tags.indexOf('Nova')).toBeLessThan(tags.indexOf('Média'));
    expect(html).toMatch(/^<ul role="list"/);
    expect(html).toMatch(/<li><button type="button"/);
  });
});

describe('286 §8.3 — atrasada', () => {
  it('tag "⚠ Atrasada", prazo em --danger e texto com os dias', () => {
    const html = lista([tarefa({ atrasada: true, prazo: '2026-10-11T12:00:00.000Z' })]);
    expect(html).toContain('⚠ Atrasada');
    expect(html).toMatch(/tarefa-prazo[^"]*text-\[var\(--danger\)\]/);
    expect(html).toContain('atrasada 4 dias');
    expect(prazoTarefaInfo({ prazo: '2026-10-14T12:00:00.000Z', status: 'NOVA', atrasada: true, concluidaEm: null }, HOJE).texto).toContain('atrasada 1 dia');
  });
  it('sem atraso não há tag Atrasada', () => {
    expect(lista([tarefa()])).not.toContain('Atrasada');
  });
});

describe('286 §8.4 — histórico', () => {
  it('concluída e cancelada mostram tag e data de encerramento', () => {
    const html = lista([
      tarefa({ id: 'a', status: 'CONCLUIDA', concluidaEm: '2026-10-12T15:00:00.000Z', atrasada: true }),
      tarefa({ id: 'b', status: 'CANCELADA', concluidaEm: '2026-10-13T15:00:00.000Z' }),
    ]);
    expect(html).toContain('Concluída em 12/10');
    expect(html).toContain('Cancelada em 13/10');
    expect(html).toContain('>Concluída<');
    expect(html).toContain('>Cancelada<');
    expect(html).toContain('line-through');
    expect(html).not.toContain('⚠ Atrasada');
  });
});

describe('286 §8.5 — abrir pelo card, Esc e foco', () => {
  it('o card é <button> (Enter/Espaço nativos) que chama onOpen; o painel seleciona e abre o sheet', () => {
    expect(listSrc).toContain('onClick={() => onOpen(item.id)}');
    expect(panelSrc).toMatch(/function abrirTarefa\(id: string\) \{\s*setSelecionada\(id\);[\s\S]*?setAberta\(id\);/);
    expect(panelSrc).toContain('onOpen={abrirTarefa}');
  });
  it('Esc fecha e o foco volta ao card', () => {
    expect(panelSrc).toMatch(/event\.key === 'Escape'\) fecharTarefa\(\)/);
    expect(panelSrc).toMatch(/data-tarefa-id="\$\{CSS\.escape\(id\)\}"[\s\S]{0,80}card\?\.focus\(\)/);
    expect(panelSrc).toContain('onClose={fecharTarefa}');
  });
  it('card selecionado tem aria-current e barra interna', () => {
    const html = lista([tarefa()], { selectedId: 't1' });
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('is-selected');
    expect(html).toContain('shadow-[inset_3px_0_0_var(--brand)]');
  });
});

describe('286 §8.6 — clique no pin', () => {
  const fn = panelSrc.slice(panelSrc.indexOf('function selecionarPeloPin'), panelSrc.indexOf('useEffect(() => {\n    if (searchParams'));
  it('seleciona, rola a lista e anuncia em aria-live, sem abrir o modal', () => {
    expect(fn).toContain('setSelecionada(id)');
    expect(fn).toContain('setRolarParaSelecionada');
    expect(fn).toContain('selecionada no mapa');
    expect(fn).not.toContain('setAberta');
    expect(panelSrc).toContain('onSelect={selecionarPeloPin}');
    expect(panelSrc).toMatch(/aria-live="polite"/);
    expect(listSrc).toContain("scrollIntoView({ block: 'nearest'");
  });
});

describe('286 §8.7 — localização e pins', () => {
  it('herda a coordenada do chamado; sem nenhuma, sem pin e "Sem localização"', () => {
    expect(coordenadaTarefa(tarefa())?.origem).toBe('chamado');
    expect(coordenadaTarefa({ ...tarefa(), latitude: 1, longitude: 2 })?.origem).toBe('tarefa');
    const sem = tarefa({ id: 'x' }, { latitude: null, longitude: null });
    expect(coordenadaTarefa(sem)).toBeNull();
    expect(agruparPinsTarefas([sem])).toHaveLength(0);
    // tag visível (fora do aria-label)
    expect(lista([sem])).toMatch(/<\/svg>Sem localização<\/span>/);
    expect(lista([tarefa()])).not.toContain('Sem localização');
    expect(tarefaAriaLabel(sem, HOJE)).toContain('Sem localização.');
  });
  it('tarefas no mesmo ponto viram um pin com contador; "N no mapa" = número de pins', () => {
    const pins = agruparPinsTarefas([
      tarefa({ id: 'a' }),
      tarefa({ id: 'b' }),
      tarefa({ id: 'c' }, { id: 'c2', latitude: -21, longitude: -47 }),
      tarefa({ id: 'd' }, { latitude: null, longitude: null }),
    ]);
    expect(pins).toHaveLength(2);
    expect(pins[0]).toMatchObject({ tarefaIds: ['a', 'b'], contagem: 2 });
    expect(pinDaTarefa(pins, 'b')).toBe(pins[0].id);
    expect(panelSrc).toContain('{pins.length} no mapa');
    const mapSrc = readFileSync(join(__dirname, 'chamados-execucao-map-client.tsx'), 'utf8');
    expect(mapSrc).toContain('point.contagem && point.contagem > 1 ? String(point.contagem) : chamadoPinIcon(');
    expect(panelSrc).toMatch(/pontos=\{erro \? \[\] : pins\}/);
  });
});

describe('286 §8.8 e §8.9 — textos', () => {
  it('título com clamp 2 e title completo; resumo 1 linha com title', () => {
    const longo = 'Título muito longo '.repeat(10).trim();
    const html = lista([tarefa({ titulo: longo })]);
    expect(html).toMatch(new RegExp(`title="${longo}" class="tarefa-titulo[^"]*line-clamp-2`));
    expect(html).toMatch(/title="Elétrica - Troca de Lâmpada" class="tarefa-resumo[^"]*truncate/);
  });
  it('"Sem responsável" e "Sem equipe", nunca "—" solto', () => {
    const html = lista([tarefa({ responsavel: null, equipe: null })]);
    expect(html).toContain('Sem responsável');
    expect(html).toContain('Sem equipe');
    expect(html).not.toContain('—');
  });
});

describe('286 §8.10 — celular', () => {
  it('abre em Lista, chips de 44px, sem min-w fixo e respiro acima do menu inferior', () => {
    expect(panelSrc).toContain("useState<'lista' | 'mapa'>('lista')");
    expect(panelSrc).toMatch(/onClick=\{\(\) => setMobile\('lista'\)\} className="min-h-11"/);
    expect(panelSrc).not.toMatch(/min-w-\[\d+px\]/);
    expect(panelSrc).toContain('pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))]');
    expect(lista([tarefa()])).toContain('min-h-11');
  });
});

describe('286 §8.11 — regressão de filtros e contadores', () => {
  // Cópia literal do objeto que o painel montava inline antes da 286.
  function legado(f: FiltrosTarefasExecucaoEstado) {
    const { status, atribuidaAMim, minhasEquipes, atrasadas, historico, prazoFrom, prazoTo, secretariaId, equipeId, responsavelId, tipoChamadoId, prioridade } = f;
    return {
      status: status || undefined,
      atribuidaAMim: atribuidaAMim ? '1' : undefined,
      minhasEquipes: minhasEquipes ? '1' : undefined,
      atrasadas: atrasadas ? '1' : undefined,
      historico: historico ? '1' : undefined,
      prazoFrom: prazoFrom ? new Date(prazoFrom).toISOString() : undefined,
      prazoTo: prazoTo ? new Date(prazoTo).toISOString() : undefined,
      secretariaId: secretariaId || undefined,
      equipeId: equipeId || undefined,
      responsavelId: responsavelId || undefined,
      tipoChamadoId: tipoChamadoId || undefined,
      prioridade: prioridade || undefined,
    };
  }
  const vazio: FiltrosTarefasExecucaoEstado = {
    status: '', atribuidaAMim: false, minhasEquipes: false, atrasadas: false, historico: false, prazoFrom: '', prazoTo: '',
    secretariaId: '', equipeId: '', responsavelId: '', tipoChamadoId: '', prioridade: '',
  };
  const cheio: FiltrosTarefasExecucaoEstado = {
    status: 'EM_ANDAMENTO', atribuidaAMim: true, minhasEquipes: true, atrasadas: true, historico: true, prazoFrom: '2026-10-01', prazoTo: '2026-10-31',
    secretariaId: 's1', equipeId: 'e1', responsavelId: 'u1', tipoChamadoId: 'tp', prioridade: 'ALTA',
  };
  it('os parâmetros enviados à API são idênticos aos de antes, campo a campo e em combinações', () => {
    expect(montarParametrosTarefasExecucao(vazio)).toEqual(legado(vazio));
    expect(montarParametrosTarefasExecucao(cheio)).toEqual(legado(cheio));
    for (const chave of Object.keys(vazio) as Array<keyof FiltrosTarefasExecucaoEstado>) {
      const f = { ...vazio, [chave]: cheio[chave] } as FiltrosTarefasExecucaoEstado;
      expect(montarParametrosTarefasExecucao(f)).toStrictEqual(legado(f));
    }
    expect(panelSrc).toMatch(/listTarefasExecucao\(\s*montarParametrosTarefasExecucao\(/);
  });
  it('contadores continuam vindo da API e a busca local não altera filtros nem contadores', () => {
    expect(panelSrc).toContain('{data?.contadores.novas ?? 0} novas');
    expect(panelSrc).toContain('{data?.contadores.emAndamento ?? 0} em andamento');
    expect(panelSrc).toContain('{data?.contadores.atrasadas ?? 0} atrasadas');
    // 286 §8.12: o contador "atrasadas" (badge danger) também usa --danger-ink na aba
    expect(panelSrc).toContain('<Badge variant="danger" className="text-[var(--danger-ink)]">{data?.contadores.atrasadas');
    expect(panelSrc).not.toMatch(/\[status, atribuidaAMim[^\]]*busca/);
    const itens = [tarefa({ id: 'a' }), tarefa({ id: 'b', titulo: 'Pintura', equipe: { id: 'e2', nome: 'Civil' } })];
    expect(filtrarTarefasBusca(itens, '')).toBe(itens);
    expect(filtrarTarefasBusca(itens, 'civil').map((t) => t.id)).toEqual(['b']);
    expect(filtrarTarefasBusca(itens, 'ch-2026').map((t) => t.id)).toEqual(['a', 'b']);
    const sec = [tarefa({ id: 'a' }), tarefa({ id: 'b', secretaria: { id: 's2', nome: 'Obras', sigla: 'SOB' } })];
    expect(filtrarTarefasBusca(sec, 'sob').map((t) => t.id)).toEqual(['b']);
  });
  it('a sanfona e o resumo dos filtros permanecem', () => {
    expect(panelSrc).toContain('onClick={() => setFiltrosAbertos((current) => !current)}');
    expect(panelSrc).toContain('{!filtrosAbertos ? <p className="mt-0.5 truncate text-[11px] text-[var(--ink-3)]">{resumoFiltros}</p> : null}');
  });
});

describe('286 §8.12 — contraste AA (≥ 4,5:1)', () => {
  it('--warn-ink sobre --warn-bg e sobre branco; Badge warning usa --warn-ink', () => {
    expect(token('warn-ink')).toBe('#8f5207');
    expect(razaoContraste(token('warn-ink'), token('warn-bg'))).toBeGreaterThanOrEqual(4.5);
    expect(razaoContraste(token('warn-ink'), '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(badgeSrc).toContain("warning: 'bg-[var(--warn-bg)] text-[var(--warn-ink)]'");
    expect(badgeSrc).not.toContain('text-[var(--warn)]');
  });
  it('todos os pares texto/fundo usados no card passam 4,5:1', () => {
    const fundos = ['surface', 'surface-2', 'brand-soft'];
    const pares: Array<[string, string]> = [
      ['ok-ink', 'ok-bg'], ['danger-ink', 'danger-bg'], ['warn-ink', 'warn-bg'], ['muted', 'muted-bg'], ['brand-hover', 'brand-soft'],
      ['danger', 'surface'], ['danger', 'surface-2'], ['danger-ink', 'brand-soft'], ['ok-ink', 'surface'], ['ok-ink', 'brand-soft'],
      ['warn-ink', 'surface'], ['warn-ink', 'brand-soft'], ['ink-3', 'surface'], ['ink-3', 'surface-2'], ['ink-2', 'brand-soft'],
      ...fundos.map((f) => ['ink', f] as [string, string]), ['brand-hover', 'surface'],
    ];
    for (const [t, f] of pares) expect([t, f, razaoContraste(token(t), token(f))]).toEqual([t, f, expect.any(Number)]);
    const falhas = pares.filter(([t, f]) => razaoContraste(token(t), token(f)) < 4.5);
    expect(falhas).toEqual([]);
  });
  it('o card não usa --ink-4 nem --warn em texto; ok/danger no card usam *-ink', () => {
    expect(listSrc).not.toContain('--ink-4');
    expect(listSrc).not.toMatch(/text-\[var\(--warn\)\]/);
    expect(listSrc).toContain("ok: 'text-[var(--ok-ink)]'");
    expect(listSrc).toContain("danger: 'text-[var(--danger-ink)]'");
    // selecionado/hover (fundo --brand-soft): meta passa para --ink-2 e prazo danger para --danger-ink
    expect(lista([tarefa({ atrasada: true })], { selectedId: 't1' })).toMatch(/tarefa-prazo[^"]*text-\[var\(--danger-ink\)\]/);
    expect(lista([tarefa()], { selectedId: 't1' })).toMatch(/unit-meta[^"]*text-\[var\(--ink-2\)\]/);
    // axe: --ink-3 sobre --brand-soft dá 4,22:1 — nenhum texto do card selecionado pode usar --ink-3
    expect(lista([tarefa()], { selectedId: 't1' })).not.toContain('--ink-3');
    // axe: --ink-3 sobre --canvas dá 4,45:1 — o subtítulo do mapa usa --ink-2
    expect(panelSrc).toContain('<span className="text-[12px] text-[var(--ink-2)]">— clique no pin para selecionar</span>');
  });
});

describe('286 §8.13 — estados da fila dentro do painel', () => {
  const r = (estado: ReturnType<typeof estadoFila>, busca = '') =>
    renderToStaticMarkup(
      createElement(FilaTarefasConteudo, {
        estado,
        erro: 'Falhou',
        busca,
        onRetry: () => undefined,
        onLimpar: () => undefined,
        children: createElement('p', null, 'LISTA'),
      }),
    );
  it('estadoFila decide erro > carregando > vazia > lista', () => {
    expect(estadoFila({ carregando: true, erro: 'x', total: 3 })).toBe('erro');
    expect(estadoFila({ carregando: true, erro: null, total: 0 })).toBe('carregando');
    expect(estadoFila({ carregando: false, erro: null, total: 0 })).toBe('vazia');
    expect(estadoFila({ carregando: false, erro: null, total: 2 })).toBe('lista');
  });
  it('carregando = 3 skeletons; vazia com e sem busca; erro com "Tentar novamente"', () => {
    expect(r('carregando').match(/<div class="space-y-2">/g)).toHaveLength(3);
    expect(r('vazia')).toContain('Nenhuma tarefa neste filtro');
    expect(r('vazia')).toContain('Limpar filtros');
    expect(r('vazia', 'xyz')).toContain('Nenhuma tarefa encontrada para &#x27;xyz&#x27;');
    expect(r('erro')).toContain('Tentar novamente');
    expect(r('lista')).toBe('<p>LISTA</p>');
  });
  it('o painel começa no estado carregando dentro da fila, com busca visível', () => {
    const html = renderToStaticMarkup(createElement(ExecucaoTarefasPanel));
    const fila = html.slice(html.indexOf('aria-label="Fila de tarefas"'));
    expect(fila).toContain('data-fila-estado="carregando"');
    expect(fila).toContain('aria-label="Buscar tarefa"');
  });
});
