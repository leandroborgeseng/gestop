'use client';

/**
 * 309 (base para o 308) — componentes do padrão de inativos: sanfona, tag, Inativar/Reativar com confirmação
 * e aviso de somente leitura. Sem regra de negócio: a permissão e a auditoria ficam no backend.
 */
import { useId, useState } from 'react';
import { AlertTriangle, Ban, ChevronDown, Lock, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import {
  acaoStatusDisponivel,
  EntidadeInativavelTextos,
  rotuloAcaoStatus,
  rotuloSanfonaInativos,
  textoConfirmacaoStatus,
} from '@/lib/inativos';

export function TagInativo({ className }: { className?: string }) {
  return (
    <Badge variant="muted" className={cn('shrink-0', className)}>
      Inativo
    </Badge>
  );
}

export function SanfonaInativos({
  textos,
  total,
  children,
  defaultAberta = false,
  className,
}: {
  textos: Pick<EntidadeInativavelTextos, 'plural'>;
  total: number;
  children: React.ReactNode;
  defaultAberta?: boolean;
  className?: string;
}) {
  const [aberta, setAberta] = useState(defaultAberta);
  const painelId = useId();
  if (total === 0) return null;
  return (
    <div className={cn('mt-1 border-t border-[var(--line-2)] pt-1', className)} data-testid="sanfona-inativos">
      <button
        type="button"
        aria-expanded={aberta}
        aria-controls={painelId}
        onClick={() => setAberta((v) => !v)}
        className="flex min-h-11 w-full items-center gap-2 rounded-[var(--r-md)] px-3 text-left text-[13px] font-semibold text-[var(--ink-2)] hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
      >
        <ChevronDown className={cn('h-4 w-4 transition-transform', aberta ? 'rotate-180' : '')} aria-hidden />
        {rotuloSanfonaInativos(textos, aberta, total)}
      </button>
      <div id={painelId} hidden={!aberta} role="region" aria-label={`${textos.plural} inativos`}>
        {aberta ? children : null}
      </div>
    </div>
  );
}

export function AvisoSomenteLeitura({ mensagem, className }: { mensagem: string; className?: string }) {
  return (
    <div
      role="status"
      data-testid="aviso-somente-leitura"
      className={cn(
        'flex items-start gap-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--muted-bg)] px-4 py-3 text-[13px] font-medium text-[var(--ink-2)]',
        className,
      )}
    >
      <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{mensagem}</span>
    </div>
  );
}

/** Mostra "Inativar" no ativo e "Reativar" no inativo, sempre com confirmação. */
export function BotaoStatusAtivo({
  registro,
  textos,
  onConfirmar,
  disabled,
}: {
  registro: { ativo: boolean };
  textos: EntidadeInativavelTextos;
  onConfirmar: (acao: 'INATIVAR' | 'REATIVAR') => Promise<unknown> | void;
  disabled?: boolean;
}) {
  const acao = acaoStatusDisponivel(registro);
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const t = textoConfirmacaoStatus(textos, acao);
  const Icone = acao === 'INATIVAR' ? Ban : RotateCcw;
  return (
    <>
      <Button
        variant={acao === 'INATIVAR' ? 'text' : 'tonal'}
        size="sm"
        className={cn('min-h-11 gap-1.5', acao === 'INATIVAR' ? 'text-red-700' : '')}
        disabled={disabled}
        onClick={() => setAberto(true)}
      >
        <Icone className="h-4 w-4" aria-hidden />
        {rotuloAcaoStatus(acao)}
      </Button>
      <Sheet
        open={aberto}
        onClose={() => (enviando ? undefined : setAberto(false))}
        title={t.titulo}
        footer={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="filled"
              className={cn('min-h-11 flex-1', acao === 'INATIVAR' ? 'bg-red-700 hover:bg-red-800' : '')}
              disabled={enviando}
              data-testid="confirmar-status-ativo"
              onClick={async () => {
                setEnviando(true);
                try {
                  await onConfirmar(acao);
                  setAberto(false);
                } finally {
                  setEnviando(false);
                }
              }}
            >
              {enviando ? 'Salvando…' : t.confirmar}
            </Button>
            <Button type="button" variant="text" className="min-h-11" disabled={enviando} onClick={() => setAberto(false)}>
              Cancelar
            </Button>
          </div>
        }
      >
        <p className="text-[14px] text-[var(--ink-2)]">{t.descricao}</p>
      </Sheet>
    </>
  );
}

/** 309/C5: sinaliza cronograma/programação cujo checklist está inativo (não inicia vistoria nova). */
export function AvisoChecklistInativoCronograma({ compacto, className }: { compacto?: boolean; className?: string }) {
  return (
    <p
      data-testid="cronograma-checklist-inativo"
      className={cn(
        'flex items-start gap-1.5 rounded-[var(--r-md)] bg-[var(--warn-bg)] px-2 py-1 font-semibold text-[var(--warn)]',
        compacto ? 'text-[11px]' : 'text-[12.5px]',
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {compacto
          ? 'Checklist inativo: não inicia vistoria'
          : 'Checklist inativo: esta programação não inicia vistoria nova. Reative o checklist ou troque o modelo.'}
      </span>
    </p>
  );
}
