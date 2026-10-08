// Todo o conteúdo do mundo mora aqui: biomas, monstros, chefes, Sword Skills, itens e andares.
// Quer criar algo novo? Edite este arquivo — o resto do jogo lê daqui.
import { mulberry32, pick, shuffle } from './rng.js';

export const MAX_FLOOR = 100;
export const expNeed = (lv) => Math.floor(60 * Math.pow(lv, 1.6));

// ───────────────────────────── Biomas ─────────────────────────────
export const BIOMES = {
  meadow: {
    label: 'Planícies verdejantes',
    ground: ['#4c8a36', '#69a844', '#8dbf56'], cliff: '#7b7a62', path: '#bba57c', plaza: '#a9a294',
    sky: { top: '#3b7bd8', bottom: '#cfe8ff' }, fog: [70, 470],
    trees: { style: 'round', count: 380, trunk: '#6b4a2b', leaf: ['#3f7d32', '#4f9a3c', '#5ea845'] },
    rocks: 110, rockColor: '#8b8a82', amp: 9, freq: 0.0075,
    pool: ['boar', 'wolf', 'kobold', 'wasp'],
  },
  plateau: {
    label: 'Planalto de mesas',
    ground: ['#9c8f45', '#b8aa58', '#d1c27a'], cliff: '#9a6a44', path: '#c8b08a', plaza: '#b0a490',
    sky: { top: '#4a86d0', bottom: '#f0e2c0' }, fog: [80, 480],
    trees: { style: 'round', count: 90, trunk: '#6b4a2b', leaf: ['#6f8a32', '#7f9a3c'] },
    rocks: 160, rockColor: '#a07a5a', amp: 24, freq: 0.006, terrace: 5,
    pool: ['ox', 'wasp', 'taurus', 'boar'],
  },
  forest: {
    label: 'Floresta ancestral',
    ground: ['#2f5a2a', '#3d6e33', '#4f7f3a'], cliff: '#5a5a48', path: '#8a7556', plaza: '#8f8a7c',
    sky: { top: '#3f6fa8', bottom: '#b8d8c0' }, fog: [30, 270],
    trees: { style: 'pine', count: 1100, trunk: '#4a3420', leaf: ['#1f4a24', '#2a5a2a', '#24502e'] },
    rocks: 90, rockColor: '#6e6e66', amp: 12, freq: 0.009,
    pool: ['spider', 'sapling', 'elf', 'wolf'],
  },
  lake: {
    label: 'Lagos cristalinos',
    ground: ['#5c9a52', '#78b064', '#cfc48c'], cliff: '#7a7a6a', path: '#c4ad84', plaza: '#a8a294',
    sky: { top: '#2f86e0', bottom: '#d8f0ff' }, fog: [70, 470],
    trees: { style: 'round', count: 260, trunk: '#6b4a2b', leaf: ['#3a8a3a', '#4aa04a', '#5ab05a'] },
    rocks: 80, rockColor: '#9a9a92', amp: 12, freq: 0.008, base: -3.5,
    water: { level: -1.4, color: '#3d8fc4', opacity: 0.8 },
    pool: ['toad', 'drake', 'lizard', 'wasp'],
  },
  ruins: {
    label: 'Ruínas esquecidas',
    ground: ['#6f7f5f', '#86906e', '#9a9a86'], cliff: '#6a665e', path: '#a49a86', plaza: '#9a968c',
    sky: { top: '#5a7aa0', bottom: '#d0d8d8' }, fog: [50, 400],
    trees: { style: 'dead', count: 160, trunk: '#5a4a3a', leaf: ['#5a4a3a'] },
    rocks: 200, rockColor: '#8a8680', amp: 10, freq: 0.008, ruins: true,
    pool: ['golem', 'ghost', 'skeleton'],
  },
  crystal: {
    label: 'Vale dos cristais',
    ground: ['#5a5a96', '#7272b4', '#9494d6'], cliff: '#4a4a7a', path: '#b0aed0', plaza: '#a4a2c0',
    sky: { top: '#3a3a9a', bottom: '#e0d0ff' }, fog: [60, 420],
    trees: { style: 'crystal', count: 300, trunk: '#5a5a7a', leaf: ['#7fd0ff', '#b08aff', '#ff9ae0'] },
    rocks: 120, rockColor: '#6a6aa0', amp: 14, freq: 0.008,
    pool: ['cubeling', 'slime', 'wisp'],
  },
  snow: {
    label: 'Campos congelados',
    ground: ['#cfd9e2', '#e6edf3', '#ffffff'], cliff: '#8a96a4', path: '#a8b4c0', plaza: '#b8c0c8',
    sky: { top: '#6a90c0', bottom: '#e8f0f8' }, fog: [50, 380],
    trees: { style: 'pine', count: 500, trunk: '#4a3a30', leaf: ['#e8f0f4', '#cfdde6', '#3a5a4a'] },
    rocks: 120, rockColor: '#9aa4ae', amp: 16, freq: 0.007,
    pool: ['frostwolf', 'yeti', 'wisp'],
  },
  desert: {
    label: 'Dunas escaldantes',
    ground: ['#cfa95e', '#e0c080', '#c49656'], cliff: '#a8784a', path: '#e8d4a8', plaza: '#d0c0a0',
    sky: { top: '#3f8ae0', bottom: '#fbe8c8' }, fog: [90, 500],
    trees: { style: 'dead', count: 60, trunk: '#7a5a3a', leaf: ['#7a5a3a'] },
    rocks: 140, rockColor: '#b88a5a', amp: 15, freq: 0.006,
    pool: ['scorpion', 'skeleton', 'wasp'],
  },
  volcanic: {
    label: 'Terras vulcânicas',
    ground: ['#3a2a28', '#4a3230', '#5e3c2c'], cliff: '#2a2020', path: '#6a5048', plaza: '#5a4c48',
    sky: { top: '#3a1a1a', bottom: '#d07040' }, fog: [40, 330],
    trees: { style: 'dead', count: 90, trunk: '#2a2020', leaf: ['#2a2020'] },
    rocks: 220, rockColor: '#3a3030', amp: 16, freq: 0.008, base: -2.5,
    water: { level: -2.2, color: '#ff5a1a', opacity: 1, lava: true },
    pool: ['magma', 'flamewisp', 'golem'],
  },
  dark: {
    label: 'Bosque sombrio',
    ground: ['#283838', '#324646', '#3e5656'], cliff: '#2a2a34', path: '#4a4a5a', plaza: '#4a4a56',
    sky: { top: '#1a1a3a', bottom: '#6a5a8a' }, fog: [30, 280],
    trees: { style: 'dead', count: 420, trunk: '#2a2630', leaf: ['#2a2630'] },
    rocks: 150, rockColor: '#4a4a56', amp: 13, freq: 0.009,
    pool: ['shadowknight', 'ghost', 'lizard', 'spider'],
  },
};

