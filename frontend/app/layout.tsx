import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GestOP | CCO',
  description: 'Central de Controle Operacional do GestOP',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
