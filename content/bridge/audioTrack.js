const KIND_MAP = {
  original: 'Original',
  descriptive: 'Audio Description',
  dubbed: 'Dubbed',
  secondary: 'Secondary',
};

function readVarint(bin, pos) {
  let v = 0, shift = 0;
  while (pos < bin.length) {
    const b = bin.charCodeAt(pos++);
    v |= (b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7;
  }
  return [v, pos];
}

/* Decode the base64-protobuf vssId to extract kind ("original", "descriptive") and lang ("en") */
function parseVssId(vssId) {
  if (!vssId || typeof vssId !== 'string') return null;
  const b64 = vssId.split(';').pop();
  if (!b64 || b64.length < 4) return null;
  try {
    const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    let kind = '', lang = '';
    let i = 0;
    while (i < bin.length) {
      let tag, fLen;
      [tag, i] = readVarint(bin, i);
      if ((tag & 7) !== 2) break;
      [fLen, i] = readVarint(bin, i);
      const chunk = bin.slice(i, i + fLen);
      i += fLen;
      let key = '', val = '';
      let j = 0;
      while (j < chunk.length) {
        let t2, l2;
        [t2, j] = readVarint(chunk, j);
        if ((t2 & 7) !== 2) break;
        [l2, j] = readVarint(chunk, j);
        const s = chunk.slice(j, j + l2);
        j += l2;
        if ((t2 >> 3) === 1) key = s;
        else if ((t2 >> 3) === 2) val = s;
      }
      if (key === 'lang') lang = val.toUpperCase();
      else if (val) kind = KIND_MAP[val] || (val.charAt(0).toUpperCase() + val.slice(1));
    }
    if (kind || lang) return kind && lang ? `${kind} (${lang})` : (kind || lang);
  } catch (_) {}
  return null;
}

function normalizeTrack(t) {
  const rawName = t.display_name || t.displayName || t.label
    || t.name?.simpleText
    || t.name?.runs?.map(r => r.text).join('')
    || (typeof t.name === 'string' ? t.name : null);

  const id = t.id ?? t.vss_id ?? t.language_code ?? t.languageCode ?? '';
  const displayName = rawName || parseVssId(id) || t.language_code || t.languageCode || id || '';

  return {
    id,
    displayName,
    languageCode: t.language_code ?? t.languageCode ?? '',
    isDefault: t.isDefault ?? t.audioIsDefault ?? false,
    _raw: t,
  };
}

export function getAudioTracks(ytP, payload, reply) {
  if (!ytP) { reply({ tracks: [], current: null }); return; }
  let tracks = [];
  let current = null;

  try {
    if (typeof ytP.getAvailableAudioTracks === 'function') {
      tracks = (ytP.getAvailableAudioTracks() || []).map(normalizeTrack);
    }
  } catch (_) {}

  try {
    if (typeof ytP.getAudioTrack === 'function') {
      const raw = ytP.getAudioTrack();
      if (raw) current = normalizeTrack(raw);
    }
  } catch (_) {}

  reply({ tracks, current });
}

export function setAudioTrack(ytP, payload, reply) {
  if (!ytP) { reply({ ok: false }); return; }
  const track = payload.track?._raw ?? payload.track;
  if (!track) { reply({ ok: false }); return; }

  try {
    if (typeof ytP.setAudioTrack === 'function') {
      ytP.setAudioTrack(track);
      reply({ ok: true });
    } else {
      reply({ ok: false });
    }
  } catch (err) {
    console.warn('[YTP-Skin] setAudioTrack failed:', err);
    reply({ ok: false });
  }
}
