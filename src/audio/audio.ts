/** Procedural Web Audio: synthesized SFX + an adaptive layered music loop. No asset files needed. */

type Sfx =
  | 'click' | 'card' | 'pick' | 'place' | 'road' | 'field' | 'gun' | 'cannon' | 'missile' | 'rail' | 'zap'
  | 'frost' | 'flame' | 'gust' | 'hook' | 'boom' | 'bigBoom' | 'pop' | 'xp' | 'levelUp' | 'star' | 'wave'
  | 'boss' | 'phase' | 'leak' | 'lastStand' | 'gameOver' | 'skill' | 'hero' | 'supply' | 'error' | 'coin' | 'win';

const MIN_GAP: Partial<Record<Sfx, number>> = { gun: 0.05, pop: 0.04, zap: 0.06, boom: 0.06, frost: 0.06, xp: 0.03, flame: 0.12, gust: 0.1, cannon: 0.06, missile: 0.08, hook: 0.08 };

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private noiseBuf!: AudioBuffer;
  private last = new Map<Sfx, number>();
  private xpPitch = 0;
  private xpT = 0;
  sfxVol = 0.8;
  musicVol = 0.5;
  muted = false;
  // music
  private intensity = 0;
  private targetIntensity = 0;
  private nextNote = 0;
  private step = 0;
  private timer: number | null = null;
  private layers: GainNode[] = [];

  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.music = ctx.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    this.applyVolumes();
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    for (let i = 0; i < 5; i++) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.music);
      this.layers.push(g);
    }
    this.nextNote = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : 1;
    this.sfx.gain.value = this.sfxVol * 0.7;
    this.music.gain.value = this.musicVol * 0.35;
  }

  setIntensity(n: number): void {
    this.targetIntensity = Math.max(0, Math.min(4, n));
  }

  // ───────────── primitives ─────────────
  private env(g: GainNode, t: number, a: number, peak: number, dec: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, t = 0, dest?: AudioNode, attack = 0.005): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime + t;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, now);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
    this.env(g, now, attack, vol, dur);
    o.connect(g).connect(dest ?? this.sfx);
    o.start(now);
    o.stop(now + attack + dur + 0.05);
  }
  private noise(dur: number, vol: number, filter: BiquadFilterType, f0: number, f1: number, t = 0, q = 1, dest?: AudioNode): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime + t;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, now);
    bq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
    const g = ctx.createGain();
    this.env(g, now, 0.004, vol, dur);
    src.connect(bq).connect(g).connect(dest ?? this.sfx);
    src.start(now, Math.random() * 0.5);
    src.stop(now + dur + 0.05);
  }

  play(name: Sfx, opts: { vol?: number } = {}): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const gap = MIN_GAP[name];
    if (gap) {
      const l = this.last.get(name) ?? 0;
      if (now - l < gap) return;
      this.last.set(name, now);
    }
    const v = opts.vol ?? 1;
    const j = 1 + (Math.random() - 0.5) * 0.16;
    switch (name) {
      case 'click': this.tone('triangle', 900 * j, 700, 0.06, 0.25 * v); break;
      case 'card': this.noise(0.12, 0.25 * v, 'bandpass', 3000, 6000, 0, 2); this.tone('sine', 700 * j, 900, 0.08, 0.1 * v); break;
      case 'pick': this.tone('triangle', 520, 1040, 0.12, 0.3 * v); this.tone('sine', 1040, 1560, 0.15, 0.15 * v, 0.06); break;
      case 'place': this.tone('sine', 160 * j, 50, 0.25, 0.6 * v); this.noise(0.15, 0.3 * v, 'lowpass', 900, 200); break;
      case 'road': for (let i = 0; i < 3; i++) { this.tone('square', 180 - i * 20, 90, 0.07, 0.12 * v, i * 0.06); this.noise(0.06, 0.2 * v, 'bandpass', 600, 300, i * 0.06, 2); } break;
      case 'field': this.noise(0.6, 0.25 * v, 'bandpass', 400, 2400, 0, 0.8); this.tone('sine', 660, 990, 0.4, 0.12 * v, 0.1); this.tone('sine', 990, 1320, 0.4, 0.08 * v, 0.2); break;
      case 'gun': this.noise(0.04, 0.16 * v, 'highpass', 2500 * j, 1500, 0, 1); this.tone('square', 300 * j, 120, 0.03, 0.05 * v); break;
      case 'cannon': this.tone('sine', 120 * j, 40, 0.3, 0.55 * v); this.noise(0.18, 0.35 * v, 'lowpass', 2000, 200); break;
      case 'missile': this.noise(0.35, 0.15 * v, 'bandpass', 800, 3000, 0, 3); break;
      case 'rail': this.tone('sawtooth', 2000 * j, 200, 0.25, 0.15 * v); this.noise(0.1, 0.2 * v, 'highpass', 4000, 2000); break;
      case 'zap': this.tone('sawtooth', 900 * j, 300, 0.09, 0.1 * v); this.noise(0.08, 0.15 * v, 'bandpass', 5000, 2000, 0, 4); break;
      case 'frost': this.tone('sine', 1800 * j, 2400, 0.12, 0.1 * v); this.tone('triangle', 2700 * j, 3200, 0.1, 0.05 * v, 0.03); break;
      case 'flame': this.noise(0.2, 0.12 * v, 'lowpass', 1400, 600, 0, 0.7); break;
      case 'gust': this.noise(0.35, 0.2 * v, 'bandpass', 300, 1500, 0, 1.5); break;
      case 'hook': this.tone('square', 1200 * j, 800, 0.05, 0.08 * v); this.noise(0.12, 0.1 * v, 'bandpass', 2500, 1200, 0.02, 3); break;
      case 'boom': this.tone('sine', 90 * j, 30, 0.35, 0.5 * v); this.noise(0.3, 0.4 * v, 'lowpass', 1800, 120); break;
      case 'bigBoom': this.tone('sine', 70, 25, 0.9, 0.8 * v); this.noise(0.9, 0.6 * v, 'lowpass', 2500, 60); break;
      case 'pop': this.tone('triangle', 500 * j, 200, 0.06, 0.12 * v); break;
      case 'xp': {
        if (now - this.xpT > 0.4) this.xpPitch = 0;
        this.xpT = now;
        this.xpPitch = Math.min(this.xpPitch + 1, 14);
        const f = 880 * Math.pow(2, this.xpPitch / 24);
        this.tone('sine', f, f * 1.01, 0.06, 0.06 * v);
        break;
      }
      case 'levelUp': [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.22 * v, i * 0.07)); break;
      case 'star': [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone('sine', f, f, 0.16, 0.16 * v, i * 0.05)); break;
      case 'wave': this.tone('sawtooth', 220, 220, 0.35, 0.12 * v, 0, undefined, 0.05); this.tone('sawtooth', 330, 330, 0.35, 0.1 * v, 0.12, undefined, 0.05); break;
      case 'boss': this.tone('sawtooth', 110, 55, 1.4, 0.35 * v, 0, undefined, 0.1); this.noise(1.2, 0.3 * v, 'lowpass', 600, 80); this.tone('square', 82, 41, 1.4, 0.15 * v); break;
      case 'phase': [196, 233, 294, 392].forEach((f, i) => this.tone('sawtooth', f, f, 0.5, 0.1 * v, i * 0.09, undefined, 0.02)); break;
      case 'leak': this.tone('square', 220, 110, 0.25, 0.2 * v); this.tone('sine', 80, 40, 0.3, 0.4 * v); break;
      case 'lastStand': this.tone('sine', 60, 30, 1.6, 0.9 * v); this.noise(1.4, 0.5 * v, 'lowpass', 4000, 80); [392, 523, 659, 784].forEach((f, i) => this.tone('triangle', f, f, 0.6, 0.15 * v, 0.3 + i * 0.1)); break;
      case 'gameOver': [392, 330, 262, 196].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.5, 0.2 * v, i * 0.25)); break;
      case 'skill': this.noise(0.4, 0.25 * v, 'bandpass', 600, 4000, 0, 1); this.tone('sine', 300, 900, 0.3, 0.15 * v); break;
      case 'hero': [262, 392, 523].forEach((f) => this.tone('sawtooth', f, f, 0.6, 0.12 * v, 0, undefined, 0.02)); this.noise(0.5, 0.25 * v, 'bandpass', 500, 3000, 0, 1); break;
      case 'supply': [659, 784, 988, 1319].forEach((f, i) => this.tone('sine', f, f, 0.2, 0.18 * v, i * 0.08)); break;
      case 'coin': this.tone('square', 988, 988, 0.06, 0.1 * v); this.tone('square', 1319, 1319, 0.15, 0.1 * v, 0.06); break;
      case 'error': this.tone('square', 160, 120, 0.15, 0.15 * v); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.3, 0.2 * v, i * 0.1)); break;
    }
  }

  // ───────────── music ─────────────
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.intensity += (this.targetIntensity - this.intensity) * 0.05;
    const lv = [1, this.intensity >= 0.6 ? 1 : 0, this.intensity >= 1.5 ? 1 : 0, this.intensity >= 2.5 ? 1 : 0, this.intensity >= 3.5 ? 1 : 0];
    this.layers.forEach((g, i) => g.gain.setTargetAtTime(lv[i] * [0.55, 0.6, 0.55, 0.35, 0.3][i], ctx.currentTime, 0.8));
    const bpm = 96 + Math.round(this.intensity) * 6;
    const s16 = 60 / bpm / 4;
    while (this.nextNote < ctx.currentTime + 0.2) {
      this.musicStep(this.step, this.nextNote, s16);
      this.step = (this.step + 1) % 128;
      this.nextNote += s16;
    }
  }

  private musicStep(step: number, t: number, s16: number): void {
    const ctx = this.ctx!;
    const chords = [
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [48, 52, 55], // C
      [55, 59, 62], // G
    ];
    const bar = Math.floor(step / 16) % 8;
    const chord = chords[Math.floor(bar / 2) % 4];
    const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const inBar = step % 16;
    const voice = (layer: number, type: OscillatorType, f: number, dur: number, vol: number, filt = 2000) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const bq = ctx.createBiquadFilter();
      bq.type = 'lowpass';
      bq.frequency.value = filt;
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.08, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(bq).connect(g).connect(this.layers[layer]);
      o.start(t);
      o.stop(t + dur + 0.05);
    };
    const drum = (layer: number, kind: 'kick' | 'snare' | 'hat', vol: number) => {
      if (kind === 'kick') {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g).connect(this.layers[layer]);
        o.start(t);
        o.stop(t + 0.25);
      } else {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const bq = ctx.createBiquadFilter();
        bq.type = kind === 'hat' ? 'highpass' : 'bandpass';
        bq.frequency.value = kind === 'hat' ? 7000 : 1800;
        const g = ctx.createGain();
        const d = kind === 'hat' ? 0.04 : 0.14;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        src.connect(bq).connect(g).connect(this.layers[layer]);
        src.start(t, Math.random() * 0.5);
        src.stop(t + d + 0.02);
      }
    };
    // layer 0: pad
    if (inBar === 0 && bar % 2 === 0) for (const n of chord) voice(0, 'triangle', mtof(n), s16 * 30, 0.06, 1200);
    // layer 1: bass + hats
    if (inBar % 4 === 0) voice(1, 'sawtooth', mtof(chord[0] - 24), s16 * 3, 0.12, 400);
    if (inBar % 2 === 1) drum(1, 'hat', 0.05);
    // layer 2: kick + snare
    if (inBar % 4 === 0) drum(2, 'kick', 0.5);
    if (inBar === 4 || inBar === 12) drum(2, 'snare', 0.18);
    // layer 3: arp
    if (inBar % 2 === 0) {
      const n = chord[(inBar / 2) % 3] + 12 + (inBar >= 8 ? 12 : 0);
      voice(3, 'square', mtof(n), s16 * 1.6, 0.04, 2400);
    }
    // layer 4: boss pulse
    if (inBar % 1 === 0) voice(4, 'sawtooth', mtof(chord[0] - 12 + (inBar % 8 < 4 ? 0 : 1)), s16 * 0.9, 0.05, 900);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
  }
}

export const audio = new AudioEngine();
