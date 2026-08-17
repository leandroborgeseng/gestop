export function formatSecretariaLabel(
  secretaria: { sigla?: string | null; nome?: string | null } | string | null | undefined,
  nome?: string | null,
) {
  if (typeof secretaria === 'string' || secretaria == null) {
    const sigla = (secretaria ?? '').trim();
    const nomeTexto = (nome ?? '').trim();
    if (sigla && nomeTexto) return `${sigla} · ${nomeTexto}`;
    return sigla || nomeTexto || '-';
  }
  const sigla = (secretaria.sigla ?? '').trim();
  const nomeTexto = (secretaria.nome ?? '').trim();
  if (sigla && nomeTexto) return `${sigla} · ${nomeTexto}`;
  return sigla || nomeTexto || '-';
}
