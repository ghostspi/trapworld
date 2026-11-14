/* TRAP WORLD — the trap system
   Every trap exposes:
     - update(dt, world)  : world = { player, level, game }
     - solids             : array of solid rects (rebuilt each update)
     - hazards            : array of lethal rects (rebuilt each update)
     - reset()            : returns the trap to its starting state
     - draw(ctx, time)    : renders in WORLD coordinates
*/
import { rectsOverlap, clamp } from './utilities.js';

/* ------------------------------------------------------------------ */
/* Base                                                                */
/* ------------------------------------------------------------------ */
class Trap {
  constructor(def, level) {
    this.def = def;
    this.level = level;
    this.type = def.type;
    this.x = def.x || 0;
    this.y = def.y || 0;
    this.w = def.w || 16;
    this.h = def.h || 16;
    this.solids = [];
    this.hazards = [];
    this.triggered = false;
  }

  reset() {
    this.triggered = false;
    this.solids.length = 0;
    this.hazards.length = 0;
  }

  update() { /* overridden */ }

  draw() { /* overridden */ }

  triggerRect() {
    const t = this.def.trigger;
    if (t) return t;
    return { x: this.x - 40, y: this.y - 90, w: this.w + 80, h: this.h + 120 };
  }
}

/* ------------------------------------------------------------------ */
/* Hidden spikes                                                       */
/* ------------------------------------------------------------------ */
class HiddenSpikes extends Trap {
  constructor(def, level) {
    super(def, level);
    this.w = def.w || 32;
    this.h = def.h || 22;
    this.ext = 0;
    this.state = 'idle';
    this.timer = 0;
    this.delay = def.delay !== undefined ? def.delay : 0.1;
    this.riseSpeed = def.riseSpeed || 300;
    this.hold = def.hold !== undefined ? def.hold : 1.4;
  }

  reset() {
    super.reset();
    this.ext = 0;
    this.state = 'idle';
    this.timer = 0;
    this.hazards.length = 0;
  }

  update(dt, world) {
    const p = world.player;
    if (this.state === 'idle') {
      if (p.alive && rectsOverlap(p, this.triggerRect())) {
        this.state = 'delay';
        this.timer = this.delay;
        if (world.game) world.game.onTrapTriggered(this);
      }
    } else if (this.state === 'delay') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'rising';
    } else if (this.state === 'rising') {
      this.ext += this.riseSpeed * dt;
      if (this.ext >= this.h) { this.ext = this.h; this.state = 'active'; this.timer = this.hold; }
    } else if (this.state === 'active') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'retract';
    } else if (this.state === 'retract') {
      this.ext -= this.riseSpeed * dt;
      if (this.ext <= 0) { this.ext = 0; this.state = 'idle'; }
    }

    this.hazards.length = 0;
    if (this.ext > this.h * 0.3) {
      this.hazards.push({ x: this.x, y: this.y + this.h - this.ext, w: this.w, h: this.ext });
    }
  }

  draw(ctx, time) {
    const bx = this.x;
    const by = this.y + this.h;

    // base plate
    ctx.fillStyle = '#171423';
    ctx.fillRect(bx, by - 3, this.w, 3);

    if (this.ext < 1) {
      // subtle crack hint
      ctx.fillStyle = 'rgba(255, 92, 138, 0.20)';
      ctx.fillRect(bx + 2, by - 2, this.w - 4, 1);
      return;
    }

    const spikes = Math.max(1, Math.round(this.w / 8));
    const sw = this.w / spikes;
    const top = by - this.ext;

    ctx.fillStyle = '#aeb8cc';
    for (let i = 0; i < spikes; i++) {
      const sx = bx + i * sw;
      ctx.beginPath();
      ctx.moveTo(sx, by);
      ctx.lineTo(sx + sw / 2, top);
      ctx.lineTo(sx + sw, by);
      ctx.closePath();
      ctx.fill();
    }
    // highlight
    ctx.fillStyle = '#e9f1ff';
    for (let i = 0; i < spikes; i++) {
      const sx = bx + i * sw;
      ctx.fillRect(Math.round(sx + sw / 2) - 1, Math.round(top) + 2, 1, Math.max(1, this.ext - 3));
    }
    // danger glow
    ctx.globalAlpha = 0.25 + Math.sin(time * 12) * 0.1;
    ctx.fillStyle = '#ff5c8a';
    ctx.fillRect(bx, top, this.w, 2);
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ */
/* Fake / disappearing platforms                                       */
/* ------------------------------------------------------------------ */
class FakePlatform extends Trap {
  constructor(def, level) {
    super(def, level);
    this.state = 'solid';
    this.timer = def.delay !== undefined ? def.delay : 0.35;
    this.maxTimer = this.timer;
    this.respawn = def.respawn || 0;
    this.goneTimer = 0;
    this.wobble = 0;
    this.rebuild();
  }

  rebuild() {
    this.solids.length = 0;
    this.hazards.length = 0;
    if (this.state === 'solid' || this.state === 'shaking') {
      this.solids.push({ x: this.x, y: this.y, w: this.w, h: this.h });
    }
  }

  reset() {
    this.state = 'solid';
    this.timer = this.maxTimer;
    this.goneTimer = 0;
    this.wobble = 0;
    this.rebuild();
  }

  update(dt, world) {
    if (this.state === 'solid') {
      if (world.player.alive && rectsOverlap(world.player, this)) {
        this.state = 'shaking';
        this.timer = this.maxTimer;
        if (world.game) world.game.onTrapTriggered(this);
      }
    } else if (this.state === 'shaking') {
      this.timer -= dt;
      this.wobble += dt * 40;
      if (this.timer <= 0) {
        this.state = 'gone';
        this.goneTimer = this.respawn;
        if (world.game) world.game.onTrapBreak(this);
      }
    } else if (this.state === 'gone' && this.respawn > 0) {
      this.goneTimer -= dt;
      if (this.goneTimer <= 0) { this.state = 'solid'; this.wobble = 0; }
    }
    this.rebuild();
  }

  draw(ctx, time) {
    if (this.state === 'gone') return;
    const off = this.state === 'shaking' ? Math.sin(this.wobble) * 1.2 : 0;
    const x = Math.round(this.x + off);
    const y = Math.round(this.y);
    const g = ctx.createLinearGradient(0, y, 0, y + this.h);
    g.addColorStop(0, '#5c6f92');
    g.addColorStop(1, '#2a3650');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, this.w, this.h);
    ctx.fillStyle = '#8fa6cc';
    ctx.fillRect(x, y, this.w, 2);
    ctx.fillStyle = 'rgba(255, 92, 138, 0.35)';
    ctx.fillRect(x, y + this.h - 1, this.w, 1);
  }
}

