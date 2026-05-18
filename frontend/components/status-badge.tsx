import { UnidadeSituacao } from '@/lib/types';

const statusConfig: Record<UnidadeSituacao, { label: string; className: string }> = {
  OPERACIONAL: {
    label: 'Operacional',
    className: 'bg-green-50 text-green-700 ring-green-600/20',
  },
  COM_PENDENCIAS: {
    label: 'Com pendências',
    className: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  },
  SEM_LOCALIZACAO: {
    label: 'Sem localização',
    className: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  },
  INATIVA: {
    label: 'Inativa',
    className: 'bg-red-50 text-red-700 ring-red-600/20',
  },
};

export function StatusBadge({ situacao }: { situacao: UnidadeSituacao }) {
  const config = statusConfig[situacao];

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${config.className}`}>
      {config.label}
    </span>
  );
}
