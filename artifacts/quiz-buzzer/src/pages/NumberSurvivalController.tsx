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

  if (!isAlive) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: teamBg }}>
        <div className="text-6xl mb-4">💀</div>
        <h2 className="text-3xl font-black text-white mb-2">Eliminated!</h2>
        <p className="text-white/60 text-lg">You picked the same number as someone else.</p>
        <p className="text-white/40 text-sm mt-4">Watch the main screen for results.</p>
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

  if (phase === "revealing" && currentResult) {
    const myEntry = currentResult.choices.find((c) => c.socketId === mySocketId);
    const iEliminated = currentResult.eliminated.includes(mySocketId);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: teamBg }}>
        {iEliminated ? (
          <>
            <div className="text-6xl mb-3">💀</div>
            <h2 className="text-3xl font-black text-red-400 mb-2">Eliminated!</h2>
            <p className="text-white/60">Your number {myEntry?.number} was picked by someone else.</p>
          </>
        ) : (
          <>
            <div className="text-6xl mb-3">✅</div>
            <h2 className="text-3xl font-black text-green-400 mb-2">You Survived!</h2>
            <p className="text-white/60">Your number {myEntry?.number} was unique!</p>
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

  if (phase === "done") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: teamBg }}>
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-3xl font-black text-yellow-400 mb-2">Game Over!</h2>
        <p className="text-white/60">Waiting for admin to announce winner…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: teamBg }}>
      <div className="text-center mb-4">
        <div className="text-4xl mb-1">{avatar}</div>
        <p className="text-sm font-bold" style={{ color: teamFg }}>{playerName} — {team.name}</p>
        <div className="mt-2">
          <span className="text-xs text-white/40">Round </span>
          <span className="text-white font-black">{round}</span>
          <span className="text-white/40 text-xs"> of {totalRounds}</span>
        </div>
      </div>

      <div className="bg-black/30 rounded-2xl p-5 w-full max-w-sm">
        <h2 className="text-white font-black text-xl text-center mb-1">Pick a number</h2>
        <p className="text-white/50 text-sm text-center mb-4">
          Unique numbers survive. Duplicates are eliminated!
        </p>

        {submitted ? (
          <div className="text-center">
            <div className="text-6xl font-black mb-3" style={{ color: teamFg }}>{selected}</div>
            <p className="text-white/60 animate-pulse">Locked in! Waiting for others…</p>
            {myChoiceThisRound !== null && myChoiceThisRound !== selected && (
              <p className="text-xs text-white/30 mt-1">Server confirmed: {myChoiceThisRound}</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {[1,2,3,4,5,6,7,8,9,10].map((num) => (
              <button
                key={num}
                onClick={() => submitNumber(num)}
                className="aspect-square rounded-xl font-black text-2xl transition-all active:scale-95 select-none"
                style={{ backgroundColor: teamFg + "22", color: teamFg, border: `2px solid ${teamFg}44` }}
              >
                {num}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
