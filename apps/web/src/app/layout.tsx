import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
});
export const metadata: Metadata = {
  title: 'Real Estate Rental Management',
  description: 'Project foundation',
  other: { google: 'notranslate' },
};
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" translate="no">
      <body className={manrope.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