// ───────────────────────────── Monstros ─────────────────────────────
// arch: quad | humanoid | flyer | slime | spider | cube
export const MONSTERS = {
  boar: { name: 'Frenzy Boar', arch: 'quad', color: '#8a5a3c', color2: '#efe6d2', tusks: true, scale: 1, speed: 4.6, hp: 1, atk: 0.9, aggro: 10, range: 1.7, windup: 0.55, drop: ['Carne de Javali', 6] },
  wolf: { name: 'Dire Wolf', arch: 'quad', color: '#59606b', color2: '#2a2d33', ears: true, scale: 0.9, speed: 6.2, hp: 0.85, atk: 1.05, aggro: 17, range: 1.7, windup: 0.45, drop: ['Presa de Lobo', 9] },
  kobold: { name: 'Ruin Kobold Trooper', arch: 'humanoid', color: '#9a6b3a', color2: '#5b4a3a', weapon: 'axe', ears: true, scale: 0.95, speed: 4.2, hp: 1.2, atk: 1.1, aggro: 14, range: 2.2, windup: 0.65, drop: ['Fragmento Kobold', 10] },
  wasp: { name: 'Wind Wasp', arch: 'flyer', color: '#d9c23a', color2: '#26241e', stinger: true, scale: 0.8, speed: 5.5, hp: 0.7, atk: 0.95, aggro: 15, range: 2.1, windup: 0.5, drop: ['Ferrão de Vespa', 8] },
  ox: { name: 'Trembling Ox', arch: 'quad', color: '#6b4b2e', color2: '#e8dcc0', horns: true, scale: 1.5, speed: 3.6, hp: 1.7, atk: 1.2, aggro: 9, range: 2.4, windup: 0.75, drop: ['Couro de Boi', 14] },
  taurus: { name: 'Lesser Taurus Striker', arch: 'humanoid', color: '#7a3d2a', color2: '#e0d0b0', horns: true, weapon: 'hammer', scale: 1.25, speed: 4, hp: 1.5, atk: 1.25, aggro: 14, range: 2.6, windup: 0.75, drop: ['Chifre de Taurus', 15] },
  spider: { name: 'Giant Forest Spider', arch: 'spider', color: '#3d3a2a', color2: '#8a2a2a', scale: 1, speed: 5, hp: 1, atk: 1.1, aggro: 13, range: 2, windup: 0.5, drop: ['Seda de Aranha', 11] },
  sapling: { name: 'Treant Sapling', arch: 'humanoid', color: '#5b4528', color2: '#4f8f3a', leaves: true, bulky: true, scale: 1.15, speed: 3.2, hp: 1.6, atk: 1.1, aggro: 10, range: 2.4, windup: 0.8, eye: '#ffd040', drop: ['Galho Antigo', 12] },
  elf: { name: 'Forest Elven Scout', arch: 'humanoid', color: '#355c3a', color2: '#c8b88a', weapon: 'sword', ears: true, scale: 1, speed: 5.2, hp: 1.1, atk: 1.2, aggro: 18, range: 2.3, windup: 0.5, eye: '#70ffa0', drop: ['Emblema Élfico', 16] },
  toad: { name: 'Scavenger Toad', arch: 'slime', color: '#6a8a3a', color2: '#d8d070', scale: 1.1, speed: 4, hp: 1.1, atk: 1, aggro: 10, range: 1.9, windup: 0.6, eye: '#ffe060', drop: ['Língua de Sapo', 9] },
  drake: { name: 'Lake Drake', arch: 'flyer', color: '#3a7aa0', color2: '#9fd8f0', tail: true, scale: 1.2, speed: 5, hp: 1.2, atk: 1.15, aggro: 16, range: 2.3, windup: 0.6, eye: '#ffd040', drop: ['Escama de Drake', 15] },
  lizard: { name: 'Lizardman', arch: 'humanoid', color: '#4a8a5a', color2: '#c8b070', weapon: 'sword', shield: true, tail: true, scale: 1.1, speed: 5, hp: 1.25, atk: 1.2, aggro: 16, range: 2.4, windup: 0.55, eye: '#ffe040', drop: ['Escama de Lagarto', 14] },
  golem: { name: 'Stone Golem', arch: 'humanoid', color: '#8a8a86', color2: '#5a5a58', bulky: true, scale: 1.6, speed: 2.8, hp: 2.2, atk: 1.4, aggro: 9, range: 2.9, windup: 0.95, eye: '#5ad1ff', drop: ['Núcleo de Pedra', 20] },
  ghost: { name: 'Wandering Ghost', arch: 'flyer', color: '#bcd0e8', color2: '#7aaaff', ghost: true, wingless: true, scale: 1, speed: 4.5, hp: 0.8, atk: 1.1, aggro: 15, range: 2.1, windup: 0.55, eye: '#60a0ff', drop: ['Ectoplasma', 13] },
  skeleton: { name: 'Skeleton Swordsman', arch: 'humanoid', color: '#e2ddd0', color2: '#3a3530', weapon: 'sword', scale: 1, speed: 4.6, hp: 1, atk: 1.25, aggro: 15, range: 2.3, windup: 0.5, eye: '#60a0ff', drop: ['Osso Antigo', 12] },
  cubeling: { name: 'Shard Cube', arch: 'cube', color: '#4aa8d8', color2: '#aeeeff', scale: 0.9, speed: 4, hp: 1.1, atk: 1.1, aggro: 13, range: 2.1, windup: 0.6, drop: ['Fragmento Cúbico', 14] },
  slime: { name: 'Crystal Slime', arch: 'slime', color: '#7fd0ff', color2: '#ffffff', glassy: true, scale: 1, speed: 3.6, hp: 1, atk: 1, aggro: 10, range: 1.9, windup: 0.6, eye: '#2040ff', drop: ['Gel Cristalino', 10] },
  wisp: { name: "Will-o'-Wisp", arch: 'flyer', color: '#a8f0ff', color2: '#ffffff', ghost: true, wingless: true, emissive: true, scale: 0.7, speed: 5.5, hp: 0.7, atk: 1.15, aggro: 16, range: 2.1, windup: 0.45, eye: '#ffffff', drop: ['Essência de Luz', 13] },
  frostwolf: { name: 'Frost Wolf', arch: 'quad', color: '#dfe8f0', color2: '#7aa0c0', ears: true, scale: 1, speed: 6.4, hp: 1, atk: 1.15, aggro: 18, range: 1.8, windup: 0.45, eye: '#60c0ff', drop: ['Pelagem Gélida', 14] },
  yeti: { name: 'Snow Yeti', arch: 'humanoid', color: '#eef2f6', color2: '#6a8ab0', bulky: true, horns: true, scale: 1.5, speed: 3.6, hp: 2, atk: 1.35, aggro: 12, range: 2.8, windup: 0.85, eye: '#60c0ff', drop: ['Pelo de Yeti', 18] },
  scorpion: { name: 'Desert Scorpion', arch: 'spider', color: '#b8843a', color2: '#5a3a1a', stinger: true, scale: 1.1, speed: 4.8, hp: 1.2, atk: 1.2, aggro: 13, range: 2.1, windup: 0.55, drop: ['Garra de Escorpião', 14] },
  magma: { name: 'Magma Slime', arch: 'slime', color: '#ff5a1a', color2: '#ffd27a', emissive: true, scale: 1.1, speed: 3.6, hp: 1.2, atk: 1.25, aggro: 11, range: 2, windup: 0.6, eye: '#ffffa0', drop: ['Núcleo de Magma', 15] },
  flamewisp: { name: 'Flame Wisp', arch: 'flyer', color: '#ff8a3a', color2: '#ffe0a0', ghost: true, wingless: true, emissive: true, scale: 0.8, speed: 5.5, hp: 0.8, atk: 1.25, aggro: 16, range: 2.1, windup: 0.45, eye: '#ffffff', drop: ['Brasa Viva', 14] },
  shadowknight: { name: 'Shadow Knight', arch: 'humanoid', color: '#2a2a34', color2: '#5a3a8a', weapon: 'zweihander', horns: true, scale: 1.2, speed: 4.4, hp: 1.6, atk: 1.35, aggro: 16, range: 2.8, windup: 0.7, eye: '#c03aff', drop: ['Fragmento Sombrio', 20] },
};

