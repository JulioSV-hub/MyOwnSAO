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
| T | Cristal de Teletransporte (abre a lista de andares) |
| H | Guardar / sacar a espada |
| F | Pescar (perto da água, com Vara de Pesca) |
| G | Decorar a casa (dentro de casa) |
| E | Interagir (Portal, loja do Agil, porta do Labirinto) |
| Tab / Esc | Menu |

## O que tem no jogo

- **Andares de Aincrad (1–100)** gerados de forma procedural, com 10 biomas. Vários são canônicos: Town of Beginnings, Urbus, Zumfut, Coral, Algade, Kamdet, Collinia...
- **Chefes de andar** com barras de HP múltiplas, ataques telegrafados, reforços e fúria na última barra: Illfang, Asterius, The Irrational Cube, The Gleam Eyes, The Skull Reaper, Heathcliff...
- **16 Sword Skills** com brilho, rastro de luz e *post-motion delay*: Slant, Vertical, Sonic Leap, Vorpal Strike, Mother's Rosario...
- **Dual Blades** no nível 25: Starburst Stream (16 golpes) e The Eclipse (27 golpes).
- Níveis, atributos (STR/AGI/VIT), Col, loja, equipamentos, materiais e *Last Attack Bonus*.
- Ciclo dia/noite, Portal de Teletransporte, Link Start e monstros que se desfazem em polígonos.

## Vida em Aincrad

- **Missões:** principal (chefe do andar), secundárias dos personagens (❗/❓ na cabeça), Quadro de Missões na praça e uma **missão em cadeia** com história por andar (no andar 1: *A Joia da Floresta* → Anneal Blade).
- **Pousada do Sino Dourado:** dormir até de manhã/noite, recupera HP e salva.
- **Mascotes:** monstros dóceis (♥) podem ser domados com Petisco de Domador; seguem, lutam e curam.
- **Pesca:** lago perto da cidade em todo andar; a Asuna grelha seus peixes.
- **Casa própria:** compre pela placa na cidade e decore com 12 móveis (G).
- **Town of Beginnings** no estilo do anime: Black Iron Palace, Monumento da Vida e torre do relógio.
- **Rua do Comércio** (junto à muralha): Armaduras do Grimm (leves, médias e pesadas), Oficina de Runas da Mira, Toca dos Mascotes (filhotes e petiscos), Taverna do Javali Dourado (comidas com bônus, boatos de baús, contratar companheiros) e Guilda dos Aventureiros (postos F → S, contratos diários, bônus). A Lisbeth também vende armas forjadas.
- **Runas:** até 3 encaixes (níveis 1, 10 e 20) com bônus de ataque, defesa, HP, velocidade, crítico, roubo de vida, Col ou EXP. Equipe em *Menu → Equipamento*.
- **Time:** chame Kirito, Asuna, Klein ou Silica, contrate companheiros na Taverna ou chame membros da Guilda. Eles lutam, curam e podem ser atacados (*Menu → Time*). Companheiros usam sempre os bonecos do jogo, nunca os modelos `.vrm`.
- **Pedidos do dia:** o Quadro de Missões e a Guilda sorteiam 3 pedidos novos a cada dia do jogo (caçadas, coleta, pesca, baús, patrulha, caçada noturna, procurados...). As missões dos personagens também mudam de andar para andar.
- **Baús e coleta:** 12 baús por andar (madeira, prata, dourado) que reabastecem a cada 3 dias, e ervas, cogumelos, minérios e cristais espalhados pelos campos.
- **Mapa:** mapa do andar inteiro com sua casa, lojas e missões, e teletransporte para qualquer ponto da cidade (grátis na cidade; no campo gasta 1 cristal).

## Modelos 3D (VRM) e música

- **Modelos 3D:** em *Menu → Sistema → Modelos 3D*, escolha arquivos `.vrm` do seu PC para cada personagem. Eles ficam guardados **só no seu navegador** (nada é enviado para a internet), então funcionam também no site online. Pelo `jogar.bat` também dá para usar a pasta `models/` (veja `models/LEIA-ME.txt`). Os créditos dos autores aparecem em *Sistema*.
- **Música:** gerada em tempo real e diferente em cada área (cidade, noite, campo com vento, floresta sombria, batalha e chefe). O volume fica em *Sistema*.

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
js/shops.js       Rua do Comércio (fachadas das lojas)
js/shopui.js      Janelas das lojas e do Time
js/party.js       Companheiros de time
js/loot.js        Baús e itens de coleta
js/guild.js       Postos da Guilda
js/save.js        Salvar / exportar / importar
js/audio.js       Efeitos sonoros sintetizados
```
