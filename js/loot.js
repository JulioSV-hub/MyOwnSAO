// Baús e itens de coleta espalhados pelos campos de cada andar.
// Baús voltam a encher depois de 3 dias do jogo; ervas, minérios e cristais renascem no dia seguinte.
import * as THREE from 'three';
import { toonMat } from './toon.js';
import { mulberry32 } from './rng.js';
import { GATHER, ITEMS, MONSTERS, RUNES, RUNE_TIER_FLOOR, weaponDef, armorDef, runeDef } from './data.js';
import { Sfx } from './audio.js';

const CHESTS = 12, NODES = 40, REFILL = 3;
const TIERS = {
  wood: { name: 'Baú de Madeira', body: '#8a5a32', trim: '#5a3a22', lock: '#c8a050' },
  silver: { name: 'Baú de Prata', body: '#6a6e78', trim: '#d8dde4', lock: '#9ad0ff' },
  gold: { name: 'Baú Dourado', body: '#7a2a2a', trim: '#f0c040', lock: '#fff0a0' },
};

function chestMesh(t) {
  const g = new THREE.Group(), T = TIERS[t];
  const body = toonMat(T.body), trim = toonMat(T.trim), lock = toonMat(T.lock);
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.7), body);
  box.position.y = 0.3;
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.6, -0.35);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.1, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), body);
  lid.position.z = 0.35;
  lidPivot.add(lid);
  for (const x of [-0.42, 0.42]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.72), trim);
    band.position.set(x, 0.3, 0);
    const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), trim);
    lb.position.set(x, 0, 0.35);
    g.add(band);
    lidPivot.add(lb);
  }
  const lk = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.06), lock);
  lk.position.set(0, 0.55, 0.37);
  g.add(box, lidPivot, lk);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // brilho que denuncia o baú de longe
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(T.lock).multiplyScalar(1.2), transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.y = 0.6;
  g.add(glow);
  return { group: g, lid: lidPivot, glow };
}

function nodeMesh(kind) {
  const g = new THREE.Group(), c = kind.color;
  if (kind.name === 'Erva Medicinal') {
    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), toonMat(i % 2 ? '#5ac83a' : '#3f9a2a'));
      l.scale.set(0.5, 1.6, 0.25);
      const a = (i / 6) * Math.PI * 2;
      l.position.set(Math.cos(a) * 0.1, 0.18, Math.sin(a) * 0.1);
      l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      g.add(l);
    }
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.4) }));
    f.position.y = 0.38;
    g.add(f);
  } else if (kind.name === 'Cogumelo Luminoso') {
    for (const [x, z, s] of [[0, 0, 1], [0.16, 0.08, 0.7], [-0.12, 0.12, 0.6]]) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.04 * s, 0.2 * s, 8), toonMat('#f0ead8'));
      st.position.set(x, 0.1 * s, z);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.6) }));
      cap.position.set(x, 0.19 * s, z);
      g.add(st, cap);
    }
  } else {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), toonMat('#7a7670'));
    rock.scale.set(1, 0.6, 0.9);
    rock.position.y = 0.2;
    g.add(rock);
    const crystal = kind.name === 'Cristal Bruto';
    for (let i = 0; i < (crystal ? 4 : 6); i++) {
      const a = i * 1.7;
      const sh = new THREE.Mesh(crystal ? new THREE.OctahedronGeometry(0.12, 0) : new THREE.IcosahedronGeometry(0.07, 0), crystal ? new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.5) }) : toonMat('#c8ccd8', { emissive: '#3a3a44' }));
      sh.position.set(Math.cos(a) * 0.26, 0.34 + (i % 2) * 0.06, Math.sin(a) * 0.22);
      if (crystal) sh.scale.y = 2;
      g.add(sh);
    }
  }
  // brilhinho flutuando em cima
  const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff8d0').multiplyScalar(2.2) }));
  sp.position.y = 0.9;
  g.add(sp);
  g.userData.spark = sp;
  return g;
}

export class Loot {
  constructor(game) {
    this.game = game;
    this.chests = [];
    this.nodes = [];
    this.group = null;
    this.visT = 0;
  }

  get st() {
    const s = this.game.state, n = this.game.floor.n;
    s.loot ||= {};
    return (s.loot[n] ||= { c: {}, g: {}, rev: [] });
  }
  get day() { return this.game.state.world.day || 0; }

  clear() {
    this.fbRef = null;
    if (this.group) {
      this.game.scene.remove(this.group);
      this.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    }
    this.group = null;
    this.chests = [];
    this.nodes = [];
  }

