// Espada em primeira pessoa, combos básicos, Sword Skills (com brilho e post-motion delay), defesa e rastro da lâmina.
import * as THREE from 'three';
import { skillById, weaponDef } from './data.js';
import { Sfx } from './audio.js';
import { buildSword } from './gear3d.js';

const PI = Math.PI;
const IDLE = { tilt: 0, yaw: 0.25, pitch: -0.55, px: 0.42, py: -0.45, pz: -0.62 };
const GUARD = { tilt: -0.15, yaw: 1.45, pitch: -1.45, px: 0.3, py: -0.2, pz: -0.6 };
const KEYS = ['tilt', 'yaw', 'pitch', 'px', 'py', 'pz'];
const mirror = (p) => ({ tilt: -p.tilt, yaw: -p.yaw, pitch: p.pitch, px: -p.px, py: p.py, pz: p.pz });
const TRAIL_WHITE = new THREE.Color('#dfefff');
const GLOW_TMP = new THREE.Color();

const BASIC = [
  [{ type: 'slash', tilt: 0.35, from: -1.25, to: 1.15, dur: 0.2, mul: 1, wind: 0.07 }],
  [{ type: 'slash', tilt: PI - 0.35, from: -1.25, to: 1.15, dur: 0.2, mul: 1, wind: 0.07 }],
  [{ type: 'thrust', dur: 0.16, mul: 1.35, wind: 0.1 }],
];

function movePoses(m) {
  if (m.type === 'thrust') {
    const ox = m.ox || 0, oy = m.oy || 0;
    return [
      { tilt: 0, yaw: 0.06, pitch: -1.57, px: 0.24 + ox, py: -0.32 + oy, pz: -0.18 },
      { tilt: 0, yaw: 0.02, pitch: -1.57, px: 0.06 + ox, py: -0.24 + oy, pz: -0.98 },
    ];
  }
  const b = { tilt: m.tilt, pitch: -1.45, px: 0.16, py: -0.3, pz: -0.48 };
  return [{ ...b, yaw: m.from }, { ...b, yaw: m.to }];
}

class SwordRig {
  constructor(camera, side) {
    this.root = new THREE.Group();
    this.tilt = new THREE.Group();
    this.aim = new THREE.Group();
    this.aim.rotation.order = 'YXZ';
    this.root.add(this.tilt);
    this.tilt.add(this.aim);
    camera.add(this.root);
    this.root.scale.setScalar(0.72);
    this.setWeapon(weaponDef('small_sword'));
    this.pose = side === 'L' ? mirror(IDLE) : { ...IDLE };
    this.apply();
  }

  apply() {
    const p = this.pose;
    this.root.position.set(p.px, p.py, p.pz);
    this.tilt.rotation.z = p.tilt;
    this.aim.rotation.set(p.pitch, p.yaw, 0);
  }

  // troca o modelo 3D da arma (cada estilo tem lâmina, guarda e cabo próprios)
  setWeapon(def) {
    if (this.weaponId === def.id) return;
    this.weaponId = def.id;
    if (this.model) {
      this.aim.remove(this.model);
      this.model.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    }
    const w = buildSword(def);
    this.model = w.group;
    this.bladeMat = w.bladeMat;
    this.tipY = w.tipY;
    this.baseY = w.baseY;
    this.model.traverse((o) => { if (o.isMesh) { o.renderOrder = 10; o.frustumCulled = false; o.castShadow = false; } });
    this.aim.add(this.model);
  }

  tipWorld(v) { this.aim.updateWorldMatrix(true, false); return this.aim.localToWorld(v.set(0, this.tipY, 0)); }
  baseWorld(v) { this.aim.updateWorldMatrix(true, false); return this.aim.localToWorld(v.set(0, this.baseY + 0.15, 0)); }
}

class Trail {
  constructor(scene) {
    this.max = 28;
    this.pts = [];
    const n = this.max * 2;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < this.max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
    scene.add(this.mesh);
  }

  cut(life) { for (const p of this.pts) p.age = Math.max(p.age, life); }

  push(a, b, color, strength) {
    this.pts.unshift({ a: a.clone(), b: b.clone(), age: 0, c: color.clone().multiplyScalar(strength) });
    if (this.pts.length > this.max) this.pts.pop();
  }

  update(dt, life) {
    for (const p of this.pts) p.age += dt;
    while (this.pts.length && this.pts[this.pts.length - 1].age > life) this.pts.pop();
    const n = this.pts.length;
    for (let i = 0; i < n; i++) {
      const p = this.pts[i], f = Math.max(0, 1 - p.age / life), j = i * 6;
      this.pos[j] = p.a.x; this.pos[j + 1] = p.a.y; this.pos[j + 2] = p.a.z;
      this.pos[j + 3] = p.b.x; this.pos[j + 4] = p.b.y; this.pos[j + 5] = p.b.z;
      this.col[j] = p.c.r * f * 0.1; this.col[j + 1] = p.c.g * f * 0.1; this.col[j + 2] = p.c.b * f * 0.1;
      this.col[j + 3] = p.c.r * f; this.col[j + 4] = p.c.g * f; this.col[j + 5] = p.c.b * f;
    }
    const g = this.mesh.geometry;
    g.setDrawRange(0, Math.max(0, (n - 1) * 6));
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }
}

