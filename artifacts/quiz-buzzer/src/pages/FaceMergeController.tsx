import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Team, GameState, FaceMergeData } from "@/lib/types";

interface Props {
  team: Team;
  socket: Socket;
  sessionId: string;
  playerName: string;
  avatar: string;
  gameState: GameState;
}

const TEAM_BG: Record<string, string> = { blue: "#1e3a8a", red: "#7f1d1d", green: "#14532d", yellow: "#713f12", purple: "#4a1d96", orange: "#7c2d12" };
const TEAM_FG: Record<string, string> = { blue: "#60a5fa", red: "#f87171", green: "#4ade80", yellow: "#facc15", purple: "#c084fc", orange: "#fb923c" };

export default function FaceMergeController({ team, socket, sessionId, playerName, avatar, gameState: initialState }: Props) {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [hasBuzzed, setHasBuzzed] = useState(false);
  const [buzzSuccess, setBuzzSuccess] = useState(false);

  const teamBg = TEAM_BG[team.color] || "#1f2937";
  const teamFg = TEAM_FG[team.color] || "#ffffff";

  useEffect(() => {
    const handler = (state: GameState) => setGameState(state);
    socket.on("game:face_merge_updated", handler);
    socket.on("game:buzzed", ({ state }: { state: GameState }) => {
      setGameState(state);
      if (state.buzzedBy?.playerName === playerName) setBuzzSuccess(true);
    });
    socket.on("game:buzz_reset", (state: GameState) => {
      setGameState(state); setHasBuzzed(false); setBuzzSuccess(false);
    });
    socket.on("game:minigame_ended", handler);
    return () => {
      socket.off("game:face_merge_updated", handler);
      socket.off("game:buzzed");
      socket.off("game:buzz_reset");
      socket.off("game:minigame_ended", handler);
    };
  }, [socket, playerName]);

  const handleBuzz = () => {
    if (hasBuzzed || buzzSuccess) return;
    const fmData = gameState.miniGameData as FaceMergeData | null;
    if (!fmData || fmData.phase !== "guessing") return;
    setHasBuzzed(true);
    socket.emit("face_merge:buzz", { sessionId });
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  const fmData = gameState.miniGameData as FaceMergeData | null;
  const phase = fmData?.phase ?? "guessing";
  const buzzedBy = gameState.buzzedBy;
  const iAmBuzzer = buzzedBy?.playerName === playerName;
  const someoneElseBuzzed = !!buzzedBy && !iAmBuzzer;
  const setIndex = fmData?.setIndex ?? 0;
  const totalSets = fmData?.totalSets ?? 0;

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

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 gap-6">
        <div className="text-center">
          <p className="text-white font-black text-2xl">🖼️ Face Merge</p>
          {totalSets > 0 && <p className="text-white/50 text-sm mt-1">Image {setIndex + 1} of {totalSets}</p>}
          <p className="text-white/40 text-xs mt-2 max-w-xs">Look at the host's screen for the merged image. Buzz in when you know who they are!</p>
        </div>

        {phase === "guessing" && !iAmBuzzer && !someoneElseBuzzed && (
          <button
            onTouchStart={handleBuzz}
            onClick={handleBuzz}
            disabled={hasBuzzed}
            className={`w-64 h-64 rounded-full font-black text-4xl transition-all select-none ${hasBuzzed ? "opacity-50 scale-95" : "active:scale-95 shadow-2xl"}`}
            style={{ backgroundColor: hasBuzzed ? "rgba(255,255,255,0.2)" : teamFg, color: hasBuzzed ? "rgba(255,255,255,0.5)" : teamBg, boxShadow: hasBuzzed ? "none" : `0 0 60px ${teamFg}66` }}
          >
            {hasBuzzed ? "…" : "BUZZ!"}
          </button>
        )}

        {iAmBuzzer && (
          <div className="text-center animate-pulse">
            <div className="text-6xl mb-3">🔔</div>
            <p className="text-3xl font-black text-white">YOU BUZZED FIRST!</p>
            <p className="text-white/60 text-sm mt-2">Waiting for host to award the point…</p>
          </div>
        )}

        {someoneElseBuzzed && buzzedBy && (
          <div className="text-center">
            <div className="text-5xl mb-3">🔕</div>
            <p className="text-white/70 font-bold text-lg">{buzzedBy.playerName} buzzed first</p>
            <p className="text-white/40 text-sm">{buzzedBy.teamName}</p>
          </div>
        )}

        {phase === "revealed" && !buzzedBy && (
          <div className="text-center text-yellow-400 font-bold animate-pulse">Images revealed on the host's screen!</div>
        )}

        {phase === "done" && (
          <div className="text-center">
            <div className="text-5xl mb-2">🏁</div>
            <p className="text-white font-bold">All images complete!</p>
          </div>
        )}
      </div>
    </div>
  );
}
