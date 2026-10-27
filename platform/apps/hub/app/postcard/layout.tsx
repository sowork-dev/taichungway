import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './postcard.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://taichungway.sowork.ai'),
  title: '台中聲音明信片｜合成聲景體驗',
  description: '選擇台中行政區，混合原創合成環境音。合成聲景示意・非在地實錄。獨立互動預覽，非官方，非施政成果。',
  openGraph: {
    title: '台中聲音明信片｜合成聲景示意・非在地實錄',
    description: '聲音不會自動播放。挑選地名、調整音量、分享只含聲景配方的聆聽連結。獨立互動預覽，非官方。',
    locale: 'zh_TW',
    type: 'website',
    images: [{ url: '/og/postcard.png', width: 1200, height: 630, alt: 'postcard｜台中味互動' }],
    url: '/postcard/',
  },
  robots: { index: false, follow: false },
};

export default function PostcardLayout({ children }: { children: ReactNode }) {
  return children;
}
