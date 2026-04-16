import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { GameEngine, ClassesStr } from './src/GameEngine.js'; // Using the original GameEngine

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(express.static(join(__dirname, 'dist')));

// Estutura das salas (Rooms)
// rooms[roomId] = {
//   engine: new GameEngine(),
//   playersCount: 0,
//   lobby: [], // { socketId, name: string }
//   started: false,
//   activePvP: null // will hold pvp state if a battle is ongoing
// }
const rooms = {};

const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
};

io.on('connection', (socket) => {
  console.log(`[+] Nova conexão: ${socket.id}`);

  socket.on('createRoom', ({ playerName }) => {
    let roomId = generateRoomCode();
    while (rooms[roomId]) roomId = generateRoomCode();

    rooms[roomId] = {
      engine: new GameEngine(),
      lobby: [{ socketId: socket.id, name: playerName || "Host" }],
      started: false
    };

    socket.join(roomId);
    socket.emit('roomCreated', roomId);
    io.to(roomId).emit('lobbyUpdate', rooms[roomId].lobby);
    console.log(`Sala ${roomId} criada por ${playerName}`);
  });

  socket.on('joinRoom', ({ playerName, roomId }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('errorMsg', 'Sala não existe.');
      return;
    }
    if (room.started) {
      socket.emit('errorMsg', 'Partida já começou nessa sala.');
      return;
    }
    if (room.lobby.length >= 4) {
      socket.emit('errorMsg', 'Sala cheia.');
      return;
    }

    room.lobby.push({ socketId: socket.id, name: playerName || `Player ${room.lobby.length + 1}` });
    socket.join(roomId);
    socket.emit('joinedRoom', roomId);
    io.to(roomId).emit('lobbyUpdate', room.lobby);
    console.log(`${playerName} entrou na sala ${roomId}`);
  });

  socket.on('startGame', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    
    // Sorteio de Classes
    const allClasses = [ClassesStr.LADINO, ClassesStr.BARDO, ClassesStr.PALADINO, ClassesStr.MAGO];
    // Shuffle array
    for (let i = allClasses.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allClasses[i], allClasses[j]] = [allClasses[j], allClasses[i]];
    }

    const playerConfigs = room.lobby.map((p, idx) => ({
      name: p.name,
      class: allClasses[idx]
    }));

    room.engine.initGame(playerConfigs);
    
    // Add socketIds to state players so we can identify them
    room.engine.state.players.forEach((p, idx) => {
      p.socketId = room.lobby[idx].socketId;
    });

    room.started = true;
    
    // Initialize game for everyone
    io.to(roomId).emit('gameStarted', room.engine.state);
    
    // Inicia o Banner do Turno para o Primeiro Jogador!
    const atvP = room.engine.getActivePlayer();
    io.to(roomId).emit('turnBanner', atvP.name);
  });

  socket.on('move', ({ roomId, dir }) => {
    const room = rooms[roomId];
    if (!room || !room.started) return;
    const engine = room.engine;
    
    const p = engine.getActivePlayer();
    // Validate if the socket asking to move is the active player
    if (p.socketId !== socket.id) return;

    if (engine.moverJogador(dir)) {
      io.to(roomId).emit('logMsg', { msg: `${p.name} moveu-se.`, type: 'log-move' });
      resolveCellEvent(roomId, engine);
    }
  });

  socket.on('action', ({ roomId }) => {
     const room = rooms[roomId];
     if (!room || !room.started) return;
     const engine = room.engine;
     const actP = engine.getActivePlayer();
     
     if (actP.socketId !== socket.id) return;

     const enemiesHere = engine.state.players.filter(e => e.isAlive && e.id !== actP.id && e.x === actP.x && e.y === actP.y);
     if (enemiesHere.length > 0) {
        if(actP.turnsPlayed < 2) {
           socket.emit('logMsg', { msg: `PvP restrito para ${actP.name}. (Turno ${actP.turnsPlayed + 1}/3)`, type: 'log-combat' });
           return;
        }
        
        // Start PvP
        const def = enemiesHere[0];
        // Send everyone an alert!
        io.to(roomId).emit('showModal', {
           title: '⚔️ Combate PvP!',
           desc: `${actP.name} estocará ${def.name}! Luta ao vivo!`,
           primaryBtn: 'Rolar Dados!',
           showSecBtn: false,
           type: 'pvp_init'
        });
        
        room.activePvP = { atacanteId: actP.id, defensorId: def.id, resolvedAtk: null, resolvedDef: null };
        return;
     }

     // Use skill
     if(actP.uses > 0) {
        let resMsg = "";
        if(actP.class === ClassesStr.PALADINO) {
           actP.uses--;
           actP.currentLife = Math.min(actP.maxLife, actP.currentLife + 2);
           resMsg = "Paladino usou Cura! +2 Vida.";
        } else if(actP.class === ClassesStr.MAGO && !actP.playAgain) {
           const res = engine.usarHabilidade();
           resMsg = res.msg;
        } else {
           socket.emit('logMsg', { msg: `Habilidade requer alvo ou não pode ser usada aqui.`, type: 'log-move' });
           return;
        }
        
        if (resMsg) {
           io.to(roomId).emit('logMsg', { msg: resMsg, type: 'log-item' });
           io.to(roomId).emit('syncState', engine.state);
        }
     }
  });

  // Client sent "Rolar Dados" for PvP or PvE
  socket.on('rollDice', ({ roomId, actionType }) => {
     const room = rooms[roomId];
     if(!room) return;
     const engine = room.engine;
     const actP = engine.getActivePlayer();

     if (actionType === 'pvp_init') {
        if (actP.socketId !== socket.id) return; // Only active player rolls
        const defP = engine.state.players.find(p => p.id === room.activePvP.defensorId);
        
        // Roll attack and defense
        let isLadinoBuff = (actP.class === ClassesStr.LADINO && actP.currentLife <= actP.maxLife/3);
        const atk = engine.calcularAtaqueBasico(isLadinoBuff);
        let atkStr = `Ataque: 🎲 ${atk.roll} (Dano bruto: ${atk.dmg})\n`;
        
        const def = engine.calcularDefesaPvP(atk.dmg);
        let defStr = `Defesa (${defP.name}): 🎲 ${def.roll} => Dano Real: ${def.dmgTaken}`;
        
        const resultString = atkStr + defStr + '\n' + def.msg;

        if(def.dmgTaken > 0) {
            engine.aplicarDano(defP, def.dmgTaken);
            io.to(roomId).emit('logMsg', { msg: `${defP.name} recebeu ${def.dmgTaken} dano de ${actP.name}.`, type: 'log-combat' });
        }
        if(def.counterDmg > 0 && actP.isAlive) {
            engine.aplicarDano(actP, def.counterDmg);
            io.to(roomId).emit('logMsg', { msg: `${actP.name} recebeu ${def.counterDmg} do contra-ataque.`, type: 'log-combat' });
        }

        io.to(roomId).emit('diceResult', resultString);
        io.to(roomId).emit('syncState', engine.state);
        
        // Em 4 segundos fecha ou manda os clientes fecharem
        setTimeout(() => {
           io.to(roomId).emit('closeModal');
           room.activePvP = null;
        }, 5000);
     }
     
     if (actionType === 'pve_atk') {
        if (actP.socketId !== socket.id) return;
        const cell = engine.state.map[actP.y][actP.x];
        const m = cell.monster;
        if (!m) return; // double check

        let hp = m.hp;
        let dmgBase = m.dmg;
        let initialPlayerLife = actP.currentLife;

        let isLadinoBuff = false;
        if(actP.class === ClassesStr.LADINO && actP.currentLife <= actP.maxLife/3) isLadinoBuff = true;

        const atkRes = engine.calcularAtaqueBasico(isLadinoBuff);
        hp -= atkRes.dmg;
        m.hp = hp;

        let str = `🎲 Tirou ${atkRes.roll}! Causa ${atkRes.dmg} dano. ${atkRes.isCrit?'Crítico!':''}\n`;

        if (hp <= 0) {
          let lostLife = (m.initialEncounterLife || initialPlayerLife) - Math.max(0, actP.currentLife);
          if (lostLife > 0 && actP.isAlive) {
             let recovered = Math.ceil(lostLife / 2);
             actP.currentLife = Math.min(actP.maxLife, actP.currentLife + recovered);
             str += `\n❤️ Você recuperou ${recovered} HP!`;
          }
          str += '\nMonstro derrotado!';
          
          io.to(roomId).emit('logMsg', { msg: `${actP.name} matou um monstro.`, type: 'log-combat' });
          cell.type = 'path'; 
          cell.monster = null;

          io.to(roomId).emit('diceResult', str);
          io.to(roomId).emit('syncState', engine.state);

          io.to(roomId).emit('updateModalPrimary', { text: "Continuar", actionType: "pve_done" });
        } else {
           str += `\nMonstro sobreviveu (HP: ${hp}) e contra-ataca com ${dmgBase} dano!`;
           
           const msgDeath = engine.aplicarDano(actP, dmgBase);
           io.to(roomId).emit('logMsg', { msg: `${actP.name} recebeu ${dmgBase} dano do monstro.`, type: 'log-combat' });
           
           io.to(roomId).emit('diceResult', str);
           io.to(roomId).emit('syncState', engine.state);

           if(msgDeath) {
              io.to(roomId).emit('logMsg', { msg: msgDeath, type: 'log-combat' });
              io.to(roomId).emit('updateModalPrimary', { text: "Morrer", actionType: "pve_done" });
           } else {
              io.to(roomId).emit('updateModalPrimary', { text: "Atacar Novamente", actionType: "pve_atk" });
           }
        }
     }
  });

  socket.on('modalResolve', ({ roomId, actionType }) => {
     const room = rooms[roomId];
     if(!room) return;
     const engine = room.engine;
     const actP = engine.getActivePlayer();
     if(actP.socketId !== socket.id) return;

     if(actionType === 'pve_done' || actionType === 'pve_flee') {
        if(actionType === 'pve_flee') {
            engine.usarHabilidade(); // Uses Ladino Flee skill
            io.to(roomId).emit('logMsg', { msg:`${actP.name} fugiu do monstro.`, type: 'log-item'});
        }
        io.to(roomId).emit('closeModal');
        
        if(engine.isGameOver()) {
            resolveCellEvent(roomId, engine);
        } else {
            checkTurnEnd(roomId, engine);
        }
     }
  });

  socket.on('disconnect', () => {
    // If we want reconnections, it's more complex. We'll simply ignore or kill player.
    console.log(`[-] Desconectado: ${socket.id}`);
  });
});

