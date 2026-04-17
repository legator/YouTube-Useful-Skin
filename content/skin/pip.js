import { ICONS, volIcon } from './icons.js';
import { fmtTime } from './utils.js';
import { SPEED_OPTIONS, SKIP_SECONDS, HD_QUALITIES, QUALITY_LABELS } from './constants.js';
import { attachSeekDrag, renderCCItems, renderQualityItems, renderAudioItems } from './buildSkin.js';

export async function openDocumentPip({ video, ui, bridgeCall, cachedChapters, loadChapters,
                                        syncPlayBtn, syncVolBtn, updateProgress, isLiveStream, onPipClosed }) {
  const pipWin = await window.documentPictureInPicture.requestWindow({
    width:  Math.min(640, Math.round(screen.width  * 0.35)),
    height: Math.min(360, Math.round(screen.height * 0.35)),
  });

  /* Inject styles */
  const link = pipWin.document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('content/pip.css');
  pipWin.document.head.appendChild(link);
  pipWin.document.body.style.fontFamily = "'Segoe UI', Roboto, Arial, sans-serif";

  /* Move video into PiP window */
  const videoParent  = video.parentElement;
  const videoNext    = video.nextSibling;
  const savedStyle   = video.getAttribute('style') || '';
  pipWin.document.body.appendChild(video);
  video.style.cssText = 'width:100%;height:100%;position:static;top:auto;left:auto;object-fit:contain;background:#000;';

  /* ── Helper ── */
  const mk = (tag, cls, html) => {
    const el = pipWin.document.createElement(tag);
    if (cls)  el.className = cls;
    if (html) el.innerHTML = html;
    if (tag === 'button') el.type = 'button';
    return el;
  };

  /* ── Overlay ── */
  const overlay = mk('div', 'pip-overlay');

  /* Top info — glass card */
  const topDiv    = mk('div', 'pip-top');
  const pTitle    = mk('div', 'pip-title');
  pTitle.textContent = ui.titleEl.textContent || '';
  const pChannel  = mk('div', 'pip-channel');
  pChannel.textContent = ui.channelEl.textContent || '';
  topDiv.append(pTitle, pChannel);

  /* Close button */
  const closeBtn = mk('button', 'pip-close-btn',
    `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`);
  closeBtn.title = 'Close PiP';

  /* ── Bottom ── */
  const bottomDiv = mk('div', 'pip-bottom');
  const ctrlRow   = mk('div', 'pip-controls');

  /* Volume */
  const pipBtnVol    = mk('button', 'pip-btn', volIcon(video.volume, video.muted));
  pipBtnVol.title = 'Mute';
  const pipVolWrap   = mk('div', 'pip-vol-wrap');
  const pipVolSlider = mk('div', 'pip-vol-slider');
  const pipVolFill   = mk('div', 'pip-vol-fill');
  const pipVolThumb  = mk('div', 'pip-vol-thumb');
  pipVolSlider.append(pipVolFill, pipVolThumb);
  pipVolWrap.append(pipBtnVol, pipVolSlider);

  /* Transport */
  const pipBtnPrev = mk('button', 'pip-btn', ICONS.replay10);  pipBtnPrev.title = 'Back 10s';
  const pipBtnPlay = mk('button', 'pip-btn pip-btn-play' + (video.paused ? '' : ' playing'),
                        video.paused ? ICONS.play : ICONS.pause);
  pipBtnPlay.title = video.paused ? 'Play' : 'Pause';
  const pipBtnNext = mk('button', 'pip-btn', ICONS.forward10); pipBtnNext.title = 'Forward 10s';

  /* Live */
  const pipBtnLive = mk('button', 'pip-btn-live' + (isLiveStream ? ' at-live' : ''));
  pipBtnLive.textContent = '● LIVE';
  pipBtnLive.title = 'Go to live';
  pipBtnLive.style.display = isLiveStream ? 'inline-flex' : 'none';
  if (isLiveStream) { pipBtnPrev.style.display = 'none'; pipBtnNext.style.display = 'none'; }

  /* ── Badges + menus ── */
  const mkMenuWrap = (badgeCls, badgeContent, menuCls) => {
    const wrap  = mk('div', 'pip-menu-wrap');
    const badge = mk('span', 'pip-badge' + (badgeCls ? ' ' + badgeCls : ''));
    badge.innerHTML = badgeContent;
    const menu  = mk('div', 'pip-menu' + (menuCls ? ' ' + menuCls : ''));
    wrap.append(badge, menu);
    return { wrap, badge, menu };
  };

  const { wrap: pipCCWrap,    badge: pipCCBadge,    menu: pipCCMenu    } = mkMenuWrap('', 'CC', '');
  pipCCBadge.title = 'Subtitles';

  const { wrap: pipLangWrap,  badge: pipLangBadge,  menu: pipLangMenu  } = mkMenuWrap('pip-badge-lang', ICONS.language, '');
  pipLangBadge.title = 'Audio language';
  pipLangWrap.style.display = 'none';

  const { wrap: pipHDWrap,    badge: pipHDBadge,    menu: pipHDMenu    } = mkMenuWrap('', 'HD', '');
  pipHDBadge.title = 'Quality';

  const { wrap: pipSpeedWrap, badge: pipSpeedBadge, menu: pipSpeedMenu } = mkMenuWrap('pip-badge-speed',
    (video.playbackRate || 1) === 1 ? '1x' : video.playbackRate + 'x', '');
  pipSpeedBadge.title = 'Speed';

  const pipChapWrap = mk('div', 'pip-menu-wrap');
  const pipChapBtn  = mk('button', 'pip-btn-chap', ICONS.chapters);
  pipChapBtn.title  = 'Chapters';
  const pipChapMenu = mk('div', 'pip-menu');
  pipChapWrap.append(pipChapBtn, pipChapMenu);

  ctrlRow.append(
    pipVolWrap, pipCCWrap, pipLangWrap, pipHDWrap, pipSpeedWrap,
    pipBtnPrev, pipBtnPlay, pipBtnNext, pipBtnLive, pipChapWrap
  );

  /* ── Progress row — glass pill ── */
  const progRow = mk('div', 'pip-progress-row');
  const pTimeL  = mk('span', 'pip-time');        pTimeL.textContent = fmtTime(video.currentTime);
  const pTimeR  = mk('span', 'pip-time pip-time-right'); pTimeR.textContent = fmtTime(video.duration);
  const pSeek   = mk('div', 'pip-seek');
  const pTrack  = mk('div', 'pip-seek-track');
  const pBuf    = mk('div', 'pip-seek-buf');
  const pFill   = mk('div', 'pip-seek-fill');
  const pThumb  = mk('div', 'pip-seek-thumb');
  const pTip    = mk('div', 'pip-seek-tooltip');
  pTrack.append(pBuf, pFill, pThumb);
  pSeek.append(pTrack, pTip);
  progRow.append(pTimeL, pSeek, pTimeR);

  bottomDiv.append(ctrlRow, progRow);
  overlay.append(topDiv, closeBtn, bottomDiv);
  pipWin.document.body.appendChild(overlay);

  /* ── Show / hide overlay ── */
  let pipHideTimer;
  const showOverlay = () => {
    overlay.classList.add('show');
    clearTimeout(pipHideTimer);
    pipHideTimer = setTimeout(() => { if (!video.paused) overlay.classList.remove('show'); }, 3000);
  };
  pipWin.document.body.addEventListener('mousemove',  showOverlay);
  pipWin.document.body.addEventListener('mouseenter', showOverlay);
  pipWin.document.body.addEventListener('mouseleave', () => { clearTimeout(pipHideTimer); overlay.classList.remove('show'); });

  /* ── Play / Pause ── */
  pipBtnPlay.addEventListener('click', () => { if (video.paused) video.play(); else video.pause(); });
  const syncPipPlay = () => {
    pipBtnPlay.innerHTML  = video.paused ? ICONS.play : ICONS.pause;
    pipBtnPlay.className  = 'pip-btn pip-btn-play' + (video.paused ? '' : ' playing');
    if (video.paused) overlay.classList.add('show');
  };
  video.addEventListener('play',  syncPipPlay);
  video.addEventListener('pause', syncPipPlay);

  /* ── Skip ── */
  pipBtnPrev.addEventListener('click', () => { video.currentTime = Math.max(0, video.currentTime - SKIP_SECONDS); });
  pipBtnNext.addEventListener('click', () => { video.currentTime = Math.min(video.duration || 0, video.currentTime + SKIP_SECONDS); });

  /* ── Live ── */
  pipBtnLive.addEventListener('click', () => {
    const s = video.seekable;
    if (s.length) video.currentTime = s.end(s.length - 1);
  });

  /* ── Volume ── */
  pipBtnVol.addEventListener('click', () => { video.muted = !video.muted; });
  const syncPipVol = () => {
    pipBtnVol.innerHTML = volIcon(video.volume, video.muted);
    const vp = video.muted ? 0 : video.volume * 100;
    pipVolFill.style.width  = vp + '%';
    pipVolThumb.style.left  = vp + '%';
  };
  video.addEventListener('volumechange', syncPipVol);
  syncPipVol();

  const volFromE = (e) => {
    const r = pipVolSlider.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };
  pipVolSlider.addEventListener('mousedown', (e) => {
    e.preventDefault();
    let v = volFromE(e);
    if (video.volume !== v) video.volume = v;
    if (video.muted) video.muted = false;
    const onM = (ev) => { v = volFromE(ev); if (video.volume !== v) video.volume = v; if (video.muted) video.muted = false; };
    const onU = () => { pipWin.document.removeEventListener('mousemove', onM); pipWin.document.removeEventListener('mouseup', onU); };
    pipWin.document.addEventListener('mousemove', onM);
    pipWin.document.addEventListener('mouseup', onU);
  });

  /* ── Progress / seek ── */
  let pipSeeking = false;
  let pipLastLiveHeadAtLive = true;
  let pipLiveHeadPollTimer  = null;

  function schedulePipLiveHeadPoll() {
    if (pipLiveHeadPollTimer) return;
    pipLiveHeadPollTimer = setTimeout(async () => {
      pipLiveHeadPollTimer = null;
      if (!isLiveStream) return;
      const r = await bridgeCall('getSyncState', {});
      if (r?.isAtLiveHead != null) pipLastLiveHeadAtLive = r.isAtLiveHead;
    }, 2000);
  }

  const syncPipProgress = () => {
    if (pipSeeking) return;
    const cur = video.currentTime || 0;
    if (isLiveStream) {
      const s = video.seekable;
      let edge = cur, start = 0;
      if (s.length > 0) { edge = s.end(s.length - 1); start = s.start(0); }
      const range = edge - start;
      const pct   = range > 0 ? Math.max(0, Math.min(100, ((cur - start) / range) * 100)) : 100;
      pFill.style.width  = pct + '%';
      pThumb.style.left  = pct + '%';
      pBuf.style.width   = '100%';
      const behind = Math.max(0, edge - cur);
      pTimeL.textContent = behind > 2 ? '\u2212' + fmtTime(Math.round(behind)) : 'LIVE';
      pTimeR.textContent = '';
      pipBtnLive.classList.toggle('at-live', pipLastLiveHeadAtLive);
      schedulePipLiveHeadPoll();
      return;
    }
    const dur = video.duration || 0;
    const pct = dur ? (cur / dur) * 100 : 0;
    pFill.style.width  = pct + '%';
    pThumb.style.left  = pct + '%';
    pTimeL.textContent = fmtTime(cur);
    pTimeR.textContent = fmtTime(dur);
    if (video.buffered?.length > 0) {
      const buf = video.buffered.end(video.buffered.length - 1);
      pBuf.style.width = (dur ? (buf / dur) * 100 : 0) + '%';
    }
  };
  video.addEventListener('timeupdate', syncPipProgress);
  syncPipProgress();

  attachSeekDrag(pSeek, pTrack, pFill, pThumb, pipWin.document, video,
    () => { pipSeeking = true; }, () => { pipSeeking = false; });

  /* Seek tooltip */
  pSeek.addEventListener('mousemove', (e) => {
    const r   = pTrack.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const t   = pct * (video.duration || 0);
    pTip.textContent  = fmtTime(t);
    pTip.style.left   = (pct * 100) + '%';
  });
  pSeek.addEventListener('mouseleave', () => { pTip.style.opacity = '0'; });
  pSeek.addEventListener('mouseenter', () => { pTip.style.opacity = '1'; });

  video.addEventListener('click', () => { if (video.paused) video.play(); else video.pause(); });

  /* ── Menus ── */
  function closePipMenus() {
    [pipCCMenu, pipLangMenu, pipHDMenu, pipSpeedMenu, pipChapMenu].forEach(m => m.classList.remove('visible'));
  }

  function pipMenuTitle(text) {
    const t = mk('div', 'pip-menu-title');
    t.textContent = text;
    return t;
  }

  /* CC */
  async function buildPipCCMenu() {
    pipCCMenu.innerHTML = '';
    pipCCMenu.append(pipMenuTitle('Subtitles'));
    const loading = mk('div', 'pip-menu-item disabled'); loading.textContent = 'Loading...';
    pipCCMenu.append(loading);
    const result = await bridgeCall('getCaptions', {});
    pipCCMenu.innerHTML = '';
    pipCCMenu.append(pipMenuTitle('Subtitles'));
    if (!result) { const e = mk('div', 'pip-menu-item disabled'); e.textContent = 'Could not load'; pipCCMenu.append(e); return; }
    renderCCItems(pipCCMenu, pipWin.document, 'pip-menu-item', 'pip-menu-check',
      result.tracks, result.current,
      () => { bridgeCall('setCaptions', { track: {} }); pipCCBadge.classList.remove('active'); closePipMenus(); },
      (t) => { bridgeCall('setCaptions', { track: t });  pipCCBadge.classList.add('active');    closePipMenus(); }
    );
  }
  pipCCBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = pipCCMenu.classList.contains('visible');
    closePipMenus();
    if (!open) { buildPipCCMenu(); pipCCMenu.classList.add('visible'); }
  });

  /* Audio language */
  async function buildPipLangMenu() {
    pipLangMenu.innerHTML = '';
    pipLangMenu.append(pipMenuTitle('Audio Language'));
    const loading = mk('div', 'pip-menu-item disabled'); loading.textContent = 'Loading...';
    pipLangMenu.append(loading);
    const result = await bridgeCall('getAudioTracks', {});
    pipLangMenu.innerHTML = '';
    pipLangMenu.append(pipMenuTitle('Audio Language'));
    if (!result) { const e = mk('div', 'pip-menu-item disabled'); e.textContent = 'Could not load'; pipLangMenu.append(e); return; }
    renderAudioItems(pipLangMenu, pipWin.document, 'pip-menu-item', 'pip-menu-check',
      result.tracks, result.current,
      (t) => { bridgeCall('setAudioTrack', { track: t }); closePipMenus(); }
    );
  }
  pipLangBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = pipLangMenu.classList.contains('visible');
    closePipMenus();
    if (!open) { buildPipLangMenu(); pipLangMenu.classList.add('visible'); }
  });

  async function checkPipAudioTracks() {
    const result = await bridgeCall('getAudioTracks', {});
    pipLangWrap.style.display = (result?.tracks?.length > 1) ? '' : 'none';
  }
  setTimeout(checkPipAudioTracks, 600);

  /* Quality */
  async function buildPipQualityMenu() {
    pipHDMenu.innerHTML = '';
    pipHDMenu.append(pipMenuTitle('Quality'));
    const loading = mk('div', 'pip-menu-item disabled'); loading.textContent = 'Loading...';
    pipHDMenu.append(loading);
    const result = await bridgeCall('getQualities', {});
    pipHDMenu.innerHTML = '';
    pipHDMenu.append(pipMenuTitle('Quality'));
    if (!result) { const e = mk('div', 'pip-menu-item disabled'); e.textContent = 'Could not load'; pipHDMenu.append(e); return; }
    renderQualityItems(pipHDMenu, pipWin.document, 'pip-menu-item', 'pip-menu-check', 'pip-hd-tag',
      result.levels, result.current, result.qualityData,
      (q) => { bridgeCall('setQuality', { quality: q }); closePipMenus(); }
    );
  }
  pipHDBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = pipHDMenu.classList.contains('visible');
    closePipMenus();
    if (!open) { buildPipQualityMenu(); pipHDMenu.classList.add('visible'); }
  });

  /* Speed */
  function buildPipSpeedMenu() {
    pipSpeedMenu.innerHTML = '';
    pipSpeedMenu.append(pipMenuTitle('Speed'));
    const current = video.playbackRate || 1;
    SPEED_OPTIONS.forEach((spd) => {
      const item  = mk('div', 'pip-menu-item' + (spd === current ? ' active' : ''));
      const label = spd === 1 ? 'Normal' : spd + 'x';
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

    const customRow   = mk('div', 'pip-speed-custom');
    const customLabel = mk('span', 'pip-speed-label'); customLabel.textContent = 'Custom:';
    const customInput = mk('input', 'pip-speed-input');
    Object.assign(customInput, { type: 'number', min: '0.1', max: '16', step: '0.05', value: current });
    const customBtn = mk('button', 'pip-speed-apply'); customBtn.textContent = 'Set';
    const applySpeed = () => {
      let val = parseFloat(customInput.value);
      if (isNaN(val) || val < 0.1) val = 0.1;
      if (val > 16) val = 16;
      video.playbackRate = val;
      pipSpeedBadge.textContent = val === 1 ? '1x' : val + 'x';
      pipSpeedBadge.classList.toggle('active', val !== 1);
      closePipMenus();
    };
    customBtn.addEventListener('click',   (e) => { e.stopPropagation(); applySpeed(); });
    customInput.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') applySpeed(); });
    customInput.addEventListener('click',   (e) => e.stopPropagation());
    customRow.append(customLabel, customInput, customBtn);
    pipSpeedMenu.append(customRow);
  }
  pipSpeedBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = pipSpeedMenu.classList.contains('visible');
    closePipMenus();
    if (!open) { buildPipSpeedMenu(); pipSpeedMenu.classList.add('visible'); }
  });

  /* Chapters */
  async function buildPipChaptersMenu() {
    pipChapMenu.innerHTML = '';
    pipChapMenu.append(pipMenuTitle('Chapters'));
    const chapters = cachedChapters.length > 0 ? cachedChapters : await loadChapters();
    if (chapters.length === 0) {
      const n = mk('div', 'pip-menu-item disabled'); n.textContent = 'No chapters'; pipChapMenu.append(n); return;
    }
    const dur = video.duration || 0, curTime = video.currentTime || 0;
    chapters.forEach((ch, idx) => {
      const nextStart = idx + 1 < chapters.length ? chapters[idx + 1].startTime : dur;
      const isActive  = curTime >= ch.startTime && curTime < nextStart;
      const item      = mk('div', 'pip-menu-item' + (isActive ? ' active' : ''));
      const timeSpan  = mk('span', 'pip-chap-time'); timeSpan.textContent = fmtTime(ch.startTime);
      const titSpan   = mk('span', 'pip-chap-title'); titSpan.textContent = ch.title;
      item.append(timeSpan, titSpan);
      item.addEventListener('click', (e) => { e.stopPropagation(); video.currentTime = ch.startTime; closePipMenus(); });
      pipChapMenu.append(item);
    });
  }
  pipChapBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = pipChapMenu.classList.contains('visible');
    closePipMenus();
    if (!open) { buildPipChaptersMenu(); pipChapMenu.classList.add('visible'); }
  });

  pipWin.document.body.addEventListener('click', () => closePipMenus());

  /* Chapter markers on seek bar */
  function renderPipChapMarkers() {
    const dur = video.duration || 0;
    if (dur <= 0 || !cachedChapters.length) return;
    cachedChapters.forEach((ch) => {
      if (ch.startTime <= 0) return;
      const m = mk('div', 'pip-chap-marker');
      m.style.left = ((ch.startTime / dur) * 100) + '%';
      pTrack.appendChild(m);
    });
  }
  renderPipChapMarkers();

  /* Keyboard shortcuts */
  pipWin.document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case ' ': case 'k': e.preventDefault(); if (video.paused) video.play(); else video.pause(); break;
      case 'ArrowLeft':  case 'j': e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - SKIP_SECONDS); break;
      case 'ArrowRight': case 'l': e.preventDefault(); video.currentTime = Math.min(video.duration || 0, video.currentTime + SKIP_SECONDS); break;
      case 'ArrowUp':   e.preventDefault(); video.volume = Math.min(1, video.volume + 0.05); video.muted = false; break;
      case 'ArrowDown': e.preventDefault(); video.volume = Math.max(0, video.volume - 0.05); break;
      case 'm': e.preventDefault(); video.muted = !video.muted; break;
      case 'Escape': closePip(); break;
    }
  });

  video.addEventListener('dblclick', () => closePip());
  closeBtn.addEventListener('click', () => closePip());

  /* Cleanup */
  function restoreVideo() {
    video.removeEventListener('play',         syncPipPlay);
    video.removeEventListener('pause',        syncPipPlay);
    video.removeEventListener('volumechange', syncPipVol);
    video.removeEventListener('timeupdate',   syncPipProgress);
    if (videoNext) videoParent.insertBefore(video, videoNext);
    else           videoParent.appendChild(video);
    video.setAttribute('style', savedStyle);
    onPipClosed(); syncPlayBtn(); syncVolBtn(); updateProgress();
  }

  function closePip() {
    try { restoreVideo(); pipWin.close(); } catch (_) {}
  }

  pipWin.addEventListener('pagehide', () => {
    try {
      if (videoParent && !videoParent.contains(video)) restoreVideo();
      else { onPipClosed(); syncPlayBtn(); syncVolBtn(); updateProgress(); }
    } catch (_) {}
  });

  showOverlay();
  return { pipWindow: pipWin, closePip };
}

/** Fallback for browsers without Document PiP API. */
export async function openBasicPip(video) {
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else if (video?.requestPictureInPicture) await video.requestPictureInPicture();
  } catch (_) {}
}
