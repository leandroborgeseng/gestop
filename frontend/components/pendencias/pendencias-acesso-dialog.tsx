'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { travarRolagemFundo } from '@/components/documentos/documento-consulta-dialogs';
import { Button } from '@/components/ui/button';
import type { PendenciasResumo } from '@/lib/api';

const GRUPO_ACAO: Record<string, string> = {
  documentos: 'Ir para documentos',
  tarefas: 'Ir para execução de tarefas',
  chamados: 'Ir para chamados',
};

/**
 * 288: o modal de pendências é renderizado via portal em document.body. Antes ele ficava dentro do
 * <header> com backdrop-blur (que cria containing block para position:fixed) e aparecia como uma
 * faixa cortada no topo do celular. z-[140] fica acima do header (z-30) e do menu inferior (z-40).
 */
export function PendenciasPortal({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    return travarRolagemFundo(window, document);
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

/** 288: alvo de 44px no celular; mantém o tamanho atual a partir de sm. */
const ALVO_44 = 'h-11 min-h-11 sm:h-8 sm:min-h-8';

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

  function ir(href: string) {
    onClose();
    router.replace(href);
  }

  return (
    <PendenciasPortal>
    <div
      className="fixed inset-0 z-[140] flex items-stretch justify-center overflow-hidden bg-black/45 p-0 sm:items-center sm:p-6"
      role="presentation"
      data-pendencias-overlay
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pendencias-titulo"
        className="flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-[var(--canvas)] pt-[env(safe-area-inset-top)] shadow-[var(--sh-lg)] sm:h-auto sm:max-h-[min(80dvh,640px)] sm:rounded-[16px] sm:pt-0"
      >
        <div className="shrink-0 px-4 pt-4">
          <h2 id="pendencias-titulo" tabIndex={-1} className="text-[16px] font-semibold text-[var(--ink)] outline-none">
            {soDocumentos ? 'Você possui documentos pendentes de assinatura.' : 'Você possui pendências.'}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--ink-3)]">
            {soDocumentos
              ? `${resumo.total} documento(s) aguardam a sua assinatura interna.`
              : `${resumo.total} item(ns) pendente(s).`}
          </p>
        </div>
        <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-3 sm:pb-0">
          {resumo.grupos.map((grupo) => (
            <section key={grupo.id}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12px] font-semibold text-[var(--ink-2)]">
                  {grupo.titulo} · {grupo.total}
                </p>
                {grupo.verMaisHref ? (
                  <Button type="button" variant="outlined" size="sm" className={`self-start ${ALVO_44}`} onClick={() => ir(grupo.verMaisHref!)}>
                    {GRUPO_ACAO[grupo.id] ?? 'Abrir lista'}
                  </Button>
                ) : null}
              </div>
              <ul className="mt-1 space-y-1">
                {grupo.itens.map((item) => (
                  <li
                    key={`${grupo.id}-${item.id}`}
                    className={`flex items-start gap-2 rounded-[10px] border px-3 py-2 ${item.atrasado ? 'border-amber-400 bg-amber-50' : 'border-[var(--line)]'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="mono text-[12px] font-semibold text-[var(--brand-hover)]">{item.codigo}</span>
                      <span className="mt-0.5 block text-[13px] text-[var(--ink)]">{item.titulo}</span>
                      <span className="text-[11px] text-[var(--ink-3)]">
                        {[item.status, item.secretaria, item.equipe, item.prazo ? new Date(item.prazo).toLocaleString('pt-BR') : null, item.atrasado ? 'Atrasado' : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    <Button type="button" variant="text" size="sm" className={`shrink-0 ${ALVO_44}`} onClick={() => ir(item.href)}>
                      Abrir
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="flex shrink-0 justify-end border-t border-[var(--line)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:border-t-0 sm:pb-3">
          <Button type="button" variant="outlined" size="sm" className={ALVO_44} onClick={fechar}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
    </PendenciasPortal>
  );
}

export function PendenciasVazio({ onClose }: { onClose: () => void }) {
  return (
    <PendenciasPortal>
      <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center" role="presentation">
        <div role="dialog" aria-modal="true" aria-labelledby="pendencias-vazio-titulo" className="w-full max-w-sm rounded-[16px] bg-[var(--canvas)] p-4">
          <h2 id="pendencias-vazio-titulo" className="text-[16px] font-semibold text-[var(--ink)]">Pendências</h2>
          <p className="mt-1 text-[13px] text-[var(--ink-3)]">Nenhuma pendência no momento.</p>
          <button type="button" className="mt-3 min-h-11 text-[13px] font-semibold text-[var(--brand)] sm:min-h-0" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </PendenciasPortal>
  );
}
