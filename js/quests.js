// Missões: principal (chefe do andar), secundárias dos personagens e caçadas do Quadro de Missões.
// Tipos: kill (derrotar monstros) · deliver (entregar materiais) · explore (visitar pontos marcados)
//        skill (usar Sword Skills) · parry (aparar ataques) · upgrade (fortalecer arma) · talk (conversar) · boss
import * as THREE from 'three';
import { MONSTERS, weaponDef, armorDef, laReward, monDef } from './data.js';
import { mulberry32 } from './rng.js';
import { guildRank } from './guild.js';
import { Sfx } from './audio.js';

const pickMon = (floor, i) => floor.monsters[i % floor.monsters.length];
const dropOf = (id) => MONSTERS[id].drop[0];

export function questsForFloor(floor) {
  const n = floor.n, m0 = pickMon(floor, 0), m1 = pickMon(floor, 1), m2 = pickMon(floor, 2);
  const k = 1 + (n - 1) * 0.6;
  const col = (v) => Math.round(v * k);
  const Q = [];
  const vary = (list, off = 0) => list[(n + off) % list.length];
  Q.push({ id: `main_${n}`, giver: null, main: true, title: `Libertar o Andar ${n}`, desc: `Derrote ${floor.boss.name}, o chefe do andar, na arena diante do Labirinto.`, type: 'boss', count: 1, reward: { col: col(400), exp: 0 } });
  // as missões dos personagens mudam de andar para andar
  Q.push({ id: `agil_${n}`, giver: 'agil', reward: { col: col(260), items: { potion: 3 } }, ...vary([
    { title: 'Estoque da Agil\'s Store', desc: `"Os aventureiros estão comprando tudo! Me traga 5 ${dropOf(m0)} — pago bem."`, type: 'deliver', target: dropOf(m0), count: 5 },
    { title: 'Minério para revenda', desc: '"Os ferreiros da cidade querem minério. Colete 4 Minério de Ferro nos campos — brilham entre as pedras."', type: 'deliver', target: 'Minério de Ferro', count: 4 },
    { title: 'Peixe fresco na loja', desc: '"Peixe vende que é uma beleza! Pesque 3 peixes quaisquer no lago e eu compro todos."', type: 'fish', count: 3 },
  ]) });
  Q.push({ id: `klein_${n}`, giver: 'klein', reward: { col: col(180), exp: Math.round(120 * k * 1.6) }, ...vary([
    { title: 'Caçada do Fuurinkazan', desc: `"Bora mostrar do que a gente é capaz! Derrote 8 ${monDef(floor, m1).name} comigo... quer dizer, por mim!"`, type: 'kill', target: m1, count: 8 },
    { title: 'Ronda noturna', desc: '"Samurai de verdade caça sob a lua! Derrote 8 monstros quaisquer durante a noite."', type: 'kill', target: '*', night: true, count: 8 },
    { title: `Duelo contra ${monDef(floor, m2).name}`, desc: `"Os ${monDef(floor, m2).name} acham que mandam neste andar. Derrote 7 e mostre quem manda!"`, type: 'kill', target: m2, count: 7 },
  ], 1) });
  Q.push({ id: `argo_${n}`, giver: 'argo', reward: { col: col(150), items: { teleport_crystal: 2 } }, ...vary([
    { title: 'Mapear o andar', desc: '"Preciso de alguém pra checar 3 lugares nos campos. Marquei com pilares de luz no seu mapa. Nyahaha~"', type: 'explore', count: 3 },
    { title: 'Caça ao tesouro', desc: '"Dizem que há baús escondidos pelos campos deste andar. Abra 2 e me conte o que tinha dentro~"', type: 'chest', count: 2 },
    { title: 'Rotas seguras', desc: '"Os novatos precisam de rotas seguras. Visite 4 pontos marcados e eu vendo o mapa... digo, publico de graça!"', type: 'explore', count: 4 },
  ], 2) });
  Q.push({ id: `lisbeth_${n}`, giver: 'lisbeth', reward: { upgrade: 1, col: col(60) }, ...vary([
    { title: 'Metal para a forja', desc: `"Estou sem material! Traga 4 ${dropOf(m2)} e eu fortaleço sua arma de graça."`, type: 'deliver', target: dropOf(m2), count: 4 },
    { title: 'Minério da montanha', desc: '"Preciso de 5 Minério de Ferro para uma encomenda grande. Em troca, fortaleço sua arma de graça!"', type: 'deliver', target: 'Minério de Ferro', count: 5 },
    { title: 'O cristal perfeito', desc: '"Quero testar uma liga nova com cristal. Traga 2 Cristal Bruto — eles brilham roxo entre as pedras."', type: 'deliver', target: 'Cristal Bruto', count: 2 },
  ], 1) });
  Q.push({ id: `asuna_${n}`, giver: 'asuna', reward: { items: { hipotion: 2 }, col: col(120), heal: true }, ...vary([
    { title: 'Ingredientes do jantar', desc: `"Quero testar uma receita nova! Pode me trazer 3 ${dropOf(m1)}?"`, type: 'deliver', target: dropOf(m1), count: 3 },
    { title: 'Ervas para o tempero', desc: '"Meu molho especial precisa de ervas frescas. Colete 5 Erva Medicinal nos campos, por favor!"', type: 'deliver', target: 'Erva Medicinal', count: 5 },
    { title: 'Aula de culinária', desc: '"Quero aprender um prato com peixe. Pesque 2 peixes para mim? O lago fica pertinho da cidade."', type: 'fish', count: 2 },
  ], 2) });
  const kiritoTasks = [
    { title: 'Treino de Sword Skills', desc: '"Sword Skills vencem lutas. Use 12 Sword Skills em combate e me conte como foi."', type: 'skill', count: 12 },
    { title: 'A arte de aparar', desc: '"Segure a defesa (botão direito) no instante do golpe inimigo. Apare 3 ataques."', type: 'parry', count: 3 },
    { title: 'Caçador solo', desc: '"Derrote 15 monstros neste andar. Sem pressa, sem morrer."', type: 'kill', target: '*', count: 15 },
  ];
  Q.push({ id: `kirito_${n}`, giver: 'kirito', ...kiritoTasks[(n - 1) % kiritoTasks.length], reward: { points: 2, col: col(100) } });
  Q.push({ id: `silica_${n}`, giver: 'silica', reward: { items: { heal_crystal: 1 }, col: col(140) }, ...(n % 2
    ? { title: 'A Flor de Pneuma', desc: '"Dizem que uma flor brilhante nasce em algum lugar deste andar... ela tem um poder especial! Me ajuda a achar?"', type: 'explore', flower: true, count: 1 }
    : { title: 'Petisco da Pina', desc: '"A Pina adora Cogumelo Luminoso! Eles brilham azul nos campos. Pode colher 3 para ela?"', type: 'deliver', target: 'Cogumelo Luminoso', count: 3 }) });
  if (n === 1) Q.push({ id: 'yui_1', giver: 'yui', title: 'Papai e mamãe', desc: '"Eu queria conversar com o moço de preto e a moça de branco... você me ajuda? Fala com eles por mim?"', type: 'talk', targets: ['kirito', 'asuna'], count: 2, reward: { items: { potion: 2 }, col: 80 } });
  const ch = chainForFloor(floor);
  let prev = null;
  for (const st of ch.steps) {
    const id = `chain_${n}_${st.key}`;
    Q.push({ ...st, id, giver: 'chain', chain: true, requires: prev });
    prev = id;
  }
  for (const q of Q) q.floor = n;
  return Q;
}

