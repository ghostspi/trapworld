/* TRAP WORLD — procedural audio engine (WebAudio, no external assets) */

class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;

    this.masterVolume = 0.9;
    this.musicVolume = 0.35;
    this.sfxVolume = 0.7;
    this.musicEnabled = true;
    this.sfxEnabled = true;

    this.musicTimer = null;
    this.musicStep = 0;
    this.nextNoteTime = 0;
    this.theme = null;
    this.failed = false;
  }

  init() {
    if (this.ctx || this.failed) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.failed = true; return; }
      this.ctx = new AC();

      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVolume;
      this.master.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVolume;
      this.sfxBus.connect(this.master);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicVolume;
      this.musicBus.connect(this.master);
    } catch (err) {
      this.failed = true;
      this.ctx = null;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setVolumes(master, music, sfx) {
    this.masterVolume = master;
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (this.master) this.master.gain.value = master;
    if (this.musicBus) this.musicBus.gain.value = music;
    if (this.sfxBus) this.sfxBus.gain.value = sfx;
  }

  setEnabled(musicOn, sfxOn) {
    this.musicEnabled = musicOn;
    this.sfxEnabled = sfxOn;
    if (!musicOn) this.stopMusic();
  }

  /* ---------------- low-level helpers ---------------- */

  _tone({ freq = 440, freq2 = null, dur = 0.12, type = 'square', gain = 0.25, delay = 0, bus = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freq2 !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(bus || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise({ dur = 0.12, gain = 0.2, filterFreq = 1200, delay = 0, bus = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus || this.sfxBus);
    src.start(t0);
  }

  /* ---------------- public SFX API ---------------- */

  play(name) {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;

    switch (name) {
      case 'jump':
        this._tone({ freq: 420, freq2: 720, dur: 0.11, type: 'square', gain: 0.16 });
        break;
      case 'doubleJump':
        this._tone({ freq: 620, freq2: 1080, dur: 0.14, type: 'square', gain: 0.17 });
        this._tone({ freq: 930, freq2: 1500, dur: 0.1, type: 'triangle', gain: 0.08, delay: 0.03 });
        break;
      case 'land':
        this._noise({ dur: 0.09, gain: 0.14, filterFreq: 600 });
        break;
      case 'death':
        this._tone({ freq: 300, freq2: 60, dur: 0.5, type: 'sawtooth', gain: 0.22 });
        this._noise({ dur: 0.35, gain: 0.18, filterFreq: 900 });
        break;
      case 'checkpoint':
        this._tone({ freq: 660, dur: 0.1, type: 'triangle', gain: 0.18 });
        this._tone({ freq: 990, dur: 0.16, type: 'triangle', gain: 0.16, delay: 0.09 });
        break;
      case 'trap':
        this._tone({ freq: 150, freq2: 80, dur: 0.14, type: 'square', gain: 0.14 });
        break;
      case 'impact':
        this._noise({ dur: 0.25, gain: 0.26, filterFreq: 500 });
        this._tone({ freq: 110, freq2: 50, dur: 0.25, type: 'sawtooth', gain: 0.18 });
        break;
      case 'complete':
        [523, 659, 784, 1046].forEach((f, i) => {
          this._tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.17, delay: i * 0.1 });
        });
        break;
      case 'click':
        this._tone({ freq: 880, freq2: 660, dur: 0.06, type: 'square', gain: 0.1 });
        break;
      case 'teleport':
        this._tone({ freq: 200, freq2: 1400, dur: 0.22, type: 'sine', gain: 0.18 });
        break;
      default:
        break;
    }
  }

  /* ---------------- music ---------------- */

  startMusic(theme) {
    this.init();
    if (!this.ctx || !this.musicEnabled) return;
    if (this.theme === theme && this.musicTimer) return;
    this.stopMusic();
    this.theme = theme;
    this.musicStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.15;
    this.musicTimer = setInterval(() => this._schedule(), 80);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.theme = null;
  }

  _schedule() {
    if (!this.ctx || !this.musicTimer) return;
    // recover if the tab was throttled
    if (this.nextNoteTime < this.ctx.currentTime - 0.5) {
      this.nextNoteTime = this.ctx.currentTime + 0.05;
    }
    const STEP = 0.26;
    let guard = 0;
    while (this.nextNoteTime < this.ctx.currentTime + 0.3 && guard < 16) {
      this._note(this.musicStep, this.nextNoteTime - this.ctx.currentTime);
      this.nextNoteTime += STEP;
      this.musicStep = (this.musicStep + 1) % 32;
      guard++;
    }
  }

  _note(step, delay) {
    if (!this.musicEnabled) return;

    const scales = {
      forest: [0, 3, 5, 7, 10],
      castle: [0, 2, 3, 7, 8],
      lava: [0, 1, 5, 6, 8],
      factory: [0, 2, 5, 7, 9],
      nightmare: [0, 1, 4, 6, 7],
      menu: [0, 4, 7, 11, 14],
    };
    const scale = scales[this.theme] || scales.menu;
    const base = this.theme === 'lava' ? 98 : this.theme === 'nightmare' ? 82 : 110;

    // sparse pattern — only certain steps make sound
    const pattern = [0, 3, 6, 8, 11, 14, 19, 22, 25, 28];
    if (!pattern.includes(step)) return;

    const degree = scale[(step / 2 | 0) % scale.length];
    const freq = base * Math.pow(2, degree / 12) * (step % 8 === 0 ? 1 : 2);

    this._tone({
      freq,
      dur: 0.42,
      type: 'triangle',
      gain: 0.085,
      delay: Math.max(0, delay),
      bus: this.musicBus,
    });

    if (step % 8 === 0) {
      this._tone({
        freq: base / 2,
        dur: 0.7,
        type: 'sine',
        gain: 0.11,
        delay: Math.max(0, delay),
        bus: this.musicBus,
      });
    }
  }
}

export const audio = new AudioManager();
