// Classes do jogador, árvore de talentos e classes dos companheiros de time.
// Cada nível dá 1 ponto de talento (além dos 3 pontos de atributo). Um nó só libera
// depois de gastar pontos suficientes no mesmo ramo (req).

export const CLASSES = {
  swordsman: { name: 'Espadachim', icon: '⚔', color: '#4fa8ff', desc: 'Equilibrado. Domina as Sword Skills.', passive: '+10% ataque · −10% recarga das Sword Skills', bonus: { atk: 0.1, cd: 0.1 } },
  guardian: { name: 'Guardião', icon: '🛡', color: '#8a9ab0', desc: 'Aguenta tudo e protege o time.', passive: '+35% HP · +25% defesa · defender bloqueia +15%', bonus: { hp: 0.35, defMul: 0.25, guard: 0.15 } },
  duelist: { name: 'Duelista', icon: '✦', color: '#ffd84a', desc: 'Rápido e letal: críticos e esquivas.', passive: '+10% crítico · +30% dano crítico · +8% velocidade', bonus: { crit: 0.1, critDmg: 0.3, spd: 0.08 } },
  berserker: { name: 'Berserker', icon: '🔥', color: '#ff5a3a', desc: 'Dano bruto e roubo de vida, menos defesa.', passive: '+22% ataque · −15% defesa · 3% roubo de vida', bonus: { atk: 0.22, defMul: -0.15, leech: 0.03 } },
  cleric: { name: 'Clérigo', icon: '✚', color: '#7aff9a', desc: 'Cura você e o time em combate.', passive: 'aura cura você e o time (8% a cada 12s) · poções +50% · regeneração 3×', bonus: { aura: 0.08, potion: 0.5, regen: 2 } },
  tamer: { name: 'Domador', icon: '♥', color: '#ff9ac8', desc: 'Luta junto com o mascote, como a Silica.', passive: 'mascote causa 2× dano e cura 50% mais · +25% chance de domar', bonus: { petDmg: 1, petHeal: 0.5, tame: 0.25 } },
};

