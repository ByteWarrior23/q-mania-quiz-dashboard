import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import GameState from "./gameState.js";

const __dirname     = path.dirname(fileURLToPath(import.meta.url));
const PORT          = process.env.PORT ?? 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
});

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// ── Load questions ────────────────────────────────────────────────────────────
const questionsPath = path.join(__dirname, "data", "questions.json");
let allQuestions;

try {
  allQuestions = JSON.parse(fs.readFileSync(questionsPath, "utf-8"));
  const sections = Object.keys(allQuestions);
  const total    = sections.reduce((n, s) => n + allQuestions[s].length, 0);
  console.log(`\n✓ Loaded ${total} questions across ${sections.length} sections: ${sections.join(", ")}`);
} catch (err) {
  console.error("✗ Failed to load questions.json:", err.message);
  process.exit(1);
}

// ── Game instance ─────────────────────────────────────────────────────────────
const game = new GameState(allQuestions);

// ── REST endpoints ────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/state", (_req, res) => {
  res.json(game.getPublicState());
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const broadcast = () => io.emit("state", game.getPublicState());

/**
 * Wraps a game method call:
 *  - On success  → broadcast new state to ALL clients
 *  - On error    → send error message back to THIS socket only
 */
const safeHandler = (socket, fn) => async (...args) => {
  try {
    await fn(...args);
    broadcast();
  } catch (err) {
    socket.emit("error", { message: err.message });
  }
};

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`  + Client connected:    ${socket.id}`);

  // Send full current state immediately on connect
  socket.emit("state", game.getPublicState());

  // ── Team Setup ──────────────────────────────────────────────────────────────
  socket.on("setup:teams",    safeHandler(socket, ({ teams })           => game.setupTeams(teams)));

  // ── Section Control ─────────────────────────────────────────────────────────
  socket.on("section:select", safeHandler(socket, ({ section })         => game.selectSection(section)));

  // ── Question Control ────────────────────────────────────────────────────────
  socket.on("question:next",  safeHandler(socket, ()                    => game.nextQuestion()));
  socket.on("question:end",   safeHandler(socket, ()                    => game.endQuestion()));   // FIX: was missing
  socket.on("question:skip",  safeHandler(socket, ()                    => game.skipQuestion()));
  socket.on("question:reset", safeHandler(socket, ()                    => game.resetQuestion()));

  // ── Attempt & Scoring ───────────────────────────────────────────────────────
  socket.on("attempt:start",  safeHandler(socket, ({ teamId, attempt }) => game.startAttempt(teamId, attempt)));
  socket.on("score:mark",     safeHandler(socket, ({ result })          => game.markScore(result)));
  socket.on("score:manual",   safeHandler(socket, ({ teamId, points })  => game.manualScore(teamId, Number(points))));

  // ── Game Utility ────────────────────────────────────────────────────────────
  socket.on("action:undo",    safeHandler(socket, ()                    => game.undo()));
  socket.on("game:end",       safeHandler(socket, ()                    => game.endGame()));       // FIX: was missing
  socket.on("game:reset",     safeHandler(socket, ()                    => game.resetGame()));

  socket.on("disconnect", () => {
    console.log(`  - Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`\n🎮  Q-MANIA server  →  http://localhost:${PORT}`);
  console.log(`    Scoring  : Physics +40/−10 | Sci-Fi +40/−10 | Puzzles +60/−20`);
  console.log(`    Q limits : ceil(1.7 × teams) for Physics & Sci-Fi | ceil(0.6 × teams) for Puzzles\n`);
});