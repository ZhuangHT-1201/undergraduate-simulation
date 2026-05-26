/**
 * 批量润色游戏内中文文案（病句、模板尾句、生硬梗）
 * Run from repo root: node tools/polish-chinese-copy.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const configDir = path.join(root, 'config', 'v1');

/** 全文替换：先匹配较长串，避免部分替换 */
const GLOBAL_REPLACEMENTS = [
  [
    '洗漱镜子里的人看上去疲惫却安定：还行，还在轨道上。你没写给谁的总结，却在心里默默点了点头。',
    '镜中的你有些疲惫，眼神却很稳。你没写下总结，却在心里默默点了点头。',
  ],
  [
    '你把这一天轻轻合上本子：不算轰轰烈烈，但踏踏实实地往前挪了一小步。',
    '合上日记本，今天谈不上轰轰烈烈，却也算稳稳向前挪了一小步。',
  ],
  [
    '这些事不大，却把你的大学生活填得更具体了一点。',
    '这些事不大，却让大学生活更具体、更鲜活。',
  ],
  [
    '日历又翻过一格，你对「下一次会怎样」多了一分想象。',
    '时间又翻过一页，你对接下来的日子多了几分期待。',
  ],
  [
    '你给自己记了一笔小账：时间花出去了，心也安了一点。',
    '你在心里默默结算：时间没白花，人也踏实了些。',
  ],
  [
    '你把耳机戴上又摘下，最后决定安静地和这一天道别。',
    '夜深了，你摘下耳机，安静地结束了这一天。',
  ],
  [
    '洗漱镜子里的人看上去疲惫却安定：还行，还在轨道上。',
    '镜中的你有些疲惫，眼神却很稳——日子还在正轨上。',
  ],
  [
    '走在路上你也说不清楚收获了什么，但就是觉得心里多了点底气。',
    '你说不清具体收获了什么，心里却多了几分底气。',
  ],
  ['挂科连环触发预警，学分危机把你按在现实里摩擦。', '挂科接连触发学业预警，学分压力把你狠狠拉回现实。'],
  [
    '你突然觉得，大学不只是绩点和竞赛，还有这些热气腾腾的夜晚。窗外天色暗下去，你心里却亮了一点点。',
    '你突然觉得，大学不只有绩点和竞赛，还有这些热气腾腾的夜晚。天色渐暗，心里却亮了一分。',
  ],
  ['你摸了摸口袋里的校园卡，突然觉得它和今天的你很合拍。', '你摸了摸口袋里的校园卡，觉得它跟今天的你很合拍。'],
  ['舍友问你干嘛傻笑，你说没事——其实只是心情还行。', '舍友问你为什么傻笑，你说没事——其实只是心情不错。'],
  [
    '风把窗帘吹动一下，你忽然觉得：日子就是这样，慢慢堆出来的。',
    '风把窗帘轻轻吹动，你忽然觉得：日子就是这样一天天叠出来的。',
  ],
  ['整个人像被市场按在地上摩擦', '整个人像被行情狠狠按在地上'],
  ['你差点没绷住。', '你差点没忍住眼泪。'],
  ['支支吾吾地糊弄过去了', '支支吾吾地应付了过去'],
  ['支支吾吾地回答了', '支支吾吾地作答'],
  ['不算惊艳，但足够真实——你接受这样的日常。', '结果不算亮眼，但你坦然接受了这样的日常。'],
  [
    '你在货架之间绕了很久，试吃、试闻、试穿样样都来了一遍——最后什么都没结账。售货员的微笑有点僵，但你觉得自己省下了一笔「情绪税」。',
    '你在货架之间绕了很久，试吃、试闻、试穿样样都来了一遍——最后什么都没结账。售货员的笑容有点僵，但你觉得自己省下了一笔冤枉钱。',
  ],
];

