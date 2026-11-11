'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { hrefDe, paramsIguais } from '@/lib/estado-url';
import { lerEstadoDocumentos, serializarEstadoDocumentos, type EstadoDocumentos } from '@/lib/estado-url-documentos';

export function useEstadoDocumentos() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sp = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const lido = useMemo(() => lerEstadoDocumentos(sp), [sp]);
  const [estado, setEstado] = useState<EstadoDocumentos>(lido.estado);
  const chaveRef = useRef(lido.canonico.toString());
  const spVisto = useRef(sp.toString());
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  useEffect(() => {
    if (paramsIguais(sp, lido.canonico)) return;
    router.replace(hrefDe('/documentos', lido.canonico));
  }, [sp, lido.canonico, router]);

  useEffect(() => {
    const spChave = sp.toString();
    if (spVisto.current === spChave) return;
    spVisto.current = spChave;
    const next = lerEstadoDocumentos(new URLSearchParams(spChave));
    if (chaveRef.current === next.canonico.toString()) return;
    chaveRef.current = next.canonico.toString();
    setEstado(next.estado);
  }, [sp]);

  const definir = useCallback((patch: Partial<EstadoDocumentos>, modo: 'replace' | 'push' = 'replace') => {
    const next = { ...estadoRef.current, ...patch };
    if (!next.id) next.preencher = false;
    const canon = serializarEstadoDocumentos(next);
    chaveRef.current = canon.toString();
    estadoRef.current = next;
    setEstado(next);
    const href = hrefDe('/documentos', canon);
    if (modo === 'push') router.push(href);
    else router.replace(href);
  }, [router]);

  return { estado, definir };
}