// Nós: { id, name, max, req (pontos já gastos no ramo), lvl (nível mínimo), per (bônus por ponto), desc }
// 7 ramos × 8 nós = 210 pontos — mais do que você ganha até o andar 100, então é preciso escolher.
// Os nós mais fundos só liberam nos níveis 40, 60, 90 e 120; o último de cada ramo é lendário.
const REQ = [0, 3, 6, 9, 12, 16, 20, 24], LVL = [0, 0, 0, 0, 40, 60, 90, 120], MAX = [5, 5, 3, 3, 5, 5, 3, 1];
const tier = (prefix, list) => list.map(([name, per, desc], i) => ({ id: `${prefix}${i + 1}`, name, max: MAX[i], req: REQ[i], lvl: LVL[i], per, desc, legend: i === 7 }));
export const BRANCHES = {
  off: { name: 'Ofensiva', color: '#ff7a5a', nodes: tier('off', [
    ['Lâmina Afiada', { atk: 0.03 }, '+3% de ataque'],
    ['Golpe Preciso', { crit: 0.02 }, '+2% de crítico'],
    ['Golpe Devastador', { critDmg: 0.1 }, '+10% de dano crítico'],
    ['Fluxo de Combate', { cd: 0.04 }, '−4% de recarga das Sword Skills'],
    ['Executor', { execute: 0.06 }, '+6% de dano em inimigos com menos de 30% de HP'],
    ['Caçador de Chefes', { bossDmg: 0.05 }, '+5% de dano contra chefes e elites'],
    ['Fio Implacável', { atk: 0.05 }, '+5% de ataque'],
    ['Lâmina Lendária', { atk: 0.1, critDmg: 0.25 }, '+10% de ataque e +25% de dano crítico'],
  ]) },
  def: { name: 'Defensiva', color: '#6ab0ff', nodes: tier('def', [
    ['Vitalidade', { hp: 0.04 }, '+4% de HP máximo'],
    ['Armadura Viva', { defMul: 0.05 }, '+5% de defesa'],
    ['Defesa Firme', { guard: 0.06 }, 'defender bloqueia +6% do dano'],
    ['Reflexo de Parry', { parry: 0.04 }, '+0,04s na janela do parry'],
    ['Pele de Pedra', { resist: 0.02 }, '−2% de dano recebido'],
    ['Fortaleza', { hp: 0.05 }, '+5% de HP máximo'],
    ['Muralha Viva', { defMul: 0.08 }, '+8% de defesa'],
    ['Imortal', { secondWind: 1, defMul: 0.1 }, 'um golpe fatal te deixa com 30% de HP (1× a cada 2 min) e +10% de defesa'],
  ]) },
  uti: { name: 'Utilidade', color: '#9ae07a', nodes: tier('uti', [
    ['Passos Leves', { spd: 0.02 }, '+2% de velocidade'],
    ['Fôlego', { dodge: 0.12 }, '−12% de stamina na esquiva e na corrida'],
    ['Alquimia', { potion: 0.1 }, 'poções curam +10%'],
    ['Fortuna', { col: 0.05, exp: 0.05 }, '+5% de Col e EXP'],
    ['Saqueador', { drop: 0.1 }, '+10% de chance de materiais dos monstros'],
    ['Gourmet', { buffTime: 0.2 }, 'comidas e bebidas duram +20%'],
    ['Pés de Vento', { spd: 0.04 }, '+4% de velocidade'],
    ['Sorte Grande', { col: 0.25, exp: 0.15 }, '+25% de Col e +15% de EXP'],
  ]) },
  mas: { name: 'Maestria', color: '#c08aff', nodes: tier('mas', [
    ['Técnica', { skillDmg: 0.04 }, 'Sword Skills causam +4% de dano'],
    ['Recuperação', { cd: 0.03 }, '−3% de recarga das Sword Skills'],
    ['Golpe Fluido', { post: 0.1 }, '−10% de post-motion delay'],
    ['Encadeamento', { skillDmg: 0.06 }, 'Sword Skills causam +6% de dano'],
    ['Estocada Mortal', { critDmg: 0.06 }, '+6% de dano crítico'],
    ['Arte Marcial', { skillDmg: 0.05 }, 'Sword Skills causam +5% de dano'],
    ['Mente Clara', { cd: 0.05 }, '−5% de recarga das Sword Skills'],
    ['Espada Estelar', { skillDmg: 0.2, post: 0.25 }, 'Sword Skills +20% de dano e −25% de post-motion delay'],
  ]) },
  sur: { name: 'Sobrevivência', color: '#5ad8a0', nodes: tier('sur', [
    ['Regeneração', { regen: 0.3 }, 'HP se regenera 30% mais rápido'],
    ['Sangue Frio', { resist: 0.03 }, '−3% de dano recebido'],
    ['Vampirismo', { leech: 0.01 }, '+1% de roubo de vida'],
    ['Remédios', { potion: 0.1 }, 'poções curam +10%'],
    ['Segundo Fôlego', { stam: 0.1 }, 'stamina volta 10% mais rápido'],
    ['Couro Grosso', { resist: 0.02 }, '−2% de dano recebido'],
    ['Sanguessuga', { leech: 0.015 }, '+1,5% de roubo de vida'],
    ['Fênix', { secondWind: 1, regen: 1 }, 'um golpe fatal te deixa com 30% de HP (1× a cada 2 min) e regeneração 2×'],
  ]) },
  lead: { name: 'Liderança', color: '#ffb84a', nodes: tier('lead', [
    ['Companheirismo', { partyDmg: 0.04 }, 'seu time causa +4% de dano'],
    ['Proteção', { partyHp: 0.05 }, 'seu time ganha +5% de HP'],
    ['Laço Animal', { petDmg: 0.15 }, 'mascote causa +15% de dano'],
    ['Treinador', { petHeal: 0.1 }, 'cura do mascote +10%'],
    ['Tática de Grupo', { partyDmg: 0.05 }, 'seu time causa +5% de dano'],
    ['Escudo do Time', { partyHp: 0.06 }, 'seu time ganha +6% de HP'],
    ['Grito de Guerra', { atk: 0.02, partyDmg: 0.04 }, '+2% de ataque e time +4% de dano'],
    ['Comandante', { partyDmg: 0.2, partyHp: 0.2 }, 'seu time causa +20% de dano e ganha +20% de HP'],
  ]) },
};
export const CLASS_BRANCH = {
  swordsman: tier('sw', [
    ['Domínio da Espada', { atk: 0.04 }, '+4% de ataque'], ['Ímpeto', { skillDmg: 0.06 }, 'Sword Skills causam +6% de dano'],
    ['Olho do Mestre', { crit: 0.03 }, '+3% de crítico'], ['Arte da Espada', { cd: 0.06 }, '−6% de recarga das Sword Skills'],
    ['Lâmina Veloz', { atk: 0.03, cd: 0.02 }, '+3% de ataque e −2% de recarga'], ['Mestre Espadachim', { skillDmg: 0.05 }, 'Sword Skills causam +5% de dano'],
    ['Corte Perfeito', { crit: 0.03, critDmg: 0.08 }, '+3% de crítico e +8% de dano crítico'], ['Espada do Herói', { atk: 0.12, cd: 0.1 }, '+12% de ataque e −10% de recarga'],
  ]),
  guardian: tier('gu', [
    ['Corpo de Aço', { hp: 0.05 }, '+5% de HP máximo'], ['Couraça', { defMul: 0.06 }, '+6% de defesa'],
    ['Bloqueio Total', { guard: 0.08 }, 'defender bloqueia +8% do dano'], ['Muralha', { partyHp: 0.1 }, 'seu time ganha +10% de HP'],
    ['Baluarte', { resist: 0.02 }, '−2% de dano recebido'], ['Gigante', { hp: 0.05 }, '+5% de HP máximo'],
    ['Contra-golpe', { parry: 0.05, guard: 0.05 }, '+0,05s de parry e bloqueio +5%'], ['Inquebrável', { secondWind: 1, defMul: 0.2 }, 'um golpe fatal te deixa com 30% de HP (1× a cada 2 min) e +20% de defesa'],
  ]),
  duelist: tier('du', [
    ['Precisão', { crit: 0.03 }, '+3% de crítico'], ['Ponto Vital', { critDmg: 0.1 }, '+10% de dano crítico'],
    ['Esquiva Ágil', { dodge: 0.15 }, '−15% de stamina na esquiva e na corrida'], ['Reflexos', { parry: 0.05 }, '+0,05s na janela do parry'],
    ['Dança das Lâminas', { spd: 0.02, crit: 0.015 }, '+2% de velocidade e +1,5% de crítico'], ['Golpe Fatal', { critDmg: 0.08 }, '+8% de dano crítico'],
    ['Sombra', { dodge: 0.1, spd: 0.03 }, 'esquiva −10% de stamina e +3% de velocidade'], ['Mil Cortes', { crit: 0.1, critDmg: 0.3 }, '+10% de crítico e +30% de dano crítico'],
  ]),
  berserker: tier('be', [
    ['Força Bruta', { atk: 0.04 }, '+4% de ataque'], ['Fúria', { lowHp: 0.08 }, 'até +8% de ataque quanto menor o seu HP'],
    ['Sede de Sangue', { leech: 0.015 }, '+1,5% de roubo de vida'], ['Vigor Selvagem', { hp: 0.04 }, '+4% de HP máximo'],
    ['Sangue Fervendo', { lowHp: 0.06 }, 'até +6% de ataque quanto menor o seu HP'], ['Massacre', { atk: 0.04 }, '+4% de ataque'],
    ['Banquete de Sangue', { leech: 0.015 }, '+1,5% de roubo de vida'], ['Ira Imortal', { secondWind: 1, atk: 0.15 }, 'um golpe fatal te deixa com 30% de HP (1× a cada 2 min) e +15% de ataque'],
  ]),
  cleric: tier('cl', [
    ['Bênção', { aura: 0.01 }, 'a aura cura +1% a mais'], ['Prece', { hp: 0.05 }, '+5% de HP máximo'],
    ['Luz Protetora', { defMul: 0.05 }, '+5% de defesa'], ['Graça', { partyDmg: 0.1 }, 'seu time causa +10% de dano'],
    ['Santuário', { aura: 0.01 }, 'a aura cura +1% a mais'], ['Graça Divina', { potion: 0.1, regen: 0.3 }, 'poções +10% e regeneração +30%'],
    ['Escudo Sagrado', { resist: 0.03 }, '−3% de dano recebido'], ['Milagre', { secondWind: 1, aura: 0.05 }, 'um golpe fatal te deixa com 30% de HP (1× a cada 2 min) e a aura cura +5%'],
  ]),
  tamer: tier('ta', [
    ['Laço', { petDmg: 0.15 }, 'mascote causa +15% de dano'], ['Instinto', { petHeal: 0.1 }, 'cura do mascote +10%'],
    ['Matilha', { partyHp: 0.08 }, 'seu time ganha +8% de HP'], ['Comando', { partyDmg: 0.08 }, 'seu time causa +8% de dano'],
    ['Fera Leal', { petDmg: 0.15 }, 'mascote causa +15% de dano'], ['Vínculo', { petHeal: 0.1, partyHp: 0.03 }, 'cura do mascote +10% e time +3% de HP'],
    ['Alfa', { petDmg: 0.2 }, 'mascote causa +20% de dano'], ['Rei das Feras', { petDmg: 0.6, partyDmg: 0.15 }, 'mascote +60% de dano e time +15% de dano'],
  ]),
};