class DisappearingPlatform extends FakePlatform {
  constructor(def, level) {
    super(def, level);
    if (!def.respawn) this.respawn = 2.5;
  }

  draw(ctx, time) {
    if (this.state === 'gone') {
      if (this.respawn > 0) {
        const a = 1 - Math.max(0, this.goneTimer / this.respawn);
        ctx.globalAlpha = 0.18 * a;
        ctx.fillStyle = '#6df2ff';
        ctx.fillRect(Math.round(this.x), Math.round(this.y), this.w, this.h);
        ctx.globalAlpha = 1;
      }
      return;
    }
    super.draw(ctx, time);
  }
}

/* ------------------------------------------------------------------ */
/* Collapsing floor                                                    */
/* ------------------------------------------------------------------ */
class CollapsingFloor extends Trap {
  constructor(def, level) {
    super(def, level);
    this.startY = def.y;
    this.state = 'idle';
    this.timer = def.delay !== undefined ? def.delay : 0.25;
    this.maxTimer = this.timer;
    this.vy = 0;
    this.rebuild();
  }

  rebuild() {
    this.solids.length = 0;
    if (this.state === 'idle' || this.state === 'shaking') {
      this.solids.push({ x: this.x, y: this.y, w: this.w, h: this.h });
    }
  }

  reset() {
    this.state = 'idle';
    this.timer = this.maxTimer;
    this.vy = 0;
    this.y = this.startY;
    this.rebuild();
  }

  update(dt, world) {
    if (this.state === 'idle') {
      if (world.player.alive && rectsOverlap(world.player, this)) {
        this.state = 'shaking';
        this.timer = this.maxTimer;
        if (world.game) world.game.onTrapTriggered(this);
      }
    } else if (this.state === 'shaking') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'falling';
        this.vy = 40;
        if (world.game) world.game.onTrapBreak(this);
      }
    } else if (this.state === 'falling') {
      this.vy += 1600 * dt;
      this.y += this.vy * dt;
      if (this.y > world.level.height + 80) this.state = 'gone';
    }
    this.rebuild();
  }

  draw(ctx, time) {
    if (this.state === 'gone') return;
    const off = this.state === 'shaking' ? Math.sin(time * 60) * 1.5 : 0;
    const x = Math.round(this.x + off);
    const y = Math.round(this.y);
    ctx.fillStyle = '#22304a';
    ctx.fillRect(x, y, this.w, this.h);
    ctx.fillStyle = '#3f5a80';
    ctx.fillRect(x, y, this.w, 3);
    ctx.fillStyle = '#121c2c';
    for (let i = 8; i < this.w; i += 14) ctx.fillRect(x + i, y + 6, 2, this.h - 10);
  }
}

