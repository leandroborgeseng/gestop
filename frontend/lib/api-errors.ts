/** Texto genérico usado só quando o backend não manda mensagem própria no 403. */
export const ACESSO_NEGADO_GENERICO = 'Acesso negado para o seu perfil.';

/**
 * Extrai a mensagem de erro do corpo da API (Nest: `{ message }`, às vezes array).
 * Retorna `fallback` quando não há texto aproveitável.
 */
export function extractApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const { message, error } = payload as { message?: unknown; error?: unknown };
  const pick = (value: unknown): string | null => {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const parts = value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
      if (parts.length > 0) return parts.join(' ');
    }
    return null;
  };
  return pick(message) ?? pick(error) ?? fallback;
}

/** Mensagem do 403: a do backend; o texto genérico só quando o backend não manda nenhuma. */
export async function readForbiddenMessage(response: Pick<Response, 'json'>): Promise<string> {
  try {
    return extractApiErrorMessage(await response.json(), ACESSO_NEGADO_GENERICO);
  } catch {
    return ACESSO_NEGADO_GENERICO;
  }
}