export const branchesFor = (cls) => [...Object.entries(BRANCHES).map(([k, b]) => ({ key: k, ...b })), ...(CLASSES[cls] ? [{ key: 'cls', name: CLASSES[cls].name, color: CLASSES[cls].color, nodes: CLASS_BRANCH[cls] }] : [])];
export const talentPoints = (p) => Math.max(0, p.level - 1) - Object.values(p.talents || {}).reduce((a, b) => a + b, 0);
export const spentIn = (p, branch) => branch.nodes.reduce((a, n) => a + ((p.talents || {})[n.id] || 0), 0);

// Soma do bônus da classe + talentos
export function classBonus(p) {
  const out = {};
  const add = (o, k = 1) => { for (const [key, v] of Object.entries(o)) out[key] = (out[key] || 0) + v * k; };
  if (CLASSES[p.cls]) add(CLASSES[p.cls].bonus);
  for (const br of branchesFor(p.cls)) for (const n of br.nodes) { const r = (p.talents || {})[n.id] || 0; if (r) add(n.per, r); }
  return out;
}

// saves antigos: nós que ficaram com máximo menor devolvem os pontos que passaram do limite
export function normalizeTalents(p) {
  p.talents ||= {};
  const all = [...Object.values(BRANCHES).flatMap((b) => b.nodes), ...Object.values(CLASS_BRANCH).flat()];
  for (const [id, r] of Object.entries(p.talents)) {
    const n = all.find((x) => x.id === id);
    if (!n) delete p.talents[id];
    else if (r > n.max) p.talents[id] = n.max;
  }
}

