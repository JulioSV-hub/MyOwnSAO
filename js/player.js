// Movimento em primeira pessoa: andar, correr, pular, esquivar (com invencibilidade) e câmera.
import * as THREE from 'three';
import { FLOOR_R, ARENA_R } from './world.js';
import { Sfx } from './audio.js';

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 0.42;
    this.eye = 1.65;
    this.onGround = false;
    this.stamina = 100;
    this.staminaCD = 0;
    this.dodge = 0;
    this.dodgeDir = new THREE.Vector3();
    this.iframes = 0;
    this.lunge = 0;
    this.bob = 0;
    this.shake = 0;
    this.dead = false;
    this.lastHit = 99;
    this.hot = null;
    this.roll = 0;
  }

  place(x, z, yaw = 0) {
    this.game.indoor = null;
    this.pos.set(x, 0, z);
    this.game.world.resolve(this.pos, this.radius);
    this.pos.y = this.game.world.groundAt(this.pos.x, this.pos.z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.dodge = 0;
    this.lunge = 0;
  }

  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  update(dt) {
    const g = this.game, inp = g.input, s = g.state.settings, w = g.world, st = g.stats();
    const sens = 0.0022 * s.sens;
    this.yaw -= inp.mouse.dx * sens;
    this.pitch -= inp.mouse.dy * sens * (s.invertY ? -1 : 1);
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));

    let f = 0, r = 0;
    if (inp.held('KeyW')) f += 1;
    if (inp.held('KeyS')) f -= 1;
    if (inp.held('KeyD')) r += 1;
    if (inp.held('KeyA')) r -= 1;
    const canMove = !g.combat.locked && !this.dead;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let wx = fx * f + rx * r, wz = fz * f + rz * r;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }

    let speed = 5.2 * st.speedMul;
    const sprinting = inp.held('ShiftLeft') && f > 0 && this.stamina > 1 && !g.combat.guard && canMove;
    if (sprinting) { speed *= 1.65; this.stamina -= 14 * dt; this.staminaCD = 0.8; }
    if (g.combat.guard) speed *= 0.45;
    if (g.combat.action?.basic) speed *= 0.55;
    const water = w.inWater(this.pos);
    if (water) speed *= 0.65;

    if (inp.pressed('KeyQ') && canMove && this.stamina >= 25 && this.dodge <= 0) {
      if (wl > 0) this.dodgeDir.set(wx, 0, wz);
      else this.dodgeDir.set(-fx, 0, -fz);
      this.dodge = 0.26;
      this.iframes = 0.32;
      this.stamina -= 25;
      this.staminaCD = 0.8;
      this.roll = r !== 0 ? -r : 0;
      Sfx.dash();
    }

    if (this.dodge > 0) {
      this.dodge -= dt;
      this.vel.x = this.dodgeDir.x * 15;
      this.vel.z = this.dodgeDir.z * 15;
    } else if (this.lunge) {
      this.vel.x = fx * this.lunge;
      this.vel.z = fz * this.lunge;
    } else {
      const accel = this.onGround ? 14 : 4;
      const k = Math.min(1, accel * dt), m = canMove ? speed : 0;
      this.vel.x += (wx * m - this.vel.x) * k;
      this.vel.z += (wz * m - this.vel.z) * k;
    }

    if (inp.pressed('Space') && this.onGround && canMove) {
      this.vel.y = 7.2;
      this.onGround = false;
    }
    this.vel.y -= 24 * dt;
    const wasGround = this.onGround;
    this.pos.addScaledVector(this.vel, dt);

    const ind = g.indoor;
    if (ind) {
      g.housing.resolve(this.pos, this.radius);
      this.pos.x = Math.max(ind.minX, Math.min(ind.maxX, this.pos.x));
      this.pos.z = Math.max(ind.minZ, Math.min(ind.maxZ, this.pos.z));
    } else {
      w.resolve(this.pos, this.radius);
      const d = Math.hypot(this.pos.x, this.pos.z);
      if (d > FLOOR_R - 4) { const k = (FLOOR_R - 4) / d; this.pos.x *= k; this.pos.z *= k; }
    }
    if (g.bossFight) {
      const ax = this.pos.x - w.arenaPos.x, az = this.pos.z - w.arenaPos.z, da = Math.hypot(ax, az);
      if (da > ARENA_R - 1) { const k = (ARENA_R - 1) / da; this.pos.x = w.arenaPos.x + ax * k; this.pos.z = w.arenaPos.z + az * k; }
    }
    const gy = ind ? ind.y : w.groundAt(this.pos.x, this.pos.z);
    if (this.pos.y <= gy || (wasGround && this.vel.y <= 0 && this.pos.y - gy < 0.45)) {
      this.pos.y = gy;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    if (!sprinting && this.dodge <= 0) {
      this.staminaCD -= dt;
      if (this.staminaCD <= 0) this.stamina = Math.min(100, this.stamina + 24 * dt);
    }
    this.stamina = Math.max(0, this.stamina);
    this.iframes = Math.max(0, this.iframes - dt);
    this.lastHit += dt;

    const p = g.state.player;
    if (!this.dead) {
      const safe = w.inSafeZone(this.pos);
      if (this.lastHit > 8 || safe) p.hp = Math.min(st.maxHp, p.hp + st.maxHp * (safe ? 0.08 : 0.012) * dt);
      if (this.hot) {
        const h = Math.min(this.hot.left, this.hot.rate * dt);
        p.hp = Math.min(st.maxHp, p.hp + h);
        this.hot.left -= h;
        if (this.hot.left <= 0.01 || p.hp >= st.maxHp) this.hot = null;
      }
    }

    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const cam = this.game.camera;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround) this.bob += dt * sp * 1.7;
    const bobY = Math.sin(this.bob * 2) * 0.045 * Math.min(1, sp / 6);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = this.shake * this.shake * 0.35;
    this.roll += ((this.dodge > 0 ? this.roll : 0) - this.roll) * Math.min(1, dt * 10);
    cam.position.set(
      this.pos.x + (Math.random() - 0.5) * sh,
      this.pos.y + this.eye + bobY + (Math.random() - 0.5) * sh,
      this.pos.z + (Math.random() - 0.5) * sh,
    );
    cam.rotation.set(this.pitch, this.yaw, this.dodge > 0 ? this.roll * 0.12 : 0, 'YXZ');
  }
}
