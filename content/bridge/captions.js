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
  const track = payload.track;
  try {
    if (track && track.languageCode) {
      ytP.loadModule('captions');
      /* Poll until the module accepts the option (up to 10 × 200 ms = 2 s) */
      (function trySetCaption(attempts) {
        try {
          ytP.setOption('captions', 'track', track);
        } catch (_) {
          if (attempts < 10) setTimeout(() => trySetCaption(attempts + 1), 200);
        }
      })(0);
    } else {
      try { ytP.setOption('captions', 'track', {}); } catch (_) {}
      try { ytP.unloadModule('captions'); } catch (_) {}
    }
  } catch (_) {}
  reply({ ok: true });
}
