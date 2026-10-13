// Feitiços da classe Mago: cajado e livro em primeira pessoa, mana e 8 magias que substituem as Sword Skills.
// O poder mágico vem da arma equipada (upgrades da Lisbeth, armas raras, STR e runas continuam valendo).
import * as THREE from 'three';
import { Sfx } from './audio.js';

export const SPELLS = [
  { id: 'missile', name: 'Míssil Arcano', lvl: 1, mp: 8, cd: 1.2, mul: 1.7, color: '#b08aff', desc: 'Esfera rápida que persegue de leve o alvo.' },
  { id: 'fireball', name: 'Bola de Fogo', lvl: 4, mp: 22, cd: 5, mul: 2.3, color: '#ff7a2a', aoe: 3.4, desc: 'Explode ao bater, atingindo todos em volta.' },
  { id: 'ice', name: 'Lança de Gelo', lvl: 8, mp: 20, cd: 6, mul: 2.4, color: '#8ae8ff', pierce: true, slow: 3, desc: 'Atravessa os inimigos e deixa todos 50% mais lentos.' },
  { id: 'heal', name: 'Cura Arcana', lvl: 12, mp: 30, cd: 18, color: '#7aff9a', desc: 'Recupera 35% do HP ao longo de 3s (você e o time).' },
  { id: 'chain', name: 'Corrente Elétrica', lvl: 15, mp: 28, cd: 7, mul: 1.8, color: '#fff27a', chain: 4, desc: 'Um raio que salta entre até 4 inimigos.' },
  { id: 'shield', name: 'Escudo Arcano', lvl: 20, mp: 35, cd: 22, color: '#7ab8ff', desc: 'Barreira que absorve dano igual a 30% do seu HP por 8s.' },
  { id: 'meteor', name: 'Meteoro', lvl: 28, mp: 55, cd: 20, mul: 5, color: '#ff4a2a', aoe: 6, desc: 'Marca o chão para onde você olha; 1s depois cai um meteoro.' },
  { id: 'blizzard', name: 'Nevasca', lvl: 35, mp: 60, cd: 25, mul: 0.9, color: '#d8f4ff', aoe: 8, desc: 'Tempestade de gelo em volta de você: 8 golpes em 3s e lentidão.' },
];
export const spellById = (id) => SPELLS.find((s) => s.id === id);

const glow = (c, k = 2.4) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });

