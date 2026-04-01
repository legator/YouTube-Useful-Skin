/**
 * Parses a YouTube storyboard spec string into a usable descriptor object.
 * Spec format: baseUrl|L0params|L1params|...
 * Each level params: width#height#count#sheets#interval#namePattern#sigh
 */
export function parseStoryboardSpec(spec) {
  if (!spec) return null;
  const parts = spec.split('|');
  if (parts.length < 2) return null;
  const baseUrl = parts[0].replace(/&amp;/g, '&').replace(/\\u0026/g, '&');

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

  /* Prefer the largest resolution level that has the $M sheet pattern;
     fall back to the largest overall if none have $M. */
  let best = null;
  for (const lv of levels) {
    const hasSheetPattern = lv.namePattern && lv.namePattern.includes('$M');
    const bestHasPattern = best && best.namePattern && best.namePattern.includes('$M');
    if (!best) { best = lv; continue; }
    if (hasSheetPattern && !bestHasPattern) { best = lv; continue; }
    if (!hasSheetPattern && bestHasPattern) continue;
    if (lv.w * lv.h > best.w * best.h) { best = lv; }
  }
  best.baseUrl = baseUrl;
  best.level = best.levelIdx;
  return best;
}

/** Builds the URL for a specific storyboard sheet index. */
export function storyboardUrl(sb, sheetIdx) {
  let url = sb.baseUrl;
  url = url.replace(/\$L/g, String(sb.level));
  if (sb.namePattern && sb.namePattern.includes('$M')) {
    const name = sb.namePattern.replace(/\$M/g, String(sheetIdx));
    url = url.replace(/\$N/g, name);
  } else {
    url = url.replace(/\$N/g, sb.sheets > 1 ? 'M' + sheetIdx : (sb.namePattern || 'M' + sheetIdx));
  }
  if (sb.sigh) {
    url = url.replace(/[&?]sigh=[^&]*/, '');
    url += (url.includes('?') ? '&' : '?') + 'sigh=' + sb.sigh;
  }
  return url;
}

/** Returns the sprite frame descriptor for a given playback time. */
export function storyboardFrame(sb, time, duration) {
  if (!sb) return null;
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
    rows: sb.rows,
  };
}