/* ------------------------------------------------------------------ */
/* Falling ceiling                                                     */
/* ------------------------------------------------------------------ */
class FallingCeiling extends Trap {
  constructor(def, level) {
    super(def, level);
    this.startY = def.y;
    this.state = 'idle';
    this.vy = 0;
    this.timer = def.delay !== undefined ? def.delay : 0.22;
    this.crumble = 0;
    this.rebuild();
  }

  rebuild() {
    this.solids.length = 0;
    this.hazards.length = 0;
    if (this.state === 'falling') {
      this.hazards.push({ x: this.x, y: this.y, w: this.w, h: this.h });
    } else if (this.state === 'landed') {
      this.solids.push({ x: this.x, y: this.y, w: this.w, h: this.h });
    }
  }

  reset() {
    this.state = 'idle';
    this.vy = 0;
    this.timer = this.def.delay !== undefined ? this.def.delay : 0.22;
    this.y = this.startY;
    this.crumble = 0;
    this.rebuild();
  }

  update(dt, world) {
    if (this.state === 'idle') {
      if (world.player.alive && rectsOverlap(world.player, this.triggerRect())) {
        this.state = 'delay';
        this.timer = this.def.delay !== undefined ? this.def.delay : 0.22;
        if (world.game) world.game.onTrapTriggered(this);
      }
    } else if (this.state === 'delay') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'falling';
    } else if (this.state === 'falling') {
      this.vy = Math.min(this.vy + 1500 * dt, 720);
      this.y += this.vy * dt;

      const platforms = world.level.platforms;
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        if (rectsOverlap(this, p)) {
          this.y = p.y - this.h;
          this.state = 'landed';
          this.vy = 0;
          this.crumble = 1.0;
          if (world.game) world.game.onTrapImpact(this);
          break;
        }
      }
      if (this.state === 'falling' && this.y > world.level.height) {
        this.state = 'gone';
      }
    } else if (this.state === 'landed') {
      this.crumble -= dt;
      if (this.crumble <= 0) this.state = 'gone';
    }
    this.rebuild();
  }

  draw(ctx, time) {
    if (this.state === 'gone') return;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const shake = this.state === 'delay' ? Math.sin(time * 70) * 1.5 : 0;

    ctx.fillStyle = '#2a2233';
    ctx.fillRect(x + shake, y, this.w, this.h);
    ctx.fillStyle = '#463a57';
    ctx.fillRect(x + shake, y, this.w, 3);
    ctx.fillStyle = '#1a1522';
    ctx.fillRect(x + shake, y + this.h - 3, this.w, 3);
    // rivets
    ctx.fillStyle = '#6b5c82';
    for (let i = 6; i < this.w - 4; i += 12) {
      ctx.fillRect(x + shake + i, y + 6, 2, 2);
    }
    if (this.state === 'landed') {
      ctx.globalAlpha = Math.max(0, this.crumble);
      ctx.fillStyle = 'rgba(255, 92, 138, 0.35)';
      ctx.fillRect(x, y + this.h - 1, this.w, 1);
      ctx.globalAlpha = 1;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Crushers & moving spikes                                            */
/* ------------------------------------------------------------------ */
class Mover extends Trap {
  constructor(def, level) {
    super(def, level);
    this.axis = def.axis || 'y';
    this.range = def.range !== undefined ? def.range : 100;
    this.speed = def.speed || 60;
    this.phase = def.phase || 0;
    this.t = this.phase;
    this.originX = def.x;
    this.originY = def.y;
    this.needsTrigger = !!def.trigger;
    this.active = !this.needsTrigger;
    this.isSpike = def.type === 'movingSpike';
  }

  reset() {
    this.t = this.phase;
    this.active = !this.needsTrigger;
    this.x = this.originX;
    this.y = this.originY;
    this.solids.length = 0;
    this.hazards.length = 0;
  }

  update(dt, world) {
    if (!this.active) {
      if (world.player.alive && rectsOverlap(world.player, this.triggerRect())) {
        this.active = true;
        if (world.game) world.game.onTrapTriggered(this);
      }
      this.hazards.length = 0;
      this.hazards.push({ x: this.x, y: this.y, w: this.w, h: this.h });
      return;
    }

    this.t += dt;
    const cycle = (this.range * 2) / this.speed;
    const p = cycle > 0 ? (this.t % cycle) / cycle : 0;
    const d = p < 0.5 ? p * 2 : 2 - p * 2;

    if (this.axis === 'x') {
      this.x = this.originX + d * this.range;
      this.y = this.originY;
    } else {
      this.x = this.originX;
      this.y = this.originY + d * this.range;
    }

    this.hazards.length = 0;
    this.hazards.push({ x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 4 });
  }

  draw(ctx, time) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);

    if (this.isSpike) {
      ctx.fillStyle = '#b9c2d6';
      ctx.beginPath();
      ctx.moveTo(x, y + this.h);
      ctx.lineTo(x + this.w / 2, y);
      ctx.lineTo(x + this.w, y + this.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e9f1ff';
      ctx.fillRect(x + Math.floor(this.w / 2) - 1, y + 3, 1, this.h - 5);
      ctx.globalAlpha = 0.3 + Math.sin(time * 10) * 0.1;
      ctx.fillStyle = '#ff5c8a';
      ctx.fillRect(x, y + this.h - 2, this.w, 2);
      ctx.globalAlpha = 1;
      return;
    }

    // crusher body
    ctx.fillStyle = '#332a3f';
    ctx.fillRect(x, y, this.w, this.h);
    ctx.fillStyle = '#544568';
    ctx.fillRect(x, y, this.w, 3);
    ctx.fillRect(x, y, 3, this.h);
    ctx.fillStyle = '#1c1626';
    ctx.fillRect(x, y + this.h - 4, this.w, 4);

    // teeth on the working side
    ctx.fillStyle = '#8d7aa8';
    const teeth = Math.max(2, Math.round(this.w / 12));
    const tw = this.w / teeth;
    for (let i = 0; i < teeth; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * tw, y + this.h);
      ctx.lineTo(x + i * tw + tw / 2, y + this.h + 4);
      ctx.lineTo(x + (i + 1) * tw, y + this.h);
      ctx.closePath();
      ctx.fill();
    }

    // warning stripe
    ctx.globalAlpha = 0.4 + Math.sin(time * 8) * 0.15;
    ctx.fillStyle = '#ff5c8a';
    ctx.fillRect(x + 4, y + this.h - 8, this.w - 8, 2);
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ */
/* Moving platform (solid, carries the player)                         */
/* ------------------------------------------------------------------ */
class MovingPlatform extends Trap {
  constructor(def, level) {
    super(def, level);
    this.axis = def.axis || 'x';
    this.range = def.range !== undefined ? def.range : 100;
    this.speed = def.speed || 50;
    this.t = def.phase || 0;
    this.originX = def.x;
    this.originY = def.y;
    this.prevX = def.x;
    this.prevY = def.y;
    this.solids.push({ x: this.x, y: this.y, w: this.w, h: this.h });
  }

  reset() {
    this.t = this.def.phase || 0;
    this.x = this.originX;
    this.y = this.originY;
    this.prevX = this.x;
    this.prevY = this.y;
    this.solids.length = 0;
    this.solids.push({ x: this.x, y: this.y, w: this.w, h: this.h });
    this.hazards.length = 0;
  }

  update(dt, world) {
    this.prevX = this.x;
    this.prevY = this.y;

    this.t += dt;
    const cycle = (this.range * 2) / this.speed;
    const p = cycle > 0 ? (this.t % cycle) / cycle : 0;
    const d = p < 0.5 ? p * 2 : 2 - p * 2;

    if (this.axis === 'x') { this.x = this.originX + d * this.range; this.y = this.originY; }
    else { this.y = this.originY + d * this.range; this.x = this.originX; }

    const dx = this.x - this.prevX;
    const dy = this.y - this.prevY;
    const pl = world.player;

    if (pl.alive && Math.abs((pl.y + pl.h) - this.prevY) < 4 &&
        pl.x + pl.w > this.x && pl.x < this.x + this.w) {
      pl.x += dx;
      pl.y += dy;
    }

    this.solids.length = 0;
    this.solids.push({ x: this.x, y: this.y, w: this.w, h: this.h });
  }

  draw(ctx) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const g = ctx.createLinearGradient(0, y, 0, y + this.h);
    g.addColorStop(0, '#8f7ab8');
    g.addColorStop(1, '#3d3054');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, this.w, this.h);
    ctx.fillStyle = '#c4aee8';
    ctx.fillRect(x, y, this.w, 2);
    ctx.fillStyle = '#1e1729';
    ctx.fillRect(x, y + this.h - 2, this.w, 2);
    // rivets
    ctx.fillStyle = '#221a30';
    for (let i = 5; i < this.w - 3; i += 12) ctx.fillRect(x + i, y + 5, 2, 2);
  }
}

