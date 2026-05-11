import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Team, GameState, MysteryPuzzleData } from "@/lib/types";

interface Props {
  team: Team;
  socket: Socket;
  sessionId: string;
  playerName: string;
  avatar: string;
  gameState: GameState;
  mySocketId?: string;
}

const TEAM_BG: Record<string, string> = { blue: "#1e3a8a", red: "#7f1d1d", green: "#14532d", yellow: "#713f12", purple: "#4a1d96", orange: "#7c2d12" };
const TEAM_FG: Record<string, string> = { blue: "#60a5fa", red: "#f87171", green: "#4ade80", yellow: "#facc15", purple: "#c084fc", orange: "#fb923c" };

export default function MysteryPuzzleController({ team, socket, sessionId, playerName, avatar, gameState: initialState, mySocketId }: Props) {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [code, setCode] = useState<string[]>(["", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [shake, setShake] = useState(false);

  const teamBg = TEAM_BG[team.color] || "#1f2937";
  const teamFg = TEAM_FG[team.color] || "#ffffff";

  useEffect(() => {
    const handler = (state: GameState) => setGameState(state);
    socket.on("game:mystery_updated", handler);
    socket.on("game:minigame_ended", handler);
    socket.on("game:score_update", handler);
    return () => {
      socket.off("game:mystery_updated", handler);
      socket.off("game:minigame_ended", handler);
      socket.off("game:score_update", handler);
    };
  }, [socket]);

  const mpData = gameState.miniGameData as MysteryPuzzleData | null;
  if (!mpData) return null;

  const mySolverSocketId = mySocketId ?? socket.id;
  const isSolver = mpData.solverByTeam[team.id] === mySolverSocketId;
  const solverName = mpData.solverNamesByTeam[team.id];
  const winnerTeam = mpData.winnerTeamId ? gameState.teams.find((t) => t.id === mpData.winnerTeamId) : null;
  const myTeamWon = winnerTeam?.id === team.id;

  // My team's puzzle data only
  const myTd = mpData.teamData[team.id];
  const myClues = myTd?.clues ?? [];
  const collectedDigits = myClues.filter((c) => c.digit !== null).map((c) => c.digit as string);
  const allDigitsCollected = myClues.length === 4 && collectedDigits.length === 4;

  const setDigit = (i: number, value: string) => {
    const v = value.replace(/\D/g, "").slice(0, 1);
    setCode((prev) => prev.map((d, idx) => idx === i ? v : d));
    setFeedback("idle");
    if (v && i < 3) {
      const next = document.getElementById(`code-digit-${i + 1}`);
      next?.focus();
    }
  };

  const handleKeypadPress = (digit: string) => {
    setFeedback("idle");
    setCode((prev) => {
      const next = [...prev];
      const firstEmpty = next.findIndex((d) => d === "");
      const target = firstEmpty === -1 ? 3 : firstEmpty;
      next[target] = digit;
      return next;
    });
  };

  const handleBackspace = () => {
    setFeedback("idle");
    setCode((prev) => {
      const next = [...prev];
      const lastFilled = [...next].reverse().findIndex((d) => d !== "");
      if (lastFilled === -1) return prev;
      const target = next.length - 1 - lastFilled;
      next[target] = "";
      return next;
    });
  };

  const handleClear = () => {
    setCode(["", "", "", ""]);
    setFeedback("idle");
  };

  const handleSubmit = () => {
    const joined = code.join("");
    if (joined.length !== 4) return;
    setSubmitting(true);
    socket.emit("mystery:submit_code", { sessionId, code: joined }, (res: { ok: boolean; correct: boolean; reason?: string }) => {
      setSubmitting(false);
      if (res?.correct) {
        setFeedback("correct");
      } else {
        setFeedback("wrong");
        setShake(true);
        setTimeout(() => setShake(false), 500);
        // Clear after a moment so they can try the next permutation
        setTimeout(() => { setCode(["", "", "", ""]); setFeedback("idle"); }, 800);
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: teamBg }}>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{avatar}</span>
            <div>
              <p className="text-white/50 text-xs">Playing as</p>
              <p className="font-black text-white text-base leading-tight">{playerName}</p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full text-sm font-bold" style={{ backgroundColor: teamFg, color: teamBg }}>{team.name}</div>
        </div>
        <div className="flex gap-2">
          {gameState.teams.map((t) => (
            <div key={t.id} className={`flex-1 rounded-lg px-2 py-1.5 text-center ${t.id === team.id ? "border border-white/30" : ""}`} style={{ backgroundColor: "rgba(0,0,0,0.3)" }}>
              <div className="text-xl font-black text-white">{t.score}</div>
              <div className="text-xs text-white/50">{t.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 pb-8 pt-2 gap-3">
        {/* Lock + title */}
        <div className="flex items-center justify-center gap-4">
          <div className="text-5xl">{winnerTeam ? "🔓" : "🔒"}</div>
          <div className="text-center">
            <p className="text-xs text-yellow-400/70 font-bold uppercase">{team.name}'s Vault</p>
            <p className="text-xs text-white/50">{collectedDigits.length} of 4 digits collected</p>
          </div>
          <div className="text-5xl">{winnerTeam ? "🔓" : "🔒"}</div>
        </div>

        {/* My team's clues, revealed only */}
        {myClues.some((c) => c.revealed) && (
          <div className="bg-black/30 rounded-xl p-3">
            <p className="text-xs font-bold uppercase mb-2 text-yellow-400">🧩 Your Clues</p>
            <div className="space-y-1.5">
              {myClues.map((clue, i) => {
                if (!clue.revealed) return null;
                return (
                  <div key={i} className="bg-white/5 rounded-lg p-2 flex items-start gap-2">
                    <p className="text-[11px] text-white/40 shrink-0">{i + 1}</p>
                    <p className="text-white text-sm font-semibold flex-1">{clue.question}</p>
                    {clue.digit !== null && (
                      <span className="bg-green-700 text-white font-mono font-black text-base px-2 py-0.5 rounded">{clue.digit}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!myClues.some((c) => c.revealed) && (
          <div className="text-center text-white/40 text-sm py-2 italic">
            Waiting for the host to reveal your first clue…
          </div>
        )}

        {/* Collected digits panel */}
        {collectedDigits.length > 0 && !winnerTeam && (
          <div className="bg-black/30 rounded-xl p-3 text-center">
            <p className="text-xs text-yellow-400 font-bold uppercase mb-2">🔢 Your digits (random order)</p>
            <div className="flex justify-center gap-2">
              {collectedDigits.map((d, i) => (
                <span key={i} className="bg-amber-500/20 border-2 border-amber-400 text-amber-200 font-mono font-black text-2xl w-12 h-12 rounded-lg flex items-center justify-center">{d}</span>
              ))}
            </div>
            {allDigitsCollected && (
              <p className="text-xs text-amber-200 mt-2">All 4 digits collected — try different orders below to unlock!</p>
            )}
          </div>
        )}

        {/* WINNER banner */}
        {winnerTeam && (
          <div className={`rounded-xl p-4 text-center ${myTeamWon ? "bg-green-900 border-2 border-green-400" : "bg-red-900/40 border-2 border-red-700"}`}>
            <p className="text-2xl font-black text-white mb-1">{myTeamWon ? "🏆 YOUR TEAM WINS!" : "💔 Other team won"}</p>
          </div>
        )}

        {/* Body: keypad for solver, otherwise waiting message */}
        {!winnerTeam && (
          <>
            {!isSolver ? (
              <div className="bg-black/30 rounded-xl p-4 text-center flex-1 flex flex-col items-center justify-center">
                <div className="text-4xl mb-2">🔑</div>
                {solverName ? (
                  <>
                    <p className="text-white font-bold text-base">{solverName}</p>
                    <p className="text-white/60 text-sm mt-1">is unlocking the vault for {team.name}</p>
                    <p className="text-white/40 text-xs mt-2">Help your teammate figure out the order!</p>
                  </>
                ) : (
                  <p className="text-white/60 text-sm">No solver chosen yet</p>
                )}
              </div>
            ) : (
              <div className={`bg-black/30 rounded-xl p-3 space-y-3 ${shake ? "animate-shake" : ""}`}>
                <p className="text-center text-yellow-300 font-black text-sm uppercase">🔑 You are the solver</p>

                {/* 4-digit input */}
                <div className="flex justify-center gap-2">
                  {code.map((d, i) => (
                    <input
                      key={i}
                      id={`code-digit-${i}`}
                      inputMode="numeric"
                      type="text"
                      maxLength={1}
                      value={d}
                      onChange={(e) => setDigit(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !code[i] && i > 0) {
                          const prev = document.getElementById(`code-digit-${i - 1}`);
                          prev?.focus();
                        }
                      }}
                      className={`w-14 h-16 text-center font-mono font-black text-3xl rounded-lg border-2 ${
                        feedback === "wrong" ? "border-red-500 bg-red-900/40 text-red-200" :
                        feedback === "correct" ? "border-green-500 bg-green-900/40 text-green-200" :
                        d ? "border-yellow-400 bg-yellow-950/40 text-yellow-200" : "border-white/20 bg-white/5 text-white/40"
                      }`}
                    />
                  ))}
                </div>

                {feedback === "wrong" && <p className="text-center text-red-300 text-sm font-bold">Wrong order — try a different permutation</p>}
                {feedback === "correct" && <p className="text-center text-green-300 text-sm font-bold">✓ Unlocked!</p>}

                {/* On-screen keypad */}
                <div className="grid grid-cols-3 gap-2">
                  {["1","2","3","4","5","6","7","8","9"].map((n) => (
                    <button
                      key={n}
                      onClick={() => handleKeypadPress(n)}
                      disabled={submitting}
                      className="bg-white/10 hover:bg-white/20 active:scale-95 text-white font-black text-2xl py-3 rounded-xl transition disabled:opacity-50"
                    >
                      {n}
                    </button>
                  ))}
                  <button onClick={handleBackspace} disabled={submitting} className="bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold py-3 rounded-xl transition disabled:opacity-50">⌫</button>
                  <button
                    onClick={() => handleKeypadPress("0")}
                    disabled={submitting}
                    className="bg-white/10 hover:bg-white/20 active:scale-95 text-white font-black text-2xl py-3 rounded-xl transition disabled:opacity-50"
                  >
                    0
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || code.some((d) => !d)}
                    className="bg-green-600 hover:bg-green-500 active:scale-95 text-white font-black py-3 rounded-xl transition disabled:opacity-30"
                  >
                    {submitting ? "..." : "✓"}
                  </button>
                </div>
                <button onClick={handleClear} disabled={submitting} className="w-full text-xs text-white/40 hover:text-white/70 underline">Clear</button>
              </div>
            )}
          </>
        )}

        {!winnerTeam && mpData.attempts.length > 0 && (
          <div className="text-center text-white/30 text-xs">
            {mpData.attempts.filter((a) => a.teamId === team.id).length} attempts by {team.name}
          </div>
        )}
      </div>

      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 50%{transform:translateX(6px)} 75%{transform:translateX(-3px)} }
        .animate-shake { animation: shake 0.4s; }
      `}</style>
    </div>
  );
}