// ───────────────────────────── Chefes e andares ─────────────────────────────
const CANON = {
  1: { town: 'Town of Beginnings', biome: 'meadow', monsters: ['boar', 'wolf', 'kobold'],
    boss: { name: 'Illfang the Kobold Lord', arch: 'humanoid', color: '#b5462f', color2: '#d8c080', weapon: 'axe', shield: true, ears: true, scale: 3, bars: 4,
      enrageWeapon: 'katana', enrageText: 'Illfang joga fora o machado e o escudo — e saca um nodachi!', adds: ['kobold'] } },
  2: { town: 'Urbus', biome: 'plateau', monsters: ['ox', 'wasp', 'taurus'],
    boss: { name: 'Asterius the Taurus King', arch: 'humanoid', color: '#4a3070', color2: '#e0c060', weapon: 'hammer', horns: true, bulky: true, scale: 3.3, bars: 4, adds: ['taurus'] } },
  3: { town: 'Zumfut', biome: 'forest', monsters: ['spider', 'sapling', 'elf'],
    boss: { name: 'Nerius the Evil Treant', arch: 'humanoid', color: '#5a4228', color2: '#3f7f2a', leaves: true, bulky: true, scale: 3.4, bars: 4, eye: '#ffd040', adds: ['sapling'] } },
  4: { town: 'Rovia', biome: 'lake', monsters: ['toad', 'drake', 'lizard'],
    boss: { name: 'Wythege the Hippocampus', arch: 'quad', color: '#3a8ab0', color2: '#e0f4ff', horns: true, tail: true, scale: 3.2, bars: 4, eye: '#ffe040' } },
  5: { town: 'Karluin', biome: 'ruins', monsters: ['golem', 'ghost', 'skeleton'],
    boss: { name: 'Fuscus the Vacant Colossus', arch: 'humanoid', color: '#7a7a74', color2: '#4a4a46', bulky: true, scale: 3.8, bars: 4, eye: '#5ad1ff', adds: ['golem'] } },
  6: { town: 'Stachion', biome: 'crystal', monsters: ['cubeling', 'slime', 'wisp'],
    boss: { name: 'The Irrational Cube', arch: 'cube', color: '#3a7ad8', color2: '#bff4ff', scale: 3.4, bars: 4, adds: ['cubeling'] } },
  22: { town: 'Coral', biome: 'lake', monsters: ['boar', 'wasp', 'toad'], desc: 'Um andar tranquilo de lagos e florestas — dizem que há uma cabana à venda por aqui.' },
  48: { town: 'Lindarth', biome: 'meadow' },
  50: { town: 'Algade', biome: 'ruins', monsters: ['skeleton', 'golem', 'shadowknight'] },
  55: { town: 'Granzam', biome: 'snow', monsters: ['frostwolf', 'yeti', 'wisp'] },
  61: { town: 'Selmburg', biome: 'lake' },
  74: { town: 'Kamdet', biome: 'dark', monsters: ['shadowknight', 'lizard', 'skeleton'],
    boss: { name: 'The Gleam Eyes', arch: 'humanoid', color: '#2a4aa0', color2: '#1a1a30', weapon: 'zweihander', horns: true, bulky: true, scale: 3.6, bars: 4, eye: '#60d0ff' } },
  75: { town: 'Collinia', biome: 'ruins', monsters: ['skeleton', 'ghost', 'shadowknight'],
    boss: { name: 'The Skull Reaper', arch: 'spider', color: '#e0dccc', color2: '#8a8070', scythes: true, scale: 3.4, bars: 5, eye: '#40c0ff', speed: 6 } },
  100: { town: 'Ruby Palace', biome: 'dark',
    boss: { name: 'Heathcliff — Holy Sword', arch: 'humanoid', color: '#b02020', color2: '#e8e8f0', weapon: 'sword', shield: true, scale: 1.6, bars: 6, hpMul: 26, eye: '#ffd0a0', speed: 6.5 } },
};

