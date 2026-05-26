/**
 * v4 规则：8 学期主轴 + 周行动 + 扩展玩法系统。
 */
export const RULES_VERSION = 'v4';

/** @typedef {'comprehensive'|'polytech'|'local'|'normal_key'|'finance'|'teacher'|'med'|'sino_foreign'} SchoolId */
/** @typedef {'cs'|'biz'|'liberal'|'se'|'ee'|'ai'|'data_science'|'law'|'finance_major'|'news'|'medicine'|'civil_exam'} MajorId */

/** 学校：影响初始属性 */
export const SCHOOLS = {
  top2: {
    id: 'top2',
    name: '清北复交联盟',
    tagline: '早八排队像春运抢票，人均「小镇做题家」满级转世；选这里你会拿到更高的绩点地板与实习敲门砖，同时领取高压加班体验卡和社交内卷入场券。',
    effects: { gpa: 0.15, skill: 8, pressure: 10, social: 5 },
    collegeSystem: true,
    topTier: true,
  },
  comprehensive: {
    id: 'comprehensive',
    name: '双一流综合大学',
    tagline: '大一书院让你假装文理兼修，大二分流瞬间回到真实专业线；嘴上说是「什么都会一点」——选这里你会得到更宽的社交开局与通识缓冲，适合把自己升级成六边形预备役。',
    effects: { social: 8, skill: 2 },
    collegeSystem: true,
  },
  polytech: {
    id: 'polytech',
    name: '985 理工强校',
    tagline: '别人谈恋爱你焊板子，别人放假你调参——俗称「理工的浪漫」；选这里你会获得更高的硬技能起点与项目履历厚度，代价是睡眠像限量皮肤和 ddl 像早八刺客。',
    effects: { skill: 10, pressure: 5 },
    collegeSystem: true,
  },
  local: {
    id: 'local',
    name: '省属重点大学',
    tagline: '宿舍冷热水稳定，奖助学金每月按时打卡；节奏松、成就感来得真切，像「反卷养生服」。选这里你会得到更多生活费缓冲与健康底气，适合先把游戏走顺一遍再追求上限。',
    effects: { money: 300, health: 5 },
  },
  normal_key: {
    id: 'normal_key',
    name: '211 重点大学',
    tagline: '朋友圈封面写着「冲双一流」，现实是「早八从不缺席」；选这里你会拿到扎实的课业加成与还不错的社交盘子，压力适中——典型的「比上不足比下有余」舒适暴击区。',
    effects: { gpa: 0.08, pressure: 4, social: 3 },
  },
  finance: {
    id: 'finance',
    name: '两财一贸',
    tagline: '实习 jd 比课表还密，群公告响得像交易所开盘铃；选这里你会拿到更强的现金流与社会连接筹码，同时学会用一杯美式假装自己已经去过陆家嘴。',
    effects: { money: 500, social: 8, pressure: 6 },
  },
  teacher: {
    id: 'teacher',
    name: '部属师范院校',
    tagline: '走廊里都在讨论板书与班级管理，像进了「未来班主任」DLC；选这里你会得到稳定的学业与健康加成，以及天然的人民教师光环——虽然你可能只想先把教师资格证啃下来。',
    effects: { gpa: 0.12, health: 4, skill: 2 },
  },
  med: {
    id: 'med',
    name: '医学类院校',
    tagline: '厚度堪比砖头的教材 + 永远不够的睡眠 = 医学生经典开局；选这里你会拿到超高的能力成长曲线与硬核履历，也要习惯「背书是第一生产力、发际线是限量周边」。',
    effects: { skill: 6, pressure: 12, health: -4 },
  },
  sino_foreign: {
    id: 'sino_foreign',
    name: '中外合办学院',
    tagline: '全英文授课让你假装留学生，账单提醒你仍是本地人；选这里你会收获双语技能与国际人脉buff，同时学会在汇率与生活成本之间优雅裂开。',
    effects: { skill: 7, social: 7, money: -600 },
  },
  art_academy: {
    id: 'art_academy',
    name: '艺术类院校',
    tagline: '作品集比绩点更响亮，凌晨画室属于常态档；选这里你会拿到更高的审美与社会表现力筹码，以及一句挂在嘴边的「DDL 是第一生产力」。',
    effects: { skill: 4, social: 6, health: 2, pressure: 3 },
  },
  military_academy: {
    id: 'military_academy',
    name: '军事院校',
    tagline: '起床号比闹钟狠，被子叠成豆腐块像在读几何证明；选这里你会拿到顶尖的体质与执行力加成，也会明白什么叫「统一发型才是最潮单品」。',
    effects: { health: 10, skill: 6, pressure: 8, social: -2 },
  },
  agricultural: {
    id: 'agricultural',
    name: '农林类院校',
    tagline: '实验地里读懂二十四节气，朋友圈晒的不是打卡是秧苗；选这里你会得到扎实的动手能力与额外的生活补贴感——乡土气拉满，踏实得像有机肥。',
    effects: { health: 6, skill: 3, money: 200, pressure: 2 },
  },
  foreign_language: {
    id: 'foreign_language',
    name: '外语类院校',
    tagline: '晨读像合唱节，演讲比赛像主播选秀；选这里你会获得顶尖的社交与语言能力加成，顺便认识一群能把「中式英语」说成潮流的态度选手。',
    effects: { social: 10, skill: 4, gpa: 0.05, pressure: 3 },
  },
  police_academy: {
    id: 'police_academy',
    name: '政法类院校',
    tagline: '宪法刑法两手抓，操场跑道也在盯你的意志力；选这里你会拿到更硬的综合素质与社会通道门票——前提是你跑得动也背得下。',
    effects: { skill: 5, pressure: 7, social: 4, money: 150 },
  },
  vocational: {
    id: 'vocational',
    name: '职业技术大学',
    tagline: '车间里练的是真本事，简历上写的是「已能干活」；选这里你会得到可观的钱包成长与就业向技能树，适合走「少谈情怀多拧螺丝」的稳健路线。',
    effects: { skill: 8, money: 400, gpa: -0.05, pressure: 2 },
  },
};

