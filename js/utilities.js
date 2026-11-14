/* TRAP WORLD — small helper utilities */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const lerp = (a, b, t) => a + (b - a) * t;

export function approach(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return current;
}

export function rand(min, max) { return min + Math.random() * (max - min); }

export function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function makeRect(x, y, w, h) { return { x, y, w, h }; }

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInQuad = (t) => t * t;

/** Deterministic pseudo-random generator (for stars, textures etc.) */
export function seededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function formatTime(seconds) {
  if (seconds < 60) return seconds.toFixed(1) + 's';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