  setFloor(floor) {
    this.clear();
    const w = this.game.world, r = mulberry32(floor.seed + 31337);
    this.group = new THREE.Group();
    const spot = (minR, maxR, pad) => {
      for (let i = 0; i < 80; i++) {
        const a = r() * Math.PI * 2, d = minR + r() * (maxR - minR), x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (!w.freeSpot(x, z, pad)) continue;
        if (w.water && w.groundAt(x, z) < w.water.level + 0.2) continue;
        if (w.grid.query(x, z, 1.4, []).length) continue;
        return { x, z, d };
      }
      return null;
    };
    for (let i = 0; i < CHESTS; i++) {
      const p = spot(70, 212, 3);
      if (!p) continue;
      const roll = r();
      const tier = p.d > 150 && roll < 0.3 ? 'gold' : roll < 0.38 ? 'silver' : 'wood';
      const m = chestMesh(tier);
      m.group.position.set(p.x, w.groundAt(p.x, p.z), p.z);
      m.group.rotation.y = r() * Math.PI * 2;
      this.group.add(m.group);
      w.grid.add({ x: p.x, z: p.z, r: 0.55 });
      this.chests.push({ i, tier, pos: m.group.position, ...m, open: 0 });
    }
    let total = 0;
    for (const k of GATHER) total += k.w;
    for (let i = 0; i < NODES; i++) {
      const p = spot(62, 214, 2);
      if (!p) continue;
      let roll = r() * total, kind = GATHER[0];
      for (const k of GATHER) { roll -= k.w; if (roll <= 0) { kind = k; break; } }
      const g = nodeMesh(kind);
      g.position.set(p.x, w.groundAt(p.x, p.z), p.z);
      g.rotation.y = r() * 6;
      this.group.add(g);
      this.nodes.push({ i, kind, obj: g, pos: g.position });
    }
    this.game.scene.add(this.group);
    this.refresh();
  }

  available(c) { const d = this.st.c[c.i]; return d == null || this.day - d >= REFILL; }
  nodeReady(n) { const d = this.st.g[n.i]; return d == null || this.day > d; }

  refresh() {
    for (const c of this.chests) {
      const ok = this.available(c);
      c.lid.rotation.x = ok ? 0 : -1.9;
      c.glow.visible = ok;
    }
    for (const n of this.nodes) n.obj.visible = this.nodeReady(n);
    const st = this.st;
    st.rev = (st.rev || []).filter((i) => this.chests.some((c) => c.i === i && this.available(c)));
  }

  onNewDay() { if (this.group) this.refresh(); }

  // o que dá para pegar perto do jogador
  nearest(pos) {
    let best = null, bd = 2.4;
    for (const c of this.chests) {
      if (!this.available(c)) continue;
      const d = Math.hypot(pos.x - c.pos.x, pos.z - c.pos.z);
      if (d < bd) { bd = d; best = { kind: 'chest', c, label: `[E] Abrir ${TIERS[c.tier].name}` }; }
    }
    for (const n of this.nodes) {
      if (!n.obj.visible) continue;
      const d = Math.hypot(pos.x - n.pos.x, pos.z - n.pos.z);
      if (d < Math.min(bd, 2)) { bd = d; best = { kind: 'node', n, label: `[E] Coletar ${n.kind.name}` }; }
    }
    return best;
  }

  interact(t) {
    if (t.kind === 'chest') this.openChest(t.c);
    else this.collect(t.n);
  }

