// Modelos 3D externos (VRM do VRoid / VRoid Hub, ou GLB) que substituem os bonecos procedurais.
// Coloque os arquivos em models/ e liste-os em models/modelos.json — veja models/LEIA-ME.txt.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

const buffers = new Map();   // arquivo -> ArrayBuffer (para criar várias instâncias do mesmo modelo)
export const registry = { cast: {}, folk: [], loaded: false, errors: [] };

async function fetchBuffer(file) {
  if (buffers.has(file)) return buffers.get(file);
  const res = await fetch(`models/${file}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  buffers.set(file, buf);
  return buf;
}

export async function loadModels() {
  let cfg;
  try {
    const res = await fetch('models/modelos.json', { cache: 'no-cache' });
    if (!res.ok) { registry.loaded = true; return registry; }
    cfg = await res.json();
  } catch {
    registry.loaded = true;
    return registry;
  }
  const jobs = [];
  for (const [id, file] of Object.entries(cfg.personagens || {})) {
    if (!file) continue;
    jobs.push(fetchBuffer(file).then(() => { registry.cast[id] = file; }).catch((e) => registry.errors.push(e.message)));
  }
  for (const file of cfg.moradores || []) {
    jobs.push(fetchBuffer(file).then(() => { registry.folk.push(file); }).catch((e) => registry.errors.push(e.message)));
  }
  await Promise.all(jobs);
  registry.loaded = true;
  return registry;
}

export function hasModel(id) { return !!registry.cast[id]; }

// Cria uma instância pronta para o jogo: virada para -Z, com ~altura desejada, braços abaixados.
export async function createModelCharacter(file, height = 1.7) {
  const buf = buffers.get(file) || await fetchBuffer(file);
  const gltf = await loader.parseAsync(buf.slice(0), '');
  const vrm = gltf.userData.vrm || null;
  const scene = vrm ? vrm.scene : gltf.scene;
  if (vrm) {
    VRMUtils.removeUnnecessaryVertices(scene);
    VRMUtils.combineSkeletons?.(scene);
    VRMUtils.rotateVRM0(vrm);
  }
  scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  const group = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(scene);
  group.add(inner);
  // VRM olha para +Z depois do rotateVRM0; nossos personagens olham para -Z
  inner.rotation.y = Math.PI;
  const box = new THREE.Box3().setFromObject(scene);
  const h = Math.max(0.1, box.max.y - box.min.y);
  const k = height / h;
  inner.scale.setScalar(k);
  inner.position.y = -box.min.y * k;
  const c = { group, inner, vrm, gltf, height: height + 0.1, external: true, parts: {} };
  if (gltf.animations?.length && !vrm) {
    c.mixer = new THREE.AnimationMixer(scene);
    c.mixer.clipAction(gltf.animations[0]).play();
  }
  return c;
}

const bone = (vrm, name) => vrm.humanoid?.getNormalizedBoneNode(name);

// Animação procedural sobre o esqueleto humanoide do VRM: andar, respirar, piscar, olhar, falar.
export function animateModel(c, dt, t, speed, lookYaw, talking) {
  const vrm = c.vrm;
  if (!vrm) { c.mixer?.update(dt); return; }
  c.walk = (c.walk || Math.random() * 10) + dt * speed * 6;
  const s = Math.sin(c.walk), amp = Math.min(1, speed / 1.4) * 0.55;
  // VRM 0.x fica girado 180° (rotateVRM0): os eixos X e Z dos ossos normalizados se invertem
  const k = vrm.meta?.metaVersion === '0' ? -1 : 1;
  const set = (n, x = 0, y = 0, z = 0) => { const b = bone(vrm, n); if (b) b.rotation.set(x * k, y, z * k); };
  set('leftUpperLeg', s * amp);
  set('rightUpperLeg', -s * amp);
  set('leftLowerLeg', Math.max(0, -s) * amp * 0.9);
  set('rightLowerLeg', Math.max(0, s) * amp * 0.9);
  const breath = Math.sin(t * 2) * 0.02;
  // braços para baixo (o VRM vem em pose T) balançando ao andar
  set('leftUpperArm', -s * amp * 0.6, 0, -1.2 + breath);
  set('rightUpperArm', s * amp * 0.6 + (talking ? Math.sin(t * 5) * 0.12 : 0), 0, 1.2 - breath);
  set('leftLowerArm', 0, 0, -0.15);
  set('rightLowerArm', 0, 0, 0.15 + (talking ? 0.3 : 0));
  set('spine', breath * 0.5, 0, 0);
  c.headYaw = (c.headYaw || 0) + ((Math.max(-0.9, Math.min(0.9, lookYaw || 0))) - (c.headYaw || 0)) * Math.min(1, dt * 6);
  set('neck', 0, c.headYaw * 0.4, 0);
  set('head', talking ? Math.sin(t * 7) * 0.05 : 0, c.headYaw * 0.6, 0);
  c.inner.position.y = (c.baseY ??= c.inner.position.y) + (speed > 0.05 ? Math.abs(s) * 0.03 : 0);
  // piscar e mexer a boca enquanto fala
  const em = vrm.expressionManager;
  if (em) {
    c.blinkT = (c.blinkT ?? 1 + Math.random() * 3) - dt;
    em.setValue('blink', c.blinkT < 0.12 ? 1 : 0);
    if (c.blinkT < 0) c.blinkT = 2 + Math.random() * 4;
    em.setValue('aa', talking ? Math.max(0, Math.sin(t * 14)) * 0.6 : 0);
    em.setValue('happy', talking ? 0.3 : 0);
  }
  vrm.update(dt);
}

export function disposeModel(c) {
  if (c.vrm) VRMUtils.deepDispose(c.vrm.scene);
  else c.group.traverse((o) => { o.geometry?.dispose(); [].concat(o.material || []).forEach((m) => m.dispose()); });
}
