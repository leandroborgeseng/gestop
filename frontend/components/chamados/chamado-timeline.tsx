'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Check, Paperclip } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AuthenticatedImage } from '@/components/ui/authenticated-image';
import { ZoomableAuthenticatedImage } from '@/components/ui/zoomable-authenticated-image';
import { AuthenticatedStorageLink } from '@/components/ui/authenticated-storage-link';
import { ChamadoTimelineStep } from '@/lib/chamado-status';

export function ChamadoTimeline({ steps }: { steps: ChamadoTimelineStep[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggle(key: string) {
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div className="space-y-0">
      {steps.map((step, index) => {
        const key = step.id ?? `${step.title}-${index}`;
        const isExpanded = expanded[key] ?? false;
        const canExpand = Boolean(step.expand);

        return (
          <div key={key} className="relative flex gap-3 pb-5 last:pb-0">
            {index < steps.length - 1 ? (
              <span
                className={cn(
                  'absolute top-6 left-[11px] w-0.5 -translate-x-1/2',
                  step.done ? 'bg-[var(--ok)]' : 'bg-[var(--line)]',
                )}
                style={{ height: 'calc(100% - 12px)' }}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                'relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                step.done
                  ? 'border-[var(--ok)] bg-[var(--ok)] text-white'
                  : step.active
                    ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-3)]',
              )}
            >
              {step.done ? <Check className="h-3 w-3" strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-current opacity-40" />}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                {canExpand ? (
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className="inline-flex items-center gap-1 text-left text-[13px] font-semibold text-[var(--ink)] hover:text-[var(--brand-hover)]"
                  >
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {step.title}
                  </button>
                ) : (
                  <span className={cn('text-[13px] font-semibold', step.active ? 'text-[var(--brand-hover)]' : 'text-[var(--ink)]')}>
                    {step.title}
                  </span>
                )}
                <span className="mono text-[11px] text-[var(--ink-3)]">{step.date}</span>
              </div>
              {step.sub ? <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">{step.sub}</p> : null}

              {canExpand && isExpanded && step.expand ? (
                <div className="mt-2 space-y-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3 text-[12px] text-[var(--ink-2)]">
                  <p className="text-[11px] text-[var(--ink-3)]">
                    {[step.expand.usuario, step.expand.dataHora ?? step.date].filter(Boolean).join(' · ')}
                  </p>
                  {step.expand.descricao ? (
                    <p className="whitespace-pre-wrap">{step.expand.descricao}</p>
                  ) : null}
                  {step.expand.alteracoes?.map((item) => (
                    <div key={item.campo}>
                      <p className="font-semibold text-[var(--ink)]">{item.label}</p>
                      <p>De: {item.de}</p>
                      <p>Para: {item.para}</p>
                    </div>
                  ))}
                  {step.expand.detalhes?.map((item) => (
                    <div key={item.label}>
                      <p className="font-semibold text-[var(--ink)]">{item.label}</p>
                      <p className="whitespace-pre-wrap">{item.value}</p>
                    </div>
                  ))}
                  {step.expand.anexos && step.expand.anexos.length > 0 ? (
                    <div className="space-y-2">
                      <p className="inline-flex items-center gap-1 font-semibold text-[var(--ink)]">
                        <Paperclip className="h-3.5 w-3.5" />
                        Anexos
                      </p>
                      {step.expand.anexos.map((anexo) => {
                        const isImage = (anexo.mimeType ?? '').startsWith('image/');
                        return isImage ? (
                          <ZoomableAuthenticatedImage
                            key={anexo.id}
                            src={anexo.url}
                            alt={anexo.nome ?? 'Anexo'}
                            className="max-h-40 w-full object-cover"
                            previewClassName="max-h-[88vh] object-contain"
                          />
                        ) : (
                          <AuthenticatedStorageLink
                            key={anexo.id}
                            href={anexo.url}
                            label={anexo.nome ?? 'Arquivo anexo'}
                          />
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
