/* TRAP WORLD — smooth clamped camera with screen shake */
import { clamp, lerp } from './utilities.js';

export class Camera {
  constructor(viewW, viewH) {
    this.w = viewW;
    this.h = viewH;
    this.x = 0;
    this.y = 0;
    this.ox = 0;
    this.oy = 0;
    this.shakeTime = 0;
    this.shakeDuration = 0;
    this.shakeMagnitude = 0;
    this.enabled = true;
  }

  setBounds() { /* bounds come from the level each frame */ }

  clampTo(level) {
    const maxX = Math.max(0, level.width - this.w);
    const maxY = Math.max(0, level.height - this.h);
    this.x = clamp(this.x, 0, maxX);
    this.y = clamp(this.y, 0, maxY);
  }

  snapTo(target, level) {
    this.x = target.x + target.w / 2 - this.w / 2;
    this.y = target.y + target.h / 2 - this.h / 2 - 12;
    this.clampTo(level);
  }

  follow(target, level, dt) {
    const tx = target.x + target.w / 2 - this.w / 2;
    const ty = target.y + target.h / 2 - this.h / 2 - 12;
    const k = 1 - Math.exp(-7 * dt);
    this.x = lerp(this.x, tx, k);
    this.y = lerp(this.y, ty, k);
    this.clampTo(level);
  }

  shake(magnitude, duration) {
    if (!this.enabled) return;
    if (magnitude <= this.shakeMagnitude && this.shakeTime > 0) return;
    this.shakeMagnitude = magnitude;
    this.shakeDuration = duration;
    this.shakeTime = duration;
  }

  update(dt) {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const t = Math.max(0, this.shakeTime / this.shakeDuration);
      const mag = this.shakeMagnitude * t;
      this.ox = (Math.random() * 2 - 1) * mag;
      this.oy = (Math.random() * 2 - 1) * mag;
      if (this.shakeTime <= 0) {
        this.shakeTime = 0;
        this.ox = 0;
        this.oy = 0;
        this.shakeMagnitude = 0;
      }
    } else {
      this.ox = 0;
      this.oy = 0;
    }
  }
}
