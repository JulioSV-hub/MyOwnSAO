// Time: até 2 companheiros (3 com posto C na Guilda) que seguem você, lutam, curam e podem ser atacados.
// Companheiros usam sempre os bonecos do jogo — os modelos .vrm (como os do Kirito e da Asuna) não podem
// aparecer em cenas de combate pelas regras dos autores.
import * as THREE from 'three';
import { buildCharacter, animateCharacter, CAST, randomTownsfolk } from './characters.js';
import { buildSword } from './gear3d.js';
import { buildWeapon } from './monsters.js';
import { toonMat } from './toon.js';
import { MERCS, CAST_PARTY } from './data.js';
import { COMP_CLASSES, OLD_MERC, CAST_DEFAULT_CLASS } from './classes.js';
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
    // classe do companheiro (escolhida por você); saves antigos são convertidos
    if (OLD_MERC[data.cls]) data.cls = OLD_MERC[data.cls];
    if (!COMP_CLASSES[data.cls]) data.cls = data.kind === 'cast' ? CAST_DEFAULT_CLASS[data.id] || 'swordsman' : 'swordsman';
    const cc = COMP_CLASSES[data.cls], cast = data.kind === 'cast' ? CAST_PARTY[data.id] : null;
    this.spec = { ...cc, dmg: cc.dmg * (cast?.dmg || 1), hp: cc.hp * (cast?.hp || 1) };
    data.rank ||= 0;
    // nível próprio: não sobe sozinho com você; só treinando (e nunca passa do seu nível)
    if (data.lv == null) data.lv = data.joined ? Math.max(1, Math.round(this.game.state.player.level * 0.7)) : this.game.state.player.level;
    const def = data.kind === 'cast'
      ? { ...CAST[data.id], id: undefined, ...(cc.pet ? { pet: true } : {}) }
      : { ...randomTownsfolk(mulberry32(data.seed || 7), false), ...MERCS[data.cls].look, name: data.name, kid: false };
    const base = (data.name || CAST[data.id]?.name || cc.name).replace(/ \(.*\)$/, '');
    this.name = data.kind === 'cast' ? base : `${base} (${cc.name})`;
    this.c = buildCharacter({ ...def, sword: null });
    this.mesh = this.c.group;
    const k = def.kid ? 0.68 : def.big ? 1.12 : 1;
    this.mesh.scale.setScalar((def.female ? 1.64 : 1.74) / (1.78 * k));
    this.equipWeapons(def);
    this.mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.game.scene.add(this.mesh);
    this.label = this.game.ui.createAllyLabel(this);
    this.refreshStats();
    this.hp = data.hp != null ? Math.min(this.maxHp, data.hp) : this.maxHp;
    this.radius = 0.36;
    this.height = 1.7;
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
  get level() { return Math.min(this.data.lv || 1, this.game.state.player.level); }

  // Força: proporcional ao nível do companheiro comparado ao seu (no seu nível ≈ 90% da sua força de base)
  refreshStats() {
    const st = this.game.stats(), sp = this.spec, old = this.maxHp;
    const k = Math.min(1, this.level / Math.max(1, this.game.state.player.level)), f = 0.25 + 0.65 * Math.pow(k, 1.6);
    this.maxHp = Math.round(st.maxHp * sp.hp * f * (1 + (st.partyHp || 0)));
    this.defense = st.def * f * (sp.taunt ? 1.35 : 1);
    this.atk = st.atkR * 0.32 * sp.dmg * f * 1.1 * (1 + (st.partyDmg || 0));
    if (old && this.hp != null) this.hp = Math.min(this.maxHp, this.hp * (this.maxHp / old));
  }

  // armas de cada classe
  equipWeapons(def) {
    const cls = this.data.cls, R = this.c.parts.arms[1], L = this.c.parts.arms[0];
    const metal = new THREE.MeshStandardMaterial({ color: '#c4c8d0', metalness: 0.75, roughness: 0.28 });
    const acc = toonMat(def.accent || '#7a5232');
    const hold = (obj, arm, flip = false) => { obj.position.set(0, -0.54, -0.02); obj.rotation.x = flip ? Math.PI / 2 - 0.3 : -Math.PI / 2 + 0.3; arm.add(obj); return obj; };
    const sword = (style, k = 0.85) => { const s = buildSword({ style, blade: def.sword || '#c8d0d8', guard: def.accent || '#7a7a82', grip: '#3a2a20' }).group; s.scale.multiplyScalar(k); return s; };
    if (cls === 'guardian') {
      hold(sword('long', 0.75), R);
      const sh = buildWeapon('shield', metal, acc);
      sh.scale.setScalar(1.15);
      sh.position.set(-0.12, -0.48, -0.1);
      sh.rotation.y = -0.5;
      L.add(sh);
    } else if (cls === 'berserker') {
      const ax = buildWeapon(Math.random() < 0.5 ? 'axe' : 'zweihander', metal, acc);
      ax.scale.setScalar(0.9);
      hold(ax, R, true);
    } else if (cls === 'duelist') {
      hold(sword('rapier'), R);
      hold(sword('basic', 0.5), L);
    } else if (cls === 'cleric' || cls === 'mage') {
      // cajado com orbe brilhando; o mago também carrega um livro de feitiços
      const st = new THREE.Group();
      const col = cls === 'mage' ? '#9a7aff' : '#fff0a0';
      st.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.6, 8), toonMat('#6a4428')));
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.2) }));
      orb.position.y = 0.85;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 6, 20), toonMat('#d8b050'));
      ring.position.y = 0.85;
      st.add(orb, ring);
      st.position.set(0, -0.54, 0.02);
      st.rotation.x = 0.15;
      R.add(st);
      this.orb = orb;
      if (cls === 'mage') {
        const book = new THREE.Group();
        book.add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.06), toonMat('#4a2a7a')));
        const pages = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.045), toonMat('#f4ecd8'));
        pages.position.x = 0.012;
        const sig = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#c8a0ff').multiplyScalar(1.8) }));
        sig.position.z = 0.032;
        book.add(pages, sig);
        book.position.set(0.02, -0.55, -0.12);
        book.rotation.set(-0.9, 0, 0.2);
        L.add(book);
      }
    } else if (cls === 'tamer') {
      hold(sword('basic', 0.7), R);
    } else {
      hold(sword(this.data.id === 'klein' ? 'katana' : this.data.id === 'asuna' ? 'rapier' : 'long'), R);
    }
  }

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
      for (const o of this.mgr.members) if (o.alive) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.15);
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
    // ─── movimento natural: alvo de posição + direção suave (acelera, freia, desvia) ───
    this.vel ||= new THREE.Vector3();
    this.retreat = Math.max(0, (this.retreat || 0) - dt);
    const plSpeed = Math.hypot(pl.vel.x, pl.vel.z), f = pl.forward(), rx = -f.z, rz = f.x;
    let goal = null, maxSp = 3.2, faceYaw = null, inRange = false, slow = 1.6;
    if (this.target) {
      const e = this.target;
      // cada um ataca de um lado do monstro, para não se amontoarem
      const base = Math.atan2(pl.pos.z - e.pos.z, pl.pos.x - e.pos.x);
      const ang = base + ([-1.1, 1.1, 2.6][this.slot] ?? 0) + Math.sin(t * 0.5 + this.slot * 2) * 0.2;
      const r = this.spec.ranged ? e.radius + this.spec.reach * 0.75 : e.radius + this.spec.reach * 0.7 + (this.retreat > 0 ? 1.3 : 0);
      goal = { x: e.pos.x + Math.cos(ang) * r, z: e.pos.z + Math.sin(ang) * r };
      maxSp = 6.4; slow = 1;
      const de = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
      inRange = de <= e.radius + this.spec.reach + 0.35;
      if (de < 6) faceYaw = Math.atan2(-(e.pos.x - this.pos.x), -(e.pos.z - this.pos.z));
    } else {
      // formação com folga, para não ficar se ajeitando a cada passo
      // nos cantos da tela: um pouco à frente e bem para o lado (nunca no meio da mira)
      const side = [-1, 1, 1][this.slot] ?? 1, back = this.slot === 2 ? -1.6 : -3.2, wide = this.slot === 2 ? 4.6 : 2.8;
      const sx = pl.pos.x - f.x * back + rx * side * wide, sz = pl.pos.z - f.z * back + rz * side * wide;
      const dSlot = Math.hypot(sx - this.pos.x, sz - this.pos.z);
      if (plSpeed > 0.5 || (this.following ? dSlot > 0.5 : dSlot > 3.2)) {
        this.following = true;
        goal = { x: sx, z: sz };
        maxSp = plSpeed > 0.5 ? Math.min(12, plSpeed * 1.35 + 1.5) : dSlot > 6 ? 6 : 2.6;
        slow = plSpeed > 0.5 ? 0.9 : 1.6;
      } else this.following = false;
    }
    const want = new THREE.Vector3();
    if (goal) {
      const gx = goal.x - this.pos.x, gz = goal.z - this.pos.z, gd = Math.hypot(gx, gz);
      if (!this.target && plSpeed > 0.5) {
        // andando junto: acompanha a sua velocidade e só corrige a distância até a posição dele
        want.set(pl.vel.x, 0, pl.vel.z);
        if (gd > 0.05) want.add(new THREE.Vector3(gx / gd, 0, gz / gd).multiplyScalar(Math.min(maxSp, gd * 2.5)));
      } else if (gd > 0.05) want.set(gx / gd, 0, gz / gd).multiplyScalar(maxSp * Math.min(1, gd / slow));
    }
    // separação: não esbarra em você nem nos outros
    const push = (ox, oz, rad, k) => { const ddx = this.pos.x - ox, ddz = this.pos.z - oz, d = Math.hypot(ddx, ddz); if (d < rad && d > 1e-3) { want.x += (ddx / d) * (rad - d) * k; want.z += (ddz / d) * (rad - d) * k; } };
    push(pl.pos.x, pl.pos.z, 1.6, 4);
    for (const o of this.mgr.members) if (o !== this && o.alive) push(o.pos.x, o.pos.z, 1.3, 3);
    // sai da frente da sua mira
    if (!this.target) {
      const vx = this.pos.x - pl.pos.x, vz = this.pos.z - pl.pos.z, vd = Math.hypot(vx, vz);
      const ahead = (vx * f.x + vz * f.z) / (vd || 1), lateral = vx * rx + vz * rz;
      if (vd < 8 && ahead > 0.93) { const s2 = lateral >= 0 ? 1 : -1; want.x += rx * s2 * 3; want.z += rz * s2 * 3; }
    }
    this.vel.lerp(want, Math.min(1, dt * (goal ? 5 : 7)));
    if (this.vel.lengthSq() < 0.0004) this.vel.set(0, 0, 0);
    const pdx = pl.pos.x - this.pos.x, pdz = pl.pos.z - this.pos.z, pd = Math.hypot(pdx, pdz);
    if (pd > 40) {
      // ficou muito para trás: reaparece atrás de você, fora da vista
      this.pos.set(pl.pos.x - f.x * 4 + rx * (this.slot - 1) * 2, 0, pl.pos.z - f.z * 4 + rz * (this.slot - 1) * 2);
      this.vel.set(0, 0, 0);
    } else this.pos.addScaledVector(this.vel, dt);
    const moving = this.vel.length();
    // virar o corpo: para o monstro, para onde anda ou, parado, olhar em volta de vez em quando
    this.lookT = (this.lookT ?? 3 + Math.random() * 4) - dt;
    if (this.lookT <= 0) { this.lookT = 3 + Math.random() * 5; this.idleYaw = pl.yaw + (Math.random() - 0.5) * 2.2; }
    const yawGoal = faceYaw ?? (moving > 0.5 ? Math.atan2(-this.vel.x, -this.vel.z) : this.idleYaw ?? pl.yaw);
    const turn = angleTo(this.yaw, yawGoal), maxTurn = (this.target ? 7 : 4.5) * dt;
    this.yaw += Math.max(-maxTurn, Math.min(maxTurn, turn));
    if (this.target && inRange && this.cool <= 0 && Math.abs(angleTo(this.yaw, Math.atan2(-(this.target.pos.x - this.pos.x), -(this.target.pos.z - this.pos.z)))) < 0.6) {
      const ex = this.target.pos.x - this.pos.x, ez = this.target.pos.z - this.pos.z, ed = Math.hypot(ex, ez) || 1;
      this.attack(ex / ed, ez / ed);
      this.retreat = 0.45;
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
    const g = this.game, e = this.target;
    this.cool = this.spec.fast ? 0.75 : this.data.cls === 'berserker' ? 1.25 : this.spec.ranged ? 1.5 : 1.05;
    this.swing = 1;
    const crit = Math.random() < (this.spec.crit || 0.12);
    const dmg = Math.max(1, Math.round((this.atk * (crit ? 1.7 : 1) * (0.9 + Math.random() * 0.2) * 60) / (60 + e.defense)));
    if (this.spec.ranged) {
      // magia: uma esfera de luz voa até o monstro
      const from = this.pos.clone().add(new THREE.Vector3(0, 1.8, 0));
      this.mgr.cast(from, e, dmg, crit, this.spec.bolt || '#9a7aff');
      Sfx.swing();
      return;
    }
    const at = e.pos.clone().add(new THREE.Vector3(0, e.flyH ? 0 : e.height * 0.5, 0));
    e.takeDamage(dmg, new THREE.Vector3(nx, 0, nz), 0.5);
    // o monstro atingido pode passar a mirar o companheiro (o Guardião atrai sempre)
    if (!e.dead && !e.boss && (this.spec.taunt || Math.random() < 0.45)) e.tgtC = this;
    g.effects.sparks(at, crit ? '#ffe08a' : '#cfe8ff', 8);
    g.ui.damageNumber(at, dmg, crit ? 'allycrit' : 'ally');
    // Domador: o bichinho ataca junto
    if (this.spec.pet && !e.dead) {
      const pd = Math.max(1, Math.round(dmg * 0.45));
      e.takeDamage(pd, null, 0.2);
      g.ui.damageNumber(at.clone().add(new THREE.Vector3(0.3, 0.4, 0)), pd, 'pet');
      g.effects.sparks(at, '#ff9ac8', 5);
    }
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
const data = (c) => ({ healLine: (c.data.kind === 'cast' && LINES[c.data.id]?.healLine) || 'Que a luz te proteja!' });

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
    data.joined = true;
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

  setClass(i, cls) {
    const d = this.list[i];
    if (!d || !COMP_CLASSES[cls]) return;
    d.cls = cls;
    d.hp = null;
    this.spawn();
    this.game.ui.toast(`${this.members[i].name} agora é ${COMP_CLASSES[cls].name}.`, 'skill');
    this.game.save();
  }

  cast(from, target, dmg, crit, color) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5) }));
    m.position.copy(from);
    this.game.scene.add(m);
    (this.bolts ||= []).push({ m, target, dmg, crit, color, t: 0 });
  }

  updateBolts(dt) {
    const g = this.game;
    for (let i = (this.bolts || []).length - 1; i >= 0; i--) {
      const b = this.bolts[i], e = b.target;
      b.t += dt;
      const to = e.pos.clone().add(new THREE.Vector3(0, e.flyH ? 0 : e.height * 0.5, 0));
      const d = b.m.position.distanceTo(to);
      if (e.dead || b.t > 2.5 || d < 0.6) {
        if (!e.dead && d < 0.8) {
          e.takeDamage(b.dmg, null, 0.3);
          g.effects.sparks(to, b.color, 14, 0.8);
          g.ui.damageNumber(to, b.dmg, b.crit ? 'allycrit' : 'ally');
          Sfx.hit(false);
        }
        g.scene.remove(b.m);
        b.m.geometry.dispose(); b.m.material.dispose();
        this.bolts.splice(i, 1);
        continue;
      }
      b.m.position.lerp(to, Math.min(1, (18 * dt) / d));
      b.m.scale.setScalar(1 + Math.sin(b.t * 30) * 0.15);
    }
  }

  // Treino: pagar para subir o nível de um companheiro (fica mais forte)
  // custo de treinar n níveis a partir do nível atual
  trainCost(i, n = 1) {
    const d = this.list[i];
    let c = 0;
    for (let k = 0; k < n; k++) c += Math.round(120 * Math.pow((d?.lv || 1) + k, 1.45) * (1 + this.game.floor.n * 0.04));
    return c;
  }
  trainMax(i) { const d = this.list[i]; return Math.max(0, this.game.state.player.level - (d?.lv || 1)); }
  train(i, n = 1) {
    const g = this.game, d = this.list[i], m = this.members[i];
    n = Math.min(n, this.trainMax(i));
    if (!d || n <= 0) { g.ui.toast('Já está no seu nível — suba de nível para treinar mais.', 'warn'); return; }
    const cost = this.trainCost(i, n);
    if (g.state.player.col < cost) { Sfx.error(); g.ui.toast('Col insuficiente para o treino.', 'warn'); return; }
    g.state.player.col -= cost;
    d.lv = (d.lv || 1) + n;
    if (m) { m.refreshStats(); m.hp = m.maxHp; g.effects.levelUp(m.pos.clone()); }
    Sfx.levelUp();
    g.ui.toast(`${m?.name || 'Companheiro'} treinou e subiu para o nível ${m?.level}!`, 'skill');
    g.save();
  }

  update(dt) {
    const t = this.game.time;
    this.statT = (this.statT || 0) - dt;
    if (this.statT <= 0) { this.statT = 2; for (const m of this.members) m.refreshStats(); }
    this.updateBolts(dt);
    for (const m of this.members) m.update(dt, t);
  }
}
