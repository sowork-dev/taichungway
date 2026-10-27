import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@taichung/ui/styles.css';
import '@taichung/ui/gamekit.css';
import '@taichung/ui/play-game.css';
import '@taichung/ui/cards.css';
import './fortune-cards.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PREVIEW_ORIGIN ?? 'https://taichungway.sowork.ai'),
  title: '沾福氣｜台中味',
  description: '長按，沾一點福氣。把一張原創祝福卡，留給今天的自己。',
  openGraph: {
    title: '沾福氣｜台中味',
    description: '長按，沾一點福氣。把一張原創祝福卡，留給今天的自己。',
    locale: 'zh_TW',
    type: 'website',
    images: [{ url: '/og/fortune.png', width: 1200, height: 630, alt: '沾福氣｜台中味' }],
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-Hant-TW"><body>{children}</body></html>;
}
