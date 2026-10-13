// Núcleo do jogo: renderização, ciclo dia/noite, andares, combate, progressão e salvamento.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Combat } from './combat.js';
import { EnemyManager } from './enemies.js';
import { NPCManager } from './npcs.js';
import { Quests } from './quests.js';
import { Ambient } from './ambient.js';
import { Pets } from './pets.js';
import { Fishing } from './fishing.js';
import { Housing } from './housing.js';
import { Party } from './party.js';
import { Loot } from './loot.js';
import { Spells, SPELLS } from './spells.js';
import { loadModels } from './models.js';
import { Effects } from './effects.js';
import { UI } from './ui.js';
import { Sfx } from './audio.js';
import { windTime } from './toon.js';
import { Music } from './music.js';
import { smoothstep } from './rng.js';
import { getFloor, expNeed, SKILLS, ITEMS, MONSTERS, MAX_FLOOR, weaponDef, armorDef, laReward, runeDef, FOODS, MERCS, mercPrice, runeSlotsFor, DISHES, INGREDIENTS, RUNES, RUNE_TIER_FLOOR, pieceDef, randomPiece } from './data.js';
import { isFish } from './fishing.js';
import { guildRank, guildDiscount } from './guild.js';
import { classBonus, CLASSES, normalizeTalents } from './classes.js';
import { checkCompletion } from './completion.js';
import { classPicker } from './talentui.js';
import { adoptPrice, ADOPT_NAMES } from './shopui.js';
import { loadSave, writeSave, deleteSave, newSave, recordDeath, getRecord, listSaves } from './save.js';

const NIGHT_TOP = new THREE.Color('#050a1c');
const NIGHT_BOTTOM = new THREE.Color('#121c34');
const SUNSET = new THREE.Color('#ff8a4a');
const MOON = new THREE.Color('#9fb4ff');
const SUN = new THREE.Color('#fff2dc');
const WHITE = new THREE.Color('#ffffff');
const DEFAULT_SETTINGS = newSave('x').settings;
const UPGRADE_STEP = 0.1; // cada nível na Lisbeth: +10% do ataque da arma
const CLOUD_SHADE = new THREE.Color('#a9bfe0');
const CLOUD_SUNSET = new THREE.Color('#ffd2a8');
const CLOUD_DUSK = new THREE.Color('#9a86b8');

