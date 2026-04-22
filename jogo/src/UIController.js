import { ClassesStr, CLASS_IMAGES } from './GameEngine.js';

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

    this.boardContainer.style.gridTemplateColumns = `repeat(${this.engine.state.mapSize}, 48px)`;
    this.boardContainer.style.gridTemplateRows = `repeat(${this.engine.state.mapSize}, 48px)`;
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
    if (p) {
      this.currentPlayerNameEl.textContent = `Turn: ${p.name} (${p.class})`;
      this.currentPlayerNameEl.style.color = p.color;
    }
  }

  renderStatus() {
    this.statusListEl.innerHTML = '';
    this.engine.state.players.forEach(p => {
      const isAct = p.id === this.engine.state.activePlayerIndex;
      const card = document.createElement('div');
      card.className = `player-card ${isAct ? 'active' : ''} ${!p.isAlive ? 'dead' : ''}`;

      const hpPct = Math.max(0, (p.currentLife / p.maxLife) * 100);
      const hpColor = hpPct < 30 ? '#b91c1c' : hpPct < 60 ? '#c8a84e' : '#166534';

      let statusIcons = '';
      if (p.hasKey) statusIcons += '🔑 ';
      if (!p.isAlive) statusIcons += '💀 ';
      if (p.skipNextTurn) statusIcons += '❄️ ';
      if (p.invisibleTurns > 0) statusIcons += '👻 ';
      if (p.critBuff) statusIcons += '🗡️ ';

      const teamLabel = p.team ? ` [Team ${p.team}]` : '';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:${p.color}; font-family:var(--font-head); font-size:0.85rem;">${p.name}</strong>
          <span style="font-size:0.75rem; color:var(--text-muted);">${p.class}${teamLabel}</span>
        </div>
        <div style="font-size:0.75rem; margin-top:3px; color:var(--text-muted);">
          HP: ${p.currentLife}/${p.maxLife} | Skills: ${p.uses} | Turns: ${p.turnsPlayed}
        </div>
        ${statusIcons ? `<div style="font-size:0.75rem; color:var(--gold);">${statusIcons}</div>` : ''}
        <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%; background:${hpColor};"></div></div>
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
          cellEl.classList.add('revealed', cellData.type);

          if (cellData.type === 'monster' && cellData.monster) {
            const isSummoned = cellData.monster.summoned;
            cellEl.innerHTML = `${isSummoned ? '🧟' : '👹'}<span style="position:absolute;bottom:1px;right:2px;font-size:9px;color:white;">${cellData.monster.hp}♥</span>`;
          } else if (cellData.type === 'door') {
            cellEl.innerHTML = '🚪';
          } else if (cellData.type === 'key') {
            cellEl.innerHTML = '🔑';
          } else if (cellData.type === 'teleport') {
            cellEl.innerHTML = '🌀';
          }
        }

        // Players
        const playersHere = this.engine.state.players.filter(p => p.isAlive && p.x === x && p.y === y);
        if (playersHere.length > 0 && cellData.revealed) {
          playersHere.forEach((p, idx) => {
            const token = document.createElement('div');
            token.className = 'player-token';
            token.style.borderColor = p.color;
            token.style.transform = `translate(${idx * 8 - 4}px, ${idx * -4 + 4}px)`;
            token.textContent = p.name.substring(0, 1).toUpperCase();

            if (p.invisibleTurns > 0) {
              token.style.opacity = '0.3';
            }

            if (p.id === this.engine.state.activePlayerIndex) {
              token.style.boxShadow = `0 0 10px ${p.color}, inset 0 0 5px ${p.color}`;
            }
            cellEl.appendChild(token);
          });
        }

        this.boardContainer.appendChild(cellEl);
      }
    }
  }

  hideModal() {
    this.interactionModal.classList.remove('show');
  }

  // Show shuffle animation for Pictomancer
  showShuffleAnimation() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'shuffle-overlay';
      overlay.innerHTML = '<div class="joker">🃏</div><p>Shuffling the board...</p>';
      document.body.appendChild(overlay);

      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 2500);
    });
  }

  // Show spectator banner
  showSpectatorBanner(title, desc) {
    const banner = document.getElementById('spectator-banner');
    document.getElementById('spectator-title').textContent = title;
    document.getElementById('spectator-desc').textContent = desc;
    banner.style.display = 'block';
  }

  hideSpectatorBanner() {
    document.getElementById('spectator-banner').style.display = 'none';
  }
}
