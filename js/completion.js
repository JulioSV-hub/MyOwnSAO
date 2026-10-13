// Conclusão de cada andar (0–100%) e recompensa ao completar tudo.
import { getFloor, ITEMS } from './data.js';
import { questsForFloor } from './quests.js';
import { Sfx } from './audio.js';

export const PARTS = [
  { key: 'boss', label: 'Chefe do andar', w: 25 },
  { key: 'quests', label: 'Missões do andar', w: 35 },
  { key: 'chests', label: 'Baús abertos', w: 15 },
  { key: 'landmarks', label: 'Marcos visitados', w: 10 },
  { key: 'fieldBoss', label: 'Chefe de Campo', w: 10 },
  { key: 'daily', label: 'Pedidos do Quadro/Guilda', w: 5 },
];
const DAILY_GOAL = 3;
const cache = new Map();

export function floorCompletion(state, n) {
  const fl = getFloor(n);
  if (!cache.has(n)) cache.set(n, questsForFloor(fl).filter((q) => !q.main && !q.daily).map((q) => ({ id: q.id, title: q.title, giver: q.chain ? 'chain' : q.giver })));
  // missões de quem não estava no andar quando você passou por lá não contam
  const givers = state.loot?.[n]?.givers;
  const quests = cache.get(n).filter((q) => !givers || !q.giver || givers.includes(q.giver));
  const lt = state.loot?.[n] || {};
  const done = state.quests?.done || {};
  const nC = lt.nC ?? 12, nL = lt.nL ?? (fl.landmarks?.length || 3);
  const parts = {
    boss: { have: state.progress.cleared[n] ? 1 : 0, need: 1 },
    quests: { have: quests.filter((q) => done[q.id]).length, need: quests.length, list: quests.map((q) => ({ ...q, done: !!done[q.id] })) },
    chests: { have: Math.min(nC, Object.keys(lt.c || {}).length), need: nC },
    landmarks: { have: Math.min(nL, (lt.lm || []).length), need: nL },
    fieldBoss: { have: lt.fbEver ? 1 : 0, need: 1 },
    daily: { have: Math.min(DAILY_GOAL, state.progress.dailyDone?.[n] || 0), need: DAILY_GOAL },
  };
  let pct = 0;
  for (const p of PARTS) { const x = parts[p.key]; pct += p.w * (x.need ? x.have / x.need : 1); }
  pct = Math.floor(pct + 1e-6);
  return { pct, parts, claimed: !!state.progress.complete?.[n] };
}

export function completionReward(n) {
  return { col: Math.round(1500 * (1 + n * 0.3)), elixir: true, talent: 1 };
}

// Confere o andar atual e entrega a recompensa ao bater 100%
export function checkCompletion(g) {
  const n = g.floor.n, st = g.state;
  const c = floorCompletion(st, n);
  if (c.pct < 100 || c.claimed) return;
  (st.progress.complete ||= {})[n] = true;
  const r = completionReward(n), p = st.player;
  p.col += r.col;
  const el = ['elixir_str', 'elixir_agi', 'elixir_vit'][Math.floor(Math.random() * 3)];
  p.items[el] = (p.items[el] || 0) + 1;
  p.bonusTalents = (p.bonusTalents || 0) + r.talent;
  Sfx.victory();
  g.effects.levelUp(g.player.pos.clone());
  setTimeout(() => g.ui.banner(`Andar ${n} — 100% concluído!`, `+${r.col.toLocaleString('pt-BR')} Col · ${ITEMS[el].name} · +1 ponto de talento bônus`, 6), 1200);
  g.save();
}
