// Núcleo do jogo: renderização, ciclo dia/noite, andares, combate, progressão e salvamento.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Combat } from './combat.js';
import { EnemyManager } from './enemies.js';
import { Effects } from './effects.js';
import { UI } from './ui.js';
import { Sfx } from './audio.js';
import { smoothstep } from './rng.js';
import { getFloor, expNeed, SKILLS, ITEMS, MONSTERS, MAX_FLOOR, weaponDef, armorDef, laReward } from './data.js';
import { loadSave, writeSave, deleteSave, newSave } from './save.js';

const NIGHT_TOP = new THREE.Color('#050a1c');
const NIGHT_BOTTOM = new THREE.Color('#121c34');
const SUNSET = new THREE.Color('#ff8a4a');
const MOON = new THREE.Color('#9fb4ff');
const SUN = new THREE.Color('#fff2dc');
const DEFAULT_SETTINGS = newSave('x').settings;

// Faces achatadas vistas de lado geram normal = normalize(0) = NaN; o bloom espalharia esse pixel pela tela toda.
THREE.ShaderChunk.normal_fragment_begin = THREE.ShaderChunk.normal_fragment_begin.replace(
  'vec3 normal = normalize( cross( fdx, fdy ) );',
  'vec3 fn = cross( fdx, fdy ); vec3 normal = dot( fn, fn ) > 1e-30 ? normalize( fn ) : vec3( 0.0, 0.0, 1.0 );',
);

class Game {
  constructor() {
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    r.setSize(innerWidth, innerHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    document.getElementById('game').appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#cfe8ff', 70, 470);
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 2600);
    this.scene.add(this.camera);
    this.buildSky();

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.45, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.input = new Input(r.domElement);
    this.ui = new UI(this);
    this.player = new Player(this);
    this.combat = new Combat(this);
    this.enemies = new EnemyManager(this);
    this.effects = new Effects(this);

    this.mode = 'title';
    this.state = null;
    this.world = null;
    this.floor = null;
    this.bossFight = null;
    this.time = 0;
    this.tod = 0.32;
    this.night = 0;
    this.hitstop = 0;
    this.autosaveT = 30;
    this.last = performance.now();

    this.input.onLockChange = (locked) => {
      if (!locked && this.mode === 'play' && !this.ui.menuOpen) this.ui.openMenu('status');
    };
    r.domElement.addEventListener('click', () => { if (this.mode === 'play' && !this.input.isLocked && !this.ui.menuOpen) this.input.lock(); });
    addEventListener('resize', () => this.resize());
    addEventListener('beforeunload', () => { if (this.state && this.mode !== 'title') this.save(); });

    const save = loadSave();
    this.setFloor(save ? save.progress.floor : 1);
    this.combat.setVisible(false);
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);

