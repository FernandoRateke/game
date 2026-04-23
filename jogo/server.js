import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { GameEngine, ClassesStr } from './src/GameEngine.js';

const DB_PATH = join(__dirname, 'database.json');

async function loadDb() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return { singleplayerSaves: {} };
  }
}

async function saveDb(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}


const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(express.static(join(__dirname, 'dist')));
app.use(express.json());

// === SINGLEPLAYER ENDPOINTS ===
app.post('/api/save-game', async (req, res) => {
  const { playerName, state } = req.body;
  if (!playerName) return res.status(400).send('No name');
  const db = await loadDb();
  db.singleplayerSaves[playerName] = state;
  await saveDb(db);
  res.send({ success: true });
});

app.get('/api/load-game/:name', async (req, res) => {
  const db = await loadDb();
  const state = db.singleplayerSaves[req.params.name];
  if (state) res.send({ success: true, state });
  else res.send({ success: false });
});

const rooms = {};
const ALL_CLASSES = [
  ClassesStr.LADINO, ClassesStr.BARDO, ClassesStr.PALADINO, ClassesStr.MAGO,
  ClassesStr.SUMMONER, ClassesStr.SAMURAI, ClassesStr.REAPER, ClassesStr.PICTOMANCER
];

const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // === CREATE ROOM ===
  socket.on('createRoom', ({ playerName, gameMode }) => {
    let roomId = generateRoomCode();
    while (rooms[roomId]) roomId = generateRoomCode();

    rooms[roomId] = {
      engine: new GameEngine(),
      lobby: [{ socketId: socket.id, name: playerName || 'Host' }],
      started: false,
      gameMode: gameMode || 'individual',
      classSelections: {},
      classSelectionStarted: false
    };

    socket.join(roomId);
    socket.emit('roomCreated', { roomId, mode: gameMode });
    io.to(roomId).emit('lobbyUpdate', rooms[roomId].lobby);
    console.log(`Room ${roomId} created by ${playerName} (${gameMode})`);
  });

  // === JOIN ROOM ===
  socket.on('joinRoom', ({ playerName, roomId }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit('errorMsg', 'Room does not exist.');
    if (room.started) return socket.emit('errorMsg', 'Game already started.');
    if (room.lobby.length >= 8) return socket.emit('errorMsg', 'Room is full (max 8).');

    room.lobby.push({ socketId: socket.id, name: playerName || `Player ${room.lobby.length + 1}` });
    socket.join(roomId);
    socket.emit('joinedRoom', { roomId, mode: room.gameMode });
    io.to(roomId).emit('lobbyUpdate', room.lobby);
    console.log(`${playerName} joined room ${roomId}`);
  });

  // === CLASS SELECTION PHASE ===
  socket.on('startClassSelection', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.gameMode === 'duo' && room.lobby.length % 2 !== 0) {
      socket.emit('errorMsg', 'Duo mode requires even number of players.');
      return;
    }
    if (room.lobby.length < 1) return;

    room.classSelectionStarted = true;
    room.classSelections = {};

    io.to(roomId).emit('startClassSelection', {
      classes: ALL_CLASSES,
      takenClasses: []
    });

    // 30s Timer for Class Selection
    let timeLeft = 30;
    room.timerInterval = setInterval(() => {
      timeLeft--;
      io.to(roomId).emit('classTimerUpdate', timeLeft);
      if (timeLeft <= 0) {
        clearInterval(room.timerInterval);
        // Auto-assign remaining players
        room.lobby.forEach(p => {
          if (!room.classSelections[p.socketId]) {
            const available = ALL_CLASSES.filter(c => !Object.values(room.classSelections).includes(c));
            room.classSelections[p.socketId] = available[0] || ALL_CLASSES[0];
          }
        });
        startGame(roomId, room);
      }
    }, 1000);
  });

  socket.on('selectClass', ({ roomId, className }) => {
    const room = rooms[roomId];
    if (!room || !room.classSelectionStarted) return;

    // Check if class is already taken
    const taken = Object.values(room.classSelections);
    if (taken.includes(className)) {
      socket.emit('errorMsg', 'Class already taken!');
      return;
    }

    room.classSelections[socket.id] = className;
    const takenClasses = Object.values(room.classSelections);

    io.to(roomId).emit('classSelectionUpdate', { takenClasses });

    // Check if all players selected
    if (Object.keys(room.classSelections).length === room.lobby.length) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      startGame(roomId, room);
    }
  });

  socket.on('startSingleplayer', ({ playerName }) => {
    let roomId = generateRoomCode();
    rooms[roomId] = {
      engine: new GameEngine(),
      lobby: [{ socketId: socket.id, name: playerName || 'Solo' }],
      started: false,
      gameMode: 'singleplayer',
      classSelections: {}
    };
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, mode: 'singleplayer' });
    
    // Auto-start class selection for singleplayer
    rooms[roomId].classSelectionStarted = true;
    socket.emit('startClassSelection', {
      classes: ALL_CLASSES,
      takenClasses: []
    });
  });

  socket.on('continueSingleplayer', ({ state, roomId }) => {
    let id = roomId || generateRoomCode();
    rooms[id] = {
      engine: new GameEngine(),
      lobby: state.players.map(p => ({ socketId: socket.id, name: p.name })),
      started: true,
      gameMode: 'singleplayer',
      classSelections: {}
    };
    rooms[id].engine.state = state;
    rooms[id].engine.state.players[0].socketId = socket.id; // Refresh socket
    
    socket.join(id);
    socket.emit('roomCreated', { roomId: id, mode: 'singleplayer' });
    socket.emit('gameStarted', rooms[id].engine.state);
    
    const atvP = rooms[id].engine.getActivePlayer();
    socket.emit('turnBanner', atvP.name);
  });

  function startGame(roomId, room) {
    const playerConfigs = room.lobby.map((p, idx) => {
      const team = room.gameMode === 'duo' ? String.fromCharCode(65 + Math.floor(idx / 2)) : null;
      return {
        name: p.name,
        class: room.classSelections[p.socketId] || ALL_CLASSES[idx % ALL_CLASSES.length],
        team
      };
    });

    room.engine.initGame(playerConfigs, room.gameMode);

    room.engine.state.players.forEach((p, idx) => {
      p.socketId = room.lobby[idx].socketId;
    });

    room.started = true;
    io.to(roomId).emit('gameStarted', room.engine.state);

    const atvP = room.engine.getActivePlayer();
    io.to(roomId).emit('turnBanner', atvP.name);
  }

  // === MOVEMENT ===
  socket.on('move', ({ roomId, dir }) => {
    const room = rooms[roomId];
    if (!room || !room.started) return;
    const engine = room.engine;
    const p = engine.getActivePlayer();
    if (p.socketId !== socket.id) return;

    if (engine.moverJogador(dir)) {
      io.to(roomId).emit('playSound', 'step');
      io.to(roomId).emit('logMsg', { msg: `${p.name} moved.`, type: 'log-move' });
      resolveCellEvent(roomId, engine);
    }
  });

  // === ACTION (skill / PvP) ===
  socket.on('action', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.started) return;
    const engine = room.engine;
    const actP = engine.getActivePlayer();
    if (actP.socketId !== socket.id) return;

    // Check PvP
    const enemiesHere = engine.state.players.filter(e =>
      e.isAlive && e.id !== actP.id && e.x === actP.x && e.y === actP.y &&
      !engine.areTeammates(actP, e)
    );

    if (enemiesHere.length > 0) {
      handleAction(socket, roomId, true);
      return;
    }

    // Use skill
    if (actP.uses > 0) {
      let resMsg = '';

      if (actP.class === ClassesStr.PALADINO) {
        actP.uses--;
        actP.currentLife = Math.min(actP.maxLife, actP.currentLife + 2);
        resMsg = 'Paladino used Heal! +2 HP.';
        io.to(roomId).emit('playSound', 'heal');
      } else if (actP.class === ClassesStr.MAGO && !actP.playAgain) {
        const res = engine.usarHabilidade();
        resMsg = res.msg;
        io.to(roomId).emit('playSound', 'skill');
      } else if (actP.class === ClassesStr.SAMURAI) {
        const res = engine.usarHabilidade();
        resMsg = res.msg;
        io.to(roomId).emit('playSound', 'skill');
      } else if (actP.class === ClassesStr.REAPER) {
        const res = engine.usarHabilidade();
        resMsg = res.msg;
        io.to(roomId).emit('playSound', 'skill');
      } else if (actP.class === ClassesStr.PICTOMANCER) {
        actP.uses--;
        io.to(roomId).emit('shuffleAnimation');
        setTimeout(() => {
          const res = engine.usarHabilidade();
          io.to(roomId).emit('logMsg', { msg: res.msg, type: 'log-item' });
          io.to(roomId).emit('syncState', engine.state);
          io.to(roomId).emit('playSound', 'skill');
          checkTurnEnd(roomId, engine);
        }, 2500);
        return;
      } else if (actP.class === ClassesStr.SUMMONER) {
        // Summon a monster
        actP.uses--;
        const pos = engine.summonMonster(actP);
        resMsg = `Summoner created a monster at (${pos.x},${pos.y})!`;
        io.to(roomId).emit('playSound', 'skill');
      } else if (actP.class === ClassesStr.BARDO) {
        // Bardo paralyzes nearest enemy player
        const target = engine.findNearestPlayer(actP.x, actP.y, actP.id);
        if (target) {
          const res = engine.usarHabilidade(target);
          resMsg = res.msg;
        } else {
          resMsg = 'No target found for Bardo ability.';
          actP.uses++; // refund
        }
        io.to(roomId).emit('playSound', 'skill');
      } else {
        socket.emit('logMsg', { msg: 'Skill requires target or cannot be used here.', type: 'log-move' });
        return;
      }

      if (resMsg) {
        io.to(roomId).emit('logMsg', { msg: resMsg, type: 'log-item' });
        io.to(roomId).emit('syncState', engine.state);
      }
    }
  });

  // === DICE ROLL ===
  socket.on('rollDice', ({ roomId, actionType }) => {
    const room = rooms[roomId];
    if (!room) return;
    const engine = room.engine;
    const actP = engine.getActivePlayer();

    if (actionType === 'pvp_init') {
      if (actP.socketId !== socket.id) return;
      const defP = engine.state.players.find(p => p.id === room.activePvP.defensorId);

      let isLadinoBuff = (actP.class === ClassesStr.LADINO && actP.currentLife <= actP.maxLife / 3);
      let isSamuraiCrit = (actP.class === ClassesStr.SAMURAI && actP.critBuff);
      if (isSamuraiCrit) actP.critBuff = false;

      const atk = engine.calcularAtaqueBasico(isLadinoBuff, isSamuraiCrit);
      const def = engine.calcularDefesaPvP(atk.dmg);

      let resultString = `Attack: 🎲 ${atk.roll} (Raw dmg: ${atk.dmg})\nDefense (${defP.name}): 🎲 ${def.roll} => Real dmg: ${def.dmgTaken}\n${def.msg}`;
      let soundType = atk.isCrit ? 'crit' : (atk.dmg > 0 ? 'hit' : 'miss');

      if (def.dmgTaken > 0) {
        const deathMsg = engine.aplicarDano(defP, def.dmgTaken);
        io.to(roomId).emit('logMsg', { msg: `${defP.name} took ${def.dmgTaken} damage from ${actP.name}.`, type: 'log-combat' });
        if (deathMsg) {
          io.to(roomId).emit('logMsg', { msg: deathMsg, type: 'log-combat' });
          soundType = 'death';
        }
      }
      if (def.counterDmg > 0 && actP.isAlive) {
        const deathMsg = engine.aplicarDano(actP, def.counterDmg);
        io.to(roomId).emit('logMsg', { msg: `${actP.name} took ${def.counterDmg} counter-attack damage.`, type: 'log-combat' });
        if (deathMsg) {
          io.to(roomId).emit('logMsg', { msg: deathMsg, type: 'log-combat' });
          soundType = 'death';
        }
      }

      io.to(roomId).emit('diceResult', { text: resultString, type: soundType,
        playerHp: actP.currentLife, playerMaxHp: actP.maxLife,
        enemyHp: defP.currentLife, enemyMaxHp: defP.maxLife
      });
      io.to(roomId).emit('syncState', engine.state);

      setTimeout(() => {
        io.to(roomId).emit('closeModal');
        room.activePvP = null;
        if (engine.isGameOver()) {
          io.to(roomId).emit('showGameOver');
        } else {
          checkTurnEnd(roomId, engine);
        }
      }, 4000);
    }

    if (actionType === 'pve_atk') {
      if (actP.socketId !== socket.id) return;
      const cell = engine.state.map[actP.y][actP.x];
      const m = cell.monster;
      if (!m) return;

      let isLadinoBuff = (actP.class === ClassesStr.LADINO && actP.currentLife <= actP.maxLife / 3);
      let isSamuraiCrit = (actP.class === ClassesStr.SAMURAI && actP.critBuff);
      if (isSamuraiCrit) actP.critBuff = false;

      const atkRes = engine.calcularAtaqueBasico(isLadinoBuff, isSamuraiCrit);
      m.hp -= atkRes.dmg;

      let str = `🎲 Rolled ${atkRes.roll}! Dealt ${atkRes.dmg} damage. ${atkRes.isCrit ? 'CRITICAL!' : ''}\n`;
      let soundType = atkRes.isCrit ? 'crit' : (atkRes.dmg > 0 ? 'hit' : 'miss');

      if (m.hp <= 0) {
        let lostLife = (m.initialEncounterLife || actP.currentLife) - Math.max(0, actP.currentLife);
        if (lostLife > 0 && actP.isAlive) {
          let recovered = Math.ceil(lostLife / 2);
          actP.currentLife = Math.min(actP.maxLife, actP.currentLife + recovered);
          str += `\n❤️ Recovered ${recovered} HP!`;
        }
        str += '\nMonster defeated!';
        io.to(roomId).emit('logMsg', { msg: `${actP.name} killed a monster.`, type: 'log-combat' });
        cell.type = 'path';
        cell.monster = null;

        io.to(actP.socketId).emit('diceResult', { text: str, type: soundType,
          playerHp: actP.currentLife, playerMaxHp: actP.maxLife,
          enemyHp: 0, enemyMaxHp: m.initialEncounterLife || 10
        });
        io.to(roomId).emit('syncState', engine.state);
        io.to(actP.socketId).emit('updateModalPrimary', { text: 'Continue', actionType: 'pve_done' });

        broadcastSpectator(roomId, actP.socketId, `Turn of ${actP.name}`, `${actP.name} defeated a monster!`);
      } else {
        str += `\nMonster survived (HP: ${m.hp}) and counter-attacks with ${m.dmg} damage!`;
        const msgDeath = engine.aplicarDano(actP, m.dmg);
        io.to(roomId).emit('logMsg', { msg: `${actP.name} took ${m.dmg} damage from the monster.`, type: 'log-combat' });

        if (msgDeath) {
          soundType = 'death';
          io.to(roomId).emit('logMsg', { msg: msgDeath, type: 'log-combat' });
        }

        io.to(actP.socketId).emit('diceResult', { text: str, type: soundType,
          playerHp: actP.currentLife, playerMaxHp: actP.maxLife,
          enemyHp: m.hp, enemyMaxHp: m.initialEncounterLife || 10
        });
        io.to(roomId).emit('syncState', engine.state);

        if (msgDeath && !actP.isAlive) {
          io.to(actP.socketId).emit('updateModalPrimary', { text: 'Death...', actionType: 'pve_done' });
        } else {
          // Show Bardo paralysis option in combat
          let secBtn = null;
          let secType = null;
          if (actP.class === ClassesStr.BARDO && actP.uses > 0) {
            secBtn = 'Paralyze (skip monster counter-attack)';
            secType = 'pve_bardo';
          }
          if (actP.class === ClassesStr.SUMMONER && actP.uses > 0) {
            secBtn = 'Teleport Monster to nearest player';
            secType = 'pve_summoner_tp';
          }

          if (secBtn) {
            io.to(actP.socketId).emit('showModal', {
              title: '⚔️ PvE Combat',
              desc: `Monster: ${m.hp} HP | ${m.dmg} Dmg`,
              primaryBtn: 'Attack Again',
              showSecBtn: true,
              secBtnTxt: secBtn,
              type: 'pve_atk',
              secType: secType,
              playerHp: actP.currentLife, playerMaxHp: actP.maxLife, playerName: actP.name,
              enemyHp: m.hp, enemyMaxHp: m.initialEncounterLife || 10, enemyName: 'Monster'
            });
          } else {
            io.to(actP.socketId).emit('updateModalPrimary', { text: 'Attack Again', actionType: 'pve_atk' });
          }
        }
      }
    }
  });

  // === MODAL RESOLVE ===
  socket.on('modalResolve', ({ roomId, actionType }) => {
    const room = rooms[roomId];
    if (!room) return;
    const engine = room.engine;
    const actP = engine.getActivePlayer();
    if (actP.socketId !== socket.id) return;

    if (actionType === 'pve_done' || actionType === 'pve_flee') {
      if (actionType === 'pve_flee') {
        engine.usarHabilidade();
        io.to(roomId).emit('logMsg', { msg: `${actP.name} fled from the monster.`, type: 'log-item' });
      }
      io.to(roomId).emit('closeModal');

      if (engine.isGameOver()) {
        io.to(roomId).emit('showGameOver');
      } else {
        checkTurnEnd(roomId, engine);
      }
    }

    if (actionType === 'pve_bardo') {
      // Bardo paralyzes monster — skip its counter-attack this round
      actP.uses--;
      io.to(roomId).emit('logMsg', { msg: `Bardo paralyzed the monster! No counter-attack this turn.`, type: 'log-item' });
      io.to(roomId).emit('playSound', 'skill');
      // Re-show attack button without counter-attack logic
      io.to(actP.socketId).emit('updateModalPrimary', { text: 'Attack (No counter!)', actionType: 'pve_atk_safe' });
    }

  if (actionType === 'pve_summoner_tp') {
      const cell = engine.state.map[actP.y][actP.x];
      if (cell.monster) {
        actP.uses--;
        const target = engine.teleportMonsterToPlayer(cell, actP);
        if (target) {
          io.to(roomId).emit('logMsg', { msg: `Summoner teleported the monster to ${target.name}!`, type: 'log-item' });
          io.to(roomId).emit('playSound', 'teleport');
          io.to(roomId).emit('closeModal');
          io.to(roomId).emit('syncState', engine.state);
          checkTurnEnd(roomId, engine);
        } else {
          io.to(roomId).emit('logMsg', { msg: 'No valid target found.', type: 'log-move' });
          actP.uses++; // refund
        }
      }
    }
    
    if (actionType === 'encounter_pvp') {
      io.to(roomId).emit('closeModal');
      // Force an action as if space was pressed for PvP
      handleAction(socket, roomId, true);
    }
    
    if (actionType === 'encounter_bardo') {
      io.to(roomId).emit('closeModal');
      const target = engine.findNearestPlayer(actP.x, actP.y, actP.id);
      if (target) {
        const res = engine.usarHabilidade(target);
        io.to(roomId).emit('logMsg', { msg: res.msg, type: 'log-item' });
        io.to(roomId).emit('playSound', 'skill');
        io.to(roomId).emit('syncState', engine.state);
      }
      checkTurnEnd(roomId, engine);
    }
    
    if (actionType === 'encounter_ignore') {
      io.to(roomId).emit('closeModal');
      checkTurnEnd(roomId, engine);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
  });
});

