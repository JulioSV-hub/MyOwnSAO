// Modelos dos monstros feitos de formas suaves (cápsulas, esferas, lâminas extrudadas). Frente do modelo = -Z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toonMat, outlineMat, addOutlines } from './toon.js';

const G = {};
const geo = (key, fn) => G[key] || (G[key] = fn());
const SPH = (r, w = 22, h = 16) => geo(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
const CAP = (r, len, rs = 14) => geo(`p${r},${len},${rs}`, () => new THREE.CapsuleGeometry(r, len, 6, rs));
const CONE = (r, h, s = 12) => geo(`c${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const CYL = (a, b, h, s = 14) => geo(`y${a},${b},${h},${s}`, () => new THREE.CylinderGeometry(a, b, h, s));
const RBOX = (w, h, d, r) => geo(`r${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r));

// Chifre curvo: cone afunilado dobrado ao longo do comprimento.
const HORN = (r, h) => geo(`h${r},${h}`, () => {
  const g = new THREE.ConeGeometry(r, h, 12, 6).translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / h; p.setZ(i, p.getZ(i) + y * y * h * 0.45); }
  g.computeVertexNormals();
  return g;
});

// Lâmina com ponta, extrudada e com bisel, apontando para -Y a partir de y = 0.
function BLADE(len, w, t, curve = 0) {
  return geo(`bl${len},${w},${t},${curve}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(-w / 2 + curve * 0.3, -len * 0.82);
    s.quadraticCurveTo(-w / 2 + curve, -len * 0.97, curve * 0.6, -len);
    s.quadraticCurveTo(w / 2 + curve * 0.4, -len * 0.9, w / 2 + curve * 0.2, -len * 0.8);
    s.lineTo(w / 2, 0);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: t * 0.4, bevelEnabled: true, bevelThickness: t * 0.3, bevelSize: w * 0.22, bevelSegments: 2, curveSegments: 6 });
    g.translate(0, 0, -t * 0.2);
    g.computeVertexNormals();
    return g;
  });
}

function AXEHEAD() {
  return geo('axe', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.12);
    s.quadraticCurveTo(0.25, 0.2, 0.42, 0.34);
    s.quadraticCurveTo(0.55, 0, 0.42, -0.34);
    s.quadraticCurveTo(0.25, -0.2, 0, -0.12);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 10 });
    g.translate(0, 0, -0.015).rotateY(Math.PI / 2);
    return g;
  });
}

function M(g, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function stdMat(color, def) {
  const m = toonMat(color);
  if (def.ghost) {
    m.transparent = true;
    m.opacity = 0.62;
    m.depthWrite = false;
    m.emissive.set(color).multiplyScalar(0.35);
  }
  if (def.glassy) {
    m.transparent = true;
    m.opacity = 0.78;
    m.roughness = 0.08;
    m.metalness = 0.15;
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
      g.add(M(CYL(0.035, 0.04, 0.3, 10), accent), M(CAP(0.035, 0.3, 8), accent, 0, -0.17, 0), M(BLADE(1.25, 0.1, 0.03), metal, 0, -0.19, 0));
      g.children[1].rotation.z = Math.PI / 2;
      break;
    case 'axe':
      g.add(M(CYL(0.035, 0.045, 1.5, 10), accent, 0, -0.55, 0), M(AXEHEAD(), metal, 0, -1.15, 0), M(SPH(0.06, 10, 8), metal, 0, -1.32, 0));
      break;
    case 'hammer': {
      const head = M(CYL(0.22, 0.22, 0.55, 18), metal, 0, -1.2, 0);
      head.rotation.x = Math.PI / 2;
      g.add(M(CYL(0.04, 0.05, 1.4, 10), accent, 0, -0.5, 0), head);
      break;
    }
    case 'katana':
      g.add(M(CYL(0.032, 0.032, 0.45, 10), accent), M(CYL(0.12, 0.12, 0.03, 18), metal, 0, -0.25, 0), M(BLADE(2.1, 0.075, 0.025, 0.12), metal, 0, -0.26, 0));
      break;
    case 'zweihander':
      g.add(M(CYL(0.04, 0.045, 0.5, 10), accent), M(CAP(0.05, 0.5, 8), accent, 0, -0.27, 0), M(BLADE(2.1, 0.2, 0.05), metal, 0, -0.3, 0));
      g.children[1].rotation.z = Math.PI / 2;
      break;
    case 'shield': {
      const disc = M(CYL(0.42, 0.42, 0.07, 28), accent);
      disc.rotation.z = Math.PI / 2;
      const boss = M(SPH(0.13, 14, 10), metal, -0.05, 0, 0);
      const rim = M(geo('rim', () => new THREE.TorusGeometry(0.42, 0.035, 8, 32)), metal);
      rim.rotation.y = Math.PI / 2;
      g.add(disc, boss, rim);
      break;
    }
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
  const dark = toonMat('#2a2420');
  dark.userData.base = dark.emissive.clone();
  const metal = new THREE.MeshStandardMaterial({ color: '#c4c8d0', metalness: 0.75, roughness: 0.28 });
  metal.userData.base = metal.emissive.clone();
  const parts = { legs: [], arms: [], wings: [] };
  let radius = 0.8, height = 1.6;

  switch (def.arch) {
    case 'quad': {
      const torso = M(CAP(0.42, 0.85), body, 0, 0.98, 0);
      torso.rotation.x = Math.PI / 2;
      torso.scale.set(1.08, 1, 0.95);
      inner.add(torso);
      inner.add(M(SPH(0.4), body, 0, 1.12, -0.55));
      const head = new THREE.Group();
      head.position.set(0, 1.2, -0.95);
      const skull = M(SPH(0.34), body);
      skull.scale.set(1, 0.92, 1.05);
      const snout = M(CAP(0.17, 0.2), acc, 0, -0.08, -0.34);
      snout.rotation.x = Math.PI / 2;
      head.add(skull, snout, M(SPH(0.07, 10, 8), dark, 0, -0.04, -0.6));
      head.add(M(SPH(0.055, 10, 8), eye, -0.15, 0.1, -0.27), M(SPH(0.055, 10, 8), eye, 0.15, 0.1, -0.27));
      if (def.tusks) for (const s of [-1, 1]) { const t = M(HORN(0.045, 0.32), acc, s * 0.13, -0.16, -0.45); t.rotation.x = -2.2; head.add(t); }
      if (def.ears) for (const s of [-1, 1]) { const e = M(CONE(0.11, 0.32), body, s * 0.19, 0.32, 0.02); e.rotation.z = -s * 0.25; head.add(e); }
      if (def.horns) for (const s of [-1, 1]) { const h = M(HORN(0.08, 0.6), acc, s * 0.26, 0.22, 0.02); h.rotation.set(-0.4, 0, -s * 0.8); head.add(h); }
      inner.add(head);
      parts.head = head;
      for (const [x, z] of [[-0.27, -0.5], [0.27, -0.5], [-0.27, 0.48], [0.27, 0.48]]) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.82, z);
        pivot.add(M(CAP(0.11, 0.42), body, 0, -0.33, 0), M(SPH(0.11, 12, 8), dark, 0, -0.68, -0.02));
        inner.add(pivot);
        parts.legs.push(pivot);
      }
      const tail = M(CAP(0.06, def.tail ? 1.0 : 0.35), body, 0, 1.08, def.tail ? 1.3 : 0.98);
      tail.rotation.x = def.tail ? 1.25 : 0.6;
      inner.add(tail);
      radius = 0.9; height = 1.65;
      break;
    }
    case 'humanoid': {
      const k = def.bulky ? 1.3 : 1;
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.17 * k, 0.94, 0);
        const boot = M(SPH(0.13 * k, 14, 10), acc, 0, -0.86, -0.04);
        boot.scale.set(1, 0.7, 1.35);
        pivot.add(M(CAP(0.12 * k, 0.5), acc, 0, -0.38, 0), boot);
        inner.add(pivot);
        parts.legs.push(pivot);
      }
      const pelvis = M(SPH(0.27 * k), acc, 0, 1.0, 0);
      pelvis.scale.set(1.1, 0.62, 0.8);
      const torso = M(CAP(0.29 * k, 0.38), body, 0, 1.42, 0);
      torso.scale.set(1.12, 1, 0.78);
      const belt = M(CYL(0.31 * k, 0.31 * k, 0.12, 20), acc, 0, 1.08, 0);
      belt.scale.z = 0.8;
      inner.add(pelvis, torso, belt);
      for (const s of [-1, 1]) inner.add(M(SPH(0.16 * k, 14, 10), body, s * 0.36 * k, 1.74, 0));
      const head = new THREE.Group();
      head.position.set(0, 2.07, 0);
      const skull = M(SPH(0.25), body);
      skull.scale.set(1, 1.05, 1);
      head.add(skull, M(SPH(0.045, 10, 8), eye, -0.09, 0.04, -0.22), M(SPH(0.045, 10, 8), eye, 0.09, 0.04, -0.22));
      if (def.ears) {
        const muzzle = M(CAP(0.1, 0.12), body, 0, -0.07, -0.25);
        muzzle.rotation.x = Math.PI / 2;
        head.add(muzzle);
        for (const s of [-1, 1]) { const e = M(CONE(0.09, 0.36), body, s * 0.2, 0.26, 0.02); e.rotation.z = -s * 0.45; head.add(e); }
      }
      if (def.horns) for (const s of [-1, 1]) { const h = M(HORN(0.075, 0.55), acc, s * 0.2, 0.16, 0); h.rotation.set(-0.3, 0, -s * 0.75); head.add(h); }
      if (def.leaves) {
        for (const [x, y, z, r] of [[0, 0.42, 0, 0.5], [0.32, 0.3, 0.1, 0.34], [-0.3, 0.32, -0.08, 0.36], [0, 0.32, 0.3, 0.3]]) head.add(M(SPH(r, 16, 12), acc, x, y, z));
      }
      inner.add(head);
      parts.head = head;
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.42 * k, 1.74, 0);
        pivot.add(M(CAP(0.095 * k, 0.55), body, 0, -0.38, 0), M(SPH(0.1 * k, 12, 10), acc, 0, -0.78, 0));
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
        sh.position.set(-0.14, -0.55, -0.05);
        parts.arms[0].add(sh);
        parts.shield = sh;
      }
      if (def.tail) { const t = M(CAP(0.09, 0.9), body, 0, 0.85, 0.55); t.rotation.x = 1.0; inner.add(t); }
      radius = 0.52 * k; height = 2.4;
      break;
    }
    case 'flyer': {
      const b = M(SPH(0.48), body);
      b.scale.set(1, 0.85, 1.3);
      inner.add(b);
      inner.add(M(SPH(0.31), def.wingless ? body : acc, 0, 0.1, -0.62));
      inner.add(M(SPH(0.06, 10, 8), eye, -0.13, 0.18, -0.88), M(SPH(0.06, 10, 8), eye, 0.13, 0.18, -0.88));
      if (def.stinger) {
        const ab = M(SPH(0.32), acc, 0, -0.05, 0.62);
        ab.scale.set(1, 0.9, 1.25);
        const s = M(CONE(0.1, 0.45), dark, 0, -0.1, 1.05);
        s.rotation.x = Math.PI / 2 + 0.3;
        inner.add(ab, s);
      }
      if (def.tail) { const t = M(CAP(0.1, 1.1), body, 0, 0, 1.1); t.rotation.x = Math.PI / 2; inner.add(t); }
      if (def.ghost) { const t = M(CONE(0.42, 1.2, 20), body, 0, -0.55, 0.3); t.rotation.x = Math.PI + 0.5; inner.add(t); }
      if (!def.wingless) {
        const wm = acc.clone();
        wm.transparent = true; wm.opacity = 0.65; wm.side = THREE.DoubleSide; wm.depthWrite = false;
        wm.userData.base = wm.emissive.clone();
        const wing = geo('wing', () => new THREE.CircleGeometry(0.6, 24).rotateX(-Math.PI / 2).scale(1.25, 1, 0.55));
        for (const s of [-1, 1]) {
          const pivot = new THREE.Group();
          pivot.position.set(s * 0.32, 0.28, 0);
          pivot.add(M(wing, wm, s * 0.72, 0, 0.05));
          inner.add(pivot);
          parts.wings.push(pivot);
        }
        parts.extraMats = [wm];
      }
      radius = 0.7; height = 1;
      break;
    }
    case 'slime': {
      body.roughness = 0.18;
      const b = M(SPH(0.8, 32, 24), body, 0, 0.55, 0);
      b.scale.set(1, 0.72, 1);
      inner.add(b);
      parts.body = b;
      for (const s of [-1, 1]) {
        if (def.name.includes('Toad')) inner.add(M(SPH(0.2), body, s * 0.28, 0.95, -0.42));
        inner.add(M(SPH(0.11, 12, 10), eye, s * 0.27, 0.95, -0.58));
      }
      if (def.color2) inner.add(M(SPH(0.3), acc, 0, 0.5, 0));
      radius = 0.85; height = 1.2;
      break;
    }
    case 'spider': {
      inner.add(M(SPH(0.42), body, 0, 0.78, -0.25));
      const abd = M(SPH(0.66), body, 0, 0.92, 0.7);
      abd.scale.set(1, 0.85, 1.15);
      inner.add(abd);
      const head = new THREE.Group();
      head.position.set(0, 0.85, -0.7);
      head.add(M(SPH(def.scythes ? 0.33 : 0.26), def.scythes ? acc : body));
      for (const [x, y] of [[-0.09, 0.09], [0.09, 0.09], [-0.17, 0.0], [0.17, 0.0]]) head.add(M(SPH(0.045, 8, 6), eye, x, y, -0.24));
      inner.add(head);
      parts.head = head;
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.3, 0.82, -0.45 + i * 0.25);
        pivot.rotation.y = s * (-0.6 + i * 0.4);
        const upper = M(CAP(0.05, 0.6, 8), acc, s * 0.3, 0.2, 0);
        upper.rotation.z = -s * 1.0;
        const lower = M(CAP(0.04, 0.75, 8), acc, s * 0.86, -0.12, 0);
        lower.rotation.z = s * 0.45;
        pivot.add(upper, M(SPH(0.065, 8, 6), acc, s * 0.56, 0.38, 0), lower);
        inner.add(pivot);
        parts.legs.push(pivot);
      }
      if (def.scythes) {
        const blade = geo('scythe', () => new THREE.TorusGeometry(0.7, 0.05, 8, 24, Math.PI * 0.6).scale(1, 1, 0.4));
        for (const s of [-1, 1]) {
          const pivot = new THREE.Group();
          pivot.position.set(s * 0.45, 1.0, -0.6);
          pivot.add(M(CAP(0.06, 1.1, 8), acc, 0, 0.55, 0));
          const b = M(blade, metal, 0, 1.15, -0.65);
          b.rotation.y = Math.PI / 2;
          b.rotation.z = Math.PI * 0.2;
          pivot.add(b);
          pivot.rotation.x = -0.3;
          inner.add(pivot);
          parts.arms.push(pivot);
        }
      }
      if (def.stinger) {
        let y = 1.2, z = 1.3;
        for (let i = 0; i < 5; i++) { inner.add(M(SPH(0.16 - i * 0.015), acc, 0, y, z)); y += 0.25; z += 0.08 - i * 0.07; }
        const st = M(CONE(0.1, 0.4), dark, 0, y, z - 0.15);
        st.rotation.x = -2;
        inner.add(st);
      }
      radius = 1; height = 1.4;
      break;
    }
    case 'cube': {
      const glass = body;
      glass.transparent = true; glass.opacity = 0.55; glass.metalness = 0.3; glass.roughness = 0.08;
      const cube = M(RBOX(1.2, 1.2, 1.2, 0.08), glass);
      const edges = new THREE.LineSegments(geo('edges', () => new THREE.EdgesGeometry(new THREE.BoxGeometry(1.22, 1.22, 1.22))),
        new THREE.LineBasicMaterial({ color: new THREE.Color(def.color2).multiplyScalar(3) }));
      cube.add(edges);
      const core = M(SPH(0.32), eyeMat(def.color2));
      cube.add(core);
      inner.add(cube);
      parts.cube = cube;
      parts.core = core;
      radius = 0.9; height = 1.3;
      break;
    }
    default:
      inner.add(M(SPH(0.6), body, 0, 0.6, 0));
  }

  const outline = outlineMat('#2a1e16', boss ? 1.8 : 1.3);
  if (!def.ghost && def.arch !== 'cube') addOutlines(inner, outline, (o) => o.material === eye || o.material.transparent);
  const s = def.scale || 1;
  inner.scale.setScalar(s);
  inner.userData.s = s;
  const mats = [body, acc, metal, dark, ...(parts.extraMats || [])];
  return { group, inner, parts, mats, radius: radius * s, height: height * s };
}
