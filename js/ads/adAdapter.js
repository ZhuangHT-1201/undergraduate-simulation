export const AD_CONFIG = {
  rewardedEnabled: true,
  interstitialEnabled: true,
  rewardedAdUnitId: 'adunit-3576f34e778862b1',
  interstitialAdUnitId: 'adunit-c2830c8c35122125',
};

let rewardedVideoAd = null;
let interstitialAd = null;
let rewardedCloseHandler = null;

function canUseRewardedAd() {
  return (
    AD_CONFIG.rewardedEnabled
    && AD_CONFIG.rewardedAdUnitId
    && typeof wx !== 'undefined'
    && typeof wx.createRewardedVideoAd === 'function'
  );
}

function canUseInterstitialAd() {
  return (
    AD_CONFIG.interstitialEnabled
    && AD_CONFIG.interstitialAdUnitId
    && typeof wx !== 'undefined'
    && typeof wx.createInterstitialAd === 'function'
  );
}

function getRewardedAd() {
  if (!canUseRewardedAd()) return null;
  if (rewardedVideoAd) return rewardedVideoAd;
  try {
    rewardedVideoAd = wx.createRewardedVideoAd({
      adUnitId: AD_CONFIG.rewardedAdUnitId,
    });
    if (typeof rewardedVideoAd.onError === 'function') rewardedVideoAd.onError(() => {});
  } catch (error) {
    rewardedVideoAd = null;
  }
  return rewardedVideoAd;
}

function getInterstitialAd() {
  if (!canUseInterstitialAd()) return null;
  if (interstitialAd) return interstitialAd;
  try {
    interstitialAd = wx.createInterstitialAd({
      adUnitId: AD_CONFIG.interstitialAdUnitId,
    });
    if (typeof interstitialAd.onError === 'function') interstitialAd.onError(() => {});
  } catch (error) {
    interstitialAd = null;
  }
  return interstitialAd;
}

export function warmUpAds() {
  getRewardedAd();
  getInterstitialAd();
}

function clearRewardedHandler() {
  if (!rewardedVideoAd || !rewardedCloseHandler) return;
  try {
    rewardedVideoAd.offClose(rewardedCloseHandler);
  } catch (error) {
    // Older client libraries can omit offClose.
  }
  rewardedCloseHandler = null;
}

export function showRewardedVideo(placement) {
  if (!AD_CONFIG.rewardedEnabled) {
    return Promise.resolve({ ok: false, reason: 'disabled' });
  }
  const ad = getRewardedAd();
  if (!ad) {
    return Promise.resolve({ ok: false, reason: 'no_sdk' });
  }
  if (rewardedCloseHandler) {
    return Promise.resolve({ ok: false, reason: 'busy' });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearRewardedHandler();
      resolve({ ...result, placement });
    };
    rewardedCloseHandler = (result) => {
      const completed = !result || result.isEnded !== false;
      finish({ ok: completed, reason: completed ? 'completed' : 'closed_early' });
    };

    try {
      ad.onClose(rewardedCloseHandler);
      Promise.resolve(ad.show()).catch(() => {
        if (typeof ad.load !== 'function') {
          finish({ ok: false, reason: 'show_failed' });
          return;
        }
        Promise.resolve(ad.load())
          .then(() => ad.show())
          .catch(() => finish({ ok: false, reason: 'show_failed' }));
      });
    } catch (error) {
      finish({ ok: false, reason: 'show_failed' });
    }
  });
}

export function showInterstitial(placement) {
  if (!AD_CONFIG.interstitialEnabled) {
    return Promise.resolve({ ok: false, reason: 'disabled' });
  }
  const ad = getInterstitialAd();
  if (!ad) {
    return Promise.resolve({ ok: false, reason: 'no_sdk' });
  }
  return Promise.resolve()
    .then(() => ad.show())
    .then(() => ({ ok: true, placement }))
    .catch(() => {
      if (typeof ad.load !== 'function') return { ok: false, placement, reason: 'show_failed' };
      return Promise.resolve(ad.load())
        .then(() => ad.show())
        .then(() => ({ ok: true, placement }))
        .catch(() => ({ ok: false, placement, reason: 'show_failed' }));
    });
}