/** 专业 */
export const MAJORS = {
  cs: {
    id: 'cs',
    name: '计算机科学与技术',
    tagline: 'OJ 刷到键盘油亮，操作系统期末像公开处刑现场；私下自封「面向 Stack Overflow 编程」。选这条线你会拿到硬核工程履历，也要习惯绩点像过山车、简历像 Git 提交记录一样越堆越亮。',
    effects: { skill: 8, pressure: 6, gpa: -0.05 },
  },
  biz: {
    id: 'biz',
    name: '工商管理',
    tagline: '课堂讲波特五力，社团搞创业路演，群里转发麦克·波特你自己；选这里你会得到更强的社交与现金流开局，适合想当「人脉富二代」的你先从 PPT 富二代做起。',
    effects: { social: 8, money: 200, gpa: 0.05 },
  },
  liberal: {
    id: 'liberal',
    name: '汉语言文学',
    tagline: '鲁迅语录随手甩，论文脚注写到手软——大家都说读懂段子却读不懂绩点。选这里你会拿到出色的写作与通识加成，身体也比理工狗友好一点。',
    effects: { gpa: 0.15, health: 4, skill: -2 },
  },
  se: {
    id: 'se',
    name: '软件工程',
    tagline: '需求一改全员暴走，Git 冲突比寝室矛盾还难调解；选这里你会叠满工程实践 buff，也要习惯 ddl 面前人人都是「临时产品经理」。',
    effects: { skill: 10, pressure: 8, gpa: -0.08 },
  },
  ee: {
    id: 'ee',
    name: '电子信息工程',
    tagline: '示波器屏幕上藏着真理，焊锡味比香水更上头；选这里你会拿到扎实的硬件与系统思维，偶尔还会收获「头发换波形」的隐藏成就。',
    effects: { skill: 7, pressure: 5, gpa: -0.03 },
  },
  law: {
    id: 'law',
    name: '法学',
    tagline: '民法刑法行政法，三门神器背到怀疑 DNA；嘴上自嘲「我不是法盲我只是还没背完」。选这里你会拿到考公法考双线路门票，压力也在合理区间爆表。',
    effects: { gpa: 0.08, pressure: 7, social: 4, skill: 3 },
  },
  ai: {
    id: 'ai',
    name: '人工智能',
    tagline: 'Attention is all you need，显卡比你对象还珍贵；选这里你会拿到最高的技能成长上限，以及一句室友听不懂的「我在调参不是在打游戏」。',
    effects: { skill: 12, pressure: 10, gpa: -0.1 },
  },
  data_science: {
    id: 'data_science',
    name: '数据科学与大数据技术',
    tagline: 'Excel 只是入门皮肤，SQL 与 Python 才是主武器；选这里你会拿到分析岗敲门砖，也要习惯「数据不会说谎但会打脸」。',
    effects: { skill: 9, pressure: 7, gpa: -0.06 },
  },
  finance_major: {
    id: 'finance_major',
    name: '金融学',
    tagline: 'DCF 模型画到天亮，群里流传「韭菜的自我修养」；选这里你会拿到金钱与人脉双加成，顺便学会用 Excel 假装自己已经华尔街出道。',
    effects: { money: 300, social: 7, pressure: 5 },
  },
  news: {
    id: 'news',
    name: '新闻传播学',
    tagline: '选题会比谈恋爱还纠结，热点跑得比早八还快；选这里你会把社交与表达点满，适合想当「内容民工」里最会整活的那一个。',
    effects: { social: 10, gpa: 0.06, pressure: 4 },
  },
  medicine: {
    id: 'medicine',
    name: '临床医学',
    tagline: '蓝色生死恋不是爱情是教材厚度；选这里你会拿到令人尊敬的硬实力曲线，以及永远不够的睡眠条——那句老话你我都懂，后半句通常不敢当面说。',
    effects: { skill: 7, pressure: 11, health: -5, gpa: 0.1 },
  },
  civil_exam: {
    id: 'civil_exam',
    name: '公共管理',
    tagline: '案例分析像申论预习，小组作业像基层实训；选这里你会拿到稳健的绩点与上岸预备姿态，适合认定「铁饭碗也是一种浪漫」。',
    effects: { gpa: 0.1, pressure: 3, social: 5 },
  },
};

