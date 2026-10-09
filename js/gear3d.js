// Modelos 3D dos equipamentos e itens — usados na mão do jogador e nos ícones da mochila.
// Espadas: cabo na origem, lâmina apontando para +Y.
import * as THREE from 'three';

const PI = Math.PI;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.2, ...o });
const glow = (color, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });
const M = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };

// Perfil da lâmina com ponta (curve > 0 entorta como uma katana). Base em y=0, ponta em y=L.
function bladeGeo(L, w, t, { tip = 0.14, curve = 0, taper = 0.85 } = {}) {
  const s = new THREE.Shape();
  const cx = (y) => curve * Math.pow(y / L, 2) * L * 0.12;
  s.moveTo(-w, 0);
  s.lineTo(-w * taper + cx(L * (1 - tip)), L * (1 - tip));
  s.quadraticCurveTo(-w * 0.4 + cx(L * 0.97), L * 0.97, cx(L), L);
  s.quadraticCurveTo(w * 0.5 + cx(L * 0.97), L * 0.96, w * taper + cx(L * (1 - tip)), L * (1 - tip));
  s.lineTo(w, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t * 0.3, bevelEnabled: true, bevelThickness: t * 0.35, bevelSize: Math.min(w * 0.35, 0.012), bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -t * 0.15);
  g.computeVertexNormals();
  return g;
}

function crossGuard(width, mat, { curl = 0, thick = 0.02 } = {}) {
  const g = new THREE.Group();
  const bar = M(new THREE.CapsuleGeometry(thick, width, 4, 10), mat);
  bar.rotation.z = PI / 2;
  g.add(bar);
  if (curl) for (const s of [-1, 1]) {
    const tip = M(new THREE.CapsuleGeometry(thick * 0.9, 0.06, 4, 8), mat, s * (width / 2 + 0.02), curl > 0 ? 0.03 : -0.03, 0);
    tip.rotation.z = s * (curl > 0 ? -0.8 : 0.8);
    g.add(tip, M(new THREE.SphereGeometry(thick * 1.3, 10, 8), mat, s * (width / 2 + 0.045), curl > 0 ? 0.06 : -0.06, 0));
  }
  return g;
}

function grip(len, r, mat, wrapMat) {
  const g = new THREE.Group();
  g.add(M(new THREE.CylinderGeometry(r * 0.9, r, len, 14), mat));
  const n = Math.round(len / 0.045);
  for (let i = 0; i < n; i++) {
    const w = M(new THREE.TorusGeometry(r * 1.02, r * 0.22, 6, 14), wrapMat, 0, -len / 2 + (i + 0.5) * (len / n), 0);
    w.rotation.x = PI / 2;
    w.rotation.y = 0.35;
    g.add(w);
  }
  return g;
}

