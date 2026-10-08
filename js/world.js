// Geração procedural de um andar de Aincrad: ilha flutuante, cidade com Portal, campos, arena do chefe e Labirinto.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeNoise2D, mulberry32, fbm, smoothstep, lerp } from './rng.js';
import { MAX_FLOOR } from './data.js';

export const FLOOR_R = 230;
export const TOWN_R = 34;
export const ARENA_R = 24;
const ARENA_DIST = 165;
const TOWER_GAP = 54;

// Grade espacial para colisões rápidas (círculos e caixas rotacionadas).
class Grid {
  constructor(cell) { this.cell = cell; this.map = new Map(); this.stamp = 0; }
  key(i, j) { return (i + 1000) * 4000 + (j + 1000); }
  add(c) {
    const r = c.r ?? Math.hypot(c.hw, c.hd);
    const i0 = Math.floor((c.x - r) / this.cell), i1 = Math.floor((c.x + r) / this.cell);
    const j0 = Math.floor((c.z - r) / this.cell), j1 = Math.floor((c.z + r) / this.cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this.key(i, j);
      let l = this.map.get(k);
      if (!l) this.map.set(k, (l = []));
      l.push(c);
    }
  }
  query(x, z, r, out) {
    out.length = 0;
    const s = ++this.stamp;
    const i0 = Math.floor((x - r) / this.cell), i1 = Math.floor((x + r) / this.cell);
    const j0 = Math.floor((z - r) / this.cell), j1 = Math.floor((z + r) / this.cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const l = this.map.get(this.key(i, j));
      if (!l) continue;
      for (const c of l) if (c._s !== s) { c._s = s; out.push(c); }
    }
    return out;
  }
}

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true, ...o });
const hdr = (hex, k) => { const c = new THREE.Color(hex); return c.multiplyScalar(k); };

