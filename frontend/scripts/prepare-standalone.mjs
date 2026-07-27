import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const standaloneDir = '.next/standalone';
const serverJs = join(standaloneDir, 'server.js');

if (!existsSync(serverJs)) {
  console.error(
    'prepare-standalone: .next/standalone/server.js não encontrado. Confirme output: "standalone" em next.config.ts e rode next build.',
  );
  process.exit(1);
}

mkdirSync(join(standaloneDir, '.next'), { recursive: true });
cpSync('public', join(standaloneDir, 'public'), { recursive: true });
cpSync('.next/static', join(standaloneDir, '.next/static'), { recursive: true });
console.log('prepare-standalone: public + .next/static copiados para .next/standalone');
