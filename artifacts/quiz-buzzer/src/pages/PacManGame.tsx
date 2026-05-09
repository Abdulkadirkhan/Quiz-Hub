import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { Team, GameState, PacmanData } from "@/lib/types";

interface GameResult { winner: "team1" | "team2" | "tie"; scores: [number, number]; }
interface Props {
  team1: Team;
  team2: Team;
  onGameEnd: (result: GameResult) => void;
  socket: Socket;
  sessionId: string;
  gameState: GameState;
}

const CELL = 22;

const TEAM_COLORS: Record<string, string> = {
  blue: "#60a5fa", red: "#f87171", green: "#4ade80",
  yellow: "#facc15", purple: "#c084fc", orange: "#fb923c",
};

export default function PacManGame({ team1, team2, onGameEnd, socket, sessionId: _sessionId, gameState: initialState }: Props) {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    const onTick = (state: GameState) => setGameState(state);
    const onFinished = ({ state, result }: { state: GameState; result: { teamScores: Record<string, number>; winnerTeamId: string | null } }) => {
      setGameState(state);
      if (finishedRef.current) return;
      finishedRef.current = true;
      const s1 = result.teamScores[team1.id] ?? 0;
      const s2 = result.teamScores[team2.id] ?? 0;
      const winner: "team1" | "team2" | "tie" = result.winnerTeamId === team1.id ? "team1" : result.winnerTeamId === team2.id ? "team2" : "tie";
      onGameEnd({ winner, scores: [s1, s2] });
    };
    socket.on("game:pacman_tick", onTick);
    socket.on("game:pacman_finished", onFinished);
    return () => {
      socket.off("game:pacman_tick", onTick);
      socket.off("game:pacman_finished", onFinished);
    };
  }, [socket, team1.id, team2.id, onGameEnd]);

  // Draw whenever state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = gameState.miniGameData as PacmanData | null;
    if (!data || !data.walls) return;

    canvas.width = data.cols * CELL;
    canvas.height = data.rows * CELL;

    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Maze walls + pellets
    for (let r = 0; r < data.rows; r++) {
      for (let c = 0; c < data.cols; c++) {
        const x = c * CELL; const y = r * CELL;
        if (data.walls[r]?.[c]) {
          ctx.fillStyle = "#1e3a5f"; ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          ctx.strokeStyle = "#2d5faa"; ctx.lineWidth = 1; ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
        } else if (data.pellets[r]?.[c]) {
          ctx.fillStyle = "#fbbf24"; ctx.beginPath();
          ctx.arc(x + CELL / 2, y + CELL / 2, 3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // Pac-Men
    for (const p of data.players) {
      const cx = p.x * CELL + CELL / 2; const cy = p.y * CELL + CELL / 2; const r = CELL / 2 - 2;
      const angle = (p.dir.x === 0 && p.dir.y === 0) ? 0 : Math.atan2(p.dir.y, p.dir.x);
      const mouth = p.mouthOpen ? 0.3 : 0.05;
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle + mouth, angle + Math.PI * 2 - mouth);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#0a0a1a"; ctx.beginPath();
      ctx.arc(cx + Math.cos(angle - 0.8) * (r * 0.5), cy + Math.sin(angle - 0.8) * (r * 0.5), 2, 0, Math.PI * 2);
      ctx.fill();
      // Name label below pac
      ctx.fillStyle = p.color; ctx.font = "bold 8px monospace"; ctx.textAlign = "center";
      ctx.fillText(p.name.slice(0, 8), cx, cy + r + 9);
    }
  }, [gameState]);

  const data = gameState.miniGameData as PacmanData | null;
  const remainingS = data ? Math.max(0, Math.ceil((data.remainingMs ?? 0) / 1000)) : 30;
  const team1Color = TEAM_COLORS[team1.color] || "#60a5fa";
  const team2Color = TEAM_COLORS[team2.color] || "#f87171";
  const score1 = data?.teamScores?.[team1.id] ?? 0;
  const score2 = data?.teamScores?.[team2.id] ?? 0;
  const players = data?.players ?? [];

  // Group players by team for the legend
  const team1Players = players.filter((p) => p.teamId === team1.id);
  const team2Players = players.filter((p) => p.teamId === team2.id);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-6 mb-1">
        <div className="text-center">
          <div className="text-xs font-bold" style={{ color: team1Color }}>{team1.name}</div>
          <div className="text-3xl font-black text-white">{score1}</div>
        </div>
        <div className="text-center">
          <div className={`text-2xl font-mono font-black ${remainingS <= 5 ? "text-red-400 animate-pulse" : "text-yellow-400"}`}>{remainingS}s</div>
        </div>
        <div className="text-center">
          <div className="text-xs font-bold" style={{ color: team2Color }}>{team2.name}</div>
          <div className="text-3xl font-black text-white">{score2}</div>
        </div>
      </div>

      <canvas ref={canvasRef} className="rounded-xl border-2 border-purple-700" style={{ imageRendering: "pixelated", maxWidth: "100%" }} />

      {/* Player legend */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-2xl">
        {[team1Players, team2Players].map((teamList, i) => {
          const t = i === 0 ? team1 : team2;
          const tColor = i === 0 ? team1Color : team2Color;
          return (
            <div key={t.id} className="bg-gray-800 rounded-lg p-2">
              <p className="text-xs font-bold mb-1" style={{ color: tColor }}>{t.name} ({teamList.length})</p>
              <div className="flex flex-wrap gap-1">
                {teamList.length === 0 && <span className="text-xs text-gray-500 italic">No players</span>}
                {teamList.map((p) => (
                  <span key={p.playerKey} className="text-xs px-1.5 py-0.5 rounded-full bg-gray-900 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-white/80">{p.name}</span>
                    <span className="text-white/50 font-mono">{p.score}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-gray-500 text-xs">All players play simultaneously • Each phone controls one Pac-Man • Team total wins!</p>
    </div>
  );
}
