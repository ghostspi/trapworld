/* TRAP WORLD — touch controls */
import { input } from './input.js';

export function initMobileControls() {
  const isTouch =
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0);

  document.body.classList.toggle('touch-device', isTouch);

  const root = document.getElementById('touch-controls');
  if (!root) return;

  const buttons = root.querySelectorAll('[data-action]');

  buttons.forEach((btn) => {
    const action = btn.dataset.action;

    const press = (e) => {
      e.preventDefault();
      btn.classList.add('active');
      input.setVirtual(action, true);
    };
    const release = (e) => {
      if (e) e.preventDefault();
      btn.classList.remove('active');
      input.setVirtual(action, false);
    };

    btn.addEventListener('pointerdown', (e) => {
      press(e);
      try { btn.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // Release everything if the app loses focus
  window.addEventListener('blur', () => {
    buttons.forEach((b) => {
      b.classList.remove('active');
      input.setVirtual(b.dataset.action, false);
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      buttons.forEach((b) => {
        b.classList.remove('active');
        input.setVirtual(b.dataset.action, false);
      });
    }
  });
}
