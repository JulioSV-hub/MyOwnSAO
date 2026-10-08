# Sword Art Online — Meu Mundo

Um RPG de ação em primeira pessoa inspirado em Aincrad, rodando 100% no navegador (HTML + JavaScript + Three.js). Sem servidor e sem instalação.

## Como jogar no seu PC

Dê dois cliques em **`jogar.bat`**. Ele abre o navegador em `http://localhost:8765`.
(Abrir o `index.html` direto não funciona, porque o navegador bloqueia módulos JavaScript em arquivos locais.)

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub (ex.: `meu-aincrad`) e envie todos os arquivos desta pasta para ele.
2. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. Em 1–2 minutos o jogo estará em `https://SEU-USUARIO.github.io/meu-aincrad/`.

> Seu progresso fica salvo **no seu navegador** (localStorage), então ninguém vê o seu mundo. Mas em contas gratuitas o GitHub Pages só funciona com repositório **público**, ou seja, o código e o link ficam acessíveis a quem souber o endereço. Use *Sistema → Exportar mundo* para levar seu save para outro PC/navegador.

## Controles

| Tecla | Ação |
|---|---|
| WASD | Mover |
| Shift | Correr |
| Espaço | Pular |
| Q | Esquiva (invencível por um instante) |
| Clique esquerdo | Ataque (combo de 3 golpes) |
| Botão direito | Defender — no instante certo vira **Parry** e atordoa o inimigo |
| 1–4 | Sword Skills |
| R | Poção |
| E | Interagir (Portal, loja do Agil, porta do Labirinto) |
| Tab / Esc | Menu |

## O que tem no jogo

- **Andares de Aincrad (1–100)** gerados de forma procedural, com 10 biomas. Vários são canônicos: Town of Beginnings, Urbus, Zumfut, Coral, Algade, Kamdet, Collinia...
- **Chefes de andar** com barras de HP múltiplas, ataques telegrafados, reforços e fúria na última barra: Illfang, Asterius, The Irrational Cube, The Gleam Eyes, The Skull Reaper, Heathcliff...
- **16 Sword Skills** com brilho, rastro de luz e *post-motion delay*: Slant, Vertical, Sonic Leap, Vorpal Strike, Mother's Rosario...
- **Dual Blades** no nível 25: Starburst Stream (16 golpes) e The Eclipse (27 golpes).
- Níveis, atributos (STR/AGI/VIT), Col, loja, equipamentos, materiais e *Last Attack Bonus*.
- Ciclo dia/noite, Portal de Teletransporte, Link Start e monstros que se desfazem em polígonos.

## Criando o seu mundo

Quase todo o conteúdo fica em **`js/data.js`**:

- `MONSTERS`: crie monstros novos (nome, formato, cores, velocidade, força).
- `CANON`: personalize qualquer andar (cidade, bioma, monstros, chefe).
- `SKILLS`: invente Sword Skills (cada golpe é um corte ou estocada com ângulo, dano e alcance).
- `BIOMES`: cores do chão e do céu, árvores, água ou lava.
- `weaponDef` / `armorDef`: armas e armaduras.

Em *Sistema* também dá para mudar a taxa de EXP (até 10×) e a duração do dia.

## Estrutura

```
index.html        HUD, menus e telas
css/style.css     Visual da interface no estilo SAO
js/main.js        Núcleo: render, dia/noite, progressão, chefe, loja
js/world.js       Geração do andar (terreno, cidade, Portal, arena, Labirinto)
js/enemies.js     IA de monstros e chefes
js/monsters.js    Modelos 3D low-poly dos monstros
js/combat.js      Espada em 1ª pessoa, combos e Sword Skills
js/player.js      Movimento e câmera
js/ui.js          HUD, menu, minimapa, Link Start
js/data.js        Conteúdo (edite aqui!)
js/save.js        Salvar / exportar / importar
js/audio.js       Efeitos sonoros sintetizados
```