    if (new URLSearchParams(location.search).has('test')) {
      this.input.forceLocked = true;
      this.ui.hideTitle();
      this.startState(newSave('Tester'));
    } else {
      this.ui.showTitle(save);
    }
  }

  // ─────────── Céu, luzes e ciclo dia/noite ───────────
  buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 0.9, 0.7) }, sunVis: { value: 1 },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunVis; varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir); float h = d.y;
          vec3 col = mix(bottom, top, smoothstep(-0.02, 0.55, h));
          if (h < 0.0) col = mix(bottom, bottom * 0.7, smoothstep(0.0, -0.4, h));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          col += sunCol * (pow(s, 900.0) * 30.0 + pow(s, 14.0) * 0.35) * sunVis;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), this.skyMat);
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);

    const N = 1600, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3().randomDirection();
      v.y = Math.abs(v.y) * 0.9 + 0.05;
      v.normalize().multiplyScalar(1400);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.scene.add(this.stars);

    this.hemi = new THREE.HemisphereLight('#cfe8ff', '#4a5a3a', 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff2dc', 2.6);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -55; sc.right = sc.top = 55; sc.near = 1; sc.far = 320;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.5;
    this.scene.add(this.sun, this.sun.target);
    this.sunDir = new THREE.Vector3();
  }

  updateSky(dt, advance) {
    const s = this.state?.settings || DEFAULT_SETTINGS;
    if (advance) this.tod = (this.tod + dt / (s.dayMinutes * 60)) % 1;
    const elev = Math.sin((this.tod - 0.25) * Math.PI * 2);
    const az = this.tod * Math.PI * 2, ce = Math.sqrt(Math.max(0, 1 - elev * elev));
    const sun = this.sunDir.set(Math.cos(az) * ce, elev, Math.sin(az) * ce * 0.6 + 0.2).normalize();
    const day = smoothstep(-0.12, 0.22, elev);
    const sunset = Math.max(0, 1 - Math.abs(elev) / 0.3);
    const b = this.floor.biome.sky;
    const u = this.skyMat.uniforms;
    u.top.value.copy(NIGHT_TOP).lerp(new THREE.Color(b.top), day);
    u.bottom.value.copy(NIGHT_BOTTOM).lerp(new THREE.Color(b.bottom), day).lerp(SUNSET, sunset * 0.45);
    u.sunDir.value.copy(sun);
    u.sunVis.value = smoothstep(-0.06, 0.04, elev);
    this.scene.fog.color.copy(u.bottom.value);
    this.hemi.color.copy(u.top.value).lerp(new THREE.Color('#ffffff'), 0.5);
    this.hemi.intensity = 0.3 + 0.7 * day;
    this.sun.intensity = 0.35 + 2.3 * day;
    this.sun.color.copy(MOON).lerp(SUN, day).lerp(SUNSET, sunset * 0.4);
    const ld = elev > -0.05 ? sun : v3a.copy(sun).negate().setY(Math.max(0.35, -sun.y));
    const c = this.mode === 'title' ? v3b.set(0, 0, 0) : this.player.pos;
    this.sun.position.copy(c).addScaledVector(ld, 140);
    this.sun.target.position.copy(c);
    this.stars.material.opacity = 1 - day;
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    this.night = 1 - day;
    if (this.world?.cloudMat) this.world.cloudMat.color.copy(u.bottom.value).lerp(new THREE.Color('#ffffff'), 0.4 * day);
  }

  // ─────────── Andares ───────────
  setFloor(n) {
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
    }
    this.enemies.clear();
    this.effects.clear();
    this.ui.clearEnemyLabels();
    this.bossFight = null;
    this.floor = getFloor(n);
    this.world = new World(this, this.floor);
    this.scene.add(this.world.group);
    const [near, far] = this.floor.biome.fog;
    this.scene.fog.near = near;
    this.scene.fog.far = far;
    this.ui.setWorldLabels(this.world.labels);
  }

  loadFloor(n) {
    if (!this.world || this.world.floor.n !== n || this.enemies.list.length) this.setFloor(n);
    const pr = this.state.progress;
    pr.floor = n;
    pr.highest = Math.max(pr.highest, n);
    this.world.setDoorOpen(!!pr.cleared[n]);
    this.player.place(0, 9, 0);
    this.player.dead = false;
    this.enemies.populate();
    this.combat.reset();
    this.ui.banner(`Andar ${n}`, `${this.floor.town} — ${this.floor.desc}`, 3.5);
    this.save();
  }

  nearGate() { return this.mode === 'play' && this.player.pos.distanceTo(this.world.gatePos) < 6; }

  travel(n, viaDoor = false) {
    if (n === this.floor.n) return;
    const p = this.state.player;
    if (!viaDoor && !this.nearGate()) {
      if ((p.items.teleport_crystal || 0) <= 0) { this.ui.toast('Você precisa estar no Portal ou ter um Cristal de Teletransporte.', 'warn'); return; }
      p.items.teleport_crystal--;
    }
    this.ui.closeMenu(false);
    Sfx.teleport();
    this.ui.fade(() => {
      this.loadFloor(n);
      this.input.lock();
    });
  }

  // ─────────── Sessão ───────────
  beginGame(state) {
    this.ui.hideTitle();
    this.ui.linkStart(() => this.startState(state));
  }

  startState(state) {
    this.state = state;
    const p = state.player;
    this.tod = state.world.tod ?? 0.32;
    if (p.hp == null || p.hp <= 0) p.hp = this.stats().maxHp;
    this.mode = 'play';
    this.player.dead = false;
    this.ui.hideDeath();
    this.ui.showHUD(true);
    this.ui.refreshSkillbar();
    this.combat.setVisible(true);
    this.combat.refresh();
    this.applySettings();
    this.loadFloor(state.progress.floor);
    this.clampHp();
    this.autosaveT = 30;
    if (state.playTime < 1) {
      setTimeout(() => this.ui.toast('Bem-vindo a Aincrad! Saia da cidade e enfrente os monstros dos campos.'), 3800);
      setTimeout(() => this.ui.toast('Clique = atacar · 1 = Sword Skill "Slant" · Esc = menu'), 5200);
    }
  }

  logout() {
    this.save();
    this.ui.closeMenu(false);
    this.mode = 'title';
    this.input.unlock();
    this.combat.setVisible(false);
    this.enemies.clear();
    this.ui.clearEnemyLabels();
    this.ui.hint(null);
    this.ui.showTitle(loadSave());
  }

  wipe() {
    deleteSave();
    this.state = null;
    this.ui.closeMenu(false);
    this.mode = 'title';
    this.input.unlock();
    this.combat.setVisible(false);
    this.enemies.clear();
    this.ui.clearEnemyLabels();
    this.ui.hint(null);
    this.ui.showTitle(null);
  }

  save(manual = false) {
    if (!this.state) return;
    this.state.world.tod = this.tod;
    const ok = writeSave(this.state);
    if (manual) this.ui.toast(ok ? 'Mundo salvo.' : 'Não foi possível salvar (armazenamento cheio?).', ok ? '' : 'warn');
  }

  applySettings() {
    const s = this.state.settings;
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    Sfx.setVolume(s.volume);
    this.sun.castShadow = s.shadows;
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
  }

  // ─────────── Atributos ───────────
  stats() {
    const p = this.state.player, w = weaponDef(p.weapon), a = armorDef(p.armor);
    const o = p.dualBlades && p.offhand ? weaponDef(p.offhand) : null;
    const base = p.str * 2 + p.level * 1.5;
    return {
      maxHp: Math.round(180 + 25 * (p.level - 1) + p.vit * 15 + a.hp),
      atkR: w.atk + base,
      atkL: (o ? o.atk : w.atk) + base,
      dual: !!o,
      def: a.def + p.vit * 0.5 + p.level * 0.5,
      crit: Math.min(0.6, 0.05 + p.agi * 0.008),
      speedMul: 1 + Math.min(0.5, p.agi * 0.006),
    };
  }

  clampHp() {
    const p = this.state.player;
    p.hp = Math.min(p.hp, this.stats().maxHp);
  }

  shake(v) { this.player.shake = Math.max(this.player.shake, v); }

  // ─────────── Combate ───────────
  performHit(h, a) {
    const st = this.stats(), pl = this.player;
    const fx = -Math.sin(pl.yaw), fz = -Math.cos(pl.yaw);
    const atk = h.hand === 'L' ? st.atkL : st.atkR;
    const color = a.color ? `#${a.color.getHexString()}` : '#dfefff';
    let hits = 0, anyCrit = false;
    for (const e of this.enemies.list) {
      if (e.dead || e.state === 'intro') continue;
      const dx = e.pos.x - pl.pos.x, dz = e.pos.z - pl.pos.z, d = Math.hypot(dx, dz) || 0.001;
      if (d - e.radius > h.reach) continue;
      if (d > e.radius + 0.6 && (dx * fx + dz * fz) / d < h.arc) continue;
      const center = e.pos.y + (e.flyH ? 0 : e.height * 0.5);
      if (Math.abs(center - (pl.pos.y + 1.2)) > e.height * 0.5 + 2.2) continue;
      let dmg = atk * h.mul * (0.9 + Math.random() * 0.2);
      const crit = Math.random() < st.crit;
      if (crit) { dmg *= 1.8; anyCrit = true; }
      dmg = Math.max(1, Math.round((dmg * 60) / (60 + e.defense)));
      const kd = new THREE.Vector3(dx / d, 0, dz / d);
      const at = new THREE.Vector3(e.pos.x - kd.x * e.radius * 0.8, center + (Math.random() - 0.5) * 0.4, e.pos.z - kd.z * e.radius * 0.8);
      e.takeDamage(dmg, kd, a.skill ? 1.4 : 1);
      this.effects.sparks(at, color, a.skill ? 14 : 8);
      this.ui.damageNumber(at, dmg, crit ? 'crit' : a.skill ? 'skill' : '');
      hits++;
    }
    if (hits) {
      Sfx.hit(anyCrit);
      this.hitstop = Math.max(this.hitstop, a.skill ? 0.05 : 0.03);
      this.shake(a.skill ? 0.18 : 0.1);
    }
  }

  damagePlayer(raw, src) {
    const pl = this.player, p = this.state.player;
    if (pl.dead || this.world.inSafeZone(pl.pos)) return;
    const front = pl.forward(v3a).multiplyScalar(1.2).add(pl.pos).setY(pl.pos.y + 1.4);
    if (pl.iframes > 0) { this.ui.damageNumber(front, 'ESQUIVA', 'miss'); return; }
    const st = this.stats();
    let dmg = (raw * (0.9 + Math.random() * 0.2) * 60) / (60 + st.def);
    if (this.combat.guard && src) {
      const dx = src.pos.x - pl.pos.x, dz = src.pos.z - pl.pos.z, d = Math.hypot(dx, dz) || 1;
      const f = pl.forward(v3b);
      if ((dx * f.x + dz * f.z) / d > 0.2) {
        if (this.combat.guardT < 0.28) {
          src.stunFor?.(1.6);
          Sfx.parry();
          this.effects.ring(front, '#ffffff', 1.4, 0.35);
          this.effects.sparks(front, '#ffffff', 16, 1.2);
          this.ui.damageNumber(front, 'PARRY!', 'parry');
          this.hitstop = 0.09;
          this.shake(0.15);
          return;
        }
        dmg *= 0.3;
        pl.stamina = Math.max(0, pl.stamina - 15);
        Sfx.guard();
        this.effects.sparks(front, '#ffd080', 8);
      }
    }
    dmg = Math.max(1, Math.round(dmg));
    p.hp -= dmg;
    pl.lastHit = 0;
    this.ui.hurt(dmg / st.maxHp);
    Sfx.hurt();
    this.shake(0.3);
    if (p.hp <= 0) { p.hp = 0; this.die(); }
  }

  die() {
    const pl = this.player;
    pl.dead = true;
    pl.hot = null;
    this.state.player.deaths++;
    this.effects.shatter(pl.pos.clone(), '#7fc8ff', 1.2, 70);
    Sfx.shatter();
    Sfx.death();
    this.combat.reset();
    this.combat.setVisible(false);
    if (this.bossFight) this.endBossFight(false);
    this.mode = 'dead';
    this.ui.hint(null);
    setTimeout(() => { this.input.unlock(); this.ui.showDeath(); }, 1400);
  }

  respawn() {
    const p = this.state.player;
    const lost = Math.floor(p.exp * 0.1);
    p.exp -= lost;
    p.hp = this.stats().maxHp;
    this.player.dead = false;
    this.ui.hideDeath();
    this.player.place(0, 9, 0);
    this.combat.setVisible(true);
    this.combat.refresh();
    this.mode = 'play';
    this.input.lock();
    this.ui.toast(lost ? `Você renasceu na cidade e perdeu ${lost} EXP.` : 'Você renasceu na cidade.');
    this.save();
  }

  // ─────────── Chefe ───────────
  startBossFight() {
    const f = this.floor, w = this.world;
    const def = { speed: 4.8, range: 3, windup: 1, ...f.boss };
    const dir = new THREE.Vector3(w.towerPos.x - w.arenaPos.x, 0, w.towerPos.z - w.arenaPos.z).normalize();
    const boss = this.enemies.spawnAt(def, f.level + 4, w.arenaPos.x + dir.x * 10, w.arenaPos.z + dir.z * 10, { boss: true, aggro: true });
    this.bossFight = { boss };
    w.barrier.visible = true;
    this.ui.banner(def.name, `Chefe do Andar ${f.n}`, 3.5);
    Sfx.roar();
    this.shake(0.5);
  }

  onBossBar(boss, bar) {
    const adds = boss.def.adds;
    if (!adds) return;
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      this.enemies.spawnAt(MONSTERS[adds[i % adds.length]], this.floor.level + 1, boss.pos.x + Math.cos(a) * 6, boss.pos.z + Math.sin(a) * 6, { aggro: true, arena: true });
    }
    this.ui.toast(`${boss.def.name} convocou reforços! (barra ${bar}/${boss.bars})`, 'warn');
  }

  endBossFight(victory) {
    const bf = this.bossFight;
    if (!bf) return;
    this.bossFight = null;
    this.world.barrier.visible = false;
    if (victory) return;
    const list = this.enemies.list;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i] === bf.boss || list[i].aggroInArena) { list[i].destroy(); list.splice(i, 1); }
    }
  }

  bossDefeated(e) {
    const n = this.floor.n, pr = this.state.progress, p = this.state.player;
    this.endBossFight(true);
    for (const o of this.enemies.list) if (o.aggroInArena && !o.dead) o.takeDamage(o.hp + 1);
    pr.cleared[n] = true;
    pr.highest = Math.max(pr.highest, Math.min(MAX_FLOOR, n + 1));
    const exp = (10 + 9 * e.level) * 25 * this.state.settings.xpRate;
    const col = Math.round((5 + 3 * e.level) * 30);
    p.col += col;
    const la = laReward(n);
    const d = la.kind === 'weapon' ? weaponDef(la.id) : armorDef(la.id);
    (la.kind === 'weapon' ? p.weapons : p.armors).push(la.id);
    p.items.potion = (p.items.potion || 0) + 3;
    this.world.setDoorOpen(true);
    Sfx.victory();
    if (n >= MAX_FLOOR) this.ui.banner('AINCRAD CONQUISTADA', 'Game Clear! Você libertou todos os jogadores.', 8);
    else this.ui.banner('Congratulations!', `Andar ${n} concluído — a porta do Labirinto está aberta`, 6);
    this.ui.toast(`Last Attack Bonus: ${d.name}!`, 'skill');
    this.ui.toast(`+${Math.round(exp)} EXP · +${col} Col · +3 Poções`);
    this.gainExp(exp);
    this.save();
  }

  onEnemyKilled(e) {
    if (e.boss) { this.bossDefeated(e); return; }
    const p = this.state.player;
    p.kills++;
    const diff = p.level - e.level;
    const k = diff > 5 ? Math.max(0.1, 1 - (diff - 5) * 0.15) : 1;
    const exp = Math.round((10 + 9 * e.level) * k * this.state.settings.xpRate);
    const col = Math.round((5 + 3 * e.level) * (0.8 + Math.random() * 0.4));
    p.col += col;
    let msg = `+${exp} EXP · +${col} Col`;
    if (Math.random() < 0.4) {
      const [name, value] = e.def.drop;
      const m = (p.mats[name] ||= { qty: 0, value: Math.round(value * (1 + e.level * 0.15)) });
      m.qty++;
      msg += ` · ${name}`;
    }
    if (Math.random() < 0.07) { p.items.potion = (p.items.potion || 0) + 1; msg += ' · Poção'; }
    this.ui.toast(msg);
    this.gainExp(exp);
  }

  gainExp(x) {
    const p = this.state.player;
    p.exp += Math.round(x);
    while (p.exp >= expNeed(p.level)) {
      p.exp -= expNeed(p.level);
      this.levelUp();
    }
  }

  levelUp() {
    const p = this.state.player;
    p.level++;
    p.points += 3;
    p.hp = this.stats().maxHp;
    Sfx.levelUp();
    this.effects.levelUp(this.player.pos.clone());
    this.ui.banner('LEVEL UP!', `Nível ${p.level} · +3 pontos de atributo (menu → Status)`, 2.5);
    for (const s of SKILLS) if (s.lvl === p.level && (!s.dual || p.dualBlades)) this.unlockSkill(s);
    if (p.level >= 25 && !p.dualBlades) this.unlockDual();
    for (const l of this.ui.enemyLabels) {
      const diff = l.e.level - p.level;
      l.el.style.setProperty('--nc', diff >= 5 ? '#b0102a' : diff >= 2 ? '#ff3a3a' : diff >= -2 ? '#ff7a6a' : '#ffb8a8');
    }
  }

  unlockSkill(s) {
    const p = this.state.player;
    this.ui.toast(`Nova Sword Skill: ${s.name}!`, 'skill');
    const empty = p.slots.indexOf(null);
    if (empty >= 0 && !p.slots.includes(s.id)) p.slots[empty] = s.id;
    this.ui.refreshSkillbar();
  }

  unlockDual() {
    const p = this.state.player;
    p.dualBlades = true;
    const id = `rare_${Math.max(1, this.state.progress.highest)}`;
    p.weapons.push(id);
    if (p.weapon !== id) p.offhand = id;
    this.combat.refresh();
    this.ui.banner('Habilidade Única: Dual Blades', 'Concedida ao jogador com a maior velocidade de reação de Aincrad', 5);
    this.ui.toast(`Você recebeu ${weaponDef(id).name} para a mão esquerda!`, 'skill');
    for (const s of SKILLS) if (s.dual && s.lvl <= p.level) this.unlockSkill(s);
  }

  // ─────────── Itens e loja ───────────
  useItem(id) {
    const p = this.state.player, d = ITEMS[id];
    if (!d || !(p.items[id] > 0)) return false;
    if (id === 'teleport_crystal') { this.ui.setPanel('map'); return true; }
    const max = this.stats().maxHp;
    if (p.hp >= max) { this.ui.toast('Seu HP já está cheio.'); return false; }
    p.items[id]--;
    if (d.over) this.player.hot = { rate: (max * d.heal) / d.over, left: max * d.heal };
    else p.hp = Math.min(max, p.hp + max * d.heal);
    this.effects.ring(this.player.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), '#7aff9a', 1.2, 0.8, 1.5);
    Sfx.menuOpen();
    return true;
  }

  quickPotion() {
    const p = this.state.player;
    if (this.player.hot) return;
    if (p.items.potion > 0) this.useItem('potion');
    else if (p.items.hipotion > 0) this.useItem('hipotion');
    else this.ui.toast('Sem poções! Compre mais com o Agil na cidade.', 'warn');
  }

  buy(kind, id, q = 1) {
    const p = this.state.player;
    const d = kind === 'item' ? ITEMS[id] : kind === 'weapon' ? weaponDef(id) : armorDef(id);
    const cost = d.price * q;
    if (p.col < cost) { this.ui.toast('Col insuficiente.', 'warn'); Sfx.error(); return; }
    p.col -= cost;
    if (kind === 'item') p.items[id] = (p.items[id] || 0) + q;
    else (kind === 'weapon' ? p.weapons : p.armors).push(id);
    Sfx.coin();
    this.ui.toast(`Comprou ${q > 1 ? `${q}× ` : ''}${d.name}.`);
  }

  sellPrice(d) { return Math.max(10, Math.floor(d.price * 0.4)); }

  sellMat(name) {
    const p = this.state.player, m = p.mats[name];
    if (!m || !m.qty) return;
    p.col += m.qty * m.value;
    delete p.mats[name];
    Sfx.coin();
  }

  sellGear(kind, id) {
    const p = this.state.player, list = kind === 'weapon' ? p.weapons : p.armors;
    if (id === p.weapon || id === p.offhand || id === p.armor) return;
    const i = list.indexOf(id);
    if (i < 0) return;
    list.splice(i, 1);
    p.col += this.sellPrice(kind === 'weapon' ? weaponDef(id) : armorDef(id));
    Sfx.coin();
  }

  // ─────────── Interação ───────────
  updateInteract() {
    const pl = this.player.pos, w = this.world, n = this.floor.n, pr = this.state.progress;
    let hint = null, act = null;
    if (this.nearGate()) {
      hint = '[E] Portal de Teletransporte';
      act = () => this.ui.openMenu('map');
    } else if (pl.distanceTo(w.npcPos) < 4.5) {
      hint = '[E] Falar com Agil (loja)';
      act = () => { this.ui.shopTab = 'buy'; this.ui.openMenu('shop'); };
    } else if (Math.hypot(pl.x - w.doorPos.x, pl.z - w.doorPos.z) < 9) {
      if (pr.cleared[n] && n < MAX_FLOOR) { hint = `[E] Subir para o Andar ${n + 1}`; act = () => this.travel(n + 1, true); }
      else if (!pr.cleared[n]) hint = 'A porta está selada. Derrote o chefe deste andar na arena.';
    }
    this.ui.hint(hint);
    if (act && this.input.pressed('KeyE')) act();
    if (!this.bossFight && !pr.cleared[n] && !this.player.dead && w.inArena(pl, -3)) this.startBossFight();
  }

  handleKeys() {
    const inp = this.input;
    if (this.ui.menuOpen) {
      if (inp.pressed('Escape') || inp.pressed('Tab')) this.ui.closeMenu();
      return;
    }
    if (inp.pressed('Tab') || inp.pressed('KeyM')) { this.ui.openMenu('status'); return; }
    if (!inp.isLocked) return;
    if (inp.mouse.clicked.has(0)) this.combat.basic();
    for (let i = 0; i < 4; i++) if (inp.pressed(`Digit${i + 1}`)) this.combat.skill(i);
    if (inp.pressed('KeyR')) this.quickPotion();
  }

  // ─────────── Loop ───────────
  frame(now) {
    requestAnimationFrame(this.frame);
    const real = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    let dt = real;
    if (this.hitstop > 0) { this.hitstop -= real; dt *= 0.12; }
    this.time += dt;

    if (this.mode === 'play') {
      this.handleKeys();
      const paused = this.ui.menuOpen || !this.input.isLocked;
      this.ui.setClickToPlay(!this.ui.menuOpen && !this.input.isLocked);
      if (!paused) {
        this.player.update(dt);
        this.combat.update(dt);
        this.enemies.update(dt);
        this.updateInteract();
        this.state.playTime += real;
        this.autosaveT -= real;
        if (this.autosaveT <= 0) { this.autosaveT = 30; this.save(); }
      }
      this.effects.update(paused ? 0 : dt);
      this.updateSky(dt, !paused);
    } else if (this.mode === 'dead') {
      this.ui.setClickToPlay(false);
      this.enemies.update(dt);
      this.effects.update(dt);
      this.combat.update(dt);
      this.updateSky(dt, true);
    } else {
      this.ui.setClickToPlay(false);
      const t = this.time * 0.04;
      this.camera.position.set(Math.cos(t) * 72, 32, Math.sin(t) * 72);
      this.camera.lookAt(0, 6, 0);
      this.effects.update(dt);
      this.updateSky(dt, true);
    }
    this.world.update(dt, this.time, this.night);

    if (this.state?.settings.bloom !== false) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    if (this.mode !== 'title') this.ui.update(real);
    this.input.endFrame();
  }
}

const v3a = new THREE.Vector3();
const v3b = new THREE.Vector3();

window.__game = new Game();