// === HELPER: broadcast spectator info to non-active players ===
function broadcastSpectator(roomId, activeSocketId, title, detail) {
  const room = rooms[roomId];
  if (!room) return;
  for (const p of room.engine.state.players) {
    if (p.socketId !== activeSocketId && p.isAlive) {
      io.to(p.socketId).emit('showSpectatorBanner', { title, detail });
    }
  }
}

// === RESOLVE CELL EVENTS ===
function resolveCellEvent(roomId, engine) {
  io.to(roomId).emit('syncState', engine.state);
  const actP = engine.getActivePlayer();
  const cell = engine.state.map[actP.y][actP.x];

  if (engine.verificarVitoria()) {
    const winner = engine.state.winner;
    const data = {
      winnerName: winner.name,
      winnerClass: winner.class,
      winnerSocketId: winner.socketId,
      teamWin: false
    };
    if (engine.state.gameMode === 'duo' && winner.team) {
      data.teamWin = true;
      data.winnerTeam = winner.team;
      data.teamSockets = engine.state.players.filter(p => p.team === winner.team).map(p => p.socketId);
    }
    io.to(roomId).emit('showVictory', data);
    return;
  }

  if (engine.isGameOver()) {
    io.to(roomId).emit('showGameOver');
    return;
  }

  if (cell.type === 'key') {
    engine.coletarItem();
    io.to(roomId).emit('logMsg', { msg: `${actP.name} found the key! Run to the door!`, type: 'log-item' });
    io.to(roomId).emit('playSound', 'key');
    io.to(roomId).emit('syncState', engine.state);
  }

  if (cell.type === 'teleport') {
    let t = engine.getRandomEmptyPos(actP.x, actP.y);
    actP.x = t.x; actP.y = t.y;
    engine.revelarCelula(t.x, t.y);
    io.to(roomId).emit('logMsg', { msg: `${actP.name} stepped on a teleporter!`, type: 'log-item' });
    io.to(roomId).emit('playSound', 'teleport');
    io.to(roomId).emit('syncState', engine.state);
  }

  if (cell.type === 'monster' && cell.monster) {
    if (cell.monster.initialEncounterLife === undefined) {
      cell.monster.initialEncounterLife = actP.currentLife;
    }

    let canFlee = (actP.class === ClassesStr.LADINO && actP.uses > 0);
    let secBtn = canFlee ? 'Flee (Ladino)' : null;
    let secType = canFlee ? 'pve_flee' : null;

    // Summoner can also teleport monster
    if (!secBtn && actP.class === ClassesStr.SUMMONER && actP.uses > 0) {
      secBtn = 'Teleport Monster';
      secType = 'pve_summoner_tp';
    }

    // Only send combat modal to the active player
    io.to(actP.socketId).emit('showModal', {
      title: '⚔️ PvE Combat',
      desc: `Monster: ${cell.monster.hp} HP | ${cell.monster.dmg} Dmg`,
      primaryBtn: 'Attack',
      showSecBtn: !!secBtn,
      secBtnTxt: secBtn,
      type: 'pve_atk',
      secType: secType,
      playerHp: actP.currentLife, playerMaxHp: actP.maxLife, playerName: actP.name,
      enemyHp: cell.monster.hp, enemyMaxHp: cell.monster.hp, enemyName: 'Monster'
    });

    // Spectator banner for others
    broadcastSpectator(roomId, actP.socketId, `Turn of ${actP.name}`, `${actP.name} found a monster!`);
    return;
  }

  // Encounter check (PvP or Bardo)
  const enemiesHere = engine.state.players.filter(e =>
    e.isAlive && e.id !== actP.id && e.x === actP.x && e.y === actP.y &&
    !engine.areTeammates(actP, e) && e.invisibleTurns <= 0
  );

  if (enemiesHere.length > 0) {
    const def = enemiesHere[0];
    let isBardo = (actP.class === ClassesStr.BARDO && actP.uses > 0);
    
    io.to(actP.socketId).emit('showModal', {
      title: 'Encontro!',
      desc: `Você encontrou ${def.name}!`,
      primaryBtn: isBardo ? 'Paralisar (Bardo)' : 'Atacar (PvP)',
      showSecBtn: true,
      secBtnTxt: 'Ignorar',
      type: isBardo ? 'encounter_bardo' : 'encounter_pvp',
      secType: 'encounter_ignore'
    });
    return;
  }

  checkTurnEnd(roomId, engine);
}

