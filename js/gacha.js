// Altar dos Cristais (gacha): três estandartes — Mascotes, Arsenal e Visuais.
// Cada giro custa Cristais de Memória. Garantia: Épico ou melhor a cada 10 giros e Lendário a cada 80 (com chance subindo a partir do 65º).
import { PETS, PET_TIERS } from './petdata.js';
import { SKINS, SKIN_TIERS } from './skins.js';
import { classWeapon, weaponDef, armorDef, randomPiece, pieceDef } from './data.js';
import { icon } from './icons.js';
import { Sfx } from './audio.js';

export const COST = { one: 10, ten: 90 };
const RATES = [0, 0.55, 0.33, 0.1, 0.018, 0.002];
export const TIER_INFO = [null,
  { name: 'Comum', color: '#9aa0a8' }, { name: 'Raro', color: '#4f9ff7' }, { name: 'Épico', color: '#b05aff' },
  { name: 'Lendário', color: '#f3a712' }, { name: 'Mítico', color: '#ff4a6a' }];

export const BANNERS = {
  pets: { name: 'Mascotes', desc: 'Todos os mascotes da Toca — inclusive os lendários e os míticos (Dragão Ancestral, Fênix, Kirin), sem precisar dos requisitos.', icon: '♥' },
  gear: { name: 'Arsenal', desc: 'Armas da sua classe, peitorais e peças de equipamento do seu maior andar. Lendários e míticos vêm de andares acima!', icon: '⚔' },
  skins: { name: 'Visuais', desc: 'Skins colecionáveis: Samurai, Ninja, Divino, Lorde Demônio, Imperador Celestial... Comum aqui vira Col.', icon: '✦' },
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Gacha {
  constructor(game) { this.game = game; }

  get st() {
    const s = this.game.state;
    s.gacha ||= { pity: {}, pulls: 0, free: -1 };
    return s.gacha;
  }
  get gems() { return this.game.state.player.gems || 0; }
  addGems(n, why) {
    const p = this.game.state.player;
    p.gems = (p.gems || 0) + n;
    if (why) this.game.ui.toast(`+${n} Cristais de Memória (${why})`, 'skill');
  }

  freeReady() { return this.st.free !== (this.game.state.world.day || 0); }

  rollTier(banner) {
    const pity = (this.st.pity[banner] ||= { e: 0, l: 0 });
    pity.e++; pity.l++;
    let leg = RATES[4] + RATES[5];
    if (pity.l > 64) leg += (pity.l - 64) * 0.06;
    let tier;
    const r = Math.random();
    if (pity.l >= 80 || r < leg) tier = Math.random() < 0.1 ? 5 : 4;
    else if (pity.e >= 10 || r < leg + RATES[3]) tier = 3;
    else if (r < leg + RATES[3] + RATES[2]) tier = 2;
    else tier = 1;
    if (tier >= 3) pity.e = 0;
    if (tier >= 4) pity.l = 0;
    return tier;
  }

  // o prêmio de uma raridade em cada estandarte
  prize(banner, tier) {
    const g = this.game, p = g.state.player, hi = Math.max(1, g.state.progress.highest);
    if (banner === 'pets') {
      const list = Object.values(PETS).filter((x) => x.tier === tier);
      const pd = pick(list);
      const owned = [g.state.pet, ...(g.state.stable || [])].some((x) => x && (x.id || x.mon) === pd.id);
      if (owned) { const n = PET_TIERS[tier].refund; return { tier, name: pd.name, img: icon('pet', pd.id), dup: true, sub: `repetido · +${n} Cristais`, give: () => { p.gems = (p.gems || 0) + n; } }; }
      return { tier, name: pd.name, img: icon('pet', pd.id), sub: `Mascote ${PET_TIERS[tier].name}`, give: () => g.pets.add({ id: pd.id, mon: pd.mon || pd.id, name: pd.name, level: 1, exp: 0 }, false) };
    }
    if (banner === 'gear') {
      if (tier === 1) { const id = randomPiece(hi, false); return { tier, name: pieceDef(id).name, img: icon('piece', id), sub: pieceDef(id).slotName, give: () => (p.pieces ||= []).push(id) }; }
      if (tier === 2) {
        if (Math.random() < 0.5) { const id = randomPiece(hi, true); return { tier, name: pieceDef(id).name, img: icon('piece', id), sub: `${pieceDef(id).slotName} rara`, give: () => (p.pieces ||= []).push(id) }; }
        const id = classWeapon(p.cls, hi + 1);
        return { tier, name: weaponDef(id).name, img: icon('weapon', id), sub: `Arma · ATK ${weaponDef(id).atk}`, give: () => p.weapons.push(id) };
      }
      if (tier === 3) {
        if (Math.random() < 0.4) { const id = `rarm_${hi + 1}`; return { tier, name: armorDef(id).name, img: icon('armor', id), sub: `Peitoral raro · DEF ${armorDef(id).def}`, give: () => p.armors.push(id) }; }
        const id = classWeapon(p.cls, hi + 1, true);
        return { tier, name: weaponDef(id).name, img: icon('weapon', id), sub: `Arma rara · ATK ${weaponDef(id).atk}`, give: () => p.weapons.push(id) };
      }
      // lendário: arma rara de 6 andares acima já fortalecida; mítico: 12 andares acima, +5
      const up = tier === 5 ? 12 : 6, lv = tier === 5 ? 5 : 2;
      const id = classWeapon(p.cls, Math.min(100, hi + up), true);
      return { tier, name: `${weaponDef(id).name} +${lv}`, img: icon('weapon', id), sub: `Arma ${TIER_INFO[tier].name} · ATK ${Math.round(weaponDef(id).atk * (1 + 0.1 * lv))}`, give: () => { p.weapons.push(id); p.upgrades ||= {}; p.upgrades[id] = Math.max(p.upgrades[id] || 0, lv); } };
    }
    // visuais
    if (tier === 1) { const col = 200 + hi * 60; return { tier, name: `${col.toLocaleString('pt-BR')} Col`, img: icon('mat', 'Moedas de Col'), sub: 'consolação', give: () => { p.col += col; } }; }
    const list = Object.values(SKINS).filter((x) => x.tier === tier);
    const sk = pick(list);
    if ((p.skins || []).includes(sk.id)) { const n = [0, 0, 2, 6, 25, 60][tier]; return { tier, name: sk.name, skin: sk.id, dup: true, sub: `repetida · +${n} Cristais`, give: () => { p.gems = (p.gems || 0) + n; } }; }
    return { tier, name: sk.name, skin: sk.id, sub: `Skin ${SKIN_TIERS[tier].name}`, give: () => (p.skins ||= []).push(sk.id) };
  }

  pull(banner, n, free = false) {
    const g = this.game, p = g.state.player, cost = free ? 0 : n === 10 ? COST.ten : COST.one * n;
    if (!free && this.gems < cost) { Sfx.error(); g.ui.toast(`Faltam ${cost - this.gems} Cristais de Memória.`, 'warn'); return null; }
    if (free) { if (!this.freeReady()) return null; this.st.free = g.state.world.day || 0; }
    p.gems = this.gems - cost;
    const out = [];
    for (let i = 0; i < n; i++) {
      const pr = this.prize(banner, this.rollTier(banner));
      pr.give();
      out.push(pr);
    }
    this.st.pulls += n;
    (this.st.hist ||= []).unshift(...out.map((x) => ({ b: banner, t: x.tier, n: x.name })));
    this.st.hist.length = Math.min(this.st.hist.length, 40);
    g.save();
    return out;
  }
}

// ─────────── Tela do Altar ───────────
export function openGacha(g, banner = 'pets') {
  const ga = g.gacha;
  let el = document.getElementById('gacha');
  if (!el) { el = document.createElement('div'); el.id = 'gacha'; document.body.appendChild(el); }
  g.input.unlock();
  g.ui.dialogOpen = true;
  let view = 'banner', results = null;
  const close = () => { el.remove(); g.ui.dialogOpen = false; g.input.lock(); };
  const skinImg = (id) => g.ui.skinPreview?.(id) || '';
  const render = () => {
    const pity = ga.st.pity[banner] || { e: 0, l: 0 }, b = BANNERS[banner];
    const tabs = Object.entries(BANNERS).map(([k, v]) => `<button class="gtab ${k === banner && view === 'banner' ? 'on' : ''}" data-b="${k}">${v.icon} ${v.name}</button>`).join('') + `<button class="gtab ${view === 'col' ? 'on' : ''}" data-v="col">📖 Coleção</button>`;
    let body = '';
    if (view === 'col') body = collectionHtml(g, skinImg);
    else {
      body = `<div class="gban gb-${banner}"><div class="gb-title">${b.icon} Estandarte: ${b.name}</div><div class="gb-desc">${b.desc}</div>
        <div class="gb-rates">${[5, 4, 3, 2, 1].map((t) => `<span style="color:${TIER_INFO[t].color}">${TIER_INFO[t].name} ${[0, 55, 33, 10, 1.8, 0.2][t]}%</span>`).join(' · ')}</div>
        <div class="gb-pity">Épico garantido em <b>${10 - pity.e}</b> giro(s) · Lendário garantido em <b>${80 - pity.l}</b> giro(s)</div></div>`;
      body += `<div class="gbtns">${banner === 'pets' && ga.freeReady() ? '<button class="btn primary" data-pull="free">Giro grátis do dia</button>' : ''}<button class="btn" data-pull="1" ${ga.gems < COST.one ? 'disabled' : ''}>Girar 1× (${COST.one} 💎)</button><button class="btn primary" data-pull="10" ${ga.gems < COST.ten ? 'disabled' : ''}>Girar 10× (${COST.ten} 💎)</button></div>`;
      if (results) body += `<div class="gres ${results.length > 1 ? 'ten' : ''}">${results.map((r, i) => `<div class="gcard t${r.tier}" style="--c:${TIER_INFO[r.tier].color};animation-delay:${i * 0.18}s"><div class="gc-in"><img src="${r.skin ? skinImg(r.skin) : r.img}" alt=""><b>${r.name}</b><small>${r.sub}</small><span class="gc-t">${'★'.repeat(r.tier)}</span></div></div>`).join('')}</div>`;
    }
    el.innerHTML = `<div class="gbox"><div class="ghead"><span>ALTAR DOS CRISTAIS</span><span class="ggems">💎 ${ga.gems} Cristais de Memória</span><button class="gx" data-x="1">✕</button></div>
      <div class="gtabs">${tabs}</div><div class="gbody">${body}</div>
      <div class="gfoot muted">Cristais: chefes de andar (+30 na primeira vitória), Chefes de Campo (+6), baús de ouro (+3), missões diárias (+2), cada nível (+3), andar 100% concluído (+50) e o pacote do Agil.</div></div>`;
  };
  el.onclick = (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    Sfx.click();
    if (t.dataset.x) { close(); return; }
    if (t.dataset.b) { banner = t.dataset.b; view = 'banner'; results = null; }
    else if (t.dataset.v) { view = 'col'; }
    else if (t.dataset.pull) {
      const free = t.dataset.pull === 'free';
      const r = ga.pull(banner, free ? 1 : +t.dataset.pull, free);
      if (r) {
        results = r;
        const best = Math.max(...r.map((x) => x.tier));
        if (best >= 4) { Sfx.victory(); g.ui.banner(best === 5 ? '✦ MÍTICO! ✦' : '★ LENDÁRIO! ★', r.find((x) => x.tier === best).name, 3.5); }
        else if (best === 3) Sfx.levelUp(); else Sfx.coin();
      }
    }
    render();
  };
  render();
}

function collectionHtml(g, skinImg) {
  const p = g.state.player, owned = new Set([g.state.pet, ...(g.state.stable || [])].filter(Boolean).map((x) => x.id || x.mon));
  const pets = Object.values(PETS), skins = Object.values(SKINS), mySk = new Set(p.skins || []);
  const pc = pets.filter((x) => owned.has(x.id)).length, sc = skins.filter((x) => mySk.has(x.id)).length;
  const tile = (have, img, name, tier) => `<div class="gtile ${have ? '' : 'lock'}" style="--c:${TIER_INFO[tier].color}">${have ? `<img src="${img}" alt="">` : '<span class="q">?</span>'}<small>${have ? name : '???'}</small><span class="gc-t">${'★'.repeat(tier)}</span></div>`;
  return `<div class="section">Mascotes — ${pc}/${pets.length}</div><div class="gcol">${pets.map((x) => tile(owned.has(x.id), icon('pet', x.id), x.name, x.tier)).join('')}</div>
    <div class="section">Skins — ${sc}/${skins.length} <span class="muted">(use em Menu → Equipamento)</span></div><div class="gcol">${skins.map((x) => tile(mySk.has(x.id), skinImg(x.id), x.name, x.tier)).join('')}</div>`;
}
