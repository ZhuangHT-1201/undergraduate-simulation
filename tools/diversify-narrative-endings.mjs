/**
 * 将 events.json / actions.json 中大量重复的模板收尾句轮换为多种表达。
 * 运行：node tools/diversify-narrative-endings.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const BOILERPLATE = '这一笔写进了你的日常，也悄悄换了你面对下一件事时的底气；你会更从容一点，也更敢对自己笑。';

const ENDINGS = [
  '你把这一天轻轻合上本子：不算轰轰烈烈，但踏踏实实地往前挪了一小步。',
  '熄灯前你在脑子里复盘了一遍，觉得还行——明天继续。',
  '走在路上你也说不清楚收获了什么，但就是觉得心里多了点底气。',
  '这些事不大，却把你的大学生活填得更具体了一点。',
  '你没有发朋友圈，但嘴角不自觉翘了一点。',
  '回到宿舍你突然觉得：嗯，今天也算没有白过。',
  '日历又翻过一格，你对「下一次会怎样」多了一分想象。',
  '你给自己记了一笔小账：时间花出去了，心也安了一点。',
  '事情做完的那一刻，你吐出一口气，像把一块小石头从心里搬走了。',
  '你也没想太多，只是默默把这一格日子标成「还不错」。',
  '夜风从窗缝钻进来，你伸了个懒腰，觉得身体和精神都轻了一点。',
  '你忽然明白，成长很多时候就是这样：不声不响，但方向清楚了一点。',
  '手机震了一下，是群里的梗图；你笑了一下，又关掉了屏幕。',
  '这一页翻过去，下一件小事还在排队等你。',
  '你把它写进待办里又划掉，像给今天盖了个「完成」的章。',
  '不算惊艳，但足够真实——你接受这样的日常。',
  '你给自己倒了杯水，像给今天画了个小小的句号。',
  '窗外天色暗下去，你心里却亮了一点点。',
  '你摸了摸口袋里的校园卡，突然觉得它和今天的你很合拍。',
  '舍友问你干嘛傻笑，你说没事——其实只是心情还行。',
  '你把耳机戴上又摘下，最后决定安静地和这一天道别。',
  '洗漱镜子里的人看上去疲惫却安定：还行，还在轨道上。',
  '你没写给谁的总结，却在心里默默点了点头。',
  '楼道里有脚步声远去，你的大学生活又多了一层回声。',
  '你关上台灯，觉得今天像一张折好的纸，平平整整地收进抽屉里。',
  '风把窗帘吹动一下，你忽然觉得：日子就是这样，慢慢堆出来的。',
];

function diversifyString(s, nextIndex) {
  if (!s || typeof s !== 'string' || !s.includes(BOILERPLATE)) return { text: s, count: 0, nextIndex };
  const re = new RegExp(BOILERPLATE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  let c = 0;
  const text = s.replace(re, () => {
    c += 1;
    const out = ENDINGS[nextIndex % ENDINGS.length];
    nextIndex += 1;
    return out;
  });
  return { text, count: c, nextIndex };
}

function processEvents(arr, startIndex) {
  let next = startIndex;
  let total = 0;
  for (const ev of arr) {
    if (!ev.choices) continue;
    for (const ch of ev.choices) {
      if (!ch.narrative) continue;
      const { text, count, nextIndex } = diversifyString(ch.narrative, next);
      if (count) {
        ch.narrative = text;
        total += count;
        next = nextIndex;
      }
    }
  }
  return { next, total };
}

function processActions(arr, startIndex) {
  let next = startIndex;
  let total = 0;
  for (const a of arr) {
    if (!a.narrative) continue;
    const { text, count, nextIndex } = diversifyString(a.narrative, next);
    if (count) {
      a.narrative = text;
      total += count;
      next = nextIndex;
    }
  }
  return { next, total };
}

const eventsPath = path.join(root, 'config/v1/events.json');
const actionsPath = path.join(root, 'config/v1/actions.json');

const events = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
const actions = JSON.parse(fs.readFileSync(actionsPath, 'utf8'));

let idx = 0;
const r1 = processEvents(events, idx);
idx = r1.next;
const r2 = processActions(actions, idx);

fs.writeFileSync(eventsPath, `${JSON.stringify(events, null, 2)}\n`, 'utf8');
fs.writeFileSync(actionsPath, `${JSON.stringify(actions, null, 2)}\n`, 'utf8');

console.log(`events: replaced ${r1.total} occurrence(s) of template ending`);
console.log(`actions: replaced ${r2.total} occurrence(s) of template ending`);
console.log(`unique endings pool: ${ENDINGS.length}`);