/** 学期总结 body：保留占位符，理顺语序 */
const SEMESTER_BODY_MAP = {
  '{name}把这学期焊在了{topAction}上，×{topActionCount}次像极了签到氪金。':
    '{name}这学期几乎都泡在{topAction}里，一共 {topActionCount} 次，像把打卡当成了日常仪式。',
  '{name}在「卷」与「躺」之间横跳，{topAction}×{topActionCount}是最诚实的时间账。':
    '{name}在「卷」和「躺」之间来回切换，{topAction} 做了 {topActionCount} 次，是最直观的时间账本。',
  '期末周那句老话：DDL是第一生产力。{name}用{topAction}×{topActionCount}交了本学期电费。':
    '期末周那句老话：DDL 是第一生产力。{name}靠 {topAction} 撑了 {topActionCount} 次，把这学期的电量交足了。',
  '{name}嘴上佛系身体诚实，{topAction}×{topActionCount}给人设打补丁。':
    '{name}嘴上佛系、身体却很诚实，{topAction} 做了 {topActionCount} 次，悄悄给「人设」补了补丁。',
  '{name}恋爱线与任务线偶尔串台，{topAction}×{topActionCount}记了主线进度。':
    '{name}恋爱线和任务线偶尔撞车，{topAction} 做了 {topActionCount} 次，主线进度仍在往前推。',
  '{name}人脉圈像路由器，{topAction}×{topActionCount}是最稳的信道。':
    '{name}人脉圈像路由器，{topAction} 做了 {topActionCount} 次，是最稳的连接信道。',
  '{name}把复习做成仪式，{topAction}×{topActionCount}是背景音乐。':
    '{name}把复习做成仪式，{topAction} 做了 {topActionCount} 次，像一直循环的背景音乐。',
  '{name}在教室食堂折返，{topAction}×{topActionCount}写满通勤叙事。':
    '{name}在教室和食堂之间来回折返，{topAction} 做了 {topActionCount} 次，写满通勤日常。',
  '{name}花钱刀刃一半奶茶一半，{topAction}×{topActionCount}算刀刃。':
    '{name}花钱讲究刀刃，一半奶茶一半刚需，{topAction} 做了 {topActionCount} 次，算刀刃上的选择。',
  '{name}本学期人设更新，{topAction}×{topActionCount}是补丁说明。':
    '{name}本学期人设悄悄更新，{topAction} 做了 {topActionCount} 次，像补丁说明一样具体。',
  '{name}健康条过山车，{topAction}×{topActionCount}像安全带。':
    '{name}健康状态像过山车，{topAction} 做了 {topActionCount} 次，像系上的安全带。',
  '{name}田野调查式上学：{topAction}×{topActionCount}是采样次数。':
    '{name}像在做田野调查一样上学，{topAction} 做了 {topActionCount} 次，都是采样次数。',
  '{name}拖延也在进化：{topAction}×{topActionCount}至少准时。':
    '{name}拖延症也在进化，{topAction} 做了 {topActionCount} 次，至少还能准时交差。',
  '{name}焦虑调静音，{topAction}×{topActionCount}仍有推送。':
    '{name}把焦虑调成了静音，{topAction} 做了 {topActionCount} 次，提醒仍会偶尔弹出。',
  '{name}实习邮箱像许愿池，{topAction}×{topActionCount}像保底掉落。':
    '{name}实习邮箱像许愿池，{topAction} 做了 {topActionCount} 次，像保底掉落一样踏实。',
  '{name}恋爱副本慢加载，{topAction}×{topActionCount}先刷日常。':
    '{name}恋爱线还在慢加载，{topAction} 做了 {topActionCount} 次，先把日常刷稳。',
  '{name}熬夜像追剧式补课，{topAction}×{topActionCount}写脚注。':
    '{name}熬夜像追剧式补课，{topAction} 做了 {topActionCount} 次，在笔记里写下脚注。',
  '{name}寝室热播剧：{topAction}×{topActionCount}花絮。':
    '{name}寝室像热播剧现场，{topAction} 做了 {topActionCount} 次，都是花絮素材。',
  '{name}体育场常客巩固：{topAction}×{topActionCount}。':
    '{name}成了体育场常客，{topAction} 做了 {topActionCount} 次，状态慢慢巩固。',
  '{name}考证路线打卡：{topAction}×{topActionCount}补给站。':
    '{name}在考证路上打卡，{topAction} 做了 {topActionCount} 次，像路上的补给站。',
  '{name}科研曲线陡：{topAction}×{topActionCount}标坡度。':
    '{name}科研进度曲线很陡，{topAction} 做了 {topActionCount} 次，标出了坡度。',
  '{name}副业像盲盒：{topAction}×{topActionCount}还行。':
    '{name}副业像开盲盒，{topAction} 做了 {topActionCount} 次，结果还算过得去。',
  '{name}朴素金钱观：先活再优雅；{topAction}×{topActionCount}负责活。':
    '{name}金钱观很朴素：先活下去再谈优雅；{topAction} 做了 {topActionCount} 次，负责把日子撑住。',
  '{name}社交能量起伏：{topAction}×{topActionCount}稳定输出。':
    '{name}社交能量起起伏伏，{topAction} 做了 {topActionCount} 次，输出还算稳定。',
  '{name}复盘关键词稳：细节{topAction}×{topActionCount}。':
    '{name}复盘时关键词很稳：细节、{topAction}，一共 {topActionCount} 次。',
  '{name}早八刺客命中膝盖：{topAction}×{topActionCount}包扎。':
    '{name}早八像刺客一样命中膝盖，{topAction} 做了 {topActionCount} 次，算给伤口包扎。',
  '{name}做题家血脉：{topAction}×{topActionCount}。':
    '{name}做题家血脉还在，{topAction} 做了 {topActionCount} 次。',
  '{name}心态钟摆：{topAction}×{topActionCount}记摆动。':
    '{name}心态像钟摆来回晃，{topAction} 做了 {topActionCount} 次，记下每一次摆动。',
  '{name}前排不多故事多：{topAction}×{topActionCount}。':
    '{name}前排座位不多，故事却不少：{topAction} 做了 {topActionCount} 次。',
  '{name}把玩笑揉进生活：{topAction}×{topActionCount}伏笔。':
    '{name}把玩笑揉进生活，{topAction} 做了 {topActionCount} 次，都像伏笔。',
  '{name}赛季结算感：{topAction}×{topActionCount}。':
    '{name}这学期有赛季结算的感觉，{topAction} 做了 {topActionCount} 次。',
  '{name}睡眠随机播：{topAction}×{topActionCount}。':
    '{name}睡眠像随机播放，{topAction} 做了 {topActionCount} 次。',
  '{name}论文裁缝：{topAction}×{topActionCount}。':
    '{name}像论文裁缝一样缝缝补补，{topAction} 做了 {topActionCount} 次。',
  '{name}宿舍外交：{topAction}×{topActionCount}。':
    '{name}在宿舍搞起了外交，{topAction} 做了 {topActionCount} 次。',
  '{name}健康优先偶翻：{topAction}×{topActionCount}。':
    '{name}把健康放在首位，偶尔也会翻车；{topAction} 做了 {topActionCount} 次。',
  '{name}搞钱脑间歇：{topAction}×{topActionCount}。':
    '{name}搞钱念头间歇发作，{topAction} 做了 {topActionCount} 次。',
  '{name}恋爱支线：{topAction}×{topActionCount}。':
    '{name}恋爱支线在推进，{topAction} 做了 {topActionCount} 次。',
  '{name}主线活着：{topAction}×{topActionCount}。':
    '{name}主线仍是好好活着，{topAction} 做了 {topActionCount} 次。',
  '{name}长篇小说感：{topAction}×{topActionCount}。':
    '{name}这学期像一部长篇小说，{topAction} 做了 {topActionCount} 次。',
  '{name}闭馆音乐听：{topAction}×{topActionCount}。':
    '{name}听过不少闭馆音乐，{topAction} 做了 {topActionCount} 次。',
  '{name}周末像赠品：{topAction}×{topActionCount}。':
    '{name}周末像附赠的小憩，{topAction} 做了 {topActionCount} 次。',
  '{name}把自己养成号：{topAction}×{topActionCount}。':
    '{name}慢慢把自己养成想要的样子，{topAction} 做了 {topActionCount} 次。',
};

