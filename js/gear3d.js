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

// Machado, maça e cajado: haste na origem, cabeça apontando para +Y (como as espadas).
function buildHafted(def) {
  const t = def.type, group = new THREE.Group();
  const color = new THREE.Color(def.blade || '#c8d0d8');
  const bladeMat = new THREE.MeshStandardMaterial({ color, metalness: t === 'staff' ? 0.1 : 0.75, roughness: t === 'staff' ? 0.2 : 0.22 });
  if (t === 'staff' || def.rarity === 2) bladeMat.emissive = color.clone().multiplyScalar(t === 'staff' ? 0.9 : 0.12);
  bladeMat.userData.baseEmissive = bladeMat.emissive.clone();
  const wood = std(def.grip || '#5a3a20', { metalness: 0, roughness: 0.8 });
  const trim = std(def.guard || '#7a7a82', { metalness: 0.8, roughness: 0.3 });
  let tipY = 1, baseY = 0.5;
  if (t === 'axe') {
    group.add(M(new THREE.CylinderGeometry(0.02, 0.024, 1.25, 12), wood, 0, 0.4, 0));
    const s = new THREE.Shape();
    s.moveTo(0, 0.07); s.quadraticCurveTo(0.12, 0.1, 0.22, 0.2); s.quadraticCurveTo(0.3, 0, 0.22, -0.2); s.quadraticCurveTo(0.12, -0.1, 0, -0.07); s.closePath();
    const hg = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 10 });
    hg.translate(0.02, 0, -0.006);
    for (const side of [1, -1]) { const h = M(hg, bladeMat, 0, 0.88, 0); if (side < 0) h.rotation.y = PI; group.add(h); }
    group.add(M(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 12), trim, 0, 0.88, 0), M(new THREE.ConeGeometry(0.03, 0.1, 8), trim, 0, 1.06, 0));
    tipY = 1.1; baseY = 0.7;
  } else if (t === 'mace') {
    group.add(M(new THREE.CylinderGeometry(0.019, 0.022, 0.72, 12), wood, 0, 0.2, 0));
    group.add(M(new THREE.SphereGeometry(0.085, 16, 12), bladeMat, 0, 0.64, 0));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2, sp = M(new THREE.ConeGeometry(0.022, 0.07, 6), trim, Math.cos(a) * 0.085, 0.64 + (i % 2 ? 0.035 : -0.035), Math.sin(a) * 0.085);
      sp.lookAt(sp.position.clone().multiplyScalar(2).setY(sp.position.y));
      sp.rotateX(PI / 2);
      group.add(sp);
    }
    group.add(M(new THREE.ConeGeometry(0.025, 0.08, 8), trim, 0, 0.75, 0), M(new THREE.TorusGeometry(0.03, 0.008, 6, 14).rotateX(PI / 2), trim, 0, 0.55, 0));
    tipY = 0.76; baseY = 0.45;
  } else {
    // cajado: haste longa, garras douradas segurando uma esfera brilhante
    group.add(M(new THREE.CylinderGeometry(0.018, 0.026, 1.55, 10), wood, 0, 0.35, 0));
    group.add(M(new THREE.SphereGeometry(0.06, 16, 12), bladeMat, 0, 1.22, 0));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2, c = M(new THREE.CapsuleGeometry(0.009, 0.1, 4, 8), trim, Math.cos(a) * 0.05, 1.18, Math.sin(a) * 0.05);
      c.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
      group.add(c);
    }
    group.add(M(new THREE.TorusGeometry(0.03, 0.009, 6, 14).rotateX(PI / 2), trim, 0, 1.1, 0));
    tipY = 1.28; baseY = 0.9;
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group, bladeMat, tipY, baseY };
}

