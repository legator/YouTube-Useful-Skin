/* ============================================================
   YouTube Custom Player Skin — Content Script (entry point)
   Imports sub-modules, wires the YouTube player overlay, and
   handles SPA navigation re-injection.
   ============================================================ */

(async function () {
  'use strict';

  /* Bridge client — singleton, persists across SPA navigations */
  let bridgeMsgId = 0;
  const bridgeCallbacks = new Map();
  
  /* Generate a unique nonce for secure bridge communication */
  const bridgeNonce = (typeof crypto !== 'undefined' && crypto.randomUUID) 
    ? crypto.randomUUID() 
    : 'nonce-' + Date.now() + '-' + Math.random().toString(36).substring(2);

  let _bridgeReadyResolve;
  const bridgeReady = new Promise(res => { _bridgeReadyResolve = res; });
  
  /* Fallback: resolve after timeout so per-call timeouts can handle failures */
  /* Use hardcoded value since TIMING not imported yet */
  setTimeout(() => _bridgeReadyResolve(), 5000);

  window.addEventListener('message', (e) => {
    /* Security: Validate message origin, structure, and nonce */
    if (e.source !== window) return;
    if (!e.data || typeof e.data !== 'object') return;
    
    if (e.data.source === 'ytp-skin-bridge-ready') {
      /* Validate nonce if available */
      if (bridgeNonce && e.data.nonce && e.data.nonce !== bridgeNonce) {
        console.warn('[YTP-Skin] Bridge nonce mismatch');
        return;
      }
      _bridgeReadyResolve(); 
      return; 
    }
    
    if (e.data.source !== 'ytp-skin-response') return;
    /* Validate nonce if available */
    if (bridgeNonce && e.data.nonce && e.data.nonce !== bridgeNonce) {
      console.warn('[YTP-Skin] Response nonce mismatch');
      return;
    }
    
    const cb = bridgeCallbacks.get(e.data.id);
    if (cb) { 
      bridgeCallbacks.delete(e.data.id); 
      cb(e.data.data); 
    }
  });

  function bridgeCall(action, payload) {
    return bridgeReady.then(() => new Promise((resolve) => {
      const id = ++bridgeMsgId;
      bridgeCallbacks.set(id, resolve);
      window.postMessage({ source: 'ytp-skin-request', action, payload, id, nonce: bridgeNonce }, '*');
      /* Timeout protection - use hardcoded value since TIMING not imported yet */
      setTimeout(() => { 
        if (bridgeCallbacks.has(id)) { 
          bridgeCallbacks.delete(id); 
          console.warn('[YTP-Skin] Bridge call timeout:', action);
          resolve(null); 
        } 
      }, 2000);
    }));
  }

  function injectBridge() {
    if (document.getElementById('ytp-skin-bridge')) return;
    const s = document.createElement('script');
    s.id = 'ytp-skin-bridge';
    s.type = 'module';
    s.src = chrome.runtime.getURL('content/bridge.js');
    /* Pass nonce to bridge via data attribute */
    s.dataset.nonce = bridgeNonce;
    (document.head || document.documentElement).appendChild(s);
  }
  injectBridge();

  /* Load sub-modules in parallel */
  const _base = chrome.runtime.getURL('content/skin/');
  let _imports;
  try {
    _imports = await Promise.all([
      import(_base + 'icons.js'),
      import(_base + 'utils.js'),
      import(_base + 'constants.js'),
      import(_base + 'buildSkin.js'),
      import(_base + 'storyboard.js'),
      import(_base + 'pip.js'),
      import(_base + 'mediaSession.js'),
    ]);
  } catch (err) {
    console.error('[YTP-Skin] Failed to load sub-modules — try reloading the extension:', err);
    return;
  }
  const [
    { ICONS, volIcon },
    { qs, ce, fmtTime },
    { QUALITY_LABELS, HD_QUALITIES, SPEED_OPTIONS, SKIP_SECONDS, TIMING },
    { buildSkin, attachSeekDrag, renderCCItems, renderQualityItems, renderAudioItems },
    { parseStoryboardSpec, storyboardUrl, storyboardFrame },
    { openDocumentPip, openBasicPip },
    { setupMediaSession },
  ] = _imports;

  /* Throttle utility for performance-critical event handlers */
  function throttle(fn, delay) {
    let lastCall = 0;
    let timeoutId = null;
    return function (...args) {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;
      if (timeSinceLastCall >= delay) {
        lastCall = now;
        fn.apply(this, args);
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          lastCall = Date.now();
          fn.apply(this, args);
        }, delay - timeSinceLastCall);
      }
    };
  }

  /* Module state */
  let skinInjected = false;
  let seeking = false;
  let cleanupSkin = null;

  function injectSkin() {
    const player = qs('.html5-video-player');
    const video = qs('video.html5-main-video');
    if (!player || !video) return;
    if (skinInjected && player.querySelector('.ytp-skin-top-bar')) return;

    /* Tear down previous instance before re-injecting */
    if (cleanupSkin) { cleanupSkin(); cleanupSkin = null; }

    /* clean up previous injection if navigated */
    player.querySelectorAll('.ytp-skin-top-bar, .ytp-skin-bottom-bar').forEach(e => e.remove());

    const ui = buildSkin();
    player.appendChild(ui.topBar);
    player.appendChild(ui.bottomBar);
    player.appendChild(ui.clickOverlay);
    skinInjected = true;

    /* ---- metadata ---- */
    let lastMetaHash = '';
    function updateMeta() {
      try {
        const titleText = qs('#title h1 yt-formatted-string, #info-contents h1 yt-formatted-string, h1.ytd-watch-metadata yt-formatted-string');
        const channelText = qs('#owner #channel-name a, ytd-video-owner-renderer #channel-name a, #upload-info #channel-name a');
        const viewInfo = qs('#info-text #info span, ytd-watch-metadata #info span, #info-strings yt-formatted-string');
        
        const title = titleText ? titleText.textContent.trim() : '';
        const channel = channelText ? channelText.textContent.trim() : '';
        const views = viewInfo ? viewInfo.textContent.trim() : '';
        
        /* Only update DOM if content actually changed (performance optimization) */
        const metaHash = JSON.stringify([title, channel, views]);
        if (metaHash !== lastMetaHash) {
          ui.titleEl.textContent = title;
          ui.channelEl.textContent = channel;
          ui.viewsEl.textContent = views;
          lastMetaHash = metaHash;
        }
      } catch (err) { 
        console.warn('[YTP-Skin] Metadata update failed:', err);
      }
    }
    updateMeta();
    const metaInterval = setInterval(updateMeta, TIMING.METADATA_UPDATE_INTERVAL);

    /* ---- Live stream helpers ---- */
    /* Once confirmed live, stays true for the lifetime of this skin instance */
    let isLiveStream = false;

    function updateLiveControls() {
      /* video.duration === Infinity is the definitive HLS live signal */
      if (!isLiveStream && video.duration === Infinity) isLiveStream = true;
      /* YouTube sets 'ytp-live' on the player element for live streams */
      if (!isLiveStream && player.classList.contains('ytp-live')) isLiveStream = true;
      ui.btnSkipBack.style.display = isLiveStream ? 'none' : '';
      ui.btnSkipFwd.style.display = isLiveStream ? 'none' : '';
      ui.btnChapPrev.style.display = isLiveStream ? 'none' : '';
      ui.btnChapNext.style.display = isLiveStream ? 'none' : '';
      ui.btnChapters.style.display = isLiveStream ? 'none' : '';
      ui.btnLive.style.display = isLiveStream ? 'flex' : 'none';
      if (isLiveStream) ui.btnLive.classList.add('at-live');
    }
    video.addEventListener('durationchange', updateLiveControls);
    video.addEventListener('loadedmetadata', updateLiveControls);

    /* MutationObserver: watch for YouTube adding 'ytp-live' to the player element.
       This fires immediately regardless of timing — no polling window to miss. */
    const liveClassObserver = new MutationObserver(() => {
      if (!isLiveStream && player.classList.contains('ytp-live')) {
        isLiveStream = true;
        updateLiveControls();
        liveClassObserver.disconnect();
      }
    });
    liveClassObserver.observe(player, { attributes: true, attributeFilter: ['class'] });

    /* Bridge-based live detection via ytP.getVideoData().isLive.
       Polls every 1 s for up to 10 s in case the YT player initialises slowly
       (common on SPA navigation where metadata arrives after skin injection).
       Stops immediately once live is confirmed. The interval is cleaned up in
       cleanupSkin so it never leaks across SPA navigations. */
    let liveCheckCount = 0;
    const liveCheckInterval = setInterval(async () => {
      if (isLiveStream) { clearInterval(liveCheckInterval); return; }
      const result = await bridgeCall('getSyncState', {});
      if (result?.isLive) {
        isLiveStream = true;
        updateLiveControls();
        clearInterval(liveCheckInterval);
      }
      if (++liveCheckCount >= 10) clearInterval(liveCheckInterval);
    }, 1000);

    updateLiveControls();

    /* ---- time & progress updates ---- */
    /* Throttled bridge poll for live-head status (every 2 s is enough) */
    let lastLiveHeadAtLive = true; /* default: assume at live until told otherwise */
    let liveHeadPollTimer = null;
    function scheduleLiveHeadPoll() {
      if (liveHeadPollTimer) return;
      liveHeadPollTimer = setTimeout(async () => {
        liveHeadPollTimer = null;
        if (!isLiveStream) return;
        const result = await bridgeCall('getSyncState', {});
        if (result && result.isAtLiveHead !== null && result.isAtLiveHead !== undefined) {
          lastLiveHeadAtLive = result.isAtLiveHead;
        }
      }, 2000);
    }

    function updateProgress() {
      if (seeking) return;

      /* Live stream handling — use cached flag, not isLive() re-check */
      if (isLiveStream) {
        const seekable = video.seekable;
        const cur = video.currentTime || 0;

        /* Seek bar position */
        let liveEdge = cur;
        let start = 0;
        if (seekable.length > 0) {
          liveEdge = seekable.end(seekable.length - 1);
          start = seekable.start(0);
        }
        const range = liveEdge - start;
        const pct = range > 0 ? Math.max(0, Math.min(100, ((cur - start) / range) * 100)) : 100;
        ui.seekFill.style.width = pct + '%';
        ui.seekThumb.style.left = pct + '%';
        ui.seekBuffer.style.width = '100%';
        const behind = Math.max(0, liveEdge - cur);
        ui.timeLeft.textContent = behind > 2 ? '\u2212' + fmtTime(Math.round(behind)) : 'LIVE';
        ui.timeRight.textContent = '';
        ui.chapNameEl.textContent = '';

        /* Use YouTube's own isAtLiveHead() via bridge (polled every 2 s).
           Fall back to seekable math only when bridge hasn't returned yet. */
        ui.btnLive.classList.toggle('at-live', lastLiveHeadAtLive);
        scheduleLiveHeadPoll();
        return;
      }

      const dur = video.duration || 0;
      const cur = video.currentTime || 0;
      ui.timeLeft.textContent = fmtTime(cur);
      ui.timeRight.textContent = fmtTime(dur);
      const pct = dur ? (cur / dur) * 100 : 0;
      ui.seekFill.style.width = pct + '%';
      ui.seekThumb.style.left = pct + '%';

      /* buffered */
      if (video.buffered && video.buffered.length > 0) {
        const buf = video.buffered.end(video.buffered.length - 1);
        ui.seekBuffer.style.width = (dur ? (buf / dur) * 100 : 0) + '%';
      }

      /* chapter marker colours */
      if (dur > 0) {
        chapterMarkerEls.forEach(el => {
          el.classList.toggle('played', parseFloat(el.style.left) < pct);
        });
      }

      /* current chapter name */
      const activeChap = getChapterAtTime(cur);
      ui.chapNameEl.textContent = activeChap ? activeChap.title : '';

      /* Update chapter menu highlight if visible */
      updateChapterMenuHighlight();
    }
    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('loadedmetadata', updateProgress);
    video.addEventListener('durationchange', updateProgress);

    /* ---- seek interaction ---- */
    attachSeekDrag(
      ui.seekArea, ui.seekTrack, ui.seekFill, ui.seekThumb, document, video,
      () => { seeking = true; }, () => { seeking = false; }, ui.seekTooltip
    );

    /* ---- Storyboard thumbnail preview helpers ---- */
    let storyboardData = null;
    const storyboardImageCache = new Map(); /* Cache loaded images for performance */
    let lastHover = null; /* Last hover position for re-triggering preview after image load */

    async function loadStoryboard() {
      if (storyboardData) return; /* Already loaded successfully */
      if (isLiveStream) return; /* Live streams have no storyboard */
      if (!getVideoId()) return; /* Not on a video page — no storyboard to fetch */

      const result = await bridgeCall('getStoryboard', {});

      /* Bridge confirmed this is a live stream — abort permanently, no retries */
      if (result?.isLive) { isLiveStream = true; updateLiveControls(); return; }

      if (result && result.spec) {
        const parsed = parseStoryboardSpec(result.spec);
        if (parsed) {
          /* Verify URL is reachable before committing */
          const testUrl = storyboardUrl(parsed, 0);
          const img = new Image();
          img.onload = () => {
            storyboardData = parsed;
            storyboardImageCache.set(testUrl, 'loaded');
            /* Re-trigger preview if user is already hovering over seek bar */
            if (lastHover) updateSeekPreview(lastHover.pct, lastHover.time);
          };
          img.onerror = () => {
            /* URL expired or unavailable — discard this spec and retry */
            storyboardRetries++;
            if (storyboardRetries < 5 && !isLiveStream) storyboardRetryTimer = setTimeout(loadStoryboard, TIMING.STORYBOARD_RETRY_DELAY);
          };
          img.src = testUrl;
          return; /* Done — onload/onerror will finalise */
        } else {
          console.warn('[YTP-Skin] parseStoryboardSpec returned null — spec may be malformed:', result.spec.slice(0, 200));
        }
      } else {
        console.warn('[YTP-Skin] No spec in result — retry', storyboardRetries + 1);
      }

      /* Spec not available yet — schedule a retry (up to 5 attempts) */
      storyboardRetries++;
      if (storyboardRetries < 5 && !isLiveStream) {
        storyboardRetryTimer = setTimeout(loadStoryboard, TIMING.STORYBOARD_RETRY_DELAY);
      }
    }

    let storyboardRetries = 0;
    let storyboardRetryTimer = null;

    /* Lazy load storyboard image with caching */
    function preloadStoryboardImage(url) {
      if (storyboardImageCache.has(url)) return;
      storyboardImageCache.set(url, 'loading');
      const img = new Image();
      img.onload = () => {
        storyboardImageCache.set(url, 'loaded');
        /* Re-trigger preview if user is still hovering over seek bar */
        if (lastHover) updateSeekPreview(lastHover.pct, lastHover.time);
      };
      img.onerror = () => {
        console.warn('[YTP-Skin] Sheet failed to load:', url);
        storyboardImageCache.set(url, 'failed'); /* Mark as failed to prevent infinite retries */
      };
      img.src = url;
    }

    function updateSeekPreview(pct, time) {
      if (!storyboardData) {
        ui.seekPreview.classList.remove('visible');
        return;
      }
      const dur = video.duration || 0;
      const frame = storyboardFrame(storyboardData, time, dur);
      if (!frame) {
        ui.seekPreview.classList.remove('visible');
        return;
      }
      /* Lazy load image only when needed */
      if (!storyboardImageCache.has(frame.url)) {
        preloadStoryboardImage(frame.url);
      }
      /* Only show preview if image is loaded or loading */
      const cacheStatus = storyboardImageCache.get(frame.url);
      if (cacheStatus === 'loaded') {
        /* Target display size for the preview popup */
        const TARGET_W = 160;
        const TARGET_H = 90;
        const scale = Math.min(TARGET_W / frame.w, TARGET_H / frame.h);

        ui.seekPreviewImg.style.backgroundImage = `url("${frame.url}")`;
        ui.seekPreviewImg.style.backgroundPosition = `-${frame.x}px -${frame.y}px`;
        ui.seekPreviewImg.style.backgroundSize = `${frame.cols * frame.w}px ${frame.rows * frame.h}px`;
        ui.seekPreviewImg.style.width = frame.w + 'px';
        ui.seekPreviewImg.style.height = frame.h + 'px';
        ui.seekPreviewImg.style.transform = `scale(${scale})`;
        ui.seekPreviewImg.style.transformOrigin = 'top left';
        ui.seekPreview.style.width = Math.round(frame.w * scale) + 'px';
        ui.seekPreview.style.height = Math.round(frame.h * scale) + 'px';
        ui.seekPreview.style.overflow = 'hidden';
        /* Position horizontally, clamped to seek area */
        let left = pct * 100;
        ui.seekPreview.style.left = left + '%';
        ui.seekPreview.classList.add('visible');
      } else {
        ui.seekPreview.classList.remove('visible');
      }
    }

    /* Load storyboard early — use a short delay so player response is available */
    storyboardRetryTimer = setTimeout(loadStoryboard, 500);
    function onStoryboardLoadedData() {
      /* Reset for new video */
      storyboardData = null;
      storyboardRetries = 0;
      clearTimeout(storyboardRetryTimer);
      storyboardImageCache.clear(); /* Clear cached images from previous video */
      ui.seekPreview.classList.remove('visible'); /* Hide any showing preview */
      lastHover = null;
      storyboardRetryTimer = setTimeout(loadStoryboard, TIMING.STORYBOARD_RELOAD_DELAY);
    }
    video.addEventListener('loadeddata', onStoryboardLoadedData);

    /* Throttled mousemove handler for seek area (60fps = ~16ms) */
    const handleSeekMouseMove = throttle((e) => {
      if (seeking) return;
      const rect = ui.seekTrack.getBoundingClientRect();
      let pct = (e.clientX - rect.left) / rect.width;
      pct = Math.max(0, Math.min(1, pct));
      const hoverTime = pct * (video.duration || 0);
      lastHover = { pct, time: hoverTime };
      const chapter = getChapterAtTime(hoverTime);
      const timeStr = fmtTime(hoverTime);
      ui.seekTooltip.textContent = chapter ? `${timeStr} • ${chapter.title}` : timeStr;
      ui.seekTooltip.style.left = (pct * 100) + '%';
      updateSeekPreview(pct, hoverTime);
    }, 16);
    
    ui.seekArea.addEventListener('mousemove', handleSeekMouseMove);

    ui.seekArea.addEventListener('mouseleave', () => {
      lastHover = null;
      ui.seekPreview.classList.remove('visible');
    });

    /* Also hide preview when mouse leaves the entire bottom bar
       (preview popup extends above the seek area so seekArea mouseleave isn't always triggered) */
    ui.bottomBar.addEventListener('mouseleave', () => {
      lastHover = null;
      ui.seekPreview.classList.remove('visible');
    });

    /* ---- play / pause ---- */
    function syncPlayBtn() {
      if (video.paused) {
        ui.btnPlay.innerHTML = ICONS.play;
        ui.btnPlay.classList.add('paused');
        ui.btnPlay.classList.remove('playing');
        ui.btnPlay.title = 'Play';
      } else {
        ui.btnPlay.innerHTML = ICONS.pause;
        ui.btnPlay.classList.remove('paused');
        ui.btnPlay.classList.add('playing');
        ui.btnPlay.title = 'Pause';
      }
    }
    video.addEventListener('play', syncPlayBtn);
    video.addEventListener('pause', syncPlayBtn);
    syncPlayBtn();

    /* Click on video area (overlay) to toggle play/pause */
    ui.clickOverlay.addEventListener('click', () => {
      closeAllMenus();
      if (video.paused) video.play(); else video.pause();
    });

    ui.btnPlay.addEventListener('click', () => {
      if (video.paused) video.play(); else video.pause();
    });

    /* ---- volume / mute ---- */

    function syncVolBtn() {
      ui.btnVol.innerHTML = volIcon(video.volume, video.muted);
      const pct = video.muted ? 0 : Math.round(video.volume * 100);
      ui.volSliderFill.style.height = pct + '%';
      ui.volSliderThumb.style.bottom = pct + '%';
      ui.volLabel.textContent = pct + '%';
    }
    video.addEventListener('volumechange', syncVolBtn);
    syncVolBtn();

    /* Sync final volume value to YouTube's player API so it persists via yt-player-volume */
    let ytVolSyncTimer;
    function scheduleVolumeSync() {
      clearTimeout(ytVolSyncTimer);
      ytVolSyncTimer = setTimeout(() => {
        bridgeCall('setVolume', { volume: video.volume, muted: video.muted });
      }, 300);
    }

    ui.btnVol.addEventListener('click', (e) => {
      e.stopPropagation();
      video.muted = !video.muted;
      scheduleVolumeSync();
    });

    /* volume slider interaction (vertical) */
    function volFromEvent(e) {
      const rect = ui.volSliderTrack.getBoundingClientRect();
      let pct = 1 - (e.clientY - rect.top) / rect.height;
      return Math.max(0, Math.min(1, pct));
    }

    let volDragging = false;

    ui.volSliderTrack.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      volDragging = true;
      const vol = volFromEvent(e);
      if (video.volume !== vol) video.volume = vol;
      if (video.muted) video.muted = false;

      const onMove = (ev) => {
        const v = volFromEvent(ev);
        if (video.volume !== v) video.volume = v;
        if (video.muted) video.muted = false;
      };
      const onUp = () => {
        volDragging = false;
        scheduleVolumeSync();
        if (!ui.volWrap.matches(':hover')) ui.volPopup.classList.remove('visible');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    /* show volume popup on hover */
    ui.volWrap.addEventListener('mouseenter', () => ui.volPopup.classList.add('visible'));
    ui.volWrap.addEventListener('mouseleave', () => {
      if (!volDragging) ui.volPopup.classList.remove('visible');
    });

    /* mouse wheel on volume button adjusts volume */
    ui.volWrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      let vol = video.volume + (e.deltaY < 0 ? 0.05 : -0.05);
      vol = Math.max(0, Math.min(1, vol));
      video.volume = vol;
      if (vol > 0) video.muted = false;
      scheduleVolumeSync();
    }, { passive: false });

    /* ---- CC / Subtitles menu ---- */

    async function buildCCMenu() {
      ui.ccMenuList.innerHTML = '';
      const loading = ce('div', 'ytp-skin-menu-item disabled');
      loading.textContent = 'Loading...';
      ui.ccMenuList.append(loading);

      const result = await bridgeCall('getCaptions', {});
      ui.ccMenuList.innerHTML = '';
      if (!result) {
        const err = ce('div', 'ytp-skin-menu-item disabled');
        err.textContent = 'Could not load subtitles';
        ui.ccMenuList.append(err);
        return;
      }
      renderCCItems(
        ui.ccMenuList, document, 'ytp-skin-menu-item', 'ytp-skin-menu-check',
        result.tracks, result.current,
        () => {
          bridgeCall('setCaptions', { track: {} });
          ui.badgeCC.classList.remove('active');
          const vid = getVideoId();
          if (vid) chrome.storage.local.set({ [`cc_${vid}`]: null });
          closeAllMenus();
        },
        (t) => {
          bridgeCall('setCaptions', { track: t });
          ui.badgeCC.classList.add('active');
          const vid = getVideoId();
          if (vid && t.languageCode) chrome.storage.local.set({ [`cc_${vid}`]: t.languageCode });
          closeAllMenus();
        }
      );
    }

    ui.badgeCC.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = ui.ccMenu.classList.contains('visible');
      closeAllMenus();
      if (!isOpen) {
        buildCCMenu();
        ui.ccMenu.classList.add('visible');
      }
    });

    /* ---- Audio language menu ---- */
    ui.langWrap.style.display = 'none';

    async function buildLangMenu() {
      ui.langMenuList.innerHTML = '';
      const loading = ce('div', 'ytp-skin-menu-item disabled');
      loading.textContent = 'Loading...';
      ui.langMenuList.append(loading);

      const result = await bridgeCall('getAudioTracks', {});
      ui.langMenuList.innerHTML = '';
      if (!result) {
        const err = ce('div', 'ytp-skin-menu-item disabled');
        err.textContent = 'Could not load audio tracks';
        ui.langMenuList.append(err);
        return;
      }
      renderAudioItems(
        ui.langMenuList, document, 'ytp-skin-menu-item', 'ytp-skin-menu-check',
        result.tracks, result.current,
        (t) => { bridgeCall('setAudioTrack', { track: t }); closeAllMenus(); }
      );
    }

    ui.badgeLang.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = ui.langMenu.classList.contains('visible');
      closeAllMenus();
      if (!isOpen) {
        buildLangMenu();
        ui.langMenu.classList.add('visible');
      }
    });

    async function checkAudioTracks() {
      const result = await bridgeCall('getAudioTracks', {});
      ui.langWrap.style.display = (result?.tracks?.length > 1) ? '' : 'none';
    }
    setTimeout(checkAudioTracks, TIMING.QUALITY_UPDATE_DELAY);
    video.addEventListener('loadeddata', () => setTimeout(checkAudioTracks, TIMING.QUALITY_BADGE_UPDATE_DELAY));

    /* ---- Quality menu ---- */
    async function buildQualityMenu() {
      ui.hdMenuList.innerHTML = '';
      const loading = ce('div', 'ytp-skin-menu-item disabled');
      loading.textContent = 'Loading...';
      ui.hdMenuList.append(loading);

      const result = await bridgeCall('getQualities', {});
      ui.hdMenuList.innerHTML = '';
      if (!result) {
        const err = ce('div', 'ytp-skin-menu-item disabled');
        err.textContent = 'Could not load qualities';
        ui.hdMenuList.append(err);
        return;
      }
      renderQualityItems(
        ui.hdMenuList, document, 'ytp-skin-menu-item', 'ytp-skin-menu-check', 'ytp-skin-hd-tag',
        result.levels, result.current, result.qualityData,
        (q) => { bridgeCall('setQuality', { quality: q }); setTimeout(updateQualityBadge, TIMING.QUALITY_UPDATE_DELAY); closeAllMenus(); }
      );
    }

    ui.badgeHD.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = ui.hdMenu.classList.contains('visible');
      closeAllMenus();
      if (!isOpen) {
        buildQualityMenu();
        ui.hdMenu.classList.add('visible');
      }
    });

    /* close menus helper */
    let chapPinned = false;
    function closeAllMenus() {
      ui.ccMenu.classList.remove('visible');
      ui.langMenu.classList.remove('visible');
      ui.hdMenu.classList.remove('visible');
      ui.speedMenu.classList.remove('visible');
      if (!chapPinned) ui.chapMenu.classList.remove('visible');
    }

    /* close menus when clicking elsewhere */
    const docClickHandler = () => closeAllMenus();
    player.addEventListener('click', docClickHandler);
    document.addEventListener('click', docClickHandler);

    /* ---- Speed menu ---- */
    function syncSpeedBadge() {
      const rate = video.playbackRate || 1;
      ui.badgeSpeed.textContent = rate === 1 ? '1x' : rate + 'x';
    }

    function buildSpeedMenu() {
      ui.speedMenuList.innerHTML = '';
      const current = video.playbackRate || 1;

      SPEED_OPTIONS.forEach((spd) => {
        const item = ce('div', 'ytp-skin-menu-item');
        const label = spd === 1 ? 'Normal' : spd + 'x';
        item.innerHTML = `<span class="ytp-skin-menu-check">${ICONS.check}</span><span>${label}</span>`;
        if (spd === current) item.classList.add('active');
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          video.playbackRate = spd;
          syncSpeedBadge();
          closeAllMenus();
        });
        ui.speedMenuList.append(item);
      });

      /* Custom speed input */
      const customRow = ce('div', 'ytp-skin-speed-custom');
      const customLabel = ce('span', '', 'Custom:');
      customLabel.style.cssText = 'color:#aaa;font-size:12px;margin-right:6px;';
      const customInput = ce('input', 'ytp-skin-speed-input');
      customInput.type = 'number';
      customInput.min = '0.1';
      customInput.max = '16';
      customInput.step = '0.05';
      customInput.value = current;
      customInput.title = 'Enter custom speed (0.1–16)';
      const initialValue = customInput.value;
      
      const customApply = ce('button', 'ytp-skin-speed-apply', 'Set');
      const applyCustomSpeed = () => {
        let val = parseFloat(customInput.value);
        if (isNaN(val) || val < 0.1) val = 0.1;
        if (val > 16) val = 16;
        video.playbackRate = val;
        syncSpeedBadge();
        closeAllMenus();
      };
      
      /* Highlight input when value is modified */
      customInput.addEventListener('input', () => {
        if (customInput.value !== initialValue) {
          customInput.classList.add('modified');
        } else {
          customInput.classList.remove('modified');
        }
      });
      
      customApply.addEventListener('click', (e) => { e.stopPropagation(); applyCustomSpeed(); });
      customInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') applyCustomSpeed();
      });
      customInput.addEventListener('click', (e) => e.stopPropagation());
      customRow.append(customLabel, customInput, customApply);
      ui.speedMenuList.append(customRow);
    }

    ui.badgeSpeed.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = ui.speedMenu.classList.contains('visible');
      closeAllMenus();
      if (!isOpen) {
        buildSpeedMenu();
        ui.speedMenu.classList.add('visible');
      }
    });

    video.addEventListener('ratechange', syncSpeedBadge);
    syncSpeedBadge();

    /* Persist speed per video ID */
    function getVideoId() {
      try {
        const vid = new URLSearchParams(location.search).get('v') || '';
        /* Basic validation - YouTube video IDs are 11 chars, alphanumeric + - and _ */
        if (vid && /^[a-zA-Z0-9_-]{11}$/.test(vid)) {
          return vid;
        }
        return '';
      } catch (err) {
        console.warn('[YTP-Skin] getVideoId failed:', err);
        return '';
      }
    }
    video.addEventListener('ratechange', () => {
      const vid = getVideoId();
      if (!vid) return;
      const rate = video.playbackRate;
      if (typeof rate === 'number' && rate >= 0.1 && rate <= 16) {
        chrome.storage.local.set({ [`speed_${vid}`]: rate });
      }
    });
    /* Restore speed when a new video loads */
    video.addEventListener('loadedmetadata', () => {
      const vid = getVideoId();
      if (!vid) return;
      chrome.storage.local.get([`speed_${vid}`], (r) => {
        const saved = r[`speed_${vid}`];
        if (typeof saved === 'number' && saved !== video.playbackRate) {
          video.playbackRate = saved;
        }
      });
    });

    /* ---- Chapters / Timecodes menu ---- */
    let cachedChapters = [];
    let lastActiveChapterIdx = -1; /* Track active chapter for efficient updates */
    let userInteractingWithMenu = false; /* Track if user is scrolling/browsing menu */
    let menuInteractionTimer = null;

    async function loadChapters() {
      const result = await bridgeCall('getChapters', {});
      if (result && result.chapters && result.chapters.length > 0) {
        cachedChapters = result.chapters;
      }
      return cachedChapters;
    }

    async function buildChaptersMenu() {
      ui.chapMenuList.innerHTML = '';

      const loadingItem = ce('div', 'ytp-skin-menu-item disabled');
      loadingItem.textContent = 'Loading...';
      ui.chapMenuList.append(loadingItem);

      const chapters = await loadChapters();
      ui.chapMenuList.innerHTML = '';

      if (chapters.length === 0) {
        const noItem = ce('div', 'ytp-skin-menu-item disabled');
        noItem.textContent = 'No chapters available';
        ui.chapMenuList.append(noItem);
        return;
      }

      const dur = video.duration || 0;
      const currentTime = video.currentTime || 0;
      let activeItem = null;

      chapters.forEach((ch, idx) => {
        const item = ce('div', 'ytp-skin-menu-item ytp-skin-chap-item');

        /* Determine if this chapter is the currently active one */
        const nextStart = idx + 1 < chapters.length ? chapters[idx + 1].startTime : dur;
        const isActive = currentTime >= ch.startTime && currentTime < nextStart;

        const timeStr = fmtTime(ch.startTime);
        const timeSpan = ce('span', 'ytp-skin-chap-time');
        timeSpan.textContent = timeStr;
        const titleSpan = ce('span', 'ytp-skin-chap-title');
        titleSpan.textContent = ch.title;
        item.append(timeSpan, titleSpan);
        if (isActive) {
          item.classList.add('active');
          activeItem = item;
          lastActiveChapterIdx = idx;
        }

        item.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          video.currentTime = ch.startTime;
          if (!chapPinned) closeAllMenus();
        });
        ui.chapMenuList.append(item);
      });

      /* Scroll to active chapter — use scrollTop to avoid scrollIntoView scrolling the page */
      if (activeItem) {
        requestAnimationFrame(() => {
          const menuRect = ui.chapMenu.getBoundingClientRect();
          const itemRect = activeItem.getBoundingClientRect();
          const offset = itemRect.top - menuRect.top - (ui.chapMenu.clientHeight - itemRect.height) / 2;
          ui.chapMenu.scrollTop = Math.max(0, ui.chapMenu.scrollTop + offset);
        });
      }
    }

    /* Track user interaction with chapter menu */
    function onChapterMenuInteraction() {
      userInteractingWithMenu = true;
      clearTimeout(menuInteractionTimer);
      menuInteractionTimer = setTimeout(() => {
        userInteractingWithMenu = false;
      }, 2000); /* User hasn't interacted for 2s */
    }

    /* Update chapter menu highlighting when time changes (optimized) */
    function updateChapterMenuHighlight() {
      if (!ui.chapMenu.classList.contains('visible')) return;

      const cur = video.currentTime;
      if (!Number.isFinite(cur)) return;
      const chapters = cachedChapters;
      if (chapters.length === 0) return;

      /* Find current active chapter index (reverse search for efficiency) */
      let activeIdx = -1;
      for (let i = chapters.length - 1; i >= 0; i--) {
        if (cur >= chapters[i].startTime) {
          activeIdx = i;
          break;
        }
      }

      /* Only update DOM if the active chapter has changed */
      if (activeIdx === lastActiveChapterIdx) return;

      const items = ui.chapMenuList.querySelectorAll('.ytp-skin-chap-item');
      const targetItem = items[activeIdx];
      const currentActive = items[lastActiveChapterIdx];

      /* Update highlights */
      if (currentActive) currentActive.classList.remove('active');
      if (targetItem) {
        targetItem.classList.add('active');
        
        /* Only auto-scroll if user is not interacting and item is out of viewport */
        if (!userInteractingWithMenu) {
          const menuRect = ui.chapMenuList.getBoundingClientRect();
          const itemRect = targetItem.getBoundingClientRect();
          const isOutOfView = itemRect.top < menuRect.top || itemRect.bottom > menuRect.bottom;
          
          if (isOutOfView) {
            requestAnimationFrame(() => {
              const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
              const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';
              targetItem.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
            });
          }
        }
      }

      lastActiveChapterIdx = activeIdx;
    }

    ui.btnChapters.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = ui.chapMenu.classList.contains('visible');
      closeAllMenus();
      if (!isOpen) {
        lastActiveChapterIdx = -1; /* Reset cache when opening menu */
        userInteractingWithMenu = false; /* Reset interaction state */
        buildChaptersMenu();
        ui.chapMenu.classList.add('visible');
      }
      return false;
    });

    /* Wire up interaction tracking for chapter menu */
    ui.chapMenuList.addEventListener('scroll', onChapterMenuInteraction, { passive: true });
    ui.chapMenuList.addEventListener('mouseenter', onChapterMenuInteraction);
    ui.chapMenuList.addEventListener('touchstart', onChapterMenuInteraction, { passive: true });

    /* ---- Chapter menu pin + drag ---- */
    function unpinChapMenu() {
      chapPinned = false;
      ui.chapMenu.classList.remove('pinned', 'visible');
      ui.btnChapPin.classList.remove('active');
      ui.btnChapPin.title = 'Pin chapters panel';
      ui.chapMenu.style.cssText = '';
      /* Move menu back into its original chapWrap */
      ui.chapWrap.appendChild(ui.chapMenu);
    }

    ui.btnChapPin.addEventListener('click', (e) => {
      e.stopPropagation();
      if (chapPinned) {
        unpinChapMenu();
      } else {
        chapPinned = true;
        /* Compute position relative to player before reparenting */
        const menuRect = ui.chapMenu.getBoundingClientRect();
        const playerRect = player.getBoundingClientRect();
        const left = menuRect.left - playerRect.left;
        const top = menuRect.top - playerRect.top;
        /* Reparent into player so position: absolute is player-relative */
        player.appendChild(ui.chapMenu);
        ui.chapMenu.style.position = 'absolute';
        ui.chapMenu.style.left = left + 'px';
        ui.chapMenu.style.top = top + 'px';
        ui.chapMenu.style.bottom = 'auto';
        ui.chapMenu.style.transform = 'none';
        ui.chapMenu.style.margin = '0';
        ui.chapMenu.classList.add('pinned', 'visible');
        ui.btnChapPin.classList.add('active');
        ui.btnChapPin.title = 'Unpin chapters panel';
      }
    });

    /* Drag behaviour on the header */
    ui.chapMenuHeader.addEventListener('mousedown', (e) => {
      if (!chapPinned) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = parseInt(ui.chapMenu.style.left) || 0;
      const startTop = parseInt(ui.chapMenu.style.top) || 0;

      const onMove = (ev) => {
        const playerRect = player.getBoundingClientRect();
        const menuRect = ui.chapMenu.getBoundingClientRect();
        let newLeft = startLeft + (ev.clientX - startX);
        let newTop = startTop + (ev.clientY - startY);
        /* Clamp within player bounds */
        newLeft = Math.max(0, Math.min(playerRect.width - menuRect.width, newLeft));
        newTop = Math.max(0, Math.min(playerRect.height - menuRect.height, newTop));
        ui.chapMenu.style.left = newLeft + 'px';
        ui.chapMenu.style.top = newTop + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    /* ---- Chapter markers on seek bar ---- */
    let chapterMarkerEls = [];

    function renderChapterMarkers(chapters) {
      /* Remove old markers */
      chapterMarkerEls.forEach(el => el.remove());
      chapterMarkerEls = [];

      const dur = video.duration || 0;
      if (dur <= 0 || chapters.length === 0) return;

      chapters.forEach((ch) => {
        if (ch.startTime <= 0) return; /* skip 0:00 marker */
        const pct = (ch.startTime / dur) * 100;
        const marker = ce('div', 'ytp-skin-chap-marker');
        marker.style.left = pct + '%';
        marker.title = ch.title;
        ui.seekTrack.appendChild(marker);
        chapterMarkerEls.push(marker);
      });
    }

    function getChapterAtTime(t) {
      for (let i = cachedChapters.length - 1; i >= 0; i--) {
        if (t >= cachedChapters[i].startTime) return cachedChapters[i];
      }
      return null;
    }

    /* Load chapters on init and render markers */
    async function initChapters() {
      lastActiveChapterIdx = -1; /* Reset cache on new video */
      const chapters = await loadChapters();
      const hasChap = chapters.length > 0;
      if (hasChap) {
        renderChapterMarkers(chapters);
        ui.btnChapters.style.display = '';
        ui.btnChapPrev.style.display = '';
        ui.btnChapNext.style.display = '';
      } else {
        ui.btnChapters.style.display = 'none';
        ui.btnChapPrev.style.display = 'none';
        ui.btnChapNext.style.display = 'none';
      }
    }
    /* Delay a bit to ensure player response is available */
    setTimeout(initChapters, TIMING.CHAPTERS_INIT_DELAY);
    const onLoadedDataInitChapters = () => setTimeout(initChapters, TIMING.CHAPTERS_RELOAD_DELAY);
    video.addEventListener('loadeddata', onLoadedDataInitChapters);

    /* ---- Quality badge label sync ---- */
    async function updateQualityBadge() {
      const result = await bridgeCall('getSyncState', {});
      if (!result) return;
      if (result.quality) {
        const q = result.quality;
        const label = QUALITY_LABELS[q] || q;
        if (parseInt(label) >= 720 || HD_QUALITIES.includes(q)) {
          ui.badgeHD.innerHTML = label.replace(/p.*/, '') + '<sup>HD</sup>';
        } else {
          ui.badgeHD.textContent = label || 'Auto';
        }
      }
      ui.badgeCC.classList.toggle('active', result.captionActive);
    }
    updateQualityBadge();
    video.addEventListener('loadeddata', () => setTimeout(updateQualityBadge, TIMING.QUALITY_BADGE_UPDATE_DELAY));

    /* Restore saved CC language for this video */
    async function restoreSavedCC() {
      const vid = getVideoId();
      if (!vid) return;
      chrome.storage.local.get([`cc_${vid}`], async (r) => {
        const savedCode = r[`cc_${vid}`];
        if (!savedCode) return;
        const result = await bridgeCall('getCaptions', {});
        if (!result || !result.tracks) return;
        const track = result.tracks.find(t => t.languageCode === savedCode);
        if (track) {
          bridgeCall('setCaptions', { track });
          ui.badgeCC.classList.add('active');
        }
      });
    }
    video.addEventListener('loadeddata', () => setTimeout(restoreSavedCC, TIMING.CC_RESTORE_DELAY));

    /* ---- theater mode ---- */
    ui.btnTheater.addEventListener('click', () => {
      const tb = qs('.ytp-size-button', player);
      if (tb) tb.click();
    });

    /* ---- Skip Back / Forward ---- */
    ui.btnSkipBack.addEventListener('click', () => {
      video.currentTime = Math.max(0, video.currentTime - SKIP_SECONDS);
    });

    ui.btnSkipFwd.addEventListener('click', () => {
      video.currentTime = Math.min(video.duration || 0, video.currentTime + SKIP_SECONDS);
    });

    ui.btnChapPrev.addEventListener('click', () => {
      if (cachedChapters.length === 0) return;
      const cur = video.currentTime;
      /* If more than 3 s into current chapter, restart it; else go to previous */
      let target = 0;
      for (let i = cachedChapters.length - 1; i >= 0; i--) {
        if (cur - cachedChapters[i].startTime > 3) { target = cachedChapters[i].startTime; break; }
        if (i > 0 && cur > cachedChapters[i].startTime) { target = cachedChapters[i - 1].startTime; break; }
      }
      video.currentTime = target;
    });

    ui.btnChapNext.addEventListener('click', () => {
      if (cachedChapters.length === 0) return;
      const cur = video.currentTime;
      const next = cachedChapters.find(ch => ch.startTime > cur + 0.5);
      if (next) video.currentTime = next.startTime;
    });

    /* ---- Return to Live ---- */
    ui.btnLive.addEventListener('click', () => {
      const seekable = video.seekable;
      if (seekable.length) video.currentTime = seekable.end(seekable.length - 1);
    });

    /* ---- Picture-in-Picture ---- */
    let pipWindow = null;
    let pipCleanup = null;

    function syncPipBtn() {
      const inPip = !!pipWindow || !!document.pictureInPictureElement;
      ui.btnMini.innerHTML = inPip ? ICONS.pipActive : ICONS.pip;
      ui.btnMini.classList.toggle('ytp-skin-pip-active', inPip);
      ui.btnMini.title = inPip ? 'Exit Picture-in-Picture' : 'Picture-in-Picture';
    }

    ui.btnMini.addEventListener('click', async () => {
      if (pipWindow) {
        if (pipCleanup) pipCleanup();
        return;
      }
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        syncPipBtn();
        return;
      }
      try {
        const result = await openDocumentPip({
          video, ui, bridgeCall,
          cachedChapters, loadChapters,
          syncPlayBtn, syncVolBtn, updateProgress,
          isLiveStream,
          onPipClosed: () => { pipWindow = null; pipCleanup = null; syncPipBtn(); },
        });
        pipWindow = result.pipWindow;
        pipCleanup = result.closePip;
      } catch (_) {
        await openBasicPip(video);
      }
    });

    video.addEventListener('enterpictureinpicture', syncPipBtn);
    video.addEventListener('leavepictureinpicture', syncPipBtn);
    syncPipBtn();

    /* ---- Media Session API ---- */
    const cleanupMediaSession = setupMediaSession({ video, player, ui, SKIP_SECONDS });

    /* ---- fullscreen ---- */
    ui.btnFS.addEventListener('click', () => {
      /* Use native Fullscreen API directly — MUST be synchronous to keep user activation.
         We manually manage the ytp-fullscreen class so our CSS adapts. */
      const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (isFS) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        const target = document.getElementById('movie_player') || player;
        const p = target.requestFullscreen
          ? target.requestFullscreen()
          : target.webkitRequestFullscreen
            ? target.webkitRequestFullscreen()
            : Promise.reject(new Error('Fullscreen API not supported'));
        if (p && p.catch) {
          p.catch(err => console.error('[YTP-Skin] Fullscreen error:', err));
        }
      }
      /* Fire-and-forget: tell YouTube's internal player to sync its state */
      bridgeCall('syncFullscreenState', { enter: !isFS });
    });

    function syncFSIcon() {
      const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
      /* Keep ytp-fullscreen class in sync so CSS adapts */
      player.classList.toggle('ytp-fullscreen', isFS);
      ui.btnFS.innerHTML = isFS ? ICONS.fullscreenExit : ICONS.fullscreen;
      ui.btnFS.title = isFS ? 'Exit full screen' : 'Full screen';
    }
    document.addEventListener('fullscreenchange', syncFSIcon);
    document.addEventListener('webkitfullscreenchange', syncFSIcon);
    syncFSIcon();

    /* ---- show controls on interaction ---- */
    let hideTimeout;
    function showControls() {
      player.classList.add('ytp-skin-controls-visible');
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        if (!video.paused) player.classList.remove('ytp-skin-controls-visible');
      }, TIMING.CONTROLS_HIDE_DELAY);
    }
    const onPlayerMouseLeave = () => {
      clearTimeout(hideTimeout);
      player.classList.remove('ytp-skin-controls-visible');
    };
    /* Throttled mousemove for controls visibility (reduced to 100ms for smoother UX) */
    const throttledShowControls = throttle(showControls, 100);
    player.addEventListener('mousemove', throttledShowControls);
    player.addEventListener('mouseenter', showControls);
    player.addEventListener('mouseleave', onPlayerMouseLeave);

    /* keep controls visible while paused */
    const onVideoPause = () => player.classList.add('ytp-skin-controls-visible');
    const onVideoPlay = () => {
      hideTimeout = setTimeout(() => player.classList.remove('ytp-skin-controls-visible'), TIMING.CONTROLS_HIDE_DELAY);
    };
    video.addEventListener('pause', onVideoPause);
    video.addEventListener('play', onVideoPlay);

    /* ---- cleanup on navigation ---- */
    /* Optimized: observe only the player container instead of entire document.body */
    const observer = new MutationObserver(() => {
      if (!document.contains(player)) {
        if (cleanupSkin) { cleanupSkin(); cleanupSkin = null; }
        observer.disconnect();
      }
    });
    const playerContainer = player.parentElement || document.body;
    observer.observe(playerContainer, { childList: true, subtree: false });

    cleanupSkin = function () {
      skinInjected = false;
      clearInterval(metaInterval);
      liveClassObserver.disconnect();
      clearInterval(liveCheckInterval);
      clearTimeout(storyboardRetryTimer);
      storyboardRetryTimer = null;
      clearTimeout(hideTimeout);
      clearTimeout(liveHeadPollTimer);
      liveHeadPollTimer = null;
      cleanupMediaSession?.();
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('loadedmetadata', updateProgress);
      video.removeEventListener('durationchange', updateProgress);
      video.removeEventListener('durationchange', updateLiveControls);
      video.removeEventListener('loadedmetadata', updateLiveControls);
      video.removeEventListener('loadeddata', onStoryboardLoadedData);
      video.removeEventListener('play', syncPlayBtn);
      video.removeEventListener('pause', syncPlayBtn);
      video.removeEventListener('volumechange', syncVolBtn);
      video.removeEventListener('ratechange', syncSpeedBadge);
      video.removeEventListener('pause', onVideoPause);
      video.removeEventListener('play', onVideoPlay);
      video.removeEventListener('enterpictureinpicture', syncPipBtn);
      video.removeEventListener('leavepictureinpicture', syncPipBtn);
      video.removeEventListener('loadeddata', onLoadedDataInitChapters);
      player.removeEventListener('click', docClickHandler);
      player.removeEventListener('mousemove', throttledShowControls);
      player.removeEventListener('mouseenter', showControls);
      player.removeEventListener('mouseleave', onPlayerMouseLeave);
      document.removeEventListener('click', docClickHandler);
      document.removeEventListener('fullscreenchange', syncFSIcon);
      document.removeEventListener('webkitfullscreenchange', syncFSIcon);
      observer.disconnect();
    };
  }

  /* ==========================================================
     Boot – watch for the player, re-inject on SPA navigation
     ========================================================== */
  function waitForPlayer() {
    if (qs('.html5-video-player video.html5-main-video')) {
      injectSkin();
    }
  }

  /* Initial load */
  waitForPlayer();

  /* YouTube is an SPA — listen for navigation */
  /* Optimized: observe only ytd-app or main content container */
  const ytdApp = document.querySelector('ytd-app') || document.body;
  const navObserver = new MutationObserver(() => waitForPlayer());
  navObserver.observe(ytdApp, { childList: true, subtree: ytdApp !== document.body });

  /* Also handle yt-navigate-finish (YouTube custom event) */
  window.addEventListener('yt-navigate-finish', () => {
    skinInjected = false;
    setTimeout(waitForPlayer, TIMING.NAV_DETECT_DELAY);
  });

  /* ---- Toggle message from popup ---- */
  chrome.runtime?.onMessage?.addListener((msg) => {
    if (msg.action === 'toggleSkin') {
      const player = qs('.html5-video-player');
      if (player) player.classList.toggle('ytp-skin-disabled', !msg.enabled);
    }
  });

  /* ---- Check saved state on load ---- */
  chrome.storage?.local?.get(['skinEnabled'], (result) => {
    if (result.skinEnabled === false) {
      const player = qs('.html5-video-player');
      if (player) player.classList.add('ytp-skin-disabled');
    }
  });
})();
