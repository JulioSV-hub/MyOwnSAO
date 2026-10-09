// NPCs da cidade: andam pelas ruas, olham para o jogador e conversam (tecla E).
import * as THREE from 'three';
import { buildCharacter, animateCharacter, CAST, randomTownsfolk } from './characters.js';
import { registry, createModelCharacter, animateModel, disposeModel } from './models.js';
import { mulberry32 } from './rng.js';
import { TOWN_R } from './world.js';
import { weaponDef, MAX_FLOOR } from './data.js';
import { Sfx } from './audio.js';

const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const pickOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

const FOLK_LINES = [
  'Dizem que quem morre aqui... não, prefiro não pensar nisso. Cuide-se lá fora!',
  'Os jogadores da linha de frente são incríveis. Eu só tenho coragem de pescar perto da cidade.',
  'Você já provou a torta da padaria da praça? Recupera o ânimo, se não o HP!',
  'Ouvi dizer que tem um espadachim de preto que luta sozinho. Que coisa perigosa...',
  'Quando o sol se põe por trás do andar de cima, o céu fica cor-de-rosa. É lindo.',
  'Meu irmão subiu para o próximo andar ontem. Espero que ele esteja bem.',
  'Se for para os campos, leve poções. Muitas poções.',
  'A Argo sabe de tudo que acontece em Aincrad. Mas cobra caro por isso!',
  'A Lisbeth faz as melhores armas do andar. E ela fica brava se você quebrar uma!',
  'Já viu o Portal funcionando à noite? Brilha como um pedaço do céu.',
  'Eu estava no Town of Beginnings quando tudo começou... Nunca vou esquecer aquele dia.',
  'Se segurar a defesa no instante exato do golpe, dá para aparar o ataque. Meu amigo jura que funciona!',
];
const KID_LINES = ['Pega-pega! Você tá com ele!', 'Quando eu crescer vou ser da linha de frente!', 'Moço, você tem um Sword Skill bem legal?', 'Shhh! Estou me escondendo da minha mãe.'];

class NPC {
  constructor(mgr, def, x, z, opts = {}) {
    this.mgr = mgr;
    this.game = mgr.game;
    this.def = def;
    this.role = opts.role || (def.kid ? 'kid' : 'folk');
    this.name = def.name || opts.name || (def.kid ? 'Criança' : 'Morador');
    this.title = def.title || opts.title || '';
    this.fixed = !!opts.fixed;
    this.c = buildCharacter(def);
    this.mesh = this.c.group;
    // se existir um modelo 3D (VRM/GLB) para este personagem, troca o boneco assim que carregar
    const file = (def.id && registry.cast[def.id]) || opts.modelFile;
    if (file) {
      const h = (def.kid ? 1.25 : def.small ? 1.5 : def.big ? 1.9 : def.female ? 1.62 : 1.72) * (opts.modelFile ? 0.93 + Math.random() * 0.12 : 1);
      createModelCharacter(file, h).then((mc) => {
        if (this.dead) { disposeModel(mc); return; }
        this.game.scene.remove(this.mesh);
        this.mesh.traverse((o) => { if (o.material && !o.userData.outline) o.material.dispose?.(); });
        this.c = mc;
        this.mesh = mc.group;
        this.mesh.position.copy(this.pos);
        this.mesh.rotation.y = this.yaw;
        this.game.scene.add(this.mesh);
      }).catch((e) => console.warn('Modelo não carregou:', file, e));
    }
    this.pos = new THREE.Vector3(x, 0, z);
    this.home = this.pos.clone();
    this.yaw = opts.yaw ?? Math.random() * Math.PI * 2;
    this.homeYaw = this.yaw;
    this.speed = opts.speed ?? (def.kid ? 2.6 : 1.1 + Math.random() * 0.4);
    this.state = 'idle';
    this.timer = Math.random() * 4;
    this.target = null;
    this.talking = false;
    this.radius = 0.32;
    this.stuck = 0;
    this.followName = opts.follow || null;
    this.lineIdx = Math.floor(Math.random() * 100);
    this.mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.game.scene.add(this.mesh);
    this.label = this.game.ui.createNpcLabel(this);
  }

  pickTarget() {
    const w = this.game.world;
    for (let i = 0; i < 12; i++) {
      const band = pickOf([[6, 17], [6, 17], [30.5, 35.5], [49.5, 53.5]]);
      const rad = band[0] + Math.random() * (band[1] - band[0]), a = Math.random() * Math.PI * 2;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (w.grid.query(x, z, 1.2, []).length) continue;
      return { x, z };
    }
    return { x: this.home.x, z: this.home.z };
  }

