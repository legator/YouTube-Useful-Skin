export function setVolume(ytP, payload, reply) {
  try {
    if (ytP) {
      /* setVolume expects 0–100 */
      if (typeof ytP.setVolume === 'function') {
        ytP.setVolume(Math.round(payload.volume * 100));
      }
      if (payload.muted === true && typeof ytP.mute === 'function') {
        ytP.mute();
      } else if (payload.muted === false && typeof ytP.unMute === 'function') {
        ytP.unMute();
      }
    }
  } catch (_) {}
  reply({});
}
