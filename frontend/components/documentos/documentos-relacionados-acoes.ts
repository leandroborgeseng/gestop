import { canColetarAssinatura } from '@/lib/permissions-matrix';
import type { DocumentoResumo } from '@/lib/types';

/** Mesma regra do backend: `documentos.coletar_assinatura` / matriz / administrar. */
export function resolvePodeColetar(permissoes: string[]) {
  return canColetarAssinatura(permissoes);
}

export function signatariosPendentesDoCard(
  item: Pick<DocumentoResumo, 'signatariosPendentes'>,
) {
  return item.signatariosPendentes ?? [];
}

export function rotuloSignatarioPendente(sig: { nome: string; email?: string | null }) {
  return sig.email ? `${sig.nome} (${sig.email})` : sig.nome;
}

export function assinaturasVigentesDoCard(item: Pick<DocumentoResumo, 'assinaturas'>) {
  return (item.assinaturas ?? []).filter((itemAssinatura) => !itemAssinatura.invalida);
}

export function rotuloAssinaturaVigente(sig: {
  assinanteNome: string;
  qualificacao?: string | null;
  qualificacaoOutro?: string | null;
}) {
  const papel = sig.qualificacaoOutro?.trim() || sig.qualificacao?.trim();
  return papel ? `${sig.assinanteNome} (${papel})` : sig.assinanteNome;
}
