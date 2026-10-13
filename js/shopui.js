// Janelas das lojas (cartões com ícone 3D, comparação de atributos e preço) e do Time.
import { DISHES, INGREDIENTS, pieceDef, PIECE_ORDER } from './data.js';
import { isFish } from './fishing.js';
import { ITEMS, MONSTERS, FOODS, RUNES, RUNE_TIER_FLOOR, MERCS, CAST_PARTY, weaponDef, armorDef, runeDef, shopStock, forgeKeysFor, forgeNote, WEAPON_TYPES, CLASS_WEAPONS, armorWeight, runeSlotsFor } from './data.js';
import { icon } from './icons.js';
import { weaponTypeNote } from './equipui.js';
import { PETS, PET_TIERS, ABILITY_TXT, petInfo, petReqFail } from './petdata.js';
import { CAST } from './characters.js';
import { guildRank } from './guild.js';
import { COMP_CLASSES } from './classes.js';
import { compClassSelect } from './talentui.js';

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
  cook: { title: 'Restaurante Sabor de Aincrad', say: () => '"Cozinhe com os ingredientes que você trouxer, ou compre um prato pronto. Uma refeição e uma bebida podem fazer efeito ao mesmo tempo!"', sell: true, cook: true },
  home: { title: 'Cozinha de casa', say: () => '"A lareira está acesa. Hora de cozinhar com o que você trouxe dos campos!"', cook: true, only: 'cook' },
};

// Bônus de comida ativos (refeição e bebida)
export function buffsHtml(g) {
  const list = g.activeBuffs();
  if (!list.length) return '<div class="muted pad">Nenhuma refeição ou bebida fazendo efeito agora.</div>';
  return `<div class="buffs">${list.map((e) => `<div class="buff ${e.slot}"><b>${e.slot === 'drink' ? '🥤 Bebida' : '🍖 Refeição'}: ${esc(e.def.name)}</b><span>${esc(e.def.desc)}</span><em>${Math.ceil(e.left / 60)} min</em></div>`).join('')}</div>`;
}

function recipeCard(g, id) {
  const d = DISHES[id], p = g.state.player;
  const fish = Object.entries(p.mats).filter(([n]) => isFish(n)).reduce((a, [, m]) => a + m.qty, 0);
  const ings = Object.entries(d.recipe).map(([ing, q]) => { const have = ing === '*peixe' ? fish : p.mats[ing]?.qty || 0; return `<span class="ing ${have >= q ? 'ok' : 'no'}">${ing === '*peixe' ? 'Peixe (qualquer)' : esc(ing)} ${Math.min(have, 99)}/${q}</span>`; }).join('');
  const can = g.canCook(id);
  return `<div class="scard rcard"><img src="${icon('item', `dish_${id}`)}" alt="">
    <div class="sc-body"><div class="sc-name">${d.cat === 'drink' ? '🥤' : '🍖'} ${esc(d.name)}</div><div class="sc-line"><b>${esc(d.desc)}</b></div><div class="sc-desc">dura ${d.mins} min · ${d.cat === 'drink' ? 'bebida' : 'refeição'} · tem ${p.items[`dish_${id}`] || 0} na mochila</div><div class="ings">${ings}</div></div>
    <div class="sc-foot"><span class="sc-btns"><button class="btn sm" data-act="cook" data-id="${id}" ${can ? '' : 'disabled'}>Cozinhar</button><button class="btn sm" data-act="cook" data-id="${id}" data-q="5" ${can ? '' : 'disabled'}>×5</button></span></div></div>`;
}