export class Combat {
  constructor(game) {
    this.game = game;
    this.R = new SwordRig(game.camera, 'R');
    this.L = new SwordRig(game.camera, 'L');
    this.L.root.visible = false;
    this.trailR = new Trail(game.scene);
    this.trailL = new Trail(game.scene);
    this.action = null;
    this.combo = 0;
    this.comboT = 0;
    this.queued = false;
    this.cd = {};
    this.post = 0;
    this.guard = false;
    this.guardT = 0;
    this.bob = 0;
    this.glow = 0;
    this.glowColor = new THREE.Color('#ffffff');
    this.prevR = false;
    this.sheathed = false;
    this.sheathAmt = 0;
    this.shown = true;
    this.prevL = false;
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
  }

  get dual() { const p = this.game.state?.player; return !!(p && p.dualBlades && p.offhand); }
  get busy() { return !!this.action || this.post > 0; }
  get locked() { return this.post > 0 || !!(this.action && !this.action.basic); }

  setVisible(v) {
    this.shown = v;
    this.updateVisibility();
  }

  updateVisibility() {
    const v = this.shown !== false && this.sheathAmt < 0.97;
    this.R.root.visible = v;
    this.L.root.visible = v && this.dual;
  }

  // Guardar / sacar a espada (tecla H). Atacar com a espada guardada saca automaticamente.
  setSheathed(on, quiet = false) {
    if (this.sheathed === on) return;
    if (on && this.busy) return;
    this.sheathed = on;
    this.guard = false;
    if (!quiet) Sfx.sheath(on);
  }

  toggleSheath() {
    this.setSheathed(!this.sheathed);
    this.game.ui.toast(this.sheathed ? 'Espada guardada (H para sacar)' : 'Espada em mãos');
  }

  refresh() {
    const p = this.game.state.player;
    this.R.setWeapon(weaponDef(p.weapon));
    if (p.offhand) this.L.setWeapon(weaponDef(p.offhand));
    this.updateVisibility();
  }

  reset() {
    this.action = null;
    this.post = 0;
    this.guard = false;
    this.queued = false;
    this.combo = 0;
    this.glow = 0;
  }

  basic() {
    if (this.sheathed) { this.setSheathed(false); return; }
    if (this.post > 0 || this.guard) return;
    if (this.action) {
      if (this.action.basic && this.action.t > this.action.dur * 0.4) this.queued = true;
      return;
    }
    if (this.comboT <= 0) this.combo = 0;
    const hand = this.dual && this.combo % 2 ? 'L' : 'R';
    this.start(BASIC[this.combo % 3].map((m) => ({ ...m, hand })), null, null);
    this.combo++;
  }

  skill(slot) {
    if (this.sheathed) { this.setSheathed(false); return; }
    const g = this.game, p = g.state.player;
    const id = p.slots[slot];
    if (!id) { g.ui.toast('Nenhuma Sword Skill neste atalho — abra o menu → Skills.', 'warn'); return; }
    const def = skillById(id);
    if (!def || this.busy) return;
    if (p.level < def.lvl) { g.ui.toast(`${def.name} requer nível ${def.lvl}.`, 'warn'); Sfx.error(); return; }
    if (def.dual && !this.dual) { g.ui.toast('Requer Dual Blades com uma arma secundária equipada.', 'warn'); Sfx.error(); return; }
    if ((this.cd[id] || 0) > 0) { Sfx.error(); return; }
    this.guard = false;
    this.cd[id] = def.cd * (g.stats().cdMul ?? 1);
    this.start(def.moves, def.color, def);
    Sfx.skillStart();
    g.ui.skillName(def);
  }

  start(moves, color, skill) {
    const keys = { R: [{ t: 0, p: { ...this.R.pose } }], L: [{ t: 0, p: { ...this.L.pose } }] };
    const hits = [], lunges = [], sounds = [];
    let t = skill ? 0.06 : 0;
    for (const m of moves) {
      const hand = m.hand || 'R';
      let [from, to] = movePoses(m);
      if (hand === 'L') { from = mirror(from); to = mirror(to); }
      const start = t;
      t += m.wind ?? 0.08;
      keys[hand].push({ t, p: from });
      sounds.push(t);
      hits.push({
        t: t + m.dur * 0.45, mul: m.mul, hand, done: false,
        reach: m.reach ?? (m.type === 'thrust' ? 3.8 : 3.3),
        arc: m.arc ?? (m.type === 'thrust' ? 0.55 : 0.3),
      });
      if (m.lunge) lunges.push({ a: start, b: t + m.dur * 0.5, v: m.lunge });
      t += m.dur;
      keys[hand].push({ t, p: to, swing: true });
    }
    t += 0.18;
    keys.R.push({ t, p: { ...IDLE } });
    keys.L.push({ t, p: mirror(IDLE) });
    this.action = { keys, hits, lunges, sounds, dur: t, t: 0, color: color ? new THREE.Color(color) : null, skill, basic: !skill, si: 0 };
    if (color) this.glowColor.set(color);
  }

