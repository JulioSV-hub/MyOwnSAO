// Catálogo de mascotes: do Lobinho comum ao Dragão Ancestral mítico.
// Raridade multiplica dano e cura; raros e acima dão um bônus para você; lendários e míticos têm uma habilidade especial.
import { MONSTERS } from './data.js';

export const PET_TIERS = [
  null,
  { name: 'Comum', color: '#9aa0a8', stars: 1, mul: 1, refund: 1 },
  { name: 'Raro', color: '#4f9ff7', stars: 2, mul: 1.35, refund: 2 },
  { name: 'Épico', color: '#b05aff', stars: 3, mul: 1.85, refund: 6 },
  { name: 'Lendário', color: '#f3a712', stars: 4, mul: 2.6, refund: 25 },
  { name: 'Mítico', color: '#ff4a6a', stars: 5, mul: 3.5, refund: 60 },
];

// def: monstro próprio (não aparece nos campos). scale: tamanho do mascote (0.55 = filhote).
const D = (o) => ({ speed: 5, hp: 1, atk: 1, aggro: 10, range: 2, windup: 0.5, ...o });
export const PETS = {
  // ─── Comuns: baratinhos (e meio fracos — faz parte!) ───
  wolf: { name: 'Lobinho', tier: 1, mon: 'wolf', price: 600 },
  boar: { name: 'Javalizinho', tier: 1, mon: 'boar', price: 500 },
  slime: { name: 'Geleca', tier: 1, mon: 'slime', price: 450 },
  wasp: { name: 'Zunzum', tier: 1, mon: 'wasp', price: 550 },
  toad: { name: 'Sapeco', tier: 1, mon: 'toad', price: 700, req: { floor: 3 } },
  acornboar: { name: 'Bolotinha', tier: 1, mon: 'acornboar', price: 900, req: { floor: 5 } },
  // ─── Raros ───
  drake: { name: 'Draquinho', tier: 2, mon: 'drake', price: 4500, req: { floor: 4, level: 8 }, perk: { crit: 0.02 }, perkTxt: '+2% crítico' },
  cubeling: { name: 'Cubinho', tier: 2, mon: 'cubeling', price: 5200, req: { floor: 6, level: 10 }, perk: { defMul: 0.03 }, perkTxt: '+3% defesa' },
  wisp: { name: 'Faísca', tier: 2, mon: 'wisp', price: 5800, req: { floor: 6, level: 10 }, perk: { exp: 0.03 }, perkTxt: '+3% EXP' },
  frostwolf: { name: 'Floco', tier: 2, mon: 'frostwolf', price: 8000, req: { floor: 8, level: 14 }, perk: { spd: 0.03 }, perkTxt: '+3% velocidade' },
  emberfox: { name: 'Brasinha', tier: 2, mon: 'emberfox', price: 11000, req: { floor: 10, level: 18 }, perk: { atk: 0.02 }, perkTxt: '+2% ataque' },
  kitsune: { name: 'Kitsune', tier: 2, mon: 'kitsune', price: 16000, req: { floor: 14, level: 24 }, perk: { col: 0.05 }, perkTxt: '+5% Col' },
  // ─── Épicos ───
  lion: { name: 'Leão das Planícies', tier: 3, mon: 'lion', scale: 0.7, price: 45000, req: { floor: 20, level: 32 }, perk: { atk: 0.04 }, perkTxt: '+4% ataque' },
  rhino: { name: 'Rinoceronte de Guerra', tier: 3, mon: 'rhino', scale: 0.6, price: 60000, req: { floor: 24, level: 36 }, perk: { defMul: 0.06 }, perkTxt: '+6% defesa' },
  griffin: { name: 'Grifo', tier: 3, scale: 0.7, price: 90000, req: { floor: 28, level: 42 }, perk: { spd: 0.05, crit: 0.02 }, perkTxt: '+5% velocidade e +2% crítico',
    def: D({ name: 'Griffin', arch: 'quad', color: '#c8a060', color2: '#f4f0e8', wingColor: '#e8dcc8', ears: true, tail: true, wings: true, feather: true, wingSpan: 1.1, eye: '#ffd040' }) },
  yeti: { name: 'Yeti Mirim', tier: 3, mon: 'yeti', scale: 0.5, price: 70000, req: { floor: 26, level: 40 }, perk: { hp: 0.05 }, perkTxt: '+5% HP' },
  golem: { name: 'Golem de Bolso', tier: 3, mon: 'golem', scale: 0.45, price: 85000, req: { floor: 30, level: 45 }, perk: { defMul: 0.05, hp: 0.03 }, perkTxt: '+5% defesa e +3% HP' },
  // ─── Lendários: caros e com requisitos ───
  unicorn: { name: 'Unicórnio Celeste', tier: 4, scale: 0.75, price: 300000, req: { floor: 35, level: 50, bosses: 3 }, ability: 'holy', perk: { regen: 0.25, hp: 0.06 }, perkTxt: '+6% HP e regeneração +25%',
    def: D({ name: 'Unicorn', arch: 'quad', color: '#f6f4fa', color2: '#ffd0f0', horn: true, ears: true, tail: true, eye: '#8ab8ff', emissive: false }) },
  minotaur: { name: 'Minotauro', tier: 4, scale: 0.6, price: 380000, req: { floor: 40, level: 55, bosses: 4 }, ability: 'stomp', perk: { atk: 0.07 }, perkTxt: '+7% ataque',
    def: D({ name: 'Minotaur', arch: 'humanoid', color: '#6a3a24', color2: '#e0d0b0', horns: true, bulky: true, weapon: 'axe', eye: '#ff4a2a' }) },
  ogre: { name: 'Ogro da Montanha', tier: 4, scale: 0.6, price: 340000, req: { floor: 38, level: 52, bosses: 3 }, ability: 'stomp', perk: { hp: 0.1 }, perkTxt: '+10% HP',
    def: D({ name: 'Ogre', arch: 'humanoid', color: '#6a8a4a', color2: '#5a4430', bulky: true, ears: true, weapon: 'hammer', eye: '#ffd040' }) },
  giant: { name: 'Gigante de Pedra', tier: 4, scale: 0.85, price: 450000, req: { floor: 45, level: 60, bosses: 5 }, ability: 'stomp', perk: { defMul: 0.1, hp: 0.05 }, perkTxt: '+10% defesa e +5% HP',
    def: D({ name: 'Stone Giant', arch: 'humanoid', color: '#9a948a', color2: '#5a5650', bulky: true, eye: '#7ad8ff' }) },
  harpy: { name: 'Harpia', tier: 4, scale: 0.6, price: 320000, req: { floor: 36, level: 50, bosses: 3 }, ability: 'gust', perk: { spd: 0.07, crit: 0.03 }, perkTxt: '+7% velocidade e +3% crítico',
    def: D({ name: 'Harpy', arch: 'humanoid', color: '#c89a7a', color2: '#7a5aa8', wingColor: '#8a6ac8', wings: true, feather: true, wingSpan: 1.2, leaves: false, eye: '#ffe040' }) },
  wingedlion: { name: 'Leão Alado', tier: 4, scale: 0.75, price: 500000, req: { floor: 48, level: 62, bosses: 6 }, ability: 'roar', perk: { atk: 0.06, crit: 0.04 }, perkTxt: '+6% ataque e +4% crítico',
    def: D({ name: 'Winged Lion', arch: 'quad', color: '#e0b050', color2: '#a0602a', wingColor: '#f4ead0', ears: true, mane: true, tail: true, wings: true, feather: true, wingSpan: 1.3, eye: '#ffd040' }) },
  reddragon: { name: 'Dragão Vermelho', tier: 4, scale: 0.8, price: 650000, req: { floor: 55, level: 70, bosses: 8 }, ability: 'breath', perk: { atk: 0.08, bossDmg: 0.05 }, perkTxt: '+8% ataque e +5% de dano em chefes',
    def: D({ name: 'Red Dragon', arch: 'quad', color: '#a02a2a', color2: '#e0a040', wingColor: '#5a1a1a', horns: true, tail: true, wings: true, wingSpan: 1.6, eye: '#ffd040' }) },
  // ─── Míticos: só no Altar dos Cristais (gacha) ou por uma fortuna nos andares altos ───
  ancientdragon: { name: 'Dragão Ancestral', tier: 5, scale: 0.95, price: 2500000, req: { floor: 80, level: 100, bosses: 15 }, ability: 'breath', perk: { atk: 0.12, defMul: 0.08, bossDmg: 0.1 }, perkTxt: '+12% ataque, +8% defesa e +10% em chefes',
    def: D({ name: 'Ancient Dragon', arch: 'quad', color: '#1e1a24', color2: '#f0c040', wingColor: '#3a2a10', horns: true, tail: true, wings: true, wingSpan: 1.9, eye: '#ff9a20' }) },
  phoenix: { name: 'Fênix', tier: 5, scale: 0.9, price: 2000000, req: { floor: 75, level: 95, bosses: 12 }, ability: 'holy', perk: { regen: 0.6, hp: 0.1, secondWindX: 1 }, perkTxt: '+10% HP e regeneração +60%',
    def: D({ name: 'Phoenix', arch: 'flyer', color: '#ff6a1a', color2: '#ffd040', tail: true, emissive: true, eye: '#ffffff' }) },
  kirin: { name: 'Kirin do Trovão', tier: 5, scale: 0.8, price: 2200000, req: { floor: 78, level: 98, bosses: 13 }, ability: 'gust', perk: { spd: 0.1, crit: 0.06, atk: 0.06 }, perkTxt: '+10% velocidade, +6% crítico e +6% ataque',
    def: D({ name: 'Kirin', arch: 'quad', color: '#2a4a8a', color2: '#a8e0ff', horn: true, mane: true, tail: true, ears: true, emissive: false, eye: '#c8f0ff' }) },
};
for (const [k, v] of Object.entries(PETS)) v.id = k;

