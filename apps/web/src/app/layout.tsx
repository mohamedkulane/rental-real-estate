import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';
const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
});
export const metadata: Metadata = {
  title: 'Real Estate Rental Management',
  description: 'Project foundation',
};
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={montserrat.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
