// Guilda dos Aventureiros: registro, postos (F → S) e bônus por posto.
export const RANKS = [
  { letter: 'F', pts: 0 }, { letter: 'E', pts: 120 }, { letter: 'D', pts: 300 }, { letter: 'C', pts: 600 },
  { letter: 'B', pts: 1000 }, { letter: 'A', pts: 1600 }, { letter: 'S', pts: 2500 },
];

// Posto atual: i = índice (0 = F). Cada posto dá +3% de EXP e 2% de desconto nas lojas.
export function guildRank(g) {
  if (!g) return null;
  let i = 0;
  while (i + 1 < RANKS.length && g.pts >= RANKS[i + 1].pts) i++;
  return { i, letter: RANKS[i].letter, next: RANKS[i + 1] || null, discount: i * 0.02, exp: i * 0.03 };
}

export const guildDiscount = (state) => guildRank(state?.guild)?.discount || 0;
