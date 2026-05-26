/**
 * 流量主预埋：统一广告入口，真正接入时在 mp 后台创建广告位并填写 adUnitId。
 * @see https://developers.weixin.qq.com/minigame/dev/guide/open-ability/ad/rewarded-video-ad.html
 */

export const AD_CONFIG = {
  /** 总开关：开发阶段保持 false */
  rewardedEnabled: false,
  interstitialEnabled: false,
  /** 替换为真实广告位 id */
  rewardedAdUnitId: '',
  interstitialAdUnitId: '',
};

let rewardedVideoAd = null;

function getRewardedAd() {
  if (!AD_CONFIG.rewardedAdUnitId || !wx.createRewardedVideoAd) return null;
  if (!rewardedVideoAd) {
    rewardedVideoAd = wx.createRewardedVideoAd({ adUnitId: AD_CONFIG.rewardedAdUnitId });
  }
  return rewardedVideoAd;
}

/**
 * @param {string} placement 埋点用，例如 ending_bonus / revive
 * @returns {Promise<{ ok: boolean }>}
 */
export function showRewardedVideo(placement) {
  if (!AD_CONFIG.rewardedEnabled) {
    return Promise.resolve({ ok: false, reason: 'disabled' });
  }
  const ad = getRewardedAd();
  if (!ad) {
    return Promise.resolve({ ok: false, reason: 'no_sdk' });
  }
  return new Promise((resolve) => {
    const onClose = (res) => {
      ad.offClose(onClose);
      const ok = !!(res && res.isEnded);
      resolve({ ok, placement });
    };
    ad.onClose(onClose);
    ad.show().catch(() => {
      ad.offClose(onClose);
      resolve({ ok: false, placement, reason: 'show_failed' });
    });
  });
}

export function showInterstitial(placement) {
  if (!AD_CONFIG.interstitialEnabled || !AD_CONFIG.interstitialAdUnitId || !wx.createInterstitialAd) {
    return Promise.resolve({ ok: false, reason: 'disabled' });
  }
  const interstitialAd = wx.createInterstitialAd({ adUnitId: AD_CONFIG.interstitialAdUnitId });
  return interstitialAd.show().then(() => ({ ok: true, placement })).catch(() => ({ ok: false, placement }));
}