export function buildSword(def) {
  const style = def.style || 'long';
  const group = new THREE.Group();
  const bladeColor = new THREE.Color(def.blade || '#c8d0d8');
  const bladeMat = new THREE.MeshStandardMaterial({ color: bladeColor, metalness: 0.75, roughness: 0.18 });
  const guardMat = std(def.guard || '#7a7a82', { metalness: 0.8, roughness: 0.3 });
  const gripMat = std(def.grip || '#3a2a20', { metalness: 0, roughness: 0.85 });
  const wrapMat = std(new THREE.Color(def.grip || '#3a2a20').multiplyScalar(0.6), { metalness: 0, roughness: 0.9 });
  let L = 1.0, w = 0.028, t = 0.009, gripLen = 0.22, guardW = 0.2, opts = {};
  switch (style) {
    case 'basic': L = 0.82; w = 0.025; guardW = 0.15; gripLen = 0.18; break;
    case 'broad': L = 0.98; w = 0.042; t = 0.012; guardW = 0.28; break;
    case 'rapier': L = 1.1; w = 0.011; t = 0.007; opts = { tip: 0.3, taper: 0.7 }; guardW = 0.12; break;
    case 'katana': L = 1.12; w = 0.02; t = 0.008; gripLen = 0.3; opts = { curve: 1, tip: 0.08, taper: 0.95 }; break;
    case 'dark': L = 1.06; w = 0.032; t = 0.011; guardW = 0.24; opts = { tip: 0.18 }; break;
    case 'crystal': L = 1.04; w = 0.03; t = 0.011; guardW = 0.22; opts = { tip: 0.2, taper: 0.75 }; break;
    case 'ornate': L = 1.04; w = 0.03; guardW = 0.26; break;
    case 'holy': L = 1.08; w = 0.032; guardW = 0.3; break;
    default: break;
  }
  if (style === 'dark') { bladeMat.metalness = 0.6; bladeMat.roughness = 0.25; }
  if (style === 'crystal') {
    bladeMat.transparent = true; bladeMat.opacity = 0.82; bladeMat.metalness = 0.1; bladeMat.roughness = 0.05;
    bladeMat.emissive = bladeColor.clone().multiplyScalar(0.35);
  }
  if (style === 'holy') bladeMat.emissive = new THREE.Color('#fff4d0').multiplyScalar(0.12);
  bladeMat.userData.baseEmissive = bladeMat.emissive.clone();

  const base = 0.13;
  const blade = M(bladeGeo(L, w, t, opts), bladeMat, 0, base, 0);
  group.add(blade);
  // sulco central (fuller) nas duas faces
  if (style === 'long' || style === 'broad' || style === 'ornate' || style === 'holy' || style === 'dark') {
    const fm = new THREE.MeshStandardMaterial({ color: bladeColor.clone().multiplyScalar(style === 'dark' ? 1.6 : 0.62), metalness: 0.8, roughness: 0.3 });
    for (const z of [-1, 1]) {
      const f = M(new THREE.PlaneGeometry(w * 0.45, L * 0.62), fm, 0, base + L * 0.36, z * (t * 0.5 + 0.0012));
      if (z < 0) f.rotation.y = PI;
      group.add(f);
    }
  }
  // runas brilhantes na lâmina
  if (def.rune) for (const z of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const r = M(new THREE.PlaneGeometry(w * 0.5, 0.025), glow(def.rune, 2.2), 0, base + 0.15 + i * 0.12, z * (t * 0.5 + 0.002));
      if (z < 0) r.rotation.y = PI;
      group.add(r);
    }
  }

  // guarda
  if (style === 'rapier') {
    const ring = M(new THREE.TorusGeometry(0.06, 0.008, 8, 24), guardMat, 0, 0.1, 0);
    const cup = M(new THREE.SphereGeometry(0.055, 16, 10, 0, PI * 2, 0, PI * 0.45), guardMat, 0, 0.1, 0);
    cup.rotation.x = PI;
    const bow = M(new THREE.TorusGeometry(0.11, 0.007, 6, 20, PI * 0.9), guardMat, 0.04, 0.02, 0);
    bow.rotation.z = -PI / 2 - 0.2;
    group.add(ring, cup, bow, crossGuard(guardW, guardMat, { thick: 0.01, curl: 1 }));
    group.children[group.children.length - 1].position.y = 0.11;
  } else if (style === 'katana') {
    const tsuba = M(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 24), guardMat, 0, base - 0.01, 0);
    group.add(tsuba, M(new THREE.CylinderGeometry(0.022, 0.024, 0.04, 14), guardMat, 0, base + 0.02, 0));
  } else if (style === 'dark' || style === 'crystal') {
    // guarda angular em "asas"
    const shape = new THREE.Shape();
    shape.moveTo(-guardW / 2, -0.01); shape.lineTo(-guardW * 0.18, 0.025); shape.lineTo(0, 0.05); shape.lineTo(guardW * 0.18, 0.025);
    shape.lineTo(guardW / 2, -0.01); shape.lineTo(guardW * 0.2, -0.03); shape.lineTo(0, -0.045); shape.lineTo(-guardW * 0.2, -0.03); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 1 });
    g.translate(0, 0, -0.01);
    group.add(M(g, style === 'crystal' ? bladeMat : guardMat, 0, base - 0.01, 0));
  } else {
    const cg = crossGuard(guardW, guardMat, { curl: style === 'ornate' || style === 'holy' ? 1 : style === 'broad' ? -1 : 0, thick: style === 'broad' ? 0.024 : 0.018 });
    cg.position.y = base - 0.01;
    group.add(cg);
    if (style === 'holy') {
      for (const s of [-1, 1]) {
        const wing = M(new THREE.ConeGeometry(0.03, 0.12, 8), guardMat, s * 0.06, base + 0.03, 0);
        wing.rotation.z = -s * 1.0;
        group.add(wing);
      }
    }
  }
  if (def.gem) {
    for (const z of [-1, 1]) group.add(M(new THREE.SphereGeometry(0.017, 12, 10), glow(def.gem, 1.6), 0, base - 0.01, z * 0.016));
  }
  // cabo e pomo
  const g = grip(gripLen, 0.019, gripMat, wrapMat);
  g.position.y = base - 0.03 - gripLen / 2;
  group.add(g);
  group.add(M(style === 'katana' ? new THREE.CylinderGeometry(0.022, 0.02, 0.025, 12) : new THREE.SphereGeometry(0.03, 14, 10), guardMat, 0, base - 0.05 - gripLen, 0));
  if (def.gem && style !== 'katana') group.add(M(new THREE.SphereGeometry(0.013, 10, 8), glow(def.gem, 1.6), 0, base - 0.05 - gripLen, 0.024));
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // centraliza para que a empunhadura fique na origem
  group.position.y = 0;
  return { group, bladeMat, tipY: base + L, baseY: base + 0.08 };
}