  collect(n) {
    const g = this.game, p = g.state.player, k = 1 + g.floor.n * 0.12;
    const qty = 1 + (Math.random() < 0.35 ? 1 : 0);
    const m = (p.mats[n.kind.name] ||= { qty: 0, value: Math.round(n.kind.value * k) });
    m.qty += qty;
    this.st.g[n.i] = this.day;
    n.obj.visible = false;
    g.effects.sparks(n.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), n.kind.color, 12, 0.6);
    Sfx.coin();
    g.ui.toast(`Coletou ${qty}× ${n.kind.name}`);
    g.quests.onDrop(n.kind.name);
  }

  openChest(c) {
    const g = this.game;
    this.st.c[c.i] = this.day;
    this.st.rev = (this.st.rev || []).filter((i) => i !== c.i);
    c.glow.visible = false;
    c.open = 0.001;
    const got = this.grant(c.tier);
    g.effects.sparks(c.pos.clone().add(new THREE.Vector3(0, 0.9, 0)), TIERS[c.tier].lock, 30, 1);
    Sfx.victory();
    g.ui.banner(TIERS[c.tier].name, got.join(' · '), 4);
    g.quests.onChest();
    g.save();
  }

  // ─────────── Chefe de Campo ───────────
  fieldBossReady() { const fb = this.game.world?.fieldBoss; return !!fb && this.st.fb !== this.day; }

  onFieldBoss(e) {
    const g = this.game;
    this.st.fb = this.day;
    const got = this.grant('gold');
    const exp = Math.round((10 + 9 * e.level) * 8 * g.state.settings.xpRate);
    g.gainExp(exp);
    Sfx.victory();
    g.ui.banner(`Chefe de Campo derrotado: ${e.def.name}`, `+${exp} EXP · ${got.join(' · ')}`, 5);
    g.save();
  }

  // recompensa de um baú (ou do Chefe de Campo); devolve a lista do que você ganhou
  grant(tier) {
    const g = this.game, p = g.state.player, n = g.floor.n, k = 1 + (n - 1) * 0.6;
    const c = { tier };
    const got = [];
    const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const item = (id, q) => { p.items[id] = (p.items[id] || 0) + q; got.push(`${q}× ${ITEMS[id].name}`); };
    const mat = (name, value, q) => { const m = (p.mats[name] ||= { qty: 0, value }); m.qty += q; got.push(`${q}× ${name}`); };
    const maxTier = RUNE_TIER_FLOOR.filter((f) => n >= f).length;
    const rune = (tier) => { const keys = Object.keys(RUNES), id = `rune_${keys[rint(0, keys.length - 1)]}_${tier}`; p.runes ||= {}; p.runes[id] = (p.runes[id] || 0) + 1; got.push(runeDef(id).name); };
    const col = c.tier === 'gold' ? rint(400, 800) : c.tier === 'silver' ? rint(120, 250) : rint(30, 80);
    p.col += Math.round(col * k);
    got.unshift(`${Math.round(col * k)} Col`);
    const drop = MONSTERS[g.floor.monsters[rint(0, g.floor.monsters.length - 1)]].drop;
    if (c.tier === 'wood') {
      if (Math.random() < 0.6) item('potion', rint(1, 2));
      if (Math.random() < 0.45) mat(drop[0], Math.round(drop[1] * (1 + n * 0.45)), rint(1, 2));
      if (Math.random() < 0.08) rune(1);
    } else if (c.tier === 'silver') {
      item(n >= 3 ? 'hipotion' : 'potion', rint(1, 2));
      if (Math.random() < 0.35) item('teleport_crystal', 1);
      if (Math.random() < 0.35) rune(Math.max(1, maxTier - 1));
      if (Math.random() < 0.4) {
        const id = Math.random() < 0.5 ? `gen_${n}` : `${Math.random() < 0.5 ? 'larm' : 'harm'}_${n}`;
        if (id.startsWith('gen')) { p.weapons.push(id); got.push(weaponDef(id).name); } else { p.armors.push(id); got.push(armorDef(id).name); }
      }
    } else {
      item(n >= 5 ? 'heal_crystal' : 'hipotion', 1);
      rune(maxTier);
      if (Math.random() < 0.65) {
        const w = Math.random() < 0.5;
        const id = w ? `rare_${n}` : `rarm_${n}`;
        (w ? p.weapons : p.armors).push(id);
        got.push(`★ ${(w ? weaponDef(id) : armorDef(id)).name}`);
      }
    }
    return got;
  }

  // boato da taverna: revela no mapa um baú fechado
  reveal() {
    const st = this.st, closed = this.chests.filter((c) => this.available(c) && !st.rev.includes(c.i));
    if (!closed.length) return null;
    const c = closed.sort((a, b) => (b.tier === 'gold') - (a.tier === 'gold') || Math.random() - 0.5)[0];
    st.rev.push(c.i);
    return c;
  }

  revealed() { const st = this.st; return this.chests.filter((c) => st.rev.includes(c.i) && this.available(c)); }

  update(dt) {
    if (!this.group) return;
    const t = this.game.time, pl = this.game.player.pos;
    // o Chefe de Campo aparece quando você chega perto do marco dele
    const fb = this.game.world.fieldBoss;
    if (fb && this.fieldBossReady() && !this.game.indoor && Math.hypot(pl.x - fb.pos.x, pl.z - fb.pos.z) < 85) {
      const ref = this.fbRef, list = this.game.enemies.list;
      if (!ref || ref.dead || !list.includes(ref)) {
        if (!ref || !ref.dead) {
          const e = this.game.enemies.spawnAt(fb.def, this.game.floor.level + 6, fb.pos.x + 6, fb.pos.z + 6, {});
          e.fieldBoss = true;
          e.elite = true;
          e.monId = fb.id;
          e.label?.el.classList.add('elite');
          this.fbRef = e;
        }
      }
    }
    for (const c of this.chests) {
      if (c.open > 0 && c.open < 1) { c.open = Math.min(1, c.open + dt * 2.5); c.lid.rotation.x = -1.9 * (1 - (1 - c.open) ** 3); }
      if (c.glow.visible) c.glow.material.opacity = 0.14 + Math.sin(t * 3 + c.i) * 0.06;
    }
    this.visT -= dt;
    if (this.visT <= 0) {
      this.visT = 0.4;
      for (const n of this.nodes) if (n.obj.visible || this.nodeReady(n)) n.obj.visible = this.nodeReady(n) && Math.hypot(pl.x - n.pos.x, pl.z - n.pos.z) < 95;
    }
    for (const n of this.nodes) if (n.obj.visible) { const s = n.obj.userData.spark; s.position.y = 0.9 + Math.sin(t * 2.5 + n.i) * 0.12; s.rotation.y += dt * 2; }
  }
}
