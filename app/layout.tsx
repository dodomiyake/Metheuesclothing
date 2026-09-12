import type { Metadata } from 'next';
import '../design/tokens/tokens.css';

export const metadata: Metadata = {
  title: 'Metheues Clothings',
  description: 'T-shirt-first storefront.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
