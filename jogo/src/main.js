import './style.css';
import { GameEngine, ClassesStr } from './GameEngine.js';
import { UIController } from './UIController.js';

// Setup engine to hold state (logic runs on server)
let engine = new GameEngine();
let ui = new UIController(engine);

// Socket setup
// Em dev roda na 3000. Em prod conecta na raiz '/'
const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/';
const socket = io(serverUrl);

let myRoomId = null;
let isHost = false;

// --- DOM ELEMENTS ---
const elmMenuInitial = document.getElementById('menu-initial');
const elmMenuLobby = document.getElementById('menu-lobby');
const playerNameInput = document.getElementById('player-name');
const roomCodeInput = document.getElementById('room-code-input');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const btnStartGame = document.getElementById('btn-start');

// --- LOBBY LOGIC ---
btnCreateRoom.addEventListener('click', () => {
    const pName = playerNameInput.value.trim() || 'Desconhecido';
    socket.emit('createRoom', { playerName: pName });
});

btnJoinRoom.addEventListener('click', () => {
    const pName = playerNameInput.value.trim() || 'Desconhecido';
    const rCode = roomCodeInput.value.trim().toUpperCase();
    if(rCode.length === 4) {
        socket.emit('joinRoom', { playerName: pName, roomId: rCode });
    } else {
        alert("Código de sala inválido. Deve ter 4 letras.");
    }
});

btnStartGame.addEventListener('click', () => {
    if(myRoomId && isHost) {
        socket.emit('startGame', myRoomId);
    }
});

socket.on('roomCreated', (roomId) => {
    myRoomId = roomId;
    isHost = true;
    elmMenuInitial.style.display = 'none';
    elmMenuLobby.style.display = 'block';
    document.getElementById('lobby-room-code').textContent = roomId;
    btnStartGame.style.display = 'block'; // Host pode iniciar
});

