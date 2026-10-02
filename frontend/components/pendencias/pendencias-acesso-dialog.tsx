'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { PendenciasResumo } from '@/lib/api';

const GRUPO_ACAO: Record<string, string> = {
  documentos: 'Ir para documentos',
  tarefas: 'Ir para execução de tarefas',
  chamados: 'Ir para chamados',
};

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
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center overflow-hidden bg-black/45 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-6"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pendencias-titulo"
        className="flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-[16px] bg-[var(--canvas)] shadow-[var(--sh-lg)] sm:max-h-[min(80dvh,640px)]"
      >
        <div className="px-4 pt-4">
          <h2 id="pendencias-titulo" className="text-[16px] font-semibold text-[var(--ink)]">
            {soDocumentos ? 'Você possui documentos pendentes de assinatura.' : 'Você possui pendências.'}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--ink-3)]">
            {soDocumentos
              ? `${resumo.total} documento(s) aguardam a sua assinatura interna.`
              : `${resumo.total} item(ns) pendente(s).`}
          </p>
        </div>
        <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto px-4">
          {resumo.grupos.map((grupo) => (
            <section key={grupo.id}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12px] font-semibold text-[var(--ink-2)]">
                  {grupo.titulo} · {grupo.total}
                </p>
                {grupo.verMaisHref ? (
                  <Button type="button" variant="outlined" size="sm" className="self-start" onClick={() => ir(grupo.verMaisHref!)}>
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
                    <Button type="button" variant="text" size="sm" className="shrink-0" onClick={() => ir(item.href)}>
                      Abrir
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="flex justify-end px-4 py-3">
          <Button type="button" variant="outlined" size="sm" onClick={fechar}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
