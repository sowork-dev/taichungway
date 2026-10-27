import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './comic.css';
import './comic-game.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://taichungway.sowork.ai'),
  title: '巷口四格漫畫｜台中味・非官方互動',
  description: '選一個日常場景，留下一句原文，創作自己的藍色四格。預製故事版，不使用 AI；SoWork 獨立製作，未取得競選團隊授權或背書。',
  alternates: { canonical: '/comic/' },
  openGraph: {
    title: '巷口四格漫畫｜台中味',
    description: '把一件身邊小事，留成一頁藍色日常。預製故事版・不使用 AI・非官方製作。',
    url: '/comic/',
    type: 'website',
    images: [{ url: '/og/comic.png', width: 1200, height: 630, alt: 'comic｜台中味互動' }],
    locale: 'zh_TW',
  },
};

export default function ComicLayout({ children }: { children: ReactNode }) { return children; }
