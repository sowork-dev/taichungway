import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
test('public/gamekit.css is a byte-identical copy of the UI package kit', () => {
  assert.equal(read('../../public/gamekit.css'), read('../packages/ui/src/gamekit.css'));
});
test('game kit offers the reference components and respects reduced motion', () => {
  const css = read('../packages/ui/src/gamekit.css');
  for (const cls of ['.gk-btn', '.gk-panel', '.gk-badge', '.gk-ribbon', '.gk-chip', '.gk-stars', '.gk-hearts', '.gk-tile', '.gk-progress']) assert.ok(css.includes(cls), cls);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