  samplePose(keys, t, out) {
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
    const k0 = keys[i], k1 = keys[i + 1] || k0;
    const span = k1.t - k0.t;
    let f = span > 1e-5 ? Math.min(1, Math.max(0, (t - k0.t) / span)) : 1;
    f = k1.swing ? (f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2) : f * f * (3 - 2 * f);
    for (const k of KEYS) out[k] = k0.p[k] + (k1.p[k] - k0.p[k]) * f;
    return !!k1.swing && t >= k0.t && t <= k1.t;
  }

  update(dt) {
    const g = this.game, inp = g.input;
    for (const k in this.cd) if (this.cd[k] > 0) this.cd[k] = Math.max(0, this.cd[k] - dt);
    if (this.post > 0) this.post = Math.max(0, this.post - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    g.player.lunge = 0;
    const a = this.action;
    let swingR = false, swingL = false;
    if (a) {
      a.t += dt;
      for (const l of a.lunges) if (a.t >= l.a && a.t <= l.b) g.player.lunge = l.v;
      while (a.si < a.sounds.length && a.t >= a.sounds[a.si]) { if (a.skill) Sfx.skillSwing(); else Sfx.swing(); a.si++; }
      for (const h of a.hits) if (!h.done && a.t >= h.t) { h.done = true; g.performHit(h, a); }
      swingR = this.samplePose(a.keys.R, a.t, this.R.pose);
      swingL = this.samplePose(a.keys.L, a.t, this.L.pose);
      this.glow = a.color ? 1 : 0;
      if (a.t >= a.dur) {
        this.action = null;
        if (a.skill) this.post = a.skill.post;
        this.comboT = 0.8;
        if (this.queued) { this.queued = false; this.basic(); }
      }
    } else {
      const wantGuard = inp.mouse.buttons.has(2) && this.post <= 0 && !g.player.dead && !this.sheathed;
      if (wantGuard && !this.guard) { this.guard = true; this.guardT = 0; }
      if (!wantGuard) this.guard = false;
      if (this.guard) this.guardT += dt;
      const tR = this.guard ? GUARD : IDLE, tL = mirror(tR);
      const k = 1 - Math.exp(-dt * 14);
      const sp = Math.min(1, Math.hypot(g.player.vel.x, g.player.vel.z) / 5);
      this.bob += dt * sp * 7;
      const off = { px: Math.cos(this.bob) * 0.012 * sp, py: Math.sin(this.bob * 2) * 0.014 * sp };
      const offL = { px: -off.px, py: off.py };
      for (const kk of KEYS) {
        this.R.pose[kk] += (tR[kk] + (off[kk] || 0) - this.R.pose[kk]) * k;
        this.L.pose[kk] += (tL[kk] + (offL[kk] || 0) - this.L.pose[kk]) * k;
      }
      this.glow = Math.max(0, this.glow - dt * 3);
    }
    // animação de guardar/sacar: a espada desce para fora da tela e some
    this.sheathAmt += ((this.sheathed ? 1 : 0) - this.sheathAmt) * Math.min(1, dt * 9);
    if (Math.abs(this.sheathAmt - (this.sheathed ? 1 : 0)) < 0.002) this.sheathAmt = this.sheathed ? 1 : 0;
    for (const rig of [this.R, this.L]) {
      rig.pose.py -= this.sheathAmt * 0.75;
      rig.pose.pitch += this.sheathAmt * 0.9;
    }
    this.updateVisibility();
    this.R.apply();
    this.L.apply();
    for (const rig of [this.R, this.L]) {
      rig.pose.py += this.sheathAmt * 0.75;
      rig.pose.pitch -= this.sheathAmt * 0.9;
    }
    for (const rig of [this.R, this.L]) rig.bladeMat.emissive.copy(rig.bladeMat.userData.baseEmissive).add(GLOW_TMP.copy(this.glowColor).multiplyScalar(this.glow * 2.2));

    const col = a?.color || TRAIL_WHITE, strength = a?.color ? 2.4 : 0.6, life = a?.color ? 0.16 : 0.1;
    if (swingR) {
      if (!this.prevR) this.trailR.cut(life);
      this.trailR.push(this.R.baseWorld(this._a), this.R.tipWorld(this._b), col, strength);
    }
    if (swingL && this.L.root.visible) {
      if (!this.prevL) this.trailL.cut(life);
      this.trailL.push(this.L.baseWorld(this._a), this.L.tipWorld(this._b), col, strength);
    }
    this.prevR = swingR;
    this.prevL = swingL;
    this.trailR.update(dt, life);
    this.trailL.update(dt, life);
  }
}
