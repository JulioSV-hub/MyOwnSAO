// IA dos monstros e dos chefes de andar.
import * as THREE from 'three';
import { buildMonster, buildWeapon } from './monsters.js';
import { MONSTERS } from './data.js';
import { FLOOR_R, TOWN_R, ARENA_R } from './world.js';
import { Sfx } from './audio.js';
import { hdr } from './effects.js';

const TAMEABLE = new Set(['quad', 'flyer', 'slime', 'spider', 'cube']);

const RED = new THREE.Color('#ff2010');
const WHITE = new THREE.Color('#ffffff');
const angleTo = (from, to) => { const d = to - from; return Math.atan2(Math.sin(d), Math.cos(d)); };
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - (1 - t) * (1 - t);

export class Enemy {
  constructor(mgr, def, level, x, z, opts = {}) {
    this.mgr = mgr;
    this.game = mgr.game;
    this.def = def;
    this.level = level;
    this.boss = !!opts.boss;
    const m = buildMonster(def, this.boss);
    this.mesh = m.group; this.inner = m.inner; this.parts = m.parts; this.mats = m.mats;
    this.radius = m.radius; this.height = m.height;
    this.pos = new THREE.Vector3(x, 0, z);
    this.home = this.pos.clone();
    this.yaw = Math.random() * Math.PI * 2;
    const L = level;
    this.maxHp = Math.round((40 + 24 * L) * (this.boss ? (def.hpMul ?? 9) : (def.hp ?? 1)));
    this.hp = this.maxHp;
    this.atk = (6 + 3.4 * L) * (def.atk ?? 1) * (this.boss ? 1.3 : 1);
    this.defense = L * 2;
    this.speed = def.speed ?? (this.boss ? 4.8 : 4);
    const sc = def.scale || 1;
    this.flyH = def.arch === 'flyer' ? 1.5 * Math.min(sc, 1.6) : def.arch === 'cube' ? 0.9 * sc : 0;
    this.state = this.boss ? 'intro' : 'idle';
    this.t = 0;
    this.timer = Math.random() * 3;
    this.cool = 1.2;
    this.stun = 0;
    this.flash = 0;
    this.glow = 0;
    this.walk = Math.random() * 10;
    this.moving = 0;
    this.atkProg = 0;
    this.dist = 0;
    this.knock = new THREE.Vector3();
    this.aggro = !!opts.aggro;
    this.aggroInArena = !!opts.arena;
    this.dead = false;
    this.removeT = 0;
    this.attack = null;
    this.bars = this.boss ? (def.bars || 3) : 1;
    this.bar = this.bars;
    this.enraged = false;
    this.game.scene.add(this.mesh);
    this.label = this.boss ? null : this.game.ui.createEnemyLabel(this);
    this.pos.y = this.game.world.groundAt(x, z) + this.flyH;
    this.syncMesh();
  }

  face(tx, tz, rate, dt) {
    const target = Math.atan2(-(tx - this.pos.x), -(tz - this.pos.z));
    const d = angleTo(this.yaw, target);
    this.yaw += Math.max(-rate * dt, Math.min(rate * dt, d));
  }