// Escudo do Guardião (mão esquerda): face voltada para +Z
export function buildShield(def) {
  const group = new THREE.Group();
  const color = new THREE.Color(def.blade || '#b8bcc4');
  const bladeMat = new THREE.MeshStandardMaterial({ color: def.guard || '#7a6a50', metalness: 0.3, roughness: 0.5 });
  bladeMat.userData.baseEmissive = bladeMat.emissive.clone();
  const rimMat = new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.25 });
  const s = new THREE.Shape();
  s.moveTo(0, 0.2); s.quadraticCurveTo(0.17, 0.2, 0.17, 0.08); s.quadraticCurveTo(0.17, -0.12, 0, -0.24); s.quadraticCurveTo(-0.17, -0.12, -0.17, 0.08); s.quadraticCurveTo(-0.17, 0.2, 0, 0.2);
  const face = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.014, bevelSegments: 2, curveSegments: 12 });
  face.translate(0, 0, -0.01);
  group.add(M(face, bladeMat));
  const rim = M(new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: false, curveSegments: 12 }), rimMat, 0, 0, 0.012);
  rim.scale.set(0.55, 0.55, 1);
  group.add(rim, M(new THREE.SphereGeometry(0.035, 12, 10), rimMat, 0, 0.02, 0.03));
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group, bladeMat, tipY: 0.2, baseY: -0.1 };
}

