'use client';

import { useCallback, useState } from 'react';
import { getMapaCamadas } from '@/lib/api';
import type { MapaCamadaGrupo } from '@/lib/types';

/**
 * 299/300 — árvore das camadas do Webmap para o painel do mapa, sob demanda (só grupos e nomes, sem geometria).
 * 300: sempre ativa (a flag NEXT_PUBLIC_WEBMAP_CAMADAS_MAPA foi removida).
 */
export function useArvoreCamadasWebmap() {
  const [arvore, setArvore] = useState<MapaCamadaGrupo[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(false);
    getMapaCamadas()
      .then((data) => setArvore(Array.isArray(data) ? data : []))
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, []);
  /** Abre a aba Camadas: carrega uma vez. */
  const garantir = useCallback(() => {
    if (!arvore && !carregando) carregar();
  }, [arvore, carregando, carregar]);
  return { arvore, carregando, erro, carregar, garantir };
}
