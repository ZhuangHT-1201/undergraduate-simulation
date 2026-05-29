/**
 * 微信小游戏分享：右上角 ··· → 转发给朋友 / 分享到朋友圈 / 收藏。
 * @see https://developers.weixin.qq.com/minigame/dev/guide/open-ability/share/share.html
 * @see https://developers.weixin.qq.com/minigame/dev/guide/open-ability/share-timeline_game.html
 * @see https://developers.weixin.qq.com/minigame/dev/api/share/wx.onAddToFavorites.html
 */

/** 包内分享图路径（见 images/share/README.md） */
export const SHARE_ASSETS = {
  card: 'images/share/share_card.jpg',
  timeline: 'images/share/share_preview.jpg',
  preview: 'images/share/share_preview.jpg',
};

/** MP 后台审核分享图（可选，两者须同时填写） */
export const SHARE_MP_APPROVED = {
  imageUrlId: '',
  imageUrl: '',
};

const FALLBACK_IMAGE = 'images/generated/game_avatar.jpg';
const DEFAULT_FRIEND_TITLE = '本科生的四年日记 — 来体验你的大学四年';
const DEFAULT_TIMELINE_TITLE = '本科生的四年日记';

let shareBootstrapped = false;
let handlersRegistered = false;
let friendMenuReady = false;
let timelineMenuReady = false;
/** @type {ReturnType<typeof setTimeout> | null} */
let shareMenuTimer = null;
/** @type {Record<string, string>} */
const resolvedImageCache = {};

function normalizePackagePath(path) {
  if (!path) return '';
  return String(path).replace(/^\/+/, '');
}

