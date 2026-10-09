// Trilha sonora gerada em tempo real (WebAudio): cada área tem sua música, com transição suave entre elas.
// cidade = alegre · noite na cidade = caixinha de música · campo = vento + flauta · floresta = sombria
// batalha = tambores e baixo · chefe = épica · título = tema calmo
import { getAudio } from './audio.js';

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const MAJ = [0, 4, 7], MIN = [0, 3, 7];

function makeIR(ctx, secs) {
  const len = Math.floor(ctx.sampleRate * secs), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return ir;
}

// ─────────── Instrumentos ───────────
function voice(tr, t, dur, vol, attack = 0.005, release = null) {
  const c = tr.m.ctx, g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  if (release === null) g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  else { g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release)); g.gain.linearRampToValueAtTime(0, t + dur); }
  g.connect(tr.out);
  return g;
}
function osc(tr, type, f, t, end, dest, detune = 0) {
  const o = tr.m.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.detune.value = detune;
  o.connect(dest);
  o.start(t);
  o.stop(end + 0.05);
  return o;
}
function lowpass(tr, f, dest, q = 0.7) {
  const flt = tr.m.ctx.createBiquadFilter();
  flt.type = 'lowpass'; flt.frequency.value = f; flt.Q.value = q;
  flt.connect(dest);
  return flt;
}
const I = {
  pluck(tr, f, t, dur, vol, type = 'triangle') {
    const g = voice(tr, t, dur, vol);
    const flt = lowpass(tr, 3200, g);
    flt.frequency.setValueAtTime(3200, t);
    flt.frequency.exponentialRampToValueAtTime(700, t + dur);
    osc(tr, type, f, t, t + dur, flt);
  },
  bell(tr, f, t, vol, decay = 2) {
    const g = voice(tr, t, decay, vol, 0.003);
    osc(tr, 'sine', f, t, t + decay, g);
    const g2 = voice(tr, t, decay * 0.5, vol * 0.25, 0.003);
    osc(tr, 'sine', f * 2.76, t, t + decay * 0.5, g2);
    const g3 = voice(tr, t, decay * 0.25, vol * 0.1, 0.002);
    osc(tr, 'sine', f * 5.4, t, t + decay * 0.25, g3);
  },
  pad(tr, freqs, t, dur, vol, cutoff = 900) {
    const g = voice(tr, t, dur, vol, Math.min(0.8, dur * 0.3), Math.min(0.9, dur * 0.35));
    const flt = lowpass(tr, cutoff, g);
    for (const f of freqs) { osc(tr, 'sawtooth', f, t, t + dur, flt, -7); osc(tr, 'sawtooth', f, t, t + dur, flt, 7); }
  },
  flute(tr, f, t, dur, vol) {
    const c = tr.m.ctx, g = voice(tr, t, dur, vol, 0.09, Math.min(0.3, dur * 0.4));
    const o = osc(tr, 'sine', f, t, t + dur, g);
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 5.2;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.5);
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t); lfo.stop(t + dur + 0.05);
    const g2 = voice(tr, t, dur, vol * 0.18, 0.09, Math.min(0.3, dur * 0.4));
    osc(tr, 'triangle', f * 2, t, t + dur, g2);
  },
  bass(tr, f, t, dur, vol, type = 'triangle', cutoff = 700) {
    const g = voice(tr, t, dur, vol, 0.01, dur * 0.3);
    osc(tr, type, f, t, t + dur, lowpass(tr, cutoff, g));
  },
  lead(tr, f, t, dur, vol) {
    const g = voice(tr, t, dur, vol, 0.01, dur * 0.4);
    osc(tr, 'square', f, t, t + dur, lowpass(tr, 2400, g), 0);
    osc(tr, 'sawtooth', f, t, t + dur, lowpass(tr, 1600, g), 9);
  },
  kick(tr, t, vol) {
    const g = voice(tr, t, 0.3, vol, 0.002);
    const o = osc(tr, 'sine', 150, t, t + 0.3, g);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  },
  noise(tr, t, dur, vol, type, freq) {
    const c = tr.m.ctx, s = c.createBufferSource(), flt = c.createBiquadFilter(), g = voice(tr, t, dur, vol, 0.002);
    s.buffer = tr.m.noiseBuf;
    flt.type = type; flt.frequency.value = freq;
    s.connect(flt).connect(g);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  },
  snare(tr, t, vol) { I.noise(tr, t, 0.16, vol, 'highpass', 1400); const g = voice(tr, t, 0.08, vol * 0.5); osc(tr, 'triangle', 190, t, t + 0.08, g); },
  hat(tr, t, vol) { I.noise(tr, t, 0.04, vol, 'highpass', 7500); },
  tom(tr, t, vol, f = 90) { const g = voice(tr, t, 0.45, vol, 0.002); const o = osc(tr, 'sine', f * 1.6, t, t + 0.45, g); o.frequency.exponentialRampToValueAtTime(f, t + 0.2); },
};

