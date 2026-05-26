function matchAchievement(id, flags, stats, ending, isDropout) {
  switch (id) {
    case 'ach_first_run':
      return true;
    case 'ach_hardcore':
      return (stats.pressure || 0) >= 75 && (stats.skill || 0) >= 70;
    case 'ach_romance_route':
      return !!flags.romanceCommitted && !isDropout;
    case 'ach_intern_ready':
      return !!flags.internshipReady;
    case 'ach_civil_track':
      return ending.id === 'end_civil_pass' || ending.id === 'end_teacher_staff';
    case 'ach_student_work':
      return Number(flags.studentWork || 0) >= 2;
    case 'ach_cert_grind':
      return Number(flags.certProgress || 0) >= 2;
    case 'ach_research_path':
      return Number(flags.researchProgress || 0) >= 2;
    case 'ach_contest_path':
      return Number(flags.contestProgress || 0) >= 2;
    case 'ach_dorm_survivor':
      return Number(flags.dormProgress || 0) >= 2 && (stats.health || 0) >= 50;
    default:
      return false;
  }
}

function matchRule(rule, value) {
  if (rule.eq !== undefined) {
    const v = value === undefined || value === null ? 0 : value;
    return v === rule.eq || Number(v) === Number(rule.eq);
  }
  if (rule.gte !== undefined) return Number(value || 0) >= Number(rule.gte);
  if (rule.lte !== undefined) return Number(value || 0) <= Number(rule.lte);
  if (rule.truthy !== undefined) return !!value === !!rule.truthy;
  return !!value;
}

function matchAchievementByConditions(conditions, flags, stats, ending, isDropout, runSnapshot) {
  if (!conditions) return false;
  const rs = runSnapshot || {};
  if (conditions.always) return true;
  if (conditions.notDropout && isDropout) return false;
  if (Array.isArray(conditions.endingIn) && !conditions.endingIn.includes(ending.id)) return false;
  if (conditions.school && rs.schoolId !== conditions.school) return false;
  if (conditions.major && rs.majorId !== conditions.major) return false;
  if (conditions.rosterPartner === true && !(rs.npcRoster && rs.npcRoster.partner)) return false;
  if (
    conditions.rosterPrimaryMentor === true &&
    !(rs.npcRoster && rs.npcRoster.primaryMentor) &&
    !flags.primaryMentor
  ) {
    return false;
  }
  if (Array.isArray(conditions.stats)) {
    const ok = conditions.stats.every((r) => matchRule(r, stats[r.key]));
    if (!ok) return false;
  }
  if (Array.isArray(conditions.flags)) {
    const ok = conditions.flags.every((r) => matchRule(r, flags[r.key]));
    if (!ok) return false;
  }
  if (Array.isArray(conditions.flagsAny) && conditions.flagsAny.length) {
    const ok = conditions.flagsAny.some((r) => matchRule(r, flags[r.key]));
    if (!ok) return false;
  }
  return true;
}

export function evaluateAchievements(runSnapshot, ending, catalog) {
  const unlocked = [];
  const flags = runSnapshot.flags || {};
  const stats = runSnapshot.stats || {};
  const isDropout = String(ending.id || '').startsWith('end_dropout');

  catalog.forEach((a) => {
    const matched = a.conditions
      ? matchAchievementByConditions(a.conditions, flags, stats, ending, isDropout, runSnapshot)
      : matchAchievement(a.id, flags, stats, ending, isDropout);
    if (matched) unlocked.push(a.id);
  });
  return unlocked;
}
