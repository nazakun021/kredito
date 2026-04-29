import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import WalletProvider from '@/components/WalletProvider';
import './globals.css';

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
    <html lang="en">
      <body>
        <WalletProvider>
          <Providers>
            {children}
          </Providers>
        </WalletProvider>
      </body>
    </html>
  );
}
