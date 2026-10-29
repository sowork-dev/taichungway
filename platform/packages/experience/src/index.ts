import { POLICY_MISSIONS, type PolicyMission } from './policy.ts';
export { POLICY_MISSIONS, MARKET_MISSION, policyMissionById, type PolicyMission } from './policy.ts';

/** Offline entertainment content; no accounts, requests, or personal data. */
export const FORTUNES: readonly string[] = Object.freeze([
  '願你今天的步伐，剛好跟上心裡的風。',
  '願巷口的暖光，陪你慢慢走回家。',
  '願早餐的熱氣，也暖到今天的心情。',
  '願忙碌之間，留得下一口好茶。',
  '願你遇見的人，多一點溫柔。',
  '願手上的小事，慢慢長成喜歡的樣子。',
  '願傍晚的風，替你吹散一點疲倦。',
  '願今天有空，看看路旁的小花。',
  '願心裡的念頭，有一塊安靜的地方。',
  '願回家的路，藏著熟悉的香氣。',
  '願每次出發，都帶著一點好奇。',
  '願你在轉角，遇見值得停留的風景。',
  '願桌上的熱湯，陪你把日子過暖。',
  '願山裡的茶香，捎來片刻清爽。',
  '願海風經過時，心也跟著寬一點。',
  '願新的一天，有你喜歡的節奏。',
  '願沒說完的話，找到溫柔的開頭。',
  '願你的認真，被身邊的人看見。',
  '願休息的時候，不必急著趕路。',
  '願平常的午後，也有小小的驚喜。',
  '願想念的人，今天吃得暖暖的。',
  '願你為自己，留下一張舒服的椅子。',
  '願手心的溫度，陪你走過微涼的天。',
  '願一段散步，換來一點輕鬆。',
  '願清晨的市場，送你一聲親切招呼。',
  '願你的靈感，在不經意時探出頭。',
  '願路邊的樹影，給你片刻歇腳。',
  '願等候的時光，也能自在呼吸。',
  '願今天的餐桌，多一道喜歡的滋味。',
  '願想做的小事，有慢慢開始的勇氣。',
  '願你走過舊街，也看見新的趣味。',
  '願口袋裡，裝得下一點閒情。',
  '願午後的陽光，落在你喜歡的角落。',
  '願生活的留白，容得下自在的笑。',
  '願你和自己，相處得再舒服一些。',
  '願遠方的消息，帶來一點暖意。',
  '願認真工作的手，也能好好歇一會。',
  '願田埂上的微風，陪你放慢腳步。',
  '願城市的聲音，有一段讓你安心。',
  '願今晚的月色，陪你收好今天。',
]);

export interface FortuneStyle {
  readonly id: string;
  readonly name: string;
  readonly bg: string;
  readonly ink: string;
  readonly accent: string;
  readonly pattern: string;
}

export const FORTUNE_STYLES: readonly FortuneStyle[] = Object.freeze([
  { id: 'morning', name: '晨光淺藍', bg: '#F3F8FF', ink: '#112A4D', accent: '#1A63C8', pattern: 'dots' },
  { id: 'tea', name: '山城青藍', bg: '#EAF3FF', ink: '#112A4D', accent: '#1A63C8', pattern: 'leaves' },
  { id: 'sea', name: '海風晴藍', bg: '#E3EFFF', ink: '#112A4D', accent: '#1A63C8', pattern: 'waves' },
  { id: 'brick', name: '老街靛藍', bg: '#D8E9FF', ink: '#112A4D', accent: '#1A63C8', pattern: 'bricks' },
  { id: 'sun', name: '午後天藍', bg: '#CCE1FF', ink: '#112A4D', accent: '#1A63C8', pattern: 'rays' },
  { id: 'night', name: '夜色藏藍', bg: '#112A4D', ink: '#FFFFFF', accent: '#7FC0F0', pattern: 'stars' },
  { id: 'rice', name: '稻田淡藍', bg: '#EDF5FF', ink: '#112A4D', accent: '#1A63C8', pattern: 'grain' },
  { id: 'flower', name: '花開霧藍', bg: '#E0EDFF', ink: '#112A4D', accent: '#1A63C8', pattern: 'petals' },
  { id: 'cloud', name: '晴空雲藍', bg: '#F6FAFF', ink: '#112A4D', accent: '#1A63C8', pattern: 'clouds' },
  { id: 'orange', name: '晨光亮藍', bg: '#D2E5FF', ink: '#112A4D', accent: '#1A63C8', pattern: 'circles' },
  { id: 'ink', name: '職人墨藍', bg: '#BED8FA', ink: '#112A4D', accent: '#1A63C8', pattern: 'grid' },
  { id: 'purple', name: '暮色深藍', bg: '#154A94', ink: '#FFFFFF', accent: '#7FC0F0', pattern: 'lines' },
].map((style) => Object.freeze(style)));

