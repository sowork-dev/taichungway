'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const topicIds = ['exhibition-168', 'robot-city', 'parenting', 'senior-care', 'culture-starlight', 'smart-agriculture', 'airport-gateway', 'smart-transport', 'city-safety', 'twenty-minute-city', 'new-residents', 'indigenous', 'animal-welfare', 'hakka', 'education'];
const sourceHash = 'fd4c2ebf572160971de4cb1c4a2def74bb8b8747dfca79936cfc071543942a2b';
// Independent direct ZIP extraction fingerprints; these are NOT computed from the importer.
// Each fingerprint covers every title, stage field/chip, pad description/bullet, and detail note.
const sourceManifest = [
  ['01-exhibition-168.html', 6, 6, 16, 26, '5c69849a5fda03c0abe85f66dff157d0a726ad311547c4e3cdef29bddaf4d111'],
  ['02-robot-city.html', 6, 5, 18, 22, 'a8a024f7049d7b46b50e35f517854d38d8e307dc47e56f64c6a4fb9f9153aac8'],
  ['03-parenting.html', 6, 5, 17, 29, 'f937f3d66c23bef1e7f7b9bfbdbf8fad3ec610d7870aad560bd9d11deca570f3'],
  ['04-senior-care.html', 6, 6, 23, 23, '1df767eb8199d1ea52939bef264fd027e5cad6b654e34a8106c51bafd5b971a3'],
  ['05-culture-starlight.html', 6, 5, 22, 25, 'cef1adaa2b426b3ef7eee9baa100756a2d0bb81753c9cf9d1339556043044e22'],
  ['06-smart-agriculture.html', 6, 5, 21, 21, 'bad2ba82834efd7b42633b3968aa164af496bf3238c1c97f3b89242e70e35027'],
  ['07-airport-gateway.html', 6, 4, 16, 19, '937c9f72644f81658a04347479eed329384499a0fed343587f628e01fcad1411'],
  ['08-smart-transport.html', 6, 5, 21, 22, '0af3444094b6ac9a6758a110f9323c33ee5da8de7d699f60c634f7e74271eaac'],
  ['09-city-safety.html', 6, 4, 15, 21, '1a476f20715e2b1f1047c81c699e5f99dde92e8ded8e13a88e6484686db425ff'],
  ['10-twenty-minute-city.html', 6, 5, 12, 20, 'd643fc0daa0a97e5e59d0fd09fa8c8789e71be44ec02bf8a8fc3e6da5049ecd1'],
  ['11-new-residents.html', 6, 4, 13, 24, '3bd9f8e7a2baeba3ef3bb64e159edb053ddf62ad04f31ed75b20db3032ac8c73'],
  ['12-indigenous.html', 6, 5, 19, 21, '847f3f4c717d13ee8cbb2ef5dfb0c9541cb05b2d84913c0d5dcdeedc76dbe138'],
  ['13-animal-welfare.html', 6, 3, 14, 20, 'a9c30c7929d60ed4922a32cad936f5277be069f0f8842b91f90cc867dbbdf7d5'],
  ['14-hakka.html', 6, 5, 23, 22, '0dd2ce25a4f597e20d85f6a31fac330e5ae0504ac4f74326737af32319fba812'],
  ['15-education.html', 6, 6, 25, 23, '3a4cdaef27355c62816b63095b82229e3a4034c7a4f9916f05f1785902febb96'],
];

for (const [filename, stages, pads, bullets, chips, fingerprint] of sourceManifest) {
  test(`complete source coverage: ${filename}`, () => {
    const topic = read('data/policy-catalog.json').topics.find(t => t.sourceFile === filename);
    assert.ok(topic);
    assert.deepEqual(Object.keys(topic).sort(), ['detailNote', 'id', 'pads', 'recordIds', 'sourceFile', 'sourceUrl', 'stages', 'title']);
    assert.equal(topic.stages.length, stages);
    assert.equal(topic.pads.length, pads);
    assert.equal(topic.pads.reduce((n, p) => n + p.details.length, 0), bullets);
    assert.equal(topic.stages.reduce((n, s) => n + s.chips.length, 0), chips);
    const fullText = {title: topic.title, stages: topic.stages,
      pads: topic.pads.map(p => ({title: p.title, description: p.description, details: p.details})), detailNote: topic.detailNote};
    assert.equal(digest(JSON.stringify(fullText)), fingerprint, 'source wording/number/note/chip omitted or changed');
    assert.ok(!/<\/?(?:b|p|span|script)\b/i.test(JSON.stringify(fullText)), 'source markup must not be published');
  });
}

