'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui-states';
import { getPublicChamadoProtocolo } from '@/lib/api';
import { CHAMADO_STATUS_META } from '@/lib/chamado-status';
import { ChamadoProtocoloPublico } from '@/lib/types';

export default function ConsultaProtocoloDetalhePage() {
  const params = useParams<{ codigo: string }>();
  const codigo = decodeURIComponent(params.codigo ?? '').toUpperCase();
  const [data, setData] = useState<ChamadoProtocoloPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    setLoading(true);
    setError(null);
    getPublicChamadoProtocolo(codigo)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Protocolo não encontrado.'))
      .finally(() => setLoading(false));
  }, [codigo]);

  const statusMeta = data ? CHAMADO_STATUS_META[data.status as keyof typeof CHAMADO_STATUS_META] : null;

  return (
    <main className="min-h-dvh bg-[#e7ecf3] px-4 py-7 font-[family-name:var(--font-sans)]">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-[20px] bg-[var(--canvas)] shadow-[var(--sh-lg)]">
        <header className="bg-gradient-to-br from-[var(--brand-hover)] to-[var(--brand-bright)] px-[18px] pt-[18px] pb-[22px] text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
              <Image src="/franca-mark.png" alt="PMF" width={26} height={31} className="object-contain" />
            </span>
            <div>
              <p className="text-[15px] font-bold leading-tight">Prefeitura de Franca</p>
              <p className="text-[11px] opacity-90">Protocolo {codigo}</p>
            </div>
          </div>
        </header>

        <div className="p-5">
          {loading ? <LoadingState label="Consultando protocolo..." /> : null}
          {error ? <Alert variant="error">{error}</Alert> : null}

          {data ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="mono text-[16px] font-bold text-[var(--brand-hover)]">{data.codigo}</p>
                {statusMeta ? (
                  <Badge variant={statusMeta.badge}>{statusMeta.label}</Badge>
                ) : (
                  <Badge>{data.status}</Badge>
                )}
              </div>

              <div className="space-y-1 text-[13px] text-[var(--ink-2)]">
                <p>{data.descricaoResumo}</p>
                {data.local ? <p><strong>Local:</strong> {data.local}{data.bairro ? ` · ${data.bairro}` : ''}</p> : null}
                {data.secretaria ? <p><strong>Secretaria:</strong> {data.secretaria}</p> : null}
                <p className="text-[12px] text-[var(--ink-3)]">
                  Aberto em {new Date(data.abertoEm).toLocaleString('pt-BR')}
                  {data.encerradoEm ? ` · Encerrado em ${new Date(data.encerradoEm).toLocaleString('pt-BR')}` : ''}
                </p>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Andamento</p>
                <ol className="space-y-2 border-l-2 border-[var(--line)] pl-3">
                  {data.historico.map((item, index) => {
                    const meta = CHAMADO_STATUS_META[item.status as keyof typeof CHAMADO_STATUS_META];
                    return (
                      <li key={`${item.em}-${index}`} className="text-[12px]">
                        <p className="font-semibold text-[var(--ink)]">{meta?.label ?? item.status}</p>
                        {item.motivo ? <p className="text-[var(--ink-3)]">{item.motivo}</p> : null}
                        <p className="text-[11px] text-[var(--ink-4)]">{new Date(item.em).toLocaleString('pt-BR')}</p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-5 text-center text-[12px] text-[var(--ink-3)]">
        <Link href="/chamado/protocolo" className="text-[var(--brand)] hover:underline">
          Nova consulta
        </Link>
      </p>
    </main>
  );
}
