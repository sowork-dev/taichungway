// Collectible local-object cards (prototype set 「文化旗艦」). Names and figures come only from user-provided policy documents.
// Stats are game values, not policy evaluations; stats marked 'set' are design settings, 'doc' ones are converted from public seat counts.
export type CardType = 'old' | 'venue' | 'sound' | 'hill';
export type Rarity = 'N' | 'R' | 'SR' | 'SSR';
export interface ObjectCard {
  readonly no: number; readonly name: string; readonly type: CardType; readonly rarity: Rarity;
  readonly policy: string; readonly policyShort: string; readonly policyTitle: string; readonly doc: string;
  readonly status: string; readonly skill: string;
  readonly stats: readonly [number, number, number]; readonly statBasis: readonly ('set' | 'doc')[]; readonly fact: string;
}
export const SET_NAME = '文化旗艦';
export const CARDS: readonly ObjectCard[] = Object.freeze([
  { no: 1, name: "臺中驛", type: 'old', rarity: 'R', policy: 'EDU-21', policyShort: '文化門戶', policyTitle: "臺中車站出發，啟動「臺中文化門戶計畫」", doc: '文化政策', status: "文件列為文化門戶計畫範圍", skill: "百年鐘聲", stats: [70, 90, 50], statBasis: ['set', 'set', 'set'], fact: "文件將臺中驛列為文化門戶計畫涵蓋的古蹟與建物。" },
  { no: 2, name: "第二市場", type: 'old', rarity: 'N', policy: 'EDU-21', policyShort: '文化門戶', policyTitle: "臺中車站出發，啟動「臺中文化門戶計畫」", doc: '文化政策', status: "文件列為文化門戶計畫範圍", skill: "早安吆喝", stats: [80, 75, 40], statBasis: ['set', 'set', 'set'], fact: "文件將第二市場列為文化門戶計畫涵蓋的建物。" },
  { no: 3, name: "宮原眼科", type: 'old', rarity: 'N', policy: 'EDU-21', policyShort: '文化門戶', policyTitle: "臺中車站出發，啟動「臺中文化門戶計畫」", doc: '文化政策', status: "文件列為文化門戶計畫範圍", skill: "拱廊慢逛", stats: [75, 70, 25], statBasis: ['set', 'set', 'set'], fact: "文件將宮原眼科列為文化門戶計畫涵蓋的建物。" },
  { no: 4, name: "新民街倉庫群", type: 'venue', rarity: 'N', policy: 'IND-18', policyShort: '星光計畫', policyTitle: "推動星光計畫，點亮活化舊城區", doc: '文化政策', status: "文件提出：設立 Live House", skill: "暖場開唱", stats: [50, 55, 45], statBasis: ['set', 'set', 'set'], fact: "文件提出在新民街倉庫群設立 Live House。" },
  { no: 5, name: "流行影音中心", type: 'venue', rarity: 'SR', policy: 'IND-18', policyShort: '星光計畫', policyTitle: "推動星光計畫，點亮活化舊城區", doc: '文化政策', status: "文件稱：2027 年開幕", skill: "沉浸聲光", stats: [85, 20, 70], statBasis: ['set', 'set', 'set'], fact: "文件提到：總投資近 24 億，含國際級影城、沉浸式體驗與 Live House 空間。" },
  { no: 6, name: "鐵支路開唱", type: 'sound', rarity: 'R', policy: 'IND-18', policyShort: '星光計畫', policyTitle: "推動星光計畫，點亮活化舊城區", doc: '文化政策', status: "文件提出：創辦", skill: "鐵道合唱", stats: [65, 45, 20], statBasis: ['set', 'set', 'set'], fact: "文件提出創辦「鐵支路開唱」，讓臺中成為在地樂團與本土音樂人才的聖地。" },
  { no: 7, name: "臺中巨蛋", type: 'venue', rarity: 'R', policy: 'CUL-07', policyShort: '流行音樂', policyTitle: "打造臺中成為流行音樂與表演藝術之都", doc: '文化政策', status: "文件稱：2030 年完工", skill: "萬人尖叫", stats: [90, 10, 30], statBasis: ['set', 'set', 'doc'], fact: "文件提到：主場館 1.5 萬席。（規模 30＝15,000÷500）" },
  { no: 8, name: "臺中超巨蛋", type: 'venue', rarity: 'SSR', policy: 'CUL-07', policyShort: '流行音樂', policyTitle: "打造臺中成為流行音樂與表演藝術之都", doc: '文化政策', status: "文件稱：2030 年完工", skill: "全壘打風暴", stats: [95, 10, 90], statBasis: ['set', 'set', 'doc'], fact: "文件提到：多功能棒球場 4.5 萬席。（規模 90＝45,000÷500）" },
  { no: 9, name: "巨蛋副場館", type: 'venue', rarity: 'N', policy: 'CUL-07', policyShort: '流行音樂', policyTitle: "打造臺中成為流行音樂與表演藝術之都", doc: '文化政策', status: "文件稱：2030 年完工", skill: "近距離演出", stats: [60, 10, 10], statBasis: ['set', 'set', 'doc'], fact: "文件提到：副場館 5 千席。（規模 10＝5,000÷500）" },
  { no: 10, name: "后里薩克斯風", type: 'sound', rarity: 'N', policy: 'CUL-08', policyShort: '文化品牌', policyTitle: "文化產業國際化，打造臺中文化品牌", doc: '文化政策', status: "文件列為在地音樂產業", skill: "金色旋律", stats: [45, 60, 15], statBasis: ['set', 'set', 'set'], fact: "文件提到：結合在地音樂產業，包括后里的薩克斯風。" },
  { no: 11, name: "潭子爵士鼓", type: 'sound', rarity: 'R', policy: 'CUL-08', policyShort: '文化品牌', policyTitle: "文化產業國際化，打造臺中文化品牌", doc: '文化政策', status: "文件列為在地音樂產業", skill: "節奏連擊", stats: [55, 45, 15], statBasis: ['set', 'set', 'set'], fact: "文件提到：潭子的爵士鼓和 AI 鼓。" },
  { no: 12, name: "霧峰音樂鈴", type: 'sound', rarity: 'N', policy: 'CUL-08', policyShort: '文化品牌', policyTitle: "文化產業國際化，打造臺中文化品牌", doc: '文化政策', status: "文件列為在地音樂產業", skill: "叮叮清響", stats: [40, 65, 10], statBasis: ['set', 'set', 'set'], fact: "文件提到：霧峰的音樂鈴機芯。" },
  { no: 13, name: "東勢客家園區", type: 'hill', rarity: 'SR', policy: 'EDU-27', policyShort: '客家園區', policyTitle: "升級「東勢客家文化園區」，再現山城客家之美", doc: '客家政策', status: "文件提出：升級", skill: "老站新生", stats: [60, 80, 55], statBasis: ['set', 'set', 'set'], fact: "文件提出升級東勢客家文化園區（舊車站改建），加入科技互動與親子體驗。" },
  { no: 14, name: "新丁粄", type: 'hill', rarity: 'N', policy: 'EDU-27', policyShort: '客家園區', policyTitle: "升級「東勢客家文化園區」，再現山城客家之美", doc: '客家政策', status: "文件列為客家慶典", skill: "分享喜氣", stats: [70, 85, 10], statBasis: ['set', 'set', 'set'], fact: "文件提到：正月中的東勢新丁粄節，鬪粄並致贈親友分享好運。" },
  { no: 15, name: "巧聖仙師祭", type: 'hill', rarity: 'SR', policy: 'EDU-27', policyShort: '客家園區', policyTitle: "升級「東勢客家文化園區」，再現山城客家之美", doc: '客家政策', status: "文件列為客家慶典", skill: "匠心不輸", stats: [55, 90, 30], statBasis: ['set', 'set', 'set'], fact: "文件提到：五、六月的巧聖仙師文化祭，象徵客家人精益求精的匠人精神。" },
]);

