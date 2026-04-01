export function toggleFullscreen(ytP, payload, reply) {
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
}

export function syncFullscreenState(ytP, payload, reply) {
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
}
