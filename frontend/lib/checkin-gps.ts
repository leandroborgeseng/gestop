/**
 * 303 — check-in com GPS validado na hora (G2/G2a/G3/G4).
 * Mensagens distintas para cada falha; "sem conexão" nunca é tratado como "GPS desligado".
 */
export const PRECISAO_CHECKIN_PADRAO_METROS = 50;

export type FalhaGps = 'PERMISSAO_NEGADA' | 'SERVICO_DESLIGADO' | 'TEMPO_ESGOTADO' | 'PRECISAO_BAIXA' | 'COORDENADAS_INVALIDAS' | 'INDISPONIVEL';

export type CheckinGps = {
  latitude: number;
  longitude: number;
  precisaoMetros: number;
  /** Horário da leitura (vira `iniciadaEm` da vistoria — G3a). */
  capturadoEm: string;
};

export type ResultadoCheckin = { ok: true; checkin: CheckinGps } | { ok: false; falha: FalhaGps; mensagem: string };

export function mensagemFalhaGps(falha: FalhaGps, ctx: { precisaoMetros?: number; limiteMetros?: number } = {}) {
  switch (falha) {
    case 'PERMISSAO_NEGADA':
      return 'Permissão de localização negada. Toque no cadeado ao lado do endereço, depois em Permissões e em Localização (Android). Depois tente de novo.';
    case 'SERVICO_DESLIGADO':
      return 'GPS desligado ou sem sinal. Ative a localização do aparelho e tente de novo.';
    case 'TEMPO_ESGOTADO':
      return 'O GPS demorou para responder. Vá para um local aberto e tente de novo.';
    case 'PRECISAO_BAIXA':
      return `Precisão do GPS baixa (${ctx.precisaoMetros ?? '?'} m; o limite é ${ctx.limiteMetros ?? PRECISAO_CHECKIN_PADRAO_METROS} m). Aguarde o sinal melhorar e tente de novo.`;
    case 'COORDENADAS_INVALIDAS':
      return 'O GPS devolveu coordenadas inválidas. Tente de novo; se continuar, reinicie a localização do aparelho.';
    default:
      return 'Este aparelho não oferece localização. Use um aparelho com GPS para fazer o check-in.';
  }
}

/** G4: sem internet não impede o check-in; é outra mensagem, nunca a de GPS desligado. */
export const MENSAGEM_SEM_CONEXAO =
  'Sem conexão com a internet. O check-in usa só o GPS e funciona assim mesmo; a vistoria vai para a fila e sincroniza depois.';

/** Códigos do GeolocationPositionError: 1 permissão, 2 posição indisponível (serviço desligado/sem sinal), 3 timeout. */
export function classificarErroGeo(code: number | undefined): FalhaGps {
  if (code === 1) return 'PERMISSAO_NEGADA';
  if (code === 2) return 'SERVICO_DESLIGADO';
  if (code === 3) return 'TEMPO_ESGOTADO';
  return 'INDISPONIVEL';
}

export function validarLeituraGps(
  leitura: { latitude: number; longitude: number; accuracy: number },
  limiteMetros = PRECISAO_CHECKIN_PADRAO_METROS,
): FalhaGps | null {
  const { latitude, longitude, accuracy } = leitura;
  const numeros = [latitude, longitude, accuracy].every((n) => typeof n === 'number' && Number.isFinite(n));
  if (!numeros || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0) || accuracy <= 0) {
    return 'COORDENADAS_INVALIDAS';
  }
  if (accuracy > limiteMetros) return 'PRECISAO_BAIXA';
  return null;
}

type Geo = Pick<Geolocation, 'getCurrentPosition'>;

export function fazerCheckinGps(opts: { limiteMetros?: number; geolocation?: Geo | null; agora?: () => Date } = {}): Promise<ResultadoCheckin> {
  const limite = opts.limiteMetros ?? PRECISAO_CHECKIN_PADRAO_METROS;
  const geo = opts.geolocation === undefined ? (typeof navigator !== 'undefined' ? navigator.geolocation : null) : opts.geolocation;
  const agora = opts.agora ?? (() => new Date());
  if (!geo) return Promise.resolve({ ok: false, falha: 'INDISPONIVEL', mensagem: mensagemFalhaGps('INDISPONIVEL') });
  return new Promise((resolve) => {
    geo.getCurrentPosition(
      (pos) => {
        const leitura = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
        const falha = validarLeituraGps(leitura, limite);
        const precisaoMetros = Math.round(leitura.accuracy);
        if (falha) {
          resolve({ ok: false, falha, mensagem: mensagemFalhaGps(falha, { precisaoMetros, limiteMetros: limite }) });
          return;
        }
        resolve({ ok: true, checkin: { latitude: leitura.latitude, longitude: leitura.longitude, precisaoMetros, capturadoEm: agora().toISOString() } });
      },
      (err) => {
        const falha = classificarErroGeo(err?.code);
        resolve({ ok: false, falha, mensagem: mensagemFalhaGps(falha) });
      },
      // Leitura nova (maximumAge 0): o check-in é a prova de presença.
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

/** Distância em metros (haversine) — antecipa no app a checagem de raio que o backend faz. */
export function distanciaMetros(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function mensagemForaDoRaio(distancia: number, raio: number) {
  return `Você está a ${distancia} m do próprio; o check-in exige estar a até ${raio} m. Aproxime-se e tente de novo.`;
}
