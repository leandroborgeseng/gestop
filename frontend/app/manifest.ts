import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GestOP Campo',
    short_name: 'GestOP',
    description: 'PWA de fiscalização em campo do GestOP',
    start_url: '/mobile',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#0066cc',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
