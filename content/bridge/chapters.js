export function getChapters(ytP, payload, reply) {
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
}