  moveTo(tx, tz, speed, dt, stop = 0) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    if (d > stop + 0.01) {
      const step = Math.min(speed * dt, d - stop);
      this.pos.x += (dx / d) * step;
      this.pos.z += (dz / d) * step;
      this.moving = speed;
      this.face(tx, tz, 8, dt);
    }
    return d;
  }

  update(dt) {
    if (this.dead) return;
    const g = this.game, pl = g.player, w = g.world;
    const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
    this.dist = dist;
    this.moving = 0;
    const pSafe = pl.dead || w.inSafeZone(pl.pos);
    this.flash = Math.max(0, this.flash - dt * 7);

    if (this.stun > 0) {
      this.stun -= dt;
      this.inner.rotation.z = Math.sin(g.time * 22) * 0.12;
      if (this.stun <= 0) { this.state = 'chase'; this.inner.rotation.z = 0; this.cool = 0.4; }
    } else if (this.boss) {
      this.updateBoss(dt, dx, dz, dist);
    } else {
      this.updateNormal(dt, dx, dz, dist, pSafe);
    }

    if (this.knock.lengthSq() > 0.01) {
      this.pos.addScaledVector(this.knock, dt);
      this.knock.multiplyScalar(Math.max(0, 1 - dt * 6));
    }
    for (const o of this.mgr.list) {
      if (o === this || o.dead) continue;
      const ox = this.pos.x - o.pos.x, oz = this.pos.z - o.pos.z, m = this.radius + o.radius, d2 = ox * ox + oz * oz;
      if (d2 < m * m && d2 > 1e-4) {
        const d = Math.sqrt(d2), push = (m - d) * (o.boss ? 1 : 0.5);
        this.pos.x += (ox / d) * push;
        this.pos.z += (oz / d) * push;
      }
    }
    w.resolve(this.pos, this.radius * 0.8);
    const dc = Math.hypot(this.pos.x, this.pos.z);
    if (dc < TOWN_R + 2) { const k = (TOWN_R + 2) / Math.max(dc, 0.01); this.pos.x *= k; this.pos.z *= k; }
    if (dc > FLOOR_R - 3) { const k = (FLOOR_R - 3) / dc; this.pos.x *= k; this.pos.z *= k; }
    const ax = this.pos.x - w.arenaPos.x, az = this.pos.z - w.arenaPos.z, da = Math.hypot(ax, az);
    if (this.boss || this.aggroInArena) {
      if (da > ARENA_R - 2) { const k = (ARENA_R - 2) / da; this.pos.x = w.arenaPos.x + ax * k; this.pos.z = w.arenaPos.z + az * k; }
    } else if (da < ARENA_R + 2) {
      const k = (ARENA_R + 2) / Math.max(da, 0.01); this.pos.x = w.arenaPos.x + ax * k; this.pos.z = w.arenaPos.z + az * k;
    }
    const gy = w.groundAt(this.pos.x, this.pos.z);
    this.pos.y = gy + this.flyH + (this.flyH ? Math.sin(g.time * 2 + this.walk * 0.3) * 0.25 : 0);

    // empurra o jogador para fora do corpo do monstro
    const m = this.radius + pl.radius, px = pl.pos.x - this.pos.x, pz = pl.pos.z - this.pos.z, pd = Math.hypot(px, pz);
    if (pd < m && pd > 1e-3 && Math.abs(pl.pos.y - (this.pos.y - this.flyH)) < this.height + 0.4) {
      pl.pos.x = this.pos.x + (px / pd) * m;
      pl.pos.z = this.pos.z + (pz / pd) * m;
    }

    this.animate(dt);
    this.syncMesh();
  }

  updateNormal(dt, dx, dz, dist, pSafe) {
    const g = this.game, d = this.def;
    // alvo: o jogador ou um companheiro do time que chamou a atenção do monstro
    if (this.tgtC && !this.tgtC.alive) this.tgtC = null;
    const tc = this.tgtC;
    const tp = tc ? tc.pos : g.player.pos;
    if (tc) { dx = tp.x - this.pos.x; dz = tp.z - this.pos.z; dist = Math.hypot(dx, dz); pSafe = false; }
    switch (this.state) {
      case 'idle':
        this.timer -= dt;
        if (this.timer <= 0) {
          const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 8;
          this.wander = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r };
          this.state = 'wander';
          this.timer = 6;
        }
        break;
      case 'wander':
        this.timer -= dt;
        if (this.moveTo(this.wander.x, this.wander.z, this.speed * 0.35, dt) < 0.5 || this.timer <= 0) {
          this.state = 'idle';
          this.timer = 2 + Math.random() * 4;
        }
        break;
      case 'chase': {
        if (pSafe || Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z) > 70) {
          this.tgtC = null;
          this.state = 'return';
          this.aggro = false;
          break;
        }
        const reach = d.range + 0.35;
        this.face(tp.x, tp.z, 8, dt);
        if (dist > reach) this.moveTo(tp.x, tp.z, this.speed, dt, reach);
        this.cool -= dt;
        if (dist <= reach + 0.4 && this.cool <= 0) { this.state = 'windup'; this.t = 0; }
        break;
      }
      case 'windup': {
        this.t += dt;
        this.atkProg = Math.min(1, this.t / d.windup);
        this.glow = this.atkProg;
        this.face(tp.x, tp.z, 3, dt);
        if (this.t >= d.windup) {
          this.glow = 0;
          this.atkProg = 0;
          const facing = Math.abs(angleTo(this.yaw, Math.atan2(-dx, -dz))) < 1.2;
          const dy = Math.abs(tp.y - (this.pos.y - this.flyH));
          if (!pSafe && facing && dist <= d.range + 1.3 && dy < 2.2) { if (tc) tc.takeHit(this.atk, this); else g.damagePlayer(this.atk, this); }
          if (d.arch === 'quad' || d.arch === 'slime' || d.arch === 'spider') {
            this.knock.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).multiplyScalar(4);
          }
          this.state = 'recover';
          this.t = 0;
          this.cool = 0.9 + Math.random() * 0.9;
        }
        break;
      }
      case 'recover':
        this.t += dt;
        if (this.t > 0.55) this.state = 'chase';
        break;
      case 'return':
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3 * dt);
        if (this.moveTo(this.home.x, this.home.z, this.speed, dt) < 1.5) { this.state = 'idle'; this.timer = 2; }
        break;
      default:
        this.state = 'chase';
    }
    if ((this.state === 'idle' || this.state === 'wander') && !pSafe && ((dist < d.aggro && !this.docile) || this.aggro)) {
      this.state = 'chase';
      this.cool = 0.6;
    }
  }

  // ─────────── Chefe ───────────
  updateBoss(dt, dx, dz, dist) {
    const g = this.game, pl = g.player;
    const reach = this.radius + 3.2;
    switch (this.state) {
      case 'intro': {
        this.t += dt;
        const f = Math.min(1, this.t / 1.6);
        this.inner.position.y = -(1 - easeOut(f)) * this.height;
        this.face(pl.pos.x, pl.pos.z, 2, dt);
        if (this.t > 2.4) { this.state = 'chase'; this.inner.position.y = 0; this.cool = 1; }
        break;
      }
      case 'chase':
        this.face(pl.pos.x, pl.pos.z, 3, dt);
        if (dist > reach - 0.5) this.moveTo(pl.pos.x, pl.pos.z, this.speed * (this.enraged ? 1.25 : 1), dt, reach - 0.5);
        this.cool -= dt;
        if (this.cool <= 0 && !pl.dead) this.chooseAttack(dist, reach);
        break;
      case 'bwind': {
        const a = this.attack;
        this.t += dt;
        this.atkProg = Math.min(1, this.t / a.wind);
        this.glow = this.atkProg;
        if (a.type === 'swipe') {
          this.face(pl.pos.x, pl.pos.z, 1.4, dt);
          a.decal.position.set(this.pos.x, g.world.arenaH + 0.12, this.pos.z);
          a.decal.rotation.y = this.yaw;
        }
        this.updateDecal(a);
        if (this.t >= a.wind) this.execute(a, dist, dx, dz);
        break;
      }
      case 'charging': {
        const a = this.attack;
        this.t += dt;
        this.pos.x += a.dir.x * 22 * dt;
        this.pos.z += a.dir.z * 22 * dt;
        this.moving = 8;
        if (!a.hit && Math.hypot(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z) < this.radius + 1.3) {
          a.hit = true;
          g.damagePlayer(this.atk * 1.2, this);
        }
        if (this.t > a.dur) { this.state = 'recover'; this.t = 0; this.atkProg = 0; this.glow = 0; }
        break;
      }
      case 'recover':
        this.t += dt;
        if (this.t > (this.enraged ? 0.55 : 0.85)) this.state = 'chase';
        break;
      default:
        this.state = 'chase';
    }
  }

  chooseAttack(dist, reach) {
    const r = Math.random(), pl = this.game.player, w = this.game.world;
    let type;
    if (dist > 11) type = r < 0.55 ? 'charge' : 'slam';
    else if (dist < reach + 1) type = r < 0.65 ? 'swipe' : 'slam';
    else type = r < 0.5 ? 'slam' : 'charge';
    if (this.def.arch === 'cube' && type === 'swipe') type = 'slam';
    const k = this.enraged ? 0.72 : 1;
    const a = { type, wind: { swipe: 0.95, slam: 1.25, charge: 0.9 }[type] * k };
    const y = w.arenaH + 0.12;
    if (type === 'swipe') {
      a.reach = reach + 0.8;
      a.half = 1.05;
      a.decal = this.makeDecal('cone', a.reach, a.half);
      a.decal.position.set(this.pos.x, y, this.pos.z);
      a.decal.rotation.y = this.yaw;
    } else if (type === 'slam') {
      a.r = 5.5 + this.radius * 0.6;
      a.x = pl.pos.x;
      a.z = pl.pos.z;
      a.decal = this.makeDecal('circle', a.r);
      a.decal.position.set(a.x, y, a.z);
    } else {
      this.yaw = Math.atan2(-(pl.pos.x - this.pos.x), -(pl.pos.z - this.pos.z));
      a.dir = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      a.dur = 0.6;
      a.decal = this.makeDecal('rect', 22 * a.dur + this.radius, this.radius * 1.8);
      a.decal.position.set(this.pos.x, y, this.pos.z);
      a.decal.rotation.y = this.yaw;
    }
    this.attack = a;
    this.state = 'bwind';
    this.t = 0;
  }

  execute(a, dist, dx, dz) {
    const g = this.game, pl = g.player;
    this.glow = 0;
    this.atkProg = 0;
    this.removeDecal();
    this.attack = a;
    const airborne = pl.pos.y - g.world.groundAt(pl.pos.x, pl.pos.z) > 0.9;
    if (a.type === 'swipe') {
      const ang = Math.abs(angleTo(this.yaw, Math.atan2(-dx, -dz)));
      if (dist <= a.reach + 0.4 && ang <= a.half + 0.1) g.damagePlayer(this.atk * 1.1, this);
      Sfx.swing();
      g.shake(0.25);
      this.state = 'recover';
    } else if (a.type === 'slam') {
      if (Math.hypot(pl.pos.x - a.x, pl.pos.z - a.z) <= a.r && !airborne) g.damagePlayer(this.atk * 1.5, this);
      g.effects.shockwave(new THREE.Vector3(a.x, g.world.arenaH, a.z), '#ff6a3a', a.r);
      Sfx.slam();
      g.shake(0.6);
      this.state = 'recover';
    } else {
      this.state = 'charging';
      a.hit = false;
      Sfx.dash();
    }
    this.t = 0;
    this.cool = (this.enraged ? 0.9 : 1.6) + Math.random() * 0.8;
  }

  makeDecal(kind, size, extra) {
    let geo;
    if (kind === 'circle') geo = new THREE.CircleGeometry(size, 40);
    else if (kind === 'cone') geo = new THREE.CircleGeometry(size, 32, Math.PI / 2 - extra, extra * 2);
    else geo = new THREE.PlaneGeometry(extra, size).translate(0, size / 2, 0);
    geo.rotateX(-Math.PI / 2);
    const mk = (k, o) => new THREE.MeshBasicMaterial({ color: hdr('#ff3020', k), transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending });
    const base = new THREE.Mesh(geo, mk(1, 0.25));
    const fill = new THREE.Mesh(geo, mk(1.6, 0.4));
    fill.scale.setScalar(0.01);
    const grp = new THREE.Group();
    grp.add(base, fill);
    grp.userData = { fill, kind };
    this.game.scene.add(grp);
    return grp;
  }

  updateDecal(a) {
    const f = Math.max(0.01, this.atkProg), { fill, kind } = a.decal.userData;
    if (kind === 'rect') fill.scale.set(1, 1, f);
    else fill.scale.setScalar(f);
  }

  removeDecal() {
    const d = this.attack?.decal;
    if (!d) return;
    this.game.scene.remove(d);
    d.children[0].geometry.dispose();
    d.children.forEach((c) => c.material.dispose());
    this.attack.decal = null;
  }

  // ─────────── Dano e morte ───────────
  takeDamage(dmg, knockDir, power = 1) {
    if (this.dead || this.state === 'intro') return 0;
    this.hp -= dmg;
    this.flash = 1;
    this.aggro = true;
    if (this.docile) { this.docile = false; this.label?.el.classList.remove('docile'); }
    if (this.state === 'idle' || this.state === 'wander' || this.state === 'return') {
      this.state = 'chase';
      this.cool = Math.min(this.cool, 0.6);
    }
    if (!this.boss && knockDir) this.knock.copy(knockDir).multiplyScalar(3.5 * power);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    } else if (this.boss) {
      this.checkBars();
    }
    return dmg;
  }

  checkBars() {
    const per = this.maxHp / this.bars;
    const bar = Math.max(1, Math.ceil(this.hp / per));
    if (bar < this.bar) {
      this.bar = bar;
      this.game.onBossBar(this, bar);
      if (bar === 1 && !this.enraged) this.enrage();
    }
  }

  enrage() {
    this.enraged = true;
    const d = this.def, p = this.parts;
    if (d.enrageWeapon && p.weaponHolder) {
      p.weaponHolder.clear();
      p.weaponHolder.add(buildWeapon(d.enrageWeapon, p.metal, p.acc));
      if (p.shield) p.shield.visible = false;
    }
    this.game.ui.banner(d.enrageText || `${d.name} está enfurecido!`, 'ÚLTIMA BARRA DE HP', 3);
    Sfx.roar();
    this.game.shake(0.5);
  }

  stunFor(s) {
    this.stun = this.boss ? s * 0.5 : s;
    this.atkProg = 0;
    this.glow = 0;
    this.removeDecal();
    if (this.state === 'charging' || this.state === 'bwind' || this.state === 'windup') this.state = 'recover';
  }

  die() {
    this.dead = true;
    this.mesh.visible = false;
    this.removeDecal();
    this.label?.remove();
    this.label = null;
    const c = this.pos.clone();
    c.y -= this.flyH * 0.5;
    this.game.effects.shatter(c, this.def.color, Math.max(1, this.height * 0.5), this.boss ? 160 : 46);
    Sfx.shatter();
    this.game.onEnemyKilled(this);
  }

  destroy() {
    this.removeDecal();
    this.game.scene.remove(this.mesh);
    this.mesh.traverse((o) => { if (o.material) o.material.dispose(); });
    this.label?.remove();
    this.label = null;
  }

  // ─────────── Visual ───────────
  syncMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
    for (const m of this.mats) {
      m.emissive.copy(m.userData.base);
      if (this.glow > 0) m.emissive.lerp(RED, this.glow * 0.5);
      if (this.flash > 0) m.emissive.lerp(WHITE, this.flash * 0.55);
    }
  }

  animate(dt) {
    const p = this.parts, a = this.def.arch, t = this.game.time, inner = this.inner, base = inner.userData.s;
    const mv = this.moving > 0;
    this.walk += dt * (mv ? 4 + this.moving * 1.4 : 0);
    const s = Math.sin(this.walk), amp = mv ? 0.65 : 0;
    const w = this.atkProg;
    const rec = this.state === 'recover' ? this.t : -1;
    if (a === 'quad') {
      p.legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3 ? s : -s) * amp; });
      p.head.rotation.x = w * 0.5 - (rec >= 0 && rec < 0.2 ? 0.6 : 0);
      inner.position.z = w * 0.25 * base;
      if (!this.boss || this.state !== 'intro') inner.position.y = mv ? Math.abs(s) * 0.05 * base : 0;
    } else if (a === 'humanoid') {
      p.legs[0].rotation.x = s * amp;
      p.legs[1].rotation.x = -s * amp;
      p.arms[0].rotation.x = -s * amp * 0.7;
      let ra = s * amp * 0.7;
      if (w > 0) ra = 2.8 * easeOut(w);
      else if (rec >= 0) ra = rec < 0.12 ? lerp(2.8, 0.9, rec / 0.12) : lerp(0.9, 0, Math.min(1, (rec - 0.12) / 0.4));
      p.arms[1].rotation.x = ra;
      if (this.attack?.type === 'slam' && w > 0) p.arms[0].rotation.x = 2.8 * w;
      inner.rotation.x = -w * 0.12 + (rec >= 0 && rec < 0.2 ? 0.15 : 0);
      if (!this.boss || this.state !== 'intro') inner.position.y = mv ? Math.abs(s) * 0.04 * base : 0;
    } else if (a === 'flyer') {
      const f = Math.sin(t * 22 + this.walk) * 0.6;
      p.wings.forEach((wg, i) => { wg.rotation.z = i ? -f : f; });
      inner.rotation.x = -w * 0.7 + (rec >= 0 && rec < 0.25 ? 0.5 : 0);
    } else if (a === 'slime') {
      const b = Math.abs(Math.sin(this.walk * 0.8 + t * 2));
      const pop = rec >= 0 && rec < 0.2 ? 0.3 : 0;
      inner.scale.set(base * (1 + w * 0.15), base * (1 - w * 0.35 + b * 0.12 + pop), base * (1 + w * 0.15));
      if (!this.boss || this.state !== 'intro') inner.position.y = mv ? b * 0.25 * base : 0;
    } else if (a === 'spider') {
      p.legs.forEach((l, i) => {
        if (l.userData.by === undefined) l.userData.by = l.rotation.y;
        l.rotation.y = l.userData.by + Math.sin(this.walk * 1.5 + i * 1.3) * amp * 0.4;
      });
      p.arms.forEach((arm) => { arm.rotation.x = -0.3 - w * 1.4 + (rec >= 0 && rec < 0.2 ? 1.6 : 0); });
      inner.rotation.x = -w * 0.2;
    } else if (a === 'cube') {
      p.cube.rotation.y += dt * (0.8 + w * 8);
      p.cube.rotation.x += dt * (0.5 + w * 4);
      p.core.scale.setScalar(1 + Math.sin(t * 5) * 0.2 + w * 0.8);
    }
  }
}