// ─────────── Missões em cadeia: uma pequena história por andar ───────────
export function chainForFloor(floor) {
  const n = floor.n, m0 = floor.monsters[0];
  const la = laReward(n);
  const gear = la.kind === 'weapon' ? { kind: 'armor', id: `rarm_${n}` } : { kind: 'weapon', id: `rare_${n}` };
  const k = 1 + (n - 1) * 0.6;
  if (n === 1) {
    return {
      npc: 'Mãe de Agatha', title: 'Moradora de Horunka', look: { female: true, hair: 'long', hairColor: '#6a4a2a', top: '#7a6a50', apron: '#f0e8d8', skirt: '#5a4a3a' },
      greet: 'Minha filhinha Agatha está com febre há dias... O curandeiro disse que só um remédio feito com o Óvulo da Nepenthes pode salvá-la.',
      steps: [
        { key: 'a', title: 'Rastros na floresta', desc: '"As Nepenthes florescem longe da cidade, perto das árvores. Você poderia procurar onde elas estão?"', type: 'explore', count: 1, reward: { col: 60 } },
        { key: 'b', title: 'O Óvulo da Nepenthes', desc: '"Uma Little Nepenthes com flor carrega o óvulo. Ela é perigosa... por favor, tome cuidado!"', type: 'elite', count: 1,
          elite: { base: 'sapling', name: 'Little Nepenthes (florida)', color: '#4f9a3a', color2: '#ff7ab8', hp: 5, scale: 1.25, drop: 'Óvulo da Nepenthes' },
          reward: { gear: { kind: 'weapon', id: 'rare_1' }, col: 300, exp: 220 }, thanks: '"Agatha vai ficar bem! Meu marido era espadachim... por favor, aceite a espada dele: a Anneal Blade."' },
      ],
    };
  }
  if (n === 2) {
    return {
      npc: 'Fazendeiro de Taran', title: 'Criador de touros', look: { hair: 'short', hairColor: '#4a3020', top: '#8a6a3a', hat: '#c8a050', beard: true },
      greet: 'Um touro gigante dourado está destruindo minhas plantações! Os aventureiros chamam ele de Bullbous Bow.',
      steps: [
        { key: 'a', title: 'Marcas de cascos', desc: '"Ele deixou rastros enormes pelos campos. Descubra para onde foi."', type: 'explore', count: 1, reward: { col: 80 } },
        { key: 'b', title: 'Bullbous Bow', desc: '"Ele está pastando lá. Derrote-o antes que ele volte para a fazenda!"', type: 'elite', count: 1,
          elite: { base: 'ox', name: 'Bullbous Bow', color: '#c8a040', color2: '#fff0c0', hp: 8, scale: 1.9, drop: 'Chifre Dourado' },
          reward: { gear, col: 520, exp: 420 }, thanks: '"Você conseguiu! Tome, encontrei isto nas ruínas perto da fazenda. Deve servir mais a você do que a mim."' },
      ],
    };
  }
  const r = mulberry32(floor.seed + 77);
  const npcs = [['Caçador veterano', { hair: 'short', hairColor: '#5a5a62', top: '#4a5a3a', beard: true }], ['Guarda da cidade', { hair: 'short', hairColor: '#2a1e16', top: '#6a7080' }], ['Velha sábia', { female: true, hair: 'bob', hairColor: '#d8d4cc', top: '#5a3a6a' }], ['Mercadora viajante', { female: true, hair: 'ponytail', hairColor: '#a85a2a', top: '#3a6a5a', hat: '#6a4a2a' }]];
  const [npc, look] = npcs[Math.floor(r() * npcs.length)];
  const adj = ['Alfa', 'Ancião', 'Sanguinário', 'Colosso', 'Fantasma', 'Rei'][Math.floor(r() * 6)];
  const ename = `${adj} ${monDef(floor, m0).name}`;
  return {
    npc, title: `${floor.town}`, look,
    greet: `Viajante! Um ${ename} anda atacando quem sai de ${floor.town}. Ninguém voltou para contar onde ele se esconde.`,
    steps: [
      { key: 'a', title: 'Investigar os rastros', desc: '"Encontramos sinais da fera nos campos. Vá até lá e veja o que descobre."', type: 'explore', count: 1, reward: { col: Math.round(70 * k) } },
      { key: 'b', title: `A Fera de ${floor.town}`, desc: `"É o ${ename}! Derrote-o e traga paz para a cidade."`, type: 'elite', count: 1,
        elite: { base: m0, name: ename, color: null, hp: 7, scale: 1.7, drop: `Troféu: ${ename}` },
        reward: { gear, col: Math.round(380 * k), exp: Math.round(260 * k) }, thanks: `"${floor.town} está a salvo! Aceite isto como agradecimento de todos nós."` },
    ],
  };
}

