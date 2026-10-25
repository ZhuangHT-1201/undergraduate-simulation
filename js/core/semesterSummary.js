/**
 * 学期总结：定性叙述，避免弹出无意义的数字或内部 ID。
 */

function matchConditions(cond, run, completedSemesterIndex) {
  if (!cond || typeof cond !== 'object') return true;
  const log = (run.log || []).filter((e) => Number(e.semesterIndex) === Number(completedSemesterIndex));
  if (cond.stats && Array.isArray(cond.stats)) {
    const st = run.stats || {};
    for (let i = 0; i < cond.stats.length; i++) {
      const c = cond.stats[i];
      const v = st[c.key];
      if (v === undefined) return false;
      if (c.gte !== undefined && v < c.gte) return false;
      if (c.lte !== undefined && v > c.lte) return false;
    }
  }
  if (cond.phaseCounts && typeof cond.phaseCounts === 'object') {
    const pc = { main_event: 0, side_event: 0, week_action: 0 };
    log.forEach((e) => {
      if (pc[e.phase] !== undefined) pc[e.phase] += 1;
    });
    const entries = Object.entries(cond.phaseCounts);
    for (let i = 0; i < entries.length; i++) {
      const [ph, need] = entries[i];
      if ((pc[ph] || 0) < Number(need)) return false;
    }
  }
  return true;
}

function clampNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** 周行动频次 → 定性说法（不暴露次数） */
function describeActionHabit(count) {
  const n = clampNumber(count, 0);
  if (n >= 10) return '几乎成了你这学期的固定节奏';
  if (n >= 6) return '常常出现在你的日程里';
  if (n >= 3) return '时不时会被你翻出来';
  if (n >= 1) return '也留下过几次印象';
  return '';
}

/** 本学期经历量 → 定性说法 */
function describeSemesterPace(total) {
  const n = clampNumber(total, 0);
  if (n >= 28) return '排得很满';
  if (n >= 16) return '不紧不慢但一直在推进';
  if (n >= 8) return '节奏偏松，关键节点却都没落下';
  if (n >= 1) return '留白不少，但每个选择都算数';
  return '像一段还在酝酿的序章';
}

function describePressure(st) {
  const p = clampNumber(st.pressure, 50);
  if (p >= 72) return '压力多数时候偏高，你靠硬撑走完了这一段';
  if (p >= 55) return '忙起来的几周节奏很紧';
  if (p <= 32) return '整体比较从容，很少被截止日期追着跑';
  return '有起伏，但大体还能自己安排节奏';
}

function describeHealth(st) {
  const h = clampNumber(st.health, 50);
  if (h >= 78) return '身体状态一直跟得上日程';
  if (h <= 38) return '身体亮过黄灯，下学期需要多留一点余地';
  return '作息不算完美，也还撑得住';
}

function describeMoney(st) {
  const m = clampNumber(st.money, 0);
  if (m >= 4500) return '手头相对宽裕，敢为喜欢的事买单';
  if (m <= 600) return '钱包偏紧，花钱更像在做取舍题';
  return '收支在可控范围内晃荡';
}

function describeGpa(st) {
  const g = clampNumber(st.gpa, 0);
  if (g >= 3.5) return '学业表现亮眼';
  if (g >= 2.8) return '学业稳扎稳打';
  if (g >= 2.0) return '学业有起伏，但还在自己的轨道上';
  if (g > 0) return '学业需要下学期再补一课';
  return '学业线还在慢慢展开';
}

/**
 * 根据本学期记录与当前属性推断倾向标签
 * @returns {Set<string>}
 */
