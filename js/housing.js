// Casa própria: compra pela placa na cidade, interior decorável (G) com móveis comprados e posicionados livremente.
import * as THREE from 'three';
import { toonMat } from './toon.js';
import { buildSword } from './gear3d.js';
import { weaponDef } from './data.js';
import { Sfx } from './audio.js';

const BASE = new THREE.Vector3(0, 600, 0);
const ROOM = { w: 14, d: 11, h: 4.4 };
const M = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = false; return o; };
const T = (c, o) => toonMat(c, o);

function plankTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = `hsl(28, 40%, ${36 + (i * 7) % 12}%)`;
    g.fillRect(0, i * 32, 256, 31);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, i * 32 + 31, 256, 1);
    g.fillRect(((i * 97) % 200) + 20, i * 32, 1, 32);
    for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(Math.random() * 256, i * 32 + Math.random() * 30, 40, 1); }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Catálogo de móveis
export const FURNITURE = [
  { id: 'bed', name: 'Cama', price: 300, r: 1.2, build: () => { const g = new THREE.Group(); g.add(M(new THREE.BoxGeometry(1.5, 0.4, 2.2), T('#7a5232'), 0, 0.3, 0), M(new THREE.BoxGeometry(1.4, 0.22, 2.1), T('#f4f0e8'), 0, 0.6, 0), M(new THREE.BoxGeometry(1.42, 0.12, 1.3), T('#4a6aa8'), 0, 0.72, 0.38), M(new THREE.BoxGeometry(0.9, 0.16, 0.4), T('#ffffff'), 0, 0.78, -0.8), M(new THREE.BoxGeometry(1.5, 0.9, 0.1), T('#6a4428'), 0, 0.6, -1.1)); return g; } },
  { id: 'table', name: 'Mesa', price: 120, r: 0.8, build: () => { const g = new THREE.Group(); g.add(M(new THREE.BoxGeometry(1.4, 0.08, 0.9), T('#8a5a36'), 0, 0.78, 0)); for (const x of [-0.6, 0.6]) for (const z of [-0.36, 0.36]) g.add(M(new THREE.CylinderGeometry(0.04, 0.04, 0.76, 8), T('#6a4428'), x, 0.38, z)); return g; } },
  { id: 'chair', name: 'Cadeira', price: 60, r: 0.4, build: () => { const g = new THREE.Group(); g.add(M(new THREE.BoxGeometry(0.45, 0.06, 0.45), T('#8a5a36'), 0, 0.46, 0), M(new THREE.BoxGeometry(0.45, 0.5, 0.05), T('#8a5a36'), 0, 0.74, -0.2)); for (const x of [-0.19, 0.19]) for (const z of [-0.19, 0.19]) g.add(M(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6), T('#6a4428'), x, 0.22, z)); return g; } },
  { id: 'sofa', name: 'Sofá', price: 260, r: 1.0, build: () => { const g = new THREE.Group(); const c = T('#a0384a'); g.add(M(new THREE.BoxGeometry(1.9, 0.4, 0.8), c, 0, 0.3, 0), M(new THREE.BoxGeometry(1.9, 0.6, 0.2), c, 0, 0.7, -0.32), M(new THREE.BoxGeometry(0.2, 0.55, 0.8), c, -0.85, 0.5, 0), M(new THREE.BoxGeometry(0.2, 0.55, 0.8), c, 0.85, 0.5, 0)); return g; } },
  { id: 'shelf', name: 'Estante', price: 220, r: 0.8, build: () => { const g = new THREE.Group(); const w = T('#6a4428'); g.add(M(new THREE.BoxGeometry(1.4, 2.0, 0.4), w, 0, 1.0, 0)); const cols = ['#a03a3a', '#3a6aa8', '#4a8a4a', '#c8a050', '#6a4a8a']; for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) g.add(M(new THREE.BoxGeometry(0.16, 0.34, 0.28), T(cols[(r + i) % 5]), -0.5 + i * 0.2, 0.25 + r * 0.48, 0.08)); return g; } },
  { id: 'rug', name: 'Tapete', price: 90, r: 0, build: () => { const g = new THREE.Group(); g.add(M(new THREE.CylinderGeometry(1.3, 1.3, 0.02, 32), T('#a8584a'), 0, 0.01, 0), M(new THREE.TorusGeometry(1.05, 0.06, 4, 32).rotateX(Math.PI / 2), T('#e8c070'), 0, 0.025, 0)); return g; } },
  { id: 'plant', name: 'Planta', price: 50, r: 0.35, build: () => { const g = new THREE.Group(); g.add(M(new THREE.CylinderGeometry(0.22, 0.16, 0.36, 12), T('#b8603a'), 0, 0.18, 0)); for (let i = 0; i < 5; i++) { const b = M(new THREE.SphereGeometry(0.22, 10, 8), T('#4a9a3a'), Math.cos(i) * 0.1, 0.55 + (i % 2) * 0.18, Math.sin(i) * 0.1); g.add(b); } return g; } },
  { id: 'lamp', name: 'Luminária', price: 110, r: 0.3, glow: true, build: () => { const g = new THREE.Group(); g.add(M(new THREE.CylinderGeometry(0.03, 0.12, 1.5, 8), T('#3a3a3a'), 0, 0.75, 0)); const shade = M(new THREE.CylinderGeometry(0.18, 0.3, 0.32, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#fff0c0', emissive: '#ffcc66', emissiveIntensity: 1.2, side: THREE.DoubleSide }), 0, 1.6, 0); g.add(shade); return g; } },
  { id: 'chest', name: 'Baú', price: 150, r: 0.6, build: () => { const g = new THREE.Group(); g.add(M(new THREE.BoxGeometry(1.0, 0.5, 0.6), T('#7a5232'), 0, 0.25, 0), M(new THREE.CylinderGeometry(0.3, 0.3, 1.0, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), T('#7a5232'), 0, 0.5, 0), M(new THREE.BoxGeometry(1.02, 0.06, 0.62), T('#c8a050'), 0, 0.5, 0), M(new THREE.BoxGeometry(0.12, 0.14, 0.04), T('#e8c060'), 0, 0.48, 0.31)); return g; } },
  { id: 'fireplace', name: 'Lareira', price: 400, r: 1.0, fire: true, build: () => { const g = new THREE.Group(); const st = T('#8a8478'); g.add(M(new THREE.BoxGeometry(1.8, 1.4, 0.7), st, 0, 0.7, 0), M(new THREE.BoxGeometry(2.0, 0.12, 0.8), T('#6a4428'), 0, 1.44, 0), M(new THREE.BoxGeometry(0.8, 2.6, 0.5), st, 0, 2.7, -0.1)); g.add(M(new THREE.BoxGeometry(1.0, 0.8, 0.3), T('#1a1210'), 0, 0.5, 0.22)); const fire = M(new THREE.ConeGeometry(0.22, 0.5, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.0, 0.3) }), 0, 0.42, 0.25); fire.userData.fire = true; g.add(fire); return g; } },
  { id: 'painting', name: 'Quadro de Aincrad', price: 180, r: 0.5, build: () => { const g = new THREE.Group(); const cv = document.createElement('canvas'); cv.width = 256; cv.height = 192; const c = cv.getContext('2d'); const gr = c.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, '#6ab0ff'); gr.addColorStop(1, '#e8f4ff'); c.fillStyle = gr; c.fillRect(0, 0, 256, 192); c.fillStyle = '#5a5a66'; for (let i = 0; i < 9; i++) { const w = 180 - i * 16; c.fillRect(128 - w / 2, 160 - i * 15, w, 11); } c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(60, 40, 40, 14, 0, 0, Math.PI * 2); c.fill(); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; g.add(M(new THREE.BoxGeometry(1.1, 0.85, 0.06), T('#c8a050'), 0, 1.7, 0), M(new THREE.PlaneGeometry(0.98, 0.73), new THREE.MeshBasicMaterial({ map: tex }), 0, 1.7, 0.035)); for (const x of [-0.35, 0.35]) { const l = M(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6), T('#6a4428'), x, 0.8, -0.15); l.rotation.x = 0.15; g.add(l); } return g; } },
  { id: 'rack', name: 'Expositor de Espadas', price: 200, r: 0.6, rack: true, build: () => { const g = new THREE.Group(); const w = T('#5a3a24'); g.add(M(new THREE.BoxGeometry(1.2, 0.12, 0.5), w, 0, 0.06, 0), M(new THREE.BoxGeometry(1.2, 1.8, 0.08), w, 0, 0.95, -0.2)); return g; } },
];
const byId = (id) => FURNITURE.find((f) => f.id === id);