/** 学制 */
export const TOTAL_SEMESTERS = 8;
/** 学期节奏配置 */
export const SEMESTER_PACING = {
  weeksPerSemester: 4,
};
/** 每学期周行动次数 */
export const WEEKS_PER_SEMESTER = SEMESTER_PACING.weeksPerSemester;
/** 兼容旧逻辑：每局学期数 */
export const EVENTS_PER_RUN = TOTAL_SEMESTERS;

/** 周行动「购物」外出路费（确认选购时计入总价） */
export const WEEKLY_SHOP_TRANSIT_FEE = 12;

/**
 * 周行动购物界面货架：itemId + 单价（校园店/便利店）
 * 物品需在 config/v1/items.json 与 catalog 中存在。
 */
export const WEEKLY_SHOP_STOCK = [
  { itemId: 'item_coffee_coupon', price: 24 },
  { itemId: 'item_study_notes', price: 66 },
  { itemId: 'item_gym_card', price: 132 },
  { itemId: 'item_savings_book', price: 68 },
  { itemId: 'item_meal_card', price: 96 },
  { itemId: 'item_sleep_patch', price: 108 },
  { itemId: 'item_exam_luck', price: 46 },
  { itemId: 'item_mentor_letter', price: 148 },
];

/** 三层目标系统配置 */
export const GOAL_SYSTEM_CONFIG = {
  semesterGoalCount: 3,
};

/** 主目标候选（毕业导向） */
export const CORE_GOAL_TEMPLATES = [
  { id: 'core_academic', title: '学术进阶', desc: '把绩点和能力打到稳定高线，争取高质量毕业履历。' },
  { id: 'core_career', title: '就业冲刺', desc: '围绕实习与技能累积，毕业前拿到更稳的就业机会。' },
  { id: 'core_relationship', title: '关系经营', desc: '经营同学、导师与亲密关系，走出更完整的人际成长线。' },
  { id: 'core_survival', title: '稳态生存', desc: '优先守住健康、压力与现金流，确保四年平稳通关。' },
];

export const DEFAULT_UNLOCKED_SCHOOLS = ['comprehensive', 'local', 'polytech'];
export const DEFAULT_UNLOCKED_MAJORS = ['cs', 'biz', 'liberal'];

