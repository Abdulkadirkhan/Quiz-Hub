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
  const phase = fmData?.phase ?? "setup";
  const buzzedBy = gameState.buzzedBy;
  const iAmBuzzer = buzzedBy?.playerName === playerName;
  const someoneElseBuzzed = !!buzzedBy && !iAmBuzzer;
  const scores = gameState.teams;

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
          {scores.map((t) => (
            <div key={t.id} className={`flex-1 rounded-lg px-2 py-1.5 text-center ${t.id === team.id ? "border border-white/30" : ""}`} style={{ backgroundColor: "rgba(0,0,0,0.3)" }}>
              <div className="text-xl font-black text-white">{t.score}</div>
              <div className="text-xs text-white/50">{t.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 gap-5">
        <div className="text-center">
          <p className="text-white font-black text-xl">🖼️ Face Merge</p>
        </div>

        {phase === "setup" && (
          <p className="text-white/50 text-lg text-center animate-pulse">Waiting for host to upload images…</p>
        )}

        {(phase === "guessing" || phase === "revealed") && fmData && (
          <>
            <div className="relative w-56 h-56 rounded-2xl overflow-hidden border-2 border-pink-400 shadow-2xl">
              {fmData.image1 && (
                <img src={fmData.image1} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.55 }} />
              )}
              {fmData.image2 && (
                <img src={fmData.image2} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.55, mixBlendMode: "multiply" }} />
              )}
            </div>

            {phase === "revealed" && fmData.image1 && fmData.image2 && (
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-white/40 text-xs">Person 1</p>
                  <img src={fmData.image1} alt="" className="w-full h-24 object-cover rounded-lg border border-pink-400" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-white/40 text-xs">Person 2</p>
                  <img src={fmData.image2} alt="" className="w-full h-24 object-cover rounded-lg border border-pink-400" />
                </div>
              </div>
            )}

            {!iAmBuzzer && !someoneElseBuzzed && phase === "guessing" && (
              <button
                onTouchStart={handleBuzz}
                onClick={handleBuzz}
                disabled={hasBuzzed}
                className={`w-56 h-56 rounded-full font-black text-3xl transition-all select-none ${hasBuzzed ? "opacity-50 scale-95" : "active:scale-95 shadow-2xl"}`}
                style={{ backgroundColor: hasBuzzed ? "rgba(255,255,255,0.2)" : teamFg, color: hasBuzzed ? "rgba(255,255,255,0.5)" : teamBg, boxShadow: hasBuzzed ? "none" : `0 0 60px ${teamFg}66` }}
              >
                {hasBuzzed ? "…" : "BUZZ!"}
              </button>
            )}

            {iAmBuzzer && (
              <div className="text-center animate-pulse">
                <div className="text-5xl mb-2">🔔</div>
                <p className="text-2xl font-black text-white">YOU BUZZED FIRST!</p>
                <p className="text-white/60 text-sm">Waiting for host…</p>
              </div>
            )}

            {someoneElseBuzzed && buzzedBy && (
              <div className="text-center">
                <div className="text-4xl mb-2">🔕</div>
                <p className="text-white/60 font-bold">{buzzedBy.playerName} buzzed first!</p>
                <p className="text-white/40 text-sm">{buzzedBy.teamName}</p>
              </div>
            )}

            {phase === "revealed" && (
              <p className="text-yellow-400 font-bold text-center animate-pulse">Images revealed! What's your answer?</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
