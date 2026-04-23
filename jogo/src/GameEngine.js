export const ClassesStr = {
  LADINO: 'Ladino',
  BARDO: 'Bardo',
  PALADINO: 'Paladino',
  MAGO: 'Mago',
  SUMMONER: 'Summoner',
  SAMURAI: 'Samurai',
  REAPER: 'Reaper',
  PICTOMANCER: 'Pictomancer'
};

export const CLASS_IMAGES = {
  [ClassesStr.LADINO]: '/classes/ninja.png',
  [ClassesStr.BARDO]: '/classes/bard.png',
  [ClassesStr.PALADINO]: '/classes/paladin.png',
  [ClassesStr.MAGO]: '/classes/black-mage.png',
  [ClassesStr.SUMMONER]: '/classes/summoner.png',
  [ClassesStr.SAMURAI]: '/classes/samurai.png',
  [ClassesStr.REAPER]: '/classes/reaper.png',
  [ClassesStr.PICTOMANCER]: '/classes/pictomancer.png'
};

export const CLASS_DESCRIPTIONS = {
  [ClassesStr.LADINO]: {
    title: '⚡ Ladino – Fuga / Golpe Duplo',
    desc: 'Se tiver menos de 33% de vida, causa dano dobrado. No combate PvE pode fugir sem lutar.',
    uses: 3
  },
  [ClassesStr.BARDO]: {
    title: '🎵 Bardo – Paralisia',
    desc: 'Paralisa um inimigo por 1 turno inteiro, fazendo ele perder sua vez.',
    uses: 2
  },
  [ClassesStr.PALADINO]: {
    title: '🛡️ Paladino – Cura / Reviver',
    desc: 'Recupera +2 de vida. Ao morrer, revive 1 vez com metade da vida (passiva).',
    uses: 3
  },
  [ClassesStr.MAGO]: {
    title: '✨ Mago – Celeridade / Portal',
    desc: 'Joga mais um turno (Celeridade) ou se teleporta para outra sala aleatória (Portal).',
    uses: 2
  },
  [ClassesStr.SUMMONER]: {
    title: '👹 Summoner – Invocar / Teleportar',
    desc: 'Cria monstros (10HP/2DMG) no mapa. Em combate, pode teleportar o monstro para o jogador mais próximo.',
    uses: 3
  },
  [ClassesStr.SAMURAI]: {
    title: '⚔️ Samurai – Golpe Crítico',
    desc: 'Ativa o foco: o próximo ataque em combate será um golpe crítico garantido.',
    uses: 3
  },
  [ClassesStr.REAPER]: {
    title: '💀 Reaper – Cura Passiva / Invisibilidade',
    desc: 'Passiva: cura 1HP por turno geral. Ativo: fica invisível por 3 turnos (não pode ser alvo de PvP).',
    uses: 2
  },
  [ClassesStr.PICTOMANCER]: {
    title: '🎨 Pictomancer – Embaralhar Tabuleiro',
    desc: 'Embaralha todas as posições do tabuleiro (monstros, chave, porta, teleportes). Pode ser usado 1 vez.',
    uses: 1
  }
};

export class GameEngine {
  constructor() {
    this.state = {
      players: [],
      map: [],
      mapSize: 10,
      turnCounter: 1,
      activePlayerIndex: 0,
      winner: null,
      doorPos: null,
      keyPos: null,
      gameMode: 'individual', // 'individual' or 'duo'
      summonedMonsters: [] // track monsters created by summoner
    };

    this.classesConfig = {
      [ClassesStr.LADINO]:      { life: 20, uses: 3, color: '#f59e0b' },
      [ClassesStr.BARDO]:       { life: 20, uses: 2, color: '#10b981' },
      [ClassesStr.PALADINO]:    { life: 20, uses: 3, color: '#3b82f6' },
      [ClassesStr.MAGO]:        { life: 20, uses: 2, color: '#8b5cf6' },
      [ClassesStr.SUMMONER]:    { life: 20, uses: 3, color: '#ec4899' },
      [ClassesStr.SAMURAI]:     { life: 20, uses: 3, color: '#ef4444' },
      [ClassesStr.REAPER]:      { life: 18, uses: 2, color: '#6b7280' },
      [ClassesStr.PICTOMANCER]: { life: 20, uses: 1, color: '#06b6d4' }
    };
  }