export class Housing {
  constructor(game) {
    this.game = game;
    this.room = null;
    this.decorating = false;
    this.sel = 0;
    this.rot = 0;
    this.ghost = null;
    this.ray = new THREE.Raycaster();
    this.colliders = [];
  }

  get data() { return this.game.state.house || null; }
  // no andar 22 fica a cabana à beira do lago, como no anime
  price(floor) { return floor === 22 ? 6000 : 2500 + (floor - 1) * 900; }

  // venda: devolve 60% do que você pagou pela casa + metade do valor dos móveis
  saleValue() {
    const d = this.data;
    if (!d) return 0;
    const furn = d.items.reduce((a, it) => a + (byId(it.t)?.price || 0), 0);
    return Math.floor((d.paid ?? this.price(d.floor)) * 0.6 + furn * 0.5);
  }

  sellHouse() {
    const g = this.game, v = this.saleValue(), f = this.data.floor;
    g.state.player.col += v;
    g.state.house = null;
    Sfx.coin();
    g.ui.banner('Casa vendida', `+${v.toLocaleString('pt-BR')} Col — a casa do Andar ${f} voltou a ficar à venda`, 4);
    g.save();
  }

  sellOption() {
    const v = this.saleValue(), f = this.data.floor;
    return { label: `Vender a casa do Andar ${f} (${v.toLocaleString('pt-BR')} Col)`, run: () => ({
      text: `Tem certeza? Você recebe ${v.toLocaleString('pt-BR')} Col (60% do preço da casa + metade do valor dos móveis). Os móveis vão junto com a casa.`,
      options: [{ label: 'Sim, vender', run: () => { this.sellHouse(); return null; } }, { label: 'Não, deixa pra lá', run: () => this.plaqueDialog() }],
    }) };
  }

