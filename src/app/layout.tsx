import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MilesTracker | Alertas de Passagens com Milhas',
  description: 'Seja notificado em tempo real quando passagens da Latam, Gol e Azul atingirem o seu limite de milhas. Economize nas suas viagens.',
  keywords: ['milhas', 'passagens', 'alerta de voos', 'smiles', 'latam pass', 'azul fidelidade'],
  openGraph: {
    title: 'MilesTracker | Voe mais barato com milhas',
    description: 'Alertas automáticos de milhas para Latam, Gol e Azul.',
    type: 'website',
    locale: 'pt_BR',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-gray-900 text-white antialiased min-h-screen flex flex-col`}>
        {children}
      </body>
    </html>
  );
}