export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { describeBackendUrlConfig } = await import('./lib/backend-url');
  const config = describeBackendUrlConfig();

  console.log('[SIGMA:frontend] Proxy backend:', JSON.stringify(config));

  if (config.usingFallback && config.nodeEnv === 'production') {
    console.warn(
      '[SIGMA:frontend] BACKEND_INTERNAL_URL nao configurada — usando fallback',
      config.backendUrl,
    );
  }
}
