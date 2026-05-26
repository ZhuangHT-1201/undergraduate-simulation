import { createInitialRunState, SCHOOLS, MAJORS, WEEKS_PER_SEMESTER, TOTAL_SEMESTERS } from '../config/v1/rules.js';
import {
  pickMainEvent,
  pickSideEvent,
  applyChoiceOutcome,
  applyWeeklyAction,
  applyStatusEffects,
  triggerRandomEvent,
  maybeGrantItem,
  resolveEnding,
} from '../js/core/eventEngine.js';
import { actionsCatalog, endingsCatalog, eventsCatalog, randomEventsCatalog, itemsCatalog } from '../js/data/catalog.js';

const RUNS = Number(process.argv[2] || 300);
const schoolIds = Object.keys(SCHOOLS);
const majorIds = Object.keys(MAJORS);

function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function chooseWeeklyAction(run) {
  const semNo = (run.semesterIndex || 0) + 1;
  const candidates = actionsCatalog.filter((a) => {
    if (a.id === 'act_intern' && semNo < 5) return false;
    if (Array.isArray(a.tags) && a.tags.includes('internship') && semNo < 5) return false;
    const budgetNeed = Number(a.cost || 0);
    return Number(run.stats.money || 0) >= budgetNeed;
  });
  return candidates.length ? randPick(candidates) : randPick(actionsCatalog);
}

function stepMainOrSide(run, evt, phase) {
  const next = { ...run };
  const choice = randPick(evt.choices || []);
  next.usedEventIds = Array.isArray(next.usedEventIds) ? [...next.usedEventIds, evt.id] : [evt.id];
  const after = applyChoiceOutcome(next, choice || {});
  after.log = Array.isArray(after.log) ? [...after.log] : [];
  after.log.push({
    eventId: evt.id,
    eventTitle: evt.title,
    choiceText: (choice && choice.text) || '跳过',
    semesterIndex: run.semesterIndex,
    weekIndex: run.weekIndex,
    phase,
    effects: (choice && choice.effects) || {},
  });
  return after;
}

function runOne() {
  const schoolId = randPick(schoolIds);
  const majorId = randPick(majorIds);
  let run = createInitialRunState(schoolId, majorId, {});
  run.pendingMainEvent = pickMainEvent(run, eventsCatalog);

  while ((run.semesterIndex || 0) < TOTAL_SEMESTERS) {
    if (run.phase === 'main_event') {
      const evt = run.pendingMainEvent || pickMainEvent(run, eventsCatalog);
      run = stepMainOrSide(run, evt, 'main_event');
      run.phase = 'week_action';
      run.pendingMainEvent = null;
      run.pendingSideEvent = null;
      run.actionSlotsLeft = Number(run.weeksPerSemester || WEEKS_PER_SEMESTER);
      continue;
    }

    if (run.phase === 'side_event') {
      const evt = run.pendingSideEvent || pickSideEvent(run, eventsCatalog);
      if (evt) run = stepMainOrSide(run, evt, 'side_event');
      run.phase = 'week_action';
      run.pendingSideEvent = null;
      continue;
    }

    const action = chooseWeeklyAction(run);
    const cost = Number(action.cost || 0);
    if (cost > 0) {
      run.stats = { ...run.stats, money: Number(run.stats.money || 0) - cost };
    }
    run = applyWeeklyAction(run, action);
    run = applyStatusEffects(run);
    run = triggerRandomEvent(run, randomEventsCatalog);
    run = maybeGrantItem(run, itemsCatalog);
    run.log = Array.isArray(run.log) ? [...run.log] : [];
    run.log.push({
      eventId: action.id,
      eventTitle: action.title,
      choiceText: action.title,
      semesterIndex: run.semesterIndex,
      weekIndex: run.weekIndex,
      phase: 'week_action',
      effects: action.effects || {},
    });

    const slotsLeft = Math.max(0, Number(run.actionSlotsLeft || WEEKS_PER_SEMESTER) - 1);
    run.actionSlotsLeft = slotsLeft;
    if (slotsLeft > 0) {
      run.weekIndex = Number(run.weekIndex || 0) + 1;
      const side = Math.random() < 0.35 ? pickSideEvent(run, eventsCatalog) : null;
      if (side) {
        run.pendingSideEvent = side;
        run.phase = 'side_event';
      } else {
        run.phase = 'week_action';
      }
      continue;
    }

    if ((run.semesterIndex || 0) + 1 >= TOTAL_SEMESTERS) break;
    run.semesterIndex = Number(run.semesterIndex || 0) + 1;
    run.weekIndex = 0;
    run.turn = Number(run.turn || 0) + 1;
    run.actionSlotsLeft = Number(run.weeksPerSemester || WEEKS_PER_SEMESTER);
    run.pendingMainEvent = pickMainEvent(run, eventsCatalog);
    run.phase = 'main_event';
  }

  const ending = resolveEnding(run, endingsCatalog, {});
  return {
    endingId: ending && ending.id ? ending.id : 'unknown',
    stats: run.stats,
    schoolId,
    majorId,
  };
}

const dist = {};
let lowHealthCount = 0;
let highPressureCount = 0;
for (let i = 0; i < RUNS; i++) {
  const out = runOne();
  dist[out.endingId] = (dist[out.endingId] || 0) + 1;
  if (Number(out.stats.health || 0) <= 25) lowHealthCount++;
  if (Number(out.stats.pressure || 0) >= 75) highPressureCount++;
}

const rows = Object.entries(dist).sort((a, b) => b[1] - a[1]);
const unique = rows.length;
const top = rows[0] || ['none', 0];
const topShare = RUNS ? (top[1] / RUNS) * 100 : 0;

console.log(`runs=${RUNS}`);
console.log(`unique_endings=${unique}`);
console.log(`top_ending=${top[0]} count=${top[1]} share=${topShare.toFixed(2)}%`);
console.log(`low_health_ratio=${((lowHealthCount / RUNS) * 100).toFixed(2)}%`);
console.log(`high_pressure_ratio=${((highPressureCount / RUNS) * 100).toFixed(2)}%`);
console.log('ending_distribution');
rows.forEach(([id, count]) => {
  const pct = ((count / RUNS) * 100).toFixed(2);
  console.log(`- ${id}: ${count} (${pct}%)`);
});