const triad = (root, q) => q.map((x) => midi(root + x));

// ─────────── Faixas ───────────
// step(tr, i, t, sd): i = semicolcheia (16 por compasso), sd = duração de uma semicolcheia em segundos
const TRACKS = {
  town: {
    bpm: 104, reverb: 0.25,
    prog: [[53, MAJ], [48, MAJ], [50, MIN], [46, MAJ]],
    scale: [65, 67, 69, 72, 74, 77, 79, 81],
    step(tr, i, t, sd) {
      const [root, q] = this.prog[Math.floor(i / 16) % 4], s = i % 16;
      if (s === 0) I.pad(tr, triad(root + 12, q), t, sd * 16, 0.035, 1200);
      if (s === 0 || s === 8 || (s === 6 && Math.random() < 0.5)) I.bass(tr, midi(root - 12), t, sd * 3, 0.16);
      if (s % 2 === 0) { const n = [0, 1, 2, 1][(s / 2) % 4]; I.pluck(tr, midi(root + 24 + q[n]), t, sd * 2.5, 0.05); }
      if ([0, 3, 6, 8, 10, 12].includes(s) && Math.random() < 0.55) {
        tr.mel = Math.max(0, Math.min(this.scale.length - 1, (tr.mel ?? 3) + rnd([-2, -1, 1, 1, 2])));
        I.bell(tr, midi(this.scale[tr.mel]), t, 0.06, 0.9);
      }
      if (s % 2 === 1) I.hat(tr, t, 0.012);
    },
  },
  townNight: {
    bpm: 72, reverb: 0.5,
    prog: [[53, MAJ], [57, MIN], [46, MAJ], [48, MAJ]],
    scale: [77, 79, 81, 84, 86, 89],
    step(tr, i, t, sd) {
      const [root, q] = this.prog[Math.floor(i / 16) % 4], s = i % 16;
      if (s === 0) I.pad(tr, triad(root, q), t, sd * 16, 0.03, 700);
      if (s % 4 === 0) I.bell(tr, midi(root + 24 + q[(s / 4) % 3]), t, 0.035, 1.6);
      if (s % 4 === 2 && Math.random() < 0.4) I.bell(tr, midi(rnd(this.scale)), t, 0.03, 2.2);
    },
  },
  title: {
    bpm: 66, reverb: 0.55,
    prog: [[50, MIN], [46, MAJ], [53, MAJ], [48, MAJ]],
    scale: [62, 65, 67, 69, 72, 74, 77],
    step(tr, i, t, sd) {
      const [root, q] = this.prog[Math.floor(i / 16) % 4], s = i % 16;
      if (s === 0) { I.pad(tr, triad(root + 12, q), t, sd * 16, 0.04, 900); I.bass(tr, midi(root - 12), t, sd * 14, 0.1, 'sine'); }
      if (s % 4 === 0) I.bell(tr, midi(root + 24 + q[(s / 4) % 3]), t, 0.03, 2);
      if ((s === 0 || s === 8) && Math.random() < 0.7) I.flute(tr, midi(rnd(this.scale) + 12), t, sd * 7, 0.045);
    },
  },
  field: {
    bpm: 70, reverb: 0.45, wind: 0.06,
    prog: [[50, MIN], [55, MAJ], [50, MIN], [48, MAJ]],
    scale: [62, 64, 65, 67, 69, 71, 72, 74, 76],
    step(tr, i, t, sd) {
      const [root, q] = this.prog[Math.floor(i / 16) % 4], s = i % 16;
      if (s === 0) I.pad(tr, triad(root + 12, q), t, sd * 16, 0.025, 800);
      if (s === 0) I.bass(tr, midi(root - 12), t, sd * 12, 0.07, 'sine');
      if ((s === 0 || s === 6 || s === 10) && Math.random() < 0.45) {
        tr.mel = Math.max(0, Math.min(this.scale.length - 1, (tr.mel ?? 4) + rnd([-2, -1, 1, 2])));
        I.flute(tr, midi(this.scale[tr.mel] + 12), t, sd * (4 + Math.random() * 5), 0.045);
      }
      if (s === 12 && Math.random() < 0.25) I.bell(tr, midi(rnd(this.scale) + 24), t, 0.02, 2.5);
    },
  },
  forest: {
    bpm: 58, reverb: 0.7, wind: 0.025,
    prog: [[45, MIN], [41, MAJ], [38, MIN], [40, MAJ]],
    scale: [57, 59, 60, 62, 64, 65, 68, 69],
    step(tr, i, t, sd) {
      const [root, q] = this.prog[Math.floor(i / 16) % 4], s = i % 16;
      if (s === 0) { I.pad(tr, triad(root + 12, q), t, sd * 16, 0.035, 500); I.bass(tr, midi(root - 12), t, sd * 16, 0.09, 'sine', 300); }
      if (s % 8 === 4 && Math.random() < 0.35) I.bell(tr, midi(rnd(this.scale)), t, 0.03, 3);
      if (s === 8 && Math.random() < 0.3) I.flute(tr, midi(rnd(this.scale) - 12), t, sd * 10, 0.035);
    },
  },
  battle: {
    bpm: 144, reverb: 0.15,
    prog: [[40, MIN], [36, MAJ], [43, MAJ], [38, MAJ]],
    scale: [64, 66, 67, 69, 71, 72, 74, 76],
    step(tr, i, t, sd) {
      const [root, q] = this.prog[Math.floor(i / 16) % 4], s = i % 16;
      if (s === 0 || s === 8 || s === 10) I.kick(tr, t, 0.32);
      if (s === 4 || s === 12) I.snare(tr, t, 0.13);
      if (s % 2 === 0) I.hat(tr, t, 0.03);
      if (s % 2 === 0) I.bass(tr, midi(root - 12 + (s % 4 === 2 ? 12 : 0)), t, sd * 1.8, 0.14, 'sawtooth', 500);
      if (s === 0 || s === 3 || s === 6) I.pad(tr, triad(root + 12, q), t, sd * 2, 0.04, 2000);
      if (s % 2 === 0 && Math.random() < 0.6) {
        tr.mel = Math.max(0, Math.min(this.scale.length - 1, (tr.mel ?? 3) + rnd([-1, -1, 1, 1, 2, -2])));
        I.lead(tr, midi(this.scale[tr.mel]), t, sd * 1.8, 0.03);
      }
    },
  },
  boss: {
    bpm: 160, reverb: 0.25,
    prog: [[40, MIN], [41, MAJ], [40, MIN], [38, MAJ]],
    scale: [64, 65, 67, 69, 71, 72, 74, 76, 79],
    step(tr, i, t, sd) {
      const [root, q] = this.prog[Math.floor(i / 16) % 4], s = i % 16, bar = Math.floor(i / 16);
      if (s % 4 === 0 || s === 14) I.kick(tr, t, 0.34);
      if (s === 4 || s === 12) I.snare(tr, t, 0.15);
      if (s % 2 === 1) I.hat(tr, t, 0.025);
      if (bar % 2 === 1 && s >= 12) I.tom(tr, t, 0.2, 70 + (s - 12) * 15);
      I.bass(tr, midi(root - 12), t, sd * 0.9, 0.12, 'sawtooth', 450);
      if (s === 0) I.pad(tr, triad(root + 12, q).concat([midi(root + 24)]), t, sd * 16, 0.05, 1400);
      if (s % 2 === 0 && Math.random() < 0.7) {
        tr.mel = Math.max(0, Math.min(this.scale.length - 1, (tr.mel ?? 4) + rnd([-1, 1, 1, 2, -2, 0])));
        I.lead(tr, midi(this.scale[tr.mel] + 12), t, sd * 1.8, 0.03);
      }
    },
  },
};

