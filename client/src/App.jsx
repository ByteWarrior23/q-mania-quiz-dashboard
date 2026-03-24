import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'

// ─── Constants ───────────────────────────────────────────────────────────────

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'
const MAX_TEAMS  = 8

const SECTION_META = {
  physics: { icon: '⚛',  label: 'Physics', color: '#00d4ff', scoreLabel: '+40 / −10' },
  sciFi:   { icon: '🚀', label: 'Sci-Fi',  color: '#a855f7', scoreLabel: '+40 / −10' },
  puzzles: { icon: '🧩', label: 'Puzzles', color: '#ffd700', scoreLabel: '+60 / −20' },
}
const getSectionMeta = (s) =>
  SECTION_META[s] ?? { icon: '◈', label: s?.toUpperCase() ?? '', color: '#00d4ff', scoreLabel: '' }

const RANK_ICONS = ['🥇', '🥈', '🥉']

const TEAM_COLORS = [
  '#00d4ff', '#ff6b35', '#39ff14', '#ff2244',
  '#ffd700', '#a855f7', '#ec4899', '#10b981',
]

let _uid = 0
const makeTeam = (name = '') => ({ uid: ++_uid, name })

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [gameState, setGameState] = useState(null)
  const [connected, setConnected] = useState(false)
  const [error,     setError]     = useState(null)
  const socketRef                 = useRef(null)

  useEffect(() => {
    const socket = io(SERVER_URL, { reconnectionAttempts: Infinity })
    socketRef.current = socket
    socket.on('connect',    ()      => setConnected(true))
    socket.on('disconnect', ()      => setConnected(false))
    socket.on('state',      (state) => setGameState(state))
    socket.on('error',      ({ message }) => {
      setError(message)
      setTimeout(() => setError(null), 5000)
    })
    return () => socket.disconnect()
  }, [])

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data)
  }, [])

  if (!gameState) {
    return (
      <div className="min-h-screen bg-void flex flex-col items-center justify-center gap-4">
        <div className="grid-overlay" />
        <h1 className="font-display text-4xl text-neon-cyan glow-cyan tracking-widest">Q-MANIA</h1>
        <p className="font-mono text-ghost text-sm tracking-widest animate-pulse">
          {connected ? 'LOADING STATE...' : 'CONNECTING TO SERVER...'}
        </p>
        {!connected && (
          <p className="font-mono text-ghost/50 text-xs mt-2">
            Make sure the server is running on {SERVER_URL}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
      <div className="grid-overlay" />
      <div className="scanlines" />

      {!connected && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-900/80 border-b border-yellow-500/40 text-yellow-300 text-center py-2 text-sm font-mono tracking-widest">
          ⚡ CONNECTION LOST — RECONNECTING...
        </div>
      )}

      {error && (
        <div className="fixed top-4 right-4 z-50 card border border-neon-red/40 bg-red-950/90 text-neon-red px-5 py-4 text-base font-mono max-w-sm animate-slide-in">
          ⚠ {error}
        </div>
      )}

      {gameState.phase === 'setup' && (
        <TeamSetup onStart={(teams) => emit('setup:teams', { teams })} />
      )}
      {gameState.phase === 'game' && (
        <Dashboard gameState={gameState} emit={emit} />
      )}
      {gameState.phase === 'end' && (
        <EndGameScreen
          gameState={gameState}
          onReset={() => emit('game:reset')}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM SETUP
// ═══════════════════════════════════════════════════════════════════════════════

function TeamSetup({ onStart }) {
  const [teams, setTeams] = useState([makeTeam(), makeTeam(), makeTeam(), makeTeam()])
  const [error, setError] = useState('')
  const inputRefs         = useRef([])

  const addTeam = () => {
    if (teams.length >= MAX_TEAMS) return
    setTeams(prev => [...prev, makeTeam()])
    setTimeout(() => inputRefs.current[teams.length]?.focus(), 30)
  }

  const removeTeam = (uid) => {
    if (teams.length <= 2) return
    setTeams(prev => prev.filter(t => t.uid !== uid))
    setError('')
  }

  const updateName = (uid, value) => {
    setTeams(prev => prev.map(t => t.uid === uid ? { ...t, name: value } : t))
    if (error) setError('')
  }

  const handleStart = () => {
    const names = teams.map(t => t.name.trim()).filter(Boolean)
    if (names.length < 2)                    { setError('Add at least 2 team names'); return }
    if (new Set(names).size < names.length)  { setError('Team names must be unique'); return }
    setError('')
    onStart(names)
  }

  const handleKeyDown = (e, idx) => {
    if (e.key !== 'Enter') return
    if (idx < teams.length - 1) inputRefs.current[idx + 1]?.focus()
    else handleStart()
  }

  const namedCount = teams.filter(t => t.name.trim()).length

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-5"
           style={{ background: 'radial-gradient(circle, #00d4ff, transparent)', filter: 'blur(80px)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-5"
           style={{ background: 'radial-gradient(circle, #a855f7, transparent)', filter: 'blur(80px)' }} />

      <div className="relative z-10 w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-12">
          <h1 className="font-display text-7xl tracking-widest text-neon-cyan glow-cyan mb-2">
            Q-MANIA
          </h1>
          <div className="h-px bg-gradient-to-r from-transparent via-neon-cyan to-transparent opacity-40 mb-4" />
          <p className="font-mono text-ghost text-xs tracking-[0.4em] uppercase">
            Live Quiz Dashboard · Host Console
          </p>
        </div>

        {/* Scoring reference */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {Object.entries(SECTION_META).map(([key, meta]) => (
            <div key={key} className="card-sm p-3 text-center">
              <div className="text-2xl mb-1">{meta.icon}</div>
              <div className="font-mono text-xs tracking-widest mb-1" style={{ color: meta.color }}>
                {meta.label.toUpperCase()}
              </div>
              <div className="font-mono text-xs text-ghost">{meta.scoreLabel}</div>
            </div>
          ))}
        </div>

        {/* Team setup card */}
        <div className="card p-8">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-1 h-6 bg-neon-cyan rounded-full" style={{ boxShadow: '0 0 8px #00d4ff' }} />
            <h2 className="font-display text-sm text-frost tracking-widest">CONFIGURE TEAMS</h2>
          </div>

          <div className="space-y-3 mb-5">
            {teams.map((team, i) => (
              <div key={team.uid} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: TEAM_COLORS[i], boxShadow: `0 0 10px ${TEAM_COLORS[i]}88` }}
                />
                <input
                  ref={el => { inputRefs.current[i] = el }}
                  className="input-field flex-1 text-base"
                  value={team.name}
                  onChange={e => updateName(team.uid, e.target.value)}
                  placeholder={`Team ${i + 1} name`}
                  maxLength={24}
                  onKeyDown={e => handleKeyDown(e, i)}
                />
                {teams.length > 2 && (
                  <button
                    onClick={() => removeTeam(team.uid)}
                    className="text-ghost hover:text-neon-red transition-colors w-6 text-base flex-shrink-0"
                    aria-label="Remove team"
                  >✕</button>
                )}
              </div>
            ))}
          </div>

          {teams.length < MAX_TEAMS ? (
            <button onClick={addTeam} className="btn btn-ghost mb-5 text-sm" style={{ width: 'auto' }}>
              + ADD TEAM ({teams.length}/{MAX_TEAMS})
            </button>
          ) : (
            <p className="font-mono text-ghost/50 text-sm mb-5 text-center">
              Maximum {MAX_TEAMS} teams reached
            </p>
          )}

          {error && (
            <p className="text-neon-red text-sm font-mono mb-4 flex items-center gap-2">
              <span>⚠</span> {error}
            </p>
          )}

          <button onClick={handleStart} className="btn btn-primary py-4 text-base">
            ▶ LAUNCH GAME
          </button>

          <p className="text-ghost text-sm font-mono text-center mt-4">
            {namedCount} / {teams.length} teams named
          </p>
        </div>

        <p className="text-center font-mono text-ghost/40 text-xs mt-6">
          Q-Mania Club · Live Event Quiz System
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD (GAME PHASE)
// ═══════════════════════════════════════════════════════════════════════════════

function Dashboard({ gameState, emit }) {
  const [mobileTab,   setMobileTab]   = useState('question')
  const [showAnswer,  setShowAnswer]  = useState(false)
  const prevQuestionRef               = useRef(null)

  const {
    teams, leaderboard, sections, sectionMeta, sectionScores,
    currentSection, currentQuestion, questionState,
    activeTeamId, activeAttempt, canUndo, remainingInSection,
  } = gameState

  useEffect(() => {
    const qText = currentQuestion?.question ?? null
    if (qText !== prevQuestionRef.current) {
      prevQuestionRef.current = qText
      setShowAnswer(false)
    }
  }, [currentQuestion])

  useEffect(() => {
    if (currentQuestion && questionState === 'active') setMobileTab('question')
  }, [currentQuestion?.question])

  const handleEndGame = () => {
    if (window.confirm('End the game and show final scores? This cannot be undone.')) {
      emit('game:end')
    }
  }

  const handleReset = () => {
    if (window.confirm('RESET the entire game? All scores will be permanently lost.')) {
      emit('game:reset')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-void">

      {/* ── Header ── */}
      <header className="header-border px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0 relative z-10 bg-void/90 backdrop-blur-sm">
        <div className="flex items-center gap-3 md:gap-4">
          <h1 className="font-display text-2xl md:text-3xl text-neon-cyan glow-cyan tracking-widest">
            Q-MANIA
          </h1>
          <div className="hidden sm:flex items-center gap-2">
            <div className="h-5 w-px bg-ghost/30" />
            <span className="font-mono text-ghost text-xs tracking-widest">HOST CONSOLE</span>
          </div>
          {currentSection && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded border border-white/10 bg-white/5">
              <span className="text-base">{getSectionMeta(currentSection).icon}</span>
              <span className="font-mono text-sm tracking-widest" style={{ color: getSectionMeta(currentSection).color }}>
                {getSectionMeta(currentSection).label.toUpperCase()}
              </span>
              <span className="font-mono text-xs text-ghost">· {remainingInSection} left</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => emit('action:undo')}
            disabled={!canUndo}
            className="btn btn-ghost btn-sm"
            style={{ width: 'auto' }}
            title={canUndo ? 'Undo last action' : 'No action to undo yet'}
          >
            ↩ UNDO
          </button>
          <button onClick={handleEndGame} className="btn btn-sm" style={{ width: 'auto', background: 'rgba(255,215,0,0.1)', borderColor: 'rgba(255,215,0,0.4)', color: '#ffd700' }}>
            🏁 END GAME
          </button>
          <button onClick={handleReset} className="btn btn-danger btn-sm" style={{ width: 'auto' }}>
            ⊗ RESET
          </button>
        </div>
      </header>

      {/* ── Mobile tabs ── */}
      <div className="md:hidden header-border panel-border-b flex flex-shrink-0 bg-void/90 backdrop-blur-sm">
        {[
          { key: 'sections',    label: 'Sections', icon: '⚡' },
          { key: 'question',    label: 'Question',  icon: '❓' },
          { key: 'leaderboard', label: 'Scores',    icon: '🏆' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setMobileTab(tab.key)}
            className={`flex-1 py-3 font-mono text-sm tracking-widest uppercase transition-all ${
              mobileTab === tab.key
                ? 'text-neon-cyan border-b-2 border-neon-cyan -mb-px'
                : 'text-ghost'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Main 3-panel layout ── */}
      <div className="flex flex-1 overflow-hidden relative z-10">

        {/* LEFT — Sections */}
        <aside className={`${mobileTab === 'sections' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-64 lg:w-72 panel-border-r flex-shrink-0 overflow-y-auto`}>
          <SectionsPanel
            sections={sections}
            sectionMeta={sectionMeta}
            sectionScores={sectionScores}
            currentSection={currentSection}
            remainingInSection={remainingInSection}
            questionState={questionState}
            onSelectSection={(s) => emit('section:select', { section: s })}
            onNextQuestion={() => emit('question:next')}
          />
        </aside>

        {/* CENTER — Question + Controls */}
        <main className={`${mobileTab === 'question' ? 'flex' : 'hidden'} md:flex flex-col flex-1 overflow-y-auto`}>
          <QuestionPanel
            currentQuestion={currentQuestion}
            questionState={questionState}
            currentSection={currentSection}
            showAnswer={showAnswer}
            onToggleAnswer={() => setShowAnswer(v => !v)}
            onSkip={() => emit('question:skip')}
            onEnd={() => emit('question:end')}
            onReset={() => emit('question:reset')}
          />
          <ControlPanel
            teams={teams}
            activeTeamId={activeTeamId}
            activeAttempt={activeAttempt}
            questionState={questionState}
            currentQuestion={currentQuestion}
            currentSection={currentSection}
            sectionScores={sectionScores}
            onStartAttempt={(teamId, attempt) => emit('attempt:start', { teamId, attempt })}
            onMarkScore={(result) => emit('score:mark', { result })}
            onManualScore={(teamId, points) => emit('score:manual', { teamId, points })}
            onEndQuestion={() => emit('question:end')}
            onSkipQuestion={() => emit('question:skip')}
            onNextQuestion={() => emit('question:next')}
            canUndo={canUndo}
            onUndo={() => emit('action:undo')}
          />
        </main>

        {/* RIGHT — Leaderboard */}
        <aside className={`${mobileTab === 'leaderboard' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 lg:w-80 panel-border-l flex-shrink-0 overflow-y-auto`}>
          <LeaderboardPanel teams={leaderboard} activeTeamId={activeTeamId} />
        </aside>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTIONS PANEL (LEFT)
// ═══════════════════════════════════════════════════════════════════════════════

function SectionsPanel({ sections, sectionMeta, sectionScores, currentSection, remainingInSection, questionState, onSelectSection, onNextQuestion }) {
  const isScoring = questionState === 'scoring'

  return (
    <div className="p-4 flex flex-col gap-4 h-full">

      <div className="flex items-center gap-2 mb-1">
        <div className="w-1 h-4 bg-neon-cyan rounded-full" style={{ boxShadow: '0 0 6px #00d4ff' }} />
        <h3 className="font-display text-xs text-ghost tracking-widest">SECTIONS</h3>
      </div>

      <div className="space-y-2">
        {sections.map(section => {
          const meta       = getSectionMeta(section)
          const meta2      = sectionMeta?.[section]
          const maxAllowed = meta2?.maxAllowed ?? '?'
          const asked      = meta2?.asked      ?? 0
          const remaining  = meta2?.remaining  ?? '?'
          const exhausted  = remaining === 0
          const isActive   = currentSection === section
          const scores     = sectionScores?.[section]

          return (
            <button
              key={section}
              disabled={isScoring}
              onClick={() => onSelectSection(section)}
              className={`section-btn ${isActive ? 'active' : ''} ${exhausted && !isActive ? 'opacity-40' : ''}`}
            >
              <span className="text-xl">{meta.icon}</span>
              <div className="flex-1 text-left">
                <div className="text-sm tracking-widest">{meta.label.toUpperCase()}</div>
                {scores && (
                  <div className="font-mono text-xs mt-0.5" style={{ color: `${meta.color}80` }}>
                    +{scores.correct} / {scores.wrong}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className={`font-display text-sm ${isActive ? 'text-neon-cyan' : 'text-ghost/60'}`}>
                  {asked}/{maxAllowed}
                </div>
                <div className="font-mono text-xs text-ghost/40">asked</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Q count formula info */}
      <div className="card-sm p-3 text-center">
        <div className="font-mono text-ghost/50 text-xs leading-relaxed">
          Phy/SciFi: ceil(1.7 × teams)<br />
          Puzzles: ceil(0.6 × teams)
        </div>
      </div>

      <div className="mt-auto space-y-3">
        {currentSection ? (
          <>
            <div className="card-sm p-4 text-center">
              <div className="font-mono text-xs text-ghost mb-1">REMAINING</div>
              <div className="font-display text-4xl" style={{ color: getSectionMeta(currentSection).color }}>
                {remainingInSection}
              </div>
              <div className="font-mono text-xs text-ghost">questions left</div>
            </div>
            <button
              onClick={onNextQuestion}
              disabled={isScoring || remainingInSection === 0}
              className="btn btn-primary py-4 text-base"
            >
              ▶ NEXT QUESTION
            </button>
            {isScoring && (
              <p className="font-mono text-ghost/50 text-xs text-center">
                Finish current attempt first
              </p>
            )}
            {remainingInSection === 0 && !isScoring && (
              <p className="font-mono text-neon-orange/70 text-xs text-center">
                Section complete
              </p>
            )}
          </>
        ) : (
          <p className="text-ghost text-sm font-mono text-center leading-relaxed">
            ↑ Select a section<br />to begin
          </p>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUESTION PANEL (CENTER TOP)
// ═══════════════════════════════════════════════════════════════════════════════

function QuestionPanel({ currentQuestion, questionState, currentSection, showAnswer, onToggleAnswer, onSkip, onEnd, onReset }) {
  if (!currentQuestion) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-64">
        <div className="text-8xl mb-6 opacity-10 select-none">❓</div>
        <h3 className="font-display text-base text-ghost tracking-widest mb-3">
          {currentSection ? 'READY TO DRAW' : 'SELECT A SECTION'}
        </h3>
        <p className="font-mono text-ghost/60 text-sm">
          {currentSection
            ? 'Click NEXT QUESTION in the left panel'
            : 'Choose a section from the left panel to begin'}
        </p>
      </div>
    )
  }

  const meta      = getSectionMeta(currentSection)
  const isDone    = questionState === 'done'
  const isScoring = questionState === 'scoring'

  return (
    <div className="p-4 md:p-6">

      {/* Question card */}
      <div className={`card p-5 md:p-7 mb-4 question-enter ${isDone ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{meta.icon}</span>
            <div>
              <span className="font-mono text-sm tracking-widest" style={{ color: meta.color }}>
                {meta.label.toUpperCase()}
              </span>
              {isDone && <span className="font-mono text-xs text-ghost/50 tracking-widest ml-2">[CLOSED]</span>}
              {isScoring && <span className="font-mono text-xs text-neon-orange tracking-widest ml-2 animate-pulse">[SCORING]</span>}
            </div>
          </div>
          <div
            className="px-4 py-1.5 rounded-full border font-mono text-sm font-semibold"
            style={{ borderColor: `${meta.color}50`, color: meta.color, background: `${meta.color}10` }}
          >
            +{currentQuestion.marks} pts
          </div>
        </div>

        {/* Big question text — projector friendly */}
        <p className="font-body text-2xl md:text-3xl text-frost leading-relaxed font-semibold mb-5">
          {currentQuestion.question}
        </p>

        {currentQuestion.hint && (
          <div className="flex items-start gap-2 pt-4 border-t border-white/5">
            <span className="text-lg flex-shrink-0">💡</span>
            <p className="font-mono text-ghost text-sm leading-relaxed italic">
              {currentQuestion.hint}
            </p>
          </div>
        )}
      </div>

      {/* Scoring reference chips */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card-sm p-3 flex items-center gap-3">
          <span className="font-mono text-xs text-ghost/60">CORRECT</span>
          <span className="font-display text-lg text-neon-green ml-auto">+{currentQuestion.marks}</span>
        </div>
        <div className="card-sm p-3 flex items-center gap-3">
          <span className="font-mono text-xs text-ghost/60">WRONG</span>
          <span className="font-display text-lg text-neon-red ml-auto">−{currentQuestion.wrongPenalty}</span>
        </div>
      </div>

      {/* Answer reveal */}
      <div className="card mb-4 overflow-hidden">
        <button
          onClick={onToggleAnswer}
          className="w-full flex items-center justify-between px-5 py-4 font-mono text-sm text-ghost hover:text-frost transition-colors tracking-widest"
        >
          <span>ANSWER</span>
          <span className="text-neon-cyan font-semibold">{showAnswer ? '▲ HIDE' : '▼ REVEAL ANSWER'}</span>
        </button>
        {showAnswer && (
          <div className="px-5 pb-5 border-t border-white/5">
            <p className="font-body text-2xl md:text-2xl text-neon-green glow-green leading-relaxed font-semibold mt-4">
              {currentQuestion.answer}
            </p>
          </div>
        )}
      </div>

      {/* Quick flow buttons */}
      <div className="flex gap-2">
        <button
          onClick={onEnd}
          disabled={isScoring || isDone}
          className="btn btn-sm flex-1"
          style={{ width: 'auto', background: 'rgba(57,255,20,0.08)', borderColor: 'rgba(57,255,20,0.3)', color: isDone ? '#4a5580' : '#39ff14' }}
        >
          ✓ END QUESTION
        </button>
        <button
          onClick={onSkip}
          disabled={isScoring || isDone}
          className="btn btn-ghost btn-sm flex-1"
          style={{ width: 'auto' }}
        >
          ⏭ SKIP
        </button>
        <button
          onClick={onReset}
          disabled={isScoring}
          className="btn btn-ghost btn-sm"
          style={{ width: 'auto' }}
        >
          ↺ RESET
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROL PANEL (CENTER BOTTOM) — THE HEART OF MANUAL CONTROL
// ═══════════════════════════════════════════════════════════════════════════════

function ControlPanel({
  teams, activeTeamId, activeAttempt, questionState,
  currentQuestion, currentSection, sectionScores,
  onStartAttempt, onMarkScore, onManualScore,
  onEndQuestion, onSkipQuestion, onNextQuestion,
  canUndo, onUndo,
}) {
  const [manualTeam, setManualTeam] = useState('')
  const [manualPts,  setManualPts]  = useState('')
  const [manualErr,  setManualErr]  = useState('')

  const isScoring = questionState === 'scoring'
  const isDone    = questionState === 'done'
  const isActive  = questionState === 'active'
  const noQ       = !currentQuestion || questionState === 'idle'

  const scores     = sectionScores?.[currentSection] ?? { correct: 40, wrong: -10 }
  const activeTeam = teams.find(t => t.id === activeTeamId)

  const handleManual = () => {
    setManualErr('')
    if (!manualTeam) { setManualErr('Select a team'); return }
    const pts = parseInt(manualPts, 10)
    if (isNaN(pts))  { setManualErr('Enter a valid number'); return }
    if (pts === 0)   { setManualErr('Points cannot be zero'); return }
    onManualScore(manualTeam, pts)
    setManualPts('')
    setManualTeam('')
  }

  if (noQ) {
    return (
      <div className="panel-border-t p-4 md:p-6 flex-shrink-0 bg-void/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-neon-orange rounded-full" style={{ boxShadow: '0 0 6px #ff6b35' }} />
            <h3 className="font-display text-xs text-ghost tracking-widest">HOST CONTROLS</h3>
          </div>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="btn btn-ghost btn-sm"
            style={{ width: 'auto' }}
            title={canUndo ? 'Undo last action' : 'No action to undo yet'}
          >
            ↩ UNDO
          </button>
        </div>
        <ManualAdjust
          teams={teams} manualTeam={manualTeam} manualPts={manualPts} manualErr={manualErr}
          setManualTeam={v => { setManualTeam(v); setManualErr('') }}
          setManualPts={v => { setManualPts(v); setManualErr('') }}
          onApply={handleManual}
        />
      </div>
    )
  }

  return (
    <div className="panel-border-t p-4 md:p-6 flex-shrink-0 bg-void/50">

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-neon-orange rounded-full" style={{ boxShadow: '0 0 6px #ff6b35' }} />
          <h3 className="font-display text-sm text-ghost tracking-widest">HOST CONTROLS</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="btn btn-ghost btn-sm"
            style={{ width: 'auto' }}
            title={canUndo ? 'Undo last action' : 'No action to undo yet'}
          >
            ↩ UNDO
          </button>
        </div>
      </div>

      {/* ── ACTIVE SCORING MODE ── */}
      {isScoring && activeTeam && (
        <div className="card card-glow-cyan p-5 mb-5 scoring-panel">
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0 animate-pulse"
              style={{ backgroundColor: activeTeam.color, boxShadow: `0 0 14px ${activeTeam.color}` }}
            />
            <div className="flex-1">
              <div className="font-body text-xl font-semibold" style={{ color: activeTeam.color }}>
                {activeTeam.name}
              </div>
              <div className="font-mono text-xs text-ghost mt-0.5">
                Attempt {activeAttempt}  ·  Correct: +{scores.correct}  ·  Wrong: {scores.wrong}
              </div>
            </div>
            <div className="font-display text-2xl" style={{ color: activeTeam.color }}>
              {activeTeam.score}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => onMarkScore('correct')}
              className="btn btn-success py-5 text-lg"
            >
              ✓ CORRECT<br />
              <span className="text-sm opacity-70">+{scores.correct} pts</span>
            </button>
            <button
              onClick={() => onMarkScore('wrong')}
              className="btn btn-danger py-5 text-lg"
            >
              ✗ WRONG<br />
              <span className="text-sm opacity-70">{scores.wrong} pts</span>
            </button>
          </div>
        </div>
      )}

      {/* ── TEAM ATTEMPT ROWS ── */}
      {!isScoring && (
        <div className="mb-5">
          <div className="font-mono text-xs text-ghost/60 tracking-widest mb-3">
            SELECT TEAM → START ATTEMPT
          </div>
          {isDone && (
            <div className="font-mono text-xs text-ghost/40 text-center py-2 tracking-widest mb-2">
              — QUESTION CLOSED —
            </div>
          )}
          <div className="space-y-2">
            {teams.map(team => (
              <TeamAttemptRow
                key={team.id}
                team={team}
                questionDone={isDone}
                onStartAttempt={onStartAttempt}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── FLOW CONTROL BUTTONS ── */}
      {!isScoring && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <button
            onClick={onEndQuestion}
            disabled={isDone}
            className="btn btn-sm py-3"
            style={{
              width: 'auto',
              background: 'rgba(57,255,20,0.08)',
              borderColor: isDone ? 'rgba(57,255,20,0.1)' : 'rgba(57,255,20,0.35)',
              color: isDone ? '#4a5580' : '#39ff14',
            }}
          >
            ✓ END<br/>QUESTION
          </button>
          <button
            onClick={onSkipQuestion}
            disabled={isDone}
            className="btn btn-ghost btn-sm py-3"
            style={{ width: 'auto' }}
          >
            ⏭ SKIP<br/>QUESTION
          </button>
          <button
            onClick={onNextQuestion}
            disabled={!currentSection}
            className="btn btn-primary btn-sm py-3"
            style={{ width: 'auto' }}
          >
            ▶ NEXT<br/>QUESTION
          </button>
        </div>
      )}

      {/* ── MANUAL ADJUSTMENT ── */}
      <div className="panel-border-t pt-4">
        <ManualAdjust
          teams={teams} manualTeam={manualTeam} manualPts={manualPts} manualErr={manualErr}
          setManualTeam={v => { setManualTeam(v); setManualErr('') }}
          setManualPts={v => { setManualPts(v); setManualErr('') }}
          onApply={handleManual}
        />
      </div>
    </div>
  )
}

/** Reusable manual score adjustment row */
function ManualAdjust({ teams, manualTeam, manualPts, manualErr, setManualTeam, setManualPts, onApply }) {
  return (
    <div>
      <div className="font-mono text-xs text-ghost/60 tracking-widest mb-3">
        MANUAL ADJUSTMENT (OVERRIDE)
      </div>
      <div className="flex gap-2">
        <select
          value={manualTeam}
          onChange={e => setManualTeam(e.target.value)}
          className="input-field flex-1 text-sm"
        >
          <option value="">Select team...</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input
          type="number"
          value={manualPts}
          onChange={e => setManualPts(e.target.value)}
          placeholder="±pts"
          className="input-field w-24 text-sm"
          onKeyDown={e => e.key === 'Enter' && onApply()}
        />
        <button
          onClick={onApply}
          className="btn btn-ghost btn-sm px-5 whitespace-nowrap"
          style={{ width: 'auto' }}
        >
          APPLY
        </button>
      </div>
      {manualErr && <p className="text-neon-red text-sm font-mono mt-2">{manualErr}</p>}
      <p className="font-mono text-ghost/30 text-xs mt-2">
        Use negative numbers to deduct. No validation — full host override.
      </p>
    </div>
  )
}

/** Single team row with Attempt 1 / Attempt 2 buttons */
function TeamAttemptRow({ team, questionDone, onStartAttempt }) {
  const att1Done   = team.att1Scored
  const att2Done   = team.att2Scored
  const att1Result = team.att1Result
  const att2Result = team.att2Result

  return (
    <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: team.color, boxShadow: `0 0 6px ${team.color}88` }}
      />
      <span
        className="font-mono text-sm flex-1 truncate min-w-0 font-medium"
        style={{ color: team.color }}
        title={team.name}
      >
        {team.name}
      </span>
      <span className="font-display text-sm text-ghost/70 mr-2">{team.score}</span>

      {/* Attempt 1 */}
      <div className="flex items-center gap-1">
        {att1Done ? (
          <span className={`result-badge ${att1Result === 'correct' ? 'result-badge-correct' : 'result-badge-wrong'} text-xs px-2 py-1`}>
            ATT1 {att1Result === 'correct' ? '✓' : '✗'}
          </span>
        ) : (
          <button
            className="attempt-btn attempt-btn-1 text-sm px-3 py-1.5"
            onClick={() => !questionDone && onStartAttempt(team.id, 1)}
            disabled={questionDone}
          >
            ATT 1
          </button>
        )}
      </div>

      {/* Attempt 2 */}
      <div className="flex items-center gap-1">
        {att2Done ? (
          <span className={`result-badge ${att2Result === 'correct' ? 'result-badge-correct' : 'result-badge-wrong'} text-xs px-2 py-1`}>
            ATT2 {att2Result === 'correct' ? '✓' : '✗'}
          </span>
        ) : (
          <button
            className="attempt-btn attempt-btn-2 text-sm px-3 py-1.5"
            onClick={() => !questionDone && onStartAttempt(team.id, 2)}
            disabled={questionDone}
          >
            ATT 2
          </button>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD PANEL (RIGHT)
// ═══════════════════════════════════════════════════════════════════════════════

function LeaderboardPanel({ teams, activeTeamId }) {
  const scores   = teams.map(t => t.score)
  const maxScore = scores.length ? Math.max(...scores) : 1
  const minFloor = Math.min(...scores, 0)
  const range    = Math.max(maxScore - minFloor, 1)

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-1 h-4 bg-neon-gold rounded-full" style={{ boxShadow: '0 0 6px #ffd700' }} />
        <h3 className="font-display text-xs text-ghost tracking-widest">LIVE LEADERBOARD</h3>
      </div>

      <div className="space-y-2 flex-1">
        {teams.map((team, i) => {
          const isActive = team.id === activeTeamId
          const barWidth = Math.max(0, ((team.score - minFloor) / range) * 100)

          return (
            <div
              key={team.id}
              className={`lb-item ${isActive ? 'active-team' : ''}`}
              style={isActive ? { '--team-color': team.color } : {}}
            >
              <div className="flex items-center gap-2">
                <span className="text-base w-7 flex-shrink-0 text-center">
                  {i < 3
                    ? RANK_ICONS[i]
                    : <span className="font-mono text-ghost text-xs">{i + 1}</span>
                  }
                </span>
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: team.color, boxShadow: `0 0 6px ${team.color}88` }}
                />
                <span
                  className="font-mono text-sm flex-1 truncate"
                  style={{ color: isActive ? team.color : undefined }}
                  title={team.name}
                >
                  {team.name}
                </span>
                <span
                  className={`font-display text-xl flex-shrink-0 ${isActive ? 'animate-score-pop' : ''}`}
                  style={{
                    color: team.color,
                    textShadow: isActive ? `0 0 12px ${team.color}` : undefined,
                  }}
                >
                  {team.score}
                </span>
              </div>
              <div className="score-bar mt-2">
                <div
                  className="score-bar-fill"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: team.color,
                    boxShadow: `0 0 6px ${team.color}88`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {teams.length > 0 && (
        <div className="mt-4 pt-4 panel-border-t grid grid-cols-2 gap-3">
          <div className="card-sm p-3 text-center">
            <div className="font-mono text-ghost text-xs mb-1">LEADER</div>
            <div className="font-display text-neon-gold text-sm truncate" title={teams[0]?.name}>
              {teams[0]?.name ?? '—'}
            </div>
          </div>
          <div className="card-sm p-3 text-center">
            <div className="font-mono text-ghost text-xs mb-1">TOP SCORE</div>
            <div className="font-display text-neon-gold text-xl">{teams[0]?.score ?? 0}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// END GAME SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

function EndGameScreen({ gameState, onReset }) {
  const { leaderboard, endWarnings } = gameState
  const winner = leaderboard[0]

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5"
           style={{ background: 'radial-gradient(ellipse at center, #ffd700 0%, transparent 60%)' }} />

      {/* Header */}
      <div className="text-center mb-10 mt-8 relative z-10">
        <div className="text-6xl mb-4">🏆</div>
        <h1 className="font-display text-5xl md:text-6xl tracking-widest text-neon-gold mb-2"
            style={{ textShadow: '0 0 30px rgba(255,215,0,0.6), 0 0 60px rgba(255,215,0,0.3)' }}>
          Q-MANIA
        </h1>
        <div className="font-display text-xl tracking-widest text-frost/70 mb-4">
          FINAL SCORES
        </div>
        {winner && (
          <div
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full border"
            style={{ borderColor: `${winner.color}50`, background: `${winner.color}10` }}
          >
            <span className="text-2xl">🥇</span>
            <span className="font-display text-xl" style={{ color: winner.color, textShadow: `0 0 15px ${winner.color}` }}>
              {winner.name}
            </span>
            <span className="font-display text-2xl text-neon-gold">{winner.score}</span>
          </div>
        )}
      </div>

      <div className="w-full max-w-2xl relative z-10 space-y-4 mb-8">

        {/* Full leaderboard */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-5 bg-neon-gold rounded-full" style={{ boxShadow: '0 0 6px #ffd700' }} />
            <h2 className="font-display text-sm tracking-widest text-ghost">FINAL STANDINGS</h2>
          </div>
          <div className="space-y-3">
            {leaderboard.map((team, i) => (
              <div
                key={team.id}
                className="flex items-center gap-4 p-4 rounded-lg border"
                style={{
                  borderColor: i === 0 ? `${team.color}50` : 'rgba(255,255,255,0.06)',
                  background:  i === 0 ? `${team.color}08` : 'rgba(13,13,36,0.4)',
                }}
              >
                <span className="text-2xl w-8 text-center">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (
                    <span className="font-mono text-ghost text-base">{i + 1}</span>
                  )}
                </span>
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: team.color, boxShadow: `0 0 8px ${team.color}` }}
                />
                <span className="font-body text-xl flex-1 font-semibold" style={{ color: i === 0 ? team.color : undefined }}>
                  {team.name}
                </span>
                <span className="font-display text-3xl" style={{ color: team.color, textShadow: `0 0 10px ${team.color}88` }}>
                  {team.score}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* End-game warnings */}
        {endWarnings && endWarnings.length > 0 && (
          <div className="card p-6 border-neon-orange/30" style={{ borderColor: 'rgba(255,107,53,0.3)' }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">⚠️</span>
              <h2 className="font-display text-sm tracking-widest text-neon-orange">
                SECTION ATTEMPT WARNINGS
              </h2>
            </div>
            <p className="font-mono text-ghost/60 text-xs mb-4">
              The following teams did not answer any question in these sections.
              No penalty has been applied — host decision only.
            </p>
            <div className="space-y-4">
              {endWarnings.map(w => (
                <div key={w.section}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{getSectionMeta(w.section).icon}</span>
                    <span className="font-mono text-sm tracking-widest" style={{ color: getSectionMeta(w.section).color }}>
                      {w.label.toUpperCase()}
                    </span>
                    <span className="font-mono text-xs text-ghost">— no attempts from:</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-7">
                    {w.missed.map(t => (
                      <span
                        key={t.id}
                        className="font-mono text-sm px-3 py-1 rounded border"
                        style={{ borderColor: `${t.color}40`, color: t.color, background: `${t.color}0d` }}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {endWarnings && endWarnings.length === 0 && (
          <div
            className="card p-4 text-center"
            style={{ borderColor: 'rgba(57,255,20,0.25)' }}
          >
            <span className="text-xl">✅</span>
            <p className="font-mono text-neon-green text-sm mt-2">All teams attempted all mandatory sections.</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4 relative z-10 pb-8">
        <button
          onClick={onReset}
          className="btn btn-danger px-10 py-4 text-base"
          style={{ width: 'auto' }}
        >
          ↺ PLAY AGAIN
        </button>
      </div>
    </div>
  )
}