/** 315: chamado de outra Secretaria (ou inexistente) aberto pelo id. */
export const SEM_ACESSO_CHAMADO = 'Você não tem acesso a este chamado';

export function ehSemAcessoChamado(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  return status === 403 || status === 404;
}

/** 310-excluir: excluir exige a permissão E a Secretaria de execução (`podeGerirAbertura` ≠ false). */
export function podeExcluirChamado(temPermissao: boolean, resumo: { podeGerirAbertura?: boolean } | null | undefined) {
  return temPermissao && resumo?.podeGerirAbertura !== false;
}
