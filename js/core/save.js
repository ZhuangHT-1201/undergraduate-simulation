import {
  RULES_VERSION,
  EVENTS_PER_RUN,
  TOTAL_SEMESTERS,
  WEEKS_PER_SEMESTER,
  GOAL_SYSTEM_CONFIG,
  CORE_GOAL_TEMPLATES,
  DEFAULT_UNLOCKED_SCHOOLS,
  DEFAULT_UNLOCKED_MAJORS,
  UNLOCK_RULES,
  buildSchoolMajorMeta,
} from '../../config/v1/rules.js';

const KEY_RUN = 'undergrad_sim_run_v4';
const KEY_META = 'undergrad_sim_meta_v4';
const KEY_RUN_V2 = 'undergrad_sim_run_v2';
const KEY_META_V2 = 'undergrad_sim_meta_v2';
const KEY_RUN_V1 = 'undergrad_sim_run_v1';
const KEY_META_V1 = 'undergrad_sim_meta_v1';

function createDefaultMeta() {
  return {
    unlockedEndings: [],
    playCount: 0,
    rulesVersion: RULES_VERSION,
    unlockedSchools: [...DEFAULT_UNLOCKED_SCHOOLS],
    unlockedMajors: [...DEFAULT_UNLOCKED_MAJORS],
    achievements: {},
    statsLifetime: { totalRuns: 0, totalChoices: 0 },
    playerProfile: { name: '同学', gender: 'male' },
    audioPrefs: { muted: false, volume: 0.6 },
    themeMode: 'dark',
    recentEndingIds: [],
    endingUnlockOrder: [],
    achievementUnlockOrder: [],
    unlockedCgs: [],
    cgUnlockOrder: [],
    unlockedBgms: ['bgm_main_theme'],
  };
}

function normalizeMeta(parsed) {
  const base = createDefaultMeta();
  const out = { ...base, ...(parsed || {}) };
  out.unlockedEndings = Array.isArray(out.unlockedEndings) ? out.unlockedEndings : [];
  out.unlockedSchools = Array.isArray(out.unlockedSchools)
    ? Array.from(new Set([...DEFAULT_UNLOCKED_SCHOOLS, ...out.unlockedSchools]))
    : [...DEFAULT_UNLOCKED_SCHOOLS];
  out.unlockedMajors = Array.isArray(out.unlockedMajors)
    ? Array.from(new Set([...DEFAULT_UNLOCKED_MAJORS, ...out.unlockedMajors]))
    : [...DEFAULT_UNLOCKED_MAJORS];
  out.achievements = out.achievements && typeof out.achievements === 'object' ? out.achievements : {};
  out.statsLifetime = out.statsLifetime && typeof out.statsLifetime === 'object'
    ? out.statsLifetime
    : { totalRuns: 0, totalChoices: 0 };
  out.playerProfile = out.playerProfile && typeof out.playerProfile === 'object'
    ? out.playerProfile
    : { name: '同学', gender: 'male' };
  out.audioPrefs = out.audioPrefs && typeof out.audioPrefs === 'object'
    ? out.audioPrefs
    : { muted: false, volume: 0.6 };
  out.themeMode = out.themeMode === 'light' ? 'light' : 'dark';
  out.recentEndingIds = Array.isArray(out.recentEndingIds)
    ? out.recentEndingIds.filter((id) => typeof id === 'string').slice(-12)
    : [];
  out.endingUnlockOrder = Array.isArray(out.endingUnlockOrder)
    ? out.endingUnlockOrder.filter((it) => it && typeof it.id === 'string')
    : [];
  out.achievementUnlockOrder = Array.isArray(out.achievementUnlockOrder)
    ? out.achievementUnlockOrder.filter((it) => it && typeof it.id === 'string')
    : [];
  out.unlockedCgs = Array.isArray(out.unlockedCgs) ? out.unlockedCgs.filter((id) => typeof id === 'string') : [];
  out.cgUnlockOrder = Array.isArray(out.cgUnlockOrder)
    ? out.cgUnlockOrder.filter((it) => it && typeof it.id === 'string')
    : [];
  out.unlockedBgms = Array.isArray(out.unlockedBgms)
    ? Array.from(new Set(out.unlockedBgms.filter((id) => typeof id === 'string')))
    : ['bgm_main_theme'];
  out.rulesVersion = RULES_VERSION;
  return out;
}

function shouldUnlock(rule, meta) {
  if (!rule || typeof rule !== 'object') return true;
  if (Array.isArray(rule.any)) {
    return rule.any.some((sub) => shouldUnlock(sub, meta));
  }
  if (rule.playCount !== undefined && meta.playCount < rule.playCount) return false;
  if (rule.achievement && !meta.achievements[rule.achievement]) return false;
  if (rule.ending && !meta.unlockedEndings.includes(rule.ending)) return false;
  return true;
}

