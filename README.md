# 🕳️ Hollow Depths

> *A dungeon board game of probability and fate. Explore, fight, survive.*

A turn-based multiplayer dungeon crawler built with **Node.js + Socket.IO** on the backend and **Vanilla JavaScript** on the frontend.

---

## 🚀 How to Run

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- npm

### Install & Start

```bash
cd jogo
npm install
npm run dev
```

Then open your browser at **http://localhost:3000**.

> For production build: `npm run build` then `node server.js`

---

## 🎮 Game Modes

| Mode | Description |
|------|-------------|
| **Singleplayer** | Solo run with boosted HP (×1.5). Auto-saves after each turn. |
| **Multiplayer – Individual** | Up to 8 players. Everyone for themselves. |
| **Multiplayer – Duo** | Teams of 2. Win together by getting your teammate through the door. |

---

## 🗺️ Objective

1. Find the **🔑 Key** hidden somewhere on the 10×10 board.
2. Reach the **🚪 Door** with the key to escape and win!

---

## ⚔️ Combat

### Attack (D6)
| Roll | Result |
|------|--------|
| 1–2 | 2 damage |
| 3 | 3 damage |
| 4–5 | 0 damage (miss) |
| 6 | **Critical! 4 damage** |

### PvP Defense (D6 — after 3rd turn played)
| Roll | Result |
|------|--------|
| 1 | +1 extra damage received |
| 2–3 | Normal damage |
| 4–5 | −1 damage reduced |
| 6 | **Counter-attack** (reflect full damage) |

> PvP is locked for your first 3 turns to allow exploration.

### PvE (Monsters)
- Monsters counter-attack after surviving your hit.
- Defeating a monster recovers **50% of HP lost** during that fight.

---

## 🧙 Classes

| Class | Skill | Uses |
|-------|-------|------|
| ⚡ **Ladino** | Double damage at ≤33% HP. Flee PvE without fighting. | 3 |
| 🎵 **Bardo** | Paralyze enemy for **2 turns** (PvP) or skip monster counter-attack (PvE). | 2 |
| 🛡️ **Paladino** | Heal +2 HP. Passive: revive once at 50% HP when killed. | 3 |
| ✨ **Mago** | Extra turn (Celeridade) or teleport to random cell (Portal). | 2 |
| 👹 **Summoner** | Summon 10HP/2DMG monsters. Teleport monsters to nearest player. | 3 |
| ⚔️ **Samurai** | Next attack is a guaranteed critical hit. | 3 |
| 💀 **Reaper** | Passive: +1 HP/turn. Active: Invisible for 3 turns (untargetable in PvP). | 2 |
| 🎨 **Pictomancer** | Shuffle all unrevealed cells (monsters, key, door, teleporters). | 1 |

---

## 🎮 Controls

| Key | Action |
|-----|--------|
| ← ↑ → ↓ Arrow Keys | Move your character |
| `Space` | Use skill / Confirm action |

---

## 🗂️ Project Structure

```
game/
├── README.md
└── jogo/
    ├── server.js          # Node.js + Socket.IO backend
    ├── index.html         # Main HTML shell
    ├── package.json
    └── src/
        ├── GameEngine.js  # Core game logic (pure, no I/O)
        ├── UIController.js# DOM rendering helpers
        ├── main.js        # Frontend socket client + UI flow
        ├── SoundManager.js# Audio management
        ├── i18n.js        # PT/EN internationalization
        └── style.css      # Dark fantasy visual theme
```

---

## 🏗️ Architecture

- **GameEngine.js** is a pure class with no network or DOM dependencies — all state lives here.
- **server.js** hosts the Socket.IO room system, drives game events and emits state syncs.
- **main.js** listens to socket events, delegates rendering to UIController, and emits player actions.
- Game state is serialized to `database.json` for singleplayer auto-save/load.

---

## 📄 License

MIT — free to use and modify.
