import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Lume — Content Operations',
  description: 'The content ops platform for teams who ship. Pipeline, calendar, campaigns, AI briefs — one place.',
  openGraph: {
    title: 'Lume — Content Operations',
    description: 'From idea to published. No chaos.',
    url: 'https://getlume.com',
    siteName: 'Lume',
    images: [{ url: 'https://getlume.com/og.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lume',
    description: 'From idea to published. No chaos.',
  },
  icons: {
    icon: '/favicon.svg',
  },
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
