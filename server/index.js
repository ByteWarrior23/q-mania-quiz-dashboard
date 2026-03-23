const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const questionsPath = path.join(__dirname, "data", "questions.json");
const bank = JSON.parse(fs.readFileSync(questionsPath, "utf8"));

const sections = {
  physics: { label: "Physics", correct: 40, wrong: -10 },
  sciFi: { label: "Sci-Fi", correct: 40, wrong: -10 },
  puzzles: { label: "Puzzles", correct: 60, wrong: -20 },
};

const state = {
  initialized: false,
  teams: [],
  activeTeamId: null,
  activeSection: "physics",
  currentQuestion: null,
  usedQuestionIds: new Set(),
  attemptsStarted: [],
  scoredAttemptKeys: new Set(),
  sectionAttemptsByTeam: {}, // only for section 1/2 final warning
  actionHistory: [],
};

function clonePublicState() {
  const leaderboard = [...state.teams].sort((a, b) => b.score - a.score);
  const remainingBySection = Object.keys(sections).reduce((acc, key) => {
    const total = bank[key].length;
    const used = bank[key].filter((q) => state.usedQuestionIds.has(q.id)).length;
    acc[key] = Math.max(0, total - used);
    return acc;
  }, {});
  return {
    initialized: state.initialized,
    sections,
    activeSection: state.activeSection,
    activeTeamId: state.activeTeamId,
    teams: state.teams,
    leaderboard,
    currentQuestion: state.currentQuestion,
    attemptsStarted: state.attemptsStarted,
    remainingBySection,
    sectionWarnings: buildSectionWarnings(),
  };
}

function pushUndo(snapshot) {
  state.actionHistory.push(JSON.stringify(snapshot));
  if (state.actionHistory.length > 100) state.actionHistory.shift();
}

function snapshotForUndo() {
  return {
    teams: JSON.parse(JSON.stringify(state.teams)),
    activeTeamId: state.activeTeamId,
    activeSection: state.activeSection,
    currentQuestion: state.currentQuestion ? { ...state.currentQuestion } : null,
    usedQuestionIds: [...state.usedQuestionIds],
    attemptsStarted: [...state.attemptsStarted],
    scoredAttemptKeys: [...state.scoredAttemptKeys],
    sectionAttemptsByTeam: JSON.parse(JSON.stringify(state.sectionAttemptsByTeam)),
  };
}

function restoreFromSnapshot(raw) {
  state.teams = raw.teams;
  state.activeTeamId = raw.activeTeamId;
  state.activeSection = raw.activeSection;
  state.currentQuestion = raw.currentQuestion;
  state.usedQuestionIds = new Set(raw.usedQuestionIds);
  state.attemptsStarted = raw.attemptsStarted;
  state.scoredAttemptKeys = new Set(raw.scoredAttemptKeys);
  state.sectionAttemptsByTeam = raw.sectionAttemptsByTeam;
}

function emitState() {
  io.emit("state:update", clonePublicState());
}

function pickRandomQuestion(sectionKey) {
  const available = bank[sectionKey].filter((q) => !state.usedQuestionIds.has(q.id));
  if (!available.length) return null;
  const q = available[Math.floor(Math.random() * available.length)];
  state.usedQuestionIds.add(q.id);
  return {
    id: q.id,
    section: sectionKey,
    sectionLabel: sections[sectionKey].label,
    question: q.question,
    answer: q.answer,
    answerRevealed: false,
    attempts: [],
    ended: false,
  };
}

function buildSectionWarnings() {
  if (!state.initialized || !state.teams.length) return [];
  const targets = ["physics", "sciFi"];
  return targets.map((section) => {
    const missing = state.teams
      .filter((t) => !state.sectionAttemptsByTeam[t.id]?.[section])
      .map((t) => t.name);
    return { section, sectionLabel: sections[section].label, missingTeams: missing };
  });
}

app.get("/api/state", (_req, res) => res.json(clonePublicState()));

app.post("/api/setup", (req, res) => {
  const { teamNames } = req.body;
  if (!Array.isArray(teamNames) || !teamNames.length) {
    return res.status(400).json({ error: "teamNames is required" });
  }
  const cleaned = teamNames.map((n) => String(n).trim()).filter(Boolean);
  if (!cleaned.length) return res.status(400).json({ error: "Provide at least one team" });

  pushUndo(snapshotForUndo());
  state.initialized = true;
  state.teams = cleaned.map((name, idx) => ({ id: `team-${idx + 1}`, name, score: 0 }));
  state.activeTeamId = state.teams[0].id;
  state.activeSection = "physics";
  state.currentQuestion = null;
  state.usedQuestionIds = new Set();
  state.attemptsStarted = [];
  state.scoredAttemptKeys = new Set();
  state.sectionAttemptsByTeam = {};
  state.actionHistory = [];
  emitState();
  res.json(clonePublicState());
});

