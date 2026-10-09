// Configuração dos NPCs feita pelo jogador (aba NPCs do menu): altura, presença nos andares e escala dos moradores.
const KEY = 'sao-meu-mundo-npcs';

export const DEFAULT_H = { kirito: 1.72, asuna: 1.64, klein: 1.74, agil: 1.92, lisbeth: 1.63, silica: 1.6, argo: 1.58, yui: 1.25 };
const DEFAULT_PRESENCE = { kirito: 'always', asuna: 'always', klein: 'sometimes', silica: 'sometimes', yui: 'sometimes' };
export const PRESENCE_IDS = Object.keys(DEFAULT_PRESENCE);

export function getNpcConfig() {
  try { return { cast: {}, folkScale: 1, kidScale: 1, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { cast: {}, folkScale: 1, kidScale: 1 }; }
}

function save(c) { localStorage.setItem(KEY, JSON.stringify(c)); }

export function setNpc(id, patch) {
  const c = getNpcConfig();
  c.cast[id] = { ...(c.cast[id] || {}), ...patch };
  save(c);
}

export function setGlobal(key, value) {
  const c = getNpcConfig();
  c[key] = value;
  save(c);
}

export function resetNpc(id) {
  const c = getNpcConfig();
  delete c.cast[id];
  save(c);
}

export const npcHeight = (id) => getNpcConfig().cast[id]?.height ?? DEFAULT_H[id] ?? 1.7;
export const presence = (id) => getNpcConfig().cast[id]?.presence ?? DEFAULT_PRESENCE[id] ?? 'always';
