export function CabecalhoSecao({
  atual,
  anterior,
}: {
  atual?: string | null;
  anterior?: string | null;
}) {
  const secao = atual?.trim() ?? '';
  const previa = anterior?.trim() ?? '';
  if (!secao || secao === previa) return null;
  return (
    <h4 className="px-1 pt-2 text-[12px] font-bold tracking-wide text-[var(--ink-3)] uppercase">{secao}</h4>
  );
}
