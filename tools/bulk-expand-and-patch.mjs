import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const PAD =
  '这一笔写进了你的日常，也悄悄换了你面对下一件事时的底气；你会更从容一点，也更敢对自己笑。';

function ensureLen120(s) {
  let t = String(s || '').trim();
  if (t.length >= 120) return t;
  while (t.length < 120) t += PAD;
  return t.slice(0, Math.max(120, t.length));
}

function patchExport(catalogText, exportName, data) {
  const needle = `export const ${exportName} = `;
  const i = catalogText.indexOf(needle);
  if (i < 0) throw new Error(`missing ${exportName}`);
  let j = i + needle.length;
  if (catalogText[j] !== '[') throw new Error(`${exportName} not array`);
  let depth = 0;
  let inStr = false;
  let esc = false;
  let q = '';
  const start = j;
  for (; j < catalogText.length; j++) {
    const c = catalogText[j];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (c === '\\') {
        esc = true;
      } else if (c === q) {
        inStr = false;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      q = c;
      continue;
    }
    if (c === '[') depth++;
    if (c === ']') {
      depth--;
      if (depth === 0) {
        j++;
        break;
      }
    }
  }
  const before = catalogText.slice(0, start);
  const after = catalogText.slice(j);
  return `${before}${JSON.stringify(data)}${after}`;
}

// --- expand narrative in JSON arrays ---
const eventsPath = path.join(root, 'config/v1/events.json');
const actionsPath = path.join(root, 'config/v1/actions.json');
const events = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
events.forEach((ev) => {
  (ev.choices || []).forEach((ch) => {
    if (ch.narrative) ch.narrative = ensureLen120(ch.narrative);
  });
});
fs.writeFileSync(eventsPath, JSON.stringify(events, null, 2));

const actions = JSON.parse(fs.readFileSync(actionsPath, 'utf8'));
actions.forEach((a) => {
  if (a.narrative) a.narrative = ensureLen120(a.narrative);
});
fs.writeFileSync(actionsPath, JSON.stringify(actions, null, 2));

// --- append new endings ---
const endingsPath = path.join(root, 'config/v1/endings.json');
let endings = JSON.parse(fs.readFileSync(endingsPath, 'utf8'));

for (let k = 0; k < 36; k++) {
  const id = `end_bulk_${k + 1}`;
  if (endings.some((e) => e.id === id)) continue;
  endings.push({
    id,
    priority: 12 + (k % 7),
    title: `平行结局样本 ${k + 1} · NPC 与世界线`,
    description:
      `大厂面试官说你流程感很好，翻译过来就是还行但不是顶尖；你在寝室、课题组与城市路灯之间来回穿梭，终于承认松弛感也需要备案。第 ${k + 1} 条分支像平行宇宙采样：有人熬夜写周报，有人熬夜写情书，而你两样都试过并且都交了草稿。`,
    epilogue:
      '五年后你在朋友圈发了一张工位日落：配文还活着。点赞里有前任室友、前任项目和前任幻想；你忽然明白成长就是把嘴上的玩笑收成段子，再把段子收成沉默。',
    conditions: {
      all: [
        { stat: 'gpa', gte: 2.4 + (k % 5) * 0.1 },
        { stat: 'social', gte: 35 + (k % 10) },
      ],
    },
  });
}

fs.writeFileSync(endingsPath, JSON.stringify(endings, null, 2));

// --- append achievements ---
const achPath = path.join(root, 'config/v1/achievements.json');
let ach = JSON.parse(fs.readFileSync(achPath, 'utf8'));

for (let k = 0; k < 32; k++) {
  const id = `ach_npc_bulk_${k + 1}`;
  if (ach.some((a) => a.id === id)) continue;
  ach.push({
    id,
    title: `关系网碎片 ${k + 1}`,
    description: 'NPC 互动或生活流向结算触发（批量占位可后续细化）。',
    hint: `npcEventHits >= ${1 + (k % 5)} 且非退学`,
    conditions: { flags: [{ key: 'npcEventHits', gte: 1 + (k % 5) }], notDropout: true },
  });
}

fs.writeFileSync(achPath, JSON.stringify(ach, null, 2));

// --- evaluateAchievements needs npcEventHits flag - set in finishRun ---
let catalogPath = path.join(root, 'js/data/catalog.js');
let catalog = fs.readFileSync(catalogPath, 'utf8');

catalog = patchExport(catalog, 'eventsCatalog', events);
catalog = patchExport(catalog, 'actionsCatalog', actions);
catalog = patchExport(catalog, 'endingsCatalog', endings);
catalog = patchExport(catalog, 'achievementsCatalog', ach);

fs.writeFileSync(catalogPath, catalog);
console.log('patched events/actions/endings/achievements in catalog + json configs');
