export function getSyncState(ytP, payload, reply) {
  let quality = '';
  let captionActive = false;
  let isAtLiveHead = null;
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
  reply({ quality, captionActive, isAtLiveHead });
}
