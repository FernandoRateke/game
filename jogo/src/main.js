import './style.css';
import { GameEngine, ClassesStr, CLASS_IMAGES, CLASS_DESCRIPTIONS } from './GameEngine.js';
import { UIController } from './UIController.js';
import { SoundManager } from './SoundManager.js';
import { t, setLang, getLang, initLang } from './i18n.js';

let engine = new GameEngine();
let ui = new UIController(engine);
const sound = new SoundManager();

const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/';
const socket = io(serverUrl);

let myRoomId = null;
let isHost = false;
let selectedClass = null;
let gameMode = 'individual';

// --- DOM ELEMENTS ---
const titleScreen = document.getElementById('title-screen');
const setupScreen = document.getElementById('setup-screen');
const elmMenuInitial = document.getElementById('menu-initial');
const elmMenuSingleplayer = document.getElementById('menu-singleplayer');
const elmMenuMultiplayer = document.getElementById('menu-multiplayer');
const elmMenuLobby = document.getElementById('menu-lobby');
const playerNameInput = document.getElementById('player-name');
const roomCodeInput = document.getElementById('room-code-input');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const btnStartGame = document.getElementById('btn-start');
const classSelScreen = document.getElementById('class-selection-screen');
const classGrid = document.getElementById('class-grid');
const btnConfirmClass = document.getElementById('btn-confirm-class');

// === LANGUAGE SYSTEM ===
initLang();

function updateAllText() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.innerHTML = t(key);
  });
  // Update language button text
  const langBtn = document.getElementById('btn-lang-title');
  if (langBtn) langBtn.textContent = t('language');
}

document.getElementById('btn-lang-title').addEventListener('click', (e) => {
  e.stopPropagation();
  const newLang = getLang() === 'en' ? 'pt' : 'en';
  setLang(newLang);
  updateAllText();
  sound.playClick();
});

updateAllText();

// === TITLE SCREEN ===
function spawnParticles() {
  const container = document.getElementById('title-particles');
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'title-particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = (60 + Math.random() * 40) + '%';
    p.style.animationDelay = Math.random() * 6 + 's';
    p.style.animationDuration = (4 + Math.random() * 4) + 's';
    p.style.width = (1 + Math.random() * 3) + 'px';
    p.style.height = p.style.width;
    container.appendChild(p);
  }
}
spawnParticles();

const bgMusic = document.getElementById('bg-music');
let isMusicMuted = false;

document.getElementById('btn-mute-music').addEventListener('click', (e) => {
  e.stopPropagation();
  isMusicMuted = !isMusicMuted;
  bgMusic.muted = isMusicMuted;
  document.getElementById('btn-mute-music').textContent = isMusicMuted ? '🔇' : '🔊';
});

titleScreen.addEventListener('click', () => {
  sound.init();
  sound.playTitleGong();
  if (!isMusicMuted) {
    bgMusic.volume = 0.3;
    bgMusic.play().catch(e => console.log('Audio autoplay blocked:', e));
  }
  document.getElementById('title-content').classList.add('fading');
  setTimeout(() => {
    titleScreen.classList.remove('active');
    setupScreen.classList.add('active');
  }, 2500);
});

// === MENU NAVIGATION ===
document.getElementById('btn-menu-single').addEventListener('click', () => {
  sound.playClick();
  elmMenuInitial.style.display = 'none';
  elmMenuSingleplayer.style.display = 'block';
});

document.getElementById('btn-menu-multi').addEventListener('click', () => {
  sound.playClick();
  elmMenuInitial.style.display = 'none';
  elmMenuMultiplayer.style.display = 'block';
});

document.querySelectorAll('.btn-back-main').forEach(btn => {
  btn.addEventListener('click', () => {
    sound.playClick();
    elmMenuSingleplayer.style.display = 'none';
    elmMenuMultiplayer.style.display = 'none';
    elmMenuInitial.style.display = 'block';
  });
});