export function buildArmor(def) {
  const group = new THREE.Group();
  const main = std(def.color, { metalness: def.type === 'plate' || def.type === 'mail' ? 0.7 : 0.05, roughness: def.type === 'plate' ? 0.3 : 0.8 });
  const trim = std(def.trim, { metalness: 0.5, roughness: 0.5 });
  const torso = M(new THREE.CapsuleGeometry(0.3, 0.42, 6, 18), main, 0, 0, 0);
  torso.scale.set(1.15, 1, 0.65);
  group.add(torso);
  for (const s of [-1, 1]) {
    const sh = M(new THREE.SphereGeometry(0.17, 16, 12), def.type === 'plate' ? trim : main, s * 0.36, 0.3, 0);
    sh.scale.set(1.2, 0.8, 1);
    group.add(sh);
  }
  const belt = M(new THREE.CylinderGeometry(0.31, 0.31, 0.07, 24), trim, 0, -0.25, 0);
  belt.scale.z = 0.66;
  group.add(belt, M(new THREE.BoxGeometry(0.08, 0.06, 0.03), std('#d8c070', { metalness: 0.9 }), 0, -0.25, 0.21));
  if (def.type === 'coat' || def.type === 'cloak') {
    const skirt = M(new THREE.CylinderGeometry(0.3, 0.46, 0.75, 24, 1, true, PI + 0.4, PI * 2 - 0.8), std(def.color, { side: THREE.DoubleSide, roughness: 0.85 }), 0, -0.6, 0);
    skirt.scale.z = 0.7;
    const collar = M(new THREE.CylinderGeometry(0.17, 0.24, 0.16, 20, 1, true, PI + 0.6, PI * 2 - 1.2), std(def.color, { side: THREE.DoubleSide }), 0, 0.48, 0);
    group.add(skirt, collar);
    for (const s of [-1, 1]) group.add(M(new THREE.BoxGeometry(0.02, 0.9, 0.02), trim, s * 0.12, -0.25, 0.2));
  }
  if (def.type === 'mail') {
    const rm = std(new THREE.Color(def.color).multiplyScalar(0.7), { metalness: 0.8, roughness: 0.4 });
    for (let y = -0.15; y < 0.3; y += 0.09) {
      const r = M(new THREE.TorusGeometry(0.33, 0.012, 6, 32), rm, 0, y, 0);
      r.rotation.x = PI / 2;
      r.scale.y = 0.66;
      group.add(r);
    }
  }
  if (def.type === 'plate') {
    const plate = M(new THREE.SphereGeometry(0.28, 20, 14, 0, PI * 2, 0, PI * 0.5), main, 0, 0.05, 0.08);
    plate.rotation.x = PI / 2;
    plate.scale.set(1.05, 0.5, 1.1);
    group.add(plate);
    if (def.trim === '#c0262c') {
      group.add(M(new THREE.BoxGeometry(0.05, 0.22, 0.02), trim, 0, 0.12, 0.23), M(new THREE.BoxGeometry(0.16, 0.05, 0.02), trim, 0, 0.16, 0.23));
    }
  }
  if (def.type === 'cloak') {
    const hood = M(new THREE.SphereGeometry(0.2, 16, 12, 0, PI * 2, 0, PI * 0.55), std(def.color, { side: THREE.DoubleSide }), 0, 0.55, 0.08);
    hood.rotation.x = 0.6;
    group.add(hood);
  }
  return { group };
}