export function inferSemesterTendencyTags(run, completedSemesterIndex) {
  const tags = new Set();
  const log = (run.log || []).filter((e) => Number(e.semesterIndex) === Number(completedSemesterIndex));
  const st = run.stats || {};
  let weekStudy = 0;
  let weekSocial = 0;
  let weekMoney = 0;
  let romanceHits = 0;
  let homesickHits = 0;
  let weekActions = 0;
  log.forEach((e) => {
    if (e.phase !== 'week_action' || !e.eventId) return;
    weekActions += 1;
    const id = String(e.eventId);
    if (id.includes('study') || id.includes('class') || id.includes('library') || id.includes('review') || id.includes('cert') || id.includes('contest')) weekStudy += 1;
    if (id.includes('social') || id.includes('party') || id.includes('club') || id.includes('join_club') || id.includes('volunteer')) weekSocial += 1;
    if (id.includes('parttime') || id.includes('invest') || id.includes('cook_meal')) weekMoney += 1;
  });
  if (log.some((e) => String(e.eventId || '').includes('romance') || String(e.choiceText || '').includes('恋'))) {
    romanceHits += 1;
  }
  if (log.some((e) => String(e.eventId || '').includes('homesick') || String(e.eventTitle || '').includes('想家'))) {
    homesickHits += 1;
  }
  if (st.pressure >= 68) tags.add('卷王');
  if (st.pressure <= 38) tags.add('佛系');
  if (weekStudy >= 5) tags.add('学业上行');
  if (weekSocial >= 4) tags.add('社牛');
  if (romanceHits || (run.flags && run.flags.romanceCommitted)) tags.add('恋爱');
  if (run.flags && run.flags.startupIntent) tags.add('创业');
  if (run.flags && (run.flags.civilTrack || run.flags.publicInstitutionTrack)) tags.add('考公');
  if (run.flags && run.flags.researchTrack) tags.add('科研');
  if (run.flags && run.flags.internshipReady) tags.add('实习');
  if (st.health >= 75 && st.pressure <= 50) tags.add('养生');
  if (st.money >= 4000) tags.add('搞钱');
  if (homesickHits || weekMoney >= 3) tags.add('恋家');
  if (st.pressure >= 55 && weekActions > 0 && weekStudy < 3) tags.add('拖延');
  if (weekMoney >= 4) tags.add('兼职');
  if (tags.size === 0) tags.add('日常');
  return tags;
}

const TAG_PORTRAIT = {
  卷王: '你把很多时间留给了课业和目标，也真正感到了疲惫',
  佛系: '你给自己留了呼吸的余地，要紧的节点并没有松手',
  学业上行: '教室和自习室占据了你不少时间',
  社牛: '你更愿意走出宿舍，和不同的人产生交集',
  恋爱: '一段关系进入了你的日常，也改变了时间的分配',
  创业: '你开始把一个念头变成能拿给别人看的作品',
  考公: '你对稳定生活的想象变得更具体',
  科研: '实验、文献和讨论成了反复出现的内容',
  实习: '你开始用职场标准整理自己的经历',
  养生: '你比过去更在意睡眠和身体状态',
  搞钱: '你开始认真计算收入和支出',
  恋家: '远方和故乡在电话里来回出现',
  拖延: '截止日期仍会推着你向前，只是常常来得晚一点',
  兼职: '课余时间被工作切成了几块',
  日常: '没有夸张的标签，但每一天都有具体的重量',
};

/**
 * 统计本学期分相位数量
 */
export function getSemesterPhaseCounts(run, completedSemesterIndex) {
  const phaseCounts = { main_event: 0, side_event: 0, week_action: 0 };
  const log = Array.isArray(run && run.log) ? run.log : [];
  log.forEach((entry) => {
    if (Number(entry.semesterIndex) !== Number(completedSemesterIndex)) return;
    if (phaseCounts[entry.phase] !== undefined) phaseCounts[entry.phase] += 1;
  });
  return phaseCounts;
}

function pickPortraitLine(tags) {
  const list = Array.from(tags);
  for (let i = 0; i < list.length; i++) {
    if (TAG_PORTRAIT[list[i]]) return TAG_PORTRAIT[list[i]];
  }
  return TAG_PORTRAIT['日常'];
}

function sanitizeActionLabel(label) {
  const s = String(label || '').trim();
  if (!s) return '';
  if (/^act_/i.test(s)) return '';
  return s;
}

function pickMemorableLogLines(run, completedSemesterIndex, resolveEventTitle, max = 3) {
  const log = (run.log || []).filter((e) => Number(e.semesterIndex) === Number(completedSemesterIndex));
  const tail = log.slice(-max);
  const out = [];
  tail.forEach((e) => {
    let title = '';
    if (typeof resolveEventTitle === 'function') {
      title = String(resolveEventTitle(e) || '').trim();
    } else {
      title = String(e.eventTitle || '').trim();
    }
    if (title && !/^act_/i.test(title)) out.push(title);
  });
  return out;
}

