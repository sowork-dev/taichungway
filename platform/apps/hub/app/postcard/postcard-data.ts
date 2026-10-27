export const SYNTHETIC_NOTICE = '合成聲景示意・非在地實錄';
export const GROUPS = ['山', '海', '屯', '城'] as const;
export type DistrictGroup = typeof GROUPS[number];
export const SOUND_BEDS = {
  market: { title: '市集節拍', src: '/audio/city-market.wav', description: '以節奏與輕敲構成的市集想像，無人聲。' },
  sea: { title: '潮汐起伏', src: '/audio/city-sea.wav', description: '以合成噪音構成的潮汐起伏。' },
  birds: { title: '樹間音符', src: '/audio/city-birds.wav', description: '以合成音符構成的鳥鳴想像。' },
  rain: { title: '細雨紋理', src: '/audio/city-rain.wav', description: '以合成噪音構成的細雨紋理。' },
  train: { title: '軌道律動', src: '/audio/city-train.wav', description: '以規律節拍構成的軌道律動。' },
  bell: { title: '清亮鐘音', src: '/audio/city-bell.wav', description: '以合成泛音構成的清亮鐘音。' },
} as const;
export type SoundBed = keyof typeof SOUND_BEDS;
export type District = { id: string; name: string; group: DistrictGroup; bed: SoundBed };
export type MixEntry = { id: string; volume: number };

/** Strict, whole-string, allowlisted format. No user text belongs here. */
export function parseMix(value: string | null): MixEntry[] | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 26) return null;
  const parts = value.split(',');
  if (parts.length < 1 || parts.length > 3) return null;
  const result: MixEntry[] = [];
  for (const part of parts) {
    const match = /^(d(?:0[1-9]|[12][0-9])):(0|[1-9][0-9]?|100)$/.exec(part);
    // JS $ also matches before a terminal newline; require full length.
    if (!match || match[0] !== part || !DISTRICTS.some(d => d.id === match[1]) || result.some(d => d.id === match[1])) return null;
    result.push({ id: match[1]!, volume: Number(match[2]) });
  }
  return result;
}

export function serializeMix(mix: readonly MixEntry[]): string {
  if (!Array.isArray(mix) || mix.some(entry => !entry || typeof entry.id !== 'string' || !Number.isInteger(entry.volume))) throw new TypeError('Invalid mix');
  const value = mix.map(entry => `${entry.id}:${entry.volume}`).join(',');
  if (!parseMix(value)) throw new TypeError('Invalid mix');
  return value;
}

export function parseReceiverSearch(search: string): MixEntry[] | null {
  if (!search.startsWith('?mix=')) return null;
  const params = new URLSearchParams(search.slice(1));
  if ([...params.keys()].length !== 1 || !params.has('mix')) return null;
  return parseMix(params.get('mix'));
}

export function buildMixUrl(location: string, mix: readonly MixEntry[]): string {
  const origin = new URL(location);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) throw new TypeError('Invalid origin');
  const target = new URL('/postcard/m/', origin.origin);
  target.searchParams.set('mix', serializeMix(mix));
  return target.href;
}

/** A conservative local convenience guard, not a guarantee of de-identification. */
export function privateTextReason(value: string): string | null {
  const text = value.normalize('NFKC');
  if (/[\w.!#$%&'*+/=?^`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{1,}/i.test(text)) return '電子郵件';
  if (/(?:^|[^A-Z0-9])[A-Z][12ABCD][0-9]{8}(?![0-9])/i.test(text)) return '身分證／居留證號';
  if (/(?:\+?\d[\s().-]*){7,15}/.test(text)) return '電話或長串號碼';
  if (/(?:路|街|大道|巷|弄)[^，。\n]{0,16}[0-9一二三四五六七八九十百零〇]+(?:之[0-9]+)?號/.test(text) || /\b\d{1,6}\s+[A-Z][A-Z\s.]{1,35}\s(?:STREET|ST|ROAD|RD|AVENUE|AVE|LANE|LN)\b/i.test(text)) return '門牌地址';
  return null;
}

// Editorial listening groups, not a map or a claim about district recordings.
// District names checked against Taichung City Government's 29-district list.
export const DISTRICTS: readonly District[] = [
  { id: 'd01', name: '中區', group: '城', bed: 'market' },
  { id: 'd02', name: '東區', group: '城', bed: 'train' },
  { id: 'd03', name: '南區', group: '城', bed: 'bell' },
  { id: 'd04', name: '西區', group: '城', bed: 'birds' },
  { id: 'd05', name: '北區', group: '城', bed: 'market' },
  { id: 'd06', name: '西屯區', group: '城', bed: 'rain' },
  { id: 'd07', name: '南屯區', group: '城', bed: 'bell' },
  { id: 'd08', name: '北屯區', group: '城', bed: 'birds' },
  { id: 'd09', name: '豐原區', group: '山', bed: 'train' },
  { id: 'd10', name: '東勢區', group: '山', bed: 'birds' },
  { id: 'd11', name: '大甲區', group: '海', bed: 'bell' },
  { id: 'd12', name: '清水區', group: '海', bed: 'sea' },
  { id: 'd13', name: '沙鹿區', group: '海', bed: 'rain' },
  { id: 'd14', name: '梧棲區', group: '海', bed: 'sea' },
  { id: 'd15', name: '后里區', group: '山', bed: 'bell' },
  { id: 'd16', name: '神岡區', group: '山', bed: 'birds' },
  { id: 'd17', name: '潭子區', group: '山', bed: 'train' },
  { id: 'd18', name: '大雅區', group: '山', bed: 'rain' },
  { id: 'd19', name: '新社區', group: '山', bed: 'birds' },
  { id: 'd20', name: '石岡區', group: '山', bed: 'birds' },
  { id: 'd21', name: '外埔區', group: '海', bed: 'rain' },
  { id: 'd22', name: '大肚區', group: '海', bed: 'train' },
  { id: 'd23', name: '烏日區', group: '屯', bed: 'train' },
  { id: 'd24', name: '霧峰區', group: '屯', bed: 'bell' },
  { id: 'd25', name: '大里區', group: '屯', bed: 'train' },
  { id: 'd26', name: '太平區', group: '屯', bed: 'rain' },
  { id: 'd27', name: '龍井區', group: '海', bed: 'sea' },
  { id: 'd28', name: '和平區', group: '山', bed: 'rain' },
  { id: 'd29', name: '大安區', group: '海', bed: 'sea' },
];
