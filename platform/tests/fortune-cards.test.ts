import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, RARITY_INFO, FOIL_ODDS, TYPE_INFO, WEAK_TO, RESISTS, drawCard, seededRng, cardCp, cardDamage, cardCost, attackDamage, addToCollection, emptyCollection, ownedCount, foilCount, isComplete, serializeCollection, restoreCollection, shareText, cardById } from '../packages/experience/src/cards.ts';

test('fifteen object cards from five policies with the published rarity split', () => {
  assert.equal(CARDS.length, 15);
  assert.equal(new Set(CARDS.map(card => card.no)).size, 15);
  assert.equal(new Set(CARDS.map(card => card.policy)).size, 5);
  const count = (r: string) => CARDS.filter(card => card.rarity === r).length;
  assert.deepEqual(['N', 'R', 'SR', 'SSR'].map(count), [7, 4, 3, 1]);
  for (const card of CARDS) {
    assert.ok(card.name.length <= 8, card.name);
    assert.ok(card.stats.every(value => Number.isInteger(value) && value >= 0 && value <= 99), card.name);
    assert.ok(card.status.length > 0 && card.fact.length > 0);
    assert.ok(Object.hasOwn(TYPE_INFO, card.type));
  }
});
test('published odds sum to one and seat-based scale follows the 500-seat rule', () => {
  assert.ok(Math.abs(Object.values(RARITY_INFO).reduce((sum, r) => sum + r.odds, 0) - 1) < 1e-9);
  assert.equal(cardById(7)!.stats[2], 15000 / 500);
  assert.equal(cardById(8)!.stats[2], 45000 / 500);
  assert.equal(cardById(9)!.stats[2], 5000 / 500);
  for (const no of [7, 8, 9]) assert.deepEqual(cardById(no)!.statBasis, ['set', 'set', 'doc']);
});
test('type ring is a single cycle: every type has exactly one counter and one it resists', () => {
  const types = Object.keys(TYPE_INFO) as (keyof typeof TYPE_INFO)[];
  for (const t of types) { assert.notEqual(WEAK_TO[t], t); assert.equal(RESISTS[WEAK_TO[t]], t); }
  let cur = types[0]!; const seen = new Set<string>();
  for (let i = 0; i < 4; i++) { seen.add(cur); cur = WEAK_TO[cur]; }
  assert.equal(seen.size, 4);
});
test('cp, damage, cost and attack damage follow the published formulas', () => {
  const dome = cardById(8)!, hill = cardById(13)!;
  assert.equal(cardCp(dome), 95 + 10 + 90);
  assert.equal(cardDamage(dome), 100);
  assert.equal(cardCost(dome), 3);
  assert.equal(cardCost(cardById(9)!), 1);
  assert.equal(attackDamage(dome, hill), 200, 'venue beats hill: x2');
  assert.equal(attackDamage(hill, dome), 60 - 30, 'venue resists hill: -30');
  assert.equal(attackDamage(cardById(2)!, cardById(10)!), 80 * 2, 'sound is weak to old: x2');
  assert.equal(attackDamage(cardById(10)!, cardById(2)!), Math.max(0, 50 - 30), 'old resists sound: -30');
});
test('draw frequencies match the published odds and every card and foil is reachable', () => {
  const rng = seededRng(20261027); const N = 40000;
  const tiers: Record<string, number> = { N: 0, R: 0, SR: 0, SSR: 0 }; const seen = new Set<number>(); let foil = 0;
  for (let i = 0; i < N; i++) { const d = drawCard(rng); tiers[d.card.rarity]!++; seen.add(d.card.no); if (d.foil) foil++; }
  for (const key of ['N', 'R', 'SR', 'SSR'] as const) assert.ok(Math.abs(tiers[key]! / N - RARITY_INFO[key].odds) < 0.012, `${key} ${tiers[key]! / N}`);
  assert.equal(seen.size, 15);
  assert.ok(Math.abs(foil / N - FOIL_ODDS) < 0.01);
  const a = drawCard(seededRng(5)), b = drawCard(seededRng(5));
  assert.deepEqual([a.card.no, a.foil], [b.card.no, b.foil]);
  assert.doesNotThrow(() => drawCard(() => 0.999999999)); assert.doesNotThrow(() => drawCard(() => 0));
});
test('collection tracks new cards, duplicates and foil copies separately', () => {
  let col = emptyCollection();
  const c1 = CARDS[0]!;
  let r = addToCollection(col, { card: c1, foil: false }); col = r.collection;
  assert.equal(r.isNew, true); assert.equal(ownedCount(col), 1);
  r = addToCollection(col, { card: c1, foil: false }); col = r.collection;
  assert.equal(r.isNew, false); assert.equal(col.cards['1']!.n, 2);
  r = addToCollection(col, { card: c1, foil: true }); col = r.collection;
  assert.equal(r.isNew, false); assert.equal(r.isNewFoil, true); assert.equal(foilCount(col), 1);
  for (const card of CARDS) col = addToCollection(col, { card, foil: false }).collection;
  assert.equal(isComplete(col), true);
});
test('collection storage fails closed on bad data', () => {
  const col = addToCollection(emptyCollection(), { card: CARDS[3]!, foil: true }).collection;
  assert.deepEqual(restoreCollection(serializeCollection(col)), col);
  const bad = [null, '', 'nope', '{}', '{"v":1,"cards":{}}', '{"v":2,"cards":[]}', '{"v":2,"cards":{"99":{"n":1,"foil":0}}}', '{"v":2,"cards":{"1":{"n":-1,"foil":0}}}', '{"v":2,"cards":{"1":{"n":1.5,"foil":0}}}', '{"v":2,"cards":{"1":{"n":99999,"foil":0}}}', '{"v":2,"cards":{"x":{"n":1,"foil":0}}}'];
  for (const raw of bad) assert.equal(restoreCollection(raw), null, String(raw));
});
test('card and share wording stays factual: no endorsement words, status quotes the document, disclaimers present in facts', () => {
  const forbidden = ['投票', '支持', '推薦', '贊成', '拉票', '選我'];
  for (const card of CARDS) {
    const text = [card.name, card.status, card.skill, card.fact, card.policyTitle].join('\n');
    for (const word of forbidden) assert.equal(text.includes(word), false, `${card.name}: ${word}`);
    assert.match(card.status, /^文件/);
    assert.doesNotMatch(card.status + card.fact, /已完工|已落成|已完成|已實施/);
  }
  assert.match(shareText({ card: CARDS[7]!, foil: true }), /臺中超巨蛋.*傳說.*閃卡.*CP 195/);
  assert.equal(shareText({ card: CARDS[7]!, foil: false }).includes('支持'), false);
});

