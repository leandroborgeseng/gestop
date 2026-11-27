'use client';

import { useCallback, useRef, useState } from 'react';
import { getMapaCamadas } from '@/lib/api';
import type { MapaCamadaGrupo } from '@/lib/types';

export function mensagemErroArvoreCamadas(e: unknown): string {
  const status = (e as { status?: number } | null)?.status;
  const msg = e instanceof Error && e.message.trim() ? e.message : 'Erro ao carregar as camadas do Webmap.';
  if (typeof status === 'number' && !msg.includes(String(status))) return `${msg} (${status})`;
  return msg;
}

/**
 * 299/300 — árvore das camadas do Webmap para o painel do mapa, sob demanda (só grupos e nomes, sem geometria).
 * 300: sempre ativa (a flag NEXT_PUBLIC_WEBMAP_CAMADAS_MAPA foi removida).
 */
export function useArvoreCamadasWebmap() {
  const [arvore, setArvore] = useState<MapaCamadaGrupo[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const [erroMensagem, setErroMensagem] = useState<string | null>(null);
  /** 300: 403 — o perfil não tem acesso (não é falha temporária). */
  const [semAcesso, setSemAcesso] = useState(false);
  const arvoreRef = useRef(arvore);
  const carregandoRef = useRef(carregando);
  const erroRef = useRef(erro);
  const semAcessoRef = useRef(semAcesso);
  arvoreRef.current = arvore;
  carregandoRef.current = carregando;
  erroRef.current = erro;
  semAcessoRef.current = semAcesso;

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(false);
    setErroMensagem(null);
    setSemAcesso(false);
    getMapaCamadas()
      .then((data) => setArvore(Array.isArray(data) ? data : []))
      .catch((e: unknown) => {
        if ((e as { status?: number } | null)?.status === 403) setSemAcesso(true);
        else {
          setErro(true);
          setErroMensagem(mensagemErroArvoreCamadas(e));
        }
      })
      .finally(() => setCarregando(false));
  }, []);

  /**
   * Abre a aba Camadas / sessão com camada ligada: carrega uma vez.
   * Identidade estável — não rearma o useEffect da página quando carregando/erro mudam.
   * Depois de um erro, só `carregar` ("Tentar novamente") dispara de novo.
   */
  const garantir = useCallback(() => {
    if (!arvoreRef.current && !carregandoRef.current && !semAcessoRef.current && !erroRef.current) {
      carregar();
    }
  }, [carregar]);

  return { arvore, carregando, erro, erroMensagem, semAcesso, carregar, garantir };
}
