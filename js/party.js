// Time: até 2 companheiros (3 com posto C na Guilda) que seguem você, lutam, curam e podem ser atacados.
// Companheiros usam sempre os bonecos do jogo — os modelos .vrm (como os do Kirito e da Asuna) não podem
// aparecer em cenas de combate pelas regras dos autores.
import * as THREE from 'three';
import { buildCharacter, animateCharacter, CAST, randomTownsfolk } from './characters.js';
import { buildSword } from './gear3d.js';
import { MERCS, CAST_PARTY } from './data.js';
import { mulberry32 } from './rng.js';
import { guildRank } from './guild.js';
import { Sfx } from './audio.js';

const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

class Companion {
  constructor(mgr, data, slot) {
    this.mgr = mgr;
    this.game = mgr.game;
    this.data = data;
    this.slot = slot;
    const spec = data.kind === 'cast' ? CAST_PARTY[data.id] : MERCS[data.cls];
    this.spec = spec;
    const def = data.kind === 'cast'
      ? { ...CAST[data.id], id: undefined }
      : { ...randomTownsfolk(mulberry32(data.seed || 7), false), ...spec.look, name: data.name, kid: false };
    this.name = data.name || CAST[data.id]?.name || spec.name;
    this.c = buildCharacter({ ...def, sword: null });
    this.mesh = this.c.group;
    const k = def.kid ? 0.68 : def.big ? 1.12 : 1;
    this.mesh.scale.setScalar((def.female ? 1.64 : 1.74) / (1.78 * k));
    // espada na mão direita
    const sw = buildSword({ style: data.id === 'asuna' ? 'rapier' : data.id === 'klein' ? 'katana' : data.cls === 'lance' ? 'rapier' : 'long', blade: def.sword || '#c8d0d8', guard: def.accent || '#7a7a82', grip: '#3a2a20' }).group;
    if (data.cls === 'lance') sw.scale.set(1, 1.7, 1);
    sw.scale.multiplyScalar(0.85);
    sw.position.set(0, -0.54, -0.02);
    sw.rotation.x = -Math.PI / 2 + 0.3;
    this.c.parts.arms[1].add(sw);
    this.sword = sw;
    this.mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.game.scene.add(this.mesh);
    this.label = this.game.ui.createAllyLabel(this);
    const lv = this.game.state.player.level;
    this.maxHp = Math.round((140 + lv * 32) * spec.hp);
    this.hp = data.hp != null ? Math.min(this.maxHp, data.hp) : this.maxHp;
    this.radius = 0.36;
    this.height = 1.7;
    this.defense = lv * 1.6 * spec.hp;
    this.pos = this.game.player.pos.clone().add(new THREE.Vector3(slot ? 1.4 : -1.4, 0, 1.6));
    this.yaw = this.game.player.yaw;
    this.cool = 0.5;
    this.healCool = 6;
    this.swing = 0;
    this.target = null;
    this.down = data.downT > 0 ? data.downT : 0;
    this.mesh.visible = !this.down;
  }

  get alive() { return this.down <= 0; }

