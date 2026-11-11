'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ChamadoMapaItem } from '@/lib/types';
import { chamadoTitulo } from '@/lib/chamado-geo';
import { CHAMADO_STATUS_META, prazoInfo } from '@/lib/chamado-status';
import { Badge } from '@/components/ui/badge';
import { CcoDetalheBarra } from '@/components/cco/cco-detalhe-barra';

export function ChamadoMapaDrawer({
  chamado,
  open,
  onClose,
}: {
  chamado: ChamadoMapaItem | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !chamado) return null;

  const statusMeta = CHAMADO_STATUS_META[chamado.status];
  const prazo = prazoInfo(chamado.prazoEm, chamado.status);
  const titulo = chamadoTitulo(chamado);

  return (
    <CcoDetalheBarra
      titulo={titulo}
      rotuloFechar={`Fechar detalhes de ${titulo}`}
      onClose={onClose}
      kicker={<div className="mono text-[11px] font-semibold text-[var(--brand-hover)]">{chamado.codigo}</div>}
      meta={
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant={statusMeta?.badge ?? 'muted'}>{statusMeta?.label ?? chamado.status}</Badge>
          <Badge variant="neutral">{chamado.prioridade}</Badge>
          {chamado.slaMapa ? (
            <Badge variant={chamado.slaMapa === 'FORA' ? 'danger' : 'success'}>
              {chamado.slaMapa === 'FORA' ? 'Fora do prazo' : 'Dentro do prazo'}
            </Badge>
          ) : null}
        </div>
      }
      rodape={
        <Link
          href={`/chamados?id=${chamado.id}`}
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[var(--brand)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--brand-hover)]"
        >
          Abrir em Chamados
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="space-y-4 text-[13px]">
        <div>
          <div className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Local</div>
          <p className="mt-1 text-[var(--ink-2)]">
            {chamado.unidade?.nome ?? chamado.enderecoTexto ?? 'Sem endereço'}
            {(chamado.enderecoBairro || chamado.unidade?.bairro) &&
              ` · ${chamado.enderecoBairro ?? chamado.unidade?.bairro}`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Secretaria</div>
            <p className="mt-1 text-[var(--ink-2)]">{chamado.secretaria.sigla}</p>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Tipo</div>
            <p className="mt-1 text-[var(--ink-2)]">{chamado.tipoChamado?.nome ?? '—'}</p>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Equipe</div>
            <p className="mt-1 text-[var(--ink-2)]">{chamado.equipe?.nome ?? '—'}</p>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">SLA</div>
            <p className="mt-1 text-[var(--ink-2)]">{prazo.sub ?? prazo.label}</p>
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Descrição</div>
          <p className="mt-1 whitespace-pre-wrap text-[var(--ink-2)]">{chamado.descricao}</p>
        </div>
      </div>
    </CcoDetalheBarra>
  );
}
