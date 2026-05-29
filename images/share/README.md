# 分享素材说明

| 文件名 | 用途 | 尺寸与比例 |
|--------|------|------------|
| **share_card.jpg** | 转发给好友 | **5:4**（如 500×400） |
| **share_preview.jpg** | 朋友圈卡片 + 预览 | **1:1**（500×500，由主图居中裁切） |

更新 `share_card.jpg` 后重新生成预览图：

```bash
python tools/regenerate-share-preview.py
```

批量压缩 / PNG 转 JPG（整个 `images/` 目录）：

```bash
python tools/compress-images-to-jpeg.py
```

未放置分享图时，回退为 `images/generated/game_avatar.jpg`。
