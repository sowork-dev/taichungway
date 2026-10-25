/* Fictional, illustrative city scenarios, not claims about policy outcomes.
 * Pure local state only: completion records understanding, never endorsement.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.QuestCore = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MISSIONS = Object.freeze([
    { id: 'commute', topicId: 'smart-transport', zoneId: 'living', buildingLabel: '轉乘資訊站', label: '通勤卡關', x: 145, y: 350, policyIds: ['transport-public-transit', 'transport-smart-roads'], scenario: '趕著上班，卻不知道公車何時來、轉乘能否接上。' },
    { id: 'childcare', topicId: 'parenting', zoneId: 'living', buildingLabel: '親子交流所', label: '臨托難找', x: 455, y: 350, policyIds: ['parenting-childcare', 'parenting-family-support'], scenario: '臨時有事需要托育，卻不知道附近資源怎麼找。' },
    { id: 'care', topicId: 'senior-care', zoneId: 'living', buildingLabel: '照顧諮詢所', label: '照護迷路', x: 145, y: 830, policyIds: ['senior-care-single-window'], scenario: '家人需要照護，卻在不同窗口之間來回詢問。' }
  ].concat([
    ['exhibition-168', 'innovation', '會展交流館', '展場怎麼走', 745, 350, '虛構情境：第一次參加展覽，想先釐清場館位置與參觀動線。'],
    ['robot-city', 'innovation', '機器人探索館', '科技看不懂', 1055, 1310, '虛構情境：路過機器人展示，想了解這個主題在城市生活中討論什麼。'],
    ['culture-starlight', 'culture', '藝文交流館', '活動資訊散', 1345, 350, '虛構情境：想安排一場藝文小旅行，卻還沒找到適合的活動資訊。'],
    ['smart-agriculture', 'nature', '農業觀察所', '田間提問', 1945, 830, '虛構情境：走訪農田時聽到智慧農業，想先弄清楚有哪些議題。'],
    ['airport-gateway', 'connection', '空港問路站', '旅程接不上', 2545, 350, '虛構情境：準備前往機場，還在確認接駁資訊與行程安排。'],
    ['city-safety', 'connection', '安全觀察站', '街角不安心', 2855, 830, '虛構情境：夜間經過陌生街角，想知道城市安全議題可以從哪裡了解。'],
    ['twenty-minute-city', 'connection', '生活圈交流所', '日常路太繞', 2545, 1310, '虛構情境：買菜、就醫與休閒分在不同方向，想盤點日常生活的動線。'],
    ['new-residents', 'culture', '新住民交流館', '資訊有隔閡', 1655, 830, '虛構情境：新搬來的鄰居不熟悉在地資訊，想一起找到容易理解的說明。'],
    ['indigenous', 'culture', '原民文化交流館', '文化想認識', 1345, 1310, '虛構情境：想認識原住民族文化，卻不確定該從哪些在地議題開始。'],
    ['animal-welfare', 'nature', '動物關懷所', '遇見迷途動物', 2255, 1550, '虛構情境：散步遇到疑似走失的動物，想先理解動物照顧與通報的議題。'],
    ['hakka', 'culture', '客家文化交流館', '客庄初探', 1655, 1550, '虛構情境：想規劃客庄走讀，正在尋找文化背景與地方生活的入門資訊。'],
    ['education', 'connection', '學習交流館', '學習方向多', 2855, 1550, '虛構情境：家人想討論學習安排，卻還不清楚教育主題有哪些面向。']
  ].map(function (entry) {
    const [id, zoneId, buildingLabel, label, x, y, scenario] = entry;
    return { id, topicId: id, zoneId, buildingLabel, label, x, y, scenario,
      policyIds: ['archive-' + id + '-overview'] };
  }))
  .map(function (mission) {
    Object.freeze(mission.policyIds);
    return Object.freeze(mission);
  }));

  function createState() {
    return { x: 300, y: 520, phase: 'explore', missionId: null,
      selectedPolicyId: null, completed: [], paused: false, path: [],
      destinationMissionId: null, dashRemaining: 0 };
  }

  function missionById(id) {
    return MISSIONS.find(function (mission) { return mission.id === id; });
  }

  function clearNavigation(state) {
    state.path = [];
    state.destinationMissionId = null;
    state.dashRemaining = 0;
  }

  function selectMission(state, id) {
    if (!missionById(id)) return false;
    state.phase = 'choose';
    state.missionId = id;
    state.selectedPolicyId = null;
    clearNavigation(state);
    return true;
  }

  function choosePolicy(state, id) {
    const mission = missionById(state.missionId);
    if (state.phase !== 'choose' || !mission || !mission.policyIds.includes(id)) return false;
    state.selectedPolicyId = id;
    return true;
  }

  function activatePolicy(state) {
    const mission = missionById(state.missionId);
    if (state.phase !== 'choose' || !mission || !mission.policyIds.includes(state.selectedPolicyId)) return false;
    state.phase = 'demonstrate';
    return true;
  }

  function showReview(state) {
    if (state.phase !== 'demonstrate') return false;
    state.phase = 'review';
    return true;
  }

  function clearMission(state) {
    state.phase = 'explore';
    state.missionId = null;
    state.selectedPolicyId = null;
    clearNavigation(state);
  }

  function completeMission(state) {
    if (state.phase !== 'review' || !missionById(state.missionId)) return false;
    // This is a local understood marker, not agreement or policy approval.
    if (!state.completed.includes(state.missionId)) state.completed.push(state.missionId);
    clearMission(state);
    return true;
  }

  function closeMission(state) {
    clearMission(state);
    return true;
  }

  function normalizeVector(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
    const magnitude = Math.hypot(x, y);
    if (magnitude <= 1) return { x: x || 0, y: y || 0 };
    // Scale first so finite large inputs cannot overflow their length.
    const scale = Math.max(Math.abs(x), Math.abs(y));
    const sx = x / scale;
    const sy = y / scale;
    const length = Math.hypot(sx, sy);
    return { x: sx / length, y: sy / length };
  }

  const WORLD_WIDTH = 3000;
  const WORLD_HEIGHT = 1800;
  const ZONES = Object.freeze([
    ['living', '生活照顧', '#b9dec9'],
    ['innovation', '創新產業', '#bbd9ed'],
    ['culture', '文化共好', '#e4c9df'],
    ['nature', '山海永續', '#cbdcaa'],
    ['connection', '城市連結', '#ecd4b1']
  ].map(function (entry, i) {
    const [id, title, color] = entry;
    return Object.freeze({ id, title, x: i * 600, y: 0, w: 600, h: WORLD_HEIGHT, color,
      topicIds: Object.freeze(MISSIONS.filter(function (m) { return m.zoneId === id; })
        .map(function (m) { return m.topicId; })) });
  }));

  // Half-open rectangles give every in-world coordinate exactly one district.
  function getZone(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x >= WORLD_WIDTH ||
        y < 0 || y >= WORLD_HEIGHT) return null;
    return ZONES[Math.floor(x / 600)];
  }

  const PADDING = 12;
  const OBSTACLES = Object.freeze([
    { x: 45, y: 125, w: 210, h: 145 }, { x: 345, y: 125, w: 210, h: 145 },
    { x: 45, y: 610, w: 210, h: 135 }, { x: 345, y: 610, w: 210, h: 135 }
  ].concat(MISSIONS.slice(3).map(function (mission) {
    // An 80-unit open forecourt keeps the exact interaction point outside
    // the padded landmark; district-center boulevards remain uninterrupted.
    return { x: mission.x - 100, y: mission.y - 225, w: 200, h: 145,
      missionId: mission.id };
  })).map(Object.freeze));

  function canStand(state, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < PADDING ||
        x > WORLD_WIDTH - PADDING || y < PADDING || y > WORLD_HEIGHT - PADDING) return false;
    return !OBSTACLES.some(function (o) {
      return x >= o.x - PADDING && x <= o.x + o.w + PADDING &&
        y >= o.y - PADDING && y <= o.y + o.h + PADDING;
    });
  }

  function nearestMission(state, maxDistance = 100) {
    if (!Number.isFinite(state.x) || !Number.isFinite(state.y) ||
        !Number.isFinite(maxDistance) || maxDistance < 0) return null;
    let nearest = null;
    let distance = maxDistance;
    MISSIONS.forEach(function (mission) {
      const d = Math.hypot(state.x - mission.x, state.y - mission.y);
      if (d <= distance && (!nearest || d < distance)) {
        distance = d;
        nearest = mission;
      }
    });
    return nearest;
  }

  // Small independent axis steps allow wall sliding without crossing buildings.
  function moveBy(state, dx, dy) {
    const count = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    for (let i = 0; i < count; i++) {
      const x = state.x + dx / count;
      if (canStand(state, x, state.y)) state.x = x;
      const y = state.y + dy / count;
      if (canStand(state, state.x, y)) state.y = y;
    }
  }

  // input is { x, y, dash }; dt is elapsed seconds, not milliseconds.
  function step(state, input, dt) {
    const result = { moved: false, arrivedMissionId: null };
    if (state.paused || state.phase !== 'explore') return result;
    const seconds = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
    input = input || {};
    const direction = normalizeVector(input.x === undefined ? 0 : input.x,
      input.y === undefined ? 0 : input.y);
    if (direction.x || direction.y) clearNavigation(state);
    if (!seconds) return result;
    const startX = state.x;
    const startY = state.y;
    const speed = input.dash === true ? 340 : 180;
    if (direction.x || direction.y) {
      moveBy(state, direction.x * speed * seconds, direction.y * speed * seconds);
    } else if (state.path.length) {
      let remaining = speed * seconds;
      while (state.path.length && remaining > 0) {
        const target = state.path[0];
        if (!segmentClear(state, state, target)) {
          clearNavigation(state);
          break;
        }
        const dx = target.x - state.x;
        const dy = target.y - state.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= remaining) {
          // Snap only along a swept, collision-free segment to the exact endpoint.
          state.x = target.x;
          state.y = target.y;
          state.path.shift();
          remaining -= distance;
          if (!state.path.length) {
            result.arrivedMissionId = state.destinationMissionId;
            clearNavigation(state);
          }
        } else {
          state.x += dx / distance * remaining;
          state.y += dy / distance * remaining;
          remaining = 0;
        }
      }
    }
    result.moved = state.x !== startX || state.y !== startY;
    return result;
  }

  const GRID_SIZE = 20;
  const GRID_COLS = Math.floor((WORLD_WIDTH - PADDING) / GRID_SIZE);
  const GRID_ROWS = Math.floor((WORLD_HEIGHT - PADDING) / GRID_SIZE);

  // Exact segment/expanded-rectangle intersection also protects endpoint connectors.
  function segmentClear(state, a, b) {
    if (!canStand(state, a.x, a.y) || !canStand(state, b.x, b.y)) return false;
    return !OBSTACLES.some(function (o) {
      let enter = 0;
      let leave = 1;
      const axes = [
        [a.x, b.x - a.x, o.x - PADDING, o.x + o.w + PADDING],
        [a.y, b.y - a.y, o.y - PADDING, o.y + o.h + PADDING]
      ];
      for (const axis of axes) {
        const [origin, delta, low, high] = axis;
        if (delta === 0) {
          if (origin < low || origin > high) return false;
        } else {
          const first = (low - origin) / delta;
          const last = (high - origin) / delta;
          enter = Math.max(enter, Math.min(first, last));
          leave = Math.min(leave, Math.max(first, last));
          if (enter > leave) return false;
        }
      }
      return true;
    });
  }

  function gridPoint(index) {
    return { x: (index % GRID_COLS + 1) * GRID_SIZE,
      y: (Math.floor(index / GRID_COLS) + 1) * GRID_SIZE };
  }

  function nearestGridNode(state, point) {
    let nearest = -1;
    let distance = Infinity;
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      const candidate = gridPoint(i);
      const d = Math.hypot(point.x - candidate.x, point.y - candidate.y);
      if (d < distance && segmentClear(state, point, candidate)) {
        nearest = i;
        distance = d;
      }
    }
    return nearest;
  }

  function findPath(state, x, y) {
    if (!canStand(state, state.x, state.y) || !canStand(state, x, y)) return null;
    const endpoint = { x, y };
    if (state.x === x && state.y === y) return [endpoint];
    const start = nearestGridNode(state, state);
    const goal = nearestGridNode(state, endpoint);
    if (start < 0 || goal < 0) return null;
    const parents = new Int32Array(GRID_COLS * GRID_ROWS).fill(-2);
    parents[start] = -1;
    const queue = [start];
    for (let head = 0; head < queue.length && parents[goal] === -2; head++) {
      const current = queue[head];
      const col = current % GRID_COLS;
      const row = Math.floor(current / GRID_COLS);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;
        const next = nr * GRID_COLS + nc;
        if (parents[next] !== -2 || !segmentClear(state, gridPoint(current), gridPoint(next))) continue;
        parents[next] = current;
        queue.push(next);
      }
    }
    if (parents[goal] === -2) return null;
    const route = [];
    for (let current = goal; current !== -1; current = parents[current]) route.push(gridPoint(current));
    route.reverse();
    const last = route[route.length - 1];
    if (last.x !== x || last.y !== y) route.push(endpoint);
    return route;
  }

  function goToMission(state, id) {
    const mission = missionById(id);
    if (state.phase !== 'explore' || !mission) return false;
    const route = findPath(state, mission.x, mission.y);
    if (!route) return false;
    state.path = route;
    state.destinationMissionId = id;
    state.dashRemaining = 0;
    return true;
  }

  function setDestination(state, x, y) {
    if (state.phase !== 'explore') return false;
    const route = findPath(state, x, y);
    if (!route) return false;
    state.path = route;
    state.destinationMissionId = null;
    state.dashRemaining = 0;
    return true;
  }

  // Explicit fast travel is separate from walking and never emits an arrival.
  function travelToMission(state, id) {
    const mission = missionById(id);
    if (state.phase !== 'explore' || state.paused || !mission ||
        !canStand(state, mission.x, mission.y)) return false;
    state.x = mission.x;
    state.y = mission.y;
    clearNavigation(state);
    return true;
  }

  function resetPosition(state) {
    state.x = 300;
    state.y = 520;
    state.paused = false;
    clearMission(state);
    return true;
  }

  return { MISSIONS, ZONES, getZone, OBSTACLES, WORLD_WIDTH, WORLD_HEIGHT, GRID_SIZE, createState,
    selectMission, choosePolicy, activatePolicy, showReview, completeMission,
    closeMission, normalizeVector, canStand, nearestMission, step, goToMission,
    setDestination, travelToMission, resetPosition };
}));
