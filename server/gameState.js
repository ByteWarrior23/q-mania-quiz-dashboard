/**
 * GameState — Q-Mania Quiz Dashboard v2.1
 *
 * SCORING (fixed, no scaling):
 *   Physics  → correct +40  |  wrong −10
 *   Sci-Fi   → correct +40  |  wrong −10
 *   Puzzles  → correct +60  |  wrong −20
 *
 * QUESTION LIMITS (based on team count X):
 *   Physics / Sci-Fi → ceil(1.7 × X)
 *   Puzzles          → ceil(0.6 × X)
 *
 * MAX TEAMS: 8
 */

const TEAM_COLORS = [
  '#00d4ff', // cyan
  '#ff6b35', // orange
  '#39ff14', // green
  '#ff2244', // red
  '#ffd700', // gold
  '#a855f7', // purple
  '#ec4899', // pink
  '#10b981', // emerald
]

const MAX_TEAMS = 8

// ─── Section scoring — the ONLY source of truth for marks ───────────────────
const SECTION_SCORES = {
  physics: { correct: 40, wrong: -10 },
  sciFi:   { correct: 40, wrong: -10 },
  puzzles: { correct: 60, wrong: -20 },
}

const DEFAULT_SCORE = { correct: 40, wrong: -10 }

// Sections to check for end-game attempt warnings (display only, no penalty)
const WARN_SECTIONS = ['physics', 'sciFi']

export default class GameState {
  constructor(allQuestions) {
    this.allQuestions = allQuestions
    this.sections     = Object.keys(allQuestions)
    this._initState()
  }

  // ── Initialisation ─────────────────────────────────────────────────────────

