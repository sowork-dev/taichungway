const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const modulePath = path.join(__dirname, '../public/quest-core.js');
function core() { return fs.existsSync(modulePath) ? require(modulePath) : {}; }

test('showReview only advances demonstrate to review without completing', () => {
  const q = core(); assert.equal(typeof q.showReview, 'function');
  const s = q.createState(); assert.equal(q.showReview(s), false);
  q.selectMission(s, 'care'); assert.equal(q.showReview(s), false);
  q.choosePolicy(s, 'senior-care-single-window'); q.activatePolicy(s);
  assert.equal(q.showReview(s), true); assert.equal(s.phase, 'review');
  assert.deepEqual(s.completed, []); assert.equal(q.showReview(s), false);
});

test('completeMission rejects early phases including demonstrate', () => {
  const q = core(); assert.equal(typeof q.completeMission, 'function');
  const s = q.createState(); assert.equal(q.completeMission(s), false);
  q.selectMission(s, 'commute'); assert.equal(q.completeMission(s), false);
  q.choosePolicy(s, 'transport-public-transit'); q.activatePolicy(s);
  assert.equal(q.completeMission(s), false); assert.deepEqual(s.completed, []);
  assert.equal(s.phase, 'demonstrate');
});

test('review completion records understanding exactly once and clears mission navigation', () => {
  const q = core(); assert.equal(typeof q.completeMission, 'function');
  const s = q.createState();
  for (let i = 0; i < 2; i++) {
    q.selectMission(s, 'commute'); q.choosePolicy(s, 'transport-smart-roads');
    q.activatePolicy(s); q.showReview(s);
    s.path = [{ x: 200, y: 300 }]; s.destinationMissionId = 'care';
    assert.equal(q.completeMission(s), true);
    assert.deepEqual(s.completed, ['commute']); assert.equal(s.phase, 'explore');
    assert.equal(s.selectedPolicyId, null); assert.equal(s.missionId, null);
    assert.deepEqual(s.path, []); assert.equal(s.destinationMissionId, null);
    assert.equal(q.completeMission(s), false);
    for (const key of ['approval', 'support', 'vote', 'endorsement']) assert.equal(key in s, false);
  }
});

test('closeMission exits every mission phase without completing or moving', () => {
  const q = core(); assert.equal(typeof q.closeMission, 'function');
  for (const phase of ['choose', 'demonstrate', 'review']) {
    const s = q.createState(); q.selectMission(s, 'care'); s.phase = phase;
    s.selectedPolicyId = 'senior-care-single-window'; s.path = [{ x: 20, y: 40 }];
    s.destinationMissionId = 'care'; s.completed = ['commute'];
    q.closeMission(s);
    assert.equal(s.phase, 'explore'); assert.equal(s.missionId, null);
    assert.equal(s.selectedPolicyId, null); assert.deepEqual(s.path, []);
    assert.equal(s.destinationMissionId, null); assert.deepEqual(s.completed, ['commute']);
    assert.equal(s.x, 300); assert.equal(s.y, 520);
  }
});

test('normalizeVector preserves subunit input and caps diagonal magnitude', () => {
  const q = core(); assert.equal(typeof q.normalizeVector, 'function');
  assert.deepEqual(q.normalizeVector(0.25, -0.5), { x: 0.25, y: -0.5 });
  const v = q.normalizeVector(1, 1);
  assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-12);
  assert.ok(Math.abs(v.x - v.y) < 1e-12);
  assert.deepEqual(q.normalizeVector(0, 0), { x: 0, y: 0 });
});

test('normalizeVector always returns finite values for huge and invalid input', () => {
  const q = core(); assert.equal(typeof q.normalizeVector, 'function');
  for (const pair of [[NaN, 1], [1, Infinity], [null, 0], ['1', 0], [undefined, 1]]) {
    assert.deepEqual(q.normalizeVector(...pair), { x: 0, y: 0 });
  }
  const v = q.normalizeVector(1e308, -1e308);
  assert.ok(Number.isFinite(v.x) && Number.isFinite(v.y));
  assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-12);
});