export function buildSword(def) {
  if (def.type === 'axe' || def.type === 'mace' || def.type === 'staff') return buildHafted(def);
  const style = def.type === 'dagger' ? 'dagger' : def.style || 'long';
  const group = new THREE.Group();
  const bladeColor = new THREE.Color(def.blade || '#c8d0d8');
  const bladeMat = new THREE.MeshStandardMaterial({ color: bladeColor, metalness: 0.75, roughness: 0.18 });
  const guardMat = std(def.guard || '#7a7a82', { metalness: 0.8, roughness: 0.3 });
  const gripMat = std(def.grip || '#3a2a20', { metalness: 0, roughness: 0.85 });
  const wrapMat = std(new THREE.Color(def.grip || '#3a2a20').multiplyScalar(0.6), { metalness: 0, roughness: 0.9 });
  let L = 1.0, w = 0.028, t = 0.009, gripLen = 0.22, guardW = 0.2, opts = {};
  switch (style) {
    case 'basic': L = 0.82; w = 0.025; guardW = 0.15; gripLen = 0.18; break;
    case 'dagger': L = 0.46; w = 0.03; t = 0.01; guardW = 0.13; gripLen = 0.15; opts = { tip: 0.28, taper: 0.8 }; break;
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

// ─────────── Armaduras (ícones, manequins e loja) ───────────
// Peitoral curvo com faixas no abdômen, gola, ombreiras em camadas, saiote e frisos — como as armaduras de cavaleiro do anime.
const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
function plateShell(y0, y1, r0, r1, bulge = 0, front = true, seg = 28) {
  // casca de placa (meia volta na frente ou volta inteira)
  const pts = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector2(r0 + (r1 - r0) * t + Math.sin(t * PI) * bulge, y0 + (y1 - y0) * t)); }
  return new THREE.LatheGeometry(pts, seg, front ? -PI * 0.5 : 0, front ? PI : PI * 2);
}
export function pauldron(mat, trim, s, big = 1) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const plate = M(new THREE.SphereGeometry(0.17 * big - k * 0.02, 18, 10, 0, PI * 2, 0, PI * 0.42), mat, 0, -k * 0.07, 0);
    plate.scale.set(1.25, 0.75, 1.05);
    plate.rotation.z = s * (0.35 + k * 0.12);
    const edge = M(new THREE.TorusGeometry((0.17 * big - k * 0.02) * Math.sin(PI * 0.42), 0.012, 6, 24), trim, 0, -k * 0.07 + (0.17 * big - k * 0.02) * Math.cos(PI * 0.42) * 0.75, 0);
    edge.rotation.set(PI / 2, s * (0.35 + k * 0.12), 0);
    edge.scale.set(1.25, 1.05, 1);
    g.add(plate, edge);
  }
  return g;
}
export function buildArmor(def) {
  const group = new THREE.Group(), t = def.type;
  const metal = t === 'plate' || t === 'mail';
  const main = std(def.color, { metalness: metal ? 0.85 : 0.05, roughness: metal ? 0.25 : 0.8 });
  const trim = std(def.trim, { metalness: 0.9, roughness: 0.25 });
  const cloth = std(t === 'plate' ? def.trim : def.color, { metalness: 0, roughness: 0.85, side: THREE.DoubleSide });
  const leather = std(new THREE.Color(def.color).multiplyScalar(0.7), { metalness: 0, roughness: 0.75 });
  // corpo base (camisa por baixo)
  const body = M(lathe([[0.0, -0.32], [0.24, -0.3], [0.22, -0.12], [0.27, 0.12], [0.3, 0.3], [0.22, 0.42], [0.1, 0.47], [0, 0.48]]), t === 'plate' ? std(new THREE.Color(def.trim).multiplyScalar(0.5), { roughness: 0.8 }) : main);
  body.scale.z = 0.7;
  group.add(body);
  if (t === 'plate' || t === 'mail') {
    // peitoral curvo (frente) e costas
    const chest = M(plateShell(-0.05, 0.42, 0.27, 0.2, 0.06), main);
    chest.scale.set(1.08, 1, 0.78);
    const back = M(plateShell(-0.05, 0.42, 0.26, 0.2, 0.03), main);
    back.rotation.y = PI;
    back.scale.set(1.06, 1, 0.74);
    group.add(chest, back);
    // friso do peitoral e emblema
    const neckRim = M(new THREE.TorusGeometry(0.16, 0.02, 8, 26, PI), trim, 0, 0.42, 0.02);
    neckRim.rotation.set(PI / 2, 0, PI);
    neckRim.scale.set(1.2, 0.8, 1);
    group.add(neckRim);
    for (const s2 of [-1, 1]) { const l = M(new THREE.BoxGeometry(0.018, 0.4, 0.02), trim, s2 * 0.18, 0.18, 0.205); l.rotation.z = s2 * 0.2; group.add(l); }
    const em = M(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 6), trim, 0, 0.22, 0.225);
    em.rotation.x = PI / 2;
    group.add(em, M(new THREE.OctahedronGeometry(0.035, 0), glow(def.trim === '#c0262c' ? '#ff4a4a' : '#8ad0ff', 1.4), 0, 0.22, 0.24));
    if (def.trim === '#c0262c') group.add(M(new THREE.BoxGeometry(0.035, 0.16, 0.02), trim, 0, 0.12, 0.235), M(new THREE.BoxGeometry(0.11, 0.035, 0.02), trim, 0, 0.15, 0.235));
    // faixas do abdômen (lames)
    for (let k = 0; k < 3; k++) {
      const lame = M(plateShell(-0.06 - k * 0.075, -0.0 - k * 0.075, 0.245 - k * 0.006, 0.255 - k * 0.006, 0.0, false, 28), main);
      lame.scale.z = 0.72;
      lame.position.y = -0.02;
      const er = M(new THREE.TorusGeometry(0.25 - k * 0.006, 0.008, 6, 30), trim, 0, -0.08 - k * 0.075, 0);
      er.rotation.x = PI / 2;
      er.scale.set(1, 0.72, 1);
      group.add(lame, er);
    }
    // saiote (tassets) na frente e dos lados
    for (const a of [-0.9, -0.3, 0.3, 0.9]) {
      const ts = M(new THREE.BoxGeometry(0.16, 0.22, 0.02), main, Math.sin(a) * 0.25, -0.38, Math.cos(a) * 0.18);
      ts.rotation.set(-0.12, a, 0);
      const tt = M(new THREE.BoxGeometry(0.17, 0.02, 0.025), trim, Math.sin(a) * 0.25, -0.48, Math.cos(a) * 0.185);
      tt.rotation.y = a;
      group.add(ts, tt);
    }
    // ombreiras em camadas
    for (const s2 of [-1, 1]) { const pd = pauldron(main, trim, s2, 1.05); pd.position.set(s2 * 0.34, 0.38, 0); group.add(pd); }
    if (t === 'mail') {
      const rm = std(new THREE.Color(def.color).multiplyScalar(0.75), { metalness: 0.8, roughness: 0.45 });
      for (let y = -0.28; y < -0.05; y += 0.045) { const r = M(new THREE.TorusGeometry(0.255, 0.01, 5, 32), rm, 0, y, 0); r.rotation.x = PI / 2; r.scale.y = 0.72; group.add(r); }
    }
    // cinto
    const belt = M(new THREE.CylinderGeometry(0.262, 0.262, 0.05, 28), leather, 0, -0.29, 0);
    belt.scale.z = 0.74;
    group.add(belt, M(new THREE.BoxGeometry(0.08, 0.07, 0.03), trim, 0, -0.29, 0.2));
  } else {
    // couro / sobretudo / manto: gola, faixas cruzadas com fivelas, barra comprida
    const collar = M(new THREE.CylinderGeometry(0.17, 0.25, 0.18, 22, 1, true, PI + 0.55, PI * 2 - 1.1), cloth, 0, 0.47, 0);
    group.add(collar);
    for (const s2 of [-1, 1]) {
      const strap = M(new THREE.BoxGeometry(0.05, 0.7, 0.015), leather, s2 * 0.05, 0.08, 0.205);
      strap.rotation.z = s2 * 0.62;
      group.add(strap, M(new THREE.BoxGeometry(0.045, 0.045, 0.02), trim, s2 * 0.11, 0.17, 0.215));
      const sh = M(new THREE.SphereGeometry(0.13, 14, 10, 0, PI * 2, 0, PI * 0.45), leather, s2 * 0.32, 0.36, 0);
      sh.scale.set(1.3, 0.7, 1);
      sh.rotation.z = s2 * 0.4;
      group.add(sh);
    }
    const belt = M(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 26), leather, 0, -0.27, 0);
    belt.scale.z = 0.72;
    group.add(belt, M(new THREE.BoxGeometry(0.08, 0.07, 0.03), trim, 0, -0.27, 0.19), M(new THREE.BoxGeometry(0.1, 0.12, 0.06), leather, 0.17, -0.34, 0.12));
    if (t === 'coat' || t === 'cloak') {
      // barra longa aberta na frente, com friso
      const tail = M(new THREE.CylinderGeometry(0.26, 0.48, 0.95, 28, 1, true, PI + 0.42, PI * 2 - 0.84), cloth, 0, -0.75, 0);
      tail.scale.z = 0.72;
      group.add(tail);
      const hem = M(new THREE.TorusGeometry(0.48, 0.012, 6, 40, PI * 2 - 0.84), trim, 0, -1.22, 0);
      hem.rotation.set(PI / 2, 0, PI / 2 + 0.42);
      hem.scale.set(1, 0.72, 1);
      group.add(hem);
      for (const s2 of [-1, 1]) group.add(M(new THREE.BoxGeometry(0.014, 1.15, 0.014), trim, s2 * 0.13, -0.42, 0.2));
    }
    if (t === 'cloak') {
      const hood = M(new THREE.SphereGeometry(0.2, 16, 12, 0, PI * 2, 0, PI * 0.55), cloth, 0, 0.56, 0.1);
      hood.rotation.x = 0.7;
      group.add(hood);
    }
  }
  return { group };
}

