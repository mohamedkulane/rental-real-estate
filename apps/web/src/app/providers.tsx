'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 300_000,
            gcTime: 900_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          className: 'product-toast',
          success: { iconTheme: { primary: '#059669', secondary: '#ffffff' } },
          error: { iconTheme: { primary: '#dc2626', secondary: '#ffffff' } },
        }}
      />
    </QueryClientProvider>
  );
}
