// Rua do Comércio: lojas com fachada, toldo, placa e vitrine, encostadas na muralha da cidade.
// Armaduras · Runas · Toca dos Mascotes · Taverna · Guilda dos Aventureiros.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toonMat } from './toon.js';
import { buildArmor } from './gear3d.js';
import { buildMonster } from './monsters.js';
import { armorDef, MONSTERS } from './data.js';
import { TOWN_R } from './world.js';

const rbox = (w, h, d, r = 0.08) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.99);
const mats = new Map();
const T = (c, o) => { const k = c + JSON.stringify(o || {}); if (!mats.has(k)) mats.set(k, toonMat(c, o)); return mats.get(k); };
const glowMat = (c, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });

export const SHOPS = {
  armor: { sign: 'ARMADURAS', title: 'Armaduras do Grimm', color: '#3a5a8a', color2: '#e8e0d0', w: 6,
    npc: { name: 'Grimm', title: 'Armadureiro', hair: 'short', hairColor: '#5a3a2a', top: '#5a5a62', apron: '#6a4a2a', beard: true, big: true } },
  rune: { sign: 'RUNAS', title: 'Oficina de Runas da Mira', color: '#5a3a8a', color2: '#e8dcff', w: 5.6,
    npc: { name: 'Mira', title: 'Runista', female: true, hair: 'long', hairColor: '#c8c8f0', top: '#4a3a7a', skirt: '#2a2050', accent: '#b08aff' } },
  pet: { sign: 'TOCA DOS MASCOTES', title: 'Toca dos Mascotes', color: '#d86a8a', color2: '#fff0f4', w: 6,
    npc: { name: 'Kiko', title: 'Tratador de Mascotes', hair: 'spiky', hairColor: '#e0a040', top: '#6a9a4a', pants: '#4a3a2a', accent: '#ff9ac8' } },
  tavern: { sign: 'TAVERNA DO JAVALI', title: 'Taverna do Javali Dourado', color: '#8a4a2a', color2: '#f0d8a8', w: 8,
    npc: { name: 'Gorm', title: 'Taverneiro', hair: 'bald', top: '#8a6a4a', apron: '#f0e8d8', beard: true, big: true } },
  guild: { sign: 'GUILDA DOS AVENTUREIROS', title: 'Guilda dos Aventureiros', color: '#a02a2a', color2: '#f4e8c8', w: 7.4,
    npc: { name: 'Elena', title: 'Recepcionista da Guilda', female: true, hair: 'ponytail', hairColor: '#3a2a1a', top: '#f4f0e8', skirt: '#8a2a2a', accent: '#d8b050' } },
};

