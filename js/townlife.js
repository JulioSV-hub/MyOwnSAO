// Vida na cidade: cavalos andando pelas ruas circulares (um puxando carroça) e dragões que às vezes cruzam o céu.
import * as THREE from 'three';
import { toonMat } from './toon.js';
import { buildMonster } from './monsters.js';
import { mulberry32 } from './rng.js';

const mats = new Map();
const T = (c) => { if (!mats.has(c)) mats.set(c, toonMat(c)); return mats.get(c); };
const M = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };
const CAP = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);

const COATS = [['#7a4a2a', '#2a1a10'], ['#f0ece4', '#d8d0c0'], ['#2a2420', '#141210'], ['#a0602e', '#f0e0c0'], ['#8a8a8e', '#3a3a3e'], ['#c89a5a', '#f4ecd8']];
const BLANKETS = ['#a02a2a', '#2a4a8a', '#3a6a3a', '#d8b050', '#6a3a8a'];

// cavalo de frente para -Z, cascos em y=0
function buildHorse(coat, mane, blanket) {
  const g = new THREE.Group(), body = T(coat), hair = T(mane), dark = T('#1e1612');
  const torso = M(CAP(0.36, 1.0), body, 0, 1.25, 0);
  torso.rotation.x = Math.PI / 2;
  g.add(torso);
  const neck = M(CAP(0.17, 0.55), body, 0, 1.62, -0.72);
  neck.rotation.x = -0.75;
  g.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 1.98, -0.98);
  const skull = M(CAP(0.13, 0.42), body, 0, 0, -0.16);
  skull.rotation.x = Math.PI / 2 - 0.5;
  head.add(skull, M(new THREE.SphereGeometry(0.12, 10, 8), body, 0, -0.14, -0.42));
  for (const s of [-1, 1]) { const e = M(new THREE.ConeGeometry(0.05, 0.16, 6), body, s * 0.08, 0.14, 0.02); head.add(e); head.add(M(new THREE.SphereGeometry(0.028, 8, 6), dark, s * 0.11, 0.0, -0.18)); }
  g.add(head);
  for (let i = 0; i < 6; i++) g.add(M(new THREE.BoxGeometry(0.06, 0.16, 0.14), hair, 0, 1.75 + i * 0.06, -0.5 - i * 0.09));
  const tail = M(CAP(0.07, 0.55), hair, 0, 1.15, 0.78);
  tail.rotation.x = 0.45;
  g.add(tail);
  if (blanket) { const b = M(new THREE.BoxGeometry(0.8, 0.05, 0.75), T(blanket), 0, 1.6, -0.05); g.add(b, M(new THREE.BoxGeometry(0.34, 0.12, 0.42), T('#5a3a22'), 0, 1.66, -0.05)); }
  const legs = [];
  for (const [x, z] of [[-0.2, -0.5], [0.2, -0.5], [-0.2, 0.5], [0.2, 0.5]]) {
    const p = new THREE.Group();
    p.position.set(x, 1.05, z);
    p.add(M(CAP(0.07, 0.75), body, 0, -0.45, 0), M(new THREE.CylinderGeometry(0.075, 0.085, 0.12, 8), dark, 0, -0.98, 0));
    g.add(p);
    legs.push(p);
  }
  return { g, legs, head, tail };
}

function buildCart() {
  const g = new THREE.Group(), wood = T('#8a5a36'), dark = T('#4a3424');
  g.add(M(new THREE.BoxGeometry(1.4, 0.5, 1.8), wood, 0, 0.95, 0), M(new THREE.BoxGeometry(1.5, 0.08, 1.9), dark, 0, 0.7, 0));
  // carga: sacos e caixas
  g.add(M(new THREE.SphereGeometry(0.3, 10, 8), T('#d8c8a0'), -0.3, 1.3, 0.3), M(new THREE.BoxGeometry(0.5, 0.4, 0.5), T('#a0703a'), 0.3, 1.35, -0.3), M(new THREE.SphereGeometry(0.26, 10, 8), T('#c8b890'), 0.25, 1.3, 0.45));
  for (const s of [-1, 1]) g.add(M(new THREE.BoxGeometry(0.06, 0.06, 1.6), dark, s * 0.45, 0.85, -1.5));
  const wheels = [];
  for (const s of [-1, 1]) {
    const wh = new THREE.Group();
    wh.position.set(s * 0.8, 0.55, 0.1);
    wh.add(M(new THREE.TorusGeometry(0.5, 0.05, 6, 20).rotateY(Math.PI / 2), dark));
    for (let i = 0; i < 4; i++) { const sp = M(new THREE.BoxGeometry(0.04, 0.95, 0.04), dark); sp.rotation.x = (i / 4) * Math.PI; wh.add(sp); }
    g.add(wh);
    wheels.push(wh);
  }
  return { g, wheels };
}

export class TownLife {
  constructor(game) {
    this.game = game;
    this.horses = [];
    this.dragons = [];
    this.root = null;
    this.dragonT = 25;
  }

  spawn() {
    this.clear();
    const g = this.game, w = g.world, rand = mulberry32(g.floor.seed + 4242);
    this.root = new THREE.Group();
    g.scene.add(this.root);
    // 5 cavalos: nas duas ruas circulares, em sentidos opostos; o primeiro puxa uma carroça
    const lanes = [[32.4, 1], [34.2, -1], [52, 1], [51, -1], [33.3, 1]];
    lanes.forEach(([R, dir], i) => {
      const [coat, mane] = COATS[Math.floor(rand() * COATS.length)];
      const h = buildHorse(coat, mane, rand() < 0.6 ? BLANKETS[Math.floor(rand() * BLANKETS.length)] : null);
      const horse = { ...h, R, dir, ang: rand() * Math.PI * 2, speed: 1.3 + rand() * 0.5, walk: rand() * 10, pause: 0, pos: new THREE.Vector3() };
      if (i === 0) { horse.cart = buildCart(); this.root.add(horse.cart.g); }
      this.root.add(h.g);
      this.horses.push(horse);
    });
    this.w = w;
  }