export const respecCost = (p) => 150 * p.level;
export const classChangeCost = (p) => 250 * p.level;

// ─────────── Classes dos companheiros ───────────
export const COMP_CLASSES = {
  swordsman: { name: 'Espadachim', role: 'Ataque equilibrado', dmg: 1, hp: 1, reach: 2.4 },
  guardian: { name: 'Guardião', role: 'Muito HP; atrai os monstros', dmg: 0.75, hp: 1.9, reach: 2.3, taunt: true },
  duelist: { name: 'Duelista', role: 'Golpes rápidos e críticos', dmg: 1.05, hp: 0.9, reach: 2.5, fast: true, crit: 0.3 },
  berserker: { name: 'Berserker', role: 'Dano altíssimo, pouco HP', dmg: 1.45, hp: 0.85, reach: 2.7 },
  cleric: { name: 'Clérigo', role: 'Cura você durante a luta', dmg: 0.5, hp: 0.9, reach: 2.2, heals: true },
  tamer: { name: 'Domador', role: 'Ataca junto com um bichinho', dmg: 0.85, hp: 1, reach: 2.3, pet: true },
};
// saves antigos usavam outros nomes
export const OLD_MERC = { sword: 'swordsman', lance: 'berserker', cleric: 'cleric', tank: 'guardian' };
export const CAST_DEFAULT_CLASS = { kirito: 'duelist', asuna: 'duelist', klein: 'swordsman', silica: 'tamer' };
