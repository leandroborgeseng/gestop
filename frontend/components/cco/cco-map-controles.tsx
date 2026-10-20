'use client';

import { type ReactNode, type Ref, useEffect, useRef, useState } from 'react';
import { Layers, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';

export type CcoPainelAba = 'filtros' | 'camadas';

const BOTAO =
  'relative flex h-11 w-11 items-center justify-center rounded-[var(--r-md)] border border-[var(--line)] bg-[rgba(255,255,255,0.94)] text-[var(--ink-2)] shadow-[var(--sh-sm)] backdrop-blur-md hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--brand)]';

/** Tooltip à esquerda do botão: hover/foco após 400 ms, some com Esc (WCAG 1.4.13). */
function ComTooltip({ texto, children }: { texto: string; children: ReactNode }) {
  const [visivel, setVisivel] = useState(false);
  const timer = useRef<number | null>(null);
  const mostrar = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisivel(true), 400);
  };
  const esconder = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setVisivel(false);
  };
  useEffect(() => {
    if (!visivel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisivel(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visivel]);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  return (
    <div
      className="relative self-end"
      onMouseEnter={mostrar}
      onMouseLeave={esconder}
      onFocus={mostrar}
      onBlur={esconder}
    >
      {children}
      {visivel ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute top-1/2 right-[calc(100%+8px)] -translate-y-1/2 whitespace-nowrap rounded-[var(--r-md)] bg-[var(--ink)] px-2 py-1 text-[11.5px] font-semibold text-white shadow-[var(--sh-md)]"
        >
          {texto}
        </span>
      ) : null}
    </div>
  );
}

function Selo({ n, testId }: { n: number; testId: string }) {
  if (n <= 0) return null;
  return (
    <span
      data-testid={testId}
      aria-hidden="true"
      className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10.5px] font-bold text-white"
    >
      {n}
    </span>
  );
}

/** 299 — Filtros, Atualizar mapa e Camadas (pilha da direita, abaixo da tela cheia). */
export function CcoMapControles({
  painelAberto,
  onAbrir,
  filtrosAtivos,
  camadasAlemDoPadrao,
  atualizando,
  onAtualizar,
  rascunhoPendente,
  atualizadoAs,
  filtrosRef,
  camadasRef,
}: {
  painelAberto: CcoPainelAba | null;
  onAbrir: (aba: CcoPainelAba) => void;
  filtrosAtivos: number;
  camadasAlemDoPadrao: number;
  atualizando: boolean;
  onAtualizar: () => void;
  rascunhoPendente: boolean;
  /** "14h35" (BRT) da última carga bem-sucedida. */
  atualizadoAs: string | null;
  filtrosRef?: Ref<HTMLButtonElement>;
  camadasRef?: Ref<HTMLButtonElement>;
}) {
  const rotuloFiltros = filtrosAtivos > 0 ? `Filtros, ${filtrosAtivos} ${filtrosAtivos === 1 ? 'ativo' : 'ativos'}` : 'Filtros';
  const rotuloCamadas = camadasAlemDoPadrao > 0 ? `Camadas, ${camadasAlemDoPadrao} além do padrão` : 'Camadas';
  const rotuloAtualizar = atualizando ? 'Atualizando mapa…' : 'Atualizar mapa';
  const dicaAtualizar = rascunhoPendente && !atualizando ? 'Atualizar mapa (usa os filtros aplicados)' : rotuloAtualizar;

  return (
    <div className="mt-1 flex flex-col items-end gap-2 border-t border-[var(--line)] pt-2" data-testid="cco-map-controles">
      <ComTooltip texto="Filtros">
        <button
          ref={filtrosRef}
          type="button"
          className={cn(BOTAO, painelAberto === 'filtros' && 'border-[var(--brand)] text-[var(--brand)]')}
          aria-label={rotuloFiltros}
          aria-expanded={painelAberto === 'filtros'}
          aria-controls="cco-map-painel"
          onClick={() => onAbrir('filtros')}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          <Selo n={filtrosAtivos} testId="cco-selo-filtros" />
        </button>
      </ComTooltip>
      <ComTooltip texto={dicaAtualizar}>
        <button
          type="button"
          className={cn(BOTAO, atualizando && 'cursor-progress')}
          aria-label={rotuloAtualizar}
          aria-disabled={atualizando ? 'true' : undefined}
          aria-busy={atualizando ? 'true' : undefined}
          onClick={() => {
            if (!atualizando) onAtualizar();
          }}
        >
          <RefreshCw className={cn('h-4 w-4', atualizando && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
        </button>
      </ComTooltip>
      <ComTooltip texto="Camadas">
        <button
          ref={camadasRef}
          type="button"
          className={cn(BOTAO, painelAberto === 'camadas' && 'border-[var(--brand)] text-[var(--brand)]')}
          aria-label={rotuloCamadas}
          aria-expanded={painelAberto === 'camadas'}
          aria-controls="cco-map-painel"
          onClick={() => onAbrir('camadas')}
        >
          <Layers className="h-4 w-4" aria-hidden="true" />
          <Selo n={camadasAlemDoPadrao} testId="cco-selo-camadas" />
        </button>
      </ComTooltip>
      <span
        role="status"
        data-testid="cco-atualizado-as"
        className={cn(
          'rounded-[var(--r-pill)] border border-[var(--line)] bg-[rgba(255,255,255,0.94)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-2)] shadow-[var(--sh-sm)]',
          !atualizadoAs && 'sr-only',
        )}
      >
        {atualizadoAs ? `Atualizado às ${atualizadoAs}` : ''}
      </span>
    </div>
  );
}
