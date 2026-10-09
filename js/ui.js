// Interface no estilo de Aincrad: barra de HP, menu circular, janelas holográficas, rótulos e números de dano.
import * as THREE from 'three';
import { SKILLS, ITEMS, MONSTERS, weaponDef, armorDef, getFloor, expNeed, skillById, shopStock } from './data.js';
import { Sfx } from './audio.js';
import { exportSave, importSave, newSave, loadSave, getRecord } from './save.js';
import { icon } from './icons.js';
import { TOWN_R } from './world.js';
import { registry, displayName } from './models.js';
import { CAST } from './characters.js';
import { FURNITURE } from './housing.js';
import { renderShop, renderParty, runeSlotsHtml, SHOP_INFO } from './shopui.js';
import { runeDef, FOODS } from './data.js';
import { guildRank } from './guild.js';
import { getNpcConfig, setNpc, setGlobal, resetNpc, npcHeight, presence, PRESENCE_IDS, DEFAULT_H } from './npcconfig.js';
import { assignLocal, removeLocal, getLocalMap, setLocalCredit } from './localmodels.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = (s) => `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}min`;
const nf = (n) => Math.round(n).toLocaleString('pt-BR');
const v3 = new THREE.Vector3();

const ICONS = {
  status: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>',
  items: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1.2 13H6.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  equip: '<svg viewBox="0 0 24 24"><path d="M20 2l2 2-11.5 11.5-2-2z"/><path d="M6.5 13.5l4 4-1.5 1.5-1.2-1.2L4 21.6 2.4 20l3.8-3.8L5 15z"/></svg>',
  skills: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/></svg>',
  quests: '<svg viewBox="0 0 24 24"><path d="M6 2h9l4 4v16H6z"/><path d="M9 10h7M9 14h7M9 18h4" stroke="#fff" stroke-width="1.6"/></svg>',
  party: '<svg viewBox="0 0 24 24"><path d="M4 20l7-7M20 20l-7-7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M14.5 3.5L20.5 3.5 20.5 9.5 13 17 7 11z" opacity=".55"/><path d="M9.5 3.5L3.5 3.5 3.5 9.5 11 17 17 11z"/></svg>',
  npcs: '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3.2"/><circle cx="16.5" cy="9" r="2.7"/><path d="M2 20c0-3.6 2.7-6 6-6s6 2.4 6 6z"/><path d="M13.5 20c.2-2.4-.6-4.3-1.9-5.4 1.2-.7 2.6-1 4-.9 3 .2 5.4 2.4 5.4 6.3z"/></svg>',
  system: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="3.4 2.1"/><circle cx="12" cy="12" r="2.6"/></svg>',
};
const MENU = [['status', 'Status'], ['items', 'Mochila'], ['equip', 'Equipamento'], ['skills', 'Skills'], ['quests', 'Missões'], ['party', 'Time'], ['map', 'Mapa'], ['npcs', 'NPCs'], ['system', 'Sistema']];
const TITLES = { status: 'Status', items: 'Mochila', equip: 'Equipamento', skills: 'Sword Skills', map: 'Mapa de Aincrad', system: 'Sistema', shop: 'Loja', npcs: 'NPCs da cidade', quests: 'Missões', party: 'Time' };
const SET_FMT = {
  sens: (v) => (+v).toFixed(2), fov: (v) => `${v}°`, volume: (v) => `${Math.round(v * 100)}%`,
  xpRate: (v) => `${v}×`, music: (v) => `${Math.round(v * 100)}%`, dayMinutes: (v) => `${v} min`,
};

export class UI {
  constructor(game) {
    this.g = game;
    this.menuOpen = false;
    this.panel = null;
    this.shopTab = 'buy';
    this.enemyLabels = new Set();
    this.npcLabels = new Set();
    this.dialogOpen = false;
    this.dlg = null;
    this.worldLabels = [];
    this.dmgs = [];
    this.mm = $('minimap').getContext('2d');
    this.hpLag = 1;
    this.bannerT = 0;
    this.hurtV = 0;
    this.buildSkillbar();
    this.buildMenu();
    this.bindPanel();
    $('clicktoplay').addEventListener('click', () => { Sfx.unlock(); game.input.lock(); });
    $('respawn-btn').addEventListener('click', () => game.respawn());
    $('death-title-btn').addEventListener('click', () => game.logout());
  }

  // ─────────── HUD ───────────
  showHUD(v) { $('hud').classList.toggle('hidden', !v); }

  buildSkillbar() {
    const bar = $('skillbar');
    bar.innerHTML = [0, 1, 2, 3].map((i) => `<div class="slot" id="slot${i}"><span class="key">${i + 1}</span><span class="sname"></span><div class="cd"></div></div>`).join('')
      + '<div class="slot potion" id="slot-pot"><span class="key">R</span><span class="sname">Poção</span><span class="count" id="pot-count">0</span></div>'
      + '<div class="slot tp" id="slot-tp"><span class="key">T</span><span class="sname">Cristal</span><span class="count" id="tp-count">0</span></div>';
  }

  refreshSkillbar() {
    const p = this.g.state.player;
    for (let i = 0; i < 4; i++) {
      const s = p.slots[i] ? skillById(p.slots[i]) : null;
      const el = $(`slot${i}`);
      el.querySelector('.sname').textContent = s ? s.name : '—';
      el.style.setProperty('--sc', s ? s.color : '#888');
      el.classList.toggle('empty', !s);
    }
  }