export const TYPE_INFO: Readonly<Record<CardType, { readonly name: string; readonly glyph: string }>> = Object.freeze({
  old: { name: '老城', glyph: '城' }, venue: { name: '場館', glyph: '館' }, sound: { name: '聲音', glyph: '音' }, hill: { name: '山城', glyph: '山' },
});
// Ring: old > sound > venue > hill > old. A beats B: B takes x2 from A; A takes -30 from B.
export const WEAK_TO: Readonly<Record<CardType, CardType>> = Object.freeze({ old: 'hill', sound: 'old', venue: 'sound', hill: 'venue' });
export const RESISTS: Readonly<Record<CardType, CardType>> = Object.freeze({ old: 'sound', sound: 'venue', venue: 'hill', hill: 'old' });
export const RARITY_INFO: Readonly<Record<Rarity, { readonly symbol: string; readonly name: string; readonly odds: number }>> = Object.freeze({
  N: { symbol: '●', name: '普通', odds: 0.6 }, R: { symbol: '◆', name: '稀有', odds: 0.28 }, SR: { symbol: '★', name: '超稀有', odds: 0.1 }, SSR: { symbol: '✦', name: '傳說', odds: 0.02 },
});
/** Chance that any drawn card is a foil (閃卡) copy. Independent of rarity; foil is a separate collectible. */
export const FOIL_ODDS = 0.1;

