/* TRAP WORLD — the player character */
import { moveBody } from './collision.js';
import * as P from './physics.js';
import { approach, clamp } from './utilities.js';

export class Player {
  constructor() {
    this.w = 10;
    this.h = 14;
    this.reset(0, 0);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.hitWall = false;
    this.facing = 1;
    this.jumpsUsed = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.alive = true;
    this.deadTimer = 0;
    this.animState = 'idle';
    this.animTime = 0;
    this.squash = 1;
    this.stretch = 1;
    this.aura = 0;
    this.spawnFlash = 0.35;
    this.onJump = null;
    this.onLand = null;
  }

  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.deadTimer = 1.0;
    this.vy = -230;
    this.vx = (Math.random() < 0.5 ? -1 : 1) * 70;
    this.animState = 'dead';
  }

  update(dt, input, solids) {
    this.animTime += dt;
    if (this.spawnFlash > 0) this.spawnFlash -= dt;
    if (this.aura > 0) this.aura -= dt;

    if (!this.alive) {
      this.vy += P.GRAVITY * dt * 0.85;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.deadTimer -= dt;
      return;
    }

    const left = input.isDown('left');
    const right = input.isDown('right');
    const dir = (right ? 1 : 0) - (left ? 1 : 0);

    // ---- horizontal movement ----
    const accel = this.onGround ? P.GROUND_ACCEL : P.AIR_ACCEL;
    if (dir !== 0) {
      this.vx = approach(this.vx, dir * P.MOVE_SPEED, accel * dt);
      this.facing = dir;
    } else {
      this.vx = approach(this.vx, 0, (this.onGround ? P.GROUND_FRICTION : P.AIR_FRICTION) * dt);
    }

    // ---- coyote / jump budget ----
    if (this.onGround) {
      this.coyote = P.COYOTE_TIME;
      this.jumpsUsed = 0;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
      if (this.coyote <= 0 && this.jumpsUsed === 0) this.jumpsUsed = 1;
    }

    // ---- jump buffer ----
    if (input.justPressed('jump')) this.jumpBuffer = P.JUMP_BUFFER;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    if (this.jumpBuffer > 0) {
      if ((this.onGround || this.coyote > 0) && this.jumpsUsed === 0) {
        this.vy = P.JUMP_VELOCITY;
        this.jumpsUsed = 1;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.onGround = false;
        this.squash = 0.76;
        this.stretch = 1.16;
        if (this.onJump) this.onJump(false);
      } else if (this.jumpsUsed < 2) {
        this.vy = P.DOUBLE_JUMP_VELOCITY;
        this.jumpsUsed = 2;
        this.jumpBuffer = 0;
        this.squash = 0.82;
        this.stretch = 1.12;
        this.aura = 0.35;
        if (this.onJump) this.onJump(true);
      }
    }

    // ---- gravity ----
    this.vy += P.GRAVITY * dt;
    if (this.vy < 0 && !input.isDown('jump')) {
      this.vy += P.GRAVITY * (P.JUMP_CUT_MULTIPLIER - 1) * dt;
    }
    if (this.vy > P.MAX_FALL_SPEED) this.vy = P.MAX_FALL_SPEED;

    // ---- collision ----
    const wasGrounded = this.onGround;
    moveBody(this, dt, solids);

    if (!wasGrounded && this.onGround) {
      this.squash = 1.3;
      this.stretch = 0.78;
      if (this.onLand) this.onLand();
    }

    // ---- animation state ----
    if (!this.onGround) this.animState = this.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(this.vx) > 12) this.animState = 'run';
    else this.animState = 'idle';

    this.squash = approach(this.squash, 1, 7 * dt);
    this.stretch = approach(this.stretch, 1, 7 * dt);
  }

  draw(ctx) {
    const px = Math.round(this.x);
    const py = Math.round(this.y);

    // double-jump aura
    if (this.aura > 0) {
      const a = this.aura / 0.35;
      ctx.globalAlpha = a * 0.5;
      ctx.strokeStyle = '#6df2ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px + this.w / 2, py + this.h / 2, 10 + (1 - a) * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // respawn flash
    if (this.spawnFlash > 0 && Math.floor(this.spawnFlash * 30) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    ctx.save();

    if (!this.alive) {
      const cx = px + this.w / 2;
      const cy = py + this.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((1 - Math.max(0, this.deadTimer)) * 6);
      ctx.translate(-cx, -cy);
      ctx.globalAlpha = Math.max(0, this.deadTimer);
    }

    const bx = px;
    const by = py;

    const paint = (x, y, w, h, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(bx + x, by + y, w, h);
    };

    const running = this.animState === 'run';
    const swing = running ? Math.sin(this.animTime * 20) * 2 : 0;
    const bob = this.animState === 'idle' ? Math.sin(this.animTime * 3.2) * 0.5 : 0;

    // shadow
    ctx.globalAlpha *= 0.28;
    paint(1, 13, 8, 1, '#000000');
    ctx.globalAlpha = this.alive ? 1 : Math.max(0, this.deadTimer);

    // cloak
    paint(1, 5 + bob, 8, 7, '#2b2140');
    paint(1, 5 + bob, 8, 1, '#3a2c5c');
    // hood
    paint(1, 1 + bob, 8, 5, '#3a2c5c');
    paint(2, 1 + bob, 6, 1, '#4d3b78');
    // face void
    paint(2, 3 + bob, 6, 3, '#0d0918');
    // glowing eyes
    paint(3, 4 + bob, 2, 2, '#6df2ff');
    paint(6, 4 + bob, 2, 2, '#6df2ff');
    // scarf
    paint(1, 6 + bob, 8, 2, '#c94f6d');
    paint(8, 7 + bob, 2, 1, '#c94f6d');

    // legs
    paint(2 + swing, 11, 2, 3, '#151024');
    paint(6 - swing, 11, 2, 3, '#151024');
    paint(2 + swing, 12, 2, 2, '#0d0a16');
    paint(6 - swing, 12, 2, 2, '#0d0a16');

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
