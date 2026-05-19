import { UnidadeSituacao } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

const statusConfig: Record<UnidadeSituacao, { label: string; variant: 'success' | 'warning' | 'muted' | 'danger' }> = {
  OPERACIONAL: { label: 'Operacional', variant: 'success' },
  COM_PENDENCIAS: { label: 'Com pendências', variant: 'warning' },
  SEM_LOCALIZACAO: { label: 'Sem localização', variant: 'muted' },
  INATIVA: { label: 'Inativa', variant: 'danger' },
};

export function StatusBadge({ situacao }: { situacao: UnidadeSituacao }) {
  const config = statusConfig[situacao];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
