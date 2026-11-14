/* TRAP WORLD — the game controller */
import { Engine } from './engine.js';
import { input } from './input.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { ParticleSystem } from './particles.js';
import { LevelManager } from './level-manager.js';
import { LEVELS } from './levels.js';
import { audio } from './audio.js';
import { SaveSystem } from './save-system.js';
import { settings } from './settings.js';
import { UI } from './ui.js';
import { drawBackground, THEMES } from './backgrounds.js';
import { rectsOverlap, clamp } from './utilities.js';

export const VIEW_W = 480;
export const VIEW_H = 270;

const FIXED_STEP = 1 / 60;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;

    this.engine = new Engine(canvas, VIEW_W, VIEW_H);

    this.state = 'menu';
    this.time = 0;

    this.player = new Player();
    this.camera = new Camera(VIEW_W, VIEW_H);
    this.particles = new ParticleSystem(320);
    this.levelMgr = new LevelManager();
    this.ui = new UI(this);

    this.currentLevel = 0;
    this.deaths = 0;
    this.deathTimer = 0;
    this.levelTime = 0;
    this.goalReached = false;

    this.lastTs = 0;
    this.accumulator = 0;
    this.loop = this.loop.bind(this);

    this.camera.enabled = settings.get('screenShake');

    this.player.onJump = (isDouble) => {
      audio.play(isDouble ? 'doubleJump' : 'jump');
      if (isDouble) {
        this.particles.burst(
          this.player.x + this.player.w / 2,
          this.player.y + this.player.h,
          10,
          { speed: 80, angle: Math.PI / 2, spread: Math.PI, life: 0.35, colors: ['#6df2ff', '#b7f9ff', '#5ef2a0'], gravity: 120 }
        );
      }
    };

    this.player.onLand = () => {
      audio.play('land');
      this.particles.burst(
        this.player.x + this.player.w / 2,
        this.player.y + this.player.h,
        6,
        { speed: 60, angle: -Math.PI / 2, spread: Math.PI * 0.9, life: 0.3, colors: ['#9fb4d6', '#6d84a8'], gravity: 260 }
      );
      this.camera.shake(1.2, 0.1);
    };

    audio.startMusic('menu');
  }

  /* ---------------- loop ---------------- */

  start() {
    this.lastTs = performance.now() / 1000;
    requestAnimationFrame(this.loop);
  }

  loop(ts) {
    requestAnimationFrame(this.loop);

    const now = ts / 1000;
    let delta = now - this.lastTs;
    this.lastTs = now;
    if (!Number.isFinite(delta) || delta < 0) delta = 0;
    if (delta > 0.25) delta = 0.25;

    this.accumulator += delta;

    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < 5) {
      this.update(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
      input.endFrame();
      steps++;
    }
    if (steps === 5) this.accumulator = 0;

    this.render();
  }

  /* ---------------- update ---------------- */

  update(dt) {
    this.time += dt;

    // global hotkeys
    if (this.state === 'playing') {
      if (input.justPressed('pause')) { this.pause(); return; }
      if (input.justPressed('restart')) { this.restartLevel(); return; }
    } else if (this.state === 'paused') {
      if (input.justPressed('pause')) { this.resume(); return; }
      if (input.justPressed('restart')) { this.restartLevel(); return; }
    }

    if (this.state === 'playing') {
      this.updatePlaying(dt);
    } else {
      // idle animation for menus (particles keep drifting)
      this.particles.update(dt);
      this.camera.update(dt);
    }
  }

  updatePlaying(dt) {
    this.levelTime += dt;
    const level = this.levelMgr.level;

    // 1. traps first so their solids/hazards are current
    this.levelMgr.updateTraps(dt, this);

    // 2. player
    const solids = this.levelMgr.getSolids();
    this.player.update(dt, input, solids);

    // 3. hazards
    if (this.player.alive) {
      const hazards = this.levelMgr.getHazards();
      for (let i = 0; i < hazards.length; i++) {
        if (rectsOverlap(this.player, hazards[i])) { this.killPlayer(); break; }
      }
    }

    // 4. fell out of the world
    if (this.player.alive && this.player.y > level.height + 60) this.killPlayer();

    // 5. death timer -> respawn
    if (!this.player.alive) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.respawn();
    }

    // 6. checkpoints
    if (this.player.alive && level.checkpoints) {
      for (let i = 0; i < level.checkpoints.length; i++) {
        const cp = level.checkpoints[i];
        const rect = { x: cp.x - 12, y: cp.y - 40, w: 24, h: 40 };
        if (rectsOverlap(this.player, rect)) {
          if (this.levelMgr.registerCheckpoint(i)) {
            audio.play('checkpoint');
            this.ui.toast('CHECKPOINT');
            this.particles.burst(cp.x, cp.y - 20, 16, {
              speed: 70, life: 0.6, colors: ['#5ef2a0', '#6df2ff', '#ffffff'], gravity: -40,
            });
          }
        }
      }
    }

    // 7. goal
    if (this.player.alive && !this.goalReached && rectsOverlap(this.player, level.goal)) {
      this.completeLevel();
      return;
    }

    // 8. camera & particles
    this.camera.follow(this.player, level, dt);
    this.camera.update(dt);
    this.particles.update(dt);

    this.ui.updateHUD();
  }

  /* ---------------- level flow ---------------- */

  playFromMenu() {
    const next = Math.min(SaveSystem.data.unlocked - 1, LEVELS.length - 1);
    this.startLevel(Math.max(0, next));
  }

  startLevel(index) {
    if (index < 0 || index >= LEVELS.length) return;

    audio.init();

    this.currentLevel = index;
    this.levelMgr.load(index);

    this.deaths = 0;
    this.levelTime = 0;
    this.deathTimer = 0;
    this.goalReached = false;

    const sp = this.levelMgr.spawn;
    this.player.reset(sp.x, sp.y);
    this.particles.clear();

    this.camera.snapTo(this.player, this.levelMgr.level);
    this.camera.update(0);

    this.state = 'playing';
    this.accumulator = 0;

    this.ui.showGameplay();
    this.ui.updateHUD();

    audio.startMusic(this.levelMgr.level.theme);
  }

  restartLevel() {
    this.startLevel(this.currentLevel);
  }

  nextLevel() {
    if (this.currentLevel + 1 < LEVELS.length) this.startLevel(this.currentLevel + 1);
    else this.toMenu();
  }

  toMenu() {
    this.state = 'menu';
    this.hudHidden = true;
    this.player.alive = true;
    this.ui.showMenu();
    this.ui.buildLevelGrid();
    audio.startMusic('menu');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.showScreen('screen-pause');
    this.ui.touchControls.classList.add('hidden');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.hideAllScreens();
    this.ui.hud.classList.remove('hidden');
    if (document.body.classList.contains('touch-device')) {
      this.ui.touchControls.classList.remove('hidden');
    }
    this.accumulator = 0;
    this.lastTs = performance.now() / 1000;
  }

  completeLevel() {
    if (this.goalReached) return;
    this.goalReached = true;
    this.state = 'levelcomplete';

    audio.play('complete');
    this.particles.burst(
      this.player.x + this.player.w / 2,
      this.player.y + this.player.h / 2,
      40,
      { speed: 150, life: 1.0, colors: ['#5ef2a0', '#6df2ff', '#ffd166', '#ffffff'], gravity: 120 }
    );
    this.camera.shake(2.5, 0.35);

    SaveSystem.completeLevel(this.currentLevel, this.deaths);
    this.ui.showComplete(this.currentLevel, this.deaths, this.levelTime);
    this.ui.touchControls.classList.add('hidden');
  }

  /* ---------------- death & respawn ---------------- */

  killPlayer() {
    if (!this.player.alive || this.state !== 'playing') return;

    this.player.kill();
    this.deaths++;
    this.deathTimer = 0.95;

    audio.play('death');
    this.camera.shake(4, 0.4);

    this.particles.burst(
      this.player.x + this.player.w / 2,
      this.player.y + this.player.h / 2,
      24,
      { speed: 160, life: 0.7, colors: ['#ff5c8a', '#ff8a3d', '#ffffff'], gravity: 380 }
    );
  }

  respawn() {
    const sp = this.levelMgr.respawnPoint();
    this.player.reset(sp.x, sp.y);
    this.levelMgr.resetTraps();
    this.particles.clear();
    this.camera.snapTo(this.player, this.levelMgr.level);
    this.deathTimer = 0;
  }

  /* ---------------- trap callbacks ---------------- */

  onTrapTriggered(trap) {
    audio.play('trap');
    if (settings.get('screenShake')) this.camera.shake(1.2, 0.12);
  }

  onTrapImpact(trap) {
    audio.play('impact');
    this.camera.shake(3.2, 0.3);
    this.particles.burst(
      trap.x + trap.w / 2,
      trap.y + trap.h,
      14,
      { speed: 120, life: 0.5, colors: ['#8d7aa8', '#5b4a70', '#c9b8e0'], gravity: 500 }
    );
  }

  onTrapBreak(trap) {
    audio.play('trap');
    this.camera.shake(1.8, 0.18);
    this.particles.burst(
      trap.x + trap.w / 2,
      trap.y + trap.h / 2,
      10,
      { speed: 90, life: 0.45, colors: ['#7d879b', '#556', '#aab'], gravity: 400 }
    );
  }

  teleportPlayer(x, y) {
    audio.play('teleport');
    this.particles.burst(
      this.player.x + this.player.w / 2,
      this.player.y + this.player.h / 2,
      16,
      { speed: 110, life: 0.5, colors: ['#c07bff', '#6df2ff', '#ffffff'], gravity: 0 }
    );
    this.player.x = x;
    this.player.y = y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.camera.shake(2, 0.2);
  }

  onFakeExit(trap) {
    audio.play('trap');
    this.camera.shake(4, 0.35);
    this.particles.burst(trap.x + trap.w / 2, trap.y + trap.h / 2, 22, {
      speed: 150, life: 0.6, colors: ['#ff5c8a', '#ffd166'], gravity: 300,
    });

    if (trap.def.effect === 'teleport' && trap.def.to) {
      this.teleportPlayer(trap.def.to.x, trap.def.to.y);
    } else {
      // spikes erupt out of the fake door
      this.killPlayer();
    }
  }

  /* ---------------- rendering ---------------- */

  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;

    if (this.state === 'menu' || !this.levelMgr.level) {
      this.renderMenuBackground();
      return;
    }
    this.renderWorld();
  }

  renderMenuBackground() {
    const ctx = this.ctx;
    const cam = { x: this.time * 18, y: 0 };
    drawBackground(ctx, 'forest', cam, this.time, VIEW_W, VIEW_H);
    this.particles.draw(ctx);

    // slow drifting embers
    if (Math.random() < 0.35) {
      this.particles.spawn({
        x: Math.random() * VIEW_W,
        y: VIEW_H + 4,
        vx: (Math.random() - 0.5) * 12,
        vy: -18 - Math.random() * 22,
        life: 3.2,
        size: 1,
        color: Math.random() < 0.5 ? '#6df2ff' : '#5ef2a0',
        gravity: -4,
      });
    }
    this.particles.update(1 / 60);
  }

  renderWorld() {
    const ctx = this.ctx;
    const cam = this.camera;
    const level = this.levelMgr.level;

    const cx = cam.x + cam.ox;
    const cy = cam.y + cam.oy;

    drawBackground(ctx, level.theme, { x: cx, y: cy }, this.time, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(-Math.round(cx), -Math.round(cy));

    this.drawPlatforms(level);
    this.drawCheckpoints(level);
    this.drawGoal(level);

    const traps = this.levelMgr.traps;
    for (let i = 0; i < traps.length; i++) traps[i].draw(ctx, this.time);

    this.player.draw(ctx);
    this.particles.draw(ctx);

    ctx.restore();

    // vignette
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // death flash
    if (!this.player.alive) {
      ctx.globalAlpha = Math.max(0, this.deathTimer) * 0.35;
      ctx.fillStyle = '#ff5c8a';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
  }

  drawPlatforms(level) {
    const ctx = this.ctx;
    const theme = THEMES[level.theme] || THEMES.forest;
    const platforms = level.platforms;

    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      const w = Math.round(p.w);
      const h = Math.round(p.h);

      if (p.kind === 'ground') {
        ctx.fillStyle = theme.groundBody;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = theme.groundBody2;
        for (let gy = y + 6; gy < y + h; gy += 8) {
          for (let gx = x + ((gy * 7) % 13); gx < x + w; gx += 17) {
            ctx.fillRect(gx, gy, 3, 2);
          }
        }
        ctx.fillStyle = theme.groundTopDark;
        ctx.fillRect(x, y, w, 5);
        ctx.fillStyle = theme.groundTop;
        ctx.fillRect(x, y, w, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x, y, w, 1);
      } else {
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, theme.platformTop);
        g.addColorStop(1, theme.platformBody);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x, y, w, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x, y + h - 1, w, 1);
        // rivets
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let rx = x + 4; rx < x + w - 2; rx += 10) ctx.fillRect(rx, y + 4, 2, 2);
      }

      // accent glow under platforms
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(x, y + h, w, 1);
      ctx.globalAlpha = 1;
    }
  }

  drawCheckpoints(level) {
    if (!level.checkpoints) return;
    const ctx = this.ctx;
    for (let i = 0; i < level.checkpoints.length; i++) {
      const cp = level.checkpoints[i];
      const active = this.levelMgr.checkpointsHit.has(i);
      const x = Math.round(cp.x);
      const y = Math.round(cp.y);

      // pole
      ctx.fillStyle = '#2b3550';
      ctx.fillRect(x - 1, y - 34, 2, 34);
      // flag
      const wave = Math.sin(this.time * 4 + i) * 1.5;
      ctx.fillStyle = active ? '#5ef2a0' : '#3a4a6a';
      ctx.beginPath();
      ctx.moveTo(x + 1, y - 34);
      ctx.lineTo(x + 14 + wave, y - 29);
      ctx.lineTo(x + 1, y - 24);
      ctx.closePath();
      ctx.fill();

      if (active) {
        ctx.globalAlpha = 0.35 + Math.sin(this.time * 5) * 0.12;
        ctx.fillStyle = '#5ef2a0';
        ctx.fillRect(x - 3, y - 36, 8, 8);
        ctx.globalAlpha = 1;
      }
    }
  }

  drawGoal(level) {
    const ctx = this.ctx;
    const g = level.goal;
    const x = Math.round(g.x);
    const y = Math.round(g.y);
    const pulse = 0.5 + Math.sin(this.time * 3.5) * 0.25;

    // frame
    ctx.fillStyle = '#0d1a2a';
    ctx.fillRect(x - 4, y - 4, g.w + 8, g.h + 4);
    ctx.strokeStyle = '#5ef2a0';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 4.5, y - 4.5, g.w + 9, g.h + 5);

    // inner glow
    const grad = ctx.createLinearGradient(0, y, 0, y + g.h);
    grad.addColorStop(0, `rgba(94,242,160,${0.25 + pulse * 0.35})`);
    grad.addColorStop(1, 'rgba(109,242,255,0.05)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, g.w, g.h);

    // energy lines
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#5ef2a0';
    for (let i = 0; i < 5; i++) {
      const ly = y + 5 + ((i * 9 + this.time * 26) % (g.h - 10));
      ctx.fillRect(x + 3, Math.round(ly), g.w - 6, 1);
    }
    ctx.globalAlpha = 1;

    // outer glow
    ctx.globalAlpha = 0.18 + pulse * 0.12;
    ctx.fillStyle = '#5ef2a0';
    ctx.fillRect(x - 10, y - 10, g.w + 20, g.h + 20);
    ctx.globalAlpha = 1;
  }
}
