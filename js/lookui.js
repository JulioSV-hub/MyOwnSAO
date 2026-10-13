// Editor de aparência do personagem (novo jogo e Sistema → Alterar aparência).
import { LOOK_OPTIONS, defaultLook } from './data.js';
import { renderAvatar } from './avatar.js';
import { Sfx } from './audio.js';

const LABELS = { hairColor: 'Cor do cabelo', skin: 'Pele', eyes: 'Olhos', top: 'Roupa', pants: 'Calça / saia', boots: 'Botas', accent: 'Detalhes' };

export function openLookEditor({ look, name = 'Você', title = 'Aparência do personagem', onSave, onCancel }) {
  let draft = { ...defaultLook(!!look?.female), ...(look || {}) };
  let angle = 0.4;
  const el = document.createElement('div');
  el.id = 'looked';
  document.body.appendChild(el);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const render = () => {
    const img = renderAvatar({ name, look: draft, equip: {}, armor: 'leather', weapon: 'small_sword' }, angle, { ...draft, useGear: false }, false);
    const sw = (k) => `<div class="lrow"><span>${LABELS[k]}</span><div class="sw">${LOOK_OPTIONS[k].map((c) => `<button class="swc ${draft[k] === c ? 'on' : ''}" data-k="${k}" data-v="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div></div>`;
    el.innerHTML = `<div class="lbox">
      <div class="lhead">${title}</div>
      <div class="lbody">
        <div class="lprev"><img src="${img}" alt=""><div class="drot"><button class="btn sm" data-rot="-1">⟲</button><button class="btn sm" data-rot="1">⟳</button></div></div>
        <div class="lopts">
          <div class="lrow"><span>Sexo</span><div class="sw"><button class="btn sm ${!draft.female ? 'on' : ''}" data-sex="m">Masculino</button><button class="btn sm ${draft.female ? 'on' : ''}" data-sex="f">Feminino</button>
            <label class="muted"><input type="checkbox" data-skirt ${draft.skirt ? 'checked' : ''}> saia</label></div></div>
          <div class="lrow"><span>Cabelo</span><div class="sw">${LOOK_OPTIONS.hair.map(([v, l]) => `<button class="btn sm ${draft.hair === v ? 'on' : ''}" data-k="hair" data-v="${v}">${l}</button>`).join('')}</div></div>
          ${['hairColor', 'skin', 'eyes', 'top', 'pants', 'boots', 'accent'].map(sw).join('')}
          <div class="muted pad">Armaduras, elmos, luvas, botas e capas que você equipar aparecem por cima desta aparência.</div>
        </div>
      </div>
      <div class="lfoot"><button class="btn" data-act="rand">🎲 Aleatório</button><button class="btn" data-act="cancel">Cancelar</button><button class="btn primary" data-act="save">Salvar aparência</button></div>
    </div>`;
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    Sfx.click();
    if (b.dataset.rot) angle += +b.dataset.rot * 0.7;
    else if (b.dataset.sex) { const f = b.dataset.sex === 'f'; draft = { ...defaultLook(f), ...draft, female: f, skirt: f }; if (!f && ['long', 'twintails', 'bob'].includes(draft.hair)) draft.hair = 'short'; }
    else if (b.dataset.k) draft[b.dataset.k] = b.dataset.v;
    else if (b.dataset.act === 'rand') {
      const f = Math.random() < 0.5;
      draft = { female: f, skirt: f && Math.random() < 0.6 };
      draft.hair = pick(LOOK_OPTIONS.hair)[0];
      for (const k of Object.keys(LABELS)) draft[k] = pick(LOOK_OPTIONS[k]);
    } else if (b.dataset.act === 'cancel') { el.remove(); onCancel?.(); return; }
    else if (b.dataset.act === 'save') { el.remove(); onSave?.(draft); return; }
    render();
  });
  el.addEventListener('change', (e) => { if (e.target.dataset.skirt !== undefined) { draft.skirt = e.target.checked; render(); } });
  render();
}
