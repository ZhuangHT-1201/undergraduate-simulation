import assert from 'node:assert/strict';

const created = [];
const rewardedResults = [{ isEnded: true }, { isEnded: false }];
let rewardedClose = null;
let rewardedShowCalls = 0;
let interstitialShowCalls = 0;
let failFirstRewardedShow = true;

globalThis.wx = {
  createRewardedVideoAd(options) {
    const ad = {
      adUnitId: options.adUnitId,
      onError() {},
      onClose(handler) { rewardedClose = handler; },
      offClose(handler) {
        if (rewardedClose === handler) rewardedClose = null;
      },
      show() {
        rewardedShowCalls += 1;
        if (failFirstRewardedShow) {
          failFirstRewardedShow = false;
          return Promise.reject(new Error('preload miss'));
        }
        const result = rewardedResults.shift() || { isEnded: true };
        setTimeout(() => rewardedClose && rewardedClose(result), 0);
        return Promise.resolve();
      },
      load() { return Promise.resolve(); },
    };
    created.push(ad);
    return ad;
  },
  createInterstitialAd(options) {
    const ad = {
      adUnitId: options.adUnitId,
      onError() {},
      show() {
        interstitialShowCalls += 1;
        return Promise.resolve();
      },
      load() { return Promise.resolve(); },
    };
    created.push(ad);
    return ad;
  },
};

const ads = await import('../js/ads/adAdapter.js');
ads.warmUpAds();
assert.equal(created[0].adUnitId, 'adunit-3576f34e778862b1');
assert.equal(created[1].adUnitId, 'adunit-c2830c8c35122125');

const completed = await ads.showRewardedVideo('test_completed');
assert.equal(completed.ok, true);
assert.equal(rewardedShowCalls, 2);

const skipped = await ads.showRewardedVideo('test_skipped');
assert.equal(skipped.ok, false);
assert.equal(skipped.reason, 'closed_early');

const interstitial = await ads.showInterstitial('test_semester_complete');
assert.equal(interstitial.ok, true);
assert.equal(interstitialShowCalls, 1);

console.log('ad_adapter_ok');