  update(dt, t) {
    const g = this.game, w = g.world, pl = g.player.pos;
    const dx = pl.x - this.pos.x, dz = pl.z - this.pos.z, dist = Math.hypot(dx, dz);
    const toPlayer = Math.atan2(-dx, -dz);
    let moving = 0;
    const turn = (target, rate) => { this.yaw += Math.max(-rate * dt, Math.min(rate * dt, angleTo(this.yaw, target))); };

    if (this.talking) {
      turn(toPlayer, 6);
    } else if (this.fixed) {
      turn(dist < 6 ? toPlayer : this.homeYaw, 3);
    } else {
      if (this.followName) {
        const leader = this.mgr.byName(this.followName);
        if (leader) {
          const fx = leader.pos.x + Math.cos(leader.yaw) * 1.1, fz = leader.pos.z - Math.sin(leader.yaw) * 1.1;
          const fd = Math.hypot(fx - this.pos.x, fz - this.pos.z);
          if (fd > 0.4) {
            const sp = Math.min(leader.speed * 1.3, fd * 2);
            this.pos.x += ((fx - this.pos.x) / fd) * sp * dt;
            this.pos.z += ((fz - this.pos.z) / fd) * sp * dt;
            turn(Math.atan2(-(fx - this.pos.x), -(fz - this.pos.z)), 5);
            moving = sp;
          } else turn(leader.yaw, 3);
        }
      } else if (this.state === 'idle') {
        this.timer -= dt;
        if (dist < 4) turn(toPlayer, 3);
        if (this.timer <= 0) { this.target = this.pickTarget(); this.state = 'walk'; this.stuck = 0; }
      } else {
        const tx = this.target.x - this.pos.x, tz = this.target.z - this.pos.z, td = Math.hypot(tx, tz);
        // diminui o passo e espera quando o jogador está bem na frente
        const slow = dist < 2.2 ? 0 : dist < 4 ? 0.5 : 1;
        if (td < 0.6) { this.state = 'idle'; this.timer = 2 + Math.random() * 6; }
        else if (slow > 0) {
          const sp = this.speed * slow;
          const ox = this.pos.x, oz = this.pos.z;
          this.pos.x += (tx / td) * sp * dt;
          this.pos.z += (tz / td) * sp * dt;
          turn(Math.atan2(-tx, -tz), 5);
          moving = sp;
          w.resolve(this.pos, this.radius);
          const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
          this.stuck = moved < sp * dt * 0.3 ? this.stuck + dt : 0;
          if (this.stuck > 1.2) { this.target = this.pickTarget(); this.stuck = 0; }
        } else turn(toPlayer, 4);
      }
    }
    w.resolve(this.pos, this.radius);
    const dc = Math.hypot(this.pos.x, this.pos.z);
    if (dc > TOWN_R - 3) { const k = (TOWN_R - 3) / dc; this.pos.x *= k; this.pos.z *= k; }
    this.pos.y = w.groundAt(this.pos.x, this.pos.z);
    // o jogador não atravessa NPCs
    const m = this.radius + g.player.radius;
    if (dist < m && dist > 1e-3) { pl.x = this.pos.x + (dx / dist) * m; pl.z = this.pos.z + (dz / dist) * m; }

    const look = dist < 7 ? angleTo(this.yaw, toPlayer) : 0;
    const lk = Math.abs(look) < 1.6 ? look : 0;
    if (this.c.external) animateModel(this.c, dt, t, moving, lk, this.talking);
    else animateCharacter(this.c, dt, t, moving, lk, this.talking);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
    this.dist = dist;
  }

  destroy() {
    this.dead = true;
    this.game.scene.remove(this.mesh);
    if (this.c.external) { disposeModel(this.c); this.label?.remove(); return; }
    this.mesh.traverse((o) => { if (o.material && !o.userData.outline) o.material.dispose?.(); });
    this.label?.remove();
  }

