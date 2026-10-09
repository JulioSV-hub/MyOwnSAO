// Geração procedural de um andar de Aincrad: ilha flutuante, cidade com Portal, campos, arena do chefe e Labirinto.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeNoise2D, mulberry32, fbm, smoothstep, lerp } from './rng.js';
import { MAX_FLOOR } from './data.js';
import { Grass } from './grass.js';
import { toonMat } from './toon.js';

export const FLOOR_R = 230;
export const TOWN_R = 58;
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

const std = (color, o = {}) => toonMat(color, o);
const hdr = (hex, k) => { const c = new THREE.Color(hex); return c.multiplyScalar(k); };
const rbox = (w, h, d, r = 0.12) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.99);

// Esfera "orgânica": vértices unidos e deslocados por ruído, com normais suaves.
function blob(detail, amount, seed) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const n = makeNoise2D(seed), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + (n(v.x * 1.3 + v.y * 0.7, v.z * 1.3 - v.y * 0.5) * 0.7 + n(v.x * 3.1, v.z * 3.1 + v.y * 2) * 0.3) * amount;
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

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
    this.npcPos = new THREE.Vector3(10, this.townH, 6);
    this.smithPos = new THREE.Vector3(-10, this.townH, 6);
    this.boardPos = new THREE.Vector3(0, this.townH, -10.5);
    this.spokes = [0, 0.5, 1, 1.5].map((k, i) => ({
      dx: Math.cos(a + k * Math.PI), dz: Math.sin(a + k * Math.PI),
      len: i === 0 ? ARENA_DIST - ARENA_R + 2 : 70 + this.rand() * 70,
    }));

    this.buildTerrain();
    this.buildEnvironment();
    this.buildTrees();
    this.buildRocks();
    this.buildBushes();
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
      const t = Math.max(15, Math.min(s.len, x * s.dx + z * s.dz));
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
    const N = 300, half = FLOOR_R + 50, cell = (half * 2) / N, W = N + 1;
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
    const D = new Float32Array(W * W);
    const grassy = b.grass ?? 1;
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
      const onPath = 1 - smoothstep(2.2, 3.8, this.pathDist(x, z));
      c.lerp(path, onPath * 0.85);
      const dt = Math.hypot(x, z);
      const plazaM = 1 - smoothstep(18, 20.5, dt);
      const streetM = dt < TOWN_R ? Math.max(1 - smoothstep(2.6, 3.6, Math.abs(dt - 33)), 1 - smoothstep(2.2, 3.2, Math.abs(dt - 51.5))) : 0;
      const pz = Math.max(plazaM, streetM);
      if (pz > 0) {
        const ring = (Math.floor(dt / 2.4) & 1) ? 0.95 : 1;
        tmp.copy(plaza).multiplyScalar(ring * (0.94 + n * 0.12));
        c.lerp(tmp, pz);
      }
      c.lerp(edge, smoothstep(FLOOR_R - 2, FLOOR_R + 8, dt));
      colr[i * 3] = c.r; colr[i * 3 + 1] = c.g; colr[i * 3 + 2] = c.b;
      // densidade da grama: some em caminhos, praça, encostas, água, arena e borda
      const patch = 0.45 + 0.55 * smoothstep(-0.5, 0.4, this.noise2(x * 0.02, z * 0.02));
      let dn = grassy * patch * (1 - onPath) * (1 - pz) * (1 - smoothstep(0.35, 0.7, slope));
      if (this.water && h < this.water.level + 0.25) dn = 0;
      if (Math.hypot(x - this.arenaPos.x, z - this.arenaPos.z) < ARENA_R + 2.5) dn = 0;
      if (Math.hypot(x - this.towerPos.x, z - this.towerPos.z) < 27) dn = 0;
      if (dt > FLOOR_R - 3) dn = 0;
      D[i] = dn;
    }
    if (grassy > 0) {
      const gb = new THREE.Color(b.grassColors?.[0] || b.ground[0]).multiplyScalar(b.grassColors ? 1 : 0.8);
      const gt = new THREE.Color(b.grassColors?.[1] || b.ground[2]).multiplyScalar(b.grassColors ? 1 : 1.15);
      this.grass = new Grass({ N, half, cell, H, D, base: gb, tip: gt });
      this.group.add(this.grass.mesh);
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
    const S = this.floor.seed;
    const branch = (len, r, rz, rx, x, y, z) => new THREE.CylinderGeometry(r * 0.5, r, len, 7).translate(0, len / 2, 0).rotateZ(rz).rotateX(rx).translate(x, y, z);
    switch (t.style) {
      case 'pine': {
        trunkGeo = new THREE.CylinderGeometry(0.16, 0.32, 2.2, 10).translate(0, 1.1, 0);
        const layers = [];
        for (let i = 0; i < 4; i++) {
          const r = 1.9 - i * 0.42, h = 2.4 - i * 0.3;
          // camada aberta embaixo e levemente côncava, para as bordas caírem como galhos
          const g = new THREE.ConeGeometry(r, h, 12, 2, true);
          const p = g.attributes.position;
          for (let k = 0; k < p.count; k++) if (p.getY(k) < -h / 2 + 0.01) p.setY(k, p.getY(k) - 0.25);
          g.computeVertexNormals();
          layers.push(g.translate(0, 2.4 + i * 1.15, 0));
        }
        crownGeo = mergeGeometries(layers);
        break;
      }
      case 'dead':
        trunkGeo = mergeGeometries([
          new THREE.CylinderGeometry(0.13, 0.34, 4.4, 9).translate(0, 2.2, 0),
          branch(1.8, 0.1, -0.9, 0, 0.05, 2.9, 0),
          branch(1.5, 0.09, 1.0, 0.2, -0.05, 2.3, 0),
          branch(1.3, 0.08, 0.3, 0.9, 0, 3.4, 0.05),
          branch(1.0, 0.06, -0.4, -0.8, 0, 3.9, -0.05),
        ]);
        break;
      case 'crystal':
        crownGeo = new THREE.OctahedronGeometry(1, 0).scale(0.7, 2.6, 0.7).translate(0, 2.0, 0);
        break;
      default: {
        trunkGeo = mergeGeometries([
          new THREE.CylinderGeometry(0.2, 0.36, 2.8, 10).translate(0, 1.4, 0),
          branch(1.1, 0.12, -0.8, 0, 0.05, 2.1, 0),
          branch(1.0, 0.11, 0.9, 0.3, -0.05, 2.3, 0),
        ]);
        const puffs = [[0, 3.7, 0, 1.55], [0.95, 3.2, 0.2, 1.05], [-0.9, 3.35, -0.3, 1.1], [0.2, 3.3, 0.95, 1.0], [-0.2, 3.25, -0.95, 0.95], [0.1, 4.55, 0.1, 1.05]];
        crownGeo = mergeGeometries(puffs.map(([x, y, z, r], i) => {
          const g = blob(1, 0.1, S + i);
          g.deleteAttribute('uv');
          return g.scale(r, r * 0.88, r).translate(x, y, z);
        }));
      }
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
      : std('#ffffff', { side: t.style === 'pine' ? THREE.DoubleSide : THREE.FrontSide, wind: { strength: t.style === 'pine' ? 0.025 : 0.05, minY: 2.2 } });
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
    const im = new THREE.InstancedMesh(blob(2, 0.3, this.floor.seed + 7), std('#ffffff', { roughness: 0.95 }), n);
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

  buildBushes() {
    const b = this.b, r = this.rand;
    const leaf = b.trees?.leaf || ['#4a8a3a'];
    const nb = b.bushes ?? 160, nf = b.flowers ?? 0;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    if (nb) {
      const im = new THREE.InstancedMesh(blob(2, 0.22, this.floor.seed + 3), std('#ffffff', { wind: { strength: 0.05, minY: -0.3 } }), nb);
      let k = 0;
      for (let tries = 0; tries < nb * 4 && k < nb; tries++) {
        const rad = (FLOOR_R - 6) * Math.sqrt(r()), ang = r() * Math.PI * 2;
        const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
        if (!this.freeSpot(x, z, 3.5)) continue;
        const h = this.groundAt(x, z);
        if (this.water && h < this.water.level + 0.3) continue;
        const s = 0.5 + r() * 0.8;
        e.set(0, r() * 6, 0);
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(x, h + s * 0.25, z), q, new THREE.Vector3(s * 1.2, s * 0.8, s * 1.1));
        im.setMatrixAt(k, m);
        c.set(b.bushColor || leaf[k % leaf.length]).multiplyScalar(0.85 + r() * 0.3);
        im.setColorAt(k, c);
        k++;
      }
      im.count = k;
      im.castShadow = im.receiveShadow = true;
      this.group.add(im);
    }
    if (nf) {
      const palette = b.flowerColors || ['#ffffff', '#ffe066', '#ff8ab0', '#b08aff', '#7ad0ff'];
      const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 10, 8), std('#ffffff', { emissive: '#222222' }), nf);
      let k = 0;
      for (let tries = 0; tries < nf * 3 && k < nf; tries++) {
        // flores em pequenos canteiros
        const cx = (r() - 0.5) * FLOOR_R * 1.8, cz = (r() - 0.5) * FLOOR_R * 1.8;
        const col = palette[Math.floor(r() * palette.length)];
        for (let j = 0; j < 12 && k < nf; j++) {
          const x = cx + (r() - 0.5) * 5, z = cz + (r() - 0.5) * 5;
          if (!this.freeSpot(x, z, 2.5)) continue;
          const h = this.groundAt(x, z);
          if (this.water && h < this.water.level + 0.3) continue;
          m.compose(new THREE.Vector3(x, h + 0.55 + r() * 0.3, z), q.identity(), new THREE.Vector3(1, 0.65, 1));
          im.setMatrixAt(k, m);
          c.set(col);
          im.setColorAt(k, c);
          k++;
        }
      }
      im.count = k;
      this.group.add(im);
    }
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
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, hgt, 16), mat);
        p.position.set(x, h + hgt / 2 - 0.2, z);
        p.rotation.z = (r() - 0.5) * 0.15;
        p.castShadow = p.receiveShadow = true;
        this.group.add(p);
        this.grid.add({ x, z, r: 0.9 });
      } else {
        const w = 4 + r() * 6, hgt = 1.5 + r() * 3.5, rot = r() * Math.PI;
        const wall = new THREE.Mesh(rbox(w, hgt, 0.9, 0.2), mat2);
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
    const wallCols = ['#f3e6cf', '#efe0c4', '#f6efe0', '#ead6b4', '#f0dcc8', '#e8d8c0'];
    const roofCols = ['#c4572e', '#d36b3a', '#3f7f8f', '#9a3f2e', '#5d8a4a', '#b8482e', '#4a6a9a'];
    const doorCols = ['#4a7a4a', '#3a6a8a', '#8a3a2a', '#6a4a2a'];
    const flowerCols = ['#ff6a7a', '#ffb0c8', '#fff0a0', '#ffffff', '#c8a0ff'];
    const mats = {};
    const M = (c) => mats[c] || (mats[c] = std(c));
    const beamMat = M('#6b4a32');
    const winGeo = new THREE.PlaneGeometry(0.8, 0.9);
    const flowerGeo = new THREE.SphereGeometry(0.14, 10, 8);
    const leafMat = M('#4f9a3a');
    this.windowMat = new THREE.MeshStandardMaterial({ color: '#3a3020', emissive: '#ffc864', emissiveIntensity: 0.1 });
    const doorMat = std('#5a3a22');
    const spokeAngles = this.spokes.map((sp) => Math.atan2(sp.dz, sp.dx));
    const onRoad = (ang, rad, half) => spokeAngles.some((sa) => Math.abs(Math.atan2(Math.sin(ang - sa), Math.cos(ang - sa))) * rad < half);

    const makeHouse = (x, z, rot, w, d, hgt) => {
    const house = new THREE.Group();
    house.position.set(x, this.townH, z);
    house.rotation.y = rot;
    // paredes com empena (perfil de casa extrudado, bordas arredondadas)
    const rh = 1.6 + r() * 1.2;
    const prof = new THREE.Shape();
    prof.moveTo(-w / 2, 0); prof.lineTo(w / 2, 0); prof.lineTo(w / 2, hgt); prof.lineTo(0, hgt + rh); prof.lineTo(-w / 2, hgt);
    const wallGeo = new THREE.ExtrudeGeometry(prof, { depth: d, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
    wallGeo.translate(0, 0, -d / 2);
    const walls = new THREE.Mesh(wallGeo, M(wallCols[Math.floor(r() * wallCols.length)]));
    // telhado de duas águas com beiral
    const roofMat = M(roofCols[Math.floor(r() * roofCols.length)]);
    const slope = Math.hypot(w / 2, rh) + 0.55, ang2 = Math.atan2(rh, w / 2);
    for (const s of [-1, 1]) {
      const slab = new THREE.Mesh(rbox(slope, 0.2, d + 0.9, 0.08), roofMat);
      slab.position.set(s * (w / 4 + 0.08), hgt + rh / 2 + 0.12, 0);
      slab.rotation.z = -s * ang2;
      house.add(slab);
    }
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, d + 0.95, 10).rotateX(Math.PI / 2), roofMat);
    ridge.position.y = hgt + rh + 0.12;
    const chimney = new THREE.Mesh(rbox(0.6, 1.4, 0.6, 0.08), M('#8a7a6a'));
    chimney.position.set(w * 0.22, hgt + rh * 0.75, -d * 0.2);
    const door = new THREE.Mesh(rbox(1.1, 2.1, 0.16, 0.06), M(doorCols[Math.floor(r() * doorCols.length)]));
    door.position.set(0, 1.05, d / 2 + 0.06);
    const step = new THREE.Mesh(rbox(1.6, 0.18, 0.7, 0.06), M('#9a948a'));
    step.position.set(0, 0.09, d / 2 + 0.4);
    house.add(walls, ridge, chimney, door, step);
    house.updateMatrixWorld(true);
    (this.chimneys ||= []).push(chimney.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.8, 0)));
    for (const sx of [-1, 1]) {
      const frame = new THREE.Mesh(rbox(1.0, 1.1, 0.1, 0.04), doorMat);
      frame.position.set(sx * w * 0.3, hgt * 0.58, d / 2 + 0.06);
      const win = new THREE.Mesh(winGeo, this.windowMat);
      win.position.set(sx * w * 0.3, hgt * 0.58, d / 2 + 0.12);
      house.add(frame, win);
      // floreira sob a janela
      const box = new THREE.Mesh(rbox(1.15, 0.28, 0.35, 0.05), beamMat);
      box.position.set(sx * w * 0.3, hgt * 0.58 - 0.72, d / 2 + 0.2);
      house.add(box);
      const fc = M(flowerCols[Math.floor(r() * flowerCols.length)]);
      for (let f = 0; f < 5; f++) {
        const bl = new THREE.Mesh(flowerGeo, f % 2 ? leafMat : fc);
        bl.position.set(sx * w * 0.3 - 0.45 + f * 0.22, hgt * 0.58 - 0.5, d / 2 + 0.2);
        house.add(bl);
      }
    }
    // vigas de madeira (enxaimel) nos cantos e no meio da parede
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) {
      const post = new THREE.Mesh(rbox(0.22, hgt, 0.22, 0.05), beamMat);
      post.position.set(cx * (w / 2 + 0.04), hgt / 2, cz * (d / 2 + 0.04));
      house.add(post);
    }
    for (const cz of [-1, 1]) {
      const beam = new THREE.Mesh(rbox(w + 0.2, 0.2, 0.14, 0.05), beamMat);
      beam.position.set(0, hgt * 0.92, cz * (d / 2 + 0.07));
      house.add(beam);
    }
    house.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.group.add(house);
    this.grid.add({ x, z, hw: w / 2, hd: d / 2, rot });
    };

    // Anel interno (casas menores) e anel externo (casas maiores, algumas de dois andares)
    const ring = (n, r0, r1, wr, dr, hr) => {
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + r() * 0.08;
        const w = wr[0] + r() * (wr[1] - wr[0]), d = dr[0] + r() * (dr[1] - dr[0]), hgt = hr[0] + r() * (hr[1] - hr[0]);
        const rad = r0 + r() * (r1 - r0);
        if (onRoad(ang, rad, 4.2 + w / 2)) continue;
        makeHouse(Math.cos(ang) * rad, Math.sin(ang) * rad, Math.atan2(-Math.cos(ang), -Math.sin(ang)), w, d, hgt);
      }
    };
    ring(16, 23, 26, [5, 7], [4.5, 6], [3.4, 4.6]);
    ring(26, 41.5, 45.5, [6, 8.5], [5, 7], [4.4, 7]);

    // Postes de luz na praça e na rua principal
    const pole = new THREE.CylinderGeometry(0.06, 0.1, 3.4, 10);
    const lanGeo = new THREE.SphereGeometry(0.24, 14, 10);
    const capGeo = new THREE.ConeGeometry(0.3, 0.28, 12);
    const poleMat = std('#3a3a3a');
    const lamp = (x, z) => {
      const p = new THREE.Mesh(pole, poleMat);
      p.position.set(x, this.townH + 1.7, z);
      const lan = new THREE.Mesh(lanGeo, this.windowMat);
      lan.position.set(x, this.townH + 3.6, z);
      const cap = new THREE.Mesh(capGeo, poleMat);
      cap.position.set(x, this.townH + 3.95, z);
      p.castShadow = true;
      this.group.add(p, lan, cap);
      this.grid.add({ x, z, r: 0.25 });
    };
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + 0.31; if (!onRoad(a, 19.5, 3)) lamp(Math.cos(a) * 19.5, Math.sin(a) * 19.5); }
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 + 0.1; if (!onRoad(a, 36.8, 3.5)) lamp(Math.cos(a) * 36.8, Math.sin(a) * 36.8); }

    // Bancos e canteiros de flores na praça
    const wood = M('#8a5a36'), iron = M('#3a3a3a');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      if (onRoad(a, 13, 2.5)) continue;
      const x = Math.cos(a) * 13, z = Math.sin(a) * 13, rot = Math.atan2(-Math.cos(a), -Math.sin(a));
      const b = new THREE.Group();
      b.position.set(x, this.townH, z);
      b.rotation.y = rot;
      const seat = new THREE.Mesh(rbox(2, 0.12, 0.55, 0.04), wood);
      seat.position.y = 0.48;
      const back = new THREE.Mesh(rbox(2, 0.5, 0.1, 0.04), wood);
      back.position.set(0, 0.8, 0.26);
      b.add(seat, back);
      for (const sx of [-0.85, 0.85]) { const l = new THREE.Mesh(rbox(0.1, 0.48, 0.5, 0.03), iron); l.position.set(sx, 0.24, 0); b.add(l); }
      b.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.group.add(b);
      this.grid.add({ x, z, hw: 1, hd: 0.35, rot });
    }
    const bedGeo = new THREE.CylinderGeometry(2.1, 2.2, 0.45, 24);
    const soilGeo = new THREE.CylinderGeometry(1.9, 1.9, 0.1, 24);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      if (onRoad(a, 8.5, 2.5)) continue;
      const x = Math.cos(a) * 8.5, z = Math.sin(a) * 8.5;
      if (Math.hypot(x - this.npcPos.x, z - this.npcPos.z) < 4 || Math.hypot(x - this.smithPos.x, z - this.smithPos.z) < 5) continue;
      const bed = new THREE.Mesh(bedGeo, M('#a8987e'));
      bed.position.set(x, this.townH + 0.22, z);
      const soil = new THREE.Mesh(soilGeo, M('#5a4030'));
      soil.position.set(x, this.townH + 0.45, z);
      this.group.add(bed, soil);
      const fc = M(flowerCols[i % flowerCols.length]);
      for (let k = 0; k < 26; k++) {
        const fa = r() * Math.PI * 2, fr = Math.sqrt(r()) * 1.7;
        const f = new THREE.Mesh(flowerGeo, k % 3 ? fc : leafMat);
        f.position.set(x + Math.cos(fa) * fr, this.townH + 0.6, z + Math.sin(fa) * fr);
        this.group.add(f);
      }
      this.grid.add({ x, z, r: 2.2 });
    }

    // Árvores nos jardins entre as casas
    const crown = mergeGeometries([[0, 3.5, 0, 1.5], [0.9, 3.0, 0.2, 1.0], [-0.85, 3.1, -0.3, 1.05], [0.1, 4.3, 0.1, 1.0]].map(([x, y, z, rr], i) => {
      const g = blob(1, 0.1, this.floor.seed + 50 + i);
      return g.scale(rr, rr * 0.9, rr).translate(x, y, z);
    }));
    const trunkG = new THREE.CylinderGeometry(0.2, 0.34, 2.8, 10).translate(0, 1.4, 0);
    const crownMat = std('#5aa846', { wind: { strength: 0.05, minY: 2.2 } }), trunkMat = M('#6e4c34');
    const q = [];
    for (let i = 0, placed = 0; i < 160 && placed < 26; i++) {
      const outer = r() < 0.6;
      const rad = outer ? 38 + r() * 11 : 20 + r() * 8.5, a = r() * Math.PI * 2;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (onRoad(a, rad, 4.5) || this.grid.query(x, z, 3.2, q).length) continue;
      const t = new THREE.Mesh(trunkG, trunkMat), c = new THREE.Mesh(crown, crownMat);
      const sc = 0.8 + r() * 0.5;
      t.position.set(x, this.townH, z);
      c.position.copy(t.position);
      t.scale.setScalar(sc);
      c.scale.setScalar(sc);
      t.castShadow = c.castShadow = true;
      this.group.add(t, c);
      this.grid.add({ x, z, r: 0.45 * sc });
      placed++;
    }

    // Muralha da cidade com torres, aberta nas estradas
    const wallR = TOWN_R - 1.2, wallMat = M('#d8ccb4'), towerMat = M('#cfc2a8'), roofT = M('#b8482e');
    const segs = 64;
    const towerG = new THREE.CylinderGeometry(1.5, 1.7, 5, 16), towerRoof = new THREE.ConeGeometry(2.0, 2.4, 16);
    for (let i = 0; i < segs; i++) {
      const a = ((i + 0.5) / segs) * Math.PI * 2;
      if (onRoad(a, wallR, 5)) continue;
      const len = (Math.PI * 2 * wallR) / segs + 0.3;
      const x = Math.cos(a) * wallR, z = Math.sin(a) * wallR, rot = Math.atan2(-Math.cos(a), -Math.sin(a));
      const seg = new THREE.Mesh(rbox(len, 2.6, 1.1, 0.12), wallMat);
      seg.position.set(x, this.townH + 1.1, z);
      seg.rotation.y = rot;
      seg.castShadow = seg.receiveShadow = true;
      this.group.add(seg);
      this.grid.add({ x, z, hw: len / 2, hd: 0.6, rot });
      if (i % 8 === 0) {
        const tw = new THREE.Mesh(towerG, towerMat);
        tw.position.set(x, this.townH + 2.3, z);
        const tr = new THREE.Mesh(towerRoof, roofT);
        tr.position.set(x, this.townH + 6, z);
        tw.castShadow = tr.castShadow = true;
        this.group.add(tw, tr);
        this.grid.add({ x, z, r: 1.7 });
      }
    }
    for (const sa of spokeAngles) for (const side of [-1, 1]) {
      const a = sa + side * (5.6 / wallR);
      const x = Math.cos(a) * wallR, z = Math.sin(a) * wallR;
      const tw = new THREE.Mesh(towerG, towerMat);
      tw.scale.set(0.95, 1.3, 0.95);
      tw.position.set(x, this.townH + 3, z);
      const tr = new THREE.Mesh(towerRoof, roofT);
      tr.position.set(x, this.townH + 7.6, z);
      tw.castShadow = tr.castShadow = true;
      this.group.add(tw, tr);
      this.grid.add({ x, z, r: 1.6 });
    }

    // Barracas do mercado ao redor da praça
    const cloths = [['#c0392b', '#f0e8d8'], ['#2e7d9a', '#f0e8d8'], ['#e0a030', '#fff4dc'], ['#5d8a4a', '#f0e8d8'], ['#8a4a9a', '#f4e8f8']];
    for (let i = 0, placed = 0; i < 12 && placed < 5; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.2, rad = 16;
      if (onRoad(a, rad, 4)) continue;
      const pos = new THREE.Vector3(Math.cos(a) * rad, this.townH, Math.sin(a) * rad);
      if (pos.distanceTo(this.npcPos) < 6 || pos.distanceTo(this.smithPos) < 7) continue;
      this.buildStall(pos, cloths[placed % cloths.length]);
      placed++;
    }
  }

  // Quadro de Missões na praça
  buildBoard() {
    const p = this.boardPos, g = new THREE.Group();
    g.position.copy(p);
    g.rotation.y = Math.atan2(-p.x, -p.z);
    const wood = std('#7a5232'), paper = std('#f4ecd8');
    for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 8), wood); post.position.set(s * 1.1, 1.3, 0); g.add(post); }
    const board = new THREE.Mesh(rbox(2.4, 1.5, 0.12, 0.05), std('#9a6a42'));
    board.position.y = 1.7;
    const roof = new THREE.Mesh(rbox(2.8, 0.12, 0.6, 0.04), std('#b8482e'));
    roof.position.set(0, 2.6, 0.1);
    roof.rotation.x = -0.25;
    g.add(board, roof);
    const notes = ['#f4ecd8', '#fff4c0', '#e8f0ff', '#ffe0e0'];
    for (let i = 0; i < 6; i++) {
      const n = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.5), std(notes[i % 4], { side: THREE.DoubleSide }));
      n.position.set(-0.8 + (i % 3) * 0.8, 1.98 - Math.floor(i / 3) * 0.6, 0.075);
      n.rotation.z = (Math.sin(i * 7) * 0.12);
      g.add(n);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.group.add(g);
    this.grid.add({ x: p.x, z: p.z, hw: 1.3, hd: 0.3, rot: g.rotation.y });
    this.labels.push({ text: 'Quadro de Missões', pos: new THREE.Vector3(p.x, this.townH + 3.2, p.z), cls: 'npc' });
  }

  buildStall(pos, [c1, c2]) {
    const g = new THREE.Group();
    g.position.copy(pos);
    g.rotation.y = Math.atan2(-pos.x, -pos.z);
    const wood = std('#7a5232'), cloth1 = std(c1), cloth2 = std(c2);
    const counter = new THREE.Mesh(rbox(3, 1.05, 1, 0.1), wood);
    counter.position.set(0, 0.52, 0.8);
    g.add(counter);
    for (const sx of [-1.4, 1.4]) for (const sz of [0.35, -0.9]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 8), wood);
      post.position.set(sx, 1.4, sz);
      g.add(post);
    }
    for (let i = 0; i < 5; i++) {
      const sl = new THREE.Mesh(rbox(0.62, 0.08, 1.8, 0.03), i % 2 ? cloth2 : cloth1);
      sl.position.set(-1.24 + i * 0.62, 2.85, -0.25);
      sl.rotation.x = -0.18;
      g.add(sl);
    }
    const goods = ['#e05a3a', '#f0c040', '#7ac04a', '#c87aff', '#ff9a5a'];
    const goodGeo = new THREE.SphereGeometry(0.12, 10, 8);
    for (let i = 0; i < 6; i++) {
      const it = new THREE.Mesh(goodGeo, std(goods[i % goods.length]));
      it.position.set(-1.1 + i * 0.44, 1.15, 0.8);
      g.add(it);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.group.add(g);
    this.grid.add({ x: pos.x, z: pos.z, hw: 1.6, hd: 1.4, rot: g.rotation.y });
    return g;
  }

  buildGate() {
    const g = new THREE.Group();
    g.position.copy(this.gatePos);
    const stone = std('#e2d6c2'), gold = std('#d8a850');
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.8, 0.3, 32), stone);
    base.position.y = 0.05;
    const step = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.2, 32), std('#cdbfa6'));
    step.position.y = 0.3;
    g.add(base, step);
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 6.2, 16), stone);
      p.position.set(sx * 3.1, 3.4, 0);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.35, 16), gold);
      cap.position.set(sx * 3.1, 0.5, 0);
      g.add(p, cap);
      this.grid.add({ x: this.gatePos.x + sx * 3.1, z: this.gatePos.z, r: 0.55 });
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.34, 16, 48, Math.PI), stone);
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
          float alpha = edge * (0.25 + 0.3 * s) * (0.6 + 0.4 * r);
          vec3 c = mix(vec3(0.25, 0.6, 1.0), vec3(0.85, 1.0, 1.0), s * (1.0 - r));
          gl_FragColor = vec4(c * alpha * 1.1, alpha);
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
    this.buildBoard();
    // Os personagens (Agil, Lisbeth...) são NPCs animados; aqui ficam só as barracas e a forja.
    const behind = (p, rot) => new THREE.Vector3(p.x - Math.sin(rot) * 0.35, p.y, p.z - Math.cos(rot) * 0.35);
    const shop = this.buildStall(this.npcPos, ['#c0392b', '#f0e8d8']);
    this.agilSpot = { pos: behind(this.npcPos, shop.rotation.y), yaw: shop.rotation.y + Math.PI };
    this.labels.push({ text: "Agil's Store", pos: new THREE.Vector3(this.npcPos.x, this.townH + 3.7, this.npcPos.z), cls: 'npc' });
    const smith = this.buildStall(this.smithPos, ['#ff8ab8', '#fff0f6']);
    this.lisbethSpot = { pos: behind(this.smithPos, smith.rotation.y), yaw: smith.rotation.y + Math.PI };
    const rot = smith.rotation.y, side = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
    const fp = this.smithPos.clone().addScaledVector(side, 2.7);
    const forge = new THREE.Mesh(rbox(1.4, 1.1, 1.2, 0.15), std('#8a8070'));
    forge.position.set(fp.x, this.townH + 0.55, fp.z);
    this.forgeMat = new THREE.MeshBasicMaterial({ color: hdr('#ff7a2a', 2.2) });
    const coals = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 16), this.forgeMat);
    coals.position.set(fp.x, this.townH + 1.12, fp.z);
    const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 12), std('#7a7060'));
    chim.position.set(fp.x + side.x * 0.35, this.townH + 2.3, fp.z + side.z * 0.35);
    const ap = this.smithPos.clone().addScaledVector(side, -2.5);
    const anvil = new THREE.Mesh(rbox(0.9, 0.3, 0.4, 0.06), std('#4a4a52'));
    anvil.position.set(ap.x, this.townH + 0.85, ap.z);
    anvil.rotation.y = rot;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.7, 10), std('#6a4a32'));
    stand.position.set(ap.x, this.townH + 0.35, ap.z);
    for (const m of [forge, chim, anvil, stand]) m.castShadow = true;
    this.group.add(forge, coals, chim, anvil, stand);
    this.forgeLight = new THREE.PointLight('#ff8a3a', 12, 8, 2);
    this.forgeLight.position.set(fp.x, this.townH + 1.6, fp.z);
    this.group.add(this.forgeLight);
    this.grid.add({ x: fp.x, z: fp.z, r: 0.9 });
    this.grid.add({ x: ap.x, z: ap.z, r: 0.5 });
    this.labels.push({ text: "Lisbeth's Smith Shop", pos: new THREE.Vector3(this.smithPos.x, this.townH + 3.7, this.smithPos.z), cls: 'npc' });
  }

  // ─────────── Arena do chefe e Labirinto ───────────
  buildArena() {
    const ap = this.arenaPos, tp = this.towerPos;
    const floorMesh = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R + 1, ARENA_R + 2, 1.6, 72), std('#4a4850'));
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
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 10, 16), stone);
      p.position.set(x, this.arenaH + 5, z);
      const cap = new THREE.Mesh(rbox(2.4, 0.8, 2.4, 0.15), stone);
      cap.position.set(x, this.arenaH + 10.2, z);
      p.castShadow = cap.castShadow = true;
      this.group.add(p, cap);
      this.grid.add({ x, z, r: 1.1 });
    }
    // Torre do Labirinto, que perfura o teto até o próximo andar
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(20, 26, 400, 32, 1), std('#8c8a86'));
    tower.position.set(tp.x, -40 + 200, tp.z);
    tower.castShadow = tower.receiveShadow = true;
    this.group.add(tower);
    const bandMat = std('#6a6864');
    for (let i = 0; i < 7; i++) {
      const y = 20 + i * 45, rr = 26 - ((y + 40) / 400) * 6 + 0.6;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 2.5, 32), bandMat);
      band.position.set(tp.x, y, tp.z);
      this.group.add(band);
    }
    this.grid.add({ x: tp.x, z: tp.z, r: 25.6 });
    const dir = new THREE.Vector3(ap.x - tp.x, 0, ap.z - tp.z).normalize();
    const rot = Math.atan2(dir.x, dir.z);
    const frame = new THREE.Mesh(rbox(9.5, 13.5, 1.2, 0.3), std('#5a5860'));
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
    if (this.forgeMat) { const f = 0.8 + Math.sin(t * 7) * 0.12 + Math.sin(t * 13) * 0.08; this.forgeMat.color.setRGB(2.2 * f, 0.9 * f, 0.25 * f); this.forgeLight.intensity = 12 * f; }
    if (this.barrier.visible) this.barrierMat.uniforms.uTime.value = t;
    this.runeMat.opacity = 0.35 + Math.sin(t * 1.5) * 0.15;
  }

  dispose() {
    this.grass?.map.dispose();
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) { m.map?.dispose(); m.dispose(); }
    });
  }
}