/* ------------------------------------------------------------------ */
/* Lava                                                                */
/* ------------------------------------------------------------------ */
class Lava extends Trap {
  constructor(def, level) {
    super(def, level);
    this.top = def.y;
    this.baseY = def.y;
    this.riseTo = def.riseTo !== undefined ? def.riseTo : def.y;
    this.speed = def.speed || 20;
    this.needsTrigger = !!def.trigger;
    this.active = !this.needsTrigger;
    this.anim = 0;
    this.rebuild();
  }

  rebuild() {
    this.hazards.length = 0;
    const bottom = this.baseY + this.h;
    if (bottom > this.top) {
      this.hazards.push({ x: this.x, y: this.top, w: this.w, h: bottom - this.top });
    }
  }

  reset() {
    this.top = this.baseY;
    this.active = !this.needsTrigger;
    this.anim = 0;
    this.rebuild();
  }

  update(dt, world) {
    this.anim += dt;
    if (!this.active) {
      if (world.player.alive && rectsOverlap(world.player, this.triggerRect())) {
        this.active = true;
        if (world.game) world.game.onTrapTriggered(this);
      }
    } else if (this.top > this.riseTo) {
      this.top = Math.max(this.riseTo, this.top - this.speed * dt);
    }
    this.rebuild();
  }

