// Janelas das lojas (cartões com ícone 3D, comparação de atributos e preço) e do Time.
import { ITEMS, MONSTERS, FOODS, RUNES, RUNE_TIER_FLOOR, MERCS, CAST_PARTY, weaponDef, armorDef, runeDef, shopStock, FORGE_KEYS, forgeNote, armorWeight, runeSlotsFor } from './data.js';
import { icon } from './icons.js';
import { CAST } from './characters.js';
import { guildRank } from './guild.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (n) => Math.round(n).toLocaleString('pt-BR');

// Filhotes da Toca dos Mascotes (alguns só depois de chegar a andares mais altos)
export const ADOPT = [['wolf', 1], ['boar', 1], ['slime', 1], ['wasp', 1], ['toad', 3], ['drake', 4], ['cubeling', 6], ['wisp', 6], ['frostwolf', 8]];
export const ADOPT_NAMES = { wolf: 'Lobinho', boar: 'Javalizinho', slime: 'Geleca', wasp: 'Zunzum', toad: 'Sapeco', drake: 'Draquinho', cubeling: 'Cubinho', wisp: 'Faísca', frostwolf: 'Floco' };
export const adoptPrice = (mon) => 600 + Math.max(0, ADOPT.findIndex(([m]) => m === mon)) * 220;

export const SHOP_INFO = {
  agil: { title: "Agil's Store", say: (n) => `"Bem-vindo! Aqui no Andar ${n} eu tenho o que você precisa — preço justo, palavra do Agil."`, sell: true },
  forge: { title: "Lisbeth's Smith Shop", say: () => '"Lâminas forjadas por mim! Rapieiras para quem é rápido, katanas equilibradas e montantes para quem gosta de bater forte."', sell: true },
  armor: { title: 'Armaduras do Grimm', say: () => '"Leve, média ou pesada? Leve deixa você mais rápido; pesada aguenta pancada de chefe. Escolha com calma."', sell: true },
  rune: { title: 'Oficina de Runas da Mira', say: () => '"Runas guardam o poder de Aincrad. Equipe-as nos seus encaixes — um encaixe novo no nível 10 e outro no 20."' },
  pet: { title: 'Toca dos Mascotes', say: () => '"Todo aventureiro merece um amigo! Adote um filhote ou compre petiscos para o seu."' },
  tavern: { title: 'Taverna do Javali Dourado', say: () => '"Senta aí, aventureiro! Comida quente dá força para a próxima luta. O efeito dura alguns minutos."' },
};

function card(g, { kind, id, name, rar = 1, lines = [], desc = '', price, owned, btns, img, disabled }) {
  const p = g.state.player;
  const afford = p.col >= price;
  const buttons = btns || `<button class="btn sm" data-act="buy" data-kind="${kind}" data-id="${esc(id)}" ${disabled || !afford ? 'disabled' : ''}>Comprar</button>`;
  return `<div class="scard r${rar}">
    <img src="${img || icon(kind, id)}" alt="">
    <div class="sc-body"><div class="sc-name"><span class="rar r${rar}">◆</span> ${esc(name)}</div>${lines.map((l) => `<div class="sc-line">${l}</div>`).join('')}${desc ? `<div class="sc-desc">${esc(desc)}</div>` : ''}</div>
    <div class="sc-foot"><span class="price ${afford ? '' : 'no'}">${nf(price)}</span>${owned ? `<span class="owned">${owned}</span>` : ''}<span class="sc-btns">${buttons}</span></div>
  </div>`;
}
const cmp = (v, cur, label, fmt = (x) => x) => { const d = Math.round((v - cur) * 10) / 10; return `${label} <b>${fmt(v)}</b> ${d ? `<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${fmt(Math.abs(d))}</span>` : '<span class="muted">=</span>'}`; };

function weaponCard(g, id) {
  const d = weaponDef(id), cur = g.weaponAtk(g.state.player.weapon), curW = weaponDef(g.state.player.weapon);
  const lines = [cmp(d.atk, cur, 'ATK')];
  if (d.crit) lines.push(`Crítico <b class="${d.crit > 0 ? 'up' : 'down'}">${d.crit > 0 ? '+' : ''}${Math.round(d.crit * 100)}%</b>${curW.crit ? ` <span class="muted">(atual ${Math.round(curW.crit * 100)}%)</span>` : ''}`);
  const have = g.state.player.weapons.filter((x) => x === id).length;
  return card(g, { kind: 'weapon', id, name: d.name, rar: d.rarity, lines, desc: d.forged ? `Forjada pela Lisbeth — ${forgeNote(id.split('_')[1])}` : '', price: g.priceOf('weapon', id), owned: have ? `tem ${have}` : '' });
}

