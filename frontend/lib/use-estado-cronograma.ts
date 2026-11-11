'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { hrefDe, paramsIguais } from '@/lib/estado-url';
import { lerEstadoCronograma, serializarEstadoCronograma, type EstadoCronograma } from '@/lib/estado-url-cronograma';

export function useEstadoCronograma() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sp = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const lido = useMemo(() => lerEstadoCronograma(sp), [sp]);
  const [estado, setEstado] = useState<EstadoCronograma>(lido.estado);
  const chaveRef = useRef(lido.canonico.toString());
  const spVisto = useRef(sp.toString());
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  useEffect(() => {
    if (paramsIguais(sp, lido.canonico)) return;
    router.replace(hrefDe('/cronograma', lido.canonico));
  }, [sp, lido.canonico, router]);

  useEffect(() => {
    const spChave = sp.toString();
    if (spVisto.current === spChave) return;
    spVisto.current = spChave;
    const next = lerEstadoCronograma(new URLSearchParams(spChave));
    if (chaveRef.current === next.canonico.toString()) return;
    chaveRef.current = next.canonico.toString();
    setEstado(next.estado);
  }, [sp]);

  const definir = useCallback((patch: Partial<EstadoCronograma>) => {
    const next = { ...estadoRef.current, ...patch };
    const canon = serializarEstadoCronograma(next);
    chaveRef.current = canon.toString();
    estadoRef.current = next;
    setEstado(next);
    router.replace(hrefDe('/cronograma', canon));
  }, [router]);

  return { estado, definir };
}
