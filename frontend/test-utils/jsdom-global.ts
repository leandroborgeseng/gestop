/**
 * Ambiente DOM (jsdom do frontend) só para specs de interação. Importar ANTES de @testing-library/react.
 * O vitest da raiz roda em `node` e não enxerga o jsdom do frontend via `@vitest-environment`,
 * por isso o DOM é instalado aqui, por arquivo.
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
const g = globalThis as Record<string, unknown>;
const win = dom.window as unknown as Record<string, unknown>;
for (const key of Object.getOwnPropertyNames(win)) {
  if (key in g) continue;
  g[key] = win[key];
}
g.window = dom.window;
g.document = dom.window.document;
g.navigator = dom.window.navigator;
g.IS_REACT_ACT_ENVIRONMENT = true;
