import {
  clampStats,
  EVENTS_PER_RUN,
  WEEKS_PER_SEMESTER,
  TOTAL_SEMESTERS,
  getAttributeThresholdsForDifficulty,
  getDifficultyTuning,
  getEndingStatAdjust,
  HARSH_ENDING_IDS,
} from '../../config/v1/rules.js';

/**
 * @param {Record<string, number>} stats
 * @param {Record<string, number>} effects
 */
export function applyEffects(stats, effects) {
  const next = { ...stats };
  Object.entries(effects || {}).forEach(([key, delta]) => {
    if (next[key] !== undefined && typeof delta === 'number') {
      next[key] += delta;
    }
  });
  return clampStats(next);
}

/**
 * 数值平滑处理：将所有效果数值按比例缩放，使游戏曲线更平滑
 * @param {Record<string, number>} effects - 原始效果
 * @param {number} scale - 缩放比例（默认0.6，即缩减40%）
 * @returns {Record<string, number>} - 平滑后的效果
 */
export function smoothEffects(effects, scale = 0.6) {
  if (!effects || typeof effects !== 'object') return effects;
  
  const smoothed = {};
  Object.entries(effects).forEach(([key, value]) => {
    if (typeof value === 'number') {
      // 特殊处理GPA，保持更高精度
      if (key === 'gpa') {
        smoothed[key] = Math.round(value * scale * 1000) / 1000;
      } else {
        // 其他数值四舍五入到整数
        smoothed[key] = Math.round(value * scale);
      }
    } else {
      smoothed[key] = value;
    }
  });
  
  return smoothed;
}

/**
 * 应用平滑后的效果
 * @param {Record<string, number>} stats
 * @param {Record<string, number>} effects
 * @param {number} scale - 缩放比例
 */
export function applySmoothedEffects(stats, effects, scale = 0.6) {
  const smoothedEffects = smoothEffects(effects, scale);
  return applyEffects(stats, smoothedEffects);
}

/**
 * 按难度缩放单次效果（负面额外乘 negativeMult），再写入 stats。
 * @param {Record<string, number>} stats
 * @param {Record<string, number>} effects
 * @param {{ difficulty?: string }} runState
 */
export function applySmoothedEffectsForRun(stats, effects, runState) {
  return applyEffects(stats, scaleEffectsForDifficulty(effects, runState));
}

/**
 * @param {Record<string, number>} effects
 * @param {{ difficulty?: string }} runState
 * @returns {Record<string, number>}
 */
export function scaleEffectsForDifficulty(effects, runState) {
  const tuning = getDifficultyTuning(runState && runState.difficulty);
  const scale = tuning.effectScale;
  const negMult = tuning.negativeMult ?? 1;
  if (!effects || typeof effects !== 'object') return {};
  const out = {};
  Object.entries(effects).forEach(([key, value]) => {
    if (typeof value !== 'number') {
      out[key] = value;
      return;
    }
    if (key === 'gpa') {
      let v = Math.round(value * scale * 1000) / 1000;
      if (v < 0) v *= negMult;
      out[key] = v;
    } else {
      let v = Math.round(value * scale);
      if (v < 0) v *= negMult;
      out[key] = v;
    }
  });
  return out;
}

/**
 * @param {{ stats: Record<string, number>, turn: number }} runState
 * @param {{ all?: Array<{ stat: string, gte?: number, lte?: number, eq?: number }> }} condRoot
 */
