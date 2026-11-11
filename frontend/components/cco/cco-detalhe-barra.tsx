'use client';

import { type ReactNode, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * 321 — barra de detalhes dentro do `.sigma-map-shell` (o elemento que entra em
 * tela cheia, ou que recebe `.sigma-map-fullscreen` no fallback do Safari/iPhone).
 * Não usa portal: assim continua visível na Fullscreen API e no fallback CSS.
 */
export function CcoDetalheBarra({
  titulo,
  rotuloFechar,
  onClose,
  kicker,
  meta,
  abas,
  abaKey,
  children,
  rodape,
}: {
  titulo: string;
  rotuloFechar: string;
  onClose: () => void;
  kicker?: ReactNode;
  meta?: ReactNode;
  abas?: ReactNode;
  abaKey?: string;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  const tituloId = useId();
  const raizRef = useRef<HTMLElement | null>(null);
  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const fecharPeloUsuario = useRef(false);
  const retornoRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  function fechar() {
    fecharPeloUsuario.current = true;
    onCloseRef.current();
  }

  useEffect(() => {
    const atual = document.activeElement;
    if (
      retornoRef.current === null &&
      atual instanceof HTMLElement &&
      atual !== tituloRef.current &&
      !raizRef.current?.contains(atual)
    ) {
      retornoRef.current = atual;
    }
    tituloRef.current?.focus({ preventScroll: true });
    return () => {
      const retorno = retornoRef.current;
      if (fecharPeloUsuario.current && retorno && document.contains(retorno)) {
        retorno.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    const abas = raiz.querySelector<HTMLElement>('.cco-detalhe-abas');
    const ativo = raiz.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!abas || !ativo) return;
    const esquerda = ativo.offsetLeft;
    const direita = esquerda + ativo.offsetWidth;
    if (esquerda < abas.scrollLeft) abas.scrollLeft = Math.max(0, esquerda - 8);
    else if (direita > abas.scrollLeft + abas.clientWidth) abas.scrollLeft = direita - abas.clientWidth + 8;
  }, [abaKey]);

  useEffect(() => {
    const barra = raizRef.current;
    const shell = barra?.closest('.sigma-map-shell');
    if (!barra || !(shell instanceof HTMLElement)) return;

    const marcados = new Set<HTMLElement>();
    const sync = () => {
      const br = barra.getBoundingClientRect();
      const alvos = shell.querySelectorAll<HTMLElement>(
        '[data-map-chrome], .sigma-map-controls button, .leaflet-control-zoom, .leaflet-control-attribution',
      );
      const agora = new Set<HTMLElement>();
      alvos.forEach((el) => {
        if (barra.contains(el)) return;
        const r = el.getBoundingClientRect();
        const cruza =
          r.width > 0 &&
          r.height > 0 &&
          r.left < br.right - 0.5 &&
          r.right > br.left + 0.5 &&
          r.top < br.bottom - 0.5 &&
          r.bottom > br.top + 0.5;
        if (!cruza) return;
        el.setAttribute('inert', '');
        el.setAttribute('data-coberto-pela-barra', 'true');
        agora.add(el);
        marcados.add(el);
      });
      marcados.forEach((el) => {
        if (agora.has(el)) return;
        el.removeAttribute('inert');
        el.removeAttribute('data-coberto-pela-barra');
        marcados.delete(el);
      });
    };

    sync();
    const obs = new ResizeObserver(sync);
    obs.observe(barra);
    obs.observe(shell);
    window.addEventListener('resize', sync);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', sync);
      marcados.forEach((el) => {
        el.removeAttribute('inert');
        el.removeAttribute('data-coberto-pela-barra');
      });
    };
  }, []);

  useEffect(() => {
    const node = raizRef.current;
    if (!node) return;
    let ativo = true;
    void import('leaflet')
      .then((mod) => {
        const Leaflet = (mod as { default?: typeof import('leaflet') }).default ?? (mod as unknown as typeof import('leaflet'));
        if (!ativo) return;
        Leaflet.DomEvent.disableScrollPropagation(node);
        Leaflet.DomEvent.disableClickPropagation(node);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (document.querySelector('[data-cco-vistoria-modal], [data-zoom-lightbox]')) return;
      if (!window.matchMedia('(min-width: 1024px)').matches) return;
      // Fullscreen nativo: o navegador consome Esc. No fallback CSS (Safari/iPhone) a barra fecha e a tela cheia fica.
      if (document.fullscreenElement) return;
      event.preventDefault();
      event.stopPropagation();
      fechar();
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <aside
      ref={raizRef}
      role="dialog"
      aria-labelledby={tituloId}
      data-testid="cco-detalhe-barra"
      className="cco-detalhe-barra"
    >
      <header className="cco-detalhe-header">
        <div className="cco-detalhe-header-texto">
          {kicker ? <div className="cco-detalhe-extra">{kicker}</div> : null}
          <h2
            id={tituloId}
            ref={tituloRef}
            tabIndex={-1}
            title={titulo}
            data-testid="cco-detalhe-titulo"
            className="cco-detalhe-nome"
          >
            {titulo}
          </h2>
          {meta ? <div className="cco-detalhe-extra">{meta}</div> : null}
        </div>
        <button type="button" data-testid="cco-detalhe-fechar" aria-label={rotuloFechar} className="cco-detalhe-fechar" onClick={fechar}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      {abas ? (
        <div className="cco-detalhe-abas" data-testid="cco-detalhe-abas">
          {abas}
        </div>
      ) : null}
      <div className="cco-detalhe-corpo" data-testid="cco-detalhe-corpo">
        {children}
      </div>
      {rodape ? <div className="cco-detalhe-rodape">{rodape}</div> : null}
    </aside>
  );
}