  // ─────────── Diálogos ───────────
  dialog() {
    const g = this.game, p = g.state.player, n = g.floor.n;
    const close = { label: 'Até mais', run: () => null };
    const say = (text, options = [close]) => ({ text, options });
    const nextLine = (lines) => lines[this.lineIdx++ % lines.length];
    switch (this.role) {
      case 'shop':
        return say(`Ei, ${p.name}! Bem-vindo à Agil's Store. Preço justo, palavra de honra — bom, quase sempre. O que vai ser hoje?`, [
          { label: 'Ver a loja', run: () => { g.ui.closeDialog(false); g.ui.shopTab = 'buy'; g.ui.openMenu('shop'); return undefined; } },
          { label: 'Vender materiais', run: () => { g.ui.closeDialog(false); g.ui.shopTab = 'sell'; g.ui.openMenu('shop'); return undefined; } },
          { label: 'Como vão os negócios?', run: () => say(nextLine(['Uso parte do lucro para ajudar os jogadores de nível baixo. Não conte pra ninguém, hein?', 'Material de monstro raro vende bem. Traga o que achar nos campos!', 'Desde que a linha de frente chegou a este andar, o movimento triplicou.'])) },
          close,
        ]);
      case 'smith': {
        const wid = p.weapon, wd = weaponDef(wid), lv = (p.upgrades?.[wid]) || 0;
        const cost = g.upgradeCost(wid);
        const opts = [];
        if (lv < 10) {
          opts.push({ label: `Fortalecer ${wd.name} +${lv} → +${lv + 1} (${cost.toLocaleString('pt-BR')} Col)`, run: () => {
            if (p.col < cost) { Sfx.error(); return say('Hmm... você não tem Col suficiente. Volte quando tiver juntado mais!'); }
            g.upgradeWeapon(wid);
            Sfx.coin();
            return say(`*CLANG! CLANG!* ... Prontinho! ${wd.name} agora está +${lv + 1}. Olha esse brilho! Não vai quebrar ela, viu?`, [{ label: 'Fortalecer de novo', run: () => this.dialog() }, close]);
          } });
        } else opts.push({ label: 'Já está no máximo (+10)', run: () => say('Essa lâmina está perfeita. Nem eu consigo melhorar mais!') });
        opts.push({ label: 'Conversar', run: () => say(nextLine(['Uma espada feita com metal de cristal... um dia eu faço uma assim de novo.', 'Meu sonho é ter uma loja com uma roda d\'água no andar 48!', 'Se o fio da sua lâmina gastar, eu dou um jeito. É meu trabalho!'])) });
        opts.push(close);
        return say(`Bem-vinda à Lisbeth's Smith Shop! Quer dizer... bem-vindo! Posso deixar sua arma mais forte. Atualmente: ${wd.name} +${lv}.`, opts);
      }
      case 'info': {
        const pr = g.state.progress, paid = pr.info?.[n];
        const b = g.floor.boss;
        const report = () => say(`Chefe do Andar ${n}: ${b.name}. ${b.bars || 3} barras de HP. Ele marca o chão em vermelho antes de atacar — saia da área! Pule para escapar do impacto circular. ${b.adds ? 'Convoca reforços quando perde uma barra. ' : ''}${b.enrageText ? 'Na última barra ele troca de arma e fica mais rápido! ' : 'Na última barra ele fica furioso e ataca mais rápido. '}Nyahaha, informação de primeira!`);
        return say('Nyahaha~ Argo, a Rata, a seu dispor. Informação é poder... e poder custa Col.', [
          paid ? { label: 'Repetir a informação do chefe', run: report } : { label: 'Comprar informação sobre o chefe (300 Col)', run: () => {
            if (p.col < 300) { Sfx.error(); return say('Sem Col, sem informação. Regras são regras, freguês~'); }
            p.col -= 300;
            (pr.info ||= {})[n] = true;
            Sfx.coin();
            return report();
          } },
          { label: 'Uma dica de graça?', run: () => say(nextLine(['Dica grátis: a esquiva (Q) te deixa invencível por um instante. Use contra golpes grandes.', 'Dica grátis: o post-motion delay depois das Sword Skills te deixa parado. Não gaste skill longa perto de um chefe furioso.', 'Dica grátis: o Last Attack Bonus vai para quem dá o golpe final no chefe.', 'Dica grátis: a Lisbeth fortalece armas. Cada nível dá +8% de ataque.', 'Dica grátis: dizem que quem alcança o nível 25 recebe uma Habilidade Única...'])) },
          close,
        ]);
      }
      case 'cook':
        return say(`Oi, ${p.name}! Você parece cansado... Fiz uns sanduíches com um molho especial. Quer um?`, [
          { label: 'Aceitar o sanduíche', run: () => {
            p.hp = g.stats().maxHp;
            g.effects.ring(g.player.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), '#ffd27a', 1.4, 0.8, 1.5);
            Sfx.levelUp();
            return say('Hehe, minha skill de Culinária está no máximo! HP totalmente restaurado. Agora vai lá e volta inteiro, ouviu?');
          } },
          { label: 'Conversar', run: () => say(nextLine(['Não quero passar meus dias trancada na cidade. Prefiro viver cada dia lutando.', 'Os Knights of the Blood estão planejando o ataque ao chefe. Você vem?', 'Um dia quero ter uma casinha perto de um lago... no andar 22, talvez.'])) },
          close,
        ]);
      case 'kirito':
        return say(p.name.toLowerCase() === 'kirito' ? 'Espera... você também se chama Kirito? Que coincidência estranha.' : `...Ah, oi. Precisa de alguma coisa, ${p.name}?`, [
          { label: 'Alguma dica de combate?', run: () => say(nextLine(['Sword Skills são poderosas, mas encadear com ataques normais é o que faz a diferença.', 'Em luta contra chefe, nunca fique parado na área vermelha. Movimente-se sempre.', 'Aparar no tempo certo abre o inimigo para um contra-ataque. Treine nos javalis.', 'Se um dia você conseguir empunhar duas espadas... bom, deixa pra lá.'])) },
          { label: 'Por que você joga sozinho?', run: () => say('...É mais fácil assim. Ninguém se machuca por minha causa.') },
          close,
        ]);
      case 'klein':
        return say(`Ei, ei! ${p.name}, irmão! Quer entrar pra guilda Fuurinkazan? A gente tem pizza... quer dizer, pão. Só pão.`, [
          { label: 'Conversar', run: () => say(nextLine(['O Kirito me ensinou a usar Sword Skills no primeiro dia. Devo minha vida a ele!', 'Um samurai nunca abandona os amigos! ...nem quando tem uma garota bonita por perto.', 'Já tentou cortar um javali com o Reaver? Satisfação garantida!'])) },
          close,
        ]);
      case 'silica':
        return say('Oi! Esta é a Pina, meu dragãozinho. Diz oi, Pina! — "Kyuu!"', [
          { label: 'Fazer carinho na Pina', run: () => { Sfx.click(); p.hp = Math.min(g.stats().maxHp, p.hp + g.stats().maxHp * 0.3); return say('"Kyuuu~!" A Pina gostou de você! Ela soprou bolhas de cura... (você se sente melhor)'); } },
          close,
        ]);
      case 'yui':
        return say('Papai...? Ah, desculpa! Você parece alguém que eu conheço...', [{ label: 'Você está perdida?', run: () => say('Não... eu acho que estou procurando alguém. Obrigada por perguntar!') }, close]);
      case 'kid':
        return say(nextLine(KID_LINES));
      default:
        return say(nextLine([...FOLK_LINES, `Ouvi dizer que o chefe deste andar se chama ${g.floor.boss.name}... dá medo só de falar o nome.`, n < MAX_FLOOR ? `Faltam ${MAX_FLOOR - n} andares para o topo. Será que alguém vai conseguir?` : 'Chegamos ao topo... finalmente!']));
    }
  }
}

