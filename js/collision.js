/* TRAP WORLD — axis-aligned collision resolution */
import { rectsOverlap } from './utilities.js';

/**
 * Moves a body ({x,y,w,h,vx,vy}) through a list of solid rectangles.
 * Resolves X first, then Y (classic AABB platformer approach),
 * sub-stepping so fast movement never tunnels through thin platforms.
 */
export function moveBody(body, dt, solids) {
  body.onGround = false;
  body.hitWall = false;

  const dx = body.vx * dt;
  const dy = body.vy * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
  const sdt = dt / steps;

  for (let i = 0; i < steps; i++) {
    // ---- horizontal ----
    if (body.vx !== 0) {
      body.x += body.vx * sdt;
      for (let j = 0; j < solids.length; j++) {
        const s = solids[j];
        if (s.disabled) continue;
        if (!rectsOverlap(body, s)) continue;
        if (body.vx > 0) body.x = s.x - body.w;
        else body.x = s.x + s.w;
        body.vx = 0;
        body.hitWall = true;
      }
    }
    // ---- vertical ----
    if (body.vy !== 0) {
      body.y += body.vy * sdt;
      for (let j = 0; j < solids.length; j++) {
        const s = solids[j];
        if (s.disabled) continue;
        if (!rectsOverlap(body, s)) continue;
        if (body.vy > 0) {
          body.y = s.y - body.h;
          body.onGround = true;
          body.vy = 0;
        } else {
          body.y = s.y + s.h;
          body.vy = 0;
        }
      }
    }
  }
}
