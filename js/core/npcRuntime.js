/**
 * 本局 NPC 池抽样与好感维护
 * @param {object[]} catalog
 * @param {string} playerGender
 */
export function seedNpcRuntime(run, catalog) {
  const list = Array.isArray(catalog) ? catalog : [];
  const pg = run && run.playerProfile && run.playerProfile.gender;
  const g = pg === 'female' ? 'female' : 'male';
  const by = (role) => list.filter((n) => n && n.role === role);

  const pickN = (pool, n) => {
    const a = [...pool];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, Math.min(n, a.length));
  };

  const roommates = pickN(by('roommate'), 3);
  const mentors = pickN(by('mentor'), 3);
  const opposite = g === 'female' ? 'male' : 'female';
  const romancePool = by('romance').filter((n) => n.gender === opposite);
  const romanceCandidates = pickN(romancePool, Math.min(4, romancePool.length));
  const seniors = pickN(by('senior'), 2);

  run.npcRoster = {
    roommates: roommates.map((x) => x.id),
    mentors: mentors.map((x) => x.id),
    romanceCandidates: romanceCandidates.map((x) => x.id),
    seniors: seniors.map((x) => x.id),
    primaryMentor: null,
    partner: null,
  };

  const aff = { ...(run.npcAffinity || {}) };
  list.forEach((n) => {
    if (n && n.id && aff[n.id] === undefined) {
      aff[n.id] = n.affinityBase != null ? n.affinityBase : 50;
    }
  });
  run.npcAffinity = aff;
  if (!run.npcLastInteraction || typeof run.npcLastInteraction !== 'object') run.npcLastInteraction = {};
  if (!run.npcEventHits || typeof run.npcEventHits !== 'object') run.npcEventHits = {};
}

/**
 * @param {object} run
 * @param {string} npcId
 * @param {number} delta
 * @param {string} [line]
 */
export function adjustNpcAffinity(run, npcId, delta, line) {
  if (!run || !npcId) return;
  const cur = Number((run.npcAffinity && run.npcAffinity[npcId]) || 50);
  const next = Math.max(0, Math.min(100, cur + Number(delta || 0)));
  run.npcAffinity = { ...(run.npcAffinity || {}), [npcId]: next };
  if (line) {
    run.npcLastInteraction = { ...(run.npcLastInteraction || {}), [npcId]: line };
  }
}
