import { useEffect, useRef, useCallback, useState } from "react";
import { Socket } from "socket.io-client";
import { Team } from "@/lib/types";

interface PacManPlayer {
  x: number; y: number;
  dir: { x: number; y: number };
  nextDir: { x: number; y: number };
  score: number; color: string; mouthOpen: boolean;
}

interface GameResult { winner: "team1" | "team2" | "tie"; scores: [number, number]; }
interface Props { team1: Team; team2: Team; onGameEnd: (result: GameResult) => void; socket: Socket; sessionId: string; }

const CELL = 24;
const COLS = 21;
const ROWS = 19;

const TEAM_COLORS: Record<string, string> = {
  blue: "#60a5fa", red: "#f87171", green: "#4ade80",
  yellow: "#facc15", purple: "#c084fc", orange: "#fb923c",
};

const MAZE_TEMPLATE = [
  "#####################",
  "#........#..........#",
  "#.##.###.#.###.##.###",
  "#...................#",
  "#.##.#.#####.#.##.##",
  "#....#...#...#....##",
  "####.###.#.###.#####",
  "#....#.......#.....#",
  "#.##.#.#####.#.##.##",
  "#...................#",
  "#.##.###.#.###.##.###",
  "#........#..........#",
  "#.##.###.#.###.##.###",
  "#...................#",
  "#.##.#.#####.#.##.##",
  "#....#...#...#....##",
  "#...................#",
  "#........#..........#",
  "#####################",
];

function buildMaze(): { walls: boolean[][]; pellets: boolean[][] } {
  const walls: boolean[][] = [];
  const pellets: boolean[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const wallRow: boolean[] = [];
    const pelletRow: boolean[] = [];
    const rowStr = (MAZE_TEMPLATE[r] || "#####################").padEnd(COLS, "#");
    for (let c = 0; c < COLS; c++) {
      const ch = rowStr[c];
      wallRow.push(ch === "#");
      pelletRow.push(ch === ".");
    }
    walls.push(wallRow);
    pellets.push(pelletRow);
  }
  return { walls, pellets };
}

