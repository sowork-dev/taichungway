import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { createRequire } from 'node:module';
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server');

// Explicit UI fixture, not a substitute for the parent-owned canonical policy data.
const mission = {
  id: 'market' as const, policyId: 'IND-19', title: '公有市場裝冷氣，打造特色市場',
  sourceUrl: 'https://taichungway.tw/future', category: '市場',
  wish: '願逛市場的日常，多一點清爽。', action: '替市場開啟冷氣概念示意',
  context: '市場買菜的日常情境', mechanism: '以市場冷氣與特色市場規劃改善購物環境。',
  limitation: '需依各市場條件評估，並非實測或成果保證。',
};

const pageSource = (app: string) => readFileSync(new URL(`../apps/${app}/app/page.tsx`, import.meta.url), 'utf8');

// Static state-boundary contracts complement real markup tests; browser interaction belongs to parent QA.
test('fortune state boundary gates nickname/export until policy flip and resets on replay', () => {
  const source = readFileSync(new URL('../apps/fortune/app/classic/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /ReturnType<typeof pickPolicyFortune>/);
  assert.match(source, /pickPolicyFortune\(\)/);
  assert.match(source, /<PolicyPlay[^>]+mission=\{result.mission\}[^>]+mode="flip"[^>]+onComplete=\{\(\) => setPolicyRevealed\(true\)\}/);
  assert.match(source, /policyRevealed && <>\s*<NicknameField/);
  assert.match(source, /policyId=\{result.mission.policyId\}/);
  assert.match(source, /setPolicyRevealed\(false\)/);
  assert.match(source, /setNickname\(''\)/);
  assert.match(source, /holdButton.current\?\.focus\(\)/);
  assert.match(source, /POLICY_MISSIONS.length/);
  assert.doesNotMatch(source, /FORTUNES.length/);
});

test('flavor state boundary requires identical market scene between answer one and answer two', () => {
  const source = pageSource('flavor');
  assert.match(source, /'intro' \| 'questions' \| 'market' \| 'result'/);
  assert.match(source, /nextAnswers.length === 1\) \{ setMarketReady\(false\); setStage\('market'\)/);
  assert.match(source, /<PolicyPlay mission=\{MARKET_MISSION\} mode="market"/);
  assert.match(source, /data-testid="market-continue"[^>]+disabled=\{!marketReady\}/);
  assert.match(source, /繼續找我的台中味/);
  assert.match(source, /policyId=\{MARKET_MISSION.policyId\}/);
  assert.match(source, /「\{MARKET_MISSION.title\}」/);
  assert.match(source, /href=\{MARKET_MISSION.sourceUrl\}/);
  assert.match(source, /江啟臣政見・非施政成果/);
  assert.match(source, /scoreFlavor\(nextAnswers\)/);
  assert.match(source, /setMarketReady\(false\)/);
  assert.doesNotMatch(source, /約 30 秒|30 秒完成/);
});

test('policy surfaces define scoped blue-white receipt, air paths and accessible controls', () => {
  const css = readFileSync(new URL('../packages/ui/src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.policy-play\s*\{[^}]*color:\s*#112A4D/);
  assert.match(css, /\.policy-button\s*\{[^}]*min-height:\s*48px/);
  assert.match(css, /\.market-is-cooling \.market-air/);
  assert.match(css, /\.policy-front\[hidden\], \.policy-back\[hidden\]\s*\{\s*display:\s*none/);
});

async function renderPolicy(mode: 'flip' | 'market') {
  const { PolicyPlay } = await import('../packages/ui/src/policy-play');
  return renderToStaticMarkup(createElement(PolicyPlay, { mission, mode }));
}

test('real flip component renders a wish/action front and accessible reveal control', async () => {
  const html = await renderPolicy('flip');
  assert.ok(html.includes(mission.wish));
  assert.ok(html.includes(mission.action));
  assert.match(html, /data-testid="policy-reveal"/);
  assert.match(html, /翻開福氣背後的政策/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /<img|<svg/);
});

test('real policy receipt carries exact quote, safe official source and transparent limitations', async () => {
  const html = await renderPolicy('flip');
  for (const text of [mission.title, mission.mechanism, mission.limitation, '概念示意，不是實測結果', '江啟臣政見・非施政成果']) assert.ok(html.includes(text), text);
  assert.match(html, /href="https:\/\/taichungway.tw\/future" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /class="policy-back" hidden=""/);
  assert.match(html, /<h3[^>]*tabindex="-1"/, 'revealed policy heading must accept managed keyboard focus');
});

test('real market component renders a plan with stalls, aisle and an off-state comparison switch', async () => {
  const html = await renderPolicy('market');
  assert.match(html, /data-testid="market-cool"/);
  assert.match(html, /幫市場開冷氣/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /class="market-aisle"/);
  assert.equal((html.match(/class="market-stall"/g) ?? []).length, 6);
  for (const text of ['非實景照片', '概念示意，不是實測結果', '江啟臣政見・非施政成果', mission.title, mission.mechanism, mission.limitation]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /\d+\s*(?:°|℃)|降溫\d/);
});