function signTexture(text, bg, fg) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg; g.lineWidth = 8;
  g.strokeRect(10, 10, 492, 108);
  g.fillStyle = fg;
  let size = 64;
  g.font = `800 ${size}px "Exo 2", sans-serif`;
  while (g.measureText(text).width > 450 && size > 20) { size -= 2; g.font = `800 ${size}px "Exo 2", sans-serif`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Ponto está dentro de algum obstáculo já colocado (casas, torres, palácio)?
function blocked(world, x, z, pad) {
  for (const c of world.grid.query(x, z, pad + 6, [])) {
    if (c.hw === undefined) { if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true; continue; }
    const cs = Math.cos(c.rot), sn = Math.sin(c.rot), dx = x - c.x, dz = z - c.z;
    const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
    if (Math.abs(lx) < c.hw + pad && Math.abs(lz) < c.hd + pad) return true;
  }
  return false;
}

export function buildShops(world) {
  const R = TOWN_R - 4.4, H = world.townH, spokes = world.spokes.map((s) => Math.atan2(s.dz, s.dx));
  const onRoad = (a, half) => spokes.some((sa) => Math.abs(Math.atan2(Math.sin(a - sa), Math.cos(a - sa))) * R < half);
  const root = new THREE.Group();
  world.shopSpots = {};
  const keys = Object.keys(SHOPS);
  // procura lugares livres ao longo da muralha, espalhados entre as quatro estradas
  const base = world.arenaDir + Math.PI / 4;
  const cand = [];
  for (let i = 0; i < 72; i++) cand.push(base + (i / 72) * Math.PI * 2);
  const used = [];
  let ci = 0;
  for (const key of keys) {
    const spec = SHOPS[key];
    let placed = false;
    for (let tries = 0; tries < cand.length && !placed; tries++) {
      const a = cand[(ci + tries * 7) % cand.length];
      const half = spec.w / 2 + 3.5;
      if (onRoad(a, half)) continue;
      if (used.some((u) => Math.abs(Math.atan2(Math.sin(a - u), Math.cos(a - u))) * R < spec.w + 2.5)) continue;
      const x = Math.cos(a) * R, z = Math.sin(a) * R, rot = Math.atan2(-Math.cos(a), -Math.sin(a));
      const fx = Math.cos(rot), fz = -Math.sin(rot), ox = -Math.sin(rot), oz = -Math.cos(rot);
      const pts = [[0, 0], [-spec.w / 2, -1.4], [spec.w / 2, -1.4], [-spec.w / 2, 1.4], [spec.w / 2, 1.4], [-spec.w / 2 - 0.6, 3.2], [0, 3.2], [spec.w / 2 + 0.6, 3.2]];
      if (pts.some(([lx, lz]) => blocked(world, x + fx * lx - ox * lz, z + fz * lx - oz * lz, 0.4))) continue;
      used.push(a);
      ci = (ci + tries * 7 + 13) % cand.length;
      buildFront(world, root, key, spec, x, z, rot);
      placed = true;
    }
  }
  world.mergeStatic(root);
}

function buildFront(world, root, key, spec, x, z, rot) {
  const H = world.townH, w = spec.w, d = 3.2, h = 4.2;
  const g = new THREE.Group();
  g.position.set(x, H, z);
  g.rotation.y = rot;
  const stone = world.stoneMat || T('#e8dcc4');
  const wood = T('#7a5232'), dark = T('#4a3424'), c1 = T(spec.color), c2 = T(spec.color2);
  const add = (geo, mat, px, py, pz, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  // paredes (fundo e laterais) e telhado inclinado
  add(rbox(w, h, 0.4), stone, 0, h / 2, -d / 2);
  for (const s of [-1, 1]) add(rbox(0.4, h, d), stone, s * (w / 2 - 0.2), h / 2, 0);
  const roof = add(rbox(w + 0.8, 0.22, d + 1.2), T(world.slateMat ? '#4e5a6c' : '#b8482e'), 0, h + 0.55, -0.1);
  roof.rotation.x = -0.3;
  if (world.slateMat) roof.material = world.slateMat;
  // fachada: viga com a placa, colunas de madeira, piso de tábuas e um lampião aceso lá dentro
  add(rbox(w + 0.2, 1.25, 0.3), wood, 0, h - 0.1, d / 2 - 0.05);
  for (const s of [-1, 1]) add(rbox(0.3, h - 0.6, 0.3), dark, s * (w / 2 - 0.05), (h - 0.6) / 2, d / 2 - 0.05);
  add(rbox(w - 0.6, 0.06, d - 0.4, 0.02), T('#8a6a48'), 0, 0.04, 0);
  const lan = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: '#3a3020', emissive: '#ffc070', emissiveIntensity: 1.4 }));
  lan.position.set(-w / 2 + 0.9, h - 0.95, 0.2);
  g.add(lan);
  // toldo listrado na frente
  for (let i = 0; i < Math.round(w / 0.6); i++) {
    const sl = add(rbox(0.6, 0.06, 1.3, 0.02), i % 2 ? c2 : c1, -w / 2 + 0.3 + i * 0.6, h - 0.95, d / 2 + 0.75);
    sl.rotation.x = 0.36;
  }
  add(rbox(w + 0.1, 0.12, 0.14, 0.03), c1, 0, h - 1.2, d / 2 + 1.38);
  // balcão
  add(rbox(w - 1.2, 1.05, 0.7), wood, 0, 0.52, d / 2 - 0.25);
  add(rbox(w - 1.0, 0.08, 0.86, 0.03), dark, 0, 1.08, d / 2 - 0.25);
  // prateleiras no fundo
  for (const y of [1.3, 2.2]) add(rbox(w - 1.2, 0.07, 0.42, 0.02), wood, 0, y, -d / 2 + 0.42);
  // placa com o nome
  const sm = new THREE.MeshBasicMaterial({ map: signTexture(spec.sign, spec.color2, spec.color) });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 0.4, 4.6), 1.1), sm);
  sign.position.set(0, h - 0.1, d / 2 + 0.17);
  g.add(sign);
  // vitrine de cada loja
  goods[key]?.(add, g, spec, w, d);
  root.add(g);
  g.updateMatrixWorld(true);
  const toW = (lx, lz) => new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).add(new THREE.Vector3(x, H, z));
  // colisão: fundo, laterais e balcão (o vendedor fica protegido atrás do balcão)
  const box = (lx, lz, hw, hd) => { const p = toW(lx, lz); world.grid.add({ x: p.x, z: p.z, hw, hd, rot }); };
  box(0, -d / 2, w / 2, 0.3);
  box(-(w / 2 - 0.2), 0, 0.3, d / 2);
  box(w / 2 - 0.2, 0, 0.3, d / 2);
  box(0, d / 2 - 0.25, (w - 1.2) / 2, 0.4);
  const spot = toW(0, 0.05);
  world.shopSpots[key] = { pos: spot, yaw: rot + Math.PI, front: toW(0, d / 2 + 1.6), title: spec.title };
  world.labels.push({ text: spec.title, pos: toW(0, d / 2 + 0.2).setY(H + h + 1.1), cls: 'npc' });
}

