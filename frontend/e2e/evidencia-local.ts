import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Prints de 321/322 ficam fora do git. Não sobrescreve evidencias/ versionado. */
export function pastaEvidencias(nome: '321' | '322') {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results/evidencias', nome);
}