export default function PacManGame({ team1, team2, onGameEnd, socket, sessionId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [waiting, setWaiting] = useState(true);
  const stateRef = useRef({
    walls: [] as boolean[][], pellets: [] as boolean[][], originalPellets: [] as boolean[][],
    player1: null as PacManPlayer | null, player2: null as PacManPlayer | null,
    running: false, intervalId: null as ReturnType<typeof setInterval> | null,
    timerIntervalId: null as ReturnType<typeof setInterval> | null,
    animFrame: 0, ended: false, timeLeftInt: 30,
  });

  const team1Color = TEAM_COLORS[team1.color] || "#60a5fa";
  const team2Color = TEAM_COLORS[team2.color] || "#f87171";

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    const { walls, pellets, player1, player2 } = s;
    if (!player1 || !player2) return;

    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * CELL; const y = r * CELL;
        if (walls[r]?.[c]) {
          ctx.fillStyle = "#1e3a5f"; ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          ctx.strokeStyle = "#2d5faa"; ctx.lineWidth = 1; ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
        } else if (pellets[r]?.[c]) {
          ctx.fillStyle = "#fbbf24"; ctx.beginPath();
          ctx.arc(x + CELL / 2, y + CELL / 2, 3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    const drawPacMan = (p: PacManPlayer, color: string) => {
      const cx = p.x * CELL + CELL / 2; const cy = p.y * CELL + CELL / 2; const r = CELL / 2 - 2;
      const angle = (p.dir.x === 0 && p.dir.y === 0) ? 0 : Math.atan2(p.dir.y, p.dir.x);
      const mouth = p.mouthOpen ? 0.3 : 0.05;
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle + mouth, angle + Math.PI * 2 - mouth);
      ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#0a0a1a"; ctx.beginPath();
      ctx.arc(cx + Math.cos(angle - 0.8) * (r * 0.5), cy + Math.sin(angle - 0.8) * (r * 0.5), 2, 0, Math.PI * 2);
      ctx.fill();
    };

    drawPacMan(player1, team1Color);
    drawPacMan(player2, team2Color);
  }, [team1Color, team2Color]);

  const tryMove = useCallback((player: PacManPlayer, dir: { x: number; y: number }): { x: number; y: number } | null => {
    if (dir.x === 0 && dir.y === 0) return null;
    const nx = player.x + dir.x; const ny = player.y + dir.y;
    const s = stateRef.current;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return null;
    if (s.walls[ny]?.[nx]) return null;
    return { x: nx, y: ny };
  }, []);

  const gameLoop = useCallback(() => {
    const s = stateRef.current;
    if (!s.running || s.ended) return;
    s.animFrame++;

    const tick = (player: PacManPlayer) => {
      const tryNext = tryMove(player, player.nextDir);
      if (tryNext) {
        player.dir = { ...player.nextDir };
        player.x = tryNext.x; player.y = tryNext.y;
      } else {
        const tryCur = tryMove(player, player.dir);
        if (tryCur) { player.x = tryCur.x; player.y = tryCur.y; }
        else return;
      }
      if (s.pellets[player.y]?.[player.x]) {
        s.pellets[player.y][player.x] = false;
        player.score++;
      }
      player.mouthOpen = s.animFrame % 6 < 3;
    };

    if (s.player1) tick(s.player1);
    if (s.player2) tick(s.player2);

    let pelletCount = 0;
    for (const row of s.pellets) for (const p of row) if (p) pelletCount++;
    if (pelletCount === 0) {
      const { pellets: fresh } = buildMaze();
      s.pellets = fresh;
    }

    setScores([s.player1?.score ?? 0, s.player2?.score ?? 0]);
    draw();
  }, [tryMove, draw]);

  const endGame = useCallback(() => {
    const s = stateRef.current;
    if (s.ended) return;
    s.ended = true; s.running = false;
    if (s.intervalId) clearInterval(s.intervalId);
    if (s.timerIntervalId) clearInterval(s.timerIntervalId);
    const s1 = s.player1?.score ?? 0; const s2 = s.player2?.score ?? 0;
    const winner: "team1" | "team2" | "tie" = s1 > s2 ? "team1" : s2 > s1 ? "team2" : "tie";
    onGameEnd({ winner, scores: [s1, s2] });
  }, [onGameEnd]);

  useEffect(() => {
    const { walls, pellets } = buildMaze();
    const s = stateRef.current;
    s.walls = walls; s.pellets = pellets;
    s.originalPellets = pellets.map((row) => [...row]);
    s.ended = false; s.animFrame = 0; s.timeLeftInt = 30;
    setTimeLeft(30); setScores([0, 0]); setWaiting(true);

    s.player1 = { x: 1, y: 1, dir: { x: 0, y: 0 }, nextDir: { x: 0, y: 0 }, score: 0, color: team1Color, mouthOpen: true };
    s.player2 = { x: COLS - 2, y: ROWS - 2, dir: { x: 0, y: 0 }, nextDir: { x: 0, y: 0 }, score: 0, color: team2Color, mouthOpen: true };

    draw();

    const countdown = setTimeout(() => {
      setWaiting(false);
      s.running = true;
      s.intervalId = setInterval(gameLoop, 150);
      s.timerIntervalId = setInterval(() => {
        s.timeLeftInt -= 1;
        setTimeLeft(s.timeLeftInt);
        if (s.timeLeftInt <= 0) {
          clearInterval(s.timerIntervalId!);
          clearInterval(s.intervalId!);
          endGame();
        }
      }, 1000);
    }, 3000);

    return () => {
      clearTimeout(countdown);
      if (s.intervalId) clearInterval(s.intervalId);
      if (s.timerIntervalId) clearInterval(s.timerIntervalId);
    };
  }, [team1Color, team2Color, gameLoop, endGame, draw]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (!s.player1 || !s.player2) return;
      const p1Dirs: Record<string, { x: number; y: number }> = { w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 } };
      const p2Dirs: Record<string, { x: number; y: number }> = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 } };
      if (p1Dirs[e.key]) { s.player1.nextDir = p1Dirs[e.key]; e.preventDefault(); }
      if (p2Dirs[e.key]) { s.player2.nextDir = p2Dirs[e.key]; e.preventDefault(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleDirection = (data: { teamId: string; direction: string }) => {
      const s = stateRef.current;
      const dirMap: Record<string, { x: number; y: number }> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
      const dir = dirMap[data.direction];
      if (!dir) return;
      if (data.teamId === team1.id && s.player1) s.player1.nextDir = dir;
      else if (data.teamId === team2.id && s.player2) s.player2.nextDir = dir;
    };
    socket.on("pacman:direction", handleDirection);
    return () => { socket.off("pacman:direction", handleDirection); };
  }, [socket, team1.id, team2.id]);

  return (
    <div className="flex flex-col items-center gap-3">
      {waiting && (
        <div className="text-center mb-1 animate-pulse">
          <p className="text-yellow-400 font-black text-xl">Get Ready! Game starts in 3s…</p>
          <p className="text-gray-400 text-sm mt-1">Press a direction on your phone to start moving!</p>
        </div>
      )}
      <div className="flex items-center gap-6 mb-1">
        <div className="text-center">
          <div className="text-xs font-bold" style={{ color: team1Color }}>{team1.name}</div>
          <div className="text-3xl font-black text-white">{scores[0]}</div>
        </div>
        <div className="text-center">
          <div className={`text-2xl font-mono font-black ${timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-yellow-400"}`}>{timeLeft}s</div>
        </div>
        <div className="text-center">
          <div className="text-xs font-bold" style={{ color: team2Color }}>{team2.name}</div>
          <div className="text-3xl font-black text-white">{scores[1]}</div>
        </div>
      </div>
      <canvas ref={canvasRef} width={COLS * CELL} height={ROWS * CELL} className="rounded-xl border-2 border-purple-700" style={{ imageRendering: "pixelated", maxWidth: "100%" }} />
      <p className="text-gray-500 text-xs">Dots respawn infinitely • Admin: WASD / Arrow keys • Players: phone D-pad</p>
    </div>
  );
}
