import { useCallback, useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { Team, GameState, PacmanData } from "@/lib/types";

interface Props {
  team: Team;
  socket: Socket;
  sessionId: string;
  playerName: string;
  avatar: string;
  gameState: GameState;
  mySocketId?: string;
}

const TEAM_BG: Record<string, string> = {
  blue: "#1e3a8a", red: "#7f1d1d", green: "#14532d",
  yellow: "#713f12", purple: "#4a1d96", orange: "#7c2d12",
};

export default function PacManController({ team, socket, sessionId, playerName, avatar, gameState: initialState }: Props) {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const teamBg = TEAM_BG[team.color] || "#1f2937";

  useEffect(() => {
    const onTick = (state: GameState) => setGameState(state);
    const onFinished = ({ state }: { state: GameState }) => setGameState(state);
    socket.on("game:pacman_tick", onTick);
    socket.on("game:pacman_finished", onFinished);
    socket.on("game:minigame_ended", onTick);
    return () => {
      socket.off("game:pacman_tick", onTick);
      socket.off("game:pacman_finished", onFinished);
      socket.off("game:minigame_ended", onTick);
    };
  }, [socket]);

  const sendDir = useCallback((dir: "up" | "down" | "left" | "right") => {
    socket.emit("pacman:direction", { sessionId, direction: dir });
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }, [socket, sessionId]);

  const data = gameState.miniGameData as PacmanData | null;
  // Find this player's pacman by name (we don't have playerKey on the socket id, but the server-side player key is what we want)
  // Match by name + teamId; this is unique enough within a team
  const myPacMan = data?.players.find((p) => p.teamId === team.id && p.name === playerName);
  const myColor = myPacMan?.color || "#facc15";
  const myScore = myPacMan?.score ?? 0;
  const teamScore = data?.teamScores?.[team.id] ?? 0;
  const remainingS = data ? Math.max(0, Math.ceil((data.remainingMs ?? 0) / 1000)) : 0;
  const ended = data?.ended ?? false;

  // Cross-team scoreboard
  const teamScores = data?.teamScores ?? {};

  // Game outcome
  let outcomeLabel: string | null = null;
  let outcomeColor: string = "#fff";
  if (ended && data) {
    let best = -1; let winner: string | null = null; let tied = false;
    for (const [tid, sc] of Object.entries(teamScores)) {
      if (sc > best) { best = sc; winner = tid; tied = false; }
      else if (sc === best) tied = true;
    }
    if (tied) { outcomeLabel = "Round complete"; outcomeColor = "#facc15"; }
    else if (winner === team.id) { outcomeLabel = "Round Won!"; outcomeColor = "#4ade80"; }
    else { outcomeLabel = "Round Lost"; outcomeColor = "#f87171"; }
  }

  const DirBtn = ({ dir, label }: { dir: "up" | "down" | "left" | "right"; label: string }) => (
    <button
      onTouchStart={(e) => { e.preventDefault(); sendDir(dir); }}
      onClick={() => sendDir(dir)}
      disabled={ended}
      className="w-20 h-20 rounded-2xl font-black text-3xl select-none active:scale-95 transition-transform flex items-center justify-center disabled:opacity-30"
      style={{ backgroundColor: myColor, color: "#0a0a1a" }}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: teamBg }}>
      <div className="text-center mb-4">
        <div className="text-3xl mb-1">{avatar}</div>
        <p className="text-xs text-white/50">{playerName} — {team.name}</p>

        {/* Player's color identification */}
        <div className="mt-3 flex items-center justify-center gap-2">
          <div className="text-3xl" style={{ filter: `drop-shadow(0 0 8px ${myColor})` }}>👾</div>
          <div className="text-left">
            <p className="text-xs text-white/50">You are</p>
            <p className="font-black text-base" style={{ color: myColor }}>your colored Pac-Man</p>
          </div>
          <div className="w-8 h-8 rounded-full border-2 border-white/40" style={{ backgroundColor: myColor }} />
        </div>
      </div>

      {/* Live scores */}
      <div className="bg-black/40 rounded-2xl px-4 py-3 mb-4 w-full max-w-xs">
        <div className="flex items-center justify-between text-white text-sm">
          <span>Your dots: <span className="font-black" style={{ color: myColor }}>{myScore}</span></span>
          <span className={`font-mono font-black ${remainingS <= 5 ? "text-red-400 animate-pulse" : "text-yellow-400"}`}>{remainingS}s</span>
        </div>
        <div className="border-t border-white/10 my-2" />
        <div className="flex justify-between text-xs">
          {gameState.teams.map((t) => (
            <div key={t.id} className="text-center">
              <div className="text-white/50">{t.name}</div>
              <div className="font-black text-white text-lg">{teamScores[t.id] ?? 0}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Outcome banner */}
      {ended && outcomeLabel && (
        <div className="rounded-xl px-6 py-3 mb-4 border-2" style={{ borderColor: outcomeColor, backgroundColor: outcomeColor + "20" }}>
          <p className="font-black text-2xl" style={{ color: outcomeColor }}>{outcomeLabel}</p>
        </div>
      )}

      {/* D-pad */}
      <div className="flex flex-col items-center gap-2">
        <DirBtn dir="up" label="↑" />
        <div className="flex gap-2">
          <DirBtn dir="left" label="←" />
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center opacity-30" style={{ backgroundColor: myColor }}>
            <span className="text-2xl">●</span>
          </div>
          <DirBtn dir="right" label="→" />
        </div>
        <DirBtn dir="down" label="↓" />
      </div>

      <p className="mt-6 text-white/30 text-xs text-center max-w-xs">
        Tap a direction to move your Pac-Man and eat dots. Your team total wins the round!
      </p>
    </div>
  );
}
