'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { hrefDe, paramsIguais } from '@/lib/estado-url';
import { lerEstadoChamados, serializarEstadoChamados, type EstadoChamados } from '@/lib/estado-url-chamados';

export function useEstadoChamados() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sp = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const lido = useMemo(() => lerEstadoChamados(sp), [sp]);
  const [estado, setEstado] = useState<EstadoChamados>(lido.estado);
  const chaveRef = useRef(lido.canonico.toString());
  const spVisto = useRef(sp.toString());

  useEffect(() => {
    if (paramsIguais(sp, lido.canonico)) return;
    router.replace(hrefDe('/chamados', lido.canonico));
  }, [sp, lido.canonico, router]);

  useEffect(() => {
    const spChave = sp.toString();
    if (spVisto.current === spChave) return;
    spVisto.current = spChave;
    const next = lerEstadoChamados(new URLSearchParams(spChave));
    if (chaveRef.current === next.canonico.toString()) return;
    chaveRef.current = next.canonico.toString();
    setEstado(next.estado);
  }, [sp]);

  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  const definir = useCallback((patch: Partial<EstadoChamados>, modo: 'replace' | 'push' = 'replace') => {
    const next = { ...estadoRef.current, ...patch };
    const canon = serializarEstadoChamados(next);
    chaveRef.current = canon.toString();
    estadoRef.current = next;
    setEstado(next);
    const href = hrefDe('/chamados', canon);
    if (modo === 'push') router.push(href);
    else router.replace(href);
  }, [router]);

  return { estado, definir };
}
