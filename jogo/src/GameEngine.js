export const ClassesStr = {
  LADINO: 'Ladino',
  BARDO: 'Bardo',
  PALADINO: 'Paladino',
  MAGO: 'Mago'
};

export class GameEngine {
  constructor() {
    this.state = {
      players: [],
      map: [],
      mapSize: 10,
      turnCounter: 1, // Geral turn (increments after everyone played)
      activePlayerIndex: 0,
      winner: null,
      doorPos: null,
      keyPos: null
    };
    
    // Configurações de Classes
    this.classesConfig = {
      [ClassesStr.LADINO]: { life: 20, uses: 3, color: '#f59e0b' },
      [ClassesStr.BARDO]: { life: 20, uses: 2, color: '#10b981' },
      [ClassesStr.PALADINO]: { life: 20, uses: 3, color: '#3b82f6' },
      [ClassesStr.MAGO]: { life: 20, uses: 2, color: '#8b5cf6' }
    };
  }

  initGame(playerConfigs) {
    // playerConfigs: [{name: '', class: ''}]
    this.state.players = playerConfigs.map((cfg, idx) => ({
      id: idx,
      name: cfg.name,
      class: cfg.class,
      maxLife: this.classesConfig[cfg.class].life,
      currentLife: this.classesConfig[cfg.class].life,
      uses: this.classesConfig[cfg.class].uses,
      x: Math.floor(this.state.mapSize / 2),
      y: Math.floor(this.state.mapSize / 2),
      hasKey: false,
      isAlive: true,
      turnsPlayed: 0,
      color: this.classesConfig[cfg.class].color,
      // Status buffs/debuffs
      skipNextTurn: false,
      playAgain: false,
      revived: false // for Paladin
    }));
    
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

    // Initial cell revealed and safe
    this.state.map[centerY][centerX].revealed = true;

    // Distribute Key and Door (never at center, never same place)
    this.state.keyPos = this.getRandomEmptyPos(centerX, centerY);
    this.state.map[this.state.keyPos.y][this.state.keyPos.x].type = 'key';

    this.state.doorPos = this.getRandomEmptyPos(centerX, centerY);
    this.state.map[this.state.doorPos.y][this.state.doorPos.x].type = 'door';

    // Distribute remaining
    // Total cells = 100. Used: 3
    // Distribute 25% monsters (25), 10% teleports (10). Paths are default.
    let monstersPlated = 0;
    while(monstersPlated < 25) {
      let pos = this.getRandomEmptyPos(centerX, centerY);
      this.state.map[pos.y][pos.x].type = 'monster';
      // Roll monster type (1, 2 or 3)
      const mType = this.rolarDado(3);
      if(mType === 1) this.state.map[pos.y][pos.x].monster = { hp: 5, dmg: 1 };
      else if(mType === 2) this.state.map[pos.y][pos.x].monster = { hp: 10, dmg: 2 };
      else this.state.map[pos.y][pos.x].monster = { hp: 5, dmg: 3 };
      
      monstersPlated++;
    }

    let teleportsPlaced = 0;
    while(teleportsPlaced < 10) {
      let pos = this.getRandomEmptyPos(centerX, centerY);
      this.state.map[pos.y][pos.x].type = 'teleport';
      teleportsPlaced++;
    }
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
    if(!p.isAlive) return false;

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
      return true; // Moved successfully
    }
    return false; // Invalid move
  }

  revelarCelula(x, y) {
    this.state.map[y][x].revealed = true;
  }

  encerrarTurno() {
    const p = this.getActivePlayer();
    p.turnsPlayed++;

    if (p.playAgain) {
      p.playAgain = false;
      return { changeTurn: false };
    }

    let loopCount = 0;
    do {
      this.state.activePlayerIndex = (this.state.activePlayerIndex + 1) % this.state.players.length;
      if (this.state.activePlayerIndex === 0) {
        this.state.turnCounter++;
      }
      
      let nextP = this.getActivePlayer();
      if(nextP.skipNextTurn) {
        nextP.skipNextTurn = false;
        // continue loop
      } else if (!nextP.isAlive) {
        // continue loop
      } else {
        break; // found next valid player
      }

      loopCount++;
      if (loopCount > 10) break; // Should not happen, all dead?
    } while (true);

    return { changeTurn: true };
  }

  rolarDado(lados = 6) {
    return Math.floor(Math.random() * lados) + 1;
  }

  // Returns { dmgDealt, isCrit, msg }
  calcularAtaqueBasico(isLadinoBuff = false) {
    const roll = this.rolarDado(6);
    let dmg = 0;
    let isCrit = false;
    if (roll >= 1 && roll <= 2) dmg = 2;
    else if (roll === 3) dmg = 3;
    else if (roll >= 4 && roll <= 5) dmg = 0;
    else if (roll === 6) { dmg = 4; isCrit = true; }

    if(isLadinoBuff) dmg *= 2; 

    return { roll, dmg, isCrit };
  }

  isGameOver() {
    return this.state.players.every(p => !p.isAlive);
  }

  // Returns { dmgTaken, counterDmg, msg }
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
    if(!player.isAlive) return;
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
      this.state.map[player.y][player.x].type = 'key'; // Drop key
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

  usarHabilidade(alvo = null) {
    const p = this.getActivePlayer();
    if (p.uses <= 0) return { success: false, msg: "Sem usos de habilidade." };

    p.uses--;
    let resMsg = "";

    switch(p.class) {
      case ClassesStr.LADINO:
        // Automatically handled fleeing UI side, but this registers use
        resMsg = "Ladino usou fuga automática e escapou sem lutar.";
        break;
      case ClassesStr.BARDO:
        if (alvo) {
          alvo.skipNextTurn = true;
          resMsg = `Bardo paralisou ${alvo.name || 'Inimigo'} por 1 turno!`;
        }
        break;
      case ClassesStr.PALADINO:
        p.currentLife = Math.min(p.maxLife, p.currentLife + 2);
        resMsg = "Paladino usou Cura! +2 Vida.";
        break;
      case ClassesStr.MAGO:
        if(!alvo) {
          // Play again (if not target it means default ability uses playAgain)
          p.playAgain = true;
          resMsg = "Mago invocou Celeridade: jogará mais um turno em seguida!";
        } else {
          // Portal (alvo is coordinates in this case {x,y})
          p.x = alvo.x; p.y = alvo.y;
          this.revelarCelula(p.x, p.y);
          resMsg = "Mago usou Portal e teleportou!";
        }
        break;
    }
    return { success: true, msg: resMsg };
  }
}
