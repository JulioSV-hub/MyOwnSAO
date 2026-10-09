// Modelos 3D guardados só no navegador do jogador (IndexedDB). Os arquivos nunca saem do computador,
// então dá para usar no site online sem redistribuir os modelos.
const DB = 'sao-meu-mundo-modelos', STORE = 'files', MAP_KEY = 'sao-meu-mundo-modelos-map';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode), st = t.objectStore(STORE);
    const r = fn(st);
    t.oncomplete = () => { db.close(); resolve(r?.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

export function getLocalMap() {
  try { return { personagens: {}, moradores: [], creditos: {}, ...JSON.parse(localStorage.getItem(MAP_KEY) || '{}') }; } catch { return { personagens: {}, moradores: [], creditos: {} }; }
}
function setLocalMap(m) { localStorage.setItem(MAP_KEY, JSON.stringify(m)); }

export async function readLocalFile(key) { return tx('readonly', (st) => st.get(key)); }

export async function saveLocalFile(file) {
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf, 0, 4);
  if (String.fromCharCode(...head) !== 'glTF') throw new Error('o arquivo não é um .vrm/.glb válido');
  const key = `local:${file.name}`;
  await tx('readwrite', (st) => st.put(buf, key));
  navigator.storage?.persist?.();
  return key;
}

export async function assignLocal(slot, file) {
  const key = await saveLocalFile(file);
  const m = getLocalMap();
  if (slot === 'moradores') { if (!m.moradores.includes(key)) m.moradores.push(key); }
  else m.personagens[slot] = key;
  setLocalMap(m);
  return key;
}

export async function removeLocal(slot, key) {
  const m = getLocalMap();
  if (slot === 'moradores') m.moradores = m.moradores.filter((k) => k !== key);
  else delete m.personagens[slot];
  const still = Object.values(m.personagens).includes(key) || m.moradores.includes(key);
  if (!still) { await tx('readwrite', (st) => st.delete(key)); delete m.creditos[key]; }
  setLocalMap(m);
}

export function setLocalCredit(key, credit) {
  const m = getLocalMap();
  m.creditos[key] = { ...(m.creditos[key] || {}), ...credit };
  setLocalMap(m);
}
