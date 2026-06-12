/**
 * Smoke test HTTP contra produção (ou URL customizada).
 * Uso: npm run prod:smoke
 *      PROD_BASE_URL=https://gestop.up.railway.app npm run prod:smoke
 */

const BASE = (process.env.PROD_BASE_URL ?? 'https://gestop.up.railway.app').replace(/\/$/, '');

type Check = { ok: boolean; label: string; detail?: string; severity?: 'critical' | 'warn' };

type HealthPayload = {
  status?: string;
  backend?: {
    health?: {
      status?: string;
      observability?: {
        sentryConfigured?: boolean;
        emailConfigured?: boolean;
        webPushConfigured?: boolean;
        webmapCronConfigured?: boolean;
      };
    };
    db?: {
      status?: string;
      connected?: boolean;
      counts?: {
        usuarios?: number;
        secretarias?: number;
        unidades?: number;
        chamados?: number;
      };
      migrations?: Array<{ name: string; applied: boolean }>;
    };
  };
};

async function fetchStatus(path: string) {
  const url = `${BASE}${path}`;
  const response = await fetch(url, { redirect: 'follow' });
  return { url, status: response.status, ok: response.ok };
}

async function fetchJson<T>(path: string): Promise<{ status: number; body: T | null }> {
  const url = `${BASE}${path}`;
  const response = await fetch(url);
  let body: T | null = null;
  try {
    body = (await response.json()) as T;
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

function logCheck(check: Check) {
  const prefix = check.ok ? 'OK' : check.severity === 'warn' ? 'AVISO' : 'FALHA';
  console.log(`[${prefix}] ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
}

async function main() {
  console.log(`SIGMA prod smoke — ${BASE}\n`);

  const checks: Check[] = [];

  for (const path of ['/login', '/recuperar-senha', '/api/health/backend']) {
    const result = await fetchStatus(path);
    checks.push({
      ok: result.status >= 200 && result.status < 400,
      label: `${path} → HTTP ${result.status}`,
      severity: 'critical',
    });
  }

  const publicUnidade = await fetchJson<Record<string, unknown>>('/api-gestop/public/unidades/PMF-ESC-001');
  checks.push({
    ok: publicUnidade.status === 200 && Boolean(publicUnidade.body?.codigoPatrimonial),
    label: 'Chamado QR — unidade piloto PMF-ESC-001',
    detail:
      publicUnidade.status === 200
        ? String(publicUnidade.body?.nome ?? 'OK')
        : `HTTP ${publicUnidade.status}`,
    severity: 'critical',
  });

  const health = await fetchJson<HealthPayload>('/api/health/backend');
  const db = health.body?.backend?.db;
  const obs = health.body?.backend?.health?.observability;

  checks.push({
    ok: health.status === 200 && health.body?.status === 'ok',
    label: 'Health agregado frontend + backend',
    severity: 'critical',
  });

  checks.push({
    ok: db?.connected === true && db?.status === 'ok',
    label: 'PostgreSQL conectado',
    severity: 'critical',
  });

  const secretarias = db?.counts?.secretarias ?? 0;
  checks.push({
    ok: secretarias >= 9,
    label: `Secretarias (${secretarias})`,
    detail: secretarias >= 9 ? undefined : 'Importe secretarias.template.csv',
    severity: secretarias >= 3 ? 'warn' : 'critical',
  });

  const unidades = db?.counts?.unidades ?? 0;
  checks.push({
    ok: unidades >= 300,
    label: `Unidades (${unidades})`,
    detail: unidades >= 300 ? undefined : 'Rode sync webmap no Admin (meta ≥ 300)',
    severity: unidades >= 10 ? 'warn' : 'critical',
  });

  const usuarios = db?.counts?.usuarios ?? 0;
  checks.push({
    ok: usuarios >= 1,
    label: `Usuarios ativos (${usuarios})`,
    severity: 'critical',
  });

  const fotoMigration = db?.migrations?.find((m) => m.name.includes('chamado_foto'));
  checks.push({
    ok: fotoMigration?.applied === true,
    label: 'Migration chamado_foto aplicada',
    severity: 'critical',
  });

  if (obs) {
    checks.push({
      ok: obs.emailConfigured === true,
      label: 'E-mail transacional (SMTP/webhook)',
      detail: obs.emailConfigured ? undefined : 'Configure EMAIL_DRIVER + SMTP_* em prod',
      severity: 'warn',
    });
    checks.push({
      ok: obs.sentryConfigured === true,
      label: 'Sentry DSN',
      detail: obs.sentryConfigured ? undefined : 'Recomendado para piloto',
      severity: 'warn',
    });
    checks.push({
      ok: obs.webmapCronConfigured === true,
      label: 'WEBMAP_CRON_SECRET',
      detail: obs.webmapCronConfigured ? undefined : 'Sync manual apenas',
      severity: 'warn',
    });
  }

  for (const check of checks) logCheck(check);

  const critical = checks.filter((c) => !c.ok && c.severity === 'critical');
  const warnings = checks.filter((c) => !c.ok && c.severity === 'warn');

  console.log('');
  if (critical.length > 0) {
    console.log(`${critical.length} falha(s) CRITICA(s). Ver docs/go-live-franca.md`);
    process.exitCode = 1;
  } else if (warnings.length > 0) {
    console.log(`${warnings.length} aviso(s) — revisar antes do piloto.`);
  } else {
    console.log('Smoke concluido: pronto para piloto.');
  }
}

main().catch((error) => {
  console.error('Falha no smoke:', error);
  process.exit(1);
});