class MusicEngine {
  constructor() {
    this.ctx = null;
    this.zone = null;
    this.volume = 0.45;
    this.tracks = {};
  }

  init() {
    if (this.ctx) return;
    const { ctx, noise } = getAudio();
    this.ctx = ctx;
    this.noiseBuf = noise;
    this.bus = ctx.createGain();
    this.bus.gain.value = this.volume;
    this.bus.connect(ctx.destination);
    this.verb = ctx.createConvolver();
    this.verb.buffer = makeIR(ctx, 3);
    this.verb.connect(this.bus);
    for (const [name, def] of Object.entries(TRACKS)) {
      const out = ctx.createGain(), level = ctx.createGain(), send = ctx.createGain();
      level.gain.value = 0;
      send.gain.value = def.reverb;
      out.connect(level);
      level.connect(this.bus);
      level.connect(send).connect(this.verb);
      this.tracks[name] = { m: this, def, out, level, active: false, until: 0, next: 0, i: 0 };
    }
    this.timer = setInterval(() => this.schedule(), 30);
  }

  setVolume(v) {
    this.volume = v;
    if (this.bus) this.bus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  setZone(zone) {
    this.init();
    if (zone === this.zone) return;
    const now = this.ctx.currentTime;
    const fast = zone === 'battle' || zone === 'boss';
    for (const [name, tr] of Object.entries(this.tracks)) {
      const on = name === zone, fade = on ? (fast ? 0.6 : 2.5) : (fast ? 0.8 : 2.5);
      tr.level.gain.cancelScheduledValues(now);
      tr.level.gain.setValueAtTime(tr.level.gain.value, now);
      tr.level.gain.linearRampToValueAtTime(on ? 1 : 0, now + fade);
      if (on) {
        if (!tr.active) { tr.active = true; tr.next = now + 0.05; tr.i = 0; this.startWind(tr); }
        tr.until = Infinity;
      } else if (tr.active) tr.until = now + fade + 0.2;
    }
    this.zone = zone;
  }

  startWind(tr) {
    if (!tr.def.wind || tr.windSrc) return;
    const c = this.ctx, src = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf;
    src.loop = true;
    flt.type = 'bandpass'; flt.frequency.value = 520; flt.Q.value = 0.8;
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 0.07; lg.gain.value = 320;
    lfo.connect(lg).connect(flt.frequency);
    const lfo2 = c.createOscillator(), lg2 = c.createGain();
    lfo2.frequency.value = 0.11; lg2.gain.value = tr.def.wind * 0.6;
    g.gain.value = tr.def.wind;
    lfo2.connect(lg2).connect(g.gain);
    src.connect(flt).connect(g).connect(tr.out);
    src.start(); lfo.start(); lfo2.start();
    tr.windSrc = [src, lfo, lfo2];
  }

  stopWind(tr) {
    if (!tr.windSrc) return;
    tr.windSrc.forEach((n) => { try { n.stop(); } catch { /* já parado */ } });
    tr.windSrc = null;
  }

  schedule() {
    const now = this.ctx.currentTime, ahead = now + 0.15;
    for (const tr of Object.values(this.tracks)) {
      if (!tr.active) continue;
      if (now > tr.until) { tr.active = false; this.stopWind(tr); continue; }
      const sd = 60 / tr.def.bpm / 4;
      if (tr.next < now) tr.next = now + 0.02;
      while (tr.next < ahead) {
        tr.def.step(tr, tr.i, tr.next, sd);
        tr.next += sd;
        tr.i++;
      }
    }
  }
}

export const Music = new MusicEngine();
