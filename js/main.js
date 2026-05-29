import './render';
import { SCREEN_WIDTH, SCREEN_HEIGHT, SAFE_TOP } from './render';
import {
  createInitialRunState,
  SCHOOLS,
  MAJORS,
  SCHOOL_MAJOR_MATRIX,
  TOTAL_SEMESTERS,
  WEEKS_PER_SEMESTER,
  RULES_VERSION,
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
  relationshipsCatalog,
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
import { showRewardedVideo, AD_CONFIG } from './ads/adAdapter';
import { evaluateAchievements } from './core/achievements';
import BgmManager from './audio/bgmManager';
import {
  initShare,
  getShareTimelineHint,
  getLaunchShareInfo,
} from './core/share';

const ctx = canvas.getContext('2d');
/** 本周行动列表单行高度与可视行数（须与 renderPlay / 触摸滚动一致） */
const WEEK_ACTION_ROW_H = 54;
const WEEK_ACTION_MAX_VISIBLE = 5;
const WEEK_ACTION_SCROLL_STEP = WEEK_ACTION_ROW_H * 2;

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
  intro: '感谢他们在开发期间的支持',
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
    bg: '#0f1729',
    panel: '#18233d',
    panelSoft: '#243352',
    textMain: '#f5f7ff',
    textSub: '#b9c4e0',
    button: '#3a6df0',
    buttonDisabled: '#4d5673',
    accent: '#f06292',
    good: '#43c07a',
    warn: '#f7b955',
    danger: '#f06767',
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

  constructor() {
    this.assets = {};
    this.themeCatalog = uiTheme.themes || { dark: cloneTheme(uiTheme), light: cloneTheme(THEME_FALLBACK) };
    const meta = save.loadMeta();
    this.themeMode = 'dark';
    this.applyTheme('dark');
    this.bgm = new BgmManager(audioConfig);
    this.lastRenderedScene = '';
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
    this.relationsScroll = 0;
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
    requestAnimationFrame(() => initShare());
    this.bindShareLaunchWelcome();
    requestAnimationFrame(this.loop.bind(this));
    this.galleryScroll = 0;
    this.achievementScroll = 0;
    this.touchStartY = 0;
    this.isDragging = false;
  }

  tryLoadAssets() {
    if (!wx.createImage) return;
    
    // 加载UI资源
    this.loadImageAsset('ui_panel_bg', 'images/generated/ui_panel_bg.jpg');
    this.loadImageAsset('ui_button_primary', 'images/generated/ui_button_primary.jpg');
    
    // 加载游戏头像
    this.loadImageAsset('game_avatar', 'images/generated/game_avatar.jpg');
    
    // 加载学校背景图片
    this.loadSchoolBackgrounds();
    
    // 加载个人房间背景（用于宿舍场景）
    this.loadPersonalRoomBackgrounds();
    
    // 预设头像：images/generated/avatars/male|female/*.jpg（不走 assetExists，避免小游戏包内路径误判）
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
    
    // 加载UI按钮资源
    this.loadUIButtons();
    this.loadCgAssets();
  }

  loadPersonalRoomBackgrounds() {
    // 加载个人房间背景，用于宿舍、休息等场景
    const roomBackgrounds = [
      'pra_a1_day1.webp',
      'pra_a1_evening1.webp',
      'pra_a1_night1_lights.webp',
      'prb_a1_day1.webp',
      'prb_a1_evening1.webp',
      'prb_a1_night1_lights.webp',
      'prc_a1_day1.webp',
      'prc_a1_evening1.webp',
      'prc_a1_night1_lights.webp'
    ];
    
    roomBackgrounds.forEach(bg => {
      const assetId = bg.replace('.webp', '');
      this.loadImageAsset(assetId, `images/generated/PersonalRooms1_1080p_WEBP/${bg}`);
    });
  }

  loadSchoolBackgrounds() {
    // 加载不同场景的学校背景
    const backgrounds = [
      'Library Day.jpg',
      'Classroom Day.jpg', 
      'Gym Day.jpg',
      'Corridor Day.jpg',
      'Refectory Day.jpg',
      'Courtyard1 Day.jpg',
      'Athletics Track Day.jpg',
      'Music Room Day.jpg',
      'Science Laboratory Room Day.jpg',
      'Student Council Room Day.jpg'
    ];
    
    backgrounds.forEach(bg => {
      const assetId = bg.replace(/\.(png|jpe?g)$/i, '').replace(' ', '_');
      this.loadImageAsset(assetId, `images/School/${bg}`);
    });
    
    // 加载SchoolMiniPack背景图片
    const schoolMiniBackgrounds = [
      'smp_classroom1_day1.webp',
      'smp_classroom2_day1.webp',
      'smp_classroom3_day1.webp',
      'smp_classroom4_day1.webp',
      'smp_club1_day1.webp',
      'smp_club2_day1.webp',
      'smp_club3_day1.webp',
      'smp_club4_day1.webp',
      'smp_front_day1.webp',
      'smp_hallway_day1.webp',
      'smp_hallway11_day1.webp',
      'smp_hallway21_day1.webp',
      'smp_hallway31_day1.webp',
      'smp_noticeboard_day1.webp',
      'smp_roof_day1.webp',
      'smp_stairs1_day1.webp',
      'smp_stairs2_day1.webp'
    ];
    
    schoolMiniBackgrounds.forEach(bg => {
      const assetId = bg.replace('.webp', '');
      this.loadImageAsset(assetId, `images/generated/SchoolMiniPack_1080p_WEBP/${bg}`);
    });
    
    // 加载装饰性图片
    const decorativeImages = [
      'star_yellow.jpg',
      'star_blue.jpg',
      'star_pink.jpg',
      'button_green.jpg',
      'button_red.jpg',
      'button_blue.jpg'
    ];
    
    decorativeImages.forEach(img => {
      const assetId = img.replace(/\.(png|jpe?g)$/i, '');
      this.loadImageAsset(assetId, `images/kenney_ui-pack/PNG/${img}`);
    });
  }

  loadUIButtons() {
    // 加载不同样式的按钮
    const buttonStyles = [
      'button_round_gradient.jpg',
      'button_rectangle_gradient.jpg',
      'button_square_gradient.jpg'
    ];
    
    buttonStyles.forEach(btn => {
      const assetId = btn.replace(/\.(png|jpe?g)$/i, '');
      this.loadImageAsset(assetId, `images/kenney_ui-pack/PNG/Grey/Default/${btn}`);
    });
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
        preLead: '你隐约感觉，这次见面会决定你未来一段时间的节奏与方向。',
        preNotice: '你注意到',
        preClose: '你下意识站直了些，想听听他们会怎么定义“成长”。',
        meetLead: '你们聊了几句后，对方的语气不疾不徐，却句句落在重点上。',
        meetClose: '你忽然意识到，这段关系也许会影响你接下来很多关键选择。',
      };
    }
    if (role === 'romance') {
      return {
        preLead: '空气里有点说不清的悸动，你知道这次相遇可能会改写你的校园故事。',
        preNotice: '你最先看见',
        preClose: '你心里轻轻咯噔了一下，像某条故事线在这一刻悄然接上。',
        meetLead: '你们的对话并不夸张，却莫名顺着同一个频率走了下去。',
        meetClose: '离开时你回头看了一眼，感觉故事好像已经悄悄翻到下一页。',
      };
    }
    if (role === 'roommate') {
      return {
        preLead: '宿舍生活还没真正开始，但你已经能想象出未来的烟火气。',
        preNotice: '你先留意到',
        preClose: '你在心里默默判断：这个人以后很可能会出现在你每个日常片段里。',
        meetLead: '从聊天到互相吐槽，一切都很自然，像隔壁床位刚好补上了生活里的那一角。',
        meetClose: '你知道从今天起，校园生活会多一些“有人一起”的时刻。',
      };
    }
    if (role === 'senior') {
      return {
        preLead: '这次碰面更像一次提前的路线指引，你希望听到一些过来人的答案。',
        preNotice: '你在人群中注意到',
        preClose: '你暗暗记下了对方的神情，像在读一份真实版本的“未来参考”。',
        meetLead: '几句话下来，对方把很多弯路讲得很轻，但你听得很认真。',
        meetClose: '这段关系不像热闹开场，更像一盏能在关键时刻为你照路的灯。',
      };
    }
    return {
      preLead: '你感觉这次相遇会给这学期带来一些新的可能。',
      preNotice: '你先注意到',
      preClose: '你心里有了一个模糊判断：也许这就是接下来要并行的新故事线。',
      meetLead: '你们很快熟络起来，彼此都留了个不错的印象。',
      meetClose: '你知道这段关系之后还会有后续。',
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
      : '你在人群里看见了几个让你下意识想多聊两句的人。';
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
    this.touchStartY = t.clientY;
    this.isDragging = false;
    this.weeklyScrollbarDrag = false;
    this.runLogTouchInList = true;
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
    if (this.weeklyScrollbarDrag && this._weeklyScrollUi) {
      this.setWeeklyScrollFromTrackY(t.clientY);
      return;
    }
    const deltaY = this.touchStartY - t.clientY;
    if (Math.abs(deltaY) > 10) {
      this.isDragging = true;
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
        const actions = this.getWeeklyActionChoices();
        const maxScroll = Math.max(0, (actions.length - WEEK_ACTION_MAX_VISIBLE) * WEEK_ACTION_ROW_H);
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
      } else if (this.scene === 'ending_playback') {
        /* 打字机场景：中部点击快进由 handleTap 处理 */
      }
    }
    this.touchStartY = t.clientY;
  }

  onTouchEnd(e) {
    this.weeklyScrollbarDrag = false;
    const t = e.changedTouches[0];
    if (!this.isDragging) {
      this.handleTap(t.clientX, t.clientY);
    }
    this.isDragging = false;
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
            this.tapLockedUntil = Date.now() + 150;
            return;
          }
        }
      }
      const btn = this.narrative.btnRect;
      if (btn && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        const cb = this.narrative.onDismiss;
        this.narrative = null;
        if (typeof cb === 'function') cb();
        this.processCgQueue();
        this.tapLockedUntil = Date.now() + 150;
      }
      return;
    }
    let tappedButton = false;
    for (let i = 0; i < this.buttons.length; i++) {
      const b = this.buttons[i];
      if (b.disabled) continue;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        b.onClick();
        tappedButton = true;
        break;
      }
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
          this.tapLockedUntil = Date.now() + 120;
          return;
        }
      }
    }
  }

  showToast(text, ms = 2200) {
    this.toast = { text, until: Date.now() + ms };
  }

  /**
   * 显示叙事对话框：正文 + 状态变化 + 点击关闭
   * @param {string} text - 叙事正文（可含轻松段子）
   * @param {Array<{label:string,color:string}>} changes - 状态变化标签列表
   * @param {Function} [onDismiss] - 关闭后回调
   */
  showNarrative(text, changes = [], onDismiss = null) {
    this.narrative = { text: this.dedupeNarrativeEcho(text), changes, onDismiss };
  }

  showNarrativeWithOptions(text, options = []) {
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
      researchProgress: '科研线推进程度',
      contestProgress: '竞赛线推进程度',
      dormProgress: '宿舍事件推进程度',
      financeProgress: '理财投入次数',
      isCrossMajor: '跨专业路径标记',
      researchTrack: '科研主线路径',
      civilTrack: '考公路线标记',
      publicInstitutionTrack: '考编路线标记',
      itemUsage: '道具使用次数',
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
    const title = String((ending && ending.title) || '这个结局');
    const desc = String((ending && ending.description) || '你完成了一段属于自己的校园篇章');
    const id = String((ending && ending.id) || '');
    const epilogue = String((ending && ending.epilogue) || '').trim();
    const flavorPool = [
      '你不是简单“过关”，而是把这一局过成了一段能跟朋友讲三遍的校园故事。',
      '这一条线最妙的地方，是每个选择当时都像临场发挥，回头看却又刚好拼成最适合你的路线。',
      '如果人生有弹幕，这里大概会飘过一整屏“这波可以写进校史馆彩蛋”。',
      '它有点像期末周的你：白天硬扛、晚上复盘，嘴上说平平无奇，成绩单却在悄悄发光。',
      '恭喜你把“普通大学日常”玩成了限定剧情，属于多年后同学聚会还会被点名回忆的那种。',
      '这不是标准答案结局，而是你在一堆不确定里，亲手攒出来的高光片段。',
    ];
    let seed = 0;
    for (let i = 0; i < id.length; i++) seed += id.charCodeAt(i);
    const flavor = flavorPool[Math.abs(seed) % flavorPool.length];
    const lines = [
      `${desc}。`,
      '',
      '这段结局不只是结果页上的一行字，更像是你这局人生在学业、情感、资源和心态之间做出的总和。每次权衡、每次咬牙坚持、每次“先把这一周过完再说”，最后都汇成了现在这句定场白。',
      '',
      flavor,
    ];
    if (epilogue) {
      lines.push('', `五年后你把这段经历继续写了下去：${epilogue}`);
    } else {
      lines.push('', '如果把镜头拉远，你的故事不会停在毕业这一刻，而是会带着这段经历继续展开后续章节。');
    }
    lines.push('', '你当然还能打出别的结局，但这一条已经足够独特，足够像你。');
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
  drawTalentSpecialEffectLines(x, y, maxW, lineHeight, specialEffects) {
    const se = specialEffects || {};
    const lines = Object.keys(se)
      .filter((k) => se[k])
      .map((k) => TALENT_SPECIAL_LABEL[k])
      .filter(Boolean);
    if (!lines.length) return y;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    let cy = y;
    for (const line of lines) {
      cy = this.wrapText(line, x, cy, maxW, lineHeight, 2);
    }
    return cy;
  }

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
  getMenuSafeOffsetY() {
    let safeInset = 0;
    try {
      if (wx.getSystemInfoSync) {
        const s = wx.getSystemInfoSync();
        safeInset = Number(s.safeArea?.top ?? s.safeAreaTop ?? 0);
      }
    } catch (e) {
      safeInset = 0;
    }
    if (!safeInset) safeInset = Number(SAFE_TOP || 0);
    const padded = safeInset + 24;
    return Math.max(80, padded);
  }

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
      description: '平凡的大学生，没有特殊天赋，靠努力改变命运',
      effects: {},
      specialEffects: {},
      rarity: 'common',
      meme: '我命由我不由天🌟'
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
    this.showNarrative(body, [], null);
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
    return tag ? `第${sem}学期第${wk}周，当前阶段为${tag}` : `第${sem}学期第${wk}周`;
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
    const subtitleRaw = choice && choice.narrative
      ? this.applyRunContent(choice.narrative)
      : '确认后将推进剧情并结算本次选择。';
    const subtitle = this.fitText(subtitleRaw, SCREEN_WIDTH - 120);
    const effectSmall = this.formatEffectHintLine(choice && choice.effects ? choice.effects : null);
    const metaSmall = this.buildEventChoiceMetaText(choice);
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
    const lines = [
      '这一局大学生活的回望',
      '故事暂时落幕，你也终于有机会回头看清自己走过的轨迹。',
      `共记录 ${settlement.totalRecords} 条，其中主事件 ${settlement.byPhase.main_event} 条，支线 ${settlement.byPhase.side_event} 条，周行动 ${settlement.byPhase.week_action} 条`,
    ];
    const fs = settlement.finalStats || {};
    lines.push('');
    lines.push('你在成长曲线上的位置');
    lines.push('成绩、能力和心态并非直线前进，但它们共同勾勒出了你的轮廓。');
    lines.push(
      `绩点 ${this.formatStatValue('gpa', fs.gpa)}，能力 ${this.formatStatValue('ability', fs.ability)}，社交 ${this.formatStatValue('social', fs.social)}`,
    );
    lines.push(
      `健康 ${this.formatStatValue('health', fs.health)}，压力 ${this.formatStatValue('pressure', fs.pressure)}，存款 ￥${this.formatStatValue('money', fs.money)}`,
    );
    if (settlement.topActions && settlement.topActions.length) {
    lines.push(`你最常进行的周行动是${settlement.topActions.map((x) => `${x.title} 共 ${x.n} 次`).join('，')}`);
    }
    lines.push('');
    lines.push('你与他人的故事进展');
    lines.push('人与人的靠近，从来不是一瞬间，而是很多次认真回应的累积。');
    if (settlement.schoolName || settlement.majorName) {
      lines.push(`你这一局所在的学校与专业是${`${settlement.schoolName || ''} ${settlement.majorName || ''}`.trim()}`);
    }
    if (settlement.primaryMentorName) {
      lines.push(`你选择的主导师是${settlement.primaryMentorName}`);
    }
    if (settlement.partnerName) {
      lines.push(`与你建立亲密关系的是${settlement.partnerName}`);
    }
    if (settlement.notableFlags && settlement.notableFlags.length) {
      lines.push(`你的路线关键词包括${settlement.notableFlags.slice(0, 14).join('，')}`);
    }
    if (settlement.affinityLines && settlement.affinityLines.length) {
      lines.push(`当前关系网的好感概况是${settlement.affinityLines.join('，')}`);
    }
    lines.push('');
    lines.push('那些改变走向的关键选择');
    lines.push('当时看似普通的决定，后来都成了分岔路口上的方向牌。');
    lines.push(`本局累计出现了 ${settlement.activeFlagCount} 个关键标记`);
    if (settlement.npcHitBreakdown && settlement.npcHitBreakdown.length) {
      lines.push(`专属事件主要分布在${settlement.npcHitBreakdown.join('，')}`);
    } else if (settlement.npcEventHitsTotal > 0) {
      lines.push(`你与 NPC 的专属事件互动共计 ${settlement.npcEventHitsTotal} 次`);
    }
    if (settlement.notableFlags && settlement.notableFlags.length) {
      lines.push(`回顾这一路，你的路线关键词是${settlement.notableFlags.slice(0, 14).join('，')}`);
    }
    lines.push('');
    lines.push('随机片段与图鉴收藏');
    lines.push('命运偶尔会送来意外，而你把其中一部分变成了自己的收藏。');
    lines.push(
      `截至目前，你一共解锁了 ${settlement.unlockedEndingsCount || 0} 个结局，达成了 ${settlement.achievementsCount || 0} 项成就，以上为全局存档统计`,
    );
    if (settlement.thisRunEndingId) {
      lines.push(`这一局解锁的结局编号是 ${settlement.thisRunEndingId}`);
    }
    if (settlement.thisRunNewAchievements && settlement.thisRunNewAchievements.length) {
      const titles = settlement.thisRunNewAchievements
        .map((id) => achievementsCatalog.find((x) => x.id === id))
        .filter(Boolean)
        .map((a) => a.title);
      lines.push(`本局新成就共 ${settlement.thisRunNewAchievements.length} 项，分别是 ${titles.join('；')}`);
    }
    if (settlement.thisRunNewSchools && settlement.thisRunNewSchools.length) {
      lines.push(`这一局新解锁了这些学校，${settlement.thisRunNewSchools.join('，')}`);
    }
    if (settlement.thisRunNewMajors && settlement.thisRunNewMajors.length) {
      lines.push(`这一局新解锁了这些专业，${settlement.thisRunNewMajors.join('，')}`);
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
          adjustNpcAffinity(this.run, mid, 6, '你选定导师，课题组画风悄然对齐。');
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
          adjustNpcAffinity(this.run, pid, 10, '你们在故事里轻轻对齐了频率。');
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
      : '这个选择似乎会带来一些改变。';
    
    return `${playerName}${choice.text}。${defaultDesc}`;
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
    // 为右侧「背包/记录/关系」按钮预留空间，避免商店层与其重叠
    const rightColX = SCREEN_WIDTH - 96 - 16;
    const panelRight = rightColX - 20;
    const panelW = Math.max(220, Math.min(w, panelRight - pad));
    // 整体上移，并为底部操作区（返回主菜单/背包/记录/关系）预留安全空间
    const panelTop = Math.max(SAFE_TOP + 56, yStart - 14);
    const chrome = this._playChrome || this.getPlaySceneChrome();
    const panelBottom = chrome.defaultContinueY - 8;
    const rowH = 84;
    const footerH = 44;
    const footerGap = 10;
    const headH = 60;
    const panelH = Math.max(220, panelBottom - panelTop);
    const listMaxH = Math.max(96, panelH - headH - footerH - footerGap - 20);
    const contentH = stock.length * rowH;
    this._weeklyShopScrollMax = Math.max(0, contentH - listMaxH);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, panelTop - 8, SCREEN_WIDTH, SCREEN_HEIGHT - panelTop + 8);

    ctx.fillStyle = uiTheme.colors.panel || 'rgba(32,38,54,0.96)';
    this.fillRoundRect(pad, panelTop, panelW, panelH, 12);
    ctx.strokeStyle = uiTheme.colors.border || 'rgba(120,130,160,0.35)';
    ctx.lineWidth = 1;
    this.strokeRoundRect(pad, panelTop, panelW, panelH, 12);

    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('购物', pad + 12, panelTop + 10);

    const previewTotal = this.computeWeeklyShopPreviewTotal(cart);
    ctx.fillStyle = uiTheme.colors.textSub;
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

  drawPickTitleCentered(btn, pc, mainTint) {
    const titleFs = uiTheme.font.small + 1;
    const bodyLH = 14;
    const padX = 10;
    const innerW = btn.w - padX * 2;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillStyle = mainTint;
    ctx.font = `bold ${titleFs}px sans-serif`;
    const lines = this.splitWrappedLines(pc.title || '', innerW, 2);
    const blockH = lines.length * bodyLH;
    const startY = btn.y + (btn.h - blockH) / 2;
    const cx = btn.x + btn.w / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, cx, startY + i * bodyLH);
    });
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
    ctx.save();
    ctx.fillStyle = 'rgba(30, 36, 48, 0.92)';
    this.fillRoundRect(x, y, w, h, 8);
    ctx.strokeStyle = 'rgba(100, 115, 145, 0.5)';
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
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${bodyFs}px sans-serif`;
    ty = this.wrapText(pc.subtitle || '', innerX, ty, textMaxW, bodyLH, pc.locked ? 4 : 3);
    if (pc.effectSmall) {
      ctx.fillStyle = 'rgba(75, 90, 118, 0.95)';
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
    const variant = btn.variant || 'normal';
    const borderColor = variant === 'primary' ? '#ffffff' : uiTheme.colors.panelSoft;
    if (
      !btn.disabled
      && this.assets.ui_button_primary
      && this.assets.ui_button_primary.__ready
      && !this.assets.ui_button_primary.__failed
    ) {
      ctx.drawImage(this.assets.ui_button_primary, btn.x, btn.y, btn.w, btn.h);
      // Keep center area clean so labels stay readable on generated skins.
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(btn.x + 10, btn.y + 8, btn.w - 20, btn.h - 16);
      if (variant === 'secondary') {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      }
    } else {
      ctx.fillStyle = isSelected
        ? uiTheme.colors.accent
        : (btn.disabled ? uiTheme.colors.buttonDisabled : (variant === 'secondary' ? uiTheme.colors.panelSoft : uiTheme.colors.button));
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    }
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = variant === 'primary' ? 2 : 1.5;
    ctx.strokeRect(btn.x + 0.5, btn.y + 0.5, btn.w - 1, btn.h - 1);
    if (isSelected) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.strokeRect(btn.x + 2, btn.y + 2, btn.w - 4, btn.h - 4);
      ctx.fillStyle = '#ffd166';
      ctx.font = `bold ${uiTheme.font.small}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('已选', btn.x + btn.w - 8, btn.y + 6);
    }
    const textColor = btn.textColor || '#1f2a3d';
    const mainTint = btn.disabled ? uiTheme.colors.textSub : textColor;
    if (btn.pickContent) {
      const pc = btn.pickContent;
      ctx.save();
      this.drawPickTitleCentered(btn, pc, mainTint);
      if (btn.pickDetailBelow && isSelected) {
        this.drawPickDetailPanel(btn.x, btn.y + btn.h + 8, btn.w, pc);
      }
      ctx.restore();
      return;
    }
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxTextW = Math.max(20, btn.w - 18);
    const rawParts = String(btn.label || '').split('\n');
    const hasSubtitle = rawParts.length > 1 && rawParts.slice(1).join('').trim().length > 0;
    if (hasSubtitle) {
      const title = rawParts[0] || '';
      const subtitle = rawParts.slice(1).join(' ');
      const titleFs = Math.max(12, uiTheme.font.body);
      const subtitleFs = Math.max(10, uiTheme.font.small - 1);
      const titleLH = 15;
      const subtitleLH = 13;
      ctx.font = `bold ${titleFs}px sans-serif`;
      const titleLines = this.splitWrappedLines(title, maxTextW, 1);
      ctx.font = `${subtitleFs}px sans-serif`;
      const subtitleLines = this.splitWrappedLines(subtitle, maxTextW, 1);
      const totalH = titleLines.length * titleLH + subtitleLines.length * subtitleLH + 2;
      const centerY = btn.y + btn.h / 2;
      let cy = centerY - totalH / 2 + titleLH / 2;
      ctx.fillStyle = textColor;
      ctx.font = `bold ${titleFs}px sans-serif`;
      titleLines.forEach((line) => {
        ctx.fillText(line, btn.x + btn.w / 2, cy);
        cy += titleLH;
      });
      ctx.fillStyle = btn.disabled ? '#6f7686' : '#263247';
      ctx.shadowColor = 'rgba(255,255,255,0.35)';
      ctx.shadowBlur = 1;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.font = `${subtitleFs}px sans-serif`;
      cy += 2;
      subtitleLines.forEach((line) => {
        ctx.fillText(line, btn.x + btn.w / 2, cy);
        cy += subtitleLH;
      });
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else {
      const lineHeight = 14;
      const maxLines = Math.max(1, Math.floor((btn.h - 8) / lineHeight));
      const lines = this.splitWrappedLines(rawParts[0] || '', maxTextW, maxLines);
      const midY = btn.y + btn.h / 2;
      const startY = midY - ((lines.length - 1) * lineHeight) / 2;
      ctx.fillStyle = textColor;
      ctx.font = `${variant === 'primary' ? `bold ${uiTheme.font.body}` : uiTheme.font.body}px sans-serif`;
      lines.forEach((line, i) => {
        ctx.fillText(line, btn.x + btn.w / 2, startY + i * lineHeight);
      });
    }
  }

  drawSmallIcon(assetId, x, y, size = 22) {
    const icon = this.assets[assetId];
    if (icon && icon.__ready && !icon.__failed) {
      ctx.drawImage(icon, x, y, size, size);
      return true;
    }
    ctx.fillStyle = uiTheme.colors.panelSoft;
    ctx.fillRect(x, y, size, size);
    return false;
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
    
    // 备用方案
    ctx.fillStyle = uiTheme.colors.panelSoft;
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
    return false;
  }

  drawSceneBackground() {
    // 根据当前场景选择合适的背景
    const backgroundAsset = this.getSceneBackground();
    
    if (backgroundAsset && backgroundAsset.__ready && !backgroundAsset.__failed) {
      ctx.drawImage(backgroundAsset, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      // 添加半透明遮罩确保文字可读性
      ctx.fillStyle = 'rgba(18, 14, 22, 0.30)';
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    } else if (this.assets.ui_panel_bg && this.assets.ui_panel_bg.__ready && !this.assets.ui_panel_bg.__failed) {
      ctx.drawImage(this.assets.ui_panel_bg, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      ctx.fillStyle = 'rgba(18, 14, 22, 0.20)';
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    } else {
      ctx.fillStyle = uiTheme.colors.bg;
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    }
  }

  getSceneBackground() {
    // 根据场景和当前状态选择背景
    if (this.scene === 'play' && this.run) {
      // 游戏中根据当前阶段选择背景
      if (this.run.phase === 'main_event' || this.run.phase === 'side_event') {
        // 事件场景：使用SchoolMiniPack的教室背景
        const eventBackgrounds = [
          this.assets.smp_classroom1_day1,
          this.assets.smp_classroom2_day1,
          this.assets.smp_classroom3_day1,
          this.assets.smp_classroom4_day1,
          this.assets.Library_Day,
          this.assets.Classroom_Day,
          this.assets.Science_Laboratory_Room_Day,
          this.assets.Music_Room_Day
        ].filter(bg => bg);
        
        if (eventBackgrounds.length > 0) {
          const weeks = Number(this.run.weeksPerSemester || WEEKS_PER_SEMESTER);
          const index = (this.run.semesterIndex * weeks + this.run.weekIndex) % eventBackgrounds.length;
          return eventBackgrounds[index];
        }
      } else if (this.run.phase === 'week_action') {
        // 周行动场景：使用SchoolMiniPack的多样化背景
        const backgrounds = [
          this.assets.smp_hallway_day1,
          this.assets.smp_hallway11_day1,
          this.assets.smp_hallway21_day1,
          this.assets.smp_hallway31_day1,
          this.assets.smp_front_day1,
          this.assets.smp_noticeboard_day1,
          this.assets.smp_stairs1_day1,
          this.assets.smp_stairs2_day1,
          this.assets.Library_Day,
          this.assets.Gym_Day,
          this.assets.Corridor_Day,
          this.assets.Refectory_Day,
          this.assets.Courtyard1_Day,
          this.assets.Athletics_Track_Day,
          this.assets.Student_Council_Room_Day
        ].filter(bg => bg);
        
        // 根据当前状态选择合适的背景
        const st = this.run.stats;
        if (st.pressure > 70) {
          // 压力大时显示放松场景
          const relaxBackgrounds = [
            this.assets.smp_roof_day1,
            this.assets.smp_front_day1,
            this.assets.Gym_Day,
            this.assets.Courtyard1_Day,
            this.assets.Athletics_Track_Day
          ].filter(bg => bg);
          if (relaxBackgrounds.length > 0) {
            return relaxBackgrounds[Math.floor(Math.random() * relaxBackgrounds.length)];
          }
        }
        
        if (backgrounds.length > 0) {
          const index = (this.run.semesterIndex * 7 + this.run.weekIndex) % backgrounds.length;
          return backgrounds[index];
        }
      }
    } else if (this.scene === 'create_role') {
      // 创建角色：使用个人房间背景
      const roomBackgrounds = [
        this.assets.pra_a1_day1,
        this.assets.pra_a1_evening1,
        this.assets.pra_a1_night1_lights,
        this.assets.prb_a1_day1,
        this.assets.prb_a1_evening1,
        this.assets.prb_a1_night1_lights,
        this.assets.prc_a1_day1,
        this.assets.prc_a1_evening1,
        this.assets.prc_a1_night1_lights
      ].filter(bg => bg);
      
      if (roomBackgrounds.length > 0) {
        return roomBackgrounds[Math.floor(Math.random() * roomBackgrounds.length)];
      }
    } else if (this.scene === 'menu') {
      // 主菜单：使用SchoolMiniPack的前门背景
      return this.assets.smp_front_day1 || this.assets.Courtyard1_Day;
    } else if (this.scene === 'gallery' || this.scene === 'achievements' || this.scene === 'run_log' || this.scene === 'cg_gallery' || this.scene === 'bgm_gallery' || this.scene === 'credits' || this.scene === 'cg_playback') {
      // 图鉴和成就：使用SchoolMiniPack的布告栏背景
      return this.assets.smp_noticeboard_day1 || this.assets.Student_Council_Room_Day;
    } else if (this.scene === 'inventory') {
      // 背包：使用个人房间背景
      const roomBackgrounds = [
        this.assets.pra_a1_day1,
        this.assets.pra_a1_evening1,
        this.assets.pra_a1_night1_lights
      ].filter(bg => bg);
      
      if (roomBackgrounds.length > 0) {
        return roomBackgrounds[Math.floor(Math.random() * roomBackgrounds.length)];
      }
    }
    
    return null;
  }

  wrapText(text, x, y, maxWidth, lineHeight, maxLines) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let line = '';
    let cy = y;
    let lines = 0;
    const chars = String(text).split('');
    for (let n = 0; n < chars.length; n++) {
      const testLine = line + chars[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, cy);
        line = chars[n];
        cy += lineHeight;
        lines += 1;
        if (lines >= maxLines - 1) {
          line += '…';
          break;
        }
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, cy);
    return cy + lineHeight;
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
    let line = '';
    let cy = y;
    let lines = 0;
    const chars = String(text).split('');
    for (let n = 0; n < chars.length; n++) {
      const testLine = line + chars[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        cy += lineHeight;
        lines += 1;
        line = chars[n];
        if (lines >= maxLines - 1) {
          line += '…';
          break;
        }
      } else {
        line = testLine;
      }
    }
    return cy + lineHeight;
  }

  /** 学校/专业：仅按钮区 + 选中时按钮下方说明框（与 drawButton 一致） */
  measurePickRowHeight(pc, innerW, expanded) {
    const PICK_ROW_BTN_H = 44;
    const DETAIL_GAP = 8;
    if (!expanded) return PICK_ROW_BTN_H;
    ctx.save();
    const detailH = this.measurePickDetailPanelHeight(pc, innerW);
    ctx.restore();
    return PICK_ROW_BTN_H + DETAIL_GAP + detailH;
  }

  drawStatBar(label, value, max, x, y, w) {
    const numericValue = Number(value || 0);
    const ratio = Math.max(0, Math.min(1, numericValue / max));
    ctx.fillStyle = uiTheme.colors.panelSoft;
    ctx.fillRect(x, y, w, 14);
    let barColor = uiTheme.colors.good;
    
    // 压力条特殊逻辑：值越高越危险
    if (label === '压力') {
      if (ratio > 0.7) barColor = uiTheme.colors.danger;
      else if (ratio > 0.5) barColor = uiTheme.colors.warn;
    } else {
      if (ratio < 0.35) barColor = uiTheme.colors.danger;
      else if (ratio < 0.7) barColor = uiTheme.colors.warn;
    }
    
    ctx.fillStyle = barColor;
    ctx.fillRect(x, y, w * ratio, 14);
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 4, y + 7);
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(numericValue)), x + w - 4, y + 7);
    ctx.textBaseline = 'top';
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
    const oy = this.getMenuSafeOffsetY();

    // 绘制游戏头像
    const avatarSize = 80;
    const avatarX = (SCREEN_WIDTH - avatarSize) / 2;
    this.drawSmallIcon('game_avatar', avatarX, 20 + oy, avatarSize);

    const titleBoxW = Math.min(SCREEN_WIDTH - 28, 360);
    const titleBoxX = (SCREEN_WIDTH - titleBoxW) / 2;
    ctx.fillStyle = 'rgba(24, 16, 10, 0.45)';
    ctx.fillRect(titleBoxX, 116 + oy, titleBoxW, 78);
    ctx.fillStyle = '#ffe7c7';
    ctx.strokeStyle = 'rgba(33, 24, 18, 0.7)';
    ctx.lineWidth = 3;
    ctx.font = `bold ${uiTheme.font.title + 4}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.strokeText('本科生的四年日记', SCREEN_WIDTH / 2, 122 + oy);
    ctx.fillText('本科生的四年日记', SCREEN_WIDTH / 2, 122 + oy);
    ctx.font = `${uiTheme.font.body}px sans-serif`;
    ctx.fillStyle = '#ffe4bf';
    ctx.fillText('感谢各位的支持', SCREEN_WIDTH / 2, 155 + oy);
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.fillText('有bug、建议等，欢迎发送到邮箱:zzz051201@163.com', SCREEN_WIDTH / 2, 175 + oy);

    const canContinue = save.hasSavedRun();
    this.buttons = [];
    const pad = 16;
    const w = SCREEN_WIDTH - pad * 2;
    const h = 42;
    let y = 202 + oy;
    const add = (label, disabled, onClick) => {
      this.buttons.push({ x: pad, y, w, h, label, disabled, onClick });
      y += h + 8;
    };
    add('新游戏', false, () => { this.goScene('create_role', { initCreateRole: true }); });
    add('继续', !canContinue, () => { if (canContinue) this.continueRun(); });
    add('结局图鉴', false, () => { this.goScene('gallery'); });
    add('成就系统', false, () => { this.goScene('achievements'); });
    add('CG 图鉴', false, () => { this.goScene('cg_gallery'); });
    add('BGM 图鉴', false, () => { this.goScene('bgm_gallery'); });
    add('致谢', false, () => { this.creditsScroll = 0; this.goScene('credits'); });
    add('设置', false, () => { this.goScene('settings'); });
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
    const pad = 20;
    const w = SCREEN_WIDTH - pad * 2;
    const gap = 12;
    const panelTop = 60;
    const inner = pad + 8;
    const avatarLeft = pad + 6;
    const avatarSize = 48;
    const btnH = 34;
    const btnGap = 8;
    const btn3w = Math.floor((w - btnGap * 2) / 3);
    const bodyLH = uiTheme.lineHeight?.body || 19;
    const smallLH = (uiTheme.lineHeight?.small || 14) + 2;
    const h2Line = uiTheme.lineHeight?.title ? uiTheme.lineHeight.title : 28;

    const bottomBtnH = 44;
    const bottomGap = 10;
    const yBack = SCREEN_HEIGHT - 16 - bottomBtnH;
    const yConfirm = yBack - bottomGap - bottomBtnH;
    const panelBottom = yConfirm - 8;

    ctx.textBaseline = 'top';
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('创建角色', SCREEN_WIDTH / 2, 44);

    ctx.fillStyle = uiTheme.colors.panel;
    ctx.fillRect(pad, panelTop, w, panelBottom - panelTop);

    this.buttons = [];

    let y = panelTop + 8;
    const textMaxW = w - 16;

    this.drawAvatar(avatarLeft, y, avatarSize, this.tempProfile);
    const nickX = avatarLeft + avatarSize + 10;
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `${uiTheme.font.body}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`昵称：${this.tempProfile.name}`, nickX, y + 4);
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.fillText(
      `性别：${this.tempProfile.gender === 'male' ? '男' : '女'}`,
      nickX,
      y + 4 + bodyLH,
    );

    const btnRowY = y + avatarSize + 8;
    this.buttons.push({
      id: 'role_name_random',
      x: pad,
      y: btnRowY,
      w: btn3w,
      h: btnH,
      label: '随机姓名',
      variant: 'secondary',
      disabled: false,
      onClick: () => this.pickRandomNameByGender(this.tempProfile.gender),
    });
    this.buttons.push({
      id: 'role_gender_toggle',
      x: pad + btn3w + btnGap,
      y: btnRowY,
      w: btn3w,
      h: btnH,
      label: '切换性别',
      variant: 'secondary',
      disabled: false,
      onClick: () => {
        this.tempProfile.gender = this.tempProfile.gender === 'male' ? 'female' : 'male';
        this.pickRandomNameByGender(this.tempProfile.gender);
        this.pickRandomAvatarByGender(this.tempProfile.gender);
      },
    });
    this.buttons.push({
      id: 'role_avatar_random',
      x: pad + 2 * (btn3w + btnGap),
      y: btnRowY,
      w: btn3w,
      h: btnH,
      label: '随机头像',
      variant: 'secondary',
      disabled: false,
      onClick: () => this.pickRandomAvatarByGender(this.tempProfile.gender),
    });

    y = btnRowY + btnH + gap;

    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.small}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('难度', inner, y);
    y += 16;
    const diffRowY = y;
    const d = this.tempProfile.difficulty || DEFAULT_DIFFICULTY;
    this.buttons.push({
      id: 'diff_easy',
      x: pad,
      y: diffRowY,
      w: btn3w,
      h: btnH,
      label: '简单',
      variant: d === 'easy' ? 'primary' : 'secondary',
      disabled: false,
      onClick: () => { this.tempProfile.difficulty = 'easy'; },
    });
    this.buttons.push({
      id: 'diff_normal',
      x: pad + btn3w + btnGap,
      y: diffRowY,
      w: btn3w,
      h: btnH,
      label: '标准',
      variant: d === 'normal' ? 'primary' : 'secondary',
      disabled: false,
      onClick: () => { this.tempProfile.difficulty = 'normal'; },
    });
    this.buttons.push({
      id: 'diff_hard',
      x: pad + 2 * (btn3w + btnGap),
      y: diffRowY,
      w: btn3w,
      h: btnH,
      label: '困难',
      variant: d === 'hard' ? 'primary' : 'secondary',
      disabled: false,
      onClick: () => { this.tempProfile.difficulty = 'hard'; },
    });

    y = diffRowY + btnH + 8;
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.textBaseline = 'top';
    const diffKey = d === 'easy' || d === 'hard' ? d : 'normal';
    const diffExpl = DIFFICULTY_CREATE_ROLE_HINT[diffKey];
    y = this.wrapText(diffExpl, inner, y, textMaxW, smallLH, 3);

    y += gap;

    const talentActionGap = 8;
    const talentActionW = 56;
    const talentActionH = 32;
    const talentActionsTotalW = talentActionW * 2 + talentActionGap;
    const talentActionX = pad + w - 8 - talentActionsTotalW;
    const talentTitleY = y;

    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('选择天赋', inner, talentTitleY);

    const tierFilter = this.talentTierFilter || 'all';
    const tierBtnGap = 6;
    const tierBtnCount = TALENT_TIER_FILTER_KEYS.length;
    const tierBtnW = Math.floor((w - tierBtnGap * (tierBtnCount - 1)) / tierBtnCount);
    const tierBtnH = 30;
    y = talentTitleY + talentActionH + 8;

    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.fillText('随机池分层', inner, y);
    y += 16;
    const tierRowY = y;
    TALENT_TIER_FILTER_KEYS.forEach((key, idx) => {
      this.buttons.push({
        id: `talent_tier_${key}`,
        x: pad + idx * (tierBtnW + tierBtnGap),
        y: tierRowY,
        w: tierBtnW,
        h: tierBtnH,
        label: TALENT_TIER_FILTER_LABEL[key] || key,
        variant: tierFilter === key ? 'primary' : 'secondary',
        disabled: false,
        onClick: () => { this.talentTierFilter = key; },
      });
    });
    y = tierRowY + tierBtnH + 8;

    const talentDisplay = this.selectedTalent ? this.selectedTalent.name : '—';
    const talentTier = this.selectedTalent
      ? (TALENT_TIER_LABEL[this.selectedTalent.tier] || TALENT_TIER_LABEL.balanced)
      : '—';
    const poolLabel = TALENT_TIER_FILTER_LABEL[tierFilter] || '全部';
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${uiTheme.font.body}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`当前：${talentDisplay}`, inner, y);
    y += bodyLH;
    ctx.fillText(`随机池：${poolLabel}　天赋分层：${talentTier}`, inner, y);
    y += bodyLH + 4;

    ctx.textAlign = 'left';
    if (this.selectedTalent) {
      const st = this.selectedTalent;
      const desc = st.description || '';
      const meme = st.meme || '';
      const se = st.specialEffects || {};
      const activeSpecialCount = Object.keys(se).filter((k) => se[k]).length;
      const nChips = this.formatStatChanges(st.effects || {}).length;
      const statBlockH = nChips ? Math.max(smallLH, Math.ceil(nChips / 2) * smallLH) : smallLH;
      const reserveFx =
        18 +
        statBlockH +
        activeSpecialCount * smallLH * 2 +
        12;
      const memeReserve = meme ? 6 + smallLH * 2 : 0;
      const room = yConfirm - gap - y - reserveFx - memeReserve;
      const descMaxLines = Math.max(1, Math.min(5, Math.floor(Math.max(0, room) / bodyLH)));
      const afterDesc = yConfirm - gap - y - reserveFx - descMaxLines * bodyLH - (meme ? 6 : 0);
      const memeMaxLines = meme
        ? Math.max(1, Math.min(2, Math.floor(Math.max(0, afterDesc) / smallLH)))
        : 0;

      ctx.fillStyle = uiTheme.colors.textSub;
      ctx.font = `${uiTheme.font.body}px sans-serif`;
      if (desc) {
        y = this.wrapText(desc, inner, y, textMaxW, bodyLH, descMaxLines);
      }
      if (meme) {
        ctx.fillStyle = uiTheme.colors.accent;
        ctx.font = `${uiTheme.font.small}px sans-serif`;
        y = this.wrapText(meme, inner, y + 6, textMaxW, smallLH, Math.max(1, memeMaxLines));
      }
      y += 8;
      ctx.fillStyle = uiTheme.colors.textMain;
      ctx.font = `bold ${uiTheme.font.small}px sans-serif`;
      ctx.fillText('天赋效果', inner, y);
      y += smallLH;
      y = this.drawColoredStatChangeLine(inner, y, textMaxW, smallLH, st.effects || {});
      y = this.drawTalentSpecialEffectLines(inner, y + 2, textMaxW, smallLH, st.specialEffects);
    } else {
      ctx.fillStyle = uiTheme.colors.textSub;
      ctx.font = `${uiTheme.font.small}px sans-serif`;
      y = this.wrapText(
        '先选随机池分层，再点「随机」从该池抽取；「无」表示不携带天赋。',
        inner,
        y,
        textMaxW,
        smallLH,
        3,
      );
    }

    this.buttons.push({
      id: 'talent_none',
      x: talentActionX,
      y: talentTitleY,
      w: talentActionW,
      h: talentActionH,
      label: '无',
      variant: 'secondary',
      disabled: false,
      onClick: () => {
        this.selectTalent({
          id: 'no_talent',
          name: '无',
          description: '平凡的大学生，没有特殊天赋，靠努力改变命运',
          effects: {},
          specialEffects: {},
          rarity: 'common',
          meme: '我命由我不由天🌟',
        });
      },
    });

    this.buttons.push({
      id: 'talent_random',
      x: talentActionX + talentActionW + talentActionGap,
      y: talentTitleY,
      w: talentActionW,
      h: talentActionH,
      label: '随机',
      variant: 'secondary',
      disabled: false,
      onClick: () => {
        const randomTalent = this.pickRandomTalentFromTierFilter();
        if (randomTalent) {
          this.selectTalent(randomTalent);
        } else {
          const poolName = TALENT_TIER_FILTER_LABEL[this.talentTierFilter] || '该分层';
          this.showToast(`${poolName}池暂无可用天赋`);
        }
      },
    });

    this.buttons.push({
      id: 'role_confirm_continue',
      x: pad,
      y: yConfirm,
      w,
      h: bottomBtnH,
      label: '确认并继续',
      variant: 'primary',
      disabled: false,
      onClick: () => {
        if (!this.selectedTalent || this.selectedTalent.id === 'no_talent') {
          this.ensureDefaultTalentForCreateRole();
        }
        this.goScene('school', { clearPending: true });
      },
    });
    this.buttons.push({
      id: 'role_back',
      x: pad,
      y: yBack,
      w,
      h: bottomBtnH,
      label: '返回',
      variant: 'secondary',
      disabled: false,
      onClick: () => { this.goScene('menu'); },
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

  buildPickImpactLine(item, type) {
    const effectLine = this.formatPickEffectsLine(item);
    const prefix = effectLine ? `属性会这样变化，${effectLine}` : '属性会有轻微变化';
    const tail = type === 'schools'
      ? '并影响后续可见事件、可达成成就与结局分支'
      : '并影响后续选项池、成就触发与结局走向';
    return `选择影响如下，${prefix}。${tail}`;
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

  renderPickScreen(title, list, unlockedSet, type, onPick, backScenePrev, extra = {}) {
    this.drawSceneBackground();
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(title, SCREEN_WIDTH / 2, 46);
    this.buttons = [];
    const pad = 16;
    const w = SCREEN_WIDTH - pad * 2 - 14;
    const rowGap = 10;
    const listTop = 88;
    const pickBtnH = 44;
    const bottomPad = 8;
    const footerBtnH = 44;
    const footerStackGap = 8;
    const scrollHintBand = 28;
    const backY = SCREEN_HEIGHT - bottomPad - footerBtnH;
    const confirmY = backY - footerStackGap - footerBtnH;
    const footerStackTop = confirmY;
    const maxBottom = footerStackTop - scrollHintBand;
    const scrollHintY = footerStackTop - scrollHintBand / 2;

    const innerW = w - 20;
    const positions = [];
    const rowMetas = list.map((item) => {
      const unlocked = unlockedSet.has(item.id);
      const rel = (extra.relationById && extra.relationById[item.id]) || '';
      const lockHint = this.getUnlockHint(type, item.id);
      const titleText = unlocked ? this.sanitizePickName(item.name) : `${this.sanitizePickName(item.name)} · 未解锁`;
      const subtitle = unlocked ? this.buildPickSubtitle(item.tagline) : '暂不可选，满足条件后可解锁';
      const metaSmall = unlocked
        ? (type === 'majors' ? '' : (type === 'schools' ? '学校会改变可选专业与校内事件池' : '专业会改变后续分支、成就与结局倾向'))
        : (type === 'majors' ? `解锁条件是${lockHint}` : `${rel ? `${rel}，` : ''}解锁条件是${lockHint}`);
      const pickContent = {
        title: titleText,
        subtitle,
        effectSmall: unlocked ? this.buildPickImpactLine(item, type) : '',
        metaSmall,
        locked: !unlocked,
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
      if (topY + rm.h < listTop || topY > maxBottom) continue;
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

    const footerBtnW = SCREEN_WIDTH - pad * 2;
    this.buttons.push({
      id: `${type}_confirm`,
      x: pad,
      y: confirmY,
      w: footerBtnW,
      h: footerBtnH,
      label: '确认并继续',
      variant: 'primary',
      disabled: !this.pendingTransition,
      onClick: () => {
        if (!this.pendingTransition) return;
        this.commitPendingTransition();
      },
    });
    this.buttons.push({
      x: pad,
      y: backY,
      w: footerBtnW,
      h: footerBtnH,
      label: '返回',
      variant: 'secondary',
      disabled: false,
      onClick: () => { this.goScene(backScenePrev); },
    });
  }

  renderSchool() {
    const meta = save.loadMeta();
    const relationById = {};
    Object.values(SCHOOLS).forEach((s) => {
      if (s.topTier) relationById[s.id] = 'TOP2';
    });
    this.renderPickScreen('选择学校', Object.values(SCHOOLS), new Set(meta.unlockedSchools), 'schools', (s) => {
      this.pendingSchoolId = s.id;
      this.goScene('major');
    }, 'create_role', { relationById });
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
    const statsPanelH = Math.min(174, Math.max(152, Math.round(SCREEN_HEIGHT * 0.205)));
    const statsPadBottom = Math.max(10, Math.round(SCREEN_HEIGHT * 0.018));
    const statsTop = SCREEN_HEIGHT - statsPanelH - statsPadBottom;

    const sideBtnH = 30;
    const sideBtnGap = 8;
    const chromeGap = Math.max(8, Math.round(SCREEN_HEIGHT * 0.012));
    const sideStackBottom = statsTop - chromeGap;
    const relationsY = sideStackBottom - sideBtnH;
    const logY = relationsY - sideBtnH - sideBtnGap;
    const invY = logY - sideBtnH - sideBtnGap;

    const continueBtnH = 36;
    const continueGap = 10;
    const defaultContinueY = relationsY - continueGap - continueBtnH;
    const contentBottom = (this.pendingTransition ? defaultContinueY : sideStackBottom) - chromeGap;

    return {
      statsTop,
      statsPanelH,
      relationsY,
      logY,
      invY,
      sideBtnH,
      continueBtnH,
      continueGap,
      defaultContinueY,
      contentBottom,
      rightColX: SCREEN_WIDTH - 96 - 16,
      btnStackW: 96,
      sideStackBottom,
      chromeGap,
    };
  }

  renderStatsPanel() {
    const st = this.run.stats;
    const chrome = this._playChrome || this.getPlaySceneChrome();
    const x = 16;
    const y = chrome.statsTop;
    const panelH = chrome.statsPanelH;
    const w = SCREEN_WIDTH - 32;
    ctx.fillStyle = uiTheme.colors.panel;
    ctx.fillRect(x, y, w, panelH);
    
    // 状态条
    this.drawStatBar('健康', st.health, 100, x + 10, y + 56, w - 20);
    this.drawStatBar('社交', st.social, 100, x + 10, y + 82, w - 20);
    this.drawStatBar('能力', st.skill, 100, x + 10, y + 108, w - 20);
    this.drawStatBar('压力', st.pressure, 100, x + 10, y + 134, w - 20);
    
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`绩点 ${this.formatStatValue('gpa', st.gpa)}/4.00`, x + w * 0.28, y + 10);
    ctx.fillText(`金钱 ￥${this.formatStatValue('money', st.money)}`, x + w * 0.72, y + 10);
    
    // 第一行额外信息
    ctx.textAlign = 'left';
    const invCount = Array.isArray(this.run.inventory) ? this.run.inventory.length : 0;
    ctx.fillText(`背包 ${invCount} 件`, x + 10, y + 28);
    if (invCount > 0) {
      const firstId = this.run.inventory[0];
      const first = itemsCatalog.find((it) => it.id === firstId);
      const recentLabel = first ? first.name || first.title || first.id : firstId;
      ctx.textAlign = 'right';
      ctx.fillText(
        `最近：${this.fitText(String(recentLabel || '道具'), w - 150)}`,
        x + w - 10,
        y + 28,
      );
      ctx.textAlign = 'left';
    }
    
    // 第二行有趣信息
    const funnyStatus = this.generateFunnyStatus();
    ctx.fillText(funnyStatus, x + 10, y + 44);
    
    // 底部成就/进度信息
    const progressInfo = this.generateProgressInfo();
    if (progressInfo) {
      ctx.fillStyle = uiTheme.colors.textSub;
      ctx.font = `${uiTheme.font.small - 1}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(progressInfo, x + w - 10, y + panelH - 14);
      ctx.textAlign = 'left';
    }
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
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    if (drawY0 + 24 >= contentTop && drawY0 <= contentBottom) {
      ctx.fillText(eventObj.title, pad, drawY0);
    }

    ctx.font = `${uiTheme.font.body}px sans-serif`;
    ctx.fillStyle = uiTheme.colors.textSub;
    const bodyY = drawY0 + 24;
    if (bodyY < contentBottom) {
      this.wrapText(eventObj.body || '', pad, bodyY, SCREEN_WIDTH - pad * 2, bodyLH, 6);
    }

    this._playEventChoiceLayouts = measured.choiceMetas;
    this._playEventListTop = contentTop;

    measured.choiceMetas.forEach((m) => {
      const drawY = m.y - scroll;
      if (drawY + m.rowH < contentTop || drawY > contentBottom) return;
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
      ctx.fillStyle = 'rgba(185, 196, 224, 0.55)';
      ctx.font = `${uiTheme.font.small}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('上下滑动查看事件与选项', SCREEN_WIDTH / 2, contentTop + 14);
      ctx.textBaseline = 'top';
    }

    return measured.totalHeight;
  }

  generateFunnyStatus() {
    const st = this.run.stats;
    
    // 计算当前状态的哈希值
    const currentStatsHash = JSON.stringify({
      health: Math.round(st.health / 10) * 10,
      social: Math.round(st.social / 10) * 10,
      skill: Math.round(st.skill / 10) * 10,
      pressure: Math.round(st.pressure / 10) * 10,
      gpa: Math.round(st.gpa * 10) / 10,
      money: Math.round(st.money / 100) * 100
    });
    
    // 如果状态没有显著变化，返回固定的状态描述
    if (this.lastStatsHash === currentStatsHash && this.fixedFunnyStatus) {
      return this.fixedFunnyStatus;
    }
    
    // 状态发生变化时，生成新的状态描述并固定
    this.lastStatsHash = currentStatsHash;
    const statuses = [];
    
    // 基于状态生成有趣的描述
    if (st.pressure > 80) {
      statuses.push('压力山大，快秃了👨‍🦲');
    } else if (st.pressure > 60) {
      statuses.push('有点焦虑，需要放松😰');
    } else if (st.pressure < 20) {
      statuses.push('心态平和，佛系青年🧘');
    }
    
    if (st.health > 80) {
      statuses.push('身体棒棒，吃嘛嘛香💪');
    } else if (st.health < 30) {
      statuses.push('身体被掏空，需要补补😵');
    }
    
    if (st.social > 80) {
      statuses.push('社交达人，人脉广🎉');
    } else if (st.social < 20) {
      statuses.push('自闭边缘，需要社交👥');
    }
    
    if (st.skill > 80) {
      statuses.push('技能点满，大佬级别🚀');
    } else if (st.skill < 30) {
      statuses.push('萌新上路，还需努力🌱');
    }
    
    if (st.gpa > 3.5) {
      statuses.push('学霸附体，绩点起飞📚');
    } else if (st.gpa < 2.0) {
      statuses.push('学渣预警，危险边缘⚠️');
    }
    
    if (st.money > 1000) {
      statuses.push('小富翁，消费自由💰');
    } else if (st.money < 100) {
      statuses.push('吃土模式，急需打工🏗️');
    }
    
    // 特殊组合状态
    if (st.pressure > 70 && st.health < 40) {
      statuses.push('过劳肥预备役⚖️');
    }
    
    if (st.social > 70 && st.gpa < 2.5) {
      statuses.push('社交学霸，学习困难🎭');
    }
    
    // 随机选择一个状态并固定
    if (statuses.length > 0) {
      this.fixedFunnyStatus = statuses[Math.floor(Math.random() * statuses.length)];
    } else {
      // 默认状态
      const defaultStatuses = [
        '大学生活进行中🎓',
        '青春不散场🌟',
        '未来可期🌈',
        '努力奋斗中💼',
        '平凡的一天📅'
      ];
      this.fixedFunnyStatus = defaultStatuses[Math.floor(Math.random() * defaultStatuses.length)];
    }
    
    return this.fixedFunnyStatus;
  }

  generateProgressInfo() {
    const flags = this.run.flags || {};
    const progress = [];
    
    if (flags.certProgress) {
      progress.push(`证书进度${flags.certProgress}/3`);
    }
    if (flags.contestProgress) {
      progress.push(`竞赛进度${flags.contestProgress}/3`);
    }
    if (flags.researchProgress) {
      progress.push(`科研进度${flags.researchProgress}/3`);
    }
    if (flags.financeProgress) {
      progress.push(`理财进度${flags.financeProgress}/3`);
    }
    if (flags.civilProgress) {
      progress.push(`考公进度${flags.civilProgress}/3`);
    }
    
    if (progress.length > 0) {
      return progress.join(' · ');
    }
    
    // 根据压力值显示状态评语
    const pressure = this.run.stats.pressure || 0;
    if (pressure >= 85) {
      return '当前状态：在崩溃的边缘疯狂试探';
    } else if (pressure >= 70) {
      return '当前状态：压力山大，需要休息';
    } else if (pressure >= 55) {
      return '当前状态：有点紧绷，但还能坚持';
    } else if (pressure >= 40) {
      return '当前状态：节奏适中，稳步前行';
    } else if (pressure >= 25) {
      return '当前状态：状态不错，游刃有余';
    } else {
      return '当前状态：轻松惬意，享受校园时光';
    }
  }

  renderPlay() {
    this.drawSceneBackground();
    if (!this.run) return;
    if (this.run.phase !== 'week_action') this._weeklyScrollUi = null;
    
    // 绘制右上角头像
    this.drawAvatar(SCREEN_WIDTH - 64, SAFE_TOP, 48, this.run.playerProfile);
    
    ctx.fillStyle = uiTheme.colors.accent;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.textAlign = 'left';
    const statusText = this.fitText(
      `第 ${this.run.semesterIndex + 1} 学期，共 ${TOTAL_SEMESTERS} 学期；第 ${this.run.weekIndex + 1} 周，本学期共 ${Number(this.run.weeksPerSemester || WEEKS_PER_SEMESTER)} 周`,
      SCREEN_WIDTH - 100,
    );
    ctx.fillText(
      statusText,
      10,
      SAFE_TOP,
    );
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.fillText(this.fitText(`你扮演的角色是${this.run.playerProfile.name}，${this.run.playerProfile.gender === 'male' ? '男生' : '女生'}`, SCREEN_WIDTH - 100), 10, SAFE_TOP + 18);
    const school = SCHOOLS[this.run.schoolId];
    let metaY = SAFE_TOP + 36;
    if (school && school.collegeSystem && this.run.semesterIndex < 2) {
      ctx.fillText(this.fitText('书院阶段：大一通识培养中，大二再细化方向', SCREEN_WIDTH - 24), 10, metaY);
      metaY += 18;
    }
    if (this.run.goals && this.run.goals.currentWeekGoal) {
      ctx.fillText(this.fitText(`本周目标是${this.run.goals.currentWeekGoal.title}`, SCREEN_WIDTH - 24), 10, metaY);
      metaY += 18;
    }

    const chrome = this.getPlaySceneChrome();
    this._playChrome = chrome;

    this.buttons = [];
    const pad = 16;
    const w = SCREEN_WIDTH - pad * 2;
    let y = metaY + 10;
    const contentBottom = chrome.contentBottom;

    if (this.run.phase === 'week_action') {
      this._weeklyScrollUi = null;
      ctx.fillStyle = uiTheme.colors.textMain;
      ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
      ctx.fillText('本周行动', 16, y);
      y += 26;

      if (this.weeklyShopOverlay) {
        this.renderWeeklyShopOverlay(pad, w, y, contentBottom);
      } else {
      const actions = this.getWeeklyActionChoices();
      const needsScroll = actions.length > WEEK_ACTION_MAX_VISIBLE;
      
      // 显示滚动指示器和滚动条
      if (needsScroll) {
        // 页面指示器
        ctx.fillStyle = uiTheme.colors.textSub;
        ctx.font = `${uiTheme.font.small}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(
          `${Math.floor(this.weeklyActionScroll / WEEK_ACTION_ROW_H) + 1}/${Math.ceil(actions.length / WEEK_ACTION_MAX_VISIBLE)}`,
          SCREEN_WIDTH - 16,
          y + 20,
        );
        ctx.textAlign = 'left';
        
        // 绘制自定义滚动条
        const scrollbarX = SCREEN_WIDTH - 24;
        const scrollbarY = y;
        const scrollbarHeight = WEEK_ACTION_MAX_VISIBLE * WEEK_ACTION_ROW_H;
        const scrollbarWidth = 8;
        const totalHeight = actions.length * WEEK_ACTION_ROW_H;
        const maxScroll = Math.max(0, totalHeight - scrollbarHeight);
        const thumbHeight =
          maxScroll <= 0 ? scrollbarHeight : Math.max(20, (scrollbarHeight / totalHeight) * scrollbarHeight);
        const thumbY =
          maxScroll <= 0
            ? scrollbarY
            : scrollbarY + (this.weeklyActionScroll / maxScroll) * (scrollbarHeight - thumbHeight);
        
        // 滚动条背景
        ctx.fillStyle = 'rgba(128, 128, 128, 0.3)';
        this.fillRoundRect(scrollbarX, scrollbarY, scrollbarWidth, scrollbarHeight, 4);
        
        // 滚动条滑块
        ctx.fillStyle = 'rgba(64, 64, 64, 0.8)';
        this.fillRoundRect(scrollbarX, thumbY, scrollbarWidth, thumbHeight, 4);

        this._weeklyScrollUi = {
          maxScroll,
          thumbH: thumbHeight,
          track: { x: scrollbarX - 10, y: scrollbarY, w: 28, h: scrollbarHeight },
        };
        this.buttons.push({
          id: 'weekly_scroll_up',
          x: SCREEN_WIDTH - 58,
          y: y,
          w: 30,
          h: 24,
          label: '↑',
          variant: 'secondary',
          disabled: this.weeklyActionScroll <= 0,
          onClick: () => {
            this.weeklyActionScroll = Math.max(0, this.weeklyActionScroll - WEEK_ACTION_SCROLL_STEP);
          },
        });
        this.buttons.push({
          id: 'weekly_scroll_down',
          x: SCREEN_WIDTH - 58,
          y: y + WEEK_ACTION_MAX_VISIBLE * WEEK_ACTION_ROW_H - 24,
          w: 30,
          h: 24,
          label: '↓',
          variant: 'secondary',
          disabled: this.weeklyActionScroll >= maxScroll,
          onClick: () => {
            this.weeklyActionScroll = Math.min(maxScroll, this.weeklyActionScroll + WEEK_ACTION_SCROLL_STEP);
          },
        });
      }
      
      // 计算可见的选项
      const startIndex = Math.floor(this.weeklyActionScroll / WEEK_ACTION_ROW_H);
      const endIndex = Math.min(startIndex + WEEK_ACTION_MAX_VISIBLE, actions.length);
      const visibleActions = actions.slice(startIndex, endIndex);
      
      visibleActions.forEach((action, index) => {
        const buttonId = `action_${action.id}`;
        const cost = Number(action.cost || 0);
        const afford = Number((this.run.stats && this.run.stats.money) || 0) >= cost;
        // 使用随机但固定的描述（用于说明框）
        const descKey = `${this.run.semesterIndex}_${this.run.weekIndex}_${action.id}`;
        const randomDesc = this.fixedActionDescriptions.get(descKey) || action.description;
        const pickContent = {
          title: action.title,
          subtitle: randomDesc || action.description || '暂无说明',
          effectSmall: cost > 0 ? `预计花费 ￥${cost}` : '预计花费 ￥0',
          metaSmall: afford ? '' : '资金不足，暂时无法选择',
          locked: !afford,
        };
        const expanded = !!(this.pendingTransition && this.pendingTransition.buttonId === buttonId);
        const detailH = expanded ? this.measurePickDetailPanelHeight(pickContent, w - 20) : 0;
        const rowH = 50 + (expanded ? (8 + detailH) : 0);
        if (y + rowH > contentBottom) return;

        this.buttons.push({
          id: buttonId,
          x: pad,
          y,
          w,
          h: 50,
          label: action.title,
          pickContent,
          pickDetailBelow: true,
          disabled: !afford,
          onClick: () => {
            if (Array.isArray(action.tags) && action.tags.includes('weekly_shop')) {
              this.openWeeklyShop(action);
              return;
            }
            this.queueTransition(buttonId, `你已选择本周行动，${action.title}`, () => this.handleWeeklyAction(action));
          },
        });
        y += rowH + 6;
      });
      
      // 在行动列表后添加滚动提示
      if (needsScroll) {
        const hintText = ' ↕ 滑动列表查看更多选项 ↕ ';
        const hintY = y + 12; // 添加呼吸感
        
        // 绘制纯文字提示，去掉背景
        ctx.fillStyle = 'rgba(185, 196, 224, 0.6)'; // 调暗文字颜色，加透明度
        ctx.font = `${uiTheme.font.small}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hintText, SCREEN_WIDTH / 2, hintY);
        ctx.textBaseline = 'top';
      }
      }
    } else {
      let eventObj = this.getCurrentEvent();
      if (!eventObj) {
        // 如果没有当前事件，根据阶段生成相应事件
        if (this.run.phase === 'main_event') {
          this.run.pendingMainEvent = this.pickMainForRun(this.run);
        } else if (this.run.phase === 'side_event') {
          this.run.pendingSideEvent = this.pickSideForRun(this.run);
        }
        // 重新获取事件对象
        const updatedEvent = this.getCurrentEvent();
        if (!updatedEvent) return; // 如果仍然没有事件，退出
        // 使用更新后的事件对象
        eventObj = updatedEvent;
      }
      
      if (eventObj) {
        this.maybeShowNpcPreChoiceNarrative(eventObj);
        const eventScrollKey = String(eventObj.id || '');
        if (this._playEventScrollKey !== eventScrollKey) {
          this._playEventScrollKey = eventScrollKey;
          this.playContentScroll = 0;
        }
        const contentTop = y;
        this.renderPlayEventBlock(eventObj, pad, w, y, contentTop, contentBottom);
      }
    }

    if (this.run.lastAttributeEffects && this.run.lastAttributeEffects.length) {
      const fxY = Math.max(metaY + 8, chrome.statsTop - 34);
      ctx.fillStyle = uiTheme.colors.warn;
      ctx.font = `${uiTheme.font.small}px sans-serif`;
      this.wrapText(this.run.lastAttributeEffects.join('；'), 16, fxY, SCREEN_WIDTH - 32, 16, 2);
    }

    const {
      rightColX,
      btnStackW,
      sideBtnH: btnH,
      relationsY,
      logY,
      invY,
      defaultContinueY,
      continueBtnH,
    } = chrome;

    if (this.pendingTransition) {
      const continueGap = 10;
      const continueW = Math.max(160, rightColX - pad - continueGap);
      this.buttons.push({
        id: 'play_continue',
        x: pad,
        y: defaultContinueY,
        w: continueW,
        h: continueBtnH,
        label: '确认并继续',
        variant: 'primary',
        disabled: false,
        onClick: () => this.commitPendingTransition(),
      });
    }
    this.buttons.push({
      id: 'open_relations',
      x: rightColX,
      y: relationsY,
      w: btnStackW,
      h: btnH,
      label: '关系',
      variant: 'secondary',
      disabled: false,
      onClick: () => {
        this.pushReturnScene();
        this.relationsScroll = 0;
        this.goScene('relations', { clearPending: false });
      },
    });

    this.buttons.push({
      id: 'open_run_log',
      x: rightColX,
      y: logY,
      w: btnStackW,
      h: btnH,
      label: '记录',
      variant: 'secondary',
      disabled: false,
      onClick: () => {
        this.pushReturnScene();
        this.runLogScroll = 0;
        this.goScene('run_log', { clearPending: false });
      },
    });

    this.buttons.push({
      id: 'open_inventory',
      x: rightColX,
      y: invY,
      w: btnStackW,
      h: btnH,
      label: '背包',
      variant: 'secondary',
      disabled: false,
      onClick: () => {
        this.pushReturnScene();
        this.goScene('inventory', { clearPending: false });
      },
    });

    this.buttons.push({
      id: 'play_back_safe',
      x: 16,
      y: relationsY,
      w: btnStackW,
      h: btnH,
      label: '返回主菜单',
      variant: 'secondary',
      disabled: false,
      onClick: () => this.confirmReturnToMenu(),
    });

    this.renderStatsPanel();
  }

  renderEnding() {
    this.drawSceneBackground();
    const e = this.currentEnding;
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.title}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(e ? e.title : '结局', SCREEN_WIDTH / 2, 48);
    const scroll = this.endingScroll || 0;
    let penY = 88 - scroll;
    const pad = 20;
    const textW = SCREEN_WIDTH - 40;
    const listTop = 80;
    const listBottom = SCREEN_HEIGHT - 120;
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad - 4, listTop - 4, textW + 8, listBottom - listTop + 8);
    ctx.clip();
    ctx.textAlign = 'left';
    if (e) {
      ctx.fillStyle = uiTheme.colors.textSub;
      ctx.font = `${uiTheme.font.body}px sans-serif`;
      const endingStory = this.buildEndingStoryText(e);
      penY = this.drawParagraphText(endingStory || '', pad, penY, textW, 22, 40);
    }
    if (this.runSettlement) {
      ctx.fillStyle = uiTheme.colors.textSub;
      ctx.font = `${uiTheme.font.small}px sans-serif`;
      penY += 12;
      penY = this.wrapText(
        this.formatRunSettlementText(this.runSettlement),
        pad,
        penY,
        textW,
        17,
        30,
      );
    }
    ctx.restore();
    const viewH = listBottom - listTop;
    const maxScroll = Math.max(0, penY - listBottom + 24);
    this._endingScrollMax = maxScroll;
    this.drawScrollIndicator(listTop, viewH, scroll, maxScroll);

    this.buttons = [];
    const w = SCREEN_WIDTH - pad * 2;
    this.buttons.push({
      x: pad, y: SCREEN_HEIGHT - 68, w, h: 44, label: '返回主菜单', disabled: false, onClick: () => {
        this.currentEnding = null;
        this.runSettlement = null;
        this.endingScroll = 0;
        this.goScene('menu');
      },
    });
    // 激励视频按钮已暂时注释
    // const adLabel = AD_CONFIG.rewardedEnabled ? '看激励视频（额外提示）' : '激励视频（开通后可用）';
    // this.buttons.push({
    //   x: pad, y: SCREEN_HEIGHT - 68, w, h: 40, label: adLabel, disabled: false, onClick: () => {
    //     showRewardedVideo('ending_bonus').then((r) => {
    //       this.showToast(r.ok ? '感谢支持！' : '未完成观看或暂未开通');
    //     });
    //   },
    // });
  }

  renderGallery() {
    this.drawSceneBackground();
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('结局图鉴', SCREEN_WIDTH / 2, 48);
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.fillText('点击下方文字可查看已解锁结局，支持上下滑动', SCREEN_WIDTH / 2, 74);

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
    const listTop = 92;
    const backBtnY = SCREEN_HEIGHT - 52;
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
        ctx.fillStyle = ok ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)';
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
          const descLines = this.splitWrappedLines(this.fitText(end.description, cardW - 24), cardW - 24, 2);
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
      y: SCREEN_HEIGHT - 52,
      w: SCREEN_WIDTH - 32,
      h: 40,
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
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('成就系统', SCREEN_WIDTH / 2, 48);
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.fillText('上下滑动查看更多', SCREEN_WIDTH / 2, 75);

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
    const listTop = 92;
    const backBtnY = SCREEN_HEIGHT - 52;
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
        ctx.fillStyle = ok ? 'rgba(115, 214, 127, 0.1)' : 'rgba(255,255,255,0.06)';
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

    this.buttons = [{ x: 16, y: SCREEN_HEIGHT - 52, w: SCREEN_WIDTH - 32, h: 40, label: '返回', variant: 'secondary', disabled: false, onClick: () => { this.goScene('menu'); } }];
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
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('CG 图鉴', SCREEN_WIDTH / 2, 48);
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.fillText('触发条件时会自动播放，完整观看一次后收录图鉴', SCREEN_WIDTH / 2, 74);
    const meta = save.loadMeta();
    const unlocked = new Set(meta.unlockedCgs || []);
    const order = new Map();
    (meta.cgUnlockOrder || []).forEach((it, idx) => {
      if (!it || !it.id) return;
      order.set(String(it.id), Number(it.ts || idx + 1));
    });
    (meta.unlockedCgs || []).forEach((id, idx) => {
      if (!order.has(id)) order.set(id, idx + 1);
    });
    const sorted = [...CG_CATALOG].sort((a, b) => {
      const ao = unlocked.has(a.id);
      const bo = unlocked.has(b.id);
      if (ao !== bo) return ao ? -1 : 1;
      if (ao && bo) return Number(order.get(b.id) || 0) - Number(order.get(a.id) || 0);
      return 0;
    });

    const listTop = 92;
    const backBtnY = SCREEN_HEIGHT - 52;
    const listBottom = backBtnY - 8;
    let y = listTop - this.cgScroll;
    this.cgHitAreas = [];
    this.buttons = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listTop, SCREEN_WIDTH, listBottom - listTop);
    ctx.clip();
    sorted.forEach((cg) => {
      const ok = unlocked.has(cg.id);
      const rowH = 102;
      const cardX = 16;
      const cardW = SCREEN_WIDTH - 32;
      if (y < listBottom + rowH && y > listTop - rowH) {
        ctx.fillStyle = ok ? 'rgba(120,190,255,0.14)' : 'rgba(255,255,255,0.06)';
        this.fillRoundRect(cardX, y, cardW, rowH, 10);
        ctx.strokeStyle = ok ? 'rgba(120,190,255,0.55)' : 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 1.2;
        this.strokeRoundRect(cardX, y, cardW, rowH, 10);
        ctx.fillStyle = ok ? uiTheme.colors.accent : uiTheme.colors.buttonDisabled;
        ctx.font = `bold ${uiTheme.font.body}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(ok ? cg.title : '？？？', SCREEN_WIDTH / 2, y + 16);
        ctx.fillStyle = uiTheme.colors.textSub;
        ctx.font = `${uiTheme.font.small}px sans-serif`;
        const desc = ok ? (cg.description || '已解锁 CG') : '触发并观看一次后显示';
        const lines = this.splitWrappedLines(desc, cardW - 24, 3);
        lines.forEach((line, idx) => {
          ctx.fillText(line, SCREEN_WIDTH / 2, y + 46 + idx * 16);
        });
        if (ok) this.cgHitAreas.push({ cg, x: cardX + 6, y: y + 6, w: cardW - 12, h: rowH - 12 });
      }
      y += rowH + 8;
    });
    ctx.restore();
    const maxScroll = Math.max(0, y - listBottom);
    this._cgScrollMax = maxScroll;
    this.cgScroll = Math.min(this.cgScroll, maxScroll);
    this.drawScrollIndicator(listTop, listBottom - listTop, this.cgScroll, maxScroll);
    this.buttons.push({
      x: 16,
      y: SCREEN_HEIGHT - 52,
      w: SCREEN_WIDTH - 32,
      h: 40,
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
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(cp.title || cg?.title || 'CG 回放', SCREEN_WIDTH / 2, 52);
    const cardX = 16;
    const cardY = 88;
    const cardW = SCREEN_WIDTH - 32;
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
      ctx.fillStyle = uiTheme.colors.textSub;
      ctx.font = `${uiTheme.font.body}px sans-serif`;
      ctx.fillText('CG 素材未找到（生成后放到 images/cg/）', SCREEN_WIDTH / 2, cardY + cardH / 2 - 8);
    }
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    this.wrapText(cp.description || cg?.description || '', cardX + 10, cardY + cardH + 12, cardW - 20, 18, 4);
    this.buttons = [{
      x: 16,
      y: SCREEN_HEIGHT - 52,
      w: SCREEN_WIDTH - 32,
      h: 40,
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
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('BGM 图鉴', SCREEN_WIDTH / 2, 48);
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.fillText('已解锁曲目点击卡片即可试听', SCREEN_WIDTH / 2, 74);
    const meta = save.loadMeta();
    const unlocked = new Set(meta.unlockedBgms || []);
    const playingKey = this.bgm && this.bgm.currentBgmName ? this.bgm.currentBgmName : '';
    this.bgmHitAreas = [];
    let y = 102;
    BGM_CATALOG.forEach((bgm) => {
      const ok = unlocked.has(bgm.id);
      const isPlaying = ok && playingKey === bgm.trackKey;
      const cardX = 16;
      const cardW = SCREEN_WIDTH - 32;
      const rowH = 84;
      ctx.fillStyle = isPlaying
        ? 'rgba(255,200,80,0.28)'
        : ok
          ? 'rgba(255,220,140,0.14)'
          : 'rgba(255,255,255,0.06)';
      this.fillRoundRect(cardX, y, cardW, rowH, 10);
      ctx.strokeStyle = isPlaying
        ? 'rgba(255,200,80,0.85)'
        : ok
          ? 'rgba(255,220,140,0.55)'
          : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = isPlaying ? 2 : 1.2;
      this.strokeRoundRect(cardX, y, cardW, rowH, 10);
      ctx.fillStyle = ok ? uiTheme.colors.textMain : uiTheme.colors.buttonDisabled;
      ctx.font = `bold ${uiTheme.font.body}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(ok ? bgm.title : '？？？', cardX + 12, y + 16);
      if (ok) {
        ctx.fillStyle = isPlaying ? 'rgba(255,220,140,0.95)' : uiTheme.colors.textSub;
        ctx.font = `${uiTheme.font.small}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(isPlaying ? '播放中' : '点击播放', cardX + cardW - 12, y + 18);
      }
      ctx.fillStyle = uiTheme.colors.textSub;
      ctx.font = `${uiTheme.font.small}px sans-serif`;
      ctx.textAlign = 'left';
      const line = ok ? `音轨 ID：${bgm.id}` : `解锁提示：${bgm.hint || '进入相关场景'}`;
      this.wrapText(line, cardX + 12, y + 40, cardW - 24, 16, 2);
      if (ok) this.bgmHitAreas.push({ bgm, x: cardX + 6, y: y + 6, w: cardW - 12, h: rowH - 12 });
      y += rowH + 10;
    });
    this.buttons = [{
      x: 16,
      y: SCREEN_HEIGHT - 52,
      w: SCREEN_WIDTH - 32,
      h: 40,
      label: '返回',
      variant: 'secondary',
      disabled: false,
      onClick: () => this.goScene('menu'),
    }];
  }

  renderCredits() {
    this.drawSceneBackground();
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('致谢', SCREEN_WIDTH / 2, 48);
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.fillText(CREDITS_ACK.intro, SCREEN_WIDTH / 2, 76);

    const listTop = 104;
    const backBtnY = SCREEN_HEIGHT - 52;
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
      h: 40,
      label: '返回',
      variant: 'secondary',
      disabled: false,
      onClick: () => this.goScene('menu'),
    });
  }

  renderSettings() {
    this.drawSceneBackground();
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('设置', SCREEN_WIDTH / 2, 48);
    ctx.font = `${uiTheme.font.body}px sans-serif`;
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.fillText(`BGM 音量：${Math.round(this.bgm.volume * 100)}%`, SCREEN_WIDTH / 2, 114);
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.fillStyle = uiTheme.colors.textSub;
    const hint = getShareTimelineHint();
    this.wrapText(hint, 20, 138, SCREEN_WIDTH - 40, 16, 48);

    this.buttons = [];
    const pad = 16;
    const w = SCREEN_WIDTH - 32;
    let y = 228;
    this.buttons.push({
      id: 'settings_volume_down',
      x: pad,
      y,
      w: Math.floor((w - 8) / 2),
      h: 42,
      label: '音量 -10%',
      variant: 'secondary',
      disabled: false,
      onClick: () => this.setBgmVolume(this.bgm.volume - 0.1),
    });
    this.buttons.push({
      id: 'settings_volume_up',
      x: pad + Math.floor((w - 8) / 2) + 8,
      y,
      w: Math.floor((w - 8) / 2),
      h: 42,
      label: '音量 +10%',
      variant: 'secondary',
      disabled: false,
      onClick: () => this.setBgmVolume(this.bgm.volume + 0.1),
    });
    y += 52;
    this.buttons.push({
      id: 'settings_toggle_mute',
      x: pad,
      y,
      w,
      h: 42,
      label: this.bgm.muted ? '取消静音' : '静音',
      disabled: false,
      onClick: () => {
        const muted = this.bgm.toggleMute();
        save.saveAudioPrefs({ muted, volume: this.bgm.volume });
      },
    });
    y += 52;
    this.buttons.push({
      id: 'settings_clear_cache',
      x: pad,
      y,
      w,
      h: 42,
      label: '清除缓存重新开始',
      variant: 'danger',
      disabled: false,
      onClick: () => this.confirmClearCache(),
    });
    this.buttons.push({
      id: 'settings_back',
      x: pad,
      y: SCREEN_HEIGHT - 56,
      w,
      h: 40,
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
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('背包', SCREEN_WIDTH / 2, SAFE_TOP);
    const inventory = Array.isArray(this.run.inventory) ? this.run.inventory : [];
    this.buttons = [];
    const pad = 16;
    const w = SCREEN_WIDTH - 32;
    const listTop = SAFE_TOP + 34;
    const listBottom = SCREEN_HEIGHT - 56;
    let y = listTop;
    if (!inventory.length) {
      ctx.fillStyle = uiTheme.colors.textSub;
      ctx.font = `${uiTheme.font.body}px sans-serif`;
      ctx.fillText('当前没有物品', SCREEN_WIDTH / 2, y + 24);
      y += 56;
    } else {
      inventory.slice(0, 5).forEach((itemId, i) => {
        const item = itemsCatalog.find((it) => it.id === itemId);
        if (!item) return;
        const rowH = 72;
        const cardX = 16;
        const cardW = SCREEN_WIDTH - 32;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        this.fillRoundRect(cardX, y, cardW, rowH, 10);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1.2;
        this.strokeRoundRect(cardX, y, cardW, rowH, 10);

        const tagX = cardX + 10;
        const tagY = y + 10;
        const tagW = 42;
        const tagH = 20;
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        this.fillRoundRect(tagX, tagY, tagW, tagH, 6);
        ctx.fillStyle = uiTheme.colors.textSub;
        ctx.font = `bold ${uiTheme.font.small}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('道具', tagX + tagW / 2, tagY + tagH / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = uiTheme.colors.textMain;
        ctx.font = `bold ${uiTheme.font.body}px sans-serif`;
        ctx.fillText(item.name, cardX + 12, y + 44);
        ctx.fillStyle = uiTheme.colors.textSub;
        ctx.font = `${uiTheme.font.small}px sans-serif`;
        this.wrapText(item.description || '暂无描述', cardX + 12, y + 60, cardW - 24, 15, 1);
        this.buttons.push({
          id: `inventory_item_${i}`,
          x: cardX,
          y,
          w: cardW,
          h: rowH,
          label: '',
          invisible: true,
          variant: 'secondary',
          disabled: false,
          onClick: () => this.handleUseItem(i),
        });
        y += rowH + 8;
      });
    }
    this.buttons.push({
      id: 'inventory_back',
      x: 16,
      y: SCREEN_HEIGHT - 52,
      w: SCREEN_WIDTH - 32,
      h: 36,
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
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('本局记录', SCREEN_WIDTH / 2, SAFE_TOP);
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.fillText('按时间从新到旧展示，可上下滑动', SCREEN_WIDTH / 2, SAFE_TOP + 22);

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
    const listTop = SAFE_TOP + 52;
    const listBottom = SCREEN_HEIGHT - 56;
    this._runLogScrollUi = { listTop, listBottom };
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
      y: SCREEN_HEIGHT - 52,
      w: SCREEN_WIDTH - 32,
      h: 40,
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
    this.buttons.forEach((b) => this.drawButton(b));
    if (this.toast && Date.now() < this.toast.until) {
      const toastChrome = this.scene === 'play' ? (this._playChrome || this.getPlaySceneChrome()) : null;
      const toastY = toastChrome ? toastChrome.statsTop - 44 : SCREEN_HEIGHT - 220;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(16, toastY, SCREEN_WIDTH - 32, 30);
      ctx.fillStyle = '#fff';
      ctx.font = `${uiTheme.font.small}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.toast.text, SCREEN_WIDTH / 2, toastY + 15);
    } else if (this.toast && Date.now() >= this.toast.until) {
      this.toast = null;
    }
    if (this.narrative) {
      this.renderNarrativeOverlay();
    }
  }

  renderNarrativeOverlay() {
    const n = this.narrative;
    const pad = 20;
    const w = SCREEN_WIDTH - pad * 2;
    const overlayH = Math.min(SCREEN_HEIGHT - 120, 420);
    const ox = pad;
    const oy = (SCREEN_HEIGHT - overlayH) / 2 - 50;

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 尝试使用背景图片
    const bgAsset = this.assets.ui_panel_bg;
    if (bgAsset && bgAsset.__ready && !bgAsset.__failed) {
      ctx.drawImage(bgAsset, ox, oy, w, overlayH);
      // 添加半透明遮罩确保文字可读性
      ctx.fillStyle = 'rgba(24, 16, 10, 0.3)';
      ctx.fillRect(ox, oy, w, overlayH);
    } else {
      // 备用纯色背景
      ctx.fillStyle = uiTheme.colors.panel || '#2d3550';
      ctx.fillRect(ox, oy, w, overlayH);
    }

    // 绘制边框
    ctx.strokeStyle = uiTheme.colors.accent || '#ffd166';
    ctx.lineWidth = 2;
    const r = uiTheme.radius?.md || 12;
    ctx.beginPath();
    ctx.moveTo(ox + r, oy);
    ctx.lineTo(ox + w - r, oy);
    ctx.arcTo(ox + w, oy, ox + w, oy + r, r);
    ctx.lineTo(ox + w, oy + overlayH - r);
    ctx.arcTo(ox + w, oy + overlayH, ox + w - r, oy + overlayH, r);
    ctx.lineTo(ox + r, oy + overlayH);
    ctx.arcTo(ox, oy + overlayH, ox, oy + overlayH - r, r);
    ctx.lineTo(ox, oy + r);
    ctx.arcTo(ox, oy, ox + r, oy, r);
    ctx.closePath();
    ctx.stroke();

    // 添加装饰星星
    const starAsset = this.assets.star;
    if (starAsset && starAsset.__ready && !starAsset.__failed) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(starAsset, ox + 10, oy + 10, 20, 20);
      ctx.drawImage(starAsset, ox + w - 30, oy + 10, 20, 20);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = uiTheme.colors.textMain || '#fff';
    ctx.font = `${uiTheme.font.body}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const hasOptions = Array.isArray(n.options) && n.options.length > 0;
    const btnW = 120;
    const btnH = 36;
    const btnX = ox + (w - btnW) / 2;
    const btnY = oy + overlayH - btnH - 16;
    const optionRowH = 42;
    const optionGap = 8;
    const optionsTotalH = hasOptions ? n.options.length * optionRowH + (n.options.length - 1) * optionGap : 0;
    const optionTop = oy + overlayH - 16 - optionsTotalH;
    const statusAreaY = hasOptions ? optionTop - 8 : btnY - 35;

    let ty = oy + 18;
    const maxW = w - 32;
    const lineH = uiTheme.lineHeight?.body || 19;
    
    // 计算文本可用的高度，为状态变化区域预留空间
    const maxTextHeight = statusAreaY - ty - 10;
    const maxTextLines = Math.floor(maxTextHeight / lineH);
    this.drawParagraphText(n.text, ox + 16, ty, maxW, lineH, maxTextLines);

    // 状态变化标签固定在按钮上方
    if (n.changes && n.changes.length) {
      ctx.fillStyle = uiTheme.colors.textSub || '#e7d7c4';
      ctx.font = `${uiTheme.font.small}px sans-serif`;
      let cx = ox + 16;
      let cy = statusAreaY;
      
      n.changes.forEach((ch) => {
        const tw = ctx.measureText(ch.label).width;
        // 检查是否会超出边界
        if (cx + tw + 8 > ox + w - 16) {
          cx = ox + 16;
          cy += 22;
          // 如果状态变化太多，可能会超出按钮区域，这里做简单保护
          if (cy >= btnY - 5) return;
        }
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(cx - 4, cy - 2, tw + 8, 18);
        ctx.fillStyle = ch.color || uiTheme.colors.textSub;
        ctx.fillText(ch.label, cx, cy);
        cx += tw + 14;
      });
    }

    if (hasOptions) {
      n.optionRects = [];
      n.options.forEach((op, idx) => {
        const by = optionTop + idx * (optionRowH + optionGap);
        const bx = ox + 18;
        const bw = w - 36;
        ctx.fillStyle = op.variant === 'danger' ? 'rgba(210,80,80,0.88)' : (uiTheme.colors.accent || '#ffd166');
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        this.fillRoundRect(bx, by, bw, optionRowH, 8);
        this.strokeRoundRect(bx, by, bw, optionRowH, 8);
        ctx.fillStyle = '#1a1a2e';
        ctx.font = `bold ${uiTheme.font.body}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.fitText(op.label, bw - 18), bx + bw / 2, by + optionRowH / 2);
        n.optionRects.push({ x: bx, y: by, w: bw, h: optionRowH, onSelect: op.onSelect });
      });
      n.btnRect = null;
    } else {
      ctx.fillStyle = uiTheme.colors.accent || '#ffd166';
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      const br = 8;
      ctx.beginPath();
      ctx.moveTo(btnX + br, btnY);
      ctx.lineTo(btnX + btnW - br, btnY);
      ctx.arcTo(btnX + btnW, btnY, btnX + btnW, btnY + br, br);
      ctx.lineTo(btnX + btnW, btnY + btnH - br);
      ctx.arcTo(btnX + btnW, btnY + btnH, btnX + btnW - br, btnY + btnH, br);
      ctx.lineTo(btnX + br, btnY + btnH);
      ctx.arcTo(btnX, btnY + btnH, btnX, btnY + btnH - br, br);
      ctx.lineTo(btnX, btnY + br);
      ctx.arcTo(btnX, btnY, btnX + br, btnY, br);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#1a1a2e';
      ctx.font = `bold ${uiTheme.font.body}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('确定', btnX + btnW / 2, btnY + btnH / 2);
      this.narrative.btnRect = { x: btnX, y: btnY, w: btnW, h: btnH };
    }
  }

  loop() {
    this.render();
    requestAnimationFrame(this.loop.bind(this));
  }

  renderRelations() {
    if (!this.run) {
      this.returnScene = null;
      this.goScene('menu', { clearPending: false });
      return;
    }
    this.drawSceneBackground();
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('关系网', SCREEN_WIDTH / 2, SAFE_TOP);
    this.ensureNpcUnlockState();
    this.pruneRelationshipUnlocks();
    const scroll = this.relationsScroll || 0;
    const listTop = SAFE_TOP + 72;
    const listBottom = SCREEN_HEIGHT - 56;
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
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.textAlign = 'center';
    if (rows.length) {
      ctx.fillText(`已结识 ${rows.length} 人`, SCREEN_WIDTH / 2, SAFE_TOP + 28);
    }
    if (!rows.length) {
      ctx.fillStyle = uiTheme.colors.textSub;
      ctx.font = `${uiTheme.font.body}px sans-serif`;
      ctx.textAlign = 'center';
      this.wrapText('关系网暂时为空。继续推进周行动并触发剧情，可逐步认识室友与学长姐；选定导师或心动对象后，他们才会出现在这里。', 24, listTop + 8, SCREEN_WIDTH - 48, 20, 5);
      y = listTop + 150;
    }
    rows.forEach((row) => {
      if (y > listBottom || y < listTop - 40) {
        y += 72;
        return;
      }
      ctx.fillStyle = uiTheme.colors.textMain;
      ctx.font = `bold ${uiTheme.font.body}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(`${row.n.name}，${row.label}`, 16, y);
      ctx.fillStyle = uiTheme.colors.textSub;
      ctx.font = `${uiTheme.font.small}px sans-serif`;
      this.wrapText(this.fitText(row.line, SCREEN_WIDTH - 40), 16, y + 20, SCREEN_WIDTH - 32, 16, 2);
      const barY = y + 52;
      const barW = SCREEN_WIDTH - 32;
      ctx.fillStyle = uiTheme.colors.panelSoft;
      ctx.fillRect(16, barY, barW, 6);
      ctx.fillStyle = uiTheme.colors.good;
      ctx.fillRect(16, barY, (barW * row.aff) / 100, 6);
      y += 72;
    });
    const maxScroll = Math.max(0, y - listBottom + scroll);
    this._relationsScrollMax = maxScroll;
    this.drawScrollIndicator(listTop, listBottom - listTop, scroll, maxScroll);
    this.buttons = [
      {
        id: 'relations_back_bottom',
        x: 16,
        y: SCREEN_HEIGHT - 52,
        w: SCREEN_WIDTH - 32,
        h: 40,
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
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(ep.title || ending?.title || '结局回放', SCREEN_WIDTH / 2, 52);
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.fillText('已解锁结局全文', SCREEN_WIDTH / 2, 78);

    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `${uiTheme.font.body}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    this.drawParagraphText(ep.fullText || '暂无结局内容', 20, 102, SCREEN_WIDTH - 40, 22, 14);
    this.buttons = [];
    const pad = 16;
    const w = SCREEN_WIDTH - pad * 2;
    this.buttons.push({
      x: pad,
      y: SCREEN_HEIGHT - 112,
      w,
      h: 40,
      label: '返回图鉴',
      variant: 'primary',
      onClick: () => {
        this.endingPlayback = null;
        this.goScene('gallery', { clearPending: true });
      },
    });
  }

  renderAchievementPlayback() {
    const ap = this.achievementPlayback;
    if (!ap) {
      this.goScene('achievements', { clearPending: true });
      return;
    }
    const achievement = achievementsCatalog.find((x) => x.id === ap.achievementId);
    this.drawSceneBackground();
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `bold ${uiTheme.font.h2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(ap.title || achievement?.title || '成就详情', SCREEN_WIDTH / 2, 52);
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `${uiTheme.font.small}px sans-serif`;
    ctx.fillText('已达成成就详情', SCREEN_WIDTH / 2, 78);

    const cardX = 16;
    const cardW = SCREEN_WIDTH - 32;
    const storyY = 102;
    const storyH = 270;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    this.fillRoundRect(cardX, storyY, cardW, storyH, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.2;
    this.strokeRoundRect(cardX, storyY, cardW, storyH, 10);
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `${uiTheme.font.body}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    this.drawParagraphText(ap.storyText || '暂无成就内容', cardX + 12, storyY + 12, cardW - 24, 21, 10);

    const condY = storyY + storyH + 10;
    const condH = 82;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    this.fillRoundRect(cardX, condY, cardW, condH, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    this.strokeRoundRect(cardX, condY, cardW, condH, 10);
    ctx.fillStyle = uiTheme.colors.textSub;
    ctx.font = `bold ${uiTheme.font.small}px sans-serif`;
    ctx.fillText('达成条件', cardX + 12, condY + 10);
    ctx.fillStyle = uiTheme.colors.textMain;
    ctx.font = `${uiTheme.font.small}px monospace`;
    this.wrapText(ap.conditionText || '暂无条件描述', cardX + 12, condY + 30, cardW - 24, 18, 3);

    this.buttons = [];
    const pad = 16;
    const w = SCREEN_WIDTH - pad * 2;
    this.buttons.push({
      x: pad,
      y: SCREEN_HEIGHT - 112,
      w,
      h: 40,
      label: '返回成就列表',
      variant: 'primary',
      onClick: () => {
        this.achievementPlayback = null;
        this.goScene('achievements', { clearPending: true });
      },
    });
  }
}
