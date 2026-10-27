import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '收到一張台中聲音明信片｜點擊後聆聽',
  description: '由寄件人挑選的合成聲景配方；不會自動播放。合成聲景示意・非在地實錄，非官方互動預覽。',
  openGraph: {
    title: '收到一張台中聲音明信片',
    description: '合成聲景示意・非在地實錄。開啟後按播放才會出聲；連結不含留言或暱稱。',
    locale: 'zh_TW',
    type: 'website',
    url: '/postcard/m/',
  },
};

export default function PostcardReceiverLayout({ children }: { children: ReactNode }) {
  return children;
}
