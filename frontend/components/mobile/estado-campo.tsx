'use client';

/**
 * 303/G1 + G7 — onboarding de permissões (câmera e localização pelos diálogos oficiais do navegador)
 * e indicador discreto de GPS, rede e câmera.
 */
import { Camera, MapPin, Wifi, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export type EstadoPermissao = 'granted' | 'denied' | 'prompt' | 'indisponivel' | 'desconhecido';
const ONBOARDING_KEY = 'sigma.campo.onboarding.303';

async function consultar(nome: 'geolocation' | 'camera'): Promise<EstadoPermissao> {
  if (typeof navigator === 'undefined') return 'desconhecido';
  if (nome === 'geolocation' && !navigator.geolocation) return 'indisponivel';
  if (nome === 'camera' && !navigator.mediaDevices?.getUserMedia) return 'indisponivel';
  try {
    const r = await navigator.permissions.query({ name: nome as PermissionName });
    return r.state as EstadoPermissao;
  } catch {
    return 'desconhecido';
  }
}

export function usePermissoesCampo() {
  const [gps, setGps] = useState<EstadoPermissao>('desconhecido');
  const [camera, setCamera] = useState<EstadoPermissao>('desconhecido');
  const atualizar = useCallback(async () => {
    setGps(await consultar('geolocation'));
    setCamera(await consultar('camera'));
  }, []);
  useEffect(() => {
    void atualizar();
  }, [atualizar]);
  return { gps, camera, atualizar };
}

/** Bloqueado = o usuário precisa agir (permissão negada ou recurso ausente). "Ainda não perguntado" não é bloqueio. */
export function permissaoBloqueada(estado: EstadoPermissao) {
  return estado === 'denied' || estado === 'indisponivel';
}

const rotuloFeminino: Record<EstadoPermissao, string> = {
  granted: 'liberada',
  denied: 'bloqueada',
  prompt: 'não autorizada',
  indisponivel: 'indisponível',
  desconhecido: '—',
};

/** Lows/Designer: concordância — "Câmera bloqueada". */
export function rotuloCamera(estado: EstadoPermissao) {
  return `Câmera ${rotuloFeminino[estado]}`;
}

const rotulo: Record<EstadoPermissao, string> = {
  granted: 'liberado',
  denied: 'bloqueado',
  prompt: 'não autorizado',
  indisponivel: 'indisponível',
  desconhecido: '—',
};

export function IndicadorCampo({
  gps,
  camera,
  online,
  ultimoGps,
  somenteBloqueios = false,
}: {
  gps: EstadoPermissao;
  camera: EstadoPermissao;
  online: boolean;
  /** Designer M1: inline, mostra só o que está bloqueado (nada quando está tudo ok). */
  somenteBloqueios?: boolean;
  /** Resultado do último check-in (ex.: "12 m") ou falha curta. */
  ultimoGps?: string | null;
}) {
  const item = (ok: boolean, icon: React.ReactNode, texto: string, testid: string) => (
    <span
      data-testid={testid}
      data-ok={ok ? '1' : '0'}
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--r-pill)] border px-2 py-0.5 text-[11px] font-semibold',
        ok ? 'border-[var(--ok-bd)] bg-[var(--ok-bg)] text-[var(--ok)]' : 'border-[var(--warn-bd)] bg-[var(--warn-bg)] text-[var(--warn)]',
      )}
    >
      {icon}
      {texto}
    </span>
  );
  const mostrarGps = !somenteBloqueios || permissaoBloqueada(gps);
  const mostrarRede = !somenteBloqueios || !online;
  const mostrarCamera = !somenteBloqueios || permissaoBloqueada(camera);
  if (!mostrarGps && !mostrarRede && !mostrarCamera) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      aria-label="Estado do GPS, da rede e da câmera"
      data-testid={somenteBloqueios ? 'indicador-campo-bloqueios' : 'indicador-campo'}
    >
      {mostrarGps ? item(gps === 'granted', <MapPin className="h-3 w-3" />, `GPS ${ultimoGps ? `· ${ultimoGps}` : rotulo[gps]}`, 'indicador-gps') : null}
      {mostrarRede ? item(online, online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />, online ? 'Rede online' : 'Sem rede', 'indicador-rede') : null}
      {mostrarCamera ? item(camera === 'granted', <Camera className="h-3 w-3" />, rotuloCamera(camera), 'indicador-camera') : null}
    </div>
  );
}

export function OnboardingPermissoes({
  gps,
  camera,
  onAtualizar,
}: {
  gps: EstadoPermissao;
  camera: EstadoPermissao;
  onAtualizar: () => void;
}) {
  const [visto, setVisto] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    setVisto(window.localStorage.getItem(ONBOARDING_KEY) === '1');
  }, []);
  if (visto || (gps === 'granted' && camera === 'granted')) return null;

  const concluir = () => {
    window.localStorage.setItem(ONBOARDING_KEY, '1');
    setVisto(true);
  };
  // Os pedidos abaixo abrem o diálogo OFICIAL do navegador (não simulamos botões de permissão).
  const pedirLocalizacao = () =>
    navigator.geolocation?.getCurrentPosition(
      () => onAtualizar(),
      () => {
        setMsg('Localização não liberada. Você pode liberar depois nas configurações do navegador.');
        onAtualizar();
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  const pedirCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setMsg('Câmera não liberada. Você ainda pode anexar fotos pela galeria.');
    }
    onAtualizar();
  };

  return (
    <section
      data-testid="onboarding-permissoes"
      className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--sh-sm)]"
    >
      <h2 className="text-[15px] font-semibold text-[var(--ink)]">Antes de ir a campo</h2>
      <p className="mt-1 text-[13px] text-[var(--ink-3)]">
        A vistoria usa a localização no check-in e a câmera para as fotos. O navegador vai perguntar; toque em “Permitir”.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant={gps === 'granted' ? 'outlined' : 'filled'} size="sm" disabled={gps === 'granted'} onClick={pedirLocalizacao}>
          <MapPin className="mr-1.5 h-4 w-4" />
          {gps === 'granted' ? 'Localização liberada' : 'Liberar localização'}
        </Button>
        <Button type="button" variant={camera === 'granted' ? 'outlined' : 'filled'} size="sm" disabled={camera === 'granted'} onClick={() => void pedirCamera()}>
          <Camera className="mr-1.5 h-4 w-4" />
          {camera === 'granted' ? 'Câmera liberada' : 'Liberar câmera'}
        </Button>
        <Button type="button" variant="text" size="sm" onClick={concluir}>
          Continuar
        </Button>
      </div>
      {msg ? <p className="mt-2 text-[12px] text-[var(--warn)]">{msg}</p> : null}
    </section>
  );
}
