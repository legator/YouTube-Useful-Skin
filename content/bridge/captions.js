function mapCaptionTracks(captionTracks) {
  return captionTracks.map((ct) => ({
    languageCode: ct.languageCode,
    languageName: ct.name?.simpleText || ct.name?.runs?.map(r => r.text).join('') || ct.languageCode,
    displayName: ct.name?.simpleText || ct.name?.runs?.map(r => r.text).join('') || ct.languageCode,
    kind: ct.kind || '',
    vss_id: ct.vssId || '',
    is_translateable: ct.isTranslatable || false,
    _raw: ct,
  }));
}

export function getCaptions(ytP, payload, reply) {
  if (!ytP) { reply({ tracks: [], current: null }); return; }
  let tracks = [];
  let current = null;

  /* Method 1: getOption API */
  try {
    const list = ytP.getOption('captions', 'tracklist');
    if (Array.isArray(list) && list.length > 0) tracks = list;
  } catch (_) {}

  /* Method 2: player's internal caption module (playerResponse) */
  if (tracks.length === 0) {
    try {
      const cts = ytP.getPlayerResponse?.()?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(cts) && cts.length > 0) tracks = mapCaptionTracks(cts);
    } catch (_) {}
  }

  /* Method 3: Try via ytInitialPlayerResponse global */
  if (tracks.length === 0) {
    try {
      const cts = window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(cts) && cts.length > 0) tracks = mapCaptionTracks(cts);
    } catch (_) {}
  }

  try { current = ytP.getOption('captions', 'track'); } catch (_) {}

  reply({ tracks, current });
}

export function setCaptions(ytP, payload, reply) {
  if (!ytP) { reply({ ok: false }); return; }
  /* If the track came from mapCaptionTracks(), use the original object the
     player API recognises; fall back to the mapped wrapper otherwise. */
  const track = payload.track?._raw ?? payload.track;
  try {
    if (track && track.languageCode) {
      ytP.loadModule('captions');
      /* Poll until the module accepts the option (max 10 attempts × 200ms = 2s) */
      let attempts = 0;
      const maxAttempts = 10;
      const retryDelay = 200;
      
      (function trySetCaption() {
        try {
          ytP.setOption('captions', 'track', track);
          reply({ ok: true });
        } catch (err) {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(trySetCaption, retryDelay);
          } else {
            console.warn('[YTP-Skin] Failed to set captions after retries');
            reply({ ok: false });
          }
        }
      })();
      return; /* Reply is sent asynchronously */
    } else {
      try { ytP.setOption('captions', 'track', {}); } catch (_) {}
      try { ytP.unloadModule('captions'); } catch (_) {}
    }
  } catch (err) {
    console.warn('[YTP-Skin] Caption error:', err);
  }
  reply({ ok: true });
}
