import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { GameState, NumberSurvivalData, Team } from "@/lib/types";

interface Props {
  team: Team;
  socket: Socket;
  sessionId: string;
  playerName: string;
  avatar: string;
  gameState: GameState;
  mySocketId: string;
}

const TEAM_BG: Record<string, string> = {
  blue: "#1e3a8a", red: "#7f1d1d", green: "#14532d",
  yellow: "#713f12", purple: "#4a1d96", orange: "#7c2d12",
};
const TEAM_FG: Record<string, string> = {
  blue: "#60a5fa", red: "#f87171", green: "#4ade80",
  yellow: "#facc15", purple: "#c084fc", orange: "#fb923c",
};

export default function NumberSurvivalController({ team, socket, sessionId, playerName, avatar, gameState, mySocketId }: Props) {
  const [localState, setLocalState] = useState<GameState>(gameState);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const teamBg = TEAM_BG[team.color] || "#1f2937";
  const teamFg = TEAM_FG[team.color] || "#ffffff";

  const data = localState.miniGameData as NumberSurvivalData | null;
  const isAlive = data ? data.survivorIds.includes(mySocketId) : true;
  const myChoiceThisRound = data ? data.mySelections[mySocketId] : null;

  useEffect(() => {
    setLocalState(gameState);
  }, [gameState]);

  useEffect(() => {
    const onUpdate = (state: GameState) => {
      const d = state.miniGameData as NumberSurvivalData | null;
      const prevRound = (localState.miniGameData as NumberSurvivalData | null)?.round;
      if (d && d.round !== prevRound) {
        setSelected(null);
        setSubmitted(false);
      }
      setLocalState(state);
    };
    socket.on("game:number_update", onUpdate);
    socket.on("game:number_result", onUpdate);
    socket.on("game:number_next_round", (state: GameState) => {
      setSelected(null);
      setSubmitted(false);
      setLocalState(state);
    });
    socket.on("game:number_done", onUpdate);
    return () => {
      socket.off("game:number_update", onUpdate);
      socket.off("game:number_result", onUpdate);
      socket.off("game:number_next_round");
      socket.off("game:number_done", onUpdate);
    };
  }, [socket, localState]);

  const submitNumber = (num: number) => {
    if (submitted || !isAlive || data?.phase !== "selecting") return;
    setSelected(num);
    setSubmitted(true);
    socket.emit("number:select", { sessionId, number: num });
  };

  if (!data) return null;
  const { round, totalRounds, phase, currentResult } = data;

  // ===== END OF MINI-GAME =====
  // Host awards the point manually — no winner/loser banner here.
  if (phase === "done") {
    const teamCounts = localState.teams.map((t) => ({ id: t.id, name: t.name, count: (data.teamSurvivors[t.id] || []).length }));

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: teamBg }}>
        <div className="text-6xl mb-3">🏁</div>
        <h2 className="text-3xl font-black text-white mb-2">Round Complete</h2>
        <p className="text-white/70 text-sm mb-4">Survivors per team:</p>
        <div className="flex gap-3">
          {teamCounts.map((tc) => (
            <div key={tc.id} className={`px-4 py-2 rounded-xl ${tc.id === team.id ? "border-2 border-white/30" : ""}`} style={{ backgroundColor: "rgba(0,0,0,0.3)" }}>
              <div className="text-2xl font-black text-white">{tc.count}</div>
              <div className="text-xs text-white/50">{tc.name}</div>
            </div>
          ))}
        </div>
        <p className="text-white/40 text-sm mt-6 animate-pulse">Waiting for host to award the point…</p>
      </div>
    );
  }

  // ===== PERSONAL ELIMINATION (mid-game) =====
  if (!isAlive) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: teamBg }}>
        <div className="text-6xl mb-4">💀</div>
        <h2 className="text-3xl font-black text-white mb-2">You're out this round</h2>
        <p className="text-white/60 text-lg">Your number clashed with the other team's pick.</p>
        <p className="text-white/40 text-sm mt-4">But your team can still win — cheer them on!</p>
        {currentResult && (
          <div className="mt-6 bg-black/30 rounded-2xl p-4 w-full max-w-xs">
            <p className="text-white/60 text-xs mb-2">ROUND {currentResult.round} RESULTS</p>
            {currentResult.choices.map((c) => {
              const wasElim = currentResult.eliminated.includes(c.socketId);
              return (
                <div key={c.socketId} className={`flex items-center gap-2 py-1 ${wasElim ? "text-red-400" : "text-green-400"}`}>
                  <span>{c.avatar}</span>
                  <span className="text-sm flex-1">{c.name}</span>
                  <span className="font-black">{c.number}</span>
                  <span>{wasElim ? "💀" : "✅"}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ===== ROUND REVEAL =====
  if (phase === "revealing" && currentResult) {
    const myEntry = currentResult.choices.find((c) => c.socketId === mySocketId);
    const iEliminated = currentResult.eliminated.includes(mySocketId);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: teamBg }}>
        {iEliminated ? (
          <>
            <div className="text-6xl mb-3">💀</div>
            <h2 className="text-3xl font-black text-red-400 mb-2">You're out this round</h2>
            <p className="text-white/60">Your number {myEntry?.number} clashed with the other team.</p>
          </>
        ) : (
          <>
            <div className="text-6xl mb-3">✅</div>
            <h2 className="text-3xl font-black text-green-400 mb-2">You Survived!</h2>
            <p className="text-white/60">Your number {myEntry?.number} is safe.</p>
          </>
        )}
        <p className="text-white/40 text-sm mt-4 animate-pulse">Waiting for next round…</p>
        <div className="mt-4 bg-black/30 rounded-2xl p-4 w-full max-w-xs">
          {currentResult.choices.map((c) => {
            const wasElim = currentResult.eliminated.includes(c.socketId);
            return (
              <div key={c.socketId} className={`flex items-center gap-2 py-1 ${wasElim ? "text-red-400/70" : "text-green-400"}`}>
                <span>{c.avatar}</span>
                <span className="text-sm flex-1">{c.name}</span>
                <span className="font-black">{c.number}</span>
                <span>{wasElim ? "💀" : "✅"}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ===== NUMBER PICKER =====
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: teamBg }}>
      <div className="text-center mb-4">
        <div className="text-4xl mb-1">{avatar}</div>
        <p className="text-sm font-bold" style={{ color: teamFg }}>{playerName} — {team.name}</p>
        <div className="mt-2">
          <span className="text-xs text-white/40">Round </span>
          <span className="text-xl font-black text-white">{round}</span>
          <span className="text-white/40 text-xs"> of {totalRounds}</span>
        </div>
        {data.phase === "selecting" && typeof data.remainingMs === "number" && (
          <div className={`mt-1 font-mono font-black ${data.remainingMs <= 5000 ? "text-red-400 animate-pulse" : "text-yellow-400"}`}>
            {Math.max(0, Math.ceil(data.remainingMs / 1000))}s
          </div>
        )}
      </div>

      <p className="text-center text-white/60 text-sm mb-3 max-w-xs">
        Pick a number. If <span className="text-yellow-400 font-bold">a player on the OTHER team picks the same number</span>, you both get out. Same-team duplicates are safe.
      </p>

      <div className="grid grid-cols-5 gap-2 max-w-xs">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            onClick={() => submitNumber(n)}
            disabled={submitted}
            className={`aspect-square rounded-xl text-2xl font-black transition-all active:scale-95 ${
              selected === n ? "bg-yellow-400 text-black" : submitted ? "bg-black/30 text-white/30" : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {submitted && (
        <div className="text-center mt-4">
          <p className="text-white font-bold">Picked {selected}!</p>
          {myChoiceThisRound !== null && myChoiceThisRound !== selected && (
            <p className="text-xs text-white/30 mt-1">Server confirmed: {myChoiceThisRound}</p>
          )}
          <p className="text-white/50 text-sm mt-1 animate-pulse">Waiting for everyone…</p>
        </div>
      )}
    </div>
  );
}
