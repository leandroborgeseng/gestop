'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  CcoCamadasEstado,
  SIGMA_CAMADA_CHAMADOS,
  SIGMA_CAMADA_PROPRIOS,
  camadaLigada,
  resumoGrupo,
} from '@/lib/cco-camadas';
import type { MapaCamadaGrupo } from '@/lib/types';
import type { CcoPainelAba } from './cco-map-controles';

export const MSG_CAMADAS_VAZIO =
  'Nenhuma camada do Webmap importada ainda. Um administrador pode importar em Administração › Importação.';
export const MSG_CAMADAS_ERRO = 'Não foi possível carregar as camadas. Tente novamente.';
export const MSG_ESC_TELA_CHEIA = 'Esc sai da tela cheia. Use Fechar para fechar o painel.';

const LINHA = 'flex min-h-11 items-center gap-2.5 rounded-[var(--r-md)] px-2 text-[13px] text-[var(--ink)] hover:bg-[var(--surface-2)]';

/** 299-U3: dica do Esc só com ponteiro fino (mouse/teclado), nunca no celular. */
function usePonteiroFino() {
  const [fino, setFino] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(pointer: fine)');
    const sync = () => setFino(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);
  return fino;
}

function useCelular() {
  const [celular, setCelular] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 599px)');
    const sync = () => setCelular(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);
  return celular;
}

function corAmostra(estilo: Record<string, unknown> | null): string {
  const c = estilo?.cor ?? estilo?.color ?? estilo?.strokeColor ?? estilo?.fillColor;
  return typeof c === 'string' ? c : '#8a97a8';
}

export type CcoCamadasProps = {
  estado: CcoCamadasEstado;
  arvore: MapaCamadaGrupo[] | null;
  carregando: boolean;
  erro: boolean;
  onTentarNovamente: () => void;
  onAlternar: (id: string, ligar: boolean) => void;
  onAlternarGrupo: (grupo: string) => void;
  onDesligarTodas: () => void;
  calorLigado: boolean;
  onCalor: (ligar: boolean) => void;
  /** 299-U2: há camada do Webmap (ou o calor) ligada → mostra "Desligar todas". */
  algumaLigada: boolean;
};

