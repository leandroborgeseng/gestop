import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SIGMA Vistoria',
    short_name: 'Vistoria',
    description: 'SIGMA — Sistema Integrado de Gestão de Manutenção de Ativos · Prefeitura de Franca',
    start_url: '/mobile',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#0066cc',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
