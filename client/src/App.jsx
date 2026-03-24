import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'

// ─── Constants ──────────────────────────────────────────────────────────────

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'
const MAX_TEAMS  = 8   // must match server/gameState.js

const SECTION_META = {
  physics: { icon: '⚛', label: 'Physics', color: '#00d4ff' },
  sciFi:   { icon: '🚀', label: 'Sci-Fi',  color: '#a855f7' },
  puzzles: { icon: '🧩', label: 'Puzzles', color: '#ffd700' },
}

const getSectionMeta = (s) =>
  SECTION_META[s] ?? { icon: '◈', label: s?.toUpperCase() ?? '', color: '#00d4ff' }

const RANK_ICONS = ['🥇', '🥈', '🥉']

// ─── Root App ────────────────────────────────────────────────────────────────

export default function App() {
  const [gameState, setGameState] = useState(null)
  const [connected, setConnected] = useState(false)
  const [error, setError]         = useState(null)
  const socketRef                 = useRef(null)

  useEffect(() => {
    const socket = io(SERVER_URL, { reconnectionAttempts: Infinity })
    socketRef.current = socket
    socket.on('connect',    ()      => setConnected(true))
    socket.on('disconnect', ()      => setConnected(false))
    socket.on('state',      (state) => setGameState(state))
    socket.on('error',      ({ message }) => {
      setError(message)
      setTimeout(() => setError(null), 4000)
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
        <h1 className="font-display text-3xl text-neon-cyan glow-cyan tracking-widest">Q-MANIA</h1>
        <p className="font-mono text-ghost text-sm tracking-widest animate-pulse">
          {connected ? 'LOADING STATE...' : 'CONNECTING TO SERVER...'}
        </p>
        {!connected && (
          <p className="font-mono text-ghost text-xs mt-2">
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
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-900/80 border-b border-yellow-500/40 text-yellow-300 text-center py-1.5 text-xs font-mono tracking-widest">
          ⚡ CONNECTION LOST — RECONNECTING...
        </div>
      )}

      {error && (
        <div className="fixed top-4 right-4 z-50 card border border-neon-red/40 bg-red-950/90 text-neon-red px-4 py-3 text-sm font-mono max-w-xs animate-slide-in">
          ⚠ {error}
        </div>
      )}

      {gameState.phase === 'setup' ? (
        <TeamSetup onStart={(teams) => emit('setup:teams', { teams })} />
      ) : (
        <Dashboard gameState={gameState} emit={emit} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM SETUP
// ═══════════════════════════════════════════════════════════════════════════════

const TEAM_COLORS = [
  '#00d4ff', '#ff6b35', '#39ff14', '#ff2244',
  '#ffd700', '#a855f7', '#ec4899', '#10b981',
]

// BUG FIX #1 helper: generate a stable uid for each team slot
let _uid = 0
const makeTeam = (name = '') => ({ uid: ++_uid, name })

function TeamSetup({ onStart }) {
  // BUG FIX #1: use objects with stable uid as keys, NOT array index
  const [teams, setTeams]   = useState([makeTeam(), makeTeam()])
  const [error, setError]   = useState('')

  // BUG FIX #2: use a refs array for input focus navigation
  const inputRefs = useRef([])

  const addTeam = () => {
    if (teams.length >= MAX_TEAMS) return
    setTeams(prev => [...prev, makeTeam()])
    // Focus the new input on next tick
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
    if (names.length < 2)                      { setError('Add at least 2 team names'); return }
    if (new Set(names).size < names.length)    { setError('Team names must be unique'); return }
    setError('')
    onStart(names)
  }

  // BUG FIX #2: Enter key uses ref array, not document.querySelectorAll
  const handleKeyDown = (e, idx) => {
    if (e.key !== 'Enter') return
    if (idx < teams.length - 1) {
      inputRefs.current[idx + 1]?.focus()
    } else {
      handleStart()
    }
  }

  const namedCount = teams.filter(t => t.name.trim()).length

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-5"
           style={{ background: 'radial-gradient(circle, #00d4ff, transparent)', filter: 'blur(80px)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-5"
           style={{ background: 'radial-gradient(circle, #a855f7, transparent)', filter: 'blur(80px)' }} />

      <div className="relative z-10 w-full max-w-md">

        <div className="text-center mb-12">
          <div className="relative inline-block">
            <h1 className="font-display text-6xl sm:text-7xl tracking-widest text-neon-cyan glow-cyan mb-3">
              Q-MANIA
            </h1>
            <div className="h-px bg-gradient-to-r from-transparent via-neon-cyan to-transparent opacity-50" />
          </div>
          <p className="font-mono text-ghost text-xs tracking-[0.4em] uppercase mt-4">
            Live Quiz Dashboard · Host Console
          </p>
        </div>

        <div className="card p-8">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-1 h-6 bg-neon-cyan rounded-full" style={{ boxShadow: '0 0 8px #00d4ff' }} />
            <h2 className="font-display text-sm text-frost tracking-widest">CONFIGURE TEAMS</h2>
          </div>

          <div className="space-y-3 mb-5">
            {teams.map((team, i) => (
              // BUG FIX #1: key is stable uid, not array index
              <div key={team.uid} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: TEAM_COLORS[i],
                    boxShadow: `0 0 10px ${TEAM_COLORS[i]}88`,
                  }}
                />
                <input
                  // BUG FIX #2: attach ref by index
                  ref={el => { inputRefs.current[i] = el }}
                  className="input-field flex-1"
                  value={team.name}
                  onChange={e => updateName(team.uid, e.target.value)}
                  placeholder={`Team ${i + 1} name`}
                  maxLength={24}
                  onKeyDown={e => handleKeyDown(e, i)}
                />
                {teams.length > 2 && (
                  <button
                    onClick={() => removeTeam(team.uid)}
                    className="text-ghost hover:text-neon-red transition-colors w-5 text-sm flex-shrink-0"
                    aria-label="Remove team"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {teams.length < MAX_TEAMS ? (
            <button onClick={addTeam} className="btn-ghost mb-5 text-xs">
              + ADD TEAM ({teams.length}/{MAX_TEAMS})
            </button>
          ) : (
            <p className="font-mono text-ghost/50 text-xs mb-5 text-center">
              Maximum {MAX_TEAMS} teams reached
            </p>
          )}

          {error && (
            <p className="text-neon-red text-sm font-mono mb-4 flex items-center gap-2">
              <span>⚠</span> {error}
            </p>
          )}

          <button onClick={handleStart} className="btn-primary text-sm py-3">
            ◈ LAUNCH GAME
          </button>

          <p className="text-ghost text-xs font-mono text-center mt-5">
            {namedCount} / {teams.length} teams named
          </p>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function Dashboard({ gameState, emit }) {
  const [mobileTab, setMobileTab]   = useState('question')
  const [showAnswer, setShowAnswer] = useState(false)
  const prevQuestionRef             = useRef(null)

  const {
    teams, leaderboard, sections, sectionMeta,
    currentSection, currentQuestion, questionState,
    activeTeamId, activeAttempt, canUndo, remainingInSection,
  } = gameState

  // Reset answer reveal on new question
  useEffect(() => {
    const qText = currentQuestion?.question ?? null
    if (qText !== prevQuestionRef.current) {
      prevQuestionRef.current = qText
      setShowAnswer(false)
    }
  }, [currentQuestion])

  // BUG FIX #4: auto-switch mobile tab to 'question' when a new question is drawn
  useEffect(() => {
    if (currentQuestion && questionState === 'active') {
      setMobileTab('question')
    }
  }, [currentQuestion?.question])   // only fire when question text changes

  const handleReset = () => {
    if (window.confirm('Reset the entire game? All scores will be lost.')) {
      emit('game:reset')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-void">
      {/* ── Header ── */}
      <header className="header-border px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0 relative z-10 bg-void/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 md:gap-4">
          <h1 className="font-display text-xl md:text-2xl text-neon-cyan glow-cyan tracking-widest">
            Q-MANIA
          </h1>
          <div className="hidden sm:flex items-center gap-2">
            <div className="h-4 w-px bg-ghost/30" />
            <span className="font-mono text-ghost text-xs tracking-widest">HOST CONSOLE</span>
          </div>
          {currentSection && (
            <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded border border-neon-cyan/15 bg-neon-cyan/5">
              <span className="text-sm">{getSectionMeta(currentSection).icon}</span>
              <span className="font-mono text-xs text-neon-cyan tracking-widest">
                {getSectionMeta(currentSection).label}
              </span>
              <span className="font-mono text-xs text-ghost">· {remainingInSection} left</span>
            </div>
          )}
        </div>

        {/* BUG FIX #5: add style width:auto so btn-ghost doesn't stretch to 100% in flex */}
        <div className="flex items-center gap-2">
          {canUndo && (
            <button
              onClick={() => emit('action:undo')}
              className="btn-ghost btn-sm"
              style={{ width: 'auto' }}
            >
              ↩ UNDO
            </button>
          )}
          <button
            onClick={handleReset}
            className="btn-danger btn-sm"
            style={{ width: 'auto' }}
          >
            ⊗ RESET
          </button>
        </div>
      </header>

      {/* ── Mobile tab bar ── */}
      <div className="md:hidden header-border panel-border-b flex flex-shrink-0 bg-void/90 backdrop-blur-sm">
        {[
          { key: 'sections',    label: 'Sections', icon: '⚡' },
          { key: 'question',    label: 'Question',  icon: '❓' },
          { key: 'leaderboard', label: 'Board',     icon: '🏆' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setMobileTab(tab.key)}
            className={`flex-1 py-2.5 font-mono text-xs tracking-widest uppercase transition-all ${
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

        <aside className={`${mobileTab === 'sections' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-64 lg:w-72 panel-border-r flex-shrink-0 overflow-y-auto`}>
          <SectionsPanel
            sections={sections}
            sectionMeta={sectionMeta}
            currentSection={currentSection}
            remainingInSection={remainingInSection}
            questionState={questionState}
            onSelectSection={(s) => emit('section:select', { section: s })}
            onNextQuestion={() => emit('question:next')}
          />
        </aside>

        <main className={`${mobileTab === 'question' ? 'flex' : 'hidden'} md:flex flex-col flex-1 overflow-y-auto`}>
          <QuestionPanel
            currentQuestion={currentQuestion}
            questionState={questionState}
            currentSection={currentSection}
            showAnswer={showAnswer}
            onToggleAnswer={() => setShowAnswer(v => !v)}
            onSkip={() => emit('question:skip')}
            onReset={() => emit('question:reset')}
          />
          <ControlPanel
            teams={teams}
            activeTeamId={activeTeamId}
            activeAttempt={activeAttempt}
            questionState={questionState}
            currentQuestion={currentQuestion}
            onStartAttempt={(teamId, attempt) => emit('attempt:start', { teamId, attempt })}
            onMarkScore={(result) => emit('score:mark', { result })}
            onManualScore={(teamId, points) => emit('score:manual', { teamId, points })}
          />
        </main>

        <aside className={`${mobileTab === 'leaderboard' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 lg:w-80 panel-border-l flex-shrink-0 overflow-y-auto`}>
          <LeaderboardPanel teams={leaderboard} activeTeamId={activeTeamId} />
        </aside>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTIONS PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function SectionsPanel({ sections, sectionMeta, currentSection, remainingInSection, questionState, onSelectSection, onNextQuestion }) {
  const isScoring = questionState === 'scoring'

  return (
    <div className="p-4 flex flex-col gap-4 h-full">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 bg-neon-cyan rounded-full" style={{ boxShadow: '0 0 6px #00d4ff' }} />
          <h3 className="font-display text-xs text-ghost tracking-widest">SECTIONS</h3>
        </div>

        <div className="space-y-2">
          {sections.map(section => {
            const meta      = getSectionMeta(section)
            const remaining = sectionMeta?.[section]?.remaining ?? '?'
            const total     = sectionMeta?.[section]?.total ?? '?'
            const exhausted = remaining === 0
            const isActive  = currentSection === section

            return (
              <button
                key={section}
                // BUG FIX: disable section switch when scoring
                disabled={isScoring}
                onClick={() => onSelectSection(section)}
                className={`section-btn ${isActive ? 'active' : ''} ${exhausted && !isActive ? 'opacity-40' : ''} ${isScoring && !isActive ? 'cursor-not-allowed' : ''}`}
              >
                <span className="text-base">{meta.icon}</span>
                <span className="flex-1 text-left">{meta.label.toUpperCase()}</span>
                <span className={`text-xs ${isActive ? 'text-neon-cyan/60' : 'text-ghost/50'}`}>
                  {remaining}/{total}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-auto">
        {currentSection && (
          <>
            <div className="card-sm p-3 mb-3 text-center">
              <div className="font-mono text-xs text-ghost mb-1">REMAINING</div>
              <div className="font-display text-2xl" style={{ color: getSectionMeta(currentSection).color }}>
                {remainingInSection}
              </div>
              <div className="font-mono text-xs text-ghost">questions</div>
            </div>
            <button
              onClick={onNextQuestion}
              disabled={isScoring || remainingInSection === 0}
              className="btn-primary py-3"
              data-tip={isScoring ? 'Finish current attempt first' : undefined}
            >
              ▶ NEXT QUESTION
            </button>
            {isScoring && (
              <p className="font-mono text-ghost/50 text-xs text-center mt-2">
                Finish attempt to continue
              </p>
            )}
          </>
        )}
        {!currentSection && (
          <p className="text-ghost text-xs font-mono text-center leading-relaxed">
            ↑ Select a section<br />to begin
          </p>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUESTION PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function QuestionPanel({ currentQuestion, questionState, currentSection, showAnswer, onToggleAnswer, onSkip, onReset }) {
  if (!currentQuestion) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="text-7xl mb-6 opacity-10 select-none">❓</div>
        <h3 className="font-display text-sm text-ghost tracking-widest mb-2">
          {currentSection ? 'READY' : 'NO SECTION SELECTED'}
        </h3>
        <p className="font-mono text-ghost/60 text-xs">
          {currentSection
            ? 'Click NEXT QUESTION to draw a random question from the pool'
            : 'Choose a section from the left panel to begin'}
        </p>
      </div>
    )
  }

  const meta      = getSectionMeta(currentSection)
  const baseMarks = currentQuestion.marks ?? 10
  const isDone    = questionState === 'done'
  const isScoring = questionState === 'scoring'

  return (
    <div className="p-4 md:p-6 flex-1">

      <div className={`card p-5 md:p-6 mb-4 question-enter ${isDone ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">{meta.icon}</span>
            <span className="font-mono text-xs tracking-widest" style={{ color: meta.color }}>
              {meta.label.toUpperCase()}
            </span>
            {isDone && <span className="font-mono text-xs text-ghost/50 tracking-widest ml-1">[DONE]</span>}
            {isScoring && <span className="font-mono text-xs text-neon-orange/70 tracking-widest ml-1 animate-pulse">[SCORING]</span>}
          </div>
          <div
            className="px-3 py-1 rounded-full border font-mono text-xs"
            style={{ borderColor: `${meta.color}40`, color: meta.color, background: `${meta.color}0d` }}
          >
            {baseMarks} pts
          </div>
        </div>

        <p className="font-body text-lg md:text-xl text-frost leading-relaxed font-medium mb-4">
          {currentQuestion.question}
        </p>

        {currentQuestion.hint && (
          <div className="flex items-start gap-2 pt-3 border-t border-white/5">
            <span className="text-sm">💡</span>
            <p className="font-mono text-ghost text-xs leading-relaxed italic">
              {currentQuestion.hint}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card-sm p-3">
          <div className="font-mono text-ghost text-xs mb-2">ATTEMPT 1</div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-neon-green">✓ +{baseMarks}</span>
            <span className="font-mono text-xs text-neon-red">✗ −{Math.floor(baseMarks / 4)}</span>
          </div>
        </div>
        <div className="card-sm p-3">
          <div className="font-mono text-ghost text-xs mb-2">ATTEMPT 2</div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-neon-cyan">✓ +{Math.floor(baseMarks / 2)}</span>
            <span className="font-mono text-xs text-ghost">✗  0</span>
          </div>
        </div>
      </div>

      <div className="card mb-4 overflow-hidden">
        <button
          onClick={onToggleAnswer}
          className="w-full flex items-center justify-between px-4 py-3 font-mono text-xs text-ghost hover:text-frost transition-colors tracking-widest"
        >
          <span>ANSWER</span>
          <span className="text-neon-cyan">{showAnswer ? '▲ HIDE' : '▼ REVEAL'}</span>
        </button>
        {showAnswer && (
          <div className="px-4 pb-4 pt-0 border-t border-white/5">
            <p className="font-body text-lg text-neon-green glow-green leading-relaxed font-semibold">
              {currentQuestion.answer}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSkip}
          disabled={isScoring || isDone}
          className="btn-ghost flex-1 btn-sm"
          style={{ width: 'auto' }}
        >
          ⏭ SKIP
        </button>
        <button
          onClick={onReset}
          disabled={isScoring}
          className="btn-ghost flex-1 btn-sm"
          style={{ width: 'auto' }}
        >
          ↺ RESET QUESTION
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROL PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function ControlPanel({ teams, activeTeamId, activeAttempt, questionState, currentQuestion, onStartAttempt, onMarkScore, onManualScore }) {
  const [manualTeam, setManualTeam] = useState('')
  const [manualPts,  setManualPts]  = useState('')
  const [manualErr,  setManualErr]  = useState('')

  const isScoring = questionState === 'scoring'
  const isDone    = questionState === 'done'
  const isIdle    = !currentQuestion || questionState === 'idle'

  const handleManual = () => {
    setManualErr('')
    if (!manualTeam) { setManualErr('Select a team'); return }
    const pts = parseInt(manualPts, 10)
    if (isNaN(pts))  { setManualErr('Enter a valid number'); return }
    // BUG FIX #6: warn on zero
    if (pts === 0)   { setManualErr('Points cannot be zero'); return }
    onManualScore(manualTeam, pts)
    setManualPts('')
    setManualTeam('')
  }

  const activeTeam = teams.find(t => t.id === activeTeamId)

  if (isIdle) return null

  return (
    <div className="panel-border-t p-4 md:p-6 flex-shrink-0">

      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-4 bg-neon-orange rounded-full" style={{ boxShadow: '0 0 6px #ff6b35' }} />
        <h3 className="font-display text-xs text-ghost tracking-widest">HOST CONTROLS</h3>
      </div>

      {/* Active scoring card */}
      {isScoring && activeTeam && (
        <div className="card card-glow-cyan p-4 mb-4 scoring-panel">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 animate-pulse"
              style={{ backgroundColor: activeTeam.color, boxShadow: `0 0 10px ${activeTeam.color}` }}
            />
            <div>
              <span className="font-mono text-sm text-frost">{activeTeam.name}</span>
              <span className="font-mono text-xs text-ghost ml-2">· Attempt {activeAttempt}</span>
            </div>
            <div className="ml-auto">
              <span className="font-mono text-xs text-ghost">
                {activeAttempt === 1
                  ? `+${currentQuestion?.marks ?? 10} / −${Math.floor((currentQuestion?.marks ?? 10) / 4)}`
                  : `+${Math.floor((currentQuestion?.marks ?? 10) / 2)} / 0`
                }
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onMarkScore('correct')} className="btn-success py-3.5">
              ✓ CORRECT
            </button>
            <button onClick={() => onMarkScore('wrong')} className="btn-danger py-3.5">
              ✗ WRONG
            </button>
          </div>
        </div>
      )}

      {/* Team attempt rows — BUG FIX #3: disabled when done or scoring */}
      {!isScoring && (
        <div className="mb-5 space-y-2">
          {isDone && (
            <div className="font-mono text-xs text-ghost/50 text-center py-1 tracking-widest">
              — QUESTION CLOSED — DRAW NEXT TO CONTINUE —
            </div>
          )}
          {teams.map(team => (
            <TeamAttemptRow
              key={team.id}
              team={team}
              questionDone={isDone}
              onStartAttempt={onStartAttempt}
            />
          ))}
        </div>
      )}

      {/* Manual scoring */}
      <div className="panel-border-t pt-4">
        <div className="font-mono text-xs text-ghost tracking-widest mb-3">MANUAL ADJUSTMENT</div>
        <div className="flex gap-2">
          <select
            value={manualTeam}
            onChange={e => { setManualTeam(e.target.value); setManualErr('') }}
            className="input-field flex-1 text-xs"
          >
            <option value="">Select team...</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input
            type="number"
            value={manualPts}
            onChange={e => { setManualPts(e.target.value); setManualErr('') }}
            placeholder="±pts"
            className="input-field w-20 text-xs"
            onKeyDown={e => e.key === 'Enter' && handleManual()}
          />
          <button
            onClick={handleManual}
            className="btn-ghost btn-sm px-4 whitespace-nowrap"
            style={{ width: 'auto' }}
          >
            APPLY
          </button>
        </div>
        {manualErr && <p className="text-neon-red text-xs font-mono mt-1">{manualErr}</p>}
      </div>
    </div>
  )
}

/** Single team row with Attempt 1 / Attempt 2 buttons. */
function TeamAttemptRow({ team, questionDone, onStartAttempt }) {
  const att1Done   = team.att1Scored
  const att2Done   = team.att2Scored
  const att1Result = team.att1Result
  const att2Result = team.att2Result

  return (
    <div className="flex items-center gap-2 py-1">
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: team.color, boxShadow: `0 0 6px ${team.color}88` }}
      />
      <span
        className="font-mono text-xs flex-1 truncate min-w-0"
        style={{ color: team.color }}
        title={team.name}
      >
        {team.name}
      </span>

      {/* Attempt 1 */}
      <div className="flex items-center gap-1">
        {att1Done ? (
          <span className={`result-badge ${att1Result === 'correct' ? 'result-badge-correct' : 'result-badge-wrong'}`}>
            ATT1 {att1Result === 'correct' ? '✓' : '✗'}
          </span>
        ) : (
          // BUG FIX #3: disable attempt button when question is done
          <button
            className={`attempt-btn ${questionDone ? 'attempt-btn-done' : 'attempt-btn-1'}`}
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
          <span className={`result-badge ${att2Result === 'correct' ? 'result-badge-correct' : 'result-badge-wrong'}`}>
            ATT2 {att2Result === 'correct' ? '✓' : '✗'}
          </span>
        ) : (
          // BUG FIX #3: disable attempt button when question is done
          <button
            className={`attempt-btn ${questionDone ? 'attempt-btn-done' : 'attempt-btn-2'}`}
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
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function LeaderboardPanel({ teams, activeTeamId }) {
  const scores   = teams.map(t => t.score)
  const maxScore = scores.length ? Math.max(...scores) : 1
  const minFloor = Math.min(...scores, 0)    // handles negative scores
  const range    = Math.max(maxScore - minFloor, 1)

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-1 h-4 bg-neon-gold rounded-full" style={{ boxShadow: '0 0 6px #ffd700' }} />
        <h3 className="font-display text-xs text-ghost tracking-widest">LEADERBOARD</h3>
      </div>

      <div className="space-y-2 flex-1">
        {teams.map((team, i) => {
          const isActive = team.id === activeTeamId
          const barWidth = Math.max(0, ((team.score - minFloor) / range) * 100)

          return (
            <div
              key={team.id}
              className={`lb-item ${isActive ? 'active-team' : ''} animate-fade-in`}
              style={isActive ? { '--team-color': team.color } : {}}
            >
              <div className="flex items-center gap-2">
                <span className="font-display text-sm w-6 flex-shrink-0 text-center">
                  {i < 3
                    ? RANK_ICONS[i]
                    : <span className="text-ghost text-xs">{i + 1}</span>
                  }
                </span>
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: team.color, boxShadow: `0 0 6px ${team.color}88` }}
                />
                <span
                  className="font-mono text-xs flex-1 truncate"
                  style={{ color: isActive ? team.color : undefined }}
                  title={team.name}
                >
                  {team.name}
                </span>
                <span
                  className={`font-display text-sm flex-shrink-0 ${isActive ? 'animate-score-pop' : ''}`}
                  style={{
                    color: team.color,
                    textShadow: isActive ? `0 0 12px ${team.color}` : undefined,
                  }}
                >
                  {team.score}
                </span>
              </div>

              <div className="score-bar">
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
          <div className="card-sm p-2 text-center">
            <div className="font-mono text-ghost text-xs mb-1">LEADER</div>
            <div className="font-display text-neon-gold text-xs truncate" title={teams[0]?.name}>
              {teams[0]?.name ?? '—'}
            </div>
          </div>
          <div className="card-sm p-2 text-center">
            <div className="font-mono text-ghost text-xs mb-1">TOP SCORE</div>
            <div className="font-display text-neon-gold text-sm">{teams[0]?.score ?? 0}</div>
          </div>
        </div>
      )}
    </div>
  )
}