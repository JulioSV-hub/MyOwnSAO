// Efeitos visuais: estilhaços de polígonos (a morte em SAO), faíscas de impacto e anéis de luz.
import * as THREE from 'three';

export const hdr = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);

const shardGeo = new THREE.TetrahedronGeometry(0.16, 0);
const sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.35);
const ringGeo = new THREE.TorusGeometry(1, 0.05, 6, 48).rotateX(Math.PI / 2);
const discGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);

export class Effects {
  constructor(game) {
    this.game = game;
    this.items = [];
  }

  add(obj, life, update) {
    this.game.scene.add(obj);
    this.items.push({ obj, life, max: life, update });
  }

  shatter(pos, color, scale = 1, count = 46) {
    const mat = new THREE.MeshBasicMaterial({ color: hdr(color, 1.2).lerp(hdr('#bfe8ff', 2.4), 0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const g = new THREE.Group();
    const vel = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(shardGeo, mat);
      m.position.set((Math.random() - 0.5) * scale, Math.random() * scale * 1.4, (Math.random() - 0.5) * scale);
      m.scale.setScalar((0.6 + Math.random() * 1.2) * Math.max(1, scale * 0.6));
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      g.add(m);
      const v = m.position.clone().setY(0).normalize().multiplyScalar(2 + Math.random() * 5 * scale);
      v.y = 2 + Math.random() * 5;
      vel.push(v);
    }
    g.position.copy(pos);
    this.add(g, 1.3, (it, dt) => {
      const f = it.life / it.max;
      g.children.forEach((m, i) => {
        m.position.addScaledVector(vel[i], dt);
        vel[i].multiplyScalar(1 - dt * 1.6);
        vel[i].y -= dt * 2;
        m.rotation.x += dt * 6;
        m.rotation.y += dt * 4;
      });
      mat.opacity = f;
    });
    this.flash(pos.clone().add(new THREE.Vector3(0, scale * 0.6, 0)), color, scale * 2.2);
  }

  flash(pos, color, size = 2) {
    const mat = new THREE.MeshBasicMaterial({ color: hdr(color, 2).lerp(hdr('#ffffff', 3), 0.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), mat);
    m.position.copy(pos);
    this.add(m, 0.25, (it) => {
      const f = 1 - it.life / it.max;
      m.scale.setScalar(size * (0.3 + f));
      mat.opacity = 1 - f;
    });
  }

  sparks(pos, color, count = 10, power = 1) {
    const mat = new THREE.MeshBasicMaterial({ color: hdr(color, 3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const g = new THREE.Group();
    const vel = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(sparkGeo, mat);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar((4 + Math.random() * 8) * power);
      m.lookAt(v);
      g.add(m);
      vel.push(v);
    }
    g.position.copy(pos);
    this.add(g, 0.35, (it, dt) => {
      g.children.forEach((m, i) => { m.position.addScaledVector(vel[i], dt); vel[i].y -= dt * 12; });
      mat.opacity = it.life / it.max;
    });
  }

  ring(pos, color, radius = 3, life = 0.6, rise = 0) {
    const mat = new THREE.MeshBasicMaterial({ color: hdr(color, 2.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(ringGeo, mat);
    m.position.copy(pos);
    this.add(m, life, (it, dt) => {
      const f = 1 - it.life / it.max;
      m.scale.setScalar(radius * (0.2 + f));
      m.position.y += rise * dt;
      mat.opacity = 1 - f;
    });
  }

  shockwave(pos, color, radius) {
    const mat = new THREE.MeshBasicMaterial({ color: hdr(color, 1.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(discGeo, mat);
    m.position.copy(pos).add(new THREE.Vector3(0, 0.15, 0));
    this.add(m, 0.5, (it) => {
      const f = 1 - it.life / it.max;
      m.scale.setScalar(radius * (0.3 + f * 0.8));
      mat.opacity = (1 - f) * 0.7;
    });
    this.ring(pos.clone().add(new THREE.Vector3(0, 0.3, 0)), color, radius * 1.1, 0.5);
  }

  levelUp(pos) {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => this.ring(pos.clone().add(new THREE.Vector3(0, 0.2, 0)), '#ffd75a', 1.6, 1.4, 2.2), i * 140);
    }
    this.sparks(pos.clone().add(new THREE.Vector3(0, 1, 0)), '#ffe48a', 26, 0.8);
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.life <= 0) {
        this.game.scene.remove(it.obj);
        this.disposeObj(it.obj);
        this.items.splice(i, 1);
        continue;
      }
      it.update?.(it, dt);
    }
  }

  disposeObj(o) {
    o.traverse((c) => {
      if (c.material && !c.material._shared) c.material.dispose();
      if (c.geometry && c.geometry !== shardGeo && c.geometry !== sparkGeo && c.geometry !== ringGeo && c.geometry !== discGeo) c.geometry.dispose();
    });
  }

  clear() {
    for (const it of this.items) { this.game.scene.remove(it.obj); this.disposeObj(it.obj); }
    this.items = [];
  }
}