const ITEM_LOOK = {
  potion: { kind: 'bottle', liquid: '#ff4a5a' },
  hipotion: { kind: 'bottle', liquid: '#ff9a2a', big: true },
  heal_crystal: { kind: 'crystal', color: '#ff7ab8' },
  teleport_crystal: { kind: 'crystal', color: '#4ab8ff' },
  tame_treat: { kind: 'treat' },
};

export function buildItem(id) {
  const look = ITEM_LOOK[id] || { kind: 'bottle', liquid: '#7aff9a' };
  const group = new THREE.Group();
  if (look.kind === 'treat') {
    const bag = M(new THREE.SphereGeometry(0.2, 16, 12), std('#c8a070', { roughness: 0.9 }));
    bag.scale.set(1, 0.85, 1);
    const tie = M(new THREE.TorusGeometry(0.07, 0.025, 6, 14), std('#ff7ab8'), 0, 0.17, 0);
    tie.rotation.x = Math.PI / 2;
    const top = M(new THREE.ConeGeometry(0.09, 0.12, 10), std('#c8a070', { roughness: 0.9 }), 0, 0.24, 0);
    const heart = M(new THREE.SphereGeometry(0.05, 8, 6), std('#ff5a8a', { emissive: '#801030' }), 0, 0, 0.19);
    group.add(bag, tie, top, heart);
    return { group };
  }
  if (look.kind === 'bottle') {
    const k = look.big ? 1.15 : 1;
    const pts = [[0, 0], [0.16, 0], [0.2, 0.05], [0.21, 0.16], [0.18, 0.26], [0.07, 0.34], [0.065, 0.44], [0.08, 0.46]].map(([x, y]) => new THREE.Vector2(x * k, y * k));
    const glass = new THREE.MeshStandardMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide });
    group.add(M(new THREE.LatheGeometry(pts, 28), glass));
    const lq = pts.slice(0, 5).map((p) => new THREE.Vector2(p.x * 0.9, p.y * 0.95));
    lq.push(new THREE.Vector2(0, lq[lq.length - 1].y));
    group.add(M(new THREE.LatheGeometry(lq, 28), new THREE.MeshStandardMaterial({ color: look.liquid, emissive: new THREE.Color(look.liquid).multiplyScalar(0.35), roughness: 0.2 }), 0, 0.01, 0));
    group.add(M(new THREE.CylinderGeometry(0.06 * k, 0.055 * k, 0.08, 14), std('#a0784a', { roughness: 0.9 }), 0, 0.48 * k, 0));
    group.position.y = -0.22;
  } else {
    const c = M(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: look.color, emissive: new THREE.Color(look.color).multiplyScalar(0.55), roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.9, flatShading: true }));
    c.scale.set(0.75, 1.3, 0.75);
    group.add(c, M(new THREE.SphereGeometry(0.08, 12, 10), glow(look.color, 2.5)));
  }
  return { group };
}

function hashColor(str, s = 0.45, l = 0.55) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return new THREE.Color().setHSL(h / 360, s, l);
}