function armorCard(g, id) {
  const d = armorDef(id), cur = armorDef(g.state.player.armor);
  const lines = [cmp(d.def, cur.def, 'DEF'), cmp(d.hp, cur.hp, 'HP +')];
  lines.push(`Peso: <b>${armorWeight(d)}</b>${d.spd ? ` <span class="${d.spd > 0 ? 'up' : 'down'}">${d.spd > 0 ? '+' : ''}${Math.round(d.spd * 100)}% velocidade</span>` : ''}`);
  const have = g.state.player.armors.includes(id);
  return card(g, { kind: 'armor', id, name: d.name, rar: d.rarity, lines, desc: d.floor ? `Equipamento do Andar ${d.floor}` : '', price: g.priceOf('armor', id), owned: have ? 'você já tem' : '' });
}

function itemCard(g, id) {
  const d = ITEMS[id], p = g.state.player, price = g.priceOf('item', id);
  const btns = `<button class="btn sm" data-act="buy" data-kind="item" data-id="${id}" ${p.col < price ? 'disabled' : ''}>×1</button><button class="btn sm" data-act="buy" data-kind="item" data-id="${id}" data-q="5" ${p.col < price * 5 ? 'disabled' : ''}>×5</button>`;
  return card(g, { kind: 'item', id, name: d.name, desc: d.desc, price, owned: `tem ${p.items[id] || 0}`, btns });
}

export function renderShop(ui) {
  const g = ui.g, p = g.state.player, n = g.floor.n, id = ui.shopId || 'agil', info = SHOP_INFO[id];
  const tab = (t, l) => `<button class="tab ${ui.shopTab === t ? 'on' : ''}" data-act="tab" data-t="${t}">${l}</button>`;
  const rank = guildRank(g.state.guild);
  let html = `<div class="npc-say">${esc(info.say(n))}</div>
    <div class="tabs">${tab('buy', 'Comprar')}${info.sell ? tab('sell', 'Vender') : ''}${rank?.discount ? `<span class="tag ok">Desconto da Guilda −${Math.round(rank.discount * 100)}%</span>` : ''}<span class="col">${nf(p.col)} Col</span></div>`;
  if (ui.shopTab === 'sell' && info.sell) return html + sellHtml(ui);
  const grid = (title, cards) => (cards.length ? `<div class="section">${title}</div><div class="shopgrid">${cards.join('')}</div>` : '');
  if (id === 'agil') {
    const st = shopStock(n);
    html += grid('Consumíveis', st.items.filter((i) => !ITEMS[i].pet).map((i) => itemCard(g, i)));
    html += grid('Equipamento do andar', [...st.weapons.map((w) => weaponCard(g, w)), ...st.armors.map((a) => armorCard(g, a))]);
    html += '<div class="muted pad">Mais armaduras na loja do Grimm, armas forjadas com a Lisbeth e runas com a Mira — todas na Rua do Comércio, junto à muralha.</div>';
  } else if (id === 'forge') {
    const floors = [n, n - 1].filter((f) => f >= 1);
    html += grid('Armas forjadas', floors.flatMap((f) => FORGE_KEYS.map((k) => weaponCard(g, `lw_${k}_${f}`))));
  } else if (id === 'armor') {
    for (const f of [n, n - 1, n - 2].filter((x) => x >= 1)) html += grid(`Andar ${f}`, [`larm_${f}`, `arm_${f}`, `harm_${f}`].map((a) => armorCard(g, a)));
  } else if (id === 'rune') {
    html += runeSlotsHtml(g);
    const tiers = RUNE_TIER_FLOOR.map((f, i) => (n >= f ? i + 1 : 0)).filter(Boolean);
    for (const t of tiers.reverse()) {
      html += grid(`Runas nível ${['I', 'II', 'III'][t - 1]}`, Object.keys(RUNES).map((k) => {
        const rid = `rune_${k}_${t}`, d = runeDef(rid);
        return card(g, { kind: 'rune', id: rid, name: d.name, rar: d.rarity, lines: [`<b>${d.desc}</b>`], price: g.priceOf('rune', rid), owned: p.runes?.[rid] ? `tem ${p.runes[rid]}` : '' });
      }));
    }
    const locked = RUNE_TIER_FLOOR.find((f) => n < f);
    if (locked) html += `<div class="muted pad">Runas mais fortes chegam à oficina a partir do Andar ${locked}.</div>`;
  } else if (id === 'pet') {
    html += grid('Para o seu mascote', ['tame_treat', 'pet_snack'].map((i) => itemCard(g, i)));
    const hi = g.state.progress.highest;
    html += grid('Adotar um filhote', ADOPT.map(([mon, fl]) => {
      const m = MONSTERS[mon], locked = hi < fl;
      return card(g, { kind: 'adopt', id: mon, img: icon('pet', mon), name: ADOPT_NAMES[mon], lines: [`Filhote de <b>${esc(m.name)}</b>`], desc: locked ? `Disponível depois de chegar ao Andar ${fl}.` : 'Segue você, luta junto e cura quando seu HP estiver baixo.', price: g.priceOf('adopt', mon), disabled: locked, owned: g.state.pet?.mon === mon ? 'você tem um' : '' });
    }));
    html += `<div class="muted pad">${g.state.pet ? `Seu mascote atual: <b>${esc(g.state.pet.name)}</b> (nível ${g.state.pet.level}). Adotar outro manda o atual para a Toca.` : 'Você ainda não tem mascote.'}</div>`;
  } else if (id === 'tavern') {
    const f = p.food && p.food.until > g.state.playTime ? FOODS[p.food.id] : null;
    if (f) html += `<div class="unique">Efeito ativo: <b>${esc(f.name)}</b> — ${esc(f.desc)} (mais ${Math.ceil((p.food.until - g.state.playTime) / 60)} min)</div>`;
    html += grid('Cardápio', Object.entries(FOODS).map(([fid, d]) => card(g, { kind: 'food', id: fid, name: d.name, lines: [`<b>${esc(d.desc)}</b>`, `<span class="muted">dura ${d.mins} min · substitui o efeito atual</span>`], price: g.priceOf('food', fid) })));
    html += '<div class="muted pad">Quer companhia nas batalhas? Fale com o Gorm para contratar um companheiro (menu <b>Time</b>).</div>';
  }
  return html;
}

