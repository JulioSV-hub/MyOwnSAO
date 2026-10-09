// Texturas procedurais (pedra, ardósia, paralelepípedo) e material com projeção em coordenadas do mundo,
// para que qualquer parede/telhado/rua tenha textura na escala certa sem precisar de UVs.
import * as THREE from 'three';
import { toonMat } from './toon.js';

function canvasTex(draw, size = 512) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const shade = (hex, k) => `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;
const rnd = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

// Blocos de pedra (cantaria), fileiras alternadas
export function ashlarTexture(base = '#cfc8bc', mortar = '#8f897f', seed = 7) {
  return canvasTex((g, S) => {
    const r = rnd(seed);
    g.fillStyle = mortar;
    g.fillRect(0, 0, S, S);
    const rows = 8, rh = S / rows;
    for (let y = 0; y < rows; y++) {
      const off = (y % 2) * 0.5, bw = S / 4;
      for (let x = -1; x < 5; x++) {
        const k = 0.86 + r() * 0.22;
        g.fillStyle = shade(base, k);
        const px = (x + off) * bw + 3, py = y * rh + 3;
        g.beginPath();
        g.roundRect(px, py, bw - 6, rh - 6, 6);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.10)';
        g.fillRect(px + 2, py + 2, bw - 10, 4);
        g.fillStyle = 'rgba(0,0,0,0.10)';
        g.fillRect(px + 2, py + rh - 12, bw - 10, 4);
      }
    }
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.06})`; g.fillRect(r() * S, r() * S, 2, 2); }
  });
}

// Telhas de ardósia sobrepostas
export function slateTexture(base = '#56606e', seed = 11) {
  return canvasTex((g, S) => {
    const r = rnd(seed);
    g.fillStyle = shade(base, 0.6);
    g.fillRect(0, 0, S, S);
    const rows = 12, rh = S / rows, cw = S / 8;
    for (let y = 0; y < rows; y++) for (let x = -1; x < 9; x++) {
      const px = (x + (y % 2) * 0.5) * cw, py = y * rh;
      g.fillStyle = shade(base, 0.85 + r() * 0.3);
      g.beginPath();
      g.moveTo(px + 2, py);
      g.lineTo(px + cw - 2, py);
      g.lineTo(px + cw - 2, py + rh * 0.8);
      g.quadraticCurveTo(px + cw / 2, py + rh * 1.15, px + 2, py + rh * 0.8);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(px + 2, py + rh * 0.72, cw - 4, 3);
    }
  });
}

// Paralelepípedos arredondados
export function cobbleTexture(base = '#a39a8c', seed = 3) {
  return canvasTex((g, S) => {
    const r = rnd(seed);
    g.fillStyle = shade(base, 0.55);
    g.fillRect(0, 0, S, S);
    const rows = 10, rh = S / rows;
    for (let y = 0; y < rows; y++) {
      let x = (y % 2) * 18 - 30;
      while (x < S + 30) {
        const w = 34 + r() * 26;
        g.fillStyle = shade(base, 0.82 + r() * 0.32);
        g.beginPath();
        g.ellipse(x + w / 2, y * rh + rh / 2, w / 2 - 3, rh / 2 - 4, (r() - 0.5) * 0.2, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.beginPath();
        g.ellipse(x + w / 2 - 4, y * rh + rh / 2 - 5, w / 4, rh / 6, 0, 0, Math.PI * 2);
        g.fill();
        x += w;
      }
    }
  });
}

// Material toon com textura projetada pelo mundo (triplanar simplificado: escolhe o eixo dominante da normal)
export function worldMat(tex, scale = 0.4, color = '#ffffff', extra = {}) {
  const m = toonMat(color, { map: tex, ...extra });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uScale = { value: scale };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;\nuniform float uScale;')
      .replace('#include <map_fragment>', `
        vec3 an = abs(normalize(vWN));
        vec2 wuv = an.y > max(an.x, an.z) ? vWP.xz : (an.x > an.z ? vWP.zy : vWP.xy);
        diffuseColor *= texture2D(map, wuv * uScale);`);
  };
  m.customProgramCacheKey = () => `worldmap${scale}`;
  return m;
}