function applyUnlocks(meta) {
  const out = normalizeMeta(meta);
  Object.entries(UNLOCK_RULES.schools).forEach(([schoolId, rule]) => {
    if (shouldUnlock(rule, out) && !out.unlockedSchools.includes(schoolId)) out.unlockedSchools.push(schoolId);
  });
  Object.entries(UNLOCK_RULES.majors).forEach(([majorId, rule]) => {
    if (shouldUnlock(rule, out) && !out.unlockedMajors.includes(majorId)) out.unlockedMajors.push(majorId);
  });
  return out;
}

function normalizeRunGoals(run) {
  const baseGoal = CORE_GOAL_TEMPLATES[0] || { id: 'core_academic', title: '学术进阶', desc: '稳步推进毕业目标。' };
  if (!run.goals || typeof run.goals !== 'object') {
    run.goals = {
      coreGoalId: baseGoal.id,
      coreGoalTitle: baseGoal.title,
      coreGoalDesc: baseGoal.desc,
      semesterGoals: [],
      currentWeekGoal: null,
      completedWeekGoals: [],
      feedbackQueue: [],
    };
    return;
  }
  run.goals.coreGoalId = run.goals.coreGoalId || baseGoal.id;
  run.goals.coreGoalTitle = run.goals.coreGoalTitle || baseGoal.title;
  run.goals.coreGoalDesc = run.goals.coreGoalDesc || baseGoal.desc;
  run.goals.semesterGoals = Array.isArray(run.goals.semesterGoals) ? run.goals.semesterGoals : [];
  run.goals.currentWeekGoal = run.goals.currentWeekGoal || null;
  run.goals.completedWeekGoals = Array.isArray(run.goals.completedWeekGoals) ? run.goals.completedWeekGoals : [];
  run.goals.feedbackQueue = Array.isArray(run.goals.feedbackQueue) ? run.goals.feedbackQueue : [];
}

export function loadMeta() {
  try {
    const raw = wx.getStorageSync(KEY_META) || wx.getStorageSync(KEY_META_V2) || wx.getStorageSync(KEY_META_V1);
    if (!raw) return createDefaultMeta();
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return applyUnlocks(parsed);
  } catch (e) {
    return createDefaultMeta();
  }
}

export function saveMeta(meta) {
  const normalized = applyUnlocks(meta);
  wx.setStorageSync(KEY_META, normalized);
}

export function getNewUnlocks(previousMeta, nextMeta) {
  return {
    newSchools: nextMeta.unlockedSchools.filter((id) => !previousMeta.unlockedSchools.includes(id)),
    newMajors: nextMeta.unlockedMajors.filter((id) => !previousMeta.unlockedMajors.includes(id)),
  };
}

export function unlockEnding(endingId) {
  const meta = loadMeta();
  if (!meta.unlockedEndings.includes(endingId)) {
    meta.unlockedEndings.push(endingId);
    const ts = Date.now();
    meta.endingUnlockOrder = Array.isArray(meta.endingUnlockOrder) ? meta.endingUnlockOrder : [];
    meta.endingUnlockOrder = meta.endingUnlockOrder.filter((it) => it.id !== endingId);
    meta.endingUnlockOrder.push({ id: endingId, ts });
    saveMeta(meta);
  }
}

export function incrementPlayCount() {
  const meta = loadMeta();
  meta.playCount += 1;
  meta.statsLifetime.totalRuns = (meta.statsLifetime.totalRuns || 0) + 1;
  saveMeta(meta);
}

export function addChoiceCount(count) {
  const meta = loadMeta();
  meta.statsLifetime.totalChoices = (meta.statsLifetime.totalChoices || 0) + count;
  saveMeta(meta);
}

export function pushRecentEnding(endingId) {
  if (!endingId) return;
  const meta = loadMeta();
  const list = Array.isArray(meta.recentEndingIds) ? [...meta.recentEndingIds] : [];
  list.push(endingId);
  meta.recentEndingIds = list.slice(-12);
  saveMeta(meta);
}

export function unlockAchievement(achievementId) {
  const meta = loadMeta();
  if (meta.achievements[achievementId]) return false;
  meta.achievements[achievementId] = true;
  const ts = Date.now();
  meta.achievementUnlockOrder = Array.isArray(meta.achievementUnlockOrder) ? meta.achievementUnlockOrder : [];
  meta.achievementUnlockOrder = meta.achievementUnlockOrder.filter((it) => it.id !== achievementId);
  meta.achievementUnlockOrder.push({ id: achievementId, ts });
  saveMeta(meta);
  return true;
}

export function unlockCg(cgId) {
  const id = String(cgId || '');
  if (!id) return false;
  const meta = loadMeta();
  if (Array.isArray(meta.unlockedCgs) && meta.unlockedCgs.includes(id)) return false;
  meta.unlockedCgs = Array.isArray(meta.unlockedCgs) ? [...meta.unlockedCgs, id] : [id];
  const ts = Date.now();
  meta.cgUnlockOrder = Array.isArray(meta.cgUnlockOrder) ? meta.cgUnlockOrder.filter((it) => it.id !== id) : [];
  meta.cgUnlockOrder.push({ id, ts });
  saveMeta(meta);
  return true;
}

