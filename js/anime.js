// Formas "de anime" para os personagens: mechas de cabelo curvas e afinando na ponta, tronco com cintura,
// membros afunilados e cabeça com queixo. Tudo em cache para muitos NPCs gastarem pouca memória.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const cache = new Map();
const C = (k, fn) => cache.get(k) || (cache.set(k, fn()), cache.get(k));
const v = (x, y, z) => new THREE.Vector3(x, y, z);

// Mecha: tubo achatado ao longo de uma curva (raiz → controle → ponta), afinando até a ponta
export function strandGeo(p0, p1, p2, out, r0, flat = 0.45, seg = 8, sides = 6) {
  const pos = [], idx = [];
  const P = new THREE.Vector3(), T = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    P.set(a * p0.x + b * p1.x + c * p2.x, a * p0.y + b * p1.y + c * p2.y, a * p0.z + b * p1.z + c * p2.z);
    T.set(2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x), 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y), 2 * (1 - t) * (p1.z - p0.z) + 2 * t * (p2.z - p1.z)).normalize();
    B.crossVectors(T, out).normalize();
    if (B.lengthSq() < 1e-6) B.set(1, 0, 0);
    N.crossVectors(B, T).normalize();
    const r = r0 * Math.pow(1 - t, 0.85) + 0.0015;
    for (let k = 0; k < sides; k++) {
      const ang = (k / sides) * Math.PI * 2;
      pos.push(P.x + B.x * Math.cos(ang) * r + N.x * Math.sin(ang) * r * flat, P.y + B.y * Math.cos(ang) * r + N.y * Math.sin(ang) * r * flat, P.z + B.z * Math.cos(ang) * r + N.z * Math.sin(ang) * r * flat);
    }
  }
  for (let i = 0; i < seg; i++) for (let k = 0; k < sides; k++) {
    const a = i * sides + k, b = i * sides + ((k + 1) % sides), c = a + sides, d = b + sides;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// direção na cabeça: az 0 = frente (−Z), az π = nuca; el = altura (0 = linha dos olhos, π/2 = topo)
const dirOf = (az, el) => v(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));

// uma mecha saindo da cabeça: cai para baixo (down), sai para fora (out) e pode ir para trás/lado
function lock(R, az, el, len, o = {}) {
  const d = dirOf(az, el), p0 = d.clone().multiplyScalar(R * 0.98);
  const side = v(Math.cos(az), 0, Math.sin(az));
  const down = o.down ?? 1, outK = o.out ?? 0.25, back = o.back ?? 0, sideK = o.side ?? 0, up = o.up ?? 0;
  const tip = p0.clone().addScaledVector(d, len * outK).add(v(0, -len * down + len * up, 0)).addScaledVector(side, len * sideK).add(v(0, 0, len * back));
  const mid = p0.clone().lerp(tip, 0.45).addScaledVector(d, len * (o.bulge ?? 0.28));
  return strandGeo(p0, mid, tip, d, o.r ?? 0.034, o.flat ?? 0.42);
}

// mechas de cada penteado (em coordenadas da cabeça)
export function hairLocks(style, R, female) {
  const key = `${style}|${female ? 1 : 0}|${R}`;
  return C(`hair:${key}`, () => {
    const L = [];
    // franja: termina acima dos olhos (as pontas das laterais descem um pouco mais)
    const bangs = (n, len, spread = 1.1, el = 0.74, r = 0.036) => {
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        L.push(lock(R, t * spread, el - Math.abs(t) * 0.22, len * (0.85 + Math.abs(t) * 0.5), { out: 0.42, down: 0.55 + Math.abs(t) * 0.5, side: t * 0.5, r, bulge: 0.3 }));
      }
    };
    const sides = (len, el = 0.25, r = 0.03, out = 0.18) => { for (const s of [-1, 1]) for (const k of [0, 1]) L.push(lock(R, s * (1.25 + k * 0.28), el - k * 0.05, len * (1 - k * 0.15), { out, r, bulge: 0.2 })); };
    const backRing = (n, len, el = 0.35, o = {}) => {
      for (let i = 0; i < n; i++) { const az = Math.PI + (i / (n - 1) - 0.5) * 2.6; L.push(lock(R, az, el + (i % 2) * 0.12, len * (0.85 + (i % 3) * 0.1), { out: 0.3, r: 0.042, ...o })); }
    };
    switch (style) {
      case 'spiky': // estilo Kirito: franja pontuda e mechas espetadas para trás
        bangs(6, 0.15, 1.2, 0.6, 0.04);
        sides(0.15, 0.2);
        for (let i = 0; i < 11; i++) {
          const az = Math.PI + (i / 10 - 0.5) * 3.4, el = 0.35 + (i % 3) * 0.22;
          L.push(lock(R, az, el, 0.17 + (i % 2) * 0.05, { out: 0.75, down: 0.35, up: 0, r: 0.045, bulge: 0.1 }));
        }
        for (let i = 0; i < 4; i++) L.push(lock(R, Math.PI + (i - 1.5) * 0.5, 1.05, 0.15, { out: 0.8, down: 0.1, back: 0.5, r: 0.045 }));
        break;
      case 'long':
        bangs(7, 0.14, 1.25);
        for (const s of [-1, 1]) for (let k = 0; k < 2; k++) L.push(lock(R, s * (1.3 + k * 0.3), 0.3, 0.42 - k * 0.04, { out: 0.12, r: 0.036, bulge: 0.16 }));
        backRing(9, 0.55, 0.3, { out: 0.2, bulge: 0.32 });
        break;
      case 'ponytail':
        bangs(5, 0.13, 1.05);
        sides(0.13, 0.25);
        backRing(5, 0.14, 0.4, { out: 0.2 });
        // rabo de cavalo saindo da nuca
        for (let i = 0; i < 5; i++) {
          const p0 = v(0, 0.06, R * 1.0), sx = (i - 2) * 0.018;
          L.push(strandGeo(p0, v(sx, 0.02, R * 1.6), v(sx * 2, -0.34 - (i % 2) * 0.05, R * 1.55), v(0, 0, 1), 0.04, 0.6));
        }
        break;
      case 'twintails':
        bangs(6, 0.13, 1.15);
        backRing(5, 0.15, 0.4);
        for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
          const p0 = v(s * R * 0.95, 0.07, 0.03), dz = (i - 1.5) * 0.02;
          L.push(strandGeo(p0, v(s * R * 1.55, 0.02, 0.04 + dz), v(s * R * 1.5, -0.36 - (i % 2) * 0.04, 0.06 + dz * 2), v(s, 0, 0), 0.04, 0.6));
        }
        break;
      case 'bob': // corte chanel: mechas até o queixo, curvando para dentro
        bangs(7, 0.13, 1.25);
        for (let i = 0; i < 9; i++) {
          const a = i < 2 ? -1.35 - i * 0.35 : i > 6 ? 1.35 + (8 - i) * 0.35 : Math.PI + (i - 4) * 0.42;
          L.push(lock(R, a, 0.3, 0.27, { out: 0.32, down: 0.95, r: 0.045, bulge: 0.3 }));
        }
        break;
      case 'hood':
        bangs(4, 0.11, 0.9);
        break;
      case 'bald':
        break;
      default: // curto
        bangs(5, 0.11, 1.05);
        sides(0.1, 0.25, 0.028);
        backRing(7, 0.12, 0.42, { out: 0.35 });
        break;
    }
    return L.length ? mergeGeometries(L) : null;
  });
}

