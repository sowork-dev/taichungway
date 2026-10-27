import type { ComicSceneId } from './story';

/** Tap-to-fill ideas (all within the 60-character limit, no personal data). The text stays editable and goes through the same privacy screen. */
export const QUICK_EVENTS: Record<ComicSceneId, readonly string[]> = {
  market: ['買菜時發現蔥比菜籃還高', '老闆多送了一把香菜', '傍晚的市場特別熱鬧'],
  corner: ['等紅燈時看見飄落的葉子', '騎車轉進巷口停了一下', '路口有人讓我先過'],
  park: ['公園長椅上有隻貓在睡覺', '飯後在公園慢慢散步', '孩子在草地上追泡泡'],
  station: ['等公車時翻了翻書', '車票夾在口袋裡找不到', '站牌下聽見熟悉的笑聲'],
  mountain: ['山路邊有片葉子落在手上', '在老屋屋簷下躲了一陣雨', '午後的山城很安靜'],
  coast: ['海風把帽子吹跑了', '傍晚在步道看著浪', '沙灘上撿到一枚貝殼'],
};

/** Three preset captions per beat (起承轉合), each within 20 characters; they never claim policy effects. */
export const CAPTION_PRESETS: readonly (readonly string[])[] = [
  ['今天出門，心情不錯。', '慢慢走，不趕時間。', '先停一下，看看四周。'],
  ['咦，有個小發現。', '這一刻，有點好笑。', '原來日常藏著小驚喜。'],
  ['想起一份值得讀的提案。', '翻開公開資料看看。', '先讀懂，再慢慢討論。'],
  ['留下這一格，繼續走。', '今天也是普通的好日子。', '下次再來看看。'],
];
