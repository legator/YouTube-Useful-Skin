/* ============================================================
   YouTube Custom Player Skin — Page-context bridge (entry point)
   Runs as an ES module in the MAIN WORLD (page context) so it
   can access the YouTube player API. Each action handler lives
   in its own file under content/bridge/.
   ============================================================ */

import { getQualities, setQuality }           from './bridge/quality.js';
import { getCaptions, setCaptions }           from './bridge/captions.js';
import { getSyncState }                       from './bridge/syncState.js';
import { getStoryboard }                      from './bridge/storyboard.js';
import { getChapters }                        from './bridge/chapters.js';
import { toggleFullscreen, syncFullscreenState } from './bridge/fullscreen.js';

const HANDLERS = {
  getQualities,
  setQuality,
  getCaptions,
  setCaptions,
  getSyncState,
  getStoryboard,
  getChapters,
  toggleFullscreen,
  syncFullscreenState,
};

function getPlayer() {
  const el = document.getElementById('movie_player');
  if (el && typeof el.getAvailableQualityLevels === 'function') return el;
  return null;
}

window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  if (!e.data || e.data.source !== 'ytp-skin-request') return;

  const { action, payload, id } = e.data;
  const ytP = getPlayer();

  function reply(data) {
    window.postMessage({ source: 'ytp-skin-response', id, data }, '*');
  }

  HANDLERS[action]?.(ytP, payload, reply);
});

/* Signal that the bridge is ready */
window.postMessage({ source: 'ytp-skin-bridge-ready' }, '*');
