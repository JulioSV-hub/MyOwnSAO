// Skins (visuais colecionáveis): trocam a aparência do personagem inteiro, sem mudar atributos.
// Saem no Altar dos Cristais (gacha); algumas também podem ser compradas ou ganhas.
export const SKIN_TIERS = [null, null,
  { name: 'Rara', color: '#4f9ff7', stars: 2 },
  { name: 'Épica', color: '#b05aff', stars: 3 },
  { name: 'Lendária', color: '#f3a712', stars: 4 },
  { name: 'Mítica', color: '#ff4a6a', stars: 5 },
];

export const SKINS = {
  // ─── Raras ───
  explorer: { name: 'Explorador de Aincrad', tier: 2, desc: 'Túnica azul de viagem com cachecol.', look: { top: '#3a6a9a', pants: '#3a3028', boots: '#5a3a22', accent: '#d8b070', scarf: { color: '#c8a050' } } },
  hunter: { name: 'Caçador da Floresta', tier: 2, desc: 'Capuz verde e couro para andar sem ser visto.', look: { hair: 'hood', hood: '#3a5a2a', top: '#4a6a3a', pants: '#4a3a24', boots: '#3a2a18', accent: '#a08050', gloves: '#5a4028' } },
  corsair: { name: 'Corsário', tier: 2, desc: 'Casaco vermelho e chapéu de capitão.', look: { top: '#f0e8d8', coat: '#a02a2a', pants: '#2a2a3a', boots: '#1e1a18', accent: '#e0b040', hat: '#1e1a20' } },
  spring: { name: 'Primavera', tier: 2, desc: 'Roupas leves e uma coroa de flores.', look: { top: '#ffd0e0', pants: '#f0f0e0', skirt: '#ffb0c8', boots: '#f4f0e8', accent: '#7ac86a', crown: { color: '#ff8ab8', flowers: true } } },
  // ─── Épicas ───
  ninja: { name: 'Ninja das Sombras', tier: 3, desc: 'Roupa negra, máscara e cachecol vermelho. Silencioso como a noite.', look: { hair: 'hood', hood: '#16161c', top: '#1e1e26', pants: '#16161c', boots: '#101014', accent: '#a02020', gloves: '#16161c', mask: '#16161c', scarf: { color: '#c02020', long: true } } },
  samurai: { name: 'Samurai Carmesim', tier: 3, desc: 'Kabuto com crista dourada e armadura laqueada.', look: { top: '#8a1a1a', pants: '#1e1a20', skirt: '#2a1e24', boots: '#1e1a18', accent: '#e0b040', gloves: '#1e1a20', kabuto: { color: '#8a1a1a', crest: '#e8c050' }, pauldrons: { color: '#8a1a1a', trim: '#e0b040' } } },
  steelknight: { name: 'Cavaleiro de Aço', tier: 3, desc: 'Placas polidas e uma capa azul real.', look: { top: '#b8bcc4', pants: '#8a8e96', boots: '#5a5e66', accent: '#2a4a8a', gloves: '#9aa0a8', helmet: { color: '#c8ccd4', trim: '#2a4a8a', open: false }, pauldrons: { color: '#c8ccd4', trim: '#2a4a8a' }, cape: { color: '#2a4a8a', trim: '#e0c060' } } },
  archmage: { name: 'Arquimago', tier: 3, desc: 'Manto estrelado e chapéu pontudo. Brilha de leve.', look: { top: '#3a2a6a', coat: '#2a1e5a', pants: '#2a2050', boots: '#1e1838', accent: '#c8a0ff', wizHat: { color: '#2a1e5a', trim: '#e0c060' }, aura: { color: '#b08aff' } } },
  frost: { name: 'Realeza do Gelo', tier: 3, desc: 'Coroa de cristal de gelo e manto branco-azulado.', look: { top: '#e8f4ff', pants: '#c8e0f0', skirt: '#d8ecff', boots: '#f4f8ff', accent: '#7ab8e8', crown: { color: '#a8e0ff', ice: true }, cape: { color: '#c8e4ff', trim: '#ffffff' }, aura: { color: '#9ad8ff' } } },
  // ─── Lendárias ───
  kob: { name: 'Cavaleiros do Sangue', tier: 4, desc: 'O uniforme da guilda mais forte da linha de frente.', look: { top: '#f4f4f6', pants: '#f0f0f2', skirt: '#f4f4f6', boots: '#f0f0f2', accent: '#c0262c', gloves: '#f4f4f6', pauldrons: { color: '#f4f4f6', trim: '#c0262c' }, cape: { color: '#f4f4f6', trim: '#c0262c' } } },
  blackswords: { name: 'Espadachim Negro', tier: 4, desc: 'Sobretudo negro como a meia-noite. Dizem que é de um beater...', look: { top: '#18181f', coat: '#111116', pants: '#1c1c24', boots: '#101014', accent: '#4a4a55', gloves: '#16161c', aura: { color: '#6a7aff', dark: true } } },
  divine: { name: 'Divino', tier: 4, desc: 'Branco e dourado, auréola e asas de anjo.', look: { top: '#fbf8f0', coat: '#f4ecd8', pants: '#f8f4ea', boots: '#f0e0b0', accent: '#e8c050', gloves: '#fbf8f0', halo: { color: '#ffe080' }, wingsBack: { color: '#ffffff', feather: true, span: 1.1 }, aura: { color: '#ffe8a0' } } },
  demonlord: { name: 'Lorde Demônio', tier: 4, desc: 'Chifres, asas de morcego e um olhar que gela a alma.', look: { top: '#2a1418', coat: '#1a0c10', pants: '#1e1014', boots: '#140a0c', accent: '#d02a2a', gloves: '#2a1418', horns: { color: '#2a2024' }, wingsBack: { color: '#5a1018', feather: false, span: 1.15 }, aura: { color: '#ff3a3a', dark: true } } },
  dragonknight: { name: 'Cavaleiro Dragão', tier: 4, desc: 'Armadura de escamas, elmo de chifres e asas de dragão.', look: { top: '#8a2a1a', pants: '#4a1a10', boots: '#2a1410', accent: '#e0a040', gloves: '#6a2014', kabuto: { color: '#6a2014', crest: '#e0a040', dragon: true }, pauldrons: { color: '#8a2a1a', trim: '#e0a040' }, wingsBack: { color: '#8a2a1a', feather: false, span: 1.0 } } },
  // ─── Míticas ───
  celestial: { name: 'Imperador Celestial', tier: 5, desc: 'Coroa de ouro, capa real, auréola e asas douradas enormes.', look: { top: '#fff4d8', coat: '#f0d080', pants: '#fff0d0', boots: '#e8c050', accent: '#ffffff', gloves: '#f0d080', crown: { color: '#f0c040', gem: '#ff4a6a' }, halo: { color: '#fff0a0' }, cape: { color: '#c0262c', trim: '#f0c040' }, wingsBack: { color: '#ffd860', feather: true, span: 1.4 }, aura: { color: '#ffe060' } } },
  abyss: { name: 'Sombra Abissal', tier: 5, desc: 'Capuz do vazio, máscara, asas roxas e uma aura que engole a luz.', look: { hair: 'hood', hood: '#140e1e', top: '#1a1228', coat: '#100a18', pants: '#140e1e', boots: '#0a0610', accent: '#a04aff', gloves: '#140e1e', mask: '#0a0610', wingsBack: { color: '#3a1a5a', feather: false, span: 1.3 }, aura: { color: '#a04aff', dark: true } } },
};
for (const [k, v] of Object.entries(SKINS)) v.id = k;