test('canStand uses the exact expanded building rectangles', () => {
  const q = core(); assert.equal(typeof q.canStand, 'function');
  assert.deepEqual(q.OBSTACLES, [
    { x: 45, y: 125, w: 210, h: 145 }, { x: 345, y: 125, w: 210, h: 145 },
    { x: 45, y: 610, w: 210, h: 135 }, { x: 345, y: 610, w: 210, h: 135 }
  ]);
  const s = q.createState();
  for (const o of q.OBSTACLES) {
    assert.equal(q.canStand(s, o.x + o.w / 2, o.y + o.h / 2), false);
    assert.equal(q.canStand(s, o.x - 12, o.y), false);
    assert.equal(q.canStand(s, o.x + o.w + 12, o.y), false);
    assert.equal(q.canStand(s, o.x, o.y - 12), false);
    assert.equal(q.canStand(s, o.x, o.y + o.h + 12), false);
    assert.equal(q.canStand(s, o.x - 12.01, o.y), true);
  }
  assert.equal(q.canStand(s, 300, 520), true);
});

test('canStand enforces padded world bounds and rejects nonfinite coordinates', () => {
  const q = core(); assert.equal(typeof q.canStand, 'function');
  const s = q.createState();
  for (const p of [[12, 12], [588, 1068], [12, 1068], [588, 12]]) {
    assert.equal(q.canStand(s, ...p), true);
  }
  for (const p of [[11.9, 520], [588.1, 520], [300, 11.9], [300, 1068.1], [NaN, 20], [20, Infinity], ['20', 20]]) {
    assert.equal(q.canStand(s, ...p), false);
  }
});

test('nearestMission returns only the nearest mission within inclusive distance', () => {
  const q = core(); assert.equal(typeof q.nearestMission, 'function');
  const s = q.createState(); assert.equal(q.nearestMission(s), null);
  for (const mission of q.MISSIONS) {
    s.x = mission.x; s.y = mission.y;
    assert.equal(q.nearestMission(s, 0).id, mission.id);
    s.x += 100;
    assert.equal(q.nearestMission(s).id, mission.id);
    assert.equal(q.nearestMission(s, 99.99), null);
  }
  assert.equal(q.nearestMission(s, -1), null);
  assert.equal(q.nearestMission({ x: NaN, y: 350 }), null);
});

test('step moves at 180 units per second with no diagonal speed advantage', () => {
  const q = core(); assert.equal(typeof q.step, 'function');
  const a = q.createState();
  assert.deepEqual(q.step(a, { x: 1, y: 0 }, 0.05), { moved: true, arrivedMissionId: null });
  assert.ok(Math.abs(a.x - 300 - 180 * 0.05) < 1e-10); assert.equal(a.y, 520);
  const b = q.createState(); q.step(b, { x: 1, y: 1 }, 0.05);
  assert.ok(Math.abs(Math.hypot(b.x - 300, b.y - 520) - 180 * 0.05) < 1e-10);
});

test('step caps dt at .05 and dash speed at 340', () => {
  const q = core(); assert.equal(typeof q.step, 'function');
  const a = q.createState(); const b = q.createState();
  q.step(a, { x: 1, y: 0, dash: true }, 1000000);
  q.step(b, { x: 1, y: 0, dash: true }, 0.05);
  assert.equal(a.x, b.x); assert.ok(Math.abs(a.x - 300 - 340 * 0.05) < 1e-10);
  for (const dt of [-1, 0, NaN, Infinity, undefined]) {
    const s = q.createState();
    assert.deepEqual(q.step(s, { x: 1, y: 0 }, dt), { moved: false, arrivedMissionId: null });
    assert.equal(s.x, 300); assert.equal(s.y, 520);
  }
});

test('step does not move or mutate navigation while paused or outside explore', () => {
  const q = core(); assert.equal(typeof q.step, 'function');
  for (const phase of ['explore', 'choose', 'demonstrate', 'review']) {
    const s = q.createState(); s.phase = phase; s.paused = phase === 'explore';
    s.path = [{ x: 400, y: 520 }]; s.destinationMissionId = 'care';
    const before = structuredClone(s);
    assert.deepEqual(q.step(s, { x: 1, y: 1, dash: true }, 10), { moved: false, arrivedMissionId: null });
    assert.deepEqual(s, before);
  }
});