export class NPCManager {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  clear() {
    for (const n of this.list) n.destroy();
    this.list = [];
  }

  byName(name) { return this.list.find((n) => n.name === name); }

  populate() {
    this.clear();
    const g = this.game, w = g.world, n = g.floor.n;
    const rand = mulberry32(g.floor.seed + 999);
    const add = (def, x, z, opts) => { const npc = new NPC(this, def, x, z, opts); this.list.push(npc); return npc; };
    const a = w.agilSpot, l = w.lisbethSpot;
    add(CAST.agil, a.pos.x, a.pos.z, { role: 'shop', fixed: true, yaw: a.yaw });
    add(CAST.lisbeth, l.pos.x, l.pos.z, { role: 'smith', fixed: true, yaw: l.yaw });
    add(CAST.argo, 4, -9, { role: 'info' });
    // O elenco principal aparece pela cidade (cada andar sorteia quem está lá)
    const cast = [['kirito', 'kirito'], ['asuna', 'cook'], ['klein', 'klein'], ['silica', 'silica'], ['yui', 'yui']];
    for (const [id, role] of cast) {
      if (n > 1 && id !== 'kirito' && id !== 'asuna' && rand() < 0.35) continue; // Kirito e Asuna estão em todo andar
      const ang = rand() * Math.PI * 2, rad = 7 + rand() * 9;
      add(CAST[id], Math.cos(ang) * rad, Math.sin(ang) * rad, { role, follow: id === 'yui' && this.byName('Asuna') ? 'Asuna' : null });
    }
    // Moradores e crianças
    // modelos 3D em rodízio: adultos usam a lista "moradores", crianças a lista "criancas"
    let fi = Math.floor(rand() * 97), ki = Math.floor(rand() * 97);
    for (let i = 0; i < 19; i++) {
      const kid = i >= 15;
      const ang = rand() * Math.PI * 2, rad = (kid ? [8, 14, 33, 10] : [8, 33, 51])[i % (kid ? 4 : 3)] + (rand() - 0.5) * 4;
      let file = null;
      if (kid && registry.kids.length) file = registry.kids[ki++ % registry.kids.length];
      else if (!kid && registry.folk.length && rand() < 0.75) file = registry.folk[fi++ % registry.folk.length];
      add(randomTownsfolk(rand, kid), Math.cos(ang) * rad, Math.sin(ang) * rad, { modelFile: file });
    }
  }

  update(dt) {
    const t = this.game.time;
    for (const n of this.list) n.update(dt, t);
  }

  nearest(pos, maxD) {
    let best = null, bd = maxD;
    for (const n of this.list) {
      const d = Math.hypot(n.pos.x - pos.x, n.pos.z - pos.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
}
