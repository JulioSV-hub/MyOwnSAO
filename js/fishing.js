// Pesca: lance a linha (F), espere a boia afundar e puxe (F) no tempo certo.
import * as THREE from 'three';
import { Sfx } from './audio.js';

export const FISH = [
  { name: 'Peixe-prata', value: 8, w: 50 },
  { name: 'Truta Azul', value: 15, w: 28 },
  { name: 'Carpa Listrada', value: 24, w: 14 },
  { name: 'Peixe-lua', value: 48, w: 9, night: true },
  { name: 'Carpa Dourada', value: 130, w: 2.5, rare: true },
];
export const isFish = (name) => FISH.some((f) => f.name === name);

export class Fishing {
  constructor(game) {
    this.game = game;
    this.state = null;
    // vara na mão (presa à câmera)
    const rod = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#7a5232', roughness: 0.7 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.02, 1.6, 8).translate(0, 0.8, 0), wood);
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 14), new THREE.MeshStandardMaterial({ color: '#8a8a94', metalness: 0.8, roughness: 0.3 }));
    reel.rotation.z = Math.PI / 2;
    reel.position.y = 0.18;
    rod.add(shaft, reel);
    rod.position.set(0.32, -0.42, -0.5);
    rod.rotation.set(-0.9, 0.25, -0.15);
    rod.visible = false;
    rod.traverse((o) => { if (o.isMesh) { o.renderOrder = 10; o.frustumCulled = false; } });
    game.camera.add(rod);
    this.rod = rod;
    this.tipLocal = new THREE.Vector3(0, 1.6, 0);
    // boia e linha
    const bob = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3a2a' }));
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    bob.add(top, bot);
    bob.visible = false;
    game.scene.add(bob);
    this.bobber = bob;
    const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#e8e8e8', transparent: true, opacity: 0.7 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    game.scene.add(this.line);
  }

  hasRod() { return (this.game.state.player.items.fishing_rod || 0) > 0; }

  // procura água 3–8 m à frente do jogador (lago de pesca do andar ou água do bioma)
  waterAhead() {
    const g = this.game, w = g.world, pl = g.player;
    const f = pl.forward();
    for (let d = 3; d <= 8; d += 0.5) {
      const x = pl.pos.x + f.x * d, z = pl.pos.z + f.z * d;
      if (w.pond && Math.hypot(x - w.pond.x, z - w.pond.z) < w.pond.r - 0.6) return new THREE.Vector3(x, w.pond.level, z);
      if (w.water && !w.water.lava && w.groundAt(x, z) < w.water.level - 0.3) return new THREE.Vector3(x, w.water.level, z);
    }
    return null;
  }

  get active() { return !!this.state; }

  press() {
    const g = this.game;
    if (!this.state) {
      const pt = this.waterAhead();
      if (!pt) return false;
      if (!this.hasRod()) { Sfx.error(); g.ui.toast('Você precisa de uma Vara de Pesca (Agil vende).', 'warn'); return true; }
      g.combat.setSheathed(true, true);
      this.state = { phase: 'cast', t: 0, target: pt, wait: 2.5 + Math.random() * 5 };
      this.rod.visible = true;
      this.bobber.visible = true;
      this.line.visible = true;
      Sfx.swing();
      return true;
    }
    const s = this.state;
    if (s.phase === 'bite') this.catchFish();
    else if (s.phase === 'wait') { g.ui.toast('Puxou cedo demais... o peixe se assustou.'); this.stop(); }
    else this.stop();
    return true;
  }

  stop() {
    this.state = null;
    this.rod.visible = false;
    this.bobber.visible = false;
    this.line.visible = false;
  }

  catchFish() {
    const g = this.game, p = g.state.player, night = g.night > 0.5;
    const pool = FISH.filter((f) => !f.night || night);
    let roll = Math.random() * pool.reduce((a, f) => a + f.w, 0), fish = pool[0];
    for (const f of pool) { roll -= f.w; if (roll <= 0) { fish = f; break; } }
    const value = Math.round(fish.value * (1 + g.floor.n * 0.15));
    const m = (p.mats[fish.name] ||= { qty: 0, value });
    m.qty++;
    g.effects.sparks(this.state.target.clone().add(new THREE.Vector3(0, 0.3, 0)), '#bfe8ff', 18, 0.8);
    Sfx.coin();
    if (fish.rare) { Sfx.levelUp(); g.ui.banner('Peixe raro!', `${fish.name} — vale ${value} Col`, 3); }
    else g.ui.toast(`🎣 Você pescou: ${fish.name} (${value} Col)`, 'skill');
    p.fishCaught = (p.fishCaught || 0) + 1;
    g.quests.onFish();
    this.stop();
    g.save();
  }

  update(dt) {
    const s = this.state, g = this.game;
    if (!s) return;
    // andar, atacar ou abrir menu cancela a pesca
    if (Math.hypot(g.player.vel.x, g.player.vel.z) > 1.2 || g.player.dead) { this.stop(); return; }
    s.t += dt;
    const tip = this.rod.localToWorld(this.tipLocal.clone());
    if (s.phase === 'cast') {
      const f = Math.min(1, s.t / 0.6);
      const start = tip;
      const pos = start.clone().lerp(s.target, f);
      pos.y += Math.sin(f * Math.PI) * 2;
      this.bobber.position.copy(pos);
      if (f >= 1) { s.phase = 'wait'; s.t = 0; g.effects.sparks(s.target.clone(), '#bfe8ff', 8, 0.4); }
    } else if (s.phase === 'wait') {
      this.bobber.position.set(s.target.x, s.target.y + Math.sin(g.time * 3) * 0.03, s.target.z);
      if (s.t > s.wait) { s.phase = 'bite'; s.t = 0; Sfx.hit(false); g.ui.toast('❗ Fisgou! Aperte F agora!', 'skill'); }
    } else if (s.phase === 'bite') {
      this.bobber.position.set(s.target.x, s.target.y - 0.12 + Math.sin(g.time * 30) * 0.05, s.target.z);
      if (s.t > 0.95) { g.ui.toast('O peixe escapou...'); this.stop(); return; }
    }
    const pos = this.line.geometry.attributes.position;
    pos.setXYZ(0, tip.x, tip.y, tip.z);
    pos.setXYZ(1, this.bobber.position.x, this.bobber.position.y + 0.05, this.bobber.position.z);
    pos.needsUpdate = true;
  }
}