test('manual movement slides along buildings without tunneling at huge dt', () => {
  const q = core(); assert.equal(typeof q.step, 'function');
  const s = q.createState(); s.x = 270; s.y = 650;
  q.step(s, { x: -1, y: 1 }, 0.05);
  assert.ok(s.y > 650); assert.ok(s.x > 267); assert.ok(q.canStand(s, s.x, s.y));
  s.x = 30; s.y = 200;
  for (let i = 0; i < 100; i++) {
    q.step(s, { x: 1, y: 0, dash: true }, 1e9);
    assert.ok(s.x < 33); assert.ok(q.canStand(s, s.x, s.y));
  }
});

test('manual movement stays inside padded world bounds and ignores invalid vectors', () => {
  const q = core(); assert.equal(typeof q.step, 'function');
  const s = q.createState(); s.x = 20; s.y = 20;
  for (let i = 0; i < 100; i++) q.step(s, { x: -1, y: -1, dash: true }, 0.05);
  assert.ok(s.x >= 12 && s.y >= 12); assert.ok(q.canStand(s, s.x, s.y));
  const before = structuredClone(s);
  for (const input of [{ x: NaN, y: 1 }, { x: 1, y: Infinity }, {}, null]) {
    assert.deepEqual(q.step(s, input, 0.05), { moved: false, arrivedMissionId: null });
    assert.deepEqual(s, before);
  }
});

function assertWalkablePath(q, s, endpoint) {
  assert.ok(s.path.length > 0);
  assert.deepEqual(s.path.at(-1), endpoint);
  let previous = { x: s.x, y: s.y };
  for (const point of s.path) {
    assert.ok(q.canStand(s, point.x, point.y));
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    const samples = Math.max(1, Math.ceil(distance));
    for (let i = 0; i <= samples; i++) {
      assert.ok(q.canStand(s, previous.x + (point.x - previous.x) * i / samples,
        previous.y + (point.y - previous.y) * i / samples), 'route segment crosses an obstacle');
    }
    previous = point;
  }
  for (const point of s.path.slice(0, -1)) {
    assert.equal(point.x % 20, 0); assert.equal(point.y % 20, 0);
  }
}

test('goToMission creates a walkable grid20 BFS path to each exact mission point', () => {
  const q = core(); assert.equal(typeof q.goToMission, 'function');
  for (const mission of q.MISSIONS) {
    const s = q.createState();
    assert.equal(q.goToMission(s, mission.id), true);
    assert.equal(s.destinationMissionId, mission.id); assert.equal(s.phase, 'explore');
    assert.equal(s.missionId, null); assert.deepEqual(s.completed, []);
    assertWalkablePath(q, s, { x: mission.x, y: mission.y });
  }
});

test('goToMission rejects unknown IDs and non-explore phases without mutation', () => {
  const q = core(); assert.equal(typeof q.goToMission, 'function');
  const s = q.createState(); const before = structuredClone(s);
  assert.equal(q.goToMission(s, 'no-such-mission'), false); assert.deepEqual(s, before);
  q.selectMission(s, 'commute'); const active = structuredClone(s);
  assert.equal(q.goToMission(s, 'care'), false); assert.deepEqual(s, active);
});

test('setDestination routes floor taps exactly and clears mission arrival intent', () => {
  const q = core(); assert.equal(typeof q.setDestination, 'function');
  const s = q.createState(); q.goToMission(s, 'commute');
  assert.equal(q.setDestination(s, 145.5, 950.25), true);
  assert.equal(s.destinationMissionId, null);
  assertWalkablePath(q, s, { x: 145.5, y: 950.25 });
  assert.equal(s.phase, 'explore');
});

test('setDestination rejects blocked out-of-bounds and nonfinite endpoints atomically', () => {
  const q = core(); assert.equal(typeof q.setDestination, 'function');
  const s = q.createState(); q.goToMission(s, 'care'); const before = structuredClone(s);
  for (const p of [[100, 200], [33, 200], [0, 0], [600, 1080], [300, NaN], [Infinity, 350], ['300', 350]]) {
    assert.equal(q.setDestination(s, ...p), false); assert.deepEqual(s, before);
  }
  s.phase = 'choose'; const active = structuredClone(s);
  assert.equal(q.setDestination(s, 300, 400), false); assert.deepEqual(s, active);
});

