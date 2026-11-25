/**
 * 296 — leitura em fluxo de `var json_X = {"type":"FeatureCollection",...,"features":[ {...}, {...} ]};`
 * Emite cada feature como texto JSON, sem montar o arquivo inteiro em memória.
 */
export class FeatureStreamSplitter {
  private state: 'procurando' | 'array' | 'fim' = 'procurando';
  private head = '';
  private buf: string[] = [];
  private depth = 0;
  private inStr = false;
  private esc = false;
  private atual = 0;

  constructor(private readonly onFeature: (json: string) => void, private readonly maxFeatureChars = 64 * 1024 * 1024) {}

  get terminou() {
    return this.state === 'fim';
  }

  push(chunk: string) {
    let i = 0;
    if (this.state === 'procurando') {
      this.head += chunk;
      const m = /"features"\s*:\s*\[/.exec(this.head);
      if (!m) {
        if (this.head.length > 1_000_000) throw new Error('Cabeçalho GeoJSON sem "features"');
        return;
      }
      chunk = this.head.slice(m.index + m[0].length);
      this.head = '';
      this.state = 'array';
    }
    if (this.state === 'fim') return;
    let start = -1;
    for (i = 0; i < chunk.length; i++) {
      const c = chunk.charCodeAt(i);
      if (this.inStr) {
        if (this.esc) this.esc = false;
        else if (c === 92) this.esc = true;
        else if (c === 34) this.inStr = false;
        continue;
      }
      if (c === 34) {
        this.inStr = true;
        continue;
      }
      if (c === 123 || c === 91) {
        if (this.depth === 0) start = i;
        this.depth++;
      } else if (c === 125 || c === 93) {
        if (this.depth === 0 && c === 93) {
          this.state = 'fim';
          return;
        }
        this.depth--;
        if (this.depth === 0) {
          const piece = (start >= 0 ? chunk.slice(start, i + 1) : chunk.slice(0, i + 1));
          this.buf.push(piece);
          const json = this.buf.join('');
          this.buf = [];
          this.atual = 0;
          start = -1;
          this.onFeature(json);
        } else if (this.depth < 0) {
          throw new Error('GeoJSON malformado');
        }
      }
    }
    if (this.depth > 0) {
      const rest = start >= 0 ? chunk.slice(start) : chunk;
      this.atual += rest.length;
      if (this.atual > this.maxFeatureChars) throw new Error('Elemento grande demais');
      this.buf.push(rest);
    }
  }

  end() {
    if (this.state !== 'fim') throw new Error(this.state === 'procurando' ? 'conteúdo sem GeoJSON' : 'GeoJSON truncado');
  }
}