// cabeça com queixo: a esfera afina para baixo e para frente
export function chinify(g, R) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < 0) {
      const t = Math.min(1, -y / R), k = 1 - 0.32 * Math.pow(t, 1.6);
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * (1 - 0.18 * Math.pow(t, 1.4)) - (p.getZ(i) < 0 ? 0.012 * t : 0));
      p.setY(i, y * (1 + 0.12 * t));
    }
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// tronco com peito, cintura e quadril (perfil girado em volta do eixo Y)
export function torsoGeo(female, w) {
  return C(`torso:${female ? 1 : 0}:${w}`, () => {
    const pts = female
      ? [[0, 0.98], [0.118, 0.99], [0.112, 1.04], [0.106, 1.09], [0.13, 1.17], [0.142, 1.23], [0.15, 1.3], [0.14, 1.37], [0.085, 1.42], [0, 1.44]]
      : [[0, 0.98], [0.125, 0.99], [0.122, 1.05], [0.125, 1.12], [0.148, 1.2], [0.162, 1.28], [0.168, 1.34], [0.15, 1.39], [0.085, 1.43], [0, 1.45]];
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r * w, y)), 22);
    g.scale(1, 1, 0.68);
    return g;
  });
}
export function hipsGeo(female, w) {
  return C(`hips:${female ? 1 : 0}:${w}`, () => {
    const pts = female ? [[0, 0.8], [0.1, 0.81], [0.15, 0.86], [0.152, 0.92], [0.125, 1.0], [0, 1.0]] : [[0, 0.8], [0.1, 0.81], [0.14, 0.86], [0.138, 0.93], [0.126, 1.0], [0, 1.0]];
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r * w, y)), 20);
    g.scale(1, 1, 0.74);
    return g;
  });
}

// membro afunilado (de cima para baixo), com a ponta arredondada
export function limbGeo(rTop, rBot, len) {
  return C(`limb:${rTop}:${rBot}:${len}`, () => {
    const prof = [new THREE.Vector2(0, -len - rBot * 0.45)];
    for (let i = 1; i <= 3; i++) { const a = (i / 3) * Math.PI / 2; prof.push(new THREE.Vector2(Math.sin(a) * rBot, -len - rBot * 0.45 * Math.cos(a))); }
    for (let i = 0; i <= 3; i++) { const a = (i / 3) * Math.PI / 2; prof.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * rTop), rTop * 0.5 * Math.sin(a))); }
    return new THREE.LatheGeometry(prof, 14);
  });
}

// mão em forma de luva (palma + polegar)
export function handGeo(s) {
  return C(`hand:${s}`, () => {
    const palm = new THREE.SphereGeometry(0.042, 12, 10);
    palm.scale(0.75, 1.15, 0.55);
    const thumb = new THREE.CapsuleGeometry(0.013, 0.035, 3, 8);
    thumb.rotateZ(s * 0.6);
    thumb.translate(s * 0.026, 0.005, -0.012);
    return mergeGeometries([palm.toNonIndexed(), thumb.toNonIndexed()]);
  });
}

// bota com bico para frente
export function bootGeo() {
  return C('boot', () => {
    const shaft = new THREE.CylinderGeometry(0.06, 0.056, 0.2, 14);
    shaft.translate(0, -0.06, 0);
    const foot = new THREE.CapsuleGeometry(0.05, 0.11, 4, 12);
    foot.rotateX(Math.PI / 2);
    foot.scale(1, 0.72, 1);
    foot.translate(0, -0.15, -0.05);
    return mergeGeometries([shaft.toNonIndexed(), foot.toNonIndexed()]);
  });
}
