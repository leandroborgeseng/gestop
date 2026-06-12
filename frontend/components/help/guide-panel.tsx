'use client';

import { useState } from 'react';
import { ChevronDown, FileText, Lightbulb, MapPin, X } from 'lucide-react';
import { GUIDE_ATALHOS, type GuideContent } from '@/lib/guide-content';
import { IconButton } from '@/components/ui/icon-button';

function HowToItem({ title, steps }: { title: string; steps: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={[
        'overflow-hidden rounded-[var(--r-md)] border bg-[var(--surface)]',
        open ? 'border-[color-mix(in_srgb,var(--brand)_35%,transparent)] bg-[var(--surface-2)]' : 'border-[var(--line)]',
      ].join(' ')}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="flex-1 text-[13px] font-semibold text-[var(--ink)]">{title}</span>
        <ChevronDown
          className={['h-4 w-4 text-[var(--ink-3)] transition-transform', open && 'rotate-180 text-[var(--brand)]'].filter(Boolean).join(' ')}
        />
      </button>
      {open ? (
        <ol className="m-0 list-none space-y-2 px-3.5 pb-3.5">
          {steps.map((step, index) => (
            <li key={step} className="relative pl-7 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
              <span className="mono absolute left-0 flex h-[19px] w-[19px] items-center justify-center rounded-full bg-[var(--brand-soft)] text-[11px] font-semibold text-[var(--brand-hover)]">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export function GuidePanel({
  open,
  onClose,
  content,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  content: GuideContent;
  pathname: string;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Fechar guia"
        className="fixed inset-0 z-[900] bg-[rgba(15,27,45,0.28)] backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        className="fixed top-0 right-0 z-[901] flex h-dvh w-[396px] max-w-[92vw] flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-lg)] animate-[slideInGuide_0.26s_cubic-bezier(0.4,0,0.2,1)]"
        role="dialog"
        aria-labelledby="guide-title"
      >
        <div className="bg-gradient-to-br from-[var(--brand)] to-[var(--brand-bright)] px-[18px] py-4 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/15">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="guide-title" className="text-base font-bold tracking-[-0.01em]">
                Guia do SIGMA
              </h2>
              <p className="text-xs opacity-85">Manual contextual</p>
            </div>
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="Fechar"
              onClick={onClose}
              className="text-white hover:bg-white/15 hover:text-white"
            >
              <X className="h-5 w-5" />
            </IconButton>
          </div>
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-white/14 px-2.5 py-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>
              Nesta tela: <b className="font-semibold">{content.nome}</b>
            </span>
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-[18px] py-[18px]">
          <section className="mb-5">
            <h3 className="section-title mb-2.5">Nesta tela</h3>
            <p className="text-[13.5px] leading-relaxed text-[var(--ink-2)]">{content.resumo}</p>
          </section>

          <section className="mb-5">
            <h3 className="section-title mb-2.5">Como fazer</h3>
            <div className="flex flex-col gap-1.5">
              {content.comoFazer.map((item) => (
                <HowToItem key={item.t} title={item.t} steps={item.s} />
              ))}
            </div>
          </section>

          {content.glossario.length > 0 ? (
            <section className="mb-5">
              <h3 className="section-title mb-2.5">Glossário</h3>
              <dl className="m-0 space-y-3">
                {content.glossario.map((item) => (
                  <div key={item.k}>
                    <dt className="text-[13px] font-semibold text-[var(--ink)]">{item.k}</dt>
                    <dd className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--ink-3)]">{item.v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <section>
            <h3 className="section-title mb-2.5">Atalhos</h3>
            <div className="space-y-2">
              {GUIDE_ATALHOS.map((item) => (
                <div key={item.k} className="flex items-center gap-2.5 text-[12.5px] text-[var(--ink-2)]">
                  <kbd className="mono min-w-[30px] rounded-md border border-b-2 border-[var(--line)] bg-[var(--surface-2)] px-1.5 py-0.5 text-center text-[11px] text-[var(--ink)]">
                    {item.k}
                  </kbd>
                  {item.d}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mx-[18px] mb-[18px] flex gap-2 rounded-[var(--r-md)] bg-[var(--brand-soft)] p-3 text-xs leading-relaxed text-[var(--brand-hover)]">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Rota atual: <span className="mono font-medium">{pathname}</span>. O conteúdo muda automaticamente
            conforme você navega.
          </span>
        </div>
      </aside>
    </>
  );
}
