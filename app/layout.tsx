import type { Metadata } from 'next';
import { Bodoni_Moda, Manrope } from 'next/font/google';
import '../design/tokens/tokens.css';
import './globals.css';

/**
 * design/tokens/tokens.css names Bodoni Moda and Manrope, but naming a
 * font-family in CSS doesn't load it -- nothing in this codebase ever
 * fetched the actual font files, so every browser silently fell back to
 * whatever generic serif/sans-serif it had (Times New Roman, Segoe UI).
 * next/font self-hosts these at build time (no runtime request to
 * fonts.googleapis.com, and no layout shift from a late-arriving
 * stylesheet) and exposes them as CSS variables that tokens.css's
 * --mc-font-display / --mc-font-body now read first.
 */
const bodoniModa = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-body',
  display: 'swap',
});

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
    <html lang="en" className={`${bodoniModa.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