/** 解锁规则：支持 any 子规则（任一满足即可）；与旧版单一条件并存 */
export const UNLOCK_RULES = {
  schools: {
    art_academy: { playCount: 1 },
    vocational: { playCount: 1 },
    normal_key: { playCount: 2 },
    agricultural: { playCount: 2 },
    finance: { playCount: 3 },
    foreign_language: { playCount: 3 },
    top2: {
      any: [
        { playCount: 5 },
        { achievement: 'ach_gpa_top' },
      ],
    },
    military_academy: {
      any: [
        { playCount: 5 },
        { achievement: 'ach_discipline' },
      ],
    },
    teacher: {
      any: [
        { playCount: 5 },
        { achievement: 'ach_student_work' },
      ],
    },
    med: {
      any: [
        { playCount: 5 },
        { achievement: 'ach_hardcore' },
      ],
    },
    sino_foreign: { ending: 'end_startup' },
    police_academy: { ending: 'end_civil_pass' },
  },
  majors: {
    se: { playCount: 1 },
    ee: { playCount: 3 },
    ai: { playCount: 2 },
    data_science: { playCount: 2 },
    law: { achievement: 'ach_civil_track' },
    finance_major: { ending: 'end_bigtech' },
    news: { achievement: 'ach_romance_route' },
    medicine: { achievement: 'ach_hardcore' },
    civil_exam: { ending: 'end_civil_pass' },
  },
};

/**
 * 学校-专业混合模型：
 * - core: 强相关专业（优先）
 * - cross: 可选跨学科专业（会触发体验修正）
 */
export const SCHOOL_MAJOR_MATRIX = {
  top2: {
    core: ['cs', 'se', 'ee', 'ai', 'data_science', 'biz', 'liberal', 'law', 'finance_major', 'news', 'medicine', 'civil_exam'],
    cross: [],
  },
  comprehensive: {
    core: ['cs', 'biz', 'liberal', 'law', 'news'],
    cross: ['se', 'ee', 'ai', 'data_science', 'finance_major', 'civil_exam', 'medicine'],
  },
  polytech: {
    core: ['cs', 'se', 'ee', 'ai', 'data_science'],
    cross: ['biz', 'finance_major', 'news'],
  },
  local: {
    core: ['biz', 'liberal', 'news', 'civil_exam'],
    cross: ['cs', 'se', 'ai', 'law'],
  },
  normal_key: {
    core: ['liberal', 'law', 'news', 'civil_exam'],
    cross: ['biz', 'cs', 'data_science', 'finance_major'],
  },
  finance: {
    core: ['biz', 'finance_major', 'law'],
    cross: ['cs', 'news', 'ai', 'data_science'],
  },
  teacher: {
    core: ['liberal', 'news', 'civil_exam'],
    cross: ['law', 'biz', 'data_science'],
  },
  med: {
    core: ['medicine'],
    cross: ['cs', 'liberal', 'data_science'],
  },
  sino_foreign: {
    core: ['biz', 'news', 'cs'],
    cross: ['finance_major', 'law', 'ai', 'data_science', 'se'],
  },
  art_academy: {
    core: ['liberal', 'news'],
    cross: ['biz', 'cs', 'ai'],
  },
  military_academy: {
    core: ['civil_exam', 'ee'],
    cross: ['cs', 'medicine', 'ai', 'data_science'],
  },
  agricultural: {
    core: ['medicine', 'ee'],
    cross: ['biz', 'cs', 'data_science'],
  },
  foreign_language: {
    core: ['liberal', 'news', 'biz'],
    cross: ['cs', 'finance_major', 'law', 'ai'],
  },
  police_academy: {
    core: ['civil_exam', 'law'],
    cross: ['biz', 'news', 'data_science'],
  },
  vocational: {
    core: ['cs', 'ee', 'biz'],
    cross: ['finance_major', 'news', 'ai', 'data_science', 'se'],
  },
};

export const CROSS_MAJOR_EFFECTS = {
  gpa: -0.12,
  pressure: 8,
  health: -2,
  social: 2,
};

/**
 * 学校层：课业强度 / 实习就业向体感权重，写入 schoolMajorMeta（不与 stats 直接相加）。
 */
