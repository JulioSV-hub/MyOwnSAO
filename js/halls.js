// Salões por dentro: a Taverna do Javali Dourado e a Guilda dos Aventureiros (no estilo do salão de Fairy Tail).
// Cada um é uma sala fechada bem acima da cidade (como a casa própria); entrar troca o jogador de lugar com um fade.
// Os frequentadores são NPCs normais (npcs.js) com poses: sentado, bebendo, comendo, tocando alaúde, comemorando...
import * as THREE from 'three';
import { toonMat } from './toon.js';
import { signTexture, SHOPS } from './shops.js';
import { randomTownsfolk } from './characters.js';
import { mulberry32 } from './rng.js';

const mats = new Map();
const T = (c, o) => { const k = c + JSON.stringify(o || {}); if (!mats.has(k)) mats.set(k, toonMat(c, o)); return mats.get(k); };
const glow = (c, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
const M = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };

function planks(hue = 28, light = 34) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = `hsl(${hue}, 38%, ${light + (i * 7) % 12}%)`;
    g.fillRect(0, i * 32, 256, 31);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, i * 32 + 31, 256, 1);
    g.fillRect(((i * 97) % 200) + 20, i * 32, 1, 32);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function stones(base = '#8a8072') {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#5a5248';
  g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 5; c++) {
    const off = r % 2 ? 26 : 0, l = 0.85 + ((r * 7 + c * 13) % 10) / 40;
    const col = new THREE.Color(base).multiplyScalar(l);
    g.fillStyle = `#${col.getHexString()}`;
    g.fillRect(c * 52 + off - 24, r * 32 + 2, 48, 28);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const HALLS = {
  tavern: { base: new THREE.Vector3(0, 700, 0), w: 22, d: 16, h: 6.2 },
  guild: { base: new THREE.Vector3(0, 800, 0), w: 30, d: 24, h: 10 },
};

const TAVERN_LINES = [
  'Mais uma rodada! Hoje a linha de frente paga!',
  'O ensopado de javali do Gorm cura até coração partido.',
  'Ouvi dizer que tem um baú dourado escondido perto da cachoeira...',
  'Psiu, você não viu o Klein por aí? Ele me deve 300 Col.',
  'Se um dia eu juntar coragem, vou ser da linha de frente. Mas hoje não. Hoje é hidromel.',
  'Essa música de novo? Toca outra, bardo!',
  'Brindemos aos que não voltaram dos campos.',
  'Dizem que dragões sobrevoam a cidade em dias de céu limpo. Eu juro que vi um!',
];
const GUILD_LINES = [
  'Quem quer briga?! ...Ah, é só você. Senta aí, toma uma!',
  'O quadro tem pedido novo! Monstro raro nos campos, recompensa alta!',
  'Nossa guilda é uma família. Barulhenta, briguenta... mas família.',
  'Eu ganhei a queda de braço três vezes hoje! Quer tentar?',
  'Quando subirmos para o posto S, vou dar uma festa que vai durar uma semana!',
  'A recepcionista disse que se quebrarmos mais uma mesa, quem paga é a gente.',
  'Treinei a manhã toda. Agora é hora de comer em dobro!',
  'Um mascote lendário? Dizem que só aparece para quem tem muita sorte... ou muito Col.',
];

export class Halls {
  constructor(game) {
    this.game = game;
    this.rooms = {};
    this.cur = null;
  }

  room(kind) {
    if (!this.rooms[kind]) this.build(kind);
    return this.rooms[kind];
  }

  // ─────────── Construção ───────────
  build(kind) {
    const S = HALLS[kind], { w, d, h } = S, g = new THREE.Group();
    g.position.copy(S.base);
    const R = { kind, g, S, colliders: [], fires: [], candles: [], lights: [] };
    const tex = planks(kind === 'guild' ? 24 : 28, kind === 'guild' ? 30 : 34);
    tex.repeat.set(w / 4, d / 4);
    g.add(M(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 })));
    const stoneTex = stones(kind === 'guild' ? '#9a8c78' : '#8a7a68');
    const wallMat = (len) => { const t = stoneTex.clone(); t.needsUpdate = true; t.repeat.set(len / 3, h / 3); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }); };
    for (const [x, z, ry, len] of [[0, -d / 2, 0, w], [0, d / 2, Math.PI, w], [-w / 2, 0, Math.PI / 2, d], [w / 2, 0, -Math.PI / 2, d]]) {
      const p = M(new THREE.PlaneGeometry(len, h), wallMat(len), x, h / 2, z);
      p.rotation.y = ry;
      g.add(p);
    }
    g.add(M(new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2), T('#4a3424'), 0, h, 0));
    const beam = T('#5a3a22'), dark = T('#3a2616'), wood = T('#7a5232'), iron = T('#2e3036');
    for (let x = -w / 2 + 2; x < w / 2; x += 3.2) g.add(M(new THREE.BoxGeometry(0.35, 0.4, d), beam, x, h - 0.2, 0));
    for (const z of [-d / 2 + 0.15, d / 2 - 0.15]) g.add(M(new THREE.BoxGeometry(w, 0.3, 0.3), beam, 0, 0.15, z));
    // porta (saída)
    g.add(M(new THREE.BoxGeometry(2, 3, 0.2), T('#5a3a22'), 0, 1.5, d / 2 - 0.1), M(new THREE.SphereGeometry(0.08, 8, 6), T('#d8b050'), 0.7, 1.4, d / 2 - 0.24));
    // janelas
    R.winMat = new THREE.MeshBasicMaterial({ color: '#bfe4ff' });
    for (const x of [-w / 4, w / 4]) g.add(M(new THREE.PlaneGeometry(1.6, 1.8), R.winMat, x, h * 0.5, d / 2 - 0.03).rotateY(Math.PI));
    for (const z of [-d / 4, d / 4]) { const wl = M(new THREE.PlaneGeometry(1.6, 1.8), R.winMat, w / 2 - 0.03, h * 0.5, z); wl.rotation.y = -Math.PI / 2; g.add(wl); }

    const circ = (x, z, r) => R.colliders.push({ x: S.base.x + x, z: S.base.z + z, r });
    const box = (x, z, hw, hd) => R.colliders.push({ x: S.base.x + x, z: S.base.z + z, hw, hd });
    R.circ = circ; R.box = box;
    const add = (o) => { g.add(o); return o; };

    // lareira com fogo
    const fireplace = (x, z, ry) => {
      const fp = new THREE.Group();
      fp.position.set(x, 0, z);
      fp.rotation.y = ry;
      const st = T('#7a7266');
      fp.add(M(new THREE.BoxGeometry(2.6, 1.8, 0.9), st, 0, 0.9, 0), M(new THREE.BoxGeometry(2.9, 0.18, 1.1), wood, 0, 1.85, 0.05), M(new THREE.BoxGeometry(1.2, h - 1.9, 0.7), st, 0, 1.9 + (h - 1.9) / 2, -0.1));
      fp.add(M(new THREE.BoxGeometry(1.5, 1.1, 0.4), T('#140e0a'), 0, 0.6, 0.28));
      for (let i = 0; i < 3; i++) { const f = M(new THREE.ConeGeometry(0.2 + i * 0.05, 0.6 - i * 0.1, 8), glow(i ? '#ffb040' : '#ff6a20', 2.4), -0.3 + i * 0.3, 0.5, 0.3); R.fires.push(f); fp.add(f); }
      const l = new THREE.PointLight('#ff9a4a', 22, 12, 1.8);
      l.position.set(0, 1.2, 1.2);
      fp.add(l);
      R.lights.push(l);
      add(fp);
    };
    // lustre de velas
    const chandelier = (x, z, r = 1.1) => {
      const ch = new THREE.Group();
      ch.position.set(x, h - 1.6, z);
      ch.add(M(new THREE.TorusGeometry(r, 0.05, 6, 28).rotateX(Math.PI / 2), iron));
      ch.add(M(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), iron, 0, 0.8, 0));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ch.add(M(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), T('#f4ecd8'), Math.cos(a) * r, 0.12, Math.sin(a) * r));
        const fl = M(new THREE.SphereGeometry(0.045, 8, 6), glow('#ffd070', 3), Math.cos(a) * r, 0.27, Math.sin(a) * r);
        fl.scale.y = 1.6;
        R.candles.push(fl);
        ch.add(fl);
      }
      const l = new THREE.PointLight('#ffd8a0', 26, 16, 1.6);
      l.position.y = -0.3;
      ch.add(l);
      R.lights.push(l);
      add(ch);
    };
    const roundTable = (x, z, r = 0.75) => {
      add(M(new THREE.CylinderGeometry(r, r, 0.08, 20), wood, x, 0.78, z));
      add(M(new THREE.CylinderGeometry(0.08, 0.14, 0.76, 10), dark, x, 0.38, z));
      circ(x, z, r + 0.05);
    };
    const stool = (x, z) => { add(M(new THREE.CylinderGeometry(0.22, 0.2, 0.08, 12), wood, x, 0.46, z)); for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; add(M(new THREE.CylinderGeometry(0.025, 0.025, 0.46, 6), dark, x + Math.cos(a) * 0.14, 0.23, z + Math.sin(a) * 0.14)); } };
    const mug = (x, y, z) => { add(M(new THREE.CylinderGeometry(0.06, 0.055, 0.16, 10), T('#c8a060'), x, y + 0.08, z)); add(M(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 10), T('#fff4dc'), x, y + 0.165, z)); };
    const plate = (x, y, z, food = '#c86a3a') => { add(M(new THREE.CylinderGeometry(0.17, 0.14, 0.03, 14), T('#f4f0e8'), x, y + 0.02, z)); add(M(new THREE.SphereGeometry(0.08, 10, 8), T(food), x, y + 0.08, z)).scale.y = 0.6; };
    const barrel = (x, z, y = 0, lying = false) => {
      const b = M(new THREE.CylinderGeometry(0.45, 0.45, 1, 16), T('#6a4428'), x, y + (lying ? 0.45 : 0.5), z);
      if (lying) b.rotation.z = Math.PI / 2;
      add(b);
      for (const k of [-0.3, 0.3]) { const r = M(new THREE.TorusGeometry(0.46, 0.025, 6, 20), iron, x + (lying ? k : 0), y + (lying ? 0.45 : 0.5 + k), z); r.rotation.set(lying ? 0 : Math.PI / 2, lying ? Math.PI / 2 : 0, 0); add(r); }
      if (!lying || y === 0) circ(x, z, 0.5);
    };
    const shelves = (x, z, ry, len) => {
      const sh = new THREE.Group();
      sh.position.set(x, 0, z);
      sh.rotation.y = ry;
      const bottles = ['#3a7a3a', '#7a2a2a', '#c8a050', '#3a4a8a', '#e8e0d0'];
      for (const y of [1.4, 2.2, 3.0]) {
        sh.add(M(new THREE.BoxGeometry(len, 0.07, 0.42), wood, 0, y, 0));
        for (let i = 0; i < len / 0.32; i++) if ((i * 7 + y * 10) % 5 > 0.6) sh.add(M(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 8), T(bottles[(i + Math.round(y * 3)) % 5]), -len / 2 + 0.2 + i * 0.32, y + 0.19, 0));
      }
      add(sh);
    };
    const banner = (x, y, z, ry, col, len = 3) => {
      const bn = M(new THREE.PlaneGeometry(1.4, len), T(col, { side: THREE.DoubleSide }), x, y, z);
      bn.rotation.y = ry;
      add(bn);
      const em = M(new THREE.CircleGeometry(0.42, 20), T('#e0c060', { side: THREE.DoubleSide }), x, y + len * 0.15, z);
      em.rotation.y = ry;
      em.position.addScaledVector(new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), 0.01);
      add(em);
    };
    R.seats = [];
    if (kind === 'tavern') {
      // balcão do bar à esquerda, com o Gorm atrás
      const bx = -w / 2 + 2.6;
      add(M(new THREE.BoxGeometry(1, 1.1, 8), wood, bx, 0.55, -2));
      add(M(new THREE.BoxGeometry(1.25, 0.1, 8.2), dark, bx, 1.12, -2));
      box(bx, -2, 0.55, 4.1);
      shelves(-w / 2 + 0.35, -2, Math.PI / 2, 7);
      for (let i = 0; i < 5; i++) mug(bx + (i % 2 ? 0.2 : -0.15), 1.17, -5 + i * 1.5);
      for (let i = 0; i < 4; i++) stool(bx + 1.0, -4.8 + i * 1.6);
      R.vendor = { x: -w / 2 + 1.3, z: -1.5, yaw: -Math.PI / 2 };
      R.seats.push({ x: bx + 1.0, z: -3.2, yaw: Math.PI / 2, pose: 'drink' }, { x: bx + 1.0, z: 0, yaw: Math.PI / 2, pose: 'sit' });
      barrel(-w / 2 + 1, d / 2 - 1.2); barrel(-w / 2 + 2, d / 2 - 1.2); barrel(-w / 2 + 1.5, d / 2 - 1.2, 0.95, true);
      barrel(-w / 2 + 1, -d / 2 + 1); barrel(-w / 2 + 2.1, -d / 2 + 1);
      fireplace(4, -d / 2 + 0.5, 0);
      box(4, -d / 2 + 0.5, 1.4, 0.6);
      // mesas redondas com gente sentada
      const tables = [[0.5, -3.5], [6.5, -2.2], [0.5, 2.2], [5.8, 3.4], [-3.2, 5.2]];
      tables.forEach(([tx, tz], ti) => {
        roundTable(tx, tz);
        const n = 3 + (ti % 2);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + ti, sx = tx + Math.cos(a) * 1.15, sz = tz + Math.sin(a) * 1.15;
          stool(sx, sz);
          const yaw = Math.atan2(-(tx - sx), -(tz - sz));
          if ((ti + i) % 4 !== 3) R.seats.push({ x: sx, z: sz, yaw, pose: ['drink', 'eat', 'sit', 'drink'][(ti + i) % 4] });
          const mx = tx + Math.cos(a) * 0.45, mz = tz + Math.sin(a) * 0.45;
          if (i % 2) plate(mx, 0.82, mz, ['#c86a3a', '#e8c070', '#7a4a2a'][ti % 3]); else mug(mx, 0.82, mz);
        }
      });
      R.standers = [{ x: 7.2, z: -5.6, yaw: 0.6, pose: 'strum' }, { x: -5.5, z: -1.5, yaw: 2.2, pose: 'talk' }];
      chandelier(0, -1); chandelier(6, 1.5, 0.9);
      // javali dourado na parede do fundo
      add(M(new THREE.SphereGeometry(0.5, 16, 12), T('#e0b040'), -3, h - 2, -d / 2 + 0.3)).scale.set(1.5, 1, 0.4);
      const sign = M(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: signTexture(SHOPS.tavern.sign, SHOPS.tavern.color2, SHOPS.tavern.color) }), -3, h - 0.9, -d / 2 + 0.05);
      add(sign);
    } else {
      // Guilda: mesas compridas dos dois lados do corredor central, balcão da recepção no fundo e mezanino
      for (const tx of [-9.5, -4, 4, 9.5]) {
        add(M(new THREE.BoxGeometry(1.6, 0.1, 10), wood, tx, 0.8, -1));
        for (const lz of [-5.5, 3.5]) add(M(new THREE.BoxGeometry(1.3, 0.78, 0.15), dark, tx, 0.39, lz));
        box(tx, -1, 0.85, 5.05);
        for (const sx of [-1.25, 1.25]) {
          add(M(new THREE.BoxGeometry(0.45, 0.08, 10), wood, tx + sx, 0.45, -1));
          for (const lz of [-5.3, -1, 3.3]) add(M(new THREE.BoxGeometry(0.35, 0.45, 0.1), dark, tx + sx, 0.22, lz));
          for (let i = 0; i < 5; i++) {
            const sz = -4.8 + i * 1.9 + (sx > 0 ? 0.5 : 0);
            const slot = (Math.round(tx) * 3 + i * 7 + (sx > 0 ? 5 : 0)) % 9;
            if (slot < 4) R.seats.push({ x: tx + sx, z: sz, yaw: sx < 0 ? -Math.PI / 2 : Math.PI / 2, pose: ['drink', 'eat', 'sit', 'drink', 'eat', 'sit'][slot] });
            if (slot < 4) { if (slot % 2) plate(tx + sx * 0.45, 0.85, sz, ['#c86a3a', '#e8c070', '#7a4a2a'][i % 3]); else mug(tx + sx * 0.45, 0.85, sz); }
          }
        }
      }
      // queda de braço numa ponta de mesa
      R.seats.push({ x: 4 - 1.25, z: 3.9, yaw: -Math.PI / 2, pose: 'arm' }, { x: 4 + 1.25, z: 3.9, yaw: Math.PI / 2, pose: 'arm', phase: Math.PI });
      // recepção
      const rz = -d / 2 + 3.4;
      add(M(new THREE.BoxGeometry(9, 1.15, 1.1), wood, -2, 0.58, rz));
      add(M(new THREE.BoxGeometry(9.3, 0.1, 1.3), dark, -2, 1.17, rz));
      box(-2, rz, 4.6, 0.6);
      for (let i = 0; i < 6; i++) mug(-5.8 + i * 1.4, 1.22, rz + 0.2);
      shelves(-2, -d / 2 + 0.3, 0, 8.5);
      R.vendor = { x: -2, z: rz - 1.2, yaw: Math.PI };
      barrel(4.5, -d / 2 + 1); barrel(5.6, -d / 2 + 1); barrel(5.05, -d / 2 + 1, 0.95, true);
      // mezanino no fundo (decoração) com escada
      const my = 4.6;
      add(M(new THREE.BoxGeometry(w, 0.3, 3), dark, 0, my, -d / 2 + 1.5));
      add(M(new THREE.BoxGeometry(w, 0.08, 0.08), iron, 0, my + 1.05, -d / 2 + 3));
      for (let x = -w / 2 + 0.5; x < w / 2; x += 0.6) add(M(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), iron, x, my + 0.55, -d / 2 + 3));
      for (const x of [-w / 2 + 3, w / 2 - 3]) add(M(new THREE.CylinderGeometry(0.22, 0.22, my, 12), beam, x, my / 2, -d / 2 + 2.9));
      for (let i = 0; i < 12; i++) add(M(new THREE.BoxGeometry(1.6, 0.18, 0.5), wood, w / 2 - 1.6, (i + 1) * (my / 12), -d / 2 + 3.4 + (11 - i) * 0.5));
      box(w / 2 - 1.6, -d / 2 + 6.2, 0.85, 3.2);
      R.standers = [
        { x: -6, z: -d / 2 + 2.3, yaw: Math.PI, pose: 'lean', y: my + 0.15 }, { x: 2.5, z: -d / 2 + 2.3, yaw: Math.PI, pose: 'lean', y: my + 0.15 },
        { x: 9.5, z: 2.2, yaw: Math.PI / 2, pose: 'cheer', y: 0.85 }, { x: 0, z: 6.5, yaw: 2.6, pose: 'talk' }, { x: 1.4, z: 6.0, yaw: -2.4, pose: 'talk' },
        { x: w / 2 - 1.8, z: 1.3, yaw: -Math.PI / 2, pose: 'talk' },
      ];
      // quadro de pedidos na parede direita
      const qb = new THREE.Group();
      qb.position.set(w / 2 - 0.15, 0, 1.3);
      qb.rotation.y = -Math.PI / 2;
      qb.add(M(new THREE.BoxGeometry(4.4, 2.6, 0.15), wood, 0, 2.3, 0));
      const pc = ['#f4f0e0', '#fff8d0', '#f0e8f8', '#e8f4f0', '#ffe8d8'];
      for (let i = 0; i < 14; i++) { const pp = M(new THREE.PlaneGeometry(0.55, 0.7), T(pc[i % 5], { side: THREE.DoubleSide }), -1.8 + (i % 7) * 0.6, i < 7 ? 2.85 : 1.95, 0.09); pp.rotation.z = ((i * 37) % 10 - 5) * 0.02; qb.add(pp); }
      add(qb);
      R.board = new THREE.Vector3(S.base.x + w / 2 - 1.2, S.base.y, S.base.z + 1.3);
      fireplace(-w / 2 + 0.5, 4, Math.PI / 2);
      box(-w / 2 + 0.5, 4, 0.6, 1.4);
      // estandartes e o grande brasão no fundo
      for (let i = 0; i < 5; i++) banner(-12 + i * 6, h - 2.2, -d / 2 + 0.06, 0, i % 2 ? '#2a4a8a' : '#a02a2a', 3.2);
      const emb = M(new THREE.CircleGeometry(1.6, 6), T('#d8b050', { side: THREE.DoubleSide }), 0, h - 2.6, -d / 2 + 0.08);
      add(emb);
      add(M(new THREE.CircleGeometry(1.2, 6), T('#a02a2a', { side: THREE.DoubleSide }), 0, h - 2.6, -d / 2 + 0.1));
      for (const s of [-1, 1]) { const sw = M(new THREE.BoxGeometry(0.16, 2.4, 0.04), T('#e8ecf0'), 0, h - 2.6, -d / 2 + 0.12); sw.rotation.z = s * 0.7; add(sw); }
      const sign = M(new THREE.PlaneGeometry(6.4, 1.3), new THREE.MeshBasicMaterial({ map: signTexture(SHOPS.guild.sign, SHOPS.guild.color2, SHOPS.guild.color) }), 0, my + 2.0, -d / 2 + 0.07);
      add(sign);
      for (let i = 0; i < 4; i++) { const bn = M(new THREE.PlaneGeometry(1.2, 2.6), T(i % 2 ? '#a02a2a' : '#d8b050', { side: THREE.DoubleSide }), -9 + i * 6, h - 1.6, 4); add(bn); }
      chandelier(-6, 0, 1.4); chandelier(6, 0, 1.4); chandelier(0, 6, 1.1);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    g.visible = false;
    this.game.scene.add(g);
    this.rooms[kind] = R;
    return R;
  }

  // NPCs de cada salão (chamado por npcs.populate a cada andar)
  populate(add) {
    const n = this.game.floor.n;
    for (const kind of Object.keys(HALLS)) {
      const R = this.room(kind), S = HALLS[kind], rand = mulberry32(this.game.floor.seed * 7 + kind.length);
      const opts = (o) => ({ fixed: true, noTurn: true, hall: { y: S.base.y + (o.y || 0) }, pose: o.pose, phase: o.phase ?? rand() * 6, yaw: o.yaw });
      const spec = SHOPS[kind];
      const vendor = { ...randomTownsfolk(mulberry32(this.game.floor.seed + kind.length * 31), false), ...spec.npc };
      add(vendor, S.base.x + R.vendor.x, S.base.z + R.vendor.z, { role: kind, fixed: true, yaw: R.vendor.yaw, hall: { y: S.base.y } });
      const lines = kind === 'guild' ? GUILD_LINES : TAVERN_LINES;
      for (const s of [...R.seats, ...R.standers]) {
        // nem todo lugar está ocupado — e muda a cada andar
        if (s.pose !== 'arm' && s.pose !== 'strum' && rand() < 0.22) continue;
        const def = randomTownsfolk(rand, false);
        if (kind === 'guild' && rand() < 0.4) Object.assign(def, { top: ['#a02a2a', '#2a4a8a', '#4a4a52', '#d8b050'][Math.floor(rand() * 4)] });
        const name = s.pose === 'strum' ? 'Bardo' : kind === 'guild' ? 'Membro da Guilda' : 'Frequentador';
        add(def, S.base.x + s.x, S.base.z + s.z, { ...opts(s), role: 'patron', name, title: s.pose === 'strum' ? `Canções de ${n === 1 ? 'Aincrad' : `Andar ${n}`}` : '', lines });
      }
    }
  }

  // ─────────── Entrar / sair ───────────
  enter(kind) {
    const g = this.game, R = this.room(kind), S = HALLS[kind];
    for (const r of Object.values(this.rooms)) r.g.visible = r === R;
    this.cur = R;
    g.indoor = { y: S.base.y, ctl: this, kind, minX: S.base.x - S.w / 2 + 0.5, maxX: S.base.x + S.w / 2 - 0.5, minZ: S.base.z - S.d / 2 + 0.5, maxZ: S.base.z + S.d / 2 - 0.5 };
    g.ui.fade(() => {
      g.player.pos.set(S.base.x, S.base.y, S.base.z + S.d / 2 - 1.6);
      g.player.vel.set(0, 0, 0);
      g.player.yaw = 0;
      g.player.pitch = 0;
      g.combat.setSheathed(true, true);
      g.ui.toast(`${SHOPS[kind].title} · [E] na porta para sair`);
      g.input.lock();
    });
  }

  exit() {
    const g = this.game, kind = this.cur?.kind, sp = g.world.shopSpots?.[kind];
    g.ui.fade(() => {
      g.indoor = null;
      if (this.cur) this.cur.g.visible = false;
      this.cur = null;
      const p = sp ? sp.front : g.world.gatePos;
      g.player.place(p.x, p.z, sp ? sp.yaw : 0);
      g.input.lock();
    });
  }

  resolve(pos, r) {
    if (!this.cur) return;
    for (const c of this.cur.colliders) {
      if (c.hw !== undefined) {
        const dx = pos.x - c.x, dz = pos.z - c.z, ox = c.hw + r - Math.abs(dx), oz = c.hd + r - Math.abs(dz);
        if (ox > 0 && oz > 0) { if (ox < oz) pos.x += Math.sign(dx) * ox; else pos.z += Math.sign(dz) * oz; }
        continue;
      }
      const dx = pos.x - c.x, dz = pos.z - c.z, m = r + c.r, dd = Math.hypot(dx, dz);
      if (dd < m && dd > 1e-4) { pos.x = c.x + (dx / dd) * m; pos.z = c.z + (dz / dd) * m; }
    }
  }

  interact() {
    const R = this.cur, g = this.game, pl = g.player.pos;
    if (!R) return { hint: null, act: null };
    const S = R.S;
    if (Math.hypot(pl.x - S.base.x, pl.z - (S.base.z + S.d / 2)) < 2.2) return { hint: '[E] Sair', act: () => this.exit() };
    if (R.board && Math.hypot(pl.x - R.board.x, pl.z - R.board.z) < 2.6) return { hint: '[E] Quadro de Pedidos da Guilda', act: () => g.ui.openDialog(g.boardNpc()) };
    return { hint: null, act: null };
  }

  update(dt) {
    const R = this.cur, g = this.game;
    if (!R) return;
    const t = g.time;
    R.fires.forEach((f, i) => f.scale.set(1 + Math.sin(t * 13 + i) * 0.12, 1 + Math.sin(t * 9 + i * 2) * 0.22, 1));
    R.candles.forEach((c, i) => { c.scale.y = 1.6 + Math.sin(t * 17 + i * 1.7) * 0.25; });
    R.lights.forEach((l, i) => { l.intensity = (l.userData.base ??= l.intensity) * (0.92 + Math.sin(t * 11 + i * 3) * 0.06); });
    R.winMat.color.set(g.night > 0.5 ? '#203050' : '#bfe4ff');
  }
}