const TOWN_NAMES = ['Tolbana', 'Horunka', 'Medai', 'Marome', 'Taran', 'Lindarth', 'Mishe', 'Lecte', 'Frieven', 'Ronbaru',
  'Floria', 'Danac', 'Pani', 'Yubelia', 'Rindo', 'Felicia', 'Mirmont', 'Ashtora', 'Belcourt', 'Nerine', 'Ostar', 'Verdance',
  'Caeloria', 'Silvanis', 'Ardent', 'Mistvale', 'Dawnrest', 'Ironhold', 'Lumen', 'Eventide'];

function genBoss(n, rand) {
  const arch = pick(rand, ['humanoid', 'humanoid', 'quad', 'spider', 'cube', 'flyer']);
  const first = pick(rand, ['Vorgath', 'Kaldris', 'Zerath', 'Morvane', 'Thalgor', 'Ixion', 'Ragnul', 'Sylvara', 'Drakkon', 'Velkar', 'Ombrath', 'Azureth', 'Gorvak', 'Nyxara']);
  const titles = {
    humanoid: ['the Fallen King', 'the Iron Titan', 'the Crimson Knight', 'the Ancient Guardian', 'the Twin-Blade Warlord'],
    quad: ['the Behemoth', 'the Wild Lord', 'the Horned Beast'],
    spider: ['the Venom Queen', 'the Bone Crawler'],
    cube: ['the Prism Core', 'the Geometric Sentinel'],
    flyer: ['the Storm Wyvern', 'the Phantom Sovereign'],
  };
  const hue = rand();
  const color = `hsl(${Math.round(hue * 360)}, 45%, 38%)`;
  const color2 = `hsl(${Math.round(((hue + 0.45) % 1) * 360)}, 55%, 62%)`;
  return {
    name: `${first} ${pick(rand, titles[arch])}`, arch, color, color2,
    weapon: pick(rand, ['axe', 'hammer', 'zweihander', 'katana', 'sword']),
    horns: rand() < 0.5, bulky: rand() < 0.5, shield: rand() < 0.25, tail: rand() < 0.5, scythes: arch === 'spider' && rand() < 0.5,
    scale: arch === 'flyer' ? 2.6 : 3.2 + rand() * 0.6, bars: 3 + Math.floor(n / 25),
  };
}