export const SCHOOL_RUN_BIAS = {
  top2: { courseIntensity: 1.1, internshipLean: 1.08 },
  comprehensive: { courseIntensity: 1.04, internshipLean: 1.02 },
  polytech: { courseIntensity: 1.12, internshipLean: 1.06 },
  local: { courseIntensity: 0.94, internshipLean: 0.94 },
  normal_key: { courseIntensity: 1.0, internshipLean: 0.98 },
  finance: { courseIntensity: 1.02, internshipLean: 1.14 },
  teacher: { courseIntensity: 0.98, internshipLean: 0.9 },
  med: { courseIntensity: 1.14, internshipLean: 0.86 },
  sino_foreign: { courseIntensity: 1.03, internshipLean: 1.1 },
  art_academy: { courseIntensity: 0.95, internshipLean: 0.88 },
  military_academy: { courseIntensity: 1.08, internshipLean: 0.84 },
  agricultural: { courseIntensity: 0.98, internshipLean: 0.92 },
  foreign_language: { courseIntensity: 1.0, internshipLean: 1.06 },
  police_academy: { courseIntensity: 1.06, internshipLean: 0.94 },
  vocational: { courseIntensity: 0.93, internshipLean: 1.08 },
};

/** 专业层：与 MAJORS 键一致；缺省视为 1 / 1 */
export const MAJOR_RUN_BIAS = {
  cs: { courseIntensity: 1.04, internshipLean: 1.1 },
  biz: { courseIntensity: 0.98, internshipLean: 1.05 },
  liberal: { courseIntensity: 1.0, internshipLean: 0.84 },
  se: { courseIntensity: 1.06, internshipLean: 1.08 },
  ee: { courseIntensity: 1.06, internshipLean: 1.04 },
  ai: { courseIntensity: 1.1, internshipLean: 1.12 },
  data_science: { courseIntensity: 1.08, internshipLean: 1.1 },
  law: { courseIntensity: 1.08, internshipLean: 0.9 },
  finance_major: { courseIntensity: 1.02, internshipLean: 1.14 },
  news: { courseIntensity: 0.99, internshipLean: 1.0 },
  medicine: { courseIntensity: 1.12, internshipLean: 0.82 },
  civil_exam: { courseIntensity: 1.05, internshipLean: 0.9 },
};

/**
 * @param {string} schoolId
 * @param {string} majorId
 * @returns {{ isCoreMajor: boolean, isCrossMajor: boolean, courseIntensity: number, internshipLean: number }}
 */
export function buildSchoolMajorMeta(schoolId, majorId) {
  const majorRule = SCHOOL_MAJOR_MATRIX[schoolId] || { core: [], cross: [] };
  const isCoreMajor = majorRule.core.includes(majorId);
  const isCrossMajor = !isCoreMajor && majorRule.cross.includes(majorId);
  const sb = SCHOOL_RUN_BIAS[schoolId] || { courseIntensity: 1, internshipLean: 1 };
  const mb = MAJOR_RUN_BIAS[majorId] || { courseIntensity: 1, internshipLean: 1 };
  let courseIntensity = sb.courseIntensity * mb.courseIntensity;
  let internshipLean = sb.internshipLean * mb.internshipLean;
  if (isCrossMajor) {
    courseIntensity *= 1.04;
    internshipLean *= 0.98;
  }
  courseIntensity = Math.min(1.32, Math.max(0.7, courseIntensity));
  internshipLean = Math.min(1.32, Math.max(0.7, internshipLean));
  return {
    isCoreMajor,
    isCrossMajor,
    courseIntensity,
    internshipLean,
  };
}

/**
 * 学校 × 专业 运行时数值修正（叠在学校/专业基础与跨学科惩罚之后），体现同专业不同校的差异。
 * 仅列出非零项；键必须存在于 SCHOOLS、MAJORS 与对应校的 SCHOOL_MAJOR_MATRIX。
 */
