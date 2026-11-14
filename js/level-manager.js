/* TRAP WORLD — level loading, trap lifecycle, solid/hazard aggregation */
import { LEVELS } from './levels.js';
import { createTrap } from './traps.js';
import { deepClone } from './utilities.js';

export class LevelManager {
  constructor() {
    this.level = null;
    this.traps = [];
    this.index = 0;
    this.allSolids = [];
    this.allHazards = [];
    this.checkpoint = { x: 40, y: 216 };
    this.checkpointsHit = new Set();
    this.spawn = { x: 40, y: 216 };
  }

  load(index) {
    this.index = index;
    const src = LEVELS[index];
    this.level = deepClone(src);
    this.traps = this.level.traps.map((def) => createTrap(def, this.level));
    this.checkpointsHit = new Set();
    this.spawn = { x: this.level.start.x, y: this.level.start.y };
    this.checkpoint = { x: this.spawn.x, y: this.spawn.y };
    this.refresh();
  }

  resetTraps() {
    for (let i = 0; i < this.traps.length; i++) this.traps[i].reset();
    this.refresh();
  }

  updateTraps(dt, game) {
    const world = { player: game.player, level: this.level, game };
    for (let i = 0; i < this.traps.length; i++) this.traps[i].update(dt, world);
    this.refresh();
  }

  refresh() {
    const solids = this.allSolids;
    solids.length = 0;
    const platforms = this.level.platforms;
    for (let i = 0; i < platforms.length; i++) solids.push(platforms[i]);

    const hazards = this.allHazards;
    hazards.length = 0;

    for (let i = 0; i < this.traps.length; i++) {
      const t = this.traps[i];
      for (let j = 0; j < t.solids.length; j++) solids.push(t.solids[j]);
      for (let j = 0; j < t.hazards.length; j++) hazards.push(t.hazards[j]);
    }
  }

  getSolids() { return this.allSolids; }
  getHazards() { return this.allHazards; }

  /** Returns true if this checkpoint is new. */
  registerCheckpoint(cpIndex) {
    if (this.checkpointsHit.has(cpIndex)) return false;
    this.checkpointsHit.add(cpIndex);
    const cp = this.level.checkpoints[cpIndex];
    this.checkpoint = { x: cp.x - 5, y: cp.y - 14 };
    return true;
  }

  respawnPoint() {
    return { x: this.checkpoint.x, y: this.checkpoint.y };
  }
}