// ─────────── Mercadorias de cada loja ───────────
const goods = {
  armor(add, g, spec, w, d) {
    // dois manequins com armaduras de verdade (os mesmos modelos dos ícones)
    for (const [s, id] of [[-1, 'harm_3'], [1, 'larm_2']]) {
      const a = buildArmor(armorDef(id)).group;
      a.scale.setScalar(1.15);
      a.position.set(s * (w / 2 + 0.55), 1.55, d / 2 + 0.6);
      g.add(a);
      add(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), T('#4a3424'), s * (w / 2 + 0.55), 0.55, d / 2 + 0.6);
      add(new THREE.CylinderGeometry(0.35, 0.4, 0.08, 16), T('#4a3424'), s * (w / 2 + 0.55), 0.04, d / 2 + 0.6);
    }
    // escudos pendurados na parede
    const cols = ['#a03a3a', '#3a6aa8', '#c8a050'];
    cols.forEach((c, i) => {
      const sh = add(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 20), T(c), -1.6 + i * 1.6, 3.1, -d / 2 + 0.26);
      sh.rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), T('#d8c070'), -1.6 + i * 1.6, 3.1, -d / 2 + 0.3).rotation.x = Math.PI / 2;
    });
    for (let i = 0; i < 4; i++) add(rbox(0.5, 0.4, 0.3), T(i % 2 ? '#8a8e96' : '#6a4a2a'), -1.5 + i, 1.55, -d / 2 + 0.42);
  },
  rune(add, g, spec, w, d) {
    const cols = ['#ff6a3a', '#5aff8a', '#9ae8ff', '#ffd84a', '#d0304a', '#b08aff', '#f0c040', '#b8a88a'];
    cols.forEach((c, i) => {
      const r = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), glowMat(c, 1.6));
      r.position.set(-1.7 + (i % 4) * 1.1, i < 4 ? 1.55 : 2.45, -1.1);
      r.scale.y = 1.4;
      g.add(r);
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14), new THREE.MeshStandardMaterial({ color: '#b8a0ff', emissive: '#6a4aff', emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }));
    ball.position.set(0.9, 1.42, d / 2 - 0.25);
    g.add(ball);
    add(new THREE.CylinderGeometry(0.14, 0.2, 0.18, 12), T('#3a2a4a'), 0.9, 1.18, d / 2 - 0.25);
    // círculo rúnico no chão em frente
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.12, 40).rotateX(-Math.PI / 2), glowMat('#b08aff', 1.2));
    ring.position.set(0, 0.06, d / 2 + 1.4);
    g.add(ring);
    for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 8), T('#f0e8d0'), -1.2 + i * 0.7, 1.3, d / 2 - 0.2);
  },
  pet(add, g, spec, w, d) {
    // filhotes em miniatura: um lobo e um slime brincando na frente da loja
    for (const [mon, px, ry, s] of [['wolf', -w / 2 - 0.7, 0.6, 0.42], ['slime', w / 2 + 0.6, -0.4, 0.45], ['drake', 1.3, 0.2, 0.3]]) {
      const m = buildMonster(MONSTERS[mon], false).group;
      m.scale.setScalar(s);
      m.position.set(px, mon === 'drake' ? 1.15 : 0, mon === 'drake' ? d / 2 - 0.25 : d / 2 + 0.9);
      m.rotation.y = ry;
      g.add(m);
    }
    // gaiolas e casinha de cachorro
    for (const s of [-1.6, -0.6]) {
      add(rbox(0.7, 0.6, 0.5), T('#c8a070'), s, 1.42, -d / 2 + 0.45);
      for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 5), T('#8a8a94'), s - 0.3 + i * 0.15, 1.42, -d / 2 + 0.72);
    }
    add(rbox(1.0, 0.8, 0.9), T('#d86a8a'), w / 2 + 0.2, 0.4, d / 2 + 2.0);
    const rf = add(new THREE.ConeGeometry(0.85, 0.5, 4).rotateY(Math.PI / 4), T('#8a4a5a'), w / 2 + 0.2, 1.05, d / 2 + 2.0);
    rf.scale.z = 0.9;
    // ossos e petiscos sobre o balcão
    for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(0.11, 10, 8), T(i % 2 ? '#c8a070' : '#ff9ac8'), -1.4 + i * 0.5, 1.2, d / 2 - 0.25);
  },
  tavern(add, g, spec, w, d) {
    // barris, canecas, mesas e banquinhos na calçada
    for (let i = 0; i < 3; i++) {
      const b = add(new THREE.CylinderGeometry(0.42, 0.42, 0.9, 16), T('#6a4428'), -w / 2 + 1.2 + i * 0.95, 0.45, -d / 2 + 0.7);
      add(new THREE.TorusGeometry(0.43, 0.025, 6, 20), T('#3a3a3a'), b.position.x, 0.2, b.position.z).rotation.x = Math.PI / 2;
      add(new THREE.TorusGeometry(0.43, 0.025, 6, 20), T('#3a3a3a'), b.position.x, 0.7, b.position.z).rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 5; i++) {
      add(new THREE.CylinderGeometry(0.07, 0.06, 0.16, 10), T('#c8a060'), -1.8 + i * 0.9, 1.2, d / 2 - 0.25);
      add(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10), T('#fff4dc'), -1.8 + i * 0.9, 1.29, d / 2 - 0.25);
    }
    for (const s of [-1, 1]) {
      const tx = s * 2.3, tz = d / 2 + 2.6;
      add(new THREE.CylinderGeometry(0.6, 0.6, 0.07, 18), T('#8a5a36'), tx, 0.78, tz);
      add(new THREE.CylinderGeometry(0.07, 0.1, 0.76, 8), T('#4a3424'), tx, 0.38, tz);
      for (const a of [0, 2.1, 4.2]) add(new THREE.CylinderGeometry(0.2, 0.2, 0.46, 10), T('#6a4428'), tx + Math.cos(a) * 0.95, 0.23, tz + Math.sin(a) * 0.95);
      add(new THREE.CylinderGeometry(0.07, 0.06, 0.16, 10), T('#c8a060'), tx + 0.15, 0.89, tz);
    }
    // lampião
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: '#3a3020', emissive: '#ffb050', emissiveIntensity: 1.6 }));
    lamp.position.set(w / 2 - 0.6, 3.0, d / 2 + 0.3);
    g.add(lamp);
    // placa em forma de javali dourado
    add(new THREE.SphereGeometry(0.35, 14, 10), T('#e0b040'), -w / 2 + 0.2, 3.3, d / 2 + 0.5).scale.set(1.4, 0.9, 0.4);
  },
  guild(add, g, spec, w, d) {
    // estandartes, quadro de contratos e brasão
    for (const s of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.06, 0.07, 5.6, 8), T('#4a3424'), s * (w / 2 + 0.5), 2.8, d / 2 + 0.6);
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.4), T(spec.color, { side: THREE.DoubleSide }));
      ban.position.set(s * (w / 2 + 0.5) - s * 0.5, 4.0, d / 2 + 0.6);
      g.add(ban);
      add(new THREE.CircleGeometry(0.3, 16), T('#e0c060', { side: THREE.DoubleSide }), s * (w / 2 + 0.5) - s * 0.5, 4.2, d / 2 + 0.62);
    }
    add(rbox(2.6, 1.5, 0.1), T('#8a5a36'), -1.2, 2.4, -d / 2 + 0.26);
    const pc = ['#f4f0e0', '#fff8d0', '#f0e8f8', '#e8f4f0'];
    for (let i = 0; i < 6; i++) add(new THREE.PlaneGeometry(0.5, 0.6), T(pc[i % 4], { side: THREE.DoubleSide }), -2.0 + (i % 3) * 0.8, i < 3 ? 2.7 : 2.0, -d / 2 + 0.33);
    const crest = add(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 6), T('#d8b050'), 1.6, 2.5, -d / 2 + 0.28);
    crest.rotation.x = Math.PI / 2;
    const sw = add(rbox(0.1, 1.2, 0.05), T('#d8dde4'), 1.6, 2.5, -d / 2 + 0.36);
    sw.rotation.z = 0.7;
    const sw2 = add(rbox(0.1, 1.2, 0.05), T('#d8dde4'), 1.6, 2.5, -d / 2 + 0.37);
    sw2.rotation.z = -0.7;
  },
};
