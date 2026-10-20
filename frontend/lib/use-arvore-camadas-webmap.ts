'use client';

import { useCallback, useState } from 'react';
import { getMapaCamadas } from '@/lib/api';
import type { MapaCamadaGrupo } from '@/lib/types';

/**
 * 299 — árvore das camadas do Webmap para o painel do mapa, sob demanda.
 * W-OCULTO: com `ativo` falso (flag NEXT_PUBLIC_WEBMAP_CAMADAS_MAPA desligada) `carregar` não faz NENHUMA requisição.
 */
export function useArvoreCamadasWebmap(ativo: boolean) {
  const [arvore, setArvore] = useState<MapaCamadaGrupo[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const carregar = useCallback(() => {
    if (!ativo) return;
    setCarregando(true);
    setErro(false);
    getMapaCamadas()
      .then((data) => setArvore(Array.isArray(data) ? data : []))
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, [ativo]);
  /** Abre a aba Camadas: carrega uma vez (só com a flag ligada). */
  const garantir = useCallback(() => {
    if (ativo && !arvore && !carregando) carregar();
  }, [ativo, arvore, carregando, carregar]);
  return { arvore, carregando, erro, carregar, garantir };
}
