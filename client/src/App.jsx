import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const sectionRules = {
  physics: { label: "Physics", correct: 40, wrong: -10 },
  sciFi: { label: "Sci-Fi", correct: 40, wrong: -10 },
  puzzles: { label: "Puzzles", correct: 60, wrong: -20 },
};

const socket = io("http://localhost:4000");

const panelClass = "soft-panel rounded-2xl";
const btnPrimary = "action-ring rounded-xl px-4 py-3 text-lg font-semibold transition focus:outline-none";
const btnMuted = `${btnPrimary} bg-slate-700 hover:bg-slate-600 text-slate-100 focus:ring-slate-400`;

function App() {
  const [state, setState] = useState(null);
  const [teamCount, setTeamCount] = useState(4);
  const [teamNamesText, setTeamNamesText] = useState("Team Alpha\nTeam Beta\nTeam Gamma\nTeam Delta");
  const [manualMark, setManualMark] = useState("");
  const [activeAttempt, setActiveAttempt] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(true);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const r = await fetch("/api/state");
        const data = await r.json();
        setState(data);
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
    socket.on("state:update", (next) => {
      setState(next);
      setBackendOnline(true);
    });
    return () => socket.off("state:update");
  }, []);

  const action = async (url, body = {}) => {
    setError("");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Action failed");
        return null;
      }
      setState(data);
      setBackendOnline(true);
      return data;
    } catch {
      setBackendOnline(false);
      setError("Cannot reach backend. Check server terminal.");
      return null;
    }
  };

  const questionCountHint = useMemo(() => {
    const x = Number(teamCount) || 0;
    return {
      physics: Math.ceil(1.7 * x),
      sciFi: Math.ceil(1.7 * x),
      puzzles: Math.ceil(0.6 * x),
    };
  }, [teamCount]);

  const initSetup = () => {
    const list = teamNamesText
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, Number(teamCount) || 0);
    action("/api/setup", { teamNames: list }).then((data) => {
      if (data) setShowSetup(false);
    });
  };

  const activeTeam = state?.teams?.find((t) => t.id === state.activeTeamId);
  const sectionMeta = state?.sections?.[state?.activeSection] ?? sectionRules[state?.activeSection];

  const launchDemo = () => {
    setTeamCount(4);
    setTeamNamesText("Team Alpha\nTeam Beta\nTeam Gamma\nTeam Delta");
    action("/api/setup", { teamNames: ["Team Alpha", "Team Beta", "Team Gamma", "Team Delta"] }).then((data) => {
      if (data) setShowSetup(false);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen text-slate-100 p-8">
        <div className={`mx-auto max-w-3xl p-8 ${panelClass}`}>
          <h1 className="text-3xl font-bold">Loading dashboard...</h1>
        </div>
      </div>
    );
  }

  if (!backendOnline) {
    return (
      <div className="min-h-screen text-slate-100 p-8">
        <div className={`mx-auto max-w-3xl p-8 space-y-4 ${panelClass}`}>
          <h1 className="text-3xl font-bold text-rose-300">Backend not connected</h1>
          <p className="text-xl text-slate-300">Start backend in `server` with `npm run dev` and refresh.</p>
          <button className={`${btnPrimary} bg-indigo-600 hover:bg-indigo-500 text-white`} onClick={() => window.location.reload()}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!state?.initialized || showSetup) {
    return (
      <div className="min-h-screen text-slate-100 p-6 lg:p-10">
        <div className="mx-auto max-w-4xl">
          <p className="inline-flex rounded-full glass-chip px-4 py-1 text-sm font-medium tracking-wide text-sky-200">
            Q-MANIA CLUB | HOST DESK
          </p>
          <h1 className="mt-4 text-4xl lg:text-6xl font-black tracking-tight">Initialize Live Quiz</h1>
          <p className="mt-3 text-lg lg:text-xl text-slate-300">Set teams once, then run the entire event from one control dashboard.</p>
        </div>

        <div className={`mx-auto mt-7 max-w-4xl p-6 lg:p-8 space-y-6 ${panelClass}`}>
          <div>
            <label className="block text-xl lg:text-2xl font-semibold mb-2">Number of Teams</label>
            <input
              type="number"
              min="1"
              className="w-full text-2xl p-3 rounded-xl bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={teamCount}
              onChange={(e) => setTeamCount(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xl lg:text-2xl font-semibold mb-2">Team Names (one per line)</label>
            <textarea
              className="w-full h-56 text-xl p-3 rounded-xl bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={teamNamesText}
              onChange={(e) => setTeamNamesText(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
              <p className="text-slate-300">Section 1</p>
              <p className="text-2xl font-bold">Physics: {questionCountHint.physics}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
              <p className="text-slate-300">Section 2</p>
              <p className="text-2xl font-bold">Sci-Fi: {questionCountHint.sciFi}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
              <p className="text-slate-300">Section 3</p>
              <p className="text-2xl font-bold">Puzzles: {questionCountHint.puzzles}</p>
            </div>
          </div>
          <button
            className={`${btnPrimary} w-full text-2xl py-4 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white`}
            onClick={initSetup}
          >
            Save Teams & Start
          </button>
          <button className={`${btnMuted} w-full`} onClick={launchDemo}>
            Quick Start with Demo Teams
          </button>
          {error ? <p className="text-red-400 text-xl">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-100 p-4 lg:p-6">
      <header className={`mb-4 p-4 lg:p-5 ${panelClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl lg:text-5xl font-black tracking-tight">Q-Mania Club Dashboard</h1>
            <p className="text-slate-300 mt-1">Manual host control mode</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl glass-chip px-4 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-lg font-semibold text-emerald-200">LIVE</span>
          </div>
          <div className="rounded-xl border border-amber-400/50 bg-amber-500/12 px-4 py-2 text-lg font-semibold text-amber-200">
            Active: {activeTeam?.name || "None"}
          </div>
          <button className={`${btnPrimary} bg-slate-700 hover:bg-slate-600`} onClick={() => setShowSetup(true)}>
            Re-setup Teams
          </button>
        </div>
      </header>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <section className={`xl:col-span-3 p-4 space-y-4 ${panelClass}`}>
          <h2 className="text-2xl font-bold">Sections</h2>
          {Object.entries(sectionRules).map(([key, value]) => (
            <button
              key={key}
              onClick={() => action("/api/section", { section: key })}
              className={`action-ring w-full text-left p-4 rounded-xl text-xl border transition ${
                state.activeSection === key
                  ? "bg-gradient-to-r from-indigo-600 to-sky-700 border-sky-200/60 shadow-lg shadow-sky-900/35"
                  : "bg-slate-800 border-slate-600 hover:bg-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold">{value.label}</span>
                <span className="text-base text-slate-200">{value.correct}/{value.wrong}</span>
              </div>
              <div className="mt-2 text-base text-slate-300">Remaining: {state.remainingBySection?.[key] ?? 0}</div>
            </button>
          ))}
          <div className="border-t border-slate-700 pt-4">
            <h3 className="text-xl font-bold mb-2">Mandatory Rule Check</h3>
            {state.sectionWarnings?.map((w) => (
              <div key={w.section} className="mb-3 rounded-lg border border-slate-700 bg-slate-800/70 p-3">
                <p className="text-lg text-amber-300 font-semibold">{w.sectionLabel} not attempted:</p>
                <p className="text-base text-slate-300">{w.missingTeams.length ? w.missingTeams.join(", ") : "None"}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`xl:col-span-6 p-4 space-y-4 ${panelClass}`}>
          <h2 className="text-2xl font-bold">Question Area</h2>
          <div className="min-h-64 bg-slate-800/90 rounded-2xl border border-slate-600 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-lg text-slate-300 font-semibold">
                Section: {state.currentQuestion?.sectionLabel || sectionRules[state.activeSection].label}
              </p>
              <span className="glass-chip rounded-full px-3 py-1 text-sm text-slate-200">
                Marks: +{sectionMeta?.correct} / {sectionMeta?.wrong}
              </span>
            </div>
            <p className="text-3xl lg:text-5xl leading-tight font-semibold">
              {state.currentQuestion?.question || "Press NEXT RANDOM QUESTION to begin."}
            </p>
            {state.currentQuestion?.answerRevealed ? (
              <p className="mt-5 rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-4 text-2xl lg:text-3xl text-emerald-300 font-bold">
                Answer: {state.currentQuestion.answer}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button className={`${btnPrimary} text-2xl py-4 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white`} onClick={() => action("/api/question/next")}>
              Next Random Question
            </button>
            <button className={`${btnPrimary} text-2xl py-4 bg-sky-700 hover:bg-sky-600 text-white`} onClick={() => action("/api/question/reveal")}>
              Reveal Answer
            </button>
          </div>

          <div className="bg-slate-800/85 rounded-2xl border border-slate-600 p-4 space-y-3">
            <h3 className="text-2xl font-bold">Manual Control Panel</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-lg font-semibold">Select Team</label>
                <select
                  className="w-full p-3 text-xl bg-slate-900 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={state.activeTeamId || ""}
                  onChange={(e) => action("/api/team/select", { teamId: e.target.value })}
                >
                  {state.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-lg text-amber-200">Highlighted in leaderboard</p>
              </div>
              <div>
                <label className="block mb-1 text-lg font-semibold">Attempt Control</label>
                <div className="flex gap-2">
                  <button
                    className={`action-ring flex-1 rounded-xl text-lg py-3 font-semibold transition ${activeAttempt === 1 ? "bg-violet-600 text-white" : "bg-slate-700 hover:bg-slate-600"}`}
                    onClick={() => {
                      setActiveAttempt(1);
                      action("/api/attempt/start", { attemptNo: 1 });
                    }}
                  >
                    Start Attempt 1
                  </button>
                  <button
                    className={`action-ring flex-1 rounded-xl text-lg py-3 font-semibold transition ${activeAttempt === 2 ? "bg-violet-600 text-white" : "bg-slate-700 hover:bg-slate-600"}`}
                    onClick={() => {
                      setActiveAttempt(2);
                      action("/api/attempt/start", { attemptNo: 2 });
                    }}
                  >
                    Start Attempt 2
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button className={`${btnPrimary} bg-emerald-600 hover:bg-emerald-500 text-white`} onClick={() => action("/api/score/dynamic", { outcome: "correct", attemptNo: activeAttempt })}>
                Correct
              </button>
              <button className={`${btnPrimary} bg-rose-600 hover:bg-rose-500 text-white`} onClick={() => action("/api/score/dynamic", { outcome: "wrong", attemptNo: activeAttempt })}>
                Wrong
              </button>
              <button className={`${btnPrimary} bg-emerald-800 hover:bg-emerald-700 text-white`} onClick={() => action("/api/score/manual", { mark: sectionRules[state.activeSection].correct })}>
                +{sectionRules[state.activeSection].correct}
              </button>
              <button className={`${btnPrimary} bg-rose-800 hover:bg-rose-700 text-white`} onClick={() => action("/api/score/manual", { mark: sectionRules[state.activeSection].wrong })}>
                {sectionRules[state.activeSection].wrong}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <button className={btnMuted} onClick={() => action("/api/question/end")}>
                End Question
              </button>
              <button className={btnMuted} onClick={() => action("/api/question/skip")}>
                Skip Question
              </button>
              <button className={`${btnPrimary} bg-amber-500 hover:bg-amber-400 text-black`} onClick={() => action("/api/undo")}>
                Undo Last Action
              </button>
              <button className={`${btnPrimary} bg-cyan-700 hover:bg-cyan-600 text-white`} onClick={() => action("/api/question/reset")}>
                Reset Current Question
              </button>
              <button className={`${btnPrimary} bg-indigo-700 hover:bg-indigo-600 text-white`} onClick={() => action("/api/question/next")}>
                Next Question
              </button>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                className="w-40 p-2 text-xl bg-slate-900 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
                placeholder="Manual +/-"
                value={manualMark}
                onChange={(e) => setManualMark(e.target.value)}
              />
              <button className={`${btnPrimary} bg-fuchsia-700 hover:bg-fuchsia-600 text-white`} onClick={() => action("/api/score/manual", { mark: Number(manualMark) })}>
                Apply Manual Marks
              </button>
            </div>
          </div>
          {error ? <p className="text-red-400 text-xl">{error}</p> : null}
        </section>

        <section className={`xl:col-span-3 p-4 ${panelClass}`}>
          <h2 className="text-2xl font-bold mb-3">Leaderboard (Live)</h2>
          <div className="space-y-2">
            {state.leaderboard.map((t, idx) => (
              <div
                key={t.id}
                className={`p-4 rounded-xl border text-xl flex justify-between transition ${
                  state.activeTeamId === t.id
                    ? "bg-gradient-to-r from-amber-500/18 to-orange-500/18 border-amber-300"
                    : "bg-slate-800 border-slate-600"
                }`}
              >
                <span className="font-semibold">
                  #{idx + 1} {t.name}
                </span>
                <span className="font-bold">{t.score}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