// Materiais de monstro: o formato vem da palavra-chave do nome (presa, couro, escama, núcleo...).
export function buildMaterial(name) {
  const n = name.toLowerCase(), group = new THREE.Group();
  const col = hashColor(name);
  if (/moedas de col/.test(n)) {
    const gold = std('#e8c050', { metalness: 0.9, roughness: 0.25 });
    for (let i = 0; i < 6; i++) {
      const c = M(new THREE.CylinderGeometry(0.16, 0.16, 0.035, 28), gold, (i % 3 - 1) * 0.12, -0.12 + Math.floor(i / 3) * 0.05 + i * 0.03, (i % 2) * 0.05);
      c.rotation.set(0.25 + i * 0.1, 0, 0.15 * (i % 3 - 1));
      group.add(c);
    }
    const big = M(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 32), gold, 0, 0.12, 0.05);
    big.rotation.x = PI / 2 - 0.3;
    group.add(big, M(new THREE.TorusGeometry(0.15, 0.012, 6, 28), std('#b08a2a', { metalness: 0.9 }), 0, 0.12, 0.075));
    group.children[group.children.length - 1].rotation.x = -0.3;
    return { group };
  }
  if (/carne/.test(n)) {
    const meat = M(new THREE.SphereGeometry(0.2, 18, 14), std('#b04a3a', { roughness: 0.7 }));
    meat.scale.set(1.2, 0.85, 0.9);
    const bone = M(new THREE.CylinderGeometry(0.035, 0.035, 0.35, 10), std('#f0e8d8'), 0.22, 0, 0);
    bone.rotation.z = PI / 2;
    group.add(meat, bone, M(new THREE.SphereGeometry(0.05, 10, 8), std('#f0e8d8'), 0.4, 0.02, 0), M(new THREE.SphereGeometry(0.05, 10, 8), std('#f0e8d8'), 0.4, -0.04, 0));
  } else if (/presa|ferrão|garra|chifre/.test(n)) {
    const g = new THREE.ConeGeometry(0.08, 0.5, 14, 6).translate(0, 0.25, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 0.5; p.setX(i, p.getX(i) + y * y * 0.14); }
    g.computeVertexNormals();
    const fang = M(g, std(/ferrão/.test(n) ? '#2a2a22' : '#ece4d0', { roughness: 0.4 }), 0, -0.22, 0);
    fang.rotation.z = -0.3;
    group.add(fang);
  } else if (/couro|pelagem|pelo|seda/.test(n)) {
    const g = new THREE.PlaneGeometry(0.55, 0.45, 8, 8);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 6) * 0.04 + Math.cos(p.getY(i) * 7) * 0.03);
    g.computeVertexNormals();
    group.add(M(g, std(/seda/.test(n) ? '#f0f0f4' : /gélida/.test(n) ? '#dfe8f0' : /yeti/.test(n) ? '#f4f4f8' : '#8a5a3a', { side: THREE.DoubleSide, roughness: 0.95 })));
  } else if (/escama/.test(n)) {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2, r = i ? 0.15 : 0;
      const sc = M(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 6), std(col, { metalness: 0.5, roughness: 0.3 }), Math.cos(a) * r, Math.sin(a) * r, i * 0.004);
      sc.rotation.x = PI / 2;
      group.add(sc);
    }
  } else if (/osso|galho/.test(n)) {
    const c = /galho/.test(n) ? std('#6a4a2a', { roughness: 0.9 }) : std('#ece4d0');
    const b = M(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 10), c);
    b.rotation.z = 0.8;
    group.add(b);
    if (/osso/.test(n)) for (const s of [-1, 1]) for (const k of [-1, 1]) group.add(M(new THREE.SphereGeometry(0.055, 10, 8), c, s * 0.18 + k * 0.03, -s * 0.15 + k * 0.03, 0));
  } else if (/emblema/.test(n)) {
    const coin = M(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 28), std('#d8b050', { metalness: 0.9, roughness: 0.25 }));
    coin.rotation.x = PI / 2;
    group.add(coin, M(new THREE.TorusGeometry(0.15, 0.015, 6, 28), std('#8a6a20', { metalness: 0.9 }), 0, 0, 0.025));
  } else if (/língua/.test(n)) {
    const t = M(new THREE.CapsuleGeometry(0.08, 0.3, 6, 12), std('#e07a8a', { roughness: 0.3 }));
    t.rotation.z = 1.2;
    group.add(t);
  } else {
    // núcleos, fragmentos, gel, essências, brasas: uma gema/orbe que brilha
    const gem = /gel|ectoplasma/.test(n)
      ? M(new THREE.SphereGeometry(0.2, 20, 16), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.75, roughness: 0.05, emissive: col.clone().multiplyScalar(0.3) }))
      : M(new THREE.DodecahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ color: col, emissive: col.clone().multiplyScalar(/brasa|magma/.test(n) ? 0.9 : 0.35), roughness: 0.15, metalness: 0.3, flatShading: true }));
    group.add(gem);
  }
  return { group };
}
