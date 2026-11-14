/* TRAP WORLD — DOM interface controller */
import { LEVELS } from './levels.js';
import { SaveSystem } from './save-system.js';
import { settings } from './settings.js';
import { audio } from './audio.js';
import { formatTime } from './utilities.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.screens = {};
    document.querySelectorAll('.screen').forEach((s) => { this.screens[s.id] = s; });

    this.hud = document.getElementById('hud');
    this.touchControls = document.getElementById('touch-controls');
    this.toastEl = document.getElementById('toast');
    this.toastTimer = null;

    this.el = {
      level: document.getElementById('hud-level'),
      name: document.getElementById('hud-name'),
      deaths: document.getElementById('hud-deaths'),
      progressFill: document.getElementById('hud-progress-fill'),
      progressText: document.getElementById('hud-progress-text'),
      mute: document.getElementById('btn-mute'),
      pause: document.getElementById('btn-pause'),
      levelGrid: document.getElementById('level-grid'),
      completeName: document.getElementById('complete-name'),
      completeDeaths: document.getElementById('complete-deaths'),
      completeTime: document.getElementById('complete-time'),
      next: document.getElementById('btn-next'),
    };

    this.returnScreen = 'screen-menu';
    this.bind();
    this.syncSettingsInputs();
  }

  /* ---------------- screens ---------------- */

  showScreen(id, returnTo) {
    Object.values(this.screens).forEach((s) => s.classList.remove('active'));
    if (id && this.screens[id]) {
      this.screens[id].classList.add('active');
      if (returnTo) this.returnScreen = returnTo;
    }
  }

  hideAllScreens() {
    Object.values(this.screens).forEach((s) => s.classList.remove('active'));
  }

  showGameplay() {
    this.hideAllScreens();
    this.hud.classList.remove('hidden');
    if (document.body.classList.contains('touch-device')) {
      this.touchControls.classList.remove('hidden');
    }
  }

  showMenu() {
    this.hud.classList.add('hidden');
    this.touchControls.classList.add('hidden');
    this.showScreen('screen-menu');
  }

  /* ---------------- binding ---------------- */

  bind() {
    const click = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => { audio.play('click'); fn(); });
    };

    click('btn-play', () => this.game.playFromMenu());
    click('btn-levels', () => { this.buildLevelGrid(); this.showScreen('screen-levels'); });
    click('btn-settings', () => this.showScreen('screen-settings', 'screen-menu'));
    click('btn-help', () => this.showScreen('screen-help'));
    click('btn-credits', () => this.showScreen('screen-credits'));

    document.querySelectorAll('[data-back]').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.play('click');
        this.showScreen(this.returnScreen || 'screen-menu');
      });
    });

    click('btn-resume', () => this.game.resume());
    click('btn-restart', () => this.game.restartLevel());
    click('btn-pause-menu', () => this.game.toMenu());
    click('btn-pause-settings', () => this.showScreen('screen-settings', 'screen-pause'));

    click('btn-next', () => this.game.nextLevel());
    click('btn-replay', () => this.game.restartLevel());
    click('btn-complete-menu', () => this.game.toMenu());

    if (this.el.pause) {
      this.el.pause.addEventListener('click', () => { audio.play('click'); this.game.pause(); });
    }
    if (this.el.mute) {
      this.el.mute.addEventListener('click', () => {
        audio.init();
        audio.play('click');
        const on = !(settings.get('musicEnabled') || settings.get('sfxEnabled'));
        settings.set('musicEnabled', on);
        settings.set('sfxEnabled', on);
        this.updateMuteIcon();
        this.syncSettingsInputs();
      });
    }

    click('btn-reset-progress', () => {
      SaveSystem.resetProgress();
      this.buildLevelGrid();
      this.toast('PROGRESS RESET');
    });

    this.bindSettings();
  }

  bindSettings() {
    const sliders = [
      ['set-master', 'masterVolume', 'val-master'],
      ['set-music', 'musicVolume', 'val-music'],
      ['set-sfx', 'sfxVolume', 'val-sfx'],
    ];
    sliders.forEach(([id, key, labelId]) => {
      const el = document.getElementById(id);
      const label = document.getElementById(labelId);
      if (!el) return;
      el.addEventListener('input', () => {
        const v = Number(el.value) / 100;
        settings.set(key, v);
        if (label) label.textContent = el.value;
      });
    });

    const toggles = [
      ['set-music-on', 'musicEnabled'],
      ['set-sfx-on', 'sfxEnabled'],
      ['set-shake', 'screenShake'],
    ];
    toggles.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        settings.set(key, el.checked);
        if (key === 'screenShake') this.game.camera.enabled = el.checked;
        this.updateMuteIcon();
      });
    });

    const quality = document.getElementById('set-quality');
    if (quality) {
      quality.addEventListener('change', () => settings.set('quality', quality.value));
    }
  }

  syncSettingsInputs() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const check = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };

    set('set-master', Math.round(settings.get('masterVolume') * 100));
    set('set-music', Math.round(settings.get('musicVolume') * 100));
    set('set-sfx', Math.round(settings.get('sfxVolume') * 100));
    set('val-master', Math.round(settings.get('masterVolume') * 100));
    set('val-music', Math.round(settings.get('musicVolume') * 100));
    set('val-sfx', Math.round(settings.get('sfxVolume') * 100));

    check('set-music-on', settings.get('musicEnabled'));
    check('set-sfx-on', settings.get('sfxEnabled'));
    check('set-shake', settings.get('screenShake'));

    const q = document.getElementById('set-quality');
    if (q) q.value = settings.get('quality');

    this.updateMuteIcon();
  }

  updateMuteIcon() {
    if (!this.el.mute) return;
    const on = settings.get('musicEnabled') || settings.get('sfxEnabled');
    this.el.mute.textContent = on ? '♪' : '✕';
    this.el.mute.classList.toggle('muted', !on);
  }

  /* ---------------- level select ---------------- */

  buildLevelGrid() {
    const grid = this.el.levelGrid;
    if (!grid) return;
    grid.innerHTML = '';

    LEVELS.forEach((lvl, i) => {
      const unlocked = SaveSystem.isUnlocked(i);
      const completed = SaveSystem.isCompleted(i);

      const card = document.createElement('button');
      card.className = 'level-card' + (completed ? ' completed' : '');
      card.disabled = !unlocked;
      card.innerHTML =
        `<span class="level-num">${String(i + 1).padStart(2, '0')}</span>` +
        `<span class="level-title">${lvl.name}</span>` +
        `<span class="level-sub">${completed ? '✔ CLEARED' : unlocked ? 'PLAY' : 'LOCKED'}</span>`;

      card.addEventListener('click', () => {
        if (!unlocked) return;
        audio.play('click');
        this.game.startLevel(i);
      });
      grid.appendChild(card);
    });
  }

  /* ---------------- HUD ---------------- */

  updateHUD() {
    const game = this.game;
    const lvl = game.levelMgr.level;
    if (!lvl) return;

    if (this.el.level) this.el.level.textContent = String(game.currentLevel + 1);
    if (this.el.name) this.el.name.textContent = lvl.name;
    if (this.el.deaths) this.el.deaths.textContent = String(game.deaths);

    const startX = lvl.start.x;
    const endX = lvl.goal.x;
    const span = Math.max(1, endX - startX);
    const pct = Math.max(0, Math.min(100, ((game.player.x - startX) / span) * 100));

    if (this.el.progressFill) this.el.progressFill.style.width = pct.toFixed(1) + '%';
    if (this.el.progressText) this.el.progressText.textContent = Math.round(pct) + '%';
  }

  showComplete(levelIndex, deaths, time) {
    const lvl = LEVELS[levelIndex];
    if (this.el.completeName) this.el.completeName.textContent = lvl ? lvl.name : '';
    if (this.el.completeDeaths) this.el.completeDeaths.textContent = String(deaths);
    if (this.el.completeTime) this.el.completeTime.textContent = formatTime(time);

    const isLast = levelIndex >= LEVELS.length - 1;
    if (this.el.next) {
      this.el.next.disabled = isLast;
      this.el.next.textContent = isLast ? 'ALL LEVELS CLEARED' : 'NEXT LEVEL';
    }
    this.showScreen('screen-complete');
  }

  toast(text) {
    if (!this.toastEl) return;
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 1600);
  }
}
