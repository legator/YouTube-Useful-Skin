function extractSpec(pr) {
  const r = pr?.storyboards?.playerStoryboardSpecRenderer;
  return r?.spec || r?.highResUrl || null;
}

export function getStoryboard(ytP, payload, reply) {
  let spec = null;
  let method = null;
  let isLive = false;

  /* Check if this is a live stream — live streams never have storyboard specs */
  try {
    if (ytP && typeof ytP.getVideoData === 'function') {
      isLive = ytP.getVideoData()?.isLive === true;
    }
    if (!isLive && ytP && typeof ytP.getDuration === 'function') {
      isLive = ytP.getDuration() === Infinity;
    }
  } catch (_) {}

  if (isLive) {
    reply({ spec: null, isLive: true });
    return;
  }

  /* Method 1: YouTube player API — getPlayerResponse() */
  try {
    if (ytP && typeof ytP.getPlayerResponse === 'function') {
      spec = extractSpec(ytP.getPlayerResponse());
      if (spec) method = 'playerAPI';
    }
  } catch (e) { console.warn('[YTP-Skin] storyboard method1 error:', e); }

  /* Method 2: ytInitialPlayerResponse global */
  if (!spec) {
    try {
      spec = extractSpec(window.ytInitialPlayerResponse);
      if (spec) method = 'ytInitialPlayerResponse';
    } catch (e) { console.warn('[YTP-Skin] storyboard method2 error:', e); }
  }

  /* Method 3: scan <script> tags for embedded storyboard spec */
  if (!spec) {
    try {
      const scripts = document.querySelectorAll('script:not([src])');
      for (const s of scripts) {
        const txt = s.textContent;
        if (!txt || txt.length < 100) continue;
        if (txt.includes('playerStoryboardSpecRenderer')) {
          const m = txt.match(/"spec"\s*:\s*"(https:[^"]+)"/);
          if (m) {
            spec = m[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
            method = 'scriptTag';
            break;
          }
        }
      }
    } catch (e) { console.warn('[YTP-Skin] storyboard method3 error:', e); }
  }

  /* Method 4: ytcfg PLAYER_VARS */
  if (!spec) {
    try {
      const cfg = window.ytcfg?.get?.('PLAYER_VARS');
      if (cfg?.storyboard_spec) { spec = cfg.storyboard_spec; method = 'ytcfg'; }
    } catch (e) { console.warn('[YTP-Skin] storyboard method4 error:', e); }
  }

  if (!spec) {
    console.warn('[YTP-Skin] storyboard spec NOT found (all 4 methods failed)');
  }

  reply({ spec });
}