function resolveCellEvent(roomId, engine) {
    io.to(roomId).emit('syncState', engine.state);
    const actP = engine.getActivePlayer();
    const cell = engine.state.map[actP.y][actP.x];
  
    // 1. Victory
    if (engine.verificarVitoria()) {
      io.to(roomId).emit('showVictory', { 
          winnerName: engine.state.winner.name, 
          winnerClass: engine.state.winner.class,
          winnerSocketId: engine.state.winner.socketId
      });
      return;
    }
  
    // 2. GameOver
    if (engine.isGameOver()) {
      io.to(roomId).emit('showGameOver');
      return;
    }
  
    // 3. Key
    if (cell.type === 'key') {
      engine.coletarItem();
      io.to(roomId).emit('logMsg', { msg: `${actP.name} encontrou a chave! Corra para a porta!`, type: 'log-item' });
      io.to(roomId).emit('syncState', engine.state);
    }
  
    // 4. Teleport
    if (cell.type === 'teleport') {
      let t = engine.getRandomEmptyPos(actP.x, actP.y);
      actP.x = t.x; actP.y = t.y;
      engine.revelarCelula(t.x, t.y);
      io.to(roomId).emit('logMsg', { msg: `${actP.name} pisou num teleporte!`, type: 'log-item' });
      io.to(roomId).emit('syncState', engine.state);
    }
  
    // 5. Combat
    if (cell.type === 'monster' && cell.monster) {
        
        if (cell.monster.initialEncounterLife === undefined) {
             cell.monster.initialEncounterLife = actP.currentLife;
        }

        let canFlee = (actP.class === ClassesStr.LADINO && actP.uses > 0);

        io.to(roomId).emit('showModal', {
            title: '⚔️ Combate PvE',
            desc: `Monstro: ${cell.monster.hp} HP | ${cell.monster.dmg} Dano`,
            primaryBtn: 'Atacar',
            showSecBtn: canFlee,
            secBtnTxt: 'Fugir (Ladino)',
            type: 'pve_atk',
            secType: 'pve_flee'
         });
      return; // Turn waits for combat to resolve
    }
  
    checkTurnEnd(roomId, engine);
}

function checkTurnEnd(roomId, engine) {
    const res = engine.encerrarTurno();
    io.to(roomId).emit('syncState', engine.state);
    
    if (res.changeTurn) {
        io.to(roomId).emit('logMsg', { msg: "-------------------", type: 'log-turn' });
        const nextP = engine.getActivePlayer();
        io.to(roomId).emit('logMsg', { msg: `Vez do jogador: ${nextP.name}`, type: 'log-turn' });
        io.to(roomId).emit('turnBanner', nextP.name);
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
