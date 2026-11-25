'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { PendenciasAcessoDialog } from '@/components/pendencias/pendencias-acesso-dialog';
import { verificarAberturaDiariaPendencias, type PendenciasResumo } from '@/lib/api';
import { criarControleFoco, criarRastreioFormularios, haOutroModalAberto } from '@/lib/bloqueios-modal';
import { criarAberturaDiaria, type AberturaDiaria } from '@/lib/pendencias-abertura-diaria';

/**
 * 289: instância única por carregamento de página (escopo do módulo). Remontar o shell
 * (navegação interna) não chama o endpoint de novo; o adiado continua na memória da aba.
 */
const rastreio = criarRastreioFormularios();
let abrirNaTela: ((pendencias: PendenciasResumo) => void) | null = null;
let instancia: AberturaDiaria<PendenciasResumo> | null = null;

function aberturaDiaria() {
  instancia ??= criarAberturaDiaria<PendenciasResumo>({
    verificar: verificarAberturaDiariaPendencias,
    bloqueado: () => !abrirNaTela || haOutroModalAberto(document) || rastreio.haFormularioSujo(),
    abrir: (pendencias) => abrirNaTela?.(pendencias),
  });
  return instancia;
}

export function PendenciasAberturaAutomatica() {
  const pathname = usePathname();
  const [resumo, setResumo] = useState<PendenciasResumo | null>(null);
  const foco = useRef<ReturnType<typeof criarControleFoco> | null>(null);
  const primeiraRota = useRef(true);

  useEffect(() => {
    const controle = aberturaDiaria();
    foco.current = criarControleFoco(document);
    abrirNaTela = (pendencias) => setResumo(pendencias);

    const onVisibilidade = () => void controle.aoMudarVisibilidade(document.visibilityState);
    const onEditar = (e: Event) => rastreio.aoEditar(e.target as Element | null);
    const onSalvarOuDescartar = (e: Event) => {
      if (rastreio.aoSalvarOuDescartar(e.target as Element | null)) {
        // deixa o submit/reset terminar antes de tentar
        window.setTimeout(() => controle.aoLiberarBloqueio(), 0);
      }
    };
    const observer = new MutationObserver(() => {
      if (!controle.temAdiado()) {
        rastreio.podarDesconectados();
        return;
      }
      rastreio.podarDesconectados();
      controle.aoLiberarBloqueio();
    });

    document.addEventListener('visibilitychange', onVisibilidade);
    document.addEventListener('input', onEditar, true);
    document.addEventListener('change', onEditar, true);
    document.addEventListener('submit', onSalvarOuDescartar, true);
    document.addEventListener('reset', onSalvarOuDescartar, true);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal', 'role'] });

    void controle.aoCarregar();

    return () => {
      abrirNaTela = null;
      document.removeEventListener('visibilitychange', onVisibilidade);
      document.removeEventListener('input', onEditar, true);
      document.removeEventListener('change', onEditar, true);
      document.removeEventListener('submit', onSalvarOuDescartar, true);
      document.removeEventListener('reset', onSalvarOuDescartar, true);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (primeiraRota.current) {
      primeiraRota.current = false;
      return;
    }
    aberturaDiaria().aoNavegar();
  }, [pathname]);

  useEffect(() => {
    if (!resumo) return;
    const id = window.requestAnimationFrame(() => foco.current?.aoAbrir('pendencias-titulo'));
    return () => window.cancelAnimationFrame(id);
  }, [resumo]);

  return (
    <PendenciasAcessoDialog
      open={Boolean(resumo && resumo.total > 0)}
      resumo={resumo}
      onClose={() => {
        setResumo(null);
        foco.current?.aoFechar();
      }}
    />
  );
}
