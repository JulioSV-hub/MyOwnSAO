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

// Nós: { id, name, max, req (pontos já gastos no ramo), per (bônus por ponto), desc }
const N = (id, name, max, req, per, desc) => ({ id, name, max, req, per, desc });
export const BRANCHES = {
  off: { name: 'Ofensiva', color: '#ff7a5a', nodes: [
    N('off1', 'Lâmina Afiada', 5, 0, { atk: 0.03 }, '+3% de ataque'),
    N('off2', 'Golpe Preciso', 5, 3, { crit: 0.02 }, '+2% de crítico'),
    N('off3', 'Golpe Devastador', 3, 6, { critDmg: 0.1 }, '+10% de dano crítico'),
    N('off4', 'Fluxo de Combate', 3, 9, { cd: 0.04 }, '−4% de recarga das Sword Skills'),
  ] },
  def: { name: 'Defensiva', color: '#6ab0ff', nodes: [
    N('def1', 'Vitalidade', 5, 0, { hp: 0.04 }, '+4% de HP máximo'),
    N('def2', 'Armadura Viva', 5, 3, { defMul: 0.05 }, '+5% de defesa'),
    N('def3', 'Defesa Firme', 3, 6, { guard: 0.06 }, 'defender bloqueia +6% do dano'),
    N('def4', 'Reflexo de Parry', 3, 9, { parry: 0.04 }, '+0,04s na janela do parry'),
  ] },
  uti: { name: 'Utilidade', color: '#9ae07a', nodes: [
    N('uti1', 'Passos Leves', 5, 0, { spd: 0.02 }, '+2% de velocidade'),
    N('uti2', 'Fôlego', 3, 3, { dodge: 0.12 }, '−12% de stamina na esquiva e na corrida'),
    N('uti3', 'Alquimia', 3, 6, { potion: 0.1 }, 'poções curam +10%'),
    N('uti4', 'Fortuna', 5, 9, { col: 0.05, exp: 0.05 }, '+5% de Col e EXP'),
  ] },
};
export const CLASS_BRANCH = {
  swordsman: [N('sw1', 'Domínio da Espada', 5, 0, { atk: 0.04 }, '+4% de ataque'), N('sw2', 'Ímpeto', 5, 3, { skillDmg: 0.06 }, 'Sword Skills causam +6% de dano'),
    N('sw3', 'Olho do Mestre', 3, 6, { crit: 0.03 }, '+3% de crítico'), N('sw4', 'Arte da Espada', 3, 9, { cd: 0.06 }, '−6% de recarga das Sword Skills')],
  guardian: [N('gu1', 'Corpo de Aço', 5, 0, { hp: 0.05 }, '+5% de HP máximo'), N('gu2', 'Couraça', 5, 3, { defMul: 0.06 }, '+6% de defesa'),
    N('gu3', 'Bloqueio Total', 3, 6, { guard: 0.08 }, 'defender bloqueia +8% do dano'), N('gu4', 'Muralha', 3, 9, { partyHp: 0.1 }, 'seu time ganha +10% de HP')],
  duelist: [N('du1', 'Precisão', 5, 0, { crit: 0.03 }, '+3% de crítico'), N('du2', 'Ponto Vital', 5, 3, { critDmg: 0.1 }, '+10% de dano crítico'),
    N('du3', 'Esquiva Ágil', 3, 6, { dodge: 0.15 }, '−15% de stamina na esquiva e na corrida'), N('du4', 'Reflexos', 3, 9, { parry: 0.05 }, '+0,05s na janela do parry')],
  berserker: [N('be1', 'Força Bruta', 5, 0, { atk: 0.04 }, '+4% de ataque'), N('be2', 'Fúria', 5, 3, { lowHp: 0.08 }, 'até +8% de ataque quanto menor o seu HP'),
    N('be3', 'Sede de Sangue', 3, 6, { leech: 0.015 }, '+1,5% de roubo de vida'), N('be4', 'Vigor Selvagem', 3, 9, { hp: 0.04 }, '+4% de HP máximo')],
  cleric: [N('cl1', 'Bênção', 5, 0, { aura: 0.01 }, 'a aura cura +1% a mais'), N('cl2', 'Prece', 5, 3, { hp: 0.05 }, '+5% de HP máximo'),
    N('cl3', 'Luz Protetora', 3, 6, { defMul: 0.05 }, '+5% de defesa'), N('cl4', 'Graça', 3, 9, { partyDmg: 0.1 }, 'seu time causa +10% de dano')],
  tamer: [N('ta1', 'Laço', 5, 0, { petDmg: 0.15 }, 'mascote causa +15% de dano'), N('ta2', 'Instinto', 5, 3, { petHeal: 0.1 }, 'cura do mascote +10%'),
    N('ta3', 'Matilha', 3, 6, { partyHp: 0.08 }, 'seu time ganha +8% de HP'), N('ta4', 'Comando', 3, 9, { partyDmg: 0.08 }, 'seu time causa +8% de dano')],
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