export const cardCp = (card: ObjectCard): number => card.stats[0] + card.stats[1] + card.stats[2];
export const cardDamage = (card: ObjectCard): number => Math.round(card.stats[0] / 10) * 10;
export const cardCost = (card: ObjectCard): number => Math.max(1, Math.floor(card.stats[2] / 30));
export const cardById = (no: number): ObjectCard | undefined => CARDS.find(card => card.no === no);
/** Damage when attacker hits defender: weakness x2, resistance -30, never below 0. */
export function attackDamage(attacker: ObjectCard, defender: ObjectCard): number {
  let value = cardDamage(attacker);
  if (WEAK_TO[defender.type] === attacker.type) value *= 2;
  if (RESISTS[defender.type] === attacker.type) value -= 30;
  return Math.max(0, value);
}

export interface Draw { readonly card: ObjectCard; readonly foil: boolean }
/** rng() must return [0,1). Pick a rarity tier by public odds, then a card of that tier uniformly; then roll foil. */
export function drawCard(rng: () => number = Math.random): Draw {
  const roll = rng();
  let acc = 0, tier: Rarity = 'N';
  for (const key of ['N', 'R', 'SR', 'SSR'] as const) { acc += RARITY_INFO[key].odds; if (roll < acc) { tier = key; break; } tier = key; }
  const pool = CARDS.filter(card => card.rarity === tier);
  const card = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]!;
  return { card, foil: rng() < FOIL_ODDS };
}
/** Small deterministic PRNG for tests and reproducible draws. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- Collection (this device only) ----
export interface Collection { readonly v: 2; readonly cards: Record<string, { n: number; foil: number }> }
export const COLLECTION_KEY = 'taichung-fortune-v2';
export const emptyCollection = (): Collection => ({ v: 2, cards: {} });
export function addToCollection(col: Collection, draw: Draw): { collection: Collection; isNew: boolean; isNewFoil: boolean } {
  const key = String(draw.card.no), prev = col.cards[key] ?? { n: 0, foil: 0 };
  const next = { n: prev.n + (draw.foil ? 0 : 1), foil: prev.foil + (draw.foil ? 1 : 0) };
  return { collection: { v: 2, cards: { ...col.cards, [key]: next } }, isNew: prev.n + prev.foil === 0, isNewFoil: draw.foil && prev.foil === 0 };
}
export const ownedCount = (col: Collection): number => CARDS.filter(card => (col.cards[String(card.no)]?.n ?? 0) + (col.cards[String(card.no)]?.foil ?? 0) > 0).length;
export const foilCount = (col: Collection): number => CARDS.filter(card => (col.cards[String(card.no)]?.foil ?? 0) > 0).length;
export const isComplete = (col: Collection): boolean => ownedCount(col) === CARDS.length;
export const serializeCollection = (col: Collection): string => JSON.stringify(col);
/** Fails closed: any malformed or unknown entry returns null so the caller starts empty rather than trusting bad data. */
export function restoreCollection(raw: string | null): Collection | null {
  if (!raw) return null;
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return null; }
  if (!data || typeof data !== 'object' || (data as Collection).v !== 2) return null;
  const cards = (data as Collection).cards;
  if (!cards || typeof cards !== 'object' || Array.isArray(cards)) return null;
  const out: Record<string, { n: number; foil: number }> = {};
  for (const [key, value] of Object.entries(cards)) {
    if (!/^\d+$/.test(key) || !cardById(Number(key))) return null;
    const v = value as { n?: unknown; foil?: unknown };
    if (!v || !Number.isInteger(v.n) || !Number.isInteger(v.foil) || (v.n as number) < 0 || (v.foil as number) < 0 || (v.n as number) > 9999 || (v.foil as number) > 9999) return null;
    out[key] = { n: v.n as number, foil: v.foil as number };
  }
  return { v: 2, cards: out };
}
export const shareText = (draw: Draw): string =>
  `我在台中味抽到【${draw.card.name}】${RARITY_INFO[draw.card.rarity].symbol}${RARITY_INFO[draw.card.rarity].name}${draw.foil ? '・閃卡' : ''}　CP ${cardCp(draw.card)}`;

