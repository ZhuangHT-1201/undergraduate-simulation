import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const extra = [
  {
    id: 'evt_pick_mentor',
    layer: 'side',
    tags: ['academic'],
    weight: 99,
    minTurn: 0,
    maxTurn: 23,
    title: '双向奔赴的课题组（伪）',
    body: '学院开放导师意向征集，你在三位候选之间徘徊——传说中选对导师等于选对四年副本路线；DDL是第一生产力这句话，在课题组里会变成「导师是第一生产力」。',
    choices: [
      {
        text: '跟随 {mentor1}（科研主线）',
        mentorIndex: 0,
        effects: { skill: 4, pressure: 3 },
        narrative:
          '你把报名表递给第一位导师，仿佛按下了一条更长更难也更酷的关卡线；此后组会、周报与文献会像早八刺客一样准时出现，但你心里有底——这条路能把简历镀上一层真正的硬度。这一笔写进了你的日常，也悄悄换了你面对下一件事时的底气；你会更从容一点，也更敢对自己笑。',
      },
      {
        text: '跟随 {mentor2}（工程落地）',
        mentorIndex: 1,
        effects: { skill: 5, social: 2, pressure: 4 },
        narrative:
          '你选了更偏项目与交付的那位，从此接口、联调、演示稿会像奶茶订单一样排队到来；小镇做题家模式被迫升级为「需求变更耐受模式」，但你拿到了能写进作品集的真东西。截图丢进相册，简历多一行真话；再来一次你会少点心慌，多点利落。',
      },
      {
        text: '跟随 {mentor3}（自由探索）',
        mentorIndex: 2,
        effects: { gpa: 0.06, pressure: -2 },
        narrative:
          '你选了风格更松的一位，从此进度条更像自助通关：少了push也可能少了确定感；你在自律与摸鱼之间反复横跳，却发现自由的代价是自己对自己下手——也算成年礼。截图丢进相册，简历多一行真话；再来一次你会少点心慌，多点利落。',
      },
    ],
  },
  {
    id: 'evt_romance_intro',
    layer: 'side',
    tags: ['romance', 'social'],
    weight: 99,
    minTurn: 0,
    maxTurn: 23,
    title: '心动副本加载中',
    body: '大三的节奏像按了快进，突然有人问你要不要一起走夜路、一起自习、一起把尴尬聊成笑料；你意识到恋爱不是支线任务，而是会改写时间分配的系统性更新。',
    choices: [
      {
        text: '靠近 {romance1}',
        romancePickIndex: 0,
        effects: { social: 6, pressure: -4, gpa: -0.04 },
        narrative:
          '你选了更近的那条路，聊天框开始变成心跳记录仪；从此日程表里多了「顺便见面」，也开始学会把话说完整——暧昧三连击不一定每次都赢，但至少你在练习真诚。截图丢进相册，简历多一行真话；再来一次你会少点心慌，多点利落。',
      },
      {
        text: '靠近 {romance2}',
        romancePickIndex: 1,
        effects: { social: 6, pressure: -3 },
        narrative:
          '你把偏好写在行动上而不是嘴上，关系像慢热型编译——第一次很慢，缓存命中后就顺滑起来；你们偶尔也为 ddl 吵架，但吵完还是会一起去食堂治疗灵魂。截图丢进相册，简历多一行真话；再来一次你会少点心慌，多点利落。',
      },
      {
        text: '先专注学业，暂不开始恋情',
        romanceSkip: true,
        effects: { gpa: 0.08, skill: 4, pressure: 2 },
        narrative:
          '你点了跳过恋情章节，决定先把主线推到「更像样的自己」；朋友圈看起来更冷酷，其实你只是把温柔留给未来的时间表——谁说单身就不能过得像热血番。截图丢进相册，简历多一行真话；再来一次你会少点心慌，多点利落。',
      },
    ],
  },
  {
    id: 'evt_npc_roommate_lane',
    npcRef: 'npc_lin',
    tags: ['life'],
    weight: 8,
    minTurn: 1,
    maxTurn: 20,
    title: '寝室时区战争',
    body: '{roommate1}把闹钟设成清晨六点，全寝室被动加入「卷王时区」；你一边吐槽一边发现自己的睡眠账户正在透支，像被早八刺客反复偷袭。',
    choices: [
      {
        text: '正面沟通值日表与熄灯时间',
        effects: { social: 4, pressure: -5, health: 2 },
        npcAffinityDelta: { npc_lin: 4 },
        narrative:
          '你把话说开，像打开了寝室路由器管理页面：限速、分流、黑白名单一次到位；从此矛盾还在，但至少变成可讨论的网络协议，而不是随机断网。截图丢进相册，简历多一行真话；再来一次你会少点心慌，多点利落。',
      },
      {
        text: '买耳塞眼罩进入自适应模式',
        effects: { pressure: 6, health: -2, gpa: 0.05 },
        narrative:
          '你选择装备流打法，把矛盾改成与自己的和解；代价是心里仍有小火苗，但至少不会影响你在课上当场睡着——也算战术胜利。截图丢进相册，简历多一行真话；再来一次你会少点心慌，多点利落。',
      },
    ],
  },
  {
    id: 'evt_npc_mentor_push',
    npcRef: 'npc_mentor_zhang',
    tags: ['research', 'academic'],
    weight: 9,
    minTurn: 4,
    maxTurn: 22,
    conditions: { all: [{ flag: 'primaryMentor' }] },
    title: '组会现场直播',
    body: '{primaryMentor}在组会上把你的进度条拉到全场可见：夸奖像稀有掉落，沉默像常态地图；你突然理解什么叫「导师是第一生产力」——压力也是。',
    choices: [
      {
        text: '连夜补齐材料硬顶一波',
        effects: { skill: 6, pressure: 8, health: -4 },
        npcAffinityDelta: { npc_mentor_zhang: 5 },
        narrative:
          '你用通宵把图表补齐，像在游戏里赶赛季结算；第二天导师点头的一瞬间，你觉得发际线虽然受伤，但经验值真的到账。截图丢进相册，简历多一行真话；再来一次你会少点心慌，多点利落。',
      },
      {
        text: '坦诚困难请求拆任务',
        effects: { pressure: -3, social: 3 },
        npcAffinityDelta: { npc_mentor_zhang: 2 },
        narrative:
          '你学会了把不会写进周报里，导师反而给了更可执行的切片；原来成年人的进度条也能分期付款。截图丢进相册，简历多一行真话；再来一次你会少点心慌，多点利落。',
      },
    ],
  },
  {
    id: 'evt_npc_romance_cafe',
    npcRef: 'npc_rom_h1',
    tags: ['romance', 'social'],
    weight: 8,
    minTurn: 6,
    maxTurn: 23,
    title: '咖啡馆座位抽签',
    body: '你和心动对象同时看上最后一个靠窗位——空气突然安静得像期末考场；小镇做题家本能让你想退，但心里有个声音说「这次别逃」。',
    choices: [
      {
        text: '大方拼桌一起坐',
        effects: { social: 8, pressure: -5 },
        npcAffinityDelta: { npc_rom_h1: 6 },
        narrative:
          '你们拼桌成功，话题从课程聊到人生再到八卦，咖啡杯像小型社交路由器；后来你发现主动一步并不丢人，丢人的是一直在脑内预习却没交卷。截图丢进相册，简历多一行真话；再来一次你会少点心慌，多点利落。',
      },
      {
        text: '让给对方，装冷静离开',
        effects: { social: -2, pressure: 4 },
        narrative:
          '你礼貌撤退，心里上演十万字虐恋；当晚朋友圈发「随缘」——典型嘴硬心软的前奏。截图丢进相册，简历多一行真话；再来一次你会少点心慌，多点利落。',
      },
    ],
  },
];

const evPath = path.join(root, 'config/v1/events.json');
const events = JSON.parse(fs.readFileSync(evPath, 'utf8'));
const ids = new Set(events.map((e) => e.id));
extra.forEach((e) => {
  if (!ids.has(e.id)) events.push(e);
});
fs.writeFileSync(evPath, JSON.stringify(events, null, 2));

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
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === q) inStr = false;
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

const catPath = path.join(root, 'js/data/catalog.js');
let cat = fs.readFileSync(catPath, 'utf8');
cat = patchExport(cat, 'eventsCatalog', events);
fs.writeFileSync(catPath, cat);
console.log('appended npc events to events.json + catalog');
