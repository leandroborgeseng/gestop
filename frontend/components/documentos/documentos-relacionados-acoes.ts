import { canColetarAssinatura } from '@/lib/permissions-matrix';
import type { DocumentoResumo } from '@/lib/types';

/** Mesma regra do PermissionsGuard de POST /documentos/:id/assinatura. */
export function resolvePodeColetar(
  permissoes: string[],
  user?: { perfilAtivo?: { nome?: string } | null; perfis?: string[] } | null,
) {
  return canColetarAssinatura(permissoes, user);
}

/**
 * Pedidos de assinatura interna ainda PENDENTE.
 * O backend só serializa `DocumentoAssinaturaPedido` (destinatário = Usuario do SIGMA);
 * assinatura externa desenhada vai em `assinaturas`, não neste bloco.
 */
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