export function getFloor(n) {
  const rand = mulberry32(n * 7919 + 17);
  const c = CANON[n] || {};
  const biomeKey = c.biome || pick(rand, Object.keys(BIOMES));
  const biome = BIOMES[biomeKey];
  const monsters = c.monsters || shuffle(rand, biome.pool).slice(0, 3);
  const boss = c.boss || genBoss(n, rand);
  const town = c.town || TOWN_NAMES[Math.floor(rand() * TOWN_NAMES.length)];
  return { n, town, biomeKey, biome, monsters, boss, level: 1 + (n - 1) * 3, seed: n * 104729 + 7, desc: c.desc || biome.label };
}

// ───────────────────────────── Sword Skills ─────────────────────────────
// Cada golpe ("move") é um corte (slash) ou estocada (thrust).
// slash: tilt = inclinação do plano do corte (0 = horizontal, π/2 = vertical), from/to = arco do golpe.
const PI = Math.PI;
const S = (tilt, from, to, dur, mul, o = {}) => ({ type: 'slash', tilt, from, to, dur, mul, ...o });
const T = (dur, mul, o = {}) => ({ type: 'thrust', dur, mul, ...o });

function flurry(n, mul, dur, dual) {
  const tilts = [0.6, PI - 0.6, PI / 2, 0.15, PI - 0.2, 1.1, -PI / 2, PI - 1.1];
  const moves = [];
  for (let i = 0; i < n; i++) {
    const hand = dual ? (i % 2 ? 'L' : 'R') : 'R';
    moves.push(S(tilts[i % tilts.length], -1.3, 1.3, dur, mul, { hand, wind: 0.035 }));
  }
  const last = moves[n - 1];
  last.mul = mul * 2.2; last.dur = dur * 1.5; last.wind = 0.12; last.tilt = PI / 2;
  return moves;
}

