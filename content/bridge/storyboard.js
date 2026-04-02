function extractSpec(pr) {
  const r = pr?.storyboards?.playerStoryboardSpecRenderer;
  return r?.spec || r?.highResUrl || null;
}

export function getStoryboard(ytP, payload, reply) {
  let spec = null;

  /* Method 1: YouTube player API — getPlayerResponse() */
  try {
    if (ytP && typeof ytP.getPlayerResponse === 'function') {
      spec = extractSpec(ytP.getPlayerResponse());
    }
  } catch (_) {}

  /* Method 2: ytInitialPlayerResponse global */
  if (!spec) {
    try { spec = extractSpec(window.ytInitialPlayerResponse); } catch (_) {}
  }

  /* Method 3: scan <script> tags for embedded storyboard spec */
  if (!spec) {
    try {
      const scripts = document.querySelectorAll('script:not([src])');
      for (const s of scripts) {
        const txt = s.textContent;
        if (!txt || txt.length < 100) continue;
        if (txt.includes('playerStoryboardSpecRenderer')) {
          /* Match "spec":"VALUE" in JSON - only accept HTTPS URLs for security */
          const m = txt.match(/"spec"\s*:\s*"(https:[^"]+)"/); /* Changed https? to https only */
          if (m) {
            spec = m[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
            break;
          }
        }
      }
    } catch (_) {}
  }

  /* Method 4: ytcfg PLAYER_VARS */
  if (!spec) {
    try {
      const cfg = window.ytcfg?.get?.('PLAYER_VARS');
      if (cfg?.storyboard_spec) spec = cfg.storyboard_spec;
    } catch (_) {}
  }

  reply({ spec });
}
