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

    // clima: partículas que caem (ou sobem) em volta da câmera
    const WN = 1800;
    this.wN = WN;
    this.wPos = new Float32Array(WN * 3);
    this.wVel = new Float32Array(WN * 3);
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(this.wPos, 3));
    this.weatherPts = new THREE.Points(wg, new THREE.PointsMaterial({ size: 0.12, map: dot, color: '#ffffff', transparent: true, depthWrite: false }));
    this.weatherPts.frustumCulled = false;
    this.weatherPts.visible = false;
    this.group.add(this.weatherPts);
    // chuva em riscos (linhas)
    this.rPos = new Float32Array(WN * 6);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#b8cce0', transparent: true, opacity: 0.45, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.group.add(this.rain);
    this.weather = 'none';
  }

  setWeather(type) {
    this.weather = type || 'none';
    const S = { snow: ['#ffffff', 0.34, 1, false], petals: ['#ff9cc0', 0.38, 1, false], leaves: ['#e0782a', 0.42, 1, false], ash: ['#8a847e', 0.24, 0.85, false],
      spores: ['#9af0ff', 0.22, 1, true], sparkles: ['#d8c8ff', 0.2, 1, true] }[this.weather];
    this.rain.visible = this.weather === 'rain';
    this.weatherPts.visible = !!S;
    if (S) {
      const m = this.weatherPts.material;
      m.color.set(S[0]);
      if (S[3]) m.color.multiplyScalar(1.8);
      m.size = S[1];
      m.opacity = S[2];
      m.blending = S[3] ? THREE.AdditiveBlending : THREE.NormalBlending;
    }
    const c = this.game.camera.position;
    for (let i = 0; i < this.wN; i++) this.respawnW(i, c, true);
  }

  respawnW(i, c, any) {
    const p = this.wPos, v = this.wVel, t = this.weather, up = t === 'spores' || t === 'sparkles';
    p[i * 3] = c.x + (Math.random() - 0.5) * 60;
    p[i * 3 + 1] = any ? c.y - 8 + Math.random() * 30 : up ? c.y - 10 : c.y + 18 + Math.random() * 4;
    p[i * 3 + 2] = c.z + (Math.random() - 0.5) * 60;
    const fall = { rain: -26, snow: -1.4, petals: -1.1, leaves: -1.6, ash: -0.8, spores: 0.5, sparkles: 0.7 }[t] || -1;
    v[i * 3] = (Math.random() - 0.5) * (t === 'rain' ? 0.5 : 1.2) + (t === 'petals' || t === 'leaves' ? 0.8 : 0);
    v[i * 3 + 1] = fall * (0.7 + Math.random() * 0.6);
    v[i * 3 + 2] = (Math.random() - 0.5) * (t === 'rain' ? 0.5 : 1.2);
  }

  updateWeather(dt, t) {
    const w = this.weather;
    const g = this.game;
    const hide = w === 'none' || w === 'mist' || g.indoor || g.mode === 'title';
    if (hide) { this.rain.visible = false; this.weatherPts.visible = false; return; }
    this.rain.visible = w === 'rain';
    this.weatherPts.visible = w !== 'rain';
    const c = g.camera.position, p = this.wPos, v = this.wVel, n = w === 'rain' ? this.wN : Math.round(this.wN * 0.55);
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      const sway = w === 'rain' ? 0 : Math.sin(t * 1.3 + i) * 0.6;
      p[k] += (v[k] + sway) * dt;
      p[k + 1] += v[k + 1] * dt;
      p[k + 2] += (v[k + 2] + Math.cos(t * 1.1 + i) * (w === 'rain' ? 0 : 0.4)) * dt;
      const dx = p[k] - c.x, dz = p[k + 2] - c.z;
      const dy = p[k + 1] - c.y;
      // partículas coladas na câmera viram borrões enormes na tela (e pesam muito): mantém distância
      if (dy < -10 || dy > 24 || Math.abs(dx) > 32 || Math.abs(dz) > 32 || (w !== 'rain' && dx * dx + dy * dy + dz * dz < 9)) this.respawnW(i, c, false);
    }
    if (w === 'rain') {
      const r = this.rPos;
      for (let i = 0; i < n; i++) {
        const k = i * 3, j = i * 6;
        r[j] = p[k]; r[j + 1] = p[k + 1]; r[j + 2] = p[k + 2];
        r[j + 3] = p[k] - v[k] * 0.03; r[j + 4] = p[k + 1] - v[k + 1] * 0.03; r[j + 5] = p[k + 2] - v[k + 2] * 0.03;
      }
      this.rain.geometry.setDrawRange(0, n * 2);
      this.rain.geometry.attributes.position.needsUpdate = true;
    } else {
      this.weatherPts.geometry.setDrawRange(0, n);
      this.weatherPts.geometry.attributes.position.needsUpdate = true;
    }
  }

  setWorld(world) {
    this.setWeather(world.floor.weather);
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
    this.updateWeather(dt, t);
  }
}
