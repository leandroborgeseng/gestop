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
