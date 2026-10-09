// Personagens em estilo anime: cabeça grande, olhos desenhados (com brilho e piscadas), cabelos estilizados,
// cel shading duro e contorno escuro. Frente do modelo = -Z. Altura ~1.7m.
import * as THREE from 'three';
import { animeMat, outlineMat, addOutlines } from './toon.js';

const G = {};
const geo = (k, fn) => G[k] || (G[k] = fn());
const SPH = (r, w = 20, h = 14) => geo(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
const CAP = (r, l, rs = 12) => geo(`p${r},${l},${rs}`, () => new THREE.CapsuleGeometry(r, l, 5, rs));
const CONE = (r, h, s = 10) => geo(`c${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const HEAD_R = 0.17;

// ─────────── Elenco ───────────
export const CAST = {
  kirito: { name: 'Kirito', hair: 'spiky', hairColor: '#17171f', eyes: '#2c2c3c', skin: '#f6dcc8', top: '#18181f', coat: '#111116', pants: '#1c1c24', boots: '#101014', accent: '#4a4a55', sword: '#16161c', title: 'Espadachim Negro' },
  asuna: { name: 'Asuna', hair: 'long', hairColor: '#c9773f', eyes: '#9a5a2a', skin: '#f9e3d4', top: '#f4f4f6', accent: '#c0262c', skirt: '#f4f4f6', skirtTrim: '#c0262c', boots: '#f0f0f2', female: true, sword: '#e8e8f0', title: 'Flash · Knights of the Blood' },
  klein: { name: 'Klein', hair: 'spiky', hairColor: '#b0302a', bandana: '#c0392b', eyes: '#3a2818', skin: '#f0cfb0', top: '#a8322a', accent: '#d8b060', pants: '#4a3426', boots: '#3a2a20', stubble: true, sword: '#c8ccd4', title: 'Líder do Fuurinkazan' },
  agil: { name: 'Agil', hair: 'bald', eyes: '#2a1a10', skin: '#7a4a2e', top: '#4a5a3a', accent: '#a08050', pants: '#3a3028', boots: '#2a2018', big: true, beard: true, title: 'Mercador' },
  lisbeth: { name: 'Lisbeth', hair: 'bob', hairColor: '#ff8ab8', eyes: '#c8407a', skin: '#f9e3d4', top: '#d8584a', apron: '#f4efe6', skirt: '#c84a3c', boots: '#6a3a2a', female: true, title: 'Ferreira' },
  silica: { name: 'Silica', hair: 'twintails', hairColor: '#9a5a32', eyes: '#c06a30', skin: '#f9e3d4', top: '#d8484a', accent: '#f0d070', skirt: '#4a3a6a', boots: '#5a3a2a', female: true, pet: true, title: 'Domadora de Feras' },
  argo: { name: 'Argo', hair: 'hood', hairColor: '#d8a850', hood: '#6a5a46', eyes: '#c8902a', skin: '#f4dcc4', top: '#5a4a38', pants: '#3a3028', boots: '#2a2018', whiskers: true, female: true, title: 'A Rata · Corretora de Informações' },
  yui: { name: 'Yui', hair: 'long', hairColor: '#141418', eyes: '#2a2a3a', skin: '#fae6d8', top: '#f6f6f8', skirt: '#f6f6f8', skirtTrim: '#e8e8ee', boots: '#f0f0f2', female: true, kid: true, title: 'Menina misteriosa' },
};

for (const k in CAST) CAST[k].id = k;

const HAIRS = ['short', 'short', 'spiky', 'long', 'ponytail', 'bob', 'twintails'];
const HAIR_COLORS = ['#2a1e16', '#4a3020', '#7a4a28', '#c8a060', '#1a1a20', '#8a3a2a', '#d8c8a0', '#3a2a4a', '#5a5a6a'];
const CLOTHES = ['#3a6a8a', '#8a4a3a', '#4a7a4a', '#c8a050', '#6a4a7a', '#d8d0c0', '#a03a3a', '#3a4a6a', '#7a6a50', '#e8c8a0'];
const SKINS = ['#f9e3d4', '#f4d8c0', '#e8c4a4', '#c89470', '#9a6a48'];
const EYES = ['#3a2a1a', '#2a4a8a', '#3a6a3a', '#7a4a2a', '#5a3a6a', '#2a2a3a'];

export function randomTownsfolk(rand, kid = false) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const female = rand() < 0.5;
  const hair = female ? pick(['long', 'ponytail', 'bob', 'twintails', 'short']) : pick(['short', 'spiky', 'short', 'ponytail', 'bald']);
  return {
    name: null, hair, hairColor: pick(HAIR_COLORS), eyes: pick(EYES), skin: pick(SKINS),
    top: pick(CLOTHES), pants: pick(['#3a3028', '#2a3448', '#4a4038', '#5a4a3a']), boots: pick(['#2a2018', '#4a3020', '#1e1e24']),
    skirt: female && rand() < 0.6 ? pick(CLOTHES) : null, apron: rand() < 0.15 ? '#f0ebe0' : null,
    accent: pick(CLOTHES), female, kid, beard: !female && !kid && rand() < 0.15, hat: rand() < 0.2 ? pick(['#6a4a2a', '#c8a050', '#3a5a3a']) : null,
  };
}

// ─────────── Rosto ───────────
const faceCache = new Map();
function faceTextures(def) {
  const key = `${def.eyes}|${def.female}|${def.whiskers}|${def.beard}|${def.stubble}|${def.kid}|${def.skin}`;
  if (faceCache.has(key)) return faceCache.get(key);
  const mk = (closed) => {
    const S = 256, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const eyeY = def.kid ? 128 : 122, gap = def.kid ? 52 : 48, ew = def.female || def.kid ? 34 : 30, eh = def.female || def.kid ? 44 : 36;
    for (const s of [-1, 1]) {
      const x = 128 + s * gap;
      if (closed) {
        g.strokeStyle = '#2a1a14'; g.lineWidth = 6; g.lineCap = 'round';
        g.beginPath(); g.arc(x, eyeY - 4, ew * 0.8, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      } else {
        // branco do olho
        g.fillStyle = '#ffffff';
        g.beginPath(); g.ellipse(x, eyeY, ew, eh, 0, 0, Math.PI * 2); g.fill();
        // íris com degradê
        const gr = g.createLinearGradient(0, eyeY - eh, 0, eyeY + eh);
        const c = new THREE.Color(def.eyes);
        gr.addColorStop(0, `#${c.clone().multiplyScalar(0.45).getHexString()}`);
        gr.addColorStop(1, `#${c.clone().lerp(new THREE.Color('#ffffff'), 0.35).getHexString()}`);
        g.fillStyle = gr;
        g.beginPath(); g.ellipse(x + s * 2, eyeY + 4, ew * 0.78, eh * 0.86, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#120c0a';
        g.beginPath(); g.ellipse(x + s * 2, eyeY + 6, ew * 0.36, eh * 0.42, 0, 0, Math.PI * 2); g.fill();
        // brilhos
        g.fillStyle = '#ffffff';
        g.beginPath(); g.ellipse(x - ew * 0.3, eyeY - eh * 0.32, ew * 0.24, eh * 0.2, -0.4, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(x + ew * 0.3, eyeY + eh * 0.35, ew * 0.11, 0, Math.PI * 2); g.fill();
        // pálpebra superior (traço grosso de anime) e cílios
        g.strokeStyle = '#1a100c'; g.lineWidth = def.female ? 9 : 7; g.lineCap = 'round';
        g.beginPath(); g.ellipse(x, eyeY + 2, ew + 3, eh + 2, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
        if (def.female) { g.beginPath(); g.moveTo(x + s * (ew + 2), eyeY - eh * 0.45); g.lineTo(x + s * (ew + 12), eyeY - eh * 0.75); g.stroke(); }
      }
      // sobrancelhas
      g.strokeStyle = '#2a1a14'; g.lineWidth = def.female ? 4 : 7;
      g.beginPath(); g.moveTo(x - ew * 0.9, eyeY - eh - 16 + (s < 0 ? 4 : 0)); g.quadraticCurveTo(x, eyeY - eh - 26, x + ew * 0.9, eyeY - eh - 16 + (s > 0 ? 4 : 0)); g.stroke();
      // bochechas
      if (def.female || def.kid) {
        g.fillStyle = 'rgba(255,120,130,0.35)';
        g.beginPath(); g.ellipse(x + s * 10, eyeY + eh + 18, 22, 9, 0, 0, Math.PI * 2); g.fill();
      }
      if (def.whiskers) {
        g.strokeStyle = '#4a2a1a'; g.lineWidth = 4;
        for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + s * 12, eyeY + eh + 8 + k * 9); g.lineTo(x + s * 44, eyeY + eh + 2 + k * 12); g.stroke(); }
      }
    }
    // nariz e boca
    g.strokeStyle = 'rgba(120,60,40,0.6)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(128, eyeY + eh + 8); g.lineTo(124, eyeY + eh + 16); g.stroke();
    g.strokeStyle = '#7a2a24'; g.lineWidth = 4;
    g.beginPath(); g.arc(128, eyeY + eh + 22, 10, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    if (def.beard || def.stubble) {
      g.fillStyle = def.beard ? 'rgba(30,20,14,0.85)' : 'rgba(60,40,30,0.25)';
      g.beginPath(); g.ellipse(128, eyeY + eh + 46, 62, 30, 0, 0, Math.PI); g.fill();
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const out = { open: mk(false), closed: mk(true) };
  faceCache.set(key, out);
  return out;
}

// ─────────── Montagem ───────────
function M(g, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function buildHair(def, head, mat) {
  const r = HEAD_R;
  const cap = M(geo('haircap', () => new THREE.SphereGeometry(r * 1.1, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.4)), mat, 0, 0.012, 0.012);
  cap.rotation.x = -0.28;
  const back = M(geo('hairback', () => new THREE.SphereGeometry(r * 1.08, 22, 14, Math.PI * 1.5 + 1.25, Math.PI * 2 - 2.5)), mat, 0, -0.01, 0.02);
  back.scale.set(1, 0.97, 0.95);
  if (def.hair !== 'bald' && def.hair !== 'hood') head.add(cap, back);
  // franja: mechas pontudas caindo sobre a testa
  const bangs = (n, len, spread) => {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      const b = M(CONE(0.045, len, 6), mat, t * spread, 0.085, -r * 0.92);
      b.rotation.set(Math.PI - 0.35, 0, t * 0.8);
      head.add(b);
    }
  };
  const spikes = (n, len) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 1.4 - Math.PI * 0.2;
      const s = M(CONE(0.055, len * (0.8 + (i % 3) * 0.15), 6), mat, Math.cos(a) * r * 0.85, 0.05 + Math.sin(i * 1.7) * 0.03, Math.sin(a) * r * 0.75 + 0.05);
      s.lookAt(s.position.clone().multiplyScalar(3).add(new THREE.Vector3(0, 0.15, 0.25)));
      s.rotateX(Math.PI / 2);
      head.add(s);
    }
  };
  switch (def.hair) {
    case 'spiky':
      spikes(11, 0.2);
      bangs(5, 0.15, 0.2);
      for (const s of [-1, 1]) { const l = M(CONE(0.04, 0.16, 6), mat, s * r * 0.95, -0.04, -0.03); l.rotation.set(Math.PI, 0, s * 0.2); head.add(l); }
      break;
    case 'long': {
      const tail = M(CAP(r * 0.85, 0.42), mat, 0, -0.3, 0.1);
      tail.scale.set(1.05, 1, 0.45);
      tail.rotation.x = 0.12;
      head.add(tail);
      bangs(6, 0.13, 0.22);
      for (const s of [-1, 1]) { const l = M(CAP(0.035, 0.2, 8), mat, s * r * 0.98, -0.1, -0.05); l.rotation.z = s * 0.08; head.add(l); }
      if (def.name === 'Asuna') for (const s of [-1, 1]) { const b = M(CAP(0.03, 0.12, 8), mat, s * r * 0.75, 0.03, 0.12); b.rotation.z = s * 1.2; head.add(b); }
      break;
    }
    case 'ponytail': {
      const pt = M(CAP(0.06, 0.32, 10), mat, 0, -0.08, r * 1.15);
      pt.rotation.x = 0.5;
      head.add(pt, M(SPH(0.05, 10, 8), mat, 0, 0.04, r * 1.05));
      bangs(4, 0.11, 0.18);
      break;
    }
    case 'twintails':
      for (const s of [-1, 1]) {
        head.add(M(SPH(0.05, 10, 8), def.accent ? animeMat(def.accent) : mat, s * r * 0.95, 0.06, 0.04));
        const t = M(CAP(0.055, 0.3, 10), mat, s * r * 1.15, -0.14, 0.05);
        t.rotation.z = s * 0.25;
        head.add(t);
      }
      bangs(5, 0.12, 0.2);
      break;
    case 'bob': {
      const bob = M(SPH(r * 1.17), mat, 0, -0.04, 0.02);
      bob.scale.set(1.02, 0.85, 0.95);
      head.add(bob);
      bangs(6, 0.12, 0.22);
      break;
    }
    case 'hood': {
      const hood = M(geo('hood', () => new THREE.SphereGeometry(r * 1.32, 22, 14, Math.PI * 1.5 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.82)), animeMat(def.hood, { side: THREE.DoubleSide }), 0, 0.01, 0.02);
      const tip = M(CONE(0.07, 0.16, 8), hood.material, 0, 0.2, 0.08);
      tip.rotation.x = 0.6;
      head.add(hood, tip);
      bangs(4, 0.1, 0.16);
      break;
    }
    case 'short':
      bangs(4, 0.09, 0.18);
      break;
    default:
      break;
  }
  if (def.bandana) {
    const band = M(geo('band', () => new THREE.TorusGeometry(r * 1.06, 0.022, 8, 28)), animeMat(def.bandana), 0, 0.07, 0);
    band.rotation.x = Math.PI / 2 - 0.15;
    head.add(band);
    for (const s of [-1, 1]) { const t = M(CAP(0.018, 0.14, 6), band.material, s * 0.03, 0.04, r * 1.1); t.rotation.set(0.9, 0, s * 0.4); head.add(t); }
  }
  if (def.hat) {
    const hm = animeMat(def.hat);
    head.add(M(geo('hatbrim', () => new THREE.CylinderGeometry(r * 1.7, r * 1.7, 0.02, 24)), hm, 0, 0.11, 0), M(geo('hattop', () => new THREE.CylinderGeometry(r * 0.9, r * 1.05, 0.14, 20)), hm, 0, 0.18, 0));
  }
}