export function unlockBgm(trackId) {
  const id = String(trackId || '');
  if (!id) return false;
  const meta = loadMeta();
  meta.unlockedBgms = Array.isArray(meta.unlockedBgms) ? meta.unlockedBgms : [];
  if (meta.unlockedBgms.includes(id)) return false;
  meta.unlockedBgms.push(id);
  saveMeta(meta);
  return true;
}

export function loadRun() {
  try {
    const raw = wx.getStorageSync(KEY_RUN) || wx.getStorageSync(KEY_RUN_V2) || wx.getStorageSync(KEY_RUN_V1);
    if (!raw) return null;
    const run = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!run.flags || typeof run.flags !== 'object') run.flags = {};
    if (!Array.isArray(run.inventory)) run.inventory = [];
    if (!Array.isArray(run.statusEffects)) run.statusEffects = [];
    if (!run.relationships || typeof run.relationships !== 'object') {
      run.relationships = { roommate: 50, mentor: 40, partner: 30, senior: 45 };
    }
    if (!run.npcRoster || typeof run.npcRoster !== 'object') {
      run.npcRoster = {
        roommates: [],
        mentors: [],
        romanceCandidates: [],
        seniors: [],
        primaryMentor: null,
        partner: null,
      };
    }
    if (!run.npcAffinity || typeof run.npcAffinity !== 'object') run.npcAffinity = {};
    if (!run.npcLastInteraction || typeof run.npcLastInteraction !== 'object') run.npcLastInteraction = {};
    if (!run.npcEventHits || typeof run.npcEventHits !== 'object') run.npcEventHits = {};
    run.triggeredCgIds = Array.isArray(run.triggeredCgIds)
      ? run.triggeredCgIds.filter((id) => typeof id === 'string')
      : [];
    if (run.schoolId && run.majorId) {
      run.schoolMajorMeta = buildSchoolMajorMeta(run.schoolId, run.majorId);
    } else if (!run.schoolMajorMeta || typeof run.schoolMajorMeta !== 'object') {
      run.schoolMajorMeta = { isCoreMajor: true, isCrossMajor: false, courseIntensity: 1, internshipLean: 1 };
    }
    const okDiff = run.difficulty === 'easy' || run.difficulty === 'normal' || run.difficulty === 'hard';
    if (!okDiff) run.difficulty = 'normal';
    if (run.semesterIndex === undefined) {
      const oldTurn = Number(run.turn || 0);
      run.semesterIndex = Math.max(0, Math.min(TOTAL_SEMESTERS - 1, oldTurn));
      run.weekIndex = 0;
      run.phase = 'main_event';
      run.actionSlotsLeft = WEEKS_PER_SEMESTER;
      run.pendingMainEvent = run.pendingEvent || null;
      run.pendingSideEvent = null;
      run.playerProfile = run.playerProfile || { name: '同学', gender: 'male' };
    }
    if (!Number.isFinite(Number(run.actionSlotsLeft)) || Number(run.actionSlotsLeft) <= 0) {
      run.actionSlotsLeft = WEEKS_PER_SEMESTER;
    }
    run.weeksPerSemester = Number(run.weeksPerSemester || WEEKS_PER_SEMESTER);
    run.goalConfig = run.goalConfig && typeof run.goalConfig === 'object'
      ? run.goalConfig
      : { semesterGoalCount: GOAL_SYSTEM_CONFIG.semesterGoalCount };
    if (!Number.isFinite(Number(run.goalConfig.semesterGoalCount)) || Number(run.goalConfig.semesterGoalCount) <= 0) {
      run.goalConfig.semesterGoalCount = GOAL_SYSTEM_CONFIG.semesterGoalCount;
    }
    normalizeRunGoals(run);
    return run;
  } catch (e) {
    return null;
  }
}

export function saveRun(runState) {
  wx.setStorageSync(KEY_RUN, runState);
}

export function clearRun() {
  try {
    wx.removeStorageSync(KEY_RUN);
    wx.removeStorageSync(KEY_RUN_V2);
    wx.removeStorageSync(KEY_RUN_V1);
  } catch (e) {
    // ignore
  }
}

export function saveAudioPrefs(prefs) {
  const meta = loadMeta();
  meta.audioPrefs = { ...(meta.audioPrefs || {}), ...(prefs || {}) };
  saveMeta(meta);
}

export function hasSavedRun() {
  const r = loadRun();
  return !!(r && r.semesterIndex < TOTAL_SEMESTERS);
}

export function saveThemeMode(themeMode) {
  const meta = loadMeta();
  meta.themeMode = themeMode === 'light' ? 'light' : 'dark';
  saveMeta(meta);
}
