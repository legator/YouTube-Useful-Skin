export function getQualities(ytP, payload, reply) {
  if (!ytP) { reply({ levels: [], current: '', qualityData: [] }); return; }
  let levels = [];
  let current = '';
  let qualityData = [];
  
  try { 
    levels = ytP.getAvailableQualityLevels() || []; 
  } catch (err) {
    console.warn('[YTP-Skin] Failed to get quality levels:', err);
  }
  
  try { 
    current = ytP.getPlaybackQuality() || ''; 
  } catch (err) {
    console.warn('[YTP-Skin] Failed to get current quality:', err);
  }

  try {
    if (typeof ytP.getAvailableQualityData === 'function') {
      qualityData = ytP.getAvailableQualityData() || [];
    }
  } catch (err) {
    console.warn('[YTP-Skin] Failed to get quality data:', err);
  }

  reply({ levels, current, qualityData });
}

export function setQuality(ytP, payload, reply) {
  if (!ytP) { reply({ ok: false }); return; }
  const q = payload.quality;
  if (!q) { reply({ ok: false }); return; }
  
  try {
    if (typeof ytP.setPlaybackQualityRange === 'function') {
      ytP.setPlaybackQualityRange(q, q);
    }
  } catch (err) {
    console.warn('[YTP-Skin] setPlaybackQualityRange failed:', err);
  }
  
  try { 
    ytP.setPlaybackQuality(q); 
  } catch (err) {
    console.warn('[YTP-Skin] setPlaybackQuality failed:', err);
    reply({ ok: false });
    return;
  }
  
  reply({ ok: true });
}
