import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './check.css';

export const metadata: Metadata = {
  title: '對開支票本｜把願望寫給我們的四年・台中味',
  description: '寫下你的生活願望，與官網公開政見對開閱讀。完全本機關鍵字對照，不使用 AI、不傳送或儲存私人文字；候選人政見非已兌現。',
  alternates: { canonical: 'https://taichungway.sowork.ai/check/' },
  openGraph: {
    title: '對開支票本｜我們的四年',
    description: '一張是自己的生活願望，一張是公開政見。非官方互動作品，非有價證券。',
    url: 'https://taichungway.sowork.ai/check/',
    locale: 'zh_TW',
    type: 'website',
    images: [{ url: '/og/check.png', width: 1200, height: 630, alt: 'check｜台中味互動' }],
  },
};

export default function CheckLayout({ children }: { children: ReactNode }) { return children; }
