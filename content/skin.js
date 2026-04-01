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

  let _bridgeReadyResolve;
  const bridgeReady = new Promise(res => { _bridgeReadyResolve = res; });

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    if (e.data?.source === 'ytp-skin-bridge-ready') { _bridgeReadyResolve(); return; }
    if (!e.data || e.data.source !== 'ytp-skin-response') return;
    const cb = bridgeCallbacks.get(e.data.id);
    if (cb) { bridgeCallbacks.delete(e.data.id); cb(e.data.data); }
  });

  function bridgeCall(action, payload) {
    return bridgeReady.then(() => new Promise((resolve) => {
      const id = ++bridgeMsgId;
      bridgeCallbacks.set(id, resolve);
      window.postMessage({ source: 'ytp-skin-request', action, payload, id }, '*');
      setTimeout(() => { if (bridgeCallbacks.has(id)) { bridgeCallbacks.delete(id); resolve(null); } }, 2000);
    }));
  }

  function injectBridge() {
    if (document.getElementById('ytp-skin-bridge')) return;
    const s = document.createElement('script');
    s.id = 'ytp-skin-bridge';
    s.type = 'module';
    s.src = chrome.runtime.getURL('content/bridge.js');
    (document.head || document.documentElement).appendChild(s);
  }
  injectBridge();

  /* Load sub-modules in parallel */
  const _base = chrome.runtime.getURL('content/skin/');
  const [
    { ICONS, volIcon },
    { qs, ce, fmtTime },
    { QUALITY_LABELS, HD_QUALITIES, SPEED_OPTIONS, SKIP_SECONDS },
    { buildSkin, attachSeekDrag, renderCCItems, renderQualityItems },
    { parseStoryboardSpec, storyboardUrl, storyboardFrame },
    { openDocumentPip, openBasicPip },
    { setupMediaSession },
  ] = await Promise.all([
    import(_base + 'icons.js'),
    import(_base + 'utils.js'),
    import(_base + 'constants.js'),
    import(_base + 'buildSkin.js'),
    import(_base + 'storyboard.js'),
    import(_base + 'pip.js'),
    import(_base + 'mediaSession.js'),
  ]);

  /* Module state */
  let skinInjected = false;
  let seeking = false;

  function injectSkin() {
    const player = qs('.html5-video-player');
    const video = qs('video.html5-main-video');
    if (!player || !video) return;
    if (skinInjected && player.querySelector('.ytp-skin-top-bar')) return;

    /* clean up previous injection if navigated */
    player.querySelectorAll('.ytp-skin-top-bar, .ytp-skin-bottom-bar').forEach(e => e.remove());

    const ui = buildSkin();
    player.appendChild(ui.topBar);
    player.appendChild(ui.bottomBar);
    skinInjected = true;

    /* ---- metadata ---- */
    function updateMeta() {
      try {
        const titleText = qs('#title h1 yt-formatted-string, #info-contents h1 yt-formatted-string, h1.ytd-watch-metadata yt-formatted-string');
        ui.titleEl.textContent = titleText ? titleText.textContent.trim() : '';

        const channelText = qs('#owner #channel-name a, ytd-video-owner-renderer #channel-name a, #upload-info #channel-name a');
        ui.channelEl.textContent = channelText ? channelText.textContent.trim() : '';

        const viewInfo = qs('#info-text #info span, ytd-watch-metadata #info span, #info-strings yt-formatted-string');
        ui.viewsEl.textContent = viewInfo ? viewInfo.textContent.trim() : '';
      } catch (_) { /* ignore */ }
    }
    updateMeta();
    const metaInterval = setInterval(updateMeta, 2000);

    /* ---- time & progress updates ---- */
    function updateProgress() {
      if (seeking) return;
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

    async function loadStoryboard() {
      if (storyboardData) return; /* Already loaded successfully */

      const result = await bridgeCall('getStoryboard', {});

      if (result && result.spec) {
        const parsed = parseStoryboardSpec(result.spec);
        if (parsed) {
          /* Verify URL is reachable before committing */
          const testUrl = storyboardUrl(parsed, 0);
          const img = new Image();
          img.onload = () => {
            storyboardData = parsed;
            console.log('[YTP-Skin] Storyboard ready:', parsed.w + 'x' + parsed.h,
                        parsed.totalThumbnails, 'frames');
          };
          img.onerror = () => {
            /* Image failed — still keep the parsed data; the URL might work for
               individual frames even if sheet 0 is temporarily unavailable. */
            storyboardData = parsed;
            console.warn('[YTP-Skin] Storyboard sheet 0 failed to preload, keeping data anyway');
          };
          img.src = testUrl;
          return; /* Done — onload/onerror will finalise */
        }
      }

      /* Spec not available yet — schedule a retry (up to 5 attempts) */
      storyboardRetries++;
      if (storyboardRetries < 5) {
        console.log('[YTP-Skin] Storyboard not available yet, retry', storyboardRetries, '/ 5');
        setTimeout(loadStoryboard, 3000);
      } else {
        console.warn('[YTP-Skin] Storyboard unavailable after 5 retries');
      }
    }

    let storyboardRetries = 0;

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
      ui.seekPreviewImg.style.backgroundImage = `url("${frame.url}")`;
      ui.seekPreviewImg.style.backgroundPosition = `-${frame.x}px -${frame.y}px`;
      ui.seekPreviewImg.style.backgroundSize = `${frame.cols * frame.w}px ${frame.rows * frame.h}px`;
      ui.seekPreviewImg.style.width = frame.w + 'px';
      ui.seekPreviewImg.style.height = frame.h + 'px';
      /* Position horizontally, clamped to seek area */
      let left = pct * 100;
      ui.seekPreview.style.left = left + '%';
      ui.seekPreview.classList.add('visible');
    }

    /* Load storyboard early */
    setTimeout(loadStoryboard, 2000);
    video.addEventListener('loadeddata', () => {
      /* Reset for new video */
      storyboardData = null;
      storyboardRetries = 0;
      setTimeout(loadStoryboard, 1500);
    });

    ui.seekArea.addEventListener('mousemove', (e) => {
      if (seeking) return;
      const rect = ui.seekTrack.getBoundingClientRect();
      let pct = (e.clientX - rect.left) / rect.width;
      pct = Math.max(0, Math.min(1, pct));
      const hoverTime = pct * (video.duration || 0);
      const chapter = getChapterAtTime(hoverTime);
      const timeStr = fmtTime(hoverTime);
      ui.seekTooltip.textContent = chapter ? `${timeStr} • ${chapter.title}` : timeStr;
      ui.seekTooltip.style.left = (pct * 100) + '%';
      updateSeekPreview(pct, hoverTime);
    });

    ui.seekArea.addEventListener('mouseleave', () => {
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

    ui.btnVol.addEventListener('click', (e) => {
      e.stopPropagation();
      video.muted = !video.muted;
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
        () => { bridgeCall('setCaptions', { track: {} }); ui.badgeCC.classList.remove('active'); closeAllMenus(); },
        (t) => { bridgeCall('setCaptions', { track: t }); ui.badgeCC.classList.add('active'); closeAllMenus(); }
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
        (q) => { bridgeCall('setQuality', { quality: q }); setTimeout(updateQualityBadge, 500); closeAllMenus(); }
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
    function closeAllMenus() {
      ui.ccMenu.classList.remove('visible');
      ui.hdMenu.classList.remove('visible');
      ui.speedMenu.classList.remove('visible');
      ui.chapMenu.classList.remove('visible');
    }

    /* close menus when clicking elsewhere */
    player.addEventListener('click', () => closeAllMenus());
    document.addEventListener('click', () => closeAllMenus());

    /* ---- Speed menu ---- */
    function syncSpeedBadge() {
      const rate = video.playbackRate || 1;
      ui.badgeSpeed.textContent = rate === 1 ? '1x' : rate + 'x';
      if (rate !== 1) {
        ui.badgeSpeed.classList.add('active');
      } else {
        ui.badgeSpeed.classList.remove('active');
      }
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
      const customApply = ce('button', 'ytp-skin-speed-apply', 'Set');
      const applyCustomSpeed = () => {
        let val = parseFloat(customInput.value);
        if (isNaN(val) || val < 0.1) val = 0.1;
        if (val > 16) val = 16;
        video.playbackRate = val;
        syncSpeedBadge();
        closeAllMenus();
      };
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

    /* ---- Chapters / Timecodes menu ---- */
    let cachedChapters = [];

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

      chapters.forEach((ch, idx) => {
        const item = ce('div', 'ytp-skin-menu-item ytp-skin-chap-item');

        /* Determine if this chapter is the currently active one */
        const nextStart = idx + 1 < chapters.length ? chapters[idx + 1].startTime : dur;
        const isActive = currentTime >= ch.startTime && currentTime < nextStart;

        const timeStr = fmtTime(ch.startTime);
        item.innerHTML = `<span class="ytp-skin-chap-time">${timeStr}</span><span class="ytp-skin-chap-title">${ch.title}</span>`;
        if (isActive) item.classList.add('active');

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          video.currentTime = ch.startTime;
          closeAllMenus();
        });
        ui.chapMenuList.append(item);
      });
    }

    ui.btnChapters.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = ui.chapMenu.classList.contains('visible');
      closeAllMenus();
      if (!isOpen) {
        buildChaptersMenu();
        ui.chapMenu.classList.add('visible');
      }
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
      const chapters = await loadChapters();
      if (chapters.length > 0) {
        renderChapterMarkers(chapters);
        ui.btnChapters.style.display = '';
      } else {
        ui.btnChapters.style.display = 'none';
      }
    }
    /* Delay a bit to ensure player response is available */
    setTimeout(initChapters, 1500);
    video.addEventListener('loadeddata', () => setTimeout(initChapters, 1000));

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
    video.addEventListener('loadeddata', () => setTimeout(updateQualityBadge, 1000));

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
    setupMediaSession({ video, player, ui, SKIP_SECONDS, updateMeta });

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
      }, 3000);
    }
    player.addEventListener('mousemove', showControls);
    player.addEventListener('mouseenter', showControls);
    player.addEventListener('mouseleave', () => {
      clearTimeout(hideTimeout);
      player.classList.remove('ytp-skin-controls-visible');
    });

    /* keep controls visible while paused */
    video.addEventListener('pause', () => player.classList.add('ytp-skin-controls-visible'));
    video.addEventListener('play', () => {
      hideTimeout = setTimeout(() => player.classList.remove('ytp-skin-controls-visible'), 3000);
    });

    /* ---- cleanup on navigation ---- */
    const observer = new MutationObserver(() => {
      if (!document.contains(player)) {
        clearInterval(metaInterval);
        observer.disconnect();
        skinInjected = false;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
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
  const navObserver = new MutationObserver(() => waitForPlayer());
  navObserver.observe(document.body, { childList: true, subtree: true });

  /* Also handle yt-navigate-finish (YouTube custom event) */
  window.addEventListener('yt-navigate-finish', () => {
    skinInjected = false;
    setTimeout(waitForPlayer, 500);
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
