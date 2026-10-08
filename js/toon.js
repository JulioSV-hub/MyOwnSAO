// Estilo "pintado à mão": materiais toon com rampa suave, vento em árvores e contornos finos nos personagens.
import * as THREE from 'three';

// Rampa de luz: sombra clara (nunca preta) com transição suave para a luz — como cel shading pintado.
const ramp = new Uint8Array([120, 122, 135, 170, 210, 236, 250, 255]);
export const gradientMap = new THREE.DataTexture(ramp, ramp.length, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.LinearFilter;
gradientMap.needsUpdate = true;

export const windTime = { value: 0 };

const DROP = new Set(['roughness', 'metalness', 'envMapIntensity', 'flatShading']);

export function toonMat(color, o = {}) {
  const p = { color, gradientMap };
  for (const k in o) if (!DROP.has(k) && k !== 'wind') p[k] = o[k];
  const m = new THREE.MeshToonMaterial(p);
  if (o.wind) addWind(m, o.wind.strength ?? 0.06, o.wind.minY ?? 1.5);
  return m;
}

// Balanço ao vento para objetos instanciados (copas, arbustos): desloca vértices altos conforme a posição da instância.
export function addWind(mat, strength, minY) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float wk = max(0.0, position.y - ${minY.toFixed(2)});
        float ph = uWind * 1.3 + ip.x * 0.07 + ip.z * 0.05;
        transformed.x += (sin(ph) * 0.7 + sin(ph * 2.3) * 0.3) * wk * ${strength.toFixed(3)};
        transformed.z += cos(ph * 0.8) * wk * ${(strength * 0.6).toFixed(3)};`);
  };
  mat.customProgramCacheKey = () => `wind${strength}${minY}`;
  return mat;
}

// Contorno em espaço de tela (casca invertida): largura constante em pixels, cor marrom-escura.
export function outlineMat(color = '#2a2018', width = 1.4) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uWidth: { value: width } },
    vertexShader: `uniform float uWidth;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 vn = normalize(normalMatrix * normal);
        vec2 n2 = (projectionMatrix * vec4(vn, 0.0)).xy;
        float l = length(n2);
        if (l > 1e-5) clip.xy += n2 / l * uWidth * clip.w * 0.0022;
        gl_Position = clip;
      }`,
    fragmentShader: `uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

export function addOutlines(root, mat, skip = () => false) {
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.outline && !skip(o)) meshes.push(o); });
  for (const m of meshes) {
    const ol = new THREE.Mesh(m.geometry, mat);
    ol.userData.outline = true;
    ol.castShadow = false;
    ol.raycast = () => {};
    m.add(ol);
  }
}