// ─────────── Pedidos do dia (Quadro de Missões) e contratos da Guilda ───────────
// Sorteados a partir de muitos modelos; mudam a cada dia do jogo. Ids: bd_/gd_<andar>_<dia>_<i>.
const REQUESTERS = ['um fazendeiro', 'a guarda da cidade', 'uma comerciante', 'o padeiro da praça', 'um viajante ferido', 'a enfermaria', 'um colecionador excêntrico', 'a escola de espadachins', 'uma velha senhora', 'os mineiros'];
export function dailyQuests(floor, day, giver) {
  const n = floor.n, k = 1 + (n - 1) * 0.6, col = (v) => Math.round(v * k);
  const r = mulberry32(floor.seed * 3 + day * 7919 + (giver === 'guild' ? 4111 : 0));
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const mons = floor.monsters;
  const who = () => pick(REQUESTERS);
  const T = [
    () => { const m = pick(mons), c = ri(6, 10); return { title: `Caçada: ${monDef(floor, m).name}`, desc: `Pedido de ${who()}: ${c} ${monDef(floor, m).name} estão rondando as estradas. Derrote-os.`, type: 'kill', target: m, count: c, rw: 170 }; },
    () => { const c = ri(12, 18); return { title: 'Limpar os campos', desc: `Pedido de ${who()}: derrote ${c} monstros quaisquer nos arredores da cidade.`, type: 'kill', target: '*', count: c, rw: 210 }; },
    () => { const m = pick(mons), c = ri(4, 7); return { title: `Encomenda: ${dropOf(m)}`, desc: `Pedido de ${who()}: precisa de ${c} ${dropOf(m)}. Pagam bem!`, type: 'deliver', target: dropOf(m), count: c, rw: 200 }; },
    () => { const g = pick(['Erva Medicinal', 'Erva Medicinal', 'Cogumelo Luminoso', 'Minério de Ferro', 'Cristal Bruto']), c = g === 'Cristal Bruto' ? 2 : ri(3, 6); return { title: `Coleta: ${g}`, desc: `Pedido de ${who()}: colete ${c} ${g} pelos campos (pontos brilhantes no chão).`, type: 'deliver', target: g, count: c, rw: g === 'Cristal Bruto' ? 230 : 150 }; },
    () => { const c = ri(2, 4); return { title: 'Pescaria encomendada', desc: `Pedido de ${who()}: pesque ${c} peixes no Lago de Pesca.`, type: 'fish', count: c, rw: 160 }; },
    () => { const c = ri(1, 2); return { title: 'Tesouros perdidos', desc: `Pedido de ${who()}: dizem que há baús escondidos nos campos. Abra ${c}.`, type: 'chest', count: c, rw: 190 }; },
    () => { const c = ri(2, 3); return { title: 'Patrulha', desc: `Pedido de ${who()}: verifique ${c} pontos marcados com pilares de luz azul.`, type: 'explore', count: c, rw: 150 }; },
    () => { const c = ri(6, 10); return { title: 'Caçada noturna', desc: `Pedido de ${who()}: os monstros ficam ousados à noite. Derrote ${c} depois do pôr do sol.`, type: 'kill', target: '*', night: true, count: c, rw: 240 }; },
    () => { const c = ri(8, 14); return { title: 'Demonstração de técnica', desc: `Pedido de ${who()}: mostre aos aprendizes ${c} Sword Skills em combate.`, type: 'skill', count: c, rw: 140 }; },
    () => { const c = ri(2, 4); return { title: 'Aula de defesa', desc: `Pedido de ${who()}: apare (parry) ${c} ataques de monstros.`, type: 'parry', count: c, rw: 170 }; },
    () => ({ title: 'Remédios para a enfermaria', desc: 'Pedido da enfermaria: doe 3 Poções de Cura para os feridos.', type: 'deliverItem', target: 'potion', count: 3, rw: 260 }),
    () => {
      const m = pick(mons), adj = pick(['Caolho', 'Furioso', 'Gigante', 'Ancião', 'Faminto', 'das Cinzas']);
      return { title: `Recompensa: ${monDef(floor, m).name} ${adj}`, desc: `Cartaz de procurado: um ${monDef(floor, m).name} ${adj} foi visto nos campos (pilar vermelho no mapa). Derrote-o.`, type: 'elite', count: 1, rw: 420,
        elite: { base: m, name: `${monDef(floor, m).name} ${adj}`, color: null, hp: 4, scale: 1.45, drop: null } };
    },
  ];
  const order = Array.from(T.keys());
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const out = [];
  for (let i = 0; i < 3; i++) {
    const q = T[order[i]]();
    const pts = giver === 'guild' ? Math.round(30 + q.rw / 6) : 0;
    const reward = { col: col(q.rw * (giver === 'guild' ? 0.8 : 1)), ...(q.type === 'kill' || q.type === 'elite' ? { exp: Math.round(q.rw * 0.5 * k) } : {}), ...(pts ? { guild: pts } : {}) };
    delete q.rw;
    out.push({ ...q, id: `${giver === 'guild' ? 'gd' : 'bd'}_${n}_${day}_${i}`, giver, daily: true, reward });
  }
  return out;
}

