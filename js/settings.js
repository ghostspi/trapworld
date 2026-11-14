/* TRAP WORLD — settings manager */
import { SaveSystem } from './save-system.js';
import { audio } from './audio.js';

const DEFAULTS = {
  masterVolume: 0.9,
  musicVolume: 0.35,
  sfxVolume: 0.7,
  musicEnabled: true,
  sfxEnabled: true,
  screenShake: true,
  quality: 'high',
};

class SettingsManager {
  constructor() {
    this.values = { ...DEFAULTS };
  }

  load() {
    const saved = SaveSystem.getSettings();
    if (saved && typeof saved === 'object') {
      this.values = { ...DEFAULTS, ...saved };
    }
    this.apply();
  }

  set(key, value) {
    if (!(key in DEFAULTS)) return;
    this.values[key] = value;
    this.apply();
    SaveSystem.setSettings(this.values);
  }

  get(key) { return this.values[key]; }

  apply() {
    const v = this.values;
    audio.setVolumes(v.masterVolume, v.musicVolume, v.sfxVolume);
    audio.setEnabled(v.musicEnabled, v.sfxEnabled);
  }
}

export const settings = new SettingsManager();