/**
 * 内置学期总结模板（标题 + 正文，仅 {name} {topAction} 占位，不含次数）
 */
export const semesterSummaryTemplates = [
  { id: 'sm_calm', tags: ['佛系', '日常'], title: '慢下来的这一学期', body: '{name}这学期没有把日程塞满，{topAction}偶尔出现，更多时候，你在给生活留一点余地。' },
  { id: 'sm_grind', tags: ['卷王', '学业上行'], title: '把时间交给了课表', body: '{name}这学期把不少时间放在课业和目标上，{topAction}是常见节奏，疲惫也是真的。' },
  { id: 'sm_love', tags: ['恋爱'], title: '心动进入日常', body: '{name}开始把另一个人放进日程，{topAction}前后常会多出一句问候或一次见面。' },
  { id: 'sm_social', tags: ['社牛'], title: '认识了很多名字', body: '{name}这学期更愿意走出去，{topAction}之后常能续上一顿饭或一段闲聊。' },
  { id: 'sm_money', tags: ['搞钱', '兼职', '恋家'], title: '认真算了算生活费', body: '{name}开始关注每一笔支出，{topAction}之外，也多了几次关于预算和未来的盘算。' },
  { id: 'sm_health', tags: ['养生'], title: '先把状态照顾好', body: '{name}开始把睡眠和身体放在前面，{topAction}不只是消遣，也是让下周继续运转的准备。' },
  { id: 'sm_delay', tags: ['拖延'], title: '和截止日期反复交手', body: '{name}的计划改过几次日期，{topAction}总在最后关头变得格外重要。' },
  { id: 'sm_research', tags: ['科研'], title: '实验室的灯亮到很晚', body: '{name}花了不少时间和数据、文献打交道，{topAction}是暂时离开屏幕后仍会想起的安静片段。' },
  { id: 'sm_job', tags: ['实习', '考公', '创业'], title: '开始为毕业以后做准备', body: '{name}这学期把一部分注意力移向未来，{topAction}之外，也在整理经历和方向。' },
  { id: 'sm_dorm', tags: ['日常', '恋家'], title: '宿舍里的小事', body: '{name}的日常由很多小事组成，{topAction}是其中反复出现的一段，也让生活更有实感。' },
  { id: 'sm_night', tags: ['卷王', '拖延'], title: '图书馆闭馆之前', body: '这学期有不少夜晚在书桌前结束，{topAction}常出现在最后一小时，第二天的疲惫也随之而来。' },
  { id: 'sm_balance', tags: ['学业上行', '社牛'], title: '学习和生活之间', body: '{name}试着兼顾成绩和关系，{topAction}成了两边之间相对稳定的落脚点。' },
];

/**
 * 生成兜底学期总结（全定性，无属性数值）
 */
export function buildDefaultSemesterSummary(run, completedSemesterIndex) {
  const semNo = Number(completedSemesterIndex || 0) + 1;
  const st = (run && run.stats) || {};
  const tags = inferSemesterTendencyTags(run || {}, completedSemesterIndex);
  const phaseCounts = getSemesterPhaseCounts(run || {}, completedSemesterIndex);
  const total = phaseCounts.main_event + phaseCounts.side_event + phaseCounts.week_action;
  const topAction = sanitizeActionLabel(run && run._semesterTopActionLabel) || '校园日常';
  const topActionCount = clampNumber(run && run._semesterTopActionCount, 0);
  const habit = describeActionHabit(topActionCount);
  const playerName = (run && run.playerProfile && run.playerProfile.name) || '你';
  const portrait = pickPortraitLine(tags);
  const pace = describeSemesterPace(total);

  const lines = [
    `${playerName}的第 ${semNo} 学期告一段落。整体节奏${pace}，${portrait}。`,
  ];
  if (habit) {
    lines.push(`你最常做的是「${topAction}」，${habit}。`);
  }
  const vibes = [describeGpa(st), describePressure(st), describeHealth(st), describeMoney(st)].filter(Boolean);
  if (vibes.length) {
    lines.push(vibes.join('；') + '。');
  }
  return {
    title: `第 ${semNo} 学期回顾`,
    body: lines.join('\n'),
  };
}