test('data and public JSON are byte-identical and expose no machine-specific paths', () => {
  for (const filename of ['knowledge.json', 'policy-catalog.json']) {
    const data = fs.readFileSync(path.join(root, 'data', filename));
    const publicData = fs.readFileSync(path.join(root, 'public', filename));
    assert.deepEqual(publicData, data);
    assert.ok(!data.toString().includes('/Users/'));
  }
});

const {spawnSync} = require('node:child_process');
const python = source => {
  const result = spawnSync('python3', ['-B', '-c', source], {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
};

test('parser accepts only strict JSON literals, never script expressions or duplicate-key JSON', () => {
  python(`
import runpy
module = runpy.run_path('scripts/import-policy-zip.py')
parse = module['literal']
assert parse('const STAGES = [{"n":"①","t":"100 萬"}];', 'STAGES')[0]['t'] == '100 萬'
for candidate in ['const STAGES = [NaN];', 'const STAGES = [Infinity];', 'const STAGES = [{"t":"first","t":"lost"}];', 'const STAGES = [] + evil();', 'const STAGES = (() => { throw 1; })();', 'const STAGES = []; const STAGES = [];']:
    try:
        parse(candidate, 'STAGES')
    except ValueError:
        pass
    else:
        raise AssertionError('Accepted non-strict JSON: ' + candidate)
assert module['plain']('<b>2025 年 374 億</b> &amp; 2.04 倍<br>764 億元') == '2025 年 374 億 & 2.04 倍\\n764 億元'
`);
});

test('explicit ZIP CLI verifies source hash, imports reproducibly, and never publishes raw archive files', {skip: !process.env.POLICY_SOURCE_ZIP}, () => {
  const os = require('node:os');
  const source = process.env.POLICY_SOURCE_ZIP;
  assert.equal(digest(fs.readFileSync(source)), sourceHash);
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'taichung-policy-'));
  const importer = path.join(root, 'scripts/import-policy-zip.py');
  const run = args => spawnSync('python3', ['-B', importer, ...args], {encoding: 'utf8'});
  const artifacts = ['data/knowledge.json', 'public/knowledge.json', 'data/policy-catalog.json', 'public/policy-catalog.json'];
  const snapshot = () => artifacts.map(name => digest(fs.readFileSync(path.join(temporaryRoot, name))));
  try {
    fs.mkdirSync(path.join(temporaryRoot, 'data'));
    const imported = fs.readFileSync(path.join(root, 'data/knowledge.json'), 'utf8');
    const boundary = imported.indexOf('\n  {\n    "id": "archive-');
    const original = imported.slice(0, boundary).replace(/,\s*$/, '\n') + ']\n';
    assert.equal(digest(original), '4076c5acfc557cecb52e69cff9c168e6c962ee1dd6c674bf8638b67a2892995c');
    fs.writeFileSync(path.join(temporaryRoot, 'data/knowledge.json'), original);
    let result = run([source, '--root', temporaryRoot]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {topics: 15, stages: 90, pads: 73, bullets: 275, chips: 338, addedRecords: 88, totalRecords: 100});
    for (const name of artifacts) assert.deepEqual(fs.readFileSync(path.join(temporaryRoot, name)), fs.readFileSync(path.join(root, name)));
    const before = snapshot();
    result = run([source, '--root', temporaryRoot]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(snapshot(), before, 're-import duplicates records or changes bytes');
    assert.deepEqual(fs.readdirSync(temporaryRoot).sort(), ['data', 'public']);
    for (const directory of ['data', 'public']) assert.deepEqual(fs.readdirSync(path.join(temporaryRoot, directory)).sort(), ['knowledge.json', 'policy-catalog.json']);
    const bad = path.join(temporaryRoot, 'not-the-source.zip');
    fs.writeFileSync(bad, 'not the supplied archive');
    result = run([bad, '--root', temporaryRoot]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SHA256/);
    assert.deepEqual(snapshot(), before, 'failed hash verification must not write output');
    const dataPath = path.join(temporaryRoot, 'data/knowledge.json');
    fs.writeFileSync(dataPath, fs.readFileSync(dataPath, 'utf8').replace('transport-public-transit', 'altered-original-card'));
    const altered = snapshot();
    result = run([source, '--root', temporaryRoot]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Original 12 knowledge card bytes changed/);
    assert.deepEqual(snapshot(), altered, 'failed original-card guard must not write output');
    assert.notEqual(run([]).status, 0, 'ZIP path must be explicitly supplied');
  } finally {
    fs.rmSync(temporaryRoot, {recursive: true, force: true});
  }
});

test('supplied archive catalog contains the exact 15 source filenames and stable record IDs', () => {
  assert.ok(fs.existsSync(path.join(root, 'data/policy-catalog.json')), 'missing full-source policy catalog');
  const catalog = read('data/policy-catalog.json');
  assert.deepEqual(Object.keys(catalog).sort(), ['source', 'topics', 'version']);
  assert.equal(catalog.version, 1);
  assert.deepEqual(catalog.source, {kind: 'user-provided-archive', filename: 'taichung-machine-site.zip', sha256: sourceHash, importedAt: '2026-10-25', verification: 'supplied-not-independently-verified'});
  assert.deepEqual(catalog.topics.map(t => t.id), topicIds);
  for (const [i, topic] of catalog.topics.entries()) {
    const filename = `${String(i + 1).padStart(2, '0')}-${topic.id}.html`;
    assert.equal(topic.sourceFile, filename);
    assert.equal(topic.sourceUrl, `https://taichung.sowork.ai/${filename}`);
    assert.deepEqual(topic.recordIds, [`archive-${topic.id}-overview`, ...topic.pads.map((p, j) => `archive-${topic.id}-pad-${j + 1}`)]);
    assert.deepEqual(topic.pads.map(p => p.recordId), topic.recordIds.slice(1));
  }
});

test('knowledge appends every overview and pad while preserving all 12 original cards verbatim', () => {
  const bytes = fs.readFileSync(path.join(root, 'data/knowledge.json'), 'utf8');
  const records = JSON.parse(bytes);
  const catalog = read('data/policy-catalog.json');
  assert.equal(records.length, 100, '12 original + 15 overview + 73 pad cards');
  const boundary = bytes.indexOf('\n  {\n    "id": "archive-');
  assert.ok(boundary > 0);
  assert.equal(digest(bytes.slice(0, boundary).replace(/,\s*$/, '\n')), 'c1304e59bff190797504e54c99b58578c31b02285496e4e2dc96ce4dbc5bdb2d');
  assert.equal(new Set(records.map(r => r.id)).size, records.length);
  assert.deepEqual(records.slice(12).map(r => r.id), catalog.topics.flatMap(t => t.recordIds));
  const byId = new Map(records.map(r => [r.id, r]));
  for (const topic of catalog.topics) {
    const overview = byId.get(topic.recordIds[0]);
    for (const stage of topic.stages) {
      for (const text of [stage.n, stage.t, stage.s, stage.note, ...stage.chips].filter(Boolean)) {
        assert.ok(overview.details.includes(text), `${topic.id}: missing stage text ${text}`);
      }
    }
    assert.ok(overview.details.includes(topic.detailNote));
    for (const pad of topic.pads) {
      const card = byId.get(pad.recordId);
      assert.ok(card.details.includes(pad.description));
      for (const bullet of pad.details) assert.ok(card.details.includes(bullet), `${pad.recordId}: missing bullet`);
      assert.ok(card.aliases.includes(pad.title));
    }
    for (const id of topic.recordIds) {
      const card = byId.get(id);
      assert.equal(card.category, topic.title);
      assert.equal(card.topicId, topic.id);
      assert.equal(card.status, 'proposed');
      assert.equal(card.provenance, 'user-provided-archive');
      assert.equal(card.sourceUrl, topic.sourceUrl);
      assert.equal(card.sourceDate, null);
      assert.equal(card.verifiedAt, '2026-10-25');
      assert.ok(card.sourceTitle.includes(topic.title));
      assert.match(card.summary, /使用者提供.*提案.*未獨立查證.*不代表已施行/);
      assert.ok([...card.summary].length <= 180);
      assert.ok(card.question && card.aliases.length > 0);
      assert.ok(card.aliases.every(alias => [...alias].length > 2), 'no generic two-character aliases');
      assert.equal(card.mechanismSteps.length, 3);
      const fullSource = [topic.title, ...topic.stages.flatMap(s => [s.n, s.t, s.s, s.note, ...s.chips]), ...topic.pads.flatMap(p => [p.title, p.description, ...p.details])];
      for (const step of card.mechanismSteps) {
        assert.ok(step.length > 0 && [...step].length <= 64);
        assert.ok(fullSource.some(text => text.includes(step)), `invented mechanism: ${step}`);
      }
    }
  }
});
