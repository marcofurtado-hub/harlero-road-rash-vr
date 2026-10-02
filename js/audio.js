// Áudio 100% sintetizado: rock procedural (guitarra distorcida, baixo, bateria, solo) + SFX
import { G, clamp, rand, pick } from './ctx.js';

function distCurve(k) {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return c;
}

const E2 = 82.41;
const RIFFS = [
  'C..C..C.P.P.3.5.',
  'P.PPP.PPP.PPC...',
  'PPPPPPPPC...C...',
  'C.P.3.P.5.P.6.5.',
  'C...P.PPC...5.3.',
  'P.P.PPP.P.P.3.5.',
  'PPP.PPP.PP.PC.5.',
  'C.PP3.PP5.PP6.5.',
];
const CALM_RIFFS = ['C...P.P.C...P.P.', 'C.......5...3...', 'C...C...5...3.2.'];
const MENU_RIFFS = ['C...............', 'C.......5.......', 'C...........3.5.'];
const PROGS = [
  [0, 0, 0, 0],
  [0, 0, 3, 5],
  [0, -2, -4, -2],
  [5, 3, 0, 0],
  [0, 7, 5, 3],
  [0, 0, 5, 3],
  [0, 3, 0, -2],
];
const DRUMS = {
  half: { k: 'K.........K.....', s: '........S.......', h: 'h.h.h.h.h.h.h.h.' },
  rock: { k: 'K.......K.K.....', s: '....S.......S...', h: 'h.h.h.h.h.h.h.h.' },
  drive: { k: 'K..K..K.K..K..K.', s: '....S.......S...', h: 'hhhhhhhhhhhhhhhh' },
  punk: { k: 'K...K...K...K...', s: '..S...S...S...S.', h: 'h.h.h.h.h.h.h.h.' },
  double: { k: 'KKKKKKKKKKKKKKKK', s: '....S.......S...', h: 'o...o...o...o...' },
};
const INTERVAL = { 2: 2, 3: 3, 5: 5, 6: 6, 7: 7, a: 10, c: 12 };
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27];

const GUN_SFX = {
  pistol: { vol: 0.8, ft: 'lowpass', ff: 3800, nd: 0.16, f0: 170, f1: 50, td: 0.12 },
  shotgun: { vol: 1.0, ft: 'lowpass', ff: 2400, nd: 0.38, f0: 120, f1: 35, td: 0.26 },
  smg: { vol: 0.5, ft: 'bandpass', ff: 3000, nd: 0.07, f0: 220, f1: 80, td: 0.05 },
  magnum: { vol: 1.15, ft: 'lowpass', ff: 3000, nd: 0.5, f0: 95, f1: 28, td: 0.35 },
  tommy: { vol: 0.6, ft: 'bandpass', ff: 2200, nd: 0.09, f0: 180, f1: 60, td: 0.07 },
  bazooka: { vol: 1.1, ft: 'lowpass', ff: 1200, nd: 0.6, f0: 160, f1: 40, td: 0.4 },
  launcher: { vol: 0.8, ft: 'lowpass', ff: 900, nd: 0.12, f0: 320, f1: 110, td: 0.16 },
  gatling: { vol: 0.42, ft: 'highpass', ff: 1800, nd: 0.05, f0: 240, f1: 90, td: 0.04 },
  enemy: { vol: 0.45, ft: 'lowpass', ff: 2200, nd: 0.14, f0: 150, f1: 50, td: 0.1 },
  enemyShotgun: { vol: 0.6, ft: 'lowpass', ff: 1800, nd: 0.3, f0: 110, f1: 35, td: 0.2 },
  sniper: { vol: 0.9, ft: 'highpass', ff: 1200, nd: 0.35, f0: 140, f1: 40, td: 0.2 },
};