export const SCHOOL_MAJOR_MODIFIERS = {
  top2: {
    cs: { pressure: 4, skill: 2 },
    law: { pressure: 5, gpa: 0.06 },
    medicine: { pressure: 4, skill: 3 },
    ai: { pressure: 5, skill: 3 },
    data_science: { pressure: 4, skill: 2 },
  },
  comprehensive: {
    liberal: { social: 4, gpa: 0.04 },
    law: { social: 3, gpa: 0.03 },
    news: { social: 3 },
    ai: { skill: 2, pressure: 3 },
    data_science: { skill: 2, gpa: -0.03 },
  },
  polytech: {
    cs: { skill: 3, pressure: 2 },
    se: { skill: 3, pressure: 3 },
    ee: { skill: 2, pressure: 2 },
    ai: { skill: 3, pressure: 4 },
    data_science: { skill: 2, pressure: 3 },
  },
  local: {
    biz: { money: 150, pressure: -2 },
    civil_exam: { gpa: 0.05, social: 2 },
  },
  normal_key: {
    law: { gpa: 0.04, pressure: 3 },
    liberal: { gpa: 0.05 },
  },
  finance: {
    finance_major: { money: 200, social: 3, pressure: 2 },
    biz: { money: 100, social: 2 },
    law: { social: 2, pressure: 2 },
    ai: { skill: 2, social: 2, pressure: 1 },
    data_science: { skill: 2, money: 100, pressure: 1 },
  },
  teacher: {
    liberal: { gpa: 0.08, health: 2 },
    civil_exam: { gpa: 0.06, social: 3 },
    news: { social: 4 },
  },
  med: {
    medicine: { skill: 4, pressure: 4, health: -3 },
  },
  sino_foreign: {
    biz: { social: 4, money: -100 },
    cs: { skill: 3, social: 2 },
    news: { social: 3 },
    ai: { skill: 3, social: 3 },
    data_science: { skill: 2, social: 2 },
  },
  art_academy: {
    liberal: { social: 4, skill: 2 },
    news: { social: 5, pressure: 2 },
  },
  military_academy: {
    civil_exam: { pressure: 3, skill: 2 },
    ee: { skill: 2, pressure: 2 },
  },
  agricultural: {
    medicine: { health: 3, skill: 2 },
    ee: { skill: 2 },
  },
  foreign_language: {
    news: { social: 4, gpa: 0.04 },
    liberal: { gpa: 0.05, social: 3 },
  },
  police_academy: {
    law: { skill: 4, pressure: 5 },
    civil_exam: { gpa: 0.06, social: 2 },
  },
  vocational: {
    cs: { skill: 3, money: 100 },
    ee: { skill: 3, money: 80 },
    biz: { money: 150, social: 2 },
  },
};

/** 属性边界 */
export const STAT_LIMITS = {
  gpa: { min: 0, max: 4 },
  money: { min: 0, max: 999999 },
  health: { min: 0, max: 100 },
  social: { min: 0, max: 100 },
  skill: { min: 0, max: 100 },
  pressure: { min: 0, max: 100 },
};

export const INITIAL_STATS = {
  gpa: 2.8, // 稍微降低初始绩点
  money: 2000,
  health: 80,
  social: 50,
  skill: 45,
  pressure: 28,
};

/** 属性阈值效果 */
export const ATTRIBUTE_THRESHOLDS = {
  pressureHigh: 85,
  healthLow: 35,
  moneyLow: 500,
  socialHigh: 72,
};

/** 难度：影响数值平滑、负面放大、坏结局判定与日常阈值 */
export const DEFAULT_DIFFICULTY = 'normal';

/**
 * @param {string} [difficulty]
 * @returns {{ effectScale: number, negativeMult: number }}
 */
export function getDifficultyTuning(difficulty) {
  const d = difficulty === 'easy' || difficulty === 'hard' ? difficulty : 'normal';
  if (d === 'easy') return { effectScale: 0.62, negativeMult: 0.82 };
  if (d === 'hard') return { effectScale: 0.58, negativeMult: 1.22 };
  return { effectScale: 0.6, negativeMult: 1 };
}

/**
 * 结算时对「严苛结局」条件的统计阈值偏移（仅应用于 resolveEnding 中的部分结局）
 * easy：更难触发坏结局；hard：更容易触发
 * @param {string} [difficulty]
 * @returns {{ healthLte: number, pressureGte: number, gpaLte: number, moneyLte: number }}
 */
export function getEndingStatAdjust(difficulty) {
  const d = difficulty === 'easy' || difficulty === 'hard' ? difficulty : 'normal';
  if (d === 'easy') return { healthLte: -3, pressureGte: 3, gpaLte: -0.12, moneyLte: -45 };
  if (d === 'hard') return { healthLte: 3, pressureGte: -5, gpaLte: 0.1, moneyLte: 45 };
  return { healthLte: 0, pressureGte: 0, gpaLte: 0, moneyLte: 0 };
}

export const HARSH_ENDING_IDS = [
  'end_dropout_health',
  'end_burnout',
  'end_dropout_gpa',
  'end_cashflow_crisis',
];

/**
 * @param {string} [difficulty]
 */
