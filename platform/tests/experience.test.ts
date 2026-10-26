import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import * as experience from '../packages/experience/src/index.ts';

test('fortune collection has at least 40 unique brief Traditional Chinese blessings', () => {
  assert.ok(experience.FORTUNES.length >= 40);
  assert.equal(new Set(experience.FORTUNES).size, experience.FORTUNES.length);
  for (const text of experience.FORTUNES) {
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 0 && [...text].length <= 24, text);
    assert.match(text, /[\u4e00-\u9fff]/u);
    assert.doesNotMatch(text, /候選|政黨|投票|當選|保證|一定|必定|政策|支持率/);
  }
});

test('fortune styles provide at least 12 unique complete color palettes', () => {
  assert.ok(experience.FORTUNE_STYLES.length >= 12);
  assert.equal(new Set(experience.FORTUNE_STYLES.map((style) => style.id)).size, experience.FORTUNE_STYLES.length);
  for (const style of experience.FORTUNE_STYLES) {
    for (const field of ['id', 'name', 'pattern'] as const) assert.ok(style[field]);
    for (const field of ['bg', 'ink', 'accent'] as const) assert.match(style[field], /^#[0-9a-f]{6}$/i);
  }
});

test('pickFortune selects independent text and style at random boundaries', () => {
  assert.deepEqual(experience.pickFortune(() => 0), {
    text: experience.FORTUNES[0], style: experience.FORTUNE_STYLES[0],
  });
  assert.deepEqual(experience.pickFortune(() => 1 - Number.EPSILON), {
    text: experience.FORTUNES.at(-1), style: experience.FORTUNE_STYLES.at(-1),
  });
  let calls = 0;
  const result = experience.pickFortune(() => calls++ === 0 ? 0 : 1 - Number.EPSILON);
  assert.equal(calls, 2);
  assert.equal(result.text, experience.FORTUNES[0]);
  assert.equal(result.style, experience.FORTUNE_STYLES.at(-1));
  const defaultResult = experience.pickFortune();
  assert.ok(experience.FORTUNES.includes(defaultResult.text));
  assert.ok(experience.FORTUNE_STYLES.includes(defaultResult.style));
});

test('flavors preserve the exact eight IDs and names with two-sentence short descriptions', () => {
  assert.deepEqual(experience.FLAVORS.map(({ id, name }) => [id, name]), [
    ['market', '老市場味'], ['tea', '山城茶香味'], ['sea', '海線海風味'], ['home', '屯區新家味'],
    ['oldtown', '舊城文青味'], ['port', '港口遠航味'], ['field', '田裡實在味'], ['craft', '黑手職人味'],
  ]);
  for (const flavor of experience.FLAVORS) {
    assert.ok([...flavor.description].length <= 40, flavor.description);
    assert.equal(flavor.description.split('。').filter(Boolean).length, 2);
    assert.ok(flavor.description.endsWith('。'));
    assert.match(flavor.accent, /^#[0-9a-f]{6}$/i);
    assert.ok(flavor.icon);
    assert.doesNotMatch(flavor.description, /候選|政黨|投票|當選|保證|一定|必定|政策|支持率/);
  }
});

test('questions cover breakfast, evening market, and weekend place in exactly 3 by 4 choices', () => {
  assert.equal(experience.QUESTIONS.length, 3);
  assert.match(experience.QUESTIONS[0]!.title, /早餐/);
  assert.match(experience.QUESTIONS[1]!.title, /傍晚.*市場/);
  assert.match(experience.QUESTIONS[2]!.title, /週末.*哪/);
  const ids = new Set(experience.FLAVORS.map(({ id }) => id));
  for (const question of experience.QUESTIONS) {
    assert.equal(question.options.length, 4);
    for (const option of question.options) {
      assert.ok(option.label);
      assert.ok(option.subtitle);
      assert.equal(option.scores.length, 2);
      assert.equal(new Set(option.scores).size, 2);
      for (const id of option.scores) assert.ok(ids.has(id), id);
    }
  }
});

test('scoreFlavor counts both IDs from every chosen option and returns the highest-scoring flavor', () => {
  const answers = Object.freeze([2, 3, 2]);
  assert.strictEqual(experience.scoreFlavor(answers), experience.FLAVORS.find(({ id }) => id === 'port'));
  assert.deepEqual(answers, [2, 3, 2]);
});

test('scoreFlavor resolves a top-score tie in third-choice scores order before display order', () => {
  // market, home, and oldtown each have two points; the last choice lists home first.
  assert.equal(experience.scoreFlavor([0, 0, 3]).id, 'home');
});

test('scoreFlavor rejects anything except exactly three integer choices from zero through three', () => {
  const invalid: unknown[] = [
    [], [0], [0, 1], [0, 1, 2, 3], new Array(3), [0, , 2],
    null, undefined, '012', { 0: 0, 1: 1, 2: 2, length: 3 }, new Uint8Array([0, 1, 2]),
  ];
  for (const value of [-1, 4, 0.5, NaN, Infinity, -Infinity, '0', null, undefined, true]) {
    for (let index = 0; index < 3; index++) {
      const answers: unknown[] = [0, 1, 2];
      answers[index] = value;
      invalid.push(answers);
    }
  }
  for (const answers of invalid) {
    assert.throws(() => experience.scoreFlavor(answers as readonly number[]), RangeError, String(answers));
  }
});

test('scoreFlavor only prefers third-choice IDs that actually share the maximum score', () => {
  for (const [answers, expected] of [
    [[1, 1, 3], 'oldtown'], [[2, 2, 1], 'field'],
    [[2, 3, 0], 'craft'], [[3, 3, 2], 'port'],
  ] as const) {
    assert.equal(experience.scoreFlavor(answers).id, expected);
  }
});

test('scoreFlavor falls back to FLAVORS order when neither third-choice ID is tied for first', () => {
  // No authored combination reaches this fallback. Exercise the real compiled scorer
  // with isolated scoring data, without mutating content or adding a public test hook.
  const questions = [
    { options: [{ scores: ['oldtown', 'port'] }] },
    { options: [{ scores: ['oldtown', 'port'] }] },
    { options: [{ scores: ['tea', 'field'] }] },
  ];
  const run = (flavors: readonly experience.Flavor[]): experience.Flavor => runInNewContext(
    `(${experience.scoreFlavor.toString()})([0, 0, 0])`,
    { QUESTIONS: questions, FLAVORS: flavors },
  );
  assert.strictEqual(run(experience.FLAVORS), experience.FLAVORS.find(({ id }) => id === 'oldtown'));
  assert.strictEqual(run([...experience.FLAVORS].reverse()), experience.FLAVORS.find(({ id }) => id === 'port'));
});

test('scoreFlavor matches an independent reference across all 64 combinations with all eight results below 35%', (t) => {
  const distribution = Object.fromEntries(experience.FLAVORS.map(({ id }) => [id, 0]));
  const combinations = new Set<string>();
  for (let first = 0; first < 4; first++) {
    for (let second = 0; second < 4; second++) {
      for (let third = 0; third < 4; third++) {
        const answers = Object.freeze([first, second, third]);
        const selected = experience.QUESTIONS.map((question, index) => question.options[answers[index]!]!);
        const votes = selected.flatMap(({ scores }) => [...scores]);
        // Rank every candidate by an independently counted vote total, then its
        // position in the last option, then display position (no scoring helper).
        const ranked = experience.FLAVORS.map((flavor, order) => ({
          flavor, order,
          votes: votes.filter((id) => id === flavor.id).length,
          lastChoice: selected[2]!.scores.includes(flavor.id)
            ? selected[2]!.scores.indexOf(flavor.id) : 2,
        })).sort((a, b) => b.votes - a.votes || a.lastChoice - b.lastChoice || a.order - b.order);
        const result = experience.scoreFlavor(answers);
        assert.strictEqual(result, ranked[0]!.flavor, `answers=${answers}`);
        assert.strictEqual(experience.scoreFlavor(answers), result, 'repeat calls must be deterministic');
        assert.deepEqual(answers, [first, second, third]);
        distribution[result.id]!++;
        combinations.add(answers.join(','));
      }
    }
  }
  assert.equal(combinations.size, 64);
  assert.equal(Object.values(distribution).reduce((sum, count) => sum + count, 0), 64);
  for (const [id, count] of Object.entries(distribution)) {
    assert.ok(count > 0, `${id} must be reachable`);
    assert.ok(count / combinations.size <= 0.35, `${id} exceeds 35%: ${count}/64`);
  }
  t.diagnostic(`Flavor distribution /64: ${JSON.stringify(distribution)}`);
});

test('pickFortune rejects nonfinite or out-of-range RNG samples', () => {
  for (const value of [-1, -Number.EPSILON, 1, Infinity, -Infinity, NaN]) {
    assert.throws(() => experience.pickFortune(() => value), RangeError);
    let calls = 0;
    assert.throws(() => experience.pickFortune(() => calls++ === 0 ? 0 : value), RangeError);
  }
});