const ITEM_LOOK = {
  potion: { kind: 'bottle', liquid: '#ff4a5a' },
  hipotion: { kind: 'bottle', liquid: '#ff9a2a', big: true },
  heal_crystal: { kind: 'crystal', color: '#ff7ab8' },
  teleport_crystal: { kind: 'crystal', color: '#4ab8ff' },
  tame_treat: { kind: 'treat' },
  fishing_rod: { kind: 'rod' },
  grilled_fish: { kind: 'grilled' },
  pet_snack: { kind: 'treat' },
  elixir_str: { kind: 'bottle', liquid: '#ff5a3a', big: true },
  elixir_agi: { kind: 'bottle', liquid: '#5ae0ff', big: true },
  elixir_vit: { kind: 'bottle', liquid: '#5aff7a', big: true },
  cristalite: { kind: 'ingot' },
  treasure_map: { kind: 'scroll' },
  mystery_box: { kind: 'box' },
};
// pratos da culinária usam os modelos de comida
const DISH_LOOK = { skewer: 'skewer', mushsoup: 'stew', herbfish: 'grilled', honeybread: 'bread', fruitpie: 'pie', feast: 'feast', herbtea: 'tea', juice: 'juice', strongmead: 'mead' };

function fishMesh(color) {
  const g = new THREE.Group();
  const body = M(new THREE.SphereGeometry(0.12, 16, 12), std(color, { metalness: 0.4, roughness: 0.3 }));
  body.scale.set(1.9, 0.8, 0.6);
  const tail = M(new THREE.ConeGeometry(0.09, 0.14, 4), std(color, { metalness: 0.4 }), -0.27, 0, 0);
  tail.rotation.z = Math.PI / 2;
  tail.scale.z = 0.25;
  const eye = M(new THREE.SphereGeometry(0.018, 6, 5), std('#111111'), 0.15, 0.03, 0.06);
  g.add(body, tail, eye);
  return g;
}

