import { DATE_KEY_RE, inicioDoDiaNoFuso, proximoDateKey } from '../common/date.utils';

/**
 * UX-02: "Prazo de" / "Prazo até" em dia civil (YYYY-MM-DD) no fuso America/Sao_Paulo.
 * O dia final entra por inteiro (até 23:59:59.999 BRT). Um instante ISO já absoluto
 * (clientes antigos) continua sendo o instante informado.
 */
export function instantePrazoFiltro(valor: string | undefined, lado: 'de' | 'ate'): Date | undefined {
  const texto = valor?.trim();
  if (!texto) return undefined;
  if (DATE_KEY_RE.test(texto)) {
    if (lado === 'de') return inicioDoDiaNoFuso(texto);
    return new Date(inicioDoDiaNoFuso(proximoDateKey(texto)).getTime() - 1);
  }
  const instante = new Date(texto);
  return Number.isNaN(instante.getTime()) ? undefined : instante;
}

export function prazoNoIntervalo(instante: Date, de?: string, ate?: string): boolean {
  const gte = instantePrazoFiltro(de, 'de');
  const lte = instantePrazoFiltro(ate, 'ate');
  if (gte && instante.getTime() < gte.getTime()) return false;
  if (lte && instante.getTime() > lte.getTime()) return false;
  return true;
}
