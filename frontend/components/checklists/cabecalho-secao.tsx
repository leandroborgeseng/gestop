import { deveExibirCabecalhoSecao } from '@/lib/checklist-item-opcoes';

export function CabecalhoSecao({
  atual,
  anterior,
}: {
  atual?: string | null;
  anterior?: string | null;
}) {
  if (!deveExibirCabecalhoSecao(atual, anterior)) return null;
  return (
    <h4 className="px-1 pt-2 text-[12px] font-bold tracking-wide text-[var(--ink-3)] uppercase">{atual?.trim()}</h4>
  );
}