export function buildItem(id) {
  if (id.startsWith('dish_')) {
    const k = DISH_LOOK[id.slice(5)];
    if (k === 'grilled') return buildItem('grilled_fish');
    if (k === 'skewer') {
      const group = new THREE.Group();
      const stick = M(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), std('#c8a070'));
      stick.rotation.z = 0.6;
      group.add(stick);
      for (let i = 0; i < 4; i++) { const m = M(new THREE.SphereGeometry(0.09, 12, 10), std(i % 2 ? '#8a4a2a' : '#5a9a3a'), -0.2 + i * 0.13, 0.13 - i * 0.09, 0); m.scale.set(1, 0.85, 1); group.add(m); }
      return { group };
    }
    if (k === 'juice') {
      const group = new THREE.Group();
      group.add(M(new THREE.CylinderGeometry(0.15, 0.12, 0.42, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide })));
      group.add(M(new THREE.CylinderGeometry(0.135, 0.11, 0.34, 16), std('#e04a6a', { emissive: '#401020' }), 0, -0.03, 0));
      const straw = M(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), std('#ffffff'), 0.05, 0.2, 0);
      straw.rotation.z = -0.25;
      group.add(straw);
      return { group };
    }
    return buildFood(k);
  }
  const look = ITEM_LOOK[id] || { kind: 'bottle', liquid: '#7aff9a' };
  const group = new THREE.Group();
  if (look.kind === 'ingot') {
    const g = new THREE.CylinderGeometry(0.2, 0.26, 0.16, 4).rotateY(Math.PI / 4);
    g.scale(1.6, 1, 0.8);
    group.add(M(g, new THREE.MeshStandardMaterial({ color: '#9ae8ff', emissive: '#2a6a8a', metalness: 0.7, roughness: 0.15 })));
    return { group };
  }
  if (look.kind === 'scroll') {
    const paper = M(new THREE.PlaneGeometry(0.5, 0.4), std('#e8d8a8', { side: THREE.DoubleSide }));
    paper.rotation.x = -0.4;
    for (const y of [-0.2, 0.2]) { const r = M(new THREE.CylinderGeometry(0.04, 0.04, 0.56, 10), std('#8a5a32'), 0, y * Math.cos(0.4), -y * Math.sin(0.4)); r.rotation.z = Math.PI / 2; group.add(r); }
    const x = M(new THREE.PlaneGeometry(0.08, 0.08), std('#c0262c', { side: THREE.DoubleSide }), 0.1, 0.02, 0.01);
    x.rotation.x = -0.4;
    group.add(paper, x);
    return { group };
  }
  if (look.kind === 'box') {
    group.add(M(new THREE.BoxGeometry(0.42, 0.36, 0.42), std('#6a3a8a')), M(new THREE.BoxGeometry(0.46, 0.08, 0.46), std('#f0c040'), 0, 0.2, 0));
    group.add(M(new THREE.BoxGeometry(0.08, 0.37, 0.43), std('#f0c040')), M(new THREE.SphereGeometry(0.07, 10, 8), glow('#ffe08a', 2), 0, 0.27, 0));
    return { group };
  }
  if (look.kind === 'rod') {
    const r = M(new THREE.CylinderGeometry(0.012, 0.03, 0.9, 8), std('#7a5232'));
    r.rotation.z = -0.8;
    const reel = M(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 14), std('#8a8a94', { metalness: 0.8 }), 0.1, -0.12, 0.03);
    reel.rotation.x = Math.PI / 2;
    group.add(r, reel);
    return { group };
  }
  if (look.kind === 'grilled') {
    const plate = M(new THREE.CylinderGeometry(0.3, 0.26, 0.04, 24), std('#f4f0e8'));
    const fish = fishMesh('#c8803a');
    fish.position.y = 0.08;
    fish.scale.setScalar(0.9);
    group.add(plate, fish);
    for (let i = 0; i < 3; i++) group.add(M(new THREE.SphereGeometry(0.025, 6, 5), std('#4a9a3a'), -0.1 + i * 0.1, 0.13, 0.05));
    return { group };
  }
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
  if (/peixe|truta|carpa/.test(n)) {
    const c = /dourada/.test(n) ? '#f0c040' : /azul/.test(n) ? '#4a8ad8' : /lua/.test(n) ? '#c8c8f0' : /listrada/.test(n) ? '#c87a4a' : '#b8c4d0';
    group.add(fishMesh(c));
    return { group };
  }
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

