// Missões: principal (chefe do andar), secundárias dos personagens e caçadas do Quadro de Missões.
// Tipos: kill (derrotar monstros) · deliver (entregar materiais) · explore (visitar pontos marcados)
//        skill (usar Sword Skills) · parry (aparar ataques) · upgrade (fortalecer arma) · talk (conversar) · boss
import * as THREE from 'three';
import { MONSTERS, weaponDef } from './data.js';
import { mulberry32 } from './rng.js';
import { Sfx } from './audio.js';

const pickMon = (floor, i) => floor.monsters[i % floor.monsters.length];
const dropOf = (id) => MONSTERS[id].drop[0];

export function questsForFloor(floor) {
  const n = floor.n, m0 = pickMon(floor, 0), m1 = pickMon(floor, 1), m2 = pickMon(floor, 2);
  const k = 1 + (n - 1) * 0.6;
  const col = (v) => Math.round(v * k);
  const Q = [];
  Q.push({ id: `main_${n}`, giver: null, main: true, title: `Libertar o Andar ${n}`, desc: `Derrote ${floor.boss.name}, o chefe do andar, na arena diante do Labirinto.`, type: 'boss', count: 1, reward: { col: col(400), exp: 0 } });
  Q.push({ id: `agil_${n}`, giver: 'agil', title: 'Estoque da Agil\'s Store', desc: `"Os aventureiros estão comprando tudo! Me traga 5 ${dropOf(m0)} — pago bem."`, type: 'deliver', target: dropOf(m0), count: 5, reward: { col: col(260), items: { potion: 3 } } });
  Q.push({ id: `klein_${n}`, giver: 'klein', title: 'Caçada do Fuurinkazan', desc: `"Bora mostrar do que a gente é capaz! Derrote 8 ${MONSTERS[m1].name} comigo... quer dizer, por mim!"`, type: 'kill', target: m1, count: 8, reward: { col: col(180), exp: Math.round(120 * k * 1.6) } });
  Q.push({ id: `argo_${n}`, giver: 'argo', title: 'Mapear o andar', desc: '"Preciso de alguém pra checar 3 lugares nos campos. Marquei com pilares de luz no seu mapa. Nyahaha~"', type: 'explore', count: 3, reward: { col: col(150), items: { teleport_crystal: 2 } } });
  Q.push({ id: `lisbeth_${n}`, giver: 'lisbeth', title: 'Metal para a forja', desc: `"Estou sem material! Traga 4 ${dropOf(m2)} e eu fortaleço sua arma de graça."`, type: 'deliver', target: dropOf(m2), count: 4, reward: { upgrade: 1, col: col(60) } });
  Q.push({ id: `asuna_${n}`, giver: 'asuna', title: 'Ingredientes do jantar', desc: `"Quero testar uma receita nova! Pode me trazer 3 ${dropOf(m1)}?"`, type: 'deliver', target: dropOf(m1), count: 3, reward: { items: { hipotion: 2 }, col: col(120), heal: true } });
  const kiritoTasks = [
    { title: 'Treino de Sword Skills', desc: '"Sword Skills vencem lutas. Use 12 Sword Skills em combate e me conte como foi."', type: 'skill', count: 12 },
    { title: 'A arte de aparar', desc: '"Segure a defesa (botão direito) no instante do golpe inimigo. Apare 3 ataques."', type: 'parry', count: 3 },
    { title: 'Caçador solo', desc: '"Derrote 15 monstros neste andar. Sem pressa, sem morrer."', type: 'kill', target: '*', count: 15 },
  ];
  Q.push({ id: `kirito_${n}`, giver: 'kirito', ...kiritoTasks[(n - 1) % kiritoTasks.length], reward: { points: 2, col: col(100) } });
  Q.push({ id: `silica_${n}`, giver: 'silica', title: 'A Flor de Pneuma', desc: '"Dizem que uma flor brilhante nasce em algum lugar deste andar... ela tem um poder especial! Me ajuda a achar?"', type: 'explore', flower: true, count: 1, reward: { items: { heal_crystal: 1 }, col: col(140) } });
  if (n === 1) Q.push({ id: 'yui_1', giver: 'yui', title: 'Papai e mamãe', desc: '"Eu queria conversar com o moço de preto e a moça de branco... você me ajuda? Fala com eles por mim?"', type: 'talk', targets: ['kirito', 'asuna'], count: 2, reward: { items: { potion: 2 }, col: 80 } });
  Q.push({ id: `board_a_${n}`, giver: 'board', title: 'Caçada: limpar os campos', desc: 'Pedido da cidade: derrote 12 monstros quaisquer nos arredores.', type: 'kill', target: '*', count: 12, reward: { col: col(200), exp: Math.round(80 * k) } });
  Q.push({ id: `board_b_${n}`, giver: 'board', title: `Caçada: ${MONSTERS[m2].name}`, desc: `Pedido da cidade: os ${MONSTERS[m2].name} estão atacando viajantes. Derrote 6.`, type: 'kill', target: m2, count: 6, reward: { col: col(170), items: { potion: 2 } } });
  Q.push({ id: `board_c_${n}`, giver: 'board', title: `Encomenda: ${dropOf(m0)}`, desc: `Pedido da cidade: entregue 6 ${dropOf(m0)} no quadro.`, type: 'deliver', target: dropOf(m0), count: 6, reward: { col: col(240) } });
  for (const q of Q) q.floor = n;
  return Q;
}

