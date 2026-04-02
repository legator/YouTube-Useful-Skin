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

/* Get nonce from script tag data attribute for authentication */
const scriptEl = document.getElementById('ytp-skin-bridge');
const BRIDGE_NONCE = scriptEl?.dataset?.nonce || null;

if (!BRIDGE_NONCE) {
  console.error('[YTP-Skin Bridge] No nonce found - bridge will not respond to requests');
}

function getPlayer() {
  const el = document.getElementById('movie_player');
  if (el && typeof el.getAvailableQualityLevels === 'function') return el;
  return null;
}

window.addEventListener('message', (e) => {
  /* Security: Validate message origin, structure, and nonce */
  if (e.source !== window) return;
  if (!e.data || typeof e.data !== 'object') return;
  if (e.data.source !== 'ytp-skin-request') return;
  
  /* Validate nonce to prevent unauthorized scripts from using this bridge */
  if (!BRIDGE_NONCE || e.data.nonce !== BRIDGE_NONCE) {
    console.warn('[YTP-Skin Bridge] Invalid nonce - rejecting request');
    return;
  }

  const { action, payload, id } = e.data;
  
  /* Validate action is a known handler */
  if (!action || typeof action !== 'string' || !HANDLERS[action]) {
    console.warn('[YTP-Skin Bridge] Unknown action:', action);
    return;
  }

  const ytP = getPlayer();

  function reply(data) {
    window.postMessage({ source: 'ytp-skin-response', id, data, nonce: BRIDGE_NONCE }, '*');
  }

  try {
    HANDLERS[action](ytP, payload, reply);
  } catch (err) {
    console.error('[YTP-Skin Bridge] Handler error:', action, err);
    reply({ error: 'Handler failed' });
  }
});

/* Signal that the bridge is ready (include nonce for validation) */
window.postMessage({ source: 'ytp-skin-bridge-ready', nonce: BRIDGE_NONCE }, '*');
