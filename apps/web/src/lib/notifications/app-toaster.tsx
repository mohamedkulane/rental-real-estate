'use client';

import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';

export function AppToaster() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Toaster
      position="top-right"
      gutter={12}
      containerClassName="toast-viewport"
      toastOptions={{
        duration: 4200,
        className: 'toast-hot-host',
        style: {
          background: 'transparent',
          boxShadow: 'none',
          padding: 0,
          margin: 0,
          maxWidth: 'none',
        },
      }}
    />
  );
}
