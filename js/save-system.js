/* TRAP WORLD — local persistence layer
   Designed so it can later be swapped for an online backend:
   every read/write goes through this single module. */

const STORAGE_KEY = 'trapworld_save_v1';

const DEFAULT_SAVE = {
  unlocked: 1,        // number of unlocked levels (1 = first level only)
  completed: [],      // array of level indices (0-based)
  bestDeaths: {},     // { levelIndex: deaths }
  settings: null,
};

class SaveSystemClass {
  constructor() {
    this.available = true;
    this.data = {
      unlocked: DEFAULT_SAVE.unlocked,
      completed: [],
      bestDeaths: {},
      settings: null,
    };
    this.load();
  }

  load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.data = {
            unlocked: typeof parsed.unlocked === 'number' ? parsed.unlocked : 1,
            completed: Array.isArray(parsed.completed) ? parsed.completed.filter((n) => typeof n === 'number') : [],
            bestDeaths: parsed.bestDeaths && typeof parsed.bestDeaths === 'object' ? parsed.bestDeaths : {},
            settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : null,
          };
        }
      }
    } catch (err) {
      this.available = false;
      this.data = { unlocked: 1, completed: [], bestDeaths: {}, settings: null };
    }
  }

  save() {
    if (!this.available) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (err) {
      this.available = false;
    }
  }

  isUnlocked(index) { return index < this.data.unlocked; }

  isCompleted(index) { return this.data.completed.includes(index); }

  unlockLevel(index) {
    const needed = index + 1;
    if (this.data.unlocked < needed) {
      this.data.unlocked = needed;
      this.save();
    }
  }

  completeLevel(index, deaths) {
    if (!this.data.completed.includes(index)) this.data.completed.push(index);
    const prev = this.data.bestDeaths[index];
    if (prev === undefined || deaths < prev) this.data.bestDeaths[index] = deaths;
    this.unlockLevel(index + 1);
    this.save();
  }

  getSettings() { return this.data.settings; }

  setSettings(settingsObj) {
    this.data.settings = settingsObj;
    this.save();
  }

  resetProgress() {
    this.data.unlocked = 1;
    this.data.completed = [];
    this.data.bestDeaths = {};
    this.save();
  }
}

export const SaveSystem = new SaveSystemClass();