  clear() {
    if (this.root) {
      this.game.scene.remove(this.root);
      this.root.traverse((o) => o.geometry?.dispose());
    }
    for (const d of this.dragons) this.game.scene.remove(d.mesh);
    this.root = null;
    this.horses = [];
    this.dragons = [];
  }

  spawnDragon() {
    const g = this.game, pl = g.player.pos;
    const cols = [['#a02a2a', '#e0a040', '#5a1a1a'], ['#2a5a3a', '#c8d870', '#1a3a2a'], ['#2a3a6a', '#a8d0ff', '#1a2448'], ['#2a2430', '#c86aff', '#14101a'], ['#e8e0d0', '#ffd060', '#c8b8a0']];
    const [c1, c2, c3] = cols[Math.floor(Math.random() * cols.length)];
    const m = buildMonster({ name: 'Dragão', arch: 'quad', color: c1, color2: c2, wingColor: c3, wings: true, wingSpan: 1.7, tail: true, horns: true, scale: 3.2 + Math.random() * 1.5, eye: '#ffd040' }, false);
    m.parts.legs.forEach((l) => { l.rotation.x = 0.9; });
    const a = Math.random() * Math.PI * 2, off = (Math.random() - 0.5) * 80;
    const dirV = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), side = new THREE.Vector3(-dirV.z, 0, dirV.x);
    const from = pl.clone().addScaledVector(dirV, -280).addScaledVector(side, off), to = pl.clone().addScaledVector(dirV, 280).addScaledVector(side, off * 0.4);
    const y = 55 + Math.random() * 40;
    from.y = to.y = y;
    g.scene.add(m.group);
    this.dragons.push({ mesh: m.group, parts: m.parts, from, to, t: 0, dur: 22 + Math.random() * 8, yaw: Math.atan2(-(to.x - from.x), -(to.z - from.z)) });
    if (Math.random() < 0.5 && !g.indoor) g.ui.toast('Uma sombra enorme passa pelo céu... um dragão!');
  }

  update(dt) {
    const g = this.game, t = g.time, w = g.world;
    if (!this.root || !w) return;
    const pl = g.player.pos, indoor = !!g.indoor;
    this.root.visible = !indoor;
    for (const h of this.horses) {
      // para se o jogador estiver bem na frente
      const ahead = new THREE.Vector3(Math.cos(h.ang + h.dir * 0.08) * h.R, 0, Math.sin(h.ang + h.dir * 0.08) * h.R);
      const blocked = !indoor && Math.hypot(pl.x - ahead.x, pl.z - ahead.z) < 2.2;
      h.pause = blocked ? Math.min(1, h.pause + dt * 3) : Math.max(0, h.pause - dt * 2);
      const sp = h.speed * (1 - h.pause);
      h.ang += (h.dir * sp * dt) / h.R;
      h.walk += dt * sp * 4.2;
      const x = Math.cos(h.ang) * h.R, z = Math.sin(h.ang) * h.R;
      h.pos.set(x, w.groundAt(x, z), z);
      const tx = -Math.sin(h.ang) * h.dir, tz = Math.cos(h.ang) * h.dir;
      h.g.position.copy(h.pos);
      h.g.rotation.y = Math.atan2(-tx, -tz);
      const s = Math.sin(h.walk), amp = sp > 0.1 ? 0.42 : 0;
      h.legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3 ? s : -s) * amp; });
      h.head.rotation.x = Math.sin(h.walk * 2) * 0.05 * (amp ? 1 : 0) + (amp ? 0 : Math.sin(t * 0.7) * 0.15 + 0.2);
      h.tail.rotation.z = Math.sin(t * 2 + h.walk) * 0.2;
      if (h.cart) {
        const ca = h.ang - h.dir * (2.6 / h.R), cx = Math.cos(ca) * h.R, cz = Math.sin(ca) * h.R;
        h.cart.g.position.set(cx, w.groundAt(cx, cz), cz);
        h.cart.g.rotation.y = h.g.rotation.y;
        h.cart.wheels.forEach((wh) => { wh.rotation.x -= (sp * dt) / 0.5; });
      }
      // o jogador não atravessa o cavalo
      if (!indoor) {
        const dx = pl.x - x, dz = pl.z - z, d = Math.hypot(dx, dz);
        if (d < 1.1 && d > 1e-3) { pl.x = x + (dx / d) * 1.1; pl.z = z + (dz / d) * 1.1; }
      }
    }
    // dragões cruzando o céu de vez em quando
    this.dragonT -= dt;
    if (this.dragonT <= 0 && !indoor) { this.dragonT = 70 + Math.random() * 110; this.spawnDragon(); }
    for (let i = this.dragons.length - 1; i >= 0; i--) {
      const d = this.dragons[i];
      d.t += dt;
      const f = d.t / d.dur;
      d.mesh.position.lerpVectors(d.from, d.to, f);
      d.mesh.position.y += Math.sin(d.t * 0.6) * 4;
      d.mesh.rotation.y = d.yaw;
      d.mesh.rotation.z = Math.sin(d.t * 0.4) * 0.12;
      const flap = Math.sin(d.t * 2.4) * 0.65;
      d.parts.wings.forEach((wg, k) => { wg.rotation.z = k ? flap : -flap; });
      d.mesh.visible = !indoor;
      if (f >= 1) { g.scene.remove(d.mesh); this.dragons.splice(i, 1); }
    }
  }
}