document.getElementById('btn-sp-new').addEventListener('click', () => {
  sound.playClick();
  const pName = document.getElementById('sp-player-name').value.trim() || 'Solo';
  socket.emit('startSingleplayer', { playerName: pName });
});

document.getElementById('btn-sp-continue').addEventListener('click', async () => {
  sound.playClick();
  const pName = document.getElementById('sp-player-name').value.trim();
  if (!pName) { alert('Digite seu nome para carregar o jogo!'); return; }
  
  try {
    const res = await fetch(`/api/load-game/${pName}`);
    const data = await res.json();
    if (data.success && data.state) {
      socket.emit('continueSingleplayer', { state: data.state });
    } else {
      alert('Nenhum jogo salvo encontrado para este nome.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro ao carregar o jogo salvo.');
  }
});

// === MODE SELECTOR ===
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gameMode = btn.dataset.mode;
    sound.playClick();
  });
});

// === LOBBY LOGIC ===
btnCreateRoom.addEventListener('click', () => {
  sound.playClick();
  const pName = playerNameInput.value.trim() || 'Unknown';
  socket.emit('createRoom', { playerName: pName, gameMode });
});

btnJoinRoom.addEventListener('click', () => {
  sound.playClick();
  const pName = playerNameInput.value.trim() || 'Unknown';
  const rCode = roomCodeInput.value.trim().toUpperCase();
  if (rCode.length === 4) {
    socket.emit('joinRoom', { playerName: pName, roomId: rCode });
  } else {
    alert('Invalid room code. Must be 4 characters.');
  }
});

btnStartGame.addEventListener('click', () => {
  sound.playClick();
  if (myRoomId && isHost) {
    socket.emit('startClassSelection', myRoomId);
  }
});

socket.on('roomCreated', ({ roomId, mode }) => {
  myRoomId = roomId;
  isHost = true;

  if (mode === 'singleplayer') {
    // Singleplayer: class selection is already triggered by server, just wait for it
    return;
  }

  elmMenuInitial.style.display = 'none';
  elmMenuSingleplayer.style.display = 'none';
  elmMenuMultiplayer.style.display = 'none';
  elmMenuLobby.style.display = 'block';
  document.getElementById('lobby-room-code').textContent = roomId;
  document.getElementById('lobby-mode-label').textContent = `Mode: ${mode === 'duo' ? 'Duo' : 'Individual'}`;
  btnStartGame.style.display = 'block';
});

socket.on('joinedRoom', ({ roomId, mode }) => {
  myRoomId = roomId;
  isHost = false;
  elmMenuInitial.style.display = 'none';
  elmMenuLobby.style.display = 'block';
  document.getElementById('lobby-room-code').textContent = roomId;
  document.getElementById('lobby-mode-label').textContent = `Mode: ${mode === 'duo' ? 'Duo' : 'Individual'}`;
  btnStartGame.style.display = 'none';
});

socket.on('lobbyUpdate', (lobby) => {
  const list = document.getElementById('lobby-players-list');
  list.innerHTML = '';
  lobby.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `👤 ${p.name}`;
    list.appendChild(li);
  });
});

socket.on('errorMsg', (msg) => alert(msg));

// === CLASS SELECTION ===
let currentDraftPlayerId = null;

socket.on('startClassSelection', ({ classes, takenClasses, draftQueue }) => {
  setupScreen.classList.remove('active');
  classSelScreen.classList.add('active');
  selectedClass = null;
  btnConfirmClass.style.opacity = '0.4';
  btnConfirmClass.style.pointerEvents = 'none';
  btnConfirmClass.textContent = t('confirmSelection');

  // Hide timer for singleplayer
  const timerEl = document.getElementById('class-timer');
  if (timerEl) {
    timerEl.style.display = 'block';
  }

  renderClassGrid(classes, takenClasses, draftQueue);
});

