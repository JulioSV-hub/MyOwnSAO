// Modelos low-poly dos monstros, montados com primitivas. Frente do modelo = -Z.
import * as THREE from 'three';

const G = {};
const geo = (key, fn) => G[key] || (G[key] = fn());
const B = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const SPH = (r, w = 10, h = 8) => geo(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
const CONE = (r, h, s = 6) => geo(`c${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const CYL = (a, b, h, s = 8) => geo(`y${a},${b},${h},${s}`, () => new THREE.CylinderGeometry(a, b, h, s));

function M(g, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function stdMat(color, def) {
  const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0.05 });
  if (def.ghost) {
    m.transparent = true;
    m.opacity = 0.62;
    m.depthWrite = false;
    m.emissive.set(color).multiplyScalar(0.35);
  }
  if (def.glassy) {
    m.transparent = true;
    m.opacity = 0.75;
    m.roughness = 0.1;
    m.metalness = 0.2;
  }
  if (def.emissive) m.emissive.set(color).multiplyScalar(0.7);
  m.userData.base = m.emissive.clone();
  return m;
}

function eyeMat(hex) {
  const c = new THREE.Color(hex);
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(c.r * 4, c.g * 4, c.b * 4) });
}

export function buildWeapon(kind, metal, accent) {
  const g = new THREE.Group();
  switch (kind) {
    case 'sword':
      g.add(M(B(0.07, 0.3, 0.07), accent, 0, 0, 0), M(B(0.34, 0.06, 0.1), accent, 0, -0.17, 0), M(B(0.1, 1.25, 0.035), metal, 0, -0.85, 0));
      break;
    case 'axe':
      g.add(M(B(0.07, 1.5, 0.07), accent, 0, -0.55, 0), M(B(0.06, 0.45, 0.55), metal, 0, -1.15, -0.25));
      break;
    case 'hammer':
      g.add(M(B(0.08, 1.4, 0.08), accent, 0, -0.5, 0), M(B(0.5, 0.42, 0.42), metal, 0, -1.2, 0));
      break;
    case 'katana':
      g.add(M(B(0.06, 0.45, 0.06), accent, 0, 0, 0), M(CYL(0.12, 0.12, 0.03, 10), accent, 0, -0.25, 0), M(B(0.07, 2.1, 0.025), metal, 0, -1.33, 0));
      break;
    case 'zweihander':
      g.add(M(B(0.08, 0.5, 0.08), accent, 0, 0, 0), M(B(0.6, 0.09, 0.12), accent, 0, -0.27, 0), M(B(0.2, 2.1, 0.05), metal, 0, -1.37, 0));
      break;
    case 'shield':
      g.add(M(B(0.6, 0.85, 0.1), accent, 0, 0, 0), M(B(0.4, 0.55, 0.12), metal, 0, 0, -0.02));
      break;
    default:
      break;
  }
  return g;
}

export function buildMonster(def, boss) {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  const body = stdMat(def.color, def);
  const acc = stdMat(def.color2 || '#cccccc', def);
  const eye = eyeMat(def.eye || (boss ? '#ff3020' : '#ff3a2a'));
  const metal = new THREE.MeshStandardMaterial({ color: '#b8bcc4', metalness: 0.85, roughness: 0.3, flatShading: true });
  metal.userData.base = metal.emissive.clone();
  const parts = { legs: [], arms: [], wings: [] };
  let radius = 0.8, height = 1.6;

  switch (def.arch) {
    case 'quad': {
      inner.add(M(B(1, 0.75, 1.6), body, 0, 0.95, 0));
      const head = new THREE.Group();
      head.position.set(0, 1.15, -0.95);
      head.add(M(B(0.7, 0.62, 0.7), body), M(B(0.45, 0.35, 0.38), acc, 0, -0.1, -0.45));
      head.add(M(B(0.1, 0.1, 0.05), eye, -0.2, 0.12, -0.36), M(B(0.1, 0.1, 0.05), eye, 0.2, 0.12, -0.36));
      if (def.tusks) for (const s of [-1, 1]) { const t = M(CONE(0.06, 0.4, 5), acc, s * 0.2, -0.2, -0.6); t.rotation.x = -1.2; head.add(t); }
      if (def.ears) for (const s of [-1, 1]) head.add(M(CONE(0.12, 0.35, 4), body, s * 0.22, 0.45, 0.05));
      if (def.horns) for (const s of [-1, 1]) { const h = M(CONE(0.1, 0.6, 5), acc, s * 0.42, 0.38, 0); h.rotation.z = -s * 0.9; head.add(h); }
      inner.add(head);
      parts.head = head;
      for (const [x, z] of [[-0.35, -0.55], [0.35, -0.55], [-0.35, 0.55], [0.35, 0.55]]) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.65, z);
        pivot.add(M(B(0.25, 0.68, 0.25), body, 0, -0.32, 0));
        inner.add(pivot);
        parts.legs.push(pivot);
      }
      const tail = M(B(0.12, 0.12, def.tail ? 1.2 : 0.4), body, 0, 1.05, def.tail ? 1.3 : 0.95);
      tail.rotation.x = 0.4;
      inner.add(tail);
      radius = 0.9; height = 1.6;
      break;
    }
    case 'humanoid': {
      const k = def.bulky ? 1.35 : 1;
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.2 * k, 0.95, 0);
        pivot.add(M(B(0.26 * k, 0.95, 0.28 * k), acc, 0, -0.47, 0));
        inner.add(pivot);
        parts.legs.push(pivot);
      }
      inner.add(M(B(0.75 * k, 0.85, 0.45 * k), body, 0, 1.4, 0), M(B(0.8 * k, 0.16, 0.5 * k), acc, 0, 1.02, 0));
      const head = new THREE.Group();
      head.position.set(0, 2.05, 0);
      head.add(M(B(0.5, 0.5, 0.5), body), M(B(0.09, 0.07, 0.05), eye, -0.12, 0.04, -0.26), M(B(0.09, 0.07, 0.05), eye, 0.12, 0.04, -0.26));
      if (def.ears) for (const s of [-1, 1]) { const e = M(CONE(0.1, 0.4, 4), body, s * 0.3, 0.2, 0); e.rotation.z = -s * 0.6; head.add(e); }
      if (def.horns) for (const s of [-1, 1]) { const h = M(CONE(0.09, 0.55, 5), acc, s * 0.28, 0.35, 0); h.rotation.z = -s * 0.5; head.add(h); }
      if (def.leaves) head.add(M(geo('ico1', () => new THREE.IcosahedronGeometry(0.75, 0)), acc, 0, 0.45, 0));
      inner.add(head);
      parts.head = head;
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.5 * k, 1.75, 0);
        pivot.add(M(B(0.22 * k, 0.82, 0.22 * k), body, 0, -0.4, 0));
        inner.add(pivot);
        parts.arms.push(pivot);
      }
      const holder = new THREE.Group();
      holder.position.set(0, -0.8, 0);
      holder.rotation.x = 0.9;
      parts.arms[1].add(holder);
      parts.weaponHolder = holder;
      parts.metal = metal;
      parts.acc = acc;
      if (def.weapon) holder.add(buildWeapon(def.weapon, metal, acc));
      if (def.shield) {
        const sh = buildWeapon('shield', metal, acc);
        sh.position.set(-0.15, -0.55, -0.1);
        parts.arms[0].add(sh);
        parts.shield = sh;
      }
      if (def.tail) { const t = M(B(0.16, 0.16, 1.1), body, 0, 0.9, 0.6); t.rotation.x = 0.6; inner.add(t); }
      radius = 0.55 * k; height = 2.35;
      break;
    }
    case 'flyer': {
      inner.position.y = 0;
      const b = M(SPH(0.5), body);
      b.scale.set(1, 0.8, 1.3);
      inner.add(b);
      inner.add(M(SPH(0.32), def.wingless ? body : acc, 0, 0.1, -0.6));
      inner.add(M(B(0.08, 0.08, 0.05), eye, -0.13, 0.17, -0.88), M(B(0.08, 0.08, 0.05), eye, 0.13, 0.17, -0.88));
      if (def.stinger) { const s = M(CONE(0.12, 0.5, 6), acc, 0, -0.05, 0.85); s.rotation.x = Math.PI / 2 + 0.3; inner.add(s); }
      if (def.tail) { const t = M(B(0.15, 0.15, 1.2), body, 0, 0, 1.1); inner.add(t); }
      if (def.ghost) { const t = M(CONE(0.42, 1.1, 7), body, 0, -0.55, 0.3); t.rotation.x = Math.PI + 0.5; inner.add(t); }
      if (!def.wingless) {
        const wm = acc.clone();
        wm.transparent = true; wm.opacity = 0.7; wm.side = THREE.DoubleSide;
        wm.userData.base = wm.emissive.clone();
        for (const s of [-1, 1]) {
          const pivot = new THREE.Group();
          pivot.position.set(s * 0.35, 0.25, 0);
          pivot.add(M(B(1.3, 0.04, 0.65), wm, s * 0.65, 0, 0));
          inner.add(pivot);
          parts.wings.push(pivot);
        }
        parts.extraMats = [wm];
      }
      radius = 0.7; height = 1;
      break;
    }
    case 'slime': {
      const b = M(SPH(0.8, 14, 10), body, 0, 0.55, 0);
      b.scale.set(1, 0.72, 1);
      inner.add(b);
      parts.body = b;
      inner.add(M(SPH(0.11, 6, 5), eye, -0.25, 0.85, -0.62), M(SPH(0.11, 6, 5), eye, 0.25, 0.85, -0.62));
      if (def.color2) inner.add(M(SPH(0.3, 8, 6), acc, 0, 0.5, 0));
      radius = 0.85; height = 1.2;
      break;
    }
    case 'spider': {
      inner.add(M(SPH(0.45), body, 0, 0.75, -0.25));
      const abd = M(SPH(0.7), body, 0, 0.9, 0.7);
      abd.scale.set(1, 0.85, 1.15);
      inner.add(abd);
      const head = new THREE.Group();
      head.position.set(0, 0.85, -0.7);
      head.add(M(def.scythes ? SPH(0.32) : SPH(0.25), def.scythes ? acc : body));
      for (const [x, y] of [[-0.1, 0.08], [0.1, 0.08], [-0.17, 0.0], [0.17, 0.0]]) head.add(M(B(0.06, 0.06, 0.04), eye, x, y, -0.28));
      inner.add(head);
      parts.head = head;
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.32, 0.8, -0.45 + i * 0.25);
        pivot.rotation.y = s * (-0.6 + i * 0.4);
        const leg = M(B(1.15, 0.08, 0.08), acc, s * 0.55, 0, 0);
        leg.rotation.z = -s * 0.55;
        pivot.add(leg);
        inner.add(pivot);
        parts.legs.push(pivot);
      }
      if (def.scythes) {
        for (const s of [-1, 1]) {
          const pivot = new THREE.Group();
          pivot.position.set(s * 0.45, 1.0, -0.6);
          pivot.add(M(B(0.1, 1.2, 0.1), acc, 0, 0.5, 0));
          const blade = M(B(0.05, 0.22, 1.3), metal, 0, 1.05, -0.55);
          pivot.add(blade);
          pivot.rotation.x = -0.3;
          inner.add(pivot);
          parts.arms.push(pivot);
        }
      }
      if (def.stinger) {
        let prev = inner, y = 1.2, z = 1.3;
        for (let i = 0; i < 4; i++) { prev.add(M(SPH(0.16, 6, 5), acc, 0, y, z)); y += 0.3; z += 0.1 - i * 0.08; }
        const st = M(CONE(0.12, 0.4, 5), metal, 0, y, z - 0.2);
        st.rotation.x = -2;
        inner.add(st);
      }
      radius = 1; height = 1.4;
      break;
    }
    case 'cube': {
      const glass = body;
      glass.transparent = true; glass.opacity = 0.55; glass.metalness = 0.3; glass.roughness = 0.15;
      const cube = M(B(1.2, 1.2, 1.2), glass);
      const edges = new THREE.LineSegments(geo('edges', () => new THREE.EdgesGeometry(new THREE.BoxGeometry(1.22, 1.22, 1.22))),
        new THREE.LineBasicMaterial({ color: new THREE.Color(def.color2).multiplyScalar(3) }));
      cube.add(edges);
      const coreMat = eyeMat(def.color2);
      const core = M(geo('oct', () => new THREE.OctahedronGeometry(0.35, 0)), coreMat);
      cube.add(core);
      inner.add(cube);
      parts.cube = cube;
      parts.core = core;
      radius = 0.9; height = 1.3;
      break;
    }
    default:
      inner.add(M(B(1, 1, 1), body, 0, 0.5, 0));
  }

  const s = def.scale || 1;
  inner.scale.setScalar(s);
  inner.userData.s = s;
  const mats = [body, acc, metal, ...(parts.extraMats || [])];
  return { group, inner, parts, mats, radius: radius * s, height: height * s };
}
