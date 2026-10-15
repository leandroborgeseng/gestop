/**
 * 286: DOM (jsdom do frontend) para specs de interação da aba Tarefas. Importar ANTES de @testing-library/react.
 * O vitest da raiz roda em `node`; o DOM é instalado por arquivo.
 */
import { createRequire } from 'node:module';

// Sem @types/jsdom: carrega via require com o tipo mínimo usado aqui (evita dependência de tipos só para teste).
type JanelaJsdom = Window & typeof globalThis;
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string, opts: { url: string; pretendToBeVisual: boolean }) => { window: JanelaJsdom };
};

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
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