function resolvePackageImage(path, fallback = FALLBACK_IMAGE) {
  const key = normalizePackagePath(path);
  if (!key) return normalizePackagePath(fallback);
  if (resolvedImageCache[key]) return resolvedImageCache[key];

  if (typeof wx !== 'undefined') {
    try {
      const fs = wx.getFileSystemManager && wx.getFileSystemManager();
      if (fs?.accessSync) {
        for (const candidate of [key, normalizePackageImage(fallback)]) {
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

function getRuntimePlatform() {
  if (typeof wx === 'undefined') return '';
  try {
    if (wx.getDeviceInfo) return String(wx.getDeviceInfo().platform || '');
    if (wx.getSystemInfoSync) return String(wx.getSystemInfoSync().platform || '');
  } catch {
    /* ignore */
  }
  return '';
}

/** 朋友圈 menus 参数仅 Android 真机稳定支持；devtools / iOS / Windows 会 fail */
function canEnableTimelineMenu() {
  if (typeof wx === 'undefined' || typeof wx.onShareTimeline !== 'function') return false;
  return getRuntimePlatform() === 'android';
}

function unifiedFriendImageUrl() {
  const id = String(SHARE_MP_APPROVED.imageUrlId || '').trim();
  const url = String(SHARE_MP_APPROVED.imageUrl || '').trim();
  if (id && url) return url;
  return resolvePackageImage(SHARE_ASSETS.card, FALLBACK_IMAGE);
}

function unifiedTimelineImageUrl() {
  const id = String(SHARE_MP_APPROVED.imageUrlId || '').trim();
  const url = String(SHARE_MP_APPROVED.imageUrl || '').trim();
  if (id && url) return url;
  return resolvePackageImage(
    SHARE_ASSETS.timeline || SHARE_ASSETS.card,
    FALLBACK_IMAGE,
  );
}

function unifiedTimelinePreviewUrl() {
  return resolvePackageImage(
    SHARE_ASSETS.preview || SHARE_ASSETS.timeline || SHARE_ASSETS.card,
    FALLBACK_IMAGE,
  );
}

function buildQuery() {
  return 'from=share';
}

function applyMpApprovedImage(payload) {
  const id = String(SHARE_MP_APPROVED.imageUrlId || '').trim();
  const url = String(SHARE_MP_APPROVED.imageUrl || '').trim();
  if (id && url) {
    payload.imageUrlId = id;
    payload.imageUrl = url;
  }
  return payload;
}

export function buildShareAppMessagePayload(override = {}) {
  const payload = {
    title: DEFAULT_FRIEND_TITLE,
    imageUrl: unifiedFriendImageUrl(),
    query: buildQuery(),
    ...override,
  };
  applyMpApprovedImage(payload);
  return payload;
}

export function buildShareTimelinePayload(override = {}) {
  const payload = {
    title: DEFAULT_TIMELINE_TITLE,
    imageUrl: unifiedTimelineImageUrl(),
    imagePreviewUrl: unifiedTimelinePreviewUrl(),
    query: buildQuery(),
    ...override,
  };
  applyMpApprovedImage(payload);
  return payload;
}

/** 收藏预览：与转发好友共用 share_card.jpg（5:4） */
export function buildAddToFavoritesPayload(override = {}) {
  const payload = {
    title: DEFAULT_TIMELINE_TITLE,
    imageUrl: unifiedFriendImageUrl(),
    query: buildQuery(),
    ...override,
  };
  applyMpApprovedImage(payload);
  return payload;
}

function registerShareHandlers() {
  if (handlersRegistered || typeof wx === 'undefined') return;
  handlersRegistered = true;

  if (wx.onShareAppMessage) {
    wx.onShareAppMessage(() => buildShareAppMessagePayload());
  }

  if (wx.onShareTimeline) {
    wx.onShareTimeline(() => buildShareTimelinePayload());
  }

  if (wx.onAddToFavorites) {
    wx.onAddToFavorites(() => buildAddToFavoritesPayload());
  }
}

function callShowShareMenu(options, label) {
  if (!wx?.showShareMenu) return;
  wx.showShareMenu({
    ...options,
    success: () => {
      if (label === 'friend') friendMenuReady = true;
      if (label === 'timeline') timelineMenuReady = true;
    },
    fail: (err) => {
      const platform = getRuntimePlatform() || 'unknown';
      console.warn(`[share] showShareMenu(${label}) fail`, { platform, err });
    },
  });
}

function enableShareMenus() {
  if (typeof wx === 'undefined' || !wx.showShareMenu) return;

  registerShareHandlers();

  // 1) 先只开「转发给朋友」—— devtools / iOS 也能成功
  callShowShareMenu({ menus: ['shareAppMessage'] }, 'friend');

  // 2) Android 真机再追加「分享到朋友圈」（带 shareTimeline 在非 Android 会直接 fail）
  if (canEnableTimelineMenu()) {
    callShowShareMenu({
      menus: ['shareAppMessage', 'shareTimeline'],
    }, 'timeline');
  } else if (!timelineMenuReady && shareBootstrapped) {
    const platform = getRuntimePlatform() || 'unknown';
    console.info(
      `[share] 朋友圈分享菜单未开启（当前平台: ${platform}）。`
      + ' 微信规定小游戏朋友圈仅 Android 真机可用，开发者工具里会显示「未设置分享」属正常。',
    );
  }
}

function scheduleEnableShareMenus() {
  if (shareMenuTimer) clearTimeout(shareMenuTimer);
  shareMenuTimer = setTimeout(() => {
    shareMenuTimer = null;
    enableShareMenus();
  }, 0);
}

export function bootstrapShare() {
  if (shareBootstrapped || typeof wx === 'undefined') return;
  shareBootstrapped = true;

  registerShareHandlers();
  scheduleEnableShareMenus();

  if (wx.onShow) {
    wx.onShow(() => scheduleEnableShareMenus());
  }
}

/** Main 首帧渲染后再刷新一次分享菜单 */
export function initShare() {
  scheduleEnableShareMenus();
}

export function getShareTimelineHint() {
  if (canEnableTimelineMenu()) {
    return '分享给好友 / 分享到朋友圈：点右上角 ··· 使用转发与朋友圈按钮。';
  }
  return '分享给好友：点右上角 ··· → 转发。\n'
    + '分享到朋友圈：仅 Android 真机微信可用；开发者工具 / iPhone 无法测试该功能。';
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
