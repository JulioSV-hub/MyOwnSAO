// Câmera em terceira pessoa (tecla V): mostra seu personagem com a skin, o equipamento e a arma.
import * as THREE from 'three';
import { buildCharacter, animateCharacter } from './characters.js';
import { playerCharDef, attachWeapon } from './avatar.js';

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();

export class ThirdPerson {
  constructor(game) {
    this.game = game;
    this.on = false;
    this.body = null;
    this.key = '';
    this.dist = 3.6;
    this.cur = 3.6;
  }

  toggle() {
    const g = this.game;
    this.on = !this.on;
    if (!this.on) { this.hide(); g.combat.setVisible(true); }
    g.ui.toast(this.on ? 'Câmera em terceira pessoa (V para voltar) · roda do mouse aproxima/afasta' : 'Câmera em primeira pessoa');
  }

  hide() { if (this.body) this.body.group.visible = false; }

  rebuild(p) {
    const g = this.game;
    if (this.body) {
      g.scene.remove(this.body.group);
      this.body.group.traverse((o) => { if (o.material && !o.userData.outline) o.material.dispose?.(); });
    }
    const c = buildCharacter(playerCharDef(p));
    attachWeapon(c, p);
    c.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.scene.add(c.group);
    this.body = c;
  }

  zoom(dy) { this.dist = Math.max(1.8, Math.min(7, this.dist + dy * 0.004)); }

  // chamado depois do jogador posicionar a câmera na altura dos olhos
  update(dt) {
    const g = this.game, pl = g.player, p = g.state?.player;
    if (!this.on || !p || g.mode !== 'play') { this.hide(); return; }
    const key = JSON.stringify([p.look, p.equip, p.armor, p.weapon, p.cls, p.skin]);
    if (key !== this.key || !this.body) { this.key = key; this.rebuild(p); }
    const c = this.body;
    c.group.visible = !pl.dead;
    g.combat.setVisible(false);
    g.spells?.setVisible(false);
    c.group.position.copy(pl.pos);
    c.group.rotation.y = pl.yaw;
    const sp = Math.hypot(pl.vel.x, pl.vel.z);
    animateCharacter(c, dt, g.time, Math.min(sp, 6) * 0.6, 0, false);
    // ataque, carga, defesa e magia mexem o braço da arma
    const arm = c.parts.arms[1], a = g.combat.action;
    if (a) arm.rotation.x = 0.35 + Math.sin(Math.min(1, a.t / Math.max(0.05, a.dur)) * Math.PI) * 2.4;
    else if (g.combat.charging) arm.rotation.x = 0.35 + g.combat.charge * 2.5;
    else if (g.combat.guard) { arm.rotation.x = 1.4; arm.rotation.z = 0.6; }
    else if (g.spells?.active && g.spells.castAnim > 0) arm.rotation.x = 0.35 + g.spells.castAnim * 1.3;
    else arm.rotation.x = 0.35 + (arm.rotation.x - 0.35) * 0.85;
    if (!g.combat.guard) arm.rotation.z = 0;
    if (c.parts.face) c.parts.face.mat.map = c.parts.face.tex.open;

    // câmera atrás e um pouco acima, por cima do ombro; aproxima se bater em parede
    const cam = g.camera, eye = v1.copy(cam.position);
    cam.getWorldDirection(fwd);
    right.set(-fwd.z, 0, fwd.x).normalize();
    let want = this.dist;
    const ind = g.indoor;
    for (let d = 0.6; d <= this.dist; d += 0.3) {
      v2.copy(eye).addScaledVector(fwd, -d).addScaledVector(right, 0.45 * (d / this.dist));
      v2.y += 0.35 * (d / this.dist);
      let hit = false;
      if (ind) hit = v2.x < ind.minX - 0.3 || v2.x > ind.maxX + 0.3 || v2.z < ind.minZ - 0.3 || v2.z > ind.maxZ + 0.3;
      else {
        hit = v2.y < g.world.groundAt(v2.x, v2.z) + 0.25;
        if (!hit) for (const o of g.world.grid.query(v2.x, v2.z, 1, [])) {
          if (o.hw === undefined ? Math.hypot(v2.x - o.x, v2.z - o.z) < o.r + 0.2 : (() => { const cs = Math.cos(o.rot), sn = Math.sin(o.rot), dx = v2.x - o.x, dz = v2.z - o.z; return Math.abs(dx * cs - dz * sn) < o.hw + 0.2 && Math.abs(dx * sn + dz * cs) < o.hd + 0.2; })()) { hit = true; break; }
        }
      }
      if (hit) { want = Math.max(0.6, d - 0.3); break; }
    }
    this.cur += (want - this.cur) * Math.min(1, dt * (want < this.cur ? 18 : 4));
    const k = this.cur / this.dist;
    cam.position.copy(eye).addScaledVector(fwd, -this.cur).addScaledVector(right, 0.45 * k);
    cam.position.y += 0.35 * k;
  }
}