  draw(ctx, time) {
    const bottom = this.baseY + this.h;
    if (bottom <= this.top) return;

    const x = Math.round(this.x);
    const y = Math.round(this.top);
    const h = bottom - this.top;

    const g = ctx.createLinearGradient(0, y, 0, bottom);
    g.addColorStop(0, '#ff8a3d');
    g.addColorStop(0.35, '#e8452a');
    g.addColorStop(1, '#5c0f12');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, this.w, h);

    // surface wave
    ctx.fillStyle = '#ffd166';
    for (let px = 0; px < this.w; px += 6) {
      const wave = Math.sin((px + time * 60) * 0.08) * 2;
      ctx.fillRect(x + px, y + Math.round(wave), 4, 2);
    }

    // bubbles
    ctx.fillStyle = 'rgba(255, 209, 102, 0.5)';
    for (let i = 0; i < 6; i++) {
      const bx = x + ((i * 53 + time * 18) % this.w);
      const by = y + 6 + ((i * 37 + time * 26) % Math.max(1, h - 8));
      ctx.fillRect(Math.round(bx), Math.round(by), 2, 2);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Teleport trap                                                       */
/* ------------------------------------------------------------------ */
class Teleport extends Trap {
  constructor(def, level) {
    super(def, level);
    this.used = false;
    this.to = def.to || { x: this.x, y: this.y };
  }

  reset() { this.used = false; }

  update(dt, world) {
    if (this.used) return;
    if (world.player.alive && rectsOverlap(world.player, this)) {
      this.used = true;
      if (world.game) world.game.teleportPlayer(this.to.x, this.to.y);
    }
  }

  draw(ctx, time) {
    if (this.used) return;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    ctx.globalAlpha = 0.35 + Math.sin(time * 4) * 0.12;
    ctx.strokeStyle = '#c07bff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(192, 123, 255, 0.15)';
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}

/* ------------------------------------------------------------------ */
/* Invisible wall                                                      */
/* ------------------------------------------------------------------ */
class InvisibleWall extends Trap {
  constructor(def, level) {
    super(def, level);
    this.solids.push({ x: this.x, y: this.y, w: this.w, h: this.h });
  }

  reset() {
    this.solids.length = 0;
    this.solids.push({ x: this.x, y: this.y, w: this.w, h: this.h });
    this.hazards.length = 0;
  }

  update() { /* static */ }

  draw() { /* intentionally invisible */ }
}

/* ------------------------------------------------------------------ */
/* Enemy                                                               */
/* ------------------------------------------------------------------ */
class Enemy extends Trap {
  constructor(def, level) {
    super(def, level);
    this.minX = def.minX !== undefined ? def.minX : this.x - 50;
    this.maxX = def.maxX !== undefined ? def.maxX : this.x + 50;
    this.speed = def.speed || 45;
    this.dir = 1;
    this.startX = def.x;
    this.anim = 0;
  }

  reset() {
    this.x = this.startX;
    this.dir = 1;
    this.anim = 0;
    this.hazards.length = 0;
  }

  update(dt, world) {
    this.anim += dt;
    this.x += this.speed * this.dir * dt;
    if (this.x < this.minX) { this.x = this.minX; this.dir = 1; }
    if (this.x > this.maxX) { this.x = this.maxX; this.dir = -1; }

    this.hazards.length = 0;
    this.hazards.push({ x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 4 });
  }

  draw(ctx, time) {
    const x = Math.round(this.x);
    const y = Math.round(this.y + Math.sin(this.anim * 4) * 1.5);

    // wings
    ctx.fillStyle = 'rgba(140, 90, 200, 0.45)';
    const flap = Math.sin(this.anim * 18) * 4;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 7);
    ctx.lineTo(x - 6, y + 4 + flap);
    ctx.lineTo(x - 2, y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + this.w - 2, y + 7);
    ctx.lineTo(x + this.w + 6, y + 4 + flap);
    ctx.lineTo(x + this.w + 2, y + 10);
    ctx.closePath();
    ctx.fill();

    // body
    ctx.fillStyle = '#3a2352';
    ctx.fillRect(x + 1, y + 2, this.w - 2, this.h - 4);
    ctx.fillStyle = '#5b3a82';
    ctx.fillRect(x + 2, y + 2, this.w - 4, 2);

    // eye
    ctx.fillStyle = '#ff5c8a';
    ctx.fillRect(x + Math.round(this.w / 2) - 2, y + 5, 4, 4);
    ctx.fillStyle = '#ffe0e9';
    ctx.fillRect(x + Math.round(this.w / 2) - 1, y + 6, 1, 1);
  }
}

/* ------------------------------------------------------------------ */
/* Fake exit                                                           */
/* ------------------------------------------------------------------ */
class FakeExit extends Trap {
  constructor(def, level) {
    super(def, level);
    this.used = false;
  }

  reset() { this.used = false; }

  update(dt, world) {
    if (this.used) return;
    if (world.player.alive && rectsOverlap(world.player, this)) {
      this.used = true;
      if (world.game) world.game.onFakeExit(this);
    }
  }

  draw(ctx, time) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const pulse = 0.5 + Math.sin(time * 5) * 0.2;

    ctx.globalAlpha = 0.25 + pulse * 0.3;
    ctx.fillStyle = this.used ? '#ff5c8a' : '#5ef2a0';
    ctx.fillRect(x - 6, y - 6, this.w + 12, this.h + 12);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#0b1526';
    ctx.fillRect(x, y, this.w, this.h);
    ctx.strokeStyle = this.used ? '#ff5c8a' : '#5ef2a0';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 0.5, y + 0.5, this.w - 1, this.h - 1);

    ctx.globalAlpha = 0.8;
    ctx.fillStyle = this.used ? '#ff5c8a' : '#5ef2a0';
    for (let i = 0; i < 4; i++) {
      const sy = y + 6 + ((i * 11 + time * 30) % (this.h - 10));
      ctx.fillRect(x + 4, Math.round(sy), this.w - 8, 1);
    }
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */
const REGISTRY = {
  hiddenSpikes: HiddenSpikes,
  fakePlatform: FakePlatform,
  disappearingPlatform: DisappearingPlatform,
  collapsingFloor: CollapsingFloor,
  fallingCeiling: FallingCeiling,
  crusher: Mover,
  movingSpike: Mover,
  movingPlatform: MovingPlatform,
  lava: Lava,
  teleport: Teleport,
  invisibleWall: InvisibleWall,
  enemy: Enemy,
  fakeExit: FakeExit,
};

export function createTrap(def, level) {
  const Cls = REGISTRY[def.type];
  if (!Cls) {
    console.warn('[TRAP WORLD] unknown trap type:', def.type);
    return new Trap(def, level);
  }
  return new Cls(def, level);
}