/**
 * @param {object} run
 * @param {number} completedSemesterIndex
 * @param {object[]} templates
 * @returns {{ title: string, body: string }}
 */
export function pickSemesterSummary(run, completedSemesterIndex, templates) {
  const list = Array.isArray(templates) && templates.length ? templates : semesterSummaryTemplates;
  const semNo = completedSemesterIndex + 1;
  const tags = inferSemesterTendencyTags(run, completedSemesterIndex);
  const topAction = sanitizeActionLabel(run._semesterTopActionLabel) || '校园日常';
  const name = (run.playerProfile && run.playerProfile.name) || '你';

  const scored = [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (!t || !t.id) continue;
    if (t.minSemester != null && semNo < t.minSemester) continue;
    if (!matchConditions(t.conditions, run, completedSemesterIndex)) continue;
    let score = 1;
    const tt = t.tags || [];
    for (let j = 0; j < tt.length; j++) {
      if (tags.has(tt[j])) score += 4;
    }
    scored.push({ t, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const topScore = scored.length ? scored[0].score : 0;
  const topPool = scored.filter((s) => s.score === topScore);
  const pick = topPool.length ? topPool[Math.floor(Math.random() * topPool.length)].t : null;
  if (!pick) return buildDefaultSemesterSummary(run, completedSemesterIndex);

  let body = String(pick.body || '')
    .replace(/\{name\}/g, name)
    .replace(/\{topAction\}/g, topAction)
    .replace(/\{topActionCount\}/g, '')
    .replace(/\s*做了\s*次/g, '')
    .replace(/\s*一共\s*次/g, '')
    .replace(/\s*×\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const fallback = buildDefaultSemesterSummary(run, completedSemesterIndex);
  if (!body) body = fallback.body;
  const title = String(pick.title || fallback.title).replace(/\s*·\s*\d+\s*$/, '').trim();
  return { title: title || fallback.title, body };
}

/**
 * 拼装完整弹窗文案（供 main 调用）
 */
export function buildSemesterSummaryPopupText(run, completedSemesterIndex, templates, resolveEventTitle) {
  const picked = pickSemesterSummary(run, completedSemesterIndex, templates);
  const memorable = pickMemorableLogLines(run, completedSemesterIndex, resolveEventTitle, 3);
  const feedback = (run.goals && Array.isArray(run.goals.feedbackQueue))
    ? run.goals.feedbackQueue.slice(-2)
    : [];
  const lines = [];
  lines.push(`【${picked.title}】`);
  lines.push(picked.body);
  if (feedback.length) {
    lines.push('');
    lines.push('这学期你给自己的小目标');
    feedback.forEach((x) => {
      const t = String(x || '')
        .replace(/第\d+学期第\d+周/g, '某周')
        .replace(/目标达成：|目标未达成：/g, '');
      if (t.trim()) lines.push(`· ${t.trim()}`);
    });
  }
  if (memorable.length) {
    lines.push('');
    lines.push('还记得的这些瞬间');
    memorable.forEach((title) => lines.push(`· ${title}`));
  }
  lines.push('');
  lines.push('学期结束了，新的课表已经在等你。');
  return lines.join('\n');
}

/**
 * 统计本学期最常周行动标题（供模板占位）
 * @param {object[]} actionsCatalog
 */
export function attachSemesterTopAction(run, completedSemesterIndex, actionsCatalog) {
  const log = (run.log || []).filter(
    (e) => e.phase === 'week_action' && Number(e.semesterIndex) === Number(completedSemesterIndex),
  );
  const counts = {};
  log.forEach((e) => {
    const id = e.eventId;
    if (!id) return;
    counts[id] = (counts[id] || 0) + 1;
  });
  let bestId = null;
  let bestN = 0;
  Object.entries(counts).forEach(([id, n]) => {
    if (n > bestN) {
      bestN = n;
      bestId = id;
    }
  });
  const act = Array.isArray(actionsCatalog) ? actionsCatalog.find((a) => a.id === bestId) : null;
  const label = act && act.title ? act.title : '';
  run._semesterTopActionLabel = sanitizeActionLabel(label) || '校园日常';
  run._semesterTopActionCount = bestN || 0;
  run._semesterActionTitleResolved = run._semesterTopActionLabel;
}