socket.on('classDraftTurn', ({ socketId, name }) => {
  currentDraftPlayerId = socketId;
  const subtitle = classSelScreen.querySelector('.subtitle');
  if (subtitle) {
    if (socketId === socket.id) {
      subtitle.innerHTML = `<span style="color: var(--gold-bright); font-weight: bold;">É a sua vez de escolher!</span>`;
      btnConfirmClass.style.display = 'inline-block';
    } else {
      subtitle.innerHTML = `Aguardando a escolha de <span style="color: var(--gold);">${name}</span>...`;
      btnConfirmClass.style.display = 'none';
    }
  }

  // Update UI list to highlight current turn
  document.querySelectorAll('.draft-player-item').forEach(el => {
    if (el.dataset.id === socketId) {
      el.style.color = 'var(--gold-bright)';
      el.style.fontWeight = 'bold';
      el.textContent = `▶ ${el.dataset.name} (Escolhendo...)`;
    } else {
      el.style.color = 'var(--text-muted)';
      el.style.fontWeight = 'normal';
      el.textContent = `  ${el.dataset.name}`;
    }
  });
});

socket.on('classSelectionUpdate', ({ takenClasses }) => {
  updateClassGridTaken(takenClasses);
});

socket.on('classTimerUpdate', (timeLeft) => {
  const timerEl = document.getElementById('class-timer');
  if (timerEl) {
    timerEl.style.display = 'block';
    timerEl.textContent = `${timeLeft}s`;
  }
});

function renderClassGrid(classes, takenClasses, draftQueue) {
  classGrid.innerHTML = '';
  // Populate the sides with empty slots
  const listA = document.getElementById('team-a-list');
  const listB = document.getElementById('team-b-list');
  if (listA) {
    listA.innerHTML = '<h3 style="color:var(--gold); font-family:var(--font-head); text-align:center; margin-bottom:10px;">Ordem de Escolha</h3>';
    if (draftQueue) {
      draftQueue.forEach(p => {
        const d = document.createElement('div');
        d.className = 'draft-player-item';
        d.dataset.id = p.socketId;
        d.dataset.name = p.name;
        d.style.fontFamily = 'monospace';
        d.style.marginBottom = '5px';
        d.style.fontSize = '0.9rem';
        d.textContent = `  ${p.name}`;
        listA.appendChild(d);
      });
    }
  }
  if (listB) listB.innerHTML = ''; // Only used if duo mode later

  classes.forEach(cls => {
    const card = document.createElement('div');
    card.className = 'class-card';
    card.dataset.class = cls;
    const desc = CLASS_DESCRIPTIONS[cls];
    const img = CLASS_IMAGES[cls];

    if (takenClasses.includes(cls)) {
      card.classList.add('taken');
    }

    card.innerHTML = `
      <img src="${img}" alt="${cls}" />
      <h3>${cls}</h3>
      <p class="card-desc">${desc.desc}</p>
      <span class="card-uses">${desc.uses} ${t('uses')}</span>
    `;

    card.addEventListener('click', () => {
      if (card.classList.contains('taken')) return;
      sound.playClick();
      document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedClass = cls;
      btnConfirmClass.style.opacity = '1';
      btnConfirmClass.style.pointerEvents = 'auto';
    });

    classGrid.appendChild(card);
  });
}

function updateClassGridTaken(takenClasses) {
  document.querySelectorAll('.class-card').forEach(card => {
    const cls = card.dataset.class;
    if (takenClasses.includes(cls)) {
      card.classList.add('taken');
      if (selectedClass === cls) {
        selectedClass = null;
        card.classList.remove('selected');
        btnConfirmClass.style.opacity = '0.4';
        btnConfirmClass.style.pointerEvents = 'none';
      }
    }
  });
}

btnConfirmClass.addEventListener('click', () => {
  if (!selectedClass) return;
  sound.playSkill();
  socket.emit('selectClass', { roomId: myRoomId, className: selectedClass });
  btnConfirmClass.style.opacity = '0.4';
  btnConfirmClass.style.pointerEvents = 'none';
  btnConfirmClass.textContent = t('waitingOthers');
});

