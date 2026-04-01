import { ICONS, volIcon } from './icons.js';
import { fmtTime } from './utils.js';
import { SPEED_OPTIONS, SKIP_SECONDS, HD_QUALITIES, QUALITY_LABELS } from './constants.js';
import { attachSeekDrag, renderCCItems, renderQualityItems } from './buildSkin.js';

/**
 * Opens a Document Picture-in-Picture window with full skin overlay controls.
 *
 * @param {object} ctx
 * @param {HTMLVideoElement} ctx.video
 * @param {object}           ctx.ui           - refs returned by buildSkin()
 * @param {Function}         ctx.bridgeCall
 * @param {Array}            ctx.cachedChapters
 * @param {Function}         ctx.loadChapters
 * @param {Function}         ctx.syncPlayBtn  - called after PiP closes to sync main controls
 * @param {Function}         ctx.syncVolBtn
 * @param {Function}         ctx.updateProgress
 * @param {Function}         ctx.onPipClosed  - called after PiP window closes (e.g. set pipWindow=null, syncPipBtn)
 *
 * @returns {{ pipWindow: Window, closePip: Function }}
 */
export async function openDocumentPip({ video, ui, bridgeCall, cachedChapters, loadChapters,
                                        syncPlayBtn, syncVolBtn, updateProgress, onPipClosed }) {
  const pipWin = await window.documentPictureInPicture.requestWindow({
    width: Math.min(640, Math.round(screen.width * 0.35)),
    height: Math.min(360, Math.round(screen.height * 0.35)),
  });

  /* Inject styles */
  const link = pipWin.document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('content/pip.css');
  pipWin.document.head.appendChild(link);
  pipWin.document.body.style.fontFamily = "'Segoe UI', Roboto, Arial, sans-serif";

  /* Move video into PiP window */
  const videoParent = video.parentElement;
  const videoNext = video.nextSibling;
  const savedVideoStyle = video.getAttribute('style') || '';
  pipWin.document.body.appendChild(video);
  video.style.cssText = 'width:100%;height:100%;position:static;top:auto;left:auto;object-fit:contain;background:#000;';

  /* ---- Build overlay DOM ---- */
  const overlay = pipWin.document.createElement('div');
  overlay.className = 'pip-overlay';

  /* Top info */
  const topDiv = pipWin.document.createElement('div');
  topDiv.className = 'pip-top';
  const pTitle = pipWin.document.createElement('div');
  pTitle.className = 'pip-title';
  pTitle.textContent = ui.titleEl.textContent || '';
  const pChannel = pipWin.document.createElement('div');
  pChannel.className = 'pip-channel';
  pChannel.textContent = ui.channelEl.textContent || '';
  topDiv.append(pTitle, pChannel);

  /* Close button */
  const closeBtn = pipWin.document.createElement('button');
  closeBtn.className = 'pip-close-btn';
  closeBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
  closeBtn.title = 'Close PiP';

  /* Bottom controls */
  const bottomDiv = pipWin.document.createElement('div');
  bottomDiv.className = 'pip-bottom';

  const ctrlRow = pipWin.document.createElement('div');
  ctrlRow.className = 'pip-controls';

  const mkBtn = (cls, svg, title) => {
    const b = pipWin.document.createElement('button');
    b.className = 'pip-btn ' + cls;
    b.innerHTML = svg;
    b.title = title;
    return b;
  };

  /* Volume */
  const pipBtnVol = mkBtn('', video.muted || video.volume === 0 ? ICONS.volumeMute : ICONS.volumeHigh, 'Mute');
  const pipVolWrap = pipWin.document.createElement('div');
  pipVolWrap.className = 'pip-vol-wrap';
  const pipVolSlider = pipWin.document.createElement('div');
  pipVolSlider.className = 'pip-vol-slider';
  const pipVolFill = pipWin.document.createElement('div');
  pipVolFill.className = 'pip-vol-fill';
  const pipVolThumb = pipWin.document.createElement('div');
  pipVolThumb.className = 'pip-vol-thumb';
  pipVolSlider.append(pipVolFill, pipVolThumb);
  pipVolWrap.append(pipBtnVol, pipVolSlider);

  /* Transport */
  const pipBtnPrev = mkBtn('', ICONS.replay10, 'Back 10s');
  const pipBtnPlay = mkBtn('pip-btn-play' + (video.paused ? '' : ' playing'),
    video.paused ? ICONS.play : ICONS.pause, video.paused ? 'Play' : 'Pause');
  const pipBtnNext = mkBtn('', ICONS.forward10, 'Forward 10s');

  /* CC badge + menu */
  const pipCCWrap = pipWin.document.createElement('div');
  pipCCWrap.className = 'pip-menu-wrap';
  const pipCCBadge = pipWin.document.createElement('span');
  pipCCBadge.className = 'pip-badge';
  pipCCBadge.textContent = 'CC';
  pipCCBadge.title = 'Subtitles';
  const pipCCMenu = pipWin.document.createElement('div');
  pipCCMenu.className = 'pip-menu';
  pipCCWrap.append(pipCCBadge, pipCCMenu);

  /* Quality badge + menu */
  const pipHDWrap = pipWin.document.createElement('div');
  pipHDWrap.className = 'pip-menu-wrap';
  const pipHDBadge = pipWin.document.createElement('span');
  pipHDBadge.className = 'pip-badge';
  pipHDBadge.innerHTML = 'HD';
  pipHDBadge.title = 'Quality';
  const pipHDMenu = pipWin.document.createElement('div');
  pipHDMenu.className = 'pip-menu';
  pipHDWrap.append(pipHDBadge, pipHDMenu);

  /* Speed badge + menu */
  const pipSpeedWrap = pipWin.document.createElement('div');
  pipSpeedWrap.className = 'pip-menu-wrap';
  const pipSpeedBadge = pipWin.document.createElement('span');
  pipSpeedBadge.className = 'pip-badge';
  pipSpeedBadge.textContent = (video.playbackRate || 1) === 1 ? '1x' : video.playbackRate + 'x';
  pipSpeedBadge.title = 'Speed';
  const pipSpeedMenu = pipWin.document.createElement('div');
  pipSpeedMenu.className = 'pip-menu';
  pipSpeedWrap.append(pipSpeedBadge, pipSpeedMenu);

  /* Chapters button + menu */
  const pipChapWrap = pipWin.document.createElement('div');
  pipChapWrap.className = 'pip-menu-wrap';
  const pipChapBtn = pipWin.document.createElement('button');
  pipChapBtn.className = 'pip-btn-chap';
  pipChapBtn.innerHTML = ICONS.chapters;
  pipChapBtn.title = 'Chapters';
  const pipChapMenu = pipWin.document.createElement('div');
  pipChapMenu.className = 'pip-menu';
  pipChapWrap.append(pipChapBtn, pipChapMenu);
  if (cachedChapters.length === 0) pipChapWrap.style.display = 'none';

  ctrlRow.append(pipVolWrap, pipCCWrap, pipHDWrap, pipSpeedWrap, pipBtnPrev, pipBtnPlay, pipBtnNext, pipChapWrap);

  /* Progress / seek row */
  const progRow = pipWin.document.createElement('div');
  progRow.className = 'pip-progress-row';

  const pTimeL = pipWin.document.createElement('span');
  pTimeL.className = 'pip-time';
  pTimeL.textContent = fmtTime(video.currentTime);

  const pTimeR = pipWin.document.createElement('span');
  pTimeR.className = 'pip-time pip-time-right';
  pTimeR.textContent = fmtTime(video.duration);

  const pSeek = pipWin.document.createElement('div');
  pSeek.className = 'pip-seek';
  const pTrack = pipWin.document.createElement('div');
  pTrack.className = 'pip-seek-track';
  const pBuf = pipWin.document.createElement('div');
  pBuf.className = 'pip-seek-buf';
  const pFill = pipWin.document.createElement('div');
  pFill.className = 'pip-seek-fill';
  const pThumb = pipWin.document.createElement('div');
  pThumb.className = 'pip-seek-thumb';
  pTrack.append(pBuf, pFill, pThumb);
  pSeek.appendChild(pTrack);
  progRow.append(pTimeL, pSeek, pTimeR);

  bottomDiv.append(ctrlRow, progRow);
  overlay.append(topDiv, closeBtn, bottomDiv);
  pipWin.document.body.appendChild(overlay);

  /* ---- Wire up controls ---- */

  /* Auto-show/hide overlay */
  let pipHideTimer;
  const showOverlay = () => {
    overlay.classList.add('show');
    clearTimeout(pipHideTimer);
    pipHideTimer = setTimeout(() => {
      if (!video.paused) overlay.classList.remove('show');
    }, 3000);
  };
  pipWin.document.body.addEventListener('mousemove', showOverlay);
  pipWin.document.body.addEventListener('mouseenter', showOverlay);
  pipWin.document.body.addEventListener('mouseleave', () => {
    clearTimeout(pipHideTimer);
    overlay.classList.remove('show');
  });

  /* Play / Pause */
  pipBtnPlay.addEventListener('click', () => {
    if (video.paused) video.play(); else video.pause();
  });
  const syncPipPlay = () => {
    pipBtnPlay.innerHTML = video.paused ? ICONS.play : ICONS.pause;
    pipBtnPlay.className = 'pip-btn pip-btn-play' + (video.paused ? '' : ' playing');
    if (video.paused) overlay.classList.add('show');
  };
  video.addEventListener('play', syncPipPlay);
  video.addEventListener('pause', syncPipPlay);

  /* Skip */
  pipBtnPrev.addEventListener('click', () => { video.currentTime = Math.max(0, video.currentTime - SKIP_SECONDS); });
  pipBtnNext.addEventListener('click', () => { video.currentTime = Math.min(video.duration || 0, video.currentTime + SKIP_SECONDS); });

  /* Volume */
  pipBtnVol.addEventListener('click', () => { video.muted = !video.muted; });
  const syncPipVol = () => {
    pipBtnVol.innerHTML = volIcon(video.volume, video.muted);
    const vp = video.muted ? 0 : video.volume * 100;
    pipVolFill.style.width = vp + '%';
    pipVolThumb.style.left = vp + '%';
  };
  video.addEventListener('volumechange', syncPipVol);
  syncPipVol();

  const pipVolFromE = (e) => {
    const r = pipVolSlider.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };
  pipVolSlider.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const vInit = pipVolFromE(e);
    if (video.volume !== vInit) video.volume = vInit;
    if (video.muted) video.muted = false;
    const onM = (ev) => {
      const v = pipVolFromE(ev);
      if (video.volume !== v) video.volume = v;
      if (video.muted) video.muted = false;
    };
    const onU = () => {
      pipWin.document.removeEventListener('mousemove', onM);
      pipWin.document.removeEventListener('mouseup', onU);
    };
    pipWin.document.addEventListener('mousemove', onM);
    pipWin.document.addEventListener('mouseup', onU);
  });

  /* Seek progress sync */
  let pipSeeking = false;
  const syncPipProgress = () => {
    if (pipSeeking) return;
    const dur = video.duration || 0;
    const cur = video.currentTime || 0;
    const pct = dur ? (cur / dur) * 100 : 0;
    pFill.style.width = pct + '%';
    pThumb.style.left = pct + '%';
    pTimeL.textContent = fmtTime(cur);
    pTimeR.textContent = fmtTime(dur);
    if (video.buffered && video.buffered.length > 0) {
      const buf = video.buffered.end(video.buffered.length - 1);
      pBuf.style.width = (dur ? (buf / dur) * 100 : 0) + '%';
    }
  };
  video.addEventListener('timeupdate', syncPipProgress);
  syncPipProgress();

  attachSeekDrag(pSeek, pTrack, pFill, pThumb, pipWin.document, video,
    () => { pipSeeking = true; }, () => { pipSeeking = false; });

  video.addEventListener('click', () => { if (video.paused) video.play(); else video.pause(); });

  /* ---- PiP menus ---- */
  function closePipMenus() {
    pipCCMenu.classList.remove('visible');
    pipHDMenu.classList.remove('visible');
    pipSpeedMenu.classList.remove('visible');
    pipChapMenu.classList.remove('visible');
  }

  /* CC */
  async function buildPipCCMenu() {
    const titleEl = pipWin.document.createElement('div');
    titleEl.className = 'pip-menu-title';
    titleEl.textContent = 'Subtitles';
    pipCCMenu.innerHTML = '';
    const loading = pipWin.document.createElement('div');
    loading.className = 'pip-menu-item disabled';
    loading.textContent = 'Loading...';
    pipCCMenu.append(loading);

    const result = await bridgeCall('getCaptions', {});
    pipCCMenu.innerHTML = '';
    pipCCMenu.append(titleEl);
    if (!result) {
      const err = pipWin.document.createElement('div');
      err.className = 'pip-menu-item disabled';
      err.textContent = 'Could not load';
      pipCCMenu.append(err);
      return;
    }
    renderCCItems(
      pipCCMenu, pipWin.document, 'pip-menu-item', 'pip-menu-check',
      result.tracks, result.current,
      () => { bridgeCall('setCaptions', { track: {} }); pipCCBadge.classList.remove('active'); closePipMenus(); },
      (t) => { bridgeCall('setCaptions', { track: t }); pipCCBadge.classList.add('active'); closePipMenus(); }
    );
  }
  pipCCBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = pipCCMenu.classList.contains('visible');
    closePipMenus();
    if (!isOpen) { buildPipCCMenu(); pipCCMenu.classList.add('visible'); }
  });

  /* Quality */
  async function buildPipQualityMenu() {
    const titleEl = pipWin.document.createElement('div');
    titleEl.className = 'pip-menu-title';
    titleEl.textContent = 'Quality';
    pipHDMenu.innerHTML = '';
    const loading = pipWin.document.createElement('div');
    loading.className = 'pip-menu-item disabled';
    loading.textContent = 'Loading...';
    pipHDMenu.append(loading);

    const result = await bridgeCall('getQualities', {});
    pipHDMenu.innerHTML = '';
    pipHDMenu.append(titleEl);
    if (!result) {
      const err = pipWin.document.createElement('div');
      err.className = 'pip-menu-item disabled';
      err.textContent = 'Could not load';
      pipHDMenu.append(err);
      return;
    }
    renderQualityItems(
      pipHDMenu, pipWin.document, 'pip-menu-item', 'pip-menu-check', 'pip-hd-tag',
      result.levels, result.current, result.qualityData,
      (q) => { bridgeCall('setQuality', { quality: q }); closePipMenus(); }
    );
  }
  pipHDBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = pipHDMenu.classList.contains('visible');
    closePipMenus();
    if (!isOpen) { buildPipQualityMenu(); pipHDMenu.classList.add('visible'); }
  });

  /* Chapters */
  async function buildPipChaptersMenu() {
    pipChapMenu.innerHTML = '';
    const titleEl = pipWin.document.createElement('div');
    titleEl.className = 'pip-menu-title';
    titleEl.textContent = 'Chapters';
    pipChapMenu.append(titleEl);

    const chapters = cachedChapters.length > 0 ? cachedChapters : await loadChapters();
    if (chapters.length === 0) {
      const noItem = pipWin.document.createElement('div');
      noItem.className = 'pip-menu-item disabled';
      noItem.textContent = 'No chapters';
      pipChapMenu.append(noItem);
      return;
    }
    const dur = video.duration || 0;
    const curTime = video.currentTime || 0;
    chapters.forEach((ch, idx) => {
      const nextStart = idx + 1 < chapters.length ? chapters[idx + 1].startTime : dur;
      const isActive = curTime >= ch.startTime && curTime < nextStart;
      const item = pipWin.document.createElement('div');
      item.className = 'pip-menu-item' + (isActive ? ' active' : '');
      item.innerHTML = `<span class="pip-chap-time">${fmtTime(ch.startTime)}</span><span class="pip-chap-title">${ch.title}</span>`;
      item.addEventListener('click', (e) => { e.stopPropagation(); video.currentTime = ch.startTime; closePipMenus(); });
      pipChapMenu.append(item);
    });
  }
  pipChapBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = pipChapMenu.classList.contains('visible');
    closePipMenus();
    if (!isOpen) { buildPipChaptersMenu(); pipChapMenu.classList.add('visible'); }
  });

  /* Speed */
  function buildPipSpeedMenu() {
    pipSpeedMenu.innerHTML = '';
    const titleEl = pipWin.document.createElement('div');
    titleEl.className = 'pip-menu-title';
    titleEl.textContent = 'Speed';
    pipSpeedMenu.append(titleEl);

    const current = video.playbackRate || 1;
    SPEED_OPTIONS.forEach((spd) => {
      const item = pipWin.document.createElement('div');
      const label = spd === 1 ? 'Normal' : spd + 'x';
      item.className = 'pip-menu-item' + (spd === current ? ' active' : '');
      item.innerHTML = `<span class="pip-menu-check">${ICONS.check}</span><span>${label}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        video.playbackRate = spd;
        pipSpeedBadge.textContent = spd === 1 ? '1x' : spd + 'x';
        pipSpeedBadge.classList.toggle('active', spd !== 1);
        closePipMenus();
      });
      pipSpeedMenu.append(item);
    });

    /* Custom speed input */
    const customRow = pipWin.document.createElement('div');
    customRow.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px 10px;border-top:1px solid rgba(255,255,255,0.1);margin-top:4px;';
    const customLabel = pipWin.document.createElement('span');
    customLabel.textContent = 'Custom:';
    customLabel.style.cssText = 'color:#aaa;font-size:10px;';
    const customInput = pipWin.document.createElement('input');
    customInput.type = 'number';
    customInput.min = '0.1';
    customInput.max = '16';
    customInput.step = '0.05';
    customInput.value = current;
    customInput.style.cssText = 'width:50px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);border-radius:3px;color:#fff;font-size:11px;padding:3px 4px;text-align:center;outline:none;';
    const customBtn = pipWin.document.createElement('button');
    customBtn.textContent = 'Set';
    customBtn.style.cssText = 'background:#e53935;border:none;border-radius:3px;color:#fff;font-size:10px;font-weight:600;padding:3px 8px;cursor:pointer;';
    const applyPipSpeed = () => {
      let val = parseFloat(customInput.value);
      if (isNaN(val) || val < 0.1) val = 0.1;
      if (val > 16) val = 16;
      video.playbackRate = val;
      pipSpeedBadge.textContent = val === 1 ? '1x' : val + 'x';
      pipSpeedBadge.classList.toggle('active', val !== 1);
      closePipMenus();
    };
    customBtn.addEventListener('click', (e) => { e.stopPropagation(); applyPipSpeed(); });
    customInput.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') applyPipSpeed(); });
    customInput.addEventListener('click', (e) => e.stopPropagation());
    customRow.append(customLabel, customInput, customBtn);
    pipSpeedMenu.append(customRow);
  }
  pipSpeedBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = pipSpeedMenu.classList.contains('visible');
    closePipMenus();
    if (!isOpen) { buildPipSpeedMenu(); pipSpeedMenu.classList.add('visible'); }
  });

  pipWin.document.body.addEventListener('click', () => closePipMenus());

  /* Chapter markers on PiP seek bar */
  function renderPipChapterMarkers() {
    const dur = video.duration || 0;
    if (dur <= 0 || cachedChapters.length === 0) return;
    cachedChapters.forEach((ch) => {
      if (ch.startTime <= 0) return;
      const pct = (ch.startTime / dur) * 100;
      const m = pipWin.document.createElement('div');
      m.className = 'pip-chap-marker';
      m.style.left = pct + '%';
      pTrack.appendChild(m);
    });
  }
  renderPipChapterMarkers();

  /* Keyboard shortcuts */
  pipWin.document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case ' ': case 'k':
        e.preventDefault();
        if (video.paused) video.play(); else video.pause();
        break;
      case 'ArrowLeft': case 'j':
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - SKIP_SECONDS);
        break;
      case 'ArrowRight': case 'l':
        e.preventDefault();
        video.currentTime = Math.min(video.duration || 0, video.currentTime + SKIP_SECONDS);
        break;
      case 'ArrowUp':
        e.preventDefault();
        video.volume = Math.min(1, video.volume + 0.05);
        video.muted = false;
        break;
      case 'ArrowDown':
        e.preventDefault();
        video.volume = Math.max(0, video.volume - 0.05);
        break;
      case 'm':
        e.preventDefault();
        video.muted = !video.muted;
        break;
      case 'Escape':
        closePip();
        break;
    }
  });

  video.addEventListener('dblclick', () => closePip());
  closeBtn.addEventListener('click', () => closePip());

  /* Cleanup + restore */
  function closePip() {
    try {
      video.removeEventListener('play', syncPipPlay);
      video.removeEventListener('pause', syncPipPlay);
      video.removeEventListener('volumechange', syncPipVol);
      video.removeEventListener('timeupdate', syncPipProgress);
      if (videoNext) {
        videoParent.insertBefore(video, videoNext);
      } else {
        videoParent.appendChild(video);
      }
      video.setAttribute('style', savedVideoStyle);
      onPipClosed();
      syncPlayBtn();
      syncVolBtn();
      updateProgress();
      pipWin.close();
    } catch (_) {}
  }

  /* Handle the PiP window being closed by the browser X button */
  pipWin.addEventListener('pagehide', () => {
    try {
      if (videoParent && !videoParent.contains(video)) {
        if (videoNext) {
          videoParent.insertBefore(video, videoNext);
        } else {
          videoParent.appendChild(video);
        }
      }
      video.setAttribute('style', savedVideoStyle);
      onPipClosed();
      syncPlayBtn();
      syncVolBtn();
      updateProgress();
    } catch (_) {}
  });

  showOverlay();
  return { pipWindow: pipWin, closePip };
}

/** Fallback for browsers without Document PiP API. */
export async function openBasicPip(video) {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (video && typeof video.requestPictureInPicture === 'function') {
      await video.requestPictureInPicture();
    }
  } catch (_) {}
}
