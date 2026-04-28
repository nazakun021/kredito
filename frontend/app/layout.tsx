'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 text-gray-900">
        <QueryClientProvider client={queryClient}>
          <main className="mx-auto max-w-[390px] min-h-screen bg-white shadow-xl">
            {children}
          </main>
        </QueryClientProvider>
      </body>
    </html>
  );
}
