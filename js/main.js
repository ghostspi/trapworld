/* TRAP WORLD — entry point */
import { Game } from './game.js';
import { input } from './input.js';
import { settings } from './settings.js';
import { audio } from './audio.js';
import { initMobileControls } from './mobile-controls.js';

function boot() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('[TRAP WORLD] canvas not found');
    return;
  }

  settings.load();
  input.attach(window);
  initMobileControls();

  const game = new Game(canvas);
  game.start();

  // expose for debugging
  window.TRAPWORLD = game;

  // unlock audio on the first interaction (browser autoplay policy)
  const unlock = () => {
    audio.init();
    audio.resume();
    if (game.state === 'menu') audio.startMusic('menu');
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
    document.removeEventListener('touchstart', unlock);
  };
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('keydown', unlock);
  document.addEventListener('touchstart', unlock, { passive: true });

  // pause automatically if the tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') game.pause();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
