'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { PendenciasResumo } from '@/lib/api';

export function PendenciasAcessoDialog({
  open,
  resumo,
  onClose,
  destinoAoFechar,
}: {
  open: boolean;
  resumo: PendenciasResumo | null;
  onClose: () => void;
  destinoAoFechar?: string;
}) {
  const router = useRouter();
  if (!open || !resumo || resumo.total <= 0) return null;
  const soDocumentos = resumo.grupos.length === 1 && resumo.grupos[0]?.id === 'documentos';

  function fechar() {
    onClose();
    if (destinoAoFechar) router.replace(destinoAoFechar);
  }

  function irDocumentos() {
    onClose();
    router.replace('/documentos?pendentes=1');
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/45 p-3 sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pendencias-titulo"
        className="max-h-[min(80dvh,640px)] w-full max-w-lg overflow-y-auto rounded-[16px] bg-[var(--canvas)] p-4 shadow-[var(--sh-lg)]"
      >
        <h2 id="pendencias-titulo" className="text-[16px] font-semibold text-[var(--ink)]">
          {soDocumentos ? 'Você possui documentos pendentes de assinatura.' : 'Você possui pendências.'}
        </h2>
        <p className="mt-1 text-[13px] text-[var(--ink-3)]">
          {soDocumentos
            ? `${resumo.total} documento(s) aguardam a sua assinatura interna.`
            : `${resumo.total} item(ns) pendente(s).`}
        </p>
        <div className="mt-3 space-y-3">
          {resumo.grupos.map((grupo) => (
            <section key={grupo.id}>
              <p className="text-[12px] font-semibold text-[var(--ink-2)]">
                {grupo.titulo} · {grupo.total}
              </p>
              <ul className="mt-1 space-y-1">
                {grupo.itens.map((item) => (
                  <li key={`${grupo.id}-${item.id}`}>
                    <button
                      type="button"
                      className="w-full rounded-[10px] border border-[var(--line)] px-3 py-2 text-left hover:bg-[var(--canvas-2)]"
                      onClick={() => {
                        onClose();
                        router.replace(item.href);
                      }}
                    >
                      <span className="mono text-[12px] font-semibold text-[var(--brand-hover)]">{item.codigo}</span>
                      <span className="mt-0.5 block text-[13px] text-[var(--ink)]">{item.titulo}</span>
                      <span className="text-[11px] text-[var(--ink-3)]">
                        {[item.status, item.secretaria, item.equipe].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="filled" size="sm" onClick={irDocumentos}>
            Ir para documentos
          </Button>
          <Button type="button" variant="outlined" size="sm" onClick={fechar}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
