'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { decidirEcoDaUrl, registrarEscrita } from '@/lib/eco-url';
import { hrefDe, paramsIguais } from '@/lib/estado-url';
import { lerEstadoDocumentos, serializarEstadoDocumentos, type EstadoDocumentos } from '@/lib/estado-url-documentos';

export function useEstadoDocumentos() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sp = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const lido = useMemo(() => lerEstadoDocumentos(sp), [sp]);
  const [estado, setEstado] = useState<EstadoDocumentos>(lido.estado);
  const chaveRef = useRef(lido.canonico.toString());
  const nossasRef = useRef<string[]>([lido.canonico.toString()]);
  const spVisto = useRef(sp.toString());
  const popstateRef = useRef(false);
  const escritaRef = useRef(0);
  const confirmadaRef = useRef(0);
  const estadoRef = useRef(estado);

  useEffect(() => {
    const marcar = () => {
      popstateRef.current = true;
    };
    window.addEventListener('popstate', marcar, true);
    return () => window.removeEventListener('popstate', marcar, true);
  }, []);

  useEffect(() => {
    if (escritaRef.current !== confirmadaRef.current) return;
    if (paramsIguais(sp, lido.canonico)) return;
    router.replace(hrefDe('/documentos', lido.canonico));
  }, [sp, lido.canonico, router]);

  useEffect(() => {
    const spChave = sp.toString();
    if (spVisto.current === spChave) return;
    spVisto.current = spChave;
    const next = lerEstadoDocumentos(new URLSearchParams(spChave));
    const canon = next.canonico.toString();
    const popstate = popstateRef.current;
    popstateRef.current = false;
    const decisao = decidirEcoDaUrl({
      canon,
      chave: chaveRef.current,
      nossas: nossasRef.current,
      popstate,
      escritaPendente: escritaRef.current !== confirmadaRef.current,
    });
    nossasRef.current = decisao.nossas;
    if (decisao.tipo === 'igual') {
      confirmadaRef.current = escritaRef.current;
      return;
    }
    if (decisao.tipo === 'eco') {
      router.replace(hrefDe('/documentos', new URLSearchParams(chaveRef.current)));
      return;
    }
    chaveRef.current = canon;
    confirmadaRef.current = escritaRef.current;
    estadoRef.current = next.estado;
    setEstado(next.estado);
  }, [sp, router]);

  const definir = useCallback((patch: Partial<EstadoDocumentos>, modo: 'replace' | 'push' = 'replace') => {
    escritaRef.current += 1;
    const next = { ...estadoRef.current, ...patch };
    if (!next.id) next.preencher = false;
    const canon = serializarEstadoDocumentos(next);
    const canonChave = canon.toString();
    nossasRef.current = registrarEscrita(nossasRef.current, canonChave);
    chaveRef.current = canonChave;
    estadoRef.current = next;
    setEstado(next);
    const href = hrefDe('/documentos', canon);
    if (modo === 'push') router.push(href);
    else router.replace(href);
  }, [router]);

  return { estado, definir };
}
