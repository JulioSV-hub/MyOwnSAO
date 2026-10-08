// Salvamento local (localStorage) + exportação/importação do mundo em JSON.
const KEY = 'sao-meu-mundo-save-v1';

export function newSave(name) {
  return {
    version: 1,
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
    settings: { sens: 1, fov: 75, volume: 0.5, bloom: true, shadows: true, xpRate: 1, dayMinutes: 20, invertY: false },
    world: { tod: 0.32 },
  };
}

function migrate(s) {
  const base = newSave(s?.player?.name || 'Player');
  const out = { ...base, ...s };
  out.player = { ...base.player, ...(s.player || {}) };
  out.progress = { ...base.progress, ...(s.progress || {}) };
  out.settings = { ...base.settings, ...(s.settings || {}) };
  out.world = { ...base.world, ...(s.world || {}) };
  return out;
}

function valid(s) {
  return s && typeof s === 'object' && s.player && typeof s.player.name === 'string' && s.progress;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return valid(s) ? migrate(s) : null;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  state.savedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function deleteSave() {
  localStorage.removeItem(KEY);
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
          const m = migrate(s);
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