export function runeSlotsHtml(g) {
  const p = g.state.player, slots = runeSlotsFor(p.level), rs = p.runeSlots || [null, null, null];
  const cells = [0, 1, 2].map((i) => {
    if (i >= slots) return `<div class="rslot locked"><span>🔒</span><small>nível ${i === 1 ? 10 : 20}</small></div>`;
    const d = rs[i] && runeDef(rs[i]);
    return d ? `<div class="rslot on" style="--rc:${d.color}"><img src="${icon('rune', d.id)}" alt=""><b>${esc(d.name)}</b><small>${esc(d.desc)}</small><button class="x" data-act="runeOff" data-i="${i}" title="Tirar">✕</button></div>` : '<div class="rslot"><span>+</span><small>vazio</small></div>';
  }).join('');
  const inv = Object.entries(p.runes || {}).filter(([, q]) => q > 0);
  return `<div class="section">Encaixes de runa</div><div class="rslots">${cells}</div>
    ${inv.length ? `<div class="rinv">${inv.map(([id, q]) => { const d = runeDef(id); return `<button class="rchip" data-act="runeOn" data-id="${id}" style="--rc:${d.color}" title="${esc(d.desc)}"><img src="${icon('rune', id)}" alt="">${esc(d.name)} ×${q}</button>`; }).join('')}</div><div class="muted pad">Clique numa runa para equipar. Não dá para usar duas do mesmo tipo.</div>` : '<div class="muted pad">Nenhuma runa na mochila. Compre na Oficina de Runas ou encontre em baús.</div>'}`;
}