// Peças: elmo, luvas, calça, botas, capa, anel e amuleto (ícones)
export function buildPiece(d) {
  const group = new THREE.Group(), main = std(d.color, { metalness: 0.75, roughness: 0.3 }), trim = std(d.trim, { metalness: 0.9, roughness: 0.25 });
  const gemM = glow(d.gem, 1.6), soft = std(new THREE.Color(d.color).multiplyScalar(0.55), { metalness: 0, roughness: 0.8 });
  const gem = M(new THREE.OctahedronGeometry(0.06, 0), gemM);
  if (d.slot === 'head') {
    // elmo: cúpula, aba da testa, protetores de bochecha e crista (ou asas se for raro)
    const dome = M(new THREE.SphereGeometry(0.26, 24, 14, 0, PI * 2, 0, PI * 0.58), main);
    dome.scale.set(1, 1.05, 1.08);
    const brow = M(new THREE.TorusGeometry(0.255, 0.03, 8, 30, PI * 1.1), trim, 0, 0.04, 0);
    brow.rotation.set(PI / 2, 0, PI * 0.45 + PI);
    group.add(dome, brow);
    for (const s2 of [-1, 1]) {
      const cheek = M(new THREE.SphereGeometry(0.14, 12, 10, 0, PI, 0, PI * 0.6), main, s2 * 0.2, -0.06, 0.05);
      cheek.rotation.set(PI / 2 + 0.2, s2 * 0.9, 0);
      cheek.scale.set(0.6, 1, 1.3);
      group.add(cheek);
      if (d.rarity === 2) { const wing = M(new THREE.ConeGeometry(0.05, 0.3, 4), trim, s2 * 0.27, 0.16, -0.02); wing.rotation.set(0.2, 0, -s2 * 1.1); wing.scale.z = 0.25; group.add(wing); }
    }
    group.add(M(new THREE.BoxGeometry(0.03, 0.11, 0.05), trim, 0, -0.02, 0.27), M(new THREE.BoxGeometry(0.04, 0.09, 0.42), trim, 0, 0.27, 0));
    if (d.rarity === 2) { gem.position.set(0, 0.12, 0.27); group.add(gem); }
  } else if (d.slot === 'hands') {
    // manoplas: placas nos dedos, dorso e punho largo
    for (const s2 of [-1, 1]) {
      const h = new THREE.Group();
      h.position.x = s2 * 0.15;
      h.rotation.z = s2 * 0.25;
      const back = M(new THREE.BoxGeometry(0.14, 0.13, 0.07), main, 0, 0, 0);
      h.add(back);
      for (let f = 0; f < 4; f++) for (let k = 0; k < 2; k++) h.add(M(new THREE.BoxGeometry(0.03, 0.045, 0.045), k ? trim : main, -0.05 + f * 0.033, -0.09 - k * 0.05, 0));
      const thumb = M(new THREE.BoxGeometry(0.04, 0.08, 0.04), main, s2 * -0.085, -0.03, 0.02);
      thumb.rotation.z = s2 * 0.6;
      const cuff = M(new THREE.CylinderGeometry(0.11, 0.08, 0.13, 14, 1, true), main, 0, 0.12, 0);
      const cuffRim = M(new THREE.TorusGeometry(0.11, 0.012, 6, 18), trim, 0, 0.185, 0);
      cuffRim.rotation.x = PI / 2;
      h.add(thumb, cuff, cuffRim);
      group.add(h);
    }
  } else if (d.slot === 'legs') {
    // coxotes, joelheiras e grevas
    for (const s2 of [-1, 1]) {
      const x = s2 * 0.1;
      group.add(M(new THREE.CylinderGeometry(0.075, 0.06, 0.55, 12), soft, x, -0.05, 0));
      const thigh = M(plateShell(0.02, 0.26, 0.085, 0.095, 0.01, true, 16), main, x, -0.0, 0);
      const knee = M(new THREE.SphereGeometry(0.06, 12, 10), trim, x, -0.06, 0.05);
      knee.scale.set(1, 1, 0.7);
      const shin = M(plateShell(-0.36, -0.1, 0.06, 0.072, 0.008, true, 16), main, x, 0, 0);
      group.add(thigh, knee, shin);
    }
    group.add(M(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 18), trim, 0, 0.27, 0));
  } else if (d.slot === 'feet') {
    // botas com bico de placa, tornozeleira e friso
    for (const s2 of [-1, 1]) {
      const x = s2 * 0.11;
      group.add(M(new THREE.CylinderGeometry(0.075, 0.07, 0.24, 14), soft, x, 0.06, 0));
      const toe = M(new THREE.SphereGeometry(0.08, 14, 10), main, x, -0.09, 0.07);
      toe.scale.set(0.95, 0.6, 1.6);
      const ankle = M(new THREE.SphereGeometry(0.085, 14, 10, 0, PI * 2, 0, PI * 0.5), main, x, -0.02, 0);
      ankle.scale.set(1, 0.6, 1.1);
      group.add(toe, ankle, M(new THREE.TorusGeometry(0.076, 0.012, 6, 16), trim, x, 0.18, 0), M(new THREE.TorusGeometry(0.076, 0.01, 6, 16), trim, x, 0.06, 0));
      group.children[group.children.length - 1].rotation.x = PI / 2;
      group.children[group.children.length - 2].rotation.x = PI / 2;
    }
  } else if (d.slot === 'cape') {
    // capa ondulada com gola, broche e barra
    const geo = new THREE.CylinderGeometry(0.17, 0.4, 0.75, 28, 6, true, -1.25, 2.5);
    const pa = geo.attributes.position;
    for (let k = 0; k < pa.count; k++) { const y = pa.getY(k), a = Math.atan2(pa.getX(k), pa.getZ(k)); const w = Math.sin(a * 5) * 0.025 * (0.4 - y); pa.setX(k, pa.getX(k) + Math.sin(a) * w); pa.setZ(k, pa.getZ(k) + Math.cos(a) * w); }
    geo.computeVertexNormals();
    const c = M(geo, std(d.color, { side: THREE.DoubleSide, roughness: 0.85 }));
    const hem = M(new THREE.TorusGeometry(0.4, 0.012, 6, 30, 2.5), trim, 0, -0.37, 0);
    hem.rotation.set(PI / 2, 0, PI / 2 - 1.25);
    const col = M(new THREE.TorusGeometry(0.15, 0.03, 8, 18, PI), trim, 0, 0.36, 0);
    col.rotation.set(PI / 2, 0, 0);
    gem.position.set(0, 0.34, -0.15);
    group.add(c, hem, col, gem);
  } else if (d.slot === 'ring') {
    // anel com garras segurando uma pedra lapidada
    const r = M(new THREE.TorusGeometry(0.16, 0.032, 12, 32), trim);
    r.rotation.x = 0.35;
    const seat = M(new THREE.CylinderGeometry(0.06, 0.045, 0.05, 8), trim, 0, 0.17, 0.06);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * PI * 2 + PI / 4, pr = M(new THREE.ConeGeometry(0.012, 0.07, 5), trim, Math.cos(a) * 0.05, 0.22, 0.06 + Math.sin(a) * 0.05); group.add(pr); }
    gem.position.set(0, 0.23, 0.06);
    gem.scale.set(1.3, 1.6, 1.3);
    group.add(r, seat, gem);
  } else {
    // amuleto: corrente de elos e pingente em losango com moldura
    for (let k = 0; k < 20; k++) { const a = PI * 0.15 + (k / 19) * PI * 1.7; const l = M(new THREE.TorusGeometry(0.018, 0.005, 4, 8), trim, Math.cos(a) * 0.2, Math.sin(a) * 0.2 + 0.05, 0); l.rotation.set(k % 2 ? PI / 2 : 0, 0, a); group.add(l); }
    const pend = M(new THREE.OctahedronGeometry(0.11, 0), main, 0, -0.2, 0);
    pend.scale.set(0.8, 1.2, 0.35);
    gem.position.set(0, -0.2, 0.04);
    gem.scale.setScalar(1.1);
    const fr = M(new THREE.TorusGeometry(0.1, 0.012, 6, 4), trim, 0, -0.2, 0.02);
    fr.rotation.z = PI / 4;
    fr.scale.set(0.85, 1.25, 1);
    group.add(pend, gem, fr);
  }
  return { group };
}

