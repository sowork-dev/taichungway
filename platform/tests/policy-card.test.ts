import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as cards from '../packages/share-card/src/index.ts';
import { POLICY_MISSIONS, FLAVORS } from '../packages/experience/src/index.ts';

const fontBytes = readFileSync(new URL('../assets/fonts/LocalSansTC-Regular.ttf', import.meta.url));
const font = fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength);
const input = { title: '老市場味｜台中味', body: FLAVORS[0]!.description, accent: '#1A63C8', kind: 'flavor' as const, variant: 'market', policyId: 'IND-19' };

test('card validation fails closed for unknown or malformed policy IDs while allowing both verified proposals', () => {
  for (const mission of POLICY_MISSIONS) assert.equal(cards.validateCard({ ...input, policyId: mission.policyId }).policyId, mission.policyId);
  for (const policyId of ['', 'TRA-99', 'javascript:alert(1)', null, 6, { title: 'invented' }]) {
    assert.throws(() => cards.validateCard({ ...input, policyId } as any), /policy|policyId/);
  }
});

test('policy exports carry an exact canonical proposal, source and non-achievement disclosure in the actual SVG', async () => {
  const svg = await cards.renderCardSvg(input, font);
  assert.ok(svg.includes('公有市場裝冷氣，打造特色市場'), 'export has no accessible canonical policy title');
  assert.ok(svg.includes('taichungway.tw/future'), 'export has no source');
  assert.ok(svg.includes('江啟臣政見'), 'export has no policy label');
  assert.notEqual(svg, await cards.renderCardSvg({ ...input, policyId: undefined } as any, font));
});
