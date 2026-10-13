// Menu Equipamento: seu personagem em 3D no meio e os espaços de equipamento em volta.
import { weaponDef, armorDef, pieceDef, PIECE_SLOTS } from './data.js';
import { icon } from './icons.js';
import { renderAvatar } from './avatar.js';
import { pieceLines } from './shopui.js';
import { runeSlotsHtml } from './shopui.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SLOT_LABEL = { weapon: 'Arma', offhand: 'Mão esquerda', armor: 'Peitoral', head: 'Elmo', cape: 'Capa', hands: 'Luvas', legs: 'Calça', feet: 'Botas', ring: 'Anel', amulet: 'Amuleto' };
const LEFT = ['head', 'cape', 'armor', 'hands', 'ring'], RIGHT = ['weapon', 'offhand', 'legs', 'feet', 'amulet'];

function slotInfo(g, s) {
  const p = g.state.player;
  if (s === 'weapon') return { id: p.weapon, kind: 'weapon', name: g.weaponLabel(p.weapon), rar: weaponDef(p.weapon).rarity };
  if (s === 'offhand') return p.dualBlades ? (p.offhand ? { id: p.offhand, kind: 'weapon', name: g.weaponLabel(p.offhand), rar: weaponDef(p.offhand).rarity } : { empty: true }) : { locked: 'Dual Blades' };
  if (s === 'armor') return { id: p.armor, kind: 'armor', name: armorDef(p.armor).name, rar: armorDef(p.armor).rarity };
  const id = p.equip?.[s];
  if (!id) return { empty: true };
  const d = pieceDef(id);
  return { id, kind: 'piece', name: d.name, rar: d.rarity };
}

export function renderEquip(ui) {
  const g = ui.g, p = g.state.player, st = g.stats();
  ui.eqSlot ||= 'weapon';
  ui.avAngle ??= 0.4;
  // a imagem do personagem só é refeita quando algo muda
  const key = JSON.stringify([p.look, p.equip, p.armor, p.weapon, p.cls, ui.avAngle]);
  if (ui._avKey !== key) { ui._avKey = key; ui._avUrl = renderAvatar(p, ui.avAngle); }
  const cell = (s) => {
    const x = slotInfo(g, s), on = ui.eqSlot === s;
    return `<button class="eqcell ${on ? 'on' : ''} ${x.empty || x.locked ? 'empty' : `r${x.rar}`}" data-act="eqSlot" data-s="${s}" ${x.locked ? 'disabled' : ''}>
      ${x.id ? `<img src="${icon(x.kind, x.id)}" alt="">` : '<span class="ph">+</span>'}<span class="el">${SLOT_LABEL[s]}</span><b>${x.locked ? `requer ${x.locked}` : x.empty ? 'vazio' : esc(x.name)}</b></button>`;
  };
  let html = `<div class="doll">
      <div class="dcol">${LEFT.map(cell).join('')}</div>
      <div class="dview"><img src="${ui._avUrl}" alt="Seu personagem"><div class="drot"><button class="btn sm" data-act="rot" data-d="-1">⟲</button><button class="btn sm" data-act="rot" data-d="1">⟳</button></div></div>
      <div class="dcol">${RIGHT.map(cell).join('')}</div>
    </div>
    <div class="dstats"><span>ATK <b>${Math.round(st.atkR)}</b></span><span>DEF <b>${st.def.toFixed(0)}</b></span><span>HP <b>${st.maxHp.toLocaleString('pt-BR')}</b></span><span>Crítico <b>${(st.crit * 100).toFixed(0)}%</b></span><span>Velocidade <b>${Math.round(st.speedMul * 100)}%</b></span></div>`;
  html += `<div class="section">${SLOT_LABEL[ui.eqSlot]} — escolha o que equipar</div>${slotList(ui)}`;
  html += runeSlotsHtml(g);
  return html;
}

function slotList(ui) {
  const g = ui.g, p = g.state.player, s = ui.eqSlot;
  const row = (kind, id, name, rar, lines, equipped, act, extra = '') => `<div class="row ${equipped ? 'eq' : ''}"><div class="withicon"><img class="ico" src="${icon(kind, id)}" alt=""><span class="rar r${rar}">◆</span> <b>${esc(name)}</b> <span class="muted">${lines}</span></div><div class="row-r">${equipped ? '<span class="tag">Equipado</span>' : act}${extra}</div></div>`;
  const uniq = (arr) => [...new Set(arr)];
  if (s === 'weapon' || s === 'offhand') {
    const list = uniq(p.weapons).filter((id) => (s === 'weapon' ? true : id !== p.weapon));
    let html = list.map((id) => { const d = weaponDef(id); return row('weapon', id, g.weaponLabel(id), d.rarity, `ATK ${g.weaponAtk(id)}`, s === 'weapon' ? id === p.weapon : id === p.offhand, `<button class="btn sm" data-act="${s === 'weapon' ? 'equipW' : 'equipL'}" data-id="${id}">Equipar</button>`); }).join('');
    if (s === 'offhand' && p.offhand) html = `<div class="btns"><button class="btn sm" data-act="unequipL">Tirar arma da mão esquerda</button></div>` + html;
    return html || '<div class="muted pad">Nenhuma arma.</div>';
  }
  if (s === 'armor') return uniq(p.armors).map((id) => { const d = armorDef(id); return row('armor', id, d.name, d.rarity, `DEF ${d.def} · HP +${d.hp}`, id === p.armor, `<button class="btn sm" data-act="equipA" data-id="${id}">Equipar</button>`); }).join('');
  const mine = uniq((p.pieces || []).filter((id) => pieceDef(id)?.slot === s)).sort((a, b) => pieceDef(b).floor - pieceDef(a).floor || pieceDef(b).rarity - pieceDef(a).rarity);
  let html = p.equip?.[s] ? `<div class="btns"><button class="btn sm" data-act="unequipP" data-s="${s}">Tirar ${SLOT_LABEL[s].toLowerCase()}</button></div>` : '';
  html += mine.map((id) => { const d = pieceDef(id); return row('piece', id, d.name, d.rarity, pieceLines(d).join(' · ').replace(/<[^>]+>/g, ''), p.equip?.[s] === id, `<button class="btn sm" data-act="equipP" data-id="${id}">Equipar</button>`); }).join('');
  return html || `<div class="muted pad">Você ainda não tem ${PIECE_SLOTS[s].name.toLowerCase()}. ${PIECE_SLOTS[s].acc ? 'A Oficina de Runas da Mira vende anéis e amuletos' : 'O Grimm vende peças'} — e elas também aparecem em baús, Chefes de Campo e chefes de andar.</div>`;
}