// === GAME START ===
socket.on('gameStarted', (initialState) => {
  engine.state = initialState;
  classSelScreen.classList.remove('active');
  setupScreen.classList.remove('active');
  document.getElementById('game-screen').classList.add('active');

  // Re-configure board grid dimensions from received state
  const mapSize = initialState.mapSize || 10;
  const boardContainer = document.getElementById('board-container');
  boardContainer.style.gridTemplateColumns = `repeat(${mapSize}, 48px)`;
  boardContainer.style.gridTemplateRows = `repeat(${mapSize}, 48px)`;
  ui.engine.state = initialState;
  
  // Fading Match Started Overlay
  const overlay = document.getElementById('match-started-overlay');
  overlay.style.display = 'flex';
  setTimeout(() => {
    overlay.style.transition = 'opacity 1.5s ease';
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; overlay.style.opacity = '1'; }, 1500);
  }, 1000);

  sound.playTitleGong();
  ui.renderAll();
  updateSkillPanel(initialState);
});

socket.on('syncState', (state) => {
  engine.state = state;
  ui.renderAll();
  updateSkillPanel(state);
});

function updateSkillPanel(state) {
  const panel = document.getElementById('class-skill-panel');
  const title = document.getElementById('class-skill-title');
  const desc = document.getElementById('class-skill-desc');
  if (!panel || !state.players) return;

  const myPlayer = state.players.find(p => p.socketId === socket.id);
  if (!myPlayer) { panel.style.display = 'none'; return; }

  const skill = CLASS_DESCRIPTIONS[myPlayer.class];
  if (!skill) { panel.style.display = 'none'; return; }

  panel.style.display = 'block';
  title.textContent = skill.title + ` (${myPlayer.uses} use${myPlayer.uses !== 1 ? 's' : ''})`;
  desc.textContent = skill.desc;
}

// === LOG & BANNERS ===
socket.on('logMsg', ({ msg, type }) => ui.log(msg, type));

let bannerTimeout;
socket.on('turnBanner', (playerName) => {
  sound.playTurnChange();
  const banner = document.getElementById('turn-banner');
  banner.textContent = `${t('turnOf')} ${playerName}`;
  banner.classList.add('show');
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => banner.classList.remove('show'), 4000);
});

// === HP BAR UPDATE IN COMBAT MODAL ===
function updateCombatHp(data) {
  const display = document.getElementById('combat-hp-display');
  if (!data || data.playerHp === undefined) {
    display.style.display = 'none';
    return;
  }
  display.style.display = 'block';
  document.getElementById('combat-player-label').textContent = data.playerName || t('playerHp');
  document.getElementById('combat-player-hp-text').textContent = `${Math.max(0,data.playerHp)}/${data.playerMaxHp}`;
  document.getElementById('combat-player-hp-fill').style.width = `${Math.max(0,(data.playerHp/data.playerMaxHp)*100)}%`;
  document.getElementById('combat-enemy-label').textContent = data.enemyName || t('enemyHp');
  document.getElementById('combat-enemy-hp-text').textContent = `${Math.max(0,data.enemyHp)}/${data.enemyMaxHp}`;
  document.getElementById('combat-enemy-hp-fill').style.width = `${Math.max(0,(data.enemyHp/data.enemyMaxHp)*100)}%`;
}

// === COMBAT MODALS (only for active player) ===
socket.on('showModal', (data) => {
  ui.hideSpectatorBanner();
  ui.interactionModal.classList.add('show');
  ui.modalTitle.textContent = data.title;
  ui.modalDesc.textContent = data.desc;
  ui.diceArea.style.display = 'none';
  ui.diceResult.innerText = '';

  updateCombatHp(data);

  if (data.type === 'pve_atk') sound.playMonsterEncounter();

  ui.btnModalPrimary.textContent = data.primaryBtn;
  ui.btnModalPrimary.onclick = () => {
    if (data.type.startsWith('encounter_')) {
      sound.playClick();
      socket.emit('modalResolve', { roomId: myRoomId, actionType: data.type });
    } else {
      sound.playDiceRoll();
      socket.emit('rollDice', { roomId: myRoomId, actionType: data.type });
    }
  };

  if (data.showSecBtn) {
    ui.btnModalSecondary.style.display = 'block';
    ui.btnModalSecondary.textContent = data.secBtnTxt;
    ui.btnModalSecondary.onclick = () => {
      sound.playSkill();
      socket.emit('modalResolve', { roomId: myRoomId, actionType: data.secType });
    };
  } else {
    ui.btnModalSecondary.style.display = 'none';
  }
});