function CamadasConteudo(p: CcoCamadasProps) {
  const sigmaAberto = p.estado.gruposAbertos.includes('sigma');
  const webmapAberto = p.estado.gruposAbertos.includes('webmap');
  const totalWebmap = (p.arvore ?? []).reduce((n, g) => n + g.camadas.length, 0);
  const ligadasWebmap = (p.arvore ?? []).reduce((n, g) => n + resumoGrupo(p.estado, g).ligadas, 0);
  return (
    <div className="space-y-3" data-testid="cco-painel-camadas">
      <section>
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between rounded-[var(--r-md)] px-2 text-left text-[12px] font-bold tracking-[0.04em] text-[var(--ink-3)] uppercase hover:bg-[var(--surface-2)]"
          aria-expanded={sigmaAberto}
          onClick={() => p.onAlternarGrupo('sigma')}
        >
          SIGMA
          <ChevronDown className={cn('h-4 w-4 transition-transform', sigmaAberto && 'rotate-180')} aria-hidden="true" />
        </button>
        {sigmaAberto ? (
          <div className="mt-1 space-y-0.5">
            <label className={LINHA}>
              <input type="checkbox" className="h-4 w-4" checked={camadaLigada(p.estado, SIGMA_CAMADA_PROPRIOS)} onChange={(e) => p.onAlternar(SIGMA_CAMADA_PROPRIOS, e.target.checked)} />
              Próprios públicos
            </label>
            <label className={LINHA}>
              <input type="checkbox" className="h-4 w-4" checked={camadaLigada(p.estado, SIGMA_CAMADA_CHAMADOS)} onChange={(e) => p.onAlternar(SIGMA_CAMADA_CHAMADOS, e.target.checked)} />
              Chamados
            </label>
            <label className={LINHA}>
              <input type="checkbox" className="h-4 w-4" checked={p.calorLigado} onChange={(e) => p.onCalor(e.target.checked)} />
              Mapa de calor dos chamados
            </label>
          </div>
        ) : null}
      </section>

      <section>
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between rounded-[var(--r-md)] px-2 text-left text-[12px] font-bold tracking-[0.04em] text-[var(--ink-3)] uppercase hover:bg-[var(--surface-2)]"
          aria-expanded={webmapAberto}
          onClick={() => p.onAlternarGrupo('webmap')}
        >
          <span>
            Webmap
            {totalWebmap > 0 ? (
              <span data-testid="cco-webmap-resumo" className="font-semibold tracking-normal normal-case"> · {ligadasWebmap} de {totalWebmap} ligadas</span>
            ) : null}
          </span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', webmapAberto && 'rotate-180')} aria-hidden="true" />
        </button>
        {webmapAberto ? (
          <div className="mt-1 space-y-1">
            {p.erro ? (
              <div role="alert" className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3 text-[12.5px] text-[var(--ink-2)]">
                {MSG_CAMADAS_ERRO}
                <div className="mt-2">
                  <Button variant="outlined" size="lg" onClick={p.onTentarNovamente}>Tentar novamente</Button>
                </div>
              </div>
            ) : p.carregando && !p.arvore ? (
              <p role="status" className="px-2 text-[12.5px] text-[var(--ink-3)]">Carregando camadas…</p>
            ) : (p.arvore ?? []).length === 0 ? (
              <p role="status" data-testid="cco-camadas-vazio" className="px-2 text-[12.5px] text-[var(--ink-3)]">{MSG_CAMADAS_VAZIO}</p>
            ) : (
              (p.arvore ?? []).map((grupo) => {
                const chave = `webmap-grupo:${grupo.id}`;
                const aberto = p.estado.gruposAbertos.includes(chave);
                const resumo = resumoGrupo(p.estado, grupo);
                return (
                  <div key={grupo.id}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--r-md)] px-2 text-left text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)]"
                      aria-expanded={aberto}
                      onClick={() => p.onAlternarGrupo(chave)}
                    >
                      <span className="min-w-0 truncate">{grupo.titulo}</span>
                      <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-normal text-[var(--ink-3)]">
                        {resumo.texto}
                        <ChevronDown className={cn('h-4 w-4 transition-transform', aberto && 'rotate-180')} aria-hidden="true" />
                      </span>
                    </button>
                    {aberto ? (
                      <div className="ml-2 space-y-0.5">
                        {grupo.camadas.map((c) => (
                          <label key={c.id} className={LINHA}>
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={camadaLigada(p.estado, c.id)}
                              onChange={(e) => p.onAlternar(c.id, e.target.checked)}
                            />
                            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: corAmostra(c.estilo) }} />
                            <span className="min-w-0 break-words">{c.nomeOriginal}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

/**
 * 299 — Painel único `#cco-map-painel` dentro do `.sigma-map-shell`.
 * Desktop/tablet: região não modal à direita (360 px). < 600 px: bottom sheet modal com foco preso.
 * Esc: fora da tela cheia fecha; na tela cheia nativa o navegador sai da tela cheia e o painel fica;
 * no fallback por classe o 1º Esc fecha o painel (o 2º sai, tratado pelo mapa).
 */
export function CcoMapPainel({
  aba,
  onAba,
  onFechar,
  fullscreenMode,
  tituloAba,
  filtros,
  rascunhoPendente,
  avisoExterno,
  onLimpar,
  onAplicar,
  podeAplicar,
  camadas,
}: {
  aba: CcoPainelAba;
  onAba: (aba: CcoPainelAba) => void;
  onFechar: () => void;
  fullscreenMode: 'off' | 'native' | 'fallback';
  /** "Todos os chamados" ou "Próprios públicos". */
  tituloAba: string;
  filtros: ReactNode;
  rascunhoPendente: boolean;
  avisoExterno: boolean;
  onLimpar: () => void;
  onAplicar: () => void;
  podeAplicar: boolean;
  camadas: CcoCamadasProps;
}) {
  const celular = useCelular();
  const ponteiroFino = usePonteiroFino();
  const tituloId = useId();
  const ref = useRef<HTMLDivElement | null>(null);
  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const fecharRef = useRef(onFechar);
  fecharRef.current = onFechar;

  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  // Roda/toque no painel não mexem no mapa.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let ativo = true;
    void import('leaflet').then((mod) => {
      const L = (mod as { default?: typeof import('leaflet') }).default ?? (mod as unknown as typeof import('leaflet'));
      if (!ativo || !node) return;
      L.DomEvent.disableScrollPropagation(node);
      L.DomEvent.disableClickPropagation(node);
    }).catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (fullscreenMode === 'native') return; // o navegador sai da tela cheia; o painel fica
        e.stopImmediatePropagation();
        fecharRef.current();
        return;
      }
      if (e.key === 'Tab' && celular && ref.current) {
        const foco = Array.from(
          ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (foco.length === 0) return;
        const primeiro = foco[0];
        const ultimo = foco[foco.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [fullscreenMode, celular]);

  const isFullscreen = fullscreenMode !== 'off';

  return (
    <div
      id="cco-map-painel"
      ref={ref}
      role={celular ? 'dialog' : 'region'}
      aria-modal={celular ? 'true' : undefined}
      aria-labelledby={tituloId}
      data-testid="cco-map-painel"
      data-layout={celular ? 'sheet' : 'lateral'}
      className={cn(
        'cco-map-painel pointer-events-auto absolute flex flex-col overflow-hidden border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-md)]',
        celular
          ? 'inset-x-0 bottom-0 z-[600] h-[85%] rounded-t-[16px] pb-[env(safe-area-inset-bottom)]'
          : 'z-[450] top-[4.25rem] right-[4.25rem] bottom-3 w-[360px] max-w-[calc(100%-5rem)] min-w-[min(320px,calc(100%-5rem))] rounded-[var(--r-card)]',
      )}
    >
      {celular ? <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--line)]" /> : null}
      <div className="shrink-0 border-b border-[var(--line-2)] px-3.5 pt-2.5 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id={tituloId} ref={tituloRef} tabIndex={-1} className="text-[14px] font-bold text-[var(--ink)] focus:outline-none">
            {aba === 'filtros' ? 'Filtros' : 'Camadas'}
          </h2>
          <button
            type="button"
            aria-label="Fechar painel"
            onClick={onFechar}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--r-md)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div role="tablist" aria-label="Conteúdo do painel" className="mt-1 flex gap-1">
          {(['filtros', 'camadas'] as const).map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={aba === a}
              aria-controls="cco-map-painel-conteudo"
              onClick={() => onAba(a)}
              className={cn(
                'min-h-11 rounded-[var(--r-md)] px-3 text-[13px] font-semibold',
                aba === a ? 'bg-[var(--brand-soft)] text-[var(--brand-hover)]' : 'text-[var(--ink-3)] hover:bg-[var(--surface-2)]',
              )}
            >
              {a === 'filtros' ? 'Filtros' : 'Camadas'}
            </button>
          ))}
        </div>
        {aba === 'filtros' ? <p className="mt-1 text-[12px] text-[var(--ink-3)]">{tituloAba}</p> : null}
      </div>

      <div
        id="cco-map-painel-conteudo"
        role="tabpanel"
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3.5 py-3"
      >
        {aba === 'filtros' ? filtros : <CamadasConteudo {...camadas} />}
      </div>

      <div className="shrink-0 space-y-2 border-t border-[var(--line-2)] px-3.5 py-2.5">
        <div className={cn('text-[12px]', aba === 'filtros' && (avisoExterno || rascunhoPendente) ? 'min-h-[1em]' : 'h-0 overflow-hidden')}>
          <span role="status" data-testid="cco-painel-status" className="text-[var(--warn-ink,var(--warn))]">
            {aba === 'filtros' && avisoExterno
              ? 'Os filtros foram alterados fora do painel.'
              : aba === 'filtros' && rascunhoPendente
                ? 'Alterações não aplicadas'
                : ''}
          </span>
        </div>
        {isFullscreen && ponteiroFino && !celular ? <p className="text-[11.5px] text-[var(--ink-3)]" data-testid="cco-dica-esc">{MSG_ESC_TELA_CHEIA}</p> : null}
        {aba === 'filtros' ? (
          <div className={cn('flex items-center gap-1.5 whitespace-nowrap', celular ? 'flex-nowrap' : 'flex-wrap')}>
            <Button variant="ghost" size="lg" className="px-2.5" onClick={onLimpar}>Limpar filtros</Button>
            <span className="flex-1" />
            <Button variant="ghost" size="lg" className="px-2.5" onClick={onFechar}>Fechar</Button>
            <Button variant="filled" size="lg" className="px-3.5" onClick={onAplicar} disabled={!podeAplicar}>Aplicar filtros</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {camadas.algumaLigada ? (
              <Button variant="ghost" size="lg" className="px-3" onClick={camadas.onDesligarTodas}>Desligar todas</Button>
            ) : null}
            <span className="flex-1" />
            <Button variant="ghost" size="lg" className="px-3" onClick={onFechar}>Fechar</Button>
          </div>
        )}
      </div>
    </div>
  );
}
