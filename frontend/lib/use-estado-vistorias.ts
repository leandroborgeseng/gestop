'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { hrefDe, paramsIguais } from '@/lib/estado-url';
import { lerEstadoVistorias, serializarEstadoVistorias, type EstadoVistorias } from '@/lib/estado-url-vistorias';

export function useEstadoVistorias() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sp = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const lido = useMemo(() => lerEstadoVistorias(sp), [sp]);
  const [estado, setEstado] = useState<EstadoVistorias>(lido.estado);
  const chaveRef = useRef(lido.canonico.toString());
  const spVisto = useRef(sp.toString());
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  useEffect(() => {
    if (paramsIguais(sp, lido.canonico)) return;
    router.replace(hrefDe('/vistorias', lido.canonico));
  }, [sp, lido.canonico, router]);

  useEffect(() => {
    const spChave = sp.toString();
    if (spVisto.current === spChave) return;
    spVisto.current = spChave;
    const next = lerEstadoVistorias(new URLSearchParams(spChave));
    if (chaveRef.current === next.canonico.toString()) return;
    chaveRef.current = next.canonico.toString();
    setEstado(next.estado);
  }, [sp]);

  const definir = useCallback((patch: Partial<EstadoVistorias>, modo: 'replace' | 'push' = 'replace') => {
    const next = { ...estadoRef.current, ...patch };
    const canon = serializarEstadoVistorias(next);
    chaveRef.current = canon.toString();
    estadoRef.current = next;
    setEstado(next);
    const href = hrefDe('/vistorias', canon);
    if (modo === 'push') router.push(href);
    else router.replace(href);
  }, [router]);

  return { estado, definir };
}
