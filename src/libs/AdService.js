// src/libs/AdService.js
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const AdService = {
  async showRewarded() {
    // Poki
    if (window.PokiSDK && typeof window.PokiSDK.rewardedBreak === 'function') {
      try {
        await window.PokiSDK.rewardedBreak();
        return { ok: true, provider: 'poki', reward: true };
      } catch (e) {
        console.warn('[AdService] Poki rewarded error:', e);
        return { ok: false, provider: 'poki', error: e };
      }
    }

    // CrazyGames
    if (window.CrazyGames?.Ad?.adRequest) {
      try {
        const result = await window.CrazyGames.Ad.adRequest('rewarded');
        return { ok: !!result?.completed, provider: 'crazygames', reward: !!result?.completed };
      } catch (e) {
        console.warn('[AdService] CrazyGames rewarded error:', e);
        return { ok: false, provider: 'crazygames', error: e };
      }
    }

    // Fallback stub for dev
    console.log('[AdService] Using stub rewarded ad…');
    await wait(1200);
    return { ok: true, provider: 'stub', reward: true };
  },

  async showInterstitial() {
    // Poki
    if (window.PokiSDK && typeof window.PokiSDK.commercialBreak === 'function') {
      try {
        await window.PokiSDK.commercialBreak();
        return { ok: true, provider: 'poki' };
      } catch (e) {
        console.warn('[AdService] Poki interstitial error:', e);
        return { ok: false, provider: 'poki', error: e };
      }
    }

    // CrazyGames
    if (window.CrazyGames?.Ad?.adRequest) {
      try {
        await window.CrazyGames.Ad.adRequest('midgame');
        return { ok: true, provider: 'crazygames' };
      } catch (e) {
        console.warn('[AdService] CrazyGames interstitial error:', e);
        return { ok: false, provider: 'crazygames', error: e };
      }
    }

    // Fallback stub
    console.log('[AdService] Using stub interstitial…');
    await wait(250); // snappier dev feel
    return { ok: true, provider: 'stub' };
  },
};

export default AdService;
