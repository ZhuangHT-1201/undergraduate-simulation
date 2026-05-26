# Undergraduate Simulation

A **WeChat Mini Game** — text strategy sim about four years of college life (Canvas + ES Modules). Pick a school and major, take weekly actions, handle random events, build relationships, unlock achievements, and reach different endings.

[![Code: MIT](https://img.shields.io/badge/Code-MIT-blue.svg)](LICENSE)
[![Assets: All Rights Reserved](https://img.shields.io/badge/Assets-All%20Rights%20Reserved-lightgrey.svg)](ASSETS_NOTICE.md)

> Schools, characters, and storylines in the game are fictional and not affiliated with any real institution.

---

## Play Online

Search for **Undergraduate's Four-Year Diary** in the WeChat Mini Game store (use the title shown on the release page in WeChat).

---

## Features

- **8 semesters × multiple weeks** with GPA, health, stress, social, skills, and more
- **Data-driven content**: events, actions, endings, achievements, NPCs, and items in `config/v1/`
- **Event engine**: `js/core/eventEngine.js` handles choices, random events, state, and endings
- **Local saves**: `js/core/save.js` (WeChat local storage)
- **Achievements, CG gallery, BGM collection**, talents, clubs, weekly shop, and more
- **Content tooling**: scripts under `tools/` for copy edits, catalog sync, and regression runs

---

## Local Development

### Requirements

- [WeChat DevTools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- (Optional) Node.js 18+ for `tools/` scripts

### Import the Project

1. Clone this repository.
2. Copy the config template and set your AppID:
   ```bash
   cp project.config.example.json project.config.json
   ```
   On Windows (PowerShell):
   ```powershell
   Copy-Item project.config.example.json project.config.json
   ```
   Replace `YOUR_WECHAT_APPID` in `project.config.json` with your mini game AppID from the WeChat console.
3. Open **WeChat DevTools** → **Import Project**, select the repo root, `compileType` = **Mini Game**.
4. Build and preview in the simulator or on a device.

### Edit Game Data

1. Edit `config/v1/*.json` (or constants in `config/v1/rules.js`).
2. Sync JSON into the runtime catalog:
   ```bash
   node tools/sync-catalog-from-json.mjs
   ```
3. Rebuild in WeChat DevTools.

Common scripts (run from the repo root):

| Script | Purpose |
|--------|---------|
| `tools/sync-catalog-from-json.mjs` | JSON → `js/data/catalog.js` |
| `tools/polish-chinese-copy.mjs` | Batch polish in-game narrative copy |
| `tools/run-sim-regression.mjs` | Lightweight regression simulation |

### Ads (Optional)

Configure rewarded/interstitial ads in `js/ads/adAdapter.js`. Ads are **disabled** by default for local and open-source builds.

---

## Project Layout

```
├── game.js                 # Mini game entry
├── game.json
├── config/v1/              # Rules and content (JSON + rules.js)
├── js/
│   ├── main.js             # Main loop, scenes, rendering
│   ├── core/               # Event engine, saves, achievements, semester summary
│   ├── data/catalog.js     # Runtime data (synced via tools)
│   ├── ads/                # Ad adapter
│   └── audio/
├── images/                 # UI, CG, avatars
├── audio/                  # BGM
└── tools/                  # Content and maintenance scripts
```

---

## Contributing

Issues and pull requests are welcome for **program code** improvements and bug fixes.

Changes to narrative text, balance numbers, or art/audio require the author’s permission under [ASSETS_NOTICE.md](ASSETS_NOTICE.md). After editing `config/v1` JSON with permission, run `node tools/sync-catalog-from-json.mjs` and commit `js/data/catalog.js` if applicable.

---

## License

- **Program code**: [MIT License](LICENSE) — source under `js/` (except `js/data/catalog.js`), `game.js`, `tools/`, etc.
- **Narrative, game design data, images, and audio**: **All Rights Reserved** — see [ASSETS_NOTICE.md](ASSETS_NOTICE.md)

Program source code is open under the MIT License. Game narrative, numerical design, images, and audio remain all rights reserved; without explicit permission from the author, they may not be used commercially or redistributed in modified form.

---

## Author

[ZhuangHT-1201](https://github.com/ZhuangHT-1201)
