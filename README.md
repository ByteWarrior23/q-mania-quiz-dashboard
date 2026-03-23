# Q-Mania Club Quiz Dashboard

Live-event quiz dashboard built for manual host control.

## Tech

- Frontend: React + Tailwind
- Backend: Node.js + Express
- Realtime: Socket.IO
- Data: JSON question bank

## Run

### 1) Backend

```bash
cd server
npm install
npm run dev
```

Runs on `http://localhost:4000`.

### 2) Frontend

```bash
cd client
npm install
npm run dev
```

Open the Vite URL (typically `http://localhost:5173`).

## Sample Dataset

Question bank is in:

- `server/data/questions.json`

Sections included:

- `physics`
- `sciFi`
- `puzzles`

## Host Workflow

1. Setup teams on first screen.
2. Select section from left panel.
3. Click `Next Random Question`.
4. Choose active team and click `Start Attempt 1` or `Start Attempt 2`.
5. Score using `Correct`/`Wrong` (dynamic marks) or manual mark buttons.
6. Use `Undo Last Action` whenever needed.
7. End/Skip/Reset question with control buttons.
8. Watch live leaderboard on right panel.

## Reliability Features

- No repeated questions in a section
- Manual controls for every key action
- Undo stack for recent actions
- Prevents double scoring same question+attempt pair
- Final warning list for non-attempt teams in Physics/Sci-Fi (no auto penalty)