function evalConditions(runState, condRoot) {
  if (!condRoot || !condRoot.all) return true;
  return condRoot.all.every((c) => {
    if (c.semesterGte !== undefined && runState.semesterIndex + 1 < c.semesterGte) return false;
    if (c.semesterLte !== undefined && runState.semesterIndex + 1 > c.semesterLte) return false;
    if (c.weekGte !== undefined && runState.weekIndex + 1 < c.weekGte) return false;
    if (c.weekLte !== undefined && runState.weekIndex + 1 > c.weekLte) return false;
    if (c.school !== undefined && runState.schoolId !== c.school) return false;
    if (c.major !== undefined && runState.majorId !== c.major) return false;
    if (c.flag) {
      const fv = runState.flags ? runState.flags[c.flag] : undefined;
      if (c.eq !== undefined) return fv === c.eq;
      if (c.gte !== undefined) return Number(fv || 0) >= c.gte;
      if (c.lte !== undefined) return Number(fv || 0) <= c.lte;
      if (c.value !== undefined) return !!fv === !!c.value;
      return !!fv;
    }
    const v = runState.stats[c.stat];
    if (v === undefined) return false;
    if (c.eq !== undefined && v !== c.eq) return false;
    if (c.gte !== undefined && v < c.gte) return false;
    if (c.lte !== undefined && v > c.lte) return false;
    return true;
  });
}

export function applyChoiceOutcome(runState, choice) {
  const next = { ...runState };
  next.stats = applySmoothedEffectsForRun(runState.stats, choice.effects, runState);
  next.flags = { ...(runState.flags || {}) };
  const sem = (runState.semesterIndex || 0) + 1;
  if (Array.isArray(choice.setFlags)) {
    choice.setFlags.forEach((flagName) => {
      if (flagName === 'internshipReady' && sem < 5) return;
      next.flags[flagName] = true;
    });
    if (choice.setFlags.includes('internshipReady') && sem >= 5) {
      next.flags.careerBigTech = true;
    }
  }
  if (choice.clearFlags && Array.isArray(choice.clearFlags)) {
    choice.clearFlags.forEach((flagName) => {
      delete next.flags[flagName];
    });
  }
  if (choice.addFlags && typeof choice.addFlags === 'object') {
    Object.entries(choice.addFlags).forEach(([flagName, delta]) => {
      const cur = Number(next.flags[flagName] || 0);
      next.flags[flagName] = cur + Number(delta || 0);
    });
  }
  next.lastAttributeEffects = [];
  const th = getAttributeThresholdsForDifficulty(runState.difficulty);
  if (next.stats.pressure >= th.pressureHigh) {
    next.stats = clampStats({ ...next.stats, health: next.stats.health - 1 });
    next.lastAttributeEffects.push('压力过高，额外健康 -1');
  }
  if (next.stats.health <= th.healthLow) {
    next.stats = clampStats({ ...next.stats, pressure: next.stats.pressure + 2 });
    next.lastAttributeEffects.push('健康偏低，额外压力 +2');
  }
  return next;
}

function basePoolFilter(runState, catalog) {
  const progressTurn = runState.semesterIndex * WEEKS_PER_SEMESTER + runState.weekIndex;
  const used = new Set(runState.usedEventIds || []);
  const maxProgress = TOTAL_SEMESTERS * WEEKS_PER_SEMESTER - 1;
  return catalog.filter((evt) => {
    if (used.has(evt.id)) return false;
    let minT = evt.minTurn !== undefined ? evt.minTurn : 0;
    let maxT = evt.maxTurn !== undefined ? evt.maxTurn : EVENTS_PER_RUN * WEEKS_PER_SEMESTER - 1;
    // 兼容旧 0..11 节点写法：按总进度线性映射到周行动进度
    if (maxT <= 11) {
      const scale = maxProgress / 11;
      minT = Math.floor(minT * scale);
      maxT = Math.floor(maxT * scale);
    }
    if (progressTurn < minT || progressTurn > maxT) return false;
    if (evt.semesterGte !== undefined && runState.semesterIndex + 1 < evt.semesterGte) return false;
    if (evt.semesterLte !== undefined && runState.semesterIndex + 1 > evt.semesterLte) return false;
    if (Array.isArray(evt.schoolScopes) && evt.schoolScopes.length > 0 && !evt.schoolScopes.includes(runState.schoolId)) return false;
    if (Array.isArray(evt.majorScopes) && evt.majorScopes.length > 0 && !evt.majorScopes.includes(runState.majorId)) return false;
    return evalConditions(runState, evt.conditions);
  });
}

