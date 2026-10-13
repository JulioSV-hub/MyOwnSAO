// Mascotes: monstros dóceis domados com Petiscos. Seguem o jogador, lutam junto e curam (como a Pina).
import * as THREE from 'three';
import { buildMonster } from './monsters.js';
import { MONSTERS } from './data.js';
import { Enemy } from './enemies.js';
import { Sfx } from './audio.js';
import { PETS, PET_TIERS, petInfo, petMonDef, petScale } from './petdata.js';

export const TAMEABLE = new Set(['quad', 'flyer', 'slime', 'spider', 'cube']);
const petExpNeed = (lv) => 40 + lv * 30;

export class Pets {
  constructor(game) {
    this.game = game;
    this.pet = null;
  }

  get data() { return this.game.state?.pet || null; }

  // (re)cria o mascote salvo ao carregar o andar
  spawn() {
    this.despawn();
    const d = this.data;
    if (!d) return;
    const def = petMonDef(d), sc = petScale(d);
    const m = buildMonster(def, false);
    const pet = {
      def, mesh: m.group, inner: m.inner, parts: m.parts, mats: m.mats, game: this.game,
      radius: m.radius * sc, height: m.height * sc,
      flyH: def.arch === 'flyer' ? 1.3 : def.arch === 'cube' ? 0.6 : 0,
      pos: this.game.player.pos.clone().add(new THREE.Vector3(1.5, 0, 1.5)), yaw: 0,
      moving: 0, walk: 0, atkProg: 0, state: 'follow', t: 0, attack: null, boss: false,
      cool: 0, healCool: 10, target: null, abCool: 6,
    };
    pet.inner.scale.multiplyScalar(sc);
    pet.inner.userData.s *= sc;
    this.game.scene.add(pet.mesh);
    pet.label = this.game.ui.createPetLabel(pet, d);
    this.pet = pet;
  }

  despawn() {
    if (!this.pet) return;
    this.game.scene.remove(this.pet.mesh);
    this.pet.mesh.traverse((o) => { if (o.material) o.material.dispose?.(); });
    this.pet.label?.remove();
    this.pet = null;
  }

  tryTame(e) {
    const g = this.game, p = g.state.player;
    if (!(p.items.tame_treat > 0)) { Sfx.error(); g.ui.toast('Você precisa de um Petisco de Domador (Agil vende).', 'warn'); return; }
    p.items.tame_treat--;
    e.tameTries = (e.tameTries || 0) + 1;
    const chance = 0.45 + e.tameTries * 0.2 + g.stats().tame;
    g.effects.sparks(e.pos.clone().add(new THREE.Vector3(0, 1, 0)), '#ff9ac8', 14, 0.6);
    if (Math.random() > chance) { g.ui.toast(`${e.def.name} cheirou o petisco... mas ainda desconfia. Tente de novo!`); Sfx.click(); return; }
    const monId = e.def.baseId || e.monId || Object.keys(MONSTERS).find((k) => MONSTERS[k] === e.def);
    this.add({ id: PETS[monId] ? monId : undefined, mon: monId, name: PETS[monId]?.name || e.def.name.split(' ').pop(), level: 1, exp: 0 }, true);
    e.dead = true;
    e.mesh.visible = false;
    e.label?.remove();
    e.label = null;
    Sfx.levelUp();
    g.effects.ring(e.pos.clone(), '#ff9ac8', 2, 1, 2);
    g.ui.banner('Novo mascote!', `${e.def.name} agora é seu companheiro. Dê um nome em Menu → Status.`, 3.5);
    this.spawn();
    this.pet.pos.copy(e.pos);
    g.save();
  }

  release() {
    const g = this.game;
    if (!g.state.pet) return;
    g.ui.toast(`${g.state.pet.name} voltou para a natureza. Até logo!`);
    g.state.pet = null;
    this.despawn();
    g.save();
  }

  // ─── Toca: todos os seus mascotes; um anda com você, os outros descansam ───
  get stable() { return (this.game.state.stable ||= []); }

  add(rec, active = true) {
    const g = this.game;
    rec.id ||= rec.mon;
    if (active) {
      if (g.state.pet) { this.stable.push(g.state.pet); g.ui.toast(`${g.state.pet.name} foi descansar na Toca dos Mascotes.`); }
      g.state.pet = rec;
      this.spawn();
    } else this.stable.push(rec);
    return rec;
  }

  use(i) {
    const g = this.game, rec = this.stable[i];
    if (!rec) return;
    this.stable.splice(i, 1);
    if (g.state.pet) this.stable.push(g.state.pet);
    g.state.pet = rec;
    this.spawn();
    if (this.pet) this.pet.pos.copy(g.player.pos).add(new THREE.Vector3(-1, 0, 1));
    g.save();
  }