test('setDestination connects walkable off-grid corner and boundary endpoints safely', () => {
  const q = core(); assert.equal(typeof q.setDestination, 'function');
  for (const endpoint of [{ x: 12, y: 12 }, { x: 588, y: 1068 },
    { x: 32.999, y: 200 }, { x: 267.001, y: 282.001 }]) {
    const s = q.createState();
    assert.equal(q.setDestination(s, endpoint.x, endpoint.y), true);
    assertWalkablePath(q, s, endpoint);
  }
  const blocked = q.createState(); blocked.x = 100; blocked.y = 200;
  assert.equal(q.setDestination(blocked, 300, 400), false);
});

function runRoute(q, s, input = {}) {
  const arrivals = [];
  for (let i = 0; i < 3000 && s.path.length; i++) {
    const result = q.step(s, input, 1 / 60);
    assert.deepEqual(Object.keys(result).sort(), ['arrivedMissionId', 'moved']);
    assert.ok(q.canStand(s, s.x, s.y), 'autowalk crossed collision boundary');
    if (result.arrivedMissionId !== null) arrivals.push(result.arrivedMissionId);
  }
  assert.deepEqual(s.path, [], 'autowalk never finished');
  return arrivals;
}

test('autowalk reaches all three exact endpoints with one arrival and never selects a mission', () => {
  const q = core();
  for (const mission of q.MISSIONS) {
    const s = q.createState(); q.goToMission(s, mission.id);
    assert.deepEqual(runRoute(q, s), [mission.id]);
    assert.equal(s.x, mission.x); assert.equal(s.y, mission.y);
    assert.equal(s.destinationMissionId, null); assert.equal(s.phase, 'explore');
    assert.equal(s.missionId, null); assert.deepEqual(s.completed, []);
    for (let i = 0; i < 5; i++) {
      assert.deepEqual(q.step(s, {}, 0.05), { moved: false, arrivedMissionId: null });
    }
  }
});

test('goToMission at the existing exact endpoint emits arrival once per revisit', () => {
  const q = core();
  for (const mission of q.MISSIONS) {
    const s = q.createState(); s.x = mission.x; s.y = mission.y;
    for (let i = 0; i < 2; i++) {
      assert.equal(q.goToMission(s, mission.id), true);
      assert.deepEqual(q.step(s, {}, 0.05), { moved: false, arrivedMissionId: mission.id });
      assert.deepEqual(s.path, []); assert.equal(s.destinationMissionId, null);
      assert.deepEqual(q.step(s, {}, 0.05), { moved: false, arrivedMissionId: null });
    }
  }
});

test('autowalk floor tap finishes exactly without inventing a mission arrival', () => {
  const q = core(); const s = q.createState();
  assert.equal(q.setDestination(s, 145.5, 950.25), true);
  assert.deepEqual(runRoute(q, s, { dash: true }), []);
  assert.equal(s.x, 145.5); assert.equal(s.y, 950.25);
  assert.equal(s.destinationMissionId, null);
});

test('nonzero manual input cancels autowalk even when blocked by a building', () => {
  const q = core(); const s = q.createState();
  q.goToMission(s, 'care');
  q.step(s, { x: -0.5, y: 0 }, 0.05);
  assert.deepEqual(s.path, []); assert.equal(s.destinationMissionId, null);
  assert.ok(s.x < 300); assert.equal(s.y, 520);
  s.x = 32.9; s.y = 200; q.goToMission(s, 'commute');
  q.step(s, { x: 1, y: 0 }, 0.05);
  assert.deepEqual(s.path, []); assert.equal(s.destinationMissionId, null);
  assert.ok(s.x < 33);
});

test('resetPosition restores spawn and exploration while retaining completed understanding', () => {
  const q = core(); assert.equal(typeof q.resetPosition, 'function');
  const s = q.createState(); s.completed = ['commute', 'care'];
  const progress = s.completed;
  s.x = 145; s.y = 830; s.phase = 'review'; s.missionId = 'care';
  s.selectedPolicyId = 'senior-care-single-window'; s.paused = true;
  s.path = [{ x: 400, y: 400 }]; s.destinationMissionId = 'childcare'; s.dashRemaining = 1;
  q.resetPosition(s);
  assert.deepEqual(s, { ...q.createState(), completed: ['commute', 'care'] });
  assert.equal(s.completed, progress); assert.ok(q.canStand(s, s.x, s.y));
});

test('manual input cancels the route even when the current frame has zero elapsed time', () => {
  const q = core(); const s = q.createState(); q.goToMission(s, 'care');
  assert.deepEqual(q.step(s, { x: 1, y: 0 }, 0), { moved: false, arrivedMissionId: null });
  assert.deepEqual(s.path, []); assert.equal(s.destinationMissionId, null);
  assert.equal(s.x, 300); assert.equal(s.y, 520);
});