  _initState() {
    this.phase               = 'setup'   // setup | game | end
    this.teams               = []
    this.currentSection      = null
    this.currentQuestion     = null
    this.questionId          = 0
    this.questionState       = 'idle'    // idle | active | scoring | done
    this.activeTeamId        = null
    this.activeAttempt       = null      // 1 or 2
    this.scoredAttempts      = {}        // key → { result, points }
    this.usedIndices         = {}        // section → Set<number>
    this.questionsAsked      = {}        // section → count
    this.teamSectionAttempts = {}        // teamId  → Set<section>
    this.undoStack           = []        // snapshots for undo (max 20)

    this.sections.forEach(s => {
      this.usedIndices[s]    = new Set()
      this.questionsAsked[s] = 0
    })
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  _validate(condition, message) {
    if (!condition) throw new Error(message)
  }

  _attemptKey(qId, teamId, attempt) {
    return `${qId}-${teamId}-${attempt}`
  }

  /**
   * Max questions allowed for a section given current team count.
   * Physics/SciFi → ceil(1.7 × X)
   * Puzzles       → ceil(0.6 × X)
   */
  _getMaxQuestions(section) {
    const n = this.teams.length
    if (section === 'puzzles') return Math.ceil(0.6 * n)
    return Math.ceil(1.7 * n)
  }

  /**
   * Calculate points to award.
   * Always uses section-level fixed scores — never per-question marks.
   */
  _calcPoints(section, result) {
    const cfg = SECTION_SCORES[section] ?? DEFAULT_SCORE
    if (result === 'correct') return cfg.correct   // e.g. +40
    if (result === 'wrong')   return cfg.wrong      // e.g. -10 (already negative)
    return 0
  }

  _snapshot() {
    return {
      teams:               JSON.parse(JSON.stringify(this.teams)),
      currentSection:      this.currentSection,
      currentQuestion:     this.currentQuestion ? { ...this.currentQuestion } : null,
      questionId:          this.questionId,
      questionState:       this.questionState,
      activeTeamId:        this.activeTeamId,
      activeAttempt:       this.activeAttempt,
      scoredAttempts:      { ...this.scoredAttempts },
      usedIndices:         Object.fromEntries(
                             Object.entries(this.usedIndices).map(([k, v]) => [k, new Set(v)])
                           ),
      questionsAsked:      { ...this.questionsAsked },
      teamSectionAttempts: Object.fromEntries(
                             Object.entries(this.teamSectionAttempts).map(([k, v]) => [k, new Set(v)])
                           ),
    }
  }

  _pushUndo() {
    this.undoStack.push(this._snapshot())
    if (this.undoStack.length > 20) this.undoStack.shift()
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  setupTeams(teamNames) {
    this._validate(Array.isArray(teamNames) && teamNames.length >= 2,
      'Need at least 2 teams')
    const names = teamNames.map(n => String(n).trim()).filter(Boolean)
    this._validate(names.length >= 2,
      'Need at least 2 non-empty team names')
    this._validate(names.length <= MAX_TEAMS,
      `Maximum ${MAX_TEAMS} teams allowed`)
    this._validate(new Set(names).size === names.length,
      'Team names must be unique')

    this.teams = names.map((name, i) => ({
      id:    `team-${i}`,
      name,
      score: 0,
      color: TEAM_COLORS[i],
    }))
    this.phase = 'game'
  }

  // ── Section control ────────────────────────────────────────────────────────

  selectSection(section) {
    this._validate(this.sections.includes(section),
      `Unknown section: ${section}`)
    this._validate(this.questionState !== 'scoring',
      'Finish the current attempt before switching sections')
    this.currentSection  = section
    this.currentQuestion = null
    this.questionState   = 'idle'
    this.activeTeamId    = null
    this.activeAttempt   = null
    this.scoredAttempts  = {}
  }

  // ── Question control ───────────────────────────────────────────────────────

  nextQuestion() {
    this._validate(this.currentSection,
      'Select a section first')
    this._validate(this.questionState !== 'scoring',
      'Finish the current attempt before drawing the next question')

    const maxAllowed = this._getMaxQuestions(this.currentSection)
    const asked      = this.questionsAsked[this.currentSection] ?? 0
    this._validate(asked < maxAllowed,
      `Question limit reached for ${this.currentSection} (max ${maxAllowed} for ${this.teams.length} teams)`)

    const pool      = this.allQuestions[this.currentSection]
    const available = pool
      .map((_, i) => i)
      .filter(i => !this.usedIndices[this.currentSection].has(i))
    this._validate(available.length > 0,
      'No remaining questions in this section (all used)')

    // Pick a random unused question
    const idx = available[Math.floor(Math.random() * available.length)]
    this.usedIndices[this.currentSection].add(idx)
    this.questionsAsked[this.currentSection] = asked + 1

    this.questionId++
    const q = pool[idx]
    const cfg = SECTION_SCORES[this.currentSection] ?? DEFAULT_SCORE

    this.currentQuestion = {
      ...q,
      // Always use section-based fixed scoring, never per-question marks
      marks:          cfg.correct,
      wrongPenalty:   Math.abs(cfg.wrong),
      _id:            this.questionId,
      _section:       this.currentSection,
      _originalIndex: idx,
    }
    this.questionState  = 'active'
    this.activeTeamId   = null
    this.activeAttempt  = null
    this.scoredAttempts = {}
  }

  endQuestion() {
    this._validate(this.currentQuestion,
      'No active question to end')
    this._validate(this.questionState !== 'scoring',
      'Finish the current attempt before ending the question')
    this.questionState = 'done'
    this.activeTeamId  = null
    this.activeAttempt = null
  }

  skipQuestion() {
    this._validate(this.currentQuestion,
      'No active question to skip')
    this._validate(this.questionState !== 'scoring',
      'Finish the current attempt before skipping')
    this.questionState = 'done'
    this.activeTeamId  = null
    this.activeAttempt = null
  }

  resetQuestion() {
    if (!this.currentQuestion) return
    this._validate(this.questionState !== 'scoring',
      'Finish the current attempt before resetting')
    this._pushUndo()
    // Return the question to the available pool
    if (this.currentQuestion._originalIndex !== undefined) {
      this.usedIndices[this.currentSection].delete(this.currentQuestion._originalIndex)
    }
    this.questionsAsked[this.currentSection] =
      Math.max(0, (this.questionsAsked[this.currentSection] ?? 1) - 1)
    this.currentQuestion = null
    this.questionState   = 'idle'
    this.activeTeamId    = null
    this.activeAttempt   = null
    this.scoredAttempts  = {}
  }

  // ── Attempt / Scoring ──────────────────────────────────────────────────────

  startAttempt(teamId, attempt) {
    this._validate(this.currentQuestion,
      'No active question')
    this._validate(this.questionState === 'active',
      'Cannot start attempt — question is not in active state')
    this._validate([1, 2].includes(attempt),
      'Attempt must be 1 or 2')
    this._validate(this.teams.some(t => t.id === teamId),
      'Team not found')
    const key = this._attemptKey(this.currentQuestion._id, teamId, attempt)
    this._validate(!this.scoredAttempts[key],
      'This attempt has already been scored for this team')
    this.activeTeamId  = teamId
    this.activeAttempt = attempt
    this.questionState = 'scoring'
  }

  markScore(result) {
    this._validate(['correct', 'wrong'].includes(result),
      'Result must be "correct" or "wrong"')
    this._validate(this.activeTeamId && this.activeAttempt,
      'No active attempt in progress')
    this._validate(this.currentQuestion,
      'No active question')

    const key    = this._attemptKey(this.currentQuestion._id, this.activeTeamId, this.activeAttempt)
    const team   = this.teams.find(t => t.id === this.activeTeamId)
    const points = this._calcPoints(this.currentQuestion._section, result)

    this._pushUndo()
    team.score               += points
    this.scoredAttempts[key]  = { result, points }

    // Track which sections this team has participated in
    if (!this.teamSectionAttempts[this.activeTeamId]) {
      this.teamSectionAttempts[this.activeTeamId] = new Set()
    }
    this.teamSectionAttempts[this.activeTeamId].add(this.currentQuestion._section)

    this.activeTeamId  = null
    this.activeAttempt = null
    this.questionState = 'active'   // return to active so host can do more attempts
  }

  manualScore(teamId, points) {
    this._validate(typeof points === 'number' && !isNaN(points),
      'Points must be a valid number')
    this._validate(points !== 0,
      'Points adjustment cannot be zero')
    const team = this.teams.find(t => t.id === teamId)
    this._validate(team, 'Team not found')
    this._pushUndo()
    team.score += points
  }

  // ── Utility ────────────────────────────────────────────────────────────────

  undo() {
    this._validate(this.undoStack.length > 0, 'Nothing to undo')
    const snap = this.undoStack.pop()
    this.teams               = snap.teams
    this.currentSection      = snap.currentSection
    this.currentQuestion     = snap.currentQuestion
    this.questionId          = snap.questionId
    this.questionState       = snap.questionState
    this.activeTeamId        = snap.activeTeamId
    this.activeAttempt       = snap.activeAttempt
    this.scoredAttempts      = snap.scoredAttempts
    this.usedIndices         = snap.usedIndices
    this.questionsAsked      = snap.questionsAsked
    this.teamSectionAttempts = snap.teamSectionAttempts
  }

  endGame() {
    // Allow from any non-setup state
    if (this.questionState === 'scoring') {
      this.questionState = 'done'
      this.activeTeamId  = null
      this.activeAttempt = null
    }
    this.phase = 'end'
  }

  resetGame() {
    this._initState()
  }

  // ── Public state (sent to all clients) ────────────────────────────────────

  getPublicState() {
    const qId = this.currentQuestion?._id ?? 0

    // Enrich teams with per-question attempt status
    const teamsWithStatus = this.teams.map(t => ({
      id:         t.id,
      name:       t.name,
      score:      t.score,
      color:      t.color,
      att1Scored: !!this.scoredAttempts[this._attemptKey(qId, t.id, 1)],
      att2Scored: !!this.scoredAttempts[this._attemptKey(qId, t.id, 2)],
      att1Result: this.scoredAttempts[this._attemptKey(qId, t.id, 1)]?.result ?? null,
      att2Result: this.scoredAttempts[this._attemptKey(qId, t.id, 2)]?.result ?? null,
    }))

    const leaderboard = [...teamsWithStatus].sort((a, b) => b.score - a.score)

    // Section metadata with limits
    const sectionMeta = Object.fromEntries(
      this.sections.map(s => {
        const maxAllowed = this.teams.length > 0
          ? this._getMaxQuestions(s)
          : this.allQuestions[s].length
        const asked = this.questionsAsked[s] ?? 0
        return [s, {
          total:      this.allQuestions[s].length,
          maxAllowed,
          asked,
          remaining:  Math.max(0, maxAllowed - asked),
          poolLeft:   this.allQuestions[s].length - this.usedIndices[s].size,
        }]
      })
    )

    const remaining = this.currentSection
      ? (sectionMeta[this.currentSection]?.remaining ?? 0)
      : 0

    // End-game warnings — teams that never attempted Physics or Sci-Fi
    const endWarnings = WARN_SECTIONS
      .map(section => {
        const label  = section === 'sciFi' ? 'Sci-Fi'
          : section.charAt(0).toUpperCase() + section.slice(1)
        const missed = this.teams
          .filter(t => !this.teamSectionAttempts[t.id]?.has(section))
          .map(t => ({ id: t.id, name: t.name, color: t.color }))
        return { section, label, missed }
      })
      .filter(w => w.missed.length > 0)

    // Section score config (for UI display)
    const sectionScores = Object.fromEntries(
      this.sections.map(s => [s, SECTION_SCORES[s] ?? DEFAULT_SCORE])
    )

    return {
      phase:              this.phase,
      teams:              teamsWithStatus,
      leaderboard,
      sections:           this.sections,
      sectionMeta,
      sectionScores,
      currentSection:     this.currentSection,
      currentQuestion:    this.currentQuestion
        ? {
            question:     this.currentQuestion.question,
            answer:       this.currentQuestion.answer,
            marks:        this.currentQuestion.marks,       // always section-based (40 or 60)
            wrongPenalty: this.currentQuestion.wrongPenalty, // always section-based (10 or 20)
            hint:         this.currentQuestion.hint ?? '',
            section:      this.currentQuestion._section,
          }
        : null,
      questionState:      this.questionState,
      activeTeamId:       this.activeTeamId,
      activeAttempt:      this.activeAttempt,
      canUndo:            this.undoStack.length > 0,
      remainingInSection: remaining,
      endWarnings,
    }
  }
}