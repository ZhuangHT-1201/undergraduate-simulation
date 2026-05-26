/**
 * One-off: rewrite achievement descriptions (flavor text, no duplicates).
 * Run: node tools/update-achievement-descriptions.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const DESCRIPTIONS = {
  ach_first_run:
    '你第一次把四年跑完结算——未必完美，但学籍终于盖上了「存活确认章」。',
  ach_hardcore:
    '闭馆音乐响起时你还在，压力表与能力条同时飙红，像给图书馆交了通宵租金。',
  ach_romance_route:
    '恋爱线没有拖垮学业：你把心动写进日常，也把毕业证写进现实。',
  ach_intern_ready:
    '简历从空白页变成可投递版本，HR 邮箱在你眼里比表白墙更值得刷新。',
  ach_civil_track:
    '申论素材、面试礼仪与编制结局在同一条时间线上汇合，你终于把「上岸」从梗变成存档。',
  ach_student_work:
    '班委群消息你总能第一个回「收到」，活动台账厚得像第二本培养方案。',
  ach_cert_grind:
    '考场门口的风、准考证上的汗，被你叠成两张证——别人晒旅游，你晒及格截图。',
  ach_research_path:
    '组会、补实验、改图到凌晨——实验室的灯比你寝室的更早下班。',
  ach_contest_path:
    '周末赛程表比课表还密，你在答辩 PPT 与奖状边框之间反复横跳。',
  ach_dorm_survivor:
    '熄灯后的寝室政治、卫生轮值与夜谈你都扛过来了，体检单仍写得过去。',
  ach_finance_rookie:
    '第一次认真记账、定投或研究基金条款——钱包开始听你的，而不是只听促销。',
  ach_finance_pro:
    '毕业时账户余额让人安心，你终于能在「吃土」与「下馆子」之间按下暂停键。',
  ach_budget_master:
    '花钱克制、心态松弛：你把日子过成低压力高结余的可持续版本。',
  ach_iron_body:
    '熬夜、外卖与焦虑都没把你击倒，健康条亮得像体测满分的彩蛋。',
  ach_social_star:
    '聚会、社团、饭局与协作里你都是发光体——人脉不是 KPI，却真的在涨。',
  ach_skill_peak:
    '硬技能拉满，简历上的项目与作品会说话，比「我很努力」更有说服力。',
  ach_gpa_top:
    '绩点高到让同学怀疑你偷偷开了倍速，你知道那只是长期交付的回执。',
  ach_low_stress_grad:
    '别人卷到耳鸣，你仍保持松弛感通关——不是躺平，是节奏感赢麻了。',
  ach_cross_major_survive:
    '跨专业像重装系统：课表、黑话、社交圈全换，你仍把毕业协议签了下来。',
  ach_research_grit:
    '科研线没因为高压而断档，你在实验失败与 deadline 之间练出耐受度。',
  ach_intern_balance:
    '实习打卡、通勤与加班没有掏空身体，你还留得出力给期末与睡眠。',
  ach_public_service:
    '考公或考编的旗标被点亮，稳定路线从幻想变成可执行的投递清单。',
  ach_romance_and_career:
    '约会与刷题、牵手与面试被你排进同一张日历，爱情与能力都在线。',
  ach_item_collector:
    '道具、补给与生活向选择被你玩出收益，背包像第二套技能树。',
  ach_resilience:
    '压力爆表仍没退学——你把「扛住」写进结局，比鸡汤更硬。',
  ach_story_explorer:
    '考证、竞赛、科研你都沾过边，像刻意把校园 DLC 全图点亮了一角。',
  ach_discipline:
    '军校式的节奏压在身上，你却用纪律换到高健康毕业——硬骨头也是骨头。',
  ach_global_vision:
    '外语院校的语境里，你把口语、社交与专业能力练成一套出口套餐。',
  ach_artistic_soul:
    '美院空气里压力不高、作品很硬，你用创作而不是焦虑证明自己。',
  ach_practical_expert:
    '职校路线里技能与现金流双高，动手比画饼更早兑现成工资条。',
  ach_agricultural_innovator:
    '农林院校的田野与课题同行，科研进度与健康一起撑过了长线季节。',
  ach_justice_guardian:
    '政法院校里你把考公意向走到底，社交与法治素养像一套制服内外兼修。',
  ach_roommate_trio:
    '宿舍线推进两轮以上，闹过别扭也讲过夜话，最后还能笑着拍毕业照。',
  ach_mentor_chosen:
    '主导师在本局被写进名册，从此组会、推荐信与方向感都有了具体名字。',
  ach_crush_line_open:
    '恋爱承诺线正式加载：心动不再是随机事件，而是会分叉的主线任务。',
  ach_crush_skipped:
    '你主动跳过恋情开局，仍顺利毕业——把精力留给绩点、实习或自我升级。',
  ach_npc_events_light:
    '校园里几个 NPC 的专属剧情被你轻轻触发，关系网从陌生变成有回声。',
  ach_npc_events_dense:
    '人际支线被你频繁点开，对话、抉择与后续像连续剧一样连载。',
  ach_npc_events_whale:
    'NPC 互动计数爆表，你几乎把可遇见的人都聊成了「熟脸模组」。',
  ach_canteen_regular:
    '食堂、道具与生活消费被你玩成循环——胃和钱包都记得你的口味。',
  ach_library_streak:
    '高压之下绩点仍稳在高位，像连续七天抢到靠窗座位的精神胜利版。',
  ach_four_am_canteen:
    '极端夜猫作息把压力推到红线，身体却勉强撑过毕业线——食堂阿姨见过你最后一碗面。',
  ach_ambiguous_three:
    '恋爱、社交与健康没有互相拆台，暧昧与自律被你调成可并存的音量。',
  ach_startup_dual:
    '创业脑洞与恋爱线同时成立，你们讨论股权比例时也不忘讨论晚饭吃啥。',
  ach_mentor_research_combo:
    '导师旗标叠上科研轨，课题组从此把你登记为「常驻人口」。',
  ach_off_campus_adult:
    '外宿生活教会你水电、通勤与独处，压力却没失控——早熟但不脆皮。',
  ach_cross_major_hero:
    '转专业后绩点仍过线，像在新赛道跑完一场补考马拉松。',
  ach_finance_literate:
    '理财进度拉满，你分得清复利、风险与冲动消费，钱包有了说明书。',
  ach_civil_marathon:
    '考公路线走长程，刷题、模考与材料准备像赛季一样一季季推进。',
  ach_teach_track_shadow:
    '学生工作与考编意向并行，你已经在讲台上预演过「老师」这个皮肤。',
  ach_intern_coffee_life:
    '实习就绪且存款尚可，咖啡续命的日子至少不用为房租失眠。',
  ach_contest_resume_king:
    '竞赛履历与硬技能双高，奖状还没裱框，简历已经先亮了一格。',
  ach_cert_wall_planner:
    '考证墙规划到位，压力虽大却可控——你知道哪张证下一季该上场。',
  ach_mentor_letter_runner:
    '导师信件类互动被解锁，推荐信从传说变成可以追的进度条。',
  ach_bigtech_relaxed:
    '大厂意向有了，心态却没被卷碎——高压 OFF，投递 ON。',
  ach_bigtech_stress:
    '大厂路线与燃烧版作息绑定，你用健康条换面试轮次，像最后一季的排位赛。',
  ach_postgrad_lock_in:
    '推免锁档成功且绩点漂亮，深造副本从「可能」变成系统通知里的确定项。',
  ach_research_stack:
    '科研进度叠满三层，实验记录比日记还厚，组会 PPT 可以当枕头垫。',
  ach_balanced_human:
    '绩点、能力、社交、健康都在中高位，像五边形战士故意留了一角给睡觉。',
  ach_money_saver_soul:
    '低开支心态配上高存款收官，抠门不是吝啬，是给未来留缓冲条。',
  ach_end_npc_mentor_postdoc_track:
    '你打出了导师盖章的深造向结局——实验室的门没关，只是换了一条更长的走廊。',
  ach_end_npc_startup_couple_mvp:
    '情侣档创业双线结局解锁：合伙协议与牵手照出现在同一份文件夹里。',
  ach_end_npc_event_chain_master:
    '高密 NPC 互动结局落地，校园像开放世界，而你几乎清完了人际支线。',
  ach_hidden_low_key_legend:
    '社交曝光极低，绩点却极高——低调传说不需要朋友圈，只需要成绩单。',
  ach_hidden_full_pack:
    '道具用得多，考证与竞赛也各有一脚，你把生活与卷塞进同一只背包还能拉上拉链。',
  ach_mentor_pick:
    '双选或意向流程走完，主导师从「待定」变成名册上的确定 ID。',
  ach_partner_lock:
    '恋爱候选里你锁定了唯一心动对象，暧昧池从此只剩一条可攻略线。',
  ach_npc_events_1:
    '第一次触发 NPC 专属事件，像关系网里亮了一盏小灯：原来路人也有剧本。',
  ach_npc_events_3:
    '三次 NPC 专属互动后，校园地图开始对你显示隐藏对话选项。',
  ach_npc_events_5:
    '五条人际支线被你串联，剧情密度从「偶遇」升级成「连载」。',
  ach_roommate_night:
    '宿舍向周行动累计到位，夜谈、值日或寝室副本都成了可复盘记忆。',
  ach_startup_intent:
    '创业意向旗标被实名点亮，商业计划书还粗糙，但脑洞已经注册成立。',
  ach_off_campus:
    '外宿路线通关：通勤、房租与独居噪声都被你写进毕业存档的备注栏。',
  ach_romance_skip:
    '单身主线照样毕业，你把「暂不恋爱」当成策略而不是遗憾。',
  ach_bigtech_flag:
    '大厂职业旗标触发，秋招列表里多了几个让人失眠又兴奋的名字。',
  ach_postgrad_flag:
    '保研/推免相关旗标锁定，深造副本进入「待启动」而不是「待许愿」。',
  ach_civil_double:
    '考公与考编意向同时触及，编制宇宙在你眼里像可切换的双开窗口。',
  ach_money_grind:
    '存款很高，压力也不低——搞钱系练习生用焦虑换余额，至少账单好看。',
  ach_social_butterfly_end:
    '毕业时社交条仍爆表，典礼合影里你总在 C 位边缘发着人缘光。',
  ach_chill_still_pass:
    '低压掠过终点线：绩点够毕业、心态够松，像慢跑冲线而非冲刺。',
  ach_auntie_regular:
    '生活向周行动高频发生，食堂阿姨认得你的脸，记账本认得你的笔迹。',
  ach_dawn_canteen:
    '凌晨四点食堂只剩你，压力与健康对赌仍通关——夜猫子的毕业证带油烟味。',
  ach_contest_one_shot:
    '竞赛进度停在恰好一场，像只打了一单就收手的「比赛体验版」通关者。',
  ach_cert_only:
    '考证线突出、竞赛线为零，你把精力押在证书墙而不是赛场横幅。',
  ach_intern_no_lab:
    '实习 offer 到手却远离实验室，职业路线清晰：写字楼比通风橱更适合你。',
  ach_work_life_meme:
    '学生工作与社会能力双高，周会里你是潜水员，活动外你是发光体。',
  ach_finance_roller:
    '理财与高压并存仍毕业，基金涨跌教会你心态管理，比课堂更刺激。',
  ach_low_money_high_skill:
    '钱包瘪、技能硬——穷没有削弱你的底气，反而把能力磨成显眼包。',
  ach_gpa_mid_social_high:
    '绩点中等、人缘顶尖，你用聚会与协作补上了成绩单没写满的那一格。',
  ach_hidden_walk:
    '操场遛弯哲学家：健康与低压双赢，你把焦虑卸载给晚风和步数。',
  ach_polyglot_end:
    '外语院校气氛组毕业，社交条高到像自带翻译器与派对入场券。',
  ach_art_laid_back:
    '美院松弛战士：低压通关，技能仍在线，创作节奏比焦虑跑得稳。',
  ach_vocational_hands:
    '职校动手能力王：实训与作品堆出技能条，手上功夫比口号先兑现。',
  ach_ai_major_cs:
    '人工智能专业高压通关，炼丹炉与 deadline 并存，你仍把模型与绩点一起训出来了。',
  ach_law_civil:
    '警察学院里考公双押落地，法治素养与上岸意向写进同一份毕业叙事。',
  ach_med_grind:
    '医学式长线苦行：技能硬、压力高、健康偏低，像用身体换一张迟到的通关证。',
  ach_cross_and_love:
    '跨专业挑战与恋爱线同时成立，课业重装系统时仍有人陪你熬夜改简历。',
  ach_full_flags_triple:
    '实习、科研、竞赛三线各至少打卡一次，校园主线被你玩成全景收藏模式。',
};

function patchCatalog(achievements) {
  const catalogPath = path.join(root, 'js/data/catalog.js');
  let text = fs.readFileSync(catalogPath, 'utf8');
  text = text.replace(
    /export const achievementsCatalog = \[[\s\S]*?\];/,
    `export const achievementsCatalog = ${JSON.stringify(achievements)};`,
  );
  fs.writeFileSync(catalogPath, text);
}

function main() {
  const achPath = path.join(root, 'config/v1/achievements.json');
  const achievements = JSON.parse(fs.readFileSync(achPath, 'utf8'));
  const missing = [];
  let updated = 0;

  for (const ach of achievements) {
    const desc = DESCRIPTIONS[ach.id];
    if (!desc) {
      missing.push(ach.id);
      continue;
    }
    if (ach.description !== desc) {
      ach.description = desc;
      updated += 1;
    }
  }

  const dupes = Object.values(DESCRIPTIONS).filter(
    (d, i, arr) => arr.indexOf(d) !== i,
  );
  if (dupes.length) {
    console.error('Duplicate descriptions in map:', dupes);
    process.exit(1);
  }

  if (missing.length) {
    console.error('Missing descriptions for:', missing.join(', '));
    process.exit(1);
  }

  if (Object.keys(DESCRIPTIONS).length !== achievements.length) {
    const extra = Object.keys(DESCRIPTIONS).filter(
      (id) => !achievements.some((a) => a.id === id),
    );
    if (extra.length) console.warn('Extra keys in map (ignored):', extra.join(', '));
  }

  fs.writeFileSync(achPath, JSON.stringify(achievements, null, 2) + '\n');
  patchCatalog(achievements);
  console.log(`OK: ${achievements.length} achievements, ${updated} descriptions updated`);
}

main();
