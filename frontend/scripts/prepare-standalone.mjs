/**
 * Garante que o Next standalone fique sempre em:
 *   .next/standalone/server.js
 *
 * Em monorepos o Next às vezes gera:
 *   .next/standalone/<pasta>/server.js
 * Este script achata a árvore e copia public + .next/static para o local certo.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const standaloneRoot = resolve('.next/standalone');

function findServerJs(dir, depth = 0) {
  const candidate = join(dir, 'server.js');
  if (existsSync(candidate)) return candidate;
  if (depth > 3 || !existsSync(dir)) return null;

  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    try {
      if (!statSync(full).isDirectory()) continue;
    } catch {
      continue;
    }
    const found = findServerJs(full, depth + 1);
    if (found) return found;
  }
  return null;
}

function flattenToStandaloneRoot(serverJsPath) {
  const appDir = resolve(dirname(serverJsPath));
  if (appDir === standaloneRoot) return;

  const rel = relative(standaloneRoot, appDir);
  if (!rel || rel.startsWith('..')) {
    console.error(
      `prepare-standalone: server.js fora de ${standaloneRoot}: ${serverJsPath}`,
    );
    process.exit(1);
  }

  console.log(
    `prepare-standalone: achatando ${rel}/ → .next/standalone/ (Next aninhou o standalone)`,
  );

  for (const entry of readdirSync(appDir)) {
    const from = join(appDir, entry);
    const to = join(standaloneRoot, entry);
    if (existsSync(to)) {
      rmSync(to, { recursive: true, force: true });
    }
    cpSync(from, to, { recursive: true });
  }

  const topNested = rel.split(/[/\\]/)[0];
  if (topNested) {
    rmSync(join(standaloneRoot, topNested), { recursive: true, force: true });
  }
}

if (!existsSync(standaloneRoot)) {
  console.error(
    'prepare-standalone: .next/standalone não encontrado. Confirme output: "standalone" em next.config.ts e rode next build.',
  );
  process.exit(1);
}

const found = findServerJs(standaloneRoot);
if (!found) {
  console.error(
    'prepare-standalone: server.js não encontrado sob .next/standalone/. Confirme output: "standalone" e rode next build.',
  );
  process.exit(1);
}

flattenToStandaloneRoot(found);

const serverJs = join(standaloneRoot, 'server.js');
if (!existsSync(serverJs)) {
  console.error(
    'prepare-standalone: após flatten, .next/standalone/server.js ainda ausente.',
  );
  process.exit(1);
}

mkdirSync(join(standaloneRoot, '.next'), { recursive: true });
cpSync('public', join(standaloneRoot, 'public'), { recursive: true });
cpSync('.next/static', join(standaloneRoot, '.next/static'), { recursive: true });

// Coolify/Docker: COPY standalone → /app; npm start precisa do script no bundle
const startScript = resolve('scripts/start-standalone.mjs');
if (!existsSync(startScript)) {
  console.error('prepare-standalone: scripts/start-standalone.mjs ausente.');
  process.exit(1);
}
mkdirSync(join(standaloneRoot, 'scripts'), { recursive: true });
cpSync(startScript, join(standaloneRoot, 'scripts', 'start-standalone.mjs'));
cpSync(startScript, join(standaloneRoot, 'start-standalone.mjs'));

const pkgPath = join(standaloneRoot, 'package.json');
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.scripts = { ...(pkg.scripts || {}), start: 'node ./scripts/start-standalone.mjs' };
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

console.log(
  'prepare-standalone: public + .next/static + start-standalone em .next/standalone (server.js OK)',
);