// Runa: pedra gravada flutuando dentro de um anel de luz na cor do tipo.
export function buildRune(def) {
  const group = new THREE.Group();
  const c = new THREE.Color(def.color);
  const stone = M(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.5), emissive: c.clone().multiplyScalar(0.6), roughness: 0.3, metalness: 0.3, flatShading: true }));
  stone.scale.set(0.8, 1.25, 0.5);
  group.add(stone, M(new THREE.SphereGeometry(0.07, 10, 8), glow(def.color, 2.4)));
  for (let i = 0; i < def.tier; i++) {
    const ring = M(new THREE.TorusGeometry(0.3 + i * 0.07, 0.014, 6, 36), glow(def.color, 1.6));
    ring.rotation.set(1.2 + i * 0.35, i * 0.6, 0);
    group.add(ring);
  }
  return { group };
}

// Comidas da taverna
export function buildFood(id) {
  const group = new THREE.Group();
  if (id === 'mead' || id === 'tea') {
    const mug = M(new THREE.CylinderGeometry(0.17, 0.15, 0.36, 18), std(id === 'mead' ? '#8a5a32' : '#e8e0d0', { roughness: 0.7 }));
    const top = M(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 18), std(id === 'mead' ? '#fff4d8' : '#8aa040'), 0, 0.17, 0);
    const handle = M(new THREE.TorusGeometry(0.09, 0.025, 6, 14), mug.material, 0.18, 0, 0);
    group.add(mug, top, handle);
  } else if (id === 'pie') {
    group.add(M(new THREE.CylinderGeometry(0.3, 0.26, 0.12, 24), std('#d89a4a')), M(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 24), std('#e8b860'), 0, 0.07, 0));
    for (let i = 0; i < 4; i++) { const s = M(new THREE.BoxGeometry(0.5, 0.02, 0.03), std('#b07a30'), 0, 0.09, 0); s.rotation.y = (i * Math.PI) / 4; group.add(s); }
  } else if (id === 'bread') {
    const b = M(new THREE.SphereGeometry(0.22, 16, 12), std('#5a3a22', { roughness: 0.9 }));
    b.scale.set(1.3, 0.7, 0.9);
    const cream = M(new THREE.SphereGeometry(0.1, 12, 8), std('#fff8e8'), 0.05, 0.14, 0);
    cream.scale.y = 0.5;
    group.add(b, cream);
  } else {
    // ensopado e banquete: tigela fumegante (o banquete ganha um frango assado)
    const bowl = M(new THREE.SphereGeometry(0.28, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#8a5a32', { side: THREE.DoubleSide }));
    const soup = M(new THREE.CircleGeometry(0.26, 20), std('#a8582a'), 0, -0.03, 0);
    soup.rotation.x = -Math.PI / 2;
    group.add(bowl, soup);
    for (let i = 0; i < 4; i++) group.add(M(new THREE.SphereGeometry(0.05, 8, 6), std(i % 2 ? '#e0a040' : '#5a9a3a'), Math.cos(i * 1.6) * 0.12, 0, Math.sin(i * 1.6) * 0.12));
    if (id === 'feast') { const ck = M(new THREE.SphereGeometry(0.16, 14, 10), std('#c8803a'), 0.05, 0.14, 0); ck.scale.set(1.3, 0.9, 1); group.add(ck); }
  }
  return { group };
}