const GIVER_NAMES = { chain: 'NPC da história', inn: 'Hana', agil: 'Agil', klein: 'Klein', argo: 'Argo', lisbeth: 'Lisbeth', asuna: 'Asuna', kirito: 'Kirito', silica: 'Silica', yui: 'Yui', board: 'Quadro de Missões', guild: 'Guilda dos Aventureiros' };

export class Quests {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.markers = [];
  }

  get st() {
    const s = this.game.state;
    s.quests ||= { active: {}, done: {} };
    return s.quests;
  }

  setFloor(floor) {
    this.clearMarkers();
    this.floor = floor;
    this.rebuild();
    const main = this.list.find((q) => q.main);
    if (!this.game.state.progress.cleared[floor.n] && !this.st.done[main.id] && !this.st.active[main.id]) this.st.active[main.id] = { p: 0 };
    this.refreshMarkers();
  }

  get day() { return this.game.state.world.day || 0; }

  // lista do andar = missões fixas + pedidos do dia + pedidos antigos que você ainda está fazendo
  rebuild() {
    const floor = this.floor, n = floor.n, day = this.day;
    const list = questsForFloor(floor);
    list.push(...dailyQuests(floor, day, 'board'));
    if (this.game.state.guild) list.push(...dailyQuests(floor, day, 'guild'));
    for (const id of Object.keys(this.st.active)) {
      const m = /^(bd|gd)_(\d+)_(\d+)_(\d)$/.exec(id);
      if (!m || +m[2] !== n || +m[3] === day) continue;
      const q = dailyQuests(floor, +m[3], m[1] === 'gd' ? 'guild' : 'board')[+m[4]];
      if (q) list.push(q);
    }
    for (const id of Object.keys(this.st.done)) { const m = /^(bd|gd)_\d+_(\d+)_/.exec(id); if (m && +m[2] < day - 2) delete this.st.done[id]; }
    for (const q of list) q.floor ??= n;
    this.list = list;
    this.points = this.makePoints(floor);
  }

  // novo dia: o quadro e a guilda trocam os pedidos
  onNewDay() {
    if (!this.floor) return;
    this.rebuild();
    this.refreshMarkers();
    this.game.ui.toast('Um novo dia em Aincrad: há pedidos novos no Quadro de Missões' + (this.game.state.guild ? ' e na Guilda.' : '.'), 'skill');
  }

  makePoints(floor) {
    const w = this.game.world, out = {};
    let r = null;
    const spot = (minR, maxR) => {
      for (let i = 0; i < 60; i++) {
        const a = r() * Math.PI * 2, d = minR + r() * (maxR - minR);
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (w.freeSpot(x, z, 4) && !(w.water && w.groundAt(x, z) < w.water.level + 0.3)) return new THREE.Vector3(x, w.groundAt(x, z), z);
      }
      return new THREE.Vector3(90, w.groundAt(90, 0), 0);
    };
    // cada missão tem sua própria semente: os pontos não mudam quando os pedidos do dia mudam
    const hash = (s) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
    for (const q of this.list) if (q.type === 'explore' || q.type === 'elite') (r = mulberry32(floor.seed + hash(q.id))), out[q.id] = Array.from({ length: q.count }, () => spot(q.flower ? 110 : q.type === 'elite' ? 95 : 75, q.flower ? 205 : 195));
    return out;
  }

  def(id) { return this.list.find((q) => q.id === id); }
  isActive(id) { return !!this.st.active[id]; }
  isDone(id) { return !!this.st.done[id]; }

  progress(q) {
    const a = this.st.active[q.id];
    if (!a) return 0;
    if (q.type === 'deliver') return Math.min(q.count, this.game.state.player.mats[q.target]?.qty || 0);
    if (q.type === 'deliverItem') return Math.min(q.count, this.game.state.player.items[q.target] || 0);
    if (q.type === 'upgrade') return Math.min(q.count, this.game.upgradeLevel(this.game.state.player.weapon));
    if (q.type === 'boss') return this.game.state.progress.cleared[q.floor] ? 1 : 0;
    return Math.min(q.count, a.p || 0);
  }

  ready(q) { return this.isActive(q.id) && this.progress(q) >= q.count; }

  forGiver(giver) { return this.list.filter((q) => q.giver === giver && !this.isDone(q.id) && (!q.requires || this.isDone(q.requires))); }

  chainInfo() { return this.game.floor ? chainForFloor(this.game.floor) : null; }

  marker(giver) {
    const qs = this.forGiver(giver);
    if (qs.some((q) => this.ready(q))) return '?';
    if (qs.some((q) => !this.isActive(q.id))) return '!';
    return '';
  }

  activeList() { return this.list.filter((q) => this.isActive(q.id)); }

  accept(q) {
    this.st.active[q.id] = { p: 0, talked: [] };
    Sfx.menuOpen();
    this.game.ui.toast(`Missão aceita: ${q.title}`, 'skill');
    this.refreshMarkers();
    this.game.save();
  }

  rewardText(q) {
    const r = q.reward, parts = [];
    if (r.col) parts.push(`${r.col.toLocaleString('pt-BR')} Col`);
    if (r.exp) parts.push(`${r.exp} EXP`);
    if (r.points) parts.push(`+${r.points} pontos de atributo`);
    if (r.upgrade) parts.push('arma +1 de graça');
    if (r.gear) parts.push((r.gear.kind === 'weapon' ? weaponDef(r.gear.id) : armorDef(r.gear.id)).name);
    if (r.heal) parts.push('HP restaurado');
    if (r.guild) parts.push(`${r.guild} pontos de guilda`);
    const names = { potion: 'Poção', hipotion: 'Poção Superior', heal_crystal: 'Cristal de Cura', teleport_crystal: 'Cristal de Teletransporte' };
    for (const [id, qn] of Object.entries(r.items || {})) parts.push(`${qn}× ${names[id] || id}`);
    return parts.join(' · ');
  }

  turnIn(q) {
    if (!this.ready(q)) return false;
    const g = this.game, p = g.state.player, r = q.reward;
    if (q.type === 'deliver') {
      const m = p.mats[q.target];
      m.qty -= q.count;
      if (m.qty <= 0) delete p.mats[q.target];
    }
    if (q.type === 'deliverItem') p.items[q.target] -= q.count;
    if (r.guild && g.state.guild) {
      const before = guildRank(g.state.guild).letter;
      g.state.guild.pts += r.guild;
      g.state.guild.done = (g.state.guild.done || 0) + 1;
      const after = guildRank(g.state.guild).letter;
      if (after !== before) setTimeout(() => g.ui.banner(`Posto ${after} na Guilda!`, 'Mais EXP, descontos nas lojas e novos companheiros', 4), 1800);
    }
    delete this.st.active[q.id];
    this.st.done[q.id] = true;
    if (r.col) p.col += r.col;
    for (const [id, qn] of Object.entries(r.items || {})) p.items[id] = (p.items[id] || 0) + qn;
    if (r.points) p.points += r.points;
    if (r.heal) p.hp = g.stats().maxHp;
    if (r.upgrade) { (p.upgrades ||= {})[p.weapon] = Math.min(10, g.upgradeLevel(p.weapon) + r.upgrade); g.combat.refresh(); }
    if (r.gear) { (r.gear.kind === 'weapon' ? p.weapons : p.armors).push(r.gear.id); }
    if (r.exp) g.gainExp(r.exp);
    Sfx.victory();
    g.effects.ring(g.player.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), '#ffd54f', 1.6, 1.2, 1.8);
    g.ui.banner('Missão concluída!', `${q.title} — ${this.rewardText(q)}`, 3.5);
    this.refreshMarkers();
    g.save();
    return true;
  }

  // ─────────── Eventos do jogo ───────────
  bump(pred, amount = 1) {
    let changed = false;
    for (const q of this.activeList()) {
      if (!pred(q)) continue;
      const a = this.st.active[q.id], before = a.p || 0;
      if (before >= q.count) continue;
      a.p = before + amount;
      changed = true;
      if (a.p >= q.count) this.game.ui.toast(`✔ ${q.title}: objetivo cumprido! ${q.giver ? `Fale com ${GIVER_NAMES[q.giver]}.` : ''}`, 'skill');
    }
    return changed;
  }

  onKill(e) {
    const night = this.game.night > 0.5;
    this.bump((q) => q.type === 'kill' && (!q.night || night) && (q.target === '*' || q.target === e.monId));
    if (e.questId) {
      this.bump((q) => q.id === e.questId);
      const q = this.def(e.questId);
      if (q?.elite?.drop) this.game.ui.toast(`Você obteve: ${q.elite.drop}`, 'skill');
      this.refreshMarkers();
    }
  }
  onSkill() { this.bump((q) => q.type === 'skill'); }
  onFish() { this.bump((q) => q.type === 'fish'); }
  onChest() { this.bump((q) => q.type === 'chest'); }
  onParry() { this.bump((q) => q.type === 'parry'); }
  onDrop(name) {
    for (const q of this.activeList()) if (q.type === 'deliver' && q.target === name && this.progress(q) === q.count) this.game.ui.toast(`✔ ${q.title}: você já tem ${q.count} ${name}!`, 'skill');
  }
  onTalk(npcId) {
    for (const q of this.activeList()) {
      if (q.type !== 'talk' || !q.targets.includes(npcId)) continue;
      const a = this.st.active[q.id];
      a.talked ||= [];
      if (a.talked.includes(npcId)) continue;
      a.talked.push(npcId);
      a.p = a.talked.length;
      this.game.ui.toast(a.p >= q.count ? `✔ ${q.title}: volte para a Yui!` : `${q.title}: ${a.p}/${q.count}`, 'skill');
    }
  }
  onBoss() {
    const q = this.list.find((x) => x.main);
    if (q && this.isActive(q.id)) this.turnIn(q);
  }

  // ─────────── Pilares de exploração e a Flor de Pneuma ───────────
  clearMarkers() {
    for (const m of this.markers) {
      this.game.scene.remove(m.obj);
      m.obj.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    }
    this.markers = [];
  }

  refreshMarkers() {
    this.clearMarkers();
    if (!this.points) return;
    for (const q of this.activeList()) {
      if (q.type === 'elite' && this.progress(q) < q.count) {
        const pos = this.points[q.id][0];
        const obj = this.pillarMesh('#ff5a4a');
        obj.position.copy(pos);
        this.game.scene.add(obj);
        this.markers.push({ obj, q, i: 0, pos, elite: true });
        continue;
      }
      if (q.type !== 'explore') continue;
      const visited = this.st.active[q.id].visited || [];
      this.points[q.id].forEach((pos, i) => {
        if (visited.includes(i)) return;
        const obj = q.flower ? this.flowerMesh() : this.pillarMesh();
        obj.position.copy(pos);
        this.game.scene.add(obj);
        this.markers.push({ obj, q, i, pos, flower: !!q.flower });
      });
    }
  }

  pillarMesh(col = '#7ad0ff') {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 40, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.4), transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.y = 20;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).lerp(new THREE.Color('#ffffff'), 0.5).multiplyScalar(2.2) }));
    gem.position.y = 2.2;
    g.add(beam, gem);
    g.userData.spin = gem;
    return g;
  }

  flowerMesh() {
    const g = new THREE.Group();
    const petal = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e8f4ff').multiplyScalar(2.2) });
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), petal);
      const a = (i / 6) * Math.PI * 2;
      p.position.set(Math.cos(a) * 0.16, 0.6, Math.sin(a) * 0.16);
      p.scale.set(1, 0.4, 1.6);
      p.lookAt(0, 0.6, 0);
      g.add(p);
    }
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe08a').multiplyScalar(2.5) })));
    g.children[g.children.length - 1].position.y = 0.62;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.6, 6), new THREE.MeshStandardMaterial({ color: '#4a9a3a' }));
    stem.position.y = 0.3;
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#bfe8ff').multiplyScalar(1.2), transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), glowMat);
    halo.position.y = 0.6;
    g.add(stem, halo);
    g.userData.spin = halo;
    return g;
  }

  update(dt) {
    const pl = this.game.player.pos, t = this.game.time;
    // inimigos de elite das missões em cadeia aparecem quando você chega perto do pilar vermelho
    this.elites ||= {};
    for (const q of this.activeList()) {
      if (q.type !== 'elite' || this.progress(q) >= q.count) continue;
      const pos = this.points[q.id][0], ref = this.elites[q.id];
      if (ref && !ref.dead && this.game.enemies.list.includes(ref)) continue;
      if (Math.hypot(pl.x - pos.x, pl.z - pos.z) > 75) continue;
      const base = monDef(this.game.floor, q.elite.base);
      const def = { ...base, name: q.elite.name, hp: base.hp * q.elite.hp, atk: (base.atk || 1) * 1.35, scale: (base.scale || 1) * q.elite.scale, aggro: 24, ...(q.elite.color ? { color: q.elite.color } : {}), ...(q.elite.color2 ? { color2: q.elite.color2 } : {}) };
      const e = this.game.enemies.spawnAt(def, this.game.floor.level + 3, pos.x, pos.z, {});
      e.questId = q.id;
      e.monId = q.elite.base;
      e.elite = true;
      e.label?.el.classList.add('elite');
      this.elites[q.id] = e;
    }
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i];
      if (m.elite) { const s = m.obj.userData.spin; if (s) { s.rotation.y += dt * 1.5; s.position.y = 2.2 + Math.sin(t * 2) * 0.25; } continue; }
      const s = m.obj.userData.spin;
      if (s) { s.rotation.y += dt * 1.5; if (!m.flower) s.position.y = 2.2 + Math.sin(t * 2 + i) * 0.25; else s.scale.setScalar(1 + Math.sin(t * 3) * 0.12); }
      if (Math.hypot(pl.x - m.pos.x, pl.z - m.pos.z) < (m.flower ? 2.2 : 4)) {
        const a = this.st.active[m.q.id];
        if (!a) continue;
        (a.visited ||= []).push(m.i);
        a.p = a.visited.length;
        this.game.effects.sparks(m.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), m.flower ? '#ffffff' : '#7ad0ff', 24, 0.8);
        Sfx.coin();
        this.game.ui.toast(m.flower ? '✿ Você encontrou a Flor de Pneuma! Leve para a Silica.' : `${m.q.title}: ${a.p}/${m.q.count} lugares`, 'skill');
        if (a.p >= m.q.count && !m.flower) this.game.ui.toast(`✔ ${m.q.title}: volte para ${this.giverName(m.q.giver)}!`, 'skill');
        this.game.scene.remove(m.obj);
        this.markers.splice(i, 1);
        this.game.save();
      }
    }
  }

  // Opções de missão no diálogo de um NPC (ou do Quadro de Missões)
  dialogOptions(giver, back) {
    const opts = [];
    for (const q of this.forGiver(giver)) {
      if (this.ready(q)) {
        opts.push({ label: `✔ Entregar: ${q.title}`, run: () => { this.turnIn(q); return { text: `${q.thanks ? `${q.thanks}\n\n` : 'Obrigado! '}Recompensa: ${this.rewardText(q)}.`, options: [{ label: 'Continuar', run: back }, { label: 'Até mais', run: () => null }] }; } });
      } else if (this.isActive(q.id)) {
        opts.push({ label: `… ${q.title} (${this.progress(q)}/${q.count})`, run: () => ({ text: `${q.desc}\n\nProgresso: ${this.progress(q)}/${q.count}.`, options: [{ label: 'Voltar', run: back }] }) });
      } else {
        opts.push({ label: `❗ Missão: ${q.title}`, run: () => ({ text: `${q.desc}\n\nRecompensa: ${this.rewardText(q)}.`, options: [
          { label: 'Aceitar', run: () => { this.accept(q); return { text: 'Conto com você!', options: [{ label: 'Continuar', run: back }, { label: 'Até mais', run: () => null }] }; } },
          { label: 'Agora não', run: back },
        ] }) });
      }
    }
    return opts;
  }

  giverName(g) { return g === 'chain' ? (this.chainInfo()?.npc || 'NPC da história') : g ? GIVER_NAMES[g] : 'Missão principal'; }
}
