import { POLICIES } from '@taichung/policy-data';

export type ComicSceneId = 'market' | 'corner' | 'park' | 'station' | 'mountain' | 'coast';
export type ComicStyleId = 'ink' | 'print' | 'notebook';
export const COMIC_STYLES = [
  { id: 'ink', label: '藍墨線稿', description: '俐落筆觸・留白日常' },
  { id: 'print', label: '孔版藍調', description: '藍色塊面・紙上層次' },
  { id: 'notebook', label: '散步手帳', description: '鬆軟線條・輕輕排線' },
] as const;
export interface ComicPanel {
  beat: '起' | '承' | '轉' | '合';
  action: 'arrive' | 'notice' | 'discover' | 'leave';
  caption: string;
  description: string;
}
export interface ComicStory {
  sceneId: ComicSceneId;
  styleId: ComicStyleId;
  nickname: string;
  event: string;
  policyId: string;
  panels: ComicPanel[];
}

// Original, deliberately modest fiction; never a prediction of a policy's effects.
const narratives: Record<ComicSceneId, readonly [string, string, string, string]> = {
  market: ['菜籃出門，今天慢慢逛。', '蔥比菜籃還高，也想吹涼風。', '市場冷氣？先翻翻公開提案。', '提案先讀懂，菜籃先提穩。'],
  corner: ['轉進巷口，先停一下。', '咦，落葉也在斑馬線前排隊。', '人本道路，原來有這份提案。', '看懂提案，再一起關心路口。'],
  park: ['公園散步，不趕時間。', '椅上的貓，比我還會休息。', '共融療癒公園？翻翻這份提案。', '貓先休息，我先讀懂提案。'],
  station: ['到站了，先看一眼站牌。', '車票躲在書裡，比我還愛閱讀。', '市民公車免費，是一項公開提案。', '提案先讀懂，適用條件待確認。'],
  mountain: ['沿著山城的小路散步。', '接住葉子，像收到山的小書籤。', '客家文化園區，也有升級提案。', '把提案夾好，下回繼續讀。'],
  coast: ['走到海邊，把腳步放慢。', '一陣海風，帽子先出發。', '親海步道的提案，也值得停步看。', '風景先欣賞，提案先了解。'],
};
const actions = ['arrive', 'notice', 'discover', 'leave'] as const;
const beats = ['起', '承', '轉', '合'] as const;
const descriptions: Record<ComicSceneId, readonly [string, string, string, string]> = {
  market: ['提菜籃的人走進有條紋棚頂的市場。', '買菜的人俯身看看攤位，攤主揮手招呼。', '菜籃裡冒出一大把長蔥，主角張開手驚訝。', '主角帶著高高的蔥揮手離開，攤主也微笑。'],
  corner: ['牽著單車的人來到路口，前方有斑馬線。', '路口號誌亮著，主角停步看著飄過的葉子。', '幾片葉子沿著斑馬線邊緣排成一列。', '號誌示意轉換，主角牽車走過斑馬線。'],
  park: ['帶著小包的人走進有樹木和長椅的公園。', '主角停在長椅前，傾耳尋找聲音的來處。', '一隻貓伸展身子，獨占了大半張長椅。', '主角坐在長椅另一側，與貓各自享受休息。'],
  station: ['拿著小書的人來到站牌和公車站棚下。', '主角低頭翻找外套口袋，一手拿著小書。', '翻開的書頁夾著一張車票，主角露出笑容。', '公車停靠，主角合起書本準備從車門上車。'],
  mountain: ['背包客沿著山坡的小路，經過磚牆老屋。', '主角站在屋簷旁，抬頭看一片飄下的葉子。', '主角用張開的手接住葉子，另一手攤開書本。', '主角在山邊長椅坐下，把葉子夾進書頁。'],
  coast: ['戴帽子的人走上海邊的木棧道，遠處有浪。', '海風吹起帽子，主角抬手追著帽子跑兩步。', '主角踮起腳伸手，終於接住飛起的帽子。', '主角扶著帽子坐在海邊長椅上，看浪往返。'],
};

export function createComic(input: { sceneId: ComicSceneId; styleId: ComicStyleId; nickname: string; event: string }): ComicStory {
  const scene = COMIC_SCENES.find(row => row.id === input.sceneId) ?? COMIC_SCENES[0];
  const styleId = COMIC_STYLES.find(row => row.id === input.styleId)?.id ?? 'ink';
  return {
    sceneId: scene.id, styleId, policyId: scene.policyId,
    nickname: Array.from(input.nickname.trim()).slice(0, 10).join(''),
    event: Array.from(input.event.trim()).slice(0, 60).join(''),
    panels: narratives[scene.id].map((caption, index) => ({
      beat: beats[index], action: actions[index], caption, description: descriptions[scene.id][index],
    })),
  };
}


export function editComicCaption(story: ComicStory, index: number, value: string): ComicStory {
  if (!Number.isInteger(index) || index < 0 || index > 3) return story;
  return { ...story, panels: story.panels.map((panel, position) => position === index
    ? { ...panel, caption: Array.from(value.trim()).slice(0, 20).join('') }
    : panel) };
}

/** Fixed, public scene mapping, never inferred from a person's text or identity. */
export const COMIC_SCENES = [
  { id: 'market', label: '市場', policyId: 'IND-19', hint: '菜籃裡的小插曲' },
  { id: 'corner', label: '巷口', policyId: 'TRA-06', hint: '轉角遇見的日常' },
  { id: 'park', label: '公園', policyId: 'RES-12', hint: '散步時的小發現' },
  { id: 'station', label: '車站', policyId: 'TRA-07', hint: '等車的那幾分鐘' },
  { id: 'mountain', label: '山線', policyId: 'EDU-27', hint: '山城裡慢慢走' },
  { id: 'coast', label: '海線', policyId: 'RES-14', hint: '讓海風翻一頁' },
].map(scene => {
  const policy = POLICIES.find(row => row.id === scene.policyId);
  if (!policy) throw new Error(`Missing canonical comic policy: ${scene.policyId}`);
  return Object.freeze({ ...scene, id: scene.id as ComicSceneId, policy });
});