// Spectator view (non-active players see this during combat)
socket.on('showSpectatorBanner', ({ title, detail }) => {
  ui.showSpectatorBanner(title, detail);
});

socket.on('hideSpectatorBanner', () => {
  ui.hideSpectatorBanner();
});

socket.on('updateModalPrimary', (data) => {
  ui.btnModalPrimary.textContent = data.text;
  ui.btnModalPrimary.onclick = () => {
    if (data.actionType === 'pve_atk' || data.actionType === 'pve_atk_safe') {
      sound.playDiceRoll();
      socket.emit('rollDice', { roomId: myRoomId, actionType: data.actionType });
    } else {
      socket.emit('modalResolve', { roomId: myRoomId, actionType: data.actionType });
    }
  };
  ui.btnModalSecondary.style.display = 'none';
});

socket.on('diceResult', (data) => {
  ui.diceArea.style.display = 'block';
  ui.diceResult.innerText = data.text;
  if (data.playerHp !== undefined) updateCombatHp(data);
  if (data.type === 'crit') sound.playCrit();
  else if (data.type === 'hit') sound.playHit();
  else if (data.type === 'death') sound.playDeath();
  else if (data.type === 'heal') sound.playHeal();
});

socket.on('closeModal', () => {
  ui.hideModal();
  ui.hideSpectatorBanner();
});

socket.on('playSound', (soundType) => {
  if (soundType === 'key') sound.playKeyPickup();
  else if (soundType === 'teleport') sound.playTeleport();
  else if (soundType === 'hit') sound.playHit();
  else if (soundType === 'heal') sound.playHeal();
  else if (soundType === 'skill') sound.playSkill();
  else if (soundType === 'death') sound.playDeath();
  else if (soundType === 'step') sound.playStep();
});

// Pictomancer shuffle animation
socket.on('shuffleAnimation', async () => {
  sound.playShuffle();
  await ui.showShuffleAnimation();
});

// === VICTORY / GAME OVER ===
socket.on('showVictory', (data) => {
  const end = document.getElementById('endgame-screen');
  const desc = document.getElementById('endgame-desc');
  const title = document.getElementById('endgame-title');

  if (socket.id === data.winnerSocketId || (data.winnerTeam && data.teamSockets && data.teamSockets.includes(socket.id))) {
    title.textContent = 'VICTORY';
    title.style.color = '#c8a84e';
    title.style.textShadow = '0 0 30px rgba(200,168,78,0.6)';
    title.className = 'game-over-title';
    title.style.color = '#c8a84e';
    sound.playVictory();
  } else {
    title.textContent = 'DEFEAT';
    title.style.color = '#b91c1c';
    title.style.textShadow = '0 0 20px #b91c1c';
    sound.playDeath();
  }

  desc.textContent = data.teamWin
    ? `Team ${data.winnerTeam} wins! (${data.winnerName} escaped)`
    : `Winner: ${data.winnerName} (${data.winnerClass})`;
  end.classList.add('active');
});

socket.on('showGameOver', () => {
  sound.playDeath();
  const end = document.getElementById('endgame-screen');
  document.getElementById('endgame-desc').textContent = 'All explorers perished in the darkness...';
  document.getElementById('endgame-title').textContent = 'GAME OVER';
  end.classList.add('active');
});