export function buildCharacter(def) {
  const k = def.kid ? 0.68 : def.small ? 0.86 : def.big ? 1.12 : 1;
  const w = def.big ? 1.3 : def.female ? 0.9 : 1;
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  const skin = animeMat(def.skin);
  const top = animeMat(def.top);
  const pants = animeMat(def.pants || def.top);
  const boots = animeMat(def.boots || '#2a2018');
  const hairMat = animeMat(def.hairColor || '#2a1e16');
  const accent = animeMat(def.accent || def.top);
  const parts = { legs: [], arms: [] };

  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.085 * w, 0.86, 0);
    const boot = M(CAP(0.07, 0.16, 10), boots, 0, -0.74, -0.02);
    pivot.add(M(CAP(0.066 * w, 0.56, 10), def.skirt && !def.pants ? skin : pants, 0, -0.38, 0), boot);
    inner.add(pivot);
    parts.legs.push(pivot);
  }
  const torso = M(CAP(0.135, 0.3, 14), top, 0, 1.17, 0);
  torso.scale.set(1.12 * w, 1, 0.72 * w);
  const pelvis = M(SPH(0.14), def.skirt ? animeMat(def.skirt) : pants, 0, 0.92, 0);
  pelvis.scale.set(1.15 * w, 0.62, 0.85 * w);
  const belt = M(geo('belt', () => new THREE.CylinderGeometry(0.15, 0.15, 0.05, 18)), accent, 0, 0.99, 0);
  belt.scale.set(w, 1, 0.82 * w);
  inner.add(torso, pelvis, belt, M(CAP(0.05, 0.05, 8), skin, 0, 1.43, 0));
  if (def.skirt) {
    const sk = M(geo('skirt', () => new THREE.CylinderGeometry(0.15, 0.27, 0.34, 18, 1, true)), animeMat(def.skirt, { side: THREE.DoubleSide }), 0, 0.82, 0);
    sk.scale.set(w, 1, 0.9 * w);
    inner.add(sk);
    if (def.skirtTrim) {
      const trim = M(geo('trim', () => new THREE.TorusGeometry(0.27, 0.014, 6, 24)), animeMat(def.skirtTrim), 0, 0.655, 0);
      trim.rotation.x = Math.PI / 2;
      trim.scale.set(w, 0.9 * w, 1);
      inner.add(trim);
    }
  }
  if (def.coat) {
    // sobretudo longo aberto na frente (o Coat of Midnight)
    const coat = M(geo('coat', () => new THREE.CylinderGeometry(0.16, 0.34, 0.95, 20, 1, true, Math.PI + 0.42, Math.PI * 2 - 0.84)), animeMat(def.coat, { side: THREE.DoubleSide }), 0, 0.92, 0);
    coat.scale.z = 0.82;
    const collar = M(geo('collar', () => new THREE.CylinderGeometry(0.1, 0.15, 0.1, 18, 1, true, Math.PI + 0.6, Math.PI * 2 - 1.2)), coat.material, 0, 1.42, 0);
    inner.add(coat, collar);
  }
  if (def.apron) {
    const ap = M(geo('apron', () => new THREE.PlaneGeometry(0.26, 0.55)), animeMat(def.apron, { side: THREE.DoubleSide }), 0, 1.0, -0.115 * w);
    inner.add(ap);
  }
  if (def.accent && def.name === 'Asuna') {
    const cross = M(geo('cross', () => new THREE.PlaneGeometry(0.1, 0.03)), accent, 0, 1.2, -0.1);
    const cross2 = M(geo('cross2', () => new THREE.PlaneGeometry(0.03, 0.12)), accent, 0, 1.2, -0.1);
    inner.add(cross, cross2);
  }
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.175 * w, 1.37, 0);
    pivot.add(M(SPH(0.065, 12, 10), def.coat ? animeMat(def.coat) : top, 0, 0, 0));
    pivot.add(M(CAP(0.046, 0.42, 10), def.coat ? animeMat(def.coat) : top, 0, -0.25, 0), M(SPH(0.048, 12, 10), skin, 0, -0.52, 0));
    pivot.rotation.z = s * 0.08;
    inner.add(pivot);
    parts.arms.push(pivot);
  }
  if (def.sword) {
    // espada nas costas
    const sw = new THREE.Group();
    const bm = animeMat(def.sword);
    sw.add(M(geo('swblade', () => new THREE.BoxGeometry(0.05, 0.8, 0.015)), bm, 0, 0.35, 0), M(geo('swguard', () => new THREE.BoxGeometry(0.16, 0.025, 0.04)), accent, 0, -0.06, 0), M(CAP(0.018, 0.14, 6), accent, 0, -0.16, 0));
    sw.position.set(0.05, 1.12, 0.13);
    sw.rotation.z = -0.5;
    inner.add(sw);
  }

  const head = new THREE.Group();
  head.position.set(0, 1.61, 0);
  const skull = M(SPH(HEAD_R, 24, 18), skin);
  skull.scale.set(1, 1.04, 0.98);
  head.add(skull);
  const tex = faceTextures(def);
  const faceMat = animeMat('#ffffff', { map: tex.open, transparent: true, alphaTest: 0.08, depthWrite: false });
  const face = new THREE.Mesh(geo('face', () => new THREE.SphereGeometry(HEAD_R * 1.006, 24, 16, Math.PI * 1.5 - 0.95, 1.9, Math.PI / 2 - 0.62, 1.12)), faceMat);
  face.renderOrder = 2;
  face.userData.face = true;
  head.add(face);
  for (const s of [-1, 1]) head.add(M(SPH(0.03, 8, 6), skin, s * HEAD_R * 0.98, -0.01, 0.01));
  buildHair(def, head, hairMat);
  inner.add(head);
  parts.head = head;
  parts.face = { mat: faceMat, tex };

  if (def.pet) {
    // Pina, o pequeno dragão de pena
    const pina = new THREE.Group();
    const pm = animeMat('#a8d8f8');
    const body = M(SPH(0.11, 14, 10), pm);
    body.scale.set(1, 0.9, 1.3);
    const ph = M(SPH(0.075, 12, 10), pm, 0, 0.06, -0.12);
    const tail = M(CAP(0.02, 0.2, 6), pm, 0, 0, 0.18);
    tail.rotation.x = 1.3;
    const plume = M(CONE(0.03, 0.12, 6), animeMat('#f0f0ff'), 0, 0.14, -0.1);
    const wm = animeMat('#e8f4ff', { side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const wings = [];
    for (const s of [-1, 1]) {
      const wg = new THREE.Group();
      wg.position.set(s * 0.06, 0.05, 0);
      wg.add(M(geo('pwing', () => new THREE.CircleGeometry(0.12, 12).rotateX(-Math.PI / 2).scale(1.3, 1, 0.7)), wm, s * 0.12, 0, 0));
      pina.add(wg);
      wings.push(wg);
    }
    for (const s of [-1, 1]) ph.add(M(SPH(0.016, 6, 5), animeMat('#a02020'), s * 0.035, 0.015, -0.06));
    pina.add(body, ph, tail, plume);
    group.add(pina);
    parts.pet = { obj: pina, wings };
  }

  inner.scale.setScalar(k);
  const ol = outlineMat('#1c1410', 1.6);
  addOutlines(inner, ol, (o) => o.userData.face || o.material.transparent || o.geometry.type === 'PlaneGeometry');
  if (parts.pet) addOutlines(parts.pet.obj, ol, (o) => o.material.transparent);
  return { group, inner, parts, height: 1.85 * k };
}

// Animação: andar, respirar, piscar e olhar para alguém.
export function animateCharacter(c, dt, t, speed, lookYaw = null, talking = false) {
  const p = c.parts;
  c.walk = (c.walk || Math.random() * 10) + dt * speed * 6;
  const s = Math.sin(c.walk), amp = Math.min(1, speed / 1.4) * 0.55;
  p.legs[0].rotation.x = s * amp;
  p.legs[1].rotation.x = -s * amp;
  p.arms[0].rotation.x = -s * amp * 0.8;
  p.arms[1].rotation.x = s * amp * 0.8 + (talking ? Math.sin(t * 6) * 0.15 - 0.3 : 0);
  c.inner.position.y = speed > 0.05 ? Math.abs(Math.sin(c.walk)) * 0.035 : Math.sin(t * 2) * 0.006;
  const target = lookYaw ?? 0;
  p.head.rotation.y += (Math.max(-0.9, Math.min(0.9, target)) - p.head.rotation.y) * Math.min(1, dt * 6);
  p.head.rotation.x = talking ? Math.sin(t * 7) * 0.05 : Math.sin(t * 1.3) * 0.02;
  c.blinkT = (c.blinkT ?? 1 + Math.random() * 3) - dt;
  const closed = c.blinkT < 0.12;
  if (c.blinkT < 0) c.blinkT = 2 + Math.random() * 4;
  const want = closed ? p.face.tex.closed : p.face.tex.open;
  if (p.face.mat.map !== want) { p.face.mat.map = want; p.face.mat.needsUpdate = true; }
  if (p.pet) {
    p.pet.obj.position.set(Math.sin(t * 0.8) * 0.35 + 0.3, 1.95 + Math.sin(t * 2.2) * 0.08, Math.cos(t * 0.8) * 0.2);
    p.pet.obj.rotation.y = Math.sin(t * 0.8) * 0.6;
    p.pet.wings.forEach((w, i) => { w.rotation.z = Math.sin(t * 18) * 0.6 * (i ? -1 : 1); });
  }
}