function rosario() {
  const spots = [[-0.12, 0.1], [0.12, -0.1], [0.1, 0.12], [-0.1, -0.12], [0, 0.16], [0.16, 0], [0, -0.16], [-0.16, 0], [0.06, 0.06], [-0.06, -0.06]];
  const moves = spots.map(([ox, oy]) => T(0.055, 0.9, { ox, oy, wind: 0.03, reach: 4 }));
  moves.push(T(0.12, 3.5, { wind: 0.2, reach: 5, lunge: 10 }));
  return moves;
}

export const SKILLS = [
  { id: 'slant', name: 'Slant', lvl: 1, color: '#5ad1ff', cd: 2.5, post: 0.3, desc: 'Corte diagonal rápido. A primeira Sword Skill de todo espadachim.',
    moves: [S(0.75, -1.4, 1.4, 0.16, 1.7, { wind: 0.12 })] },
  { id: 'vertical', name: 'Vertical', lvl: 3, color: '#6fb6ff', cd: 3, post: 0.35, desc: 'Corte vertical poderoso de cima para baixo.',
    moves: [S(PI / 2, -1.5, 1.3, 0.16, 1.9, { wind: 0.14 })] },
  { id: 'horizontal', name: 'Horizontal', lvl: 4, color: '#62e6ff', cd: 3, post: 0.35, desc: 'Corte horizontal amplo — atinge vários inimigos.',
    moves: [S(0.05, -1.6, 1.6, 0.2, 1.6, { arc: -0.2, wind: 0.12 })] },
  { id: 'rage_spike', name: 'Rage Spike', lvl: 6, color: '#ffd35a', cd: 5, post: 0.4, desc: 'Investida com estocada que fecha a distância.',
    moves: [T(0.2, 2, { wind: 0.18, lunge: 13, reach: 3.8 })] },
  { id: 'horizontal_arc', name: 'Horizontal Arc', lvl: 8, color: '#4ef0ff', cd: 5, post: 0.45, desc: 'Dois cortes horizontais, ida e volta.',
    moves: [S(0.1, -1.5, 1.5, 0.15, 1.4, { arc: -0.1, wind: 0.1 }), S(PI - 0.1, -1.5, 1.5, 0.15, 1.5, { arc: -0.1, wind: 0.06 })] },
  { id: 'sonic_leap', name: 'Sonic Leap', lvl: 10, color: '#b8ff6a', cd: 6, post: 0.45, desc: 'Salto relâmpago até o alvo com um corte descendente.',
    moves: [S(1.15, -1.5, 1.3, 0.18, 2.4, { wind: 0.3, lunge: 17 })] },
  { id: 'vertical_arc', name: 'Vertical Arc', lvl: 12, color: '#7aa8ff', cd: 6, post: 0.45, desc: 'Dois cortes em "V": desce e sobe.',
    moves: [S(PI / 2 - 0.35, -1.4, 1.3, 0.14, 1.6, { wind: 0.12 }), S(-(PI / 2 - 0.35), -1.3, 1.4, 0.14, 1.7, { wind: 0.05 })] },
  { id: 'vertical_square', name: 'Vertical Square', lvl: 14, color: '#5a8cff', cd: 8, post: 0.6, desc: 'Quatro cortes verticais formando um quadrado.',
    moves: [S(PI / 2 - 0.2, -1.4, 1.3, 0.12, 1.25, { wind: 0.12 }), S(-(PI / 2 - 0.2), -1.3, 1.4, 0.12, 1.25, { wind: 0.05 }),
      S(PI / 2 + 0.2, -1.4, 1.3, 0.12, 1.25, { wind: 0.05 }), S(-(PI / 2 + 0.2), -1.3, 1.4, 0.13, 1.9, { wind: 0.08 })] },
  { id: 'horizontal_square', name: 'Horizontal Square', lvl: 17, color: '#40f0e0', cd: 9, post: 0.6, desc: 'Quatro cortes horizontais em giro — controla multidões.',
    moves: [S(0.05, -1.6, 1.6, 0.13, 1.3, { arc: -0.4, wind: 0.1 }), S(PI - 0.05, -1.6, 1.6, 0.13, 1.3, { arc: -0.4, wind: 0.05 }),
      S(0.15, -1.6, 1.6, 0.13, 1.3, { arc: -0.4, wind: 0.05 }), S(PI - 0.15, -1.6, 1.6, 0.14, 1.9, { arc: -0.4, wind: 0.06 })] },
  { id: 'vorpal_strike', name: 'Vorpal Strike', lvl: 20, color: '#ff3b3b', cd: 10, post: 0.9, desc: 'Estocada devastadora de longo alcance. Atravessa a armadura.',
    moves: [T(0.18, 4.2, { wind: 0.42, reach: 7.5, lunge: 9 })] },
  { id: 'savage_fulcrum', name: 'Savage Fulcrum', lvl: 23, color: '#ffa53a', cd: 9, post: 0.6, desc: 'Três cortes pesados: horizontal, vertical e diagonal.',
    moves: [S(0.05, -1.5, 1.5, 0.14, 1.7, { wind: 0.12 }), S(PI / 2, -1.5, 1.3, 0.14, 1.7, { wind: 0.06 }), S(0.9, -1.5, 1.4, 0.15, 2.1, { wind: 0.06 })] },
  { id: 'starburst_stream', name: 'Starburst Stream', lvl: 25, dual: true, color: '#bfe9ff', cd: 30, post: 1.4, desc: '[Dual Blades] Dezesseis golpes alternando as duas espadas. Rápido como as estrelas.',
    moves: flurry(16, 0.95, 0.075, true) },
  { id: 'howling_octave', name: 'Howling Octave', lvl: 28, color: '#ffe066', cd: 14, post: 0.8, desc: 'Oito golpes: cinco estocadas, um corte para baixo, um para cima e um final.',
    moves: [...Array.from({ length: 5 }, () => T(0.06, 0.9, { wind: 0.04 })), S(PI / 2, -1.4, 1.3, 0.1, 1.2, { wind: 0.05 }),
      S(-PI / 2, -1.3, 1.4, 0.1, 1.2, { wind: 0.04 }), S(0.6, -1.5, 1.5, 0.15, 2.6, { wind: 0.1 })] },
  { id: 'nova_ascension', name: 'Nova Ascension', lvl: 32, color: '#9dff6a', cd: 16, post: 0.9, desc: 'Dez golpes de velocidade absurda.',
    moves: flurry(10, 1.1, 0.075, false) },
  { id: 'the_eclipse', name: 'The Eclipse', lvl: 40, dual: true, color: '#fff1a8', cd: 45, post: 1.8, desc: '[Dual Blades] Vinte e sete golpes. A técnica suprema das duas espadas.',
    moves: flurry(27, 0.85, 0.06, true) },
  { id: 'mother_rosario', name: "Mother's Rosario", lvl: 45, color: '#c38bff', cd: 35, post: 1.2, desc: 'Onze estocadas em cruz — o legado de Yuuki.',
    moves: rosario() },
];
export const skillById = (id) => SKILLS.find((s) => s.id === id);

