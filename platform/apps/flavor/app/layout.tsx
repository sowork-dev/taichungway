import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@taichung/ui/styles.css';
import '@taichung/ui/gamekit.css';
import '@taichung/ui/play-game.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PREVIEW_ORIGIN ?? 'https://taichungway.sowork.ai'),
  title: '你是哪一味｜台中味',
  description: '三個日常選擇，遇見你的台中味。八種原創角色，沒有標準答案。',
  openGraph: {
    title: '你是哪一味｜台中味',
    description: '三個日常選擇，遇見你的台中味。八種原創角色，沒有標準答案。',
    locale: 'zh_TW',
    type: 'website',
    images: [{ url: '/og/flavor.png', width: 1200, height: 630, alt: '你是哪一味｜台中味' }],
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-Hant-TW"><body>{children}</body></html>;
}
