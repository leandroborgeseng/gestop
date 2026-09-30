'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { BLOCOS_ARQUITETURA, FLUXO_ARQUITETURA, INDICE_DOCUMENTACAO } from '@/content/engenharia/arquitetura';
import { ATORES, CASOS_DE_USO, GRUPOS_CASOS, atoresDoGrupo, type GrupoCasosDeUso } from '@/content/engenharia/casos-de-uso';
import { MATRIZ_RASTREABILIDADE, type LinhaRastreabilidade } from '@/content/engenharia/matriz-rastreabilidade';
import { DOMINIOS_DADOS, FONTE_SCHEMA, TOTAL_TABELAS, type DominioModelo } from '@/content/engenharia/modelo-dados';
import { Input } from '@/components/ui/input';

type Secao = 'indice' | 'arquitetura' | 'banco' | 'casos' | 'matriz';

const SECOES: Array<{ id: Secao; label: string }> = [
  { id: 'indice', label: 'Índice' },
  { id: 'arquitetura', label: 'Arquitetura' },
  { id: 'banco', label: 'Diagrama do banco' },
  { id: 'casos', label: 'Casos de uso' },
  { id: 'matriz', label: 'Rastreabilidade' },
];

export function DocumentacaoEngenhariaPanel() {
  const [secao, setSecao] = useState<Secao>('indice');
  const [dominioId, setDominioId] = useState<string>('todos');
  const [filtro, setFiltro] = useState('');

  const dominios = dominioId === 'todos' ? DOMINIOS_DADOS : DOMINIOS_DADOS.filter((item) => item.id === dominioId);
  const linhas = useMemo(() => filtrarMatriz(filtro), [filtro]);

  return (
    <section className="min-w-0 max-w-full space-y-5" aria-label="Documentação de engenharia de software">
      <header className="max-w-3xl">
        <h2 className="text-[18px] font-bold text-[var(--ink)]">Documentação de engenharia</h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--ink-3)]">
          Artefatos formais publicados a partir do código deste sistema. O diagrama do banco segue{' '}
          <span className="font-semibold text-[var(--ink)]">{FONTE_SCHEMA}</span> ({TOTAL_TABELAS} tabelas). Há{' '}
          {CASOS_DE_USO.length} casos de uso, {ATORES.length} atores e {MATRIZ_RASTREABILIDADE.length} linhas na matriz.
        </p>
      </header>

      <div className="max-w-full overflow-x-auto" role="tablist" aria-label="Artefatos">
        <div className="flex w-max min-w-full gap-2 pb-1">
          {SECOES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={secao === item.id}
              onClick={() => setSecao(item.id)}
              className={
                secao === item.id
                  ? 'min-h-11 shrink-0 rounded-[var(--r-pill)] bg-[var(--brand)] px-3 text-[13px] font-semibold text-white'
                  : 'min-h-11 shrink-0 rounded-[var(--r-pill)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] font-semibold text-[var(--ink-2)]'
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {secao === 'indice' ? <Indice onOpen={setSecao} /> : null}
      {secao === 'arquitetura' ? <Arquitetura /> : null}
      {secao === 'banco' ? (
        <div className="min-w-0 space-y-4">
          <div className="max-w-full overflow-x-auto">
            <div className="flex w-max gap-2">
              <FiltroChip active={dominioId === 'todos'} onClick={() => setDominioId('todos')}>
                Todos os domínios
              </FiltroChip>
              {DOMINIOS_DADOS.map((dominio) => (
                <FiltroChip key={dominio.id} active={dominioId === dominio.id} onClick={() => setDominioId(dominio.id)}>
                  {dominio.titulo} ({dominio.tabelas.length})
                </FiltroChip>
              ))}
            </div>
          </div>
          {dominios.map((dominio) => (
            <DominioBanco key={dominio.id} dominio={dominio} />
          ))}
        </div>
      ) : null}
      {secao === 'casos' ? (
        <div className="min-w-0 space-y-4">
          <Atores />
          {GRUPOS_CASOS.map((grupo) => (
            <GrupoCasos key={grupo.id} grupo={grupo} />
          ))}
        </div>
      ) : null}
      {secao === 'matriz' ? <Matriz linhas={linhas} filtro={filtro} onFiltro={setFiltro} /> : null}
    </section>
  );
}