// mascotes domados nos campos que não estão no catálogo viram comuns (ou raros, se o monstro for forte)
export function petInfo(d) {
  if (!d) return null;
  const id = d.id || d.mon;
  if (PETS[id]) return PETS[id];
  const m = MONSTERS[d.mon];
  return { id, name: m?.name || 'Mascote', tier: d.tier || (m && m.hp + m.atk > 2.4 ? 2 : 1), mon: d.mon };
}
export const petMonDef = (d) => { const i = petInfo(d); return i?.def || MONSTERS[i?.mon || d?.mon] || MONSTERS.wolf; };
export const petScale = (d) => petInfo(d)?.scale || 0.55;

export const ABILITY_TXT = {
  breath: 'Sopro de fogo: queima tudo num cone à frente (a cada 12 s)',
  stomp: 'Pisada: dano em área e atordoa monstros próximos (a cada 10 s)',
  holy: 'Luz sagrada: cura 25% do seu HP e do time (a cada 20 s)',
  gust: 'Rajada: empurra e corta os monstros em volta (a cada 9 s)',
  roar: 'Rugido: você e o time causam +15% de dano por 8 s (a cada 18 s)',
};

// pode comprar? devolve o motivo se não puder
export function petReqFail(g, pet) {
  const r = pet.req || {}, p = g.state.player, pr = g.state.progress;
  if (r.floor && pr.highest < r.floor) return `chegue ao Andar ${r.floor}`;
  if (r.level && p.level < r.level) return `nível ${r.level}`;
  if (r.bosses && (p.fieldBossKills || 0) < r.bosses) return `derrote ${r.bosses} Chefes de Campo (${p.fieldBossKills || 0}/${r.bosses})`;
  return null;
}
