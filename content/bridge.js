/* ============================================================
   YouTube Custom Player Skin — Page-context bridge
   This script runs in the MAIN WORLD (page context) so it can
   access the YouTube player API.  It communicates with the
   content script via window.postMessage.
   ============================================================ */

(function () {
  'use strict';

  function getPlayer() {
    const el = document.getElementById('movie_player');
    if (el && typeof el.getAvailableQualityLevels === 'function') return el;
    return null;
  }

  /* ---- helpers ---- */
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

  function extractSpec(pr) {
    const r = pr?.storyboards?.playerStoryboardSpecRenderer;
    return r?.spec || r?.highResUrl || null;
  }

  /* ---- respond to requests from content script ---- */
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    if (!e.data || e.data.source !== 'ytp-skin-request') return;

    const { action, payload, id } = e.data;
    const ytP = getPlayer();

    function reply(data) {
      window.postMessage({ source: 'ytp-skin-response', id, data }, '*');
    }

    switch (action) {
      /* ---------- Quality ---------- */
      case 'getQualities': {
        if (!ytP) { reply({ levels: [], current: '' }); return; }
        let levels = [];
        let current = '';
        try { levels = ytP.getAvailableQualityLevels() || []; } catch (_) {}
        try { current = ytP.getPlaybackQuality() || ''; } catch (_) {}

        /* Also try getAvailableQualityData for richer info */
        let qualityData = [];
        try {
          if (typeof ytP.getAvailableQualityData === 'function') {
            qualityData = ytP.getAvailableQualityData() || [];
          }
        } catch (_) {}

        reply({ levels, current, qualityData });
        break;
      }

      case 'setQuality': {
        if (!ytP) { reply({ ok: false }); return; }
        const q = payload.quality;
        try {
          if (typeof ytP.setPlaybackQualityRange === 'function') {
            ytP.setPlaybackQualityRange(q, q);
          }
        } catch (_) {}
        try { ytP.setPlaybackQuality(q); } catch (_) {}
        reply({ ok: true });
        break;
      }

      /* ---------- Captions / Subtitles ---------- */
      case 'getCaptions': {
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
        break;
      }

      case 'setCaptions': {
        if (!ytP) { reply({ ok: false }); return; }
        const track = payload.track;
        try {
          if (track && track.languageCode) {
            ytP.loadModule('captions');
            /* Small delay to ensure module is loaded */
            setTimeout(() => {
              try { ytP.setOption('captions', 'track', track); } catch (_) {}
            }, 100);
          } else {
            try { ytP.setOption('captions', 'track', {}); } catch (_) {}
            try { ytP.unloadModule('captions'); } catch (_) {}
          }
        } catch (_) {}
        reply({ ok: true });
        break;
      }

      case 'getSyncState': {
        let quality = '';
        let captionActive = false;
        try { quality = ytP ? (ytP.getPlaybackQuality?.() || '') : ''; } catch (_) {}
        try {
          const t = ytP?.getOption?.('captions', 'track');
          captionActive = !!(t && t.languageCode);
        } catch (_) {}
        reply({ quality, captionActive });
        break;
      }

      /* ---------- Storyboard / Thumbnails ---------- */
      case 'getStoryboard': {
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
                /* Match "spec":"VALUE" in JSON */
                const m = txt.match(/"spec"\s*:\s*"(https?:[^"]+)"/);
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
            if (cfg?.storyboard_spec) {
              spec = cfg.storyboard_spec;
            }
          } catch (_) {}
        }

        reply({ spec });
        break;
      }

      /* ---------- Chapters / Timecodes ---------- */
      case 'getChapters': {
        let chapters = [];

        /* Method 1: decoratedPlayerBarRenderer (most reliable for structured chapters) */
        try {
          const resp = ytP ? ytP.getPlayerResponse?.() : null;
          const pr = resp || window.ytInitialPlayerResponse;
          if (pr) {
            const po = pr.playerOverlays;
            if (po) {
              const deco = po.playerOverlayRenderer?.decoratedPlayerBarRenderer?.decoratedPlayerBarRenderer;
              const markers = deco?.playerBar?.multiMarkersPlayerBarRenderer?.markersMap;
              if (Array.isArray(markers)) {
                for (const marker of markers) {
                  const chs = marker.value?.chapters;
                  if (Array.isArray(chs)) {
                    chs.forEach((ch) => {
                      const cr = ch.chapterRenderer;
                      if (cr) {
                        const startMs = parseInt(cr.timeRangeStartMillis, 10) || 0;
                        const title = cr.title?.simpleText || cr.title?.runs?.map(r => r.text).join('') || '';
                        chapters.push({ startTime: startMs / 1000, title });
                      }
                    });
                  }
                }
              }
            }
          }
        } catch (_) {}

        /* Method 2: engagementPanels with chapters */
        if (chapters.length === 0) {
          try {
            const pr = (ytP ? ytP.getPlayerResponse?.() : null) || window.ytInitialPlayerResponse;
            if (pr && pr.engagementPanels) {
              for (const panel of pr.engagementPanels) {
                const macro = panel.engagementPanelSectionListRenderer?.content?.macroMarkersListRenderer;
                if (macro && macro.contents) {
                  macro.contents.forEach((item) => {
                    const mr = item.macroMarkersListItemRenderer;
                    if (mr) {
                      const startSec = parseInt(mr.timeDescription?.simpleText?.split(':').reduce((a, b) => a * 60 + parseInt(b, 10), 0), 10) || 0;
                      const title = mr.title?.simpleText || mr.title?.runs?.map(r => r.text).join('') || '';
                      const onTap = mr.onTap?.watchEndpoint?.startTimeSeconds;
                      chapters.push({ startTime: onTap != null ? onTap : startSec, title });
                    }
                  });
                }
              }
            }
          } catch (_) {}
        }

        /* Method 3: Parse description for timestamp lines (0:00 Title / 00:00 Title / 0:00:00 Title) */
        if (chapters.length === 0) {
          try {
            const pr = (ytP ? ytP.getPlayerResponse?.() : null) || window.ytInitialPlayerResponse;
            const desc = pr?.videoDetails?.shortDescription || '';
            const lines = desc.split('\n');
            const tsRe = /^[\s\-–•]*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)/;
            for (const line of lines) {
              const m = line.match(tsRe);
              if (m) {
                const h = parseInt(m[1] || '0', 10);
                const min = parseInt(m[2], 10);
                const sec = parseInt(m[3], 10);
                const t = h * 3600 + min * 60 + sec;
                chapters.push({ startTime: t, title: m[4].trim() });
              }
            }
          } catch (_) {}
        }

        /* Sort by start time & deduplicate */
        chapters.sort((a, b) => a.startTime - b.startTime);
        const seen = new Set();
        chapters = chapters.filter(ch => {
          const key = ch.startTime + '|' + ch.title;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        reply({ chapters });
        break;
      }

      /* ---------- Fullscreen ---------- */
      case 'toggleFullscreen': {
        /* Method 1: use YouTube's internal API */
        let done = false;
        if (ytP) {
          try {
            /* YouTube player has toggleFullscreen in its prototype */
            if (typeof ytP.toggleFullscreen === 'function') {
              ytP.toggleFullscreen();
              done = true;
            }
          } catch (_) {}

          /* Method 2: simulate pressing 'f' key from page context */
          if (!done) {
            try {
              const ev = new KeyboardEvent('keydown', {
                key: 'f', code: 'KeyF', keyCode: 70, which: 70,
                bubbles: true, cancelable: true
              });
              document.dispatchEvent(ev);
              done = true;
            } catch (_) {}
          }
        }

        /* Method 3: click YouTube's fullscreen button directly from page context */
        if (!done) {
          try {
            const fsBtn = document.querySelector('.ytp-fullscreen-button');
            if (fsBtn) { fsBtn.click(); done = true; }
          } catch (_) {}
        }

        reply({ ok: done });
        break;
      }

      /* ---------- Sync fullscreen state (without toggling) ---------- */
      case 'syncFullscreenState': {
        /* Tell YouTube's player that fullscreen state changed externally.
           This syncs YouTube's internal state machine without calling requestFullscreen. */
        const enter = payload && payload.enter;
        let synced = false;
        if (ytP) {
          try {
            /* Try YouTube's internal setFullscreen if available */
            if (typeof ytP.setFullscreen === 'function') {
              ytP.setFullscreen(enter);
              synced = true;
            }
          } catch (_) {}

          if (!synced) {
            try {
              /* Try toggling only when state mismatches */
              const playerEl = document.getElementById('movie_player');
              const isYTFS = playerEl && playerEl.classList.contains('ytp-fullscreen');
              if (enter !== !!isYTFS && typeof ytP.toggleFullscreen === 'function') {
                ytP.toggleFullscreen();
                synced = true;
              }
            } catch (_) {}
          }
        }
        reply({ ok: synced });
        break;
      }

      default:
        break;
    }
  });

  /* Signal that the bridge is ready */
  window.postMessage({ source: 'ytp-skin-bridge-ready' }, '*');
})();