import { readFileSync } from 'node:fs';
test('card game page keeps exactly one primary action per screen and no analytics or upload code', () => {
  const page = readFileSync(new URL('../apps/fortune/app/page.tsx', import.meta.url), 'utf8');
  const stages = page.split(/\{stage === /).slice(1);
  assert.ok(stages.length >= 6);
  for (const block of stages) assert.equal((block.match(/data-primary="true"/g) ?? []).length <= 1, true);
  assert.equal((page.match(/data-primary="true"/g) ?? []).length, 6, 'one primary button for each of the six screens');
  assert.doesNotMatch(page, /sendBeacon|XMLHttpRequest|fetch\(|gtag|analytics/);
  assert.match(page, /不上傳/);
  assert.match(page, /未取得競選團隊授權或背書/);
});

import { encodeGift, decodeGift, giveSpare, spareCount, receiveGift, advanceTurn, turnProgress, TURN_NEEDED, compareCards } from '../packages/experience/src/cards.ts';
test('gift links carry only a card number, reject typos and cannot forge rarity or foil', () => {
  for (const card of CARDS) { const code = encodeGift(card.no); assert.equal(decodeGift('#' + code)?.no, card.no); assert.equal(decodeGift(code)?.no, card.no); }
  const good = encodeGift(8);
  const bad = ['', '#', '#gift=v1.8', '#gift=v1.8.00', '#gift=v1.99.00', '#gift=v2.8.' + good.slice(-2), '#gift=v1.8.' + good.slice(-2) + '&foil=1', '#gift=v1.8.' + good.slice(-2) + '.SSR', '#x=1', '#gift=v1.-1.00', '#gift=v1.8.' + String((Number(good.slice(-2)) + 1) % 100).padStart(2, '0')];
  for (const hash of bad) assert.equal(decodeGift(hash), null, hash);
  assert.doesNotMatch(good, /foil|rarity|SSR/);
});
test('only spare normal copies can be given; the last copy and foil-only holdings stay', () => {
  let col = emptyCollection();
  assert.equal(giveSpare(col, 4), null);
  col = addToCollection(col, { card: CARDS[3]!, foil: false }).collection;
  assert.equal(giveSpare(col, 4), null, 'keeps the only copy');
  col = addToCollection(col, { card: CARDS[3]!, foil: false }).collection;
  assert.equal(spareCount(col, 4), 1);
  const after = giveSpare(col, 4)!; assert.equal(after.cards['4']!.n, 1); assert.equal(giveSpare(after, 4), null);
  let foilOnly = addToCollection(emptyCollection(), { card: CARDS[3]!, foil: true }).collection;
  foilOnly = addToCollection(foilOnly, { card: CARDS[3]!, foil: true }).collection;
  assert.equal(giveSpare(foilOnly, 4), null, 'foil copies are never given away');
  assert.equal(spareCount(foilOnly, 4), 0);
  const mixed = addToCollection(addToCollection(emptyCollection(), { card: CARDS[3]!, foil: true }).collection, { card: CARDS[3]!, foil: false }).collection;
  assert.equal(spareCount(mixed, 4), 1);
  const got = receiveGift(emptyCollection(), CARDS[3]!);
  assert.equal(got.isNew, true); assert.equal(got.collection.cards['4']!.foil, 0);
});
test('knob turn accumulates across the 0/360 seam in either direction and needs a near-full circle', () => {
  let acc = 0, prev = 350;
  for (const next of [10, 40, 90, 150, 210, 270, 330, 350 + 0]) { acc = advanceTurn(acc, prev, next); prev = next; }
  assert.ok(acc > 0 && turnProgress(acc) === 1, String(acc));
  let back = 0, p = 20;
  for (const next of [350, 300, 240, 180, 120, 60, 20, 340]) { back = advanceTurn(back, p, next); p = next; }
  assert.ok(back < 0 && turnProgress(back) === 1, String(back));
  assert.ok(turnProgress(advanceTurn(0, 0, 90)) < 0.3);
  assert.equal(turnProgress(TURN_NEEDED), 1);
});
test('compare shows both directions with weakness and resistance and a CP verdict', () => {
  const dome = cardById(8)!, hill = cardById(13)!;
  const r = compareCards(dome, hill);
  assert.equal(r.aToB, 200); assert.equal(r.bToA, 30); assert.equal(r.cpDiff, 0); assert.equal(r.stronger, 'tie', 'both are CP 195');
  assert.equal(compareCards(dome, cardById(3)!).stronger, 'a');
  assert.equal(compareCards(dome, dome).stronger, 'tie');
});