  initGame(playerConfigs, gameMode = 'individual') {
    this.state.gameMode = gameMode;
    this.state.summonedMonsters = [];

    this.state.players = playerConfigs.map((cfg, idx) => {
      let maxLife = this.classesConfig[cfg.class].life;
      if (gameMode === 'singleplayer') maxLife = Math.floor(maxLife * 1.5);
      
      return {
        id: idx,
        name: cfg.name,
        class: cfg.class,
        maxLife: maxLife,
        currentLife: maxLife,
        uses: this.classesConfig[cfg.class].uses,
      x: Math.floor(this.state.mapSize / 2),
      y: Math.floor(this.state.mapSize / 2),
      hasKey: false,
      isAlive: true,
      turnsPlayed: 0,
      color: this.classesConfig[cfg.class].color,
      // Status effects
      skipNextTurn: false,
      playAgain: false,
      revived: false,
      // Samurai specific
      critBuff: false,
      // Reaper specific
      invisibleTurns: 0,
      // Team for duo mode
      team: cfg.team || null
    };
  });

    this.state.turnCounter = 1;
    this.state.activePlayerIndex = 0;
    this.state.winner = null;

    this.gerarTabuleiro();
  }

  gerarTabuleiro() {
    const size = this.state.mapSize;
    this.state.map = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({
        type: 'path',
        revealed: false,
        monster: null
      }))
    );

    const centerX = Math.floor(size / 2);
    const centerY = Math.floor(size / 2);

    this.state.map[centerY][centerX].revealed = true;

    this.state.keyPos = this.getRandomEmptyPos(centerX, centerY);
    this.state.map[this.state.keyPos.y][this.state.keyPos.x].type = 'key';

    this.state.doorPos = this.getRandomEmptyPos(centerX, centerY);
    this.state.map[this.state.doorPos.y][this.state.doorPos.x].type = 'door';

    const maxMonsters = this.state.gameMode === 'singleplayer' ? 15 : 25;
    let monstersPlaced = 0;
    while (monstersPlaced < maxMonsters) {
      let pos = this.getRandomEmptyPos(centerX, centerY);
      this.state.map[pos.y][pos.x].type = 'monster';
      const mType = this.rolarDado(3);
      if (mType === 1) this.state.map[pos.y][pos.x].monster = { hp: 5, dmg: 1 };
      else if (mType === 2) this.state.map[pos.y][pos.x].monster = { hp: 10, dmg: 2 };
      else this.state.map[pos.y][pos.x].monster = { hp: 5, dmg: 3 };
      monstersPlaced++;
    }

    let teleportsPlaced = 0;
    while (teleportsPlaced < 10) {
      let pos = this.getRandomEmptyPos(centerX, centerY);
      this.state.map[pos.y][pos.x].type = 'teleport';
      teleportsPlaced++;
    }
  }

  // Pictomancer: shuffle all unrevealed cell contents
  shuffleBoard() {
    const size = this.state.mapSize;
    const centerX = Math.floor(size / 2);
    const centerY = Math.floor(size / 2);

    // Collect all shuffleable cells (unrevealed, not center)
    const cellsToShuffle = [];
    const positions = [];

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (x === centerX && y === centerY) continue;
        const cell = this.state.map[y][x];
        if (!cell.revealed) {
          cellsToShuffle.push({ type: cell.type, monster: cell.monster });
          positions.push({ x, y });
        }
      }
    }

    // Fisher-Yates shuffle
    for (let i = cellsToShuffle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cellsToShuffle[i], cellsToShuffle[j]] = [cellsToShuffle[j], cellsToShuffle[i]];
    }

    // Apply shuffled contents back
    positions.forEach((pos, idx) => {
      this.state.map[pos.y][pos.x].type = cellsToShuffle[idx].type;
      this.state.map[pos.y][pos.x].monster = cellsToShuffle[idx].monster;
    });

    // Update key/door positions
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (this.state.map[y][x].type === 'key') this.state.keyPos = { x, y };
        if (this.state.map[y][x].type === 'door') this.state.doorPos = { x, y };
      }
    }
  }

  // Summoner: create a monster on a random empty path cell near the summoner
  summonMonster(summoner) {
    const size = this.state.mapSize;
    // Try to place near the summoner first
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
    ];

    for (const d of dirs) {
      const nx = summoner.x + d.dx;
      const ny = summoner.y + d.dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        const cell = this.state.map[ny][nx];
        if (cell.type === 'path') {
          cell.type = 'monster';
          cell.monster = { hp: 10, dmg: 2, summoned: true, summonerId: summoner.id };
          cell.revealed = true;
          this.state.summonedMonsters.push({ x: nx, y: ny });
          return { x: nx, y: ny };
        }
      }
    }

    // If no adjacent cell, place randomly
    const pos = this.getRandomEmptyPos(summoner.x, summoner.y);
    this.state.map[pos.y][pos.x].type = 'monster';
    this.state.map[pos.y][pos.x].monster = { hp: 10, dmg: 2, summoned: true, summonerId: summoner.id };
    this.state.map[pos.y][pos.x].revealed = true;
    this.state.summonedMonsters.push(pos);
    return pos;
  }

  // Find nearest player to a given position (excluding a specific player)
  findNearestPlayer(fromX, fromY, excludeId) {
    let nearest = null;
    let minDist = Infinity;
    for (const p of this.state.players) {
      if (p.id === excludeId || !p.isAlive) continue;
      if (p.invisibleTurns > 0) continue; // Can't target invisible players
      const dist = Math.abs(p.x - fromX) + Math.abs(p.y - fromY);
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    }
    return nearest;
  }

  // Summoner: teleport a monster (from current combat cell) to nearest player
  teleportMonsterToPlayer(monsterCell, summoner) {
    const target = this.findNearestPlayer(summoner.x, summoner.y, summoner.id);
    if (!target) return null;

    // Move monster to target's cell
    const targetCell = this.state.map[target.y][target.x];
    if (targetCell.type === 'path') {
      targetCell.type = 'monster';
      targetCell.monster = { ...monsterCell.monster };
      targetCell.revealed = true;
      // Clear original cell
      monsterCell.type = 'path';
      monsterCell.monster = null;
      return target;
    }
    return null;
  }

  getRandomEmptyPos(cx, cy) {
    let x, y;
    while (true) {
      x = Math.floor(Math.random() * this.state.mapSize);
      y = Math.floor(Math.random() * this.state.mapSize);
      if (x === cx && y === cy) continue;
      if (this.state.map[y][x].type !== 'path') continue;
      return { x, y };
    }
  }

  getActivePlayer() {
    return this.state.players[this.state.activePlayerIndex];
  }

  moverJogador(dirStr) {
    const p = this.getActivePlayer();
    if (!p.isAlive) return false;

    let nx = p.x;
    let ny = p.y;

    if (dirStr === 'up') ny--;
    else if (dirStr === 'down') ny++;
    else if (dirStr === 'left') nx--;
    else if (dirStr === 'right') nx++;

    if (nx >= 0 && nx < this.state.mapSize && ny >= 0 && ny < this.state.mapSize) {
      p.x = nx;
      p.y = ny;
      this.revelarCelula(nx, ny);
      return true;
    }
    return false;
  }

  revelarCelula(x, y) {
    this.state.map[y][x].revealed = true;
  }

  // Apply Reaper passive healing at end of general turn
  applyReaperPassives() {
    for (const p of this.state.players) {
      if (p.isAlive && p.class === ClassesStr.REAPER) {
        p.currentLife = Math.min(p.maxLife, p.currentLife + 1);
      }
      // Decrement invisibility
      if (p.invisibleTurns > 0) {
        p.invisibleTurns--;
      }
    }
  }

  encerrarTurno() {
    const p = this.getActivePlayer();
    p.turnsPlayed++;

    if (p.playAgain) {
      p.playAgain = false;
      return { changeTurn: false };
    }

    let loopCount = 0;
    const prevIndex = this.state.activePlayerIndex;
    do {
      this.state.activePlayerIndex = (this.state.activePlayerIndex + 1) % this.state.players.length;
      if (this.state.activePlayerIndex === 0) {
        this.state.turnCounter++;
        this.applyReaperPassives();
      }

      let nextP = this.getActivePlayer();
      if (nextP.skipNextTurn) {
        nextP.skipNextTurn = false;
      } else if (!nextP.isAlive) {
        // continue loop
      } else {
        break;
      }

      loopCount++;
      if (loopCount > 20) break;
    } while (true);

    return { changeTurn: true };
  }

  rolarDado(lados = 6) {
    return Math.floor(Math.random() * lados) + 1;
  }

  calcularAtaqueBasico(isLadinoBuff = false, isSamuraiCrit = false) {
    if (isSamuraiCrit) {
      return { roll: 6, dmg: 4, isCrit: true };
    }

    const roll = this.rolarDado(6);
    let dmg = 0;
    let isCrit = false;
    if (roll >= 1 && roll <= 2) dmg = 2;
    else if (roll === 3) dmg = 3;
    else if (roll >= 4 && roll <= 5) dmg = 0;
    else if (roll === 6) { dmg = 4; isCrit = true; }

    if (isLadinoBuff) dmg *= 2;

    return { roll, dmg, isCrit };
  }

  isGameOver() {
    return this.state.players.every(p => !p.isAlive);
  }

  calcularDefesaPvP(incomingDmg) {
    const roll = this.rolarDado(6);
    let actualDmg = incomingDmg;
    let counterDmg = 0;
    let msg = "";

    if (roll === 1) { actualDmg += 1; msg = "Falha crítica! Recebeu +1 dano."; }
    else if (roll === 2 || roll === 3) { msg = "Defesa normal. Dano mantido."; }
    else if (roll === 4 || roll === 5) { actualDmg = Math.max(0, actualDmg - 1); msg = "Boa defesa. Dano reduzido em 1."; }
    else if (roll === 6) { counterDmg = incomingDmg; msg = "Defesa perfeita! Contra-atacou o dano."; }

    return { roll, dmgTaken: actualDmg, counterDmg, msg };
  }

  aplicarDano(player, amount) {
    if (!player.isAlive) return;
    player.currentLife -= amount;
    if (player.currentLife <= 0) {
      if (player.class === ClassesStr.PALADINO && !player.revived) {
        player.currentLife = Math.floor(player.maxLife / 2);
        player.revived = true;
        return "Paladino foi abatido, mas sua fé o reviveu com metade da vida!";
      } else {
        this.killPlayer(player);
        return `${player.name} morreu na escuridão...`;
      }
    }
    return null;
  }

  killPlayer(player) {
    player.currentLife = 0;
    player.isAlive = false;
    if (player.hasKey) {
      player.hasKey = false;
      this.state.map[player.y][player.x].type = 'key';
    }
  }

  coletarItem() {
    const p = this.getActivePlayer();
    const cell = this.state.map[p.y][p.x];
    if (cell.type === 'key') {
      p.hasKey = true;
      cell.type = 'path';
      return true;
    }
    return false;
  }

  verificarVitoria() {
    const p = this.getActivePlayer();
    const cell = this.state.map[p.y][p.x];
    if (cell.type === 'door' && p.hasKey) {
      this.state.winner = p;
      return true;
    }
    return false;
  }

  // Check if two players are teammates (duo mode)
  areTeammates(p1, p2) {
    if (this.state.gameMode !== 'duo') return false;
    return p1.team && p1.team === p2.team;
  }

  usarHabilidade(alvo = null) {
    const p = this.getActivePlayer();
    if (p.uses <= 0) return { success: false, msg: "Sem usos de habilidade." };

    p.uses--;
    let resMsg = "";

    switch (p.class) {
      case ClassesStr.LADINO:
        resMsg = "Ladino usou fuga automática e escapou sem lutar.";
        break;

      case ClassesStr.BARDO:
        if (alvo) {
          alvo.skipNextTurn = true;
          resMsg = `Bardo paralisou ${alvo.name || 'Inimigo'} por 1 turno!`;
        } else {
          resMsg = "Bardo usou Paralisia no monstro — monstro perde a vez de contra-atacar!";
        }
        break;

      case ClassesStr.PALADINO:
        p.currentLife = Math.min(p.maxLife, p.currentLife + 2);
        resMsg = "Paladino usou Cura! +2 Vida.";
        break;

      case ClassesStr.MAGO:
        if (!alvo) {
          p.playAgain = true;
          resMsg = "Mago invocou Celeridade: jogará mais um turno em seguida!";
        } else {
          p.x = alvo.x; p.y = alvo.y;
          this.revelarCelula(p.x, p.y);
          resMsg = "Mago usou Portal e teleportou!";
        }
        break;

      case ClassesStr.SUMMONER:
        // Handled in server.js for complex logic
        resMsg = "Summoner usou uma habilidade!";
        break;

      case ClassesStr.SAMURAI:
        p.critBuff = true;
        resMsg = "Samurai ativou Foco! O próximo ataque será um golpe crítico garantido!";
        break;

      case ClassesStr.REAPER:
        p.invisibleTurns = 3;
        resMsg = "Reaper ativou Invisibilidade! Ficará invisível por 3 turnos.";
        break;

      case ClassesStr.PICTOMANCER:
        this.shuffleBoard();
        resMsg = "Pictomancer embaralhou o tabuleiro!";
        break;
    }
    return { success: true, msg: resMsg };
  }
}
