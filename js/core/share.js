/**
 * 微信小游戏分享：转发给朋友、右上角分享到朋友圈、主动拉起转发。
 * @see https://developers.weixin.qq.com/minigame/dev/guide/open-ability/share/share.html
 * @see https://developers.weixin.qq.com/minigame/dev/guide/open-ability/share-timeline_game.html
 */

/** 包内分享图路径（见 images/share/README.md） */
export const SHARE_ASSETS = {
  /** 转发给朋友：5:4，使用 share_card.jpg */
  card: 'images/share/share_card.jpg',
  /** 朋友圈卡片 + 预览：1:1，由 share_card 居中裁切生成 share_preview.jpg */
  timeline: 'images/share/share_preview.jpg',
  preview: 'images/share/share_preview.jpg',
};

const FALLBACK_IMAGE = 'images/generated/game_avatar.jpg';

const DEFAULT_FRIEND_TITLE = '本科生的四年日记 — 来体验你的大学四年';
const DEFAULT_TIMELINE_TITLE = '本科生的四年日记';

let contextGetter = () => ({});
/** @type {Record<string, string>} */
const resolvedImageCache = {};

function normalizePackagePath(path) {
  if (!path) return '';
  return String(path).replace(/^\/+/, '');
}

/** 校验包内图片是否存在，不存在则回退 */
function resolvePackageImage(path, fallback = FALLBACK_IMAGE) {
  const key = normalizePackagePath(path);
  if (!key) return normalizePackagePath(fallback);
  if (resolvedImageCache[key]) return resolvedImageCache[key];

  if (typeof wx !== 'undefined') {
    try {
      const fs = wx.getFileSystemManager && wx.getFileSystemManager();
      if (fs && fs.accessSync) {
        for (const candidate of [key, normalizePackagePath(fallback)]) {
          if (!candidate) continue;
          try {
            fs.accessSync(candidate);
            resolvedImageCache[key] = candidate;
            return candidate;
          } catch {
            /* try next */
          }
        }
      }
    } catch (err) {
      console.warn('[share] resolvePackageImage failed', key, err);
    }
  }

  resolvedImageCache[key] = key;
  return key;
}

function encodeQuery(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v != null && String(v) !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

function buildQuery(extra = {}) {
  const ctx = contextGetter() || {};
  return encodeQuery({
    from: 'share',
    scene: ctx.scene || 'menu',
    endingId: ctx.endingId || '',
    ...extra,
  });
}

function buildFriendTitle(ctx) {
  if (ctx.scene === 'ending' && ctx.endingTitle) {
    return `我打出了结局「${ctx.endingTitle}」— 本科生的四年日记`;
  }
  if (ctx.playerName) {
    return `${ctx.playerName}的大学四年，等你来写 — 本科生的四年日记`;
  }
  if (ctx.schoolName) {
    return `在${ctx.schoolName}的四年会是什么样？来试试`;
  }
  return DEFAULT_FRIEND_TITLE;
}

function buildTimelineTitle(ctx) {
  if (ctx.scene === 'ending' && ctx.endingTitle) {
    return `【结局】${ctx.endingTitle} · 本科生的四年日记`;
  }
  return DEFAULT_TIMELINE_TITLE;
}

function friendImageUrl() {
  return resolvePackageImage(SHARE_ASSETS.card || FALLBACK_IMAGE);
}

function timelineImageUrl() {
  return resolvePackageImage(
    SHARE_ASSETS.timeline || SHARE_ASSETS.card || FALLBACK_IMAGE,
  );
}

function timelinePreviewUrl() {
  return resolvePackageImage(
    SHARE_ASSETS.preview || SHARE_ASSETS.timeline || SHARE_ASSETS.card || FALLBACK_IMAGE,
  );
}

export function buildShareAppMessagePayload(override = {}) {
  const ctx = contextGetter() || {};
  return {
    title: buildFriendTitle(ctx),
    imageUrl: friendImageUrl(),
    query: buildQuery(),
    ...override,
  };
}

export function buildShareTimelinePayload(override = {}) {
  const ctx = contextGetter() || {};
  const payload = {
    title: buildTimelineTitle(ctx),
    imageUrl: timelineImageUrl(),
    query: buildQuery(),
    ...override,
  };
  payload.imagePreviewUrl = timelinePreviewUrl();
  return payload;
}

/**
 * 注册被动分享（右上角 ···）与朋友圈入口。
 * @param {() => object} getContext 由 Main 提供：scene、endingTitle、playerName 等
 */
function enableShareMenus() {
  if (typeof wx === 'undefined' || !wx.showShareMenu) return;
  try {
    wx.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline'],
    });
  } catch (err) {
    console.warn('[share] showShareMenu failed', err);
  }
}

function bindPassiveShareHandlers() {
  if (typeof wx === 'undefined') return;

  if (wx.offShareAppMessage) wx.offShareAppMessage();
  if (wx.onShareAppMessage) {
    wx.onShareAppMessage(() => buildShareAppMessagePayload());
  }

  if (wx.offShareTimeline) wx.offShareTimeline();
  if (wx.onShareTimeline) {
    wx.onShareTimeline(() => buildShareTimelinePayload());
  }
}

export function initShare(getContext) {
  if (typeof getContext === 'function') {
    contextGetter = getContext;
  }
  if (typeof wx === 'undefined') return;

  enableShareMenus();
  bindPassiveShareHandlers();

  // 部分客户端从后台恢复后分享菜单会消失，需在 onShow 时重新开启
  if (wx.onShow) {
    wx.onShow(() => {
      enableShareMenus();
    });
  }
}

/** 主动转发给朋友（主菜单 / 结局页按钮） */
export function shareToFriend(override = {}) {
  if (typeof wx === 'undefined' || !wx.shareAppMessage) {
    return false;
  }
  wx.shareAppMessage(buildShareAppMessagePayload(override));
  return true;
}

/** 朋友圈须走右上角菜单，游戏内不可直接拉起 */
export function getShareTimelineHint() {
  return '分享到朋友圈：点右上角 ··· →「分享到朋友圈」（需较新微信；Android 支持较好）';
}

/** 主菜单 Toast 用短提示 */
export function getShareTimelineHintShort() {
  return '点右上角 ··· →「分享到朋友圈」';
}

export function parseLaunchShareQuery(query) {
  if (!query) return null;
  if (typeof query === 'object' && !Array.isArray(query)) return query;
  const out = {};
  String(query)
    .split('&')
    .forEach((pair) => {
      const eq = pair.indexOf('=');
      if (eq < 0) return;
      const k = decodeURIComponent(pair.slice(0, eq));
      const v = decodeURIComponent(pair.slice(eq + 1));
      if (k) out[k] = v;
    });
  return out;
}

/** 是否从分享链接进入 */
export function getLaunchShareInfo() {
  if (typeof wx === 'undefined') return null;
  try {
    const launch = wx.getLaunchOptionsSync && wx.getLaunchOptionsSync();
    const scene = Number(launch?.scene);
    const q = parseLaunchShareQuery(launch?.query);
    if (!q || !q.from) return null;
    return { scene, query: q };
  } catch {
    return null;
  }
}
