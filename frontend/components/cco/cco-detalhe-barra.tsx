'use client';

import { type ReactNode, useEffect, useId, useLayoutEffect, useRef } from 'react';
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
    if (document.body.classList.contains('cco-detalhe-trava')) {
      const pagina = document.querySelector('main.sigma-main > .overflow-y-auto') as HTMLElement | null;
      const y = Number(document.body.dataset.ccoScrollY ?? window.scrollY);
      const top = Number(document.body.dataset.ccoScrollTop ?? pagina?.scrollTop ?? 0);
      if (window.scrollY !== y) window.scrollTo(0, y);
      if (pagina && pagina.scrollTop !== top) pagina.scrollTop = top;
    }
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
    const faixa = raiz.querySelector<HTMLElement>('.cco-detalhe-abas');
    const lista = raiz.querySelector<HTMLElement>('.cco-detalhe-abas [role="tablist"]');
    const ativo = raiz.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (lista && ativo) {
      const esquerda = ativo.offsetLeft;
      const direita = esquerda + ativo.offsetWidth;
      if (esquerda < lista.scrollLeft) lista.scrollLeft = Math.max(0, esquerda - 8);
      else if (direita > lista.scrollLeft + lista.clientWidth) lista.scrollLeft = direita - lista.clientWidth + 8;
    }
    if (!lista || !faixa) return;
    const marcar = () => {
      faixa.dataset.overflow = lista.scrollWidth > lista.clientWidth + 1 ? '1' : '0';
      faixa.dataset.rolou = lista.scrollLeft > 1 ? '1' : '0';
    };
    marcar();
    lista.addEventListener('scroll', marcar);
    const obs = new ResizeObserver(marcar);
    obs.observe(lista);
    return () => {
      lista.removeEventListener('scroll', marcar);
      obs.disconnect();
    };
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
    const mutacao = new MutationObserver(sync);
    mutacao.observe(shell, { childList: true, attributes: true, attributeFilter: ['class', 'data-fullscreen-mode'] });
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    document.addEventListener('fullscreenchange', sync);
    return () => {
      obs.disconnect();
      mutacao.disconnect();
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      document.removeEventListener('fullscreenchange', sync);
      marcados.forEach((el) => {
        el.removeAttribute('inert');
        el.removeAttribute('data-coberto-pela-barra');
      });
    };
  }, []);

  useLayoutEffect(() => {
    const barra = raizRef.current;
    const shell = barra?.closest('.sigma-map-shell');
    if (!barra) return;
    const pagina = document.querySelector('main.sigma-main > .overflow-y-auto') as HTMLElement | null;
    const guardar = () => ({ y: window.scrollY, top: pagina?.scrollTop ?? 0 });
    const restaurar = (pos: { y: number; top: number }) => {
      if (window.scrollY !== pos.y) window.scrollTo(0, pos.y);
      if (pagina && pagina.scrollTop !== pos.top) pagina.scrollTop = pos.top;
    };
    const origem = guardar();
    document.body.dataset.ccoScrollY = String(origem.y);
    document.body.dataset.ccoScrollTop = String(origem.top);
    const ajustar = () => {
      const fullscreen = Boolean(document.fullscreenElement) || Boolean(shell?.classList.contains('sigma-map-fullscreen'));
      const estreita = window.matchMedia('(max-width: 1023px)').matches;
      document.body.classList.toggle('cco-detalhe-trava', !fullscreen && estreita);
      if (fullscreen || estreita || !(shell instanceof HTMLElement)) {
        barra.style.removeProperty('--cco-barra-topo');
        barra.style.removeProperty('height');
        barra.style.removeProperty('max-height');
      } else {
        const header = document.querySelector('header');
        const headerFim = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
        const inicio = Math.max(shell.getBoundingClientRect().top, headerFim, 0);
        const topo = Math.ceil(inicio);
        barra.style.setProperty('--cco-barra-topo', `${topo}px`);
        // 100dvh pode passar de innerHeight. A altura visível é a da janela.
        const altura = Math.max(160, window.innerHeight - topo - 4);
        barra.style.height = `${altura}px`;
        barra.style.maxHeight = `${altura}px`;
      }
      if (!fullscreen && estreita) restaurar(origem);
    };
    ajustar();
    const shellEl = shell instanceof HTMLElement ? shell : null;
    shellEl?.querySelector<HTMLElement>('.leaflet-popup-close-button')?.click();
    const mutacao = shellEl ? new MutationObserver(ajustar) : null;
    if (shellEl && mutacao) mutacao.observe(shellEl, { attributes: true, attributeFilter: ['class', 'data-fullscreen-mode'] });
    window.addEventListener('resize', ajustar);
    window.addEventListener('orientationchange', ajustar);
    window.addEventListener('scroll', ajustar, true);
    document.addEventListener('fullscreenchange', ajustar);
    return () => {
      document.body.classList.remove('cco-detalhe-trava');
      delete document.body.dataset.ccoScrollY;
      delete document.body.dataset.ccoScrollTop;
      barra.style.removeProperty('--cco-barra-topo');
      barra.style.removeProperty('height');
      barra.style.removeProperty('max-height');
      mutacao?.disconnect();
      window.removeEventListener('resize', ajustar);
      window.removeEventListener('orientationchange', ajustar);
      window.removeEventListener('scroll', ajustar, true);
      document.removeEventListener('fullscreenchange', ajustar);
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
      // Fullscreen nativo: o navegador consome Esc. Em qualquer largura, fora dele, a barra fecha.
      // No fallback CSS o stopPropagation impede que o mesmo Esc tire o mapa da tela cheia.
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
