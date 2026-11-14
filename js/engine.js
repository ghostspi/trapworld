/* TRAP WORLD — canvas sizing / responsive scaling */
export class Engine {
  constructor(canvas, viewW, viewH) {
    this.canvas = canvas;
    this.viewW = viewW;
    this.viewH = viewH;
    this.wrap = canvas.parentElement || document.body;

    canvas.width = viewW;
    canvas.height = viewH;

    this._raf = 0;
    this._onResize = () => {
      cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(() => this.resize());
    };

    window.addEventListener('resize', this._onResize, { passive: true });
    window.addEventListener('orientationchange', this._onResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this._onResize, { passive: true });
    }

    this.resize();
  }

  resize() {
    const rect = this.wrap.getBoundingClientRect();
    const availW = Math.max(64, rect.width || window.innerWidth);
    const availH = Math.max(36, rect.height || window.innerHeight);
    const scale = Math.min(availW / this.viewW, availH / this.viewH);
    const w = Math.max(64, Math.floor(this.viewW * scale));
    const h = Math.max(36, Math.floor(this.viewH * scale));

    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.scale = scale;

    // portrait hint on touch devices
    if (document.body.classList.contains('touch-device')) {
      const portrait = window.innerHeight > window.innerWidth;
      document.body.classList.toggle('portrait-hint', portrait && window.innerWidth < 700);
    }
  }
}
