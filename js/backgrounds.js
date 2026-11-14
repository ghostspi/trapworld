/* TRAP WORLD — procedural parallax backgrounds + theme palettes */
import { seededRandom } from './utilities.js';

export const THEMES = {
  forest: {
    skyTop: '#04070f', skyMid: '#0b1428', skyBottom: '#16233f',
    star: '#cfe4ff', moon: '#e8f0ff',
    far: '#101c33', mid: '#0a1424', near: '#060b16',
    accent: '#6df2ff', accent2: '#5ef2a0',
    groundTop: '#3e7a52', groundTopDark: '#2b5a3c',
    groundBody: '#18202e', groundBody2: '#111925',
    platformTop: '#7d94b8', platformBody: '#33415c',
  },
  castle: {
    skyTop: '#06040f', skyMid: '#140c26', skyBottom: '#231a3d',
    star: '#d8c8ff', moon: '#f0e6ff',
    far: '#1a1230', mid: '#100a20', near: '#080414',
    accent: '#c07bff', accent2: '#ff5c8a',
    groundTop: '#5a4a6e', groundTopDark: '#3c3149',
    groundBody: '#1d1729', groundBody2: '#151020',
    platformTop: '#8a74b0', platformBody: '#382c4e',
  },
  lava: {
    skyTop: '#12030a', skyMid: '#2b0710', skyBottom: '#4a120f',
    star: '#ff9a6b', moon: '#ffb27a',
    far: '#3a0f14', mid: '#240810', near: '#140409',
    accent: '#ff8a3d', accent2: '#ffd166',
    groundTop: '#5a2a24', groundTopDark: '#3a1a17',
    groundBody: '#1e1014', groundBody2: '#150b0e',
    platformTop: '#8a4a3a', platformBody: '#3a1f1c',
  },
  factory: {
    skyTop: '#04090c', skyMid: '#0a1a22', skyBottom: '#122a33',
    star: '#8fe6ff', moon: '#b8f4ff',
    far: '#0e2430', mid: '#081720', near: '#040c12',
    accent: '#6df2ff', accent2: '#ffd166',
    groundTop: '#4a5f6e', groundTopDark: '#33434f',
    groundBody: '#141d24', groundBody2: '#0d141a',
    platformTop: '#7f9aab', platformBody: '#2c3a45',
  },
  nightmare: {
    skyTop: '#08030f', skyMid: '#150826', skyBottom: '#241040',
    star: '#ff9bd6', moon: '#ffd0f0',
    far: '#1d0c33', mid: '#120722', near: '#08030f',
    accent: '#ff5c8a', accent2: '#c07bff',
    groundTop: '#5a2c5e', groundTopDark: '#3a1c40',
    groundBody: '#1a0f24', groundBody2: '#120a1a',
    platformTop: '#8c5aa0', platformBody: '#3a2246',
  },
};

const starCache = new Map();

function getStars(themeName) {
  if (starCache.has(themeName)) return starCache.get(themeName);
  const rnd = seededRandom(themeName.charCodeAt(0) * 7919 + themeName.length * 104729);
  const stars = [];
  for (let i = 0; i < 90; i++) {
    stars.push({
      x: rnd() * 480,
      y: rnd() * 190,
      r: rnd() < 0.85 ? 1 : 2,
      p: 0.15 + rnd() * 0.6,
      tw: rnd() * Math.PI * 2,
    });
  }
  starCache.set(themeName, stars);
  return stars;
}

const gradCache = new Map();

function getSkyGradient(ctx, themeName, t, vh) {
  const key = themeName + '_' + vh;
  if (gradCache.has(key)) return gradCache.get(key);
  const g = ctx.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, t.skyTop);
  g.addColorStop(0.55, t.skyMid);
  g.addColorStop(1, t.skyBottom);
  gradCache.set(key, g);
  return g;
}

function drawRidge(ctx, offset, vw, vh, baseY, amp, color, freq) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, vh);
  for (let x = 0; x <= vw; x += 6) {
    const wx = x + offset;
    const y = baseY
      + Math.sin(wx * freq) * amp
      + Math.sin(wx * freq * 2.37 + 1.7) * amp * 0.45
      + Math.sin(wx * freq * 0.53 + 4.1) * amp * 0.7;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(vw, vh);
  ctx.closePath();
  ctx.fill();
}

