// Ícones dos itens: cada arma, armadura, poção e material é renderizado em 3D e vira uma imagem (cache em memória).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildSword, buildArmor, buildItem, buildMaterial } from './gear3d.js';
import { weaponDef, armorDef } from './data.js';

const SIZE = 256;
let R = null, scene, camera;
const cache = new Map();

function init() {
  if (R) return;
  R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.setSize(SIZE, SIZE);
  R.setPixelRatio(1);
  R.toneMapping = THREE.NeutralToneMapping;
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(R);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  const key = new THREE.DirectionalLight('#fff4e0', 2.2);
  key.position.set(2, 3, 4);
  const rim = new THREE.DirectionalLight('#9ad0ff', 1.4);
  rim.position.set(-3, 1, -2);
  scene.add(key, rim, new THREE.AmbientLight('#ffffff', 0.4));
  camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
}

function render(obj, { diagonal = false, spin = 0.5 } = {}) {
  init();
  const pivot = new THREE.Group();
  pivot.add(obj);
  if (diagonal) pivot.rotation.set(0.25, 0.35, -PI4);
  else pivot.rotation.set(0.15, spin, 0);
  scene.add(pivot);
  pivot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pivot);
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const r = Math.max(sz.x, sz.y) * 0.5 * 1.18;
  camera.position.set(c.x, c.y, c.z + r / Math.tan((camera.fov * Math.PI) / 360) + sz.z);
  camera.lookAt(c);
  R.setClearColor(0x000000, 0);
  R.render(scene, camera);
  const url = R.domElement.toDataURL('image/png');
  scene.remove(pivot);
  pivot.traverse((o) => { o.geometry?.dispose(); [].concat(o.material || []).forEach((m) => m.dispose?.()); });
  return url;
}
const PI4 = Math.PI / 4;

export function icon(kind, id) {
  const key = `${kind}:${id}`;
  if (cache.has(key)) return cache.get(key);
  let url = '';
  try {
    if (kind === 'weapon') url = render(buildSword(weaponDef(id)).group, { diagonal: true });
    else if (kind === 'armor') url = render(buildArmor(armorDef(id)).group, { spin: 0.4 });
    else if (kind === 'item') url = render(buildItem(id).group, { spin: 0.3 });
    else url = render(buildMaterial(id).group, { spin: 0.6 });
  } catch (e) {
    console.warn('ícone falhou', key, e);
  }
  cache.set(key, url);
  return url;
}
