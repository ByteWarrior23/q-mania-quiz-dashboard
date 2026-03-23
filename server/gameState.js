/**
 * GameState - central game logic for Q-Mania Quiz Dashboard
 * Encapsulates all state mutations, validation, and undo stack.
 */

const TEAM_COLORS = [
  "#00d4ff", "#ff6b35", "#39ff14", "#ff2244",
  "#ffd700", "#a855f7", "#ec4899", "#10b981",
];

export default class GameState {
  constructor(allQuestions) {
    this.allQuestions = allQuestions;
    this.sections = Object.keys(allQuestions);
    this._initState();
  }

  _initState() {
    this.phase = "setup";
    this.teams = [];
    this.currentSection = null;
    this.currentQuestion = null;
    this.questionId = 0;
    this.questionState = "idle";
    this.activeTeamId = null;
    this.activeAttempt = null;
    this.scoredAttempts = {};
    this.usedIndices = {};
    this.undoStack = [];

    this.sections.forEach((s) => {
      this.usedIndices[s] = new Set();
    });
  }

  _validate(condition, message) {
    if (!condition) throw new Error(message);
  }

  _attemptKey(qId, teamId, attempt) {
    return `${qId}-${teamId}-${attempt}`;
  }

  _snapshot() {
    return {
      teams: JSON.parse(JSON.stringify(this.teams)),
      currentQuestion: this.currentQuestion ? { ...this.currentQuestion } : null,
      questionId: this.questionId,
      questionState: this.questionState,
      activeTeamId: this.activeTeamId,
      activeAttempt: this.activeAttempt,
      scoredAttempts: { ...this.scoredAttempts },
      usedIndices: Object.fromEntries(
        Object.entries(this.usedIndices).map(([k, v]) => [k, new Set(v)])
      ),
    };
  }

  _pushUndo() {
    this.undoStack.push(this._snapshot());
    if (this.undoStack.length > 15) this.undoStack.shift();
  }

  _calcPoints(attempt, marks, result) {
    if (result === "correct") return attempt === 1 ? marks : Math.floor(marks / 2);
    if (result === "wrong") return attempt === 1 ? -Math.floor(marks / 4) : 0;
    return 0;
  }

  setupTeams(teamNames) {
    this._validate(Array.isArray(teamNames) && teamNames.length >= 2, "Need at least 2 teams");
    const names = teamNames.map((n) => String(n).trim()).filter(Boolean);
    this._validate(names.length >= 2, "Need at least 2 non-empty team names");
    this._validate(new Set(names).size === names.length, "Team names must be unique");

    this.teams = names.map((name, i) => ({
      id: `team-${i}`,
      name,
      score: 0,
      color: TEAM_COLORS[i % TEAM_COLORS.length],
    }));
    this.phase = "game";
  }

  selectSection(section) {
    this._validate(this.sections.includes(section), `Unknown section: ${section}`);
    this.currentSection = section;
    this.currentQuestion = null;
    this.questionState = "idle";
    this.activeTeamId = null;
    this.activeAttempt = null;
    this.scoredAttempts = {};
  }

  nextQuestion() {
    this._validate(this.currentSection, "Select a section first");
    const pool = this.allQuestions[this.currentSection];
    const available = pool
      .map((_, i) => i)
      .filter((i) => !this.usedIndices[this.currentSection].has(i));
    this._validate(available.length > 0, "No remaining questions in this section");

    const idx = available[Math.floor(Math.random() * available.length)];
    this.usedIndices[this.currentSection].add(idx);

    this.questionId++;
    this.currentQuestion = {
      ...pool[idx],
      marks: pool[idx].marks ?? 10,
      _id: this.questionId,
      _section: this.currentSection,
    };
    this.questionState = "active";
    this.activeTeamId = null;
    this.activeAttempt = null;
    this.scoredAttempts = {};
  }

  startAttempt(teamId, attempt) {
    this._validate(this.currentQuestion, "No active question");
    this._validate(this.questionState === "active", "Cannot start attempt in current state");
    this._validate([1, 2].includes(attempt), "Attempt must be 1 or 2");
    this._validate(this.teams.some((t) => t.id === teamId), "Team not found");

    const key = this._attemptKey(this.currentQuestion._id, teamId, attempt);
    this._validate(!this.scoredAttempts[key], "Attempt already scored");

    this.activeTeamId = teamId;
    this.activeAttempt = attempt;
    this.questionState = "scoring";
  }

