# Q-MANIA - Quiz Dashboard v2

A live-event quiz dashboard with real-time scoring, host controls, and an Electric Noir UI.

## Tech Stack

| Layer     | Tech                             |
|-----------|----------------------------------|
| Frontend  | React 18 + Tailwind CSS 3 + Vite |
| Backend   | Node.js + Express 4             |
| Realtime  | Socket.IO 4                     |
| Data      | JSON question bank              |

## Quick Start

### 1 - Server

```bash
cd server
npm install
npm run dev
```

Runs on `http://localhost:4000`.

### 2 - Client

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.

## Question Bank

Edit `server/data/questions.json`. Structure:

```json
{
  "sectionName": [
    {
      "question": "Your question here?",
      "answer": "The full answer",
      "marks": 10,
      "hint": "Optional hint shown to host"
    }
  ]
}
```

## Scoring System

| Attempt | Correct     | Wrong         |
|---------|-------------|---------------|
| 1st     | +full marks | -1/4 marks    |
| 2nd     | +1/2 marks  | 0 (no penalty)|

Manual adjustments are also available at any time.
