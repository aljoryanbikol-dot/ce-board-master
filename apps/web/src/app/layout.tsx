import type { Metadata, Viewport } from 'next';
import { AppProviders } from '@/providers/app-providers';
import { config } from '@/lib/config';
import './globals.css';

/**
 * Fonts: in production/CI we use next/font/google for Space Grotesk (display),
 * Inter (body), and JetBrains Mono (data). The CSS variables below provide a
 * robust system fallback stack so the app renders correctly even if the font
 * CDN is unreachable at build time (e.g. air-gapped CI). To enable the Google
 * fonts, see the commented block — it slots straight into the html className.
 */

// import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
// const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
// const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
// const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
// const fontVars = `${display.variable} ${body.variable} ${mono.variable}`;

const fontVars = 'font-fallbacks';

export const metadata: Metadata = {
  title: { default: config.appName, template: `%s · ${config.appName}` },
  description: 'Premium Philippine Civil Engineering board exam review platform.',
  manifest: '/manifest.webmanifest',
  applicationName: config.appName,
  appleWebApp: { capable: true, statusBarStyle: 'default', title: config.appName },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1b4b8f' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1726' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={fontVars}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