  takeHit(raw, src) {
    if (!this.alive) return;
    const dmg = Math.max(1, Math.round((raw * (0.9 + Math.random() * 0.2) * 60) / (60 + this.defense)));
    this.hp -= dmg;
    this.game.ui.damageNumber(this.pos.clone().add(new THREE.Vector3(0, 1.9, 0)), dmg, 'allyhurt');
    if (this.hp <= 0) {
      this.hp = 0;
      this.down = 45;
      this.mesh.visible = false;
      this.game.effects.ring(this.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), '#4ab8ff', 1.6, 0.8, 2);
      Sfx.teleport();
      this.game.ui.toast(`${this.name} ficou sem HP e usou um Cristal de Teletransporte para escapar! Volta em 45s.`, 'warn');
      for (const e of this.game.enemies.list) if (e.tgtC === this) e.tgtC = null;
    }
  }

  update(dt, t) {
    const g = this.game, pl = g.player, w = g.world;
    this.data.hp = this.hp;
    this.data.downT = this.down;
    if (!this.alive) {
      this.down -= dt;
      if (this.down <= 0) {
        this.down = 0;
        this.hp = this.maxHp * 0.6;
        const b = pl.forward().multiplyScalar(-1.8);
        this.pos.set(pl.pos.x + b.x, pl.pos.y, pl.pos.z + b.z);
        this.mesh.visible = !g.indoor;
        g.effects.ring(this.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), '#4ab8ff', 1.4, 0.8, 1.6);
        g.ui.toast(`${this.name} voltou ao time!`, 'skill');
      }
      this.label.el.style.display = 'none';
      return;
    }
    if (g.indoor) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    this.cool -= dt;
    this.healCool -= dt;
    this.swing = Math.max(0, this.swing - dt * 3.2);
    const st = g.stats(), php = g.state.player.hp;
    const safe = w.inSafeZone(this.pos);
    if (safe || !this.target) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * (safe ? 0.1 : 0.015) * dt);
    // cura (Clériga, Asuna, Silica com a Pina)
    if (this.spec.heals && this.healCool <= 0 && !pl.dead && php < st.maxHp * 0.6) {
      this.healCool = 11;
      const heal = Math.round(st.maxHp * 0.18);
      g.state.player.hp = Math.min(st.maxHp, php + heal);
      g.effects.ring(pl.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), '#7aff9a', 1.3, 0.8, 1.6);
      g.ui.damageNumber(pl.pos.clone().add(new THREE.Vector3(0, 1.8, 0)), `+${heal}`, 'heal');
      g.ui.toast(`${this.name}: "${data(this).healLine}"`);
    }
    // alvo: monstro brigando com você ou com o time, perto do jogador
    if (!this.target || this.target.dead || this.target.dist > 26) {
      let best = null, bd = 18;
      for (const e of g.enemies.list) {
        if (e.dead || e.docile || e.state === 'intro') continue;
        const fighting = e.boss || e.state === 'chase' || e.state === 'windup' || e.state === 'recover' || e.state === 'bwind' || e.state === 'charging';
        if (!fighting || e.dist > 20) continue;
        const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
        if (d < bd) { bd = d; best = e; }
      }
      this.target = best;
    }
    let tx, tz, stop, speed;
    if (this.target) {
      tx = this.target.pos.x; tz = this.target.pos.z; stop = this.target.radius + this.spec.reach * 0.7; speed = 6.4;
    } else {
      // formação à frente e dos lados, dentro do campo de visão (antes ficavam atrás e ninguém via)
      const f = pl.forward(), side = this.slot === 0 ? -1 : this.slot === 1 ? 1 : 0;
      const ahead = side ? 3.2 : 5.5, wide = side ? 2.1 : -0.6;
      tx = pl.pos.x + f.x * ahead - f.z * side * wide;
      tz = pl.pos.z + f.z * ahead + f.x * side * wide;
      stop = 0.35; speed = Math.max(5.6, Math.hypot(pl.vel.x, pl.vel.z) * 1.25 + 1);
    }
    const dx = tx - this.pos.x, dz = tz - this.pos.z, dd = Math.hypot(dx, dz);
    let moving = 0;
    if (dd > 34) { this.pos.set(tx, 0, tz); }
    else if (dd > stop) {
      const sp = Math.min(speed * (dd > 7 ? 1.5 : 1), dd * 4);
      this.pos.x += (dx / dd) * sp * dt;
      this.pos.z += (dz / dd) * sp * dt;
      moving = sp;
      this.yaw += angleTo(this.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 8);
    } else if (this.target) {
      this.yaw += angleTo(this.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 10);
      if (this.cool <= 0) this.attack(dx / (dd || 1), dz / (dd || 1));
    } else {
      // parado: vira um pouco para você (dá para ver o rosto); andando: olha para a frente
      const still = Math.hypot(pl.vel.x, pl.vel.z) < 0.5;
      const face = still ? Math.atan2(-(pl.pos.x - this.pos.x), -(pl.pos.z - this.pos.z)) : pl.yaw;
      this.yaw += angleTo(this.yaw, face) * Math.min(1, dt * 3);
    }
    w.resolve(this.pos, this.radius);
    this.pos.y = w.groundAt(this.pos.x, this.pos.z);
    animateCharacter(this.c, dt, t, moving, 0, false);
    // golpe de espada: o braço direito sobe e desce
    if (this.swing > 0) {
      const s = this.swing;
      this.c.parts.arms[1].rotation.x = s > 0.6 ? 2.6 * ((1 - s) / 0.4) : 2.6 * (s / 0.6) - 0.4 * (1 - s / 0.6);
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
  }

  attack(nx, nz) {
    const g = this.game, e = this.target, lv = g.state.player.level;
    this.cool = this.spec.fast ? 0.75 : this.data.cls === 'lance' ? 1.35 : 1.05;
    this.swing = 1;
    const base = (9 + lv * 5.5) * this.spec.dmg;
    const crit = Math.random() < 0.12;
    const dmg = Math.max(1, Math.round((base * (crit ? 1.7 : 1) * (0.9 + Math.random() * 0.2) * 60) / (60 + e.defense)));
    const at = e.pos.clone().add(new THREE.Vector3(0, e.flyH ? 0 : e.height * 0.5, 0));
    e.takeDamage(dmg, new THREE.Vector3(nx, 0, nz), 0.5);
    // o monstro atingido pode passar a mirar o companheiro (o Guardião atrai sempre)
    if (!e.dead && !e.boss && (this.spec.taunt || Math.random() < 0.45)) e.tgtC = this;
    g.effects.sparks(at, crit ? '#ffe08a' : '#cfe8ff', 8);
    g.ui.damageNumber(at, dmg, crit ? 'allycrit' : 'ally');
    Sfx.hit(false);
  }

  destroy() {
    this.game.scene.remove(this.mesh);
    this.mesh.traverse((o) => { if (o.material && !o.userData.outline) o.material.dispose?.(); });
    this.label?.remove();
    for (const e of this.game.enemies.list) if (e.tgtC === this) e.tgtC = null;
  }
}

