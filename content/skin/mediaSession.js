/**
 * Sets up the Media Session API for native OS/browser transport controls.
 *
 * @param {object} ctx
 * @param {HTMLVideoElement} ctx.video
 * @param {HTMLElement}      ctx.player   - .html5-video-player element
 * @param {object}           ctx.ui       - skin UI refs
 * @param {number}           ctx.SKIP_SECONDS
 * @param {Function}         ctx.updateMeta - called to refresh Media Session metadata
 */
export function setupMediaSession({ video, player, ui, SKIP_SECONDS, updateMeta }) {
  if (!('mediaSession' in navigator)) return;

  function updateMediaMeta() {
    try {
      const title = ui.titleEl.textContent || 'YouTube Video';
      const artist = ui.channelEl.textContent || '';
      const videoId = new URLSearchParams(window.location.search).get('v');
      const artwork = videoId ? [
        { src: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' },
        { src: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' },
      ] : [];
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist, artwork });
    } catch (_) {}
  }

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

  navigator.mediaSession.setActionHandler('play', () => video.play());
  navigator.mediaSession.setActionHandler('pause', () => video.pause());
  navigator.mediaSession.setActionHandler('seekbackward', (details) => {
    video.currentTime = Math.max(0, video.currentTime - (details.seekOffset || SKIP_SECONDS));
  });
  navigator.mediaSession.setActionHandler('seekforward', (details) => {
    video.currentTime = Math.min(video.duration || 0, video.currentTime + (details.seekOffset || SKIP_SECONDS));
  });
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime != null) video.currentTime = details.seekTime;
  });

  try {
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      const prevBtn = player.querySelector('.ytp-prev-button');
      if (prevBtn && !prevBtn.disabled) prevBtn.click();
    });
  } catch (_) {}

  try {
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      const nextBtn = player.querySelector('.ytp-next-button');
      if (nextBtn && !nextBtn.disabled) nextBtn.click();
    });
  } catch (_) {}

  updateMediaMeta();
  updatePositionState();

  video.addEventListener('timeupdate', updatePositionState);
  video.addEventListener('loadeddata', () => { updateMediaMeta(); updatePositionState(); });
  video.addEventListener('ratechange', updatePositionState);

  const metaSessionInterval = setInterval(updateMediaMeta, 5000);
  video.addEventListener('emptied', () => clearInterval(metaSessionInterval));
}
