import { MENSAGEM_SEM_PERMISSAO, PERMISSOES_MATRIZ } from './permissoes-matriz';

/** Serialização estável (chaves ordenadas) da matriz para o JSON versionado. */
export function serializarMatriz() {
  const rotas = Object.fromEntries(Object.keys(PERMISSOES_MATRIZ).sort().map((chave) => [chave, PERMISSOES_MATRIZ[chave]]));
  return `${JSON.stringify({ versao: 1, mensagem403: MENSAGEM_SEM_PERMISSAO, rotas }, null, 2)}\n`;
}
