/**
 * Removes placeholder bulk entries; appends themed endings (40) and achievements (36).
 * Run from repo root: node tools/refresh-endings-achievements.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const desc = (a, b, c) => `${a}${b}${c}`;

const newEndings = [
  { id: 'end_love_grad_together', priority: 27, title: '恋人与毕业证同一批到货', description: desc('毕业照里你们站得很近，像把四年里没说完的甜都压进一帧。朋友调侃你们像「官方周边」，你笑着把话头接住，心里却认真：能一起把恋爱谈过论文与租房合同，比任何校园剧都难演。', '招聘季你们互相改简历、互相撑过面试凉经，把「我们」写进了各自的城市选择里。', '随手截图可以丢进相册，但一起扛过的焦虑与期待，只可能写进人生。'), epilogue: '五年后你们仍习惯共享日历与番茄钟，偶尔吵到想分房，最后分的是谁去扔垃圾。', conditions: { all: [{ flag: 'romanceCommitted' }, { stat: 'social', gte: 58 }, { stat: 'gpa', gte: 2.7 }, { stat: 'health', gte: 40 }] } },
  { id: 'end_mentor_recommend', priority: 27, title: '导师递来的那张纸', description: desc('主导师在组会散场后叫住你，把推荐信封好递过来，像把一条隐形的线系在你和下一程之间。你想起那些熬夜补的图、被批注到体无完肤的摘要，以及某次组会后他请你喝的那杯并不好喝的速溶。', '秋招或保研材料的文件夹里，这封信比别人家的段子更早把你送进下一轮；别人说贵人相助，你更愿意相信是长期交付换到的「流程感很好」之外的那一点真。', '「导师是第一生产力」终于从一句口头禅，变成了可执行文件。'), epilogue: '五年后你在行业群里看到导师转发顶会链接，顺手点了个赞，彼此都没说话。', conditions: { all: [{ flag: 'primaryMentor' }, { stat: 'skill', gte: 68 }, { stat: 'gpa', gte: 3.1 }] } },
  { id: 'end_roommate_founders', priority: 26, title: '寝室三人组创业试水', description: desc('你们把宿舍夜谈里的点子搬进了工商注册表，股权比例吵得像分锅包肉。路演被怼、合同踩坑、供应链翻车，你们一边互损一边改需求；DDL是第一生产力，凌晨四点的食堂只剩你们和阿姨的拖把。', '第一笔到账不大，但足够请客吃完那一顿「还没倒闭」的火锅。', '后来你们明白：合伙人不一定要志同道合，至少要一起扛过甲方与期末。'), epilogue: '五年后公司还在，名字土但活着；群名仍是「再改需求就退群」。', conditions: { all: [{ flag: 'startupIntent' }, { stat: 'social', gte: 55 }, { stat: 'skill', gte: 56 }, { stat: 'money', gte: 1200 }] } },
  { id: 'end_transfer_hero', priority: 26, title: '转专业后的窄门', description: desc('跨专业像把操作系统重装：课表、黑话、社交圈全换。你补修到怀疑人生，却在某次大作业里突然「编译通过」——原来不熟悉的坐标系里也能跑通自己的路。', '绩点起起落落像心电图，但你知道自己在对的赛道上加杠杆；小镇做题家在此刻升级成「小镇迁移工程师」。', '别人问你怎么敢转，你说再不转就要把一辈子卖给不喜欢的主角脚本。'), epilogue: '五年后你在新领域里带实习生，第一句话永远是：先别慌，补修我也挂过。', conditions: { all: [{ flag: 'crossMajorChallenge' }, { stat: 'gpa', gte: 3 }, { stat: 'skill', gte: 58 }] } },
  { id: 'end_gap_world', priority: 25, title: 'Gap 一年去看海与报错', description: desc('你暂缓「标准答案」，用间隔年换护照上的章与简历上的空白。打工、义工、穷游与自学搅在一起，像同时开十个线程；父母电话里的沉默比唠叨更响，你却学会了把焦虑写成待办而不是愧疚。', '你意识到人生不是秋招列表，允许一条分支编译失败再重跑。', '早八刺客暂时失联，但你对时间的体感反而更锋利。'), epilogue: '五年后你仍会在加班夜想起那段没钱却阔的日子，像想起一段开源项目的狂热期。', conditions: { all: [{ stat: 'health', gte: 52 }, { stat: 'money', gte: 2200 }, { stat: 'gpa', lte: 3.05 }, { stat: 'gpa', gte: 2.3 }] } },
  { id: 'end_neet_soft', priority: 24, title: '家里蹲备案中', description: desc('毕业后你先把自己关机重启：投递断断续续，出门需要心理建设，外卖软件比你更懂你的作息。爸妈把关心伪装成唠叨，你把自嘲伪装成松弛感，夜里刷到同龄人高光时仍会心绞痛。', '你知道这不是终局，只是存档点；先把睡眠与肠胃修好，也是一种硬核运维。', '表情包救不了房租，但能让你明天还能点开招聘软件。'), epilogue: '五年后你终于对别人轻描淡写提起那段「空白」，像提起一次漫长的系统维护。', conditions: { all: [{ stat: 'money', lte: 900 }, { stat: 'gpa', lte: 2.5 }, { stat: 'pressure', lte: 62 }] } },
  { id: 'end_mid_internet', priority: 25, title: '互联网中厂合格证', description: desc('你没有拿到传说中年包百万的「顶配岗」，但中厂的作息与需求变更把你打磨成可上线版本。面试官说你有流程感，你翻译：知道怎么在评审里活着把需求做完。', '团建像大型破冰 DLC，工位像第二个寝室；你学会了用周报把琐碎包装成资产。', '小镇做题家在此进化成「小镇交付工程师」。'), epilogue: '五年后你跳槽时才发现，那年学会的甩锅与对齐才是硬通货。', conditions: { all: [{ flag: 'internshipReady' }, { stat: 'skill', gte: 64 }, { stat: 'skill', lte: 76 }, { stat: 'gpa', gte: 2.9 }] } },
  { id: 'end_bank_counter', priority: 24, title: '玻璃后面的柜员线', description: desc('你考上编制边缘岗位，穿上制服坐在防弹玻璃后，点钞与微笑都有 KPI。客户把焦虑砸在你脸上，你把流程背成肌肉记忆；钞箱沉重，午休很短，但公积金按时到账像温柔补丁。', '同学说埋没才华，你说先把生活编译通过。', '早八刺客在此变为晨会刺客，迟到一分钟全网点都知道。'), epilogue: '五年后你轮岗到后台风控，终于不用微笑面对无理取闹，只需面对 Excel。', conditions: { all: [{ flag: 'publicInstitutionTrack' }, { stat: 'gpa', gte: 2.6 }, { stat: 'gpa', lte: 3.2 }, { stat: 'social', gte: 45 }] } },
  { id: 'end_med_intern_crash', priority: 26, title: '规培夜班崩溃文学', description: desc('医学路径把你送进医院迷宫：查房、病程、夜班与情绪劳动无限循环。你在值班室写过检讨也写过遗书草稿，最后只发出一条「还活着」给家人。', '带教骂你与鼓励你同一套声带；你学会在崩溃边缘写交接班，像把人生切成可交接的班次。', 'DDL 在此变成「生命体征要先稳住」。'), epilogue: '五年后你仍会做噩梦梦见医嘱签晚了一分钟，醒来发现自己已经能边噩梦边入睡。', conditions: { all: [{ stat: 'skill', gte: 62 }, { stat: 'pressure', gte: 78 }, { stat: 'health', lte: 48 }] } },
  { id: 'end_phd_slow_track', priority: 25, title: '读博慢车道入口', description: desc('导师与你长谈三次，终于在你简历与论文间隙里敲下「建议深造」。你知道博士不是光环，是更长线的延迟满足；实验失败像无限 while，只有你改的 bug 能看见出口。', '恋爱对象问你还要读几年，你只能说「取决于审稿人心情」。', '卷王在此升级为「卷五年预览版」。'), epilogue: '五年后你发际线后移但眼神更稳，终于敢自嘲「实验室常住人口」。', conditions: { all: [{ flag: 'researchTrack' }, { flag: 'researchProgress', gte: 2 }, { stat: 'gpa', gte: 3.2 }, { stat: 'skill', gte: 70 }] } },
  { id: 'end_senior_startup_pair', priority: 25, title: '学姐合伙练摊', description: desc('学长学姐不是传说，是把你拉进小项目的真实甲方兼合伙人。你们分摊焦虑与发票，校门口摆摊与线上测评双线并行，熬夜做出第一份用户反馈表。', '失败很快，迭代更快；你们互相吐槽「小镇做题家只会做题」，转头却把表格做成护城河。', '那些合伙人口嗨在此落地成报销单与合伙人协议。'), epilogue: '五年后公司未必还在，但你们的微信群仍是彼此的避险资产。', conditions: { all: [{ flag: 'startupIntent' }, { stat: 'social', gte: 62 }, { stat: 'money', lte: 3200 }] } },
  { id: 'end_romance_split_city', priority: 24, title: '恋人分隔两座城', description: desc('你们把毕业做成选择题 rather than 判断题：offer 在不同经纬度，爱与前途互相拉扯。视频里说的「马上见」越来越像接口超时重试。', '结局未必狗血，可能只是在车站抱着哭完，然后各自去安检口排队。', '你学会把想念写成周报式的碎碎念，截图存进相册，现实写进离别教程。'), epilogue: '五年后偶然同城出差约饭，彼此客气得像外包对接。', conditions: { all: [{ flag: 'romanceCommitted' }, { stat: 'pressure', gte: 72 }, { stat: 'social', lte: 52 }] } },
  { id: 'end_dorm_rift', priority: 24, title: '舍友决裂冷却期', description: desc('最后一次争吵不是因为卫生，是因为彼此的未来想象互相刺痛。群聊沉默，值日表失效，耳机成为外交边界；你在走廊听见他们笑，像你从未加入过的副本。', '你学会把情绪卸载到跑步与日记里，而不是卸载到学业上。', '寝室政治教会你的不是心机，是何时该搬出去。'), epilogue: '五年后同学聚会你们礼貌点头，像承认一段旧版本兼容失败。', conditions: { all: [{ stat: 'pressure', gte: 82 }, { stat: 'social', lte: 42 }, { stat: 'gpa', gte: 2.4 }] } },
  { id: 'end_overseas_language', priority: 25, title: '出国预备役口语班', description: desc('你把雅思托福与 GRE 当成新一卡通：打卡、模考、复议与崩溃循环。签证材料厚得像毕设，面试官问你「为什么出国」，你说想换个服务器跑人生。', '父母赞助与你的倔强混合成保证金；朋友圈晒 offer 那天，你也晒了一碗泡面。', 'Gap 在此不是躺平，是排队读语言的漫长前置。'), epilogue: '五年后你在时区另一头熬夜加班，终于懂得什么叫「换了服务器延迟还在」。', conditions: { all: [{ stat: 'skill', gte: 72 }, { stat: 'money', gte: 3500 }, { stat: 'gpa', gte: 3 }] } },
  { id: 'end_civil_retry_parent', priority: 23, title: '考编弃考再战协定', description: desc('报名费和沉没成本在桌面开会：这次没去考场，因为你知道只是逃避型到场。父母叹气又给你盛饭，你把羞愧嚼碎咽下，改成来年再战的学习计划。', '申论素材库里多了「与现实和解」这一章。', '别人说你是逃兵，你对自己说这是战术撤退。'), epilogue: '五年后你上岸那天，最先想到的是那年弃考的午后阳光。', conditions: { all: [{ flag: 'civilTrack' }, { stat: 'gpa', gte: 2.4 }, { stat: 'pressure', gte: 65 }, { stat: 'pressure', lte: 88 }] } },
  { id: 'end_teach_rural', priority: 24, title: '支教合同上的签名', description: desc('你去乡镇学校报到那天，行李箱轮子卡在雨后泥里。孩子们喊你老师，你把大城市焦虑暂时静音；教案写到深夜，蚊子比学生更难缠。', '工资不高，但某种意义感像补贴一样按月打到心里。', '小镇做题家回流小镇当老师，像故事线自己画了一个圈。'), epilogue: '五年后你考回城里编制，仍会给新生讲那段晒脱皮的日子。', conditions: { all: [{ flag: 'publicInstitutionTrack' }, { stat: 'social', gte: 52 }, { stat: 'health', gte: 48 }] } },
  { id: 'end_offcampus_lonely', priority: 23, title: '外宿独居噪声', description: desc('租房合同是你的第一份「完整独立 DLC」：水电、隔音与通勤成本教你做人。夜里路灯像延迟加载的贴图，外卖骑手是你见得最多的熟人。', '社交变少，专注变多；孤独像白噪声，习惯后反而好睡。', '你说自由很贵，但闹钟终于只属于自己。'), epilogue: '五年后你买房首付仍远，但早已不怕一个人吃火锅。', conditions: { all: [{ flag: 'offCampus' }, { stat: 'gpa', gte: 2.8 }, { stat: 'social', lte: 48 }] } },
  { id: 'end_family_business', priority: 23, title: '回家接班试探版', description: desc('家里的小生意在饭桌上摊开：叫你回去帮忙、考证、接班。你在 spreadsheet 与亲情之间走钢丝，既不想辜负也不想轻易投降。', '周末蹲店里学会了把面子换成现金流。', '聊天里那张「继承家业」的截图，落地成扫码枪与进货单。'), epilogue: '五年后店还在，你头发少了，但爸妈语气软了。', conditions: { all: [{ stat: 'money', lte: 2000 }, { stat: 'social', gte: 48 }, { stat: 'gpa', lte: 3 }] } },
  { id: 'end_freelance_creator', priority: 24, title: '自由职业试水号', description: desc('你接单、拖稿、改稿、追款，把简历写成作品集又把作品集拆成单篇报价。客户说「预算不多但要高级感」，你微笑打开模板文件夹。', '收入起伏像比特币表情包，但时间主权是真的。', '父母问你五险一金，你只好转发一篇科普。'), epilogue: '五年后你有了固定客户与房贷，仍保留离职冲动的备份存档。', conditions: { all: [{ stat: 'social', gte: 60 }, { stat: 'skill', gte: 60 }, { stat: 'money', gte: 2800 }, { stat: 'money', lte: 5000 }] } },
  { id: 'end_public_inspector', priority: 23, title: '基层巡查笔录员', description: desc('你穿着工装走过片区：表格、整改、复查与群众投诉构成日常。雨靴比球鞋更常穿，微信步数是你唯一能卷的排行榜。', '稳定不是躺平，是把琐碎砌成秩序。', '考公路线在此分叉成街道办事处的另一种亮度。'), epilogue: '五年后你升科长那天，仍记得第一次被居民骂哭的雨夜。', conditions: { all: [{ flag: 'civilTrack' }, { stat: 'social', gte: 50 }, { stat: 'gpa', gte: 2.7 }, { stat: 'gpa', lte: 3.3 }] } },
  { id: 'end_design_studio', priority: 23, title: '乙方美工求生', description: desc('你在工作室里改第 N 版「还是要第一版」，色域与血压同步飙升。甲方说「大气」，你翻译：再大一点再空一点再便宜一点。', '作品集越来越厚，头发越来越薄。', 'DDL 是第一生产力，你更像第一生产力的耗材。'), epilogue: '五年后你跳槽甲方第一件事就是善待乙方，像善待当年的自己。', conditions: { all: [{ stat: 'skill', gte: 58 }, { stat: 'pressure', gte: 68 }, { stat: 'gpa', gte: 2.6 }] } },
  { id: 'end_data_analyst', priority: 24, title: '表格战士初级职称', description: desc('SQL 与 Excel 成为你的左右护法；汇报会上你把图表做成故事线，老板点头像稀有掉落。你不知道算不算热爱，但至少周五晚上不用睡机房。', '「流程感很好」在此翻译成：指标能对齐。', '小镇做题家升级成小镇透视表工程师。'), epilogue: '五年后你带新人第一句：先别炫技，把口径对齐。', conditions: { all: [{ stat: 'skill', gte: 66 }, { stat: 'gpa', gte: 3 }, { stat: 'pressure', lte: 75 }] } },
  { id: 'end_sales_engineer', priority: 23, title: '售前工程师嘴炮岗', description: desc('你一半时间在客户现场画架构，一半时间在内部撕资源；PPT 与 demo 环境是你的左右互搏。', '懂技术又懂画饼的人，在饭局与复盘会之间反复横跳。', '社交拉满不是天赋，是工单。'), epilogue: '五年后你说话变慢了，因为知道每句都可能进会议纪要。', conditions: { all: [{ stat: 'social', gte: 70 }, { stat: 'skill', gte: 60 }, { stat: 'gpa', gte: 2.5 }] } },
  { id: 'end_journalism_intern', priority: 22, title: '媒体实习跑现场', description: desc('你扛着脚架跑突发，也写过没人看的转载稿；前辈说新闻理想很贵，你先把饭票挣到手。', '凌晨热线像随机事件池，你在稿库里练习把残酷写得克制。', '早八刺客换成了凌晨三点的突发推送。'), epilogue: '五年后你转行公关，仍会对热搜条件反射。', conditions: { all: [{ stat: 'social', gte: 56 }, { stat: 'pressure', gte: 62 }, { stat: 'health', gte: 42 }] } },
  { id: 'end_nonprofit_ops', priority: 22, title: '公益机构项目官', description: desc('筹款、审计、活动与志愿者管理填满日程；工资不高，会议纪要很长。你在琐碎里看见具体的人，而不是宏大叙事。', '成就感来自项目结项那天家长的短信，而不是转发量。', '佛系在此不是躺，是把力气用在对的地方。'), epilogue: '五年后你跳槽企业 CSR，工资翻倍但偶尔想念前线。', conditions: { all: [{ stat: 'social', gte: 54 }, { stat: 'skill', gte: 52 }, { stat: 'money', lte: 3800 }] } },
  { id: 'end_game_industry', priority: 23, title: '策划案与氪金逻辑', description: desc('你进了游戏公司做系统策划，天天与数值、活动表与玩家骂声共处。策划会上老板要「既有深度又要轻度」，你沉默打开竞品拆解。', '热爱变工单仍值得庆幸：至少夜班能报销打车。', '你在游戏里藏彩蛋，在现实里藏睡眠。'), epilogue: '五年后你玩自家游戏会跳过氪金点，像避开年轻时的坑。', conditions: { all: [{ stat: 'skill', gte: 64 }, { stat: 'social', gte: 50 }, { stat: 'pressure', gte: 60 }] } },
  { id: 'end_supply_chain', priority: 22, title: '供应链跟单员长途', description: desc('电话、合同、船期与报关单是你微信置顶；时差让你学会把失眠卖给咖啡机。', '你在车间与港口之间学会谦卑：世界很大，表格很小。', '搞钱在此不是暴富，是回款准时。'), epilogue: '五年后你升职经理，仍会对延误有 PTSD。', conditions: { all: [{ stat: 'money', gte: 3600 }, { stat: 'skill', gte: 54 }, { stat: 'social', gte: 46 }] } },
  { id: 'end_critic_reader', priority: 21, title: '出版业板凳队员', description: desc('你在出版社做编辑助理，拆快递、对清样、追作者拖稿；书的油墨味比 KPI 好闻。', '理想主义被印厂工期磨薄，但你仍会在某本书的首印夜偷偷发朋友圈。', '小镇做题家在此变成小镇校对员。'), epilogue: '五年后你笔名出书，扉页致谢写了那段板凳年份。', conditions: { all: [{ stat: 'gpa', gte: 3 }, { stat: 'pressure', lte: 58 }, { stat: 'skill', gte: 55 }] } },
  { id: 'end_gym_coach', priority: 21, title: '健身房储备教练', description: desc('考证、试课、卖课与维持体脂构成你的三角循环；镜子里的你与会员眼里的你是两份 KPI。', '你把自律当成职业，也当成枷锁；汗水是真的，鸡汤也是真的。', '养生在此等于肌肉酸痛管理。'), epilogue: '五年后你开小店当老板，终于可以对推销话术免疫。', conditions: { all: [{ stat: 'health', gte: 72 }, { stat: 'social', gte: 58 }, { stat: 'skill', gte: 50 }] } },
  { id: 'end_logistics_hub', priority: 21, title: '仓储夜班调度', description: desc('扫码枪是你的魔杖，干线晚点是你的随机事件；你与骑手、司机、客服共建微信群宇宙。', '身体疲惫，但现金流真实；你说先攒钱再谈职业规划这种老实话。', '早八刺客输给了凌晨三点的分拣线。'), epilogue: '五年后你转行产品经理，因为受够了「系统里明明不是这么写的」。', conditions: { all: [{ stat: 'money', gte: 3200 }, { stat: 'health', lte: 62 }, { stat: 'pressure', gte: 58 }] } },
  { id: 'end_coffee_chain', priority: 21, title: '连锁咖啡储备店长', description: desc('配方表、盘点与客诉把你训练成微笑机器；高峰期像黑客松，你在奶泡与订单号之间修行。', '学历像闲置技能点，但你不瞧不起此刻——先把房租稳住。', '搞钱线的烟火气在此等于蒸汽棒嘶嘶声。'), epilogue: '五年后你自己开店，菜单仍写着当年练手的隐藏款。', conditions: { all: [{ stat: 'social', gte: 52 }, { stat: 'money', gte: 2600 }, { stat: 'gpa', lte: 2.9 }] } },
  { id: 'end_realty_agent', priority: 21, title: '房产中介带看王者', description: desc('你记住片区每一套采光与房东脾气；客户说要再看看，你笑着预约下一套。', '嘴皮子与脚程是你的复合技能；签约那刻的快感堪比答辩通过。', '社交在此等于合法骚扰与真诚并存。'), epilogue: '五年后你只做豪宅渠道，仍会对雨伞常备两件。', conditions: { all: [{ stat: 'social', gte: 68 }, { stat: 'money', gte: 3000 }, { stat: 'skill', gte: 48 }] } },
  { id: 'end_farm_tech', priority: 22, title: '农技推广员下乡记', description: desc('你把传感器与无人机介绍给合作社；老乡问你英语六级能不能防虫害，你只能苦笑科普。', '科研在此接地：泥土与数据表同样沉重。', '农业创新不是嘴上热搜，是耐心比键盘长。'), epilogue: '五年后试点扩大，你却在ppt里放了一张第一年失败的苗。', conditions: { all: [{ stat: 'skill', gte: 58 }, { stat: 'health', gte: 55 }, { stat: 'social', gte: 48 }] } },
  { id: 'end_secret_crush', priority: 22, title: '暗恋停在致谢里', description: desc('你没有把喜欢说出口，只在毕业典礼合影里站得离 TA 近一点。后来朋友圈点赞成为你唯一的交互协议。', '遗憾是真的，自由也是真的：你把心动兑换成一场不被打分的关系。', '暧昧三连击一场都没触发，但你学会了克制也算成长。'), epilogue: '五年后同学会你们寒暄，像彼此早已卸载的客户端。', conditions: { all: [{ flag: 'romanceSkipped' }, { stat: 'gpa', gte: 3 }, { stat: 'social', lte: 45 }] } },
  { id: 'end_parent_expect', priority: 22, title: '父母的默认路径', description: desc('你沿着家人期待的公式投递：本地、稳定、可相亲。内心的小反抗只在深夜耳机里播放。', '你知道这不是史诗，只是中国式温情与控制的混合包。', '你在表格里填「服从调剂」，像对自己人生也按下默认安装。'), epilogue: '五年后你开始偷偷接副业，像给默认路径打补丁。', conditions: { all: [{ stat: 'pressure', gte: 60 }, { stat: 'social', lte: 50 }, { stat: 'gpa', gte: 2.7 }, { stat: 'gpa', lte: 3.2 }] } },
  { id: 'end_double_degree', priority: 23, title: '双学位缝合怪', description: desc('你同时啃两套培养方案，考试周像叠 debuff；室友以为你分身，其实你只是咖啡耐受提高。', '简历多一行，头发少一撮；但跨界想象力从此合法。', '卷王在此表现为「双倍培养方案生存实验」。'), epilogue: '五年后你做交叉岗位反而吃香，因为早就习惯翻译两种黑话。', conditions: { all: [{ stat: 'gpa', gte: 3.1 }, { stat: 'pressure', gte: 70 }, { stat: 'skill', gte: 62 }] } },
  { id: 'end_volunteer_legacy', priority: 21, title: '大型赛会志愿者遗产', description: desc('你攒下一沓志愿者证书与晒黑的皮肤；见过凌晨四点的场馆与媒体村的泡面。', '志愿时长换不了首付，却换来一群同类朋友与可控的热血。', '社牛在此是被 workflow 训练出来的。'), epilogue: '五年后城市办赛你第一反应仍是：我去不去守门？', conditions: { all: [{ stat: 'social', gte: 60 }, { stat: 'health', gte: 50 }, { stat: 'skill', gte: 50 }] } },
  { id: 'end_debt_student', priority: 22, title: '助学贷款偿还长跑', description: desc('毕业第一件事是把还款日历钉在桌面；工资到手先拆成几份，像拆解炸弹。', '你羡慕别人的松弛感，却也尊敬自己的信用记录。', '搞钱在此不是欲望，是义务函数最小化。'), epilogue: '五年后你还清那天请自己吃了顿贵的，发票撕得比毕业证还爽。', conditions: { all: [{ stat: 'money', lte: 2200 }, { stat: 'skill', gte: 55 }, { stat: 'pressure', gte: 55 }] } },
  { id: 'end_night_school', priority: 20, title: '夜校证书叠 Buff', description: desc('白天上班晚上上课，你在地铁里背单词像挂机刷怪；困到在最后一排点头，但仍抢到前排插座。', '你知道证书不是魔法，但能给简历多一行确定性。', 'DDL 是第一生产力，夜校就像给这条定律办分期。'), epilogue: '五年后证堆满抽屉，你最珍惜的是那段不肯躺平的劲儿。', conditions: { all: [{ flag: 'certProgress', gte: 1 }, { stat: 'pressure', gte: 62 }, { stat: 'money', lte: 4000 }] } },
  { id: 'end_clinic_admin', priority: 21, title: '医院行政岗稳稳幸福', description: desc('你不拿手术刀，却负责让手术排期不乱；投诉电话像随机事件，你用流程表接住情绪。', '稳定、体面、偶尔心累；你在「幕后运维」里找到位置。', '考编 wins 的一种低温版本。'), epilogue: '五年后临床同学羡慕你不值班，你羡慕他们不被投诉。', conditions: { all: [{ flag: 'publicInstitutionTrack' }, { stat: 'pressure', lte: 68 }, { stat: 'gpa', gte: 2.5 }, { stat: 'gpa', lte: 3.1 }] } },
  { id: 'end_tech_support', priority: 20, title: 'IT 运维值班魂', description: desc('7x24 热线是你的人生节拍器；故障单像无限刷新的支线。你学会在骂声中保持 ping 通。', '技能点偏硬，脾气被迫变软；凌晨告警比闹钟更懂你的作息。', '高压入职的低温对照组。'), epilogue: '五年后你转架构岗，终于能把电话转给下一班兄弟。', conditions: { all: [{ stat: 'skill', gte: 60 }, { stat: 'pressure', gte: 72 }, { stat: 'health', gte: 45 }] } },
  { id: 'end_cultural_heritage', priority: 20, title: '文博策展助理', description: desc('你在展馆与库房之间搬运时间与灰尘；讲解词背到梦里。游客自拍比你想象的更重要，你也学会与流量共存。', '专业在此落地成灯光角度与展线逻辑。', '佛系不是懒，是对文物轻声说话。'), epilogue: '五年后你独立策展，序言里藏了大四时拖场的自己。', conditions: { all: [{ stat: 'gpa', gte: 2.8 }, { stat: 'social', gte: 48 }, { stat: 'pressure', lte: 65 }] } },
  { id: 'end_ws_mock', priority: 19, title: '平行日常 · 留白的你', description: desc('你没有触发宏大叙事，却把每一天过得可复盘：食堂、教室、寝室三点循环里仍有细小骄傲。', '朋友说你不像主角，你反驳主角也要有人演路人甲的自我修养。', '普通毕业在此前的万千分支之后，仍值得一杯奶茶庆祝。'), epilogue: '五年后你把这段岁月当成默认皮肤，偶尔换上野心主题试试。', conditions: { all: [{ stat: 'gpa', gte: 2.5 }, { stat: 'social', gte: 38 }, { stat: 'social', lte: 62 }] } },
];

const newAchievements = [
  { id: 'ach_mentor_pick', title: '导师亲选', description: '本局确定了主导师', hint: '完成导师双选/意向', conditions: { rosterPrimaryMentor: true, notDropout: true } },
  { id: 'ach_partner_lock', title: '心动对象锁定', description: '恋爱候选里选定一人', hint: 'npcRoster.partner 非空', conditions: { rosterPartner: true, notDropout: true } },
  { id: 'ach_npc_events_1', title: '关系网触电', description: '触发至少 1 次 NPC 专属事件', hint: 'npcEventHits >= 1', conditions: { flags: [{ key: 'npcEventHits', gte: 1 }], notDropout: true } },
  { id: 'ach_npc_events_3', title: '关系网加厚', description: '触发至少 3 次 NPC 专属事件', hint: 'npcEventHits >= 3', conditions: { flags: [{ key: 'npcEventHits', gte: 3 }], notDropout: true } },
  { id: 'ach_npc_events_5', title: '关系网主线', description: '触发至少 5 次 NPC 专属事件', hint: 'npcEventHits >= 5', conditions: { flags: [{ key: 'npcEventHits', gte: 5 }], notDropout: true } },
  { id: 'ach_roommate_night', title: '室友夜谈备份', description: '累计宿舍向周行动', hint: 'dormProgress >= 1 且用了室友夜谈', conditions: { flags: [{ key: 'dormProgress', gte: 1 }], notDropout: true } },
  { id: 'ach_startup_intent', title: '创业脑洞实名', description: '点亮创业意向旗标', hint: 'startupIntent', conditions: { flags: [{ key: 'startupIntent', truthy: true }], notDropout: true } },
  { id: 'ach_off_campus', title: '外宿通勤勇士', description: '选择外宿路线毕业', hint: 'offCampus', conditions: { flags: [{ key: 'offCampus', truthy: true }], notDropout: true } },
  { id: 'ach_romance_skip', title: '单身主线通关', description: '主动跳过恋情开局仍毕业', hint: 'romanceSkipped', conditions: { flags: [{ key: 'romanceSkipped', truthy: true }], notDropout: true } },
  { id: 'ach_bigtech_flag', title: '大厂直通车票', description: '触发大厂职业旗标', hint: 'careerBigTech', conditions: { flags: [{ key: 'careerBigTech', truthy: true }], notDropout: true } },
  { id: 'ach_postgrad_flag', title: '保研副本通关', description: '锁定推免/保研相关旗标', hint: 'postgradLockedIn', conditions: { flags: [{ key: 'postgradLockedIn', truthy: true }], notDropout: true } },
  { id: 'ach_civil_double', title: '编制双修预备', description: '同时触及考公与考编旗标', hint: 'civilTrack 与 publicInstitutionTrack', conditions: { flags: [{ key: 'civilTrack', truthy: true }, { key: 'publicInstitutionTrack', truthy: true }], notDropout: true } },
  { id: 'ach_money_grind', title: '搞钱系练习生', description: '毕业时存款仍高且压力大', hint: '金钱>=4800 压力>=60', conditions: { stats: [{ key: 'money', gte: 4800 }, { key: 'pressure', gte: 60 }], notDropout: true } },
  { id: 'ach_social_butterfly_end', title: '毕业仍社牛', description: '高社交 finishing', hint: '社交>=80', conditions: { stats: [{ key: 'social', gte: 80 }], notDropout: true } },
  { id: 'ach_chill_still_pass', title: '低压掠过终点线', description: '低压状态下完成毕业线', hint: '压力<=40 且绩点>=2.5', conditions: { stats: [{ key: 'pressure', lte: 40 }, { key: 'gpa', gte: 2.5 }], notDropout: true } },
  { id: 'ach_auntie_regular', title: '食堂阿姨认得我', description: '高频生活类周行动（记账）', hint: 'try_new_food 或 cook 多次 — 用 itemUsage>=2 近似', conditions: { flags: [{ key: 'itemUsage', gte: 2 }], notDropout: true } },
  { id: 'ach_library_streak', title: '图书馆抢座传说', description: '学业向高频周行动', hint: '高压且高绩点', conditions: { stats: [{ key: 'pressure', gte: 65 }, { key: 'gpa', gte: 3.4 }], notDropout: true } },
  { id: 'ach_dawn_canteen', title: '凌晨四点的食堂', description: '极端作息与身体对赌仍通关', hint: '压力>=85 健康>=40', conditions: { stats: [{ key: 'pressure', gte: 85 }, { key: 'health', gte: 40 }], notDropout: true } },
  { id: 'ach_ambiguous_three', title: '暧昧三连击（伏笔）', description: '恋爱旗标 + 高社交未完成恋人锁定也可', hint: 'romanceCommitted 与高社交', conditions: { flags: [{ key: 'romanceCommitted', truthy: true }], stats: [{ key: 'social', gte: 70 }], notDropout: true } },
  { id: 'ach_contest_one_shot', title: '比赛一单通关', description: '竞赛进度恰好为 1', hint: 'contestProgress==1', conditions: { flags: [{ key: 'contestProgress', eq: 1 }], notDropout: true } },
  { id: 'ach_cert_only', title: '考证单项战士', description: '只有考证进度突出', hint: 'certProgress>=1 contest=0', conditions: { flags: [{ key: 'certProgress', gte: 1 }, { key: 'contestProgress', eq: 0 }], notDropout: true } },
  { id: 'ach_intern_no_lab', title: '不进实验室的 offer', description: '实习旗标 ON、科研旗标 OFF', hint: 'internshipReady 且未 researchTrack', conditions: { flags: [{ key: 'internshipReady', truthy: true }, { key: 'researchTrack', truthy: false }], notDropout: true } },
  { id: 'ach_work_life_meme', title: '周会潜水员', description: '学生工作与社会双高', hint: 'studentWork>=1 社交>=75', conditions: { flags: [{ key: 'studentWork', gte: 1 }], stats: [{ key: 'social', gte: 75 }], notDropout: true } },
  { id: 'ach_finance_roller', title: '基金心态大师', description: '理财与高压并存仍毕业', hint: 'financeProgress 且压力高', conditions: { flags: [{ key: 'financeProgress', gte: 1 }], stats: [{ key: 'pressure', gte: 55 }], notDropout: true } },
  { id: 'ach_low_money_high_skill', title: '穷但硬气', description: '存款不高但能力突出', hint: '金钱<=2500 能力>=75', conditions: { stats: [{ key: 'money', lte: 2500 }, { key: 'skill', gte: 75 }], notDropout: true } },
  { id: 'ach_gpa_mid_social_high', title: '绩点普通社交发光', description: '中等绩点高社交', hint: '2.6-3.2 社交>=78', conditions: { stats: [{ key: 'gpa', gte: 2.6 }, { key: 'gpa', lte: 3.2 }, { key: 'social', gte: 78 }], notDropout: true } },
  { id: 'ach_hidden_walk', title: '操场遛弯哲学家', description: '健康与低压双赢', hint: '健康>=80 压力<=42', conditions: { stats: [{ key: 'health', gte: 80 }, { key: 'pressure', lte: 42 }], notDropout: true } },
  { id: 'ach_polyglot_end', title: '外语院校气氛组', description: '外语类院校高社交毕业', school: 'foreign_language', conditions: { stats: [{ key: 'social', gte: 72 }], notDropout: true } },
  { id: 'ach_art_laid_back', title: '美院松弛战士', description: '艺术院校低压毕业', school: 'art_academy', conditions: { stats: [{ key: 'pressure', lte: 48 }, { key: 'skill', gte: 62 }], notDropout: true } },
  { id: 'ach_vocational_hands', title: '职校动手能力王', description: '职业技术院校高技能', school: 'vocational', conditions: { stats: [{ key: 'skill', gte: 78 }], notDropout: true } },
  { id: 'ach_ai_major_cs', title: '炼丹专业幸存者', description: '人工智能专业高压力通关', major: 'ai', conditions: { stats: [{ key: 'pressure', gte: 70 }, { key: 'skill', gte: 65 }], notDropout: true } },
  { id: 'ach_law_civil', title: '政法考公双押', description: '警察学院考公路线', school: 'police_academy', conditions: { flags: [{ key: 'civilTrack', truthy: true }], stats: [{ key: 'gpa', gte: 2.8 }], notDropout: true } },
  { id: 'ach_med_grind', title: '医学长线苦行', description: '医学相关高压高技能假设 — 用技能压力健康组合', hint: '技能>=68 压力>=75', conditions: { stats: [{ key: 'skill', gte: 68 }, { key: 'pressure', gte: 75 }, { key: 'health', lte: 55 }], notDropout: true } },
  { id: 'ach_cross_and_love', title: '跨学科也要谈恋爱', description: '跨专业挑战 + 恋爱', conditions: { flags: [{ key: 'crossMajorChallenge', truthy: true }, { key: 'romanceCommitted', truthy: true }], notDropout: true } },
  { id: 'ach_full_flags_triple', title: '三线打卡狂魔', description: '实习+科研+竞赛均至少触达一次', hint: '三 flag', conditions: { flags: [{ key: 'internshipReady', truthy: true }, { key: 'researchTrack', truthy: true }, { key: 'contestProgress', gte: 1 }], notDropout: true } },
];

function patchCatalog(endings, achievements) {
  const catalogPath = path.join(root, 'js/data/catalog.js');
  let text = fs.readFileSync(catalogPath, 'utf8');
  text = text.replace(
    /export const endingsCatalog = \[[\s\S]*?\];/,
    `export const endingsCatalog = ${JSON.stringify(endings)};`,
  );
  text = text.replace(
    /export const achievementsCatalog = \[[\s\S]*?\];/,
    `export const achievementsCatalog = ${JSON.stringify(achievements)};`,
  );
  fs.writeFileSync(catalogPath, text);
}

function main() {
  const endingsPath = path.join(root, 'config/v1/endings.json');
  const achPath = path.join(root, 'config/v1/achievements.json');
  let endings = JSON.parse(fs.readFileSync(endingsPath, 'utf8'));
  endings = endings.filter((e) => !String(e.id).startsWith('end_bulk_'));
  endings = endings.concat(newEndings);
  let achievements = JSON.parse(fs.readFileSync(achPath, 'utf8'));
  achievements = achievements.filter((a) => !String(a.id).startsWith('ach_npc_bulk_'));
  const existing = new Set(achievements.map((a) => a.id));
  newAchievements.forEach((a) => {
    if (!existing.has(a.id)) achievements.push(a);
  });
  fs.writeFileSync(endingsPath, JSON.stringify(endings, null, 2));
  fs.writeFileSync(achPath, JSON.stringify(achievements, null, 2));
  patchCatalog(endings, achievements);
  console.log('OK endings:', endings.length, 'achievements:', achievements.length);
}

main();
