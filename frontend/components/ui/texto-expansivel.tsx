'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * 293: texto livre do usuário, íntegro (pre-wrap). Recorta visualmente em `linhas` linhas e
 * mostra "Ver mais"/"Ver menos" (aria-expanded) só quando há corte real. Nunca trunca o dado.
 */
export function TextoExpansivel({ texto, linhas = 6, testId }: { texto: string; linhas?: number; testId?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expandido, setExpandido] = useState(false);
  const [cortado, setCortado] = useState(false);

  const medir = useCallback(() => {
    const el = ref.current;
    if (!el || expandido) return;
    setCortado(el.scrollHeight > el.clientHeight + 1);
  }, [expandido]);

  useLayoutEffect(() => {
    medir();
    if (typeof ResizeObserver === 'undefined' || !ref.current) return;
    const observer = new ResizeObserver(() => medir());
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [medir, texto]);

  return (
    <div>
      <p
        ref={ref}
        data-testid={testId}
        className="text-[12px] text-[var(--ink)]"
        style={{
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          ...(expandido
            ? {}
            : { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: linhas, overflow: 'hidden' }),
        }}
      >
        {texto}
      </p>
      {cortado || expandido ? (
        <button
          type="button"
          aria-expanded={expandido}
          className="min-h-11 text-[12px] font-semibold text-[var(--brand)]"
          onClick={() => setExpandido((v) => !v)}
        >
          {expandido ? 'Ver menos' : 'Ver mais'}
        </button>
      ) : null}
    </div>
  );
}
