import type { Metadata, Viewport } from 'next';
import './globals.css';
import { I18nProvider } from '@/i18n/I18nProvider';
import Header from '@/components/Header';
import AlertToaster from '@/components/AlertToaster';
import A11yBoot from '@/components/A11yBoot';
import OfflineBanner from '@/components/OfflineBanner';

export const metadata: Metadata = {
  title: 'ResQGrid — Community Disaster Early Warning | TerraPulse',
  description: 'Predict the Risk. Alert the Community. Act Before Disaster. AI-powered neighbourhood-level disaster early warning across India.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1d4ed8' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&family=Space+Grotesk:wght@500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen font-sans">
        <I18nProvider>
          <A11yBoot />
          <OfflineBanner />
          <Header />
          {children}
          <AlertToaster />
        </I18nProvider>
      </body>
    </html>
  );
}