export class Spells {
  constructor(game) {
    this.game = game;
    this.cd = {};
    this.basicCd = 0;
    this.bolts = [];
    this.fx = [];
    this.pending = [];
    this.castAnim = 0;
    this.shield = 0;
    this.shieldT = 0;
    // cajado (mão direita) e livro (mão esquerda) presos à câmera
    const staff = new THREE.Group();
    staff.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 1.25, 10).translate(0, 0.45, 0), new THREE.MeshStandardMaterial({ color: '#6a4428', roughness: 0.7 })));
    this.orbMat = glow('#b08aff');
    this.orb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), this.orbMat);
    this.orb.position.y = 1.12;
    const claw = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 18), new THREE.MeshStandardMaterial({ color: '#d8b050', metalness: 0.8, roughness: 0.3 }));
    claw.position.y = 1.12;
    staff.add(this.orb, claw);
    staff.scale.setScalar(0.6);
    const book = new THREE.Group();
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.28), new THREE.MeshStandardMaterial({ color: '#4a2a7a', roughness: 0.6 }));
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.26), new THREE.MeshStandardMaterial({ color: '#f4ecd8', roughness: 0.9 }));
    pages.position.y = 0.03;
    this.sigil = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.045, 20).rotateX(-Math.PI / 2), glow('#c8a0ff', 2));
    this.sigil.position.y = 0.05;
    book.add(cover, pages, this.sigil);
    book.position.set(-0.34, -0.36, -0.62);
    book.rotation.set(0.75, 0.4, 0.15);
    book.scale.setScalar(0.62);
    for (const o of [staff, book]) { o.traverse((m) => { if (m.isMesh) { m.renderOrder = 10; m.frustumCulled = false; } }); o.visible = false; game.camera.add(o); }
    this.staff = staff;
    this.book = book;
  }

  get active() { return this.game.state?.player?.cls === 'mage'; }

  maxMp() { const p = this.game.state.player, st = this.game.stats(); return Math.round((100 + p.level * 4) * (1 + (st.mana || 0))); }

  setVisible(v) { this.staff.visible = v; this.book.visible = v; }

  // ─── uso ───
  power(mul) {
    const st = this.game.stats();
    return st.atkR * mul * (1 + (st.spellDmg || 0)) * (0.9 + Math.random() * 0.2);
  }

  hitEnemy(e, raw, color) {
    const g = this.game, st = g.stats();
    if (!e || e.dead || e.state === 'intro') return 0;
    const crit = Math.random() < st.crit;
    let dmg = raw * (crit ? 1.8 + st.critDmg : 1);
    if (st.execute && e.hp < e.maxHp * 0.3) dmg *= 1 + st.execute;
    if (st.bossDmg && (e.boss || e.elite || e.fieldBoss)) dmg *= 1 + st.bossDmg;
    // magia ignora metade da defesa
    dmg = Math.max(1, Math.round((dmg * 60) / (60 + e.defense * 0.5)));
    e.takeDamage(dmg, null, 0.4);
    const at = e.pos.clone().add(new THREE.Vector3(0, e.flyH ? 0 : e.height * 0.5, 0));
    g.effects.sparks(at, color, 12, 0.8);
    g.ui.damageNumber(at, dmg, crit ? 'crit' : 'skill');
    if (st.leech) { const p = g.state.player; p.hp = Math.min(st.maxHp, p.hp + dmg * st.leech); }
    return dmg;
  }

  aimDir() { return new THREE.Vector3(0, 0, -1).applyQuaternion(this.game.camera.quaternion); }
  handPos() { return this.orb.getWorldPosition(new THREE.Vector3()); }

  basic() {
    const g = this.game;
    if (g.combat.sheathed) { g.combat.setSheathed(false); return; }
    if (this.basicCd > 0) return;
    this.basicCd = 0.42;
    this.castAnim = 0.6;
    this.launch({ color: '#c8a0ff', speed: 30, dmg: this.power(0.85), r: 0.16, home: 0.6 });
    Sfx.swing();
  }

  cast(slot) {
    const g = this.game, p = g.state.player;
    if (g.combat.sheathed) { g.combat.setSheathed(false); return; }
    const id = (p.spellSlots || [])[slot], s = spellById(id);
    if (!s) { g.ui.toast('Nenhum feitiço neste atalho — abra o menu → Skills.', 'warn'); return; }
    if (p.level < s.lvl) { g.ui.toast(`${s.name} requer nível ${s.lvl}.`, 'warn'); Sfx.error(); return; }
    if ((this.cd[id] || 0) > 0) { Sfx.error(); return; }
    if ((p.mp ?? this.maxMp()) < s.mp) { Sfx.error(); g.ui.toast('Mana insuficiente.', 'warn'); return; }
    p.mp = (p.mp ?? this.maxMp()) - s.mp;
    this.cd[id] = s.cd * (g.stats().cdMul ?? 1);
    this.castAnim = 1;
    this.orbMat.color.set(s.color).multiplyScalar(2.4);
    g.ui.skillName({ name: s.name, color: s.color });
    g.quests.onSkill();
    Sfx.skillStart();
    const pl = g.player, st = g.stats();
    switch (s.id) {
      case 'missile': this.launch({ color: s.color, speed: 34, dmg: this.power(s.mul), r: 0.22, home: 2.5 }); break;
      case 'fireball': this.launch({ color: s.color, speed: 24, dmg: this.power(s.mul), r: 0.32, aoe: s.aoe }); break;
      case 'ice': this.launch({ color: s.color, speed: 40, dmg: this.power(s.mul), r: 0.25, pierce: true, slow: s.slow, stretch: true }); break;
      case 'heal': {
        pl.hot = { rate: (st.maxHp * 0.35) / 3, left: st.maxHp * 0.35 };
        for (const m of g.party.members) if (m.alive) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.35);
        g.effects.ring(pl.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), s.color, 3, 1, 2.5);
        break;
      }
      case 'chain': this.chainBolt(s); break;
      case 'shield': this.shield = st.maxHp * 0.3; this.shieldT = 8; g.effects.ring(pl.pos.clone().add(new THREE.Vector3(0, 1, 0)), s.color, 1.5, 0.6, 2); break;
      case 'meteor': this.meteor(s); break;
      case 'blizzard': this.pending.push({ kind: 'blizzard', t: 0, ticks: 0, s }); break;
      default: break;
    }
  }

  launch(o) {
    const g = this.game, geo = o.stretch ? new THREE.ConeGeometry(o.r * 0.8, o.r * 6, 8).rotateX(-Math.PI / 2) : new THREE.SphereGeometry(o.r, 14, 10);
    const m = new THREE.Mesh(geo, glow(o.color, 2.6));
    const pos = this.handPos(), dir = this.aimDir();
    m.position.copy(pos);
    if (o.stretch) m.lookAt(pos.clone().add(dir));
    g.scene.add(m);
    this.bolts.push({ ...o, m, pos, vel: dir.multiplyScalar(o.speed), life: 1.6, hit: new Set() });
  }

  chainBolt(s) {
    const g = this.game, pl = g.player, f = pl.forward();
    const alive = g.enemies.list.filter((e) => !e.dead && e.state !== 'intro' && !e.peaceful);
    let first = null, best = 1e9;
    for (const e of alive) {
      const dx = e.pos.x - pl.pos.x, dz = e.pos.z - pl.pos.z, d = Math.hypot(dx, dz);
      if (d > 22 || (dx * f.x + dz * f.z) / (d || 1) < 0.6) continue;
      if (d < best) { best = d; first = e; }
    }
    if (!first) { g.ui.toast('Nenhum inimigo à sua frente.', 'warn'); return; }
    const pts = [this.handPos()], hit = [];
    let cur = first;
    while (cur && hit.length < s.chain) {
      hit.push(cur);
      pts.push(cur.pos.clone().add(new THREE.Vector3(0, cur.flyH ? 0 : cur.height * 0.5, 0)));
      this.hitEnemy(cur, this.power(s.mul) * (1 - hit.length * 0.12), s.color);
      let nxt = null, nd = 8;
      for (const e of alive) { if (hit.includes(e) || e.dead) continue; const d = e.pos.distanceTo(cur.pos); if (d < nd) { nd = d; nxt = e; } }
      cur = nxt;
    }
    // raio em zigue-zague
    const zig = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      for (let k = 0; k < 6; k++) {
        const p0 = a.clone().lerp(b, k / 6), p1 = a.clone().lerp(b, (k + 1) / 6);
        if (k) p0.add(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4));
        zig.push(p0, p1);
      }
    }
    const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(zig), new THREE.LineBasicMaterial({ color: new THREE.Color(s.color).multiplyScalar(3), transparent: true }));
    g.scene.add(line);
    this.fx.push({ obj: line, t: 0, life: 0.35 });
    Sfx.hit(true);
  }

  meteor(s) {
    const g = this.game, cam = g.camera.position, dir = this.aimDir();
    let point = null;
    for (let d = 2; d <= 45; d += 0.5) {
      const p = cam.clone().addScaledVector(dir, d);
      if (p.y <= g.world.groundAt(p.x, p.z)) { point = p; break; }
    }
    if (!point) { const f = g.player.forward(); point = g.player.pos.clone().addScaledVector(f, 18); }
    point.y = g.world.groundAt(point.x, point.z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(s.aoe - 0.3, s.aoe, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(s.color).multiplyScalar(1.6), transparent: true, opacity: 0.7, depthWrite: false }));
    ring.position.copy(point).add(new THREE.Vector3(0, 0.1, 0));
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), glow('#ff6a2a', 1.8));
    rock.position.copy(point).add(new THREE.Vector3(6, 26, 4));
    g.scene.add(ring, rock);
    this.pending.push({ kind: 'meteor', t: 0, point, ring, rock, s });
  }

  explode(at, radius, raw, color, slow) {
    const g = this.game;
    g.effects.shockwave?.(at.clone().setY(g.world.groundAt(at.x, at.z)), color, radius);
    g.effects.sparks(at, color, 30, 1.4);
    for (const e of g.enemies.list) {
      if (e.dead || e.peaceful) continue;
      if (Math.hypot(e.pos.x - at.x, e.pos.z - at.z) <= radius + e.radius) { this.hitEnemy(e, raw, color); if (slow) e.slowT = slow; }
    }
    g.shake(0.25);
    Sfx.slam();
  }

  // escudo arcano absorve dano antes do HP
  absorb(dmg) {
    if (this.shield <= 0) return dmg;
    const a = Math.min(this.shield, dmg);
    this.shield -= a;
    if (this.shield <= 0) this.game.ui.toast('O Escudo Arcano se desfez.');
    return dmg - a;
  }

  update(dt) {
    const g = this.game, p = g.state?.player;
    const on = this.active && g.mode === 'play' && !g.indoor;
    const show = on && !g.combat.sheathed && g.combat.shown !== false;
    this.setVisible(show);
    if (!p) return;
    if (this.active) {
      const max = this.maxMp(), st = g.stats();
      p.mp = Math.min(max, (p.mp ?? max) + max * (0.045 + (st.manaRegen || 0)) * dt);
    }
    for (const k in this.cd) if (this.cd[k] > 0) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.basicCd = Math.max(0, this.basicCd - dt);
    if (this.shieldT > 0) { this.shieldT -= dt; if (this.shieldT <= 0) this.shield = 0; }
    // animação do cajado ao lançar
    this.castAnim = Math.max(0, this.castAnim - dt * 3);
    const c = this.castAnim, t = g.time, sp = Math.min(1, Math.hypot(g.player.vel.x, g.player.vel.z) / 5);
    this.staff.position.set(0.3 - c * 0.06, -0.6 + c * 0.1 + Math.sin(t * 7) * 0.01 * sp, -0.62 - c * 0.15);
    this.staff.rotation.set(-0.62 - c * 0.5, 0, -0.22);
    this.book.position.y = -0.36 + Math.sin(t * 7 + 1) * 0.008 * sp;
    this.orb.scale.setScalar(1 + Math.sin(t * 4) * 0.08 + c * 0.6);
    this.orbMat.color.lerp(new THREE.Color('#b08aff').multiplyScalar(2.4), dt * 2);
    this.sigil.rotation.y += dt * 1.5;
    // projéteis
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      if (b.home) {
        // leve perseguição ao inimigo mais perto da linha do tiro
        let best = null, bd = 1e9;
        const dir = b.vel.clone().normalize();
        for (const e of g.enemies.list) {
          if (e.dead || e.peaceful || b.hit.has(e)) continue;
          const to = e.pos.clone().add(new THREE.Vector3(0, e.flyH ? 0 : e.height * 0.5, 0)).sub(b.pos), d = to.length();
          if (d > 30 || to.normalize().dot(dir) < 0.85) continue;
          if (d < bd) { bd = d; best = to; }
        }
        if (best) b.vel.lerp(best.multiplyScalar(b.speed), Math.min(1, dt * b.home));
      }
      b.pos.addScaledVector(b.vel, dt);
      b.m.position.copy(b.pos);
      let done = b.life <= 0 || b.pos.y < g.world.groundAt(b.pos.x, b.pos.z);
      for (const e of g.enemies.list) {
        if (done || e.dead || e.peaceful || b.hit.has(e)) continue;
        const cy = e.pos.y + (e.flyH ? 0 : e.height * 0.5);
        if (Math.hypot(e.pos.x - b.pos.x, e.pos.z - b.pos.z) < e.radius + b.r + 0.3 && Math.abs(cy - b.pos.y) < e.height * 0.6 + 0.6) {
          b.hit.add(e);
          if (b.aoe) { this.explode(b.pos.clone(), b.aoe, b.dmg, b.color); done = true; }
          else { this.hitEnemy(e, b.dmg, b.color); if (b.slow) e.slowT = b.slow; if (!b.pierce) done = true; }
          Sfx.hit(false);
        }
      }
      if (done) {
        if (b.aoe && b.life > 0 && !b.hit.size) this.explode(b.pos.clone(), b.aoe, b.dmg, b.color);
        g.scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose();
        this.bolts.splice(i, 1);
      }
    }
    // magias com atraso (meteoro, nevasca)
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const q = this.pending[i];
      q.t += dt;
      if (q.kind === 'meteor') {
        const f = Math.min(1, q.t / 1);
        q.rock.position.copy(q.point).add(new THREE.Vector3(6 * (1 - f), 26 * (1 - f) + 0.5, 4 * (1 - f)));
        q.rock.rotation.x += dt * 6;
        q.ring.material.opacity = 0.4 + Math.sin(q.t * 20) * 0.3;
        if (f >= 1) {
          this.explode(q.point.clone().add(new THREE.Vector3(0, 0.5, 0)), q.s.aoe, this.power(q.s.mul), q.s.color);
          g.shake(0.6);
          for (const o of [q.ring, q.rock]) { g.scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
          this.pending.splice(i, 1);
        }
      } else if (q.kind === 'blizzard') {
        if (q.t >= q.ticks * 0.38) {
          q.ticks++;
          const at = g.player.pos.clone().add(new THREE.Vector3(0, 0.5, 0));
          for (let k = 0; k < 6; k++) { const a = Math.random() * 6.28, r = Math.random() * q.s.aoe; g.effects.sparks(at.clone().add(new THREE.Vector3(Math.cos(a) * r, 1 + Math.random() * 3, Math.sin(a) * r)), q.s.color, 6, 0.6); }
          for (const e of g.enemies.list) {
            if (e.dead || e.peaceful) continue;
            if (Math.hypot(e.pos.x - at.x, e.pos.z - at.z) <= q.s.aoe + e.radius) { this.hitEnemy(e, this.power(q.s.mul), q.s.color); e.slowT = 2; }
          }
          if (q.ticks >= 8) this.pending.splice(i, 1);
        }
      }
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      f.obj.material.opacity = 1 - f.t / f.life;
      if (f.t >= f.life) { g.scene.remove(f.obj); f.obj.geometry.dispose(); f.obj.material.dispose(); this.fx.splice(i, 1); }
    }
  }

  clear() {
    for (const b of this.bolts) this.game.scene.remove(b.m);
    for (const q of this.pending) for (const o of [q.ring, q.rock]) if (o) this.game.scene.remove(o);
    for (const f of this.fx) this.game.scene.remove(f.obj);
    this.bolts = []; this.pending = []; this.fx = [];
  }
}
