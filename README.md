# Hollow Depths

Jogo de tabuleiro multiplayer online baseado em turnos, com temática de masmorra. Jogadores exploram uma caverna escura, coletam uma chave e tentam escapar pela porta — enquanto enfrentam monstros e uns aos outros.

---

## Sobre o Jogo

- **Modo:** Multiplayer Online (2 a 4 jogadores)
- **Tecnologias:** Node.js, Express, Socket.IO, Vite, JavaScript
- **Classes disponíveis (sorteadas automaticamente):** Ladino, Bardo, Paladino, Mago

---

## Classes e Habilidades

| Classe | Habilidade | Usos |
|---|---|---|
| **Ladino** | Dano dobrado com ≤33% de HP. Pode fugir de monstros. | 3 |
| **Bardo** | Paralisa um inimigo por 1 turno. | 2 |
| **Paladino** | Cura +2 de vida. Revive 1 vez com metade da vida ao morrer (passiva). | 3 |
| **Mago** | Joga mais um turno (Celeridade) ou se teleporta (Portal). | 2 |

---

## Objetivo

1. Explore o mapa revelando células escuras com seu movimento.
2. Encontre a **chave**.
3. Leve a chave até a **porta** para vencer!

---

## Controles

| Tecla | Ação |
|---|---|
| `↑ ↓ ← →` | Mover o personagem |
| `[ ESPAÇO ]` | Usar habilidade da classe / Iniciar combate PvP |

---

## Como Rodar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) instalado (versão 18+)

### 1. Instalar dependências
```bash
cd jogo
npm install
```

### 2. Iniciar o Servidor de Jogo (Backend)
```bash
npm run server
```
O servidor rodará em `http://localhost:3000`.

### 3. Iniciar o Frontend (Interface)
Em outro terminal, ainda na pasta `jogo`:
```bash
npm run dev
```
A interface abrirá em `http://localhost:5173`.

### 4. Jogar na mesma rede (Wi-Fi / LAN)
Para que amigos na mesma rede se conectem:
1. Descubra seu IP local: abra o CMD e digite `ipconfig`.
2. Procure o **Endereço IPv4** (ex: `192.168.0.15`).
3. Passe o endereço `http://192.168.0.15:5173` para os amigos.

---

## Deploy na Internet (Grátis)

O projeto já está configurado para ser hospedado gratuitamente no [Render.com](https://render.com):

1. Faça upload do repositório no [GitHub](https://github.com).
2. Crie uma conta no Render e clique em **New Web Service**.
3. Conecte ao seu repositório GitHub.
4. Configure:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
5. O Render vai gerar um link público para compartilhar com qualquer pessoa!

---

## Estrutura do Projeto

```
jogo/
├── server.js          # Servidor Node.js + Socket.IO (lógica autoritativa)
├── index.html         # Interface HTML principal
├── package.json       # Dependências e scripts
├── src/
│   ├── main.js        # Lógica do cliente (Socket.IO client)
│   ├── GameEngine.js  # Motor do jogo (regras, turnos, combate)
│   ├── UIController.js# Renderização do tabuleiro e status
│   └── style.css      # Estilos do jogo
└── public/            # Assets estáticos
```

---

## Regras de Combate

### PvE (Jogador vs Monstro)
- Ao entrar numa célula com monstro, um combate começa.
- **Ataque (D6):** 1-2 = 2 dano | 3 = 3 dano | 4-5 = 0 dano | 6 = Crítico (4 dano)
- Ao vencer, recupera **50% da vida perdida** naquela batalha.

### PvP (Jogador vs Jogador)
- Disponível a partir do **3º turno** do attackante.
- Use `[ ESPAÇO ]` no mesmo quadrado de outro jogador.
- **Defesa (D6):** 1 = +1 dano extra | 2-3 = dano normal | 4-5 = -1 dano | 6 = Contra-ataque!