const JSON_FILES = [
  'events.json',
  'actions.json',
  'randomEvents.json',
  'endings.json',
  'semesterSummaries.json',
];

function applyReplacements(text) {
  let out = text;
  for (const [from, to] of GLOBAL_REPLACEMENTS) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}

function polishSemesterSummaries(data) {
  let n = 0;
  for (const row of data) {
    if (row.body && SEMESTER_BODY_MAP[row.body]) {
      row.body = SEMESTER_BODY_MAP[row.body];
      n++;
    }
    if (row.title) {
      row.title = row.title
        .replace(/串台了/g, '撞车了')
        .replace(/花呗失忆/g, '钱包见底')
        .replace(/伪博主/g, '夜跑常客')
        .replace(/把这学期过成副本通关/g, '把这学期当成副本通关')
        .replace(/办了会员卡/g, '办了长期会员卡');
    }
  }
  return n;
}

function walkAndPolish(obj) {
  if (typeof obj === 'string') return applyReplacements(obj);
  if (Array.isArray(obj)) return obj.map(walkAndPolish);
  if (obj && typeof obj === 'object') {
    const next = {};
    for (const [k, v] of Object.entries(obj)) next[k] = walkAndPolish(v);
    return next;
  }
  return obj;
}

let total = 0;
for (const file of JSON_FILES) {
  const fp = path.join(configDir, file);
  const raw = fs.readFileSync(fp, 'utf8');
  let data = JSON.parse(raw);
  if (file === 'semesterSummaries.json') {
    total += polishSemesterSummaries(data);
  }
  data = walkAndPolish(data);
  fs.writeFileSync(fp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`polished ${file}`);
}
console.log(`semester body rows: ${total}`);
