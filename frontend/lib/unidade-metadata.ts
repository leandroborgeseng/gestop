import { AdminUnidade, UnidadeMetadata } from '@/lib/types';

export function getUnidadeMetadata(unidade: AdminUnidade): UnidadeMetadata {
  return (unidade.metadata ?? {}) as UnidadeMetadata;
}

export function isQgisImported(unidade: AdminUnidade): boolean {
  return Boolean(getUnidadeMetadata(unidade).webmapSource?.repo);
}

export function getLockedFields(unidade: AdminUnidade): string[] {
  return getUnidadeMetadata(unidade).manualOverride?.lockedFields ?? [];
}

export function formatUnidadeOrigem(unidade: AdminUnidade): 'QGIS' | 'Manual' {
  return isQgisImported(unidade) ? 'QGIS' : 'Manual';
}
