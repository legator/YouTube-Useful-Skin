import { ce, fmtTime } from './utils.js';
import { ICONS } from './icons.js';
import { HD_QUALITIES, QUALITY_LABELS } from './constants.js';

/** Builds and returns the complete skin DOM overlay. */
export function buildSkin() {
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
  const chapMenuHeader = ce('div', 'ytp-skin-menu-header');
  const chapMenuTitle = ce('div', 'ytp-skin-menu-title', 'Chapters');
  const btnChapPin = ce('button', 'ytp-skin-chap-pin', '📌');
  btnChapPin.title = 'Pin chapters panel';
  chapMenuHeader.append(chapMenuTitle, btnChapPin);
  const chapMenuList = ce('div', 'ytp-skin-menu-list');
  chapMenu.append(chapMenuHeader, chapMenuList);
  chapWrap.append(btnChapters, chapMenu);

  const btnChapPrev = ce('button', 'ytp-skin-btn ytp-skin-btn-skip ytp-skin-btn-chap-prev', ICONS.chapPrev);
  btnChapPrev.title = 'Previous chapter';

  const btnSkipBack = ce('button', 'ytp-skin-btn ytp-skin-btn-skip', ICONS.replay10);
  btnSkipBack.title = 'Back 10s';

  const btnPlay = ce('button', 'ytp-skin-btn ytp-skin-btn-play paused', ICONS.play);
  btnPlay.title = 'Play';

  const btnSkipFwd = ce('button', 'ytp-skin-btn ytp-skin-btn-skip', ICONS.forward10);
  btnSkipFwd.title = 'Forward 10s';

  const btnChapNext = ce('button', 'ytp-skin-btn ytp-skin-btn-skip ytp-skin-btn-chap-next', ICONS.chapNext);
  btnChapNext.title = 'Next chapter';

  const btnTheater = ce('button', 'ytp-skin-btn ytp-skin-btn-square', ICONS.theaterMode);
  btnTheater.title = 'Theater mode';

  const btnMini = ce('button', 'ytp-skin-btn ytp-skin-btn-square', ICONS.pip);
  btnMini.title = 'Picture-in-Picture';

  const btnFS = ce('button', 'ytp-skin-btn ytp-skin-btn-square', ICONS.fullscreen);
  btnFS.title = 'Full screen';

  controls.append(volWrap, ccWrap, hdWrap, speedWrap, chapWrap, btnChapPrev, btnSkipBack, btnPlay, btnSkipFwd, btnChapNext, btnTheater, btnMini, btnFS);

  /* seek / progress row */
  const progressWrap = ce('div', 'ytp-skin-progress-wrap');
  const chapNameEl = ce('div', 'ytp-skin-chap-name');
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
  bottomBar.append(controls, chapNameEl, progressWrap);

  return {
    topBar, bottomBar,
    titleEl, channelEl, viewsEl,
    btnVol, volPopup, volSliderTrack, volSliderFill, volSliderThumb, volLabel, volWrap,
    badgeCC, ccMenu, ccMenuList,
    badgeHD, hdMenu, hdMenuList,
    badgeSpeed, speedMenu, speedMenuList,
    btnChapters, chapMenu, chapMenuList, chapMenuHeader, btnChapPin, chapWrap,
    btnChapPrev, btnChapNext, chapNameEl,
    btnSkipBack, btnPlay, btnSkipFwd,
    btnTheater, btnMini, btnFS,
    timeLeft, timeRight,
    seekArea, seekTrack, seekBuffer, seekFill, seekThumb, seekTooltip,
    seekPreview, seekPreviewImg,
  };
}

/**
 * Attaches unified seek bar drag behaviour.
 * @param {HTMLElement} areaEl   - clickable seek area
 * @param {HTMLElement} trackEl  - track used for getBoundingClientRect
 * @param {HTMLElement} fillEl   - fill bar element
 * @param {HTMLElement} thumbEl  - thumb element
 * @param {Document}   docRef   - document to attach mousemove/mouseup to (may be PiP doc)
 * @param {HTMLVideoElement} video
 * @param {Function}   onStart  - called when drag begins
 * @param {Function}   onEnd    - called when drag ends
 * @param {HTMLElement} [tooltipEl] - optional tooltip element
 */
export function attachSeekDrag(areaEl, trackEl, fillEl, thumbEl, docRef, video, onStart, onEnd, tooltipEl) {
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
    let dragPct = p0;
    const onMove = (ev) => {
      const p = pctFrom(ev);
      dragPct = p;
      fillEl.style.width = (p * 100) + '%';
      thumbEl.style.left = (p * 100) + '%';
      if (tooltipEl) {
        tooltipEl.textContent = fmtTime(p * (video.duration || 0));
        tooltipEl.style.left = (p * 100) + '%';
      }
    };
    const onUp = () => {
      video.currentTime = dragPct * (video.duration || 0);
      onEnd();
      docRef.removeEventListener('mousemove', onMove);
      docRef.removeEventListener('mouseup', onUp);
    };
    docRef.addEventListener('mousemove', onMove);
    docRef.addEventListener('mouseup', onUp);
  });
}

/**
 * Renders CC/subtitle menu items into a container element.
 */
export function renderCCItems(containerEl, doc, itemCls, checkCls, tracks, current, onOff, onSelect) {
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
    const checkSpan = doc.createElement('span');
    checkSpan.className = checkCls;
    checkSpan.innerHTML = ICONS.check;
    const labelSpan = doc.createElement('span');
    labelSpan.textContent = t.displayName || t.languageName || t.languageCode || 'Unknown';
    item.append(checkSpan, labelSpan);
    item.addEventListener('click', (e) => { e.stopPropagation(); onSelect(t); });
    containerEl.append(item);
  });
}

/**
 * Renders quality menu items into a container element.
 */
export function renderQualityItems(containerEl, doc, itemCls, checkCls, hdTagCls, levels, current, qualityData, onSelect) {
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
