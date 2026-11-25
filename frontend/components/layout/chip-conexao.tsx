'use client';

/**
 * M1 (Designer): chip ÚNICO de conexão, no cabeçalho do app. Online = verde "Online"; offline = âmbar "Offline"
 * (nunca verde offline). Tocar abre os detalhes: último sync, pendências, GPS, rede, câmera e fila.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { IndicadorCampo, usePermissoesCampo } from '@/components/mobile/estado-campo';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { assinarEstadoFila, lerEstadoFila, rotuloConexao, ultimoSyncSalvo } from '@/lib/estado-fila';
import { readMobileQueue } from '@/lib/mobile-queue';
import { useEffectiveOnline } from '@/lib/use-effective-online';

const SERVIDOR = { pendentes: null, ultimoSyncEm: null };

export function ChipConexao({ compacto = false, syncPendentesServidor = 0 }: { compacto?: boolean; syncPendentesServidor?: number }) {
  const { online, refreshConnectivity } = useEffectiveOnline();
  const fila = useSyncExternalStore(assinarEstadoFila, lerEstadoFila, () => SERVIDOR);
  const [filaInicial, setFilaInicial] = useState<number>(0);
  const [aberto, setAberto] = useState(false);
  const permissoes = usePermissoesCampo();

  useEffect(() => {
    void readMobileQueue()
      .then((q) => setFilaInicial(q.length))
      .catch(() => undefined);
  }, [aberto]);

  const pendentes = fila.pendentes ?? filaInicial;
  const ultimo = fila.ultimoSyncEm ?? (typeof window !== 'undefined' ? ultimoSyncSalvo() : null);
  const r = rotuloConexao(online, pendentes);

  return (
    <>
      <button
        type="button"
        data-testid="chip-conexao"
        data-online={online ? '1' : '0'}
        aria-label={r.ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        onClick={() => {
          setAberto(true);
          void refreshConnectivity();
          void permissoes.atualizar();
        }}
        className={cn(
          'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--r-pill)] border px-2.5 font-semibold',
          compacto ? 'text-[11px]' : 'text-xs',
          r.tom === 'ok'
            ? 'border-[var(--ok-bd)] bg-[var(--ok-bg)] text-[var(--ok)]'
            : 'border-[var(--warn-bd)] bg-[var(--warn-bg)] text-[var(--warn)]',
        )}
      >
        <span className={cn('h-[7px] w-[7px] rounded-full', r.tom === 'ok' ? 'bg-[var(--ok)]' : 'bg-[var(--warn)]')} />
        {r.texto}
        {pendentes > 0 ? <span className="mono rounded-full bg-[var(--warn)] px-1.5 text-[10px] font-bold text-white">{pendentes}</span> : null}
      </button>
      <Sheet open={aberto} onClose={() => setAberto(false)} title="Conexão e aparelho">
        <div className="space-y-3 p-1" data-testid="detalhes-campo">
          <dl className="grid grid-cols-2 gap-2 text-[13px]">
            <dt className="text-[var(--ink-3)]">Conexão</dt>
            <dd data-testid="detalhes-conexao" className="font-semibold text-[var(--ink)]">{r.texto}</dd>
            <dt className="text-[var(--ink-3)]">Último sync</dt>
            <dd data-testid="detalhes-ultimo-sync" className="font-semibold text-[var(--ink)]">
              {ultimo ? new Date(ultimo).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Nenhum neste aparelho'}
            </dd>
            <dt className="text-[var(--ink-3)]">Pendentes</dt>
            <dd data-testid="detalhes-pendentes" className="font-semibold text-[var(--ink)]">
              {pendentes === 0 ? 'Nenhum envio' : `${pendentes} ${pendentes === 1 ? 'envio' : 'envios'}`}
              {syncPendentesServidor > 0 ? ` · ${syncPendentesServidor} no servidor` : ''}
            </dd>
          </dl>
          <IndicadorCampo gps={permissoes.gps} camera={permissoes.camera} online={online} />
          <p data-testid="detalhes-fila" className="text-[12px] text-[var(--ink-3)]">
            Fila: {pendentes === 0 ? 'nenhuma vistoria pendente' : `${pendentes} vistoria${pendentes === 1 ? '' : 's'} pendente${pendentes === 1 ? '' : 's'}`}
          </p>
        </div>
      </Sheet>
    </>
  );
}
