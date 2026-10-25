import './render';
import { SCREEN_WIDTH, SCREEN_HEIGHT, SAFE_TOP, SAFE_BOTTOM, DEVICE_PIXEL_RATIO } from './render';
import {
  TYPE,
  COLORS,
  font,
  alpha,
  clamp,
  easeOutCubic,
  roundRectPath,
  fillRoundRect,
  strokeRoundRect,
  drawGlassPanel,
  drawPaperPanel,
  drawSceneKicker,
  drawChevron,
  drawIcon,
  renderBackdrop,
  drawAmbientMotes,
} from './ui/designSystem';
import {
  createInitialRunState,
  SCHOOLS,
  MAJORS,
  SCHOOL_MAJOR_MATRIX,
  TOTAL_SEMESTERS,
  WEEKS_PER_SEMESTER,
  UNLOCK_RULES,
  DEFAULT_DIFFICULTY,
  GOAL_SYSTEM_CONFIG,
  WEEKLY_SHOP_STOCK,
  WEEKLY_SHOP_TRANSIT_FEE,
} from '../config/v1/rules.js';
import {
  pickMainEvent,
  pickSideEvent,
  applyChoiceOutcome,
  applyWeeklyAction,
  triggerRandomEvent,
  applyStatusEffects,
  maybeGrantItem,
  pushInventoryItem,
  useInventoryItem,
  resolveEnding,
  fallbackEvent,
} from './core/eventEngine';
import {
  eventsCatalog,
  endingsCatalog,
  achievementsCatalog,
  actionsCatalog,
  uiTheme,
  randomEventsCatalog,
  itemsCatalog,
  audioConfig,
  talentsCatalog,
  npcsCatalog,
} from './data/catalog';
import { seedNpcRuntime, adjustNpcAffinity } from './core/npcRuntime';
import {
  buildSemesterSummaryPopupText,
  attachSemesterTopAction,
  semesterSummaryTemplates,
} from './core/semesterSummary';
import * as save from './core/save';
import { showRewardedVideo, showInterstitial, warmUpAds } from './ads/adAdapter';
import { evaluateAchievements } from './core/achievements';
import BgmManager from './audio/bgmManager';
import {
  initShare,
  getLaunchShareInfo,
} from './core/share';

const ctx = canvas.getContext('2d');
/** 本周行动列表单行高度与可视行数（须与 renderPlay / 触摸滚动一致） */
const WEEK_ACTION_ROW_H = 62;
const WEEK_ACTION_MAX_VISIBLE = 5;

const MALE_NAMES = ['林逸', '陆远', '莫辰', '苏辞', '顾北', '沈星', '姜南', '贺景', '萧然', '周航', '庄羽', '季淮'];
const FEMALE_NAMES = ['宁夏', '沐秋', '浅浅', '予曦', '云汐', '柳晚', '苏晚', '林柚', '梦洁', '诗宜', '若冰', '晚晴'];
const MALE_AVATAR_IDS = ['avatar_male_1', 'avatar_male_2', 'avatar_male_3', 'avatar_male_4'];
const FEMALE_AVATAR_IDS = ['avatar_female_1', 'avatar_female_2', 'avatar_female_3', 'avatar_female_4'];

/** 天赋 specialEffects 字段 → 中文短说明（与 talentsCatalog 同步） */
const TALENT_SPECIAL_LABEL = {
  nightBonus: '夜间自习和熬夜类事件额外受益',
  dayPenalty: '白天上课或早间事件收益略减',
  morningBonus: '清晨自习与早起类行动效率更高',
  nightPenalty: '熬夜加成类事件收益下降',
  socialBonus: '社交向事件与结识人脉更易出彩',
  studyPenalty: '纯学习或绩点向选项收益略低',
  studyBonus: '学业与绩点向选项更易拿到高收益',
  socialPenalty: '社交活动收益或人脉积累略弱',
  luckBonus: '随机惊喜与小额好运判定加权',
  randomEvents: '更容易遇到趣味随机事件',
  moneyPenalty: '初始手头更紧，花钱事件更疼',
  partTimeBonus: '兼职与勤工类收益加权',
  foodBonus: '食堂和聚餐等干饭向事件更治愈',
  gamingBonus: '电竞和游戏向互动更有优势',
  sportsBonus: '锻炼与比赛类事件体质加成更高',
  artBonus: '文艺与创作向活动额外加成',
  moneyBonus: '赚钱与商机类事件更易获利',
  businessEvents: '创业和商赛类事件出现权重提高',
  deadlineBonus: '临近期末和截止期限时爆发类收益提高',
  earlyPenalty: '提前规划类选项收益略减',
  stressImmunity: '压力累积更慢、高压惩罚减轻',
  motivationPenalty: '冲劲与长期目标类选项收益略减',
  dramaBonus: '表演和演讲等场合魅力加成',
  attentionSeeking: '社交场合更容易成为焦点，也可能带来额外压力',
  memeBonus: '轻松吐槽与俏皮话类互动收益提高',
  viralEvents: '聊天斗图、热搜类趣味事件略增多',
  coffeeBonus: '咖啡因相关提神选项更有效',
  withdrawalPenalty: '长期熬夜后，戒断与疲惫惩罚更明显',
};

/** 创建角色页：当前难度下方说明（≤3 行，与 getDifficultyTuning / 结局阈值一致） */
const DIFFICULTY_CREATE_ROLE_HINT = {
  easy:
    '负面效果会略为减轻，严苛结局更难触发；高压判定也更宽松，适合先完整体验一遍流程。',
  normal: '默认平衡：日常收益与惩罚按标准曲线，严苛结局与属性阈值均为基准，适合大多数玩家。',
  hard:
    '负面惩罚更易叠加，严苛结局更容易触发；高压与健康红线更早亮起，适合想挑战极限的玩家。',
};

const CG_CATALOG = [
  {
    id: 'cg_freshman_arrival_day',
    title: '入学报到日',
    description: '第一学期，你拖着行李第一次走进校门。',
    assetPath: 'images/cg/cg_freshman_arrival_day.jpg',
    unlock: { semesterGte: 1, semesterLte: 1 },
  },
  {
    id: 'cg_first_dorm_night',
    title: '宿舍第一夜',
    description: '大一上学期，宿舍灯火与陌生室友的闲聊。',
    assetPath: 'images/cg/cg_first_dorm_night.jpg',
    unlock: { semesterGte: 1, semesterLte: 2, flags: [{ key: 'dormProgress', gte: 1 }] },
  },
  {
    id: 'cg_rain_walk_to_class',
    title: '雨天去上课',
    description: '压力偏高的一周，你在雨里赶往教室。',
    assetPath: 'images/cg/cg_rain_walk_to_class.jpg',
    unlock: { stats: [{ key: 'pressure', gte: 50 }] },
  },
  {
    id: 'cg_canteen_peak_hour',
    title: '食堂饭点',
    description: '社交活跃时，食堂成了最热闹的据点。',
    assetPath: 'images/cg/cg_canteen_peak_hour.jpg',
    unlock: { stats: [{ key: 'social', gte: 52 }] },
  },
  {
    id: 'cg_midterm_cram',
    title: '期中冲刺',
    description: '绩点与压力同时拉高，你在考前硬扛。',
    assetPath: 'images/cg/cg_midterm_cram.jpg',
    unlock: { stats: [{ key: 'pressure', gte: 62 }, { key: 'gpa', gte: 2.4 }] },
  },
  {
    id: 'cg_group_project_night',
    title: '小组项目夜战',
    description: '能力与人脉都在线，你们通宵把项目推进。',
    assetPath: 'images/cg/cg_group_project_night.jpg',
    unlock: { stats: [{ key: 'skill', gte: 55 }, { key: 'social', gte: 48 }] },
  },
  {
    id: 'cg_hackathon_overnight',
    title: '黑客松通宵',
    description: '竞赛线推进后，屏幕前的夜晚格外漫长。',
    assetPath: 'images/cg/cg_hackathon_overnight.jpg',
    unlock: { flags: [{ key: 'contestProgress', gte: 2 }] },
  },
  {
    id: 'cg_lab_mistake_recovery',
    title: '实验失误复盘',
    description: '科研受挫但没有放弃，你和同伴一起排查问题。',
    assetPath: 'images/cg/cg_lab_mistake_recovery.jpg',
    unlock: { flags: [{ key: 'researchProgress', gte: 1 }], stats: [{ key: 'pressure', gte: 52 }] },
  },
  {
    id: 'cg_lab_breakthrough',
    title: '实验室突破',
    description: '科研线推进后，你在实验室迎来阶段性成果。',
    assetPath: 'images/cg/cg_lab_breakthrough.jpg',
    unlock: { flags: [{ key: 'researchProgress', gte: 3 }] },
  },
  {
    id: 'cg_debate_stage',
    title: '辩论台',
    description: '学生工作或高社交状态下，你站上了讲台。',
    assetPath: 'images/cg/cg_debate_stage.jpg',
    unlock: { flagsAny: [{ key: 'studentWork', gte: 1 }, { key: 'contestProgress', gte: 1 }] },
  },
  {
    id: 'cg_music_club_rehearsal',
    title: '社团排练',
    description: '社交与心态都不错的一周，排练室里很热闹。',
    assetPath: 'images/cg/cg_music_club_rehearsal.jpg',
    unlock: { stats: [{ key: 'social', gte: 58 }, { key: 'pressure', lte: 72 }] },
  },
  {
    id: 'cg_basketball_night_game',
    title: '夜场篮球',
    description: '健康状态良好，你在球场释放压力。',
    assetPath: 'images/cg/cg_basketball_night_game.jpg',
    unlock: { stats: [{ key: 'health', gte: 68 }] },
  },
  {
    id: 'cg_volunteer_teaching',
    title: '志愿支教',
    description: '参与志愿或学生工作后，你走进了一间明亮的教室。',
    assetPath: 'images/cg/cg_volunteer_teaching.jpg',
    unlock: { flags: [{ key: 'studentWork', gte: 1 }], stats: [{ key: 'social', gte: 55 }] },
  },
  {
    id: 'cg_library_midnight',
    title: '凌晨图书馆',
    description: '绩点与压力都维持高位，你在深夜灯光下独自冲刺。',
    assetPath: 'images/cg/cg_library_midnight.jpg',
    unlock: { stats: [{ key: 'gpa', gte: 3.5 }, { key: 'pressure', gte: 68 }] },
  },
  {
    id: 'cg_library_snow_evening',
    title: '雪夜图书馆',
    description: '学业稳定、心态平和，窗外是安静的雪。',
    assetPath: 'images/cg/cg_library_snow_evening.jpg',
    unlock: { stats: [{ key: 'gpa', gte: 3.1 }, { key: 'pressure', lte: 58 }] },
  },
  {
    id: 'cg_track_sunrise',
    title: '清晨操场',
    description: '健康与自律达标，你在日出前完成晨跑。',
    assetPath: 'images/cg/cg_track_sunrise.jpg',
    unlock: { stats: [{ key: 'health', gte: 82 }, { key: 'pressure', lte: 52 }] },
  },
  {
    id: 'cg_internship_interview',
    title: '实习面试',
    description: '进入实习/求职节奏后，你穿上正装走进会议室。',
    assetPath: 'images/cg/cg_internship_interview.jpg',
    unlock: { flagsAny: [{ key: 'internshipReady', truthy: true }, { key: 'civilTrack', truthy: true }] },
  },
  {
    id: 'cg_offer_rejection_moment',
    title: '拒信时刻',
    description: '高压阶段收到坏消息，你在宿舍沉默了很久。',
    assetPath: 'images/cg/cg_offer_rejection_moment.jpg',
    unlock: { stats: [{ key: 'pressure', gte: 72 }, { key: 'skill', gte: 45 }] },
  },
  {
    id: 'cg_offer_arrival',
    title: 'Offer 邮件',
    description: '实习准备充分且能力达标，关键邮件终于落地。',
    assetPath: 'images/cg/cg_offer_arrival.jpg',
    unlock: { flags: [{ key: 'internshipReady', truthy: true }], stats: [{ key: 'skill', gte: 68 }] },
  },
  {
    id: 'cg_offer_success_call',
    title: '录取电话',
    description: '实习线跑通后，你在校园里接通了那通电话。',
    assetPath: 'images/cg/cg_offer_success_call.jpg',
    unlock: { flags: [{ key: 'internshipReady', truthy: true }], stats: [{ key: 'social', gte: 50 }] },
  },
  {
    id: 'cg_exam_failure_low_point',
    title: '成绩低谷',
    description: '绩点或心态跌到谷底，屏幕上的数字很冷。',
    assetPath: 'images/cg/cg_exam_failure_low_point.jpg',
    unlock: { statsAny: [{ key: 'gpa', lte: 2.2 }, { key: 'pressure', gte: 82 }] },
  },
  {
    id: 'cg_comeback_study_plan',
    title: '逆袭计划',
    description: '你从低谷拉回节奏，重新写下周计划。',
    assetPath: 'images/cg/cg_comeback_study_plan.jpg',
    unlock: { stats: [{ key: 'gpa', gte: 2.6 }, { key: 'skill', gte: 52 }, { key: 'pressure', gte: 48 }] },
  },
  {
    id: 'cg_thesis_defense_day',
    title: '论文答辩',
    description: '大四学年，你站在答辩教室的投影前。',
    assetPath: 'images/cg/cg_thesis_defense_day.jpg',
    unlock: { semesterGte: 7 },
  },
  {
    id: 'cg_graduation_day',
    title: '毕业典礼',
    description: '顺利毕业结局时解锁的纪念画面。',
    assetPath: 'images/cg/cg_graduation_day.jpg',
    unlock: { endingNotPrefix: 'end_dropout' },
  },
  {
    id: 'cg_commencement_throw_cap',
    title: '抛帽瞬间',
    description: '非退学结局通关时，草坪上的高光一刻。',
    assetPath: 'images/cg/cg_commencement_throw_cap.jpg',
    unlock: { endingNotPrefix: 'end_dropout' },
  },
];

const BGM_CATALOG = [
  { id: 'bgm_main_theme', title: 'Piano Zest', trackKey: 'main', hint: '进入主菜单自动解锁' },
  { id: 'bgm_campus_loop', title: 'Saffron Sneakers', trackKey: 'game', hint: '进入游戏内周行动自动解锁' },
  { id: 'bgm_ending_theme', title: 'Caps and Chalk', trackKey: 'end', hint: '进入结局页面自动解锁' },
];

/** 开发致谢名单 */
const CREDITS_ACK = {
  intro: '感谢参与这段校园故事的人',
  names: [
    '桃子棒棒糖',
    '陈可',
    '故障机器人',
    '钦安',
    'y同学',
    '赵yz',
    '桃饱网大会员',
    '老同学庄皓',
    'Moss',
    '水车',
  ],
};

const TALENT_TIER_LABEL = {
  positive: '正向',
  balanced: '平衡',
  negative: '负向',
  hell: '地狱',
};

const TALENT_TIER_FILTER_LABEL = {
  all: '全部',
  positive: '正向',
  balanced: '平衡',
  negative: '负向',
  hell: '地狱',
};

const TALENT_TIER_FILTER_KEYS = ['all', 'positive', 'balanced', 'negative', 'hell'];

const THEME_FALLBACK = {
  colors: {
    bg: '#101827',
    panel: '#192133',
    panelSoft: '#263449',
    textMain: '#f5f1e8',
    textSub: '#abb3b8',
    button: '#ff8a6b',
    buttonDisabled: '#5f6972',
    accent: '#ebc779',
    good: '#76cda1',
    warn: '#f3b55b',
    danger: '#ed7a76',
  },
  radius: { sm: 8, md: 12 },
  font: { title: 22, h2: 18, body: 14, small: 12 },
  lineHeight: { title: 28, body: 19, button: 15 },
  button: { height: 42, gap: 8 },
  spacing: { xs: 8, sm: 12, md: 16 },
};
const STAT_LABELS = {
  gpa: '绩点',
  money: '金钱',
  health: '健康',
  social: '社交',
  skill: '能力',
  pressure: '压力',
};

const PICK_SUBTITLE_OVERRIDES = {
  top2: '课业密度高，目标感强，压力也更大。',
  comprehensive: '学科跨度大，通识与社团资源更多。',
  polytech: '工程训练扎实，课程与作息更紧。',
  local: '生活成本从容，奖助资源更贴近日常。',
  normal_key: '基础扎实，关系均衡，适合稳步推进。',
  finance: '行业信息早，课程与社交节奏更紧。',
  teacher: '节奏稳定，适合教师、编制或深造。',
  med: '训练密集，能力与抗压提升很快。',
  sino_foreign: '双语资源更多，生活成本也更高。',
  art_academy: '创作与表达是核心，作品更重要。',
  military_academy: '纪律与体能要求高，节奏更统一。',
  agricultural: '课程贴近生产，动手机会更多。',
  foreign_language: '语言训练密集，表达机会更多。',
  police_academy: '法治课程与体能训练并重。',
  vocational: '课程面向岗位，就业准备更具体。',
  cs: '编程、系统与项目训练都很密集。',
  biz: '管理课程与小组协作占比较大。',
  liberal: '阅读与写作训练密集，适合打磨表达。',
  se: '项目实践多，需要适应需求与排期变化。',
  ee: '硬件与电路实验是每周的重点。',
  law: '记忆与逻辑训练重，法考路线可并行。',
  ai: '数学与模型训练并重，成长上限高。',
  data_science: '统计与编程结合，适合数据分析。',
  finance_major: '金融理论与实务并重，实习信息更早。',
  news: '采访、写作与传播实践占比较大。',
  medicine: '课程周期长，记忆与临床训练密集。',
  civil_exam: '公共管理与政策分析是核心内容。',
};

function cloneTheme(t) {
  return JSON.parse(JSON.stringify(t || THEME_FALLBACK));
}

/** 从头像资源 id（如 avatar_female_3）解析槽位 0–3 */
function avatarSlotIndexFromAssetId(assetId) {
  if (!assetId) return 0;
  const m = String(assetId).match(/(\d+)$/);
  if (!m) return 0;
  return Math.min(3, Math.max(0, Number(m[1]) - 1));
}

