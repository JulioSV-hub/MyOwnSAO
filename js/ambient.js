// Vida ambiente: borboletas de dia, vaga-lumes à noite, bandos de pássaros e fumaça saindo das chaminés.
import * as THREE from 'three';

function softDot() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const BUTTERFLY_COLORS = ['#ffd84a', '#ffffff', '#ff9ac8', '#8ac8ff', '#ffa040', '#c8a0ff'];

export class Ambient {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    const dot = softDot();

    // borboletas
    this.butterflies = [];
    const wingGeo = new THREE.CircleGeometry(0.11, 10).translate(0.1, 0, 0);
    for (let i = 0; i < 26; i++) {
      const b = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length], side: THREE.DoubleSide, transparent: true });
      const wl = new THREE.Mesh(wingGeo, mat), wr = new THREE.Mesh(wingGeo, mat);
      wr.scale.x = -1;
      b.add(wl, wr, new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.08, 2, 4), new THREE.MeshBasicMaterial({ color: '#2a2018' })));
      b.children[2].rotation.x = Math.PI / 2;
      b.userData = { wl, wr, mat, phase: Math.random() * 10, vel: new THREE.Vector3(), target: new THREE.Vector3(), t: 0 };
      this.group.add(b);
      this.butterflies.push(b);
    }

    // vaga-lumes
    const FN = 160;
    this.fireflyPos = new Float32Array(FN * 3);
    this.fireflyCol = new Float32Array(FN * 3);
    this.fireflyData = Array.from({ length: FN }, () => ({ phase: Math.random() * 10, speed: 0.5 + Math.random(), base: new THREE.Vector3() }));
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(this.fireflyPos, 3));
    fg.setAttribute('color', new THREE.BufferAttribute(this.fireflyCol, 3));
    this.fireflies = new THREE.Points(fg, new THREE.PointsMaterial({ size: 0.22, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.fireflies.frustumCulled = false;
    this.group.add(this.fireflies);

    // pássaros (asas em "V")
    this.flocks = [];
    const birdMat = new THREE.MeshBasicMaterial({ color: '#2a2a34', side: THREE.DoubleSide, transparent: true });
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.15, 0, 0, 0.2, 0.9, 0, 0.05], 3));
    for (let f = 0; f < 3; f++) {
      const flock = { birds: [], r: 70 + f * 35, h: 38 + f * 9, speed: 0.08 + f * 0.02, a: Math.random() * 6, dir: f % 2 ? 1 : -1 };
      for (let i = 0; i < 6; i++) {
        const b = new THREE.Group(), l = new THREE.Mesh(wing, birdMat), r = new THREE.Mesh(wing, birdMat);
        r.scale.x = -1;
        b.add(l, r);
        b.userData = { l, r, off: new THREE.Vector3((i % 3 - 1) * 2.5, Math.random() * 1.5, -Math.floor(i / 3) * 2.5 - Math.abs(i % 3 - 1) * 1.5), phase: Math.random() * 6 };
        this.group.add(b);
        flock.birds.push(b);
      }
      this.flocks.push(flock);
    }
    this.birdMat = birdMat;

    // fumaça das chaminés
    this.SMOKE_PER = 9;
    this.smokeMax = 60 * this.SMOKE_PER;
    this.smokePos = new Float32Array(this.smokeMax * 3);
    this.smokeAge = new Float32Array(this.smokeMax);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.smokePos, 3));
    this.smoke = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, map: dot, color: '#e8e4e0', transparent: true, opacity: 0.35, depthWrite: false }));
    this.smoke.frustumCulled = false;
    this.group.add(this.smoke);
    this.chimneys = [];
  }

  setWorld(world) {
    this.chimneys = (world.chimneys || []).slice(0, 60);
    const n = this.chimneys.length * this.SMOKE_PER;
    for (let i = 0; i < this.smokeMax; i++) { this.smokeAge[i] = Math.random() * 6; this.smokePos[i * 3 + 1] = -999; }
    this.smoke.geometry.setDrawRange(0, n);
    this.grassy = (world.b.grass ?? 1) > 0.3;
    for (const b of this.butterflies) b.userData.t = 0;
    for (const f of this.fireflyData) f.base.set(1e9, 0, 0);
  }

  update(dt, t, night) {
    const g = this.game, w = g.world, cam = g.camera.position, pl = g.player.pos;
    if (!w) return;
    const day = 1 - night;
    // borboletas: voam perto do jogador, de dia, em andares com grama
    const showB = day > 0.4 && this.grassy;
    for (const b of this.butterflies) {
      const u = b.userData;
      b.visible = showB;
      if (!showB) continue;
      if (u.t <= 0 || b.position.distanceTo(pl) > 32) {
        if (b.position.distanceTo(pl) > 32 || u.t === 0) {
          const a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 20;
          b.position.set(pl.x + Math.cos(a) * d, 0, pl.z + Math.sin(a) * d);
          b.position.y = w.groundAt(b.position.x, b.position.z) + 0.6 + Math.random();
        }
        u.target.set(b.position.x + (Math.random() - 0.5) * 8, 0, b.position.z + (Math.random() - 0.5) * 8);
        u.target.y = w.groundAt(u.target.x, u.target.z) + 0.4 + Math.random() * 1.4;
        u.t = 2 + Math.random() * 3;
      }
      u.t -= dt;
      u.vel.lerp(u.target.clone().sub(b.position).normalize().multiplyScalar(1.4), Math.min(1, dt * 2));
      b.position.addScaledVector(u.vel, dt);
      b.position.y += Math.sin(t * 6 + u.phase) * dt * 0.6;
      b.rotation.y = Math.atan2(u.vel.x, u.vel.z);
      const flap = Math.sin(t * 22 + u.phase) * 1.1;
      u.wl.rotation.z = flap;
      u.wr.rotation.z = -flap;
      u.mat.opacity = Math.min(1, (day - 0.4) * 4);
    }
    // vaga-lumes: à noite, piscando em volta do jogador
    const fpos = this.fireflyPos, fcol = this.fireflyCol;
    this.fireflies.visible = night > 0.25;
    if (this.fireflies.visible) {
      this.fireflyData.forEach((f, i) => {
        if (f.base.distanceTo(pl) > 34) {
          const a = Math.random() * Math.PI * 2, d = 5 + Math.random() * 26;
          f.base.set(pl.x + Math.cos(a) * d, 0, pl.z + Math.sin(a) * d);
          f.base.y = w.groundAt(f.base.x, f.base.z) + 0.4 + Math.random() * 2.2;
        }
        const ph = t * f.speed + f.phase;
        fpos[i * 3] = f.base.x + Math.sin(ph * 0.7) * 1.2;
        fpos[i * 3 + 1] = f.base.y + Math.sin(ph * 1.3) * 0.4;
        fpos[i * 3 + 2] = f.base.z + Math.cos(ph * 0.6) * 1.2;
        const blink = Math.max(0, Math.sin(ph * 2.2)) ** 3 * Math.min(1, (night - 0.25) * 3);
        fcol[i * 3] = 2.2 * blink; fcol[i * 3 + 1] = 2.6 * blink; fcol[i * 3 + 2] = 0.6 * blink;
      });
      this.fireflies.geometry.attributes.position.needsUpdate = true;
      this.fireflies.geometry.attributes.color.needsUpdate = true;
    }
    // pássaros circulando sobre a ilha
    this.birdMat.opacity = Math.min(1, day * 1.5);
    for (const f of this.flocks) {
      f.a += dt * f.speed * f.dir;
      const cx = Math.cos(f.a) * f.r, cz = Math.sin(f.a) * f.r, heading = f.a + (f.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      for (const b of f.birds) {
        const u = b.userData, off = u.off.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -heading + Math.PI / 2);
        b.position.set(cx + off.x, f.h + off.y + Math.sin(t * 0.8 + u.phase) * 0.6, cz + off.z);
        b.rotation.y = -heading + Math.PI / 2;
        const flap = Math.sin(t * 7 + u.phase) * 0.5;
        u.l.rotation.z = flap;
        u.r.rotation.z = -flap;
        b.visible = day > 0.1;
      }
    }
    // fumaça das chaminés: só as próximas da câmera para economizar
    const sp = this.smokePos, age = this.smokeAge, life = 6;
    this.chimneys.forEach((c, ci) => {
      const near = Math.abs(c.x - cam.x) + Math.abs(c.z - cam.z) < 150;
      for (let k = 0; k < this.SMOKE_PER; k++) {
        const i = ci * this.SMOKE_PER + k;
        age[i] += dt;
        if (age[i] > life) age[i] -= life;
        const a = age[i] / life;
        if (!near) { sp[i * 3 + 1] = -999; continue; }
        sp[i * 3] = c.x + Math.sin(a * 5 + ci) * 0.4 + a * 1.6;
        sp[i * 3 + 1] = c.y + a * 5;
        sp[i * 3 + 2] = c.z + Math.cos(a * 4 + ci) * 0.4 + a * 0.6;
      }
    });
    this.smoke.geometry.attributes.position.needsUpdate = true;
    this.smoke.material.opacity = 0.3 * (0.5 + day * 0.5);
  }
}
