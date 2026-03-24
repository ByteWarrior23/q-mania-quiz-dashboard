# Q-MANIA Club — Live Quiz Dashboard v2.1

A live-event quiz dashboard with real-time scoring, full manual host control, and an Electric Noir UI.

---

## Tech Stack

| Layer    | Tech                              |
|----------|-----------------------------------|
| Frontend | React 18 + Tailwind CSS 3 + Vite  |
| Backend  | Node.js + Express 4               |
| Realtime | Socket.IO 4                       |
| Data     | JSON question bank                |

---

## Scoring System

| Section  | Correct | Wrong |
|----------|---------|-------|
| Physics  | +40     | −10   |
| Sci-Fi   | +40     | −10   |
| Puzzles  | +60     | −20   |

Both Attempt 1 and Attempt 2 use the same marks.

---

## Question Count (auto-calculated per team count)

| Section          | Formula         | Example (4 teams) |
|------------------|-----------------|-------------------|
| Physics          | ceil(1.7 × X)   | 7 questions        |
| Sci-Fi           | ceil(1.7 × X)   | 7 questions        |
| Puzzles          | ceil(0.6 × X)   | 3 questions        |

The UI shows `asked/max` for each section.

---

## Quick Start

### 1 — Server

```bash
cd server
npm install
npm run dev        # uses nodemon for hot-reload
# or: npm start   # production
```

Server runs on `http://localhost:4000`

### 2 — Client

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`

---

## Project Structure

```
q-mania/
├── server/
│   ├── index.js          ← Express + Socket.IO server
│   ├── gameState.js      ← All game logic
│   ├── package.json
│   └── data/
│       └── questions.json
└── client/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.jsx
        ├── index.css
        └── App.jsx       ← Full UI (setup → game → end)
```

---

## Quiz Flow (Host Guide)

```
1. SETUP SCREEN
   → Enter team names → LAUNCH GAME

2. GAME SCREEN
   LEFT PANEL  → Click section (Physics / Sci-Fi / Puzzles)
               → Click NEXT QUESTION to draw random question

   CENTER TOP  → Question appears in large font
               → Click REVEAL ANSWER when ready

   CENTER BOT  → Select team row → click ATT 1 or ATT 2
               → Scoring mode activates: click CORRECT or WRONG
               → Repeat for ATT 2 with another team
               → Click END QUESTION (or SKIP) to close

   RIGHT PANEL → Live leaderboard updates automatically

3. MANUAL OVERRIDES (always available)
   → UNDO LAST ACTION  — reverts last score change
   → Manual Adjustment — select team, enter ±pts, APPLY
   → RESET QUESTION    — puts question back in the pool
   → SKIP QUESTION     — closes without scoring

4. END GAME
   → Click 🏁 END GAME in header
   → Final leaderboard shown
   → Section warnings: teams that never answered Physics/Sci-Fi
     (warning only — NO automatic penalty)
   → Click ↺ PLAY AGAIN to restart
```

---

## Question Bank

Edit `server/data/questions.json`. Structure:

```json
{
  "physics": [
    {
      "question": "Your question here?",
      "answer": "The full correct answer",
      "marks": 40,
      "hint": "Optional hint shown to host only"
    }
  ],
  "sciFi": [...],
  "puzzles": [...]
}
```

> **Note:** The `marks` field in JSON is overridden by the section scoring config in `gameState.js`. You can leave marks at their section default (40 / 40 / 60).

---

## Socket Events Reference

| Client → Server      | Payload                          | Action                        |
|----------------------|----------------------------------|-------------------------------|
| `setup:teams`        | `{ teams: string[] }`            | Create teams & start game     |
| `section:select`     | `{ section: string }`            | Switch active section         |
| `question:next`      | —                                | Draw next random question     |
| `question:end`       | —                                | Close current question        |
| `question:skip`      | —                                | Skip question (no scoring)    |
| `question:reset`     | —                                | Reset & return to pool        |
| `attempt:start`      | `{ teamId, attempt }`            | Begin scoring for a team      |
| `score:mark`         | `{ result: 'correct'/'wrong' }`  | Record result & apply marks   |
| `score:manual`       | `{ teamId, points }`             | Manual score adjustment       |
| `action:undo`        | —                                | Undo last score action        |
| `game:end`           | —                                | Transition to end game screen |
| `game:reset`         | —                                | Full game reset               |

---

## Environment Variables

| Variable        | Default                   | Description           |
|-----------------|---------------------------|-----------------------|
| `PORT`          | `4000`                    | Server port           |
| `CLIENT_ORIGIN` | `http://localhost:5173`   | CORS allowed origin   |

---

## Edge Cases Handled

- **No duplicate questions** — each question index tracked per section
- **Question count limit** — hard cap per section based on team count
- **Double-scoring prevention** — each team can only score once per attempt per question
- **Undo stack** — up to 20 levels of undo
- **Section switch guard** — cannot switch section during active scoring
- **Full host override** — manual adjustment works at any time, no restrictions
- **End-game warnings** — teams that never answered Physics/Sci-Fi flagged (no auto-penalty)