  plaqueDialog() {
    const g = this.game, p = g.state.player, n = g.floor.n, d = this.data;
    const close = { label: 'Fechar', run: () => null };
    if (d && d.floor === n) return { text: 'Sua casa. A chave encaixa perfeitamente na fechadura.', options: [{ label: 'Entrar', run: () => { g.ui.closeDialog(false); this.enter(); return undefined; } }, this.sellOption(), close] };
    if (d) return { text: `${n === 22 ? 'Cabana à beira do lago' : 'Casa à venda'} — mas você já tem uma casa no Andar ${d.floor}. Só dá para ter uma: venda a outra para comprar esta (a imobiliária cuida disso daqui mesmo).`, options: [this.sellOption(), close] };
    const price = this.price(n);
    return {
      text: n === 22 ? `CABANA À VENDA\nUma cabana de madeira à beira do lago de ${g.floor.town}, o andar mais tranquilo de Aincrad. Dizem que um casal de espadachins sonhava em morar aqui...\nPreço: ${price.toLocaleString('pt-BR')} Col.` : `CASA À VENDA\nUm sobrado aconchegante em ${g.floor.town}. Ideal para descansar entre as batalhas.\nPreço: ${price.toLocaleString('pt-BR')} Col.`,
      options: [
        { label: `Comprar (${price.toLocaleString('pt-BR')} Col)`, run: () => {
          if (p.col < price) { Sfx.error(); return { text: `Faltam ${(price - p.col).toLocaleString('pt-BR')} Col. Volte quando tiver juntado!`, options: [close] }; }
          p.col -= price;
          g.state.house = { floor: n, paid: price, items: [{ t: 'bed', x: -4.6, z: -3, rot: 0 }, { t: 'rug', x: 0, z: 0, rot: 0 }, { t: 'table', x: 2.5, z: -2.5, rot: 0 }] };
          Sfx.victory();
          g.ui.banner('Casa nova!', 'Bem-vindo ao lar. Dentro de casa, aperte G para decorar.', 4);
          g.save();
          return { text: 'A casa agora é sua! Ela já vem com uma cama, uma mesa e um tapete.', options: [{ label: 'Entrar agora', run: () => { g.ui.closeDialog(false); this.enter(); return undefined; } }, close] };
        } },
        close,
      ],
    };
  }