function Indice({ onOpen }: { onOpen: (secao: Secao) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {INDICE_DOCUMENTACAO.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpen(item.id)}
          className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-4 text-left shadow-[var(--sh-sm)]"
        >
          <span className="text-[14px] font-bold text-[var(--ink)]">{item.titulo}</span>
          <span className="mt-1 block text-[13px] leading-relaxed text-[var(--ink-3)]">{item.resumo}</span>
        </button>
      ))}
    </div>
  );
}

function Arquitetura() {
  return (
    <div className="min-w-0 space-y-4">
      <p className="max-w-3xl text-[13.5px] leading-relaxed text-[var(--ink-3)]">
        O GestOP/SIGMA é uma aplicação web. A interface não acessa o banco. Quem persiste é a API, e os arquivos de
        campo ficam fora das linhas do PostgreSQL.
      </p>
      <ol className="grid gap-3">
        {BLOCOS_ARQUITETURA.map((bloco, index) => (
          <li key={bloco.id} className="min-w-0">
            {index > 0 ? (
              <div className="flex justify-center py-1 text-[12px] font-semibold text-[var(--ink-3)]" aria-hidden>
                ↓
              </div>
            ) : null}
            <article className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
              <h3 className="text-[15px] font-bold text-[var(--ink)]">{bloco.nome}</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--ink-2)]">{bloco.papel}</p>
              <p className="mt-2 text-[12.5px] text-[var(--ink-3)]">
                <span className="font-semibold">Onde está no código: </span>
                {bloco.onde}
              </p>
            </article>
          </li>
        ))}
      </ol>
      <div className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface-2)] p-4">
        <h3 className="text-[14px] font-bold text-[var(--ink)]">Caminho de uma operação</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13.5px] leading-relaxed text-[var(--ink-2)]">
          {FLUXO_ARQUITETURA.map((passo) => (
            <li key={passo}>{passo}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function DominioBanco({ dominio }: { dominio: DominioModelo }) {
  return (
    <article className="min-w-0 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
      <header>
        <h3 className="text-[15px] font-bold text-[var(--ink)]">{dominio.titulo}</h3>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-[var(--ink-3)]">{dominio.descricao}</p>
        <p className="mt-1 text-[12px] text-[var(--ink-3)]">{dominio.tabelas.length} tabelas neste domínio.</p>
      </header>
      <DiagramaEr dominio={dominio} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {dominio.tabelas.map((tabela) => (
          <article key={tabela.nome} className="min-w-0 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
            <h4 className="break-all font-mono text-[13px] font-bold text-[var(--ink)]">{tabela.nome}</h4>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-2)]">{tabela.resumo}</p>
            <p className="mt-2 text-[11px] font-semibold tracking-wide text-[var(--ink-3)] uppercase">Campos principais</p>
            <ul className="mt-1 space-y-0.5 text-[12.5px] text-[var(--ink)]">
              {tabela.campos.map((campo) => (
                <li key={campo} className="break-words font-mono text-[12px]">
                  {campo}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] font-semibold tracking-wide text-[var(--ink-3)] uppercase">Relacionamentos</p>
            <ul className="mt-1 space-y-0.5 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
              {tabela.relacoes.map((relacao) => (
                <li key={relacao}>{relacao}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </article>
  );
}

function DiagramaEr({ dominio }: { dominio: DominioModelo }) {
  const internos = dominio.tabelas.map((tabela) => tabela.nome);
  const conhecidos = new Set(internos);
  const externos = Array.from(
    new Set(dominio.arestas.flatMap((aresta) => [aresta.de, aresta.para]).filter((nome) => !conhecidos.has(nome))),
  );
  const nos = [...internos, ...externos];
  const cols = nos.length <= 2 ? nos.length || 1 : nos.length <= 6 ? 3 : 4;
  const cardW = 214;
  const cardH = 46;
  const gapX = 54;
  const gapY = 42;
  const pad = 18;
  const rows = Math.ceil(nos.length / cols) || 1;
  const width = pad * 2 + cols * cardW + Math.max(0, cols - 1) * gapX;
  const height = pad * 2 + rows * cardH + Math.max(0, rows - 1) * gapY;
  const pos = new Map(
    nos.map((nome, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      return [nome, { x: pad + col * (cardW + gapX), y: pad + row * (cardH + gapY), externo: !conhecidos.has(nome) }] as const;
    }),
  );
  const markerId = `seta-${dominio.id}`;

  return (
    <figure className="mt-4 min-w-0">
      <div className="max-w-full overflow-x-auto rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)]">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Diagrama das tabelas de ${dominio.titulo}`}
          className="block max-w-none"
        >
          <defs>
            <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="var(--ink-3)" />
            </marker>
          </defs>
          {dominio.arestas.map((aresta, index) => {
            const origem = pos.get(aresta.de);
            const destino = pos.get(aresta.para);
            if (!origem || !destino) return null;
            if (aresta.de === aresta.para) {
              const x = origem.x + cardW;
              const y = origem.y + 8;
              return (
                <path
                  key={`${aresta.de}-${aresta.para}-${aresta.rotulo}`}
                  d={`M ${x - 8} ${y} C ${x + 36} ${y - 8}, ${x + 36} ${y + 36}, ${x - 8} ${y + 28}`}
                  fill="none"
                  stroke="var(--ink-3)"
                  strokeWidth="1.2"
                  markerEnd={`url(#${markerId})`}
                >
                  <title>
                    {aresta.de} → {aresta.para} ({aresta.rotulo})
                  </title>
                </path>
              );
            }
            const x1 = origem.x + cardW / 2;
            const y1 = origem.y + cardH / 2;
            const x2 = destino.x + cardW / 2;
            const y2 = destino.y + cardH / 2;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.hypot(dx, dy) || 1;
            const deslocamento = 16 + (index % 3) * 8;
            const cx = (x1 + x2) / 2 + (-dy / len) * deslocamento;
            const cy = (y1 + y2) / 2 + (dx / len) * deslocamento;
            return (
              <path
                key={`${aresta.de}-${aresta.para}-${aresta.rotulo}`}
                d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                fill="none"
                stroke="var(--ink-3)"
                strokeWidth="1.2"
                markerEnd={`url(#${markerId})`}
              >
                <title>
                  {aresta.de} → {aresta.para} ({aresta.rotulo})
                </title>
              </path>
            );
          })}
          {nos.map((nome) => {
            const caixa = pos.get(nome);
            if (!caixa) return null;
            return (
              <g key={nome}>
                <rect
                  x={caixa.x}
                  y={caixa.y}
                  width={cardW}
                  height={cardH}
                  rx="8"
                  fill={caixa.externo ? 'var(--surface)' : 'var(--surface)'}
                  stroke={caixa.externo ? 'var(--ink-3)' : 'var(--brand)'}
                  strokeDasharray={caixa.externo ? '4 3' : undefined}
                  strokeWidth="1.4"
                />
                <text
                  x={caixa.x + cardW / 2}
                  y={caixa.y + (caixa.externo ? 18 : 28)}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="var(--ink)"
                >
                  {nome}
                </text>
                {caixa.externo ? (
                  <text x={caixa.x + cardW / 2} y={caixa.y + 34} textAnchor="middle" fontSize="10" fill="var(--ink-3)">
                    outro domínio
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="mt-2 text-[12px] leading-relaxed text-[var(--ink-3)]">
        Seta é chave estrangeira. Caixa tracejada é tabela de outro domínio, só para mostrar a ligação. Passe o cursor
        na seta para ler o campo. Em tela estreita, role o diagrama na horizontal.
      </figcaption>
      {dominio.arestas.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {dominio.arestas.map((aresta) => (
            <li
              key={`${aresta.de}-${aresta.rotulo}-${aresta.para}`}
              className="rounded-[var(--r-pill)] border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1 text-[11.5px] text-[var(--ink-2)]"
            >
              {aresta.de} → {aresta.para}
              <span className="text-[var(--ink-3)]"> ({aresta.rotulo})</span>
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}

function Atores() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ATORES.map((ator) => (
        <article key={ator.id} className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-3">
          <h3 className="text-[14px] font-bold text-[var(--ink)]">{ator.nome}</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-3)]">{ator.descricao}</p>
        </article>
      ))}
    </div>
  );
}

function GrupoCasos({ grupo }: { grupo: GrupoCasosDeUso }) {
  const atores = atoresDoGrupo(grupo);
  return (
    <article className="min-w-0 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
      <h3 className="text-[15px] font-bold text-[var(--ink)]">{grupo.titulo}</h3>
      <DiagramaCasos grupo={grupo} />
      <ul className="mt-4 space-y-3">
        {grupo.casos.map((caso) => (
          <li key={caso.id} className="min-w-0 border-t border-[var(--line)] pt-3 first:border-t-0 first:pt-0">
            <p className="text-[13.5px] font-semibold text-[var(--ink)]">{caso.nome}</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--ink-2)]">{caso.descricao}</p>
            <p className="mt-1 text-[12px] text-[var(--ink-3)]">
              <span className="font-semibold">Atores: </span>
              {caso.atores.map((id) => atores.find((ator) => ator.id === id)?.nome ?? id).join(', ')}
            </p>
            <p className="mt-0.5 break-words text-[12px] text-[var(--ink-3)]">
              <span className="font-semibold">Rotas: </span>
              {caso.rotas.join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}

function DiagramaCasos({ grupo }: { grupo: GrupoCasosDeUso }) {
  const atores = atoresDoGrupo(grupo);
  const casos = grupo.casos;
  const linhas = Math.max(atores.length, casos.length, 1);
  const rowH = 64;
  const padY = 36;
  const height = padY * 2 + linhas * rowH;
  const width = 760;
  const atorX = 132;
  const casoX = 530;
  const yNo = (index: number, total: number) => {
    const inicio = padY + rowH / 2;
    if (total <= 1) return inicio + ((linhas - 1) * rowH) / 2;
    const passo = ((linhas - 1) * rowH) / (total - 1);
    return inicio + index * passo;
  };

  return (
    <figure className="mt-3 min-w-0">
      <div className="max-w-full overflow-x-auto rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)]">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Casos de uso de ${grupo.titulo}`} className="block max-w-none">
          <rect x="300" y="16" width="440" height={height - 32} rx="16" fill="var(--surface)" stroke="var(--line)" />
          <text x="316" y="34" fontSize="11" fontWeight="700" fill="var(--ink-3)">
            SIGMA — {grupo.titulo}
          </text>
          {casos.flatMap((caso) =>
            caso.atores.map((atorId) => {
              const atorIndex = atores.findIndex((ator) => ator.id === atorId);
              const casoIndex = casos.findIndex((item) => item.id === caso.id);
              if (atorIndex < 0 || casoIndex < 0) return null;
              return (
                <line
                  key={`${atorId}-${caso.id}`}
                  x1={atorX + 16}
                  y1={yNo(atorIndex, atores.length)}
                  x2={casoX - 148}
                  y2={yNo(casoIndex, casos.length)}
                  stroke="var(--ink-3)"
                  strokeWidth="1"
                />
              );
            }),
          )}
          {atores.map((ator, index) => {
            const y = yNo(index, atores.length);
            const partes = quebrar(ator.nome, 18);
            return (
              <g key={ator.id}>
                <circle cx={28} cy={y - 10} r="7" fill="none" stroke="var(--ink)" strokeWidth="1.4" />
                <path d={`M28 ${y - 3} V${y + 12} M19 ${y + 4} H37 M28 ${y + 12} L21 ${y + 24} M28 ${y + 12} L35 ${y + 24}`} fill="none" stroke="var(--ink)" strokeWidth="1.4" />
                <text x="48" y={y - (partes.length - 1) * 6} fontSize="11" fill="var(--ink)">
                  {partes.map((linha, linhaIndex) => (
                    <tspan key={linha} x="48" dy={linhaIndex === 0 ? 0 : 13}>
                      {linha}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
          {casos.map((caso, index) => {
            const y = yNo(index, casos.length);
            const partes = quebrar(caso.nome, 26);
            return (
              <g key={caso.id}>
                <ellipse cx={casoX} cy={y} rx="148" ry="24" fill="var(--surface)" stroke="var(--brand)" strokeWidth="1.4" />
                <text x={casoX} y={y - (partes.length - 1) * 6 + 4} textAnchor="middle" fontSize="12" fill="var(--ink)">
                  {partes.map((linha, linhaIndex) => (
                    <tspan key={linha} x={casoX} dy={linhaIndex === 0 ? 0 : 13}>
                      {linha}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="mt-2 text-[12px] text-[var(--ink-3)]">
        À esquerda, o ator. À direita, o caso de uso dentro do sistema. A linha indica que aquele ator participa. Em tela estreita, role o diagrama na horizontal.
      </figcaption>
    </figure>
  );
}

function Matriz({
  linhas,
  filtro,
  onFiltro,
}: {
  linhas: LinhaRastreabilidade[];
  filtro: string;
  onFiltro: (valor: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <label className="block max-w-md text-[13px] font-semibold text-[var(--ink)]" htmlFor="filtro-rastreabilidade">
        Buscar na matriz
        <Input
          id="filtro-rastreabilidade"
          value={filtro}
          onChange={(event) => onFiltro(event.target.value)}
          placeholder="Capacidade, ator, rota, tabela ou permissão"
          className="mt-1"
        />
      </label>
      <p className="text-[12.5px] text-[var(--ink-3)]" aria-live="polite">
        {linhas.length} de {MATRIZ_RASTREABILIDADE.length} capacidades
      </p>
      {linhas.length === 0 ? (
        <p className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-4 text-[13.5px] text-[var(--ink-2)]">
          Nenhuma capacidade encontrada para esse texto.
        </p>
      ) : (
        <div className="max-w-full overflow-x-auto rounded-[var(--r-card)] border border-[var(--line)]">
          <table className="w-max min-w-full border-collapse text-left text-[12.5px]">
            <thead className="bg-[var(--surface-2)] text-[var(--ink)]">
              <tr>
                <th className="sticky left-0 z-10 min-w-[220px] bg-[var(--surface-2)] px-3 py-2 font-semibold">Capacidade</th>
                <th className="min-w-[180px] px-3 py-2 font-semibold">Ator</th>
                <th className="min-w-[200px] px-3 py-2 font-semibold">Tela</th>
                <th className="min-w-[240px] px-3 py-2 font-semibold">API</th>
                <th className="min-w-[220px] px-3 py-2 font-semibold">Tabelas</th>
                <th className="min-w-[260px] px-3 py-2 font-semibold">Permissão</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={linha.id} className="border-t border-[var(--line)] align-top">
                  <th className="sticky left-0 z-10 bg-[var(--surface)] px-3 py-2 font-semibold text-[var(--ink)]" scope="row">
                    {linha.capacidade}
                  </th>
                  <td className="px-3 py-2 text-[var(--ink-2)]">{linha.ator}</td>
                  <td className="px-3 py-2 break-words text-[var(--ink-2)]">{linha.tela}</td>
                  <td className="px-3 py-2 break-words text-[var(--ink-2)]">{linha.api}</td>
                  <td className="px-3 py-2 break-words text-[var(--ink-2)]">{linha.tabelas}</td>
                  <td className="px-3 py-2 break-words text-[var(--ink-2)]">{linha.permissao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FiltroChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'min-h-10 shrink-0 rounded-[var(--r-pill)] bg-[var(--brand-soft)] px-3 text-[12.5px] font-semibold text-[var(--brand-hover)]'
          : 'min-h-10 shrink-0 rounded-[var(--r-pill)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[12.5px] font-semibold text-[var(--ink-3)]'
      }
    >
      {children}
    </button>
  );
}

function filtrarMatriz(filtro: string) {
  const termo = filtro.trim().toLocaleLowerCase('pt-BR');
  if (!termo) return MATRIZ_RASTREABILIDADE;
  return MATRIZ_RASTREABILIDADE.filter((linha) =>
    [linha.capacidade, linha.ator, linha.tela, linha.api, linha.tabelas, linha.permissao]
      .join(' ')
      .toLocaleLowerCase('pt-BR')
      .includes(termo),
  );
}

function quebrar(texto: string, limite: number) {
  const palavras = texto.split(' ');
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of palavras) {
    const proxima = atual ? `${atual} ${palavra}` : palavra;
    if (proxima.length > limite && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = proxima;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.slice(0, 2);
}
