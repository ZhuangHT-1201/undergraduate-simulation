import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const tendencies = ['卷王', '佛系', '恋爱', '创业', '社牛', '学业上行', '熬夜', '干饭', '考公', '科研', '实习', '拖延'];

const titles = [
  '把这学期过成副本通关', '在图书馆办了会员卡', 'DDL是第一生产力现场', '早八刺客幸存者', '小镇做题家上分路', '佛系但有期末', '恋爱与任务串台了', '搞钱搞到花呗失忆', '人脉像路由器', '寝室新闻联播', '操场夜跑伪博主', '食堂阿姨认得我', '考证路越走越远', '科研民工试用期', '实习投递像许愿', '考公申论气氛组', '拖延症自救中', '社交点亮地图', '躺平大师微调', '高压锅焖熟上学期', '奖学金擦边过', '挂科边缘大鹏展翅', '跨专业补丁', '副业脑觉醒', '睡眠负债续费', '运动人设波动', '焦虑贩卖机停更', '绩点过山车', '论文裁缝上线', '期末像春运', '选课像炒股', '社团打卡王', '实验室点灯人', '图书馆VIP', '小组作业幸存', '熬夜冠军候补', '咖啡一级选手', '外卖十级学者', '快递站脸熟', '打印店挚友', '宿舍关灯办', '阳台花没活', '峡谷时差党', '谷子收割机', '志愿时长KPI', '音乐节特种兵', '支教滤镜', '情绪稳定装', '金钱观朴素', '运动塌了又立', '硬扛一学期', '嘴硬身软', '故事翻篇', '普通但不平庸', '累并记录', '接话王预备役', '反卷失败样例', '反卷成功样例', '课表像心电图', '绩点像盲盒', '秋招气氛组', '健康优先翻车', '搞钱脑发作', '恋爱支线load', '主线是活下去', '闭馆音乐听众', '咖啡续命', '校园walk', '同学不明觉厉', '老师还可以', '把自己养成号', '自我对话变多', '父母电话好好的', '下一季预告',
];

const bodies = [
  '{name}把这学期焊在了{topAction}上，×{topActionCount}次像极了签到氪金。',
  '{name}在「卷」与「躺」之间横跳，{topAction}×{topActionCount}是最诚实的时间账。',
  '期末周那句老话：DDL是第一生产力。{name}用{topAction}×{topActionCount}交了本学期电费。',
  '{name}嘴上佛系身体诚实，{topAction}×{topActionCount}给人设打补丁。',
  '{name}恋爱线与任务线偶尔串台，{topAction}×{topActionCount}记了主线进度。',
  '{name}人脉圈像路由器，{topAction}×{topActionCount}是最稳的信道。',
  '{name}把复习做成仪式，{topAction}×{topActionCount}是背景音乐。',
  '{name}在教室食堂折返，{topAction}×{topActionCount}写满通勤叙事。',
  '{name}花钱刀刃一半奶茶一半，{topAction}×{topActionCount}算刀刃。',
  '{name}本学期人设更新，{topAction}×{topActionCount}是补丁说明。',
  '{name}健康条过山车，{topAction}×{topActionCount}像安全带。',
  '{name}田野调查式上学：{topAction}×{topActionCount}是采样次数。',
  '{name}拖延也在进化：{topAction}×{topActionCount}至少准时。',
  '{name}焦虑调静音，{topAction}×{topActionCount}仍有推送。',
  '{name}实习邮箱像许愿池，{topAction}×{topActionCount}像保底掉落。',
  '{name}恋爱副本慢加载，{topAction}×{topActionCount}先刷日常。',
  '{name}熬夜像追剧式补课，{topAction}×{topActionCount}写脚注。',
  '{name}寝室热播剧：{topAction}×{topActionCount}花絮。',
  '{name}体育场常客巩固：{topAction}×{topActionCount}。',
  '{name}考证路线打卡：{topAction}×{topActionCount}补给站。',
  '{name}科研曲线陡：{topAction}×{topActionCount}标坡度。',
  '{name}副业像盲盒：{topAction}×{topActionCount}还行。',
  '{name}朴素金钱观：先活再优雅；{topAction}×{topActionCount}负责活。',
  '{name}社交能量起伏：{topAction}×{topActionCount}稳定输出。',
  '{name}复盘关键词稳：细节{topAction}×{topActionCount}。',
  '{name}早八刺客命中膝盖：{topAction}×{topActionCount}包扎。',
  '{name}做题家血脉：{topAction}×{topActionCount}。',
  '{name}心态钟摆：{topAction}×{topActionCount}记摆动。',
  '{name}前排不多故事多：{topAction}×{topActionCount}。',
  '{name}把玩笑揉进生活：{topAction}×{topActionCount}伏笔。',
  '{name}赛季结算感：{topAction}×{topActionCount}。',
  '{name}睡眠随机播：{topAction}×{topActionCount}。',
  '{name}论文裁缝：{topAction}×{topActionCount}。',
  '{name}宿舍外交：{topAction}×{topActionCount}。',
  '{name}健康优先偶翻：{topAction}×{topActionCount}。',
  '{name}搞钱脑间歇：{topAction}×{topActionCount}。',
  '{name}恋爱支线：{topAction}×{topActionCount}。',
  '{name}主线活着：{topAction}×{topActionCount}。',
  '{name}长篇小说感：{topAction}×{topActionCount}。',
  '{name}闭馆音乐听：{topAction}×{topActionCount}。',
  '{name}周末像赠品：{topAction}×{topActionCount}。',
  '{name}把自己养成号：{topAction}×{topActionCount}。',
];

const out = [];
for (let i = 0; i < 82; i += 1) {
  const tend = tendencies[i % tendencies.length];
  out.push({
    id: `sm_auto_${i + 1}`,
    tags: [tend],
    minSemester: i % 4 === 0 ? 2 : 1,
    conditions:
      i % 5 === 0
        ? { stats: [{ key: 'pressure', gte: 55 }], phaseCounts: { week_action: 1 } }
        : { phaseCounts: { week_action: 1 } },
    title: `${titles[i % titles.length]} · ${i + 1}`,
    body: bodies[i % bodies.length],
  });
}

fs.writeFileSync(path.join(root, 'config/v1/semesterSummaries.json'), JSON.stringify(out, null, 2));
console.log('wrote', out.length);