const LINES = {
  kirito: { healLine: '' }, asuna: { healLine: 'Segura firme, eu cuido de você!' }, klein: { healLine: '' },
  silica: { healLine: 'Pina, bolhas de cura!' },
};
const data = (c) => (c.data.kind === 'cast' ? LINES[c.data.id] : { healLine: 'Que a luz te proteja!' });

export class Party {
  constructor(game) {
    this.game = game;
    this.members = [];
  }

  get list() { return this.game.state?.party || []; }
  maxSize() { const r = guildRank(this.game.state.guild); return r && r.i >= 3 ? 3 : 2; }
  has(id) { return this.list.some((m) => m.kind === 'cast' && m.id === id); }

  spawn() {
    this.despawn();
    this.game.state.party ||= [];
    this.list.forEach((d, i) => this.members.push(new Companion(this, d, i)));
  }

  despawn() {
    for (const m of this.members) m.destroy();
    this.members = [];
  }

  add(data) {
    const g = this.game;
    if (this.list.length >= this.maxSize()) { g.ui.toast(`Seu time está cheio (máximo ${this.maxSize()}). Dispense alguém no menu Time.`, 'warn'); return false; }
    g.state.party.push(data);
    this.members.push(new Companion(this, data, this.list.length - 1));
    Sfx.levelUp();
    g.ui.toast(`${this.members[this.members.length - 1].name} entrou no seu time!`, 'skill');
    g.save();
    return true;
  }

  dismiss(i) {
    const g = this.game, d = this.list[i];
    if (!d) return;
    g.state.party.splice(i, 1);
    this.spawn();
    g.ui.toast(`${d.name || CAST[d.id]?.name || 'Companheiro'} saiu do time.`);
    if (d.kind === 'cast') g.npcs.populate();
    g.save();
  }

  update(dt) {
    const t = this.game.time;
    for (const m of this.members) m.update(dt, t);
  }
}