// Seus mascotes: o que anda com você e os que descansam na Toca
export function petStable(g) {
  const cur = g.state.pet, st = g.state.stable || [];
  const row = (rec, i) => {
    const info = petInfo(rec), T = PET_TIERS[info.tier];
    const act = i < 0
      ? `<button class="btn sm" data-act="petName">Renomear</button><button class="btn sm" data-act="petRest">Descansar</button>`
      : `<button class="btn sm" data-act="petUse" data-i="${i}">Levar comigo</button><button class="btn sm" data-act="petFreeSt" data-i="${i}">Libertar</button>`;
    return `<div class="row ${i < 0 ? 'eq' : ''}"><div class="withicon"><img class="ico" src="${icon('pet', info.id)}" alt=""><b style="color:${T.color}">${'★'.repeat(T.stars)}</b> <b>${esc(rec.name)}</b> <span class="muted">${esc(info.name)} · nível ${rec.level}${info.perkTxt ? ` · ${esc(info.perkTxt)}` : ''}</span></div><div class="row-r">${i < 0 ? '<span class="tag ok">Com você</span>' : ''}${act}</div></div>`;
  };
  if (!cur && !st.length) return '<div class="muted pad">Você ainda não tem mascote.</div>';
  return `<div class="section">Seus mascotes (${(cur ? 1 : 0) + st.length})</div>${cur ? row(cur, -1) : ''}${st.map(row).join('')}`;
}

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
  const p = g.state.player, wn = weaponTypeNote(p.cls, id);
  lines.unshift(wn.ok ? `<b>${wn.type}</b>` : `<b class="down">${wn.type} — só ${wn.who}</b>`);
  return card(g, { kind: 'weapon', id, name: d.name, rar: d.rarity, lines, desc: d.forged ? `Forjada pela Lisbeth — ${forgeNote(id.split('_')[1])}` : '', price: g.priceOf('weapon', id), owned: have ? `tem ${have}` : '' });
}

function armorCard(g, id) {
  const d = armorDef(id), cur = armorDef(g.state.player.armor);
  const lines = [cmp(d.def, cur.def, 'DEF'), cmp(d.hp, cur.hp, 'HP +')];
  lines.push(`Peso: <b>${armorWeight(d)}</b>${d.spd ? ` <span class="${d.spd > 0 ? 'up' : 'down'}">${d.spd > 0 ? '+' : ''}${Math.round(d.spd * 100)}% velocidade</span>` : ''}`);
  const have = g.state.player.armors.includes(id);
  return card(g, { kind: 'armor', id, name: d.name, rar: d.rarity, lines, desc: d.floor ? `Equipamento do Andar ${d.floor}` : '', price: g.priceOf('armor', id), owned: have ? 'você já tem' : '' });
}

