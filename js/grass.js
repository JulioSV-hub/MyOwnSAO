// Campo de grama que acompanha o jogador: um único draw call com milhares de folhas balançando ao vento.
// A altura do terreno e a densidade da grama vêm de uma textura gerada junto com o andar.
import * as THREE from 'three';

const TILE = 72;
const COUNT = 46000;

export class Grass {
  constructor({ N, half, cell, H, D, base, tip }) {
    const W = N + 1;
    const data = new Uint16Array(W * W * 4);
    const one = THREE.DataUtils.toHalfFloat(1);
    for (let i = 0; i < W * W; i++) {
      data[i * 4] = THREE.DataUtils.toHalfFloat(H[i]);
      data[i * 4 + 1] = THREE.DataUtils.toHalfFloat(D[i]);
      data[i * 4 + 3] = one;
    }
    this.map = new THREE.DataTexture(data, W, W, THREE.RGBAFormat, THREE.HalfFloatType);
    this.map.magFilter = this.map.minFilter = THREE.LinearFilter;
    this.map.needsUpdate = true;

    // Uma folha: tira afinando até a ponta, com 4 segmentos para poder curvar.
    const seg = 4, pos = [], idx = [];
    for (let j = 0; j <= seg; j++) {
      const y = j / seg, w = 0.042 * (1 - y * 0.92);
      pos.push(-w, y, 0, w, y, 0);
      if (j < seg) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const inst = new Float32Array(COUNT * 4);
    for (let i = 0; i < COUNT; i++) {
      inst[i * 4] = Math.random() * TILE;
      inst[i * 4 + 1] = Math.random() * TILE;
      inst[i * 4 + 2] = Math.random() * Math.PI * 2;
      inst[i * 4 + 3] = Math.random();
    }
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(inst, 4));
    geo.instanceCount = COUNT;

    this.mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uMap: { value: null }, uCenter: { value: new THREE.Vector3() }, uTime: { value: 0 },
        uTile: { value: TILE }, uHalf: { value: half }, uCell: { value: cell }, uW: { value: W },
        uBase: { value: new THREE.Color(base) }, uTip: { value: new THREE.Color(tip) }, uLight: { value: 1 },
      }]),
      vertexShader: `
        #include <common>
        #include <fog_pars_vertex>
        uniform sampler2D uMap; uniform vec3 uCenter; uniform float uTime, uTile, uHalf, uCell, uW;
        attribute vec4 aData;
        varying float vY; varying float vShade;
        void main() {
          vec2 p = mod(aData.xy - uCenter.xz + uTile * 0.5, uTile) - uTile * 0.5 + uCenter.xz;
          vec2 uv = ((p + uHalf) / uCell + 0.5) / uW;
          vec4 m = texture2D(uMap, uv);
          float dist = length(p - uCenter.xz);
          float fade = 1.0 - smoothstep(uTile * 0.3, uTile * 0.48, dist);
          float r = aData.w;
          float s = step(r, m.g) * fade * (0.55 + fract(r * 7.31) * 0.75);
          vec3 lp = position;
          lp.x *= 0.7 + fract(r * 3.7) * 0.8;
          float c = cos(aData.z), sn = sin(aData.z);
          lp = vec3(lp.x * c, lp.y * s * 0.55, lp.x * sn);
          float bend = lp.y * lp.y;
          float wind = sin(uTime * 1.7 + p.x * 0.23 + p.y * 0.17) * 0.6 + sin(uTime * 3.3 + p.x * 0.9 + p.y * 0.4) * 0.2;
          lp.x += (wind * 0.35 + (fract(r * 5.1) - 0.5) * 0.4) * bend;
          lp.z += wind * 0.15 * bend;
          vec3 wp = vec3(p.x, m.r - 0.04, p.y) + lp;
          vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          vY = position.y;
          vShade = 0.8 + fract(r * 11.3) * 0.35;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <common>
        #include <fog_pars_fragment>
        uniform vec3 uBase, uTip; uniform float uLight;
        varying float vY; varying float vShade;
        void main() {
          vec3 col = mix(uBase, uTip, smoothstep(0.0, 1.0, vY)) * vShade * uLight;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.mat.uniforms.uMap.value = this.map;
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
  }

  update(center, time, light) {
    const u = this.mat.uniforms;
    u.uCenter.value.copy(center);
    u.uTime.value = time;
    u.uLight.value = light;
  }

  dispose() {
    this.map.dispose();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
