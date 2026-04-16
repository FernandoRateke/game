import { ClassesStr } from './GameEngine.js';

export class UIController {
  constructor(engine) {
    this.engine = engine;
    this.boardContainer = document.getElementById('board-container');
    this.logEl = document.getElementById('event-log');
    this.statusListEl = document.getElementById('players-status-list');
    this.turnCounterEl = document.getElementById('turn-counter');
    this.currentPlayerNameEl = document.getElementById('current-player-name');
    
    this.interactionModal = document.getElementById('interaction-modal');
    this.modalTitle = document.getElementById('modal-title');
    this.modalDesc = document.getElementById('modal-desc');
    this.diceArea = document.getElementById('dice-area');
    this.diceResult = document.getElementById('dice-result');
    this.btnModalPrimary = document.getElementById('btn-modal-primary');
    this.btnModalSecondary = document.getElementById('btn-modal-secondary');
    
    // Config controls mapping via css grid variables
    this.boardContainer.style.gridTemplateColumns = `repeat(${this.engine.state.mapSize}, 50px)`;
    this.boardContainer.style.gridTemplateRows = `repeat(${this.engine.state.mapSize}, 50px)`;
  }

  log(msg, type = 'log-move') {
    const p = document.createElement('p');
    p.className = type;
    p.textContent = msg;
    this.logEl.appendChild(p);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  renderAll() {
    this.renderBoard();
    this.renderStatus();
    this.turnCounterEl.textContent = this.engine.state.turnCounter;
    
    const p = this.engine.getActivePlayer();
    if(p) {
      this.currentPlayerNameEl.textContent = `Turno: ${p.name} (${p.class})`;
      this.currentPlayerNameEl.style.color = p.color;
    }
  }

  renderStatus() {
    this.statusListEl.innerHTML = '';
    this.engine.state.players.forEach(p => {
      const isAct = p.id === this.engine.state.activePlayerIndex;
      const card = document.createElement('div');
      card.className = `player-card ${isAct ? 'active' : ''} ${!p.isAlive ? 'dead' : ''}`;
      card.style.borderColor = isAct ? p.color : 'transparent';
      
      const hpPct = Math.max(0, (p.currentLife / p.maxLife) * 100);
      
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:${p.color}">${p.name}</strong> 
          <span>${p.class}</span>
        </div>
        <div style="font-size:0.8rem; margin-top:2px;">
          Vida: ${p.currentLife}/${p.maxLife} | Usos: ${p.uses} | Turnos: ${p.turnsPlayed}
        </div>
        <div style="font-size:0.8rem; color:var(--warning);">
          ${p.hasKey ? '🔑 Chave Equipada' : (p.isAlive ? '' : '💀 Morto')} ${p.skipNextTurn ? '❄️ Paralisado' : ''}
        </div>
        <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%; background:${hpPct < 30 ? 'red' : 'var(--success)'}"></div></div>
      `;
      this.statusListEl.appendChild(card);
    });
  }

  renderBoard() {
    this.boardContainer.innerHTML = '';
    const size = this.engine.state.mapSize;
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cellData = this.engine.state.map[y][x];
        const cellEl = document.createElement('div');
        cellEl.className = 'cell';
        cellEl.id = `cell-${x}-${y}`;

        if (cellData.revealed) {
          cellEl.classList.add('revealed');
          cellEl.classList.add(cellData.type);
          
          if(cellData.type === 'monster' && cellData.monster) {
            cellEl.innerHTML = `👹<span style="position:absolute; bottom:2px; right:2px; font-size:10px; color:white;">${cellData.monster.hp}❤️</span>`;
          } else if(cellData.type === 'door') {
            cellEl.innerHTML = `🚪`;
          } else if(cellData.type === 'key') {
            cellEl.innerHTML = `🔑`;
          } else if(cellData.type === 'teleport') {
            cellEl.innerHTML = `🌀`;
          }
        }

        // Add Players rendering
        const playersHere = this.engine.state.players.filter(p => p.isAlive && p.x === x && p.y === y);
        if (playersHere.length > 0 && cellData.revealed) {
          // Wrap innerHTML if needed, or just append tokens
          playersHere.forEach((p, idx) => {
            const token = document.createElement('div');
            token.className = 'player-token';
            token.style.borderColor = p.color;
            token.style.transform = `translate(${idx * 10 - 5}px, ${idx * -5 + 5}px)`;
            token.textContent = p.name.substring(0, 1).toUpperCase();
            // pulsing active player
            if(p.id === this.engine.state.activePlayerIndex) {
              token.style.boxShadow = `0 0 10px ${p.color}, inset 0 0 5px ${p.color}`;
            }
            cellEl.appendChild(token);
          });
        }
        
        this.boardContainer.appendChild(cellEl);
      }
    }
  }

  showModal(title, desc, primaryBtnTxt, primaryAction, secBtnTxt = null, secAction = null) {
    this.interactionModal.classList.add('show');
    this.modalTitle.textContent = title;
    this.modalDesc.textContent = desc;
    this.diceArea.style.display = 'none';
    
    this.btnModalPrimary.textContent = primaryBtnTxt;
    this.btnModalPrimary.onclick = () => { primaryAction(); };
    
    if (secBtnTxt) {
      this.btnModalSecondary.style.display = 'block';
      this.btnModalSecondary.textContent = secBtnTxt;
      this.btnModalSecondary.onclick = () => { secAction(); };
    } else {
      this.btnModalSecondary.style.display = 'none';
    }
  }

  hideModal() {
    this.interactionModal.classList.remove('show');
  }

  playDamageAnim(element) {
    element.classList.remove('flash-red', 'shake');
    void element.offsetWidth; // trigger reflow
    element.classList.add('flash-red', 'shake');
  }

  showInteraction(type, target, onResolve) {
    // type = 'monster' | 'pvp'
    const actPlayer = this.engine.getActivePlayer();
    
    let isLadinoBuff = false;
    if(actPlayer.class === ClassesStr.LADINO && actPlayer.currentLife <= actPlayer.maxLife/3) {
      isLadinoBuff = true;
    }

    if (type === 'monster') {
      const m = target.monster;
      let hp = m.hp;
      let dmgBase = m.dmg;
      let initialPlayerLife = actPlayer.currentLife;
      
      const doAtk = () => {
        this.diceArea.style.display = 'block';
        const atkRes = this.engine.calcularAtaqueBasico(isLadinoBuff);
        
        hp -= atkRes.dmg;
        let str = `🎲 Tirou ${atkRes.roll}! Causa ${atkRes.dmg} dano. ${atkRes.isCrit?'Crítico!':''}\n`;
        
        if (hp <= 0) {
          let lostLife = initialPlayerLife - Math.max(0, actPlayer.currentLife);
          if (lostLife > 0 && actPlayer.isAlive) {
             let recovered = Math.ceil(lostLife / 2);
             actPlayer.currentLife += recovered;
             str += `\n❤️ Você recuperou ${recovered} HP!`;
          }
          str += '\nMonstro derrotado!';
          this.log(`${actPlayer.name} matou um monstro.`, 'log-combat');
          this.diceResult.innerText = str;
          target.type = 'path'; // clearing cell
          target.monster = null;
          this.btnModalPrimary.textContent = "Continuar";
          this.btnModalPrimary.onclick = () => { this.hideModal(); onResolve(); };
          this.btnModalSecondary.style.display = 'none';
        } else {
          str += `\nMonstro sobreviveu (HP: ${hp}) e contra-ataca com ${dmgBase} dano!`;
          this.diceResult.innerText = str;
          const msgDeath = this.engine.aplicarDano(actPlayer, dmgBase);
          this.log(`${actPlayer.name} recebeu ${dmgBase} dano do monstro.`, 'log-combat');
          this.renderStatus();
          
          if(msgDeath) {
            this.log(msgDeath, 'log-combat');
            this.btnModalPrimary.textContent = "Morrer";
            this.btnModalPrimary.onclick = () => { this.hideModal(); onResolve(); };
            this.btnModalSecondary.style.display = 'none';
          } else {
            // Loop goes back to player
            this.btnModalPrimary.textContent = "Atacar Novamente";
            this.btnModalPrimary.onclick = doAtk;
          }
        }
      };

      const doFlee = () => {
        this.log(`${actPlayer.name} fugiu do monstro.`);
        this.hideModal();
        onResolve();
      };

      this.showModal(
        '⚔️ Combate PvE',
        `Monstro: ${hp} HP | ${dmgBase} Dano`,
        'Atacar',
        doAtk,
        (actPlayer.class === ClassesStr.LADINO && actPlayer.uses > 0) ? 'Fugir (Ladino)' : null,
        () => { this.engine.usarHabilidade(); doFlee(); }
      );
    }
  }

  showVictory() {
    const end = document.getElementById('endgame-screen');
    const desc = document.getElementById('endgame-desc');
    desc.textContent = `Vencedor: ${this.engine.state.winner.name} (${this.engine.state.winner.class})`;
    end.classList.add('active');
    document.getElementById('btn-restart').onclick = () => location.reload();
  }
}
