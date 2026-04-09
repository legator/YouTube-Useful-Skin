export function getSyncState(ytP, payload, reply) {
  let quality = '';
  let captionActive = false;
  let isAtLiveHead = null;
  let isLive = false;
  try { quality = ytP ? (ytP.getPlaybackQuality?.() || '') : ''; } catch (_) {}
  try {
    const t = ytP?.getOption?.('captions', 'track');
    captionActive = !!(t && t.languageCode);
  } catch (_) {}
  try {
    /* YouTube player API: isAtLiveHead() returns true when at live edge */
    if (ytP && typeof ytP.isAtLiveHead === 'function') {
      isAtLiveHead = ytP.isAtLiveHead();
    }
  } catch (_) {}
  try {
    /* getVideoData().isLive is the authoritative API flag — set by YouTube's own
       player code regardless of stream protocol (HLS or DASH). */
    if (ytP && typeof ytP.getVideoData === 'function') {
      const vd = ytP.getVideoData();
      isLive = vd?.isLive === true;
    }
    /* Fallback: getDuration() === Infinity works for HLS live but not always DASH */
    if (!isLive && ytP && typeof ytP.getDuration === 'function') {
      isLive = ytP.getDuration() === Infinity;
    }
  } catch (_) {}
  reply({ quality, captionActive, isAtLiveHead, isLive });
}