  update(dt) {
    const g = this.g, p = g.state.player, st = g.stats(), pl = g.player;
    const r = Math.max(0, Math.min(1, p.hp / st.maxHp));
    this.hpLag += (r - this.hpLag) * Math.min(1, dt * (this.hpLag > r ? 1.6 : 8));
    const bar = $('hp-bar');
    bar.style.width = `${(r * 100).toFixed(2)}%`;
    bar.className = `hp-bar${r < 0.25 ? ' low' : r < 0.5 ? ' mid' : ''}`;
    $('hp-lag').style.width = `${(Math.max(r, this.hpLag) * 100).toFixed(2)}%`;
    $('hp-name').textContent = p.name;
    $('hp-text').textContent = `${Math.ceil(p.hp)}/${st.maxHp}`;
    $('lv-text').textContent = `Lv ${p.level}`;
    $('exp-bar').style.width = `${Math.min(100, (p.exp / expNeed(p.level)) * 100).toFixed(1)}%`;
    $('st-bar').style.width = `${pl.stamina.toFixed(1)}%`;
    $('hud-col').textContent = `${nf(p.col)} Col`;
    this.trackT = (this.trackT || 0) - dt;
    if (this.trackT <= 0) {
      this.trackT = 0.4;
      const act = g.quests.activeList().slice(0, 4);
      $('tracker').innerHTML = act.map((x) => { const pr = g.quests.progress(x), ok = pr >= x.count; return `<div class="tq ${ok ? 'ok' : ''}"><b>${x.main ? '★ ' : ''}${esc(x.title)}</b><span>${ok ? (x.giver ? `entregar: ${esc(g.quests.giverName(x.giver))}` : 'concluída') : `${pr}/${x.count}`}</span></div>`; }).join('');
    }
    $('hp-panel').classList.toggle('danger', r < 0.25);

    for (let i = 0; i < 4; i++) {
      const id = p.slots[i], el = $(`slot${i}`);
      const s = id ? skillById(id) : null;
      const cd = s ? g.combat.cd[id] || 0 : 0;
      el.querySelector('.cd').style.setProperty('--p', s && cd > 0 ? (cd / s.cd).toFixed(3) : 0);
      el.classList.toggle('locked', !!s && (p.level < s.lvl || (!!s.dual && !g.combat.dual)));
      el.classList.toggle('ready', !!s && cd <= 0);
    }
    $('pot-count').textContent = (p.items.potion || 0) + (p.items.hipotion || 0);
    $('tp-count').textContent = p.items.teleport_crystal || 0;
    $('slot-tp').classList.toggle('locked', !(p.items.teleport_crystal > 0) && !g.nearGate());

    const boss = g.bossFight?.boss;
    $('boss-bar').classList.toggle('hidden', !boss || boss.dead);
    if (boss && !boss.dead) {
      const per = boss.maxHp / boss.bars;
      const fill = Math.max(0, (boss.hp - (boss.bar - 1) * per) / per);
      $('boss-name').textContent = `${boss.def.name}  ·  Lv ${boss.level}`;
      $('boss-hp-fill').style.width = `${(fill * 100).toFixed(1)}%`;
      $('boss-bars').innerHTML = Array.from({ length: boss.bars }, (_, i) => `<i class="${i < boss.bar ? 'on' : ''}"></i>`).join('');
      $('boss-bar').classList.toggle('enraged', boss.enraged);
    }

    $('safe-tag').classList.toggle('hidden', !g.world.inSafeZone(pl.pos) || pl.dead);
    $('post-motion').classList.toggle('hidden', g.combat.post <= 0);
    const tod = g.tod * 24, hh = Math.floor(tod), mm = Math.floor((tod - hh) * 60);
    $('floor-tag').innerHTML = `${g.state.mode === 'hardcore' ? '<i class="hc-tag">HARDCORE</i>' : ''}<b>Andar ${g.floor.n}</b>${esc(g.floor.town)}<span>${hh >= 6 && hh < 18 ? '☀' : '☾'} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</span>`;

    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) $('banner').classList.remove('show');
    }
    this.hurtV = Math.max(0, this.hurtV - dt * 1.8);
    $('hurt').style.opacity = Math.max(this.hurtV, r < 0.25 ? 0.35 + Math.sin(g.time * 6) * 0.1 : 0).toFixed(3);

    this.updateLabels();
    this.updateDamage(dt);
    this.drawMinimap();
  }

  project(pos) {
    v3.copy(pos).project(this.g.camera);
    if (v3.z > 1 || v3.z < -1) return null;
    return [(v3.x + 1) * 0.5 * innerWidth, (1 - v3.y) * 0.5 * innerHeight];
  }

  createEnemyLabel(e) {
    const el = document.createElement('div');
    el.className = 'elabel';
    el.innerHTML = `<div class="cursor">▼</div><div class="ename">${esc(e.def.name)} <span>Lv ${e.level}</span></div><div class="ehp"><i></i></div>`;
    $('labels').appendChild(el);
    const lab = {
      el, e, fill: el.querySelector('.ehp i'),
      remove: () => { el.remove(); this.enemyLabels.delete(lab); },
    };
    const diff = e.level - (this.g.state?.player.level || 1);
    el.style.setProperty('--nc', diff >= 5 ? '#b0102a' : diff >= 2 ? '#ff3a3a' : diff >= -2 ? '#ff7a6a' : '#ffb8a8');
    this.enemyLabels.add(lab);
    return lab;
  }

  createPetLabel(pet, data) {
    const el = document.createElement('div');
    el.className = 'nlabel pet';
    el.innerHTML = '<div class="cursor">♥</div><div class="nname"></div>';
    $('labels').appendChild(el);
    const lab = { el, pet, data, remove: () => { el.remove(); this.petLabel = null; } };
    this.petLabel = lab;
    return lab;
  }

  createAllyLabel(m) {
    const el = document.createElement('div');
    el.className = 'nlabel ally';
    el.innerHTML = `<div class="cursor">◆</div><div class="nname">${esc(m.name)}</div><div class="ehp"><i></i></div>`;
    $('labels').appendChild(el);
    const lab = { el, m, fill: el.querySelector('.ehp i'), remove: () => el.remove() };
    m.label = lab;
    return lab;
  }

  createNpcLabel(npc) {
    const el = document.createElement('div');
    el.className = `nlabel ${npc.role === 'folk' || npc.role === 'kid' ? 'folk' : 'named'}`;
    el.innerHTML = `<div class="cursor">${npc.role === 'folk' || npc.role === 'kid' ? '▼' : '◆'}</div><div class="nname">${esc(npc.name)}</div>${npc.title ? `<div class="ntitle">${esc(npc.title)}</div>` : ''}`;
    $('labels').appendChild(el);
    const lab = { el, npc, remove: () => { el.remove(); this.npcLabels.delete(lab); } };
    this.npcLabels.add(lab);
    return lab;
  }

  // ─────────── Diálogos com NPCs ───────────
  openDialog(npc) {
    this.dialogOpen = true;
    this.dlgNpc = npc;
    npc.talking = true;
    if (npc.def?.id) this.g.quests.onTalk(npc.def.id);
    this.g.input.unlock();
    Sfx.menuOpen();
    $('dialog').classList.remove('hidden');
    $('dlg-name').textContent = npc.name;
    $('dlg-title').textContent = npc.title || '';
    this.showNode(npc.dialog());
  }

  showNode(node) {
    this.dlg = node;
    this.typed = 0;
    $('dlg-opts').innerHTML = node.options.map((o, i) => `<button class="dlg-opt" data-i="${i}"><span>${i + 1}</span>${esc(o.label)}</button>`).join('');
    $('dlg-opts').classList.add('wait');
    $('dlg-opts').onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) this.chooseOption(+b.dataset.i); };
    $('dlg-text').onclick = () => this.skipTyping();
    clearInterval(this.typeTimer);
    this.typeTimer = setInterval(() => {
      this.typed += 2;
      $('dlg-text').textContent = node.text.slice(0, this.typed);
      if (this.typed >= node.text.length) this.skipTyping();
    }, 16);
  }

  skipTyping() {
    if (!this.dlg) return;
    clearInterval(this.typeTimer);
    $('dlg-text').textContent = this.dlg.text;
    this.typed = this.dlg.text.length;
    $('dlg-opts').classList.remove('wait');
  }

  chooseOption(i) {
    if (!this.dlg) return;
    if (this.typed < this.dlg.text.length) { this.skipTyping(); return; }
    const o = this.dlg.options[i];
    if (!o) return;
    Sfx.click();
    const next = o.run();
    if (next === null) this.closeDialog();
    else if (next) this.showNode(next);
  }

  closeDialog(relock = true) {
    if (!this.dialogOpen) return;
    clearInterval(this.typeTimer);
    this.dialogOpen = false;
    this.dlg = null;
    if (this.dlgNpc) this.dlgNpc.talking = false;
    this.dlgNpc = null;
    $('dialog').classList.add('hidden');
    if (relock && this.g.mode === 'play') this.g.input.lock();
  }

  setWorldLabels(specs) {
    for (const l of this.worldLabels) l.el.remove();
    this.worldLabels = specs.map((s) => {
      const el = document.createElement('div');
      el.className = `wlabel ${s.cls || ''}`;
      el.textContent = s.text;
      $('labels').appendChild(el);
      return { el, pos: s.pos };
    });
  }

  clearEnemyLabels() {
    for (const l of [...this.enemyLabels]) l.remove();
  }

  updateLabels() {
    const cam = this.g.camera.position;
    for (const l of this.enemyLabels) {
      const e = l.e;
      const d = cam.distanceTo(e.pos);
      const p = d < 46 ? this.project(v3.set(e.pos.x, e.pos.y + e.height + (e.flyH ? 0.2 : 0.35), e.pos.z)) : null;
      if (!p) { l.el.style.display = 'none'; continue; }
      l.el.style.display = '';
      l.el.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px) translate(-50%, -100%) scale(${Math.max(0.6, 1 - d / 70).toFixed(3)})`;
      l.fill.style.width = `${((e.hp / e.maxHp) * 100).toFixed(1)}%`;
      l.el.classList.toggle('aggro', e.state === 'chase' || e.state === 'windup' || e.state === 'recover');
    }
    for (const l of this.npcLabels) {
      const n = l.npc;
      const d = cam.distanceTo(n.pos);
      const maxD = n.role === 'folk' || n.role === 'kid' ? 9 : 26;
      const p = d < maxD ? this.project(v3.set(n.pos.x, n.pos.y + n.labelHeight() + 0.15, n.pos.z)) : null;
      if (!p || this.dialogOpen) { l.el.style.display = 'none'; continue; }
      l.el.style.display = '';
      l.el.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px) translate(-50%, -100%) scale(${Math.max(0.6, 1 - d / 40).toFixed(3)})`;
      l.el.classList.toggle('near', d < 2.8);
      const mk = n.def.id ? this.g.quests.marker(n.def.id) : '';
      if (l.mk !== mk) { l.mk = mk; l.el.querySelector('.cursor').textContent = mk === '?' ? '❓' : mk === '!' ? '❗' : (n.role === 'folk' || n.role === 'kid' ? '▼' : '◆'); l.el.classList.toggle('quest', !!mk); }
    }
    if (this.petLabel && this.g.state?.pet) {
      const l = this.petLabel, pt = l.pet, d = cam.distanceTo(pt.pos);
      const p = d < 30 ? this.project(v3.set(pt.pos.x, pt.pos.y + pt.height + 0.25, pt.pos.z)) : null;
      if (!p) l.el.style.display = 'none';
      else {
        l.el.style.display = '';
        l.el.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px) translate(-50%, -100%)`;
        const txt = `${this.g.state.pet.name} · Lv ${this.g.state.pet.level}`;
        if (l.txt !== txt) { l.txt = txt; l.el.querySelector('.nname').textContent = txt; }
      }
    }
    for (const m of this.g.party.members) {
      const l = m.label;
      if (!l) continue;
      const d = cam.distanceTo(m.pos);
      const p = m.alive && !this.g.indoor && d < 40 ? this.project(v3.set(m.pos.x, m.pos.y + 2.05, m.pos.z)) : null;
      if (!p || this.dialogOpen) { l.el.style.display = 'none'; continue; }
      l.el.style.display = '';
      l.el.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px) translate(-50%, -100%) scale(${Math.max(0.6, 1 - d / 50).toFixed(3)})`;
      l.fill.style.width = `${((m.hp / m.maxHp) * 100).toFixed(1)}%`;
    }
    for (const l of this.worldLabels) {
      const d = cam.distanceTo(l.pos);
      const p = d < 90 ? this.project(l.pos) : null;
      if (!p) { l.el.style.display = 'none'; continue; }
      l.el.style.display = '';
      l.el.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px) translate(-50%, -100%) scale(${Math.max(0.55, 1 - d / 120).toFixed(3)})`;
    }
  }

  damageNumber(pos, text, cls = '') {
    const el = document.createElement('div');
    el.className = `dmgn ${cls}`;
    el.textContent = text;
    $('dmg').appendChild(el);
    this.dmgs.push({ el, pos: pos.clone(), t: 0, dx: (Math.random() - 0.5) * 30 });
    if (this.dmgs.length > 40) { this.dmgs[0].el.remove(); this.dmgs.shift(); }
  }

  updateDamage(dt) {
    for (let i = this.dmgs.length - 1; i >= 0; i--) {
      const d = this.dmgs[i];
      d.t += dt;
      d.pos.y += dt * 1.1;
      const p = this.project(d.pos);
      if (d.t > 0.9 || !p) { d.el.remove(); this.dmgs.splice(i, 1); continue; }
      const pop = d.t < 0.08 ? 1.5 - d.t * 6 : 1;
      d.el.style.transform = `translate(${(p[0] + d.dx * d.t).toFixed(1)}px, ${p[1].toFixed(1)}px) translate(-50%, -50%) scale(${pop.toFixed(2)})`;
      d.el.style.opacity = (1 - Math.max(0, d.t - 0.5) / 0.4).toFixed(2);
    }
  }

  hurt(frac) { this.hurtV = Math.min(0.9, this.hurtV + 0.25 + frac * 2); }

  hint(text) {
    const el = $('hint');
    if (!text) { el.classList.add('hidden'); return; }
    if (el.textContent !== text) el.textContent = text;
    el.classList.remove('hidden');
  }

  banner(title, sub = '', dur = 3) {
    const b = $('banner');
    b.querySelector('.b-title').textContent = title;
    b.querySelector('.b-sub').textContent = sub;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    this.bannerT = dur;
  }

  toast(text, cls = '') {
    const el = document.createElement('div');
    el.className = `toast ${cls}`;
    el.textContent = text;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 6) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 3800);
    setTimeout(() => el.remove(), 4400);
  }

  skillName(def) {
    const el = $('skillname');
    el.textContent = def.name;
    el.style.color = def.color;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  showDecorBar(on, sel) {
    let bar = $('decorbar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'decorbar'; $('hud').appendChild(bar); }
    bar.classList.toggle('hidden', !on);
    $('skillbar').classList.toggle('hidden', on);
    if (!on) return;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
    bar.innerHTML = `<div class="db-title">Modo decoração <span>Clique: colocar · R: girar · Botão direito/X: remover (+50%) · G: sair</span></div><div class="db-items">${FURNITURE.map((f, i) => `<div class="db-it ${i === sel ? 'on' : ''}"><span class="key">${keys[i]}</span><b>${f.name}</b><span class="pr">${f.price} Col</span></div>`).join('')}</div>`;
  }

  setClickToPlay(v) { $('clicktoplay').classList.toggle('hidden', !v); }

  showLoading(title, sub) {
    const el = $('loading'), fill = $('ld-fill');
    const tips = ['Dica: segure o botão direito no instante do golpe para aparar (parry).', 'Dica: baús escondidos pelos campos guardam Col, runas e até equipamentos raros.',
      'Dica: na Taverna você ouve boatos sobre baús e pode contratar companheiros.', 'Dica: a Guilda dos Aventureiros tem contratos novos todo dia.',
      'Dica: runas da Loja de Runas dão bônus permanentes enquanto equipadas.', 'Dica: pelo Portal você pode se teletransportar para qualquer ponto da cidade.',
      'Dica: a esquiva (Q) deixa você invencível por um instante.', 'Dica: pesque no lago perto da cidade e peça para a Asuna grelhar os peixes.'];
    $('ld-title').textContent = title;
    $('ld-sub').textContent = sub || '';
    $('ld-tip').textContent = tips[Math.floor(Math.random() * tips.length)];
    fill.style.width = '0%';
    el.classList.remove('hidden', 'out');
    return {
      set: (p) => { fill.style.width = `${Math.round(p * 100)}%`; },
      done: () => { fill.style.width = '100%'; el.classList.add('out'); setTimeout(() => el.classList.add('hidden'), 460); },
    };
  }

  fade(cb) {
    const f = $('fade');
    f.classList.add('on');
    setTimeout(() => { cb(); setTimeout(() => f.classList.remove('on'), 150); }, 650);
  }

  showDeath(hc, state, cause) {
    const p = state?.player;
    $('death').classList.toggle('hardcore', !!hc);
    if (hc) {
      const r = hc.record;
      $('death-title').textContent = 'GAME OVER';
      $('death-sub').textContent = `${p.name} foi derrotado${cause ? ` por ${cause}` : ''}. No Hardcore não existe segunda chance: este mundo foi apagado.`;
      $('death-stats').innerHTML = `<div class="dstats"><div><b>${state.progress.highest}</b><span>maior andar</span></div><div><b>${p.level}</b><span>nível</span></div><div><b>${p.kills}</b><span>monstros</span></div><div><b>${fmtTime(state.playTime)}</b><span>de sobrevivência</span></div></div>
        <div class="muted-light">Recorde: andar ${r.bestFloor} · nível ${r.bestLevel} · ${r.runs} tentativa${r.runs > 1 ? 's' : ''}</div>`;
      $('respawn-btn').textContent = 'Recomeçar do zero';
      $('death-title-btn').classList.remove('hidden');
    } else {
      $('death-title').textContent = 'You are dead';
      $('death-sub').textContent = 'Seu avatar se desfez em polígonos... mas este é o seu mundo. Aqui você pode tentar de novo.';
      $('death-stats').innerHTML = '';
      $('respawn-btn').textContent = 'Renascer na cidade';
      $('death-title-btn').classList.add('hidden');
    }
    $('death').classList.remove('hidden');
  }
  hideDeath() { $('death').classList.add('hidden'); }

  // ─────────── Minimapa ───────────
  drawMinimap() {
    const c = this.mm, W = 180, S = W / 2, scale = S / 90;
    const g = this.g, w = g.world, p = g.player.pos, yaw = g.player.yaw;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const tr = (x, z) => { const dx = x - p.x, dz = z - p.z; return [S + (dx * cs - dz * sn) * scale, S + (dx * sn + dz * cs) * scale]; };
    const clampEdge = ([x, y], m = 8) => {
      const dx = x - S, dy = y - S, d = Math.hypot(dx, dy), max = S - m;
      return d > max ? [S + (dx / d) * max, S + (dy / d) * max, true] : [x, y, false];
    };
    c.clearRect(0, 0, W, W);
    c.save();
    c.beginPath(); c.arc(S, S, S - 2, 0, Math.PI * 2); c.clip();
    c.fillStyle = 'rgba(14,20,28,0.72)';
    c.fillRect(0, 0, W, W);
    let [x, y] = tr(0, 0);
    c.strokeStyle = 'rgba(255,255,255,0.25)';
    c.lineWidth = 1;
    c.beginPath(); c.arc(x, y, 230 * scale, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(160,200,255,0.12)';
    c.beginPath(); c.arc(x, y, TOWN_R * scale, 0, Math.PI * 2); c.fill();
    const [ax, ay] = tr(w.arenaPos.x, w.arenaPos.z);
    c.strokeStyle = 'rgba(210,190,150,0.35)';
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(x, y); c.lineTo(ax, ay); c.stroke();
    const cleared = g.state.progress.cleared[g.floor.n];
    c.strokeStyle = cleared ? '#4fc3ff' : '#ff5a5a';
    c.lineWidth = 2;
    c.beginPath(); c.arc(ax, ay, 24 * scale, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.8)';
    for (const e of g.enemies.list) {
      if (e.dead) continue;
      const [ex, ey] = tr(e.pos.x, e.pos.z);
      c.fillStyle = e.boss ? '#ff2a2a' : e.state === 'chase' ? '#ff6a4a' : '#d86a5a';
      c.beginPath(); c.arc(ex, ey, e.boss ? 5 : 2.4, 0, Math.PI * 2); c.fill();
    }
    const dot = (wx, wz, col, r, edge) => {
      let q = tr(wx, wz);
      if (edge) q = clampEdge(q);
      c.fillStyle = col;
      c.beginPath(); c.arc(q[0], q[1], r, 0, Math.PI * 2); c.fill();
    };
    for (const n of g.npcs.list) { const [nx2, ny2] = tr(n.pos.x, n.pos.z); c.fillStyle = n.role === 'folk' || n.role === 'kid' ? '#7adf8a' : '#ffd54f'; c.beginPath(); c.arc(nx2, ny2, n.role === 'folk' || n.role === 'kid' ? 1.8 : 2.8, 0, Math.PI * 2); c.fill(); }
    dot(w.gatePos.x, w.gatePos.z, '#4fc3ff', 4, true);
    for (const sp of Object.values(w.shopSpots || {})) dot(sp.pos.x, sp.pos.z, '#ffb84a', 2.6);
    for (const ch of g.loot.revealed()) dot(ch.pos.x, ch.pos.z, '#ffe066', 3.4, true);
    for (const m of g.party.members) if (m.alive) dot(m.pos.x, m.pos.z, '#7ad8ff', 2.6);
    if (g.state.house && g.state.house.floor === g.floor.n) {
      let q = clampEdge(tr(w.housePlaque.x, w.housePlaque.z));
      c.fillStyle = '#ff8ac8';
      c.beginPath(); c.moveTo(q[0], q[1] - 6); c.lineTo(q[0] + 5.5, q[1] - 1); c.lineTo(q[0] + 4, q[1] - 1); c.lineTo(q[0] + 4, q[1] + 4.5); c.lineTo(q[0] - 4, q[1] + 4.5); c.lineTo(q[0] - 4, q[1] - 1); c.lineTo(q[0] - 5.5, q[1] - 1); c.closePath(); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke();
    }
    if (w.boardPos) dot(w.boardPos.x, w.boardPos.z, '#ffd54f', 2.6);
    for (const m of g.quests.markers) dot(m.pos.x, m.pos.z, m.elite ? '#ff5a4a' : m.flower ? '#ffffff' : '#7ad0ff', 3.5, true);
    dot(w.doorPos.x, w.doorPos.z, cleared ? '#4fc3ff' : '#b07aff', 4, true);
    const [nx, ny] = clampEdge(tr(p.x, p.z - 500), 10);
    c.fillStyle = '#fff';
    c.font = 'bold 11px "Exo 2", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('N', nx, ny);
    c.restore();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(S, S - 7); c.lineTo(S + 5, S + 5); c.lineTo(S, S + 2); c.lineTo(S - 5, S + 5); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(S, S, S - 2, 0, Math.PI * 2); c.stroke();
  }

  // ─────────── Menu principal ───────────
  buildMenu() {
    $('menu-icons').innerHTML = MENU.map(([id, label]) => `<button class="micon" data-panel="${id}" title="${label}">${ICONS[id]}<span>${label}</span></button>`).join('');
    $('menu-icons').addEventListener('click', (e) => {
      const b = e.target.closest('[data-panel]');
      if (!b) return;
      Sfx.click();
      this.setPanel(b.dataset.panel);
    });
    $('menu').addEventListener('mousedown', (e) => { if (e.target.id === 'menu') this.closeMenu(); });
  }

  openShop(id, tab = 'buy') {
    this.shopId = id;
    this.shopTab = tab;
    this.openMenu('shop');
  }

  openMenu(panel = 'status') {
    if (!this.menuOpen) Sfx.menuOpen();
    this.menuOpen = true;
    $('menu').classList.remove('hidden');
    this.g.input.unlock();
    this.setPanel(panel);
  }

  closeMenu(relock = true) {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    $('menu').classList.add('hidden');
    Sfx.menuClose();
    if (relock && this.g.mode === 'play') this.g.input.lock();
  }

  setPanel(id) {
    this.panel = id;
    document.querySelectorAll('.micon').forEach((b) => b.classList.toggle('on', b.dataset.panel === id));
    $('mp-title').textContent = id === 'shop' ? SHOP_INFO[this.shopId || 'agil'].title : TITLES[id] || id;
    this.renderPanel();
  }

  renderPanel() {
    if (!this.menuOpen) return;
    const fn = { status: this.pStatus, items: this.pItems, equip: this.pEquip, skills: this.pSkills, map: this.pMap, system: this.pSystem, shop: () => renderShop(this), npcs: this.pNpcs, quests: this.pQuests, party: () => renderParty(this) }[this.panel];
    const body = $('mp-body');
    const scroll = body.scrollTop;
    body.innerHTML = fn ? fn.call(this) : '';
    body.scrollTop = scroll;
    if (this.panel === 'map') this.drawFloorMap();
  }

  pStatus() {
    const g = this.g, p = g.state.player, st = g.stats(), pr = g.state.progress, need = expNeed(p.level);
    const statRow = (k, label, desc) => `<div class="row"><div><b>${label}</b> <span class="muted">${desc}</span></div><div class="row-r"><span class="num">${p[k]}</span>${p.points > 0 ? `<button class="btn sm" data-act="stat" data-k="${k}">+</button>` : ''}</div></div>`;
    return `
      <div class="hero"><div class="hero-name">${esc(p.name)}</div><div class="hero-lv">Nível ${p.level}</div></div>
      <div class="bar-line"><span>EXP</span><div class="pbar"><i style="width:${Math.min(100, (p.exp / need) * 100).toFixed(1)}%"></i></div><span class="muted">${nf(p.exp)} / ${nf(need)}</span></div>
      <div class="grid2">
        <span>HP</span><b>${Math.ceil(p.hp)} / ${st.maxHp}</b>
        <span>Ataque</span><b>${Math.round(st.atkR)}${st.dual ? ` / ${Math.round(st.atkL)}` : ''}</b>
        <span class="muted">↳ ${esc(g.weaponLabel(p.weapon))} ${g.weaponAtk(p.weapon)} × STR +${p.str * 3}% + nível ${Math.round(p.level * 1.5 + p.str)}</span><span></span>
        <span>Defesa</span><b>${st.def.toFixed(1)}</b>
        <span>Crítico</span><b>${(st.crit * 100).toFixed(1)}%</b>
        <span>Velocidade</span><b>${Math.round(st.speedMul * 100)}%</b>
        <span>Col</span><b>${nf(p.col)}</b>
        <span>Andar atual / maior</span><b>${pr.floor} / ${pr.highest}</b>
        <span>Monstros derrotados</span><b>${nf(p.kills)}</b>
        <span>Mortes</span><b>${p.deaths}</b>
        <span>Tempo de jogo</span><b>${fmtTime(g.state.playTime)}</b>
      </div>
      <div class="section">Pontos de atributo: <b class="accent">${p.points}</b></div>
      ${statRow('str', 'STR', '+3% de dano da arma por ponto')}${statRow('agi', 'AGI', '+0,8% crítico, +0,6% velocidade, −1% recarga das skills')}${statRow('vit', 'VIT', '+2% HP máximo, +10 HP e defesa')}
      ${p.dualBlades ? '<div class="unique">Habilidade Única: <b>Dual Blades</b></div>' : ''}
      ${p.food && p.food.until > g.state.playTime ? `<div class="unique">Refeição da taverna: <b>${esc(FOODS[p.food.id].name)}</b> — ${esc(FOODS[p.food.id].desc)} (mais ${Math.ceil((p.food.until - g.state.playTime) / 60)} min)</div>` : ''}
      ${g.state.guild ? (() => { const r = guildRank(g.state.guild); return `<div class="unique">Guilda: <b>${esc(g.state.guild.name)}</b> · posto <b>${r.letter}</b> (${g.state.guild.pts} pts${r.next ? ` / ${r.next.pts} para ${r.next.letter}` : ''}) · +${Math.round(r.exp * 100)}% EXP · −${Math.round(r.discount * 100)}% nas lojas</div>`; })() : ''}
      ${g.state.pet ? `<div class="section">Mascote</div><div class="row"><div class="withicon"><b>♥ ${esc(g.state.pet.name)}</b> <span class="muted">${esc(MONSTERS[g.state.pet.mon]?.name || '')} · nível ${g.state.pet.level} · ataca junto com você e cura quando seu HP está baixo</span></div><div class="row-r"><button class="btn sm" data-act="petName">Renomear</button><button class="btn sm" data-act="petFree">Libertar</button></div></div>` : '<div class="muted pad">Sem mascote. Procure monstros dóceis (♥ rosa) e ofereça um Petisco de Domador.</div>'}`;
  }

  pItems() {
    const g = this.g, p = g.state.player, st = g.stats();
    const cat = this.bagCat || 'all';
    const tiles = [];
    const seen = new Set();
    for (const id of p.weapons) {
      if (seen.has(`w${id}`)) continue;
      seen.add(`w${id}`);
      const d = weaponDef(id), count = p.weapons.filter((x) => x === id).length;
      tiles.push({ cat: 'weapon', kind: 'weapon', id, name: g.weaponLabel(id), rarity: d.rarity, qty: count > 1 ? count : 0, eq: id === p.weapon ? 'D' : id === p.offhand ? 'E' : '' });
    }
    for (const id of [...new Set(p.armors)]) {
      const d = armorDef(id);
      tiles.push({ cat: 'armor', kind: 'armor', id, name: d.name, rarity: d.rarity, eq: id === p.armor ? '✓' : '' });
    }
    for (const [id, q] of Object.entries(p.items)) if (q > 0 && ITEMS[id]) tiles.push({ cat: 'item', kind: 'item', id, name: ITEMS[id].name, rarity: 1, qty: q });
    for (const [id, q] of Object.entries(p.runes || {})) if (q > 0 && runeDef(id)) tiles.push({ cat: 'item', kind: 'rune', id, name: runeDef(id).name, rarity: runeDef(id).rarity, qty: q });
    for (const [name, m] of Object.entries(p.mats)) if (m.qty > 0) tiles.push({ cat: 'mat', kind: 'mat', id: name, name, rarity: 0, qty: m.qty });
    const shown = tiles.filter((t) => cat === 'all' || t.cat === cat);
    const tab = (k, l) => `<button class="tab ${cat === k ? 'on' : ''}" data-act="bagCat" data-c="${k}">${l}</button>`;
    let html = `<div class="colcard"><img src="${icon('mat', 'Moedas de Col')}" alt=""><div><span class="muted">Seu dinheiro</span><b>${nf(p.col)} Col</b></div></div><div class="tabs">${tab('all', 'Tudo')}${tab('weapon', 'Armas')}${tab('armor', 'Armaduras')}${tab('item', 'Consumíveis')}${tab('mat', 'Materiais')}<span class="col">${nf(p.col)} Col</span></div>`;
    if (this.detail) html += this.detailCard(this.detail, st);
    html += shown.length
      ? `<div class="bag">${shown.map((t) => `<button class="tile r${t.rarity} ${this.detail && this.detail.id === t.id && this.detail.kind === t.kind ? 'sel' : ''}" data-act="detail" data-kind="${t.kind}" data-id="${esc(t.id)}" title="${esc(t.name)}">
          <img src="${icon(t.kind, t.id)}" alt="">${t.qty ? `<span class="tq">×${t.qty}</span>` : ''}${t.eq ? `<span class="te">${t.eq}</span>` : ''}<span class="tn">${esc(t.name)}</span></button>`).join('')}</div>`
      : '<div class="muted pad">Nada aqui ainda. Derrote monstros e visite o Agil!</div>';
    html += '<div class="muted pad">Clique num item para ver detalhes. <b>R</b> bebe uma poção. D/E = mão direita/esquerda.</div>';
    return html;
  }

  detailCard({ kind, id }, st) {
    const p = this.g.state.player;
    let title = '', lines = [], acts = '', rar = 0;
    if (kind === 'weapon') {
      const d = weaponDef(id), up = p.upgrades?.[id] || 0;
      title = `${d.name}${up ? ` +${up}` : ''}`; rar = d.rarity;
      const styles = { basic: 'Espada curta', long: 'Espada longa', broad: 'Espada larga', rapier: 'Rapieira', katana: 'Katana', dark: 'Lâmina sombria', crystal: 'Lâmina de cristal', ornate: 'Espada ornamentada', holy: 'Espada sagrada' };
      lines = [`${styles[d.style] || 'Espada'} · ATK ${this.g.weaponAtk(id)}${up ? ` (base ${d.atk}, +${up * 10}% pela Lisbeth)` : ''}`, d.floor ? `Origem: Andar ${d.floor}${d.rarity === 2 ? ' — item raro' : ''}` : 'Arma inicial'];
      if (id !== p.weapon) acts += `<button class="btn sm" data-act="equipW" data-id="${id}">Equipar (mão direita)</button>`;
      if (p.dualBlades && id !== p.weapon && id !== p.offhand) acts += `<button class="btn sm" data-act="equipL" data-id="${id}">Mão esquerda</button>`;
    } else if (kind === 'armor') {
      const d = armorDef(id);
      title = d.name; rar = d.rarity;
      lines = [`DEF ${d.def} · HP +${d.hp}`, d.floor ? `Origem: Andar ${d.floor}${d.rarity === 2 ? ' — item raro' : ''}` : 'Equipamento inicial'];
      if (id !== p.armor) acts += `<button class="btn sm" data-act="equipA" data-id="${id}">Equipar</button>`;
    } else if (kind === 'rune') {
      const d = runeDef(id);
      title = d.name; rar = d.rarity;
      lines = [d.desc, `Você tem ${p.runes?.[id] || 0} · equipe em Menu → Equipamento`];
      acts += `<button class="btn sm" data-act="runeOn" data-id="${id}">Equipar</button>`;
    } else if (kind === 'item') {
      const d = ITEMS[id];
      title = d.name; rar = 1;
      lines = [d.desc, `Você tem ${p.items[id] || 0}`];
      acts += `<button class="btn sm" data-act="use" data-id="${id}">Usar</button>`;
    } else {
      const m = p.mats[id];
      title = id;
      lines = ['Material de monstro. Venda ao Agil ou guarde para o futuro.', `×${m?.qty || 0} · ${m?.value || 0} Col cada`];
    }
    return `<div class="detail r${rar}"><img src="${icon(kind, id)}" alt=""><div class="dinfo"><div class="dtitle"><span class="rar r${rar}">◆</span> ${esc(title)}</div>${lines.map((l) => `<div class="muted">${esc(l)}</div>`).join('')}<div class="btns">${acts}<button class="btn sm" data-act="closeDetail">Fechar</button></div></div></div>`;
  }

  pEquip() {
    const p = this.g.state.player;
    const w = weaponDef(p.weapon), o = p.offhand ? weaponDef(p.offhand) : null, a = armorDef(p.armor);
    const seen = new Set();
    const weapons = p.weapons.filter((id) => !seen.has(id) && seen.add(id)).map((id) => {
      const d = weaponDef(id), eqR = id === p.weapon, eqL = id === p.offhand;
      const main = eqR ? '<span class="tag">Principal</span>' : `<button class="btn sm" data-act="equipW" data-id="${id}">Equipar</button>`;
      const off = p.dualBlades && !eqR ? (eqL ? '<button class="btn sm on" data-act="unequipL">Secundária ✕</button>' : `<button class="btn sm" data-act="equipL" data-id="${id}">Secundária</button>`) : '';
      return `<div class="row ${eqR || eqL ? 'eq' : ''}"><div class="withicon"><img class="ico" src="${icon('weapon', id)}" alt=""><span class="rar r${d.rarity}">◆</span> <b>${esc(this.g.weaponLabel(id))}</b> <span class="muted">ATK ${this.g.weaponAtk(id)}</span></div><div class="row-r">${main}${off}</div></div>`;
    }).join('');
    seen.clear();
    const armors = p.armors.filter((id) => !seen.has(id) && seen.add(id)).map((id) => {
      const d = armorDef(id), eq = id === p.armor;
      return `<div class="row ${eq ? 'eq' : ''}"><div class="withicon"><img class="ico" src="${icon('armor', id)}" alt=""><span class="rar r${d.rarity}">◆</span> <b>${esc(d.name)}</b> <span class="muted">DEF ${d.def} · HP +${d.hp}</span></div>${eq ? '<span class="tag">Equipada</span>' : `<button class="btn sm" data-act="equipA" data-id="${id}">Equipar</button>`}</div>`;
    }).join('');
    return `<div class="equip-sum">
        <div><span class="muted">Mão direita</span><b>${esc(this.g.weaponLabel(p.weapon))}</b><span>ATK ${this.g.weaponAtk(p.weapon)}</span></div>
        ${p.dualBlades ? `<div><span class="muted">Mão esquerda</span><b>${o ? esc(this.g.weaponLabel(p.offhand)) : '—'}</b><span>${o ? `ATK ${this.g.weaponAtk(p.offhand)}` : 'vazia'}</span></div>` : ''}
        <div><span class="muted">Armadura</span><b>${esc(a.name)}</b><span>DEF ${a.def} · HP +${a.hp}</span></div>
      </div>
      ${runeSlotsHtml(this.g)}
      <div class="section">Armas</div>${weapons}
      <div class="section">Armaduras</div>${armors}`;
  }

  pSkills() {
    const p = this.g.state.player;
    const slots = p.slots.map((id, i) => `<div class="sslot"><span class="key">${i + 1}</span>${id ? `<b style="color:${skillById(id).color}">${esc(skillById(id).name)}</b><button class="x" data-act="unslot" data-i="${i}">✕</button>` : '<span class="muted">vazio</span>'}</div>`).join('');
    const list = SKILLS.map((s) => {
      const ok = p.level >= s.lvl && (!s.dual || p.dualBlades);
      const hits = s.moves.length;
      const right = ok
        ? [0, 1, 2, 3].map((i) => `<button class="btn sm ${p.slots[i] === s.id ? 'on' : ''}" data-act="slot" data-id="${s.id}" data-i="${i}">${i + 1}</button>`).join('')
        : `<span class="tag">${s.dual && !p.dualBlades ? 'Dual Blades' : `Nv ${s.lvl}`}</span>`;
      return `<div class="row skill ${ok ? '' : 'locked'}"><div><b style="color:${s.color}">●</b> <b>${s.name}</b> <span class="muted">${hits} golpe${hits > 1 ? 's' : ''} · recarga ${s.cd}s · Nv ${s.lvl}</span><div class="muted">${s.desc}</div></div><div class="row-r">${right}</div></div>`;
    }).join('');
    return `<div class="section">Atalhos (teclas 1–4)</div><div class="sslots">${slots}</div>
      <div class="section">Sword Skills</div>${list}
      <div class="muted pad">Após uma Sword Skill há um breve <b>post-motion delay</b>, em que você fica imóvel. Escolha bem o momento!</div>`;
  }

  pMap() {
    const g = this.g, pr = g.state.progress, p = g.state.player;
    const atGate = g.nearGate(), crystals = p.items.teleport_crystal || 0, can = atGate || crystals > 0;
    let rows = '';
    for (let n = pr.highest; n >= 1; n--) {
      const f = getFloor(n), cur = n === pr.floor;
      rows += `<div class="row ${cur ? 'eq' : ''}"><div><b>Andar ${n}</b> — ${esc(f.town)} <span class="muted">${esc(f.desc)}</span>${pr.cleared[n] ? ' <span class="tag ok">Concluído</span>' : ''}</div><div class="row-r">${cur ? '<span class="tag">Você está aqui</span>' : `<button class="btn sm" data-act="travel" data-n="${n}" ${can ? '' : 'disabled'}>Teleportar</button>`}</div></div>`;
    }
    const msg = atGate ? 'Você está no Portal de Teletransporte. Escolha um destino.'
      : crystals ? `Viajar consumirá 1 Cristal de Teletransporte (você tem ${crystals}).`
        : 'Vá até o Portal no centro da cidade ou compre um Cristal de Teletransporte com o Agil.';
    const w = g.world, inTown = w.inSafeZone(g.player.pos) || atGate;
    const house = g.state.house;
    const tp = w.townPoints().filter((x) => x.id !== 'house' || (house && house.floor === g.floor.n)).map((x) => `<button class="tpbtn" data-act="townTp" data-id="${x.id}" ${inTown || crystals ? '' : 'disabled'}>${esc(x.id === 'house' ? '🏠 Minha casa' : x.name)}</button>`).join('');
    return `<div class="mapwrap"><canvas id="floormap" width="420" height="420"></canvas>
        <div class="maplegend"><span style="--c:#4fc3ff">Portal</span><span style="--c:#ffd54f">Personagens</span><span style="--c:#ffb84a">Lojas</span><span style="--c:#ff8ac8">Sua casa</span><span style="--c:#7ad0ff">Missões</span><span style="--c:#ff5a4a">Elite/chefe</span><span style="--c:#ffe066">Baú (boato)</span><span style="--c:#3fb0d8">Lago</span></div></div>
      <div class="section">Teletransporte na cidade — Andar ${g.floor.n}</div>
      <div class="muted pad">${inTown ? 'Grátis dentro da cidade.' : crystals ? 'Fora da cidade: gasta 1 Cristal de Teletransporte.' : 'Fora da cidade você precisa de um Cristal de Teletransporte.'}${house ? ` Sua casa fica no Andar ${house.floor}.` : ''}</div>
      <div class="tpgrid">${tp}</div>
      <div class="section">Andares</div><div class="muted pad">${msg}</div>${rows}<div class="muted pad">Para liberar um andar novo, derrote o chefe na arena e entre pela porta do Labirinto.</div>`;
  }

  // Mapa do andar inteiro (norte para cima), desenhado no painel Mapa
  drawFloorMap() {
    const cv = $('floormap');
    if (!cv) return;
    const c = cv.getContext('2d'), W = cv.width, S = W / 2, k = (S - 8) / 232, g = this.g, w = g.world;
    const tr = (x, z) => [S + x * k, S + z * k];
    c.clearRect(0, 0, W, W);
    c.fillStyle = '#16202c';
    c.beginPath(); c.arc(S, S, S - 2, 0, Math.PI * 2); c.fill();
    const gr = c.createRadialGradient(S, S, 0, S, S, S);
    gr.addColorStop(0, '#3e5a3a'); gr.addColorStop(1, '#253826');
    c.fillStyle = gr;
    c.beginPath(); c.arc(S, S, 230 * k, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(214,190,140,0.55)'; c.lineWidth = 3;
    for (const sp of w.spokes) { c.beginPath(); c.moveTo(S, S); const [x, y] = tr(sp.dx * sp.len, sp.dz * sp.len); c.lineTo(x, y); c.stroke(); }
    c.fillStyle = 'rgba(200,190,170,0.75)';
    c.beginPath(); c.arc(S, S, TOWN_R * k, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#8a8070'; c.lineWidth = 2; c.stroke();
    if (w.pond) { const [x, y] = tr(w.pond.x, w.pond.z); c.fillStyle = '#3fb0d8'; c.beginPath(); c.arc(x, y, w.pond.r * k, 0, Math.PI * 2); c.fill(); }
    const [ax, ay] = tr(w.arenaPos.x, w.arenaPos.z);
    c.strokeStyle = g.state.progress.cleared[g.floor.n] ? '#4fc3ff' : '#ff5a5a'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(ax, ay, 24 * k, 0, Math.PI * 2); c.stroke();
    const [tx, ty] = tr(w.towerPos.x, w.towerPos.z);
    c.fillStyle = '#8c8a86'; c.beginPath(); c.arc(tx, ty, 25 * k, 0, Math.PI * 2); c.fill();
    const dot = (x, z, col, r) => { const [px, py] = tr(x, z); c.fillStyle = col; c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill(); };
    dot(0, 0, '#4fc3ff', 4.5);
    for (const sp of Object.values(w.shopSpots || {})) dot(sp.pos.x, sp.pos.z, '#ffb84a', 3);
    for (const n of g.npcs.list) if (n.role !== 'folk' && n.role !== 'kid') dot(n.pos.x, n.pos.z, '#ffd54f', 2.4);
    for (const m of g.quests.markers) dot(m.pos.x, m.pos.z, m.elite ? '#ff5a4a' : m.flower ? '#ffffff' : '#7ad0ff', 3.4);
    for (const ch of g.loot.revealed()) dot(ch.pos.x, ch.pos.z, '#ffe066', 4);
    if (g.state.house?.floor === g.floor.n) {
      const [hx, hy] = tr(w.housePlaque.x, w.housePlaque.z);
      c.fillStyle = '#ff8ac8';
      c.beginPath(); c.moveTo(hx, hy - 8); c.lineTo(hx + 7, hy - 1); c.lineTo(hx + 5, hy - 1); c.lineTo(hx + 5, hy + 6); c.lineTo(hx - 5, hy + 6); c.lineTo(hx - 5, hy - 1); c.lineTo(hx - 7, hy - 1); c.closePath(); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.stroke();
    }
    // jogador (seta)
    const pl = g.player, [px, py] = tr(pl.pos.x, pl.pos.z);
    c.save(); c.translate(px, py); c.rotate(-pl.yaw);
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 6); c.lineTo(0, 3); c.lineTo(-6, 6); c.closePath(); c.fill();
    c.restore();
    c.fillStyle = '#fff'; c.font = 'bold 13px "Exo 2", sans-serif'; c.textAlign = 'center';
    c.fillText('N', S, 16);
  }

  pSystem() {
    const s = this.g.state.settings;
    const range = (k, label, min, max, step) => `<div class="row"><span>${label}</span><div class="row-r"><input type="range" min="${min}" max="${max}" step="${step}" value="${s[k]}" data-set="${k}"><span class="num" id="set-${k}">${SET_FMT[k](s[k])}</span></div></div>`;
    const check = (k, label) => `<div class="row"><span>${label}</span><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}></div>`;
    return `<div class="section">Configurações</div>
      ${range('sens', 'Sensibilidade do mouse', 0.2, 3, 0.05)}
      ${range('fov', 'Campo de visão', 60, 100, 1)}
      ${range('volume', 'Volume dos efeitos', 0, 1, 0.05)}
      ${range('music', 'Volume da música', 0, 1, 0.05)}
      ${range('xpRate', 'Taxa de EXP (seu mundo, suas regras)', 1, 10, 1)}
      ${range('dayMinutes', 'Duração do dia', 2, 60, 1)}
      ${check('invertY', 'Inverter eixo Y')}${check('bloom', 'Brilho (bloom)')}${check('shadows', 'Sombras')}${check('grass', 'Grama (desligue se o PC estiver lento)')}${check('autoSheath', 'Guardar a espada automaticamente na cidade')}
      <div class="section">Mundo</div>
      ${this.g.state.mode === 'hardcore'
        ? '<div class="unique hc">Modo <b>Hardcore</b>: a morte é permanente. Exportar e importar ficam desativados neste mundo.</div><div class="btns"><button class="btn" data-act="save">Salvar agora</button><button class="btn" data-act="logout">Logout</button><button class="btn danger" data-act="wipe">Desistir (apagar este mundo)</button></div>'
        : '<div class="btns"><button class="btn" data-act="save">Salvar agora</button><button class="btn" data-act="export">Exportar mundo (.json)</button><button class="btn" data-act="import">Importar mundo</button></div><div class="btns"><button class="btn" data-act="logout">Logout</button><button class="btn danger" data-act="wipe">Apagar save</button></div>'}
      <div class="muted pad">O jogo salva sozinho a cada 30s e em momentos importantes. Exporte de vez em quando como backup.</div>
      <div class="section">Modelos 3D</div>
      <div class="muted pad">Modelos, altura e presença de cada personagem ficam em <b>Menu → NPCs</b>.</div>
      ${Object.keys(registry.credits).length ? `<div class="section">Créditos dos modelos 3D</div>${Object.entries(registry.credits).map(([f, c]) => `<div class="row"><div><b>${esc(c.title)}</b> <span class="muted">por</span> <b>${esc(c.author)}</b>${c.contact ? `<div class="muted">${/^https?:\/\//.test(c.contact) ? `<a href="${esc(c.contact)}" target="_blank" rel="noopener">${esc(c.contact)}</a>` : esc(c.contact)}</div>` : ''}</div><div class="row-r"><span class="muted">${esc(displayName(f))}</span>${f.startsWith('local:') ? `<button class="btn sm" data-act="creditEdit" data-key="${esc(f)}">Editar</button>` : ''}</div></div>`).join('')}<div class="muted pad">Modelos usados conforme as condições de uso de cada autor: sem redistribuição, sem alterações e sem atos violentos.</div>` : ''}
      <div class="section">Controles</div>
      <div class="keys"><b>WASD</b> mover · <b>Shift</b> correr · <b>Espaço</b> pular · <b>Q</b> esquiva · <b>Clique</b> atacar (combo) · <b>Botão direito</b> defender (no tempo certo = <i>parry</i>) · <b>1–4</b> Sword Skills · <b>R</b> poção · <b>T</b> Cristal de Teletransporte · <b>H</b> guardar/sacar espada · <b>E</b> interagir · <b>Tab/Esc</b> menu</div>`;
  }

  pQuests() {
    const q = this.g.quests, active = q.activeList(), avail = q.list.filter((x) => !q.isActive(x.id) && !q.isDone(x.id) && (!x.requires || q.isDone(x.requires)));
    const done = q.list.filter((x) => q.isDone(x.id)).length;
    const row = (x) => {
      const pr = q.progress(x), ready = q.ready(x);
      return `<div class="qrow ${x.main ? 'main' : ''} ${ready ? 'ready' : ''}"><div class="qt"><b>${x.main ? '★ ' : ''}${esc(x.title)}</b><span class="muted">${esc(q.giverName(x.giver))}</span></div>
        <div class="muted">${esc(x.desc)}</div>
        <div class="bar-line"><div class="pbar"><i style="width:${(pr / x.count) * 100}%"></i></div><span>${pr}/${x.count}</span></div>
        <div class="muted">${ready ? (x.giver ? `<b class="accent">Pronta! Entregue para ${esc(q.giverName(x.giver))}.</b>` : '<b class="accent">Concluída!</b>') : `Recompensa: ${esc(q.rewardText(x))}`}</div></div>`;
    };
    return `<div class="section">Em andamento (${active.length})</div>${active.length ? active.map(row).join('') : '<div class="muted pad">Nenhuma missão ativa. Procure NPCs com ❗ ou o Quadro de Missões na praça.</div>'}
      <div class="section">Disponíveis neste andar (${avail.length})</div>
      ${avail.map((x) => `<div class="row"><div><b>❗ ${esc(x.title)}</b> <span class="muted">— fale com ${esc(q.giverName(x.giver))}</span></div><span class="muted">${esc(q.rewardText(x))}</span></div>`).join('') || '<div class="muted pad">Você já pegou todas as missões deste andar!</div>'}
      <div class="muted pad">Concluídas neste andar: ${done}/${q.list.length}. Pilares de luz azul e a Flor de Pneuma aparecem no minimapa.</div>`;
  }

  pNpcs() {
    const local = getLocalMap(), cfg = getNpcConfig(), g = this.g;
    const src = (slot) => {
      const key = local.personagens[slot], file = registry.cast[slot];
      return key ? `<span class="tag ok">${esc(displayName(key))}</span>` : file ? `<span class="tag">pasta: ${esc(file)}</span>` : '<span class="tag">boneco padrão</span>';
    };
    const presSel = (id) => {
      if (!PRESENCE_IDS.includes(id)) return '<span class="muted">sempre na cidade (tem função)</span>';
      const v = presence(id), o = (val, l) => `<option value="${val}" ${v === val ? 'selected' : ''}>${l}</option>`;
      return `<label class="muted">Aparece: <select data-npcp="${id}">${o('always', 'Sempre')}${o('sometimes', 'Às vezes')}${o('never', 'Nunca')}</select></label>`;
    };
    const cards = Object.entries(CAST).map(([id, c]) => {
      const key = local.personagens[id], h = npcHeight(id), here = !!g.npcs.byId(id);
      return `<div class="npccard">
        <div class="nc-head"><b>${esc(c.name)}</b> <span class="muted">${esc(c.title || '')}</span> ${src(id)}</div>
        <div class="nc-row"><span class="muted">Altura</span><input type="range" min="0.9" max="2.3" step="0.01" value="${h}" data-npch="${id}"><span class="num" id="npch-${id}">${h.toFixed(2)} m</span>
          ${cfg.cast[id]?.height ? `<button class="btn sm" data-act="npcReset" data-id="${id}" title="Voltar à altura padrão (${DEFAULT_H[id]} m)">↺</button>` : ''}</div>
        <div class="nc-row">${presSel(id)}</div>
        <div class="btns"><button class="btn sm" data-act="modelPick" data-slot="${id}">Escolher .vrm</button>${key ? `<button class="btn sm" data-act="modelRemove" data-slot="${id}" data-key="${esc(key)}">Remover modelo</button>` : ''}
          <button class="btn sm" data-act="npcCall" data-id="${id}" ${here ? '' : 'disabled title="Não está neste andar"'}>Chamar aqui</button></div>
      </div>`;
    }).join('');
    const list = (slot) => local[slot].map((k) => `<span class="tag ok">${esc(displayName(k))} <button class="x" data-act="modelRemove" data-slot="${slot}" data-key="${esc(k)}">✕</button></span>`).join(' ');
    const group = (slot, label, scaleKey, hint) => `<div class="npccard">
        <div class="nc-head"><b>${label}</b> ${list(slot) || '<span class="tag">bonecos padrão</span>'}</div>
        <div class="muted">${hint}</div>
        <div class="nc-row"><span class="muted">Escala</span><input type="range" min="0.75" max="1.3" step="0.01" value="${cfg[scaleKey]}" data-npcg="${scaleKey}"><span class="num" id="npcg-${scaleKey}">${Math.round(cfg[scaleKey] * 100)}%</span></div>
        <div class="btns"><button class="btn sm" data-act="modelPick" data-slot="${slot}">Adicionar .vrm</button></div>
      </div>`;
    return `<div class="muted pad">Ajuste cada personagem do seu jeito. Arraste a altura e veja na hora — use <b>Chamar aqui</b> para trazer o personagem até você. Modelos .vrm ficam guardados só neste navegador.</div>
      <div class="npcgrid">${cards}</div>
      <div class="section">Moradores e crianças</div>
      <div class="npcgrid">${group('moradores', 'Moradores', 'folkScale', 'Modelos distribuídos em rodízio — quanto mais arquivos, mais variados.')}${group('criancas', 'Crianças', 'kidScale', 'Cada criança usa um modelo diferente desta lista.')}</div>`;
  }

  modelRows() {
    const local = getLocalMap();
    const row = (slot, label) => {
      const key = local.personagens[slot], file = registry.cast[slot];
      const src = key ? `<span class="tag ok">${esc(displayName(key))}</span>` : file ? `<span class="tag">pasta: ${esc(file)}</span>` : '<span class="muted">boneco padrão</span>';
      return `<div class="row"><div><b>${esc(label)}</b> ${src}</div><div class="row-r"><button class="btn sm" data-act="modelPick" data-slot="${slot}">Escolher .vrm</button>${key ? `<button class="btn sm" data-act="modelRemove" data-slot="${slot}" data-key="${esc(key)}">Remover</button>` : ''}</div></div>`;
    };
    const list = (slot) => local[slot].map((k) => `<span class="tag ok">${esc(displayName(k))} <button class="x" data-act="modelRemove" data-slot="${slot}" data-key="${esc(k)}">✕</button></span>`).join(' ');
    return Object.entries(CAST).map(([id, c]) => row(id, c.name)).join('')
      + `<div class="row"><div><b>Moradores</b> ${list('moradores') || '<span class="muted">bonecos padrão</span>'}<div class="muted">Distribuídos em rodízio: quanto mais arquivos, mais variados.</div></div><button class="btn sm" data-act="modelPick" data-slot="moradores">Adicionar .vrm</button></div>`
      + `<div class="row"><div><b>Crianças</b> ${list('criancas') || '<span class="muted">bonecos padrão</span>'}<div class="muted">Cada criança usa um modelo diferente desta lista.</div></div><button class="btn sm" data-act="modelPick" data-slot="criancas">Adicionar .vrm</button></div>`;
  }

  bindPanel() {
    const body = $('mp-body');
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      const g = this.g, p = g.state.player, d = b.dataset;
      Sfx.click();
      switch (d.act) {
        case 'stat': if (p.points > 0) { p[d.k]++; p.points--; } break;
        case 'use': g.useItem(d.id); break;
        case 'equipW': p.weapon = d.id; if (p.offhand === p.weapon) p.offhand = null; g.combat.refresh(); break;
        case 'equipL': p.offhand = d.id; g.combat.refresh(); break;
        case 'unequipL': p.offhand = null; g.combat.refresh(); break;
        case 'equipA': p.armor = d.id; g.clampHp(); break;
        case 'slot': {
          const i = +d.i, prev = p.slots.indexOf(d.id);
          if (prev >= 0) p.slots[prev] = null;
          p.slots[i] = d.id;
          this.refreshSkillbar();
          break;
        }
        case 'unslot': p.slots[+d.i] = null; this.refreshSkillbar(); break;
        case 'travel': g.travel(+d.n); return;
        case 'save': g.save(true); break;
        case 'export': exportSave(g.state); this.toast('Mundo exportado!'); break;
        case 'import':
          importSave().then((s) => { this.closeMenu(false); g.startState(s); this.toast('Mundo importado!'); })
            .catch((err) => this.toast(`Erro: ${err.message}`, 'warn'));
          return;
        case 'logout': g.logout(); return;
        case 'wipe':
          if (confirm('Apagar seu mundo para sempre? (Exporte antes se quiser um backup.)')) g.wipe();
          return;
        case 'modelPick': {
          const inp = document.createElement('input');
          inp.type = 'file';
          inp.accept = '.vrm,.glb';
          inp.multiple = d.slot === 'moradores' || d.slot === 'criancas';
          inp.onchange = async () => {
            try {
              for (const f of inp.files) await assignLocal(d.slot, f);
              this.toast('Modelo guardado neste navegador. Carregando...');
              await g.reloadModels();
            } catch (err) { this.toast(`Não foi possível usar o arquivo: ${err.message}`, 'warn'); }
            this.renderPanel();
          };
          inp.click();
          return;
        }
        case 'modelRemove':
          removeLocal(d.slot, d.key).then(() => g.reloadModels()).then(() => this.renderPanel());
          return;
        case 'creditEdit': {
          const cur = registry.credits[d.key] || {};
          const author = prompt('Autor do modelo:', cur.author && cur.author !== 'autor não informado' ? cur.author : '');
          if (author === null) return;
          const link = prompt('Link da página do modelo (opcional):', cur.contact || '') ?? '';
          setLocalCredit(d.key, { autor: author, link });
          g.reloadModels().then(() => this.renderPanel());
          return;
        }
        case 'petName': {
          const nm = prompt('Nome do mascote:', g.state.pet?.name || '');
          if (nm && g.state.pet) { g.state.pet.name = nm.trim().slice(0, 16); g.save(); }
          break;
        }
        case 'petFree': if (confirm(`Libertar ${g.state.pet?.name}?`)) g.pets.release(); break;
        case 'npcReset': resetNpc(d.id); g.npcs.applyHeights(); break;
        case 'npcCall': {
          const n = g.npcs.byId(d.id);
          if (n) {
            const f = g.player.forward();
            n.pos.set(g.player.pos.x + f.x * 2.2, n.pos.y, g.player.pos.z + f.z * 2.2);
            n.state = 'idle';
            n.timer = 20;
            this.toast(`${n.name} veio até você.`);
          }
          break;
        }
        case 'tab': this.shopTab = d.t; break;
        case 'runeOn': g.equipRune(d.id); break;
        case 'runeOff': g.unequipRune(+d.i); break;
        case 'dismiss': g.party.dismiss(+d.i); break;
        case 'talkMember': {
          const m = g.party.members[+d.i];
          if (!m || m.data.kind !== 'cast') break;
          const id = m.data.id, back = () => node();
          const node = () => ({ text: 'Precisa de alguma coisa? Estou bem aqui.', options: [...g.quests.dialogOptions(id, back), { label: 'Até já', run: () => null }] });
          this.closeMenu(false);
          this.openDialog({ name: m.name, title: 'No seu time', def: { id }, talking: false, dialog: node });
          return;
        }
        case 'townTp': g.townTeleport(d.id); return;
        case 'bagCat': this.bagCat = d.c; this.detail = null; break;
        case 'detail': this.detail = { kind: d.kind, id: d.id }; break;
        case 'closeDetail': this.detail = null; break;
        case 'buy': g.buy(d.kind, d.id, +(d.q || 1)); break;
        case 'sellMat': g.sellMat(d.id); break;
        case 'sellAllMats': Object.keys(p.mats).forEach((k) => g.sellMat(k)); break;
        case 'sellGear': g.sellGear(d.kind, d.id); break;
        default: break;
      }
      this.renderPanel();
    });
    body.addEventListener('input', (e) => {
      const el = e.target;
      if (el.dataset.npch) {
        const id = el.dataset.npch, h = +el.value;
        setNpc(id, { height: h });
        $(`npch-${id}`).textContent = `${h.toFixed(2)} m`;
        this.g.npcs.applyHeights();
        return;
      }
      if (el.dataset.npcg) {
        setGlobal(el.dataset.npcg, +el.value);
        $(`npcg-${el.dataset.npcg}`).textContent = `${Math.round(+el.value * 100)}%`;
        this.g.npcs.applyHeights();
        return;
      }
      if (el.dataset.npcp) {
        setNpc(el.dataset.npcp, { presence: el.value });
        this.g.npcs.populate();
        this.toast(el.value === 'never' ? 'Personagem removido da cidade.' : 'Presença atualizada.');
        this.renderPanel();
        return;
      }
      const k = el.dataset.set;
      if (!k) return;
      const s = this.g.state.settings;
      s[k] = el.type === 'checkbox' ? el.checked : +el.value;
      const lab = $(`set-${k}`);
      if (lab && SET_FMT[k]) lab.textContent = SET_FMT[k](s[k]);
      this.g.applySettings();
    });
    $('mp-close').addEventListener('click', () => this.closeMenu());
  }

  // ─────────── Tela inicial ───────────
  showTitle() {
    $('title').classList.remove('hidden');
    this.showHUD(false);
    const normal = loadSave('normal'), hard = loadSave('hardcore'), rec = getRecord();
    const info = (sv) => `${esc(sv.player.name)} · Nv ${sv.player.level} · Andar ${sv.progress.floor}`;
    const c = $('title-actions');
    c.innerHTML = `<div class="worlds">
      <div class="world">
        <div class="wt">Mundo Normal</div>
        <div class="wd">Se morrer, você renasce na cidade e perde um pouco de EXP.</div>
        ${normal ? `<button class="tbtn primary" data-t="continue" data-m="normal">Continuar<small>${info(normal)}</small></button>` : ''}
        <button class="tbtn ${normal ? '' : 'primary'}" data-t="new" data-m="normal">Novo jogo</button>
        <button class="tbtn small" data-t="import">Importar mundo (.json)</button>
      </div>
      <div class="world hc">
        <div class="wt">Modo Hardcore</div>
        <div class="wd">Como no anime: morreu, perdeu tudo. O mundo é apagado e você recomeça do zero.</div>
        ${hard ? `<button class="tbtn danger-btn" data-t="continue" data-m="hardcore">Continuar<small>${info(hard)}</small></button>` : ''}
        <button class="tbtn ${hard ? '' : 'danger-btn'}" data-t="new" data-m="hardcore">Novo jogo Hardcore</button>
        <div class="wr">${rec.runs ? `Recorde: andar ${rec.bestFloor} · nível ${rec.bestLevel} · ${rec.runs} tentativa${rec.runs > 1 ? 's' : ''}${rec.last ? `<br>Última queda: ${esc(rec.last.name)}, andar ${rec.last.floor}${rec.last.cause ? `, por ${esc(rec.last.cause)}` : ''}` : ''}` : 'Nenhuma tentativa ainda.'}</div>
      </div>
    </div>`;
    $('title-new').classList.add('hidden');
    c.classList.remove('hidden');
    c.onclick = (e) => {
      const b = e.target.closest('[data-t]');
      if (!b) return;
      Sfx.unlock();
      Sfx.click();
      const mode = b.dataset.m;
      if (b.dataset.t === 'continue') this.g.beginGame(mode === 'hardcore' ? hard : normal);
      else if (b.dataset.t === 'new') {
        this.newMode = mode;
        c.classList.add('hidden');
        $('title-new').classList.remove('hidden');
        $('title-new').classList.toggle('hc', mode === 'hardcore');
        const has = mode === 'hardcore' ? hard : normal;
        $('title-warn').textContent = mode === 'hardcore'
          ? `Hardcore: se seu HP chegar a zero, este mundo será apagado para sempre.${has ? ' Isto também substitui o Hardcore atual.' : ''}`
          : 'Atenção: começar um novo jogo substitui o mundo Normal salvo (exporte antes se quiser guardá-lo).';
        $('title-warn').classList.toggle('hidden', !(has || mode === 'hardcore'));
        $('name-input').focus();
      } else {
        importSave().then((sv) => this.g.beginGame(sv)).catch((err) => alert(`Não foi possível importar: ${err.message}`));
      }
    };
    $('title-new').onsubmit = (e) => {
      e.preventDefault();
      const name = $('name-input').value.trim().slice(0, 16) || 'Kirito';
      this.g.beginGame(newSave(name, this.newMode || 'normal'));
    };
    $('title-back').onclick = () => { $('title-new').classList.add('hidden'); c.classList.remove('hidden'); };
  }

  hideTitle() { $('title').classList.add('hidden'); }

  linkStart(cb) {
    const cv = $('linkstart');
    cv.classList.remove('hidden', 'out');
    const W = (cv.width = innerWidth), H = (cv.height = innerHeight);
    const ctx = cv.getContext('2d');
    const colors = ['#ff4a4a', '#ffb84a', '#ffe94a', '#5aff7a', '#4ad8ff', '#4a6aff', '#c44aff', '#ffffff'];
    const rings = [];
    const checks = ['Touch', 'Sight', 'Hearing', 'Taste', 'Smell'];
    const t0 = performance.now();
    let done = false;
    Sfx.linkStart();
    const draw = (now) => {
      const t = (now - t0) / 1000;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(0, 0, W, H);
      if (t < 2.3) for (let i = 0; i < 7; i++) rings.push({ z: 1, c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * Math.PI * 2, l: 0.2 + Math.random() * 0.7, w: 2 + Math.random() * 5 });
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.z -= 0.014 * (1 + t * 1.8);
        if (r.z <= 0.03) { rings.splice(i, 1); continue; }
        const s = 1 / r.z;
        ctx.strokeStyle = r.c;
        ctx.globalAlpha = Math.min(1, (1 - r.z) * 1.6);
        ctx.lineWidth = r.w * s * 0.12;
        ctx.beginPath();
        ctx.arc(0, 0, 24 * s, r.a, r.a + r.l);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = '600 15px "Exo 2", sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      checks.forEach((c, i) => { if (t > 0.25 + i * 0.2 && t < 2.3) ctx.fillText(`${c}  ·  OK`, 40, H - 170 + i * 26); });
      if (t < 1.2) {
        ctx.font = '800 54px "Exo 2", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, t * 3) * (1 - Math.max(0, t - 0.8) / 0.4)})`;
        ctx.fillText('LINK START!', W / 2, H / 2);
      }
      if (t > 2.3) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, (t - 2.3) / 0.35)})`;
        ctx.fillRect(0, 0, W, H);
        if (t > 2.7) {
          ctx.fillStyle = '#5a6070';
          ctx.font = '300 22px "Exo 2", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Welcome to', W / 2, H / 2 - 24);
          ctx.font = '800 46px "Exo 2", sans-serif';
          ctx.fillText('Sword Art Online!', W / 2, H / 2 + 28);
        }
      }
      if (t > 2.9 && !done) { done = true; cb(); }
      if (t < 4.2) requestAnimationFrame(draw);
      else {
        cv.classList.add('out');
        setTimeout(() => cv.classList.add('hidden'), 800);
      }
    };
    requestAnimationFrame(draw);
  }
}
