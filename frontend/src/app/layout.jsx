import './globals.css';
import { Manrope, JetBrains_Mono } from 'next/font/google';

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: 'Email Verifier',
  description: 'Verify emails before cold outreach',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
