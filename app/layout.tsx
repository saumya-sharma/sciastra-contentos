import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SciAstra ContentOS',
  description: 'Command Centre for SciAstra Marketing',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before React hydrates — prevents dark/light flash */}
        <script dangerouslySetInnerHTML={{__html: `
          (function() {
            try {
              var theme = localStorage.getItem('sa_theme') || 'dark';
              document.documentElement.classList.toggle('dark', theme === 'dark');
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className={`${inter.className} bg-[var(--color-background)] text-slate-100 min-h-screen sidebar-layout`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