function weightedPick(pool) {
  if (!pool.length) return null;
  const total = pool.reduce((s, e) => s + (e.weight || 1), 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= pool[i].weight || 1;
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function applyAttributeWeight(evt, stats) {
  let w = evt.weight || 1;
  const tags = evt.tags || [];
  if (stats.pressure >= getAttributeThresholdsForDifficulty().pressureHigh && tags.includes('life')) w *= 1.25;
  if (stats.social >= getAttributeThresholdsForDifficulty().socialHigh && (tags.includes('social') || tags.includes('career'))) w *= 1.2;
  if (stats.money <= getAttributeThresholdsForDifficulty().moneyLow && tags.includes('money')) w *= 1.3;
  return { ...evt, _effectiveWeight: w, weight: w };
}

function applyRelationshipWeight(evt, runState) {
  const relationships = (runState && runState.relationships) || {};
  const tags = evt.tags || [];
  let w = evt.weight || 1;
  const mentor = Number(relationships.mentor || 40);
  const roommate = Number(relationships.roommate || 50);
  const partner = Number(relationships.partner || 30);
  const primaryMid =
    runState && runState.npcRoster && runState.npcRoster.primaryMentor
      ? runState.npcRoster.primaryMentor
      : null;
  const partnerId = runState && runState.npcRoster && runState.npcRoster.partner ? runState.npcRoster.partner : null;
  const affMap = (runState && runState.npcAffinity) || {};

  if ((tags.includes('research') || tags.includes('academic')) && mentor >= 60) w *= 1.2;
  if (tags.includes('life') && roommate <= 35) w *= 1.2;
  if (tags.includes('romance') && partner >= 60) w *= 1.2;

  const npcRef = evt.npcRef;
  if (npcRef && affMap[npcRef] !== undefined) {
    const aff = Number(affMap[npcRef] ?? 50);
    w *= 1 + Math.max(-0.08, Math.min(0.12, (aff - 50) * 0.0025));
    if (primaryMid && npcRef === primaryMid && (tags.includes('research') || tags.includes('academic'))) {
      w *= 1.06;
    }
    if (partnerId && npcRef === partnerId && tags.includes('romance')) {
      w *= 1.08;
    }
  }

  const semNo = (runState && runState.semesterIndex != null ? runState.semesterIndex : 0) + 1;
  if (semNo >= 5) w *= 1.03;

  return { ...evt, _effectiveWeight: w, weight: w };
}

/**
 * @param {object} runState
 * @param {object[]} catalog
 * @returns {object|null}
 */
export function pickNextEvent(runState, catalog) {
  const pool = basePoolFilter(runState, catalog)
    .map((evt) => applyAttributeWeight(evt, runState.stats))
    .map((evt) => applyRelationshipWeight(evt, runState));
  return weightedPick(pool);
}

export function pickMainEvent(runState, catalog) {
  const pool = basePoolFilter(runState, catalog)
    .filter((evt) => (evt.layer || 'main') === 'main')
    .map((evt) => applyAttributeWeight(evt, runState.stats))
    .map((evt) => applyRelationshipWeight(evt, runState));
  return weightedPick(pool);
}

export function pickSideEvent(runState, catalog) {
  const pool = basePoolFilter(runState, catalog)
    .filter((evt) => (evt.layer || 'main') === 'side')
    .map((evt) => applyAttributeWeight(evt, runState.stats))
    .map((evt) => applyRelationshipWeight(evt, runState));
  return weightedPick(pool);
}

export function applyWeeklyAction(runState, action) {
  let next = applyChoiceOutcome(runState, action);
  if (action.relationshipEffects && typeof action.relationshipEffects === 'object') {
    next.relationships = { ...(next.relationships || {}) };
    Object.entries(action.relationshipEffects).forEach(([rid, delta]) => {
      const cur = Number(next.relationships[rid] || 0);
      next.relationships[rid] = Math.max(0, Math.min(100, cur + Number(delta || 0)));
    });
  }
  return next;
}

/** 近 N 周内已触发的突发事件 id，用于降权避免重复 */
const RANDOM_EVENT_REPEAT_WINDOW = 4;
const RANDOM_EVENT_REPEAT_WEIGHT = 0.1;

function buildRandomEventPool(runState, catalog) {
  const recent = Array.isArray(runState.recentRandomEventIds) ? runState.recentRandomEventIds : [];
  const recentSet = new Set(recent.slice(-RANDOM_EVENT_REPEAT_WINDOW));
  return (catalog || [])
    .filter((evt) => evalConditions(runState, evt.conditions))
    .map((evt) => {
      const baseP = Math.max(0.01, Number(evt.probability || 0.05));
      let weight = baseP * 100;
      if (recentSet.has(evt.id)) weight *= RANDOM_EVENT_REPEAT_WEIGHT;
      return { ...evt, weight };
    })
    .filter((e) => e.weight > 0);
}

export function triggerRandomEvent(runState, randomEventsCatalog) {
  const catalog = Array.isArray(randomEventsCatalog) ? randomEventsCatalog : [];
  const pool = buildRandomEventPool(runState, catalog);
  if (!pool.length) return runState;

  const aggregateP = 1 - pool.reduce(
    (acc, evt) => acc * (1 - Math.min(0.95, Number(evt.probability || 0))),
    1,
  );
  const triggerP = Math.min(0.4, Math.max(0.07, aggregateP * 0.82));
  if (Math.random() > triggerP) return runState;

  const picked = weightedPick(pool);
  if (!picked) return runState;

  const recent = Array.isArray(runState.recentRandomEventIds) ? runState.recentRandomEventIds : [];
  const nextRecent = [...recent, picked.id].slice(-8);

  return {
    ...runState,
    flags: { ...(runState.flags || {}) },
    recentRandomEventIds: nextRecent,
    lastRandomEvent: {
      id: picked.id,
      title: picked.title,
      description: picked.description,
      effects: { ...(picked.effects || {}) },
      responses: Array.isArray(picked.responses)
        ? picked.responses.map((r) => ({ ...(r || {}) }))
        : [],
    },
  };
}

export function applyStatusEffects(runState) {
  const next = { ...runState };
  const effects = Array.isArray(next.statusEffects) ? [...next.statusEffects] : [];
  let stats = { ...next.stats };
  const remain = [];
  effects.forEach((s) => {
    stats = applySmoothedEffectsForRun(stats, s.effects || {}, next);
    const left = Number(s.remainingWeeks || 0) - 1;
    if (left > 0) remain.push({ ...s, remainingWeeks: left });
  });
  next.stats = stats;
  next.statusEffects = remain;
  return next;
}

export function maybeGrantItem(runState, itemsCatalog) {
  if (Math.random() > 0.15) return runState;
  const pool = (itemsCatalog || []).filter(
    (it) =>
      it &&
      typeof it.id === 'string' &&
      it.id.startsWith('item_') &&
      typeof it.name === 'string' &&
      it.name.length > 0 &&
      (it.type === 'consumable' || it.type === 'status'),
  );
  if (!pool.length) return runState;
  const item = pool[Math.floor(Math.random() * pool.length)];
  const next = { ...runState };
  next.inventory = Array.isArray(next.inventory) ? [...next.inventory] : [];
  next.inventory.push(item.id);
  next.lastGainedItem = { ...item };
  return next;
}

/** 静默入包（不触发 lastGainedItem），用于商店批量结算 */
export function pushInventoryItem(runState, itemId) {
  const id = String(itemId || '');
  if (!id) return runState;
  const next = { ...runState };
  next.inventory = Array.isArray(next.inventory) ? [...next.inventory] : [];
  next.inventory.push(id);
  return next;
}

export function consumeInventoryEffects(runState, itemsCatalog) {
  const next = { ...runState };
  if (!Array.isArray(next.inventory) || !next.inventory.length) return next;
  const itemId = next.inventory.shift();
  const item = itemsCatalog.find((it) => it.id === itemId);
  if (!item) return next;
  next.lastUsedItem = item;
  next.stats = applySmoothedEffectsForRun(next.stats, item.effects || {}, next);
  if (item.type === 'status' && item.statusEffect) {
    next.statusEffects = Array.isArray(next.statusEffects) ? [...next.statusEffects] : [];
    next.statusEffects.push({
      id: item.statusEffect.id,
      effects: scaleEffectsForDifficulty(item.statusEffect.effects || {}, next),
      remainingWeeks: Number(item.statusEffect.durationWeeks || 1),
    });
  }
  return next;
}

export function useInventoryItem(runState, itemsCatalog, itemIndex = 0) {
  const next = { ...runState };
  if (!Array.isArray(next.inventory) || !next.inventory.length) return next;
  const idx = Math.max(0, Math.min(next.inventory.length - 1, Number(itemIndex || 0)));
  const [itemId] = next.inventory.splice(idx, 1);
  const item = itemsCatalog.find((it) => it.id === itemId);
  if (!item) return next;

  // 特殊处理：导师推荐信
  if (item.id === 'item_mentor_letter') {
    if (!(next.flags && next.flags.mentorUnlocked)) {
      // 未解锁导师关系时使用：解锁并提升关系值
      next.flags = { ...next.flags, mentorUnlocked: true };
      next.relationships = {
        ...next.relationships,
        mentor: (next.relationships?.mentor || 40) + 8,
      };
    }
  }

  next.lastUsedItem = item;
  next.stats = applySmoothedEffectsForRun(next.stats, item.effects || {}, next);
  if (item.type === 'status' && item.statusEffect) {
    next.statusEffects = Array.isArray(next.statusEffects) ? [...next.statusEffects] : [];
    next.statusEffects.push({
      id: item.statusEffect.id,
      effects: scaleEffectsForDifficulty(item.statusEffect.effects || {}, next),
      remainingWeeks: Number(item.statusEffect.durationWeeks || 1),
    });
  }
  return next;
}

/**
 * 结局条件（含难度对严苛结局的阈值修正）
 * @param {object} runState
 * @param {{ all?: Array }} condRoot
 * @param {string} endingId
 */
function evalEndingConditions(runState, condRoot, endingId) {
  if (!condRoot || !condRoot.all) return true;
  const diff = runState.difficulty || 'normal';
  const harsh = HARSH_ENDING_IDS.includes(endingId);
  const adj = harsh ? getEndingStatAdjust(diff) : { healthLte: 0, pressureGte: 0, gpaLte: 0, moneyLte: 0 };
  return condRoot.all.every((c) => {
    if (c.semesterGte !== undefined && runState.semesterIndex + 1 < c.semesterGte) return false;
    if (c.semesterLte !== undefined && runState.semesterIndex + 1 > c.semesterLte) return false;
    if (c.weekGte !== undefined && runState.weekIndex + 1 < c.weekGte) return false;
    if (c.weekLte !== undefined && runState.weekIndex + 1 > c.weekLte) return false;
    if (c.flag) {
      const fv = runState.flags ? runState.flags[c.flag] : undefined;
      if (c.eq !== undefined) return fv === c.eq;
      if (c.gte !== undefined) return Number(fv || 0) >= c.gte;
      if (c.lte !== undefined) return Number(fv || 0) <= c.lte;
      if (c.value !== undefined) return !!fv === !!c.value;
      return !!fv;
    }
    const v = runState.stats[c.stat];
    if (v === undefined) return false;
    let lte = c.lte;
    let gte = c.gte;
    if (harsh) {
      if (c.stat === 'health' && c.lte !== undefined) lte = c.lte + adj.healthLte;
      if (c.stat === 'pressure' && c.gte !== undefined) gte = c.gte + adj.pressureGte;
      if (c.stat === 'gpa' && c.lte !== undefined) lte = c.lte + adj.gpaLte;
      if (c.stat === 'money' && c.lte !== undefined) lte = c.lte + adj.moneyLte;
    }
    if (c.eq !== undefined && v !== c.eq) return false;
    if (lte !== undefined && v > lte) return false;
    if (gte !== undefined && v < gte) return false;
    return true;
  });
}

/**
 * 结局按 priority 降序，取第一个满足条件的
 * @param {object} runState
 * @param {object[]} endings
 */
export function resolveEnding(runState, endings, options = {}) {
  return resolveEndingWithDiversity(runState, endings, options);
}

/**
 * 根据候选评分 + 重复惩罚 + 随机扰动选择结局，避免单一路径长期重复。
 * @param {object} runState
 * @param {object[]} endings
 * @param {{ recentEndingIds?: string[] }} options
 */
export function resolveEndingWithDiversity(runState, endings, options = {}) {
  const sorted = [...endings].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const candidates = sorted.filter((ending) => evalEndingConditions(runState, ending.conditions, ending.id));
  if (!candidates.length) return sorted[sorted.length - 1];
  if (candidates.length === 1) return candidates[0];

  const recent = Array.isArray(options.recentEndingIds) ? options.recentEndingIds : [];
  const recentCount = recent.reduce((acc, id) => {
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});
  const latestEndingId = recent.length ? recent[recent.length - 1] : '';

  const scored = candidates.map((ending) => {
    const base = Math.max(1, Number(ending.priority || 0));
    const matchBonus = computeEndingMatchBonus(runState, ending);
    const repeatTimes = Number(recentCount[ending.id] || 0);
    const repeatPenalty = 1 / (1 + repeatTimes * 0.7);
    const immediatePenalty = latestEndingId && latestEndingId === ending.id ? 0.35 : 1;
    const jitter = 0.9 + Math.random() * 0.2;
    const score = Math.max(0.1, (base + matchBonus) * repeatPenalty * immediatePenalty * jitter);
    return { ending, score };
  });

  return weightedPick(
    scored.map((entry) => ({
      ...entry.ending,
      weight: entry.score,
    })),
  );
}

/**
 * 通过状态区间贴合度与条件密度计算候选评分加成。
 * @param {object} runState
 * @param {object} ending
 */
function computeEndingMatchBonus(runState, ending) {
  const all = ending && ending.conditions && Array.isArray(ending.conditions.all) ? ending.conditions.all : [];
  if (!all.length) return 0;
  let bonus = 0;
  all.forEach((cond) => {
    if (cond.flag) {
      bonus += 1.2;
      return;
    }
    const stat = cond.stat;
    if (!stat) return;
    const value = Number(runState && runState.stats ? runState.stats[stat] : 0);
    if (!Number.isFinite(value)) return;

    if (cond.eq !== undefined) {
      const dist = Math.abs(value - Number(cond.eq));
      bonus += Math.max(0, 1.4 - dist * 0.4);
      return;
    }

    if (cond.gte !== undefined && cond.lte !== undefined) {
      const minV = Number(cond.gte);
      const maxV = Number(cond.lte);
      const center = (minV + maxV) / 2;
      const halfRange = Math.max(1, (maxV - minV) / 2);
      const centerDist = Math.abs(value - center);
      bonus += Math.max(0, 2 - (centerDist / halfRange) * 1.2);
      return;
    }

    const threshold = cond.gte !== undefined ? Number(cond.gte) : Number(cond.lte);
    const delta = Math.abs(value - threshold);
    const smoothSpan = Math.max(6, Math.abs(threshold) * 0.18);
    bonus += Math.max(0, 1.6 - delta / smoothSpan);
  });
  return bonus;
}

export { evalConditions };

/** 事件池耗尽时的兜底 */
export function fallbackEvent(turn) {
  return {
    id: `fallback_${turn}`,
    tags: [],
    weight: 1,
    title: '平凡的学期',
    body: '没有特别的大事，你按计划上课、锻炼、偶尔放空。',
    choices: [
      { text: '保持稳定节奏', effects: { gpa: 0.05, health: 3, pressure: -2 } },
      { text: '加练一项技能', effects: { skill: 5, pressure: 3 } },
      { text: '多和同学走动', effects: { social: 6, money: -50 } },
    ],
  };
}
