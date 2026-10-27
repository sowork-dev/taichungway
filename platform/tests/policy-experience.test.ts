import test from 'node:test';
import assert from 'node:assert/strict';
import * as experience from '../packages/experience/src/index.ts';
import { POLICIES } from '../packages/policy-data/src/index.ts';

test('policy fortune randomly reveals either public mission, never uses quiz answers, and keeps all twelve palettes', () => {
  const pick = (experience as Record<string, any>).pickPolicyFortune;
  assert.equal(typeof pick, 'function', 'policy fortune picker is missing');
  const ids = new Set<string>();
  const variants = new Set<string>();
  for (const first of [0, 0.5, 0.999999]) {
    for (let palette = 0; palette < 12; palette++) {
      const samples = [first, palette / 12];
      const result = pick(() => samples.shift()!);
      assert.equal(result.text, result.mission.wish);
      ids.add(result.mission.policyId);
      variants.add(result.style.id);
    }
  }
  assert.deepEqual([...ids].sort(), ['IND-19', 'TRA-06']);
  assert.equal(variants.size, 12);
  for (const invalid of [NaN, Infinity, -0.01, 1]) {
    assert.throws(() => pick(() => invalid), RangeError);
    const samples = [0, invalid];
    assert.throws(() => pick(() => samples.shift()!), RangeError);
  }
});


test('playable policy missions retain the two canonical official proposals and explicit interpretation boundaries', () => {
  const missions = (experience as Record<string, any>).POLICY_MISSIONS;
  assert.ok(Array.isArray(missions), 'policy missions are missing');
  assert.deepEqual(missions.map((m: any) => m.policyId), ['TRA-06', 'IND-19']);
  for (const mission of missions) {
    const source = POLICIES.find(policy => policy.id === mission.policyId)!;
    assert.equal(mission.title, source.title);
    assert.equal(mission.category, source.category);
    assert.equal(mission.sourceUrl, source.sourceUrl);
    for (const key of ['wish', 'action', 'context', 'mechanism', 'limitation']) assert.ok(mission[key]?.trim(), key);
    assert.ok(Object.isFrozen(mission));
  }
  assert.ok(Object.isFrozen(missions));
  assert.equal((experience as Record<string, any>).MARKET_MISSION, missions[1]);
});