const expectedMissions = [
  { id: 'commute', label: '通勤卡關', x: 145, y: 350, policyIds: ['transport-public-transit', 'transport-smart-roads'], scenario: '趕著上班，卻不知道公車何時來、轉乘能否接上。' },
  { id: 'childcare', label: '臨托難找', x: 455, y: 350, policyIds: ['parenting-childcare', 'parenting-family-support'], scenario: '臨時有事需要托育，卻不知道附近資源怎麼找。' },
  { id: 'care', label: '照護迷路', x: 145, y: 830, policyIds: ['senior-care-single-window'], scenario: '家人需要照護，卻在不同窗口之間來回詢問。' }
];

test('exports exactly the three specified fictional scenario records in Node', () => {
  assert.deepEqual(core().MISSIONS, expectedMissions);
});

test('UMD exposes QuestCore on window without Node or DOM dependencies', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), window);
  assert.deepEqual(JSON.parse(JSON.stringify(window.QuestCore.MISSIONS)), expectedMissions);
});

test('createState returns the exact independent initial state', () => {
  const q = core();
  assert.equal(typeof q.createState, 'function');
  const a = q.createState();
  const b = q.createState();
  assert.deepEqual(a, { x: 300, y: 520, phase: 'explore', missionId: null,
    selectedPolicyId: null, completed: [], paused: false, path: [],
    destinationMissionId: null, dashRemaining: 0 });
  a.completed.push('commute'); a.path.push({ x: 20, y: 20 });
  assert.deepEqual(b.completed, []); assert.deepEqual(b.path, []);
});

test('selectMission enters choose and cancels navigation for a known mission', () => {
  const q = core(); assert.equal(typeof q.selectMission, 'function');
  const s = q.createState(); s.path = [{ x: 400, y: 400 }];
  s.destinationMissionId = 'care'; s.selectedPolicyId = 'old';
  assert.equal(q.selectMission(s, 'commute'), true);
  assert.equal(s.phase, 'choose'); assert.equal(s.missionId, 'commute');
  assert.equal(s.selectedPolicyId, null); assert.deepEqual(s.path, []);
  assert.equal(s.destinationMissionId, null); assert.deepEqual(s.completed, []);
});

test('selectMission rejects unknown IDs without changing state', () => {
  const q = core(); assert.equal(typeof q.selectMission, 'function');
  const s = q.createState(); const before = structuredClone(s);
  for (const id of ['unknown', '__proto__', null, 0, {}]) {
    assert.equal(q.selectMission(s, id), false); assert.deepEqual(s, before);
  }
});

test('choosePolicy permits only the current mission policy IDs in choose phase', () => {
  const q = core(); assert.equal(typeof q.choosePolicy, 'function');
  const s = q.createState();
  assert.equal(q.choosePolicy(s, 'transport-public-transit'), false);
  q.selectMission(s, 'commute');
  for (const id of [null, 'made-up', 'parenting-childcare', '__proto__']) {
    assert.equal(q.choosePolicy(s, id), false); assert.equal(s.selectedPolicyId, null);
  }
  for (const id of expectedMissions[0].policyIds) {
    assert.equal(q.choosePolicy(s, id), true); assert.equal(s.selectedPolicyId, id);
    assert.equal(s.phase, 'choose'); assert.deepEqual(s.completed, []);
  }
  s.phase = 'demonstrate';
  assert.equal(q.choosePolicy(s, 'transport-public-transit'), false);
});

test('activatePolicy requires choose and a valid selected policy, never completes', () => {
  const q = core(); assert.equal(typeof q.activatePolicy, 'function');
  const s = q.createState();
  assert.equal(q.activatePolicy(s), false);
  q.selectMission(s, 'commute'); assert.equal(q.activatePolicy(s), false);
  s.selectedPolicyId = 'parenting-childcare'; assert.equal(q.activatePolicy(s), false);
  q.choosePolicy(s, 'transport-public-transit');
  assert.equal(q.activatePolicy(s), true); assert.equal(s.phase, 'demonstrate');
  assert.deepEqual(s.completed, []); assert.equal(q.activatePolicy(s), false);
});