socket.on('joinedRoom', (roomId) => {
    myRoomId = roomId;
    isHost = false;
    elmMenuInitial.style.display = 'none';
    elmMenuLobby.style.display = 'block';
    document.getElementById('lobby-room-code').textContent = roomId;
    btnStartGame.style.display = 'none'; // Apenas host inicia
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

socket.on('errorMsg', (msg) => {
    alert(msg);
});

// --- GAME LOGIC ---
socket.on('gameStarted', (initialState) => {
    engine.state = initialState;
    document.getElementById('setup-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    ui.renderAll();
});

socket.on('syncState', (state) => {
    engine.state = state;
    ui.renderAll();
    updateSkillPanel(state);
});

// Descrições das habilidades por classe
const CLASS_SKILLS = {
  'Ladino': { title: '⚡ Ladino – Fuga / Golpe Duplo', desc: 'Se tiver menos de 33% de vida, causa dano dobrado. No combate PvE pode fugir sem lutar (3 usos).' },
  'Bardo': { title: '🎵 Bardo – Paralisia', desc: 'Paralisa um inimigo por 1 turno inteiro, fazendo ele perder sua vez (2 usos).' },
  'Paladino': { title: '🛡️ Paladino – Cura', desc: 'Recupera +2 de vida imediatamente. Ao morrer, revive 1 vez com metade da vida (3 usos).' },
  'Mago': { title: '✨ Mago – Celeridade / Portal', desc: 'Joga mais um turno em seguida (Celeridade) ou se teleporta para outra sala aleatória (Portal) (2 usos).' }
};

function updateSkillPanel(state) {
    const panel = document.getElementById('class-skill-panel');
    const title = document.getElementById('class-skill-title');
    const desc = document.getElementById('class-skill-desc');
    if (!panel || !state.players) return;
    
    // Find MY player by socketId
    const myPlayer = state.players.find(p => p.socketId === socket.id);
    if (!myPlayer) { panel.style.display = 'none'; return; }
    
    const skill = CLASS_SKILLS[myPlayer.class];
    if (!skill) { panel.style.display = 'none'; return; }
    
    panel.style.display = 'block';
    title.textContent = skill.title + ` (${myPlayer.uses} uso${myPlayer.uses !== 1 ? 's' : ''})`;
    desc.textContent = skill.desc;
}

socket.on('logMsg', ({msg, type}) => {
    ui.log(msg, type);
});

// Banner Dinâmico de 5 segundos
let bannerTimeout;
socket.on('turnBanner', (playerName) => {
    const banner = document.getElementById('turn-banner');
    banner.textContent = `Rodada de ${playerName}`;
    banner.classList.add('show');
    clearTimeout(bannerTimeout);
    bannerTimeout = setTimeout(() => {
        banner.classList.remove('show');
    }, 5000);
});

// Modals e Interações PvP / PvE controlados pelo Servidor
socket.on('showModal', (data) => {
    // data: { title, desc, primaryBtn, showSecBtn, secBtnTxt, type, secType }
    ui.interactionModal.classList.add('show');
    ui.modalTitle.textContent = data.title;
    ui.modalDesc.textContent = data.desc;
    ui.diceArea.style.display = 'none';
    ui.diceResult.innerText = '';
    
    ui.btnModalPrimary.textContent = data.primaryBtn;
    ui.btnModalPrimary.onclick = () => { socket.emit('rollDice', { roomId: myRoomId, actionType: data.type }); };
    
    if (data.showSecBtn) {
        ui.btnModalSecondary.style.display = 'block';
        ui.btnModalSecondary.textContent = data.secBtnTxt;
        ui.btnModalSecondary.onclick = () => { socket.emit('modalResolve', { roomId: myRoomId, actionType: data.secType }); };
    } else {
        ui.btnModalSecondary.style.display = 'none';
    }
});

socket.on('updateModalPrimary', (data) => {
    ui.btnModalPrimary.textContent = data.text;
    ui.btnModalPrimary.onclick = () => {
        if(data.actionType === 'pve_atk') {
            socket.emit('rollDice', { roomId: myRoomId, actionType: 'pve_atk'});
        } else {
            socket.emit('modalResolve', { roomId: myRoomId, actionType: data.actionType });
        }
    };
    ui.btnModalSecondary.style.display = 'none';
});

socket.on('diceResult', (text) => {
    ui.diceArea.style.display = 'block';
    ui.diceResult.innerText = text;
});

socket.on('closeModal', () => {
    ui.hideModal();
});

socket.on('showVictory', (data) => {
    const end = document.getElementById('endgame-screen');
    const desc = document.getElementById('endgame-desc');
    const title = document.getElementById('endgame-title');
    
    if (socket.id === data.winnerSocketId) {
        title.textContent = 'VITÓRIA!';
        title.style.color = '#fbbf24';
        title.style.textShadow = '0 0 20px #fbbf24';
    } else {
        title.textContent = 'GAME OVER';
        title.style.color = '#ef4444';
        title.style.textShadow = '0 0 20px #dc2626';
    }
    
    desc.textContent = `Vencedor: ${data.winnerName} (${data.winnerClass})`;
    end.classList.add('active');
});

socket.on('showGameOver', () => {
    const end = document.getElementById('endgame-screen');
    const desc = document.getElementById('endgame-desc');
    desc.textContent = "Todos os exploradores pereceram na escuridão...";
    document.getElementById('endgame-title').textContent = "GAME OVER";
    document.getElementById('endgame-title').classList.add('game-over-title');
    end.classList.add('active');
});

// --- CONTROLS ---
document.addEventListener('keydown', (e) => {
    // Ignorar se o foco está em algum input de texto
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
    if (!document.getElementById('game-screen').classList.contains('active')) return;
    if (ui.interactionModal.classList.contains('show')) return;
    
    let dir = null;
    if (e.key === 'ArrowUp') dir = 'up';
    if (e.key === 'ArrowDown') dir = 'down';
    if (e.key === 'ArrowLeft') dir = 'left';
    if (e.key === 'ArrowRight') dir = 'right';
    
    if (dir) {
        e.preventDefault();
        socket.emit('move', { roomId: myRoomId, dir });
    }
    if (e.key === ' ') {
        e.preventDefault();
        socket.emit('action', { roomId: myRoomId });
    }
});

document.querySelectorAll('.btn-dir').forEach(btn => {
    btn.addEventListener('click', () => {
        if(ui.interactionModal.classList.contains('show')) return;
        socket.emit('move', { roomId: myRoomId, dir: btn.dataset.dir });
    });
});

document.getElementById('btn-action')?.addEventListener('click', () => {
    if(ui.interactionModal.classList.contains('show')) return;
    socket.emit('action', { roomId: myRoomId });
});

// Botões Genéricos
document.getElementById('btn-rules').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.add('show');
});

document.getElementById('btn-close-rules').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.remove('show');
});

if(document.getElementById('btn-cancel-lobby')) {
    document.getElementById('btn-cancel-lobby').addEventListener('click', () => location.reload());
}

if(document.getElementById('btn-main-menu')) {
    document.getElementById('btn-main-menu').addEventListener('click', () => location.reload());
}
if(document.getElementById('btn-restart')) {
    document.getElementById('btn-restart').addEventListener('click', () => location.reload());
}