// ───────────────────────────── Itens ─────────────────────────────
export const ITEMS = {
  potion: { name: 'Poção de Cura', desc: 'Recupera 45% do HP ao longo de 5s.', price: 40, heal: 0.45, over: 5 },
  hipotion: { name: 'Poção Superior', desc: 'Recupera 100% do HP ao longo de 6s.', price: 180, heal: 1, over: 6, minFloor: 3 },
  heal_crystal: { name: 'Cristal de Cura', desc: 'Recupera todo o HP instantaneamente.', price: 600, heal: 1, over: 0, minFloor: 5 },
  teleport_crystal: { name: 'Cristal de Teletransporte', desc: 'Teletransporta para qualquer andar desbloqueado, de qualquer lugar.', price: 250 },
};

const GEN_W = ['Espada Longa de Ferro', 'Espada de Aço', 'Lâmina de Bronze Polido', 'Espada de Mithril', 'Lâmina Cristalina',
  'Espada Rúnica', 'Lâmina Obsidiana', 'Espada do Vento', 'Lâmina Celeste', 'Espada Dracônica'];
const W_COLORS = ['#c8d0d8', '#d8dde4', '#d8b080', '#c0e8ff', '#a8f0ff', '#d0c0ff', '#3a3a48', '#c8ffe8', '#e8f4ff', '#ff9a7a'];
const RARE_W = {
  1: ['Anneal Blade', '#bcd8e8'], 2: ['Sword of Eventide', '#e0a050'], 5: ["Queen's Knightsword", '#e8e0b0'],
  50: ['Elucidator', '#202028'], 55: ['Dark Repulser', '#7fe8e0'], 74: ['Liberator', '#f0f0ff'], 100: ['Night Sky Sword', '#181830'],
};
const RARE_POOL = [['Blue Rose Sword', '#a8c8ff'], ['Lambent Light', '#f4f4ff'], ['Fragrant Olive Sword', '#ffd27a'], ['Excalibur', '#ffe08a'],
  ['Silver Wolf Fang', '#e0e4ea'], ['Crimson Longsword', '#ff5a5a'], ['Moonlit Edge', '#c0d0ff'], ['Gilded Edge', '#f0c060'], ['Verdant Fang', '#7aff9a']];

