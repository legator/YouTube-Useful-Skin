export function getSyncState(ytP, payload, reply) {
  let quality = '';
  let captionActive = false;
  try { quality = ytP ? (ytP.getPlaybackQuality?.() || '') : ''; } catch (_) {}
  try {
    const t = ytP?.getOption?.('captions', 'track');
    captionActive = !!(t && t.languageCode);
  } catch (_) {}
  reply({ quality, captionActive });
}
