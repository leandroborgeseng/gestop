import { ChamadoMapPoint, ChamadoResumo } from '@/lib/types';

export function chamadoTitulo(chamado: Pick<ChamadoResumo, 'titulo' | 'descricao'>) {
  return chamado.titulo?.trim() || chamado.descricao;
}

export function chamadoLocalLabel(
  chamado: Pick<ChamadoResumo, 'unidade' | 'enderecoTexto' | 'modoLocalizacao' | 'enderecoBairro'>,
) {
  if (chamado.unidade?.nome) return chamado.unidade.nome;
  if (chamado.enderecoTexto?.trim()) {
    return chamado.enderecoBairro?.trim()
      ? `${chamado.enderecoTexto} · ${chamado.enderecoBairro}`
      : chamado.enderecoTexto;
  }
  if (chamado.modoLocalizacao === 'GEOLOCALIZACAO') return 'Local por GPS';
  return 'Sem local vinculado';
}

export function resolveChamadoCoordinates(chamado: ChamadoResumo) {
  const latitude = chamado.latitude ?? chamado.unidade?.latitude ?? null;
  const longitude = chamado.longitude ?? chamado.unidade?.longitude ?? null;
  if (latitude == null || longitude == null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

export function chamadoToMapPoint(chamado: ChamadoResumo): ChamadoMapPoint | null {
  const coords = resolveChamadoCoordinates(chamado);
  if (!coords) return null;

  return {
    id: chamado.id,
    codigo: chamado.codigo,
    titulo: chamadoTitulo(chamado),
    latitude: coords.latitude,
    longitude: coords.longitude,
    unidadeNome: chamadoLocalLabel(chamado),
    prioridade: chamado.prioridade,
    equipeNome: chamado.equipe?.nome ?? null,
  };
}
