import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function scriptEhPrincipal(argv1, href) {
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(href));
  } catch {
    return false;
  }
}

export async function executarHealthcheck() {
  const porta = process.env.PORT || '3000';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const resposta = await fetch(`http://127.0.0.1:${porta}/`, {
      redirect: 'manual',
      signal: controller.signal,
    });
    process.exit(resposta.status < 500 ? 0 : 1);
  } catch {
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}

const isMain = scriptEhPrincipal(process.argv[1], import.meta.url);
if (isMain) await executarHealthcheck();