/** Each RNG sample must follow Math.random's finite [0, 1) contract. */
export function pickFortune(random: () => number = Math.random): { text: string; style: FortuneStyle } {
  const index = (length: number): number => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('Random samples must be finite numbers in [0, 1).');
    }
    return Math.floor(value * length);
  };
  return { text: FORTUNES[index(FORTUNES.length)]!, style: FORTUNE_STYLES[index(FORTUNE_STYLES.length)]! };
}

/** Random public proposal + visual palette only; no visitor profiling or remote requests. */
export function pickPolicyFortune(random: () => number = Math.random): { text: string; style: FortuneStyle; mission: PolicyMission } {
  const choose = (length: number): number => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('Random samples must be in [0, 1).');
    return Math.floor(value * length);
  };
  const mission = POLICY_MISSIONS[choose(POLICY_MISSIONS.length)]!;
  const style = FORTUNE_STYLES[choose(FORTUNE_STYLES.length)]!;
  return { text: mission.wish, style, mission };
}

export type FlavorId = 'market' | 'tea' | 'sea' | 'home' | 'oldtown' | 'port' | 'field' | 'craft';

export interface Flavor {
  readonly id: FlavorId;
  readonly name: string;
  readonly description: string;
  readonly accent: string;
  readonly icon: string;
}

/** Display order is also the final deterministic tie-break order. */
export const FLAVORS: readonly Flavor[] = Object.freeze(([
  { id: 'market', name: '老市場味', description: '熱湯與招呼聲，是日常的開場。喜歡在熟悉的攤位慢慢逛。', accent: '#1A63C8', icon: '🥣' },
  { id: 'tea', name: '山城茶香味', description: '把步調放慢，讓茶香留一會。喜歡山路轉彎後的綠意。', accent: '#1A63C8', icon: '🍵' },
  { id: 'sea', name: '海線海風味', description: '聽浪看雲，替日子留點空白。喜歡沿著海岸自在走走。', accent: '#1A63C8', icon: '🌊' },
  { id: 'home', name: '屯區新家味', description: '一頓家常飯，也能吃得有滋味。喜歡街坊相伴的生活感。', accent: '#1A63C8', icon: '🏡' },
  { id: 'oldtown', name: '舊城文青味', description: '走進老巷，收集細節與故事。喜歡書頁和街角的小驚喜。', accent: '#1A63C8', icon: '📖' },
  { id: 'port', name: '港口遠航味', description: '望著船來船往，心也想去遠方。喜歡帶著好奇迎接新風景。', accent: '#1A63C8', icon: '⚓' },
  { id: 'field', name: '田裡實在味', description: '看見當季作物，就想到餐桌滋味。喜歡踏實而親近土地的日常。', accent: '#1A63C8', icon: '🌾' },
  { id: 'craft', name: '黑手職人味', description: '細看每道工序，欣賞手作的溫度。喜歡把小事耐心做好。', accent: '#1A63C8', icon: '🛠️' },
] satisfies Flavor[]).map((flavor) => Object.freeze(flavor)));