// ---- Gifts: send a spare copy to a friend by link. No server, so this is a gift, not a verified trade. ----
// The link lives in the URL hash (never sent to a server) and carries only a card number plus a typo check.
// Foil copies and rarity cannot be encoded, so a link can never forge a rarer card.
const giftCheck = (no: number): string => String((no * 37 + 11) % 100).padStart(2, '0');
export const encodeGift = (no: number): string => `gift=v1.${no}.${giftCheck(no)}`;
export function decodeGift(hash: string): ObjectCard | null {
  const match = /^#?gift=v1\.(\d{1,3})\.(\d{2})$/.exec(hash.trim());
  if (!match) return null;
  const no = Number(match[1]), card = cardById(no);
  return card && match[2] === giftCheck(no) ? card : null;
}
/** Spare = a normal (non-foil) copy beyond the first copy you own in total. Returns the collection after giving one away, or null. */
export function giveSpare(col: Collection, no: number): Collection | null {
  const entry = col.cards[String(no)];
  if (!entry || entry.n < 1 || entry.n + entry.foil < 2) return null;
  return { v: 2, cards: { ...col.cards, [String(no)]: { n: entry.n - 1, foil: entry.foil } } };
}
export const spareCount = (col: Collection, no: number): number => {
  const entry = col.cards[String(no)];
  return !entry || entry.n + entry.foil < 2 ? 0 : Math.min(entry.n, entry.n + entry.foil - 1);
};
export function receiveGift(col: Collection, card: ObjectCard): { collection: Collection; isNew: boolean } {
  const r = addToCollection(col, { card, foil: false });
  return { collection: r.collection, isNew: r.isNew };
}

// ---- Knob gesture: accumulate the angle swept around a centre; a turn counts at TURN_NEEDED degrees (either direction). ----
export const TURN_NEEDED = 330;
export function advanceTurn(accumulated: number, previousAngle: number, nextAngle: number): number {
  let delta = nextAngle - previousAngle;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return accumulated + delta;
}
export const turnProgress = (accumulated: number): number => Math.min(1, Math.abs(accumulated) / TURN_NEEDED);

// ---- Compare two cards (damage each way with weakness and resistance applied) ----
export interface Comparison { readonly aToB: number; readonly bToA: number; readonly cpDiff: number; readonly stronger: 'a' | 'b' | 'tie' }
export function compareCards(a: ObjectCard, b: ObjectCard): Comparison {
  const cpDiff = cardCp(a) - cardCp(b);
  return { aToB: attackDamage(a, b), bToA: attackDamage(b, a), cpDiff, stronger: cpDiff > 0 ? 'a' : cpDiff < 0 ? 'b' : 'tie' };
}