function cloudTexture() {
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 10 + Math.random() * 38, a = 0.05 + Math.random() * 0.14;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, `rgba(255,255,255,${a})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class World {
  constructor(game, floor) {
    this.game = game;
    this.floor = floor;
    this.b = floor.biome;
    this.rand = mulberry32(floor.seed);
    this.noise = makeNoise2D(floor.seed);
    this.noise2 = makeNoise2D(floor.seed + 101);
    this.noise3 = makeNoise2D(floor.seed + 202);
    this.group = new THREE.Group();
    this.grid = new Grid(8);
    this._q = [];
    this.anim = [];
    this.labels = [];
    this.water = this.b.water || null;
    this.townH = 0.5;
    this.arenaH = 0.5;

    const a = this.rand() * Math.PI * 2;
    this.arenaDir = a;
    this.arenaPos = new THREE.Vector3(Math.cos(a) * ARENA_DIST, this.arenaH, Math.sin(a) * ARENA_DIST);
    const td = ARENA_DIST + TOWER_GAP;
    this.towerPos = new THREE.Vector3(Math.cos(a) * td, this.arenaH, Math.sin(a) * td);
    this.gatePos = new THREE.Vector3(0, this.townH, 0);
    this.npcPos = new THREE.Vector3(8, this.townH, 4);
    this.spokes = [0, 0.5, 1, 1.5].map((k, i) => ({
      dx: Math.cos(a + k * Math.PI), dz: Math.sin(a + k * Math.PI),
      len: i === 0 ? ARENA_DIST - ARENA_R + 2 : 70 + this.rand() * 70,
    }));

    this.buildTerrain();
    this.buildEnvironment();
    this.buildTrees();
    this.buildRocks();
    if (this.b.ruins) this.buildRuins();
    this.buildTown();
    this.buildGate();
    this.buildNpc();
    this.buildArena();
  }

  // ─────────── Terreno ───────────
  pathDist(x, z) {
    let best = 1e9;
    for (const s of this.spokes) {
      const t = Math.max(TOWN_R - 8, Math.min(s.len, x * s.dx + z * s.dz));
      const d = Math.hypot(x - s.dx * t, z - s.dz * t);
      if (d < best) best = d;
    }
    return best;
  }

  heightAt(x, z) {
    const b = this.b, f = b.freq || 0.008;
    let h = fbm(this.noise, x * f, z * f, 4) * b.amp;
    h += Math.abs(this.noise2(x * f * 0.4, z * f * 0.4)) * b.amp * 0.7;
    if (b.terrace) {
      const k = h / b.terrace, fl = Math.floor(k);
      h = (fl + smoothstep(0.7, 1, k - fl)) * b.terrace;
    }
    h += b.base || 0;
    const pd = this.pathDist(x, z);
    h = lerp(h * 0.6 + 0.3, h, smoothstep(2, 9, pd));
    const dt = Math.hypot(x, z);
    h = lerp(this.townH, h, smoothstep(TOWN_R, TOWN_R + 30, dt));
    const da = Math.hypot(x - this.arenaPos.x, z - this.arenaPos.z);
    h = lerp(this.arenaH, h, smoothstep(ARENA_R + 2, ARENA_R + 26, da));
    const dw = Math.hypot(x - this.towerPos.x, z - this.towerPos.z);
    h = lerp(this.arenaH, h, smoothstep(30, 48, dw));
    if (dt > FLOOR_R) h -= (dt - FLOOR_R) * 1.8;
    return h;
  }

  groundAt(x, z) {
    const N = this.N, W = N + 1, H = this.H;
    let fx = (x + this.half) / this.cell, fz = (z + this.half) / this.cell;
    fx = Math.min(Math.max(fx, 0), N - 0.0001);
    fz = Math.min(Math.max(fz, 0), N - 0.0001);
    const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz;
    const ha = H[iz * W + ix], hb = H[(iz + 1) * W + ix], hc = H[(iz + 1) * W + ix + 1], hd = H[iz * W + ix + 1];
    if (u + v <= 1) return ha + (hd - ha) * u + (hb - ha) * v;
    return hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - v);
  }

  buildTerrain() {
    const b = this.b;
    const N = 224, half = FLOOR_R + 50, cell = (half * 2) / N, W = N + 1;
    this.N = N; this.half = half; this.cell = cell;
    const H = new Float32Array(W * W);
    for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) H[iz * W + ix] = this.heightAt(ix * cell - half, iz * cell - half);
    this.H = H;

    const pos = new Float32Array(W * W * 3), colr = new Float32Array(W * W * 3);
    const g0 = new THREE.Color(b.ground[0]), g1 = new THREE.Color(b.ground[1]), g2 = new THREE.Color(b.ground[2]);
    const cliff = new THREE.Color(b.cliff), path = new THREE.Color(b.path), plaza = new THREE.Color(b.plaza);
    const edge = new THREE.Color(b.cliff).multiplyScalar(0.55);
    const shore = this.water?.lava ? new THREE.Color('#1a1210') : new THREE.Color(b.ground[2]).lerp(new THREE.Color('#e0d4a0'), 0.5);
    const c = new THREE.Color(), tmp = new THREE.Color();
    for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) {
      const i = iz * W + ix, x = ix * cell - half, z = iz * cell - half, h = H[i];
      pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;
      const hx = H[iz * W + Math.min(ix + 1, N)] - H[iz * W + Math.max(ix - 1, 0)];
      const hz = H[Math.min(iz + 1, N) * W + ix] - H[Math.max(iz - 1, 0) * W + ix];
      const slope = Math.hypot(hx, hz) / (2 * cell);
      const n = this.noise3(x * 0.05, z * 0.05) * 0.5 + 0.5;
      c.copy(g0).lerp(g1, n);
      c.lerp(g2, smoothstep(b.amp * 0.4, b.amp * 1.3, h - (b.base || 0)) * 0.7);
      c.lerp(cliff, smoothstep(0.45, 0.95, slope));
      if (this.water) c.lerp(shore, smoothstep(this.water.level + 0.8, this.water.level - 0.1, h) * 0.8);
      c.lerp(path, (1 - smoothstep(2.2, 3.8, this.pathDist(x, z))) * 0.85);
      const dt = Math.hypot(x, z);
      const pz = 1 - smoothstep(TOWN_R - 7, TOWN_R - 3, dt);
      if (pz > 0) {
        const tile = ((Math.floor(x / 2.5) + Math.floor(z / 2.5)) & 1) ? 0.9 : 1;
        tmp.copy(plaza).multiplyScalar(tile * (0.94 + n * 0.12));
        c.lerp(tmp, pz);
      }
      c.lerp(edge, smoothstep(FLOOR_R - 2, FLOOR_R + 8, dt));
      colr[i * 3] = c.r; colr[i * 3 + 1] = c.g; colr[i * 3 + 2] = c.b;
    }
    const idx = [];
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const cx = (ix + 0.5) * cell - half, cz = (iz + 0.5) * cell - half;
      if (Math.hypot(cx, cz) > FLOOR_R + 26) continue;
      const a = iz * W + ix, bb = (iz + 1) * W + ix, cc = (iz + 1) * W + ix + 1, d = iz * W + ix + 1;
      idx.push(a, bb, d, bb, cc, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, std(0xffffff, { vertexColors: true }));
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  buildEnvironment() {
    const b = this.b;
    // Base rochosa da ilha flutuante
    const skirt = new THREE.ConeGeometry(FLOOR_R + 30, 170, 48, 6, true);
    skirt.rotateX(Math.PI);
    const p = skirt.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + this.noise(x * 0.03 + y * 0.02, z * 0.03) * 0.08 * (y < 80 ? 1 : 0);
      p.setXYZ(i, x * k, y, z * k);
    }
    skirt.computeVertexNormals();
    const sk = new THREE.Mesh(skirt, std(new THREE.Color(b.cliff).multiplyScalar(0.6)));
    sk.position.y = -30 - 85;
    this.group.add(sk);

    // Mar de nuvens abaixo de Aincrad
    this.cloudMat = new THREE.MeshBasicMaterial({ map: cloudTexture(), transparent: true, opacity: 0.95, depthWrite: false, color: '#ffffff' });
    const clouds = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), this.cloudMat);
    clouds.position.y = -190;
    this.group.add(clouds);

    // Teto: a parte de baixo do andar de cima
    if (this.floor.n < MAX_FLOOR) {
      const ceil = new THREE.Mesh(new THREE.CylinderGeometry(FLOOR_R + 40, FLOOR_R + 70, 40, 48, 1), std('#4a4640'));
      ceil.position.y = 345;
      this.group.add(ceil);
      const stal = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 5), std('#55504a'), 90);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
      for (let i = 0; i < 90; i++) {
        const r = Math.sqrt(this.rand()) * (FLOOR_R + 30), a = this.rand() * Math.PI * 2, s = 4 + this.rand() * 10, hgt = 10 + this.rand() * 40;
        m.compose(new THREE.Vector3(Math.cos(a) * r, 325 - hgt / 2, Math.sin(a) * r), q, new THREE.Vector3(s, hgt, s));
        stal.setMatrixAt(i, m);
      }
      this.group.add(stal);
    }

    if (this.water) {
      const w = this.water;
      const mat = w.lava
        ? new THREE.MeshStandardMaterial({ color: w.color, emissive: w.color, emissiveIntensity: 1.6, roughness: 0.6 })
        : new THREE.MeshStandardMaterial({ color: w.color, transparent: true, opacity: w.opacity, roughness: 0.12, metalness: 0.25 });
      this.waterMesh = new THREE.Mesh(new THREE.CircleGeometry(FLOOR_R + 10, 96).rotateX(-Math.PI / 2), mat);
      this.waterMesh.position.y = w.level;
      this.waterMesh.receiveShadow = !w.lava;
      this.group.add(this.waterMesh);
    }
  }

  // ─────────── Vegetação e rochas ───────────
  buildTrees() {
    const t = this.b.trees;
    if (!t || !t.count) return;
    let trunkGeo = null, crownGeo = null;
    switch (t.style) {
      case 'pine':
        trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 2, 6).translate(0, 1, 0);
        crownGeo = mergeGeometries([new THREE.ConeGeometry(1.7, 3.2, 7).translate(0, 3.2, 0), new THREE.ConeGeometry(1.2, 2.6, 7).translate(0, 4.9, 0)]);
        break;
      case 'dead':
        trunkGeo = mergeGeometries([
          new THREE.CylinderGeometry(0.12, 0.32, 4.4, 5).translate(0, 2.2, 0),
          new THREE.BoxGeometry(0.12, 1.7, 0.12).rotateZ(0.85).translate(0.55, 3.2, 0),
          new THREE.BoxGeometry(0.1, 1.4, 0.1).rotateZ(-0.9).translate(-0.48, 2.5, 0.1),
          new THREE.BoxGeometry(0.1, 1.2, 0.1).rotateX(0.8).translate(0, 3.6, 0.42),
        ]);
        break;
      case 'crystal':
        crownGeo = new THREE.OctahedronGeometry(1, 0).scale(0.7, 2.6, 0.7).translate(0, 2.0, 0);
        break;
      default:
        trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.4, 6).translate(0, 1.2, 0);
        crownGeo = new THREE.IcosahedronGeometry(1.7, 0).translate(0, 3.5, 0);
    }
    const spots = [];
    let tries = t.count * 5;
    const r = this.rand;
    const clumpT = t.style === 'pine' && t.count > 600 ? -0.45 : -0.1;
    while (spots.length < t.count && tries-- > 0) {
      const rad = (FLOOR_R - 8) * Math.sqrt(r()), ang = r() * Math.PI * 2;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      if (!this.freeSpot(x, z, 5)) continue;
      if (this.noise2(x * 0.012, z * 0.012) < clumpT) continue;
      const h = this.groundAt(x, z);
      if (this.water && h < this.water.level + 0.3) continue;
      spots.push({ x, z, h, s: 0.75 + r() * 0.7, rot: r() * Math.PI * 2, k: 0.85 + r() * 0.3 });
    }
    const n = spots.length;
    const trunkMat = std(t.trunk);
    const crownMat = t.style === 'crystal'
      ? new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.15, metalness: 0.2, flatShading: true, emissive: '#2a2a44', transparent: true, opacity: 0.88 })
      : std('#ffffff');
    const trunks = trunkGeo ? new THREE.InstancedMesh(trunkGeo, trunkMat, n) : null;
    const crowns = crownGeo ? new THREE.InstancedMesh(crownGeo, crownMat, n) : null;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    spots.forEach((s, i) => {
      q.setFromAxisAngle(up, s.rot);
      m.compose(new THREE.Vector3(s.x, s.h - 0.1, s.z), q, new THREE.Vector3(s.s, s.s * s.k, s.s));
      trunks?.setMatrixAt(i, m);
      if (crowns) {
        crowns.setMatrixAt(i, m);
        c.set(t.leaf[i % t.leaf.length]).multiplyScalar(0.85 + r() * 0.3);
        crowns.setColorAt(i, c);
      }
      this.grid.add({ x: s.x, z: s.z, r: (t.style === 'crystal' ? 0.6 : 0.42) * s.s });
    });
    for (const im of [trunks, crowns]) if (im) { im.castShadow = true; im.receiveShadow = true; this.group.add(im); }
  }

  buildRocks() {
    const n = this.b.rocks || 0;
    if (!n) return;
    const im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), std('#ffffff'), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    const r = this.rand;
    let k = 0;
    for (let tries = 0; tries < n * 4 && k < n; tries++) {
      const rad = (FLOOR_R - 4) * Math.sqrt(r()), ang = r() * Math.PI * 2;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      if (!this.freeSpot(x, z, 4)) continue;
      const s = 0.4 + Math.pow(r(), 2) * 2.4;
      const sx = s * (0.8 + r() * 0.6), sy = s * (0.5 + r() * 0.5), sz = s * (0.8 + r() * 0.6);
      e.set(r() * 3, r() * 3, r() * 3);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, this.groundAt(x, z) + sy * 0.25, z), q, new THREE.Vector3(sx, sy, sz));
      im.setMatrixAt(k, m);
      c.set(this.b.rockColor).multiplyScalar(0.8 + r() * 0.35);
      im.setColorAt(k, c);
      if (s > 0.7) this.grid.add({ x, z, r: Math.max(sx, sz) * 0.8 });
      k++;
    }
    im.count = k;
    im.castShadow = true;
    im.receiveShadow = true;
    this.group.add(im);
  }

  buildRuins() {
    const mat = std('#a09a8e'), mat2 = std('#8a8478');
    const r = this.rand;
    for (let i = 0; i < 46; i++) {
      const rad = 50 + r() * (FLOOR_R - 60), ang = r() * Math.PI * 2;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      if (!this.freeSpot(x, z, 8)) continue;
      const h = this.groundAt(x, z);
      if (r() < 0.55) {
        const hgt = 2 + r() * 7;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, hgt, 8), mat);
        p.position.set(x, h + hgt / 2 - 0.2, z);
        p.rotation.z = (r() - 0.5) * 0.15;
        p.castShadow = p.receiveShadow = true;
        this.group.add(p);
        this.grid.add({ x, z, r: 0.9 });
      } else {
        const w = 4 + r() * 6, hgt = 1.5 + r() * 3.5, rot = r() * Math.PI;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, 0.9), mat2);
        wall.position.set(x, h + hgt / 2 - 0.3, z);
        wall.rotation.y = rot;
        wall.castShadow = wall.receiveShadow = true;
        this.group.add(wall);
        this.grid.add({ x, z, hw: w / 2, hd: 0.45, rot });
      }
    }
  }

  freeSpot(x, z, pad) {
    const dt = Math.hypot(x, z);
    if (dt < TOWN_R + pad + 2 || dt > FLOOR_R - 4) return false;
    if (Math.hypot(x - this.arenaPos.x, z - this.arenaPos.z) < ARENA_R + pad + 10) return false;
    if (Math.hypot(x - this.towerPos.x, z - this.towerPos.z) < 32 + pad) return false;
    return this.pathDist(x, z) > pad;
  }

  // ─────────── Cidade ───────────
  buildTown() {
    const r = this.rand;
    const wallCols = ['#e8dcc0', '#d8c8a8', '#cbbba0', '#e0d4bc', '#d4c4b0'];
    const roofCols = ['#8a3a2a', '#6a4a3a', '#3a5a7a', '#7a2a2a', '#4a6a3a'];
    const mats = {};
    const M = (c) => mats[c] || (mats[c] = std(c));
    const box = new THREE.BoxGeometry(1, 1, 1);
    const roofGeo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);
    const winGeo = new THREE.PlaneGeometry(0.8, 0.9);
    this.windowMat = new THREE.MeshStandardMaterial({ color: '#3a3020', emissive: '#ffc864', emissiveIntensity: 0.1 });
    const doorMat = std('#5a3a22');
    const spokeAngles = this.spokes.map((s) => Math.atan2(s.dz, s.dx));
    const N = 18;
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 + 0.09;
      const nearSpoke = spokeAngles.some((s) => Math.abs(Math.atan2(Math.sin(ang - s), Math.cos(ang - s))) < 0.26);
      if (nearSpoke) continue;
      const rad = 23 + r() * 4;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      const w = 5 + r() * 3, d = 4.5 + r() * 2, hgt = 3.4 + r() * 1.8;
      const rot = Math.atan2(-Math.cos(ang), -Math.sin(ang));
      const house = new THREE.Group();
      house.position.set(x, this.townH, z);
      house.rotation.y = rot;
      const walls = new THREE.Mesh(box, M(wallCols[Math.floor(r() * wallCols.length)]));
      walls.scale.set(w, hgt, d);
      walls.position.y = hgt / 2;
      const roof = new THREE.Mesh(roofGeo, M(roofCols[Math.floor(r() * roofCols.length)]));
      roof.scale.set(w * 1.2, 2.2 + r(), d * 1.2);
      roof.position.y = hgt;
      const door = new THREE.Mesh(box, doorMat);
      door.scale.set(1.1, 2, 0.12);
      door.position.set(0, 1, d / 2 + 0.03);
      house.add(walls, roof, door);
      for (const sx of [-1, 1]) {
        const win = new THREE.Mesh(winGeo, this.windowMat);
        win.position.set(sx * w * 0.3, hgt * 0.62, d / 2 + 0.02);
        house.add(win);
      }
      house.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.group.add(house);
      this.grid.add({ x, z, hw: w / 2, hd: d / 2, rot });
    }
    // Postes de luz
    const pole = new THREE.CylinderGeometry(0.07, 0.1, 3.4, 6);
    const poleMat = std('#3a3a3a');
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + 0.31, x = Math.cos(ang) * 15, z = Math.sin(ang) * 15;
      const p = new THREE.Mesh(pole, poleMat);
      p.position.set(x, this.townH + 1.7, z);
      const lan = new THREE.Mesh(box, this.windowMat);
      lan.scale.set(0.38, 0.5, 0.38);
      lan.position.set(x, this.townH + 3.55, z);
      p.castShadow = true;
      this.group.add(p, lan);
      this.grid.add({ x, z, r: 0.25 });
    }
  }

  buildGate() {
    const g = new THREE.Group();
    g.position.copy(this.gatePos);
    const stone = std('#bcb8b0'), gold = std('#c8a050', { metalness: 0.6, roughness: 0.4 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.8, 0.3, 32), stone);
    base.position.y = 0.05;
    const step = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.2, 32), std('#d8d4cc'));
    step.position.y = 0.3;
    g.add(base, step);
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 6.2, 0.7), stone);
      p.position.set(sx * 3.1, 3.4, 0);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.35, 0.95), gold);
      cap.position.set(sx * 3.1, 0.5, 0);
      g.add(p, cap);
      this.grid.add({ x: this.gatePos.x + sx * 3.1, z: this.gatePos.z, r: 0.55 });
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.32, 8, 40, Math.PI), stone);
    arch.position.y = 6.5;
    g.add(arch);
    const ringMat = new THREE.MeshBasicMaterial({ color: hdr('#6fd0ff', 3) });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.1, 8, 64), ringMat);
    ring.position.y = 3.9;
    g.add(ring);
    this.portalMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main(){
          vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
          float s = sin(a * 5.0 + uTime * 2.2 - r * 12.0) * 0.5 + 0.5;
          float edge = smoothstep(1.0, 0.85, r);
          float alpha = edge * (0.35 + 0.35 * s) * (0.6 + 0.4 * r);
          vec3 c = mix(vec3(0.25, 0.6, 1.0), vec3(0.85, 1.0, 1.0), s * (1.0 - r));
          gl_FragColor = vec4(c * alpha * 1.6, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.35, 48), this.portalMat);
    disc.position.y = 3.9;
    g.add(disc);
    // Partículas subindo
    const PN = 140, pp = new Float32Array(PN * 3);
    for (let i = 0; i < PN; i++) {
      const a = Math.random() * Math.PI * 2, rr = 1 + Math.random() * 3;
      pp[i * 3] = Math.cos(a) * rr; pp[i * 3 + 1] = Math.random() * 7; pp[i * 3 + 2] = Math.sin(a) * rr;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    this.gateParticles = new THREE.Points(pg, new THREE.PointsMaterial({ color: hdr('#9fe0ff', 2), size: 0.14, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    g.add(this.gateParticles);
    const light = new THREE.PointLight('#7fd4ff', 60, 24, 2);
    light.position.y = 3.6;
    g.add(light);
    g.traverse((o) => { if (o.isMesh && o.material !== this.portalMat && o.material !== ringMat) { o.castShadow = true; o.receiveShadow = true; } });
    this.group.add(g);
    this.labels.push({ text: 'Portal de Teletransporte', pos: new THREE.Vector3(0, this.townH + 8.2, 0), cls: 'gate' });
  }

  buildNpc() {
    const g = new THREE.Group();
    const p = this.npcPos;
    g.position.copy(p);
    g.rotation.y = Math.atan2(-p.x, -p.z);
    const wood = std('#7a5232'), cloth1 = std('#c0392b'), cloth2 = std('#f0e8d8');
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3, 1.05, 1), wood);
    counter.position.set(0, 0.52, 0.8);
    g.add(counter);
    for (const sx of [-1.4, 1.4]) for (const sz of [0.35, -0.9]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.8, 0.12), wood);
      post.position.set(sx, 1.4, sz);
      g.add(post);
    }
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 1.8), i % 2 ? cloth2 : cloth1);
      s.position.set(-1.24 + i * 0.62, 2.85, -0.25);
      s.rotation.x = -0.18;
      g.add(s);
    }
    // Agil, o mercador
    const npc = new THREE.Group();
    npc.position.set(0, 0, -0.3);
    const skin = std('#7a4a2e'), shirt = std('#4a5a3a'), pants = std('#3a3028');
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.32), pants);
    legs.position.y = 0.45;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.45), shirt);
    body.position.y = 1.32;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
    head.position.y = 1.98;
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), skin);
      arm.position.set(sx * 0.55, 1.3, 0.12);
      arm.rotation.x = -0.5;
      npc.add(arm);
    }
    npc.add(legs, body, head);
    g.add(npc);
    this.npcModel = npc;
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.group.add(g);
    this.grid.add({ x: p.x, z: p.z, hw: 1.6, hd: 1.4, rot: g.rotation.y });
    this.labels.push({ text: 'Agil — Mercador', pos: new THREE.Vector3(p.x, p.y + 2.8, p.z), cls: 'npc' });
  }

  // ─────────── Arena do chefe e Labirinto ───────────
  buildArena() {
    const ap = this.arenaPos, tp = this.towerPos;
    const floorMesh = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R + 1, ARENA_R + 2, 1.6, 48), std('#4a4850'));
    floorMesh.position.set(ap.x, this.arenaH - 0.75, ap.z);
    floorMesh.receiveShadow = true;
    this.group.add(floorMesh);
    this.runeMat = new THREE.MeshBasicMaterial({ color: hdr('#b07aff', 1.4), transparent: true, opacity: 0.5, depthWrite: false });
    const rune = new THREE.Mesh(new THREE.RingGeometry(ARENA_R - 4, ARENA_R - 3.5, 72).rotateX(-Math.PI / 2), this.runeMat);
    rune.position.set(ap.x, this.arenaH + 0.08, ap.z);
    this.group.add(rune);
    const stone = std('#77737a');
    const townSide = this.arenaDir + Math.PI;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - townSide), Math.cos(a - townSide))) < 0.3) continue;
      const x = ap.x + Math.cos(a) * (ARENA_R - 0.5), z = ap.z + Math.sin(a) * (ARENA_R - 0.5);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 10, 8), stone);
      p.position.set(x, this.arenaH + 5, z);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 2.4), stone);
      cap.position.set(x, this.arenaH + 10.2, z);
      p.castShadow = cap.castShadow = true;
      this.group.add(p, cap);
      this.grid.add({ x, z, r: 1.1 });
    }
    // Torre do Labirinto, que perfura o teto até o próximo andar
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(20, 26, 400, 14, 1), std('#8c8a86'));
    tower.position.set(tp.x, -40 + 200, tp.z);
    tower.castShadow = tower.receiveShadow = true;
    this.group.add(tower);
    const bandMat = std('#6a6864');
    for (let i = 0; i < 7; i++) {
      const y = 20 + i * 45, rr = 26 - ((y + 40) / 400) * 6 + 0.6;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 2.5, 14), bandMat);
      band.position.set(tp.x, y, tp.z);
      this.group.add(band);
    }
    this.grid.add({ x: tp.x, z: tp.z, r: 25.6 });
    const dir = new THREE.Vector3(ap.x - tp.x, 0, ap.z - tp.z).normalize();
    const rot = Math.atan2(dir.x, dir.z);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.5, 13.5, 1.2), std('#5a5860'));
    frame.position.set(tp.x + dir.x * 25.4, this.arenaH + 6.6, tp.z + dir.z * 25.4);
    frame.rotation.y = rot;
    this.doorMat = new THREE.MeshStandardMaterial({ color: '#181818', emissive: '#ff2a2a', emissiveIntensity: 1.6 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(7, 11, 0.6), this.doorMat);
    door.position.set(tp.x + dir.x * 26.1, this.arenaH + 5.5, tp.z + dir.z * 26.1);
    door.rotation.y = rot;
    this.group.add(frame, door);
    this.doorPos = new THREE.Vector3(tp.x + dir.x * 27.5, this.arenaH, tp.z + dir.z * 27.5);
    this.barrierMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main(){
          float low = 1.0 - vUv.y;
          float a = pow(low, 3.0) * 0.5 + 0.02;
          float lines = smoothstep(0.9, 1.0, fract(vUv.y * 8.0 - uTime * 0.5)) * 0.18 * low;
          float edge = smoothstep(0.985, 1.0, fract(vUv.x * 48.0)) * 0.12 * low;
          gl_FragColor = vec4(vec3(1.0, 0.2, 0.12) * (a + lines + edge), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.barrier = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R + 0.3, ARENA_R + 0.3, 14, 64, 1, true), this.barrierMat);
    this.barrier.position.set(ap.x, this.arenaH + 7, ap.z);
    this.barrier.visible = false;
    this.group.add(this.barrier);
    this.labels.push({ text: `Labirinto — Andar ${this.floor.n}`, pos: new THREE.Vector3(this.doorPos.x, this.arenaH + 14.5, this.doorPos.z), cls: 'door' });
  }

  setDoorOpen(open) {
    this.doorMat.emissive.set(open ? '#4fc3ff' : '#ff2a2a');
    this.doorMat.emissiveIntensity = open ? 2.2 : 1.6;
  }

  // ─────────── Consultas ───────────
  resolve(pos, r) {
    const list = this.grid.query(pos.x, pos.z, r + 0.2, this._q);
    for (const c of list) {
      if (c.hw === undefined) {
        const dx = pos.x - c.x, dz = pos.z - c.z, m = r + c.r, d2 = dx * dx + dz * dz;
        if (d2 < m * m) {
          const d = Math.sqrt(d2) || 0.001;
          pos.x = c.x + (dx / d) * m;
          pos.z = c.z + (dz / d) * m;
        }
      } else {
        const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
        const dx = pos.x - c.x, dz = pos.z - c.z;
        let lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
        const qx = Math.max(-c.hw, Math.min(c.hw, lx)), qz = Math.max(-c.hd, Math.min(c.hd, lz));
        const ex = lx - qx, ez = lz - qz, d2 = ex * ex + ez * ez;
        if (d2 > r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          lx = qx + (ex / d) * r;
          lz = qz + (ez / d) * r;
        } else if (c.hw - Math.abs(lx) < c.hd - Math.abs(lz)) {
          lx = Math.sign(lx || 1) * (c.hw + r);
        } else {
          lz = Math.sign(lz || 1) * (c.hd + r);
        }
        pos.x = c.x + lx * cs + lz * sn;
        pos.z = c.z - lx * sn + lz * cs;
      }
    }
  }

  inSafeZone(p) { return Math.hypot(p.x, p.z) < TOWN_R + 1; }
  inArena(p, pad = 0) { return Math.hypot(p.x - this.arenaPos.x, p.z - this.arenaPos.z) < ARENA_R + pad; }
  inWater(p) { return !!this.water && !this.water.lava && this.groundAt(p.x, p.z) < this.water.level - 0.5; }

  randomSpawn(near, minD, maxD, flying) {
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
      const x = near.x + Math.cos(a) * d, z = near.z + Math.sin(a) * d;
      const dt = Math.hypot(x, z);
      if (dt > FLOOR_R - 10 || dt < TOWN_R + 14) continue;
      if (this.inArena({ x, z }, 12)) continue;
      if (Math.hypot(x - this.towerPos.x, z - this.towerPos.z) < 36) continue;
      if (!flying && this.water && this.groundAt(x, z) < this.water.level - 0.3) continue;
      return { x, z };
    }
    return null;
  }

  // ─────────── Animação ───────────
  update(dt, t, night) {
    if (this.portalMat) this.portalMat.uniforms.uTime.value = t;
    if (this.gateParticles) {
      const p = this.gateParticles.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + dt * (0.8 + (i % 5) * 0.25);
        if (y > 8) y = 0;
        p.setY(i, y);
      }
      p.needsUpdate = true;
    }
    if (this.cloudMat) { this.cloudMat.map.offset.x += dt * 0.002; this.cloudMat.map.offset.y += dt * 0.001; }
    if (this.waterMesh) this.waterMesh.position.y = this.water.level + Math.sin(t * 0.6) * 0.06;
    if (this.windowMat) this.windowMat.emissiveIntensity = 0.1 + night * 2.6;
    if (this.npcModel) this.npcModel.rotation.y = Math.sin(t * 0.7) * 0.25;
    if (this.barrier.visible) this.barrierMat.uniforms.uTime.value = t;
    this.runeMat.opacity = 0.35 + Math.sin(t * 1.5) * 0.15;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) { m.map?.dispose(); m.dispose(); }
    });
  }
}