function handleAction(socket, roomId, forcePvP = false) {
  const room = rooms[roomId];
  if (!room || !room.started) return;
  const engine = room.engine;
  const actP = engine.getActivePlayer();

  // Check PvP
  const enemiesHere = engine.state.players.filter(e =>
    e.isAlive && e.id !== actP.id && e.x === actP.x && e.y === actP.y &&
    !engine.areTeammates(actP, e)
  );

  if (enemiesHere.length > 0) {
    if (actP.turnsPlayed < 2) {
      io.to(actP.socketId).emit('logMsg', { msg: `PvP locked for ${actP.name}. (Turn ${actP.turnsPlayed + 1}/3)`, type: 'log-combat' });
      return;
    }
    const def = enemiesHere.find(e => e.invisibleTurns <= 0);
    if (!def) {
      io.to(actP.socketId).emit('logMsg', { msg: 'Target is invisible! Cannot attack.', type: 'log-combat' });
      return;
    }

    io.to(actP.socketId).emit('showModal', {
      title: '⚔️ PvP Combat!',
      desc: `${actP.name} vs ${def.name}!`,
      primaryBtn: 'Roll Dice!',
      showSecBtn: false,
      type: 'pvp_init',
      playerHp: actP.currentLife, playerMaxHp: actP.maxLife, playerName: actP.name,
      enemyHp: def.currentLife, enemyMaxHp: def.maxLife, enemyName: def.name
    });

    broadcastSpectator(roomId, actP.socketId, `Turn of ${actP.name}`, `${actP.name} is fighting ${def.name}!`);
    room.activePvP = { atacanteId: actP.id, defensorId: def.id };
  }
}

function checkTurnEnd(roomId, engine) {
  const res = engine.encerrarTurno();
  io.to(roomId).emit('syncState', engine.state);
  io.to(roomId).emit('hideSpectatorBanner');

  // Auto-save Singleplayer
  if (engine.state.gameMode === 'singleplayer' && engine.state.players.length > 0) {
    const pName = engine.state.players[0].name;
    loadDb().then(db => {
      db.singleplayerSaves[pName] = engine.state;
      saveDb(db).catch(e => console.error('Save failed:', e));
    });
  }

  if (res.changeTurn) {
    io.to(roomId).emit('logMsg', { msg: '-------------------', type: 'log-turn' });
    const nextP = engine.getActivePlayer();
    io.to(roomId).emit('logMsg', { msg: `Turn: ${nextP.name}`, type: 'log-turn' });
    io.to(roomId).emit('turnBanner', nextP.name);
    
    // Auto-combat for Summoner TP
    const cell = engine.state.map[nextP.y][nextP.x];
    if (cell.type === 'monster' && cell.monster) {
      resolveCellEvent(roomId, engine);
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