const GIVER_NAMES = { agil: 'Agil', klein: 'Klein', argo: 'Argo', lisbeth: 'Lisbeth', asuna: 'Asuna', kirito: 'Kirito', silica: 'Silica', yui: 'Yui', board: 'Quadro de Missões' };

export class Quests {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.markers = [];
  }

  get st() {
    const s = this.game.state;
    s.quests ||= { active: {}, done: {} };
    return s.quests;
  }

  setFloor(floor) {
    this.clearMarkers();
    this.list = questsForFloor(floor);
    this.points = this.makePoints(floor);
    const main = this.list.find((q) => q.main);
    if (!this.game.state.progress.cleared[floor.n] && !this.st.done[main.id] && !this.st.active[main.id]) this.st.active[main.id] = { p: 0 };
    this.refreshMarkers();
  }

  makePoints(floor) {
    const w = this.game.world, r = mulberry32(floor.seed + 4242), out = {};
    const spot = (minR, maxR) => {
      for (let i = 0; i < 60; i++) {
        const a = r() * Math.PI * 2, d = minR + r() * (maxR - minR);
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (w.freeSpot(x, z, 4) && !(w.water && w.groundAt(x, z) < w.water.level + 0.3)) return new THREE.Vector3(x, w.groundAt(x, z), z);
      }
      return new THREE.Vector3(90, w.groundAt(90, 0), 0);
    };
    for (const q of this.list) if (q.type === 'explore') out[q.id] = Array.from({ length: q.count }, () => spot(q.flower ? 110 : 75, q.flower ? 205 : 190));
    return out;
  }

  def(id) { return this.list.find((q) => q.id === id); }
  isActive(id) { return !!this.st.active[id]; }
  isDone(id) { return !!this.st.done[id]; }

  progress(q) {
    const a = this.st.active[q.id];
    if (!a) return 0;
    if (q.type === 'deliver') return Math.min(q.count, this.game.state.player.mats[q.target]?.qty || 0);
    if (q.type === 'upgrade') return Math.min(q.count, this.game.upgradeLevel(this.game.state.player.weapon));
    if (q.type === 'boss') return this.game.state.progress.cleared[q.floor] ? 1 : 0;
    return Math.min(q.count, a.p || 0);
  }

  ready(q) { return this.isActive(q.id) && this.progress(q) >= q.count; }

  forGiver(giver) { return this.list.filter((q) => q.giver === giver && !this.isDone(q.id)); }

  marker(giver) {
    const qs = this.forGiver(giver);
    if (qs.some((q) => this.ready(q))) return '?';
    if (qs.some((q) => !this.isActive(q.id))) return '!';
    return '';
  }

  activeList() { return this.list.filter((q) => this.isActive(q.id)); }

  accept(q) {
    this.st.active[q.id] = { p: 0, talked: [] };
    Sfx.menuOpen();
    this.game.ui.toast(`Missão aceita: ${q.title}`, 'skill');
    this.refreshMarkers();
    this.game.save();
  }

  rewardText(q) {
    const r = q.reward, parts = [];
    if (r.col) parts.push(`${r.col.toLocaleString('pt-BR')} Col`);
    if (r.exp) parts.push(`${r.exp} EXP`);
    if (r.points) parts.push(`+${r.points} pontos de atributo`);
    if (r.upgrade) parts.push('arma +1 de graça');
    if (r.heal) parts.push('HP restaurado');
    const names = { potion: 'Poção', hipotion: 'Poção Superior', heal_crystal: 'Cristal de Cura', teleport_crystal: 'Cristal de Teletransporte' };
    for (const [id, qn] of Object.entries(r.items || {})) parts.push(`${qn}× ${names[id] || id}`);
    return parts.join(' · ');
  }

  turnIn(q) {
    if (!this.ready(q)) return false;
    const g = this.game, p = g.state.player, r = q.reward;
    if (q.type === 'deliver') {
      const m = p.mats[q.target];
      m.qty -= q.count;
      if (m.qty <= 0) delete p.mats[q.target];
    }
    delete this.st.active[q.id];
    this.st.done[q.id] = true;
    if (r.col) p.col += r.col;
    for (const [id, qn] of Object.entries(r.items || {})) p.items[id] = (p.items[id] || 0) + qn;
    if (r.points) p.points += r.points;
    if (r.heal) p.hp = g.stats().maxHp;
    if (r.upgrade) { (p.upgrades ||= {})[p.weapon] = Math.min(10, g.upgradeLevel(p.weapon) + r.upgrade); g.combat.refresh(); }
    if (r.exp) g.gainExp(r.exp);
    Sfx.victory();
    g.effects.ring(g.player.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), '#ffd54f', 1.6, 1.2, 1.8);
    g.ui.banner('Missão concluída!', `${q.title} — ${this.rewardText(q)}`, 3.5);
    this.refreshMarkers();
    g.save();
    return true;
  }

  // ─────────── Eventos do jogo ───────────
  bump(pred, amount = 1) {
    let changed = false;
    for (const q of this.activeList()) {
      if (!pred(q)) continue;
      const a = this.st.active[q.id], before = a.p || 0;
      if (before >= q.count) continue;
      a.p = before + amount;
      changed = true;
      if (a.p >= q.count) this.game.ui.toast(`✔ ${q.title}: objetivo cumprido! ${q.giver ? `Fale com ${GIVER_NAMES[q.giver]}.` : ''}`, 'skill');
    }
    return changed;
  }

  onKill(e) { this.bump((q) => q.type === 'kill' && (q.target === '*' || MONSTERS[q.target] === e.def)); }
  onSkill() { this.bump((q) => q.type === 'skill'); }
  onParry() { this.bump((q) => q.type === 'parry'); }
  onDrop(name) {
    for (const q of this.activeList()) if (q.type === 'deliver' && q.target === name && this.progress(q) === q.count) this.game.ui.toast(`✔ ${q.title}: você já tem ${q.count} ${name}!`, 'skill');
  }
  onTalk(npcId) {
    for (const q of this.activeList()) {
      if (q.type !== 'talk' || !q.targets.includes(npcId)) continue;
      const a = this.st.active[q.id];
      a.talked ||= [];
      if (a.talked.includes(npcId)) continue;
      a.talked.push(npcId);
      a.p = a.talked.length;
      this.game.ui.toast(a.p >= q.count ? `✔ ${q.title}: volte para a Yui!` : `${q.title}: ${a.p}/${q.count}`, 'skill');
    }
  }
  onBoss() {
    const q = this.list.find((x) => x.main);
    if (q && this.isActive(q.id)) this.turnIn(q);
  }

  // ─────────── Pilares de exploração e a Flor de Pneuma ───────────
  clearMarkers() {
    for (const m of this.markers) {
      this.game.scene.remove(m.obj);
      m.obj.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    }
    this.markers = [];
  }

  refreshMarkers() {
    this.clearMarkers();
    if (!this.points) return;
    for (const q of this.activeList()) {
      if (q.type !== 'explore') continue;
      const visited = this.st.active[q.id].visited || [];
      this.points[q.id].forEach((pos, i) => {
        if (visited.includes(i)) return;
        const obj = q.flower ? this.flowerMesh() : this.pillarMesh();
        obj.position.copy(pos);
        this.game.scene.add(obj);
        this.markers.push({ obj, q, i, pos, flower: !!q.flower });
      });
    }
  }

  pillarMesh() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 40, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#7ad0ff').multiplyScalar(1.4), transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.y = 20;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#bfe8ff').multiplyScalar(2.2) }));
    gem.position.y = 2.2;
    g.add(beam, gem);
    g.userData.spin = gem;
    return g;
  }

  flowerMesh() {
    const g = new THREE.Group();
    const petal = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e8f4ff').multiplyScalar(2.2) });
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), petal);
      const a = (i / 6) * Math.PI * 2;
      p.position.set(Math.cos(a) * 0.16, 0.6, Math.sin(a) * 0.16);
      p.scale.set(1, 0.4, 1.6);
      p.lookAt(0, 0.6, 0);
      g.add(p);
    }
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe08a').multiplyScalar(2.5) })));
    g.children[g.children.length - 1].position.y = 0.62;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.6, 6), new THREE.MeshStandardMaterial({ color: '#4a9a3a' }));
    stem.position.y = 0.3;
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#bfe8ff').multiplyScalar(1.2), transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), glowMat);
    halo.position.y = 0.6;
    g.add(stem, halo);
    g.userData.spin = halo;
    return g;
  }

  update(dt) {
    const pl = this.game.player.pos, t = this.game.time;
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i];
      const s = m.obj.userData.spin;
      if (s) { s.rotation.y += dt * 1.5; if (!m.flower) s.position.y = 2.2 + Math.sin(t * 2 + i) * 0.25; else s.scale.setScalar(1 + Math.sin(t * 3) * 0.12); }
      if (Math.hypot(pl.x - m.pos.x, pl.z - m.pos.z) < (m.flower ? 2.2 : 4)) {
        const a = this.st.active[m.q.id];
        if (!a) continue;
        (a.visited ||= []).push(m.i);
        a.p = a.visited.length;
        this.game.effects.sparks(m.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), m.flower ? '#ffffff' : '#7ad0ff', 24, 0.8);
        Sfx.coin();
        this.game.ui.toast(m.flower ? '✿ Você encontrou a Flor de Pneuma! Leve para a Silica.' : `${m.q.title}: ${a.p}/${m.q.count} lugares`, 'skill');
        if (a.p >= m.q.count && !m.flower) this.game.ui.toast(`✔ ${m.q.title}: volte para a Argo!`, 'skill');
        this.game.scene.remove(m.obj);
        this.markers.splice(i, 1);
        this.game.save();
      }
    }
  }

  // Opções de missão no diálogo de um NPC (ou do Quadro de Missões)
  dialogOptions(giver, back) {
    const opts = [];
    for (const q of this.forGiver(giver)) {
      if (this.ready(q)) {
        opts.push({ label: `✔ Entregar: ${q.title}`, run: () => { this.turnIn(q); return { text: `Obrigado! Aqui está sua recompensa: ${this.rewardText(q)}.`, options: [{ label: 'Continuar', run: back }, { label: 'Até mais', run: () => null }] }; } });
      } else if (this.isActive(q.id)) {
        opts.push({ label: `… ${q.title} (${this.progress(q)}/${q.count})`, run: () => ({ text: `${q.desc}\n\nProgresso: ${this.progress(q)}/${q.count}.`, options: [{ label: 'Voltar', run: back }] }) });
      } else {
        opts.push({ label: `❗ Missão: ${q.title}`, run: () => ({ text: `${q.desc}\n\nRecompensa: ${this.rewardText(q)}.`, options: [
          { label: 'Aceitar', run: () => { this.accept(q); return { text: 'Conto com você!', options: [{ label: 'Continuar', run: back }, { label: 'Até mais', run: () => null }] }; } },
          { label: 'Agora não', run: back },
        ] }) });
      }
    }
    return opts;
  }

  giverName(g) { return g ? GIVER_NAMES[g] : 'Missão principal'; }
}