// === CONTROLS ===
document.addEventListener('keydown', (e) => {
  if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
  if (!document.getElementById('game-screen').classList.contains('active')) return;
  
  // If modal is open, intercept spacebar for secondary action
  if (ui.interactionModal.classList.contains('show')) {
    if (e.key === ' ' && ui.btnModalSecondary.style.display !== 'none') {
      e.preventDefault();
      ui.btnModalSecondary.click();
    }
    return;
  }

  let dir = null;
  if (e.key === 'ArrowUp' || e.key === 'w') dir = 'up';
  if (e.key === 'ArrowDown' || e.key === 's') dir = 'down';
  if (e.key === 'ArrowLeft' || e.key === 'a') dir = 'left';
  if (e.key === 'ArrowRight' || e.key === 'd') dir = 'right';

  if (isTutorialMode) {
    if (dir) {
      e.preventDefault();
      handleTutorialMove(dir);
    }
    if (e.key === ' ') {
      e.preventDefault();
      handleTutorialAction();
    }
    return;
  }

  if (dir) {
    e.preventDefault();
    socket.emit('move', { roomId: myRoomId, dir });
  }
  if (e.key === ' ') {
    e.preventDefault();
    socket.emit('action', { roomId: myRoomId });
  }
});

// === INTERACTIVE TUTORIAL LOGIC ===
let isTutorialMode = false;
let tutPhase = 0;

function setTutorialBalloon(text, targetId = 'board-container', showBtn = false) {
  const balloon = document.getElementById('tutorial-balloon');
  const textEl = document.getElementById('tutorial-text');
  const btn = document.getElementById('btn-tutorial-ok');
  const target = document.getElementById(targetId);
  
  if (!target) return;
  textEl.innerHTML = text;
  balloon.style.display = 'block';
  btn.style.display = showBtn ? 'inline-block' : 'none';
  
  const rect = target.getBoundingClientRect();
  const balloonH = 140;
  let top = rect.top + (rect.height / 2) - balloonH / 2;
  let left = rect.right + 20;
  
  if (left + 310 > window.innerWidth) {
    left = rect.left - 330;
  }
  if (top < 10) top = 10;
  if (top + balloonH > window.innerHeight - 10) top = window.innerHeight - balloonH - 10;
  
  balloon.style.top = top + 'px';
  balloon.style.left = left + 'px';
}

document.getElementById('btn-tutorial-ok').addEventListener('click', () => {
  sound.playClick();
  if (isTutorialMode) {
    if (tutPhase === 0) {
      tutPhase = 0.1;
      setTutorialBalloon('⚡ Esta é a sua Habilidade. Como Ladino, pode fugir de combates apertando ESPAÇO.', 'class-skill-panel', true);
    } else if (tutPhase === 0.1) {
      tutPhase = 0.2;
      setTutorialBalloon('📜 Este é o Log de Eventos. Tudo fica registrado aqui.', 'event-log', true);
    } else if (tutPhase === 0.2) {
      tutPhase = 1;
      setTutorialBalloon('🗺️ O tabuleiro começa escuro. Agora use as <b>SETAS DO TECLADO</b> para dar um passo para qualquer lado.', 'board-container', false);
    } else if (tutPhase === 2.5) {
      tutPhase = 3;
      setTutorialBalloon('Perfeito! Dê mais um passo no tabuleiro.', 'board-container', false);
    } else if (tutPhase === 4.5) {
      tutPhase = 5;
      setTutorialBalloon('Isso foi repentino! Continue explorando.', 'board-container', false);
    } else if (tutPhase === 6.5) {
      tutPhase = 7;
      setTutorialBalloon('Estamos quase no fim. Dê mais um passo.', 'board-container', false);
    }
  }
});

