/* TRAP WORLD — keyboard + virtual input manager */

const KEY_ACTIONS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  Escape: 'pause', KeyP: 'pause',
  KeyR: 'restart',
  KeyM: 'mute',
};

class InputManager {
  constructor() {
    this.down = { left: false, right: false, jump: false, pause: false, restart: false, mute: false };
    this.virtualDown = { left: false, right: false, jump: false };
    this.pressed = { left: false, right: false, jump: false, pause: false, restart: false, mute: false };
    this.attached = false;
  }

  attach(target = window) {
    if (this.attached) return;
    this.attached = true;

    this._onKeyDown = (e) => {
      const action = KEY_ACTIONS[e.code];
      if (!action) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      if (!this.down[action]) this.pressed[action] = true;
      this.down[action] = true;
    };

    this._onKeyUp = (e) => {
      const action = KEY_ACTIONS[e.code];
      if (!action) return;
      this.down[action] = false;
    };

    this._onBlur = () => this.reset();

    target.addEventListener('keydown', this._onKeyDown, { passive: false });
    target.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
  }

  isDown(action) { return !!(this.down[action] || this.virtualDown[action]); }

  justPressed(action) { return !!this.pressed[action]; }

  setVirtual(action, isDown) {
    if (!(action in this.virtualDown)) return;
    if (isDown && !this.virtualDown[action]) this.pressed[action] = true;
    this.virtualDown[action] = isDown;
  }

  endFrame() {
    this.pressed.left = false;
    this.pressed.right = false;
    this.pressed.jump = false;
    this.pressed.pause = false;
    this.pressed.restart = false;
    this.pressed.mute = false;
  }

  reset() {
    for (const k in this.down) this.down[k] = false;
    for (const k in this.virtualDown) this.virtualDown[k] = false;
    for (const k in this.pressed) this.pressed[k] = false;
  }
}

export const input = new InputManager();