export interface QuestionOption {
  readonly label: string;
  readonly subtitle: string;
  readonly emoji: string;
  readonly scores: readonly [FlavorId, FlavorId];
}

export interface Question {
  readonly title: string;
  readonly options: readonly [QuestionOption, QuestionOption, QuestionOption, QuestionOption];
}

export const QUESTIONS: readonly [Question, Question, Question] = Object.freeze([
  {
    title: '早餐時間，你想用哪一味開場？',
    options: [
      { label: '熱湯配米食', subtitle: '在老店坐下，聽一聲早安', emoji: '🍲', scores: ['market', 'oldtown'] },
      { label: '飯糰配清茶', subtitle: '簡單吃，慢慢嚐當季的香', emoji: '🍙', scores: ['tea', 'field'] },
      { label: '一碗鮮魚湯', subtitle: '讓海的鮮味喚醒早晨', emoji: '🐟', scores: ['sea', 'port'] },
      { label: '蛋餅配豆漿', subtitle: '熟悉的早餐，補好今天的元氣', emoji: '🍳', scores: ['home', 'craft'] },
    ],
  },
  {
    title: '傍晚逛市場，你會先在哪一攤停下？',
    options: [
      { label: '家常熟食攤', subtitle: '挑兩道菜，也聊聊今天', emoji: '🍱', scores: ['market', 'home'] },
      { label: '茶點小攤', subtitle: '嚐口茶香，看看老招牌', emoji: '🍵', scores: ['tea', 'oldtown'] },
      { label: '當季鮮食攤', subtitle: '魚鮮與蔬果，都有季節的味道', emoji: '🥬', scores: ['sea', 'field'] },
      { label: '五金雜貨攤', subtitle: '看看工具，想像下次動手做什麼', emoji: '🛠️', scores: ['port', 'craft'] },
    ],
  },
  {
    title: '週末空出半天，你想去哪裡走走？',
    options: [
      { label: '市場旁的手作街', subtitle: '逛攤位，也看看師傅的手藝', emoji: '🏺', scores: ['market', 'craft'] },
      { label: '山邊茶園與田間', subtitle: '沿著綠意，找一處歇腳', emoji: '🌾', scores: ['tea', 'field'] },
      { label: '海邊港口步道', subtitle: '吹吹海風，看看遠方的船', emoji: '⚓', scores: ['sea', 'port'] },
      { label: '街坊巷弄與小書店', subtitle: '不趕行程，在熟悉的街區發現新意', emoji: '📖', scores: ['home', 'oldtown'] },
    ],
  },
].map((question) => Object.freeze({
  ...question,
  options: Object.freeze(question.options.map((option) => Object.freeze({
    ...option, scores: Object.freeze(option.scores),
  }))),
})) as unknown as [Question, Question, Question]);

/** Pure local scoring: each selected option contributes one point per listed ID. */
export function scoreFlavor(answers: readonly number[]): Flavor {
  if (!Array.isArray(answers) || answers.length !== 3) {
    throw new RangeError('Answers must contain exactly three integer choices in [0, 3].');
  }
  for (const answer of answers) {
    if (!Number.isInteger(answer) || answer < 0 || answer > 3) {
      throw new RangeError('Answers must contain exactly three integer choices in [0, 3].');
    }
  }
  const scores = new Map<FlavorId, number>(FLAVORS.map(({ id }) => [id, 0]));
  answers.forEach((answer, index) => {
    for (const id of QUESTIONS[index]!.options[answer]!.scores) {
      scores.set(id, scores.get(id)! + 1);
    }
  });
  const maximum = Math.max(...scores.values());
  const preferred = QUESTIONS[2].options[answers[2]!]!.scores.find((id) => scores.get(id) === maximum);
  return FLAVORS.find(({ id }) => preferred ? id === preferred : scores.get(id) === maximum)!;
}
export * from './cards.ts';