export function pieceLines(d) {
  const l = [];
  if (d.def) l.push(`DEF <b>+${d.def}</b> · HP <b>+${d.hp}</b>`);
  for (const b of d.bonus) l.push(`<b class="up">${b.fmt(b.v)}</b>`);
  return l;
}
function pieceCard(g, id) {
  const d = pieceDef(id), p = g.state.player, cur = p.equip?.[d.slot] ? pieceDef(p.equip[d.slot]) : null;
  const lines = pieceLines(d);
  if (cur && cur.def) lines.push(`<span class="muted">equipado: DEF +${cur.def}</span>`);
  return card(g, { kind: 'piece', id, name: d.name, rar: d.rarity, lines, desc: `${d.slotName} · Andar ${d.floor}`, price: g.priceOf('piece', id), owned: (p.pieces || []).includes(id) ? 'você tem' : '' });
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
  if (info.only) ui.shopTab = info.only;
  let html = `<div class="npc-say">${esc(info.say(n))}</div>
    <div class="tabs">${info.cook ? tab('cook', 'Cozinhar') : ''}${info.only ? '' : tab('buy', 'Comprar')}${info.sell ? tab('sell', 'Vender') : ''}${rank?.discount ? `<span class="tag ok">Desconto da Guilda −${Math.round(rank.discount * 100)}%</span>` : ''}<span class="col">${nf(p.col)} Col</span></div>`;
  if (ui.shopTab === 'sell' && info.sell) return html + sellHtml(ui);
  const grid = (title, cards) => (cards.length ? `<div class="section">${title}</div><div class="shopgrid">${cards.join('')}</div>` : '');
  if (info.cook && ui.shopTab === 'cook') {
    html += buffsHtml(g);
    html += grid('Receitas — refeições', Object.keys(DISHES).filter((k) => DISHES[k].cat === 'meal').map((k) => recipeCard(g, k)));
    html += grid('Receitas — bebidas', Object.keys(DISHES).filter((k) => DISHES[k].cat === 'drink').map((k) => recipeCard(g, k)));
    html += '<div class="muted pad">Ingredientes: ervas, cogumelos, trigo, frutas e mel brotam pelos campos; Carne Crua vem de monstros de quatro patas e voadores; peixe, do Lago de Pesca. Os pratos vão para a mochila — coma quando quiser (Mochila → Usar).</div>';
    return html;
  }
  if (id === 'cook') {
    html += buffsHtml(g);
    html += grid('Pratos prontos', Object.keys(DISHES).map((k) => itemCard(g, `dish_${k}`)));
    html += grid('Ingredientes', Object.keys(INGREDIENTS).map((ing) => {
      const price = g.priceOf('ingredient', ing);
      const btns = `<button class="btn sm" data-act="buy" data-kind="ingredient" data-id="${esc(ing)}" ${p.col < price ? 'disabled' : ''}>×1</button><button class="btn sm" data-act="buy" data-kind="ingredient" data-id="${esc(ing)}" data-q="5" ${p.col < price * 5 ? 'disabled' : ''}>×5</button>`;
      return card(g, { kind: 'mat', id: ing, name: ing, rar: 0, desc: 'Ingrediente de cozinha', price, owned: `tem ${p.mats[ing]?.qty || 0}`, btns });
    }));
    return html;
  }
  if (id === 'agil') {
    const st = shopStock(n, p.cls);
    const deals = g.agilDeals().map((d) => {
      const price = g.priceOf('deal', d.i), btns = `<button class="btn sm" data-act="buy" data-kind="deal" data-id="${d.i}" ${d.sold || p.col < price ? 'disabled' : ''}>${d.sold ? 'Vendido' : 'Comprar'}</button>`;
      if (d.kind === 'weapon') { const w = weaponDef(d.id); return card(g, { kind: 'weapon', id: d.id, name: w.name, rar: 2, lines: [`ATK <b>${w.atk}</b> <span class="up">${w.atk > g.weaponAtk(p.weapon) ? '▲' : ''}</span>`], desc: `Arma rara do Andar ${w.floor} — antes do chefe de lá!`, price, btns }); }
      if (d.kind === 'armor') { const a = armorDef(d.id); return card(g, { kind: 'armor', id: d.id, name: a.name, rar: 2, lines: [`DEF <b>${a.def}</b> · HP +${a.hp}`], desc: `Armadura rara do Andar ${a.floor}.`, price, btns }); }
      if (d.kind === 'rune') { const r = runeDef(d.id); return card(g, { kind: 'rune', id: d.id, name: r.name, rar: r.rarity, lines: [`<b>${r.desc}</b>`], desc: '25% mais barata que na Mira.', price, btns }); }
      return card(g, { kind: 'item', id: d.id, name: `${d.q}× ${ITEMS[d.id].name}`, desc: `${ITEMS[d.id].desc} (30% de desconto)`, price, btns });
    });
    html += grid(`Ofertas do dia <span class="muted">— mudam amanhã</span>`, deals);
    html += grid('Especiais da Agil\'s Store', [...['elixir_str', 'elixir_agi', 'elixir_vit', 'cristalite', 'treasure_map', 'mystery_box'].map((i) => itemCard(g, i)),
      card(g, { kind: 'gems', id: 'pack', img: icon('item', 'cristalite'), name: '10 Cristais de Memória', rar: 2, lines: ['<b>💎 ×10</b> para o Altar dos Cristais'], desc: `Você tem ${p.gems || 0}. Um giro custa 10.`, price: g.priceOf('gems', 'pack') })]);
    html += grid('Consumíveis', st.items.filter((i) => !ITEMS[i].pet).map((i) => itemCard(g, i)));
    html += grid('Equipamento básico do andar', [...st.weapons.map((w) => weaponCard(g, w)), ...st.armors.map((a) => armorCard(g, a))]);
    html += '<div class="muted pad">O Agil paga 65% do preço por equipamento raro (aba Vender). Elixires dão +1 ponto de atributo para sempre; o Lingote de Cristalita deixa a Lisbeth passar de +10.</div>';
  } else if (id === 'forge') {
    const floors = [n, n - 1].filter((f) => f >= 1);
    const types = (CLASS_WEAPONS[p.cls] || ['sword', 'rapier']).map((t) => WEAPON_TYPES[t].name.toLowerCase()).join(' e ');
    html += grid(`Armas forjadas <span class="muted">— para a sua classe (${types})</span>`, floors.flatMap((f) => forgeKeysFor(p.cls).map((k) => weaponCard(g, `lw_${k}_${f}`))));
  } else if (id === 'armor') {
    html += grid(`Peças do Andar ${n} — elmo, capa, luvas, calça e botas`, PIECE_ORDER.filter((s) => s !== 'ring' && s !== 'amulet').map((s, i) => pieceCard(g, `p_${s}_${n}_${(n + i) % 5}`)));
    for (const f of [n, n - 1, n - 2].filter((x) => x >= 1)) html += grid(`Peitorais — Andar ${f}`, [`larm_${f}`, `arm_${f}`, `harm_${f}`].map((a) => armorCard(g, a)));
  } else if (id === 'rune') {
    html += grid(`Anéis e amuletos — Andar ${n}`, ['ring', 'amulet'].flatMap((s) => [0, 1, 2, 3, 4].map((v) => pieceCard(g, `p_${s}_${n}_${v}`))));
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
    html += petStable(g);
    const owned = new Set([g.state.pet, ...(g.state.stable || [])].filter(Boolean).map((x) => x.id || x.mon));
    for (let t = 1; t <= 5; t++) {
      const T = PET_TIERS[t];
      const list = Object.values(PETS).filter((x) => x.tier === t);
      html += grid(`<span style="color:${T.color}">${'★'.repeat(T.stars)} ${T.name}s</span> <span class="muted">— dano e cura ×${T.mul}${t >= 4 ? ' · habilidade especial' : ''}</span>`, list.map((pd) => {
        const fail = petReqFail(g, pd), have = owned.has(pd.id);
        const lines = [`<b style="color:${T.color}">${'★'.repeat(T.stars)} ${T.name}</b>`];
        if (pd.perkTxt) lines.push(`Bônus: <b>${esc(pd.perkTxt)}</b>`);
        if (pd.ability) lines.push(`<span class="up">${esc(ABILITY_TXT[pd.ability])}</span>`);
        const r = pd.req || {};
        const reqTxt = [r.floor && `Andar ${r.floor}`, r.level && `nível ${r.level}`, r.bosses && `${r.bosses} Chefes de Campo`].filter(Boolean).join(' · ');
        return card(g, { kind: 'adopt', id: pd.id, img: icon('pet', pd.id), name: pd.name, rar: Math.min(2, t - 1), lines,
          desc: have ? 'Já está com você ou na Toca.' : fail ? `Requisito: ${fail}.` : reqTxt ? `Requisitos cumpridos (${reqTxt}).` : 'Segue você, luta junto e cura quando seu HP estiver baixo.',
          price: g.priceOf('adopt', pd.id), disabled: !!fail || have, owned: have ? 'seu' : '' });
      }));
    }
    html += '<div class="muted pad">Os míticos também aparecem no Altar dos Cristais. Chefes de Campo derrotados contam para os requisitos dos lendários. Monstros dóceis (♥) dos campos podem ser domados com o Petisco de Domador.</div>';
  } else if (id === 'tavern') {
    html += buffsHtml(g);
    html += grid('Cardápio (come na hora)', Object.entries(FOODS).map(([fid, d]) => card(g, { kind: 'food', id: fid, name: d.name, lines: [`<b>${esc(d.desc)}</b>`, `<span class="muted">${d.cat === 'drink' ? 'bebida' : 'refeição'} · dura ${d.mins} min</span>`], price: g.priceOf('food', fid) })));
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
  (p.pieces || []).forEach((id) => { if (!Object.values(p.equip || {}).includes(id)) gear.push(['piece', id, pieceDef(id)]); });
  html += '<div class="section">Equipamento guardado</div>';
  html += gear.length ? `<div class="shopgrid">${gear.map(([k, id, d]) => `<div class="scard r${d.rarity}"><img src="${icon(k, id)}" alt=""><div class="sc-body"><div class="sc-name"><span class="rar r${d.rarity}">◆</span> ${esc(d.name)}</div><div class="sc-line">${k === 'weapon' ? `ATK ${d.atk}` : k === 'piece' ? `${d.slotName}${d.def ? ` · DEF ${d.def}` : ''}` : `DEF ${d.def}`}</div></div><div class="sc-foot"><span class="price">${nf(g.sellPrice(d))}</span><span class="sc-btns"><button class="btn sm" data-act="sellGear" data-kind="${k}" data-id="${id}">Vender</button></span></div></div>`).join('')}</div>` : '<div class="muted pad">Nenhum equipamento sobrando.</div>';
  return html;
}

// ─────────── Menu Time ───────────
export function renderParty(ui) {
  const g = ui.g, list = g.state.party || [], max = g.party.maxSize(), rank = guildRank(g.state.guild);
  const rows = g.party.members.map((m, i) => {
    const hp = Math.max(0, m.hp / m.maxHp);
    const cost = g.party.trainCost(i), inTown = g.world.inSafeZone(g.player.pos), maxed = (m.data.rank || 0) >= 20;
    const trainBtn = maxed ? '<span class="tag ok">Treino máximo</span>' : `<button class="btn sm" data-act="train" data-i="${i}" ${inTown && g.state.player.col >= cost ? '' : 'disabled'} title="${inTown ? '' : 'Só dá para treinar na cidade'}">Treinar +1 (${nf(cost)} Col)</button>`;
    return `<div class="row"><div class="withicon"><b>${esc(m.name)}</b> <span class="tag">Lv ${m.level}${m.data.rank ? ` · treino ${m.data.rank}/20` : ''}</span> <span class="muted">${m.data.kind === 'cast' ? 'amigo · ' : ''}</span>${compClassSelect(i, m.data.cls)}
      <div class="muted">ATK ${Math.round(m.atk)} · DEF ${Math.round(m.defense)} · HP ${nf(m.maxHp)}</div>
      <div class="bar-line"><div class="pbar hp"><i style="width:${(hp * 100).toFixed(0)}%"></i></div><span class="muted">${m.alive ? `${Math.ceil(m.hp)}/${m.maxHp}` : `volta em ${Math.ceil(m.down)}s`}</span></div></div>
      <div class="row-r">${m.data.kind === 'cast' ? `<button class="btn sm" data-act="talkMember" data-i="${i}">Conversar</button>` : ''}${trainBtn}<button class="btn sm" data-act="dismiss" data-i="${i}">Dispensar</button></div></div>`;
  }).join('');
  const atTavern = g.npcs.nearest(g.player.pos, 4)?.role === 'tavern';
  const merc = Object.entries(COMP_CLASSES).map(([cls, m]) => card(g, { kind: 'merc', id: cls, img: icon('merc', cls), name: m.name, lines: [`<b>${esc(m.role)}</b>`, `Dano ${Math.round(m.dmg * 100)}% · HP ${Math.round(m.hp * 100)}%`], price: g.priceOf('merc', cls), disabled: !atTavern || list.length >= max }));
  const friends = Object.keys(CAST_PARTY).map((id) => `<span class="tag ${g.party.has(id) ? 'ok' : ''}">${esc(CAST[id].name)}</span>`).join(' ');
  return `<div class="muted pad">A força do time acompanha a sua (HP, defesa e ataque). Treine cada companheiro na cidade para subir o nível dele: até +20 níveis acima do seu, cada um deixando-o mais resistente e forte.</div><div class="muted pad">Seu time luta ao seu lado: cada companheiro escolhe um monstro que está brigando com você, e alguns também curam. Se o HP de um companheiro zerar, ele foge com um cristal e volta depois de 45 segundos.</div>
    <div class="section">Seu time (${list.length}/${max})</div>${rows || '<div class="muted pad">Ninguém no time ainda.</div>'}
    <div class="section">Amigos</div><div class="pad">${friends}</div><div class="muted pad">Converse com o Kirito, a Asuna, o Klein ou a Silica na cidade e chame para o time.</div>
    <div class="section">Contratar na Taverna</div>${atTavern ? '' : '<div class="muted pad">Vá até o Gorm, na Taverna do Javali Dourado, para contratar.</div>'}<div class="shopgrid">${merc.join('')}</div>
    ${rank ? `<div class="muted pad">Posto ${rank.letter} na Guilda${rank.i >= 3 ? ' — você pode ter 3 companheiros.' : ' — no posto C o time aumenta para 3.'}</div>` : '<div class="muted pad">Com posto C na Guilda dos Aventureiros o time aumenta para 3.</div>'}`;
}