function handleTutorialMove(dir) {
  if (![1, 2, 3, 4, 5, 7, 8].includes(tutPhase)) return;
  
  const p = engine.getActivePlayer();
  let nx = p.x; let ny = p.y;
  if (dir === 'up') ny--;
  if (dir === 'down') ny++;
  if (dir === 'left') nx--;
  if (dir === 'right') nx++;
  
  if (nx < 0 || nx >= engine.state.mapSize || ny < 0 || ny >= engine.state.mapSize) return;

  const targetCell = engine.state.map[ny][nx];
  
  if (targetCell.revealed) {
    p.x = nx; p.y = ny;
    sound.playStep();
    ui.renderAll();
    return;
  }
  
  if (tutPhase === 1) targetCell.type = 'path';
  else if (tutPhase === 2) targetCell.type = 'key';
  else if (tutPhase === 3) targetCell.type = 'path';
  else if (tutPhase === 4) targetCell.type = 'teleport';
  else if (tutPhase === 5) {
    targetCell.type = 'monster';
    targetCell.monster = { hp: 5, dmg: 1 };
  }
  else if (tutPhase === 7) {
    targetCell.type = 'monster';
    targetCell.monster = { hp: 10, dmg: 2 };
  }
  else if (tutPhase === 8) targetCell.type = 'door';

  p.x = nx; p.y = ny;
  targetCell.revealed = true;
  sound.playStep();
  
  if (tutPhase === 1) {
    tutPhase = 2;
    setTutorialBalloon('Você andou e revelou uma carta! Sempre que você entra no escuro, o mapa é revelado. Dê mais um passo!', 'board-container', false);
  } else if (tutPhase === 2) {
    tutPhase = 2.5;
    engine.coletarItem();
    sound.playKeyPickup();
    setTutorialBalloon('🔑 Você encontrou a Chave! Ela foi pega automaticamente. Sem ela, a Porta não se abre.', 'board-container', true);
  } else if (tutPhase === 3) {
    tutPhase = 4;
    setTutorialBalloon('Um caminho normal. Dê mais um passo.', 'board-container', false);
  } else if (tutPhase === 4) {
    tutPhase = 4.5;
    sound.playTeleport();
    setTutorialBalloon('🌀 Um Portal! Portais te teleportam para um local aleatório não revelado do mapa.', 'board-container', true);
    const emptyPos = engine.getRandomEmptyPos(nx, ny);
    p.x = emptyPos.x; p.y = emptyPos.y;
    engine.state.map[p.y][p.x].revealed = true;
  } else if (tutPhase === 5) {
    tutPhase = 5.5;
    document.getElementById('tutorial-balloon').style.display = 'none';
    sound.playMonsterEncounter();
    
    ui.interactionModal.classList.add('show');
    ui.modalTitle.textContent = 'Combate!';
    ui.modalDesc.textContent = 'Você encontrou um monstro. Em partidas normais, existem vários tipos. Você precisa lutar usando um dado D6. Clique em Atacar!';
    ui.diceArea.style.display = 'none';
    
    const display = document.getElementById('combat-hp-display');
    display.style.display = 'block';
    document.getElementById('combat-player-label').textContent = 'Você';
    document.getElementById('combat-player-hp-text').textContent = `${p.currentLife}/${p.maxLife}`;
    document.getElementById('combat-player-hp-fill').style.width = '100%';
    document.getElementById('combat-enemy-label').textContent = 'Monstro';
    document.getElementById('combat-enemy-hp-text').textContent = '5/5';
    document.getElementById('combat-enemy-hp-fill').style.width = '100%';
    
    ui.btnModalPrimary.textContent = 'Atacar';
    ui.btnModalSecondary.style.display = 'none';
    
    ui.btnModalPrimary.onclick = () => {
      sound.playDiceRoll();
      ui.diceArea.style.display = 'block';
      ui.diceResult.innerText = '🎲 6 - Dano Crítico!';
      sound.playCrit();
      document.getElementById('combat-enemy-hp-text').textContent = '0/5';
      document.getElementById('combat-enemy-hp-fill').style.width = '0%';
      ui.btnModalPrimary.style.display = 'none';
      
      setTimeout(() => {
        ui.hideModal();
        ui.btnModalPrimary.style.display = 'block';
        sound.playHeal();
        tutPhase = 6.5;
        targetCell.type = 'path';
        targetCell.monster = null;
        setTutorialBalloon('Vitória! Vencer um combate PvE recupera 50% do HP perdido na luta. Continue!', 'board-container', true);
        ui.renderAll();
      }, 2500);
    };
  } else if (tutPhase === 7) {
    tutPhase = 7.5;
    sound.playMonsterEncounter();
    setTutorialBalloon('👹 Outro monstro! Mas lembre-se: você é da classe Ninja (Ladino). <br><br><b>Aperte [ ESPAÇO ]</b> agora para usar sua habilidade de Fuga e escapar!', 'class-skill-panel', false);
  } else if (tutPhase === 8) {
    tutPhase = 9;
    sound.playVictory();
    document.getElementById('tutorial-balloon').style.display = 'none';
    const end = document.getElementById('endgame-screen');
    const title = document.getElementById('endgame-title');
    title.textContent = 'TUTORIAL CONCLUÍDO';
    title.style.fontSize = '2.5rem';
    title.style.color = '#c8a84e';
    title.style.textShadow = '0 0 30px rgba(200,168,78,0.6)';
    document.getElementById('endgame-desc').textContent = 'Você escapou com sucesso! Agora você está pronto para jogar. Crie salas no modo Multiplayer ou jogue Singleplayer.';
    end.classList.add('active');
  }
  
  ui.renderAll();
}