// Tratamento de cor final "pintura": saturação, calor, contraste suave, vinheta e grão de papel.
const GRADE = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, 1.14);
      col *= vec3(1.035, 1.0, 0.955);
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.18);
      vec2 q = vUv - 0.5;
      col *= 1.0 - dot(q, q) * 0.6;
      float g = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
      col += (g - 0.5) * 0.02;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

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
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1;
    document.getElementById('game').appendChild(r.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.3;
    this.scene.fog = new THREE.Fog('#cfe8ff', 70, 470);
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 2600);
    this.scene.add(this.camera);
    this.buildSky();

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.45, 1.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GRADE);
    this.composer.addPass(this.grade);

    this.input = new Input(r.domElement);
    this.ui = new UI(this);
    this.player = new Player(this);
    this.combat = new Combat(this);
    this.enemies = new EnemyManager(this);
    this.npcs = new NPCManager(this);
    this.quests = new Quests(this);
    this.ambient = new Ambient(this);
    this.pets = new Pets(this);
    this.fishing = new Fishing(this);
    this.housing = new Housing(this);
    this.party = new Party(this);
    this.loot = new Loot(this);
    this.spells = new Spells(this);
    this.indoor = null;
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
      if (!locked && this.mode === 'play' && !this.ui.menuOpen && !this.ui.dialogOpen) this.ui.openMenu('status');
    };
    r.domElement.addEventListener('click', () => { if (this.mode === 'play' && !this.input.isLocked && !this.ui.menuOpen) this.input.lock(); });
    this.input.wantLock = () => this.mode === 'play' && !this.ui.menuOpen && !this.ui.dialogOpen && !this.loading && !this.player.dead;
    addEventListener('resize', () => this.resize());
    addEventListener('beforeunload', () => { if (this.state && this.mode !== 'title') this.save(); });

    loadModels().then((reg) => {
      const n = Object.keys(reg.cast).length + reg.folk.length;
      if (reg.errors.length) console.warn('Modelos com erro:', reg.errors);
      if (n && this.mode === 'play') this.npcs.populate();
      if (n) setTimeout(() => this.ui.toast(`${n} modelo(s) 3D carregado(s) — créditos em Menu → Sistema.`), 4000);
    });
    const save = [...listSaves('normal'), ...listSaves('hardcore')].find(Boolean);
    this.setFloor(save ? save.progress.floor : 1);
    this.combat.setVisible(false);
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);

    if (new URLSearchParams(location.search).has('test')) {
      this.input.forceLocked = true;
      this.ui.hideTitle();
      this.startState(newSave('Tester', 'normal', 'swordsman'));
    } else {
      this.ui.showTitle();
    }
  }

  // ─────────── Céu, luzes e ciclo dia/noite ───────────
  buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 0.9, 0.7) }, sunVis: { value: 1 },
        uTime: { value: 0 }, cloudCol: { value: new THREE.Color(1, 1, 1) },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunVis; uniform float uTime; uniform vec3 cloudCol; varying vec3 vDir;
        float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
        float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
        void main(){
          vec3 d = normalize(vDir); float h = d.y;
          vec3 col = mix(bottom, top, smoothstep(-0.02, 0.55, h));
          if (h < 0.0) col = mix(bottom, bottom * 0.7, smoothstep(0.0, -0.4, h));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          col += sunCol * pow(s, 14.0) * 0.35 * sunVis;
          if (h > 0.0) {
            vec2 cp = d.xz / (h + 0.2) * 1.4 + vec2(mod(uTime * 0.012, 100.0), mod(uTime * 0.005, 100.0));
            float n = fbm(cp);
            float c = smoothstep(0.48, 0.75, n) * smoothstep(0.0, 0.18, h);
            vec3 cc = cloudCol * (0.82 + 0.25 * smoothstep(0.5, 0.9, n)) + sunCol * pow(s, 6.0) * 0.4 * sunVis;
            col = mix(col, cc, c * 0.9);
          }
          col += sunCol * pow(s, 900.0) * 30.0 * sunVis;
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

    this.buildCumulus();
    this.hemi = new THREE.HemisphereLight('#cfe9ff', '#8cb069', 0.9);
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

  // Grandes cumulus pintados no horizonte, iluminados pelo sol (lado sombreado azulado).
  buildCumulus() {
    this.cloudMat = new THREE.ShaderMaterial({
      fog: false,
      uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) }, uLit: { value: new THREE.Color('#ffffff') }, uShade: { value: new THREE.Color('#a9bfe0') }, uRim: { value: new THREE.Color('#ffffff') } },
      vertexShader: `varying vec3 vN; varying vec3 vP;
        void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform vec3 uSun, uLit, uShade, uRim; varying vec3 vN; varying vec3 vP;
        void main(){
          vec3 n = normalize(vN);
          float l = dot(n, normalize(uSun)) * 0.5 + 0.5;
          vec3 c = mix(uShade, uLit, smoothstep(0.32, 0.62, l));
          c = mix(c, uShade * 0.92, smoothstep(0.1, -0.7, n.y) * 0.55);
          float rim = pow(1.0 - abs(dot(n, normalize(cameraPosition - vP))), 3.0);
          c += uRim * rim * 0.3;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.cumulus = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const puffs = [];
      const w = 40 + Math.random() * 70, np = 7 + Math.floor(Math.random() * 6);
      for (let j = 0; j < np; j++) {
        const t = j / (np - 1) - 0.5, r = (1 - Math.abs(t) * 1.2) * (18 + Math.random() * 16) + 8;
        const g = new THREE.SphereGeometry(r, 18, 12);
        g.translate(t * w * 1.6 + (Math.random() - 0.5) * 10, r * 0.35 + Math.random() * 8, (Math.random() - 0.5) * 24);
        puffs.push(g);
      }
      for (let j = 0; j < 4; j++) {
        const r = 14 + Math.random() * 14, g = new THREE.SphereGeometry(r, 18, 12);
        g.translate((Math.random() - 0.5) * w, r + 10 + Math.random() * 14, (Math.random() - 0.5) * 16);
        puffs.push(g);
      }
      const geo = mergeGeometries(puffs);
      const p = geo.attributes.position;
      for (let k = 0; k < p.count; k++) if (p.getY(k) < 2) p.setY(k, 2 + (p.getY(k) - 2) * 0.22);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, this.cloudMat);
      const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3, d = 700 + Math.random() * 350;
      m.position.set(Math.cos(a) * d, 40 + Math.random() * 170, Math.sin(a) * d);
      m.lookAt(0, m.position.y, 0);
      m.scale.setScalar(0.9 + Math.random() * 0.9);
      m.userData.a = a;
      m.userData.d = d;
      this.cumulus.add(m);
    }
    this.scene.add(this.cumulus);
  }

  updateSky(dt, advance) {
    const s = this.state?.settings || DEFAULT_SETTINGS;
    if (advance) {
      // dia (sol acima do horizonte) e noite têm durações próprias, escolhidas em Sistema
      const isDay = this.tod > 0.23 && this.tod < 0.77;
      const half = (isDay ? s.dayLen ?? 12 : s.nightLen ?? 5) * 60;
      const next = this.tod + (dt * 0.5) / half;
      this.tod = next % 1;
      if (next >= 1 && this.state && this.mode === 'play') this.newDay();
    }
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
    this.hemi.color.copy(u.top.value).lerp(WHITE, 0.55);
    this.hemi.intensity = 0.45 + 0.75 * day;
    this.scene.environmentIntensity = 0.05 + 0.12 * day;
    this.sun.intensity = (0.3 + 2.1 * day) * (this.weatherDim ?? 1);
    this.sun.color.copy(MOON).lerp(SUN, day).lerp(SUNSET, sunset * 0.4);
    const ld = elev > -0.05 ? sun : v3a.copy(sun).negate().setY(Math.max(0.35, -sun.y));
    const c = this.mode === 'title' ? v3b.set(0, 0, 0) : this.player.pos;
    this.sun.position.copy(c).addScaledVector(ld, 140);
    this.sun.target.position.copy(c);
    this.stars.material.opacity = 1 - day;
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    this.night = 1 - day;
    u.uTime.value = this.time;
    windTime.value = this.time;
    const cu = this.cloudMat.uniforms;
    cu.uSun.value.copy(elev > -0.05 ? sun : v3a.set(0, 1, 0));
    cu.uLit.value.set('#59647e').lerp(WHITE, day).lerp(CLOUD_SUNSET, sunset * 0.55);
    cu.uShade.value.set('#262c44').lerp(CLOUD_SHADE, day).lerp(CLOUD_DUSK, sunset * 0.5);
    cu.uRim.value.copy(cu.uLit.value).multiplyScalar(0.6);
    this.cumulus.position.set(this.camera.position.x * 0.9, 0, this.camera.position.z * 0.9);
    this.cumulus.rotation.y = this.time * 0.002;
    u.cloudCol.value.set('#2a3348').lerp(WHITE, day).lerp(SUNSET, sunset * 0.35);
    this.world?.grass?.update(this.camera.position, this.time, 0.25 + 0.85 * day);
    if (this.world?.cloudMat) this.world.cloudMat.color.copy(u.bottom.value).lerp(new THREE.Color('#ffffff'), 0.4 * day);
  }

  // ─────────── Andares ───────────
  setFloor(n) {
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
    }
    this.enemies.clear();
    this.npcs.clear();
    this.party.despawn();
    this.loot.clear();
    this.spells?.clear();
    this.effects.clear();
    this.ui.clearEnemyLabels();
    this.bossFight = null;
    this.floor = getFloor(n);
    this.world = new World(this, this.floor);
    this.scene.add(this.world.group);
    this.ambient?.setWorld(this.world);
    const [near, far] = this.floor.biome.fog;
    // névoa e chuva fecham a visão; chuva também escurece o dia
    const wk = { mist: 0.45, rain: 0.7, snow: 0.8 }[this.floor.weather] || 1;
    this.scene.fog.near = near * wk;
    this.scene.fog.far = far * wk;
    this.weatherDim = this.floor.weather === 'rain' ? 0.62 : this.floor.weather === 'mist' ? 0.85 : 1;
    this.ui.setWorldLabels(this.world.labels);
  }

  loadFloor(n) {
    if (!this.world || this.world.floor.n !== n || this.enemies.list.length) this.setFloor(n);
    const pr = this.state.progress;
    pr.floor = n;
    pr.highest = Math.max(pr.highest, n);
    this.world.setDoorOpen(!!pr.cleared[n]);
    this.applySettings();
    this.player.place(0, 9, 0);
    this.player.dead = false;
    this.enemies.populate();
    this.indoor = null;
    this.housing.setDecorate(false);
    if (this.housing.room) this.housing.room.visible = false;
    this.quests.setFloor(this.floor);
    this.npcs.populate();
    this.npcs.recordGivers();
    this.loot.setFloor(this.floor);
    this.party.spawn();
    this.pets.spawn();
    this.combat.reset();
    this.combat.setSheathed(!!this.state.settings.autoSheath, true);
    this.wasSafe = true;
    setTimeout(() => checkCompletion(this), 2500);
    this.ui.banner(`Andar ${n}`, `${this.floor.town} — ${this.floor.desc}`, 3.5);
    if (this.floor.peaceful) setTimeout(() => this.ui.toast('Andar pacífico: nenhum monstro daqui ataca. Os animais fogem se você bater neles — e muitos podem ser domados (♥).', 'skill'), 1500);
    if (this.world.fieldBoss && this.loot.fieldBossReady()) { const fb = this.world.fieldBoss, w = this.world; setTimeout(() => { if (this.world === w) this.ui.toast(`Dizem que ${fb.def.name}, um Chefe de Campo, ronda ${fb.where}. (ponto vermelho no mapa)`); }, 3000); }
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
    const f = getFloor(n);
    this.withLoading(`Andar ${n}`, `${f.town} — ${f.desc}`, () => this.loadFloor(n)).then(() => this.input.lock());
  }

  // Tela de carregamento: monta o andar por trás dela, compila os shaders e renderiza alguns quadros
  // (texturas e sombras sobem para a GPU) antes de mostrar o mundo — assim não trava ao aparecer.
  async withLoading(title, sub, work) {
    const frames = (k = 1) => new Promise((res) => { let i = 0; const f = () => (++i >= k ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    this.loading = true;
    const L = this.ui.showLoading(title, sub);
    await frames(2);
    L.set(0.2);
    try {
      work();
      this.player.updateCamera(0);
      L.set(0.5);
      await frames(1);
      // em alguns navegadores (Firefox, Safari) essa promessa nunca termina: espera no máximo 2s
      await Promise.race([this.renderer.compileAsync(this.scene, this.camera).catch(() => {}), new Promise((r) => setTimeout(r, 2000))]);
      L.set(0.75);
      for (let i = 0; i < 14; i++) { await frames(1); L.set(0.75 + i * 0.018); }
    } finally {
      this.loading = false;
      L.done();
    }
  }

  // ─────────── Sessão ───────────
  beginGame(state) {
    this.ui.hideTitle();
    this.ui.linkStart(() => this.withLoading('Link Start!', `Entrando em Aincrad — Andar ${state.progress.floor}`, () => this.startState(state)).then(() => this.input.lock()));
  }

  startState(state) {
    this.state = state;
    state.settings = { ...DEFAULT_SETTINGS, ...state.settings };
    const p = state.player;
    this.tod = state.world.tod ?? 0.32;
    normalizeTalents(p);
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
    // saves antigos (ou importados) sem classe: pede para escolher
    if (!p.cls) setTimeout(() => { if (this.mode === 'play' && !this.ui.dialogOpen) this.ui.openDialog(classPicker(this, 0, 'Aincrad agora tem classes! Escolha a sua — ela dá um bônus e libera um ramo na árvore de talentos (Menu → Talentos). Você ganha 1 ponto de talento por nível, então já começa com vários para gastar.')); }, 2500);
    if (state.playTime < 1) {
      setTimeout(() => this.ui.toast('Bem-vindo a Aincrad! Saia da cidade e enfrente os monstros dos campos.'), 3800);
      setTimeout(() => this.ui.toast('Clique = atacar · 1 = Sword Skill "Slant" · Esc = menu'), 5200);
    }
  }

  logout() {
    this.pets.despawn();
    this.party.despawn();
    this.loot.clear();
    if (this.hardcoreDead) { this.hardcoreDead = null; this.ui.hideDeath(); this.state = null; this.mode = 'title'; this.combat.setVisible(false); this.enemies.clear(); this.npcs.clear(); this.ui.clearEnemyLabels(); this.ui.showTitle(); return; }
    this.npcs.clear();
    this.ui.closeDialog(false);
    this.save();
    this.ui.closeMenu(false);
    this.mode = 'title';
    this.input.unlock();
    this.combat.setVisible(false);
    this.enemies.clear();
    this.ui.clearEnemyLabels();
    this.ui.hint(null);
    this.ui.showTitle();
  }

  wipe() {
    this.pets.despawn();
    this.party.despawn();
    this.loot.clear();
    this.npcs.clear();
    this.ui.closeDialog(false);
    deleteSave(this.state?.mode || 'normal', this.state?.slot || 0);
    this.state = null;
    this.ui.closeMenu(false);
    this.mode = 'title';
    this.input.unlock();
    this.combat.setVisible(false);
    this.enemies.clear();
    this.ui.clearEnemyLabels();
    this.ui.hint(null);
    this.ui.showTitle();
  }

  save(manual = false) {
    if (!this.state || this.hardcoreDead) return;
    this.state.world.tod = this.tod;
    const ok = writeSave(this.state);
    if (manual) this.ui.toast(ok ? 'Mundo salvo.' : 'Não foi possível salvar (armazenamento cheio?).', ok ? '' : 'warn');
  }

  applySettings() {
    const s = this.state.settings;
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    Sfx.setVolume(s.volume);
    Music.setVolume(s.music ?? 0.45);
    this.sun.castShadow = s.shadows;
    if (this.world?.grass) this.world.grass.mesh.visible = s.grass !== false;
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
  }

  // ─────────── Atributos ───────────
  // Bônus somados de runas equipadas, comida da taverna e posto na guilda.
  bonus() {
    const p = this.state.player, b = { atk: 0, def: 0, defMul: 0, hp: 0, spd: 0, crit: 0, leech: 0, col: 0, exp: 0, regen: 0 };
    const map = { fire: 'atk', stone: 'def', life: 'hp', wind: 'spd', eagle: 'crit', leech: 'leech', fortune: 'col', sage: 'exp' };
    for (const id of p.runeSlots || []) { const r = id && runeDef(id); if (r) b[map[r.key]] += r.value; }
    for (const e of this.activeBuffs()) for (const [k, v] of Object.entries(e.def.buff)) b[k] = (b[k] || 0) + v;
    // elmo, luvas, calça, botas, capa, anel e amuleto
    b.pDef = 0; b.pHp = 0;
    for (const id of Object.values(p.equip || {})) { const d = id && pieceDef(id); if (!d) continue; b.pDef += d.def; b.pHp += d.hp; for (const x of d.bonus) b[x.k] = (b[x.k] || 0) + x.v; }
    const rank = guildRank(this.state.guild);
    if (rank) b.exp += rank.i * 0.03;
    // classe e árvore de talentos
    for (const [k, v] of Object.entries(classBonus(p))) b[k] = (b[k] || 0) + v;
    return b;
  }

  // Refeição e bebida ativas (da taverna, do restaurante ou feitas por você)
  activeBuffs() {
    const p = this.state.player, now = this.state.playTime;
    if (p.food) { p.buffs = { ...(p.buffs || {}), meal: { src: 'food', id: p.food.id, until: p.food.until } }; p.food = null; }
    const out = [];
    for (const [slot, e] of Object.entries(p.buffs || {})) {
      if (!e || e.until <= now) continue;
      const def = e.src === 'dish' ? DISHES[e.id] : FOODS[e.id];
      if (def) out.push({ slot, def, left: e.until - now });
    }
    return out;
  }

  applyBuff(src, id) {
    const p = this.state.player, def = src === 'dish' ? DISHES[id] : FOODS[id], slot = def.cat || 'meal';
    (p.buffs ||= {})[slot] = { src, id, until: this.state.playTime + def.mins * 60 * (1 + this.stats().buffTime) };
    this.clampHp();
    this.effects.ring(this.player.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), slot === 'drink' ? '#7ad0ff' : '#ffd27a', 1.3, 0.8, 1.5);
    this.ui.toast(`${def.name}: ${def.desc} por ${def.mins} min.`, 'skill');
  }

  // Cozinhar: gasta os ingredientes da receita e põe o prato na mochila
  canCook(id) {
    const p = this.state.player, r = DISHES[id].recipe;
    const fish = Object.entries(p.mats).filter(([n]) => isFish(n)).reduce((a, [, m]) => a + m.qty, 0);
    return Object.entries(r).every(([ing, q]) => (ing === '*peixe' ? fish : p.mats[ing]?.qty || 0) >= q);
  }

  cook(id, q = 1) {
    const p = this.state.player, d = DISHES[id];
    let made = 0;
    for (let i = 0; i < q && this.canCook(id); i++) {
      for (const [ing, need] of Object.entries(d.recipe)) {
        let left = need;
        for (const [n, m] of Object.entries(p.mats)) {
          if (left <= 0) break;
          if (ing === '*peixe' ? !isFish(n) : n !== ing) continue;
          const take = Math.min(left, m.qty);
          m.qty -= take; left -= take;
          if (m.qty <= 0) delete p.mats[n];
        }
      }
      p.items[`dish_${id}`] = (p.items[`dish_${id}`] || 0) + 1;
      made++;
    }
    if (!made) { Sfx.error(); this.ui.toast('Faltam ingredientes para essa receita.', 'warn'); return; }
    Sfx.coin();
    this.ui.toast(`🍳 Você cozinhou ${made}× ${d.name}! (na mochila)`, 'skill');
    this.save();
  }

  // Ofertas do dia do Agil: 4 itens que mudam a cada dia (cada um pode ser comprado uma vez)
  agilDeals() {
    const n = this.floor.n, day = this.state.world.day || 0, hi = this.state.progress.highest;
    let seed = (n * 7919 + day * 104729) >>> 0;
    const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const tier = RUNE_TIER_FLOOR.filter((f) => n >= f).length;
    const keys = Object.keys(RUNES);
    const deals = [
      { kind: 'weapon', id: `rare_${hi + 1 + Math.floor(r() * 2)}`, mul: 2.2 },
      { kind: 'armor', id: `rarm_${hi + 1 + Math.floor(r() * 2)}`, mul: 2.2 },
      { kind: 'rune', id: `rune_${keys[Math.floor(r() * keys.length)]}_${tier}`, mul: 0.75 },
      { kind: 'item', id: ['heal_crystal', 'treasure_map', 'mystery_box', 'cristalite'][Math.floor(r() * 4)], mul: 0.7, q: 3 },
    ];
    const bought = this.state.agilDeals?.day === day && this.state.agilDeals.n === n ? this.state.agilDeals.b : [];
    return deals.map((d, i) => ({ ...d, i, sold: bought.includes(i) }));
  }

  stats() {
    const p = this.state.player, w = weaponDef(p.weapon), a = armorDef(p.armor), b = this.bonus();
    const o = p.dualBlades && p.offhand ? weaponDef(p.offhand) : null;
    // Berserker (Fúria): mais ataque quanto menor o HP
    const low = b.lowHp && p.hp != null ? b.lowHp * Math.max(0, 1 - p.hp / Math.max(1, this._lastMax || p.hp)) : 0;
    const up = (id) => (1 + UPGRADE_STEP * this.upgradeLevel(id)) * (1 + 0.03 * p.str) * (1 + b.atk + low);
    const flat = p.str + p.level * 1.5;
    const maxHp = Math.round(((180 + 25 * (p.level - 1) + a.hp + b.pHp) * (1 + 0.02 * p.vit) + p.vit * 10) * (1 + b.hp));
    this._lastMax = maxHp;
    return {
      maxHp,
      atkR: w.atk * up(p.weapon) + flat,
      atkL: (o ? o.atk * up(p.offhand) : w.atk * up(p.weapon)) + flat,
      dual: !!o,
      def: (a.def + b.pDef + p.vit * 0.8 + p.level * 0.5 + b.def) * (1 + b.defMul),
      cdMul: Math.max(0.4, (1 - Math.min(0.35, p.agi * 0.01)) * (1 - (b.cd || 0))),
      crit: Math.max(0, Math.min(0.7, 0.05 + p.agi * 0.008 + (w.crit || 0) + b.crit)),
      speedMul: Math.max(0.7, 1 + Math.min(0.5, p.agi * 0.006) + (a.spd || 0) + b.spd),
      leech: b.leech, colMul: 1 + b.col, expMul: 1 + b.exp, regen: 1 + b.regen, resist: Math.min(0.6, b.resist || 0), stam: b.stam || 0,
      critDmg: b.critDmg || 0, skillDmg: b.skillDmg || 0, guard: b.guard || 0, parry: b.parry || 0, dodge: Math.min(0.6, b.dodge || 0),
      spellDmg: b.spellDmg || 0, mana: b.mana || 0, manaRegen: b.manaRegen || 0,
      execute: b.execute || 0, bossDmg: b.bossDmg || 0, post: Math.min(0.6, b.post || 0), buffTime: b.buffTime || 0, drop: b.drop || 0, secondWind: !!b.secondWind,
      potion: b.potion || 0, petDmg: b.petDmg || 0, petHeal: b.petHeal || 0, tame: b.tame || 0, partyDmg: b.partyDmg || 0, partyHp: b.partyHp || 0, aura: b.aura || 0,
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
    let hits = 0, anyCrit = false, dealt = 0;
    for (const e of this.enemies.list) {
      if (e.dead || e.state === 'intro') continue;
      const dx = e.pos.x - pl.pos.x, dz = e.pos.z - pl.pos.z, d = Math.hypot(dx, dz) || 0.001;
      if (d - e.radius > h.reach) continue;
      if (d > e.radius + 0.6 && (dx * fx + dz * fz) / d < h.arc) continue;
      const center = e.pos.y + (e.flyH ? 0 : e.height * 0.5);
      if (Math.abs(center - (pl.pos.y + 1.2)) > e.height * 0.5 + 2.2) continue;
      let dmg = atk * h.mul * (0.9 + Math.random() * 0.2) * (a.skill ? 1 + st.skillDmg : 1);
      const crit = Math.random() < st.crit;
      if (crit) { dmg *= 1.8 + st.critDmg; anyCrit = true; }
      if (st.execute && e.hp < e.maxHp * 0.3) dmg *= 1 + st.execute;
      if (st.bossDmg && (e.boss || e.elite || e.fieldBoss)) dmg *= 1 + st.bossDmg;
      dmg = Math.max(1, Math.round((dmg * 60) / (60 + e.defense)));
      const kd = new THREE.Vector3(dx / d, 0, dz / d);
      const at = new THREE.Vector3(e.pos.x - kd.x * e.radius * 0.8, center + (Math.random() - 0.5) * 0.4, e.pos.z - kd.z * e.radius * 0.8);
      e.takeDamage(dmg, kd, a.skill ? 1.4 : 1);
      this.effects.sparks(at, color, a.skill ? 14 : 8);
      this.ui.damageNumber(at, dmg, crit ? 'crit' : a.skill ? 'skill' : '');
      hits++;
      dealt += dmg;
    }
    if (dealt && st.leech) { const p = this.state.player; p.hp = Math.min(st.maxHp, p.hp + dealt * st.leech); }
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
        if (this.combat.guardT < 0.28 + st.parry) {
          src.stunFor?.(1.6);
          this.quests.onParry();
          Sfx.parry();
          this.effects.ring(front, '#ffffff', 1.4, 0.35);
          this.effects.sparks(front, '#ffffff', 16, 1.2);
          this.ui.damageNumber(front, 'PARRY!', 'parry');
          this.hitstop = 0.09;
          this.shake(0.15);
          return;
        }
        dmg *= Math.max(0.05, 0.3 - st.guard);
        pl.stamina = Math.max(0, pl.stamina - 15);
        Sfx.guard();
        this.effects.sparks(front, '#ffd080', 8);
      }
    }
    dmg = Math.max(1, Math.round(dmg * (1 - st.resist)));
    dmg = Math.round(this.spells.absorb(dmg));
    if (dmg <= 0) { this.ui.damageNumber(front, 'ESCUDO', 'miss'); return; }
    p.hp -= dmg;
    pl.lastHit = 0;
    this.ui.hurt(dmg / st.maxHp);
    Sfx.hurt();
    this.shake(0.3);
    // nó lendário (Imortal, Fênix...): sobrevive a um golpe fatal a cada 2 minutos
    if (p.hp <= 0 && st.secondWind && this.state.playTime - (this.lastSecondWind ?? -999) > 120) {
      this.lastSecondWind = this.state.playTime;
      p.hp = Math.round(st.maxHp * 0.3);
      pl.iframes = 1.2;
      this.effects.ring(pl.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), '#ffd75a', 2.5, 1, 2.5);
      this.ui.banner('Segunda Chance!', 'Um talento lendário salvou você de um golpe fatal', 2.5);
      Sfx.levelUp();
    }
    if (p.hp <= 0) { p.hp = 0; this.die(src?.def?.name); }
  }

  die(cause) {
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
    // Hardcore: como no anime, a morte é permanente — o mundo é apagado e você recomeça do zero
    if (this.state.mode === 'hardcore') {
      const record = recordDeath(this.state, cause);
      deleteSave('hardcore', this.state.slot || 0);
      this.hardcoreDead = { name: this.state.player.name, record };
    } else this.hardcoreDead = null;
    setTimeout(() => { this.input.unlock(); this.ui.showDeath(this.hardcoreDead, this.state, cause); }, 1400);
  }

  restartHardcore() {
    this.pets.despawn();
    this.party.despawn();
    this.loot.clear();
    const name = this.hardcoreDead?.name || this.state?.player.name || 'Kirito';
    const old = this.state?.player, slot = this.state?.slot || 0;
    this.ui.hideDeath();
    this.hardcoreDead = null;
    this.mode = 'title';
    this.combat.setVisible(false);
    this.beginGame(newSave(name, 'hardcore', old?.cls || 'swordsman', old?.look || null, slot));
  }

  respawn() {
    if (this.hardcoreDead) { this.restartHardcore(); return; }
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
    this.quests.onBoss();
    pr.highest = Math.max(pr.highest, Math.min(MAX_FLOOR, n + 1));
    const exp = (10 + 9 * e.level) * 25 * this.state.settings.xpRate;
    const col = Math.round((5 + 3 * e.level) * 30);
    p.col += col;
    const la = laReward(n);
    const d = la.kind === 'weapon' ? weaponDef(la.id) : armorDef(la.id);
    (la.kind === 'weapon' ? p.weapons : p.armors).push(la.id);
    p.items.potion = (p.items.potion || 0) + 3;
    const bp = randomPiece(n, true);
    (p.pieces ||= []).push(bp);
    setTimeout(() => this.ui.toast(`Recompensa do chefe: ${pieceDef(bp).name}!`, 'skill'), 1200);
    this.world.setDoorOpen(true);
    Sfx.victory();
    if (n >= MAX_FLOOR) this.ui.banner('AINCRAD CONQUISTADA', 'Game Clear! Você libertou todos os jogadores.', 8);
    else this.ui.banner('Congratulations!', `Andar ${n} concluído — a porta do Labirinto está aberta`, 6);
    this.ui.toast(`Last Attack Bonus: ${d.name}!`, 'skill');
    this.ui.toast(`+${Math.round(exp)} EXP · +${col} Col · +3 Poções`);
    this.gainExp(exp);
    this.save();
    checkCompletion(this);
  }

  onEnemyKilled(e) {
    if (e.boss) { this.bossDefeated(e); return; }
    this.quests.onKill(e);
    const p = this.state.player;
    p.kills++;
    const diff = p.level - e.level;
    const k = diff > 5 ? Math.max(0.1, 1 - (diff - 5) * 0.15) : 1;
    const st = this.stats();
    const exp = Math.round((10 + 9 * e.level) * k * this.state.settings.xpRate * st.expMul);
    const col = Math.round((5 + 3 * e.level) * (0.8 + Math.random() * 0.4) * st.colMul);
    p.col += col;
    let msg = `+${exp} EXP · +${col} Col`;
    if (Math.random() < 0.4 * (1 + st.drop)) {
      const [name, value] = e.def.drop;
      const m = (p.mats[name] ||= { qty: 0, value: Math.round(value * (1 + e.level * 0.15)) });
      m.qty++;
      msg += ` · ${name}`;
      this.quests.onDrop(name);
    }
    if (Math.random() < 0.07) { p.items.potion = (p.items.potion || 0) + 1; msg += ' · Poção'; }
    if ((e.def.arch === 'quad' || e.def.arch === 'flyer') && Math.random() < 0.3) { const m = (p.mats['Carne Crua'] ||= { qty: 0, value: 8 }); m.qty++; msg += ' · Carne Crua'; }
    this.ui.toast(msg);
    this.gainExp(exp);
    if (e.fieldBoss) { this.loot.onFieldBoss(e); checkCompletion(this); }
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
    if (p.cls === 'mage') for (const s of SPELLS) if (s.lvl === p.level) {
      this.ui.toast(`Novo feitiço: ${s.name}!`, 'skill');
      p.spellSlots ||= [null, null, null, null];
      const i = p.spellSlots.indexOf(null);
      if (i >= 0 && !p.spellSlots.includes(s.id)) p.spellSlots[i] = s.id;
      this.ui.refreshSkillbar();
    }
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
    if (d.dish) { p.items[id]--; this.applyBuff('dish', d.dish); Sfx.menuOpen(); return true; }
    if (d.elixir) {
      p.items[id]--;
      p[d.elixir]++;
      this.clampHp();
      this.combat.refresh();
      Sfx.levelUp();
      this.effects.levelUp(this.player.pos.clone());
      this.ui.toast(`${d.name}: +1 ${d.elixir.toUpperCase()} para sempre!`, 'skill');
      return true;
    }
    if (id === 'treasure_map') {
      p.items[id]--;
      const st = this.loot.st;
      const n = this.loot.chests.filter((c) => this.loot.available(c) && !st.rev.includes(c.i)).map((c) => (st.rev.push(c.i), c)).length;
      Sfx.coin();
      this.ui.toast(n ? `Mapa do Tesouro: ${n} baú(s) marcados no mapa (pontos amarelos).` : 'Mapa do Tesouro: todos os baús deste andar já estão abertos ou marcados.', 'skill');
      return true;
    }
    if (id === 'mystery_box') {
      p.items[id]--;
      const roll = Math.random();
      let got;
      if (roll < 0.08) { const w = Math.random() < 0.5, gid = `${w ? 'rare' : 'rarm'}_${this.state.progress.highest}`; (w ? p.weapons : p.armors).push(gid); got = `★ ${(w ? weaponDef(gid) : armorDef(gid)).name}`; }
      else if (roll < 0.3) { const keys = Object.keys(RUNES), t = RUNE_TIER_FLOOR.filter((f) => this.floor.n >= f).length, rid = `rune_${keys[Math.floor(Math.random() * keys.length)]}_${t}`; p.runes ||= {}; p.runes[rid] = (p.runes[rid] || 0) + 1; got = runeDef(rid).name; }
      else if (roll < 0.5) { p.items.heal_crystal = (p.items.heal_crystal || 0) + 2; got = '2× Cristal de Cura'; }
      else if (roll < 0.7) { for (const ing of Object.keys(INGREDIENTS)) { const m = (p.mats[ing] ||= { qty: 0, value: 5 }); m.qty += 3; } got = 'uma cesta de ingredientes (3 de cada)'; }
      else if (roll < 0.78) { p.items.cristalite = (p.items.cristalite || 0) + 1; got = 'Lingote de Cristalita'; }
      else if (roll < 0.88) { const pid = randomPiece(this.state.progress.highest, Math.random() < 0.35); (p.pieces ||= []).push(pid); got = pieceDef(pid).name; }
      else { const c = Math.round(800 + Math.random() * 3000 * (1 + this.floor.n * 0.05)); p.col += c; got = `${c.toLocaleString('pt-BR')} Col`; }
      Sfx.victory();
      this.ui.banner('Caixa Misteriosa', got, 3);
      return true;
    }
    if (d.pet) {
      if (!this.state.pet) { this.ui.toast('Você não tem um mascote.', 'warn'); return false; }
      p.items[id]--;
      this.pets.gainExp(120);
      this.ui.toast(`${this.state.pet.name} adorou o biscoito! (+120 EXP)`);
      Sfx.menuOpen();
      return true;
    }
    if (d.tool) { this.ui.toast(id === 'fishing_rod' ? 'Perto da água, aperte F para pescar.' : id === 'cristalite' ? 'Leve para a Lisbeth: ela usa para fortalecer armas acima de +10.' : 'Use perto de um monstro dócil (♥) com a tecla E.'); return false; }
    const st = this.stats(), max = st.maxHp, heal = d.heal * (1 + st.potion);
    if (p.hp >= max) { this.ui.toast('Seu HP já está cheio.'); return false; }
    p.items[id]--;
    if (d.over) this.player.hot = { rate: (max * heal) / d.over, left: max * heal };
    else p.hp = Math.min(max, p.hp + max * heal);
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

  monumentNpc() {
    const p = this.state.player, rec = this.state.mode === 'hardcore' ? getRecord() : null;
    const lines = [`Milhares de nomes estão gravados na pedra negra. Entre eles, o seu: "${p.name}".`];
    lines.push(p.deaths ? `Ao lado do seu nome brilham ${p.deaths} marca(s) — as vezes em que você caiu e voltou.` : 'Seu nome brilha em azul. Você ainda não caiu nenhuma vez.');
    if (rec?.last) lines.push(`Mais abaixo, um nome riscado em vermelho: "${rec.last.name}" — caiu no andar ${rec.last.floor}${rec.last.cause ? `, derrotado por ${rec.last.cause}` : ''}.`);
    lines.push('Os nomes riscados em vermelho são dos jogadores que não voltaram...');
    return { name: 'Monumento da Vida', title: 'Black Iron Palace', def: {}, talking: false, dialog: () => ({ text: lines.join(String.fromCharCode(10, 10)), options: [{ label: 'Fechar', run: () => null }] }) };
  }

  boardNpc() {
    const back = () => this.boardNpc().dialog();
    return {
      name: 'Quadro de Missões', title: 'Pedidos da cidade', def: { id: 'board' }, talking: false,
      dialog: () => {
        const opts = this.quests.dialogOptions('board', back);
        return { text: opts.length ? 'Pedidos fixados no quadro pelos moradores deste andar. Recompensas pagas na hora!' : 'Nenhum pedido novo neste andar. Volte no próximo!', options: [...opts, { label: 'Fechar', run: () => null }] };
      },
    };
  }

  // Clérigo: a cada 12s em combate (ou ferido), cura você e o time
  updateAura(dt) {
    const st = this.stats();
    if (!st.aura || this.player.dead) return;
    this.auraT = (this.auraT ?? 12) - dt;
    if (this.auraT > 0) return;
    this.auraT = 12;
    const p = this.state.player, hurt = p.hp < st.maxHp || this.party.members.some((m) => m.alive && m.hp < m.maxHp);
    if (!hurt) return;
    p.hp = Math.min(st.maxHp, p.hp + st.maxHp * st.aura);
    for (const m of this.party.members) if (m.alive) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * st.aura);
    this.effects.ring(this.player.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), '#7aff9a', 3.5, 0.9, 2);
    this.ui.damageNumber(this.player.pos.clone().add(new THREE.Vector3(0, 1.8, 0)), `+${Math.round(st.maxHp * st.aura)}`, 'heal');
  }

  newDay() {
    const w = this.state.world;
    w.day = (w.day || 0) + 1;
    this.quests.onNewDay();
    this.loot?.onNewDay();
  }

  sleep(tod, msg) {
    this.ui.closeDialog(false);
    Sfx.menuClose();
    this.ui.fade(() => {
      if (tod < this.tod) this.newDay();
      this.tod = tod;
      this.state.player.hp = this.stats().maxHp;
      this.player.hot = null;
      this.save();
      this.ui.toast(`${msg} HP restaurado e jogo salvo.`, 'skill');
      this.input.lock();
    });
  }

  quickTeleport() {
    const p = this.state.player;
    if (this.nearGate() || (p.items.teleport_crystal || 0) > 0) { this.ui.openMenu('map'); return; }
    Sfx.error();
    this.ui.toast('Sem Cristal de Teletransporte. Compre com o Agil (250 Col) ou use o Portal da cidade.', 'warn');
  }

  // Preço final com o desconto da Guilda (2% por posto)
  priceOf(kind, id) {
    const n = this.floor.n;
    let base;
    if (kind === 'item') base = ITEMS[id].elixir ? Math.round(3000 * Math.pow(1.3, this.state.player.elixirsBought || 0)) : ITEMS[id].dish ? Math.round(ITEMS[id].price * (1 + (n - 1) * 0.12)) : ITEMS[id].price;
    else if (kind === 'deal') { const d = this.agilDeals()[+id]; return Math.max(1, Math.round(this.priceOf(d.kind, d.id) * (d.q || 1) * d.mul * (1 - guildDiscount(this.state)))); }
    else if (kind === 'ingredient') base = Math.round(INGREDIENTS[id] * (1 + (n - 1) * 0.1));
    else if (kind === 'weapon') base = weaponDef(id).price;
    else if (kind === 'armor') base = armorDef(id).price;
    else if (kind === 'rune') base = runeDef(id).price;
    else if (kind === 'piece') base = pieceDef(id).price;
    else if (kind === 'food') base = Math.round(FOODS[id].price * (1 + (n - 1) * 0.3));
    else if (kind === 'adopt') base = adoptPrice(id);
    else if (kind === 'merc') base = mercPrice(n);
    return Math.max(1, Math.round(base * (1 - guildDiscount(this.state))));
  }

  buy(kind, id, q = 1) {
    const p = this.state.player;
    const cost = this.priceOf(kind, id) * q;
    if (p.col < cost) { this.ui.toast('Col insuficiente.', 'warn'); Sfx.error(); return false; }
    let name;
    if (kind === 'food') {
      this.applyBuff('food', id);
      name = FOODS[id].name;
    } else if (kind === 'deal') {
      const d = this.agilDeals()[+id];
      if (d.sold) return false;
      if (d.kind === 'item') p.items[d.id] = (p.items[d.id] || 0) + (d.q || 1);
      else if (d.kind === 'rune') { p.runes ||= {}; p.runes[d.id] = (p.runes[d.id] || 0) + 1; }
      else (d.kind === 'weapon' ? p.weapons : p.armors).push(d.id);
      const day = this.state.world.day || 0;
      if (this.state.agilDeals?.day !== day || this.state.agilDeals.n !== this.floor.n) this.state.agilDeals = { day, n: this.floor.n, b: [] };
      this.state.agilDeals.b.push(d.i);
      name = d.kind === 'item' ? `${d.q || 1}× ${ITEMS[d.id].name}` : d.kind === 'rune' ? runeDef(d.id).name : d.kind === 'weapon' ? weaponDef(d.id).name : armorDef(d.id).name;
      this.ui.toast(`Oferta do dia: ${name}!`, 'skill');
    } else if (kind === 'ingredient') {
      const m = (p.mats[id] ||= { qty: 0, value: Math.max(1, Math.round(INGREDIENTS[id] * 0.3)) });
      m.qty += q;
      name = id;
      this.ui.toast(`Comprou ${q}× ${id}.`);
    } else if (kind === 'adopt') {
      if (this.state.pet) this.ui.toast(`${this.state.pet.name} foi morar na Toca dos Mascotes. Até mais!`);
      this.state.pet = { mon: id, name: ADOPT_NAMES[id] || MONSTERS[id].name.split(' ').pop(), level: 1, exp: 0 };
      this.pets.spawn();
      name = `filhote de ${MONSTERS[id].name}`;
      this.ui.banner('Novo mascote!', `${this.state.pet.name} agora é seu companheiro. Dê um nome em Menu → Status.`, 3.5);
    } else if (kind === 'merc') {
      const m = MERCS[id], r = Math.random;
      const names = { swordsman: ['Daren', 'Thoren', 'Kael', 'Rowan'], guardian: ['Borin', 'Gustav', 'Hallvard', 'Tor'], duelist: ['Sayu', 'Lyra', 'Vanya', 'Rin'],
        berserker: ['Ragn', 'Brakk', 'Ulf', 'Garo'], cleric: ['Eliane', 'Noa', 'Seren', 'Iris'], tamer: ['Mimi', 'Kiri', 'Lulu', 'Pip'], mage: ['Merlin', 'Elric', 'Yuna', 'Zael'] }[id] || ['Aki'];
      if (!this.party.add({ kind: 'merc', cls: id, name: names[Math.floor(r() * names.length)], seed: Math.floor(r() * 1e6) })) return false;
      name = m.name;
    } else {
      if (kind === 'item') { p.items[id] = (p.items[id] || 0) + q; if (ITEMS[id].elixir) p.elixirsBought = (p.elixirsBought || 0) + q; }
      else if (kind === 'rune') { p.runes ||= {}; p.runes[id] = (p.runes[id] || 0) + q; }
      else if (kind === 'piece') (p.pieces ||= []).push(id);
      else (kind === 'weapon' ? p.weapons : p.armors).push(id);
      name = kind === 'item' ? ITEMS[id].name : kind === 'piece' ? pieceDef(id).name : kind === 'rune' ? runeDef(id).name : kind === 'weapon' ? weaponDef(id).name : armorDef(id).name;
      this.ui.toast(`Comprou ${q > 1 ? `${q}× ` : ''}${name}.`);
    }
    p.col -= cost;
    Sfx.coin();
    this.save();
    return true;
  }

  // Runas: equipar num encaixe livre / tirar de volta para a mochila
  equipRune(id) {
    const p = this.state.player, r = runeDef(id);
    p.runeSlots ||= [null, null, null];
    const slots = runeSlotsFor(p.level);
    if (!(p.runes?.[id] > 0)) return;
    if (p.runeSlots.slice(0, slots).some((x) => x && runeDef(x)?.key === r.key)) { Sfx.error(); this.ui.toast('Você já tem uma runa desse tipo equipada.', 'warn'); return; }
    const i = p.runeSlots.findIndex((x, k) => k < slots && !x);
    if (i < 0) { Sfx.error(); this.ui.toast(`Todos os ${slots} encaixes estão ocupados. (Novos encaixes no nível 10 e 20.)`, 'warn'); return; }
    p.runes[id]--;
    p.runeSlots[i] = id;
    this.clampHp();
    Sfx.levelUp();
  }

  unequipRune(i) {
    const p = this.state.player, id = p.runeSlots?.[i];
    if (!id) return;
    p.runeSlots[i] = null;
    p.runes[id] = (p.runes[id] || 0) + 1;
    this.clampHp();
  }

  // Teletransporte para um ponto da cidade (grátis na cidade ou no Portal; no campo gasta 1 cristal)
  townTeleport(id) {
    const pt = this.world.townPoints().find((x) => x.id === id);
    if (!pt) return;
    const p = this.state.player, free = this.world.inSafeZone(this.player.pos) || this.nearGate();
    if (!free) {
      if (!(p.items.teleport_crystal > 0)) { Sfx.error(); this.ui.toast('Fora da cidade, o teletransporte local gasta 1 Cristal de Teletransporte.', 'warn'); return; }
      p.items.teleport_crystal--;
    }
    this.ui.closeMenu(false);
    Sfx.teleport();
    this.effects.ring(this.player.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), '#6fd0ff', 1.6, 0.6, 2);
    this.ui.fade(() => {
      this.player.place(pt.pos.x, pt.pos.z, Math.atan2(-(pt.look.x - pt.pos.x), -(pt.look.z - pt.pos.z)));
      for (const m of this.party.members) m.pos.copy(this.player.pos).add(new THREE.Vector3(1, 0, 1));
      if (this.pets.pet) this.pets.pet.pos.copy(this.player.pos).add(new THREE.Vector3(-1, 0, 1));
      this.ui.toast(`Teletransportado: ${pt.name}`);
      this.input.lock();
    });
  }

  async reloadModels() {
    const reg = await loadModels();
    if (this.mode === 'play') this.npcs.populate();
    return reg;
  }

  upgradeLevel(id) { return (this.state.player.upgrades && this.state.player.upgrades[id]) || 0; }
  weaponAtk(id) { return Math.round(weaponDef(id).atk * (1 + UPGRADE_STEP * this.upgradeLevel(id))); }
  weaponLabel(id) { const lv = this.upgradeLevel(id); return `${weaponDef(id).name}${lv ? ` +${lv}` : ''}`; }

  // Custo da Lisbeth: depende do valor e do ataque da arma e cresce rápido a cada nível
  upgradeCost(id) {
    const lv = (this.state.player.upgrades?.[id]) || 0, d = weaponDef(id);
    return Math.round((d.price * 0.3 + d.atk * 12 + 60) * Math.pow(lv + 1, 1.75));
  }

  // Chance de sucesso (como no anime, upgrades altos podem falhar)
  upgradeChance(id) {
    const lv = this.upgradeLevel(id);
    return [1, 1, 1, 1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3, 0.25, 0.2][lv] ?? 0.2;
  }

  upgradeWeapon(id) {
    const p = this.state.player, cost = this.upgradeCost(id), lv = this.upgradeLevel(id);
    if (p.col < cost || lv >= 15) return false;
    if (lv >= 10) { if (!(p.items.cristalite > 0)) return false; p.items.cristalite--; }
    p.col -= cost;
    if (Math.random() > this.upgradeChance(id)) { this.save(); return 'fail'; }
    (p.upgrades ||= {})[id] = ((p.upgrades[id]) || 0) + 1;
    this.combat.refresh();
    this.effects.sparks(this.world.lisbethSpot.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), '#ffb84a', 24, 0.8);
    this.save();
    return true;
  }

  // o Agil paga bem mais por equipamento raro
  sellPrice(d) { return Math.max(10, Math.floor(d.price * (d.rarity === 2 ? 0.65 : 0.4))); }

  sellMat(name) {
    const p = this.state.player, m = p.mats[name];
    if (!m || !m.qty) return;
    p.col += m.qty * m.value;
    delete p.mats[name];
    Sfx.coin();
  }

  // equipar / tirar elmo, luvas, calça, botas, capa, anel, amuleto
  equipPiece(id) {
    const p = this.state.player, d = pieceDef(id);
    if (!d || !(p.pieces || []).includes(id)) return;
    (p.equip ||= {})[d.slot] = id;
    this.clampHp();
    Sfx.menuOpen();
    this.save();
  }

  unequipPiece(slot) {
    const p = this.state.player;
    if (p.equip) delete p.equip[slot];
    this.clampHp();
    this.save();
  }

  sellGear(kind, id) {
    const p = this.state.player;
    if (kind === 'piece') {
      if (Object.values(p.equip || {}).includes(id)) return;
      const i = (p.pieces || []).indexOf(id);
      if (i < 0) return;
      p.pieces.splice(i, 1);
      p.col += this.sellPrice(pieceDef(id));
      Sfx.coin();
      return;
    }
    const list = kind === 'weapon' ? p.weapons : p.armors;
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
    if (this.indoor) {
      const r = this.housing.interact();
      this.ui.hint(r.hint);
      if (r.act && this.input.pressed('KeyE')) r.act();
      return;
    }
    if (Math.hypot(pl.x - w.housePlaque.x, pl.z - w.housePlaque.z) < 2.6) {
      const own = this.state.house && this.state.house.floor === n;
      hint = own ? '[E] Entrar em casa' : '[E] Ler a placa: Casa à venda';
      act = () => (own ? this.housing.enter() : this.ui.openDialog({ name: 'Casa à venda', title: 'Imobiliária de Aincrad', def: {}, talking: false, dialog: () => this.housing.plaqueDialog() }));
    }
    const lootT = !hint && !this.world.inSafeZone(pl) ? this.loot.nearest(pl) : null;
    if (hint) {
      // placa da casa
    } else if (lootT) {
      hint = lootT.label;
      act = () => this.loot.interact(lootT);
    } else if (this.nearGate()) {
      hint = '[E] Portal de Teletransporte';
      act = () => this.ui.openMenu('map');
    } else if (this.enemies.list.some((e) => e.docile && !e.dead && e.dist < 3.2)) {
      const e = this.enemies.list.find((x) => x.docile && !x.dead && x.dist < 3.2);
      hint = `[E] Domar ${e.def.name} ♥ (Petiscos: ${this.state.player.items.tame_treat || 0})`;
      act = () => this.pets.tryTame(e);
    } else if (w.monumentPos && Math.hypot(pl.x - w.monumentPos.x, pl.z - w.monumentPos.z) < 3.6) {
      hint = '[E] Monumento da Vida';
      act = () => this.ui.openDialog(this.monumentNpc());
    } else if (Math.hypot(pl.x - w.boardPos.x, pl.z - w.boardPos.z) < 3) {
      hint = '[E] Quadro de Missões';
      act = () => this.ui.openDialog(this.boardNpc());
    } else if (this.npcs.nearest(pl, 2.8)) {
      const npc = this.npcs.nearest(pl, 2.8);
      hint = `[E] Falar com ${npc.name}`;
      act = () => this.ui.openDialog(npc);
    } else if (Math.hypot(pl.x - w.doorPos.x, pl.z - w.doorPos.z) < 9) {
      if (pr.cleared[n] && n < MAX_FLOOR) { hint = `[E] Subir para o Andar ${n + 1}`; act = () => this.travel(n + 1, true); }
      else if (!pr.cleared[n]) hint = 'A porta está selada. Derrote o chefe deste andar na arena.';
    }
    if (!hint) {
      if (this.fishing.active) hint = this.fishing.state.phase === 'bite' ? '❗ [F] Puxar!' : '[F] Recolher a linha · andar cancela';
      else if (this.fishing.waterAhead()) hint = this.fishing.hasRod() ? '[F] Pescar' : 'Compre uma Vara de Pesca com o Agil para pescar aqui';
    }
    this.ui.hint(hint);
    if (act && this.input.pressed('KeyE')) act();
    if (!this.bossFight && !pr.cleared[n] && !this.player.dead && w.inArena(pl, -3)) this.startBossFight();
  }

  handleKeys() {
    const inp = this.input;
    if (this.ui.dialogOpen) {
      if (inp.pressed('Escape')) this.ui.closeDialog();
      for (let i = 0; i < 6; i++) if (inp.pressed(`Digit${i + 1}`)) this.ui.chooseOption(i);
      if (inp.pressed('KeyE') || inp.pressed('Space')) this.ui.skipTyping();
      return;
    }
    if (this.ui.menuOpen) {
      if (inp.pressed('Escape') || inp.pressed('Tab')) this.ui.closeMenu();
      return;
    }
    if (inp.pressed('Tab') || inp.pressed('KeyM')) { this.ui.openMenu('status'); return; }
    if (!inp.isLocked) return;
    if (this.indoor && this.housing.handleKeys(inp)) return;
    if (this.spells.active) {
      // Mago: clique lança o orbe mágico, 1–4 lançam os feitiços
      if (inp.mouse.clicked.has(0) && !this.fishing?.active) this.spells.basic();
      for (let i = 0; i < 4; i++) if (inp.pressed(`Digit${i + 1}`)) this.spells.cast(i);
    } else {
      if (inp.mouse.clicked.has(0)) this.combat.basic();
      for (let i = 0; i < 4; i++) if (inp.pressed(`Digit${i + 1}`)) this.combat.skill(i);
    }
    if (inp.pressed('KeyR')) this.quickPotion();
    if (inp.pressed('KeyH')) this.combat.toggleSheath();
    if (inp.pressed('KeyT')) this.quickTeleport();
    if (inp.pressed('KeyF')) this.fishing.press();
  }

  updateMusic(dt) {
    let z;
    if (this.mode === 'title') z = 'title';
    else if (this.mode === 'dead') z = null;
    else if (this.bossFight) z = 'boss';
    else {
      const threat = this.enemies.list.some((e) => !e.dead && e.dist < 32 && (e.state === 'chase' || e.state === 'windup' || e.state === 'recover'));
      this.battleHold = threat ? 5 : (this.battleHold || 0) - dt;
      if (this.battleHold > 0) z = 'battle';
      else if (this.world.inSafeZone(this.player.pos)) z = this.night > 0.6 ? 'townNight' : 'town';
      else z = ['forest', 'dark', 'ruins', 'volcanic'].includes(this.floor.biomeKey) ? 'forest' : 'field';
    }
    Music.setZone(z);
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
      const paused = this.ui.menuOpen || this.ui.dialogOpen || !this.input.isLocked || this.loading;
      // o aviso só aparece se o mouse continuar solto por um tempo (evita piscar depois de diálogos e menus)
      this.unlockedT = !this.ui.menuOpen && !this.ui.dialogOpen && !this.input.isLocked && !this.loading ? (this.unlockedT || 0) + real : 0;
      this.ui.setClickToPlay(this.unlockedT > 0.9);
      if (!paused) {
        this.player.update(dt);
        this.combat.update(dt);
        this.enemies.update(dt);
        this.npcs.update(dt);
        this.quests.update(dt);
        this.pets.update(dt);
        this.fishing.update(dt);
        this.housing.update(dt);
        this.party.update(dt);
        this.spells.update(dt);
        this.updateAura(dt);
        this.loot.update(dt);
        this.updateInteract();
        // guardar a espada sozinho ao entrar na cidade (opção em Sistema)
        const safe = this.world.inSafeZone(this.player.pos);
        if (this.state.settings.autoSheath && safe !== this.wasSafe && this.wasSafe !== undefined) this.combat.setSheathed(safe);
        this.wasSafe = safe;
        this.state.playTime += real;
        this.autosaveT -= real;
        if (this.autosaveT <= 0) { this.autosaveT = 30; this.save(); }
      }
      if (paused && this.ui.dialogOpen) this.npcs.update(dt);
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
    this.ambient.update(dt, this.time, this.night);
    this.updateMusic(real);

    if (this.state?.settings.bloom !== false) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    if (this.mode !== 'title') this.ui.update(real);
    this.input.endFrame();
  }
}

const v3a = new THREE.Vector3();
const v3b = new THREE.Vector3();

window.__game = new Game();