export class EnemyManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.spawnT = 0;
    this.target = 22;
  }

  get boss() { return this.list.find((e) => e.boss && !e.dead) || null; }

  clear() {
    for (const e of this.list) e.destroy();
    this.list = [];
  }

  pickDef() {
    const ids = this.game.floor.monsters;
    return MONSTERS[ids[Math.floor(Math.random() * ids.length)]];
  }

  levelFor() { return this.game.floor.level + Math.floor(Math.random() * 3); }

  spawnOne(near, minD, maxD) {
    const def = this.pickDef();
    const p = this.game.world.randomSpawn(near, minD, maxD, def.arch === 'flyer');
    if (!p) return null;
    const e = new Enemy(this, def, this.levelFor(), p.x, p.z);
    // de vez em quando um monstro aparece dócil e pode ser domado
    if (TAMEABLE.has(def.arch) && Math.random() < 0.07) {
      e.docile = true;
      e.label?.el.classList.add('docile');
    }
    this.list.push(e);
    return e;
  }

  spawnAt(def, level, x, z, opts) {
    const e = new Enemy(this, def, level, x, z, opts);
    this.list.push(e);
    return e;
  }

  populate() {
    for (let i = 0; i < this.target; i++) this.spawnOne({ x: 0, z: 0 }, 45, 210);
  }

  update(dt) {
    for (const e of this.list) e.update(dt);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.dead) {
        e.removeT += dt;
        if (e.removeT > 0.1) { e.destroy(); this.list.splice(i, 1); }
      } else if (!e.boss && e.state !== 'chase' && e.dist > 200) {
        e.destroy();
        this.list.splice(i, 1);
      }
    }
    this.spawnT -= dt;
    let normals = 0;
    for (const e of this.list) if (!e.boss) normals++;
    if (this.spawnT <= 0 && normals < this.target) {
      this.spawnOne(this.game.player.pos, 45, 130);
      this.spawnT = 1.5;
    }
  }
}
