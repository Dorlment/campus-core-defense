/* ============================================================
   坦克大战 · 音频系统（Web Audio 本地合成，无外部资源）
   ============================================================ */
window.TB = window.TB || {};

TB.AudioManager = class {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.volume = 0.7;
    this.enabled = true;       // 不支持 Web Audio 时降级为静音
    this._bgmTimer = null;
    this._bgmStep = 0;
  }

  /* 首次用户交互后调用，创建/恢复音频上下文 */
  unlock() {
    this._init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.musicOn) this.startBGM();
  }

  _init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.85;
      this.sfxGain.connect(this.master);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);
    } catch (e) {
      this.enabled = false;
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v / 100));
    if (this.master) this.master.gain.value = this.volume;
  }
  setMusic(on) {
    this.musicOn = on;
    if (on) this.startBGM(); else this.stopBGM();
  }
  setSfx(on) { this.sfxOn = on; }

  /* ---------- 基础合成 ---------- */
  _now() { return this.ctx ? this.ctx.currentTime : 0; }

  _tone(freq, dur, type = 'square', gain = 0.3, when = 0, dest = null) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this._now() + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest || this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise(dur, gain = 0.4, cutoff = 1400) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this._now();
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(lp); lp.connect(g); g.connect(this.sfxGain);
    src.start(t);
  }

  /* ---------- 事件音效 ---------- */
  play(name) {
    if (!this.enabled) return;
    this._init();
    if (!this.ctx || !this.sfxOn) return;
    switch (name) {
      case 'shoot':
        this._tone(620, 0.09, 'square', 0.22);
        this._tone(320, 0.10, 'square', 0.12, 0.0);
        break;
      case 'hit':
        this._tone(220, 0.05, 'square', 0.18);
        break;
      case 'explosion':
        this._noise(0.32, 0.5, 900);
        this._tone(120, 0.25, 'sawtooth', 0.18);
        break;
      case 'bigExplosion':
        this._noise(0.55, 0.6, 700);
        this._tone(90, 0.4, 'sawtooth', 0.22);
        break;
      case 'powerup':
        this._tone(523, 0.08, 'square', 0.25);
        this._tone(659, 0.08, 'square', 0.25, 0.08);
        this._tone(784, 0.12, 'square', 0.25, 0.16);
        break;
      case 'spawn':
        this._tone(300, 0.06, 'triangle', 0.18);
        this._tone(450, 0.06, 'triangle', 0.15, 0.06);
        break;
      case 'levelup':
        this._tone(523, 0.12, 'square', 0.25);
        this._tone(784, 0.18, 'square', 0.25, 0.12);
        break;
      case 'freeze':
        this._tone(1200, 0.18, 'sine', 0.18);
        this._tone(900, 0.22, 'sine', 0.14, 0.05);
        break;
      case 'shield':
        this._tone(700, 0.1, 'triangle', 0.2);
        this._tone(1050, 0.12, 'triangle', 0.16, 0.06);
        break;
      case 'gameover':
        this._tone(440, 0.2, 'sawtooth', 0.25);
        this._tone(330, 0.25, 'sawtooth', 0.25, 0.2);
        this._tone(220, 0.4, 'sawtooth', 0.25, 0.42);
        break;
      case 'win':
        this._tone(523, 0.12, 'square', 0.25);
        this._tone(659, 0.12, 'square', 0.25, 0.12);
        this._tone(784, 0.12, 'square', 0.25, 0.24);
        this._tone(1047, 0.3, 'square', 0.25, 0.36);
        break;
    }
  }

  /* ---------- 循环 BGM（简单步进音序） ---------- */
  startBGM() {
    if (!this.enabled) return;
    this._init();
    if (!this.ctx || !this.musicOn || this._bgmTimer) return;
    // A 小调律动：低音 + 主旋律
    const bass = [110, 110, 146.83, 146.83, 130.81, 130.81, 98, 98];
    const lead = [440, 523.25, 659.25, 523.25, 587.33, 523.25, 440, 392];
    const stepMs = 230;
    this._bgmStep = 0;
    const tick = () => {
      if (!this.ctx || !this.musicOn) return;
      const i = this._bgmStep % 8;
      const t = this._now() + 0.02;
      // 低音
      this._bgmNote(bass[i], 0.22, 'triangle', 0.5, t);
      // 主旋律（隔拍）
      if (i % 2 === 0) this._bgmNote(lead[i], 0.2, 'square', 0.28, t);
      this._bgmStep++;
    };
    tick();
    this._bgmTimer = setInterval(tick, stepMs);
  }

  _bgmNote(freq, dur, type, gain, t) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  stopBGM() {
    if (this._bgmTimer) {
      clearInterval(this._bgmTimer);
      this._bgmTimer = null;
    }
  }
};
