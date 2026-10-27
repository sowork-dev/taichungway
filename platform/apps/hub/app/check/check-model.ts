import { POLICIES } from '../../../../packages/policy-data/src/index';

/** Deliberately narrow local rules, never semantic/AI inference. */
const RULES: ReadonlyArray<{ id: string; matches: (wish: string) => boolean }> = [
  { id: 'IND-19', matches: wish => /市場/.test(wish) && /冷氣/.test(wish) },
  { id: 'TRA-06', matches: wish => /人行道|行人步道/.test(wish) },
  { id: 'TRA-07', matches: wish => /公車/.test(wish) && /免費/.test(wish) },
  { id: 'RES-12', matches: wish => /共融公園|共融.{0,4}公園|全齡公園/.test(wish) },
  { id: 'RES-15', matches: wish => /社會住宅|社宅/.test(wish) },
  { id: 'EDU-29', matches: wish => /客語|大埔腔/.test(wish) },
  { id: 'EDU-04', matches: wish => /托育|托嬰/.test(wish) },
  { id: 'RES-17', matches: wish => /寵物公園|毛小孩公園|狗狗公園/.test(wish) },
];

export type CheckValidation =
  | { ok: true; wish: string; nickname: string }
  | { ok: false; field: 'wish' | 'nickname'; message: string };

const PRIVATE_TEXT = /[\w.+-]+\s*@\s*[\w.-]+\.[a-z]{2,}|(?:\+?886[\s.-]?)?0?9\d(?:[\s().-]*\d){7}|0[2-8][\s().-]*\d(?:[\s().-]*\d){6,8}|\b[A-Z][12]\d{8}\b|\b[A-Z][A-D89]\d{8}\b|\b\d{1,6}\s+[A-Za-z][A-Za-z .'-]{1,48}\s(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd)\b|(?:路|街|大道)[^，。\n]{0,16}[\d０-９一二三四五六七八九十百]+(?:巷[^，。\n]{0,6})?(?:弄[^，。\n]{0,6})?號|(?:地址|住址)\s*[:：]/iu;
const CANDIDATE_ISSUER = /江[啟启]臣|候選人|候选人|市長|市长|競選|竞选|辦公室|办公室/;
const IMPERSONATION = /(?:扮演|假裝|假装|模仿|冒充).{0,10}(?:江[啟启]臣|候選人|市長)|(?:代替|代表|替|幫).{0,5}江[啟启]臣.{0,8}(?:宣布|發言|发言|發表|演講|承諾|承诺)|以江[啟启]臣.{0,5}(?:名義|名义|口吻)/;

export function validateCheckInput(wishInput: string, nicknameInput: string): CheckValidation {
  const wish = wishInput.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, '').trim();
  const nickname = nicknameInput.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, '').trim();
  if (!wish || [...wish].length > 60) return { ok: false, field: 'wish', message: '請寫下 1–60 字的生活願望。' };
  if ([...nickname].length > 10) return { ok: false, field: 'nickname', message: '暱稱最多 10 字，也可以留白。' };
  for (const [field, text] of [['wish', wish], ['nickname', nickname]] as const) {
    if (PRIVATE_TEXT.test(text.normalize('NFKC'))) return { ok: false, field, message: '請移除電話、Email、門牌地址或證件號碼後再試；也請勿填寫真實姓名。' };
  }
  if (CANDIDATE_ISSUER.test(nickname)) return { ok: false, field: 'nickname', message: '這張願望只由你自己署名，請使用自己的暱稱，不可冒用候選人或官方身分。' };
  if (IMPERSONATION.test(wish)) return { ok: false, field: 'wish', message: '請寫自己的生活願望，不代擬候選人發言或承諾。' };
  return { ok: true, wish, nickname };
}

export interface CheckResult { wish: string; nickname: string; policyId: string | null }
export interface CheckState {
  stage: 'write' | 'signed' | 'open';
  result: CheckResult | null;
  error: Extract<CheckValidation, { ok: false }> | null;
}
export type CheckAction =
  | { type: 'generate'; wish: string; nickname: string }
  | { type: 'reveal' }
  | { type: 'reset' };
export const initialCheckState: CheckState = { stage: 'write', result: null, error: null };

export function checkReducer(state: CheckState, action: CheckAction): CheckState {
  if (action.type === 'reset') return initialCheckState;
  if (action.type === 'reveal') return state.result ? { ...state, stage: 'open' } : state;
  const validated = validateCheckInput(action.wish, action.nickname);
  if (!validated.ok) return { ...initialCheckState, error: validated };
  return { stage: 'signed', error: null, result: {
    wish: validated.wish, nickname: validated.nickname, policyId: matchCheckPolicy(validated.wish),
  } };
}

export function matchCheckPolicy(wish: string): string | null {
  const matches = RULES.filter(rule => rule.matches(wish));
  // Multiple distinct topics are ambiguous: ask the reader to consult the full list.
  if (matches.length !== 1) return null;
  const id = matches[0].id;
  return POLICIES.some(policy => policy.id === id) ? id : null;
}
