'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { hrefDe, paramsIguais } from '@/lib/estado-url';
import { lerEstadoExecucao, serializarEstadoExecucao, type EstadoExecucao } from '@/lib/estado-url-execucao';

export function useEstadoExecucao() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sp = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const lido = useMemo(() => lerEstadoExecucao(sp), [sp]);
  const [estado, setEstado] = useState<EstadoExecucao>(lido.estado);
  const chaveRef = useRef(lido.canonico.toString());
  const spVisto = useRef(sp.toString());
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  useEffect(() => {
    if (paramsIguais(sp, lido.canonico)) return;
    router.replace(hrefDe('/execucao', lido.canonico));
  }, [sp, lido.canonico, router]);

  useEffect(() => {
    const spChave = sp.toString();
    if (spVisto.current === spChave) return;
    spVisto.current = spChave;
    const next = lerEstadoExecucao(new URLSearchParams(spChave));
    if (chaveRef.current === next.canonico.toString()) return;
    chaveRef.current = next.canonico.toString();
    setEstado(next.estado);
  }, [sp]);

  const definir = useCallback((patch: Partial<EstadoExecucao>, modo: 'replace' | 'push' = 'replace') => {
    const next = { ...estadoRef.current, ...patch };
    const canon = serializarEstadoExecucao(next);
    chaveRef.current = canon.toString();
    estadoRef.current = next;
    setEstado(next);
    const href = hrefDe('/execucao', canon);
    if (modo === 'push') router.push(href);
    else router.replace(href);
  }, [router]);

  return { estado, definir };
}