  rest() {
    const g = this.game;
    if (!g.state.pet) return;
    this.stable.push(g.state.pet);
    g.state.pet = null;
    this.despawn();
    g.save();
  }

  freeStable(i) { this.stable.splice(i, 1); this.game.save(); }

  // habilidades dos lendários e míticos
  ability(pet, d, info, st, dt) {
    const g = this.game, pl = g.player;
    pet.abCool -= dt;
    if (pet.abCool > 0 || !info.ability) return;
    const tm = PET_TIERS[info.tier].mul, base = (st.atkR * 0.3 + d.level * 3) * (1 + st.petDmg) * tm;
    const hitAll = (cx, cz, r, mul, knock, filter) => {
      let n = 0;
      for (const e of g.enemies.list) {
        if (e.dead || e.docile || e.peaceful || e.state === 'intro') continue;
        const dx = e.pos.x - cx, dz = e.pos.z - cz, dd = Math.hypot(dx, dz);
        if (dd > r + e.radius || (filter && !filter(e, dx, dz, dd))) continue;
        const dmg = Math.max(1, Math.round(base * mul * (0.9 + Math.random() * 0.2) * 60 / (60 + e.defense)));
        e.takeDamage(dmg, new THREE.Vector3(dx / (dd || 1), 0, dz / (dd || 1)), knock);
        g.ui.damageNumber(e.pos.clone().add(new THREE.Vector3(0, e.height * 0.6, 0)), dmg, 'pet');
        if (e.dead) this.gainExp(10 + e.level * 4);
        n++;
      }
      return n;
    };
    const tgt = pet.target, ground = (x, z) => new THREE.Vector3(x, g.world.groundAt(x, z) + 0.1, z);
    switch (info.ability) {
      case 'breath': {
        if (!tgt) return;
        const fx = tgt.pos.x - pet.pos.x, fz = tgt.pos.z - pet.pos.z, fl = Math.hypot(fx, fz) || 1;
        if (fl > 9) return;
        pet.abCool = 12;
        hitAll(pet.pos.x, pet.pos.z, 9, 3.2, 1.2, (e, dx, dz, dd) => (dx * fx + dz * fz) / (dd * fl || 1) > 0.6);
        for (let i = 1; i <= 6; i++) g.effects.sparks(pet.pos.clone().add(new THREE.Vector3((fx / fl) * i * 1.3, 0.8, (fz / fl) * i * 1.3)), i % 2 ? '#ff7a2a' : '#ffd040', 10, 0.9);
        Sfx.slam();
        break;
      }
      case 'stomp': {
        if (!tgt || tgt.dist > 8) return;
        pet.abCool = 10;
        hitAll(pet.pos.x, pet.pos.z, 4.5, 2.4, 2.2);
        for (const e of g.enemies.list) if (!e.dead && !e.boss && Math.hypot(e.pos.x - pet.pos.x, e.pos.z - pet.pos.z) < 4.5 && e.state === 'windup') { e.state = 'recover'; e.t = -0.6; }
        g.effects.shockwave?.(ground(pet.pos.x, pet.pos.z), '#d8b080', 4.5);
        g.shake(0.25);
        Sfx.slam();
        break;
      }
      case 'gust': {
        if (!tgt || tgt.dist > 8) return;
        pet.abCool = 9;
        hitAll(pet.pos.x, pet.pos.z, 5.5, 1.6, 3.5);
        g.effects.ring(ground(pet.pos.x, pet.pos.z), '#c8f0ff', 5.5, 0.5, 1);
        Sfx.dash?.();
        break;
      }
      case 'holy': {
        if (g.state.player.hp > st.maxHp * 0.7) return;
        pet.abCool = 20;
        const heal = Math.round(st.maxHp * 0.25 * (1 + st.petHeal));
        g.state.player.hp = Math.min(st.maxHp, g.state.player.hp + heal);
        for (const m of g.party.members) if (m.alive) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.25);
        g.effects.ring(pl.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), '#fff4c0', 3, 1, 2.5);
        g.ui.damageNumber(pl.pos.clone().add(new THREE.Vector3(0, 1.8, 0)), `+${heal}`, 'heal');
        Sfx.levelUp();
        break;
      }
      case 'roar': {
        if (!tgt || tgt.dist > 12) return;
        pet.abCool = 18;
        this.roarT = 8;
        g.effects.ring(pet.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), '#ffb030', 6, 0.7, 0);
        g.ui.toast(`${d.name} rugiu! +15% de dano por 8 s.`, 'skill');
        Sfx.slam();
        break;
      }
      default: break;
    }
  }

  gainExp(x) {
    const d = this.data;
    if (!d) return;
    d.exp += x;
    while (d.exp >= petExpNeed(d.level)) {
      d.exp -= petExpNeed(d.level);
      d.level++;
      this.game.ui.toast(`${d.name} subiu para o nível ${d.level}!`, 'skill');
      if (this.pet) this.game.effects.ring(this.pet.pos.clone(), '#ffd75a', 1.2, 0.8, 1.5);
    }
  }

  update(dt) {
    const pet = this.pet, g = this.game;
    if (!pet) return;
    const d = this.data, pl = g.player, w = g.world;
    pet.moving = 0;
    pet.cool -= dt;
    pet.healCool -= dt;
    // cura como a Pina quando o HP do jogador está baixo
    const st = g.stats(), info = petInfo(d), tm = PET_TIERS[info.tier]?.mul || 1;
    if (this.roarT > 0) this.roarT -= dt;
    if (!g.indoor) this.ability(pet, d, info, st, dt);
    if (pet.healCool <= 0 && !pl.dead && g.state.player.hp < st.maxHp * 0.45) {
      pet.healCool = Math.max(14, 30 - d.level);
      const heal = Math.round(st.maxHp * Math.min(0.5, (0.12 + d.level * 0.01) * (0.8 + tm * 0.2)) * (1 + st.petHeal));
      g.state.player.hp = Math.min(st.maxHp, g.state.player.hp + heal);
      g.effects.ring(pl.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), '#7aff9a', 1.2, 0.8, 1.5);
      g.ui.damageNumber(pl.pos.clone().add(new THREE.Vector3(0, 1.8, 0)), `+${heal}`, 'heal');
      Sfx.menuOpen();
    }
    // escolhe um inimigo que está atacando o jogador
    if (!pet.target || pet.target.dead || pet.target.dist > 16) {
      pet.target = g.enemies.list.find((e) => !e.dead && !e.docile && e.dist < 14 && (e.state === 'chase' || e.state === 'windup' || e.state === 'recover' || e.boss)) || null;
    }
    let tx, tz, speed, stop;
    if (pet.target && !g.indoor) {
      tx = pet.target.pos.x; tz = pet.target.pos.z; speed = 7; stop = pet.target.radius + 0.8;
    } else {
      // o mascote anda ao seu lado direito; parado, só vem se ficar longe
      const f = pl.forward(), ps = Math.hypot(pl.vel.x, pl.vel.z);
      tx = pl.pos.x + f.x * 0.6 - f.z * 1.7; tz = pl.pos.z + f.z * 0.6 + f.x * 1.7;
      speed = ps > 0.5 ? Math.min(11, ps * 1.2 + 1) : 3; stop = ps > 0.5 ? 0.5 : 2.2;
    }
    const dx = tx - pet.pos.x, dz = tz - pet.pos.z, dd = Math.hypot(dx, dz);
    if (dd > 30 || g.indoor) { pet.pos.set(tx, 0, tz); }
    else if (dd > stop) {
      // acelera e freia aos poucos
      const want = Math.min(speed * (dd > 6 ? 1.5 : 1), (dd - stop) * 2.5 + 0.8);
      pet.spd = (pet.spd || 0) + (want - (pet.spd || 0)) * Math.min(1, dt * 5);
      pet.pos.x += (dx / dd) * pet.spd * dt;
      pet.pos.z += (dz / dd) * pet.spd * dt;
      pet.moving = pet.spd;
      pet.yaw += Math.atan2(Math.sin(Math.atan2(-dx, -dz) - pet.yaw), Math.cos(Math.atan2(-dx, -dz) - pet.yaw)) * Math.min(1, dt * 8);
      if (!g.indoor) w.resolve(pet.pos, pet.radius);
    } else if (pet.target && pet.cool <= 0) {
      // ataque do mascote
      pet.cool = 1.3;
      pet.state = 'recover';
      pet.t = 0;
      const dmg = Math.max(1, Math.round((st.atkR * 0.3 + d.level * 3) * (1 + st.petDmg) * tm * (0.9 + Math.random() * 0.2) * 60 / (60 + pet.target.defense)));
      const at = pet.target.pos.clone().add(new THREE.Vector3(0, pet.target.height * 0.5, 0));
      pet.target.takeDamage(dmg, new THREE.Vector3(dx / dd, 0, dz / dd), 0.5);
      g.effects.sparks(at, '#ff9ac8', 8);
      g.ui.damageNumber(at, dmg, 'pet');
      Sfx.hit(false);
      if (pet.target.dead) this.gainExp(10 + pet.target.level * 4);
    }
    if (pet.state === 'recover') { pet.t += dt; if (pet.t > 0.4) pet.state = 'follow'; }
    const gy = g.indoor ? g.indoor.y : w.groundAt(pet.pos.x, pet.pos.z);
    pet.pos.y = gy + pet.flyH + (pet.flyH ? Math.sin(g.time * 2.5) * 0.15 : 0);
    Enemy.prototype.animate.call(pet, dt);
    pet.mesh.position.copy(pet.pos);
    pet.mesh.rotation.y = pet.yaw;
  }
}