function sellHtml(ui) {
  const g = ui.g, p = g.state.player;
  const mats = Object.entries(p.mats).filter(([, m]) => m.qty > 0);
  let html = '<div class="section">Materiais</div>';
  html += mats.length ? `<div class="shopgrid">${mats.map(([name, m]) => `<div class="scard"><img src="${icon('mat', name)}" alt=""><div class="sc-body"><div class="sc-name">${esc(name)}</div><div class="sc-line">×${m.qty} · ${nf(m.value)} Col cada</div></div><div class="sc-foot"><span class="price">${nf(m.qty * m.value)}</span><span class="sc-btns"><button class="btn sm" data-act="sellMat" data-id="${esc(name)}">Vender tudo</button></span></div></div>`).join('')}</div>` : '<div class="muted pad">Nada para vender.</div>';
  if (mats.length > 1) html += '<div class="btns"><button class="btn" data-act="sellAllMats">Vender todos os materiais</button></div>';
  const gear = [];
  p.weapons.forEach((id) => { if (id !== p.weapon && id !== p.offhand) gear.push(['weapon', id, weaponDef(id)]); });
  p.armors.forEach((id) => { if (id !== p.armor) gear.push(['armor', id, armorDef(id)]); });
  html += '<div class="section">Equipamento guardado</div>';
  html += gear.length ? `<div class="shopgrid">${gear.map(([k, id, d]) => `<div class="scard r${d.rarity}"><img src="${icon(k, id)}" alt=""><div class="sc-body"><div class="sc-name"><span class="rar r${d.rarity}">◆</span> ${esc(d.name)}</div><div class="sc-line">${k === 'weapon' ? `ATK ${d.atk}` : `DEF ${d.def}`}</div></div><div class="sc-foot"><span class="price">${nf(g.sellPrice(d))}</span><span class="sc-btns"><button class="btn sm" data-act="sellGear" data-kind="${k}" data-id="${id}">Vender</button></span></div></div>`).join('')}</div>` : '<div class="muted pad">Nenhum equipamento sobrando.</div>';
  return html;
}

// ─────────── Menu Time ───────────
export function renderParty(ui) {
  const g = ui.g, list = g.state.party || [], max = g.party.maxSize(), rank = guildRank(g.state.guild);
  const rows = g.party.members.map((m, i) => {
    const hp = Math.max(0, m.hp / m.maxHp);
    return `<div class="row"><div class="withicon"><b>${esc(m.name)}</b> <span class="muted">${m.data.kind === 'cast' ? 'amigo' : esc(MERCS[m.data.cls].role)}</span>
      <div class="bar-line"><div class="pbar hp"><i style="width:${(hp * 100).toFixed(0)}%"></i></div><span class="muted">${m.alive ? `${Math.ceil(m.hp)}/${m.maxHp}` : `volta em ${Math.ceil(m.down)}s`}</span></div></div>
      <div class="row-r">${m.data.kind === 'cast' ? `<button class="btn sm" data-act="talkMember" data-i="${i}">Conversar</button>` : ''}<button class="btn sm" data-act="dismiss" data-i="${i}">Dispensar</button></div></div>`;
  }).join('');
  const atTavern = g.npcs.nearest(g.player.pos, 4)?.role === 'tavern';
  const merc = Object.entries(MERCS).map(([cls, m]) => card(g, { kind: 'merc', id: cls, img: icon('merc', cls), name: m.name, lines: [`<b>${esc(m.role)}</b>`, `Dano ${Math.round(m.dmg * 100)}% · HP ${Math.round(m.hp * 100)}%`], price: g.priceOf('merc', cls), disabled: !atTavern || list.length >= max }));
  const friends = Object.keys(CAST_PARTY).map((id) => `<span class="tag ${g.party.has(id) ? 'ok' : ''}">${esc(CAST[id].name)}</span>`).join(' ');
  return `<div class="muted pad">Seu time luta ao seu lado: cada companheiro escolhe um monstro que está brigando com você, e alguns também curam. Se o HP de um companheiro zerar, ele foge com um cristal e volta depois de 45 segundos.</div>
    <div class="section">Seu time (${list.length}/${max})</div>${rows || '<div class="muted pad">Ninguém no time ainda.</div>'}
    <div class="section">Amigos</div><div class="pad">${friends}</div><div class="muted pad">Converse com o Kirito, a Asuna, o Klein ou a Silica na cidade e chame para o time.</div>
    <div class="section">Contratar na Taverna</div>${atTavern ? '' : '<div class="muted pad">Vá até o Gorm, na Taverna do Javali Dourado, para contratar.</div>'}<div class="shopgrid">${merc.join('')}</div>
    ${rank ? `<div class="muted pad">Posto ${rank.letter} na Guilda${rank.i >= 3 ? ' — você pode ter 3 companheiros.' : ' — no posto C o time aumenta para 3.'}</div>` : '<div class="muted pad">Com posto C na Guilda dos Aventureiros o time aumenta para 3.</div>'}`;
}
