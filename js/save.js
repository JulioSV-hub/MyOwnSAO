// Salvamento local (localStorage) com dois mundos: Normal (renasce ao morrer) e Hardcore (morreu = recomeça do zero).
// Também exporta/importa o mundo Normal em JSON.
const KEYS = { normal: 'sao-meu-mundo-save-v1', hardcore: 'sao-meu-mundo-save-hardcore-v1' };
const RECORD_KEY = 'sao-meu-mundo-hardcore-recorde';

export function newSave(name, mode = 'normal') {
  return {
    version: 1,
    mode,
    created: Date.now(),
    savedAt: Date.now(),
    playTime: 0,
    player: {
      name, level: 1, exp: 0, col: 300, hp: null,
      str: 0, agi: 0, vit: 0, points: 0,
      weapon: 'small_sword', offhand: null, armor: 'leather',
      weapons: ['small_sword'], armors: ['leather'],
      items: { potion: 5, teleport_crystal: 1 }, mats: {},
      slots: ['slant', null, null, null],
      dualBlades: false, kills: 0, deaths: 0,
    },
    progress: { floor: 1, highest: 1, cleared: {} },
    settings: { sens: 1, fov: 75, volume: 0.5, music: 0.45, bloom: true, shadows: true, grass: true, autoSheath: true, xpRate: 1, dayMinutes: 20, invertY: false },
    world: { tod: 0.32 },
  };
}

function migrate(s, mode) {
  const base = newSave(s?.player?.name || 'Player', s?.mode || mode || 'normal');
  const out = { ...base, ...s };
  out.mode = s?.mode || mode || 'normal';
  out.player = { ...base.player, ...(s.player || {}) };
  out.progress = { ...base.progress, ...(s.progress || {}) };
  out.settings = { ...base.settings, ...(s.settings || {}) };
  out.world = { ...base.world, ...(s.world || {}) };
  return out;
}

function valid(s) {
  return s && typeof s === 'object' && s.player && typeof s.player.name === 'string' && s.progress;
}

export function loadSave(mode = 'normal') {
  try {
    const raw = localStorage.getItem(KEYS[mode]);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return valid(s) ? migrate(s, mode) : null;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  state.savedAt = Date.now();
  try {
    localStorage.setItem(KEYS[state.mode || 'normal'], JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function deleteSave(mode = 'normal') {
  localStorage.removeItem(KEYS[mode]);
}

// Recorde do Hardcore: sobrevive às mortes, para você tentar superar a si mesmo.
export function getRecord() {
  try { return { runs: 0, bestFloor: 0, bestLevel: 0, bestKills: 0, last: null, ...JSON.parse(localStorage.getItem(RECORD_KEY) || '{}') }; } catch { return { runs: 0, bestFloor: 0, bestLevel: 0, bestKills: 0, last: null }; }
}

export function recordDeath(state, cause) {
  const r = getRecord(), p = state.player;
  r.runs++;
  r.bestFloor = Math.max(r.bestFloor, state.progress.highest);
  r.bestLevel = Math.max(r.bestLevel, p.level);
  r.bestKills = Math.max(r.bestKills, p.kills);
  r.last = { name: p.name, floor: state.progress.floor, level: p.level, kills: p.kills, time: state.playTime, cause, at: Date.now() };
  localStorage.setItem(RECORD_KEY, JSON.stringify(r));
  return r;
}

export function exportSave(state) {
  writeSave(state);
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = URL.createObjectURL(blob);
  a.download = `sao-mundo-${state.player.name.replace(/[^\w-]+/g, '_')}-${date}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// Importa sempre para o mundo Normal (no Hardcore não existe "voltar no tempo").
export function importSave() {
  return new Promise((resolve, reject) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return reject(new Error('Nenhum arquivo'));
      const r = new FileReader();
      r.onload = () => {
        try {
          const s = JSON.parse(r.result);
          if (!valid(s)) throw new Error('Arquivo não é um mundo válido');
          const m = migrate(s, 'normal');
          m.mode = 'normal';
          writeSave(m);
          resolve(m);
        } catch (e) {
          reject(e);
        }
      };
      r.readAsText(f);
    };
    inp.click();
  });
}
