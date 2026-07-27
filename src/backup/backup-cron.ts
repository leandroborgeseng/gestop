/**
 * Agendador cron simples in-process (sem @nestjs/schedule).
 * Expressão suportada: `0 {hora} * * *` (minuto fixo 0, hora 0–23).
 */
export class DynamicHourlyCron {
  private timer: NodeJS.Timeout | null = null;
  private stopped = true;

  constructor(
    private readonly getHour: () => number,
    private readonly getTimezone: () => string,
    private readonly onTick: () => void | Promise<void>,
    private readonly logger?: { log: (msg: string) => void; error: (msg: string) => void },
  ) {}

  start() {
    this.stop();
    this.stopped = false;
    this.scheduleNext();
  }

  stop() {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  isActive() {
    return !this.stopped && this.timer != null;
  }

  private scheduleNext() {
    if (this.stopped) return;
    const hour = clampHour(this.getHour());
    const timezone = this.getTimezone() || 'America/Sao_Paulo';
    const delayMs = msUntilNextLocalHour(hour, timezone);
    const nextAt = new Date(Date.now() + delayMs).toISOString();
    this.logger?.log(`Proximo backup S3 agendado para ~${nextAt} (hora local ${hour}:00, ${timezone})`);

    this.timer = setTimeout(() => {
      void (async () => {
        try {
          await this.onTick();
        } catch (error) {
          this.logger?.error(
            `Tick de backup falhou: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
          );
        } finally {
          this.scheduleNext();
        }
      })();
    }, delayMs);

    // Evita manter o processo vivo só por causa do timer em alguns ambientes.
    this.timer.unref?.();
  }
}

function clampHour(hour: number) {
  if (!Number.isFinite(hour)) return 2;
  return Math.min(23, Math.max(0, Math.trunc(hour)));
}

/** Calcula ms até a próxima ocorrência de HH:00 no fuso informado. */
export function msUntilNextLocalHour(hour: number, timezone: string): number {
  const now = Date.now();
  // Varre as próximas 48h em passos de 1 min até achar HH:00 no fuso.
  for (let offsetMin = 0; offsetMin <= 48 * 60; offsetMin += 1) {
    const candidate = new Date(now + offsetMin * 60_000);
    const parts = getTzParts(candidate, timezone);
    if (parts.hour === hour && parts.minute === 0) {
      const delay = candidate.getTime() - now;
      return delay > 1000 ? delay : delay + 24 * 60 * 60_000;
    }
  }
  return 60 * 60_000;
}

function getTzParts(date: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(date);
  return {
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? '0'),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? '0'),
  };
}