class Music {
  constructor(a) {
    this.a = a;
    this.ctx = a.ctx;
    this.bpm = 118;
    this.step = 0;
    this.bar = 0;
    this.mode = 'menu';
    this.pending = true;
    this.lead = false;
    this.leadIdx = 5;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.pickSection();
    this.timer = setInterval(() => this.tick(), 25);
  }
  get stepDur() {
    return 60 / this.bpm / 4;
  }
  setMode(m) {
    if (m !== this.mode) {
      this.mode = m;
      this.pending = true;
    }
  }
  pickSection() {
    const m = this.mode;
    if (m === 'menu') {
      this.sec = { riff: pick(MENU_RIFFS), prog: pick([[0, 0, 5, 3], [0, 0, 3, 5], [0, -2, -4, -2]]), drums: 'half', fills: false };
      this.bpm = 118;
      this.gtrLevel = 0.6;
      this.lead = false;
    } else if (m === 'calm') {
      this.sec = { riff: pick(CALM_RIFFS), prog: pick(PROGS), drums: 'rock', fills: true };
      this.bpm = 132;
      this.gtrLevel = 0.8;
      this.lead = false;
    } else if (m === 'boss') {
      this.sec = { riff: pick([RIFFS[1], RIFFS[2], RIFFS[6], RIFFS[7]]), prog: pick(PROGS), drums: pick(['double', 'drive', 'double']), fills: true };
      this.bpm = 166;
      this.gtrLevel = 1;
      this.lead = Math.random() < 0.7;
    } else {
      this.sec = { riff: pick(RIFFS), prog: pick(PROGS), drums: pick(['rock', 'drive', 'punk', 'drive']), fills: true };
      this.bpm = 150 + Math.min(G.wave, 10);
      this.gtrLevel = 1;
      this.lead = G.furyT > 0 || (G.wave >= 3 && Math.random() < 0.3);
    }
    this.a.gtrOut.gain.setTargetAtTime(0.16 * this.gtrLevel, this.ctx.currentTime, 0.2);
  }
  tick() {
    const ctx = this.ctx;
    if (ctx.state !== 'running') return;
    if (this.nextTime < ctx.currentTime - 0.3) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.12) {
      if (this.a.musicOn) this.playStep(this.step % 16, this.nextTime);
      this.nextTime += this.stepDur;
      this.step++;
      if (this.step % 16 === 0) {
        this.bar++;
        if (this.pending || this.bar % 4 === 0) {
          const wasPending = this.pending;
          this.pending = false;
          this.bar = 0;
          this.pickSection();
          if (wasPending) this.crashNext = true;
        }
      }
    }
  }
  playStep(s, t) {
    const a = this.a;
    const sec = this.sec;
    const bip = this.bar % 4;
    const root = sec.prog[bip];
    const D = DRUMS[sec.drums];
    if (s === 0 && (this.crashNext || (bip === 0 && this.mode !== 'menu'))) {
      a.crash(t);
      this.crashNext = false;
    }
    const fill = sec.fills && bip === 3 && s >= 12;
    if (fill) {
      if (s === 12) a.kick(t);
      if (s < 14) a.snare(t, 0.6 + (s - 12) * 0.15);
      else a.tom(t, s === 14 ? 120 : 85);
    } else {
      if (D.k[s] === 'K') a.kick(t, sec.drums === 'double' ? 0.7 : 1);
      if (D.s[s] === 'S') a.snare(t, 1);
      if (D.h[s] === 'h') a.hat(t, s % 4 === 0 ? 0.22 : 0.13, false);
      if (D.h[s] === 'o') a.hat(t, 0.25, true);
    }
    const tok = sec.riff[s];
    if (tok !== '.') {
      let n = 1;
      while (s + n < 16 && sec.riff[s + n] === '.') n++;
      const dur = n * this.stepDur;
      if (tok === 'P') a.chord(t, root, Math.min(dur, this.stepDur * 0.9), true);
      else if (tok === 'C') a.chord(t, root, dur, false);
      else a.chord(t, root + (INTERVAL[tok] || 0), dur, false);
      a.bass(t, root + (INTERVAL[tok] || 0), Math.min(dur, this.stepDur * 2));
    }
    if (this.lead && s % 2 === 0 && bip >= 2 && Math.random() < 0.85) {
      this.leadIdx = clamp(this.leadIdx + pick([-2, -1, -1, 1, 1, 2, 0]), 2, PENTA.length - 1);
      const long = Math.random() < 0.2;
      a.leadNote(t, PENTA[this.leadIdx] + root, this.stepDur * (long ? 4 : 2));
    }
  }
}

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.listener = { x: 0, y: 1.4, z: 0, rx: 1, ry: 0, rz: 0 };
    let saved = null;
    try {
      saved = localStorage.getItem('harlero_music');
    } catch (e) {
      /* sem storage */
    }
    this.musicOn = saved !== 'off';
  }

  // liga/desliga só a trilha (efeitos, motor e tiros continuam)
  setMusic(on) {
    this.musicOn = on;
    try {
      localStorage.setItem('harlero_music', on ? 'on' : 'off');
    } catch (e) {
      /* sem storage */
    }
    if (G.onMusicChange) G.onMusicChange(on);
  }
  toggleMusic() {
    this.setMusic(!this.musicOn);
    return this.musicOn;
  }

  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.5;
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.85;
    this.sfxBus.connect(this.master);
    this.drumBus = ctx.createGain();
    this.drumBus.gain.value = 0.75;
    this.drumBus.connect(this.musicBus);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.makeGuitar();
    this.makeBass();
    this.makeEngine();
    this.music = new Music(this);
  }

  get t() {
    return this.ctx.currentTime;
  }

  // ------------------------------------------------ cadeia da guitarra
  makeGuitar() {
    const ctx = this.ctx;
    this.gIn = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 90;
    const drive = ctx.createGain();
    drive.gain.value = 7;
    const shaper = ctx.createWaveShaper();
    shaper.curve = distCurve(60);
    shaper.oversample = '2x';
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3600;
    lp.Q.value = 0.8;
    const scoop = ctx.createBiquadFilter();
    scoop.type = 'peaking';
    scoop.frequency.value = 900;
    scoop.gain.value = -5;
    const low = ctx.createBiquadFilter();
    low.type = 'peaking';
    low.frequency.value = 160;
    low.gain.value = 4;
    this.gtrOut = ctx.createGain();
    this.gtrOut.gain.value = 0.16;
    this.gIn.connect(hp).connect(drive).connect(shaper).connect(lp).connect(scoop).connect(low).connect(this.gtrOut);
    // dobra estéreo (double tracking)
    const pl = ctx.createStereoPanner();
    pl.pan.value = -0.55;
    const pr = ctx.createStereoPanner();
    pr.pan.value = 0.55;
    const dl = ctx.createDelay();
    dl.delayTime.value = 0.014;
    this.gtrOut.connect(pl).connect(this.musicBus);
    this.gtrOut.connect(dl).connect(pr).connect(this.musicBus);
  }

  chord(t, semis, dur, muted) {
    const ctx = this.ctx;
    const f = E2 * Math.pow(2, semis / 12);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = muted ? 650 : 5000;
    g.connect(lp).connect(this.gIn);
    const freqs = muted ? [f, f * 1.4983] : [f, f * 1.4983, f * 2];
    const end = t + dur + 0.06;
    for (let i = 0; i < freqs.length; i++) {
      for (const dt of muted ? [0] : [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freqs[i];
        o.detune.value = dt;
        o.connect(g);
        o.start(t);
        o.stop(end);
      }
    }
    const v = muted ? 0.9 : 0.6;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.004);
    if (muted) g.gain.exponentialRampToValueAtTime(0.001, t + Math.min(dur, 0.13));
    else {
      g.gain.setTargetAtTime(v * 0.7, t + 0.02, 0.2);
      g.gain.setTargetAtTime(0.0001, t + dur, 0.02);
    }
  }

  leadNote(t, semis, dur) {
    const ctx = this.ctx;
    const f = 164.81 * Math.pow(2, semis / 12);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * (Math.random() < 0.3 ? 0.944 : 1), t);
    o.frequency.linearRampToValueAtTime(f, t + 0.06);
    const vib = ctx.createOscillator();
    vib.frequency.value = 6;
    const vg = ctx.createGain();
    vg.gain.value = f * 0.012;
    vib.connect(vg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.01);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.03);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 0.6;
    o.connect(g).connect(bp).connect(this.gIn);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.2);
    vib.stop(t + dur + 0.2);
  }

  makeBass() {
    const ctx = this.ctx;
    this.bassOut = ctx.createGain();
    this.bassOut.gain.value = 0.45;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 650;
    this.bassIn = lp;
    lp.connect(this.bassOut).connect(this.musicBus);
  }
  bass(t, semis, dur) {
    const ctx = this.ctx;
    const f = (E2 / 2) * Math.pow(2, semis / 12);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.value = f / 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.7, t + 0.005);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.8, 0.04);
    o.connect(g);
    o2.connect(g);
    g.connect(this.bassIn);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.2);
    o2.stop(t + dur + 0.2);
  }

  // ------------------------------------------------ bateria
  noise(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.start(t, Math.random() * 1.5, dur);
    return s;
  }
  kick(t, v = 1) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1.1 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(g).connect(this.drumBus);
    o.start(t);
    o.stop(t + 0.35);
    const n = this.noise(t, 0.02);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const ng = ctx.createGain();
    ng.gain.value = 0.25 * v;
    n.connect(hp).connect(ng).connect(this.drumBus);
  }
  snare(t, v = 1) {
    const ctx = this.ctx;
    const n = this.noise(t, 0.22);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.8 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    n.connect(bp).connect(g).connect(this.drumBus);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.5 * v, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og).connect(this.drumBus);
    o.start(t);
    o.stop(t + 0.12);
  }
  hat(t, v, open) {
    const ctx = this.ctx;
    const d = open ? 0.25 : 0.045;
    const n = this.noise(t, d + 0.02);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    n.connect(hp).connect(g).connect(this.drumBus);
  }
  crash(t) {
    const ctx = this.ctx;
    const n = this.noise(t, 1.6);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    n.connect(hp).connect(g).connect(this.drumBus);
  }
  tom(t, f) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f * 1.4, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.drumBus);
    o.start(t);
    o.stop(t + 0.32);
  }

  // ------------------------------------------------ motor + vento
  makeEngine() {
    const ctx = this.ctx;
    this.engOut = ctx.createGain();
    this.engOut.gain.value = 0;
    this.engOut.connect(this.sfxBus);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const am = ctx.createGain();
    am.gain.value = 0.55;
    this.eo1 = ctx.createOscillator();
    this.eo1.type = 'sawtooth';
    this.eo2 = ctx.createOscillator();
    this.eo2.type = 'square';
    this.eLfo = ctx.createOscillator();
    this.eLfo.type = 'square';
    const lg = ctx.createGain();
    lg.gain.value = 0.45;
    this.eLfo.connect(lg).connect(am.gain);
    this.eo1.connect(lp);
    this.eo2.connect(lp);
    lp.connect(am).connect(this.engOut);
    this.eo1.frequency.value = 45;
    this.eo2.frequency.value = 22.5;
    this.eLfo.frequency.value = 11;
    this.eo1.start();
    this.eo2.start();
    this.eLfo.start();
    // vento
    const wn = ctx.createBufferSource();
    wn.buffer = this.noiseBuf;
    wn.loop = true;
    const wbp = ctx.createBiquadFilter();
    wbp.type = 'bandpass';
    wbp.frequency.value = 700;
    wbp.Q.value = 0.5;
    this.windG = ctx.createGain();
    this.windG.gain.value = 0;
    wn.connect(wbp).connect(this.windG).connect(this.sfxBus);
    wn.start();
    // motores dos inimigos (um só som agregado)
    this.enG = ctx.createGain();
    this.enG.gain.value = 0;
    this.enPan = ctx.createStereoPanner();
    const elp = ctx.createBiquadFilter();
    elp.type = 'lowpass';
    elp.frequency.value = 700;
    this.enO = ctx.createOscillator();
    this.enO.type = 'sawtooth';
    this.enO.frequency.value = 70;
    const eam = ctx.createGain();
    eam.gain.value = 0.6;
    this.enLfo = ctx.createOscillator();
    this.enLfo.frequency.value = 17;
    const elg = ctx.createGain();
    elg.gain.value = 0.4;
    this.enLfo.connect(elg).connect(eam.gain);
    this.enO.connect(elp).connect(eam).connect(this.enG).connect(this.enPan).connect(this.sfxBus);
    this.enO.start();
    this.enLfo.start();
  }
  setEngine(speed, throttle) {
    if (!this.ctx) return;
    const t = this.t;
    const f = 30 + speed * 0.9 + throttle * 8;
    this.eo1.frequency.setTargetAtTime(f, t, 0.1);
    this.eo2.frequency.setTargetAtTime(f / 2, t, 0.1);
    this.eLfo.frequency.setTargetAtTime(f / 4.2, t, 0.1);
    this.engOut.gain.setTargetAtTime(0.16 + throttle * 0.05, t, 0.2);
    this.windG.gain.setTargetAtTime(clamp(speed / 45, 0, 1) * 0.07, t, 0.3);
  }
  setEnemyEngine(dist, pan, relSpeed) {
    if (!this.ctx) return;
    const t = this.t;
    const v = dist < 60 ? clamp(1 - dist / 60, 0, 1) * 0.22 : 0;
    this.enG.gain.setTargetAtTime(v, t, 0.15);
    this.enPan.pan.setTargetAtTime(clamp(pan, -1, 1), t, 0.1);
    this.enO.frequency.setTargetAtTime(62 - relSpeed * 1.2, t, 0.1);
  }

  // ------------------------------------------------ posicionamento simples (pan + atenuação)
  setListener(pos, right) {
    const L = this.listener;
    L.x = pos.x;
    L.y = pos.y;
    L.z = pos.z;
    L.rx = right.x;
    L.ry = right.y;
    L.rz = right.z;
  }
  out(pos, vol) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    let gain = vol;
    let pan = 0;
    if (pos) {
      const L = this.listener;
      const dx = pos.x - L.x;
      const dy = pos.y - L.y;
      const dz = pos.z - L.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;
      pan = clamp((dx * L.rx + dy * L.ry + dz * L.rz) / d, -1, 1) * 0.85;
      gain = vol / (1 + d * 0.06);
    }
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p).connect(this.sfxBus);
    return g;
  }

  // ------------------------------------------------ efeitos
  gun(kind, pos) {
    if (!this.ctx) return;
    const P = GUN_SFX[kind] || GUN_SFX.pistol;
    const ctx = this.ctx;
    const t = this.t;
    const out = this.out(pos, P.vol);
    const n = this.noise(t, P.nd + 0.05);
    const f = ctx.createBiquadFilter();
    f.type = P.ft;
    f.frequency.value = P.ff * rand(0.9, 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + P.nd);
    n.connect(f).connect(g).connect(out);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(P.f0, t);
    o.frequency.exponentialRampToValueAtTime(P.f1, t + P.td);
    const og = ctx.createGain();
    og.gain.setValueAtTime(1, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + P.td);
    o.connect(og).connect(out);
    o.start(t);
    o.stop(t + P.td + 0.02);
  }
  laserStart() {
    if (!this.ctx || this.laser) return;
    const ctx = this.ctx;
    const t = this.t;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 329.6;
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = 329.6 * 1.498;
    const vib = ctx.createOscillator();
    vib.frequency.value = 7;
    const vg = ctx.createGain();
    vg.gain.value = 9;
    vib.connect(vg).connect(o.frequency);
    vib.connect(vg).connect(o2.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.7, t + 0.05);
    o.connect(g);
    o2.connect(g);
    g.connect(this.gIn);
    o.start(t);
    o2.start(t);
    vib.start(t);
    this.laser = { o, o2, vib, g };
  }
  laserStop() {
    if (!this.laser) return;
    const { o, o2, vib, g } = this.laser;
    const t = this.t;
    g.gain.setTargetAtTime(0.0001, t, 0.05);
    o.frequency.setTargetAtTime(160, t, 0.1);
    o.stop(t + 0.3);
    o2.stop(t + 0.3);
    vib.stop(t + 0.3);
    this.laser = null;
  }
  blip(f, dur, vol = 0.3, type = 'sine', pos = null, f2 = null) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = this.t;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.out(pos, 1));
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  noiseHit(dur, ff, type, vol, pos = null) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = this.t;
    const n = this.noise(t, dur + 0.02);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = ff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f).connect(g).connect(this.out(pos, 1));
  }
  play(name, pos = null) {
    if (!this.ctx) return;
    switch (name) {
      case 'hit':
        this.blip(1900, 0.04, 0.12, 'square');
        break;
      case 'headshot':
        this.blip(1320, 0.25, 0.25, 'triangle');
        this.blip(1980, 0.3, 0.15, 'sine');
        break;
      case 'kill':
        this.noiseHit(0.15, 600, 'lowpass', 0.5, pos);
        this.blip(220, 0.15, 0.3, 'square', pos, 60);
        break;
      case 'metal':
        this.blip(2600, 0.06, 0.08, 'triangle', pos, 1800);
        break;
      case 'hurt':
        this.blip(110, 0.25, 0.6, 'sawtooth', null, 40);
        this.noiseHit(0.2, 500, 'lowpass', 0.6);
        break;
      case 'explosion': {
        this.noiseHit(1.1, 500, 'lowpass', 1.3, pos);
        this.noiseHit(0.3, 2500, 'bandpass', 0.4, pos);
        this.blip(70, 0.6, 0.9, 'sine', pos, 25);
        break;
      }
      case 'reload':
        this.noiseHit(0.03, 3500, 'bandpass', 0.4);
        setTimeout(() => this.noiseHit(0.04, 2200, 'bandpass', 0.5), 130);
        break;
      case 'empty':
        this.noiseHit(0.02, 4000, 'highpass', 0.35);
        break;
      case 'grab':
        this.noiseHit(0.08, 1500, 'bandpass', 0.35);
        this.blip(600, 0.05, 0.08, 'triangle');
        break;
      case 'holster':
        this.noiseHit(0.1, 800, 'bandpass', 0.35);
        break;
      case 'horn':
        this.blip(392, 0.55, 0.22, 'square');
        this.blip(494, 0.55, 0.18, 'square');
        break;
      case 'glass':
        this.noiseHit(0.25, 5000, 'highpass', 0.5, pos);
        this.noiseHit(0.5, 600, 'lowpass', 0.5, pos);
        break;
      case 'beep':
        this.blip(1500, 0.06, 0.18, 'square', pos);
        break;
      case 'whoosh':
        this.noiseHit(0.5, 900, 'bandpass', 0.4, pos);
        break;
      case 'pickup':
        this.blip(660, 0.1, 0.25, 'triangle');
        setTimeout(() => this.blip(990, 0.15, 0.25, 'triangle'), 80);
        break;
      case 'crash':
        this.noiseHit(0.5, 900, 'lowpass', 1.0, pos);
        this.blip(90, 0.3, 0.7, 'square', pos, 40);
        break;
      case 'charge':
        this.blip(300, 0.4, 0.15, 'sawtooth', pos, 1600);
        break;
      case 'select': {
        const t = this.t;
        this.chord(t, 0, 0.5, false);
        this.chord(t + 0.18, 7, 0.9, false);
        this.crash(t);
        break;
      }
      case 'wave': {
        const t = this.t;
        this.chord(t, 0, 0.15, false);
        this.chord(t + 0.17, 0, 0.15, false);
        this.chord(t + 0.34, 3, 0.15, false);
        this.chord(t + 0.51, 5, 1.0, false);
        this.crash(t + 0.51);
        break;
      }
      case 'clear': {
        const t = this.t;
        [0, 3, 5, 7, 12].forEach((s, i) => this.chord(t + i * 0.12, s, i === 4 ? 1.2 : 0.12, false));
        this.crash(t + 0.48);
        break;
      }
      case 'gameover': {
        const t = this.t;
        [12, 7, 5, 3, 0].forEach((s, i) => this.chord(t + i * 0.28, s, i === 4 ? 2 : 0.25, false));
        this.blip(200, 2, 0.4, 'sawtooth', null, 30);
        break;
      }
      default:
        break;
    }
  }
}
