export function getQualities(ytP, payload, reply) {
  if (!ytP) { reply({ levels: [], current: '' }); return; }
  let levels = [];
  let current = '';
  try { levels = ytP.getAvailableQualityLevels() || []; } catch (_) {}
  try { current = ytP.getPlaybackQuality() || ''; } catch (_) {}

  let qualityData = [];
  try {
    if (typeof ytP.getAvailableQualityData === 'function') {
      qualityData = ytP.getAvailableQualityData() || [];
    }
  } catch (_) {}

  reply({ levels, current, qualityData });
}

export function setQuality(ytP, payload, reply) {
  if (!ytP) { reply({ ok: false }); return; }
  const q = payload.quality;
  try {
    if (typeof ytP.setPlaybackQualityRange === 'function') {
      ytP.setPlaybackQualityRange(q, q);
    }
  } catch (_) {}
  try { ytP.setPlaybackQuality(q); } catch (_) {}
  reply({ ok: true });
}
