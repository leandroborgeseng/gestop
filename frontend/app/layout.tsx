import './globals.css';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import { SnackbarProvider } from '@/components/ui/snackbar';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SIGMA | CCO',
  description: 'SIGMA — Sistema Integrado de Gestão de Manutenção de Ativos · Prefeitura de Franca',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SIGMA',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0066cc',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} antialiased`}>
        <SnackbarProvider>{children}</SnackbarProvider>
      </body>
    </html>
  );
}