function drawTrees(ctx, offset, vw, vh, baseY, color, scale, step) {
  ctx.fillStyle = color;
  const start = Math.floor(offset / step) * step;
  for (let i = -1; i < vw / step + 2; i++) {
    const wx = start + i * step;
    const sx = wx - offset;
    if (sx < -60 || sx > vw + 60) continue;
    const h = (36 + ((i * 37) % 26)) * scale;
    const w = (10 + ((i * 17) % 6)) * scale;
    ctx.beginPath();
    ctx.moveTo(sx, baseY);
    ctx.lineTo(sx - w, baseY);
    ctx.lineTo(sx, baseY - h);
    ctx.lineTo(sx + w, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(sx - 1 * scale, baseY, 2 * scale, 8 * scale);
  }
}

export function drawBackground(ctx, themeName, cam, time, vw, vh) {
  const t = THEMES[themeName] || THEMES.forest;

  // sky
  ctx.fillStyle = getSkyGradient(ctx, themeName, t, vh);
  ctx.fillRect(0, 0, vw, vh);

  // stars (parallax 0.05)
  const stars = getStars(themeName);
  const sx = (cam.x * 0.05) % vw;
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    let x = s.x - sx;
    if (x < 0) x += vw;
    const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(time * 1.4 + s.tw));
    ctx.globalAlpha = twinkle * 0.9;
    ctx.fillStyle = t.star;
    ctx.fillRect(Math.round(x), Math.round(s.y - cam.y * 0.02), s.r, s.r);
  }
  ctx.globalAlpha = 1;

  // moon
  const moonX = vw * 0.78 - (cam.x * 0.02) % (vw * 1.4);
  const moonY = 46 - cam.y * 0.03;
  const glow = ctx.createRadialGradient(moonX, moonY, 2, moonX, moonY, 46);
  glow.addColorStop(0, 'rgba(255,255,255,0.30)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(moonX - 50, moonY - 50, 100, 100);
  ctx.fillStyle = t.moon;
  ctx.beginPath();
  ctx.arc(moonX, moonY, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.beginPath();
  ctx.arc(moonX - 5, moonY - 4, 4, 0, Math.PI * 2);
  ctx.arc(moonX + 6, moonY + 3, 3, 0, Math.PI * 2);
  ctx.fill();

  // far ridge
  drawRidge(ctx, cam.x * 0.12, vw, vh, vh * 0.62, 22, t.far, 0.0045);

  // theme-specific mid layer
  if (themeName === 'forest') {
    drawTrees(ctx, cam.x * 0.30, vw, vh, vh * 0.80, t.mid, 1.0, 54);
    drawTrees(ctx, cam.x * 0.46, vw, vh, vh * 0.90, t.near, 0.72, 38);
  } else if (themeName === 'castle') {
    // towers
    const off = cam.x * 0.30;
    ctx.fillStyle = t.mid;
    for (let i = 0; i < 10; i++) {
      const bx = ((i * 130 - off) % (vw + 260)) - 130;
      const h = 60 + ((i * 53) % 50);
      ctx.fillRect(bx, vh * 0.86 - h, 26, h + 40);
      ctx.beginPath();
      ctx.moveTo(bx - 4, vh * 0.86 - h);
      ctx.lineTo(bx + 13, vh * 0.86 - h - 22);
      ctx.lineTo(bx + 30, vh * 0.86 - h);
      ctx.closePath();
      ctx.fill();
    }
  } else if (themeName === 'lava') {
    const off = cam.x * 0.28;
    drawRidge(ctx, off, vw, vh, vh * 0.78, 16, t.mid, 0.008);
    ctx.globalAlpha = 0.30 + Math.sin(time * 1.6) * 0.06;
    ctx.fillStyle = t.accent;
    ctx.fillRect(0, vh * 0.92, vw, vh * 0.08);
    ctx.globalAlpha = 1;
  } else if (themeName === 'factory') {
    const off = cam.x * 0.28;
    ctx.fillStyle = t.mid;
    for (let i = 0; i < 14; i++) {
      const bx = ((i * 96 - off) % (vw + 200)) - 100;
      const h = 40 + ((i * 31) % 60);
      ctx.fillRect(bx, vh * 0.88 - h, 34, h + 40);
      ctx.fillStyle = 'rgba(109,242,255,0.25)';
      for (let k = 0; k < 3; k++) ctx.fillRect(bx + 6, vh * 0.88 - h + 10 + k * 14, 6, 5);
      ctx.fillStyle = t.mid;
    }
  } else if (themeName === 'nightmare') {
    drawRidge(ctx, cam.x * 0.22, vw, vh, vh * 0.70, 30, t.mid, 0.006);
    // floating shards
    ctx.fillStyle = 'rgba(192,123,255,0.20)';
    for (let i = 0; i < 12; i++) {
      const px = ((i * 97 + time * 6 - cam.x * 0.35) % (vw + 80)) - 40;
      const py = 40 + ((i * 61 + time * 11) % (vh - 90));
      ctx.fillRect(Math.round(px), Math.round(py), 3, 8);
    }
  }

  // near silhouette
  drawRidge(ctx, cam.x * 0.55, vw, vh, vh * 0.98, 10, t.near, 0.010);

  // atmospheric haze
  const haze = ctx.createLinearGradient(0, vh * 0.4, 0, vh);
  haze.addColorStop(0, 'rgba(0,0,0,0)');
  haze.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, vh * 0.4, vw, vh * 0.6);
}
