import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Kredito — On-Chain Credit Passport',
  description:
    'Transparent on-chain credit scores and instant micro-loans for the unbanked, built on Stellar. Generate a score, unlock a loan, and build your Credit Passport.',
  keywords: ['credit', 'stellar', 'soroban', 'micro-lending', 'on-chain', 'credit passport', 'PHPC'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#020617',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
