import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@taichung/ui/styles.css';
import '@taichung/ui/studio.css';
import '@taichung/ui/gamekit.css';
import '@taichung/ui/studio-game.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PREVIEW_ORIGIN ?? 'https://taichungway.sowork.ai'),
  title: '台中味｜日常遊樂場',
  description: '從市場的早安到海線的晚風，用一點時間，玩一口台中的日常。',
  openGraph: {
    title: '台中味｜日常遊樂場',
    description: '從市場的早安到海線的晚風，用一點時間，玩一口台中的日常。',
    locale: 'zh_TW',
    type: 'website',
    images: [{ url: '/og/hub.png', width: 1200, height: 630, alt: '台中味｜日常遊樂場' }],
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-Hant-TW"><body>{children}</body></html>;
}