// 绘制圆角矩形的辅助函数
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export default class SimulationMain {
  scene = 'menu';
  run = null;
  currentEnding = null;
  /** 终局结算统计（仅 ending 场景展示） */
  runSettlement = null;
  pendingSchoolId = 'comprehensive';
  tempProfile = { name: MALE_NAMES[0], gender: 'male', avatarIndex: 0, difficulty: DEFAULT_DIFFICULTY };
  toast = null;
  buttons = [];
  galleryEndingHitAreas = [];
  achievementHitAreas = [];
  cgHitAreas = [];
  bgmHitAreas = [];
  galleryScroll = 0;
  achievementScroll = 0;
  cgScroll = 0;
  creditsScroll = 0;
  runSnapshotSchoolId = '';
  runSnapshotMajorId = '';
  pendingTransition = null;
  /** 进入「记录 / 关系 / 背包」前保存的场景，返回时恢复 */
  returnScene = null;
  tapLockedUntil = 0;
  tempAvatarAssetId = MALE_AVATAR_IDS[0];
  /** 当前预设头像槽位 0–3，与 male_/female_ 文件名序号一致 */
  tempAvatarIndex = 0;
  narrative = null;
  pressedButtonId = '';
  sceneEnteredAt = 0;
  backdropCache = null;
  backdropCacheKey = '';
  narrativeScroll = 0;

  constructor() {
    this.assets = {};
    this.themeCatalog = uiTheme.themes || { dark: cloneTheme(uiTheme), light: cloneTheme(THEME_FALLBACK) };
    const meta = save.loadMeta();
    this.themeMode = meta.themeMode === 'light' ? 'light' : 'dark';
    this.applyTheme(this.themeMode);
    this.bgm = new BgmManager(audioConfig);
    this.lastRenderedScene = '';
    this.sceneEnteredAt = Date.now();
    this.rewardedAssistPending = false;
    this.lastRewardedAdAt = 0;
    this.tryLoadAssets();
    
    this.pickRandomNameByGender('male');
    this.pickRandomAvatarByGender('male');
    
    // 天赋系统相关
    this.availableTalents = [];
    this.selectedTalent = null;
    this.talentTierFilter = 'all';
    this.talentRerolls = 2; // 可重选次数
    
    // 固定状态描述相关
    this.fixedFunnyStatus = null;
    this.lastStatsHash = null;
    
    // 选项描述随机性相关
    this.fixedActionDescriptions = new Map();
    this.fixedEventDescriptions = new Map();
    
    // 社团系统相关
    this.clubPrefixes = ['青春', '梦想', '星光', '彩虹', '晨曦', '月光', '阳光', '清风', '白云', '蓝天'];
    this.clubTypes = ['吉他社', '篮球社', '摄影社', '书法社', '舞蹈社', '辩论社', '志愿者协会', '动漫社', '文学社', '科技创新社'];
    this.playerClubs = new Set();
    
    // 滚动相关
    this.weeklyActionScroll = 0;
    /** @type {{ maxScroll: number, track: { x: number, y: number, w: number, h: number }, thumbH: number } | null} */
    this._weeklyScrollUi = null;
    /** 周行动列表右侧滚动条拖拽中（与列表滑动手势互斥） */
    this.weeklyScrollbarDrag = false;
    /** 周行动购物小窗：{ action, cart: Record<string, number>, scroll: number } | null */
    this.weeklyShopOverlay = null;
    this._weeklyShopScrollMax = 0;
    this.runLogScroll = 0;
    this.schoolScroll = 0;
    this.majorScroll = 0;
    /** 游玩场景主内容区（事件选项等）纵向滚动 */
    this.playContentScroll = 0;
    this.endingScroll = 0;
    this.endingPlaybackScroll = 0;
    this.achievementPlaybackScroll = 0;
    this.relationsScroll = 0;
    this.inventoryScroll = 0;
    /** @type {Array<{ npcId: string, source: string }>} */
    this.pendingNpcUnlocks = [];
    /** @type {{ endingId: string, title?: string, fullText: string } | null} */
    this.endingPlayback = null;
    /** @type {{ achievementId: string, title?: string, storyText: string, conditionText: string } | null} */
  this.achievementPlayback = null;
  /** @type {{ cgId: string, title?: string, description?: string, fromScene?: string, unlockOnClose?: boolean } | null} */
  this.cgPlayback = null;
  /** @type {Array<{ cg: object, fromScene: string, unlockOnClose: boolean }>} */
  this.pendingCgQueue = [];
  /** @type {(() => void) | null} */
  this.cgQueueOnComplete = null;
    
    const prefs = meta.audioPrefs || {};
    if (prefs.volume !== undefined) this.bgm.setVolume(prefs.volume);
    if (prefs.muted) this.bgm.toggleMute();
    wx.onTouchStart(this.onTouchStart.bind(this));
    wx.onTouchMove(this.onTouchMove.bind(this));
    wx.onTouchEnd(this.onTouchEnd.bind(this));
    if (wx.onTouchCancel) {
      wx.onTouchCancel(() => {
        this.pressedButtonId = '';
        this.isDragging = false;
        this.weeklyScrollbarDrag = false;
      });
    }
    requestAnimationFrame(() => initShare());
    requestAnimationFrame(() => warmUpAds());
    this.bindShareLaunchWelcome();
    this.boundLoop = this.loop.bind(this);
    requestAnimationFrame(this.boundLoop);
    this.galleryScroll = 0;
    this.achievementScroll = 0;
    this.touchStartY = 0;
    this.isDragging = false;
    this.pressedButtonId = '';
  }

  tryLoadAssets() {
    if (!wx.createImage) return;

    // 头像与 CG 是实际内容资产；界面装饰全部由 Canvas 原生绘制。
    this.assets.avatars = { male: [], female: [] };
    for (let i = 1; i <= 4; i++) {
      const maleImg = this.loadImageAssetUnchecked(
        `avatar_male_${i}`,
        `images/generated/avatars/male/male_${i}.jpg`,
      );
      if (maleImg) this.assets.avatars.male[i - 1] = maleImg;
      const femaleImg = this.loadImageAssetUnchecked(
        `avatar_female_${i}`,
        `images/generated/avatars/female/female_${i}.jpg`,
      );
      if (femaleImg) this.assets.avatars.female[i - 1] = femaleImg;
    }
    
    this.loadCgAssets();
  }




  loadCgAssets() {
    CG_CATALOG.forEach((cg) => {
      if (!cg || !cg.id || !cg.assetPath) return;
      this.loadImageAsset(cg.id, cg.assetPath);
    });
  }

  assetExists(src) {
    try {
      if (!wx.getFileSystemManager) return false;
      const fs = wx.getFileSystemManager();
      if (!fs || !fs.accessSync) return false;
      fs.accessSync(src);
      return true;
    } catch (e) {
      return false;
    }
  }

  loadImageAsset(id, src) {
    try {
      if (!this.assetExists(src)) return;
      const img = wx.createImage();
      img.__ready = false;
      img.__failed = false;
      img.onload = () => { img.__ready = true; };
      img.onerror = () => { img.__failed = true; };
      img.src = src;
      this.assets[id] = img;
    } catch (e) {
      // ignore missing assets in dev
    }
  }

  /**
   * 直接发起加载（用于头像等包内资源）。微信环境下 fs.accessSync 常无法判断素材是否存在，
   * 若在此处跳过则永远不会加载，界面仅剩灰色占位。
   */
  loadImageAssetUnchecked(id, src) {
    try {
      if (!wx.createImage) return null;
      const img = wx.createImage();
      img.__ready = false;
      img.__failed = false;
      img.onload = () => { img.__ready = true; };
      img.onerror = () => { img.__failed = true; };
      img.src = src;
      this.assets[id] = img;
      return img;
    } catch (e) {
      return null;
    }
  }

  setWeeklyScrollFromTrackY(clientY) {
    const ui = this._weeklyScrollUi;
    if (!ui) return;
    const { track, thumbH, maxScroll } = ui;
    const inner = track.h - thumbH;
    if (inner <= 0 || maxScroll <= 0) {
      this.weeklyActionScroll = 0;
      return;
    }
    const rel = (clientY - track.y - thumbH / 2) / inner;
    const clamped = Math.max(0, Math.min(1, rel));
    this.weeklyActionScroll = clamped * maxScroll;
  }

  ensureNpcUnlockState() {
    if (!this.run) return;
    if (!Array.isArray(this.run.unlockedNpcIds)) this.run.unlockedNpcIds = [];
    if (!Array.isArray(this.pendingNpcUnlocks)) this.pendingNpcUnlocks = [];
  }

  /** 本局可进入关系网的人物池（不含未选导师/未选定心动对象） */
  getRelationshipEligibleIds() {
    if (!this.run || !this.run.npcRoster) return [];
    const roster = this.run.npcRoster;
    const ids = [];
    (roster.roommates || []).forEach((id) => id && ids.push(id));
    if (roster.primaryMentor) ids.push(roster.primaryMentor);
    if (roster.partner) ids.push(roster.partner);
    (roster.seniors || []).forEach((id) => id && ids.push(id));
    return ids;
  }

  /** 周/学期推进时逐步解锁的候选（导师、心动候补需经事件选定后才入池） */
  getNpcUnlockProgressCandidates() {
    return this.getRelationshipEligibleIds();
  }

  npcMayStayInRelationshipNetwork(npcId) {
    if (!npcId || !this.run) return false;
    const n = npcsCatalog.find((x) => x.id === npcId);
    if (!n) return false;
    const roster = this.run.npcRoster || {};
    if (n.role === 'mentor') return roster.primaryMentor === npcId;
    if (n.role === 'romance') return roster.partner === npcId;
    return this.getRelationshipEligibleIds().includes(npcId);
  }

  pruneRelationshipUnlocks() {
    if (!this.run) return;
    this.ensureNpcUnlockState();
    const next = (this.run.unlockedNpcIds || []).filter((id) => this.npcMayStayInRelationshipNetwork(id));
    if (next.length !== (this.run.unlockedNpcIds || []).length) {
      this.run.unlockedNpcIds = next;
    }
  }

  getNpcRoleLabel(role) {
    if (role === 'roommate') return '室友';
    if (role === 'mentor') return '导师';
    if (role === 'romance') return '心动对象';
    if (role === 'senior') return '学长姐';
    return '同学';
  }

  getNpcTonePack(role) {
    if (role === 'mentor') {
      return {
        preLead: '这次见面可能会影响你接下来一段时间的方向。',
        preNotice: '你注意到',
        preClose: '你提前整理了想问的问题，也不想只听漂亮话。',
        meetLead: '你们聊了方向、时间和能投入的精力，对方没有急着给结论。',
        meetClose: '你决定先观察这段关系会把哪些选择带到面前。',
      };
    }
    if (role === 'romance') {
      return {
        preLead: '你原本只是去见一个普通同学，却比预想中多留意了对方几眼。',
        preNotice: '你最先看见',
        preClose: '你没有立刻给这份好感下定义。',
        meetLead: '你们从课程和近况聊起，发现彼此有不少共同话题。',
        meetClose: '分开以后，你记住了这次见面里几个很具体的细节。',
      };
    }
    if (role === 'roommate') {
      return {
        preLead: '接下来几年，你们会共享同一盏灯和同一间屋子。',
        preNotice: '你先留意到',
        preClose: '第一次见面未必能看出合不合拍，但生活习惯会很快显出来。',
        meetLead: '你们聊了作息、家乡和第一周最不习惯的事。',
        meetClose: '你开始意识到，宿舍关系需要慢慢磨合。',
      };
    }
    if (role === 'senior') {
      return {
        preLead: '你希望从对方身上听到一些不走弯路的经验。',
        preNotice: '你在人群中注意到',
        preClose: '答案可能不只一个，但对方的选择会是一份参考。',
        meetLead: '对方没有把经历讲成成功故事，更多是在说每一步的真实成本。',
        meetClose: '你记下了几个可以继续追问的问题。',
      };
    }
    return {
      preLead: '这次见面也许会带来一些新的可能。',
      preNotice: '你先注意到',
      preClose: '你打算先聊几句，再决定要不要继续了解。',
      meetLead: '你们聊得还算顺利，彼此都留了个不错的印象。',
      meetClose: '这段关系之后也许还会有新的交集。',
    };
  }

  unlockNpc(npcId, source) {
    if (!this.run || !npcId) return false;
    const npc = npcsCatalog.find((x) => x.id === npcId);
    if (npc && npc.role === 'mentor') {
      const pm = this.run.npcRoster && this.run.npcRoster.primaryMentor;
      if (!pm || pm !== npcId) return false;
    }
    if (npc && npc.role === 'romance') {
      const partner = this.run.npcRoster && this.run.npcRoster.partner;
      if (!partner || partner !== npcId) return false;
    }
    this.ensureNpcUnlockState();
    const unlocked = new Set(this.run.unlockedNpcIds || []);
    if (unlocked.has(npcId)) return false;
    unlocked.add(npcId);
    this.run.unlockedNpcIds = Array.from(unlocked);
    this.pendingNpcUnlocks.push({ npcId, source: source || '校园日常' });
    this.flushPendingNpcUnlockNarrative();
    return true;
  }

  flushPendingNpcUnlockNarrative() {
    if (!this.run || this.narrative || !this.pendingNpcUnlocks || !this.pendingNpcUnlocks.length) return;
    const intro = this.pendingNpcUnlocks.shift();
    const npc = npcsCatalog.find((x) => x.id === intro.npcId);
    if (!npc) {
      this.flushPendingNpcUnlockNarrative();
      return;
    }
    const roleText = this.getNpcRoleLabel(npc.role);
    const tone = this.getNpcTonePack(npc.role);
    const firstImpression = Array.isArray(npc.tags) && npc.tags.length ? npc.tags.slice(0, 2).join('、') : roleText;
    const storyLine = npc.bio || npc.meme || '你们在校园里匆匆打了个照面。';
    const body = [
      `你和 ${npc.name} 正式认识了。`,
      `那是在${intro.source}，对方给你的第一感觉是${firstImpression}。`,
      '',
      tone.meetLead,
      '',
      storyLine,
      '',
      tone.meetClose,
      '',
      `关系网已更新：${npc.name} 已加入。`,
    ].join('\n');
    this.showNarrative(body, [], () => this.flushPendingNpcUnlockNarrative());
  }

  unlockNpcByProgress(source) {
    if (!this.run || !this.run.npcRoster) return;
    this.ensureNpcUnlockState();
    const src = String(source || '');
    if (src.includes('周') && Number(this.run.weekIndex || 0) % 2 !== 0) return;
    const candidates = this.getNpcUnlockProgressCandidates();
    const unlocked = new Set(this.run.unlockedNpcIds || []);
    const nextId = candidates.find((id) => id && !unlocked.has(id));
    if (nextId) this.unlockNpc(nextId, source);
  }

  bootstrapLegacyNpcUnlocks() {
    if (!this.run) return;
    this.ensureNpcUnlockState();
    if ((this.run.unlockedNpcIds || []).length) {
      this.pruneRelationshipUnlocks();
      return;
    }
    const ids = new Set();
    Object.keys(this.run.npcEventHits || {}).forEach((id) => {
      if (this.npcMayStayInRelationshipNetwork(id)) ids.add(id);
    });
    if (this.run.npcRoster && this.run.npcRoster.primaryMentor) ids.add(this.run.npcRoster.primaryMentor);
    if (this.run.npcRoster && this.run.npcRoster.partner) ids.add(this.run.npcRoster.partner);
    this.run.unlockedNpcIds = Array.from(ids);
  }

  maybeShowNpcPreChoiceNarrative(eventObj) {
    if (!this.run || !eventObj || this.narrative) return false;
    const targetEvents = new Set(['evt_pick_mentor', 'evt_romance_intro']);
    if (!targetEvents.has(eventObj.id)) return false;
    const flagKey = `npcPreIntroShown_${eventObj.id}`;
    if (this.run.flags && this.run.flags[flagKey]) return false;
    const roster = this.run.npcRoster || {};
    let ids = [];
    let title = '新的相遇';
    let source = '校园生活';
    if (eventObj.id === 'evt_pick_mentor') {
      ids = Array.isArray(roster.mentors) ? roster.mentors.slice(0, 3) : [];
      title = '你即将见到几位导师';
      source = `第 ${Number(this.run.semesterIndex || 0) + 1} 学期导师双选会`;
    } else if (eventObj.id === 'evt_romance_intro') {
      ids = Array.isArray(roster.romanceCandidates) ? roster.romanceCandidates.slice(0, 2) : [];
      title = '你即将遇到心动对象';
      source = `第 ${Number(this.run.semesterIndex || 0) + 1} 学期校园生活`;
    }
    const introNpcs = ids
      .map((id) => npcsCatalog.find((n) => n.id === id))
      .filter(Boolean);
    const mainRole = introNpcs[0] && introNpcs[0].role ? introNpcs[0].role : 'roommate';
    const tone = this.getNpcTonePack(mainRole);
    const introLines = introNpcs.map((npc) => {
      const firstImpression = Array.isArray(npc.tags) && npc.tags.length ? npc.tags.slice(0, 2).join('、') : this.getNpcRoleLabel(npc.role);
      return `${npc.name}，${firstImpression}`;
    });
    const introText = introLines.length
      ? `${tone.preNotice}${introLines.join('；')}。`
      : '你在人群里看见了几张想再认识一下的面孔。';
    const body = [
      `这一周，你会在${source}遇到一些关键人物。`,
      '',
      tone.preLead,
      '',
      introText,
      '',
      tone.preClose,
      '',
      '先跟着直觉走，看看你想先靠近谁。',
    ].join('\n');
    this.showNarrative(body, [], () => {
      this.run.flags = { ...(this.run.flags || {}), [flagKey]: true };
      if (this.run) save.saveRun(this.run);
    });
    return true;
  }

  onTouchStart(e) {
    const t = e.touches[0];
    if (!t) return;
    this.touchStartY = t.clientY;
    this.isDragging = false;
    this.weeklyScrollbarDrag = false;
    this.runLogTouchInList = true;
    this.pressedButtonId = '';
    if (this.narrative) {
      this.narrativeGestureY = t.clientY;
      return;
    }

    const pressed = this.findButtonAt(t.clientX, t.clientY, 3);
    this.pressedButtonId = pressed && pressed.id ? pressed.id : '';

    if (this.scene === 'run_log' && this._runLogScrollUi) {
      const { listTop, listBottom } = this._runLogScrollUi;
      this.runLogTouchInList = t.clientY >= listTop && t.clientY <= listBottom;
    }

    if (this.scene === 'play' && this.run && this.run.phase === 'week_action' && this._weeklyScrollUi) {
      const tr = this._weeklyScrollUi.track;
      const x = t.clientX;
      const y = t.clientY;
      if (x >= tr.x && x <= tr.x + tr.w && y >= tr.y && y <= tr.y + tr.h) {
        this.weeklyScrollbarDrag = true;
        this.isDragging = true;
        this.setWeeklyScrollFromTrackY(y);
        return;
      }
    }
  }

  onTouchMove(e) {
    const t = e.touches[0];
    if (!t) return;
    if (this.narrative) {
      const dy = this.narrativeGestureY - t.clientY;
      if (Math.abs(dy) > 6) {
        this.isDragging = true;
        this.narrativeScroll = clamp(
          (this.narrativeScroll || 0) + dy,
          0,
          Math.max(0, Number(this.narrative.maxScroll || 0)),
        );
        this.narrativeGestureY = t.clientY;
      }
      return;
    }
    if (this.weeklyScrollbarDrag && this._weeklyScrollUi) {
      this.setWeeklyScrollFromTrackY(t.clientY);
      return;
    }
    const deltaY = this.touchStartY - t.clientY;
    if (Math.abs(deltaY) > 10) {
      this.isDragging = true;
      this.pressedButtonId = '';
    }
    if (this.isDragging) {
      if (this.scene === 'gallery') {
        this.galleryScroll += deltaY;
        const gcap = this._galleryScrollMax != null ? this._galleryScrollMax : 0;
        this.galleryScroll = Math.max(0, Math.min(gcap, this.galleryScroll));
      } else if (this.scene === 'cg_gallery') {
        this.cgScroll += deltaY;
        const ccap = this._cgScrollMax != null ? this._cgScrollMax : 0;
        this.cgScroll = Math.max(0, Math.min(ccap, this.cgScroll));
      } else if (this.scene === 'achievements') {
        this.achievementScroll += deltaY;
        const acap = this._achievementScrollMax != null ? this._achievementScrollMax : 0;
        this.achievementScroll = Math.max(0, Math.min(acap, this.achievementScroll));
      } else if (this.scene === 'run_log' && this.runLogTouchInList) {
        this.runLogScroll += deltaY;
        const lcap = this._runLogScrollMax != null ? this._runLogScrollMax : 0;
        this.runLogScroll = Math.max(0, Math.min(lcap, this.runLogScroll));
      } else if (this.scene === 'credits') {
        this.creditsScroll += deltaY;
        const ccap = this._creditsScrollMax != null ? this._creditsScrollMax : 0;
        this.creditsScroll = Math.max(0, Math.min(ccap, this.creditsScroll));
      } else if (this.scene === 'play' && this.run && this.run.phase === 'week_action' && this.weeklyShopOverlay) {
        const cap = typeof this._weeklyShopScrollMax === 'number' ? this._weeklyShopScrollMax : 0;
        this.weeklyShopOverlay.scroll = (this.weeklyShopOverlay.scroll || 0) + deltaY;
        this.weeklyShopOverlay.scroll = Math.max(0, Math.min(cap, this.weeklyShopOverlay.scroll));
      } else if (this.scene === 'play' && this.run && this.run.phase === 'week_action' && !this.weeklyShopOverlay) {
        const maxScroll = this._weeklyScrollUi
          ? Number(this._weeklyScrollUi.maxScroll || 0)
          : Math.max(0, (this.getWeeklyActionChoices().length - WEEK_ACTION_MAX_VISIBLE) * WEEK_ACTION_ROW_H);
        this.weeklyActionScroll += deltaY;
        this.weeklyActionScroll = Math.max(0, Math.min(maxScroll, this.weeklyActionScroll));
      } else if (this.scene === 'play' && this.run && this.run.phase !== 'week_action' && !this.weeklyShopOverlay) {
        const cap = typeof this._playContentScrollMax === 'number' ? this._playContentScrollMax : 0;
        this.playContentScroll += deltaY;
        this.playContentScroll = Math.max(0, Math.min(cap, this.playContentScroll));
      } else if (this.scene === 'school') {
        const maxScroll = typeof this._pickListScrollMax === 'number' ? this._pickListScrollMax : 0;
        this.schoolScroll += deltaY;
        this.schoolScroll = Math.max(0, Math.min(maxScroll, this.schoolScroll));
      } else if (this.scene === 'major') {
        const maxScroll = typeof this._pickListScrollMax === 'number' ? this._pickListScrollMax : 0;
        this.majorScroll += deltaY;
        this.majorScroll = Math.max(0, Math.min(maxScroll, this.majorScroll));
      } else if (this.scene === 'ending') {
        this.endingScroll += deltaY;
        const cap = this._endingScrollMax != null ? this._endingScrollMax : 0;
        this.endingScroll = Math.max(0, Math.min(cap, this.endingScroll));
      } else if (this.scene === 'relations') {
        this.relationsScroll = (this.relationsScroll || 0) + deltaY;
        const rcap = this._relationsScrollMax != null ? this._relationsScrollMax : 0;
        this.relationsScroll = Math.max(0, Math.min(rcap, this.relationsScroll));
      } else if (this.scene === 'inventory') {
        this.inventoryScroll = (this.inventoryScroll || 0) + deltaY;
        const cap = this._inventoryScrollMax != null ? this._inventoryScrollMax : 0;
        this.inventoryScroll = Math.max(0, Math.min(cap, this.inventoryScroll));
      } else if (this.scene === 'ending_playback') {
        const cap = Number(this._endingPlaybackScrollMax || 0);
        this.endingPlaybackScroll = clamp((this.endingPlaybackScroll || 0) + deltaY, 0, cap);
      } else if (this.scene === 'achievement_playback') {
        const cap = Number(this._achievementPlaybackScrollMax || 0);
        this.achievementPlaybackScroll = clamp((this.achievementPlaybackScroll || 0) + deltaY, 0, cap);
      }
    }
    this.touchStartY = t.clientY;
  }

  onTouchEnd(e) {
    this.weeklyScrollbarDrag = false;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) {
      this.pressedButtonId = '';
      this.isDragging = false;
      return;
    }
    if (!this.isDragging) {
      this.handleTap(t.clientX, t.clientY);
    }
    this.pressedButtonId = '';
    this.isDragging = false;
  }

  findButtonAt(x, y, hitPadding = 0) {
    for (let i = 0; i < this.buttons.length; i++) {
      const b = this.buttons[i];
      if (!b || b.disabled) continue;
      if (
        x >= b.x - hitPadding &&
        x <= b.x + b.w + hitPadding &&
        y >= b.y - hitPadding &&
        y <= b.y + b.h + hitPadding
      ) {
        return b;
      }
    }
    return null;
  }

  feedbackTap() {
    const now = Date.now();
    if (now - Number(this.lastHapticAt || 0) < 60) return;
    this.lastHapticAt = now;
    if (this.bgm) this.bgm.playTap();
    try {
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    } catch (e) {
      // Some devices expose the API without supporting haptic feedback.
    }
  }

  handleTap(x, y) {
    if (Date.now() < this.tapLockedUntil) return;
    if (this.narrative) {
      if (Array.isArray(this.narrative.optionRects) && this.narrative.optionRects.length) {
        for (let i = 0; i < this.narrative.optionRects.length; i++) {
          const op = this.narrative.optionRects[i];
          if (x >= op.x && x <= op.x + op.w && y >= op.y && y <= op.y + op.h) {
            const cb = op.onSelect;
            this.narrative = null;
            if (typeof cb === 'function') cb();
            this.processCgQueue();
            this.feedbackTap();
            this.tapLockedUntil = Date.now() + 150;
            return;
          }
        }
      }
      const btn = this.narrative.btnRect;
      if (btn && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        if ((this.narrativeScroll || 0) < Number(this.narrative.maxScroll || 0)) {
          this.narrativeScroll = Math.min(
            Number(this.narrative.maxScroll || 0),
            (this.narrativeScroll || 0) + Math.max(80, btn.h * 2),
          );
          this.tapLockedUntil = Date.now() + 80;
          return;
        }
        const cb = this.narrative.onDismiss;
        this.narrative = null;
        if (typeof cb === 'function') cb();
        this.processCgQueue();
        this.feedbackTap();
        this.tapLockedUntil = Date.now() + 150;
      }
      return;
    }
    let tappedButton = false;
    const tapped = this.findButtonAt(x, y, 5);
    if (tapped) {
      tapped.onClick();
      tappedButton = true;
      this.feedbackTap();
    }
    if (!tappedButton && this.scene === 'ending_playback' && this.endingPlayback) {
      // 结局回放改为全文直出，无需点击快进
      return;
    }
    if (!tappedButton && this.scene === 'achievement_playback' && this.achievementPlayback) {
      return;
    }
    if (!tappedButton && this.scene === 'gallery' && this.galleryEndingHitAreas.length) {
      for (let i = 0; i < this.galleryEndingHitAreas.length; i++) {
        const area = this.galleryEndingHitAreas[i];
        if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
          this.startEndingPlayback(area.ending);
          this.feedbackTap();
          this.tapLockedUntil = Date.now() + 120;
          return;
        }
      }
    }
    if (!tappedButton && this.scene === 'achievements' && this.achievementHitAreas.length) {
      for (let i = 0; i < this.achievementHitAreas.length; i++) {
        const area = this.achievementHitAreas[i];
        if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
          this.startAchievementPlayback(area.achievement);
          this.feedbackTap();
          this.tapLockedUntil = Date.now() + 120;
          return;
        }
      }
    }
    if (!tappedButton && this.scene === 'cg_gallery' && this.cgHitAreas.length) {
      for (let i = 0; i < this.cgHitAreas.length; i++) {
        const area = this.cgHitAreas[i];
        if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
          this.startCgPlayback(area.cg, 'cg_gallery');
          this.feedbackTap();
          this.tapLockedUntil = Date.now() + 120;
          return;
        }
      }
    }
    if (!tappedButton && this.scene === 'bgm_gallery' && this.bgmHitAreas.length) {
      for (let i = 0; i < this.bgmHitAreas.length; i++) {
        const area = this.bgmHitAreas[i];
        if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
          this.playBgmFromGallery(area.bgm);
          this.feedbackTap();
          this.tapLockedUntil = Date.now() + 120;
          return;
        }
      }
    }
  }

  showToast(text, ms = 2200) {
    const now = Date.now();
    this.toast = { text: String(text || ''), until: now + ms, started: now };
  }

  /**
   * 显示叙事对话框：正文 + 状态变化 + 点击关闭
   * @param {string} text - 叙事正文（可含轻松段子）
   * @param {Array<{label:string,color:string}>} changes - 状态变化标签列表
   * @param {Function} [onDismiss] - 关闭后回调
   */
  showNarrative(text, changes = [], onDismiss = null) {
    this.narrativeScroll = 0;
    this.narrative = {
      text: this.dedupeNarrativeEcho(text),
      changes,
      onDismiss,
      openedAt: Date.now(),
    };
  }

  showNarrativeWithOptions(text, options = []) {
    this.narrativeScroll = 0;
    const cleaned = (Array.isArray(options) ? options : [])
      .map((op) => ({
        label: String(op && op.label ? op.label : '确认'),
        onSelect: op && typeof op.onSelect === 'function' ? op.onSelect : null,
        subLabel: op && op.subLabel ? String(op.subLabel) : '',
        variant: op && op.variant ? String(op.variant) : 'normal',
      }))
      .slice(0, 4);
    this.narrative = {
      text: this.dedupeNarrativeEcho(text),
      changes: [],
      options: cleaned,
      optionRects: [],
      btnRect: null,
      openedAt: Date.now(),
    };
  }

  /** 折叠连续重复的「；」分句，避免叙事末尾套娃 */
  dedupeSemicolonClauses(text) {
    const raw = String(text || '');
    if (!raw.includes('；')) return raw;
    const parts = raw.split('；');
    const normClause = (p) => String(p || '').replace(/[。！？…\s]+$/g, '').trim();
    const out = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].trim();
      if (!p) continue;
      if (out.length && normClause(out[out.length - 1]) === normClause(p)) continue;
      out.push(p);
    }
    return out.join('；');
  }

  /** 折叠连续重复的整句（以。！？… 为界），避免同一句话在结尾出现两遍 */
  dedupeConsecutiveSentenceBlocks(text) {
    const raw = String(text || '').trim();
    if (!raw) return raw;
    const terminators = /[。！？…]/;
    const blocks = [];
    let cur = '';
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      cur += ch;
      if (terminators.test(ch)) {
        blocks.push(cur);
        cur = '';
      }
    }
    if (cur.trim()) blocks.push(cur);
    const merged = [];
    for (let j = 0; j < blocks.length; j++) {
      const b = blocks[j];
      const t = b.trim();
      if (!t) continue;
      if (merged.length && merged[merged.length - 1].trim() === t) continue;
      merged.push(b);
    }
    return merged.join('');
  }

  dedupeNarrativeEcho(text) {
    let s = String(text || '').trim();
    if (!s) return s;
    s = this.dedupeSemicolonClauses(s);
    s = this.dedupeConsecutiveSentenceBlocks(s);
    return s;
  }

  getStatLabel(statKey) {
    return STAT_LABELS[statKey] || String(statKey || '');
  }

  getFlagLabel(flagKey) {
    const labels = {
      romanceCommitted: '进入并坚持恋爱主线',
      internshipReady: '完成至少一次实习主线选择',
      studentWork: '学生工作参与次数',
      certProgress: '考证推进程度',
      civilProgress: '考公推进程度',
      researchProgress: '科研线推进程度',
      contestProgress: '竞赛线推进程度',
      dormProgress: '宿舍事件推进程度',
      financeProgress: '理财投入次数',
      isCrossMajor: '跨专业路径标记',
      crossMajorChallenge: '跨专业挑战进度',
      researchTrack: '科研主线路径',
      civilTrack: '考公路线标记',
      publicInstitutionTrack: '考编路线标记',
      itemUsage: '道具使用次数',
      mentorUnlocked: '已建立导师关系',
      npcEventHits: '同学专属经历次数',
      offCampus: '外宿路线',
      postgradLockedIn: '推免与保研已锁定',
      careerBigTech: '大厂求职方向',
      primaryMentor: '成功锁定主导师',
      romanceSkipped: '主动跳过恋爱开局',
      startupIntent: '创业意向已确认',
    };
    return labels[flagKey] || String(flagKey || '');
  }

  formatConditionRule(rule, kind = 'flag') {
    if (!rule || !rule.key) return '';
    const label = kind === 'stat' ? this.getStatLabel(rule.key) : this.getFlagLabel(rule.key);
    if (rule.gte !== undefined) return `${label}达到 ${rule.gte}`;
    if (rule.lte !== undefined) return `${label}不高于 ${rule.lte}`;
    if (rule.eq !== undefined) return `${label}为 ${rule.eq}`;
    if (rule.truthy !== undefined) return rule.truthy ? `${label}` : `未满足${label}`;
    return `${label}`;
  }

  getEndingTitleById(endingId) {
    const ending = endingsCatalog.find((x) => x.id === endingId);
    return ending ? ending.title : endingId;
  }

  findConfigEntryById(source, id) {
    if (!source || !id) return null;
    if (Array.isArray(source)) return source.find((x) => x && x.id === id) || null;
    if (typeof source === 'object') {
      if (source[id]) return source[id];
      const values = Object.values(source);
      return values.find((x) => x && x.id === id) || null;
    }
    return null;
  }

  getAchievementConditionText(achievement) {
    const c = achievement && achievement.conditions ? achievement.conditions : null;
    if (!c) return String((achievement && achievement.hint) || '完成对应剧情后可解锁');
    const parts = [];
    if (c.always) parts.push('完成任意一局人生即可');
    if (c.school) {
      const school = this.findConfigEntryById(SCHOOLS, c.school);
      const schoolName = school ? (school.name || school.label || school.title || c.school) : c.school;
      parts.push(`在${schoolName}完成本局`);
    }
    if (c.major) {
      const major = this.findConfigEntryById(MAJORS, c.major);
      const majorName = major ? (major.name || major.label || major.title || c.major) : c.major;
      parts.push(`主修方向为${majorName}`);
    }
    if (c.notDropout) parts.push('并且要顺利毕业');
    if (Array.isArray(c.endingIn) && c.endingIn.length) {
      const endings = c.endingIn.map((id) => this.getEndingTitleById(id)).join('或');
      parts.push(`达成结局${endings}`);
    }
    if (c.rosterPartner === true) parts.push('本局关系网中解锁了专属心动对象');
    if (c.rosterPrimaryMentor === true) parts.push('本局关系网中成功锁定主导师');
    if (Array.isArray(c.stats) && c.stats.length) {
      parts.push(...c.stats.map((r) => this.formatConditionRule(r, 'stat')).filter(Boolean));
    }
    if (Array.isArray(c.flags) && c.flags.length) {
      parts.push(...c.flags.map((r) => this.formatConditionRule(r, 'flag')).filter(Boolean));
    }
    if (Array.isArray(c.flagsAny) && c.flagsAny.length) {
      const anyParts = c.flagsAny.map((r) => this.formatConditionRule(r, 'flag')).filter(Boolean);
      if (anyParts.length) parts.push(`满足以下任意一项 ${anyParts.join('，')}`);
    }
    if (!parts.length) return String(achievement.hint || '完成对应剧情后可解锁');
    return parts.join('，');
  }

  matchRuleForCg(rule, value) {
    if (!rule) return false;
    if (rule.gte !== undefined) return Number(value || 0) >= Number(rule.gte);
    if (rule.lte !== undefined) return Number(value || 0) <= Number(rule.lte);
    if (rule.eq !== undefined) return Number(value || 0) === Number(rule.eq);
    if (rule.truthy !== undefined) return !!value === !!rule.truthy;
    return !!value;
  }

  isCgConditionMatched(cg, runState, ending) {
    if (!cg || !cg.unlock) return false;
    const u = cg.unlock;
    const stats = runState && runState.stats ? runState.stats : {};
    const flags = runState && runState.flags ? runState.flags : {};
    const semNo = runState ? Number(runState.semesterIndex || 0) + 1 : 0;
    if (u.semesterGte !== undefined && semNo < Number(u.semesterGte)) return false;
    if (u.semesterLte !== undefined && semNo > Number(u.semesterLte)) return false;
    if (Array.isArray(u.stats)) {
      const ok = u.stats.every((r) => this.matchRuleForCg(r, stats[r.key]));
      if (!ok) return false;
    }
    if (Array.isArray(u.statsAny) && u.statsAny.length) {
      const ok = u.statsAny.some((r) => this.matchRuleForCg(r, stats[r.key]));
      if (!ok) return false;
    }
    if (Array.isArray(u.flags)) {
      const ok = u.flags.every((r) => this.matchRuleForCg(r, flags[r.key]));
      if (!ok) return false;
    }
    if (Array.isArray(u.flagsAny) && u.flagsAny.length) {
      const ok = u.flagsAny.some((r) => this.matchRuleForCg(r, flags[r.key]));
      if (!ok) return false;
    }
    if (u.endingId && (!ending || ending.id !== u.endingId)) return false;
    if (u.endingNotPrefix) {
      if (!ending) return false;
      if (String(ending.id || '').startsWith(String(u.endingNotPrefix))) return false;
    }
    return true;
  }

  getMatchedCgs(runState, ending = null) {
    return CG_CATALOG.filter((cg) => this.isCgConditionMatched(cg, runState, ending));
  }

  /** 本局未触发且图鉴未收录的 CG（按目录顺序） */
  getEligibleCgs(runState, ending = null) {
    const matched = this.getMatchedCgs(runState, ending);
    if (!matched.length) return [];
    const triggered = new Set(Array.isArray(runState?.triggeredCgIds) ? runState.triggeredCgIds : []);
    const meta = save.loadMeta();
    const unlocked = new Set(Array.isArray(meta.unlockedCgs) ? meta.unlockedCgs : []);
    return matched.filter((cg) => cg && cg.id && !triggered.has(cg.id) && !unlocked.has(cg.id));
  }

  markCgTriggeredOnRun(runState, cgId) {
    const id = String(cgId || '');
    if (!runState || !id) return;
    const prev = Array.isArray(runState.triggeredCgIds) ? runState.triggeredCgIds : [];
    if (prev.includes(id)) return;
    runState.triggeredCgIds = [...prev, id];
  }

  /** 条件达成时最多入队一张；图鉴仅在完整观看一次后解锁 */
  triggerCgsByRunState(runState, ending = null, fromScene = 'play', deferPlayback = false) {
    const eligible = this.getEligibleCgs(runState, ending);
    if (!eligible.length) return;
    const cg = eligible[0];
    this.markCgTriggeredOnRun(runState, cg.id);
    this.pendingCgQueue = [{ cg, fromScene, unlockOnClose: true }];
    if (!deferPlayback) this.processCgQueue();
  }

  processCgQueue() {
    if (this.scene === 'cg_playback' || this.cgPlayback) return;
    if (this.narrative) return;
    if (!this.pendingCgQueue.length) {
      if (typeof this.cgQueueOnComplete === 'function') {
        const done = this.cgQueueOnComplete;
        this.cgQueueOnComplete = null;
        done();
      }
      return;
    }
    const next = this.pendingCgQueue.shift();
    this.startCgPlayback(next.cg, next.fromScene, { unlockOnClose: next.unlockOnClose !== false });
  }

  finishCgPlayback() {
    const cp = this.cgPlayback;
    if (!cp) return;
    if (cp.unlockOnClose && cp.cgId && save.unlockCg(cp.cgId)) {
      this.showToast('CG 已收录至图鉴');
    }
    const fromScene = cp.fromScene || 'cg_gallery';
    this.cgPlayback = null;
    this.pendingCgQueue = [];
    if (typeof this.cgQueueOnComplete === 'function') {
      const done = this.cgQueueOnComplete;
      this.cgQueueOnComplete = null;
      done();
      return;
    }
    this.goScene(fromScene, { clearPending: true });
  }

  buildAchievementStoryText(achievement) {
    const desc = String((achievement && achievement.description) || '').trim();
    if (!desc) return '完成对应条件后即可解锁这条成就。';
    return /[。！？.!?]$/.test(desc) ? desc : `${desc}。`;
  }

  buildEndingStoryText(ending) {
    const desc = String((ending && ending.description) || '你完成了一段属于自己的校园篇章').trim();
    const epilogue = String((ending && ending.epilogue) || '').trim();
    const lines = [/[。！？.!?]$/.test(desc) ? desc : `${desc}。`];
    if (epilogue) {
      lines.push('', epilogue);
    }
    return lines.join('\n');
  }

  isPositiveDeltaBeneficial(statKey) {
    // 压力上涨是负向，其余常规属性上涨为正向。
    return statKey !== 'pressure';
  }

  formatStatValue(statKey, value, options = {}) {
    const n = Number(value || 0);
    const isDelta = !!options.delta;
    if (statKey === 'gpa') {
      return isDelta ? `${n > 0 ? '+' : ''}${n.toFixed(2)}` : n.toFixed(2);
    }
    if (statKey === 'money') {
      const whole = Math.round(n);
      return isDelta ? `${whole > 0 ? '+' : ''}${whole}` : `${whole}`;
    }
    const whole = Math.round(n);
    return isDelta ? `${whole > 0 ? '+' : ''}${whole}` : `${whole}`;
  }

  formatStatChanges(effects) {
    if (!effects) return [];
    const result = [];
    for (const [k, v] of Object.entries(effects)) {
      if (!v) continue;
      const val = this.formatStatValue(k, v, { delta: true });
      const posGood = this.isPositiveDeltaBeneficial(k);
      const color = v > 0
        ? (posGood ? 'good' : 'danger')
        : (posGood ? 'danger' : 'good');
      result.push({ label: `${this.getStatLabel(k)} ${val}`, color: uiTheme.colors[color] || uiTheme.colors.textSub });
    }
    return result;
  }

  /** 将 formatStatChanges 结果绘制成一行或多行彩色碎片（· 分隔），返回下一行 y */
  drawColoredStatChangeLine(x, y, maxW, lineHeight, effects) {
    const items = this.formatStatChanges(effects);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    if (!items.length) {
      ctx.fillStyle = uiTheme.colors.textSub;
      ctx.fillText('无初始数值加减', x, y);
      return y + lineHeight;
    }
    const sep = ' · ';
    let cx = x;
    let cy = y;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    for (let i = 0; i < items.length; i++) {
      const { label, color } = items[i];
      ctx.font = `${uiTheme.font.small}px sans-serif`;
      const tw = ctx.measureText(label).width;
      const sepW = i < items.length - 1 ? ctx.measureText(sep).width : 0;
      if (cx > x && cx + tw + sepW > x + maxW) {
        cx = x;
        cy += lineHeight;
      }
      ctx.fillStyle = color;
      ctx.fillText(label, cx, cy);
      cx += tw;
      if (i < items.length - 1) {
        ctx.fillStyle = uiTheme.colors.textSub;
        ctx.fillText(sep, cx, cy);
        cx += sepW;
      }
    }
    return cy + lineHeight;
  }

  /** 渲染 talent.specialEffects 对应中文说明，返回最后一行下方 y */

  queueTransition(buttonId, summary, callback) {
    this.pendingTransition = {
      state: 'selected',
      buttonId,
      summary,
      callback,
    };
    this.tapLockedUntil = Date.now() + 120;
    if (this.scene === 'play' && Array.isArray(this._playEventChoiceLayouts) && this._playEventListTop != null) {
      const chrome = this._playChrome || this.getPlaySceneChrome();
      const layout = this._playEventChoiceLayouts.find((m) => m.choiceId === buttonId);
      if (layout) {
        const viewportH = Math.max(0, chrome.contentBottom - this._playEventListTop);
        const rowBottom = layout.y + layout.rowH;
        const maxScroll = typeof this._playContentScrollMax === 'number' ? this._playContentScrollMax : 0;
        if (rowBottom - this.playContentScroll > this._playEventListTop + viewportH - 8) {
          this.playContentScroll = Math.min(maxScroll, Math.max(0, rowBottom - viewportH + 16));
        } else if (layout.y - this.playContentScroll < this._playEventListTop) {
          this.playContentScroll = Math.max(0, layout.y - 8);
        }
      }
    }
  }

  commitPendingTransition() {
    if (!this.pendingTransition) return;
    const cb = this.pendingTransition.callback;
    this.pendingTransition.state = 'confirming';
    this.pendingTransition = null;
    if (typeof cb === 'function') cb();
  }

  cancelPendingTransition() {
    this.pendingTransition = null;
  }

  applyTheme(mode) {
    const nextTheme = cloneTheme(this.themeCatalog[mode] || this.themeCatalog.dark || THEME_FALLBACK);
    Object.keys(uiTheme).forEach((k) => {
      if (k !== 'themes') delete uiTheme[k];
    });
    Object.assign(uiTheme, nextTheme);
    this.backdropCacheKey = '';
  }

  setThemeMode(mode) {
    this.themeMode = mode === 'light' ? 'light' : 'dark';
    this.applyTheme(this.themeMode);
    save.saveThemeMode(this.themeMode);
  }

  setBgmVolume(nextVolume) {
    this.bgm.setVolume(nextVolume);
    save.saveAudioPrefs({ muted: this.bgm.muted, volume: this.bgm.volume });
  }

  confirmReturnToMenu() {
    if (!this.run) {
      this.goScene('menu');
      return;
    }
    if (!wx.showModal) {
      save.saveRun(this.run);
      this.goScene('menu');
      return;
    }
    wx.showModal({
      title: '确认返回',
      content: '将自动存档并返回主菜单，是否继续？',
      success: (res) => {
        if (!res.confirm) return;
        save.saveRun(this.run);
        this.goScene('menu');
      },
    });
  }

  /**
   * 主菜单刘海/状态栏安全下移：优先 wx.getSystemInfoSync().safeArea.top，
   * 与 SAFE_TOP 兜底，整体至少下移 80px，避免顶部内容被遮挡。
   */

  pushReturnScene() {
    this.returnScene = this.scene;
  }

  /** @returns {string} */
  popReturnScene() {
    const s = this.returnScene;
    this.returnScene = null;
    return s || 'play';
  }

  bindShareLaunchWelcome() {
    const info = getLaunchShareInfo();
    if (!info?.query?.from) return;
    this._pendingShareWelcome = true;
    if (wx.onShow) {
      wx.onShow((res) => {
        const q = res?.query;
        if (q && (q.from === 'share' || q.scene)) {
          this.maybeShowShareWelcome();
        }
      });
    }
  }

  maybeShowShareWelcome() {
    if (!this._pendingShareWelcome) return;
    this._pendingShareWelcome = false;
    this.showToast('欢迎通过分享来体验！');
  }

  goScene(scene, opts = {}) {
    const options = { clearPending: true, ...opts };
    if (options.clearPending) this.pendingTransition = null;
    if (scene === 'menu') {
      this.returnScene = null;
      this.maybeShowShareWelcome();
    }
    this.buttons = [];
    this.scene = scene;
    this.sceneEnteredAt = Date.now();
    this.pressedButtonId = '';
    this.narrativeScroll = 0;
    if (scene === 'ending') this.endingScroll = 0;
    this.syncBgmUnlockByScene(scene);
    if (scene === 'create_role' && options.initCreateRole) {
      this.ensureDefaultTalentForCreateRole();
    }
  }

  syncBgmUnlockByScene(scene) {
    const key = this.bgm && this.bgm.sceneToBgm ? this.bgm.sceneToBgm[scene] : null;
    if (!key) return;
    const target = BGM_CATALOG.find((x) => x.trackKey === key);
    if (!target) return;
    save.unlockBgm(target.id);
  }

  pickRandomNameByGender(gender) {
    const pool = gender === 'female' ? FEMALE_NAMES : MALE_NAMES;
    this.tempProfile.name = pool[Math.floor(Math.random() * pool.length)];
    this.tempProfile.avatarIndex = this.tempAvatarIndex;
  }

  pickRandomAvatarByGender(gender) {
    this.tempAvatarIndex = Math.floor(Math.random() * 4);
    const pool = gender === 'female' ? FEMALE_AVATAR_IDS : MALE_AVATAR_IDS;
    this.tempAvatarAssetId = pool[this.tempAvatarIndex];
    this.tempProfile.avatarIndex = this.tempAvatarIndex;
  }

  generateRandomTalents() {
    // 生成3个随机天赋供选择
    this.availableTalents = [];
    const usedIds = new Set();
    
    // 添加无天赋选项
    this.availableTalents.push({
      id: 'no_talent',
      name: '无天赋',
      description: '不借助额外特质，从最普通的状态开始。',
      effects: {},
      specialEffects: {},
      rarity: 'common',
      meme: ''
    });

    const byTier = {
      positive: [],
      balanced: [],
      negative: [],
      hell: [],
    };
    talentsCatalog.forEach((t) => {
      const tier = String((t && t.tier) || 'balanced');
      if (byTier[tier]) byTier[tier].push(t);
      else byTier.balanced.push(t);
    });
    const pickOne = (pool) => {
      if (!Array.isArray(pool) || !pool.length) return null;
      const candidate = pool.filter((t) => t && t.id && !usedIds.has(t.id));
      if (!candidate.length) return null;
      const x = candidate[Math.floor(Math.random() * candidate.length)];
      usedIds.add(x.id);
      return x;
    };

    const preferredPickA = pickOne([...byTier.positive, ...byTier.balanced]);
    if (preferredPickA) this.availableTalents.push(preferredPickA);
    const preferredPickB = pickOne([...byTier.negative, ...byTier.hell]);
    if (preferredPickB) this.availableTalents.push(preferredPickB);
    while (this.availableTalents.length < 4) {
      const extra = pickOne(talentsCatalog);
      if (!extra) break;
      this.availableTalents.push(extra);
    }
  }

  selectTalent(talent, quiet) {
    this.selectedTalent = talent;
    if (!quiet) this.showToast(`选择了天赋：${talent.name}`);
  }

  getTalentPoolByTierFilter(tierFilter = this.talentTierFilter) {
    const tier = tierFilter || 'all';
    return talentsCatalog.filter((t) => {
      if (!t || !t.id) return false;
      if (tier === 'all') return true;
      return String(t.tier || 'balanced') === tier;
    });
  }

  pickRandomTalentFromTierFilter(tierFilter = this.talentTierFilter) {
    const pool = this.getTalentPoolByTierFilter(tierFilter);
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** 进入「新游戏」建角时：自动随机一个非「无」天赋，不弹 Toast */
  ensureDefaultTalentForCreateRole() {
    this.talentTierFilter = 'all';
    this.generateRandomTalents();
    const pick = this.availableTalents.find((t) => t.id !== 'no_talent');
    if (pick) this.selectTalent(pick, true);
  }

  rerollTalents() {
    this.selectedTalent = null;
    this.generateRandomTalents();
    this.showToast('天赋已刷新');
  }

  slimEvent(ev) {
    if (!ev) return null;
    return {
      id: ev.id,
      title: this.applyRunContent(ev.title || ''),
      body: this.applyRunContent(ev.body || ''),
      layer: ev.layer || 'main',
      npcRef: ev.npcRef,
      choices: (ev.choices || []).map((c) => ({
        text: this.applyRunContent(c.text),
        effects: { ...(c.effects || {}) },
        setFlags: c.setFlags || [],
        addFlags: c.addFlags || {},
        narrative: c.narrative,
        npcRef: c.npcRef,
        mentorIndex: c.mentorIndex,
        romanceSkip: c.romanceSkip,
        romancePickIndex: c.romancePickIndex,
        npcAffinityDelta: c.npcAffinityDelta,
      })),
    };
  }

  applyTemplate(text) {
    const profile = (this.run && this.run.playerProfile) || this.tempProfile;
    return String(text || '').replace(/\{playerName\}/g, profile.name || '同学');
  }

  /** 替换玩家名 + 本局 NPC 名占位 */
  applyRunContent(text) {
    let s = this.applyTemplate(text);
    if (!this.run || !this.run.npcRoster) return s;
    const R = this.run.npcRoster;
    const nameOf = (id) => {
      const n = npcsCatalog.find((x) => x.id === id);
      return n ? n.name : '同学';
    };
    (R.roommates || []).forEach((id, i) => {
      s = s.split(`{roommate${i + 1}}`).join(nameOf(id));
    });
    (R.mentors || []).forEach((id, i) => {
      s = s.split(`{mentor${i + 1}}`).join(nameOf(id));
    });
    (R.romanceCandidates || []).forEach((id, i) => {
      s = s.split(`{romance${i + 1}}`).join(nameOf(id));
    });
    (R.seniors || []).forEach((id, i) => {
      s = s.split(`{senior${i + 1}}`).join(nameOf(id));
    });
    if (R.primaryMentor) s = s.split('{primaryMentor}').join(nameOf(R.primaryMentor));
    if (R.partner) s = s.split('{partner}').join(nameOf(R.partner));
    return s;
  }

  getCurrentEvent() {
    if (!this.run) return null;
    if (this.run.phase === 'main_event') return this.run.pendingMainEvent;
    if (this.run.phase === 'side_event') return this.run.pendingSideEvent;
    return null;
  }

  pickMainForRun(run) {
    return this.slimEvent(pickMainEvent(run, eventsCatalog) || fallbackEvent(run.semesterIndex));
  }

  pickSideForRun(run) {
    return this.slimEvent(pickSideEvent(run, eventsCatalog));
  }

  ensureGoalSystemState() {
    if (!this.run) return;
    this.run.weeksPerSemester = Number(this.run.weeksPerSemester || WEEKS_PER_SEMESTER);
    this.run.goalConfig = this.run.goalConfig && typeof this.run.goalConfig === 'object'
      ? this.run.goalConfig
      : { semesterGoalCount: GOAL_SYSTEM_CONFIG.semesterGoalCount };
    if (!this.run.goals || typeof this.run.goals !== 'object') {
      this.run.goals = {
        coreGoalId: 'core_academic',
        coreGoalTitle: '学术进阶',
        coreGoalDesc: '把绩点和能力打到稳定高线，争取高质量毕业履历。',
        semesterGoals: [],
        currentWeekGoal: null,
        completedWeekGoals: [],
        feedbackQueue: [],
      };
    }
    this.run.goals.semesterGoals = Array.isArray(this.run.goals.semesterGoals) ? this.run.goals.semesterGoals : [];
    this.run.goals.completedWeekGoals = Array.isArray(this.run.goals.completedWeekGoals) ? this.run.goals.completedWeekGoals : [];
    this.run.goals.feedbackQueue = Array.isArray(this.run.goals.feedbackQueue) ? this.run.goals.feedbackQueue : [];
    this.run.goals.currentWeekGoal = this.run.goals.currentWeekGoal || null;
  }

  buildSemesterGoals() {
    if (!this.run) return [];
    const semNo = (this.run.semesterIndex || 0) + 1;
    const goalCount = Math.max(2, Number(this.run.goalConfig?.semesterGoalCount || GOAL_SYSTEM_CONFIG.semesterGoalCount));
    const byCore = this.run.goals?.coreGoalId;
    const base = [
      { id: `goal_survival_${semNo}`, title: '稳住状态线', check: 'survival', metric: '保持健康≥45且压力≤75' },
      { id: `goal_social_${semNo}`, title: '关系有推进', check: 'social', metric: '社交提升或关系值提升' },
    ];
    if (byCore === 'core_academic') {
      base.unshift({ id: `goal_academic_${semNo}`, title: '学业主线推进', check: 'academic', metric: '绩点或能力出现正增长' });
    } else if (byCore === 'core_career') {
      base.unshift({ id: `goal_career_${semNo}`, title: '就业筹码积累', check: 'career', metric: '选择实习/兼职/职业发展向行动' });
    } else if (byCore === 'core_relationship') {
      base.unshift({ id: `goal_relationship_${semNo}`, title: '人际关系经营', check: 'relationship', metric: '优先社交/关系维护类行动' });
    } else {
      base.unshift({ id: `goal_health_${semNo}`, title: '生存优先', check: 'survival', metric: '控制压力并守住健康与资金' });
    }
    return base.slice(0, goalCount);
  }

  assignSemesterGoals() {
    if (!this.run) return;
    this.ensureGoalSystemState();
    this.run.goals.semesterGoals = this.buildSemesterGoals();
    this.assignCurrentWeekGoal();
  }

  assignCurrentWeekGoal() {
    if (!this.run || !this.run.goals || !Array.isArray(this.run.goals.semesterGoals)) return;
    const goals = this.run.goals.semesterGoals;
    if (!goals.length) {
      this.run.goals.currentWeekGoal = null;
      return;
    }
    const idx = Number(this.run.weekIndex || 0) % goals.length;
    this.run.goals.currentWeekGoal = { ...goals[idx], week: Number(this.run.weekIndex || 0) + 1, completed: false };
  }

  evaluateWeekGoalProgress(goal, action, beforeStats, afterStats) {
    if (!goal || !action) return false;
    const tags = Array.isArray(action.tags) ? action.tags : [];
    const bs = beforeStats || {};
    const as = afterStats || {};
    switch (goal.check) {
      case 'academic':
        return Number(as.gpa || 0) > Number(bs.gpa || 0) || Number(as.skill || 0) > Number(bs.skill || 0) || tags.includes('study');
      case 'career':
        return tags.includes('career') || tags.includes('internship') || action.id === 'act_intern' || tags.includes('parttime');
      case 'relationship':
        return tags.includes('social') || tags.includes('romance') || tags.includes('club');
      case 'social':
        return Number(as.social || 0) > Number(bs.social || 0) || tags.includes('social') || tags.includes('club');
      case 'survival':
      default:
        return Number(as.health || 0) >= 45 && Number(as.pressure || 0) <= 75;
    }
  }

  pushGoalFeedback(ok, goal) {
    if (!this.run || !this.run.goals) return;
    const semNo = Number(this.run.semesterIndex || 0) + 1;
    const wkNo = Number(this.run.weekIndex || 0) + 1;
    const text = ok
      ? `第${semNo}学期第${wkNo}周目标达成：${goal.title}`
      : `第${semNo}学期第${wkNo}周目标未达成：${goal.title}`;
    this.run.goals.feedbackQueue.push(text);
    this.showToast(ok ? `周目标达成：${goal.title}` : `周目标未达成：${goal.title}`);
  }

  startNewRun(schoolId, majorId) {
    const run = createInitialRunState(schoolId, majorId, {
      difficulty: this.tempProfile.difficulty || DEFAULT_DIFFICULTY,
    });
    run.playerProfile = {
      ...this.tempProfile,
      avatarAssetId: this.tempAvatarAssetId,
      avatarIndex: this.tempAvatarIndex,
    };
    if (run.schoolMajorMeta && run.schoolMajorMeta.isCrossMajor) {
      run.flags = { ...(run.flags || {}), crossMajorChallenge: true };
    }
    run.weeksPerSemester = WEEKS_PER_SEMESTER;
    run.goalConfig = { semesterGoalCount: GOAL_SYSTEM_CONFIG.semesterGoalCount };
    seedNpcRuntime(run, npcsCatalog);
    run.unlockedNpcIds = [];
    run.pendingMainEvent = this.pickMainForRun(run);
    this.run = run;
    this.pendingNpcUnlocks = [];
    this.ensureGoalSystemState();
    this.assignSemesterGoals();
    save.saveRun(this.run);
    this.goScene('play');
  }

  continueRun() {
    this.run = save.loadRun();
    if (!this.run || this.run.semesterIndex >= TOTAL_SEMESTERS) {
      this.goScene('menu');
      return;
    }
    const pp = this.run.playerProfile;
    if (pp) {
      if (pp.avatarAssetId) this.tempAvatarAssetId = pp.avatarAssetId;
      else this.tempAvatarAssetId = (pp.gender === 'female' ? FEMALE_AVATAR_IDS : MALE_AVATAR_IDS)[0];
      if (typeof pp.avatarIndex === 'number' && pp.avatarIndex >= 0 && pp.avatarIndex < 4) {
        this.tempAvatarIndex = pp.avatarIndex;
      } else {
        this.tempAvatarIndex = avatarSlotIndexFromAssetId(this.tempAvatarAssetId);
      }
      this.tempProfile.avatarIndex = this.tempAvatarIndex;
    }
    if (!this.run.pendingMainEvent && this.run.phase === 'main_event') {
      this.run.pendingMainEvent = this.pickMainForRun(this.run);
      save.saveRun(this.run);
    }
    if (this.run && (!this.run.npcRoster || !(this.run.npcRoster.roommates || []).length)) {
      seedNpcRuntime(this.run, npcsCatalog);
      save.saveRun(this.run);
    }
    this.pendingNpcUnlocks = [];
    this.bootstrapLegacyNpcUnlocks();
    this.pruneRelationshipUnlocks();
    this.ensureGoalSystemState();
    if (!Array.isArray(this.run.goals.semesterGoals) || !this.run.goals.semesterGoals.length) {
      this.assignSemesterGoals();
    } else if (!this.run.goals.currentWeekGoal) {
      this.assignCurrentWeekGoal();
    }
    save.saveRun(this.run);
    this.goScene('play');
  }

  finishRun() {
    const previousMeta = save.loadMeta();
    const end = resolveEnding(this.run, endingsCatalog, { recentEndingIds: previousMeta.recentEndingIds || [] });
    this.finalizeRunWithEnding(end, previousMeta);
  }

  finishRunWithForcedEnding(endingId) {
    if (!this.run) return;
    const previousMeta = save.loadMeta();
    const forced = endingsCatalog.find((x) => x.id === endingId)
      || resolveEnding(this.run, endingsCatalog, { recentEndingIds: previousMeta.recentEndingIds || [] });
    this.finalizeRunWithEnding(forced, previousMeta);
  }

  finalizeRunWithEnding(end, previousMeta = null) {
    if (!this.run || !end) return;
    const runSnapshot = { ...this.run };
    const nh = runSnapshot.npcEventHits || {};
    const npcHitSum = Object.values(nh).reduce((a, b) => a + Number(b || 0), 0);
    runSnapshot.flags = { ...(runSnapshot.flags || {}), npcEventHits: npcHitSum };
    this.runSettlement = this.computeRunSettlement(runSnapshot);
    const prev = previousMeta || save.loadMeta();
    save.unlockEnding(end.id);
    save.pushRecentEnding(end.id);
    save.incrementPlayCount();
    save.addChoiceCount(this.run.log.length);
    const endingEligibleCgs = this.getEligibleCgs(runSnapshot, end);
    const newlyUnlockedAchievements = evaluateAchievements(runSnapshot, end, achievementsCatalog)
      .filter((id) => save.unlockAchievement(id));
    const nextMeta = save.loadMeta();
    const unlocks = save.getNewUnlocks(prev, nextMeta);
    Object.assign(this.runSettlement, {
      thisRunEndingId: end.id,
      thisRunNewAchievements: newlyUnlockedAchievements,
      thisRunNewSchools: unlocks.newSchools,
      thisRunNewMajors: unlocks.newMajors,
    });
    this.runSnapshotSchoolId = runSnapshot.schoolId;
    this.runSnapshotMajorId = runSnapshot.majorId;
    save.clearRun();
    this.run = null;
    const hints = [];
    if (newlyUnlockedAchievements.length) hints.push(`新成就 ${newlyUnlockedAchievements.length} 个`);
    if (unlocks.newSchools.length) hints.push(`新学校 ${unlocks.newSchools.length} 所`);
    if (unlocks.newMajors.length) hints.push(`新专业 ${unlocks.newMajors.length} 个`);
    if (hints.length) this.showToast(hints.join('，'), 2600);
    this.currentEnding = end;
    if (endingEligibleCgs.length) {
      const cg = endingEligibleCgs[0];
      this.markCgTriggeredOnRun(runSnapshot, cg.id);
      this.pendingCgQueue = [{ cg, fromScene: 'ending', unlockOnClose: true }];
      this.cgQueueOnComplete = () => {
        this.goScene('ending');
      };
      this.processCgQueue();
    } else {
      this.goScene('ending');
    }
  }

  advanceWeekOrSemester() {
    if (!this.run) return null;
    this.run.actionSlotsLeft -= 1;
    if (this.run.actionSlotsLeft > 0) {
      this.run.weekIndex += 1;
      this.run.phase = 'week_action';
      this.assignCurrentWeekGoal();
      this.unlockNpcByProgress(`第 ${this.run.weekIndex + 1} 周校园生活`);
      return { kind: 'next_week' };
    }

    const completedSemesterIndex = this.run.semesterIndex;
    this.run.semesterIndex += 1;
    this.run.turn = this.run.semesterIndex;
    this.run.weekIndex = 0;
    this.run.actionSlotsLeft = Number(this.run.weeksPerSemester || WEEKS_PER_SEMESTER);
    this.run.phase = 'main_event';
    this.run.pendingMainEvent = null;
    this.run.pendingSideEvent = null;

    if (this.run.semesterIndex >= TOTAL_SEMESTERS) {
      this.finishRun();
      return { kind: 'run_finished' };
    }
    this.assignSemesterGoals();
    this.run.pendingMainEvent = this.pickMainForRun(this.run);
    this.unlockNpcByProgress(`第 ${this.run.semesterIndex + 1} 学期新环境`);
    return { kind: 'semester_completed', completedSemesterIndex };
  }

  queueSemesterSummaryIfNeeded(adv) {
    if (!adv || adv.kind !== 'semester_completed') return;
    const body = this.buildSemesterSummaryText(adv.completedSemesterIndex);
    this.showNarrative(body, [], () => {
      this.flushPendingNpcUnlockNarrative();
      this.maybeShowSemesterInterstitial(adv.completedSemesterIndex);
    });
  }

  maybeShowSemesterInterstitial(completedSemesterIndex) {
    const semNo = Number(completedSemesterIndex || 0) + 1;
    if (!Number.isFinite(semNo) || semNo <= 0 || semNo >= TOTAL_SEMESTERS || semNo % 2 !== 0) return;
    if (Date.now() - Number(this.lastRewardedAdAt || 0) < 120000) return;
    const meta = save.loadMeta();
    if (Number(meta.lastInterstitialSemester || 0) === semNo) return;
    if (Date.now() - Number(meta.lastInterstitialAt || 0) < 6 * 60 * 1000) return;
    setTimeout(() => {
      if (this.narrative || this.cgPlayback) return;
      showInterstitial('semester_complete').then((result) => {
        if (!result.ok) return;
        const nextMeta = save.loadMeta();
        nextMeta.lastInterstitialAt = Date.now();
        nextMeta.lastInterstitialSemester = semNo;
        save.saveMeta(nextMeta);
      });
    }, 650);
  }

  isRewardAssistEligible() {
    if (!this.run || this.scene !== 'play' || this.pendingTransition) return false;
    const st = this.run.stats || {};
    const semester = Number(this.run.semesterIndex || 0);
    if (Number((this.run.flags || {}).rewardAssistSemester) === semester) return false;
    return Number(st.health || 0) <= 35 || Number(st.pressure || 0) >= 72;
  }

  openRewardAssist() {
    if (!this.isRewardAssistEligible() || this.rewardedAssistPending) return;
    const watch = () => {
      this.rewardedAssistPending = true;
      showRewardedVideo('low_state_assist').then((result) => {
        this.rewardedAssistPending = false;
        if (!result.ok) {
          this.showToast(result.reason === 'closed_early' ? '这次没有看完，补给未生效' : '补给通道暂时不可用');
          return;
        }
        const semester = Number(this.run.semesterIndex || 0);
        this.run.stats = {
          ...this.run.stats,
          health: Math.min(100, Number(this.run.stats.health || 0) + 8),
          pressure: Math.max(0, Number(this.run.stats.pressure || 0) - 8),
        };
        this.run.flags = {
          ...(this.run.flags || {}),
          rewardAssistSemester: semester,
        };
        this.lastRewardedAdAt = Date.now();
        save.saveRun(this.run);
        this.showNarrative(
          '你关掉手机，去操场慢慢走了一圈。夜风让紧绷的肩膀松下来，回到宿舍后，你给自己留了半小时什么都不做。\n\n状态不是奖励，是继续往前走的底盘。',
          this.formatStatChanges({ health: 8, pressure: -8 }),
          () => this.flushPendingNpcUnlockNarrative(),
        );
      });
    };

    if (!wx.showModal) {
      watch();
      return;
    }
    wx.showModal({
      title: '应急补给',
      content: '观看一段激励视频，健康 +8、压力 −8。本学期仅一次，不影响其他奖励。',
      confirmText: '去休息',
      cancelText: '先不用',
      success: (res) => {
        if (res.confirm) watch();
      },
    });
  }

  formatLogTimeLabel(semesterIndex, weekIndex, phase) {
    const sem = Number(semesterIndex ?? 0) + 1;
    const wk = Number(weekIndex ?? 0) + 1;
    const p = phase || '';
    let tag = '';
    if (p === 'main_event') tag = '主事件';
    else if (p === 'side_event') tag = '支线';
    else if (p === 'week_action') tag = '周行动';
    else if (p) tag = String(p);
    return tag ? `第${sem}学期 · 第${wk}周 / ${tag}` : `第${sem}学期 · 第${wk}周`;
  }

  resolveLogEventTitle(entry) {
    if (!entry || !entry.eventId) return '无标题记录';
    if (entry.eventTitle) return entry.eventTitle;
    const id = entry.eventId;
    if (String(id).startsWith('act_')) {
      const a = actionsCatalog.find((x) => x.id === id);
      return a ? a.title : id;
    }
    const ev = eventsCatalog.find((x) => x.id === id);
    return ev ? ev.title : id;
  }

  formatLogEffectsLine(effects) {
    if (!effects || typeof effects !== 'object') return '';
    const parts = [];
    Object.entries(STAT_LABELS).forEach(([k]) => {
      const v = effects[k];
      if (typeof v !== 'number' || !v) return;
      parts.push(`${this.getStatLabel(k)} ${this.formatStatValue(k, v, { delta: true })}`);
    });
    return parts.length ? `本次变化为${parts.join('，')}` : '';
  }

  /** 选项阶段使用：只给方向，不暴露具体数值 */
  formatEffectHintLine(effects) {
    if (!effects || typeof effects !== 'object') return '';
    const hints = [];
    const pushHint = (key, posText, negText) => {
      const v = Number(effects[key] || 0);
      if (!v) return;
      hints.push(v > 0 ? posText : negText);
    };
    pushHint('gpa', '学业表现会提升', '学业表现会下滑');
    pushHint('skill', '能力会提升', '能力会下滑');
    pushHint('social', '社交会更活跃', '社交会降温');
    pushHint('health', '身体状态会变好', '身体状态会变差');
    pushHint('money', '手头会更宽裕', '手头会更紧');
    pushHint('pressure', '心理压力会上升', '心理压力会下降');
    if (!hints.length) return '会推动剧情与关系发生变化';
    return `这项选择大致会影响：${Array.from(new Set(hints)).join('，')}`;
  }

  formatEffectCue(effects) {
    if (!effects || typeof effects !== 'object') return '';
    const cues = [];
    const cue = (value, label, inverse = false) => {
      const n = Number(value || 0);
      if (!n) return;
      const up = inverse ? n < 0 : n > 0;
      cues.push(`${label}${up ? '↑' : '↓'}`);
    };
    cue(effects.gpa, '学业');
    cue(effects.skill, '能力');
    cue(effects.social, '社交');
    cue(effects.health, '健康');
    cue(effects.money, '余额');
    cue(effects.pressure, '压力');
    return cues.slice(0, 2).join(' · ');
  }

  describeChoiceConsequenceShort(effects) {
    const e = effects || {};
    if (Number(e.health || 0) <= -7) return '身体会多承担一些，后面得补回来。';
    if (Number(e.pressure || 0) >= 10) return '这一周会更紧，收益也会更集中。';
    if (Number(e.pressure || 0) <= -6) return '先把节奏放慢，给状态留一点余地。';
    if (Number(e.money || 0) < 0) return '需要先投入一笔成本，再看后面的回报。';
    if (Number(e.gpa || 0) > 0.12) return '会把重心往课业和成绩上挪。';
    if (Number(e.skill || 0) >= 6) return '会积累一段能带走的能力和经验。';
    if (Number(e.social || 0) >= 6) return '会牵动身边的关系，也可能带来新机会。';
    if (Number(e.health || 0) > 0) return '优先照顾状态，后面会更稳。';
    if (Number(e.money || 0) > 0) return '会换来一笔看得见的收入。';
    return '这个选择会写进本学期的经历。';
  }

  buildEventChoiceMetaText(choice) {
    if (!this.run || !choice) return '';
    const roster = this.run.npcRoster || {};
    if (choice.mentorIndex !== undefined && Array.isArray(roster.mentors)) {
      const mid = roster.mentors[choice.mentorIndex];
      const mentor = npcsCatalog.find((n) => n.id === mid);
      if (mentor) return `将优先接触：导师 ${mentor.name}`;
    }
    if (choice.romancePickIndex !== undefined && Array.isArray(roster.romanceCandidates)) {
      const rid = roster.romanceCandidates[choice.romancePickIndex];
      const romance = npcsCatalog.find((n) => n.id === rid);
      if (romance) return `将优先接触：${romance.name}`;
    }
    if (choice.romanceSkip) return '将保持单身线，专注个人成长';
    if (choice.npcRef) {
      const npc = npcsCatalog.find((n) => n.id === choice.npcRef);
      if (npc) return `关联角色：${npc.name}`;
    }
    return '';
  }

  buildEventChoicePickContent(choice) {
    const titleRaw = this.applyRunContent(choice && choice.text ? choice.text : '继续');
    const title = choice && choice.mentorIndex !== undefined ? this.sanitizePickName(titleRaw) : titleRaw;
    const metaSmall = this.buildEventChoiceMetaText(choice);
    const subtitle = metaSmall || this.describeChoiceConsequenceShort(choice && choice.effects ? choice.effects : null);
    const effectSmall = this.formatEffectCue(choice && choice.effects ? choice.effects : null);
    return {
      title,
      subtitle,
      effectSmall,
      metaSmall,
      locked: false,
    };
  }

  buildSemesterSummaryText(completedSemesterIndex) {
    if (!this.run) return '';
    attachSemesterTopAction(this.run, completedSemesterIndex, actionsCatalog);
    return buildSemesterSummaryPopupText(
      this.run,
      completedSemesterIndex,
      semesterSummaryTemplates,
      (entry) => this.resolveLogEventTitle(entry),
    );
  }

  computeRunSettlement(run) {
    if (!run) return null;
    const log = Array.isArray(run.log) ? run.log : [];
    const byPhase = { main_event: 0, side_event: 0, week_action: 0 };
    const actionCounts = {};
    log.forEach((e) => {
      if (byPhase[e.phase] !== undefined) byPhase[e.phase] += 1;
      if (e.phase === 'week_action' && e.eventId) {
        actionCounts[e.eventId] = (actionCounts[e.eventId] || 0) + 1;
      }
    });
    const topActions = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, n]) => {
        const a = actionsCatalog.find((x) => x.id === id);
        return { title: a ? a.title : id, n };
      });
    const st = run.stats || {};
    const flags = run.flags && typeof run.flags === 'object' ? run.flags : {};
    const skipFlagKeys = new Set(['npcEventHits', 'civilProgress', 'certProgress', 'researchProgress', 'contestProgress', 'studentWork', 'dormProgress', 'financeProgress', 'itemUsage']);
    const flagKeys = Object.keys(flags).filter((k) => {
      const v = flags[k];
      if (v === false || v === 0 || v === '' || v == null) return false;
      if (typeof v === 'number' && v > 0 && skipFlagKeys.has(k)) return false;
      return true;
    });
    const roster = run.npcRoster || {};
    const npcName = (id) => {
      const n = npcsCatalog.find((x) => x.id === id);
      return n ? n.name : id;
    };
    const npcHits = run.npcEventHits || {};
    const npcHitTotal = Object.values(npcHits).reduce((a, b) => a + Number(b || 0), 0);
    const npcHitBreakdown = Object.entries(npcHits)
      .filter(([, c]) => Number(c) > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, c]) => `${npcName(id)}×${c}`);
    const affMap = run.npcAffinity || {};
    const rosterIds = []
      .concat(roster.roommates || [], roster.mentors || [], roster.romanceCandidates || [], roster.seniors || [])
      .filter(Boolean);
    const extraAffIds = Object.keys(affMap).filter((id) => !rosterIds.includes(id));
    const affinityLines = []
      .concat(rosterIds, extraAffIds)
      .filter((id, i, a) => a.indexOf(id) === i)
      .map((id) => {
        const v = Number(affMap[id]);
        if (!Number.isFinite(v)) return null;
        return `${npcName(id)} ${Math.round(v)}`;
      })
      .filter(Boolean)
      .slice(0, 12);
    const meta = save.loadMeta();
    const flagLabels = {
      romanceCommitted: '恋爱线',
      romanceSkipped: '跳过恋情',
      startupIntent: '创业意向',
      civilTrack: '考公路线',
      publicInstitutionTrack: '考编与事业单位',
      researchTrack: '科研线',
      internshipReady: '实习经历',
      postgradLockedIn: '推免与保研锁定',
      crossMajorChallenge: '跨学科挑战',
      offCampus: '外宿',
      careerBigTech: '大厂走向',
      primaryMentor: '已选导师',
    };
    const notableFlags = flagKeys.map((k) => flagLabels[k] || k).slice(0, 14);
    const finalStats = {
      gpa: st.gpa,
      money: st.money,
      health: st.health,
      pressure: st.pressure,
      social: st.social,
      ability: st.ability,
    };
    return {
      totalRecords: log.length,
      byPhase,
      topActions,
      activeFlagCount: flagKeys.length,
      notableFlags,
      finalStats,
      schoolName: run.schoolId && SCHOOLS[run.schoolId] ? SCHOOLS[run.schoolId].name : run.schoolId,
      majorName: run.majorId && MAJORS[run.majorId] ? MAJORS[run.majorId].name : run.majorId,
      primaryMentorName: roster.primaryMentor ? npcName(roster.primaryMentor) : '',
      partnerName: roster.partner ? npcName(roster.partner) : '',
      npcEventHitsTotal: npcHitTotal,
      npcHitBreakdown,
      affinityLines,
      unlockedEndingsCount: (meta.unlockedEndings || []).length,
      achievementsCount: Object.keys(meta.achievements || {}).length,
    };
  }

  formatRunSettlementText(settlement) {
    if (!settlement) return '';
    const lines = ['四年档案'];
    const fs = settlement.finalStats || {};
    const place = [settlement.schoolName, settlement.majorName].filter(Boolean).join(' · ');
    if (place) lines.push(place);
    if (settlement.primaryMentorName) lines.push(`导师：${settlement.primaryMentorName}`);
    if (settlement.partnerName) lines.push(`同行的人：${settlement.partnerName}`);
    lines.push('');
    lines.push('最终状态');
    lines.push(
      `绩点 ${this.formatStatValue('gpa', fs.gpa)}，能力 ${this.formatStatValue('ability', fs.ability)}，社交 ${this.formatStatValue('social', fs.social)}`,
    );
    lines.push(
      `健康 ${this.formatStatValue('health', fs.health)}，压力 ${this.formatStatValue('pressure', fs.pressure)}，存款 ￥${this.formatStatValue('money', fs.money)}`,
    );
    if (settlement.topActions && settlement.topActions.length) {
      lines.push(`最常做：${settlement.topActions.map((x) => `${x.title} ${x.n} 次`).join('，')}`);
    }
    lines.push('');
    lines.push('这一局的选择');
    lines.push(
      `共记录 ${settlement.totalRecords} 条：主事件 ${settlement.byPhase.main_event}，支线 ${settlement.byPhase.side_event}，周行动 ${settlement.byPhase.week_action}`,
    );
    if (settlement.notableFlags && settlement.notableFlags.length) {
      lines.push(`路线：${settlement.notableFlags.slice(0, 12).join('，')}`);
    }
    if (settlement.affinityLines && settlement.affinityLines.length) {
      lines.push(`好感：${settlement.affinityLines.join('，')}`);
    }
    if (settlement.npcHitBreakdown && settlement.npcHitBreakdown.length) {
      lines.push(`重要交集：${settlement.npcHitBreakdown.join('，')}`);
    } else if (settlement.npcEventHitsTotal > 0) {
      lines.push(`与同学相关的专属经历共 ${settlement.npcEventHitsTotal} 次`);
    }
    lines.push('');
    lines.push('收藏进度');
    lines.push(
      `结局 ${settlement.unlockedEndingsCount || 0} 个 · 成就 ${settlement.achievementsCount || 0} 项`,
    );
    if (settlement.thisRunNewAchievements && settlement.thisRunNewAchievements.length) {
      const titles = settlement.thisRunNewAchievements
        .map((id) => achievementsCatalog.find((x) => x.id === id))
        .filter(Boolean)
        .map((a) => a.title);
      lines.push(`本局新成就：${titles.join('；')}`);
    }
    if (settlement.thisRunNewSchools && settlement.thisRunNewSchools.length) {
      lines.push(`新解锁学校：${settlement.thisRunNewSchools.join('，')}`);
    }
    if (settlement.thisRunNewMajors && settlement.thisRunNewMajors.length) {
      lines.push(`新解锁专业：${settlement.thisRunNewMajors.join('，')}`);
    }
    return lines.join('\n');
  }

  handleEventChoice(choice) {
    const ev = this.getCurrentEvent();
    if (!this.run || !ev) return;

    const narrativeText = choice.narrative || this.generateDefaultNarrative(choice, ev);
    const changes = this.formatStatChanges(choice.effects);

    const doApply = () => {
      if (choice.mentorIndex !== undefined && this.run.npcRoster && Array.isArray(this.run.npcRoster.mentors)) {
        const mid = this.run.npcRoster.mentors[choice.mentorIndex];
        if (mid) {
          this.run.flags = { ...(this.run.flags || {}), primaryMentor: mid };
          this.run.npcRoster.primaryMentor = mid;
          this.pruneRelationshipUnlocks();
          this.unlockNpc(mid, ev.title || choice.text || '导师选择事件');
          adjustNpcAffinity(this.run, mid, 6, '你选定了导师，也知道了课题组的节奏。');
        }
      }
      if (choice.romanceSkip) {
        this.run.flags = { ...(this.run.flags || {}), romanceSkipped: true };
        this.pruneRelationshipUnlocks();
      } else if (choice.romancePickIndex !== undefined && this.run.npcRoster && Array.isArray(this.run.npcRoster.romanceCandidates)) {
        const pid = this.run.npcRoster.romanceCandidates[choice.romancePickIndex];
        if (pid) {
          this.run.npcRoster.partner = pid;
          this.run.flags = { ...(this.run.flags || {}), romanceCommitted: true };
          this.pruneRelationshipUnlocks();
          this.unlockNpc(pid, ev.title || choice.text || '关系选择事件');
          adjustNpcAffinity(this.run, pid, 10, '这次谈话之后，你们对彼此的了解多了一些。');
        }
      }
      if (choice.npcAffinityDelta && typeof choice.npcAffinityDelta === 'object') {
        Object.entries(choice.npcAffinityDelta).forEach(([nid, d]) => {
          this.unlockNpc(nid, ev.title || choice.text || '互动事件');
          adjustNpcAffinity(this.run, nid, Number(d || 0), choice.text);
        });
      }

      this.run = applyChoiceOutcome(this.run, choice);
      const evTitle = ev.title || '';
      this.run.log.push({
        eventId: ev.id,
        eventTitle: evTitle,
        choiceText: choice.text,
        semesterIndex: this.run.semesterIndex,
        weekIndex: this.run.weekIndex,
        phase: this.run.phase,
        effects: choice.effects || {},
        outcomeNarrative: String(narrativeText || '').slice(0, 120),
        npcRef: choice.npcRef || ev.npcRef || null,
      });
      if (ev.npcRef || choice.npcRef) {
        const nid = choice.npcRef || ev.npcRef;
        this.unlockNpc(nid, ev.title || choice.text || '剧情事件');
        this.run.npcEventHits = { ...(this.run.npcEventHits || {}), [nid]: Number((this.run.npcEventHits || {})[nid] || 0) + 1 };
      }
      this.run.usedEventIds.push(ev.id);
      if (this.run.phase === 'main_event') {
        this.run.pendingMainEvent = null;
        this.run.phase = 'week_action';
        this.run.weekIndex = 0;
        this.run.actionSlotsLeft = Number(this.run.weeksPerSemester || WEEKS_PER_SEMESTER);
        this.assignCurrentWeekGoal();
      } else if (this.run.phase === 'side_event') {
        this.run.pendingSideEvent = null;
        this.queueSemesterSummaryIfNeeded(this.advanceWeekOrSemester());
      }
      if (!this.run) return;
      save.saveRun(this.run);
      this.flushPendingNpcUnlockNarrative();
    };

    this.showNarrative(narrativeText, changes, doApply);
  }

  generateDefaultNarrative(choice, event) {
    const profile = (this.run && this.run.playerProfile) || this.tempProfile;
    const playerName = profile.name || '同学';
    
    // 根据选择的效果生成不同的描述
    const effects = choice.effects || {};
    const effectDescriptions = [];
    
    if (effects.gpa && effects.gpa > 0) {
      effectDescriptions.push('感觉学到了很多东西');
    }
    if (effects.social && effects.social > 0) {
      effectDescriptions.push('认识了新朋友');
    }
    if (effects.health && effects.health > 0) {
      effectDescriptions.push('身体状态不错');
    }
    if (effects.skill && effects.skill > 0) {
      effectDescriptions.push('能力得到了提升');
    }
    if (effects.pressure && effects.pressure < 0) {
      effectDescriptions.push('心情放松了不少');
    }
    if (effects.money && effects.money > 0) {
      effectDescriptions.push('钱包鼓了一点');
    }
    
    const defaultDesc = effectDescriptions.length > 0
      ? effectDescriptions.join('，') + '。'
      : '事情没有立刻发生明显变化。';

    return `${playerName}决定${choice.text}。${defaultDesc}`;
  }

  notifyPostWeeklyActionFeedback() {
    if (!this.run) return;
    if (this.run.lastRandomEvent) {
      const evt = this.run.lastRandomEvent;
      this.run.lastRandomEvent = null;
      this.presentRandomEvent(evt);
      return;
    }
    if (this.run.lastGainedItem) {
      const g = this.run.lastGainedItem;
      this.run.lastGainedItem = null;
      if (g.gainNarrative) {
        this.showNarrative(
          `获得物品：${g.name}\n\n${g.gainNarrative}`,
          [],
          () => this.flushPendingNpcUnlockNarrative(),
        );
        return;
      }
      this.showToast(`获得物品：${g.name}，可在背包中使用`);
    }
    this.flushPendingNpcUnlockNarrative();
  }

  presentRandomEvent(evt) {
    if (!this.run || !evt) return;
    const eventTitle = String(evt.title || '突发事件');
    const eventDesc = String(evt.description || '本周发生了意料之外的情况。');
    const options = Array.isArray(evt.responses) && evt.responses.length
      ? evt.responses
      : [{ text: '先扛过去', effects: {}, narrative: '你决定先稳住节奏，硬着头皮把这周过完。' }];
    const applyByOption = (op) => {
      if (!this.run) return;
      const mergedEffects = { ...(evt.effects || {}) };
      Object.entries(op.effects || {}).forEach(([k, v]) => {
        mergedEffects[k] = Number(mergedEffects[k] || 0) + Number(v || 0);
      });
      const outcome = String(op.narrative || '你做出了应对，这周的状态因此发生变化。');
      const afterApply = () => {
        if (!this.run) return;
        this.run = applyChoiceOutcome(this.run, {
          effects: mergedEffects,
          setFlags: Array.isArray(op.setFlags) ? op.setFlags : [],
          addFlags: op.addFlags || {},
        });
        this.triggerCgsByRunState(this.run, null, 'play', true);
        save.saveRun(this.run);
        if (op.gameOverEndingId) {
          const forcedEndingId = String(op.gameOverEndingId);
          this.showNarrative(
            `${outcome}\n\n这次选择让你决定提前终止本局。`,
            this.formatStatChanges(mergedEffects),
            () => this.finishRunWithForcedEnding(forcedEndingId),
          );
          return;
        }
        this.showNarrative(outcome, this.formatStatChanges(mergedEffects), () => this.flushPendingNpcUnlockNarrative());
      };
      afterApply();
    };

    this.showNarrativeWithOptions(
      `【突发事件】${eventTitle}\n\n${eventDesc}\n\n你打算怎么应对？`,
      options.map((op) => ({
        label: String(op.text || '应对'),
        variant: op.gameOverEndingId ? 'danger' : 'normal',
        onSelect: () => applyByOption(op),
      })),
    );
  }

  /**
   * 周行动结算（叙事确认后执行）
   * @param {object} action
   * @param {Record<string, number>} mergedEffects
   * @param {string} narrativeText
   * @param {Array<{ id: string, q: number }>} [shopPurchaseLines] 商店静默入包
   */
  executeWeeklyActionCommit(action, mergedEffects, narrativeText, shopPurchaseLines) {
    const cost = Number(action.cost || 0);
    const changes = this.formatStatChanges(mergedEffects);
    const doApply = () => {
      const beforeStats = { ...(this.run.stats || {}) };
      const activeWeekGoal =
        this.run.goals && this.run.goals.currentWeekGoal ? { ...this.run.goals.currentWeekGoal } : null;
      if (cost > 0) {
        this.run.stats = { ...this.run.stats, money: this.run.stats.money - cost };
      }
      this.run = applyWeeklyAction(this.run, action);
      this.run = applyStatusEffects(this.run);
      this.run = triggerRandomEvent(this.run, randomEventsCatalog);
      this.run = maybeGrantItem(this.run, itemsCatalog);
      if (shopPurchaseLines && shopPurchaseLines.length) {
        shopPurchaseLines.forEach((line) => {
          const q = Math.max(0, Math.min(99, Number(line.q) || 0));
          const id = String(line.id || '');
          for (let i = 0; i < q; i++) {
            this.run = pushInventoryItem(this.run, id);
          }
        });
      }
      this.run.log.push({
        eventId: action.id,
        eventTitle: action.title,
        choiceText: action.title,
        semesterIndex: this.run.semesterIndex,
        weekIndex: this.run.weekIndex,
        phase: 'week_action',
        effects: mergedEffects,
        outcomeNarrative: String(narrativeText || '').slice(0, 120),
        npcRef: null,
      });
      if (activeWeekGoal) {
        const ok = this.evaluateWeekGoalProgress(activeWeekGoal, action, beforeStats, this.run.stats);
        const done = { ...activeWeekGoal, completed: ok };
        this.run.goals.completedWeekGoals.push(done);
        this.pushGoalFeedback(ok, activeWeekGoal);
      }

      const mentorRel = Number((this.run.relationships && this.run.relationships.mentor) || 40);
      const mentorUnlocked = !!(this.run.flags && this.run.flags.mentorUnlocked);
      const sideChance = mentorUnlocked ? (mentorRel >= 60 ? 0.55 : 0.45) : 0.45;
      const side = Math.random() < sideChance ? this.pickSideForRun(this.run) : null;
      if (side) {
        this.run.pendingSideEvent = side;
        this.run.phase = 'side_event';
      } else {
        const adv = this.advanceWeekOrSemester();
        this.queueSemesterSummaryIfNeeded(adv);
        if (this.run && adv && adv.kind === 'next_week') {
          this.maybeInjectNpcStoryEvents();
        }
      }
      if (action.id === 'act_research' && this.run) {
        this.run.flags = { ...(this.run.flags || {}), mentorUnlocked: true };
      }
      if (!this.run) return;
      this.triggerCgsByRunState(this.run, null, 'play');
      save.saveRun(this.run);
      this.notifyPostWeeklyActionFeedback();
    };
    this.showNarrative(narrativeText, changes, doApply);
  }

  openWeeklyShop(action) {
    const currentDisplayItems = this.pickWeeklyShopDisplayItems(3);
    const cart = {};
    currentDisplayItems.forEach((row) => {
      cart[row.itemId] = 0;
    });
    this.weeklyShopOverlay = { action, cart, scroll: 0, currentDisplayItems };
  }

  /** 从总商品池中随机无放回抽取 count 件，作为本周展示商品 */
  pickWeeklyShopDisplayItems(count = 3) {
    const allShopItems = Array.isArray(WEEKLY_SHOP_STOCK) ? WEEKLY_SHOP_STOCK.slice() : [];
    if (!allShopItems.length) return [];
    for (let i = allShopItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = allShopItems[i];
      allShopItems[i] = allShopItems[j];
      allShopItems[j] = tmp;
    }
    const take = Math.max(1, Math.min(Number(count) || 3, allShopItems.length));
    return allShopItems.slice(0, take);
  }

  getWeeklyShopStageInfo() {
    if (!this.run) return { key: 'sophomore', label: '常规学期', multiplier: 1 };
    const semNo = Number(this.run.semesterIndex || 0) + 1;
    if (semNo <= 2) return { key: 'freshman', label: '大一新生季', multiplier: 0.9 };
    if (semNo <= 4) return { key: 'sophomore', label: '大二常规季', multiplier: 1.0 };
    return { key: 'junior_plus', label: '大三大四冲刺季', multiplier: 1.12 };
  }

  /** 动态单价：按年级阶段微调，资金紧张时给轻微保底折扣 */
  getWeeklyShopUnitPrice(itemId) {
    const row = WEEKLY_SHOP_STOCK.find((s) => s.itemId === itemId);
    if (!row) return 0;
    const stage = this.getWeeklyShopStageInfo();
    let m = stage.multiplier;
    const money = Number((this.run && this.run.stats && this.run.stats.money) || 0);
    if (money < 260) m *= 0.92;
    const priced = Math.round(Number(row.price || 0) * m);
    return Math.max(8, priced);
  }

  /** 计算购物总价（含路费） */
  computeWeeklyShopTotal(cart, browseOnly) {
    if (browseOnly) return 0;
    const transit = WEEKLY_SHOP_TRANSIT_FEE;
    let total = transit;
    Object.entries(cart || {}).forEach(([id, rawQ]) => {
      const q = Math.max(0, Math.min(3, Number(rawQ) || 0));
      if (!q) return;
      const unit = this.getWeeklyShopUnitPrice(id);
      if (!unit) return;
      total += unit * q;
    });
    return total;
  }

  /** 界面预览：未选商品时为 0，有商品时为货款+路费 */
  computeWeeklyShopPreviewTotal(cart) {
    let sub = 0;
    Object.entries(cart || {}).forEach(([id, rawQ]) => {
      const q = Math.max(0, Math.min(3, Number(rawQ) || 0));
      if (!q) return;
      const unit = this.getWeeklyShopUnitPrice(id);
      if (!unit) return;
      sub += unit * q;
    });
    if (!sub) return 0;
    return sub + WEEKLY_SHOP_TRANSIT_FEE;
  }

  finalizeWeeklyShop(browseOnly) {
    const ov = this.weeklyShopOverlay;
    if (!ov || !this.run) return;
    const { action, cart } = ov;
    const lines = [];
    if (!browseOnly) {
      Object.entries(cart).forEach(([id, rawQ]) => {
        const q = Math.max(0, Math.min(3, Number(rawQ) || 0));
        if (!q) return;
        const unit = this.getWeeklyShopUnitPrice(id);
        if (!unit) return;
        lines.push({ id, q, price: unit });
      });
      if (!lines.length) {
        this.showToast('请先选择商品，或点「只逛不买」');
        return;
      }
    }
    const total = this.computeWeeklyShopTotal(cart, browseOnly);
    if (!browseOnly && Number(this.run.stats.money || 0) < total) {
      this.showToast(`资金不足，需要￥${total}`);
      return;
    }
    this.weeklyShopOverlay = null;

    let narrativeText;
    let synthetic;
    if (browseOnly) {
      narrativeText =
        '你在货架之间绕了很久，试吃、试闻、试穿样样都来了一遍——最后什么都没结账。售货员的微笑有点僵，但你觉得自己省下了一笔「情绪税」。';
      synthetic = {
        ...action,
        cost: 0,
        effects: {
          pressure: -5,
          health: 1,
          social: -1,
        },
      };
    } else {
      const transit = WEEKLY_SHOP_TRANSIT_FEE;
      const nameBits = [];
      const gainBits = [];
      lines.forEach((line) => {
        const it = itemsCatalog.find((i) => i.id === line.id);
        const nm = it ? it.name : line.id;
        nameBits.push(`${nm}×${line.q}`);
        if (it && it.gainNarrative) {
          for (let j = 0; j < line.q; j++) {
            gainBits.push(`「${nm}」${it.gainNarrative}`);
          }
        }
      });
      narrativeText = `${action.narrative}\n\n小票合计 ￥${total}。其中货款 ￥${total - transit}，往返路费 ￥${transit}。你拎起塑料袋，里面有${nameBits.join('、')}。${
        gainBits.length ? `\n\n入包时的小插曲：\n${gainBits.join('\n')}` : ''
      }`;
      synthetic = {
        ...action,
        cost: 0,
        effects: {
          pressure: (action.effects && action.effects.pressure !== undefined ? action.effects.pressure : 0) - 2 - Math.min(6, lines.length * 2),
          health: (action.effects && action.effects.health !== undefined ? action.effects.health : 0) + Math.min(5, 1 + lines.length),
          social: (action.effects && action.effects.social !== undefined ? action.effects.social : 0) + Math.min(5, lines.length),
          money: (action.effects && action.effects.money !== undefined ? action.effects.money : 0) - total,
        },
      };
    }
    const mergedEffects = { ...(synthetic.effects || {}) };
    this.executeWeeklyActionCommit(
      synthetic,
      mergedEffects,
      narrativeText,
      browseOnly ? [] : lines.map((l) => ({ id: l.id, q: l.q })),
    );
  }

  /** 在 renderPlay 的周行动区内绘制购物层并注册按钮 */
  renderWeeklyShopOverlay(pad, w, yStart, topContentBottom) {
    const ov = this.weeklyShopOverlay;
    if (!ov || !this.run) return yStart;
    const cart = ov.cart || {};
    const scroll = Number(ov.scroll || 0);
    if (!Array.isArray(ov.currentDisplayItems) || !ov.currentDisplayItems.length) {
      ov.currentDisplayItems = this.pickWeeklyShopDisplayItems(3);
      ov.currentDisplayItems.forEach((row) => {
        if (ov.cart[row.itemId] === undefined) ov.cart[row.itemId] = 0;
      });
    }
    const stock = ov.currentDisplayItems;
    const stageInfo = this.getWeeklyShopStageInfo();
    const panelW = w;
    const panelTop = Math.max(SAFE_TOP + 56, yStart);
    const chrome = this._playChrome || this.getPlaySceneChrome();
    const panelBottom = Number(chrome.navTop || chrome.defaultContinueY) - 8;
    const rowH = 84;
    const footerH = 44;
    const footerGap = 10;
    const headH = 60;
    const panelH = Math.max(220, panelBottom - panelTop);
    const listMaxH = Math.max(96, panelH - headH - footerH - footerGap - 20);
    const contentH = stock.length * rowH;
    this._weeklyShopScrollMax = Math.max(0, contentH - listMaxH);

    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(0, panelTop - 8, SCREEN_WIDTH, SCREEN_HEIGHT - panelTop + 8);

    drawGlassPanel(ctx, pad, panelTop, panelW, panelH, { radius: 19, strong: true });

    ctx.fillStyle = COLORS.ink;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('购物', pad + 12, panelTop + 10);

    const previewTotal = this.computeWeeklyShopPreviewTotal(cart);
    ctx.fillStyle = COLORS.inkMuted;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.fillText(
      previewTotal > 0
        ? `预计 ￥${previewTotal}，其中路费 ￥${WEEKLY_SHOP_TRANSIT_FEE}`
        : '选购商品后会显示总价，路费已计入',
      pad + 12,
      panelTop + 34,
    );
    ctx.textAlign = 'right';
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.fillText(stageInfo.label, pad + panelW - 12, panelTop + 34);
    ctx.textAlign = 'left';

    const listTop = panelTop + headH;
    const qtyBaseX = pad + panelW - 116;
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad + 6, listTop, panelW - 12, listMaxH);
    ctx.clip();

    stock.forEach((row, idx) => {
      const item = itemsCatalog.find((it) => it.id === row.itemId);
      const yy = listTop + idx * rowH - scroll;
      if (yy + rowH < listTop || yy > listTop + listMaxH) return;
      const qty = Math.max(0, Math.min(3, Number(cart[row.itemId]) || 0));
      const unitPrice = this.getWeeklyShopUnitPrice(row.itemId);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      this.fillRoundRect(pad + 8, yy + 4, panelW - 16, rowH - 8, 8);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      this.strokeRoundRect(pad + 8, yy + 4, panelW - 16, rowH - 8, 8);
      ctx.fillStyle = uiTheme.colors.textMain;
      ctx.font = `bold ${uiTheme.font.body}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(item ? item.name : row.itemId, pad + 16, yy + 12);
      ctx.fillStyle = uiTheme.colors.textSub;
      ctx.font = `${uiTheme.font.small}px sans-serif`;
      ctx.fillText(`￥${unitPrice}`, pad + 16, yy + 34);
      this.wrapText(item && item.description ? String(item.description) : '', pad + 16, yy + 52, panelW - 152, 14, 2);

      const btnY = yy + 26;
      const isBtnVisible = btnY + 28 > listTop && btnY < listTop + listMaxH;
      if (isBtnVisible) {
        this.buttons.push({
          id: `shop_dec_${row.itemId}`,
          x: qtyBaseX,
          y: btnY,
          w: 28,
          h: 28,
          label: '−',
          variant: 'secondary',
          disabled: qty <= 0,
          onClick: () => {
            const q = Math.max(0, (Number(cart[row.itemId]) || 0) - 1);
            cart[row.itemId] = q;
          },
        });
        this.buttons.push({
          id: `shop_inc_${row.itemId}`,
          x: qtyBaseX + 72,
          y: btnY,
          w: 28,
          h: 28,
          label: '+',
          variant: 'secondary',
          disabled: qty >= 3,
          onClick: () => {
            cart[row.itemId] = Math.min(3, (Number(cart[row.itemId]) || 0) + 1);
          },
        });
      }
      ctx.fillStyle = uiTheme.colors.textMain;
      ctx.font = `${uiTheme.font.body}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(qty), qtyBaseX + 50, yy + 40);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
    });
    ctx.restore();

    const footerY = panelTop + panelH - footerH - 10;
    const bw = (panelW - 24) / 3;
    this.buttons.push({
      id: 'shop_cancel',
      x: pad + 8,
      y: footerY,
      w: bw - 6,
      h: 40,
      label: '取消',
      variant: 'secondary',
      onClick: () => {
        this.weeklyShopOverlay = null;
      },
    });
    this.buttons.push({
      id: 'shop_browse_only',
      x: pad + 8 + bw,
      y: footerY,
      w: bw - 6,
      h: 40,
      label: '只逛不买',
      variant: 'secondary',
      onClick: () => this.finalizeWeeklyShop(true),
    });
    this.buttons.push({
      id: 'shop_confirm',
      x: pad + 8 + bw * 2,
      y: footerY,
      w: bw - 6,
      h: 40,
      label: '确认选购',
      variant: 'primary',
      onClick: () => this.finalizeWeeklyShop(false),
    });

    return yStart;
  }

  handleWeeklyAction(action) {
    if (!this.run) return;
    this.ensureGoalSystemState();
    if (!this.run.goals.currentWeekGoal) this.assignCurrentWeekGoal();
    const semNo = (this.run.semesterIndex || 0) + 1;
    if (action.id === 'act_intern' && semNo < 5) {
      this.showToast('大三秋季学期起才开放实习和秋招向周行动');
      return;
    }
    if (Array.isArray(action.tags) && action.tags.includes('weekly_shop')) {
      this.openWeeklyShop(action);
      return;
    }
    const cost = Number(action.cost || 0);
    if (cost > 0 && Number(this.run.stats.money || 0) < cost) {
      this.showToast(`资金不足，需要￥${cost}`);
      return;
    }

    const narrativeText = action.narrative || `你选择了${action.title}，感觉今天过得很有意义。`;
    const mergedEffects = { ...(action.effects || {}) };
    if (cost > 0) {
      mergedEffects.money = (mergedEffects.money || 0) - cost;
    }
    this.executeWeeklyActionCommit(action, mergedEffects, narrativeText, null);
  }

  /** 周推进后注入导师/恋爱强制支线（各一次） */
  maybeInjectNpcStoryEvents() {
    if (!this.run) return;
    const mentorEvt = eventsCatalog.find((e) => e.id === 'evt_pick_mentor');
    if (
      this.run.semesterIndex === 0
      && this.run.weekIndex === 1
      && !this.run.flags.mentorPickDone
      && mentorEvt
      && !this.run.usedEventIds.includes('evt_pick_mentor')
    ) {
      this.run.pendingSideEvent = this.slimEvent(mentorEvt);
      this.run.phase = 'side_event';
      this.run.flags.mentorPickDone = true;
      return;
    }
    const romEvt = eventsCatalog.find((e) => e.id === 'evt_romance_intro');
    if (
      this.run.semesterIndex === 2
      && this.run.weekIndex === 1
      && !this.run.flags.romanceIntroDone
      && romEvt
      && !this.run.usedEventIds.includes('evt_romance_intro')
    ) {
      this.run.pendingSideEvent = this.slimEvent(romEvt);
      this.run.phase = 'side_event';
      this.run.flags.romanceIntroDone = true;
    }
  }

  handleUseItem(index) {
    if (!this.run) return;
    this.run = useInventoryItem(this.run, itemsCatalog, index);
    if (this.run.lastUsedItem) {
      this.run.flags = { ...(this.run.flags || {}) };
      this.run.flags.itemUsage = Number(this.run.flags.itemUsage || 0) + 1;
      this.showToast(`使用物品：${this.run.lastUsedItem.name}`);
      this.run.lastUsedItem = null;
    }
    save.saveRun(this.run);
  }

  fillRoundRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  strokeRoundRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.stroke();
  }

  /** 折行为多行，用于标题居中；调用前需设置好 ctx.font */
  splitWrappedLines(text, maxWidth, maxLines) {
    let line = '';
    const out = [];
    const chars = String(text).split('');
    for (let n = 0; n < chars.length; n++) {
      const testLine = line + chars[n];
      if (ctx.measureText(testLine).width > maxWidth && n > 0) {
        if (out.length >= maxLines - 1) {
          let overflow = line + chars.slice(n).join('');
          while (overflow.length > 1 && ctx.measureText(`${overflow}…`).width > maxWidth) {
            overflow = overflow.slice(0, -1);
          }
          out.push(`${overflow}…`);
          return out.slice(0, maxLines);
        }
        out.push(line);
        line = chars[n];
      } else {
        line = testLine;
      }
    }
    if (line) out.push(line);
    return out.slice(0, maxLines);
  }


  measurePickDetailPanelHeight(pc, textMaxW) {
    const bodyFs = uiTheme.font.small;
    const tinyFs = Math.max(10, uiTheme.font.small - 1);
    const bodyLH = 14;
    const tinyLH = 12;
    const pad = 10;
    let ty = pad;
    ctx.font = `${bodyFs}px sans-serif`;
    ty = this.measureWrappedTextBottom(pc.subtitle || '', 0, ty, textMaxW, bodyLH, pc.locked ? 4 : 3);
    if (pc.effectSmall) {
      ctx.font = `${tinyFs}px sans-serif`;
      ty = this.measureWrappedTextBottom(pc.effectSmall, 0, ty + 4, textMaxW, tinyLH, 3);
    }
    if (pc.metaSmall) {
      ctx.font = `${tinyFs}px sans-serif`;
      ty = this.measureWrappedTextBottom(pc.metaSmall, 0, ty + 3, textMaxW, tinyLH, 2);
    }
    return ty + pad;
  }

  drawPickDetailPanel(x, y, w, pc) {
    const textMaxW = w - 20;
    const h = this.measurePickDetailPanelHeight(pc, textMaxW);
    const light = this.themeMode === 'light';
    ctx.save();
    ctx.fillStyle = light ? 'rgba(247,242,232,0.94)' : 'rgba(20, 29, 44, 0.95)';
    this.fillRoundRect(x, y, w, h, 8);
    ctx.strokeStyle = light ? 'rgba(38,48,65,0.12)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    this.strokeRoundRect(x, y, w, h, 8);
    const innerX = x + 10;
    let ty = y + 10;
    const bodyFs = uiTheme.font.small;
    const tinyFs = Math.max(10, uiTheme.font.small - 1);
    const bodyLH = 14;
    const tinyLH = 12;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = light ? 'rgba(38,48,65,0.68)' : COLORS.inkMuted;
    ctx.font = `${bodyFs}px sans-serif`;
    ty = this.wrapText(pc.subtitle || '', innerX, ty, textMaxW, bodyLH, pc.locked ? 4 : 3);
    if (pc.effectSmall) {
      ctx.fillStyle = light ? COLORS.coralDeep : COLORS.gold;
      ctx.font = `${tinyFs}px sans-serif`;
      ty = this.wrapText(pc.effectSmall, innerX, ty + 4, textMaxW, tinyLH, 3);
    }
    if (pc.metaSmall) {
      ctx.fillStyle = pc.locked ? 'rgba(140,150,170,0.9)' : uiTheme.colors.accent;
      ctx.font = `${tinyFs}px sans-serif`;
      this.wrapText(pc.metaSmall, innerX, ty + 3, textMaxW, tinyLH, 2);
    }
    ctx.restore();
  }

  drawButton(btn) {
    if (btn.invisible) return;
    const isSelected = !!(this.pendingTransition && btn.id && this.pendingTransition.buttonId === btn.id);
    const pressed = !!btn.id && this.pressedButtonId === btn.id;
    const variant = btn.variant || 'normal';
    const isPickRow = !!btn.pickContent;
    const isPrimary = !isPickRow && (variant === 'primary' || variant === 'normal' || variant === 'danger');
    const isGhost = variant === 'ghost';
    const light = this.themeMode === 'light';
    const drawY = btn.y + (pressed && !btn.disabled ? 2 : 0);
    const radius = Math.min(15, Math.max(9, btn.h * 0.28));
    const minX = btn.x;
    const minW = btn.w;
    const right = minX + minW - 14;
    const textInk = btn.disabled
      ? (light ? 'rgba(46, 57, 70, 0.38)' : 'rgba(230, 232, 228, 0.35)')
      : (btn.textColor || (isPrimary ? '#172231' : (light ? COLORS.paperInk : COLORS.ink)));

    ctx.save();
    if (btn.h >= 34 && !isGhost && !isPickRow) {
      ctx.shadowColor = pressed ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.22)';
      ctx.shadowBlur = pressed ? 4 : 12;
      ctx.shadowOffsetY = pressed ? 1 : 5;
    }
    if (isPrimary) {
      const fill = ctx.createLinearGradient(minX, drawY, minX + minW, drawY + btn.h);
      if (btn.disabled) {
        fill.addColorStop(0, light ? 'rgba(151,154,153,0.36)' : 'rgba(91,102,110,0.42)');
        fill.addColorStop(1, light ? 'rgba(151,154,153,0.26)' : 'rgba(72,82,91,0.36)');
      } else if (variant === 'danger') {
        fill.addColorStop(0, '#F39B87');
        fill.addColorStop(1, COLORS.coralDeep);
      } else {
        fill.addColorStop(0, pressed ? '#EECB84' : '#F1D38F');
        fill.addColorStop(0.48, pressed ? '#F3B070' : COLORS.coral);
        fill.addColorStop(1, pressed ? '#D96851' : COLORS.coralDeep);
      }
      fillRoundRect(ctx, minX, drawY, minW, btn.h, radius, fill);
    } else if (isGhost) {
      ctx.globalAlpha = pressed ? 0.18 : 0.08;
      fillRoundRect(ctx, minX, drawY, minW, btn.h, radius, light ? COLORS.paperInk : '#FFFFFF');
      ctx.globalAlpha = 1;
    } else {
      fillRoundRect(
        ctx,
        minX,
        drawY,
        minW,
        btn.h,
        radius,
        btn.disabled
          ? (light ? 'rgba(245,245,242,0.38)' : 'rgba(25,34,48,0.5)')
          : (light ? 'rgba(252,249,242,0.82)' : 'rgba(26,36,53,0.84)'),
      );
    }
    ctx.shadowColor = 'transparent';
    strokeRoundRect(
      ctx,
      minX + 0.5,
      drawY + 0.5,
      minW - 1,
      btn.h - 1,
      radius,
      isPrimary
        ? 'rgba(255,255,255,0.32)'
        : (light ? 'rgba(38,48,61,0.12)' : 'rgba(255,255,255,0.14)'),
      1,
    );
    if (pressed && !btn.disabled) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundRectPath(ctx, minX + 1, drawY + 1, minW - 2, btn.h - 2, Math.max(1, radius - 1));
      ctx.fill();
    }

    if (btn.pickContent) {
      const pc = btn.pickContent;
      const locked = !!pc.locked || btn.disabled;
      const left = minX + 15;
      const titleSize = Math.max(14, TYPE.body);
      const subtitleSize = Math.max(10.5, TYPE.caption);
      const title = this.fitText(pc.title || btn.label || '', minW - 68);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = locked ? textInk : (light ? COLORS.paperInk : COLORS.ink);
      ctx.font = font(titleSize, 650);
      ctx.fillText(title, left, drawY + 8);

      if (pc.subtitle) {
        ctx.fillStyle = locked
          ? (light ? 'rgba(46,57,70,0.34)' : 'rgba(230,232,228,0.28)')
          : (light ? 'rgba(46,57,70,0.63)' : COLORS.inkMuted);
        ctx.font = font(subtitleSize, 400);
        ctx.fillText(this.fitText(pc.subtitle, minW - (pc.effectSmall ? 132 : 64)), left, drawY + 28);
      }
      if (pc.effectSmall) {
        ctx.textAlign = 'right';
        ctx.fillStyle = locked
          ? (light ? 'rgba(46,57,70,0.32)' : 'rgba(230,232,228,0.28)')
          : (light ? alpha(COLORS.coralDeep, 0.92) : COLORS.gold);
        ctx.font = font(10.5, 600);
        ctx.fillText(this.fitText(pc.effectSmall, 88), right - 17, drawY + 12);
      }
      if (locked) {
        ctx.textAlign = 'right';
        ctx.fillStyle = pc.lockedLabel === '余额不足'
          ? 'rgba(238, 122, 118, 0.9)'
          : (light ? 'rgba(38,48,65,0.32)' : COLORS.inkFaint);
        ctx.font = font(10, 600);
        ctx.fillText(pc.lockedLabel || '暂时不可选', right - 17, drawY + 29);
      } else {
        drawChevron(
          ctx,
          right - 5,
          drawY + btn.h / 2,
          13,
          isSelected ? (light ? COLORS.coralDeep : COLORS.gold) : (light ? 'rgba(46,57,70,0.42)' : COLORS.inkFaint),
          'right',
        );
      }

      if (isSelected) {
        ctx.fillStyle = light ? COLORS.coralDeep : COLORS.gold;
        fillRoundRect(ctx, minX, drawY + 10, 3, btn.h - 20, 2, ctx.fillStyle);
      }
      if (btn.pickDetailBelow && isSelected) {
        this.drawPickDetailPanel(btn.x, btn.y + btn.h + 8, btn.w, pc);
      }
      ctx.restore();
      return;
    }

    const compactButton = btn.h <= 32;
    const maxTextW = Math.max(18, btn.w - (compactButton ? 10 : (btn.icon ? 66 : 38)));
    const rawParts = String(btn.label || '').split('\n');
    const title = rawParts[0] || '';
    const subtitle = rawParts.slice(1).join(' ');
    const centerY = drawY + btn.h / 2;
    const iconSize = Math.min(22, btn.h - 15);
    if (btn.icon) drawIcon(ctx, btn.icon, minX + 14, centerY - iconSize / 2, iconSize, textInk);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textInk;
    if (subtitle) {
      ctx.font = font(14, 650);
      ctx.fillText(this.fitText(title, maxTextW), minX + minW / 2, centerY - 8);
      ctx.font = font(10.5, 400);
      ctx.fillStyle = isPrimary ? 'rgba(23,34,49,0.68)' : textInk;
      ctx.globalAlpha = isPrimary ? 1 : 0.66;
      ctx.fillText(this.fitText(subtitle, maxTextW), minX + minW / 2, centerY + 8);
      ctx.globalAlpha = 1;
    } else {
      const labelSize = compactButton ? 10.5 : (variant === 'primary' || variant === 'normal' ? 14.5 : 13.5);
      ctx.font = font(labelSize, isPrimary ? 650 : 550);
      ctx.fillText(this.fitText(title, maxTextW), minX + minW / 2, centerY + 0.5);
    }
    if (isSelected) {
      ctx.textAlign = 'right';
      ctx.font = font(10, 650);
      ctx.fillStyle = 'rgba(23,34,49,0.72)';
      ctx.fillText('已选', right, centerY);
    }
    ctx.restore();
  }


  drawAvatar(x, y, size = 48, profile = null) {
    const profileToUse = profile || this.tempProfile;
    const gender = profileToUse?.gender || 'male';
    const poolKey = gender === 'female' ? 'female' : 'male';
    const lists = this.assets.avatars;
    let idx = 0;
    if (profileToUse && typeof profileToUse.avatarIndex === 'number' && profileToUse.avatarIndex >= 0 && profileToUse.avatarIndex < 4) {
      idx = profileToUse.avatarIndex;
    } else if (profileToUse && profileToUse.avatarAssetId) {
      idx = avatarSlotIndexFromAssetId(profileToUse.avatarAssetId);
    } else {
      idx = this.tempAvatarIndex;
    }
    const fallbackAvatarId = gender === 'female' ? FEMALE_AVATAR_IDS[0] : MALE_AVATAR_IDS[0];
    const presetId = (profileToUse && profileToUse.avatarAssetId) || this.tempAvatarAssetId;
    let avatar = lists && lists[poolKey] && lists[poolKey][idx];
    if (!avatar || avatar.__failed || !avatar.__ready) {
      avatar = this.assets[presetId] || this.assets[fallbackAvatarId];
    }
    if (!avatar || avatar.__failed || !avatar.__ready) {
      avatar = lists && lists[poolKey] && lists[poolKey][0];
    }
    if (!avatar || avatar.__failed || !avatar.__ready) {
      avatar = this.assets[fallbackAvatarId];
    }
    if (avatar && avatar.__ready && !avatar.__failed) {
      // 绘制圆形头像
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, x, y, size, size);
      ctx.restore();
      
      // 添加边框
      ctx.strokeStyle = uiTheme.colors.accent || '#ffd166';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + size/2, y + size/2, size/2 - 1, 0, Math.PI * 2);
      ctx.stroke();
      return true;
    }
    
    const fallbackFill = ctx.createLinearGradient(x, y, x + size, y + size);
    fallbackFill.addColorStop(0, '#38505A');
    fallbackFill.addColorStop(1, '#B98367');
    ctx.fillStyle = fallbackFill;
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(247,243,232,0.92)';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size * 0.4, size * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + size / 2, y + size * 0.83, size * 0.27, size * 0.19, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2 - 1, 0, Math.PI * 2);
    ctx.stroke();
    return false;
  }

  drawSceneBackground() {
    const semesterIndex = this.run ? Number(this.run.semesterIndex || 0) : 0;
    const weekIndex = this.scene === 'play' && this.run ? Number(this.run.weekIndex || 0) : 0;
    const cacheKey = [
      this.scene,
      this.themeMode,
      semesterIndex,
      weekIndex,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
    ].join(':');

    if (cacheKey !== this.backdropCacheKey) {
      this.backdropCacheKey = cacheKey;
      try {
        if (!this.backdropCache && wx.createOffscreenCanvas) {
          this.backdropCache = wx.createOffscreenCanvas({
            type: '2d',
            width: Math.round(SCREEN_WIDTH * DEVICE_PIXEL_RATIO),
            height: Math.round(SCREEN_HEIGHT * DEVICE_PIXEL_RATIO),
          });
        }
        if (this.backdropCache) {
          renderBackdrop(this.backdropCache, {
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT,
            dpr: DEVICE_PIXEL_RATIO,
            scene: this.scene,
            themeMode: this.themeMode,
            semesterIndex,
            weekIndex,
          });
        }
      } catch (e) {
        this.backdropCache = null;
      }
    }

    if (this.backdropCache) {
      ctx.drawImage(this.backdropCache, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    } else {
      const fallback = ctx.createLinearGradient(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      if (this.themeMode === 'light') {
        fallback.addColorStop(0, '#F4EBDD');
        fallback.addColorStop(1, '#9CB1B7');
      } else {
        fallback.addColorStop(0, '#18243A');
        fallback.addColorStop(1, '#263A3D');
      }
      ctx.fillStyle = fallback;
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    }

    const readability = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
    readability.addColorStop(0, this.themeMode === 'light' ? 'rgba(248,243,234,0.34)' : 'rgba(7,12,21,0.24)');
    readability.addColorStop(0.42, 'rgba(8,14,24,0)');
    readability.addColorStop(0.72, this.themeMode === 'light' ? 'rgba(29,42,50,0.2)' : 'rgba(7,12,21,0.38)');
    readability.addColorStop(1, this.themeMode === 'light' ? 'rgba(18,28,35,0.46)' : 'rgba(5,10,18,0.74)');
    ctx.fillStyle = readability;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    drawAmbientMotes(ctx, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT * 0.82, Date.now(), this.themeMode);
  }


  wrapText(text, x, y, maxWidth, lineHeight, maxLines) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const lines = this.splitWrappedLines(String(text || ''), maxWidth, Math.max(1, maxLines));
    lines.forEach((line, index) => {
      ctx.fillText(line, x, y + index * lineHeight);
    });
    return y + Math.max(1, lines.length) * lineHeight;
  }

  /** 按段落渲染文本：支持 \n 换段，段内自动折行 */
  drawParagraphText(text, x, y, maxWidth, lineHeight, maxLines) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const paragraphs = String(text || '').split('\n');
    let cy = y;
    let usedLines = 0;
    for (let i = 0; i < paragraphs.length; i++) {
      if (usedLines >= maxLines) break;
      const p = paragraphs[i];
      if (!p.trim()) {
        cy += lineHeight;
        usedLines += 1;
        continue;
      }
      const remain = maxLines - usedLines;
      const lines = this.splitWrappedLines(p, maxWidth, remain);
      for (let k = 0; k < lines.length; k++) {
        ctx.fillText(lines[k], x, cy);
        cy += lineHeight;
        usedLines += 1;
        if (usedLines >= maxLines) break;
      }
    }
    return cy;
  }

  /** 与 wrapText 相同的折行规则，返回文本块最后一行下方的 y */
  measureWrappedTextBottom(text, x, y, maxWidth, lineHeight, maxLines) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const lines = this.splitWrappedLines(String(text || ''), maxWidth, Math.max(1, maxLines));
    return y + Math.max(1, lines.length) * lineHeight;
  }

  /** 学校/专业：仅按钮区 + 选中时按钮下方说明框（与 drawButton 一致） */
  measurePickRowHeight(pc, innerW, expanded) {
    const PICK_ROW_BTN_H = 55;
    const DETAIL_GAP = 8;
    if (!expanded) return PICK_ROW_BTN_H;
    ctx.save();
    const detailH = this.measurePickDetailPanelHeight(pc, innerW);
    ctx.restore();
    return PICK_ROW_BTN_H + DETAIL_GAP + detailH;
  }


  fitText(text, maxWidth) {
    const s = String(text);
    if (ctx.measureText(s).width <= maxWidth) return s;
    let out = s;
    while (out.length > 2 && ctx.measureText(`${out}…`).width > maxWidth) {
      out = out.slice(0, -1);
    }
    return `${out}…`;
  }

  getWeeklyActionChoices() {
    if (!this.run) return actionsCatalog.slice(0, 5);
    const base = [...actionsCatalog];
    
    // 添加社团活动选项
    const clubActivities = this.getClubActivities();
    clubActivities.forEach(activity => {
      base.push({
        id: activity.id,
        title: activity.title,
        description: activity.description,
        cost: 0,
        tags: ['club', 'social'],
        effects: activity.effects
      });
    });
    
    // 使用固定种子确保同一周的选项顺序不会变化
    // 基于学期、周数和当前状态生成稳定的伪随机数
    const seed = (this.run.semesterIndex + 1) * 123 + (this.run.weekIndex + 1) * 78 + Number(this.run.stats.social || 0) + Number(this.run.stats.health || 0);
    
    // 使用种子的伪随机函数，确保每次调用结果相同
    const seededRandom = (index) => {
      const x = Math.sin(seed + index) * 10000;
      return x - Math.floor(x);
    };
    
    base.sort((a, b) => {
      const va = (a.id.charCodeAt(0) + seed + a.id.length * 17 + seededRandom(a.id.length) * 100) % 97;
      const vb = (b.id.charCodeAt(0) + seed + b.id.length * 17 + seededRandom(b.id.length) * 100) % 97;
      return va - vb;
    });
    
    // 根据当前状态调整选项的可见性和权重
    const semNo = (this.run.semesterIndex || 0) + 1;
    const available = base.filter(action => {
      if (action.id === 'act_intern' && semNo < 5) return false;
      if (Array.isArray(action.tags) && action.tags.includes('internship') && semNo < 5) return false;

      const cost = Number(action.cost || 0);
      const canAfford = Number((this.run.stats && this.run.stats.money) || 0) >= cost;
      
      const stress = Number(this.run.stats?.pressure || 0);
      const health = Number(this.run.stats?.health || 0);
      const social = Number(this.run.stats?.social || 0);
      const gpa = Number(this.run.stats?.gpa || 0);
      
      // 压力高时，优先显示放松选项和摆烂选项
      if (stress > 70 && (action.description.includes('放松') || action.description.includes('锻炼') || action.description.includes('休息') || action.description.includes('游戏'))) {
        return true;
      }
      
      // 压力高时显示摆烂选项
      if (stress > 60 && action.tags.includes('slacking')) {
        return true;
      }
      
      // 健康低时，优先显示健康相关选项
      if (health < 30 && (action.description.includes('运动') || action.description.includes('恢复') || action.description.includes('休息'))) {
        return true;
      }
      
      // 社交低时，优先显示社交选项
      if (social < 30 && (action.description.includes('社交') || action.description.includes('约会') || action.description.includes('志愿'))) {
        return true;
      }
      
      // GPA高时，可以显示更多社交活动
      if (gpa > 3.5 && action.tags.includes('social')) {
        return true;
      }
      
      // 有浪漫旗标时，约会选项优先
      if (this.run.flags?.romanceFlag && action.id === 'act_dating') {
        return true;
      }
      
      // 第 5 学期起：就业/实习向（含 career 标签的主流选项）
      if (this.run.semesterIndex >= 4 && action.tags.includes('career')) {
        return true;
      }
      
      // 第 5 学期起：出国申请向
      if (this.run.semesterIndex >= 4 && action.tags.includes('abroad')) {
        return true;
      }
      
      // 社团活动优先显示
      if (action.tags.includes('club')) {
        return true;
      }
      
      return canAfford;
    });
    
    // 动态调整选项数量，增加随机性
    const maxOptions = 5 + Math.floor(seededRandom(1) * 4); // 5-8个选项
    const selectedActions = available.slice(0, Math.min(maxOptions, available.length));
    
    // 为每个选项生成固定的随机描述
    selectedActions.forEach(action => {
      const descKey = `${this.run.semesterIndex}_${this.run.weekIndex}_${action.id}`;
      if (!this.fixedActionDescriptions.has(descKey)) {
        this.fixedActionDescriptions.set(descKey, this.generateRandomActionDescription(action, seededRandom));
      }
    });
    
    return selectedActions;
  }

  editorializeActionDescription(action, fallback) {
    const descriptions = {
      act_study: '把注意力留给课本和题库，今天晚些再回消息。',
      act_night_market: '沿着摊位慢慢逛，吃点热的，也看看校园外的灯。',
      act_campus_cafe: '找一张靠窗的桌子，把手机扣在一边。',
      act_class_review: '补上遗漏的推导，把零散笔记整理成自己的话。',
      act_help_classmate: '陪同学把卡住的那一题重新捋一遍。',
      act_stargazing: '在操场坐一会儿，让脑子里的声音慢下来。',
      act_old_bookstore: '翻翻旧书和旁人的批注，挑一本真正想读的。',
      act_plant_care: '修掉枯叶，换水松土，给宿舍添一点生气。',
      act_campus_photo: '带上相机绕校园一圈，记下最近忽略的角落。',
      act_try_new_food: '去窗口试一份没吃过的菜，接受一点小冒险。',
      act_write_diary: '把这一周没来得及想清楚的事写下来。',
      act_morning_run: '天刚亮就出门，跑完再去吃早饭。',
      act_library_volunteer: '整理书车和归还区，在安静里待上半天。',
      act_parttime: '接一份能兼顾课表的活，换回一些生活费和经验。',
      act_exercise: '活动肩颈，跑几圈，今晚尽量早点睡。',
      act_social: '约熟悉的人聊近况，也顺便认识几张新面孔。',
      act_cert: '按计划刷题，把错题真正弄懂，而不是只记答案。',
      act_intern: '改简历，查岗位，投出几份认真准备过的申请。',
      act_research: '读文献、跑实验，把问题带去和导师讨论。',
      act_civil: '刷行测、写申论，把稳定路线拆成今天能做的题。',
      act_invest: '先补基础知识，再决定要不要把生活费投进去。',
      act_shopping_relax: '进店看看喜欢的小物，或只逛不买散散心。',
      act_skill_course: '报一门能补齐短板的课，按周完成练习。',
      act_movie_night: '关掉消息，认真看完一部电影。',
      act_join_club: '去活动室看看，找到一件愿意长期做的事。',
      act_volunteer: '把时间交给一场具体的服务，而不是只攒时长。',
      act_read_book: '读一本与专业无关的书，把视野往外挪一点。',
      act_cook_meal: '买菜、做饭、收拾厨房，认真吃顿热饭。',
      act_contest_prepare: '拆解赛题，和队友对齐下一步分工。',
      act_roommate_chat: '熄灯后聊聊天，把最近没说的话说开。',
      act_project_team: '组队推进一个小项目，先做出能运行的第一版。',
      act_travel_day: '去附近城市走走，换一条街和一种节奏。',
      act_library_browse: '不带任务地逛书架，遇到什么读什么。',
      act_all_night_gaming: '和朋友打一整晚，快乐很直接，困意也会准时到账。',
      act_skip_class_proxy: '用钱换一次缺席，后果未必只出现在账面上。',
      act_dorm_slump: '不安排任何任务，给大脑留一个空白的下午。',
    };
    return descriptions[action && action.id] || action.description || fallback || '给这周留出一个选择。';
  }

  generateRandomActionDescription(action, seededRandom) {
    const variations = {
      'act_study': [
        '泡在图书馆，感觉要成为学神了',
        '和书本约会，知识就是力量',
        '在知识的海洋里遨游',
        '今天也是努力学习的一天呢'
      ],
      'act_parttime': [
        '打工赚钱，钱包鼓起来的感觉真好',
        '兼职生活，成年人的快乐',
        '为了生活费，冲啊',
        '打工人的日常，累并快乐着'
      ],
      'act_exercise': [
        '运动出汗，感觉整个人都清爽了',
        '锻炼身体，为革命奋斗做准备',
        '流汗的感觉，真爽',
        '今天也是元气满满的一天'
      ],
      'act_social': [
        '和朋友们在一起，感觉真好',
        '社交时间，人脉就是财富',
        '聚会聊天，生活需要调剂',
        '今天也是社交达人的一天'
      ],
      'act_dorm_slump': [
        '床以外的地方都是远方',
        '今天选择与床融为一体',
        '咸鱼的一天，真的很舒服',
        '摆烂也是一种生活态度'
      ],
      'act_all_night_gaming': [
        '键盘敲击声此起彼伏，太爽了',
        '胜利的欢呼声响彻寝室',
        '青春就是要这样挥霍',
        '队友们carry全场，快乐加倍'
      ],
      'act_skip_class_proxy': [
        '转账给室友，拜托帮忙答到',
        '多出来的睡眠时间真香',
        '尊嘟假嘟？今天真的不想上课',
        '花钱买自由，值得'
      ],
      'act_meme_browsing': [
        '短视频刷到停不下来',
        '各种表情包笑到打鸣',
        '吗喽的命也是命，我也要休息',
        '虽然眼睛酸，但快乐是真的'
      ],
      'act_toefl_prep': [
        '单词背到吐，但为了梦想值得',
        '听力练习，耳朵快要起茧了',
        '今天的词汇量又增加了呢',
        '留学之路，从背单词开始'
      ],
      'act_abroad_agency': [
        '中介老师讲得很详细，收获很多',
        '申请材料清单长得吓人',
        '留学咨询，对未来充满期待',
        '花钱买信息，留学第一步'
      ],
      'act_abroad_documents': [
        '文书改了第八遍，终于满意了',
        '推荐信搞定，离梦想又近一步',
        '申请材料整理完毕，可以提交了',
        '每一份文件都承载着留学梦'
      ]
    };
    
    const actionVariations = variations[action.id];
    if (actionVariations) {
      const index = Math.floor(seededRandom(action.id.charCodeAt(0)) * actionVariations.length);
      return actionVariations[index];
    }
    
    return action.description;
  }

  renderMenu() {
    this.drawSceneBackground();
    const pad = Math.max(18, Math.round(SCREEN_WIDTH * 0.052));
    const menuTop = SAFE_TOP + 12;
    const bottomSafe = SCREEN_HEIGHT - SAFE_BOTTOM;
    const light = this.themeMode === 'light';
    const canContinue = save.hasSavedRun();
    const savedRun = canContinue ? save.loadRun() : null;
    const meta = save.loadMeta();
    const titleInk = light ? COLORS.paperInk : COLORS.ink;

    drawSceneKicker(ctx, pad, menuTop + 3, 'FOUR YEARS  /  ONE CAMPUS', light ? COLORS.coralDeep : COLORS.gold);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = titleInk;
    ctx.font = font(TYPE.display, 750);
    ctx.fillText('本科生的', pad, menuTop + 25);
    ctx.fillStyle = light ? COLORS.coralDeep : COLORS.gold;
    ctx.fillText('四年日记', pad, menuTop + 66);
    ctx.fillStyle = light ? 'rgba(38,48,65,0.72)' : COLORS.inkMuted;
    ctx.font = font(TYPE.body, 450);
    ctx.fillText('把每一次选择，写进这四年。', pad, menuTop + 113);

    const sealSize = 58;
    const sealX = SCREEN_WIDTH - pad - sealSize;
    const sealY = menuTop + 20;
    ctx.save();
    ctx.globalAlpha = light ? 0.62 : 0.82;
    strokeRoundRect(ctx, sealX, sealY, sealSize, sealSize, 14, light ? alpha(COLORS.coralDeep, 0.58) : alpha(COLORS.gold, 0.54), 1.2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = light ? COLORS.coralDeep : COLORS.gold;
    ctx.font = font(21, 700);
    ctx.fillText('四', sealX + sealSize / 2, sealY + 22);
    ctx.font = font(9, 600);
    ctx.fillText('YEARS', sealX + sealSize / 2, sealY + 42);
    ctx.restore();

    this.buttons = [];
    const w = SCREEN_WIDTH - pad * 2;
    const secondaryH = 42;
    const primaryH = 54;
    const secondaryY = bottomSafe - secondaryH;
    const primaryY = secondaryY - primaryH - 10;
    const utilityH = 66;
    const utilityY = primaryY - utilityH - 18;

    const collections = [
      {
        key: 'gallery',
        label: '结局',
        icon: 'trophy',
        count: `${(meta.unlockedEndings || []).length}/${endingsCatalog.length}`,
        onClick: () => this.goScene('gallery'),
      },
      {
        key: 'achievements',
        label: '成就',
        icon: 'people',
        count: `${Object.keys(meta.achievements || {}).length}/${achievementsCatalog.length}`,
        onClick: () => this.goScene('achievements'),
      },
      {
        key: 'cg_gallery',
        label: '影像',
        icon: 'image',
        count: `${(meta.unlockedCgs || []).length}/${CG_CATALOG.length}`,
        onClick: () => this.goScene('cg_gallery'),
      },
      {
        key: 'bgm_gallery',
        label: '声音',
        icon: 'music',
        count: `${(meta.unlockedBgms || []).length}/${BGM_CATALOG.length}`,
        onClick: () => this.goScene('bgm_gallery'),
      },
    ];
    const tileGap = 8;
    const tileW = (w - tileGap * 3) / 4;
    collections.forEach((item, index) => {
      const x = pad + index * (tileW + tileGap);
      const btnId = `menu_${item.key}`;
      const pressed = this.pressedButtonId === btnId;
      const y = utilityY + (pressed ? 2 : 0);
      fillRoundRect(
        ctx,
        x,
        y,
        tileW,
        utilityH,
        15,
        light ? 'rgba(252,249,243,0.72)' : 'rgba(20,29,44,0.74)',
      );
      strokeRoundRect(
        ctx,
        x + 0.5,
        y + 0.5,
        tileW - 1,
        utilityH - 1,
        15,
        light ? 'rgba(38,48,61,0.1)' : 'rgba(255,255,255,0.11)',
      );
      const iconColor = light ? COLORS.paperInk : COLORS.ink;
      drawIcon(ctx, item.icon, x + 12, y + 11, 22, iconColor);
      if (tileW >= 68) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillStyle = light ? 'rgba(38,48,61,0.42)' : COLORS.inkFaint;
        ctx.font = font(9.5, 500);
        ctx.fillText(item.count, x + tileW - 10, y + 11);
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = light ? 'rgba(38,48,61,0.84)' : 'rgba(245,241,232,0.88)';
      ctx.font = font(13, 600);
      ctx.fillText(item.label, x + 12, y + 42);
      this.buttons.push({
        id: btnId,
        x,
        y: utilityY,
        w: tileW,
        h: utilityH,
        label: item.label,
        invisible: true,
        disabled: false,
        onClick: item.onClick,
      });
    });

    if (canContinue && savedRun) {
      const sem = Number(savedRun.semesterIndex || 0) + 1;
      const week = Number(savedRun.weekIndex || 0) + 1;
      const playerName = savedRun.playerProfile && savedRun.playerProfile.name
        ? savedRun.playerProfile.name
        : '同学';
      this.buttons.push({
        id: 'menu_continue',
        x: pad,
        y: primaryY,
        w,
        h: primaryH,
        label: `继续上学\n第 ${sem} 学期 · 第 ${week} 周 · ${playerName}`,
        variant: 'primary',
        disabled: false,
        onClick: () => this.continueRun(),
      });
      this.buttons.push({
        id: 'menu_new_game',
        x: pad,
        y: secondaryY,
        w,
        h: secondaryH,
        label: '开始新的四年',
        variant: 'secondary',
        disabled: false,
        onClick: () => this.goScene('create_role', { initCreateRole: true }),
      });
    } else {
      this.buttons.push({
        id: 'menu_new_game',
        x: pad,
        y: primaryY,
        w,
        h: primaryH,
        label: '开始新的四年\n创建角色 · 选择学校与专业',
        variant: 'primary',
        disabled: false,
        onClick: () => this.goScene('create_role', { initCreateRole: true }),
      });
      this.buttons.push({
        id: 'menu_settings_footer',
        x: pad,
        y: secondaryY,
        w,
        h: secondaryH,
        label: '设置与声音',
        variant: 'secondary',
        disabled: false,
        onClick: () => this.goScene('settings'),
      });
    }

    const footerY = utilityY - 27;
    const footerButtons = canContinue
      ? [
          { id: 'menu_settings_footer', label: '设置', icon: 'settings', action: () => this.goScene('settings') },
          { id: 'menu_credits_footer', label: '制作名单', icon: 'people', action: () => { this.creditsScroll = 0; this.goScene('credits'); } },
        ]
      : [
          { id: 'menu_credits_footer', label: '制作名单', icon: 'people', action: () => { this.creditsScroll = 0; this.goScene('credits'); } },
        ];
    let footerX = pad;
    footerButtons.forEach((item) => {
      ctx.font = font(11, 500);
      const labelW = 22 + ctx.measureText(item.label).width;
      const buttonW = 52 + labelW;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = light ? 'rgba(38,48,61,0.58)' : COLORS.inkMuted;
      drawIcon(ctx, item.icon, footerX, footerY - 7, 14, ctx.fillStyle);
      ctx.fillText(item.label, footerX + 19, footerY);
      this.buttons.push({
        id: item.id,
        x: footerX - 4,
        y: footerY - 16,
        w: buttonW,
        h: 32,
        label: item.label,
        invisible: true,
        disabled: false,
        onClick: item.action,
      });
      footerX += buttonW + 18;
    });
  }

  getStatName(stat) {
    const statNames = {
      health: '健康',
      social: '社交',
      skill: '能力',
      pressure: '压力',
      gpa: '绩点',
      money: '金钱'
    };
    return statNames[stat] || stat;
  }

  generateRandomClubName() {
    const prefix = this.clubPrefixes[Math.floor(Math.random() * this.clubPrefixes.length)];
    const type = this.clubTypes[Math.floor(Math.random() * this.clubTypes.length)];
    return `${prefix}${type}`;
  }

  joinClub(clubName) {
    if (!this.playerClubs.has(clubName)) {
      this.playerClubs.add(clubName);
      this.showToast(`成功加入${clubName}！`);
      
      // 加入社团的效果
      if (this.run) {
        this.run.stats.social = Math.min(100, (this.run.stats.social || 0) + 5);
        this.run.stats.pressure = Math.min(100, (this.run.stats.pressure || 0) + 2);
      }
    } else {
      this.showToast(`你已经是${clubName}的成员了`);
    }
  }

  leaveClub(clubName) {
    if (this.playerClubs.has(clubName)) {
      this.playerClubs.delete(clubName);
      this.showToast(`退出了${clubName}`);
      
      // 退出社团的效果
      if (this.run) {
        this.run.stats.social = Math.max(0, (this.run.stats.social || 0) - 3);
        this.run.stats.pressure = Math.max(0, (this.run.stats.pressure || 0) - 1);
      }
    }
  }

  getClubActivities() {
    const activities = [];
    this.playerClubs.forEach(club => {
      if (club.includes('吉他') || club.includes('音乐')) {
        activities.push({
          id: 'club_guitar_practice',
          title: '吉他练习',
          description: `${club}的日常练习，提升音乐技能`,
          effects: { skill: 3, pressure: 2, social: 2 }
        });
      }
      if (club.includes('篮球') || club.includes('体育')) {
        activities.push({
          id: 'club_basketball',
          title: '篮球训练',
          description: `${club}的体能训练，增强体质`,
          effects: { health: 5, pressure: 3, skill: 1 }
        });
      }
      if (club.includes('摄影') || club.includes('艺术')) {
        activities.push({
          id: 'club_phography',
          title: '摄影采风',
          description: `${club}的外出拍摄活动`,
          effects: { skill: 2, social: 4, pressure: 1 }
        });
      }
      if (club.includes('书法') || club.includes('文学')) {
        activities.push({
          id: 'club_calligraphy',
          title: '书法练习',
          description: `${club}的书法练习，陶冶情操`,
          effects: { skill: 2, pressure: -2, health: 1 }
        });
      }
      if (club.includes('舞蹈')) {
        activities.push({
          id: 'club_dance',
          title: '舞蹈排练',
          description: `${club}的舞蹈排练，提升协调性`,
          effects: { health: 4, skill: 3, pressure: 2 }
        });
      }
      if (club.includes('辩论')) {
        activities.push({
          id: 'club_debate',
          title: '辩论训练',
          description: `${club}的辩论训练，锻炼思维`,
          effects: { skill: 4, pressure: 3, social: 3 }
        });
      }
      if (club.includes('志愿者')) {
        activities.push({
          id: 'club_volunteer',
          title: '志愿活动',
          description: `${club}的志愿服务活动`,
          effects: { social: 6, pressure: 1, health: 2 }
        });
      }
      if (club.includes('动漫')) {
        activities.push({
          id: 'club_anime',
          title: '动漫鉴赏',
          description: `${club}的动漫欣赏活动`,
          effects: { pressure: -3, social: 2, skill: 1 }
        });
      }
      if (club.includes('科技') || club.includes('创新')) {
        activities.push({
          id: 'club_tech',
          title: '科技项目',
          description: `${club}的科技项目开发`,
          effects: { skill: 5, pressure: 4, social: 1 }
        });
      }
    });
    return activities;
  }

  renderCreateRole() {
    this.drawSceneBackground();
    const pad = 14;
    const w = SCREEN_WIDTH - pad * 2;
    const light = this.themeMode === 'light';
    const titleInk = light ? COLORS.paperInk : COLORS.ink;
    const compact = SCREEN_HEIGHT < 720;
    const veryCompact = SCREEN_HEIGHT < 620;
    this.buttons = [];

    drawSceneKicker(ctx, pad, SAFE_TOP + 5, 'NEW CHAPTER', light ? COLORS.coralDeep : COLORS.gold);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = titleInk;
    ctx.font = font(26, 730);
    ctx.fillText('先认识一下你', pad, SAFE_TOP + 18);
    if (!veryCompact) {
      ctx.fillStyle = light ? 'rgba(38,48,65,0.6)' : COLORS.inkMuted;
      ctx.font = font(11, 450);
      ctx.fillText('这些设定决定开局，之后的路仍由你选择。', pad, SAFE_TOP + 51);
    }

    const bottomSafe = SCREEN_HEIGHT - SAFE_BOTTOM;
    const actionH = veryCompact ? 46 : 50;
    const actionY = bottomSafe - actionH;
    let y = SAFE_TOP + (veryCompact ? 54 : compact ? 72 : 78);

    const profileH = veryCompact ? 84 : (compact ? 98 : 106);
    drawGlassPanel(ctx, pad, y, w, profileH, { radius: 20, strong: true });
    const avatarSize = veryCompact ? 46 : 56;
    this.drawAvatar(pad + (veryCompact ? 12 : 14), y + (veryCompact ? 12 : 14), avatarSize, this.tempProfile);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(veryCompact ? 19 : 21, 690);
    ctx.fillText(this.tempProfile.name, pad + (veryCompact ? 70 : 84), y + (veryCompact ? 12 : 15));
    ctx.fillStyle = COLORS.inkMuted;
    ctx.font = font(10.5, 500);
    ctx.fillText(
      `${this.tempProfile.gender === 'male' ? '男生' : '女生'} · 大一新生`,
      pad + (veryCompact ? 70 : 84),
      y + (veryCompact ? 36 : 42),
    );
    const miniY = y + (veryCompact ? 49 : (compact ? 60 : 66));
    const miniGap = 6;
    const miniX = pad + (veryCompact ? 70 : 84);
    const miniW = (w - (veryCompact ? 70 : 84) - 14 - miniGap * 2) / 3;
    [
      {
        id: 'role_name_random',
        label: '换名字',
        onClick: () => this.pickRandomNameByGender(this.tempProfile.gender),
      },
      {
        id: 'role_gender_toggle',
        label: '切换性别',
        onClick: () => {
          this.tempProfile.gender = this.tempProfile.gender === 'male' ? 'female' : 'male';
          this.pickRandomNameByGender(this.tempProfile.gender);
          this.pickRandomAvatarByGender(this.tempProfile.gender);
        },
      },
      {
        id: 'role_avatar_random',
        label: '换头像',
        onClick: () => this.pickRandomAvatarByGender(this.tempProfile.gender),
      },
    ].forEach((item, index) => {
      this.buttons.push({
        id: item.id,
        x: miniX + index * (miniW + miniGap),
        y: miniY,
        w: miniW,
        h: veryCompact ? 27 : 30,
        label: item.label,
        variant: 'ghost',
        textColor: COLORS.ink,
        disabled: false,
        onClick: item.onClick,
      });
    });
    y += profileH + (veryCompact ? 8 : 14);

    ctx.fillStyle = titleInk;
    ctx.font = font(13, 650);
    ctx.fillText('难度', pad, y);
    const difficulty = this.tempProfile.difficulty || DEFAULT_DIFFICULTY;
    const diffGap = 7;
    const diffW = (w - diffGap * 2) / 3;
    const diffY = y + (veryCompact ? 17 : 20);
    [
      ['easy', '轻松'],
      ['normal', '标准'],
      ['hard', '挑战'],
    ].forEach(([key, label], index) => {
      this.buttons.push({
        id: `diff_${key}`,
        x: pad + index * (diffW + diffGap),
        y: diffY,
        w: diffW,
        h: veryCompact ? 32 : 35,
        label,
        variant: difficulty === key ? 'primary' : 'secondary',
        disabled: false,
        onClick: () => { this.tempProfile.difficulty = key; },
      });
    });
    const diffKey = difficulty === 'easy' || difficulty === 'hard' ? difficulty : 'normal';
    const diffText = DIFFICULTY_CREATE_ROLE_HINT[diffKey];
    ctx.fillStyle = light ? 'rgba(38,48,65,0.58)' : COLORS.inkMuted;
    ctx.font = font(10, 430);
    const hintBottom = this.wrapText(
      diffText,
      pad,
      diffY + (veryCompact ? 36 : 44),
      w,
      veryCompact ? 13 : 15,
      1,
    );
    y = hintBottom + (compact ? 4 : 8);

    ctx.fillStyle = titleInk;
    ctx.font = font(13, 650);
    ctx.fillText('初始特质', pad, y);
    const tierKeys = TALENT_TIER_FILTER_KEYS;
    const poolLabel = TALENT_TIER_FILTER_LABEL[this.talentTierFilter] || '全部';
    const filterW = 76;
    const randomW = 66;
    const noneW = 38;
    const actionGap = 6;
    const randomX = pad + w - randomW;
    const filterX = randomX - actionGap - filterW;
    const noneX = filterX - actionGap - noneW;
    this.buttons.push({
      id: 'talent_none',
      x: noneX,
      y: y - 7,
      w: noneW,
      h: 30,
      label: '无',
      variant: 'ghost',
      disabled: false,
      onClick: () => {
        this.selectTalent({
          id: 'no_talent',
          name: '无',
          description: '不借助额外特质，从最普通的状态开始。',
          effects: {},
          specialEffects: {},
          rarity: 'common',
          meme: '',
        });
      },
    });
    this.buttons.push({
      id: 'talent_tier_cycle',
      x: filterX,
      y: y - 7,
      w: filterW,
      h: 30,
      label: `池 · ${poolLabel}`,
      variant: 'ghost',
      disabled: false,
      onClick: () => {
        const index = tierKeys.indexOf(this.talentTierFilter);
        this.talentTierFilter = tierKeys[(index + 1) % tierKeys.length];
      },
    });
    this.buttons.push({
      id: 'talent_random',
      x: randomX,
      y: y - 7,
      w: randomW,
      h: 30,
      label: '换一个',
      variant: 'secondary',
      disabled: false,
      onClick: () => {
        const next = this.pickRandomTalentFromTierFilter();
        if (next) this.selectTalent(next);
        else this.showToast('这个筛选池暂时没有可选特质');
      },
    });
    y += (veryCompact ? 22 : (compact ? 26 : 30));

    const talentCardBottom = actionY - 12;
    const talentH = Math.max(veryCompact ? 120 : 150, talentCardBottom - y);
    drawGlassPanel(ctx, pad, y, w, talentH, { radius: 20, strong: true });
    const talent = this.selectedTalent;
    const innerX = pad + 15;
    const textW = w - 30;
    let ty = y + 14;
    if (talent) {
      const tier = TALENT_TIER_LABEL[talent.tier] || '平衡';
      const tierColor = talent.tier === 'positive'
        ? COLORS.jade
        : talent.tier === 'negative' || talent.tier === 'hell'
          ? COLORS.coral
          : COLORS.gold;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = alpha(tierColor, 0.14);
      const tierW = ctx.measureText(tier).width + 18;
      fillRoundRect(ctx, innerX, ty, Math.max(42, tierW), 20, 10, alpha(tierColor, 0.14));
      ctx.fillStyle = tierColor;
      ctx.font = font(9.5, 650);
      ctx.textAlign = 'center';
      ctx.fillText(tier, innerX + Math.max(42, tierW) / 2, ty + 10);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = COLORS.ink;
      ctx.font = font(21, 690);
      ctx.fillText(talent.name || '未选择', innerX, ty + 27);
      ty += 59;
      ctx.fillStyle = COLORS.inkMuted;
      ctx.font = font(11.5, 430);
      const descLines = compact ? 2 : 3;
      ty = this.wrapText(
        talent.description || '',
        innerX,
        ty,
        textW,
        veryCompact ? 16 : 18,
        descLines,
      );
      ty += veryCompact ? 5 : 9;
      const chips = this.formatStatChanges(talent.effects || {});
      let chipX = innerX;
      chips.forEach((chip) => {
        ctx.font = font(10, 600);
        const chipW = Math.min(textW, ctx.measureText(chip.label).width + 18);
        if (chipX + chipW > innerX + textW) return;
        fillRoundRect(ctx, chipX, ty, chipW, 22, 11, 'rgba(255,255,255,0.07)');
        ctx.fillStyle = chip.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(chip.label, chipX + chipW / 2, ty + 11);
        chipX += chipW + 6;
      });
      ty += chips.length ? (veryCompact ? 28 : 32) : 2;
      const specialLines = Object.keys(talent.specialEffects || {})
        .filter((key) => talent.specialEffects[key] && TALENT_SPECIAL_LABEL[key])
        .map((key) => TALENT_SPECIAL_LABEL[key])
        .slice(0, compact ? 1 : 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      specialLines.forEach((line) => {
        if (ty + 34 > y + talentH) return;
        ctx.fillStyle = COLORS.gold;
        ctx.beginPath();
        ctx.arc(innerX + 3, ty + 6, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.inkMuted;
        ctx.font = font(10, 430);
        const next = this.wrapText(line, innerX + 12, ty, textW - 12, 15, 2);
        ty = Math.max(ty + 18, next);
      });
    } else {
      ctx.fillStyle = COLORS.inkMuted;
      ctx.font = font(12, 450);
      this.wrapText('随机抽取一个开局特质，或选择无特质开始。', innerX, y + 28, textW, 18, 2);
    }

    const backW = veryCompact ? 78 : 86;
    this.buttons.push({
      id: 'role_back',
      x: pad,
      y: actionY,
      w: backW,
      h: actionH,
      label: '返回',
      variant: 'secondary',
      disabled: false,
      onClick: () => this.goScene('menu'),
    });
    this.buttons.push({
      id: 'role_confirm_continue',
      x: pad + backW + (veryCompact ? 8 : 9),
      y: actionY,
      w: w - backW - (veryCompact ? 8 : 9),
      h: actionH,
      label: '选择学校  →',
      variant: 'primary',
      disabled: false,
      onClick: () => {
        if (!this.selectedTalent) {
          this.selectTalent({
            id: 'no_talent',
            name: '无',
            description: '不借助额外特质，从最普通的状态开始。',
            effects: {},
            specialEffects: {},
            rarity: 'common',
            meme: '',
          });
        }
        this.goScene('school', { clearPending: true });
      },
    });
  }


  getUnlockHint(type, id) {
    const rules = UNLOCK_RULES[type];
    if (!rules || !rules[id]) return '默认解锁';
    const rule = rules[id];
    const meta = save.loadMeta();
    const subHint = (r) => {
      if (r.playCount !== undefined) {
        return `已 ${meta.playCount} / 共 ${r.playCount} 局`;
      }
      if (r.ending) return '需先解锁指定结局';
      if (r.achievement) return '需指定成就';
      return '';
    };
    if (rule.any && Array.isArray(rule.any)) {
      return rule.any.map((s) => subHint(s)).filter(Boolean).join(' 或 ') || '待解锁';
    }
    if (rule.playCount !== undefined) return `已 ${meta.playCount} / 共 ${rule.playCount} 局`;
    if (rule.ending) return '需先解锁指定结局';
    if (rule.achievement) return '需指定成就';
    return '待解锁';
  }

  formatPickEffectsLine(item) {
    const fx = item.effects || {};
    const parts = [];
    Object.keys(STAT_LABELS).forEach((k) => {
      if (fx[k] === undefined || fx[k] === 0) return;
      parts.push(`${this.getStatLabel(k)} ${this.formatStatValue(k, fx[k], { delta: true })}`);
    });
    return parts.length ? parts.join(' · ') : '';
  }

  sanitizePickName(name) {
    const raw = String(name || '');
    return raw.replace(/[（(][^）)]*[）)]/g, '').replace(/\s{2,}/g, ' ').trim();
  }

  buildPickSubtitle(tagline) {
    if (!tagline) return '';
    const cleaned = String(tagline)
      .replace(/选这里你会/g, '你会')
      .replace(/选这条线你会/g, '你会')
      .replace(/[「」"'`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const split = cleaned.split(/[；。]/).map((s) => s.trim()).filter(Boolean);
    return split[0] || cleaned;
  }


  /** 右侧极简滚动位置指示线（trackTop, trackH, scroll, contentScrollRange） */
  drawScrollIndicator(trackTop, trackH, scroll, maxScroll) {
    const x = SCREEN_WIDTH - 6;
    const barW = 2;
    ctx.fillStyle = 'rgba(120, 130, 150, 0.28)';
    ctx.fillRect(x, trackTop, barW, trackH);
    if (maxScroll <= 0) return;
    const thumbH = Math.max(20, trackH * 0.22);
    const inner = trackH - thumbH;
    const t = Math.max(0, Math.min(1, scroll / maxScroll));
    ctx.fillStyle = 'rgba(210, 218, 235, 0.55)';
    ctx.fillRect(x, trackTop + t * inner, barW, thumbH);
  }

  renderPickScreen(title, list, unlockedSet, type, onPick, backScenePrev) {
    this.drawSceneBackground();
    const light = this.themeMode === 'light';
    const titleInk = light ? COLORS.paperInk : COLORS.ink;
    drawSceneKicker(ctx, 15, SAFE_TOP + 5, type === 'schools' ? 'CHOOSE A CAMPUS' : 'CHOOSE A DIRECTION', light ? COLORS.coralDeep : COLORS.gold);
    ctx.fillStyle = titleInk;
    ctx.font = font(26, 730);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, 15, SAFE_TOP + 18);
    ctx.fillStyle = light ? 'rgba(38,48,65,0.58)' : COLORS.inkMuted;
    ctx.font = font(10.5, 450);
    ctx.fillText(
      type === 'schools' ? '学校决定起点、资源与最先遇见的人。' : '专业会改变能力成长和后续事件。',
      15,
      SAFE_TOP + 51,
    );
    this.buttons = [];
    const pad = 15;
    const w = SCREEN_WIDTH - pad * 2 - 10;
    const rowGap = 8;
    const listTop = SAFE_TOP + 72;
    const pickBtnH = 55;
    const footerBtnH = 50;
    const actionY = SCREEN_HEIGHT - SAFE_BOTTOM - footerBtnH;
    const maxBottom = actionY - 34;
    const scrollHintY = actionY - 17;

    const innerW = w - 20;
    const positions = [];
    const rowMetas = list.map((item) => {
      const unlocked = unlockedSet.has(item.id);
      const lockHint = this.getUnlockHint(type, item.id);
      const titleText = unlocked ? this.sanitizePickName(item.name) : `${this.sanitizePickName(item.name)} · 未解锁`;
      const subtitle = unlocked
        ? (PICK_SUBTITLE_OVERRIDES[item.id] || this.buildPickSubtitle(item.tagline))
        : `解锁条件：${lockHint}`;
      const metaSmall = unlocked
        ? (type === 'majors' ? '' : (type === 'schools' ? '学校会改变可选专业与校内事件池' : '专业会改变后续分支、成就与结局倾向'))
        : '';
      const effectCue = unlocked ? this.formatEffectCue(item.effects || {}) : '';
      const effectDetail = unlocked ? this.formatPickEffectsLine(item) : '';
      const pickContent = {
        title: titleText,
        subtitle,
        effectSmall: effectCue,
        metaSmall: effectDetail || metaSmall,
        locked: !unlocked,
        lockedLabel: '暂未解锁',
      };
      const id = `${type}_${item.id}`;
      const expanded = !!(unlocked && this.pendingTransition && this.pendingTransition.buttonId === id);
      const h = this.measurePickRowHeight(pickContent, innerW, expanded);
      return {
        item,
        unlocked,
        id,
        pickContent,
        h,
        titleText,
      };
    });

    let acc = 0;
    rowMetas.forEach((rm, i) => {
      positions[i] = acc;
      acc += rm.h + rowGap;
    });
    const totalContentHeight = acc > 0 ? acc - rowGap : 0;
    const viewportH = maxBottom - listTop;
    const maxScroll = Math.max(0, totalContentHeight - viewportH);
    let scrollOffset = type === 'schools' ? this.schoolScroll : (type === 'majors' ? this.majorScroll : 0);
    scrollOffset = Math.max(0, Math.min(maxScroll, scrollOffset));
    if (type === 'schools') this.schoolScroll = scrollOffset;
    if (type === 'majors') this.majorScroll = scrollOffset;
    this._pickListScrollMax = maxScroll;

    const needsScroll = maxScroll > 0;
    for (let i = 0; i < rowMetas.length; i += 1) {
      const rm = rowMetas[i];
      const topY = listTop + positions[i] - scrollOffset;
      if (topY < listTop || topY + rm.h > maxBottom) continue;
      this.buttons.push({
        id: rm.id,
        x: pad,
        y: topY,
        w,
        h: pickBtnH,
        label: rm.titleText,
        pickContent: rm.pickContent,
        pickDetailBelow: true,
        disabled: !rm.unlocked,
        onClick: () => {
          if (!rm.unlocked) return;
          const shortName = this.sanitizePickName(rm.item.name);
          this.queueTransition(rm.id, `你已选择${shortName}`, () => onPick(rm.item));
        },
      });
    }

    const trackH = viewportH;
    if (needsScroll) this.drawScrollIndicator(listTop, trackH, scrollOffset, maxScroll);

    if (needsScroll) {
      ctx.fillStyle = 'rgba(185, 196, 224, 0.55)';
      ctx.font = `${uiTheme.font.small}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(type === 'schools' ? '上下滑动查看更多学校' : '上下滑动查看更多专业', SCREEN_WIDTH / 2, scrollHintY);
      ctx.textBaseline = 'top';
    }

    const backW = Math.max(78, Math.round((SCREEN_WIDTH - pad * 2) * 0.24));
    this.buttons.push({
      id: `${type}_confirm`,
      x: pad + backW + 9,
      y: actionY,
      w: SCREEN_WIDTH - pad * 2 - backW - 9,
      h: footerBtnH,
      label: type === 'schools' ? '选择这所学校  →' : '开始这四年  →',
      variant: 'primary',
      disabled: !this.pendingTransition,
      onClick: () => {
        if (!this.pendingTransition) return;
        this.commitPendingTransition();
      },
    });
    this.buttons.push({
      x: pad,
      y: actionY,
      w: backW,
      h: footerBtnH,
      label: '返回',
      variant: 'secondary',
      disabled: false,
      onClick: () => { this.goScene(backScenePrev); },
    });
  }

  renderSchool() {
    const meta = save.loadMeta();
    this.renderPickScreen('选择学校', Object.values(SCHOOLS), new Set(meta.unlockedSchools), 'schools', (s) => {
      this.pendingSchoolId = s.id;
      this.goScene('major');
    }, 'create_role');
  }

  renderMajor() {
    const meta = save.loadMeta();
    const matrix = SCHOOL_MAJOR_MATRIX[this.pendingSchoolId] || { core: [], cross: [] };
    const majorList = Object.values(MAJORS).filter((m) => matrix.core.includes(m.id) || matrix.cross.includes(m.id));
    this.renderPickScreen('选择专业', majorList, new Set(meta.unlockedMajors), 'majors', (m) => {
      this.startNewRun(this.pendingSchoolId, m.id);
    }, 'school');
  }

  /** 游玩场景底部状态栏与操作区布局（随屏幕高度自适应） */
  getPlaySceneChrome() {
    const headerTop = SAFE_TOP + 2;
    const statsPanelH = 74;
    const statsTop = headerTop + 62;
    const navH = 50;
    const navBottom = SCREEN_HEIGHT - SAFE_BOTTOM;
    const navTop = navBottom - navH;
    const continueBtnH = 45;
    const continueGap = 9;
    const defaultContinueY = navTop - continueGap - continueBtnH;
    const chromeGap = 9;
    const contentTop = statsTop + statsPanelH + 10;
    const contentBottom = (this.pendingTransition ? defaultContinueY : navTop) - chromeGap;
    return {
      headerTop,
      statsTop,
      statsPanelH,
      contentTop,
      contentBottom,
      navTop,
      navBottom,
      navH,
      continueBtnH,
      continueGap,
      defaultContinueY,
      chromeGap,
    };
  }

  renderStatsPanel() {
    const st = this.run.stats;
    const chrome = this._playChrome || this.getPlaySceneChrome();
    const x = 13;
    const y = chrome.statsTop;
    const panelH = chrome.statsPanelH;
    const w = SCREEN_WIDTH - 26;
    drawGlassPanel(ctx, x, y, w, panelH, { radius: 18, strong: true });

    const metrics = [
      { label: '健康', value: Math.round(Number(st.health || 0)), ratio: Number(st.health || 0) / 100, color: COLORS.jade },
      { label: '压力', value: Math.round(Number(st.pressure || 0)), ratio: Number(st.pressure || 0) / 100, color: COLORS.warning, inverse: true },
      { label: '绩点', value: this.formatStatValue('gpa', st.gpa), ratio: Number(st.gpa || 0) / 4, color: COLORS.sky },
      { label: '社交', value: Math.round(Number(st.social || 0)), ratio: Number(st.social || 0) / 100, color: '#D7A8D9' },
      { label: '能力', value: Math.round(Number(st.skill || 0)), ratio: Number(st.skill || 0) / 100, color: COLORS.gold },
      { label: '余额', value: `¥${this.formatStatValue('money', st.money)}`, ratio: clamp(Number(st.money || 0) / 5000, 0, 1), color: COLORS.coral },
    ];
    const cellW = w / 3;
    const rowH = panelH / 2;
    metrics.forEach((metric, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const cx = x + col * cellW;
      const cy = y + row * rowH;
      if (col > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(cx, cy + 11, 1, rowH - 22);
      }
      if (row === 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(x + 12, cy, w - 24, 1);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.inkMuted;
      ctx.font = font(10, 500);
      ctx.fillText(metric.label, cx + 11, cy + 18);
      ctx.textAlign = 'right';
      let valueColor = COLORS.ink;
      if (metric.inverse && metric.ratio >= 0.72) valueColor = COLORS.danger;
      if (metric.label === '健康' && metric.ratio <= 0.3) valueColor = COLORS.danger;
      ctx.fillStyle = valueColor;
      ctx.font = font(14, 650);
      ctx.fillText(this.fitText(String(metric.value), cellW - 34), cx + cellW - 11, cy + 18);
      fillRoundRect(ctx, cx + 11, cy + rowH - 12, cellW - 22, 3, 1.5, 'rgba(255,255,255,0.08)');
      fillRoundRect(
        ctx,
        cx + 11,
        cy + rowH - 12,
        Math.max(2, (cellW - 22) * clamp(metric.ratio, 0, 1)),
        3,
        1.5,
        metric.color,
      );
    });
  }

  /** 事件阶段：测算标题、正文与选项总高度（含展开说明框） */
  measurePlayEventContent(eventObj, pad, w, startY) {
    const bodyLH = uiTheme.lineHeight?.body || 19;
    let penY = startY + 24;
    ctx.save();
    ctx.font = `${uiTheme.font.body}px sans-serif`;
    penY = this.measureWrappedTextBottom(
      eventObj.body || '',
      pad,
      penY,
      SCREEN_WIDTH - pad * 2,
      bodyLH,
      6,
    );
    ctx.restore();
    penY += 12;
    const choiceMetas = (eventObj.choices || []).map((c, index) => {
      const choiceId = `choice_${eventObj.id}_${index}`;
      const pickContent = this.buildEventChoicePickContent(c);
      const expanded = !!(this.pendingTransition && this.pendingTransition.buttonId === choiceId);
      const detailH = expanded ? this.measurePickDetailPanelHeight(pickContent, w - 20) : 0;
      const rowH = 52 + (expanded ? 8 + detailH : 0);
      return { c, index, choiceId, pickContent, rowH };
    });
    choiceMetas.forEach((m) => {
      m.y = penY;
      penY += m.rowH + 6;
    });
    return {
      titleY: startY,
      listTop: startY,
      choiceMetas,
      totalHeight: penY - startY,
    };
  }

  renderPlayEventBlock(eventObj, pad, w, startY, contentTop, contentBottom) {
    const bodyLH = uiTheme.lineHeight?.body || 19;
    const measured = this.measurePlayEventContent(eventObj, pad, w, startY);
    const viewportH = Math.max(0, contentBottom - contentTop);
    const maxScroll = Math.max(0, measured.totalHeight - viewportH);
    this._playContentScrollMax = maxScroll;
    const scroll = Math.max(0, Math.min(maxScroll, Number(this.playContentScroll) || 0));
    this.playContentScroll = scroll;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, contentTop, SCREEN_WIDTH, viewportH);
    ctx.clip();

    const drawY0 = measured.titleY - scroll;
    ctx.fillStyle = COLORS.ink;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    if (drawY0 + 24 >= contentTop && drawY0 <= contentBottom) {
      ctx.fillText(eventObj.title, pad, drawY0);
    }

    ctx.font = `${uiTheme.font.body}px sans-serif`;
    ctx.fillStyle = COLORS.inkMuted;
    const bodyY = drawY0 + 24;
    if (bodyY < contentBottom) {
      this.wrapText(eventObj.body || '', pad, bodyY, SCREEN_WIDTH - pad * 2, bodyLH, 6);
    }

    this._playEventChoiceLayouts = measured.choiceMetas;
    this._playEventListTop = contentTop;

    measured.choiceMetas.forEach((m) => {
      const drawY = m.y - scroll;
      if (drawY < contentTop || drawY + m.rowH > contentBottom) return;
      this.buttons.push({
        id: m.choiceId,
        x: pad,
        y: drawY,
        w,
        h: 52,
        label: this.applyRunContent(m.c.text),
        pickContent: m.pickContent,
        pickDetailBelow: true,
        disabled: false,
        onClick: () => {
          this.queueTransition(
            m.choiceId,
            `你已选择，${m.c.text.slice(0, 10)}...`,
            () => this.handleEventChoice(m.c),
          );
        },
      });
    });
    ctx.restore();

    if (maxScroll > 0) {
      this.drawScrollIndicator(contentTop, viewportH, scroll, maxScroll);
    }

    return measured.totalHeight;
  }



  renderPlay() {
    this.drawSceneBackground();
    if (!this.run) return;
    if (this.run.phase !== 'week_action') this._weeklyScrollUi = null;

    const chrome = this.getPlaySceneChrome();
    this._playChrome = chrome;
    const pad = 13;
    const w = SCREEN_WIDTH - pad * 2;
    const headerY = chrome.headerTop;
    const semNo = Number(this.run.semesterIndex || 0) + 1;
    const weekNo = Number(this.run.weekIndex || 0) + 1;
    const yearNo = Math.min(4, Math.ceil(semNo / 2));
    const school = SCHOOLS[this.run.schoolId];
    const major = MAJORS[this.run.majorId];
    const light = this.themeMode === 'light';
    const titleInk = light ? COLORS.paperInk : COLORS.ink;

    drawSceneKicker(
      ctx,
      pad,
      headerY + 4,
      `YEAR ${yearNo}  /  SEMESTER ${semNo}  /  WEEK ${weekNo}`,
      light ? COLORS.coralDeep : COLORS.gold,
    );
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = titleInk;
    ctx.font = font(TYPE.title, 720);
    ctx.fillText(`第 ${semNo} 学期`, pad, headerY + 17);
    const titleWidth = ctx.measureText(`第 ${semNo} 学期`).width;
    const weekTag = `第 ${weekNo} 周`;
    ctx.font = font(10.5, 600);
    const weekTagW = ctx.measureText(weekTag).width + 15;
    fillRoundRect(
      ctx,
      pad + titleWidth + 8,
      headerY + 22,
      weekTagW,
      20,
      10,
      light ? 'rgba(233,105,77,0.1)' : 'rgba(235,199,121,0.13)',
    );
    ctx.fillStyle = light ? COLORS.coralDeep : COLORS.gold;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(weekTag, pad + titleWidth + 8 + weekTagW / 2, headerY + 32);

    const avatarSize = 42;
    this.drawAvatar(SCREEN_WIDTH - pad - avatarSize, headerY + 6, avatarSize, this.run.playerProfile);
    const metaLabel = [school && school.name, major && major.name].filter(Boolean).join(' · ');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = light ? 'rgba(38,48,65,0.64)' : COLORS.inkMuted;
    ctx.font = font(10.5, 450);
    ctx.fillText(
      this.fitText(metaLabel || this.run.playerProfile.name, SCREEN_WIDTH - pad * 2 - avatarSize - 16),
      pad,
      headerY + 45,
    );
    const trackW = SCREEN_WIDTH - pad * 2 - avatarSize - 14;
    for (let i = 0; i < TOTAL_SEMESTERS; i += 1) {
      const segmentGap = 3;
      const segmentW = (trackW - segmentGap * (TOTAL_SEMESTERS - 1)) / TOTAL_SEMESTERS;
      const sx = pad + i * (segmentW + segmentGap);
      const active = i < semNo;
      const current = i === semNo - 1;
      fillRoundRect(
        ctx,
        sx,
        headerY + 58,
        segmentW,
        current ? 3 : 2,
        1,
        current
          ? (light ? COLORS.coralDeep : COLORS.gold)
          : active
            ? (light ? 'rgba(233,105,77,0.38)' : 'rgba(235,199,121,0.4)')
            : (light ? 'rgba(38,48,65,0.12)' : 'rgba(255,255,255,0.12)'),
      );
    }

    this.buttons = [];
    const contentTop = chrome.contentTop;
    const contentBottom = chrome.contentBottom;

    if (this.run.phase === 'week_action') {
      drawSceneKicker(
        ctx,
        pad,
        contentTop + 7,
        'THIS WEEK',
        light ? COLORS.coralDeep : COLORS.coral,
      );
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = titleInk;
      ctx.font = font(TYPE.heading, 680);
      ctx.fillText(this.weeklyShopOverlay ? '顺路逛逛' : '这周怎么过', pad, contentTop + 18);

      if (this.weeklyShopOverlay) {
        this.renderWeeklyShopOverlay(pad, w, contentTop + 55, contentBottom);
      } else {
        const actions = this.getWeeklyActionChoices();
        const listTop = contentTop + 48;
        const viewportH = Math.max(WEEK_ACTION_ROW_H, contentBottom - listTop);
        const totalH = actions.length * WEEK_ACTION_ROW_H;
        const maxScroll = Math.max(0, totalH - viewportH);
        this.weeklyActionScroll = clamp(Number(this.weeklyActionScroll || 0), 0, maxScroll);
        const visibleCount = Math.max(1, Math.floor(viewportH / WEEK_ACTION_ROW_H));
        const startVisible = Math.floor(this.weeklyActionScroll / WEEK_ACTION_ROW_H) + 1;
        const endVisible = Math.min(actions.length, startVisible + visibleCount - 1);
        if (this.isRewardAssistEligible()) {
          this.buttons.push({
            id: 'reward_assist',
            x: SCREEN_WIDTH - pad - 86,
            y: contentTop + 2,
            w: 86,
            h: 31,
            label: '应急补给',
            variant: 'secondary',
            disabled: false,
            onClick: () => this.openRewardAssist(),
          });
        } else {
          ctx.textAlign = 'right';
          ctx.textBaseline = 'top';
          ctx.fillStyle = light ? 'rgba(38,48,65,0.42)' : COLORS.inkFaint;
          ctx.font = font(10, 500);
          ctx.fillText(
            actions.length > visibleCount ? `${startVisible}–${endVisible} / ${actions.length}` : `${actions.length} 个选择`,
            SCREEN_WIDTH - pad,
            contentTop + 23,
          );
        }

        this._weeklyScrollUi = {
          maxScroll,
          thumbH: maxScroll > 0 ? Math.max(24, (viewportH / totalH) * viewportH) : viewportH,
          track: { x: SCREEN_WIDTH - 14, y: listTop, w: 18, h: viewportH },
        };
        if (maxScroll > 0) {
          fillRoundRect(ctx, SCREEN_WIDTH - 12, listTop + 2, 2, viewportH - 4, 1, 'rgba(255,255,255,0.09)');
          const thumbH = this._weeklyScrollUi.thumbH;
          const thumbY = listTop + (this.weeklyActionScroll / maxScroll) * (viewportH - thumbH);
          fillRoundRect(
            ctx,
            SCREEN_WIDTH - 12,
            thumbY + 2,
            2,
            thumbH - 4,
            1,
            light ? 'rgba(233,105,77,0.46)' : 'rgba(235,199,121,0.5)',
          );
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, listTop, SCREEN_WIDTH, viewportH);
        ctx.clip();
        actions.forEach((action, index) => {
          const buttonId = `action_${action.id}`;
          const cardY = listTop + index * WEEK_ACTION_ROW_H + 3 - this.weeklyActionScroll;
          const cardH = WEEK_ACTION_ROW_H - 7;
          if (cardY < listTop || cardY + cardH > listTop + viewportH) return;
          const cost = Number(action.cost || 0);
          const afford = Number((this.run.stats && this.run.stats.money) || 0) >= cost;
          const descKey = `${this.run.semesterIndex}_${this.run.weekIndex}_${action.id}`;
          const randomDesc = this.fixedActionDescriptions.get(descKey) || action.description;
          const pickContent = {
            title: action.title,
            subtitle: this.editorializeActionDescription(action, randomDesc),
            effectSmall: cost > 0 ? `−¥${cost}` : '',
            metaSmall: afford ? '' : '资金不足',
            locked: !afford,
            lockedLabel: '余额不足',
          };
          this.buttons.push({
            id: buttonId,
            x: pad,
            y: cardY,
            w: w - 8,
            h: cardH,
            label: action.title,
            pickContent,
            pickDetailBelow: false,
            disabled: !afford,
            onClick: () => {
              if (Array.isArray(action.tags) && action.tags.includes('weekly_shop')) {
                this.openWeeklyShop(action);
                return;
              }
              this.queueTransition(buttonId, action.title, () => this.handleWeeklyAction(action));
            },
          });
        });
        ctx.restore();
      }
    } else {
      drawSceneKicker(
        ctx,
        pad,
        contentTop + 7,
        this.run.phase === 'main_event' ? 'MAIN EVENT' : 'CAMPUS EVENT',
        light ? COLORS.coralDeep : COLORS.coral,
      );
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = titleInk;
      ctx.font = font(TYPE.heading, 680);
      ctx.fillText(
        this.run.phase === 'main_event' ? '这一周，有些事绕不开' : '路上遇到一点插曲',
        pad,
        contentTop + 18,
      );
      if (this.isRewardAssistEligible()) {
        this.buttons.push({
          id: 'reward_assist',
          x: SCREEN_WIDTH - pad - 86,
          y: contentTop + 2,
          w: 86,
          h: 31,
          label: '应急补给',
          variant: 'secondary',
          disabled: false,
          onClick: () => this.openRewardAssist(),
        });
      }

      let eventObj = this.getCurrentEvent();
      if (!eventObj) {
        if (this.run.phase === 'main_event') {
          this.run.pendingMainEvent = this.pickMainForRun(this.run);
        } else if (this.run.phase === 'side_event') {
          this.run.pendingSideEvent = this.pickSideForRun(this.run);
        }
        eventObj = this.getCurrentEvent();
        if (!eventObj) return;
      }

      this.maybeShowNpcPreChoiceNarrative(eventObj);
      const eventScrollKey = String(eventObj.id || '');
      if (this._playEventScrollKey !== eventScrollKey) {
        this._playEventScrollKey = eventScrollKey;
        this.playContentScroll = 0;
      }
      const eventTop = contentTop + 48;
      const eventInnerX = pad + 13;
      const eventInnerW = w - 26;
      const eventStartY = eventTop + 15;
      const measuredEvent = this.measurePlayEventContent(
        eventObj,
        eventInnerX,
        eventInnerW,
        eventStartY,
      );
      const cardH = Math.min(
        contentBottom - eventTop,
        Math.max(190, measuredEvent.totalHeight + 28),
      );
      const eventBottom = eventTop + cardH;
      drawGlassPanel(ctx, pad, eventTop, w, cardH, {
        radius: 19,
        strong: true,
        shadow: false,
      });
      this.renderPlayEventBlock(
        eventObj,
        eventInnerX,
        eventInnerW,
        eventStartY,
        eventTop,
        eventBottom,
      );
    }

    if (this.pendingTransition) {
      this.buttons.push({
        id: 'play_continue',
        x: pad,
        y: chrome.defaultContinueY,
        w,
        h: chrome.continueBtnH,
        label: '确认这个选择   ›',
        variant: 'primary',
        disabled: false,
        onClick: () => this.commitPendingTransition(),
      });
    }

    const navItems = [
      {
        id: 'open_relations',
        label: '关系',
        icon: 'people',
        onClick: () => {
          this.pushReturnScene();
          this.relationsScroll = 0;
          this.goScene('relations', { clearPending: false });
        },
      },
      {
        id: 'open_run_log',
        label: '记录',
        icon: 'book',
        onClick: () => {
          this.pushReturnScene();
          this.runLogScroll = 0;
          this.goScene('run_log', { clearPending: false });
        },
      },
      {
        id: 'open_inventory',
        label: '背包',
        icon: 'bag',
        onClick: () => {
          this.pushReturnScene();
          this.inventoryScroll = 0;
          this.goScene('inventory', { clearPending: false });
        },
      },
      {
        id: 'play_back_safe',
        label: '菜单',
        icon: 'home',
        onClick: () => this.confirmReturnToMenu(),
      },
    ];
    drawGlassPanel(ctx, pad, chrome.navTop, w, chrome.navH, { radius: 17, strong: true });
    const navCellW = w / navItems.length;
    navItems.forEach((item, index) => {
      const nx = pad + index * navCellW;
      const isPressed = this.pressedButtonId === item.id;
      if (isPressed) {
        fillRoundRect(
          ctx,
          nx + 7,
          chrome.navTop + 5,
          navCellW - 14,
          chrome.navH - 10,
          13,
          'rgba(255,255,255,0.08)',
        );
      }
      if (index > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(nx, chrome.navTop + 14, 1, chrome.navH - 28);
      }
      const iconSize = 17;
      const centerX = nx + navCellW / 2;
      drawIcon(ctx, item.icon, centerX - iconSize / 2, chrome.navTop + 8, iconSize, COLORS.inkMuted);
      ctx.fillStyle = COLORS.inkMuted;
      ctx.font = font(9.5, 500);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, centerX, chrome.navTop + 38);
      this.buttons.push({
        id: item.id,
        x: nx,
        y: chrome.navTop,
        w: navCellW,
        h: chrome.navH,
        label: item.label,
        invisible: true,
        disabled: false,
        onClick: item.onClick,
      });
    });

    this.renderStatsPanel();
  }


  renderEnding() {
    this.drawSceneBackground();
    const e = this.currentEnding;
    const light = this.themeMode === 'light';
    const titleInk = light ? COLORS.paperInk : COLORS.ink;
    drawSceneKicker(ctx, 15, SAFE_TOP + 5, 'EPILOGUE', light ? COLORS.coralDeep : COLORS.gold);
    ctx.fillStyle = titleInk;
    ctx.font = font(25, 730);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.fitText(e ? e.title : '四年之后', SCREEN_WIDTH - 30), 15, SAFE_TOP + 18);
    const scroll = this.endingScroll || 0;
    const pad = 14;
    const cardX = pad;
    const cardW = SCREEN_WIDTH - pad * 2;
    const cardY = SAFE_TOP + 61;
    const actionY = SCREEN_HEIGHT - SAFE_BOTTOM - 50;
    const cardH = Math.max(220, actionY - cardY - 12);
    drawPaperPanel(ctx, cardX, cardY, cardW, cardH, { radius: 21 });
    let penY = cardY + 18 - scroll;
    const textX = cardX + 21;
    const textW = cardW - 42;
    const listTop = cardY;
    const listBottom = cardY + cardH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cardX + 8, listTop + 8, cardW - 16, cardH - 16);
    ctx.clip();
    ctx.textAlign = 'left';
    if (e) {
      ctx.fillStyle = 'rgba(38,48,65,0.82)';
      ctx.font = font(14, 430);
      const endingStory = this.buildEndingStoryText(e);
      penY = this.drawParagraphText(endingStory || '', textX, penY, textW, 22, 999);
    }
    if (this.runSettlement) {
      ctx.fillStyle = 'rgba(38,48,65,0.56)';
      ctx.font = font(10.5, 430);
      penY += 18;
      penY = this.wrapText(
        this.formatRunSettlementText(this.runSettlement),
        textX,
        penY,
        textW,
        17,
        999,
      );
    }
    ctx.restore();
    const contentTop = cardY + 18;
    const viewH = cardH - 36;
    const maxScroll = Math.max(0, penY + scroll - (cardY + cardH - 18));
    this._endingScrollMax = maxScroll;
    this.endingScroll = clamp(this.endingScroll || 0, 0, maxScroll);
    if (maxScroll > 0) {
      const thumbH = Math.max(24, (viewH / (viewH + maxScroll)) * viewH);
      const thumbY = contentTop + (this.endingScroll / maxScroll) * (viewH - thumbH);
      fillRoundRect(ctx, cardX + cardW - 10, contentTop, 2, viewH, 1, 'rgba(38,48,65,0.13)');
      fillRoundRect(ctx, cardX + cardW - 10, thumbY, 2, thumbH, 1, 'rgba(233,105,77,0.55)');
    }

    this.buttons = [];
    const backW = 92;
    this.buttons.push({
      id: 'ending_menu',
      x: pad,
      y: actionY,
      w: backW,
      h: 50,
      label: '返回',
      variant: 'secondary',
      disabled: false,
      onClick: () => {
        this.currentEnding = null;
        this.runSettlement = null;
        this.endingScroll = 0;
        this.goScene('menu');
      },
    });
    this.buttons.push({
      id: 'ending_again',
      x: pad + backW + 9,
      y: actionY,
      w: SCREEN_WIDTH - pad * 2 - backW - 9,
      h: 50,
      label: '再走一局  →',
      variant: 'primary',
      disabled: false,
      onClick: () => {
        this.currentEnding = null;
        this.runSettlement = null;
        this.endingScroll = 0;
        this.run = null;
        this.goScene('create_role', { initCreateRole: true });
      },
    });
  }

  renderGallery() {
    this.drawSceneBackground();
    const light = this.themeMode === 'light';
    drawSceneKicker(ctx, 15, SAFE_TOP + 5, 'ENDINGS', light ? COLORS.coralDeep : COLORS.gold);
    ctx.fillStyle = light ? COLORS.paperInk : COLORS.ink;
    ctx.font = font(26, 730);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('结局档案', 15, SAFE_TOP + 18);
    ctx.fillStyle = light ? 'rgba(38,48,65,0.56)' : COLORS.inkMuted;
    ctx.font = font(10.5, 450);
    ctx.fillText('每一条路，都会留下不同的毕业以后。', 15, SAFE_TOP + 51);

    const meta = save.loadMeta();
    const unlocked = new Set(meta.unlockedEndings);
    const endingOrder = new Map();
    const orderList = Array.isArray(meta.endingUnlockOrder) ? meta.endingUnlockOrder : [];
    orderList.forEach((it, idx) => {
      const id = String(it.id || '');
      if (!id) return;
      const ts = Number(it.ts || idx + 1);
      endingOrder.set(id, ts);
    });
    (meta.unlockedEndings || []).forEach((id, idx) => {
      if (!endingOrder.has(id)) endingOrder.set(id, idx + 1);
    });
    const sortedEndings = [...endingsCatalog].sort((a, b) => {
      const aUnlocked = unlocked.has(a.id);
      const bUnlocked = unlocked.has(b.id);
      if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1;
      if (aUnlocked && bUnlocked) {
        const at = Number(endingOrder.get(a.id) || 0);
        const bt = Number(endingOrder.get(b.id) || 0);
        if (at !== bt) return bt - at;
      }
      return 0;
    });
    ctx.textAlign = 'left';
    const listTop = SAFE_TOP + 72;
    const backBtnY = SCREEN_HEIGHT - SAFE_BOTTOM - 42;
    const listBottom = backBtnY - 8;
    let y = listTop - this.galleryScroll;
    this.buttons = [];
    this.galleryEndingHitAreas = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listTop, SCREEN_WIDTH, listBottom - listTop);
    ctx.clip();
    sortedEndings.forEach((end) => {
      const ok = unlocked.has(end.id);
      const rowH = ok ? 104 : 88;
      if (y < listBottom + 200 && y + rowH > listTop - 200) {
        const cardX = 16;
        const cardW = SCREEN_WIDTH - 32;
        ctx.fillStyle = ok
          ? (light ? 'rgba(252,249,242,0.9)' : 'rgba(25,37,54,0.9)')
          : (light ? 'rgba(255,255,255,0.54)' : 'rgba(15,24,38,0.82)');
        this.fillRoundRect(cardX, y, cardW, rowH, 10);
        ctx.strokeStyle = ok ? 'rgba(255, 209, 102, 0.65)' : 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1.2;
        this.strokeRoundRect(cardX, y, cardW, rowH, 10);

        const tagX = cardX + 10;
        const tagY = y + 10;
        const tagW = 46;
        const tagH = 20;
        ctx.fillStyle = ok ? 'rgba(255, 209, 102, 0.2)' : 'rgba(255,255,255,0.14)';
        this.fillRoundRect(tagX, tagY, tagW, tagH, 6);
        ctx.fillStyle = ok ? (uiTheme.colors.accent || uiTheme.colors.textMain) : uiTheme.colors.buttonDisabled;
        ctx.font = `bold ${uiTheme.font.small}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ok ? '已解锁' : '未解锁', tagX + tagW / 2, tagY + tagH / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = ok ? uiTheme.colors.textMain : uiTheme.colors.buttonDisabled;
        ctx.font = `bold ${uiTheme.font.body}px sans-serif`;
        ctx.fillText(ok ? end.title : '？？？', cardX + cardW / 2, y + 44);
        if (ok) {
          ctx.fillStyle = uiTheme.colors.textSub;
          ctx.font = `${uiTheme.font.small}px sans-serif`;
          const descLines = this.splitWrappedLines(end.description || '', cardW - 24, 2);
          const descStartY = y + 64;
          descLines.forEach((line, idx) => {
            ctx.fillText(line, cardX + cardW / 2, descStartY + idx * 15);
          });
          this.galleryEndingHitAreas.push({
            ending: end,
            x: cardX + 8,
            y: y + 6,
            w: cardW - 16,
            h: rowH - 12,
          });
        } else {
          ctx.fillStyle = uiTheme.colors.textSub;
          ctx.font = `${uiTheme.font.small}px sans-serif`;
          const hintLines = this.splitWrappedLines('达成对应条件后将在此显示简介', cardW - 24, 2);
          const hintStartY = y + 64;
          hintLines.forEach((line, idx) => {
            ctx.fillText(line, cardX + cardW / 2, hintStartY + idx * 15);
          });
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
      y += rowH + 8;
    });
    ctx.restore();
    const totalH = y - listTop + this.galleryScroll;
    const maxScroll = Math.max(0, totalH - (listBottom - listTop));
    this._galleryScrollMax = maxScroll;
    this.galleryScroll = Math.min(this.galleryScroll, maxScroll);
    this.drawScrollIndicator(listTop, listBottom - listTop, this.galleryScroll, maxScroll);

    this.buttons.push({
      x: 16,
      y: backBtnY,
      w: SCREEN_WIDTH - 32,
      h: 42,
      label: '返回',
      variant: 'secondary',
      disabled: false,
      onClick: () => {
        this.goScene('menu');
      },
    });
  }

  renderAchievements() {
    this.drawSceneBackground();
    const light = this.themeMode === 'light';
    drawSceneKicker(ctx, 15, SAFE_TOP + 5, 'MILESTONES', light ? COLORS.coralDeep : COLORS.gold);
    ctx.fillStyle = light ? COLORS.paperInk : COLORS.ink;
    ctx.font = font(26, 730);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('四年印记', 15, SAFE_TOP + 18);
    ctx.fillStyle = light ? 'rgba(38,48,65,0.56)' : COLORS.inkMuted;
    ctx.font = font(10.5, 450);
    ctx.fillText('不是任务清单，是你真的做过的事。', 15, SAFE_TOP + 51);

    const meta = save.loadMeta();
    const got = meta.achievements || {};
    const achievementOrder = new Map();
    const acOrderList = Array.isArray(meta.achievementUnlockOrder) ? meta.achievementUnlockOrder : [];
    acOrderList.forEach((it, idx) => {
      const id = String(it.id || '');
      if (!id) return;
      const ts = Number(it.ts || idx + 1);
      achievementOrder.set(id, ts);
    });
    Object.keys(got).forEach((id, idx) => {
      if (!achievementOrder.has(id)) achievementOrder.set(id, idx + 1);
    });
    const sortedAchievements = [...achievementsCatalog].sort((a, b) => {
      const aUnlocked = !!got[a.id];
      const bUnlocked = !!got[b.id];
      if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1;
      if (aUnlocked && bUnlocked) {
        const at = Number(achievementOrder.get(a.id) || 0);
        const bt = Number(achievementOrder.get(b.id) || 0);
        if (at !== bt) return bt - at;
      }
      return 0;
    });
    ctx.textAlign = 'left';
    const listTop = SAFE_TOP + 72;
    const backBtnY = SCREEN_HEIGHT - SAFE_BOTTOM - 42;
    const listBottom = backBtnY - 8;
    let y = listTop - this.achievementScroll;
    this.achievementHitAreas = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listTop, SCREEN_WIDTH, listBottom - listTop);
    ctx.clip();
    sortedAchievements.forEach((a) => {
      const ok = !!got[a.id];
      const rowH = 102;
      if (y < listBottom + rowH && y > listTop - rowH) {
        const cardX = 16;
        const cardW = SCREEN_WIDTH - 32;
        ctx.fillStyle = ok
          ? (light ? 'rgba(244,250,245,0.9)' : 'rgba(31,54,49,0.88)')
          : (light ? 'rgba(255,255,255,0.54)' : 'rgba(15,24,38,0.82)');
        this.fillRoundRect(cardX, y, cardW, rowH, 10);
        ctx.strokeStyle = ok ? 'rgba(115,214,127,0.55)' : 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1.2;
        this.strokeRoundRect(cardX, y, cardW, rowH, 10);

        const tagX = cardX + 10;
        const tagY = y + 10;
        const tagW = 54;
        const tagH = 20;
        ctx.fillStyle = ok ? 'rgba(115,214,127,0.2)' : 'rgba(255,255,255,0.14)';
        this.fillRoundRect(tagX, tagY, tagW, tagH, 6);
        ctx.fillStyle = ok ? uiTheme.colors.good : uiTheme.colors.buttonDisabled;
        ctx.font = `bold ${uiTheme.font.small}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ok ? '已达成' : '未达成', tagX + tagW / 2, tagY + tagH / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = ok ? uiTheme.colors.textMain : uiTheme.colors.buttonDisabled;
        ctx.font = `bold ${uiTheme.font.body}px sans-serif`;
        ctx.fillText(ok ? a.title : '？？？', cardX + cardW / 2, y + 44);
        ctx.fillStyle = uiTheme.colors.textSub;
        ctx.font = `${uiTheme.font.small}px sans-serif`;
        const conditionText = this.getAchievementConditionText(a);
        if (ok) {
          const detailText = String(a.description || '已达成这条成就');
          const detailLines = this.splitWrappedLines(detailText, cardW - 24, 2);
          const detailStartY = y + 68;
          detailLines.forEach((line, idx) => {
            ctx.fillText(line, cardX + cardW / 2, detailStartY + idx * 16);
          });
        } else {
          ctx.fillStyle = uiTheme.colors.textSub;
          ctx.font = `${Math.max(10, uiTheme.font.small - 1)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const condLines = this.splitWrappedLines(`达成条件：${conditionText}`, cardW - 24, 2);
          const condStartY = y + 66;
          condLines.forEach((line, idx) => {
            ctx.fillText(line, cardX + cardW / 2, condStartY + idx * 14);
          });
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        if (ok) {
          this.achievementHitAreas.push({
            achievement: a,
            x: cardX + 6,
            y: y + 6,
            w: cardW - 12,
            h: rowH - 12,
          });
        }
      }
      y += rowH + 8;
    });
    ctx.restore();
    const maxScroll = Math.max(0, y - listBottom);
    this._achievementScrollMax = maxScroll;
    this.achievementScroll = Math.min(this.achievementScroll, maxScroll);
    this.drawScrollIndicator(listTop, listBottom - listTop, this.achievementScroll, maxScroll);

    this.buttons = [{ x: 16, y: backBtnY, w: SCREEN_WIDTH - 32, h: 42, label: '返回', variant: 'secondary', disabled: false, onClick: () => { this.goScene('menu'); } }];
  }

  startCgPlayback(cg, fromScene = 'cg_gallery', options = {}) {
    if (!cg) return;
    this.cgPlayback = {
      cgId: cg.id,
      title: cg.title || '',
      description: cg.description || '',
      fromScene,
      unlockOnClose: !!options.unlockOnClose,
    };
    this.goScene('cg_playback', { clearPending: true });
  }

  renderCgGallery() {
    this.drawSceneBackground();
    const light = this.themeMode === 'light';
    const meta = save.loadMeta();
    const unlocked = new Set(meta.unlockedCgs || []);
    drawSceneKicker(ctx, 15, SAFE_TOP + 5, 'MOMENTS', light ? COLORS.coralDeep : COLORS.gold);
    ctx.fillStyle = light ? COLORS.paperInk : COLORS.ink;
    ctx.font = font(26, 730);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('校园影像', 15, SAFE_TOP + 18);
    ctx.fillStyle = light ? 'rgba(38,48,65,0.56)' : COLORS.inkMuted;
    ctx.font = font(10.5, 450);
    ctx.fillText(`已收录 ${unlocked.size} / ${CG_CATALOG.length} 个瞬间`, 15, SAFE_TOP + 51);

    const order = new Map();
    (meta.cgUnlockOrder || []).forEach((item, index) => {
      if (!item || !item.id) return;
      order.set(String(item.id), Number(item.ts || index + 1));
    });
    (meta.unlockedCgs || []).forEach((id, index) => {
      if (!order.has(id)) order.set(id, index + 1);
    });
    const sorted = [...CG_CATALOG].sort((a, b) => {
      const ao = unlocked.has(a.id);
      const bo = unlocked.has(b.id);
      if (ao !== bo) return ao ? -1 : 1;
      if (ao && bo) return Number(order.get(b.id) || 0) - Number(order.get(a.id) || 0);
      return 0;
    });

    const listTop = SAFE_TOP + 72;
    const backY = SCREEN_HEIGHT - SAFE_BOTTOM - 42;
    const listBottom = backY - 10;
    const cardX = 15;
    const cardW = SCREEN_WIDTH - 30;
    const rowH = 96;
    const gap = 9;
    let y = listTop - this.cgScroll;
    this.cgHitAreas = [];
    this.buttons = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listTop, SCREEN_WIDTH, listBottom - listTop);
    ctx.clip();
    sorted.forEach((cg) => {
      const ok = unlocked.has(cg.id);
      const image = this.assets[cg.id];
      if (y >= listTop && y + rowH <= listBottom) {
        fillRoundRect(
          ctx,
          cardX,
          y,
          cardW,
          rowH,
          17,
          ok ? 'rgba(27,38,55,0.88)' : 'rgba(18,26,40,0.72)',
        );
        strokeRoundRect(
          ctx,
          cardX + 0.5,
          y + 0.5,
          cardW - 1,
          rowH - 1,
          17,
          ok ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)',
        );
        const imageX = cardX + 8;
        const imageY = y + 8;
        const imageW = 82;
        const imageH = rowH - 16;
        ctx.save();
        roundRectPath(ctx, imageX, imageY, imageW, imageH, 12);
        ctx.clip();
        if (ok && image && image.__ready && !image.__failed) {
          const iw = image.width || imageW;
          const ih = image.height || imageH;
          const scale = Math.max(imageW / iw, imageH / ih);
          const sw = imageW / scale;
          const sh = imageH / scale;
          ctx.drawImage(image, (iw - sw) / 2, (ih - sh) / 2, sw, sh, imageX, imageY, imageW, imageH);
        } else {
          const ph = ctx.createLinearGradient(imageX, imageY, imageX + imageW, imageY + imageH);
          ph.addColorStop(0, ok ? '#556A70' : '#263446');
          ph.addColorStop(1, ok ? '#9E8268' : '#141E2D');
          ctx.fillStyle = ph;
          ctx.fillRect(imageX, imageY, imageW, imageH);
          drawIcon(ctx, 'image', imageX + 27, imageY + 24, 28, ok ? COLORS.paper : COLORS.inkFaint);
        }
        ctx.restore();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = ok ? COLORS.ink : COLORS.inkFaint;
        ctx.font = font(15, 650);
        ctx.fillText(this.fitText(ok ? cg.title : '未收录的瞬间', cardW - 132), imageX + imageW + 14, y + 17);
        ctx.fillStyle = ok ? COLORS.inkMuted : COLORS.inkFaint;
        ctx.font = font(10.5, 430);
        const description = ok ? (cg.description || '已收录') : '继续经历校园事件，会遇见这里的画面。';
        const lines = this.splitWrappedLines(description, cardW - 132, 2);
        lines.forEach((line, index) => {
          ctx.fillText(line, imageX + imageW + 14, y + 43 + index * 16);
        });
        if (ok) {
          drawChevron(ctx, cardX + cardW - 14, y + rowH / 2, 13, COLORS.inkFaint, 'right');
          this.cgHitAreas.push({ cg, x: cardX + 4, y: y + 4, w: cardW - 8, h: rowH - 8 });
        }
      }
      y += rowH + gap;
    });
    ctx.restore();
    const maxScroll = Math.max(0, y - listBottom);
    this._cgScrollMax = maxScroll;
    this.cgScroll = clamp(this.cgScroll, 0, maxScroll);
    this.drawScrollIndicator(listTop, listBottom - listTop, this.cgScroll, maxScroll);
    this.buttons.push({
      id: 'cg_gallery_back',
      x: 15,
      y: backY,
      w: SCREEN_WIDTH - 30,
      h: 42,
      label: '返回',
      variant: 'secondary',
      disabled: false,
      onClick: () => this.goScene('menu'),
    });
  }


  renderCgPlayback() {
    const cp = this.cgPlayback;
    if (!cp) {
      this.goScene('cg_gallery', { clearPending: true });
      return;
    }
    const cg = CG_CATALOG.find((x) => x.id === cp.cgId);
    this.drawSceneBackground();
    const light = this.themeMode === 'light';
    drawSceneKicker(ctx, 15, SAFE_TOP + 5, 'MOMENT', light ? COLORS.coralDeep : COLORS.gold);
    ctx.fillStyle = light ? COLORS.paperInk : COLORS.ink;
    ctx.font = font(24, 720);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.fitText(cp.title || cg?.title || '校园影像', SCREEN_WIDTH - 30), 15, SAFE_TOP + 18);
    const cardX = 15;
    const cardY = SAFE_TOP + 61;
    const cardW = SCREEN_WIDTH - 30;
    const cardH = 258;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    this.fillRoundRect(cardX, cardY, cardW, cardH, 10);
    const img = this.assets[cp.cgId];
    if (img && img.__ready && !img.__failed) {
      const pad = 8;
      const boxW = cardW - pad * 2;
      const boxH = cardH - pad * 2;
      const boxX = cardX + pad;
      const boxY = cardY + pad;
      const iw = img.width || boxW;
      const ih = img.height || boxH;
      const scale = Math.min(boxW / iw, boxH / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = boxX + (boxW - dw) / 2;
      const dy = boxY + (boxH - dh) / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      const fallback = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
      fallback.addColorStop(0, '#273B48');
      fallback.addColorStop(1, '#9B7764');
      fillRoundRect(ctx, cardX + 8, cardY + 8, cardW - 16, cardH - 16, 13, fallback);
      drawIcon(ctx, 'image', SCREEN_WIDTH / 2 - 22, cardY + cardH / 2 - 38, 44, COLORS.paper);
      ctx.fillStyle = COLORS.paper;
      ctx.font = font(12, 550);
      ctx.textAlign = 'center';
      ctx.fillText('这一帧还在路上', SCREEN_WIDTH / 2, cardY + cardH / 2 + 18);
    }
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    this.wrapText(cp.description || cg?.description || '', cardX + 10, cardY + cardH + 12, cardW - 20, 18, 4);
    this.buttons = [{
      x: 15,
      y: SCREEN_HEIGHT - SAFE_BOTTOM - 50,
      w: SCREEN_WIDTH - 30,
      h: 50,
      label: '返回',
      variant: 'primary',
      disabled: false,
      onClick: () => this.finishCgPlayback(),
    }];
  }

  playBgmFromGallery(bgm) {
    if (!bgm || !bgm.trackKey || !this.bgm) return;
    this.bgm.playBgm(bgm.trackKey, true);
  }

  renderBgmGallery() {
    this.drawSceneBackground();
    const light = this.themeMode === 'light';
    drawSceneKicker(ctx, 15, SAFE_TOP + 5, 'SOUNDTRACK', light ? COLORS.coralDeep : COLORS.gold);
    ctx.fillStyle = light ? COLORS.paperInk : COLORS.ink;
    ctx.font = font(26, 730);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('校园原声', 15, SAFE_TOP + 18);
    ctx.fillStyle = light ? 'rgba(38,48,65,0.56)' : COLORS.inkMuted;
    ctx.font = font(10.5, 450);
    ctx.fillText('点开已收录的曲目，可以再听一遍。', 15, SAFE_TOP + 51);
    const meta = save.loadMeta();
    const unlocked = new Set(meta.unlockedBgms || []);
    const playingKey = this.bgm && this.bgm.currentBgmName ? this.bgm.currentBgmName : '';
    this.bgmHitAreas = [];
    let y = SAFE_TOP + 76;
    BGM_CATALOG.forEach((bgm) => {
      const ok = unlocked.has(bgm.id);
      const isPlaying = ok && playingKey === bgm.trackKey;
      const cardX = 16;
      const cardW = SCREEN_WIDTH - 32;
      const rowH = 84;
      ctx.fillStyle = isPlaying
        ? (light ? 'rgba(233,105,77,0.13)' : 'rgba(255,200,80,0.28)')
        : ok
          ? (light ? 'rgba(252,249,242,0.88)' : 'rgba(255,220,140,0.14)')
          : (light ? 'rgba(255,255,255,0.52)' : 'rgba(255,255,255,0.06)');
      this.fillRoundRect(cardX, y, cardW, rowH, 10);
      ctx.strokeStyle = isPlaying
        ? 'rgba(255,200,80,0.85)'
        : ok
          ? 'rgba(255,220,140,0.55)'
          : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = isPlaying ? 2 : 1.2;
      this.strokeRoundRect(cardX, y, cardW, rowH, 10);
      ctx.fillStyle = ok ? (light ? COLORS.paperInk : COLORS.ink) : COLORS.inkFaint;
      ctx.font = `bold ${uiTheme.font.body}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(ok ? bgm.title : '？？？', cardX + 12, y + 16);
      if (ok) {
        ctx.fillStyle = isPlaying
          ? (light ? COLORS.coralDeep : 'rgba(255,220,140,0.95)')
          : (light ? 'rgba(38,48,65,0.56)' : COLORS.inkMuted);
        ctx.font = `${uiTheme.font.small}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(isPlaying ? '播放中' : '点击播放', cardX + cardW - 12, y + 18);
      }
      ctx.fillStyle = light ? 'rgba(38,48,65,0.58)' : COLORS.inkMuted;
      ctx.font = `${uiTheme.font.small}px sans-serif`;
      ctx.textAlign = 'left';
      const line = ok ? (bgm.hint || '校园原声') : (bgm.hint || '进入相关场景后收录');
      this.wrapText(line, cardX + 12, y + 40, cardW - 24, 16, 2);
      if (ok) this.bgmHitAreas.push({ bgm, x: cardX + 6, y: y + 6, w: cardW - 12, h: rowH - 12 });
      y += rowH + 10;
    });
    this.buttons = [{
      x: 16,
      y: SCREEN_HEIGHT - SAFE_BOTTOM - 42,
      w: SCREEN_WIDTH - 32,
      h: 42,
      label: '返回',
      variant: 'secondary',
      disabled: false,
      onClick: () => this.goScene('menu'),
    }];
  }

  renderCredits() {
    this.drawSceneBackground();
    const light = this.themeMode === 'light';
    drawSceneKicker(ctx, 15, SAFE_TOP + 5, 'THANKS', light ? COLORS.coralDeep : COLORS.gold);
    ctx.fillStyle = light ? COLORS.paperInk : COLORS.ink;
    ctx.font = font(26, 730);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('一起完成这本日记', 15, SAFE_TOP + 18);
    ctx.fillStyle = light ? 'rgba(38,48,65,0.56)' : COLORS.inkMuted;
    ctx.font = font(10.5, 450);
    ctx.fillText(CREDITS_ACK.intro, 15, SAFE_TOP + 51);

    const listTop = SAFE_TOP + 72;
    const backBtnY = SCREEN_HEIGHT - SAFE_BOTTOM - 42;
    const listBottom = backBtnY - 8;
    const cardX = 16;
    const cardW = SCREEN_WIDTH - 32;
    const rowH = 44;
    let y = listTop - this.creditsScroll;

    this.buttons = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listTop, SCREEN_WIDTH, listBottom - listTop);
    ctx.clip();
    CREDITS_ACK.names.forEach((name, idx) => {
      if (y < listBottom + rowH && y > listTop - rowH) {
        ctx.fillStyle = 'rgba(255,220,140,0.12)';
        this.fillRoundRect(cardX, y, cardW, rowH, 10);
        ctx.strokeStyle = 'rgba(255,220,140,0.45)';
        ctx.lineWidth = 1.2;
        this.strokeRoundRect(cardX, y, cardW, rowH, 10);
        ctx.fillStyle = uiTheme.colors.textMain;
        ctx.font = `${uiTheme.font.body}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(`${idx + 1}. ${name}`, cardX + 14, y + 14);
      }
      y += rowH + 8;
    });
    ctx.restore();

    const maxScroll = Math.max(0, y - listBottom);
    this._creditsScrollMax = maxScroll;
    this.creditsScroll = Math.min(this.creditsScroll, maxScroll);
    this.drawScrollIndicator(listTop, listBottom - listTop, this.creditsScroll, maxScroll);

    this.buttons.push({
      id: 'credits_back',
      x: 16,
      y: backBtnY,
      w: SCREEN_WIDTH - 32,
      h: 42,
      label: '返回',
      variant: 'secondary',
      disabled: false,
      onClick: () => this.goScene('menu'),
    });
  }

  renderSettings() {
    this.drawSceneBackground();
    const light = this.themeMode === 'light';
    const titleInk = light ? COLORS.paperInk : COLORS.ink;
    const pad = 14;
    const w = SCREEN_WIDTH - pad * 2;
    const compact = SCREEN_HEIGHT < 720;
    const veryCompact = SCREEN_HEIGHT < 620;
    const bottomSafe = SCREEN_HEIGHT - SAFE_BOTTOM;
    this.buttons = [];

    drawSceneKicker(ctx, pad, SAFE_TOP + 5, 'SETTINGS', light ? COLORS.coralDeep : COLORS.gold);
    ctx.fillStyle = titleInk;
    ctx.font = font(26, 730);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('合你心意的节奏', pad, SAFE_TOP + 18);
    ctx.fillStyle = light ? 'rgba(38,48,65,0.56)' : COLORS.inkMuted;
    ctx.font = font(10.5, 450);
    ctx.fillText('声音、显示与本地数据。', pad, SAFE_TOP + 51);

    let y = SAFE_TOP + (veryCompact ? 62 : 72);
    const soundH = veryCompact ? 112 : (compact ? 158 : 174);
    drawGlassPanel(ctx, pad, y, w, soundH, { radius: 20, strong: true });
    drawIcon(ctx, 'music', pad + 14, y + 14, 20, COLORS.gold);
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(14, 650);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('声音', pad + 42, y + 15);
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.inkMuted;
    ctx.font = font(11, 500);
    ctx.fillText(this.bgm.muted ? '已静音' : `${Math.round(this.bgm.volume * 100)}%`, pad + w - 14, y + 16);

    const halfGap = 8;
    const halfW = (w - 28 - halfGap) / 2;
    const soundBtnH = veryCompact ? 30 : 38;
    const soundBtnY = y + (veryCompact ? 41 : 45);
    const muteY = y + (veryCompact ? 77 : 92);
    this.buttons.push({
      id: 'settings_volume_down',
      x: pad + 14,
      y: soundBtnY,
      w: halfW,
      h: soundBtnH,
      label: '音量 −',
      variant: 'secondary',
      disabled: false,
      onClick: () => this.setBgmVolume(this.bgm.volume - 0.1),
    });
    this.buttons.push({
      id: 'settings_volume_up',
      x: pad + 14 + halfW + halfGap,
      y: soundBtnY,
      w: halfW,
      h: soundBtnH,
      label: '音量 +',
      variant: 'secondary',
      disabled: false,
      onClick: () => this.setBgmVolume(this.bgm.volume + 0.1),
    });
    this.buttons.push({
      id: 'settings_toggle_mute',
      x: pad + 14,
      y: muteY,
      w: w - 28,
      h: soundBtnH,
      label: this.bgm.muted ? '恢复声音' : '暂时静音',
      variant: 'ghost',
      textColor: COLORS.ink,
      disabled: false,
      onClick: () => {
        const muted = this.bgm.toggleMute();
        save.saveAudioPrefs({ muted, volume: this.bgm.volume });
      },
    });
    if (!compact) {
      const progressX = pad + 14;
      const progressY = y + 145;
      const progressW = w - 28;
      fillRoundRect(ctx, progressX, progressY, progressW, 3, 1.5, 'rgba(255,255,255,0.09)');
      fillRoundRect(ctx, progressX, progressY, Math.max(2, progressW * this.bgm.volume), 3, 1.5, COLORS.gold);
    }
    y += soundH + (veryCompact ? 5 : 11);

    const appearanceH = veryCompact ? 60 : (compact ? 68 : 76);
    drawGlassPanel(ctx, pad, y, w, appearanceH, { radius: 19, strong: true });
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(13, 650);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('显示', pad + 14, y + (veryCompact ? 14 : 20));
    ctx.fillStyle = COLORS.inkMuted;
    ctx.font = font(10.5, 450);
    ctx.fillText(
      this.themeMode === 'light' ? '浅色纸张' : '夜间校园',
      pad + 52,
      y + (veryCompact ? 14 : 20),
    );
    this.buttons.push({
      id: 'settings_toggle_theme',
      x: pad + 14,
      y: y + (veryCompact ? 27 : 34),
      w: w - 28,
      h: appearanceH - (veryCompact ? 32 : 43),
      label: this.themeMode === 'light' ? '切换为夜间模式' : '切换为浅色模式',
      variant: 'ghost',
      textColor: COLORS.ink,
      disabled: false,
      onClick: () => {
        this.setThemeMode(this.themeMode === 'light' ? 'dark' : 'light');
        this.sceneEnteredAt = Date.now();
      },
    });
    y += appearanceH + (veryCompact ? 5 : 11);

    const shareH = veryCompact ? 59 : (compact ? 62 : 70);
    drawGlassPanel(ctx, pad, y, w, shareH, { radius: 19, strong: true });
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(13, 650);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('分享', pad + 14, y + (veryCompact ? 14 : 20));
    ctx.fillStyle = COLORS.inkMuted;
    ctx.font = font(10.5, 450);
    ctx.fillText(
      '把这一局校园故事发给朋友',
      pad + 52,
      y + (veryCompact ? 14 : 20),
    );
    if (wx.shareAppMessage) {
      this.buttons.push({
        id: 'settings_share',
        x: pad + 14,
        y: y + (veryCompact ? 27 : 32),
        w: w - 28,
        h: shareH - (veryCompact ? 32 : 41),
        label: '转发给朋友',
        variant: 'ghost',
        textColor: COLORS.ink,
        disabled: false,
        onClick: () => {
          wx.shareAppMessage({ title: '本科生的四年日记' });
        },
      });
    }
    y += shareH + (veryCompact ? 5 : 11);

    const dataH = veryCompact ? 63 : (compact ? 74 : 82);
    drawGlassPanel(ctx, pad, y, w, dataH, { radius: 19, strong: true });
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(13, 650);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('本地数据', pad + 14, y + (veryCompact ? 14 : 20));
    ctx.fillStyle = COLORS.inkMuted;
    ctx.font = font(10, 450);
    ctx.fillText(
      '进度与收藏只保存在这台设备',
      pad + 76,
      y + (veryCompact ? 14 : 20),
    );
    this.buttons.push({
      id: 'settings_clear_cache',
      x: pad + 14,
      y: y + (veryCompact ? 29 : 34),
      w: w - 28,
      h: dataH - (veryCompact ? 35 : 43),
      label: '清除全部记录',
      variant: 'danger',
      disabled: false,
      onClick: () => this.confirmClearCache(),
    });

    this.buttons.push({
      id: 'settings_back',
      x: pad,
      y: bottomSafe - (veryCompact ? 46 : 50),
      w,
      h: veryCompact ? 46 : 50,
      label: '返回',
      variant: 'secondary',
      disabled: false,
      onClick: () => { this.goScene('menu'); },
    });
  }


  confirmClearCache() {
    wx.showModal({
      title: '确认清除缓存',
      content: '这将删除所有游戏进度、成就、解锁内容，恢复到刚注册小程序时的状态。此操作不可撤销，确定要继续吗？',
      success: (res) => {
        if (res.confirm) {
          this.clearAllData();
        }
      }
    });
  }

  clearAllData() {
    // 清除所有保存的数据
    wx.clearStorageSync();
    
    // 重置游戏状态
    this.run = null;
    this.scene = 'menu';
    this.currentEnding = null;
    this.runSettlement = null;
    this.pendingTransition = null;
    this.themeMode = 'dark';
    this.applyTheme('dark');
    
    // 重置天赋系统
    this.availableTalents = [];
    this.selectedTalent = null;
    this.talentTierFilter = 'all';
    this.talentRerolls = 2;
    
    // 重置固定状态描述
    this.fixedFunnyStatus = null;
    this.lastStatsHash = null;
    
    // 重置选项描述
    this.fixedActionDescriptions.clear();
    this.fixedEventDescriptions.clear();
    
    this.tempProfile.gender = 'male';
    this.tempAvatarAssetId = MALE_AVATAR_IDS[0];
    this.pickRandomNameByGender('male');
    this.pickRandomAvatarByGender('male');
    
    // 显示提示
    this.showToast('缓存已清除，游戏已重置');
    
    // 返回主菜单
    this.goScene('menu');
  }

  renderInventory() {
    if (!this.run) {
      this.returnScene = null;
      this.goScene('menu', { clearPending: false });
      return;
    }
    this.drawSceneBackground();
    const light = this.themeMode === 'light';
    const inventory = Array.isArray(this.run.inventory) ? this.run.inventory : [];
    drawSceneKicker(ctx, 15, SAFE_TOP + 5, 'POCKET', light ? COLORS.coralDeep : COLORS.gold);
    ctx.fillStyle = light ? COLORS.paperInk : COLORS.ink;
    ctx.font = font(25, 730);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('随身物品', 15, SAFE_TOP + 18);
    ctx.fillStyle = light ? 'rgba(38,48,65,0.56)' : COLORS.inkMuted;
    ctx.font = font(10.5, 450);
    ctx.fillText(`背包里有 ${inventory.length} 件物品`, 15, SAFE_TOP + 51);

    const listTop = SAFE_TOP + 72;
    const backY = SCREEN_HEIGHT - SAFE_BOTTOM - 42;
    const listBottom = backY - 10;
    const cardX = 15;
    const cardW = SCREEN_WIDTH - 30;
    const rowH = 76;
    const gap = 8;
    this.buttons = [];
    this.inventoryScroll = this.inventoryScroll || 0;
    let y = listTop - this.inventoryScroll;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listTop, SCREEN_WIDTH, listBottom - listTop);
    ctx.clip();
    inventory.forEach((itemId, index) => {
      const item = itemsCatalog.find((entry) => entry.id === itemId);
      if (!item) return;
      if (y >= listTop && y + rowH <= listBottom) {
        drawGlassPanel(ctx, cardX, y, cardW, rowH, { radius: 17, strong: true, shadow: false });
        fillRoundRect(ctx, cardX + 10, y + 11, 46, 46, 13, 'rgba(235,199,121,0.1)');
        drawIcon(ctx, 'bag', cardX + 22, y + 23, 22, COLORS.gold);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = COLORS.ink;
        ctx.font = font(14, 650);
        ctx.fillText(this.fitText(item.name, cardW - 130), cardX + 69, y + 13);
        ctx.fillStyle = COLORS.inkMuted;
        ctx.font = font(10.5, 430);
        this.wrapText(item.description || '一件会用得上的校园物品', cardX + 69, y + 36, cardW - 136, 15, 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = light ? COLORS.coralDeep : COLORS.gold;
        ctx.font = font(10, 650);
        ctx.fillText('使用', cardX + cardW - 14, y + rowH / 2);
        this.buttons.push({
          id: `inventory_item_${index}`,
          x: cardX,
          y,
          w: cardW,
          h: rowH,
          label: item.name,
          invisible: true,
          disabled: false,
          onClick: () => this.handleUseItem(index),
        });
      }
      y += rowH + gap;
    });
    if (!inventory.length) {
      drawGlassPanel(ctx, cardX, listTop, cardW, 132, { radius: 19, strong: true, shadow: false });
      drawIcon(ctx, 'bag', SCREEN_WIDTH / 2 - 15, listTop + 25, 30, COLORS.inkFaint);
      ctx.fillStyle = COLORS.inkMuted;
      ctx.font = font(12, 500);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('背包还是空的', SCREEN_WIDTH / 2, listTop + 70);
      ctx.fillStyle = COLORS.inkFaint;
      ctx.font = font(10, 430);
      ctx.fillText('完成事件和校园日常时，可能会收到小物件。', SCREEN_WIDTH / 2, listTop + 94);
      y = listTop + 132;
    }
    ctx.restore();
    const maxScroll = Math.max(0, y - listBottom);
    this._inventoryScrollMax = maxScroll;
    this.inventoryScroll = clamp(this.inventoryScroll, 0, maxScroll);
    this.drawScrollIndicator(listTop, listBottom - listTop, this.inventoryScroll, maxScroll);
    this.buttons.push({
      id: 'inventory_back',
      x: 15,
      y: backY,
      w: SCREEN_WIDTH - 30,
      h: 42,
      label: '返回',
      variant: 'secondary',
      disabled: false,
      onClick: () => this.goScene(this.popReturnScene(), { clearPending: false }),
    });
  }


  renderRunLog() {
    if (!this.run) {
      this.returnScene = null;
      this.goScene('menu', { clearPending: false });
      return;
    }
    this.drawSceneBackground();
    const light = this.themeMode === 'light';
    drawSceneKicker(ctx, 15, SAFE_TOP + 5, 'JOURNAL', light ? COLORS.coralDeep : COLORS.gold);
    ctx.fillStyle = light ? COLORS.paperInk : COLORS.ink;
    ctx.font = font(25, 730);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('这一局，走过这里', 15, SAFE_TOP + 18);
    ctx.fillStyle = light ? 'rgba(38,48,65,0.56)' : COLORS.inkMuted;
    ctx.font = font(10.5, 450);
    ctx.fillText('选择与结果按时间倒序排列。', 15, SAFE_TOP + 51);

    const log = Array.isArray(this.run.log) ? [...this.run.log] : [];
    log.sort((a, b) => {
      const sa = Number(a.semesterIndex || 0);
      const sb = Number(b.semesterIndex || 0);
      if (sa !== sb) return sb - sa;
      const wa = Number(a.weekIndex || 0);
      const wb = Number(b.weekIndex || 0);
      if (wa !== wb) return wb - wa;
      return 0;
    });
    this.buttons = [];
    const lineH = 18;
    const listTop = SAFE_TOP + 72;
    const backY = SCREEN_HEIGHT - SAFE_BOTTOM - 42;
    const listBottom = backY - 10;
    this._runLogScrollUi = { listTop, listBottom };
    fillRoundRect(
      ctx,
      10,
      listTop - 8,
      SCREEN_WIDTH - 20,
      listBottom - listTop + 16,
      18,
      light ? 'rgba(252,249,242,0.9)' : 'rgba(17,26,41,0.88)',
    );
    strokeRoundRect(
      ctx,
      10.5,
      listTop - 7.5,
      SCREEN_WIDTH - 21,
      listBottom - listTop + 15,
      18,
      light ? 'rgba(38,48,65,0.12)' : 'rgba(255,255,255,0.1)',
    );
    let penY = listTop - this.runLogScroll;
    let currentSemester = null;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listTop, SCREEN_WIDTH, listBottom - listTop);
    ctx.clip();
    log.forEach((entry) => {
      const semNo = Number(entry.semesterIndex || 0) + 1;
      if (currentSemester !== semNo) {
        currentSemester = semNo;
        ctx.fillStyle = uiTheme.colors.accent || uiTheme.colors.textMain;
        ctx.font = `bold ${uiTheme.font.body}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`第 ${semNo} 学期`, 16, penY);
        penY += lineH + 2;
      }
      const tlabel = this.formatLogTimeLabel(entry.semesterIndex, entry.weekIndex, entry.phase);
      const title = this.resolveLogEventTitle(entry);
      const choice = entry.choiceText || '';
      const same = title && choice && title === choice;
      const headLine = same ? title : `${title}${choice ? ` · ${choice}` : ''}`;
      const fxLine = this.formatLogEffectsLine(entry.effects);
      const nar = entry.outcomeNarrative ? `> ${String(entry.outcomeNarrative)}` : '';
      ctx.fillStyle = uiTheme.colors.textMain;
      ctx.font = `${uiTheme.font.small}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(this.fitText(tlabel, SCREEN_WIDTH - 40), 16, penY);
      penY += lineH;
      ctx.fillStyle = uiTheme.colors.textSub;
      penY = this.wrapText(this.fitText(headLine, SCREEN_WIDTH - 44), 16, penY, SCREEN_WIDTH - 44, 17, 3);
      if (fxLine) {
        ctx.fillStyle = uiTheme.colors.good;
        penY = this.wrapText(fxLine, 16, penY + 2, SCREEN_WIDTH - 44, 16, 2);
      }
      if (nar) {
        ctx.fillStyle = uiTheme.colors.textSub;
        penY = this.wrapText(nar, 16, penY + 4, SCREEN_WIDTH - 44, 16, 4);
      }
      penY += 12;
    });

    if (!log.length) {
      ctx.fillStyle = uiTheme.colors.textSub;
      ctx.font = `${uiTheme.font.body}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('暂无记录', SCREEN_WIDTH / 2, listTop + 40);
    }
    ctx.restore();

    const totalH = penY - listTop + this.runLogScroll;
    const maxScroll = Math.max(0, totalH - (listBottom - listTop));
    this._runLogScrollMax = maxScroll;
    this.runLogScroll = Math.min(this.runLogScroll, maxScroll);
    this.drawScrollIndicator(listTop, listBottom - listTop, this.runLogScroll, maxScroll);

    this.buttons.push({
      id: 'run_log_back',
      x: 16,
      y: backY,
      w: SCREEN_WIDTH - 32,
      h: 42,
      label: '返回',
      variant: 'secondary',
      disabled: false,
      onClick: () => this.goScene(this.popReturnScene(), { clearPending: false }),
    });
  }

  render() {
    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    if (this.lastRenderedScene !== this.scene) {
      this.bgm.play(this.scene);
      this.lastRenderedScene = this.scene;
    }
    this.buttons = [];
    switch (this.scene) {
      case 'menu': this.renderMenu(); break;
      case 'create_role': this.renderCreateRole(); break;
      case 'school': this.renderSchool(); break;
      case 'major': this.renderMajor(); break;
      case 'play': this.renderPlay(); break;
      case 'ending': this.renderEnding(); break;
      case 'gallery': this.renderGallery(); break;
      case 'achievements': this.renderAchievements(); break;
      case 'cg_gallery': this.renderCgGallery(); break;
      case 'cg_playback': this.renderCgPlayback(); break;
      case 'bgm_gallery': this.renderBgmGallery(); break;
      case 'credits': this.renderCredits(); break;
      case 'settings': this.renderSettings(); break;
      case 'inventory': this.renderInventory(); break;
      case 'run_log': this.renderRunLog(); break;
      case 'relations': this.renderRelations(); break;
      case 'ending_playback': this.renderEndingPlayback(); break;
      case 'achievement_playback': this.renderAchievementPlayback(); break;
      default: this.goScene('menu', { clearPending: false }); this.renderMenu();
    }
    this.buttons.forEach((b, index) => {
      if (!b.id) b.id = `${this.scene}_button_${index}`;
      this.drawButton(b);
    });
    if (this.toast && Date.now() < this.toast.until) {
      const toastChrome = this.scene === 'play' ? (this._playChrome || this.getPlaySceneChrome()) : null;
      const toastY = toastChrome ? toastChrome.statsTop - 44 : SCREEN_HEIGHT - 220;
      const age = clamp((Date.now() - Number(this.toast.started || Date.now())) / 180, 0, 1);
      const enter = easeOutCubic(age);
      ctx.save();
      ctx.globalAlpha = enter;
      ctx.font = font(12, 500);
      const toastW = Math.min(SCREEN_WIDTH - 36, Math.max(142, ctx.measureText(this.toast.text).width + 46));
      const toastX = (SCREEN_WIDTH - toastW) / 2;
      const ty = toastY + (1 - enter) * 8;
      ctx.shadowColor = 'rgba(0,0,0,0.22)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      fillRoundRect(ctx, toastX, ty, toastW, 36, 18, 'rgba(14,22,35,0.94)');
      ctx.shadowColor = 'transparent';
      strokeRoundRect(ctx, toastX + 0.5, ty + 0.5, toastW - 1, 35, 18, 'rgba(255,255,255,0.15)', 1);
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.arc(toastX + 18, ty + 18, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.toast.text, toastX + toastW / 2 + 7, ty + 18);
      ctx.restore();
    } else if (this.toast && Date.now() >= this.toast.until) {
      this.toast = null;
    }
    this.renderSceneTransition();
    if (this.narrative) {
      this.renderNarrativeOverlay();
    }
  }

  renderSceneTransition() {
    const elapsed = Date.now() - Number(this.sceneEnteredAt || 0);
    if (elapsed < 0 || elapsed >= 240) return;
    const t = easeOutCubic(elapsed / 240);
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = '#09111D';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    ctx.globalAlpha = (1 - t) * 0.7;
    const sweep = ctx.createLinearGradient(0, 0, SCREEN_WIDTH, 0);
    sweep.addColorStop(0, 'rgba(255,255,255,0)');
    sweep.addColorStop(0.5, 'rgba(255,255,255,0.14)');
    sweep.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sweep;
    ctx.fillRect((t - 0.35) * SCREEN_WIDTH, 0, SCREEN_WIDTH * 0.34, SCREEN_HEIGHT);
    ctx.restore();
  }

  renderNarrativeOverlay() {
    const n = this.narrative;
    const pad = 14;
    const ox = pad;
    const w = SCREEN_WIDTH - pad * 2;
    const radius = 22;
    const hasOptions = Array.isArray(n.options) && n.options.length > 0;
    const optionRowH = 45;
    const optionGap = 8;
    const optionsTotalH = hasOptions
      ? n.options.length * optionRowH + (n.options.length - 1) * optionGap
      : 0;
    const btnH = 44;
    const textLeft = ox + 24;
    const textW = w - 48;
    const lineH = 23;
    let measuredTextHeight = 0;
    ctx.save();
    ctx.font = font(15, 400);
    String(n.text || '').split('\n').forEach((paragraph) => {
      if (!paragraph.trim()) {
        measuredTextHeight += lineH;
        return;
      }
      const lineCount = this.splitWrappedLines(paragraph, textW, 999).length;
      measuredTextHeight += lineCount * lineH;
    });
    ctx.restore();
    const actionH = hasOptions ? optionsTotalH : btnH;
    const availableH = SCREEN_HEIGHT - SAFE_TOP - SAFE_BOTTOM - 12;
    const overlayH = Math.min(
      availableH,
      Math.max(300, 62 + Math.min(measuredTextHeight, 370) + 22 + actionH + 34),
    );
    const enter = easeOutCubic(clamp((Date.now() - Number(n.openedAt || 0)) / 180, 0, 1));
    const oy = Math.max(SAFE_TOP + 2, (SCREEN_HEIGHT - overlayH) / 2 - 18) + (1 - enter) * 16;
    const actionTop = oy + overlayH - 18 - (hasOptions ? optionsTotalH : btnH);
    const optionTop = actionTop;
    const textTop = oy + 62;
    const textBottom = actionTop - 16;

    ctx.save();
    ctx.fillStyle = `rgba(4, 8, 16, ${0.72 * enter})`;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    drawPaperPanel(ctx, ox, oy, w, overlayH, { radius, shadow: true });

    ctx.fillStyle = COLORS.coralDeep;
    fillRoundRect(ctx, ox + 24, oy + 22, 34, 3, 2, COLORS.coralDeep);
    ctx.font = font(10, 700);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('这一幕', ox + 24, oy + 35);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(38,48,65,0.38)';
    ctx.font = font(9.5, 500);
    ctx.fillText('CAMPUS JOURNAL', ox + w - 24, oy + 35);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.paperInk;
    const viewportH = Math.max(lineH, textBottom - textTop);
    n.maxScroll = Math.max(0, measuredTextHeight - viewportH);
    this.narrativeScroll = clamp(Number(this.narrativeScroll || 0), 0, n.maxScroll);

    ctx.save();
    ctx.beginPath();
    ctx.rect(textLeft - 2, textTop, textW + 4, viewportH);
    ctx.clip();
    ctx.font = font(15, 400);
    ctx.fillStyle = 'rgba(38,48,65,0.86)';
    this.drawParagraphText(
      n.text,
      textLeft,
      textTop - this.narrativeScroll,
      textW,
      lineH,
      999,
    );
    ctx.restore();

    if (n.maxScroll > 0) {
      const trackH = 54;
      const thumbH = Math.max(18, (viewportH / Math.max(viewportH, measuredTextHeight)) * trackH);
      const thumbY = textTop + (this.narrativeScroll / n.maxScroll) * (trackH - thumbH);
      fillRoundRect(ctx, ox + w - 12, textTop + 8, 2, trackH, 1, 'rgba(38,48,65,0.12)');
      fillRoundRect(ctx, ox + w - 12, thumbY, 2, thumbH, 1, 'rgba(233,105,77,0.6)');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(38,48,65,0.42)';
      ctx.font = font(9.5, 500);
      ctx.fillText('上下滑动阅读', ox + w / 2, textBottom - 1);
    }

    if (Array.isArray(n.changes) && n.changes.length) {
      let chipX = textLeft;
      const chipY = textBottom - 18;
      n.changes.slice(0, 3).forEach((change) => {
        ctx.font = font(10, 600);
        const label = String(change.label || '');
        const chipW = Math.min(textW, ctx.measureText(label).width + 18);
        if (chipX + chipW > textLeft + textW) return;
        fillRoundRect(ctx, chipX, chipY, chipW, 20, 10, 'rgba(233,105,77,0.12)');
        ctx.fillStyle = change.color || COLORS.coralDeep;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, chipX + chipW / 2, chipY + 10);
        chipX += chipW + 6;
      });
    }

    if (hasOptions) {
      n.optionRects = [];
      n.options.forEach((op, idx) => {
        const by = optionTop + idx * (optionRowH + optionGap);
        const bx = ox + 24;
        const bw = w - 48;
        const fill = op.variant === 'danger'
          ? 'rgba(231,110,102,0.16)'
          : 'rgba(255,138,107,0.14)';
        fillRoundRect(ctx, bx, by, bw, optionRowH, 13, fill);
        strokeRoundRect(
          ctx,
          bx + 0.5,
          by + 0.5,
          bw - 1,
          optionRowH - 1,
          13,
          op.variant === 'danger' ? 'rgba(211,86,80,0.34)' : 'rgba(233,105,77,0.26)',
          1,
        );
        ctx.fillStyle = op.variant === 'danger' ? COLORS.danger : COLORS.coralDeep;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = font(13.5, 650);
        ctx.fillText(this.fitText(op.label, bw - 18), bx + bw / 2, by + optionRowH / 2);
        n.optionRects.push({ x: bx, y: by, w: bw, h: optionRowH, onSelect: op.onSelect });
      });
      n.btnRect = null;
    } else {
      const btnX = ox + 24;
      const btnW = w - 48;
      const btnY = actionTop;
      const gradient = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
      gradient.addColorStop(0, '#F4D28E');
      gradient.addColorStop(1, COLORS.coralDeep);
      fillRoundRect(ctx, btnX, btnY, btnW, btnH, 14, gradient);
      ctx.fillStyle = '#172231';
      ctx.font = font(14, 700);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.narrativeScroll < n.maxScroll ? '继续阅读' : '翻过这一页', btnX + btnW / 2, btnY + btnH / 2);
      this.narrative.btnRect = { x: btnX, y: btnY, w: btnW, h: btnH };
    }
    ctx.restore();
  }

  loop(timestamp = 0) {
    const now = Number(timestamp || Date.now());
    if (now - Number(this._lastFrameAt || 0) < 32) {
      requestAnimationFrame(this.boundLoop);
      return;
    }
    this._lastFrameAt = now;
    this.render();
    requestAnimationFrame(this.boundLoop);
  }

  renderRelations() {
    if (!this.run) {
      this.returnScene = null;
      this.goScene('menu', { clearPending: false });
      return;
    }
    this.drawSceneBackground();
    const light = this.themeMode === 'light';
    drawSceneKicker(ctx, 15, SAFE_TOP + 5, 'CONNECTIONS', light ? COLORS.coralDeep : COLORS.gold);
    ctx.fillStyle = light ? COLORS.paperInk : COLORS.ink;
    ctx.font = font(25, 730);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('身边的人', 15, SAFE_TOP + 18);
    this.ensureNpcUnlockState();
    this.pruneRelationshipUnlocks();
    const scroll = this.relationsScroll || 0;
    const listTop = SAFE_TOP + 72;
    const backY = SCREEN_HEIGHT - SAFE_BOTTOM - 42;
    const listBottom = backY - 10;
    let y = listTop - scroll;
    const roleOrder = { roommate: 0, mentor: 1, romance: 2, senior: 3 };
    const rows = [];
    (this.run.unlockedNpcIds || []).forEach((id) => {
      if (!this.npcMayStayInRelationshipNetwork(id)) return;
      const n = npcsCatalog.find((x) => x.id === id);
      if (!n) return;
      const aff = Number((this.run.npcAffinity && this.run.npcAffinity[id]) || 50);
      const label =
        n.role === 'roommate' ? '室友' : n.role === 'mentor' ? '导师' : n.role === 'romance' ? '心动' : n.role === 'senior' ? '学长姐' : 'NPC';
      const line = (this.run.npcLastInteraction && this.run.npcLastInteraction[id]) || n.bio || n.meme || '';
      rows.push({ n, aff, label, line });
    });
    rows.sort((a, b) => {
      const ra = roleOrder[a.n.role] != null ? roleOrder[a.n.role] : 9;
      const rb = roleOrder[b.n.role] != null ? roleOrder[b.n.role] : 9;
      if (ra !== rb) return ra - rb;
      return b.aff - a.aff;
    });
    ctx.fillStyle = light ? 'rgba(38,48,65,0.56)' : COLORS.inkMuted;
    ctx.font = font(10.5, 450);
    ctx.textAlign = 'left';
    if (rows.length) {
      ctx.fillText(`已结识 ${rows.length} 人 · 关系会随共同经历变化`, 15, SAFE_TOP + 51);
    }
    if (!rows.length) {
      ctx.fillStyle = uiTheme.colors.textSub;
      ctx.font = `${uiTheme.font.body}px sans-serif`;
      ctx.textAlign = 'center';
      this.wrapText('关系网暂时为空。继续推进周行动并触发剧情，可逐步认识室友与学长姐；选定导师或心动对象后，他们才会出现在这里。', 24, listTop + 8, SCREEN_WIDTH - 48, 20, 5);
      y = listTop + 150;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listTop, SCREEN_WIDTH, listBottom - listTop);
    ctx.clip();
    const cardX = 15;
    const cardW = SCREEN_WIDTH - 30;
    const rowH = 82;
    rows.forEach((row) => {
      if (y > listBottom || y < listTop - rowH) {
        y += rowH + 8;
        return;
      }
      drawGlassPanel(ctx, cardX, y, cardW, rowH, { radius: 17, strong: true, shadow: false });
      fillRoundRect(ctx, cardX + 12, y + 13, 38, 38, 19, 'rgba(235,199,121,0.12)');
      ctx.fillStyle = COLORS.gold;
      ctx.font = font(15, 700);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(row.n.name || '同').slice(0, 1), cardX + 31, y + 32);
      ctx.fillStyle = COLORS.ink;
      ctx.font = font(14, 650);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(row.n.name, cardX + 60, y + 12);
      ctx.fillStyle = COLORS.inkFaint;
      ctx.font = font(9.5, 500);
      ctx.fillText(row.label, cardX + 60, y + 32);
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.inkMuted;
      ctx.font = font(10, 550);
      ctx.fillText(`亲近度 ${Math.round(row.aff)}`, cardX + cardW - 13, y + 14);
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.inkMuted;
      ctx.font = font(10.3, 430);
      this.wrapText(this.fitText(row.line, cardW - 78), cardX + 60, y + 49, cardW - 78, 14, 1);
      fillRoundRect(ctx, cardX + 60, y + rowH - 13, cardW - 78, 3, 1.5, 'rgba(255,255,255,0.08)');
      fillRoundRect(ctx, cardX + 60, y + rowH - 13, Math.max(2, (cardW - 78) * row.aff / 100), 3, 1.5, row.aff >= 68 ? COLORS.jade : COLORS.gold);
      y += rowH + 8;
    });
    ctx.restore();
    const maxScroll = Math.max(0, y - listBottom + scroll);
    this._relationsScrollMax = maxScroll;
    this.drawScrollIndicator(listTop, listBottom - listTop, scroll, maxScroll);
    this.buttons = [
      {
        id: 'relations_back_bottom',
        x: 15,
        y: backY,
        w: SCREEN_WIDTH - 30,
        h: 42,
        label: '返回',
        variant: 'secondary',
        disabled: false,
        onClick: () => this.goScene(this.popReturnScene(), { clearPending: false }),
      },
    ];
  }

  startEndingPlayback(ending) {
    if (!ending) return;
    const chunks = [this.buildEndingStoryText(ending)];
    this.endingPlayback = {
      endingId: ending.id,
      title: ending.title || '',
      fullText: chunks.join('\n\n').trim(),
    };
    this.endingPlaybackScroll = 0;
    this.goScene('ending_playback', { clearPending: true });
  }

  startAchievementPlayback(achievement) {
    if (!achievement) return;
    const conditionText = this.getAchievementConditionText(achievement);
    const storyText = this.buildAchievementStoryText(achievement);
    this.achievementPlayback = {
      achievementId: achievement.id,
      title: achievement.title || '',
      storyText,
      conditionText,
    };
    this.achievementPlaybackScroll = 0;
    this.goScene('achievement_playback', { clearPending: true });
  }

  renderEndingPlayback() {
    const ep = this.endingPlayback;
    if (!ep) {
      this.goScene('gallery', { clearPending: true });
      return;
    }
    const ending = endingsCatalog.find((x) => x.id === ep.endingId);
    this.drawSceneBackground();
    const light = this.themeMode === 'light';
    drawSceneKicker(ctx, 15, SAFE_TOP + 5, 'ENDING FILE', light ? COLORS.coralDeep : COLORS.gold);
    ctx.fillStyle = light ? COLORS.paperInk : COLORS.ink;
    ctx.font = font(24, 720);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.fitText(ep.title || ending?.title || '结局回放', SCREEN_WIDTH - 30), 15, SAFE_TOP + 18);
    ctx.fillStyle = light ? 'rgba(38,48,65,0.56)' : COLORS.inkMuted;
    ctx.font = font(10.5, 450);
    ctx.fillText('已收录的结局全文', 15, SAFE_TOP + 51);

    const pad = 15;
    const cardX = pad;
    const cardW = SCREEN_WIDTH - pad * 2;
    const cardY = SAFE_TOP + 72;
    const backY = SCREEN_HEIGHT - SAFE_BOTTOM - 42;
    const cardH = Math.max(200, backY - cardY - 10);
    drawPaperPanel(ctx, cardX, cardY, cardW, cardH, { radius: 21 });
    const textX = cardX + 21;
    const textW = cardW - 42;
    const top = cardY + 18;
    const bottom = cardY + cardH - 18;
    const scroll = this.endingPlaybackScroll || 0;
    let penY = top - scroll;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cardX + 8, cardY + 8, cardW - 16, cardH - 16);
    ctx.clip();
    ctx.fillStyle = 'rgba(38,48,65,0.84)';
    ctx.font = font(13.5, 430);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    penY = this.drawParagraphText(ep.fullText || '暂无结局内容', textX, penY, textW, 22, 999);
    ctx.restore();
    const maxScroll = Math.max(0, penY + scroll - bottom);
    this._endingPlaybackScrollMax = maxScroll;
    this.endingPlaybackScroll = clamp(scroll, 0, maxScroll);
    if (maxScroll > 0) {
      const trackH = cardH - 36;
      const thumbH = Math.max(22, (trackH / (trackH + maxScroll)) * trackH);
      const thumbY = top + (this.endingPlaybackScroll / maxScroll) * (trackH - thumbH);
      fillRoundRect(ctx, cardX + cardW - 11, top, 2, trackH, 1, 'rgba(38,48,65,0.12)');
      fillRoundRect(ctx, cardX + cardW - 11, thumbY, 2, thumbH, 1, 'rgba(233,105,77,0.55)');
    }
    this.buttons = [{
      id: 'ending_playback_back',
      x: 15,
      y: backY,
      w: SCREEN_WIDTH - 30,
      h: 42,
      label: '返回结局档案',
      variant: 'secondary',
      disabled: false,
      onClick: () => {
        this.endingPlayback = null;
        this.goScene('gallery', { clearPending: true });
      },
    }];
  }


  renderAchievementPlayback() {
    const ap = this.achievementPlayback;
    if (!ap) {
      this.goScene('achievements', { clearPending: true });
      return;
    }
    const achievement = achievementsCatalog.find((x) => x.id === ap.achievementId);
    this.drawSceneBackground();
    const light = this.themeMode === 'light';
    drawSceneKicker(ctx, 15, SAFE_TOP + 5, 'MILESTONE', light ? COLORS.coralDeep : COLORS.gold);
    ctx.fillStyle = light ? COLORS.paperInk : COLORS.ink;
    ctx.font = font(24, 720);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.fitText(ap.title || achievement?.title || '成就详情', SCREEN_WIDTH - 30), 15, SAFE_TOP + 18);
    ctx.fillStyle = light ? 'rgba(38,48,65,0.56)' : COLORS.inkMuted;
    ctx.font = font(10.5, 450);
    ctx.fillText('这一项已经达成', 15, SAFE_TOP + 51);

    const cardX = 15;
    const cardW = SCREEN_WIDTH - 30;
    const cardY = SAFE_TOP + 72;
    const backY = SCREEN_HEIGHT - SAFE_BOTTOM - 42;
    const cardH = Math.max(210, backY - cardY - 10);
    drawPaperPanel(ctx, cardX, cardY, cardW, cardH, { radius: 21 });
    const textX = cardX + 21;
    const textW = cardW - 42;
    const top = cardY + 18;
    const bottom = cardY + cardH - 18;
    const scroll = this.achievementPlaybackScroll || 0;
    let penY = top - scroll;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cardX + 8, cardY + 8, cardW - 16, cardH - 16);
    ctx.clip();
    ctx.fillStyle = 'rgba(38,48,65,0.84)';
    ctx.font = font(13.5, 430);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    penY = this.drawParagraphText(ap.storyText || '暂无成就内容', textX, penY, textW, 22, 999);
    penY += 20;
    ctx.fillStyle = COLORS.coralDeep;
    ctx.font = font(10, 700);
    ctx.fillText('达成条件', textX, penY);
    penY += 20;
    ctx.fillStyle = 'rgba(38,48,65,0.68)';
    ctx.font = font(11, 430);
    penY = this.wrapText(ap.conditionText || '暂无附加条件', textX, penY, textW, 18, 999);
    ctx.restore();
    const maxScroll = Math.max(0, penY + scroll - bottom);
    this._achievementPlaybackScrollMax = maxScroll;
    this.achievementPlaybackScroll = clamp(scroll, 0, maxScroll);
    if (maxScroll > 0) {
      const trackH = cardH - 36;
      const thumbH = Math.max(22, (trackH / (trackH + maxScroll)) * trackH);
      const thumbY = top + (this.achievementPlaybackScroll / maxScroll) * (trackH - thumbH);
      fillRoundRect(ctx, cardX + cardW - 11, top, 2, trackH, 1, 'rgba(38,48,65,0.12)');
      fillRoundRect(ctx, cardX + cardW - 11, thumbY, 2, thumbH, 1, 'rgba(233,105,77,0.55)');
    }
    this.buttons = [{
      id: 'achievement_playback_back',
      x: 15,
      y: backY,
      w: SCREEN_WIDTH - 30,
      h: 42,
      label: '返回成就',
      variant: 'secondary',
      disabled: false,
      onClick: () => {
        this.achievementPlayback = null;
        this.goScene('achievements', { clearPending: true });
      },
    }];
  }

}