function handleTutorialAction() {
  if (tutPhase === 7.5) {
    const p = engine.getActivePlayer();
    if (p.uses > 0) p.uses--;
    sound.playSkill();
    setTutorialBalloon('💨 Fuga bem-sucedida! Habilidades têm usos limitados, então pense bem. Continue andando para ver o que vai encontrar!', 'board-container', false);
    const targetCell = engine.state.map[p.y][p.x];
    targetCell.type = 'path';
    targetCell.monster = null;
    tutPhase = 8;
    ui.renderAll();
    updateSkillPanel(engine.state);
  }
}

document.getElementById('btn-menu-tutorial').addEventListener('click', () => {
  sound.playClick();
  isTutorialMode = true;
  tutPhase = 0;
  
  elmMenuInitial.style.display = 'none';
  setupScreen.classList.remove('active');
  document.getElementById('game-screen').classList.add('active');
  
  const mockConfig = [{ name: 'Aventureiro', class: ClassesStr.LADINO }];
  engine.initGame(mockConfig, 'singleplayer');
  engine.state.players[0].socketId = socket.id;

  const cx = Math.floor(engine.state.mapSize / 2);
  const cy = Math.floor(engine.state.mapSize / 2);
  for (let y = 0; y < engine.state.mapSize; y++) {
    for (let x = 0; x < engine.state.mapSize; x++) {
      engine.state.map[y][x].revealed = (x === cx && y === cy);
      engine.state.map[y][x].type = 'path';
      engine.state.map[y][x].monster = null;
    }
  }

  const boardContainer = document.getElementById('board-container');
  boardContainer.style.gridTemplateColumns = `repeat(${engine.state.mapSize}, 48px)`;
  boardContainer.style.gridTemplateRows = `repeat(${engine.state.mapSize}, 48px)`;

  ui.renderAll();
  updateSkillPanel(engine.state);
  
  setTutorialBalloon('Bem-vindo a Hollow Depths! Aqui na esquerda ficam os status dos jogadores, como HP e Classe.', 'players-status-list', true);
});

// === GENERIC BUTTONS ===
document.getElementById('btn-rules').addEventListener('click', () => {
  sound.playClick();
  document.getElementById('rules-modal').classList.add('show');
});
document.getElementById('btn-close-rules').addEventListener('click', () => {
  sound.playClick();
  document.getElementById('rules-modal').classList.remove('show');
});
document.getElementById('btn-cancel-lobby')?.addEventListener('click', () => location.reload());
document.getElementById('btn-main-menu')?.addEventListener('click', () => location.reload());
document.getElementById('btn-restart')?.addEventListener('click', () => location.reload());
