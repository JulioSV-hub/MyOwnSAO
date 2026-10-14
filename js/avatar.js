// Seu personagem em 3D (aparência + tudo o que está equipado), desenhado como imagem para o menu.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCharacter } from './characters.js';
import { buildSword, buildShield } from './gear3d.js';
import { armorDef, weaponDef, pieceDef, defaultLook } from './data.js';
import { SKINS } from './skins.js';

const W = 320, H = 420;
let R = null, scene, camera;

function init() {
  if (R) return;
  R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.setSize(W, H);
  R.setPixelRatio(1);
  R.toneMapping = THREE.NeutralToneMapping;
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(R);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  const key = new THREE.DirectionalLight('#fff4e0', 2.6);
  key.position.set(2, 3, 4);
  const rim = new THREE.DirectionalLight('#9ad0ff', 1.2);
  rim.position.set(-3, 2, -3);
  scene.add(key, rim, new THREE.AmbientLight('#ffffff', 0.6));
  camera = new THREE.PerspectiveCamera(28, W / H, 0.1, 50);
}

// Monta a definição do boneco: aparência escolhida + cores das peças equipadas
export function playerCharDef(p, look = null) {
  const L = { ...defaultLook(!!(look || p.look)?.female), ...(p.look || {}), ...(look || {}) };
  const def = { name: p.name, hair: L.hair, hairColor: L.hairColor, skin: L.skin, eyes: L.eyes, top: L.top, pants: L.pants, boots: L.boots, accent: L.accent, female: !!L.female };
  if (L.skirt) def.skirt = L.pants;
  if (!look || look.useGear !== false) {
    const eq = p.equip || {};
    const a = p.armor && p.armor !== 'leather' ? armorDef(p.armor) : null;
    if (a) { def.top = a.color; def.accent = a.trim; if (a.type === 'coat' || a.type === 'cloak') def.coat = a.color; def.armorFx = { type: a.type, color: a.color, trim: a.trim }; }
    const pc = (slot) => (eq[slot] ? pieceDef(eq[slot]) : null);
    if (pc('legs')) { def.pants = pc('legs').color; if (def.skirt) def.skirt = def.pants; }
    if (pc('feet')) def.boots = pc('feet').color;
    if (pc('hands')) { def.gloves = pc('hands').color; def.glovesTrim = pc('hands').trim; def.gauntlets = { color: pc('hands').color, trim: pc('hands').trim }; }
    if (pc('legs')) def.greaves = { color: pc('legs').color, trim: pc('legs').trim };
    if (pc('feet')) def.sabatons = { color: pc('feet').color, trim: pc('feet').trim };
    if (pc('head')) def.helmet = { color: pc('head').color, trim: pc('head').trim, open: pc('head').floor <= 6 };
    if (pc('cape')) def.cape = { color: pc('cape').color, trim: pc('cape').trim };
    // skin equipada: troca o visual inteiro (o equipamento continua valendo, só não aparece)
    const sk = p.skin && SKINS[p.skin];
    if (sk) {
      for (const k of ['helmet', 'cape', 'gloves', 'coat', 'skirt', 'armorFx', 'gauntlets', 'greaves', 'sabatons']) delete def[k];
      Object.assign(def, sk.look);
    }
  }
  return def;
}

// arma na mão direita (e escudo do Guardião na esquerda)
export function attachWeapon(c, p) {
  if (!p.weapon) return null;
  {
    const wd = weaponDef(p.weapon), sw = buildSword(wd).group;
    sw.scale.setScalar(0.85);
    if (wd.type === 'staff') { sw.position.set(0, -0.5, 0.02); sw.rotation.x = -0.15; }
    else { sw.position.set(0, -0.54, -0.02); sw.rotation.x = -Math.PI / 2 + 0.6; c.parts.arms[1].rotation.x = 0.35; }
    c.parts.arms[1].add(sw);
    if (wd.type === 'guard') {
      const sh = buildShield(wd).group;
      sh.position.set(0, -0.42, -0.1);
      sh.rotation.y = Math.PI;
      c.parts.arms[0].add(sh);
    }
    return sw;
  }
}

export function renderAvatar(p, angle = 0.4, look = null, withWeapon = true) {
  init();
  const def = playerCharDef(p, look);
  const c = buildCharacter(def);
  if (withWeapon) attachWeapon(c, p);
  if (c.parts.face) c.parts.face.mat.map = c.parts.face.tex.open;
  const pivot = new THREE.Group();
  pivot.add(c.group);
  pivot.rotation.y = Math.PI + angle;
  scene.add(pivot);
  camera.position.set(0, 1.0, 4.3);
  camera.lookAt(0, 0.95, 0);
  R.setClearColor(0x000000, 0);
  R.render(scene, camera);
  const url = R.domElement.toDataURL('image/png');
  scene.remove(pivot);
  pivot.traverse((o) => { if (o.material && !o.userData.outline) [].concat(o.material).forEach((m) => m.dispose?.()); });
  return url;
}