app.post("/api/section", (req, res) => {
  const { section } = req.body;
  if (!sections[section]) return res.status(400).json({ error: "Invalid section" });
  pushUndo(snapshotForUndo());
  state.activeSection = section;
  emitState();
  res.json(clonePublicState());
});

app.post("/api/team/select", (req, res) => {
  const { teamId } = req.body;
  if (!state.teams.some((t) => t.id === teamId)) return res.status(400).json({ error: "Team not found" });
  pushUndo(snapshotForUndo());
  state.activeTeamId = teamId;
  emitState();
  res.json(clonePublicState());
});

app.post("/api/question/next", (_req, res) => {
  if (!state.initialized) return res.status(400).json({ error: "Run setup first" });
  const q = pickRandomQuestion(state.activeSection);
  if (!q) return res.status(400).json({ error: "No questions left in this section" });
  pushUndo(snapshotForUndo());
  state.currentQuestion = q;
  state.attemptsStarted = [];
  state.scoredAttemptKeys = new Set();
  emitState();
  res.json(clonePublicState());
});

app.post("/api/question/reveal", (_req, res) => {
  if (!state.currentQuestion) return res.status(400).json({ error: "No current question" });
  pushUndo(snapshotForUndo());
  state.currentQuestion.answerRevealed = true;
  emitState();
  res.json(clonePublicState());
});

app.post("/api/attempt/start", (req, res) => {
  const { attemptNo } = req.body;
  if (!state.currentQuestion) return res.status(400).json({ error: "No current question" });
  if (![1, 2].includes(attemptNo)) return res.status(400).json({ error: "attemptNo must be 1 or 2" });
  pushUndo(snapshotForUndo());
  if (!state.attemptsStarted.includes(attemptNo)) state.attemptsStarted.push(attemptNo);
  emitState();
  res.json(clonePublicState());
});

app.post("/api/score/dynamic", (req, res) => {
  const { outcome, attemptNo } = req.body;
  if (!state.currentQuestion) return res.status(400).json({ error: "No current question" });
  const team = state.teams.find((t) => t.id === state.activeTeamId);
  if (!team) return res.status(400).json({ error: "No active team selected" });
  if (!["correct", "wrong"].includes(outcome)) return res.status(400).json({ error: "Invalid outcome" });
  if (![1, 2].includes(attemptNo)) return res.status(400).json({ error: "attemptNo must be 1 or 2" });

  const key = `${state.currentQuestion.id}:${attemptNo}`;
  if (state.scoredAttemptKeys.has(key)) {
    return res.status(400).json({ error: "Attempt already scored. Use Undo if needed." });
  }

  pushUndo(snapshotForUndo());
  const mark = sections[state.currentQuestion.section][outcome];
  team.score += mark;
  state.currentQuestion.attempts.push({ teamId: team.id, teamName: team.name, attemptNo, outcome, mark });
  state.scoredAttemptKeys.add(key);

  if (["physics", "sciFi"].includes(state.currentQuestion.section)) {
    if (!state.sectionAttemptsByTeam[team.id]) state.sectionAttemptsByTeam[team.id] = {};
    state.sectionAttemptsByTeam[team.id][state.currentQuestion.section] = true;
  }

  emitState();
  res.json(clonePublicState());
});

app.post("/api/score/manual", (req, res) => {
  const { mark } = req.body;
  const n = Number(mark);
  const team = state.teams.find((t) => t.id === state.activeTeamId);
  if (!team) return res.status(400).json({ error: "No active team selected" });
  if (Number.isNaN(n)) return res.status(400).json({ error: "mark must be a number" });
  pushUndo(snapshotForUndo());
  team.score += n;
  emitState();
  res.json(clonePublicState());
});

app.post("/api/question/end", (_req, res) => {
  if (!state.currentQuestion) return res.status(400).json({ error: "No current question" });
  pushUndo(snapshotForUndo());
  state.currentQuestion.ended = true;
  emitState();
  res.json(clonePublicState());
});

app.post("/api/question/skip", (_req, res) => {
  if (!state.currentQuestion) return res.status(400).json({ error: "No current question" });
  pushUndo(snapshotForUndo());
  state.currentQuestion.ended = true;
  emitState();
  res.json(clonePublicState());
});

app.post("/api/question/reset", (_req, res) => {
  if (!state.currentQuestion) return res.status(400).json({ error: "No current question" });
  pushUndo(snapshotForUndo());
  state.currentQuestion.attempts = [];
  state.currentQuestion.answerRevealed = false;
  state.scoredAttemptKeys = new Set();
  emitState();
  res.json(clonePublicState());
});

app.post("/api/undo", (_req, res) => {
  const last = state.actionHistory.pop();
  if (!last) return res.status(400).json({ error: "Nothing to undo" });
  restoreFromSnapshot(JSON.parse(last));
  emitState();
  res.json(clonePublicState());
});

io.on("connection", (socket) => {
  socket.emit("state:update", clonePublicState());
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Q-Mania backend running on http://localhost:${PORT}`);
});