  markScore(result) {
    this._validate(["correct", "wrong"].includes(result), "Result must be correct or wrong");
    this._validate(this.activeTeamId && this.activeAttempt, "No active attempt");
    this._validate(this.currentQuestion, "No active question");

    const key = this._attemptKey(this.currentQuestion._id, this.activeTeamId, this.activeAttempt);
    const team = this.teams.find((t) => t.id === this.activeTeamId);
    const points = this._calcPoints(this.activeAttempt, this.currentQuestion.marks, result);

    this._pushUndo();
    team.score += points;
    this.scoredAttempts[key] = { result, points };
    this.activeTeamId = null;
    this.activeAttempt = null;
    this.questionState = "active";
  }

  manualScore(teamId, points) {
    this._validate(typeof points === "number" && !Number.isNaN(points), "Invalid points value");
    const team = this.teams.find((t) => t.id === teamId);
    this._validate(team, "Team not found");

    this._pushUndo();
    team.score += points;
  }

  skipQuestion() {
    this._validate(this.currentQuestion, "No active question");
    this.questionState = "done";
    this.activeTeamId = null;
    this.activeAttempt = null;
  }

  resetQuestion() {
    if (!this.currentQuestion) return;
    this._pushUndo();
    this.usedIndices[this.currentSection].delete(
      this.allQuestions[this.currentSection].findIndex(
        (q) => q.question === this.currentQuestion.question
      )
    );
    this.currentQuestion = null;
    this.questionState = "idle";
    this.activeTeamId = null;
    this.activeAttempt = null;
    this.scoredAttempts = {};
  }

  undo() {
    this._validate(this.undoStack.length > 0, "Nothing to undo");
    const snap = this.undoStack.pop();
    this.teams = snap.teams;
    this.currentQuestion = snap.currentQuestion;
    this.questionId = snap.questionId;
    this.questionState = snap.questionState;
    this.activeTeamId = snap.activeTeamId;
    this.activeAttempt = snap.activeAttempt;
    this.scoredAttempts = snap.scoredAttempts;
    this.usedIndices = snap.usedIndices;
  }

  resetGame() {
    this._initState();
  }

  getPublicState() {
    const qId = this.currentQuestion?._id ?? 0;
    const teamsWithStatus = this.teams.map((t) => ({
      id: t.id,
      name: t.name,
      score: t.score,
      color: t.color,
      att1Scored: !!this.scoredAttempts[this._attemptKey(qId, t.id, 1)],
      att2Scored: !!this.scoredAttempts[this._attemptKey(qId, t.id, 2)],
      att1Result: this.scoredAttempts[this._attemptKey(qId, t.id, 1)]?.result ?? null,
      att2Result: this.scoredAttempts[this._attemptKey(qId, t.id, 2)]?.result ?? null,
    }));

    const leaderboard = [...teamsWithStatus].sort((a, b) => b.score - a.score);
    const remaining = this.currentSection
      ? this.allQuestions[this.currentSection].length - this.usedIndices[this.currentSection].size
      : 0;

    const sectionMeta = Object.fromEntries(
      this.sections.map((s) => [
        s,
        {
          total: this.allQuestions[s].length,
          remaining: this.allQuestions[s].length - this.usedIndices[s].size,
        },
      ])
    );

    return {
      phase: this.phase,
      teams: teamsWithStatus,
      leaderboard,
      sections: this.sections,
      sectionMeta,
      currentSection: this.currentSection,
      currentQuestion: this.currentQuestion
        ? {
            question: this.currentQuestion.question,
            answer: this.currentQuestion.answer,
            marks: this.currentQuestion.marks,
            hint: this.currentQuestion.hint ?? "",
          }
        : null,
      questionState: this.questionState,
      activeTeamId: this.activeTeamId,
      activeAttempt: this.activeAttempt,
      canUndo: this.undoStack.length > 0,
      remainingInSection: remaining,
    };
  }
}