export function weaponDef(id) {
  if (!id || id === 'small_sword') return { id: 'small_sword', name: 'Small Sword', atk: 14, price: 30, rarity: 0, blade: '#c8d0d8' };
  const m = /^(gen|rare)_(\d+)$/.exec(id);
  if (!m) return weaponDef('small_sword');
  const n = +m[2], rare = m[1] === 'rare';
  const atk = Math.round((14 + n * 8.5) * (rare ? 1.35 : 1));
  if (rare) {
    const [name, blade] = RARE_W[n] || RARE_POOL[n % RARE_POOL.length];
    return { id, name, atk, price: Math.round(150 * Math.pow(n, 1.35)), rarity: 2, blade, floor: n };
  }
  const i = (n - 1) % GEN_W.length, tier = Math.floor((n - 1) / GEN_W.length);
  return { id, name: GEN_W[i] + (tier ? ` +${tier}` : ''), atk, price: Math.round(120 * Math.pow(n, 1.35)), rarity: 1, blade: W_COLORS[i], floor: n };
}

const GEN_A = ['Gibão de Couro Reforçado', 'Cota de Malha', 'Armadura de Escamas', 'Manto do Viajante', 'Peitoral de Aço', 'Manto Encantado'];
const RARE_A = { 1: 'Coat of Midnight', 50: 'Blackwyrm Coat', 25: 'Armadura dos Cavaleiros do Sangue' };
const RARE_A_POOL = ['Manto Celeste', 'Armadura do Dragão', 'Manto das Sombras', 'Couraça Divina', 'Manto do Guardião'];

export function armorDef(id) {
  if (!id || id === 'leather') return { id: 'leather', name: 'Roupas de Couro', def: 2, hp: 0, price: 20, rarity: 0 };
  const m = /^(arm|rarm)_(\d+)$/.exec(id);
  if (!m) return armorDef('leather');
  const n = +m[2], rare = m[1] === 'rarm';
  const k = rare ? 1.35 : 1;
  const def = Math.round((3 + n * 2.4) * k), hp = Math.round(18 * n * k);
  if (rare) return { id, name: RARE_A[n] || RARE_A_POOL[n % RARE_A_POOL.length], def, hp, price: Math.round(130 * Math.pow(n, 1.3)), rarity: 2, floor: n };
  const i = (n - 1) % GEN_A.length, tier = Math.floor((n - 1) / GEN_A.length);
  return { id, name: GEN_A[i] + (tier ? ` +${tier}` : ''), def, hp, price: Math.round(100 * Math.pow(n, 1.3)), rarity: 1, floor: n };
}

// Last Attack Bonus: item raro para quem desfere o golpe final no chefe.
export function laReward(n) {
  if (n === 1) return { kind: 'armor', id: 'rarm_1' };
  if (RARE_W[n]) return { kind: 'weapon', id: `rare_${n}` };
  return n % 2 ? { kind: 'armor', id: `rarm_${n}` } : { kind: 'weapon', id: `rare_${n}` };
}

export function shopStock(n) {
  const items = Object.entries(ITEMS).filter(([, d]) => !d.minFloor || n >= d.minFloor).map(([id]) => id);
  return { items, weapons: [`gen_${n}`], armors: [`arm_${n}`] };
}
