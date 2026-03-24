import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'
const MAX_TEAMS  = 25   // hard cap, matches server/gameState.js

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

const getTeamColor = (index) => {
  if (TEAM_COLORS[index]) return TEAM_COLORS[index]
  const hue = (index * 37) % 360
  return `hsl(${hue}, 82%, 58%)`
}

const formatTeamName = (name, maxChars = 20) => {
  if (!name || name.length <= maxChars) return name
  const keepStart = Math.max(6, Math.floor((maxChars - 3) * 0.7))
  const keepEnd = Math.max(3, maxChars - 3 - keepStart)
  return `${name.slice(0, keepStart)}...${name.slice(-keepEnd)}`
}

// Stable uid generator for team rows in setup screen
let _uid = 0
const makeTeam = (name = '') => ({ uid: ++_uid, name })

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [gameState, setGameState] = useState(null)
  const [connected, setConnected] = useState(false)
  const [error,     setError]     = useState(null)
  const socketRef                 = useRef(null)

  useEffect(() => {
    const socket = io(SERVER_URL, {
      reconnectionAttempts: Infinity,
      reconnectionDelay:    1000,
    })
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

  // ── Loading / connecting screen ──────────────────────────────────────────
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

      {/* Connection lost banner */}
      {!connected && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-900/90 border-b border-yellow-500/50 text-yellow-300 text-center py-2 text-sm font-mono tracking-widest">
          ⚡ CONNECTION LOST — RECONNECTING...
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed top-4 right-4 z-50 card border border-neon-red/50 bg-red-950/95 text-neon-red px-5 py-4 text-base font-mono max-w-sm animate-slide-in shadow-glow-red">
          ⚠ {error}
        </div>
      )}

      {/* Phase routing */}
      {gameState.phase === 'setup' && (
        <TeamSetup onStart={(teams) => emit('setup:teams', { teams })} />
      )}
      {gameState.phase === 'game' && (
        <Dashboard gameState={gameState} emit={emit} />
      )}
      {gameState.phase === 'end' && (
        <EndGameScreen gameState={gameState} onReset={() => emit('game:reset')} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM SETUP SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

function TeamSetup({ onStart }) {
  const [teams, setTeams] = useState(() => [makeTeam(), makeTeam(), makeTeam(), makeTeam()])
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
    if (names.length < 2)                   { setError('Add at least 2 team names'); return }
    if (new Set(names).size < names.length) { setError('Team names must be unique'); return }
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
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-5 pointer-events-none"
           style={{ background: 'radial-gradient(circle, #00d4ff, transparent)', filter: 'blur(80px)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-5 pointer-events-none"
           style={{ background: 'radial-gradient(circle, #a855f7, transparent)', filter: 'blur(80px)' }} />

      <div className="relative z-10 w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-display text-6xl sm:text-7xl tracking-widest text-neon-cyan glow-cyan mb-2">
            Q-MANIA
          </h1>
          <div className="h-px bg-gradient-to-r from-transparent via-neon-cyan to-transparent opacity-40 mb-4" />
          <p className="font-mono text-ghost text-xs tracking-[0.35em] uppercase">
            Live Quiz Dashboard · Host Console
          </p>
        </div>

        {/* Section scoring reference */}
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

        {/* Team config card */}
        <div className="card p-7">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 bg-neon-cyan rounded-full" style={{ boxShadow: '0 0 8px #00d4ff' }} />
            <h2 className="font-display text-sm text-frost tracking-widest">CONFIGURE TEAMS</h2>
            <span className="font-mono text-ghost/50 text-xs ml-auto">max {MAX_TEAMS}</span>
          </div>

          <div className="space-y-3 mb-5">
            {teams.map((team, i) => (
              <div key={team.uid} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: getTeamColor(i),
                    boxShadow: `0 0 10px ${getTeamColor(i)}88`,
                  }}
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
                    className="text-ghost hover:text-neon-red transition-colors w-7 h-7 flex items-center justify-center text-base flex-shrink-0 rounded hover:bg-red-500/10"
                    aria-label={`Remove team ${i + 1}`}
                  >✕</button>
                )}
              </div>
            ))}
          </div>

          {/* Add team / limit message */}
          {teams.length < MAX_TEAMS ? (
            <button
              onClick={addTeam}
              className="btn btn-ghost mb-5 text-sm"
              style={{ width: 'auto' }}
            >
              + ADD TEAM ({teams.length}/{MAX_TEAMS})
            </button>
          ) : (
            <div className="mb-5 text-center">
              <span className="font-mono text-neon-orange/70 text-xs tracking-widest">
                ◈ MAXIMUM {MAX_TEAMS} TEAMS REACHED
              </span>
            </div>
          )}

          {error && (
            <p className="text-neon-red text-sm font-mono mb-4 flex items-center gap-2">
              <span>⚠</span> {error}
            </p>
          )}

          <button onClick={handleStart} className="btn btn-primary py-4 text-base">
            ▶ LAUNCH GAME
          </button>

          <p className="text-ghost text-sm font-mono text-center mt-4 opacity-60">
            {namedCount} / {teams.length} teams named
          </p>
        </div>

        <p className="text-center font-mono text-ghost/30 text-xs mt-5">
          Q-Mania Club · Live Event Quiz System
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD — main game screen
// ═══════════════════════════════════════════════════════════════════════════════

function Dashboard({ gameState, emit }) {
  const [mobileTab,  setMobileTab]  = useState('question')
  const [showAnswer, setShowAnswer] = useState(false)
  const [isDesktop,  setIsDesktop]  = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768)
  const prevQuestionRef             = useRef(null)

  // Track screen width so the 3-panel layout is driven by JS, not Tailwind class ordering.
  // This was the root bug: md:w-68 / lg:w-76 don't exist in Tailwind's default scale,
  // causing the leaderboard to have no width constraint and fill the whole viewport.
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const {
    teams, leaderboard, sections, sectionMeta, sectionScores,
    currentSection, currentQuestion, questionState,
    activeTeamId, activeAttempt, canUndo, remainingInSection,
  } = gameState

  // Hide answer whenever a new question arrives
  useEffect(() => {
    const qText = currentQuestion?.question ?? null
    if (qText !== prevQuestionRef.current) {
      prevQuestionRef.current = qText
      setShowAnswer(false)
    }
  }, [currentQuestion])

  // Auto-switch to question tab on new question
  useEffect(() => {
    if (currentQuestion && questionState === 'active') {
      setMobileTab('question')
    }
  }, [currentQuestion?.question, questionState])

  const handleEndGame = () => {
    if (window.confirm('End the game and show final scores?')) {
      emit('game:end')
    }
  }

  const handleReset = () => {
    if (window.confirm('RESET the entire game? ALL scores will be lost permanently.')) {
      emit('game:reset')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-void">

      {/* ── HEADER ── */}
      <header className="header-border flex-shrink-0 relative z-10 bg-void/95 backdrop-blur-sm">
        <div className="px-3 md:px-5 py-2.5 flex items-center gap-2 min-w-0">

          {/* Left: logo + section badge */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h1 className="font-display text-lg md:text-2xl text-neon-cyan glow-cyan tracking-widest flex-shrink-0">
              Q-MANIA
            </h1>
            <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
              <div className="h-4 w-px bg-ghost/30" />
              <span className="font-mono text-ghost text-xs tracking-widest">HOST</span>
            </div>
            {currentSection && (
              <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded border border-white/10 bg-white/5 flex-shrink-0">
                <span className="text-sm">{getSectionMeta(currentSection).icon}</span>
                <span className="font-mono text-xs tracking-widest" style={{ color: getSectionMeta(currentSection).color }}>
                  {getSectionMeta(currentSection).label}
                </span>
                <span className="font-mono text-xs text-ghost">· {remainingInSection}Q left</span>
              </div>
            )}
          </div>

          {/* Right: action buttons — ALWAYS visible regardless of team count */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* UNDO — always rendered, disabled when nothing to undo */}
            <button
              onClick={() => emit('action:undo')}
              disabled={!canUndo}
              className="btn btn-ghost btn-sm flex-shrink-0"
              style={{ width: 'auto', minWidth: '70px' }}
              title={canUndo ? 'Undo last scoring action' : 'Nothing to undo yet'}
            >
              ↩ UNDO
            </button>

            {/* END GAME */}
            <button
              onClick={handleEndGame}
              className="btn btn-sm flex-shrink-0"
              style={{
                width: 'auto',
                minWidth: '80px',
                background: 'rgba(255,215,0,0.1)',
                borderColor: 'rgba(255,215,0,0.4)',
                color: '#ffd700',
              }}
            >
              🏁 END
            </button>

            {/* RESET */}
            <button
              onClick={handleReset}
              className="btn btn-danger btn-sm flex-shrink-0"
              style={{ width: 'auto', minWidth: '70px' }}
            >
              ⊗ RESET
            </button>
          </div>
        </div>
      </header>

      {/* ── MOBILE TAB BAR ── */}
      <div className="md:hidden header-border flex flex-shrink-0 bg-void/95 backdrop-blur-sm">
        {[
          { key: 'sections',    label: 'Sections', icon: '⚡' },
          { key: 'question',    label: 'Question',  icon: '❓' },
          { key: 'leaderboard', label: 'Scores',    icon: '🏆' },
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

      {/* ── THREE-PANEL LAYOUT ── */}
      {/*
        Layout fix: Tailwind's md:w-68 / lg:w-76 don't exist in the default scale
        and md:flex vs hidden ordering can be unreliable depending on build order.
        Solution: drive visibility entirely from JS (isDesktop hook) using inline styles.
        This is 100% reliable regardless of Tailwind purging or class ordering.
      */}
      <div className="flex flex-1 overflow-hidden relative z-10">

        {/* LEFT — Section selector */}
        <aside
          className="flex-col panel-border-r flex-shrink-0 overflow-y-auto"
          style={{
            display:  isDesktop || mobileTab === 'sections' ? 'flex' : 'none',
            width:    isDesktop ? '240px' : '100%',
            minWidth: isDesktop ? '240px' : undefined,
          }}
        >
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

        {/* CENTER — Question + Host Controls */}
        <main
          className="flex-col overflow-y-auto"
          style={{
            display:  isDesktop || mobileTab === 'question' ? 'flex' : 'none',
            flex:     1,
            minWidth: 0,
          }}
        >
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
            canUndo={canUndo}
            onStartAttempt={(teamId, attempt) => emit('attempt:start', { teamId, attempt })}
            onMarkScore={(result) => emit('score:mark', { result })}
            onManualScore={(teamId, points) => emit('score:manual', { teamId, points })}
            onEndQuestion={() => emit('question:end')}
            onSkipQuestion={() => emit('question:skip')}
            onNextQuestion={() => emit('question:next')}
            onUndo={() => emit('action:undo')}
          />
        </main>

        {/* RIGHT — Live Leaderboard */}
        <aside
          className="flex-col panel-border-l flex-shrink-0 overflow-y-auto"
          style={{
            display:  isDesktop || mobileTab === 'leaderboard' ? 'flex' : 'none',
            width:    isDesktop ? (teams.length > 20 ? '420px' : teams.length > 16 ? '380px' : '320px') : '100%',
            minWidth: isDesktop ? (teams.length > 20 ? '420px' : teams.length > 16 ? '380px' : '320px') : undefined,
          }}
        >
          <LeaderboardPanel teams={leaderboard} activeTeamId={activeTeamId} />
        </aside>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTIONS PANEL — left column
// ═══════════════════════════════════════════════════════════════════════════════

function SectionsPanel({
  sections, sectionMeta, sectionScores,
  currentSection, remainingInSection, questionState,
  onSelectSection, onNextQuestion,
}) {
  const isScoring = questionState === 'scoring'

  return (
    <div className="p-4 flex flex-col gap-3 h-full">

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-4 bg-neon-cyan rounded-full" style={{ boxShadow: '0 0 6px #00d4ff' }} />
        <h3 className="font-display text-xs text-ghost tracking-widest">SECTIONS</h3>
      </div>

      {/* Section buttons */}
      <div className="space-y-2">
        {sections.map(section => {
          const meta       = getSectionMeta(section)
          const m          = sectionMeta?.[section]
          const maxAllowed = m?.maxAllowed ?? '?'
          const asked      = m?.asked      ?? 0
          const remaining  = m?.remaining  ?? '?'
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
              <span className="text-xl flex-shrink-0">{meta.icon}</span>
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm tracking-widest">{meta.label.toUpperCase()}</div>
                {scores && (
                  <div className="font-mono text-xs mt-0.5" style={{ color: `${meta.color}90` }}>
                    +{scores.correct} / {scores.wrong}
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`font-display text-sm ${isActive ? 'text-neon-cyan' : 'text-ghost/60'}`}>
                  {asked}/{maxAllowed}
                </div>
                <div className="font-mono text-xs text-ghost/40">asked</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Formula note */}
      <div className="card-sm p-2.5 text-center">
        <div className="font-mono text-ghost/40 text-xs leading-relaxed">
          Phy/SciFi: ceil(1.7 × teams)<br />
          Puzzles: ceil(0.6 × teams)
        </div>
      </div>

      {/* Bottom: remaining counter + NEXT QUESTION */}
      <div className="mt-auto space-y-2">
        {currentSection ? (
          <>
            <div className="card-sm p-3 text-center">
              <div className="font-mono text-xs text-ghost mb-1">REMAINING</div>
              <div className="font-display text-4xl" style={{ color: getSectionMeta(currentSection).color }}>
                {remainingInSection}
              </div>
              <div className="font-mono text-xs text-ghost/60">questions left</div>
            </div>

            <button
              onClick={onNextQuestion}
              disabled={isScoring || remainingInSection === 0}
              className="btn btn-primary py-3.5 text-sm"
            >
              ▶ NEXT QUESTION
            </button>

            {isScoring && (
              <p className="font-mono text-ghost/40 text-xs text-center">
                Finish current attempt first
              </p>
            )}
            {remainingInSection === 0 && !isScoring && (
              <p className="font-mono text-neon-orange/60 text-xs text-center">
                ✓ Section complete
              </p>
            )}
          </>
        ) : (
          <p className="text-ghost text-sm font-mono text-center leading-relaxed py-4">
            ↑ Select a section<br />to begin
          </p>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUESTION PANEL — center top
// ═══════════════════════════════════════════════════════════════════════════════

function QuestionPanel({
  currentQuestion, questionState, currentSection,
  showAnswer, onToggleAnswer,
  onSkip, onEnd, onReset,
}) {
  const isDone    = questionState === 'done'
  const isScoring = questionState === 'scoring'
  const isIdle    = questionState === 'idle'

  // No question yet
  if (!currentQuestion) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" style={{ minHeight: '260px' }}>
        <div className="text-7xl mb-5 opacity-10 select-none">❓</div>
        <h3 className="font-display text-sm text-ghost tracking-widest mb-2">
          {currentSection ? 'READY TO DRAW' : 'SELECT A SECTION'}
        </h3>
        <p className="font-mono text-ghost/50 text-sm">
          {currentSection
            ? 'Click NEXT QUESTION in the left panel to draw a question'
            : 'Choose a section from the left panel to begin'}
        </p>
      </div>
    )
  }

  const meta = getSectionMeta(currentSection)

  return (
    <div className="p-4 md:p-5">

      {/* Question card */}
      <div className={`card p-5 md:p-6 mb-4 question-enter ${isDone ? 'opacity-55' : ''}`}>

        {/* Card header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{meta.icon}</span>
            <div>
              <span className="font-mono text-sm tracking-widest" style={{ color: meta.color }}>
                {meta.label.toUpperCase()}
              </span>
              {isDone    && <span className="font-mono text-xs text-ghost/50 tracking-widest ml-2">[CLOSED]</span>}
              {isScoring && <span className="font-mono text-xs text-neon-orange tracking-widest ml-2 animate-pulse">[SCORING…]</span>}
              {isIdle    && <span className="font-mono text-xs text-ghost/40 tracking-widest ml-2">[IDLE]</span>}
            </div>
          </div>
          {/* Marks badge */}
          <div
            className="px-3 py-1 rounded-full border font-mono text-sm font-semibold flex-shrink-0"
            style={{ borderColor: `${meta.color}50`, color: meta.color, background: `${meta.color}10` }}
          >
            +{currentQuestion.marks} pts
          </div>
        </div>

        {/* Question text — large for projector */}
        <p className="font-body text-2xl md:text-3xl text-frost leading-relaxed font-semibold mb-4">
          {currentQuestion.question}
        </p>

        {/* Hint */}
        {currentQuestion.hint && (
          <div className="flex items-start gap-2 pt-3 border-t border-white/5">
            <span className="text-base flex-shrink-0">💡</span>
            <p className="font-mono text-ghost text-sm leading-relaxed italic">
              {currentQuestion.hint}
            </p>
          </div>
        )}
      </div>

      {/* Correct / Wrong chip row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card-sm p-3 flex items-center gap-3">
          <span className="font-mono text-xs text-ghost/60">CORRECT</span>
          <span className="font-display text-xl text-neon-green ml-auto">+{currentQuestion.marks}</span>
        </div>
        <div className="card-sm p-3 flex items-center gap-3">
          <span className="font-mono text-xs text-ghost/60">WRONG</span>
          <span className="font-display text-xl text-neon-red ml-auto">−{currentQuestion.wrongPenalty}</span>
        </div>
      </div>

      {/* Answer reveal */}
      <div className="card mb-4 overflow-hidden">
        <button
          onClick={onToggleAnswer}
          className="w-full flex items-center justify-between px-5 py-3.5 font-mono text-sm text-ghost hover:text-frost transition-colors tracking-widest"
        >
          <span>ANSWER</span>
          <span className="text-neon-cyan font-semibold">{showAnswer ? '▲ HIDE' : '▼ REVEAL ANSWER'}</span>
        </button>
        {showAnswer && (
          <div className="px-5 pb-5 border-t border-white/5">
            <p className="font-body text-xl md:text-2xl text-neon-green glow-green leading-relaxed font-semibold mt-4">
              {currentQuestion.answer}
            </p>
          </div>
        )}
      </div>

      {/* Quick action row */}
      <div className="flex gap-2">
        <button
          onClick={onEnd}
          disabled={isScoring || isDone}
          className="btn btn-sm flex-1"
          style={{
            width: 'auto',
            background: isScoring || isDone ? 'transparent' : 'rgba(57,255,20,0.08)',
            borderColor: isScoring || isDone ? 'rgba(57,255,20,0.15)' : 'rgba(57,255,20,0.4)',
            color: isScoring || isDone ? '#4a5580' : '#39ff14',
          }}
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
// CONTROL PANEL — center bottom (the heart of host control)
// ═══════════════════════════════════════════════════════════════════════════════

function ControlPanel({
  teams, activeTeamId, activeAttempt,
  questionState, currentQuestion, currentSection, sectionScores,
  canUndo,
  onStartAttempt, onMarkScore, onManualScore,
  onEndQuestion, onSkipQuestion, onNextQuestion, onUndo,
}) {
  const [manualTeam, setManualTeam] = useState('')
  const [manualPts,  setManualPts]  = useState('')
  const [manualErr,  setManualErr]  = useState('')

  const isScoring  = questionState === 'scoring'
  const isDone     = questionState === 'done'
  const isActive   = questionState === 'active'
  const noQuestion = !currentQuestion || questionState === 'idle'

  // Live section scoring config for display
  const scores     = sectionScores?.[currentSection] ?? { correct: 40, wrong: -10 }
  const activeTeam = teams.find(t => t.id === activeTeamId)

  const handleManual = () => {
    setManualErr('')
    if (!manualTeam)        { setManualErr('Select a team first'); return }
    const pts = parseInt(manualPts, 10)
    if (isNaN(pts))         { setManualErr('Enter a valid number'); return }
    if (pts === 0)          { setManualErr('Points cannot be zero'); return }
    onManualScore(manualTeam, pts)
    setManualPts('')
    setManualTeam('')
  }

  return (
    <div className="panel-border-t p-4 md:p-5 flex-shrink-0" style={{ background: 'rgba(6,6,16,0.6)' }}>

      {/* Panel header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-neon-orange rounded-full" style={{ boxShadow: '0 0 6px #ff6b35' }} />
          <h3 className="font-display text-xs text-ghost tracking-widest">HOST CONTROLS</h3>
        </div>
        {/* Secondary UNDO in control panel — always visible */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="btn btn-ghost btn-sm"
          style={{ width: 'auto' }}
          title={canUndo ? 'Undo last scoring action' : 'Nothing to undo yet'}
        >
          ↩ UNDO
        </button>
      </div>

      {/* ── IF NO QUESTION ACTIVE: just show manual adjust ── */}
      {noQuestion && (
        <ManualAdjust
          teams={teams}
          manualTeam={manualTeam} manualPts={manualPts} manualErr={manualErr}
          setManualTeam={v => { setManualTeam(v); setManualErr('') }}
          setManualPts={v => { setManualPts(v); setManualErr('') }}
          onApply={handleManual}
        />
      )}

      {/* ── IF QUESTION ACTIVE ── */}
      {!noQuestion && (
        <>
          {/* SCORING MODE: big correct / wrong buttons */}
          {isScoring && activeTeam && (
            <div className="card card-glow-cyan p-4 mb-4 scoring-panel">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0 animate-pulse"
                  style={{ backgroundColor: activeTeam.color, boxShadow: `0 0 14px ${activeTeam.color}` }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-body text-lg font-semibold truncate" style={{ color: activeTeam.color }}>
                    {activeTeam.name}
                  </div>
                  <div className="font-mono text-xs text-ghost mt-0.5">
                    Attempt {activeAttempt} · Correct: +{scores.correct} · Wrong: {scores.wrong}
                  </div>
                </div>
                <div className="font-display text-2xl flex-shrink-0" style={{ color: activeTeam.color }}>
                  {activeTeam.score}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => onMarkScore('correct')} className="btn btn-success py-5 text-lg">
                  ✓ CORRECT<br />
                  <span className="text-sm opacity-70">+{scores.correct} pts</span>
                </button>
                <button onClick={() => onMarkScore('wrong')} className="btn btn-danger py-5 text-lg">
                  ✗ WRONG<br />
                  <span className="text-sm opacity-70">{scores.wrong} pts</span>
                </button>
              </div>
            </div>
          )}

          {/* TEAM ATTEMPT ROWS (shown when not in scoring mode) */}
          {!isScoring && (
            <div className="mb-4">
              <div className="font-mono text-xs text-ghost/50 tracking-widest mb-2">
                SELECT TEAM → START ATTEMPT
              </div>
              {isDone && (
                <div className="font-mono text-xs text-ghost/35 text-center py-1.5 tracking-widest mb-2 border border-white/5 rounded">
                  — QUESTION CLOSED — DRAW NEXT TO CONTINUE —
                </div>
              )}
              <div className="space-y-1.5">
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

          {/* FLOW CONTROL BUTTONS */}
          {!isScoring && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {/* END QUESTION */}
              <button
                onClick={onEndQuestion}
                disabled={isDone}
                className="btn btn-sm py-3"
                style={{
                  width: 'auto',
                  background: isDone ? 'transparent' : 'rgba(57,255,20,0.08)',
                  borderColor: isDone ? 'rgba(57,255,20,0.12)' : 'rgba(57,255,20,0.4)',
                  color: isDone ? '#4a5580' : '#39ff14',
                }}
              >
                ✓ END<br />QUESTION
              </button>

              {/* SKIP QUESTION */}
              <button
                onClick={onSkipQuestion}
                disabled={isDone}
                className="btn btn-ghost btn-sm py-3"
                style={{ width: 'auto' }}
              >
                ⏭ SKIP<br />QUESTION
              </button>

              {/* NEXT QUESTION — works from active OR done, disabled only when scoring */}
              <button
                onClick={onNextQuestion}
                disabled={isScoring || !currentSection}
                className="btn btn-primary btn-sm py-3"
                style={{ width: 'auto' }}
              >
                ▶ NEXT<br />QUESTION
              </button>
            </div>
          )}

          {/* MANUAL ADJUSTMENT */}
          <div className="panel-border-t pt-4">
            <ManualAdjust
              teams={teams}
              manualTeam={manualTeam} manualPts={manualPts} manualErr={manualErr}
              setManualTeam={v => { setManualTeam(v); setManualErr('') }}
              setManualPts={v => { setManualPts(v); setManualErr('') }}
              onApply={handleManual}
            />
          </div>
        </>
      )}
    </div>
  )
}

// ── Reusable manual score widget ─────────────────────────────────────────────

function ManualAdjust({ teams, manualTeam, manualPts, manualErr, setManualTeam, setManualPts, onApply }) {
  return (
    <div>
      <div className="font-mono text-xs text-ghost/50 tracking-widest mb-2">
        MANUAL SCORE ADJUSTMENT
      </div>
      <div className="flex gap-2">
        <select
          value={manualTeam}
          onChange={e => setManualTeam(e.target.value)}
          className="input-field flex-1 text-sm"
        >
          <option value="">Select team…</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input
          type="number"
          value={manualPts}
          onChange={e => setManualPts(e.target.value)}
          placeholder="±pts"
          className="input-field w-20 text-sm"
          onKeyDown={e => e.key === 'Enter' && onApply()}
        />
        <button
          onClick={onApply}
          className="btn btn-ghost btn-sm whitespace-nowrap"
          style={{ width: 'auto', minWidth: '70px' }}
        >
          APPLY
        </button>
      </div>
      {manualErr && <p className="text-neon-red text-sm font-mono mt-1.5">{manualErr}</p>}
      <p className="font-mono text-ghost/25 text-xs mt-1.5">
        Negative to deduct · No restrictions · Full host override
      </p>
    </div>
  )
}

// ── Team row with Attempt 1 / Attempt 2 buttons ──────────────────────────────

function TeamAttemptRow({ team, questionDone, onStartAttempt }) {
  const att1Done   = team.att1Scored
  const att2Done   = team.att2Scored
  const att1Result = team.att1Result
  const att2Result = team.att2Result
  const shownName  = formatTeamName(team.name, 22)

  return (
    <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
      {/* Team colour dot */}
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: team.color, boxShadow: `0 0 5px ${team.color}88` }}
      />

      {/* Team name + score */}
      <span
        className="font-mono text-sm flex-1 truncate min-w-0 font-medium"
        style={{ color: team.color }}
        title={team.name}
      >
        {shownName}
      </span>
      <span className="font-display text-sm text-ghost/60 flex-shrink-0 mr-1">
        {team.score}
      </span>

      {/* Attempt 1 */}
      {att1Done ? (
        <span className={`result-badge ${att1Result === 'correct' ? 'result-badge-correct' : 'result-badge-wrong'}`}>
          A1 {att1Result === 'correct' ? '✓' : '✗'}
        </span>
      ) : (
        <button
          className="attempt-btn attempt-btn-1"
          onClick={() => !questionDone && onStartAttempt(team.id, 1)}
          disabled={questionDone}
        >
          ATT 1
        </button>
      )}

      {/* Attempt 2 */}
      {att2Done ? (
        <span className={`result-badge ${att2Result === 'correct' ? 'result-badge-correct' : 'result-badge-wrong'}`}>
          A2 {att2Result === 'correct' ? '✓' : '✗'}
        </span>
      ) : (
        <button
          className="attempt-btn attempt-btn-2"
          onClick={() => !questionDone && onStartAttempt(team.id, 2)}
          disabled={questionDone}
        >
          ATT 2
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD PANEL — right column
// ═══════════════════════════════════════════════════════════════════════════════

function LeaderboardPanel({ teams, activeTeamId }) {
  const scores   = teams.map(t => t.score)
  const maxScore = scores.length ? Math.max(...scores) : 1
  const minFloor = Math.min(...scores, 0)
  const range    = Math.max(maxScore - minFloor, 1)
  const isSparse  = teams.length > 0 && teams.length <= 8
  const isCompact = teams.length > 10
  const isDense   = teams.length > 16
  const isUltraDense = teams.length > 20

  return (
    <div className="p-3 flex flex-col h-full min-h-0">

      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-4 bg-neon-gold rounded-full" style={{ boxShadow: '0 0 6px #ffd700' }} />
        <h3 className="font-display text-xs text-ghost tracking-widest">LIVE LEADERBOARD</h3>
        <span className="font-mono text-[10px] text-ghost/60 ml-auto">{teams.length} teams</span>
      </div>

      <div className={`flex-1 min-h-0 pr-1 ${isSparse ? 'flex flex-col gap-2' : isCompact ? 'overflow-y-auto grid gap-1.5 grid-cols-2 content-start' : 'overflow-y-auto space-y-2'}`}>
        {teams.map((team, i) => {
          const isActive = team.id === activeTeamId
          const barWidth = Math.max(0, ((team.score - minFloor) / range) * 100)
          const shownName = formatTeamName(team.name, isUltraDense ? 24 : isDense ? 20 : isCompact ? 22 : 28)

          return (
            <div
              key={team.id}
              className={`lb-item ${isActive ? 'active-team' : ''} ${isSparse ? 'flex-1 p-3' : ''} ${isDense ? 'p-2' : ''}`}
              style={isActive ? { '--team-color': team.color } : {}}
            >
              <div className={`flex items-center ${isDense ? 'gap-1.5' : 'gap-2'}`}>
                <span className={`${isSparse ? 'text-lg w-8' : isDense ? 'text-sm w-4' : 'text-base w-6'} flex-shrink-0 text-center`}>
                  {i < 3
                    ? RANK_ICONS[i]
                    : <span className="font-mono text-ghost/60 text-[10px]">{i + 1}</span>
                  }
                </span>
                <div
                  className={`${isDense ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded-full flex-shrink-0`}
                  style={{ backgroundColor: team.color, boxShadow: `0 0 6px ${team.color}88` }}
                />
                <span
                  className={`font-mono ${isSparse ? 'text-base' : isUltraDense ? 'text-sm' : isDense ? 'text-xs' : 'text-sm'} flex-1 truncate min-w-0`}
                  style={{ color: isActive ? team.color : undefined }}
                  title={team.name}
                >
                  {shownName}
                </span>
                <span
                  className={`font-display ${isSparse ? 'text-2xl' : isUltraDense ? 'text-base' : isDense ? 'text-sm' : 'text-lg'} flex-shrink-0 ${isActive ? 'animate-score-pop' : ''}`}
                  style={{
                    color: team.color,
                    textShadow: isActive ? `0 0 12px ${team.color}` : undefined,
                  }}
                >
                  {team.score}
                </span>
              </div>

              {!isDense && (
                <div className="score-bar">
                  <div
                    className="score-bar-fill"
                    style={{
                      width:           `${barWidth}%`,
                      backgroundColor: team.color,
                      boxShadow:       `0 0 6px ${team.color}88`,
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary footer */}
      {teams.length > 0 && !isDense && (
        <div className="mt-4 pt-4 panel-border-t grid grid-cols-2 gap-2">
          <div className="card-sm p-2.5 text-center">
            <div className="font-mono text-ghost text-xs mb-1">LEADER</div>
            <div className="font-body text-sm font-semibold truncate" style={{ color: teams[0]?.color }} title={teams[0]?.name}>
                {formatTeamName(teams[0]?.name, 28) ?? '—'}
            </div>
          </div>
          <div className="card-sm p-2.5 text-center">
            <div className="font-mono text-ghost text-xs mb-1">TOP SCORE</div>
            <div className="font-display text-lg text-neon-gold">{teams[0]?.score ?? 0}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// END GAME SCREEN — full leaderboard + section warnings
// ═══════════════════════════════════════════════════════════════════════════════

function EndGameScreen({ gameState, onReset }) {
  const { leaderboard, endWarnings } = gameState
  const winner = leaderboard[0]

  const scores   = leaderboard.map(t => t.score)
  const maxScore = scores.length ? Math.max(...scores) : 1
  const minFloor = Math.min(...scores, 0)
  const range    = Math.max(maxScore - minFloor, 1)

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 relative overflow-hidden">
      <div className="grid-overlay" />
      <div className="scanlines" />

      {/* Gold radial glow */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 20%, #ffd700 0%, transparent 65%)' }}
      />

      {/* ── Trophy header ── */}
      <div className="text-center mb-8 mt-6 relative z-10">
        <div className="text-6xl mb-3">🏆</div>
        <h1
          className="font-display text-4xl md:text-6xl tracking-widest text-neon-gold mb-1"
          style={{ textShadow: '0 0 30px rgba(255,215,0,0.6), 0 0 70px rgba(255,215,0,0.25)' }}
        >
          Q-MANIA
        </h1>
        <div className="font-display text-base md:text-xl tracking-[0.3em] text-frost/60 mb-5">
          FINAL SCORES
        </div>

        {/* Winner badge */}
        {winner && (
          <div
            className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border max-w-full"
            style={{ borderColor: `${winner.color}50`, background: `${winner.color}12` }}
          >
            <span className="text-2xl">🥇</span>
            <span
              className="font-display text-lg md:text-xl truncate max-w-[52vw] md:max-w-[34rem]"
              title={winner.name}
              style={{ color: winner.color, textShadow: `0 0 16px ${winner.color}` }}
            >
              {winner.name}
            </span>
            <span className="font-display text-2xl text-neon-gold">{winner.score}</span>
          </div>
        )}
      </div>

      <div className="w-full max-w-4xl relative z-10 space-y-4 mb-8">

        {/* ── Full final leaderboard ── */}
        <div className="card p-5 md:p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-5 bg-neon-gold rounded-full" style={{ boxShadow: '0 0 6px #ffd700' }} />
            <h2 className="font-display text-sm tracking-widest text-ghost">FINAL STANDINGS</h2>
          </div>

          <div className="space-y-3 max-h-[68vh] overflow-y-auto pr-1">
            {leaderboard.map((team, i) => {
              const barWidth = Math.max(0, ((team.score - minFloor) / range) * 100)
              const isFirst  = i === 0
              const shownName = formatTeamName(team.name, leaderboard.length > 20 ? 42 : 52)

              return (
                <div
                  key={team.id}
                  className="rounded-lg border p-3.5 md:p-4"
                  style={{
                    borderColor: isFirst ? `${team.color}60` : 'rgba(255,255,255,0.07)',
                    background:  isFirst ? `${team.color}0c` : 'rgba(13,13,36,0.5)',
                  }}
                >
                  <div className="flex items-center gap-3 md:gap-4">
                    {/* Rank */}
                    <span className="text-xl md:text-2xl w-7 text-center flex-shrink-0">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (
                        <span className="font-mono text-ghost/60 text-sm">{i + 1}</span>
                      )}
                    </span>
                    {/* Colour dot */}
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: team.color, boxShadow: `0 0 8px ${team.color}` }}
                    />
                    {/* Name */}
                    <span
                      className="font-body text-lg md:text-xl flex-1 min-w-0 font-semibold truncate"
                      style={{ color: isFirst ? team.color : undefined }}
                      title={team.name}
                    >
                      {shownName}
                    </span>
                    {/* Score */}
                    <span
                      className="font-display text-2xl md:text-3xl flex-shrink-0"
                      style={{ color: team.color, textShadow: `0 0 10px ${team.color}88` }}
                    >
                      {team.score}
                    </span>
                  </div>

                  {/* Score bar */}
                  <div className="score-bar mt-2.5">
                    <div
                      className="score-bar-fill"
                      style={{
                        width:           `${barWidth}%`,
                        backgroundColor: team.color,
                        boxShadow:       `0 0 6px ${team.color}88`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Section attempt warnings ── */}
        {endWarnings && endWarnings.length > 0 && (
          <div className="card p-5" style={{ borderColor: 'rgba(255,107,53,0.35)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">⚠️</span>
              <h2 className="font-display text-sm tracking-widest text-neon-orange">
                SECTION ATTEMPT WARNINGS
              </h2>
            </div>
            <p className="font-mono text-ghost/50 text-xs mb-4 leading-relaxed">
              These teams did not answer any question in the listed sections.
              No penalty applied — host decision only.
            </p>
            <div className="space-y-4">
              {endWarnings.map(w => (
                <div key={w.section}>
                  <div className="flex items-center gap-2 mb-2">
                    <span>{getSectionMeta(w.section).icon}</span>
                    <span className="font-mono text-sm tracking-widest" style={{ color: getSectionMeta(w.section).color }}>
                      {w.label.toUpperCase()}
                    </span>
                    <span className="font-mono text-xs text-ghost/50">— no attempts from:</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-6">
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

        {/* All sections attempted notice */}
        {endWarnings && endWarnings.length === 0 && (
          <div className="card p-4 text-center" style={{ borderColor: 'rgba(57,255,20,0.25)' }}>
            <span className="text-xl">✅</span>
            <p className="font-mono text-neon-green text-sm mt-2">
              All teams attempted all mandatory sections.
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="relative z-10 flex gap-3 pb-10">
        <button
          onClick={onReset}
          className="btn btn-danger px-8 md:px-12 py-4 text-base"
          style={{ width: 'auto' }}
        >
          ↺ PLAY AGAIN
        </button>
      </div>
    </div>
  )
}