  // ─────────── Interior ───────────
  buildRoom() {
    const g = new THREE.Group();
    g.position.copy(BASE);
    const { w, d, h } = ROOM;
    const floorMat = new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.8 });
    const wall = T('#efe4d0'), beam = T('#6a4428');
    g.add(M(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), floorMat));
    g.add(M(new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2), T('#d8c8a8'), 0, h, 0));
    const walls = [[0, h / 2, -d / 2, 0, w], [0, h / 2, d / 2, Math.PI, w], [-w / 2, h / 2, 0, Math.PI / 2, d], [w / 2, h / 2, 0, -Math.PI / 2, d]];
    for (const [x, y, z, ry, len] of walls) { const p = M(new THREE.PlaneGeometry(len, h), wall, x, y, z); p.rotation.y = ry; g.add(p); }
    for (let i = -2; i <= 2; i++) g.add(M(new THREE.BoxGeometry(0.25, 0.3, d), beam, i * 2.8, h - 0.15, 0));
    g.add(M(new THREE.BoxGeometry(w, 0.25, 0.12), beam, 0, 0.12, -d / 2 + 0.06), M(new THREE.BoxGeometry(w, 0.25, 0.12), beam, 0, 0.12, d / 2 - 0.06));
    // janelas com luz do dia
    this.winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#bfe4ff') });
    for (const x of [-4, 4]) { g.add(M(new THREE.PlaneGeometry(1.4, 1.5), this.winMat, x, 2.2, -d / 2 + 0.02), M(new THREE.BoxGeometry(1.6, 0.12, 0.2), beam, x, 1.42, -d / 2 + 0.08)); }
    // porta de saída
    g.add(M(new THREE.BoxGeometry(1.4, 2.5, 0.1), T('#5a3a22'), 0, 1.25, d / 2 - 0.05), M(new THREE.SphereGeometry(0.06, 8, 6), T('#d8b050'), 0.5, 1.2, d / 2 - 0.12));
    const l1 = new THREE.PointLight('#ffd8a0', 18, 14, 1.6);
    l1.position.set(-3, h - 0.6, 0);
    const l2 = l1.clone();
    l2.position.set(3, h - 0.6, 0);
    g.add(l1, l2);
    this.lights = [l1, l2];
    this.furnGroup = new THREE.Group();
    g.add(this.furnGroup);
    this.game.scene.add(g);
    this.room = g;
    this.refreshFurniture();
  }

  refreshFurniture() {
    if (!this.furnGroup) return;
    this.furnGroup.clear();
    this.colliders = [];
    this.fires = [];
    const wid = this.game.state.player.weapon;
    for (const it of this.data.items) {
      const f = byId(it.t);
      if (!f) continue;
      const o = f.build();
      if (f.rack) {
        const sw = buildSword(weaponDef(wid)).group;
        sw.position.set(0, 0.25, -0.1);
        sw.scale.setScalar(1.2);
        o.add(sw);
      }
      o.position.set(it.x, 0, it.z);
      o.rotation.y = it.rot;
      o.userData.item = it;
      o.traverse((c) => { if (c.userData.fire) this.fires.push(c); });
      this.furnGroup.add(o);
      if (f.r) this.colliders.push({ x: BASE.x + it.x, z: BASE.z + it.z, r: f.r, it });
    }
  }

  enter() {
    const g = this.game;
    if (!this.room) this.buildRoom();
    this.room.visible = true;
    this.refreshFurniture();
    this.returnPos = g.world.housePlaque.clone();
    g.indoor = { y: BASE.y, minX: BASE.x - ROOM.w / 2 + 0.5, maxX: BASE.x + ROOM.w / 2 - 0.5, minZ: BASE.z - ROOM.d / 2 + 0.5, maxZ: BASE.z + ROOM.d / 2 - 0.5 };
    g.ui.fade(() => {
      g.player.pos.set(BASE.x, BASE.y, BASE.z + ROOM.d / 2 - 1.5);
      g.player.vel.set(0, 0, 0);
      g.player.yaw = 0;
      g.player.pitch = 0;
      g.combat.setSheathed(true, true);
      g.ui.toast('Em casa! [G] decorar · [E] na porta para sair · [E] na cama para dormir');
      g.input.lock();
    });
  }

  exit() {
    const g = this.game;
    this.setDecorate(false);
    g.ui.fade(() => {
      g.indoor = null;
      if (this.room) this.room.visible = false;
      const p = this.returnPos || g.world.housePlaque;
      g.player.place(p.x + 1.5, p.z + 1.5, g.player.yaw);
      g.input.lock();
    });
  }

  resolve(pos, r) {
    for (const c of this.colliders) {
      const dx = pos.x - c.x, dz = pos.z - c.z, m = r + c.r, dd = Math.hypot(dx, dz);
      if (dd < m && dd > 1e-4) { pos.x = c.x + (dx / dd) * m; pos.z = c.z + (dz / dd) * m; }
    }
  }

  interact() {
    const pl = this.game.player.pos;
    if (Math.hypot(pl.x - BASE.x, pl.z - (BASE.z + ROOM.d / 2)) < 2) return { hint: '[E] Sair de casa', act: () => this.exit() };
    const bed = this.colliders.find((c) => c.it.t === 'bed' && Math.hypot(pl.x - c.x, pl.z - c.z) < 2.2);
    if (bed) return { hint: '[E] Dormir (grátis em casa)', act: () => this.game.sleep(this.game.night > 0.5 ? 0.27 : 0.8, 'Você descansou na sua própria cama.') };
    return { hint: this.decorating ? null : '[G] Decorar a casa', act: null };
  }

  // ─────────── Modo decoração ───────────
  setDecorate(on) {
    const g = this.game;
    this.decorating = on && !!g.indoor;
    if (this.ghost) { this.furnGroup?.remove(this.ghost); this.ghost = null; }
    g.ui.showDecorBar(this.decorating, this.sel);
    if (this.decorating) this.makeGhost();
  }

  makeGhost() {
    if (this.ghost) this.furnGroup.remove(this.ghost);
    const f = FURNITURE[this.sel];
    const o = f.build();
    o.traverse((c) => { if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.55; c.material.depthWrite = false; } });
    o.rotation.y = this.rot;
    this.ghost = o;
    this.furnGroup.add(o);
  }

  select(i) {
    if (i < 0 || i >= FURNITURE.length) return;
    this.sel = i;
    this.makeGhost();
    this.game.ui.showDecorBar(true, i);
  }

  hitPoint() {
    const cam = this.game.camera;
    this.ray.setFromCamera({ x: 0, y: 0 }, cam);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BASE.y);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(plane, hit)) return null;
    const lx = THREE.MathUtils.clamp(Math.round((hit.x - BASE.x) * 4) / 4, -ROOM.w / 2 + 0.6, ROOM.w / 2 - 0.6);
    const lz = THREE.MathUtils.clamp(Math.round((hit.z - BASE.z) * 4) / 4, -ROOM.d / 2 + 0.6, ROOM.d / 2 - 0.6);
    return { x: lx, z: lz };
  }

  place() {
    const g = this.game, f = FURNITURE[this.sel], p = g.state.player, h = this.hitPoint();
    if (!h) return;
    if (p.col < f.price) { Sfx.error(); g.ui.toast(`${f.name} custa ${f.price} Col.`, 'warn'); return; }
    p.col -= f.price;
    this.data.items.push({ t: f.id, x: h.x, z: h.z, rot: this.rot });
    Sfx.coin();
    this.refreshFurniture();
    this.makeGhost();
    g.save();
  }

  remove() {
    const g = this.game, h = this.hitPoint();
    if (!h) return;
    let best = -1, bd = 1.3;
    this.data.items.forEach((it, i) => { const d = Math.hypot(it.x - h.x, it.z - h.z); if (d < bd) { bd = d; best = i; } });
    if (best < 0) return;
    const it = this.data.items.splice(best, 1)[0];
    const f = byId(it.t);
    g.state.player.col += Math.floor((f?.price || 0) * 0.5);
    Sfx.click();
    g.ui.toast(`${f?.name || 'Móvel'} removido (+${Math.floor((f?.price || 0) * 0.5)} Col).`);
    this.refreshFurniture();
    this.makeGhost();
    g.save();
  }

  update(dt) {
    const g = this.game;
    if (!g.indoor) return;
    if (this.fires) for (const f of this.fires) f.scale.set(1 + Math.sin(g.time * 13) * 0.12, 1 + Math.sin(g.time * 9) * 0.2, 1);
    if (this.winMat) this.winMat.color.set(g.night > 0.5 ? '#203050' : '#bfe4ff');
    if (this.decorating && this.ghost) {
      const h = this.hitPoint();
      if (h) this.ghost.position.set(h.x, 0, h.z);
      this.ghost.rotation.y = this.rot;
    }
  }

  handleKeys(inp) {
    if (inp.pressed('KeyG')) { this.setDecorate(!this.decorating); return true; }
    if (!this.decorating) return false;
    for (let i = 0; i < 10; i++) if (inp.pressed(`Digit${(i + 1) % 10}`)) this.select(i);
    if (inp.pressed('Minus')) this.select(10);
    if (inp.pressed('Equal')) this.select(11);
    if (inp.pressed('KeyR')) { this.rot += Math.PI / 2; }
    if (inp.mouse.clicked.has(0)) this.place();
    if (inp.mouse.clicked.has(2) || inp.pressed('KeyX')) this.remove();
    return true;
  }
}
