// Efeitos sonoros sintetizados com WebAudio — nenhum arquivo de áudio necessário.
let ctx = null, master = null, noiseBuf = null;
let volume = 0.5;

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.25, slide = 0, delay = 0, attack = 0.005 } = {}) {
  const c = ensure();
  const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.25, freq = 1000, q = 1, to = 0, type = 'bandpass', delay = 0 } = {}) {
  const c = ensure();
  const t = c.currentTime + delay;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf;
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

export function getAudio() { ensure(); return { ctx, noise: noiseBuf }; }

export const Sfx = {
  unlock() { ensure(); },
  setVolume(v) { volume = v; if (master) master.gain.value = v; },
  swing() { noise(0.16, { vol: 0.18, freq: 700, to: 2600, q: 0.8 }); },
  skillSwing() { noise(0.2, { vol: 0.22, freq: 1200, to: 4200, q: 1.2 }); tone(1400, 0.15, { type: 'triangle', vol: 0.04, slide: 600 }); },
  skillStart() {
    tone(880, 0.25, { type: 'triangle', vol: 0.08, slide: 900 });
    tone(1320, 0.3, { type: 'sine', vol: 0.06, delay: 0.03, slide: 700 });
  },
  hit(crit) {
    noise(0.09, { vol: 0.35, freq: crit ? 2600 : 1800, q: 2 });
    tone(crit ? 220 : 160, 0.12, { type: 'square', vol: 0.08, slide: -80 });
    if (crit) tone(1800, 0.12, { type: 'triangle', vol: 0.06 });
  },
  hurt() { tone(140, 0.25, { type: 'sawtooth', vol: 0.12, slide: -60 }); noise(0.15, { vol: 0.2, freq: 400 }); },
  guard() { tone(900, 0.1, { type: 'square', vol: 0.06 }); noise(0.08, { vol: 0.2, freq: 3000, q: 3 }); },
  parry() { tone(1600, 0.35, { type: 'triangle', vol: 0.12 }); tone(2400, 0.3, { type: 'sine', vol: 0.08, delay: 0.02 }); noise(0.1, { vol: 0.25, freq: 5000, q: 4 }); },
  shatter() {
    for (let i = 0; i < 6; i++) tone(1800 + Math.random() * 2400, 0.25 + Math.random() * 0.2, { type: 'sine', vol: 0.05, delay: i * 0.025 });
    noise(0.35, { vol: 0.2, freq: 6000, q: 1, type: 'highpass' });
  },
  levelUp() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.4, { type: 'triangle', vol: 0.1, delay: i * 0.08 })); },
  menuOpen() { tone(1046, 0.12, { type: 'sine', vol: 0.08 }); tone(1568, 0.18, { type: 'sine', vol: 0.06, delay: 0.05 }); },
  menuClose() { tone(1568, 0.1, { type: 'sine', vol: 0.06 }); tone(1046, 0.14, { type: 'sine', vol: 0.06, delay: 0.04 }); },
  click() { tone(1318, 0.06, { type: 'sine', vol: 0.06 }); },
  error() { tone(220, 0.15, { type: 'square', vol: 0.05 }); tone(180, 0.15, { type: 'square', vol: 0.05, delay: 0.08 }); },
  coin() { tone(1568, 0.08, { type: 'square', vol: 0.04 }); tone(2093, 0.15, { type: 'square', vol: 0.04, delay: 0.06 }); },
  sheath(on) { noise(0.22, { vol: 0.16, freq: on ? 2600 : 1400, to: on ? 900 : 4200, q: 3 }); tone(on ? 660 : 990, 0.08, { type: 'triangle', vol: 0.05, delay: 0.16 }); },
  dash() { noise(0.2, { vol: 0.15, freq: 500, to: 1800, q: 0.6 }); },
  teleport() { tone(400, 1.2, { type: 'sine', vol: 0.1, slide: 1600 }); tone(600, 1.2, { type: 'triangle', vol: 0.06, slide: 2000, delay: 0.1 }); noise(1, { vol: 0.08, freq: 2000, to: 8000 }); },
  roar() { tone(90, 1.2, { type: 'sawtooth', vol: 0.18, slide: -40 }); noise(1.0, { vol: 0.25, freq: 300, to: 120, q: 0.7 }); },
  slam() { tone(60, 0.5, { type: 'sine', vol: 0.3, slide: -30 }); noise(0.4, { vol: 0.35, freq: 200, q: 0.5, type: 'lowpass' }); },
  victory() { [392, 523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.1, delay: i * 0.14 })); },
  death() { [440, 370, 311, 220].forEach((f, i) => tone(f, 0.6, { type: 'sine', vol: 0.1, delay: i * 0.25 })); },
  linkStart() { tone(220, 2.4, { type: 'sine', vol: 0.08, slide: 1800, attack: 0.3 }); noise(2.4, { vol: 0.06, freq: 400, to: 9000, q: 0.5 }); },
};
