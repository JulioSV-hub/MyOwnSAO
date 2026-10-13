// Telas da classe: escolha de classe (diálogo), árvore de talentos (menu) e cartões da tela inicial.
import { CLASSES, COMP_CLASSES, branchesFor, talentPoints, spentIn, respecCost, classChangeCost } from './classes.js';
import { Sfx } from './audio.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (n) => Math.round(n).toLocaleString('pt-BR');

// Diálogo de escolha de classe. cost = Col cobrado (0 na primeira vez)
export function classPicker(g, cost = 0, intro) {
  const p = g.state.player;
  const pick = (id) => () => {
    const c = CLASSES[id];
    return {
      text: `${c.icon} ${c.name}\n${c.desc}\n\nBônus da classe: ${c.passive}.\nRamo de talentos próprio: ${c.name}.${cost ? `\n\nTrocar de classe custa ${nf(cost)} Col e devolve os pontos do ramo da classe antiga.` : ''}`,
      options: [
        { label: `Ser ${c.name}${cost ? ` (${nf(cost)} Col)` : ''}`, run: () => {
          if (cost && p.col < cost) { Sfx.error(); return { text: 'Col insuficiente.', options: [{ label: 'Ok', run: () => null }] }; }
          p.col -= cost;
          setClass(g, id);
          return null;
        } },
        { label: 'Ver outras classes', run: () => root() },
      ],
    };
  };
  const root = () => ({ text: intro || 'Escolha a sua classe. Ela dá um bônus próprio e libera um ramo exclusivo na árvore de talentos (Menu → Talentos).', options: Object.entries(CLASSES).map(([id, c]) => ({ label: `${c.icon} ${c.name} — ${c.desc}${id === p.cls ? ' (atual)' : ''}`, run: pick(id) })) });
  return { name: 'Classe', title: 'Sistema de Aincrad', def: {}, talking: false, dialog: root };
}

export function setClass(g, id) {
  const p = g.state.player, old = p.cls;
  // pontos do ramo da classe antiga voltam para você
  if (old && old !== id) for (const br of branchesFor(old)) if (br.key === 'cls') for (const n of br.nodes) delete p.talents[n.id];
  p.cls = id;
  p.talents ||= {};
  g.clampHp();
  g.combat.refresh();
  g.party.spawn();
  Sfx.levelUp();
  g.ui.banner(`Classe: ${CLASSES[id].name}`, CLASSES[id].passive, 4);
  g.save();
}

export function renderTalents(ui) {
  const g = ui.g, p = g.state.player, pts = talentPoints(p), c = CLASSES[p.cls];
  if (!c) return '<div class="muted pad">Você ainda não tem classe.</div><div class="btns"><button class="btn" data-act="pickClass">Escolher classe</button></div>';
  const cols = branchesFor(p.cls).map((br) => {
    const spent = spentIn(p, br);
    const nodes = br.nodes.map((n) => {
      const r = p.talents?.[n.id] || 0, lvLock = p.level < (n.lvl || 0), locked = spent < n.req || lvLock, can = !locked && r < n.max && pts > 0;
      return `<div class="tnode ${locked ? 'locked' : ''} ${r ? 'on' : ''} ${r >= n.max ? 'max' : ''} ${n.legend ? 'legend' : ''}">
        <div class="tn-head"><b>${esc(n.name)}</b><span>${r}/${n.max}</span></div>
        <div class="tn-desc">${esc(n.desc)} <span class="muted">por ponto</span></div>
        ${locked ? `<div class="tn-lock">🔒 ${spent < n.req ? `gaste ${n.req} pontos em ${esc(br.name)}` : ''}${spent < n.req && lvLock ? ' e ' : ''}${lvLock ? `nível ${n.lvl}` : ''}</div>` : `<button class="btn sm" data-act="talent" data-id="${n.id}" ${can ? '' : 'disabled'}>+1</button>`}
      </div>`;
    }).join('<div class="tlink"></div>');
    return `<div class="tbranch" style="--bc:${br.color}"><div class="tb-head">${esc(br.name)} <span>${spent} pts</span></div>${nodes}</div>`;
  }).join('');
  return `<div class="classhead" style="--cc:${c.color}"><div class="ch-icon">${c.icon}</div><div><b>${esc(c.name)}</b><div class="muted">${esc(c.passive)}</div></div>
      <div class="ch-pts"><span>Pontos de talento</span><b>${pts}</b></div></div>
    <div class="ttree">${cols}</div>
    <div class="muted pad">Você ganha 1 ponto de talento por nível. Cada ramo libera nós mais fortes conforme você investe nele, e os mais fundos também pedem nível 40, 60, 90 e 120. O último nó de cada ramo é lendário (★). A árvore inteira tem 210 pontos — mais do que dá para juntar até o andar 100, então escolha seu caminho!</div>
    <div class="btns"><button class="btn" data-act="respec">Redistribuir pontos (${nf(respecCost(p))} Col)</button><button class="btn" data-act="changeClass">Trocar de classe (${nf(classChangeCost(p))} Col)</button></div>`;
}

export function spendTalent(g, id) {
  const p = g.state.player;
  p.talents ||= {};
  if (talentPoints(p) <= 0) return;
  for (const br of branchesFor(p.cls)) {
    const n = br.nodes.find((x) => x.id === id);
    if (!n) continue;
    const r = p.talents[id] || 0;
    if (r >= n.max || spentIn(p, br) < n.req || p.level < (n.lvl || 0)) return;
    p.talents[id] = r + 1;
    g.clampHp();
    g.combat.refresh();
    Sfx.click();
    g.save();
    return;
  }
}

export function respec(g) {
  const p = g.state.player, cost = respecCost(p);
  if (p.col < cost) { Sfx.error(); g.ui.toast('Col insuficiente.', 'warn'); return; }
  p.col -= cost;
  p.talents = {};
  g.clampHp();
  Sfx.coin();
  g.ui.toast('Pontos de talento devolvidos. Distribua de novo!', 'skill');
  g.save();
}

// Cartões da tela de novo jogo
export function classCards(sel) {
  return Object.entries(CLASSES).map(([id, c]) => `<button type="button" class="ccard ${id === sel ? 'on' : ''}" data-cls="${id}" style="--cc:${c.color}"><span class="cc-icon">${c.icon}</span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></button>`).join('');
}

export const compClassSelect = (i, cls) => `<select data-pcls="${i}" title="Classe do companheiro">${Object.entries(COMP_CLASSES).map(([id, c]) => `<option value="${id}" ${id === cls ? 'selected' : ''}>${c.name}</option>`).join('')}</select>`;
