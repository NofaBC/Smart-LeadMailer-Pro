/**
 * Root Layout
 * Global HTML structure and metadata
 * No auth/providers in v1 – simple and clean
 */

import './globals.css';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Smart LeadMailer Pro™',
  description: 'Automated local business outreach campaigns',
  keywords: 'lead generation, email outreach, local business, automation',
  robots: 'index, follow',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <main>{children}</main>
      </body>
    </html>
  );
}