// Poses dos frequentadores (aplicadas depois da animação normal do personagem)
export function applyPose(c, pose, t, phase = 0) {
  const p = c.parts;
  if (!p?.legs?.length) return;
  const seated = pose === 'sit' || pose === 'drink' || pose === 'eat' || pose === 'arm';
  if (seated) {
    p.legs[0].rotation.x = p.legs[1].rotation.x = 1.5;
    if (p.knees) p.knees[0].rotation.x = p.knees[1].rotation.x = -1.5;
    c.inner.position.y = -0.38 + Math.sin(t * 1.6 + phase) * 0.004;
    p.arms[0].rotation.x = 0.55;
    p.arms[1].rotation.x = 0.55;
  }
  if (pose === 'drink') {
    // leva a caneca à boca a cada poucos segundos
    const cyc = (t * 0.22 + phase) % 1, lift = cyc < 0.18 ? Math.sin((cyc / 0.18) * Math.PI) : 0;
    p.arms[1].rotation.x = 0.55 + lift * 1.75;
    p.arms[1].rotation.z = -0.08 - lift * 0.35;
    p.head.rotation.x = -lift * 0.25;
  } else if (pose === 'eat') {
    const k = Math.max(0, Math.sin(t * 4 + phase));
    p.arms[1].rotation.x = 0.7 + k * 0.6;
    p.head.rotation.x = 0.12 - k * 0.05;
  } else if (pose === 'arm') {
    p.arms[1].rotation.x = 1.25 + Math.sin(t * 9 + phase) * 0.06;
    p.arms[1].rotation.z = -0.15;
    p.head.rotation.x = 0.15;
  } else if (pose === 'cheer') {
    const k = Math.sin(t * 6 + phase);
    p.arms[0].rotation.x = 2.9 + k * 0.2;
    p.arms[1].rotation.x = 2.9 - k * 0.2;
    p.arms[0].rotation.z = 0.3; p.arms[1].rotation.z = -0.3;
    c.inner.position.y = Math.abs(Math.sin(t * 6 + phase)) * 0.12;
  } else if (pose === 'strum') {
    p.arms[0].rotation.x = 1.0; p.arms[0].rotation.z = 0.6;
    p.arms[1].rotation.x = 0.7 + Math.sin(t * 10 + phase) * 0.15; p.arms[1].rotation.z = -0.5;
    p.head.rotation.z = Math.sin(t * 2 + phase) * 0.12;
  } else if (pose === 'lean') {
    p.arms[0].rotation.x = p.arms[1].rotation.x = 1.25;
    c.inner.rotation.x = 0.1;
  } else if (pose === 'talk') {
    p.arms[1].rotation.x = 0.4 + Math.max(0, Math.sin(t * 3 + phase)) * 0.6;
    p.arms[0].rotation.x = 0.2 + Math.max(0, Math.sin(t * 2.3 + phase + 1)) * 0.4;
  }
}

// Objetos nas mãos (caneca, alaúde)
export function poseProps(c, pose) {
  const arm = c.parts?.arms?.[1];
  if (!arm) return;
  if (pose === 'drink' || pose === 'cheer') {
    const m = new THREE.Group();
    m.add(M(new THREE.CylinderGeometry(0.06, 0.055, 0.16, 10), T('#c8a060')), M(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 10), T('#fff4dc'), 0, 0.085, 0));
    m.position.set(0, -0.6, -0.04);
    m.rotation.x = pose === 'drink' ? -0.5 : 0;
    arm.add(m);
  } else if (pose === 'strum') {
    const l = new THREE.Group();
    const body = M(new THREE.SphereGeometry(0.2, 14, 10), T('#a86a30'));
    body.scale.set(1, 1.2, 0.35);
    l.add(body, M(new THREE.BoxGeometry(0.06, 0.5, 0.03), T('#6a4428'), 0, 0.38, 0), M(new THREE.CircleGeometry(0.06, 12), T('#2a1a10'), 0, 0.04, -0.075));
    l.position.set(0.05, 1.12, -0.22);
    l.rotation.set(0.1, 0, -1.0);
    c.inner.add(l);
  }
}
