# 本科生的四年日记

### Undergraduate Simulation

一款原生 Canvas + ES Modules 开发的微信小游戏。选择学校与专业，在八个学期里安排每周行动、处理突发事件、经营关系，并走向不同的毕业结局。

[![WeChat Mini Game](https://img.shields.io/badge/WeChat-Mini%20Game-07C160?logo=wechat&logoColor=white)](#)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=111)](#)
[![Canvas 2D](https://img.shields.io/badge/Rendering-Canvas%202D-E9694D)](#)
[![Release](https://img.shields.io/github/v/release/ZhuangHT-1201/undergraduate-simulation?label=release&color=EBC779)](https://github.com/ZhuangHT-1201/undergraduate-simulation/releases)
[![Code: MIT](https://img.shields.io/badge/Code-MIT-4E8FB8.svg)](LICENSE)
[![Assets: All Rights Reserved](https://img.shields.io/badge/Assets-All%20Rights%20Reserved-lightgrey.svg)](ASSETS_NOTICE.md)

<p align="center">
  <a href="docs/screenshots/main-menu.webp">
    <img src="docs/screenshots/main-menu.webp" width="330" alt="本科生的四年日记主菜单">
  </a>
</p>

<p align="center"><sub>四年、八个学期，以及每一次真正改变方向的选择。</sub></p>

> 游戏中的学校、人物与故事均为虚构，不代表或关联任何现实院校。

---

## 游戏预览

<p align="center">
  <a href="docs/screenshots/character-creation.webp">
    <img src="docs/screenshots/character-creation.webp" width="45%" alt="角色创建：姓名、难度与初始特质">
  </a>
  <a href="docs/screenshots/weekly-planning.webp">
    <img src="docs/screenshots/weekly-planning.webp" width="45%" alt="每周行动与状态面板">
  </a>
</p>

<p align="center">
  <a href="docs/screenshots/story-scene.webp">
    <img src="docs/screenshots/story-scene.webp" width="45%" alt="可完整滚动的剧情阅读页">
  </a>
  <a href="docs/screenshots/moment-gallery.webp">
    <img src="docs/screenshots/moment-gallery.webp" width="45%" alt="校园影像图鉴">
  </a>
</p>

<p align="center">
  <a href="docs/screenshots/ending.webp">
    <img src="docs/screenshots/ending.webp" width="45%" alt="毕业结局与四年回顾">
  </a>
</p>

---

## 核心特色

- **完整四年流程**：8 个学期、每周行动、学期目标与阶段事件。
- **可读的状态系统**：绩点、健康、压力、社交、能力与生活费共同影响路线。
- **分支叙事**：学校、专业、选择、关系与随机事件会改变可触发的内容和结局。
- **校园生活模拟**：社团、兼职、科研、实习、考公、恋爱、宿舍关系与日常活动。
- **收集系统**：多结局图鉴、成就、校园 CG、原声音乐与可解锁学校/专业。
- **移动端交互**：安全区适配、触控滚动、按压反馈、轻触震动、场景过渡与点击音。
- **原生视觉**：响应式 Canvas 校园插画、统一图标与玻璃材质，不依赖低清 UI 贴图。
- **数据驱动**：事件、行动、结局、成就、NPC 与物品均可通过配置文件维护。

## 在线体验

在微信小游戏商店搜索 **本科生的四年日记**。

> 商店名称与版本以微信发布页为准。

## 本地运行

### 环境要求

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- Node.js 18+（仅运行内容同步与回归工具时需要）

### 导入项目

1. 克隆本仓库。
2. 复制项目配置并填写自己的小游戏 AppID：

   ```powershell
   Copy-Item project.config.example.json project.config.json
   ```

3. 用微信开发者工具导入仓库根目录，项目类型选择 **小游戏**。
4. 在模拟器或真机中编译预览。

### 修改游戏内容

1. 修改 `config/v1/*.json`，全局规则位于 `config/v1/rules.js`。
2. 将内容同步到运行时目录：

   ```bash
   node tools/sync-catalog-from-json.mjs
   ```

3. 重新编译微信小游戏。

常用开发脚本：

| 脚本 | 用途 |
| --- | --- |
| `tools/sync-catalog-from-json.mjs` | 同步 JSON 内容到 `js/data/catalog.js` |
| `tools/polish-chinese-copy.mjs` | 批量清理重复表达与统一中文文案 |
| `tools/run-sim-regression.mjs` | 运行多局数值与结局分布回归 |
| `tools/test-ads.mjs` | 验证广告回调、失败重试与奖励接口 |

## 广告

广告适配器位于 `js/ads/adAdapter.js`，仅在微信广告 API 可用时初始化，加载失败不会阻塞游戏。

- 插屏广告只在一学期总结关闭后低频尝试展示，并有学期去重与冷却限制。
- 激励视频由玩家主动选择观看。健康或压力进入警戒状态时可使用一次“应急补给”，完整观看后恢复状态，每学期限一次。

## 项目结构

```text
├── game.js                 # 小游戏入口
├── game.json
├── config/v1/              # 规则与游戏内容
├── js/
│   ├── main.js             # 场景、交互、主循环与界面编排
│   ├── core/               # 事件引擎、存档、成就、关系与学期总结
│   ├── data/catalog.js     # 运行时内容目录
│   ├── ui/                 # Canvas 主题、图标与背景渲染
│   ├── ads/                # 微信广告适配
│   └── audio/              # 音乐与界面音效
├── images/                 # CG、头像与分享资源
├── audio/                  # BGM 与点击音
└── docs/screenshots/       # README 展示截图，不进入小游戏包
```

## 贡献

欢迎提交程序改进与 Bug 修复。叙事文本、数值设计、图片和音频的使用与修改请先阅读 [ASSETS_NOTICE.md](ASSETS_NOTICE.md)。

修改 `config/v1` 中的内容后，请运行 `node tools/sync-catalog-from-json.mjs` 并一并提交 `js/data/catalog.js`。

## 许可证

- **程序代码**：[MIT License](LICENSE)
- **叙事、游戏设计数据、图片与音频**：[All Rights Reserved](ASSETS_NOTICE.md)

---

## 作者

[ZhuangHT-1201](https://github.com/ZhuangHT-1201)
