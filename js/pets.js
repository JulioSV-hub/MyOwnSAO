// Mascotes: monstros dóceis domados com Petiscos. Seguem o jogador, lutam junto e curam (como a Pina).
import * as THREE from 'three';
import { buildMonster } from './monsters.js';
import { MONSTERS } from './data.js';
import { Enemy } from './enemies.js';
import { Sfx } from './audio.js';

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
    if (!d || !MONSTERS[d.mon]) return;
    const def = MONSTERS[d.mon];
    const m = buildMonster(def, false);
    const pet = {
      def, mesh: m.group, inner: m.inner, parts: m.parts, mats: m.mats, game: this.game,
      radius: m.radius * 0.55, height: m.height * 0.55,
      flyH: def.arch === 'flyer' ? 1.3 : def.arch === 'cube' ? 0.6 : 0,
      pos: this.game.player.pos.clone().add(new THREE.Vector3(1.5, 0, 1.5)), yaw: 0,
      moving: 0, walk: 0, atkProg: 0, state: 'follow', t: 0, attack: null, boss: false,
      cool: 0, healCool: 10, target: null,
    };
    pet.inner.scale.multiplyScalar(0.55);
    pet.inner.userData.s *= 0.55;
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
    const chance = 0.45 + e.tameTries * 0.2;
    g.effects.sparks(e.pos.clone().add(new THREE.Vector3(0, 1, 0)), '#ff9ac8', 14, 0.6);
    if (Math.random() > chance) { g.ui.toast(`${e.def.name} cheirou o petisco... mas ainda desconfia. Tente de novo!`); Sfx.click(); return; }
    const monId = e.def.baseId || e.monId || Object.keys(MONSTERS).find((k) => MONSTERS[k] === e.def);
    if (g.state.pet) g.ui.toast(`${g.state.pet.name} foi libertado e voltou para a natureza.`);
    g.state.pet = { mon: monId, name: e.def.name.split(' ').pop(), level: 1, exp: 0 };
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
    const st = g.stats();
    if (pet.healCool <= 0 && !pl.dead && g.state.player.hp < st.maxHp * 0.45) {
      pet.healCool = Math.max(14, 30 - d.level);
      const heal = Math.round(st.maxHp * (0.12 + d.level * 0.01));
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
      const back = pl.forward().multiplyScalar(-1.6), side = new THREE.Vector3(-back.z, 0, back.x).multiplyScalar(0.7);
      tx = pl.pos.x + back.x + side.x; tz = pl.pos.z + back.z + side.z; speed = 6.5; stop = 0.6;
    }
    const dx = tx - pet.pos.x, dz = tz - pet.pos.z, dd = Math.hypot(dx, dz);
    if (dd > 30 || g.indoor) { pet.pos.set(tx, 0, tz); }
    else if (dd > stop) {
      const sp = Math.min(speed * (dd > 6 ? 1.6 : 1), dd * 3);
      pet.pos.x += (dx / dd) * sp * dt;
      pet.pos.z += (dz / dd) * sp * dt;
      pet.moving = sp;
      pet.yaw += Math.atan2(Math.sin(Math.atan2(-dx, -dz) - pet.yaw), Math.cos(Math.atan2(-dx, -dz) - pet.yaw)) * Math.min(1, dt * 8);
      if (!g.indoor) w.resolve(pet.pos, pet.radius);
    } else if (pet.target && pet.cool <= 0) {
      // ataque do mascote
      pet.cool = 1.3;
      pet.state = 'recover';
      pet.t = 0;
      const dmg = Math.max(1, Math.round((st.atkR * 0.3 + d.level * 3) * (0.9 + Math.random() * 0.2) * 60 / (60 + pet.target.defense)));
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
