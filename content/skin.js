/* ============================================================
   YouTube Custom Player Skin — Content Script
   Injects the custom overlay UI into the YouTube HTML5 player,
   wires up seek-bar, play/pause, volume, CC, quality, etc.
   ============================================================ */

(function () {
  'use strict';

  /* ---- SVG icon paths ---- */
  const ICONS = {
    volumeHigh: `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.1v7.8a4.47 4.47 0 0 0 2.5-3.9zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1A9 9 0 0 0 14 3.2z"/></svg>`,
    volumeMute: `<svg viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0 0 14 8.1v2.3l2.45 2.45c.03-.28.05-.56.05-.85zm2.5 0a7 7 0 0 1-.57 2.8l1.53 1.53A8.93 8.93 0 0 0 21 12a9 9 0 0 0-7-8.8v2.1a7 7 0 0 1 5 6.7zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.1a8.96 8.96 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4l-2.09 2.09L12 8.18V4z"/></svg>`,
    play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
    pause: `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
    miniPlayer: `<svg viewBox="0 0 24 24"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>`,
    pip: `<svg viewBox="0 0 24 24"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg>`,
    theaterMode: `<svg viewBox="0 0 24 24"><path d="M19 7H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 8H5V9h14v6z"/></svg>`,
    fullscreen: `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`,
    fullscreenExit: `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`,
    stop: `<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>`,
    replay10: `<svg viewBox="0 0 24 24"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="10" y="16.5" font-size="7.5" font-weight="700" fill="currentColor" text-anchor="middle" font-family="Arial">10</text></svg>`,
    forward10: `<svg viewBox="0 0 24 24"><path d="M11.99 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="14" y="16.5" font-size="7.5" font-weight="700" fill="currentColor" text-anchor="middle" font-family="Arial">10</text></svg>`,
    pipActive: `<svg viewBox="0 0 24 24"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/><rect x="11" y="7" width="8" height="6" fill="currentColor" opacity="0.5"/></svg>`,
    volumeLow: `<svg viewBox="0 0 24 24"><path d="M7 9v6h4l5 5V4l-5 5H7z"/></svg>`,
    check: `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`,
    subtitles: `<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6v-2zm0 4h8v2H6v-2zm10 0h2v2h-2v-2zm-6-4h8v2h-8v-2z"/></svg>`,
    quality: `<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>`,
    chapters: `<svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>`,
    speed: `<svg viewBox="0 0 24 24"><path d="M10 8v8l6-4-6-4zm1.5 4l2.25-1.5L11.5 9v3zM20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12z"/></svg>`,
  };

  /* ---- helpers ---- */
  const qs = (sel, root = document) => root.querySelector(sel);
  const ce = (tag, cls, html) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html) el.innerHTML = html;
    return el;
  };
  const fmtTime = (s) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    return m + ':' + String(sec).padStart(2, '0');
  };
  const volIcon = (volume, muted) => {
    if (muted || volume === 0) return ICONS.volumeMute;
    if (volume < 0.5) return ICONS.volumeLow;
    return ICONS.volumeHigh;
  };

  /* ---- state ---- */
  let skinInjected = false;
  let seeking = false;

  /* ==========================================================
     buildSkin – creates the DOM overlay and returns references
     ========================================================== */
  function buildSkin() {
    /* --- top bar --- */
    const topBar = ce('div', 'ytp-skin-top-bar');
    const topLeft = ce('div', 'ytp-skin-top-left');
    const titleEl = ce('div', 'ytp-skin-title');
    const channelEl = ce('div', 'ytp-skin-channel');
    topLeft.append(titleEl, channelEl);
    const viewsEl = ce('div', 'ytp-skin-views');
    topBar.append(topLeft, viewsEl);

    /* --- bottom bar --- */
    const bottomBar = ce('div', 'ytp-skin-bottom-bar');

    /* centre controls row */
    const controls = ce('div', 'ytp-skin-controls');

    /* -- volume button + slider popup -- */
    const volWrap = ce('div', 'ytp-skin-vol-wrap');
    const btnVol = ce('button', 'ytp-skin-btn small', ICONS.volumeHigh);
    btnVol.title = 'Volume';
    const volPopup = ce('div', 'ytp-skin-vol-popup');
    const volSliderTrack = ce('div', 'ytp-skin-vol-track');
    const volSliderFill = ce('div', 'ytp-skin-vol-fill');
    const volSliderThumb = ce('div', 'ytp-skin-vol-thumb');
    const volLabel = ce('div', 'ytp-skin-vol-label', '100%');
    volSliderTrack.append(volSliderFill, volSliderThumb);
    volPopup.append(volSliderTrack, volLabel);
    volWrap.append(btnVol, volPopup);

    /* -- subtitles button + menu -- */
    const ccWrap = ce('div', 'ytp-skin-menu-wrap');
    const badgeCC = ce('span', 'ytp-skin-badge', 'CC');
    badgeCC.title = 'Subtitles/CC';
    const ccMenu = ce('div', 'ytp-skin-menu ytp-skin-cc-menu');
    const ccMenuTitle = ce('div', 'ytp-skin-menu-title', 'Subtitles');
    const ccMenuList = ce('div', 'ytp-skin-menu-list');
    ccMenu.append(ccMenuTitle, ccMenuList);
    ccWrap.append(badgeCC, ccMenu);

    /* -- quality button + menu -- */
    const hdWrap = ce('div', 'ytp-skin-menu-wrap');
    const badgeHD = ce('span', 'ytp-skin-badge ytp-skin-badge-hd', '720<sup>HD</sup>');
    badgeHD.title = 'Quality';
    const hdMenu = ce('div', 'ytp-skin-menu ytp-skin-hd-menu');
    const hdMenuTitle = ce('div', 'ytp-skin-menu-title', 'Quality');
    const hdMenuList = ce('div', 'ytp-skin-menu-list');
    hdMenu.append(hdMenuTitle, hdMenuList);
    hdWrap.append(badgeHD, hdMenu);

    /* -- speed button + menu -- */
    const speedWrap = ce('div', 'ytp-skin-menu-wrap');
    const badgeSpeed = ce('span', 'ytp-skin-badge ytp-skin-badge-speed', '1x');
    badgeSpeed.title = 'Playback speed';
    const speedMenu = ce('div', 'ytp-skin-menu ytp-skin-speed-menu');
    const speedMenuTitle = ce('div', 'ytp-skin-menu-title', 'Speed');
    const speedMenuList = ce('div', 'ytp-skin-menu-list');
    speedMenu.append(speedMenuTitle, speedMenuList);
    speedWrap.append(badgeSpeed, speedMenu);

    /* -- chapters / timecodes button + menu -- */
    const chapWrap = ce('div', 'ytp-skin-menu-wrap');
    const btnChapters = ce('button', 'ytp-skin-btn ytp-skin-btn-chapters', ICONS.chapters);
    btnChapters.title = 'Chapters';
    const chapMenu = ce('div', 'ytp-skin-menu ytp-skin-chap-menu');
    const chapMenuTitle = ce('div', 'ytp-skin-menu-title', 'Chapters');
    const chapMenuList = ce('div', 'ytp-skin-menu-list');
    chapMenu.append(chapMenuTitle, chapMenuList);
    chapWrap.append(btnChapters, chapMenu);

    const btnSkipBack = ce('button', 'ytp-skin-btn ytp-skin-btn-skip', ICONS.replay10);
    btnSkipBack.title = 'Back 10s';

    const btnPlay = ce('button', 'ytp-skin-btn ytp-skin-btn-play paused', ICONS.play);
    btnPlay.title = 'Play';

    const btnSkipFwd = ce('button', 'ytp-skin-btn ytp-skin-btn-skip', ICONS.forward10);
    btnSkipFwd.title = 'Forward 10s';

    const btnTheater = ce('button', 'ytp-skin-btn ytp-skin-btn-square', ICONS.theaterMode);
    btnTheater.title = 'Theater mode';

    const btnMini = ce('button', 'ytp-skin-btn ytp-skin-btn-square', ICONS.pip);
    btnMini.title = 'Picture-in-Picture';

    const btnFS = ce('button', 'ytp-skin-btn ytp-skin-btn-square', ICONS.fullscreen);
    btnFS.title = 'Full screen';

    controls.append(volWrap, ccWrap, hdWrap, speedWrap, chapWrap, btnSkipBack, btnPlay, btnSkipFwd, btnTheater, btnMini, btnFS);

    /* seek / progress row */
    const progressWrap = ce('div', 'ytp-skin-progress-wrap');
    const timeLeft = ce('span', 'ytp-skin-time ytp-skin-time-left', '0:00');
    const timeRight = ce('span', 'ytp-skin-time ytp-skin-time-right', '0:00');
    const seekArea = ce('div', 'ytp-skin-seek');
    const seekTrack = ce('div', 'ytp-skin-seek-track');
    const seekBuffer = ce('div', 'ytp-skin-seek-buffer');
    const seekFill = ce('div', 'ytp-skin-seek-fill');
    const seekThumb = ce('div', 'ytp-skin-seek-thumb');
    const seekTooltip = ce('div', 'ytp-skin-seek-tooltip', '0:00');
    const seekPreview = ce('div', 'ytp-skin-seek-preview');
    const seekPreviewImg = ce('div', 'ytp-skin-seek-preview-img');
    seekPreview.append(seekPreviewImg);
    seekTrack.append(seekBuffer, seekFill, seekThumb);
    seekArea.append(seekTrack, seekPreview, seekTooltip);
    progressWrap.append(timeLeft, seekArea, timeRight);

    bottomBar.append(controls, progressWrap);

    return {
      topBar, bottomBar,
      titleEl, channelEl, viewsEl,
      btnVol, volPopup, volSliderTrack, volSliderFill, volSliderThumb, volLabel, volWrap,
      badgeCC, ccMenu, ccMenuList, ccWrap,
      badgeHD, hdMenu, hdMenuList, hdWrap,
      badgeSpeed, speedMenu, speedMenuList, speedWrap,
      btnChapters, chapMenu, chapMenuList, chapWrap,
      btnSkipBack, btnPlay, btnSkipFwd,
      btnTheater, btnMini, btnFS,
      timeLeft, timeRight,
      seekArea, seekTrack, seekBuffer, seekFill, seekThumb, seekTooltip,
      seekPreview, seekPreviewImg,
    };
  }

  /* ---- shared drag helper for seek bars ---- */
  function attachSeekDrag(areaEl, trackEl, fillEl, thumbEl, docRef, video, onStart, onEnd, tooltipEl) {
    function pctFrom(e) {
      const r = trackEl.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    }
    areaEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onStart();
      const p0 = pctFrom(e);
      video.currentTime = p0 * (video.duration || 0);
      fillEl.style.width = (p0 * 100) + '%';
      thumbEl.style.left = (p0 * 100) + '%';
      const onMove = (ev) => {
        const p = pctFrom(ev);
        fillEl.style.width = (p * 100) + '%';
        thumbEl.style.left = (p * 100) + '%';
        if (tooltipEl) {
          tooltipEl.textContent = fmtTime(p * (video.duration || 0));
          tooltipEl.style.left = (p * 100) + '%';
        }
        video.currentTime = p * (video.duration || 0);
      };
      const onUp = () => {
        onEnd();
        docRef.removeEventListener('mousemove', onMove);
        docRef.removeEventListener('mouseup', onUp);
      };
      docRef.addEventListener('mousemove', onMove);
      docRef.addEventListener('mouseup', onUp);
    });
  }

  /* ---- shared CC/subtitle item renderer ---- */
  function renderCCItems(containerEl, doc, itemCls, checkCls, tracks, current, onOff, onSelect) {
    const offItem = doc.createElement('div');
    offItem.className = itemCls + (!current?.languageCode ? ' active' : '');
    offItem.innerHTML = `<span class="${checkCls}">${ICONS.check}</span><span>Off</span>`;
    offItem.addEventListener('click', (e) => { e.stopPropagation(); onOff(); });
    containerEl.append(offItem);
    if (!tracks?.length) {
      const noItem = doc.createElement('div');
      noItem.className = itemCls + ' disabled';
      noItem.textContent = 'No subtitles available';
      containerEl.append(noItem);
      return;
    }
    tracks.forEach((t) => {
      const item = doc.createElement('div');
      item.className = itemCls + (current?.languageCode === t.languageCode ? ' active' : '');
      item.innerHTML = `<span class="${checkCls}">${ICONS.check}</span><span>${t.displayName || t.languageName || t.languageCode || 'Unknown'}</span>`;
      item.addEventListener('click', (e) => { e.stopPropagation(); onSelect(t); });
      containerEl.append(item);
    });
  }

  /* ---- shared quality item renderer ---- */
  const HD_QUALITIES = ['hd720', 'hd1080', 'hd1440', 'hd2160', 'highres'];
  function renderQualityItems(containerEl, doc, itemCls, checkCls, hdTagCls, levels, current, qualityData, onSelect) {
    let qLevels = levels;
    if (qualityData?.length > 0) {
      qLevels = qualityData.map(qd => qd.quality || qd.qualityLabel).filter(Boolean);
      const seen = new Set();
      qLevels = qLevels.filter(q => { if (seen.has(q)) return false; seen.add(q); return true; });
    }
    if (!qLevels?.length) {
      const noItem = doc.createElement('div');
      noItem.className = itemCls + ' disabled';
      noItem.textContent = 'Not available';
      containerEl.append(noItem);
      return;
    }
    const autoItem = doc.createElement('div');
    autoItem.className = itemCls + (current === 'auto' || !current ? ' active' : '');
    autoItem.innerHTML = `<span class="${checkCls}">${ICONS.check}</span><span>Auto</span>`;
    autoItem.addEventListener('click', (e) => { e.stopPropagation(); onSelect('auto'); });
    containerEl.append(autoItem);
    qLevels.forEach((q) => {
      if (q === 'auto') return;
      const item = doc.createElement('div');
      const label = QUALITY_LABELS[q] || q;
      item.className = itemCls + (q === current ? ' active' : '');
      item.innerHTML = `<span class="${checkCls}">${ICONS.check}</span><span>${label}</span>${HD_QUALITIES.includes(q) ? `<span class="${hdTagCls}">HD</span>` : ''}`;
      item.addEventListener('click', (e) => { e.stopPropagation(); onSelect(q); });
      containerEl.append(item);
    });
  }

  /* ==========================================================
     injectSkin – main entry: find the player and wire everything
     ========================================================== */
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

    function parseStoryboardSpec(spec) {
      if (!spec) return null;
      const parts = spec.split('|');
      if (parts.length < 2) return null;
      const baseUrl = parts[0].replace(/&amp;/g, '&').replace(/\\u0026/g, '&');

      /* Parse all levels and pick the best one.
         YouTube storyboard spec: baseUrl|L0params|L1params|L2params|...
         Each level: width#height#count#sheets#interval#namePattern#sigh
         
         Level 0 is smallest (e.g. 48x27), used as fallback.
         Higher levels are larger (80x45, 160x90).
         We want the LARGEST level that has proper sheet naming (M$M pattern).
         Levels with namePattern 'default' only work for single-sheet cases. */
      const levels = [];
      for (let i = 1; i < parts.length; i++) {
        const f = parts[i].split('#');
        if (f.length < 7) continue;
        const w = parseInt(f[0]);
        const h = parseInt(f[1]);
        const count = parseInt(f[2]);
        const sheets = parseInt(f[3]) || 1;
        const interval = parseInt(f[4]);
        const namePattern = f[5];
        const sigh = f.slice(6).join('#');
        let cols, rows;
        if (count === 25)       { cols = 5;  rows = 5; }
        else if (count === 100) { cols = 10; rows = 10; }
        else { cols = Math.round(Math.sqrt(count)); rows = Math.ceil(count / cols); }
        levels.push({ w, h, count, sheets, interval, namePattern, sigh, cols, rows,
                      totalThumbnails: count * sheets, levelIdx: i - 1 });
      }
      if (levels.length === 0) return null;

      /* Prefer: largest resolution level that has M$M pattern;
         if none have M$M, take the largest level overall */
      let best = null;
      for (const lv of levels) {
        const hasSheetPattern = lv.namePattern && lv.namePattern.includes('$M');
        const bestHasPattern = best && best.namePattern && best.namePattern.includes('$M');
        if (!best) { best = lv; continue; }
        /* Prefer levels with $M pattern over those without */
        if (hasSheetPattern && !bestHasPattern) { best = lv; continue; }
        if (!hasSheetPattern && bestHasPattern) continue;
        /* Among same type, prefer larger resolution */
        if (lv.w * lv.h > best.w * best.h) { best = lv; }
      }
      best.baseUrl = baseUrl;
      best.level = best.levelIdx;
      return best;
    }

    function storyboardUrl(sb, sheetIdx) {
      let url = sb.baseUrl;
      /* Replace $L with level index */
      url = url.replace(/\$L/g, String(sb.level));
      /* Replace $N with resolved name */
      if (sb.namePattern && sb.namePattern.includes('$M')) {
        /* M$M → M0, M1, M2... */
        const name = sb.namePattern.replace(/\$M/g, String(sheetIdx));
        url = url.replace(/\$N/g, name);
      } else {
        /* namePattern is a literal like 'default' for single-sheet levels,
           or use sheet index directly */
        url = url.replace(/\$N/g, sb.sheets > 1 ? 'M' + sheetIdx : (sb.namePattern || 'M' + sheetIdx));
      }
      /* Append the level-specific sigh parameter */
      if (sb.sigh) {
        /* Remove any existing sigh= from the URL and add the level-specific one */
        url = url.replace(/[&?]sigh=[^&]*/, '');
        url += (url.includes('?') ? '&' : '?') + 'sigh=' + sb.sigh;
      }
      return url;
    }

    function storyboardFrame(sb, time, duration) {
      if (!sb) return null;
      /* Compute effective interval: use spec value, or derive from duration */
      let interval = sb.interval;
      if (interval <= 0 && duration > 0 && sb.totalThumbnails > 0) {
        interval = (duration * 1000) / sb.totalThumbnails;
      }
      if (interval <= 0) return null;
      const frameIdx = Math.max(0, Math.floor((time * 1000) / interval));
      const sheet = Math.min(Math.floor(frameIdx / sb.count), Math.max(0, sb.sheets - 1));
      const local = frameIdx % sb.count;
      const col = local % sb.cols;
      const row = Math.floor(local / sb.cols);
      return {
        url: storyboardUrl(sb, sheet),
        x: col * sb.w,
        y: row * sb.h,
        w: sb.w,
        h: sb.h,
        cols: sb.cols,
        rows: sb.rows
      };
    }

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

    /* =======================================================
       Bridge communication — talk to page-context bridge.js
       via postMessage to access YouTube's internal player API
       ======================================================= */
    let bridgeMsgId = 0;
    const bridgeCallbacks = new Map();

    /* Resolves when the bridge module finishes loading (ytp-skin-bridge-ready) */
    let _bridgeReadyResolve;
    const bridgeReady = new Promise(res => { _bridgeReadyResolve = res; });

    window.addEventListener('message', (e) => {
      if (e.source !== window) return;
      if (e.data?.source === 'ytp-skin-bridge-ready') { _bridgeReadyResolve(); return; }
      if (!e.data || e.data.source !== 'ytp-skin-response') return;
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
        window.postMessage({ source: 'ytp-skin-request', action, payload, id }, '*');
        /* timeout safety */
        setTimeout(() => {
          if (bridgeCallbacks.has(id)) {
            bridgeCallbacks.delete(id);
            resolve(null);
          }
        }, 2000);
      }));
    }

    /* ---- CC / Subtitles menu ---- */
    const QUALITY_LABELS = {
      highres: '4320p (8K)',
      hd2160: '2160p (4K)',
      hd1440: '1440p',
      hd1080: '1080p',
      hd720: '720p',
      large: '480p',
      medium: '360p',
      small: '240p',
      tiny: '144p',
      auto: 'Auto',
    };

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
    const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

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
    const SKIP_SECONDS = 10;

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
      if (inPip) {
        ui.btnMini.innerHTML = ICONS.pipActive;
        ui.btnMini.classList.add('ytp-skin-pip-active');
        ui.btnMini.title = 'Exit Picture-in-Picture';
      } else {
        ui.btnMini.innerHTML = ICONS.pip;
        ui.btnMini.classList.remove('ytp-skin-pip-active');
        ui.btnMini.title = 'Picture-in-Picture';
      }
    }

    async function openDocumentPip() {
      /* Document PiP API available? */
      if (!('documentPictureInPicture' in window)) {
        /* Fallback to basic video PiP */
        if (video && typeof video.requestPictureInPicture === 'function') {
          await video.requestPictureInPicture();
        }
        return;
      }

      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: Math.min(640, Math.round(screen.width * 0.35)),
        height: Math.min(360, Math.round(screen.height * 0.35)),
      });
      pipWindow = pipWin;

      /* Inject styles from pip.css */
      const link = pipWin.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('content/pip.css');
      pipWin.document.head.appendChild(link);

      /* Set font */
      pipWin.document.body.style.fontFamily = "'Segoe UI', Roboto, Arial, sans-serif";

      /* Move video into the PiP window */
      const videoParent = video.parentElement;
      const videoNext = video.nextSibling;

      /* Save YouTube's inline styles so we can restore them later */
      const savedVideoStyle = video.getAttribute('style') || '';

      pipWin.document.body.appendChild(video);

      /* Reset inline styles YouTube puts on the video (explicit width/height/top/left)
         so our PiP CSS (object-fit: contain) can work properly */
      video.style.cssText = 'width:100%;height:100%;position:static;top:auto;left:auto;object-fit:contain;background:#000;';

      /* Create overlay controls */
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

      /* Control buttons */
      const ctrlRow = pipWin.document.createElement('div');
      ctrlRow.className = 'pip-controls';

      const mkBtn = (cls, svg, title) => {
        const b = pipWin.document.createElement('button');
        b.className = 'pip-btn ' + cls;
        b.innerHTML = svg;
        b.title = title;
        return b;
      };

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

      const pipBtnPrev = mkBtn('', ICONS.replay10, 'Back 10s');
      const pipBtnPlay = mkBtn('pip-btn-play' + (video.paused ? '' : ' playing'),
        video.paused ? ICONS.play : ICONS.pause, video.paused ? 'Play' : 'Pause');
      const pipBtnNext = mkBtn('', ICONS.forward10, 'Forward 10s');

      /* CC badge + menu for PiP */
      const pipCCWrap = pipWin.document.createElement('div');
      pipCCWrap.className = 'pip-menu-wrap';
      const pipCCBadge = pipWin.document.createElement('span');
      pipCCBadge.className = 'pip-badge';
      pipCCBadge.textContent = 'CC';
      pipCCBadge.title = 'Subtitles';
      const pipCCMenu = pipWin.document.createElement('div');
      pipCCMenu.className = 'pip-menu';
      pipCCWrap.append(pipCCBadge, pipCCMenu);

      /* Quality badge + menu for PiP */
      const pipHDWrap = pipWin.document.createElement('div');
      pipHDWrap.className = 'pip-menu-wrap';
      const pipHDBadge = pipWin.document.createElement('span');
      pipHDBadge.className = 'pip-badge';
      pipHDBadge.innerHTML = 'HD';
      pipHDBadge.title = 'Quality';
      const pipHDMenu = pipWin.document.createElement('div');
      pipHDMenu.className = 'pip-menu';
      pipHDWrap.append(pipHDBadge, pipHDMenu);

      /* Speed badge + menu for PiP */
      const pipSpeedWrap = pipWin.document.createElement('div');
      pipSpeedWrap.className = 'pip-menu-wrap';
      const pipSpeedBadge = pipWin.document.createElement('span');
      pipSpeedBadge.className = 'pip-badge';
      pipSpeedBadge.textContent = (video.playbackRate || 1) === 1 ? '1x' : video.playbackRate + 'x';
      pipSpeedBadge.title = 'Speed';
      const pipSpeedMenu = pipWin.document.createElement('div');
      pipSpeedMenu.className = 'pip-menu';
      pipSpeedWrap.append(pipSpeedBadge, pipSpeedMenu);

      /* Chapters button + menu for PiP */
      const pipChapWrap = pipWin.document.createElement('div');
      pipChapWrap.className = 'pip-menu-wrap';
      const pipChapBtn = pipWin.document.createElement('button');
      pipChapBtn.className = 'pip-btn-chap';
      pipChapBtn.innerHTML = ICONS.chapters;
      pipChapBtn.title = 'Chapters';
      const pipChapMenu = pipWin.document.createElement('div');
      pipChapMenu.className = 'pip-menu';
      pipChapWrap.append(pipChapBtn, pipChapMenu);

      /* Hide chapters button if no chapters */
      if (cachedChapters.length === 0) pipChapWrap.style.display = 'none';

      /* All controls in one row */
      ctrlRow.append(pipVolWrap, pipCCWrap, pipHDWrap, pipSpeedWrap, pipBtnPrev, pipBtnPlay, pipBtnNext, pipChapWrap);

      /* Progress / seek */
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

      /* --- Wire up PiP controls --- */

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
      pipBtnPrev.addEventListener('click', () => {
        video.currentTime = Math.max(0, video.currentTime - SKIP_SECONDS);
      });
      pipBtnNext.addEventListener('click', () => {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + SKIP_SECONDS);
      });

      /* Volume */
      pipBtnVol.addEventListener('click', () => {
        video.muted = !video.muted;
      });
      const syncPipVol = () => {
        pipBtnVol.innerHTML = volIcon(video.volume, video.muted);
        const vp = video.muted ? 0 : video.volume * 100;
        pipVolFill.style.width = vp + '%';
        pipVolThumb.style.left = vp + '%';
      };
      video.addEventListener('volumechange', syncPipVol);
      syncPipVol();

      /* Volume slider drag */
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
        const onU = () => { pipWin.document.removeEventListener('mousemove', onM); pipWin.document.removeEventListener('mouseup', onU); };
        pipWin.document.addEventListener('mousemove', onM);
        pipWin.document.addEventListener('mouseup', onU);
      });

      /* Seek progress update */
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

      /* Seek drag */
      attachSeekDrag(
        pSeek, pTrack, pFill, pThumb, pipWin.document, video,
        () => { pipSeeking = true; }, () => { pipSeeking = false; }
      );

      /* Click video to toggle play */
      video.addEventListener('click', () => {
        if (video.paused) video.play(); else video.pause();
      });

      /* ---- PiP menu helpers ---- */
      function closePipMenus() {
        pipCCMenu.classList.remove('visible');
        pipHDMenu.classList.remove('visible');
        pipSpeedMenu.classList.remove('visible');
        pipChapMenu.classList.remove('visible');
      }

      /* PiP CC menu */
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

      /* PiP Quality menu */
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

      /* PiP Chapters menu */
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
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            video.currentTime = ch.startTime;
            closePipMenus();
          });
          pipChapMenu.append(item);
        });
      }

      pipChapBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = pipChapMenu.classList.contains('visible');
        closePipMenus();
        if (!isOpen) { buildPipChaptersMenu(); pipChapMenu.classList.add('visible'); }
      });

      /* PiP Speed menu */
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
            if (spd !== 1) pipSpeedBadge.classList.add('active');
            else pipSpeedBadge.classList.remove('active');
            syncSpeedBadge();
            closePipMenus();
          });
          pipSpeedMenu.append(item);
        });

        /* Custom speed input for PiP */
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
          if (val !== 1) pipSpeedBadge.classList.add('active');
          else pipSpeedBadge.classList.remove('active');
          syncSpeedBadge();
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

      /* Close PiP menus when clicking elsewhere */
      pipWin.document.body.addEventListener('click', () => closePipMenus());

      /* ---- PiP seek bar chapter markers ---- */
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

      /* Double-click to exit PiP */
      video.addEventListener('dblclick', () => closePip());

      /* Close button */
      closeBtn.addEventListener('click', () => closePip());

      /* Keyboard shortcuts in PiP */
      pipWin.document.addEventListener('keydown', (e) => {
        switch (e.key) {
          case ' ':
          case 'k':
            e.preventDefault();
            if (video.paused) video.play(); else video.pause();
            break;
          case 'ArrowLeft':
          case 'j':
            e.preventDefault();
            video.currentTime = Math.max(0, video.currentTime - SKIP_SECONDS);
            break;
          case 'ArrowRight':
          case 'l':
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

      /* Cleanup function */
      function closePip() {
        try {
          /* Move video back to the original player */
          video.removeEventListener('play', syncPipPlay);
          video.removeEventListener('pause', syncPipPlay);
          video.removeEventListener('volumechange', syncPipVol);
          video.removeEventListener('timeupdate', syncPipProgress);
          if (videoNext) {
            videoParent.insertBefore(video, videoNext);
          } else {
            videoParent.appendChild(video);
          }
          /* Restore YouTube's original inline styles */
          video.setAttribute('style', savedVideoStyle);
          pipWindow = null;
          syncPipBtn();
          syncPlayBtn();
          syncVolBtn();
          updateProgress();
          pipWin.close();
        } catch (_) {}
      }

      pipCleanup = closePip;

      /* Handle PiP window being closed by the user (clicking X) */
      pipWin.addEventListener('pagehide', () => {
        try {
          if (videoParent && !videoParent.contains(video)) {
            if (videoNext) {
              videoParent.insertBefore(video, videoNext);
            } else {
              videoParent.appendChild(video);
            }
          }
          /* Restore YouTube's original inline styles */
          video.setAttribute('style', savedVideoStyle);
          pipWindow = null;
          syncPipBtn();
          syncPlayBtn();
          syncVolBtn();
          updateProgress();
        } catch (_) {}
      });

      syncPipBtn();
      showOverlay();
    }

    /* Fallback PiP for browsers without Document PiP */
    async function openBasicPip() {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (video && typeof video.requestPictureInPicture === 'function') {
          await video.requestPictureInPicture();
        }
      } catch (err) {
        const mb = qs('.ytp-miniplayer-button', player);
        if (mb) mb.click();
      }
    }

    ui.btnMini.addEventListener('click', async () => {
      if (pipWindow) {
        /* Close existing PiP */
        if (pipCleanup) pipCleanup();
        return;
      }
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        syncPipBtn();
        return;
      }
      try {
        await openDocumentPip();
      } catch (_) {
        await openBasicPip();
      }
    });

    video.addEventListener('enterpictureinpicture', syncPipBtn);
    video.addEventListener('leavepictureinpicture', syncPipBtn);
    syncPipBtn();

    /* ---- Media Session API — adds skip controls in PiP overlay ---- */
    function setupMediaSession() {
      if (!('mediaSession' in navigator)) return;

      /* Update metadata for the PiP window */
      function updateMediaMeta() {
        try {
          const title = ui.titleEl.textContent || 'YouTube Video';
          const artist = ui.channelEl.textContent || '';

          /* Try to grab the video thumbnail */
          const videoId = new URLSearchParams(window.location.search).get('v');
          const artwork = videoId ? [
            { src: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' },
            { src: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' },
          ] : [];

          navigator.mediaSession.metadata = new MediaMetadata({
            title,
            artist,
            artwork,
          });
        } catch (_) {}
      }

      /* Update position state for the PiP seek bar */
      function updatePositionState() {
        try {
          if (navigator.mediaSession.setPositionState && video.duration && isFinite(video.duration)) {
            navigator.mediaSession.setPositionState({
              duration: video.duration,
              playbackRate: video.playbackRate || 1,
              position: Math.min(video.currentTime, video.duration),
            });
          }
        } catch (_) {}
      }

      /* Action handlers — these show as buttons in the PiP window */
      navigator.mediaSession.setActionHandler('play', () => video.play());
      navigator.mediaSession.setActionHandler('pause', () => video.pause());
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        video.currentTime = Math.max(0, video.currentTime - (details.seekOffset || SKIP_SECONDS));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + (details.seekOffset || SKIP_SECONDS));
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) {
          video.currentTime = details.seekTime;
        }
      });

      /* Try to add previous/next track handlers (for playlists) */
      try {
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          const prevBtn = qs('.ytp-prev-button', player);
          if (prevBtn && !prevBtn.disabled) prevBtn.click();
        });
      } catch (_) {}

      try {
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          const nextBtn = qs('.ytp-next-button', player);
          if (nextBtn && !nextBtn.disabled) nextBtn.click();
        });
      } catch (_) {}

      updateMediaMeta();
      updatePositionState();

      /* Keep position state updated */
      video.addEventListener('timeupdate', updatePositionState);
      video.addEventListener('loadeddata', () => {
        updateMediaMeta();
        updatePositionState();
      });
      video.addEventListener('ratechange', updatePositionState);

      /* Also update metadata when title changes */
      const origUpdateMeta = updateMeta;
      /* Override the metadata updater to also push to media session */
      const metaSessionInterval = setInterval(() => {
        updateMediaMeta();
      }, 5000);

      /* Clean up when player is removed */
      const origObserverCb = observer;
      video.addEventListener('emptied', () => clearInterval(metaSessionInterval));
    }

    setupMediaSession();

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

  /* Inject bridge script into page context (MAIN WORLD) */
  function injectBridge() {
    if (document.getElementById('ytp-skin-bridge')) return;
    const s = document.createElement('script');
    s.id = 'ytp-skin-bridge';
    s.type = 'module';
    s.src = chrome.runtime.getURL('content/bridge.js');
    (document.head || document.documentElement).appendChild(s);
  }
  injectBridge();

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
      if (!player) return;
      if (msg.enabled) {
        player.classList.remove('ytp-skin-disabled');
      } else {
        player.classList.add('ytp-skin-disabled');
      }
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