export function getAttributeThresholdsForDifficulty(difficulty) {
  const d = difficulty === 'easy' || difficulty === 'hard' ? difficulty : 'normal';
  if (d === 'easy') return { ...ATTRIBUTE_THRESHOLDS, pressureHigh: 88, healthLow: 32 };
  if (d === 'hard') return { ...ATTRIBUTE_THRESHOLDS, pressureHigh: 81, healthLow: 38 };
  return { ...ATTRIBUTE_THRESHOLDS };
}

export function clampStats(stats) {
  const out = { ...stats };
  Object.keys(STAT_LIMITS).forEach((key) => {
    const L = STAT_LIMITS[key];
    if (out[key] !== undefined) {
      out[key] = Math.max(L.min, Math.min(L.max, out[key]));
    }
  });
  return out;
}

/**
 * 创建新一局运行时状态
 * @param {SchoolId} schoolId
 * @param {MajorId} majorId
 * @param {{ difficulty?: string }} [options]
 */
export function createInitialRunState(schoolId, majorId, options = {}) {
  const school = SCHOOLS[schoolId];
  const major = MAJORS[majorId];
  const stats = { ...INITIAL_STATS };

  Object.entries(school.effects).forEach(([k, v]) => {
    if (stats[k] !== undefined) stats[k] += v;
  });
  Object.entries(major.effects).forEach(([k, v]) => {
    if (stats[k] !== undefined) stats[k] += v;
  });
  const majorRule = SCHOOL_MAJOR_MATRIX[schoolId] || { core: [], cross: [] };
  const isCoreMajor = majorRule.core.includes(majorId);
  const isCrossMajor = majorRule.cross.includes(majorId);
  if (!isCoreMajor && isCrossMajor) {
    Object.entries(CROSS_MAJOR_EFFECTS).forEach(([k, v]) => {
      if (stats[k] !== undefined) stats[k] += v;
    });
  }

  const comboModifier =
    SCHOOL_MAJOR_MODIFIERS[schoolId] && SCHOOL_MAJOR_MODIFIERS[schoolId][majorId]
      ? { ...SCHOOL_MAJOR_MODIFIERS[schoolId][majorId] }
      : null;
  if (comboModifier) {
    Object.entries(comboModifier).forEach(([k, v]) => {
      if (stats[k] !== undefined) stats[k] += v;
    });
  }

  const schoolMajorMeta = buildSchoolMajorMeta(schoolId, majorId);

  const rawD = options.difficulty || DEFAULT_DIFFICULTY;
  const difficulty = rawD === 'easy' || rawD === 'hard' ? rawD : 'normal';
  const pickedCoreGoal = CORE_GOAL_TEMPLATES[Math.floor(Math.random() * CORE_GOAL_TEMPLATES.length)] || CORE_GOAL_TEMPLATES[0];

  return {
    rulesVersion: RULES_VERSION,
    schoolId,
    majorId,
    difficulty,
    semesterIndex: 0,
    weekIndex: 0,
    phase: 'main_event',
    actionSlotsLeft: WEEKS_PER_SEMESTER,
    /** 旧字段兼容 */
    turn: 0,
    /** 本局已抽过的事件 id */
    usedEventIds: [],
    stats: clampStats(stats),
    flags: {},
    playerProfile: {
      name: '同学',
      gender: 'male',
    },
    pendingMainEvent: null,
    pendingSideEvent: null,
    inventory: [],
    statusEffects: [],
    relationships: {
      roommate: 50,
      mentor: 40,
      partner: 30,
      senior: 45,
    },
    npcRoster: {
      roommates: [],
      mentors: [],
      romanceCandidates: [],
      seniors: [],
      primaryMentor: null,
      partner: null,
    },
    npcAffinity: {},
    npcLastInteraction: {},
    npcEventHits: {},
    /** 本局选择记录，用于结算回顾 */
    log: [],
    /** 本局已触发过播放的 CG id（避免同局重复弹出） */
    triggeredCgIds: [],
    /** 近期突发事件 id（用于降权，避免连续重复） */
    recentRandomEventIds: [],
    schoolMajorMeta,
    goals: {
      coreGoalId: pickedCoreGoal.id,
      coreGoalTitle: pickedCoreGoal.title,
      coreGoalDesc: pickedCoreGoal.desc,
      semesterGoals: [],
      currentWeekGoal: null,
      completedWeekGoals: [],
      feedbackQueue: [],
    },
  };
}
