/* TRAP WORLD — pooled particle system */
import { rand } from './utilities.js';

export class ParticleSystem {
  constructor(max = 320) {
    this.max = max;
    this.pool = new Array(max);
    for (let i = 0; i < max; i++) {
      this.pool[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', gravity: 400, drag: 0 };
    }
    this.cursor = 0;
  }

  _next() {
    for (let i = 0; i < this.max; i++) {
      const idx = (this.cursor + i) % this.max;
      if (!this.pool[idx].active) {
        this.cursor = (idx + 1) % this.max;
        return this.pool[idx];
      }
    }
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    return p;
  }

  spawn(cfg) {
    const p = this._next();
    p.active = true;
    p.x = cfg.x || 0;
    p.y = cfg.y || 0;
    p.vx = cfg.vx || 0;
    p.vy = cfg.vy || 0;
    p.life = cfg.life || 0.5;
    p.maxLife = p.life;
    p.size = cfg.size || 2;
    p.color = cfg.color || '#ffffff';
    p.gravity = cfg.gravity !== undefined ? cfg.gravity : 420;
    p.drag = cfg.drag || 0;
    return p;
  }

  burst(x, y, count, cfg = {}) {
    const speed = cfg.speed !== undefined ? cfg.speed : 90;
    const spread = cfg.spread !== undefined ? cfg.spread : Math.PI * 2;
    const angle0 = cfg.angle !== undefined ? cfg.angle : 0;
    for (let i = 0; i < count; i++) {
      const a = angle0 + rand(-spread / 2, spread / 2);
      const s = rand(speed * 0.35, speed);
      this.spawn({
        x: x + rand(-2, 2),
        y: y + rand(-2, 2),
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand((cfg.life || 0.55) * 0.6, cfg.life || 0.55),
        size: cfg.size || (Math.random() < 0.35 ? 2 : 1),
        color: Array.isArray(cfg.colors) ? cfg.colors[(Math.random() * cfg.colors.length) | 0] : (cfg.color || '#ffffff'),
        gravity: cfg.gravity !== undefined ? cfg.gravity : 420,
        drag: cfg.drag || 0,
      });
    }
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.gravity * dt;
      if (p.drag > 0) {
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d;
        p.vy *= d;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx) {
    for (let i = 0; i < this.max; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, Math.min(1, t * 1.4));
      ctx.fillStyle = p.color;
      const s = Math.max(1, Math.round(p.size * (0.5 + t * 0.5)));
      ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    for (let i = 0; i < this.max; i++) this.pool[i].active = false;
  }
}
