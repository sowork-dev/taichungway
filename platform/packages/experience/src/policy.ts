import { POLICIES } from '@taichung/policy-data';

export interface PolicyMission {
  readonly id: 'walk' | 'market';
  readonly policyId: string;
  readonly title: string;
  readonly sourceUrl: string;
  readonly category: string;
  readonly wish: string;
  readonly action: string;
  readonly context: string;
  readonly mechanism: string;
  readonly limitation: string;
}

/** Copy is an editorial concept illustration, separate from the exact source title. */
function mission(id: PolicyMission['id'], policyId: string, copy: Pick<PolicyMission, 'wish' | 'action' | 'context' | 'mechanism' | 'limitation'>): PolicyMission {
  const policy = POLICIES.find(row => row.id === policyId);
  if (!policy) throw new Error('Canonical policy missing');
  return Object.freeze({ id, policyId, title: policy.title, sourceUrl: policy.sourceUrl, category: policy.category, ...copy });
}
export const POLICY_MISSIONS: readonly PolicyMission[] = Object.freeze([
  mission('walk', 'TRA-06', {
    wish: '願你出門順，走路也從容。',
    action: '翻開出門順，看看「順」可以從哪裡開始。',
    context: '散步、推車、過路口，都是城市裡的日常。',
    mechanism: '這張卡把「走路從容」的心願，連到官網的人本道路提案；不是交通效果預測。',
    limitation: '互動只是概念示意，不代表政策已落實；各路段設計、期程與成效需另行查證。',
  }),
  mission('market', 'IND-19', {
    wish: '願市場的好滋味，也有舒服的空間。',
    action: '幫市場開冷氣，看看空調如何走進採買日常。',
    context: '菜攤、熟食與來往的人，一起構成市場日常。',
    mechanism: '按下開關，氣流線條會進入市場通道；這是「公有市場裝冷氣」的概念示意，不是實際降溫或節能模擬。',
    limitation: '本場景為虛構示意，不代表市場現況或政策已施行；適用市場、經費、能耗與期程待確認。',
  }),
]);
export const MARKET_MISSION: PolicyMission = POLICY_MISSIONS[1]!;
/** Same public catalog for every player; no political profiling or answer-based targeting. */
export function policyMissionById(policyId: string): PolicyMission {
  const value = POLICY_MISSIONS.find(item => item.policyId === policyId);
  if (!value) throw new RangeError('Unknown playable policy');
  return value;
}
