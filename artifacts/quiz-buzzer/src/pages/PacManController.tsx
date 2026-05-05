import { useCallback } from "react";
import { Socket } from "socket.io-client";
import { Team } from "@/lib/types";

interface Props {
  team: Team;
  socket: Socket;
  sessionId: string;
  playerName: string;
}

const TEAM_BG: Record<string, string> = {
  blue: "#1e3a8a", red: "#7f1d1d", green: "#14532d",
  yellow: "#713f12", purple: "#4a1d96", orange: "#7c2d12",
};
const TEAM_FG: Record<string, string> = {
  blue: "#60a5fa", red: "#f87171", green: "#4ade80",
  yellow: "#facc15", purple: "#c084fc", orange: "#fb923c",
};

export default function PacManController({ team, socket, sessionId, playerName }: Props) {
  const teamBg = TEAM_BG[team.color] || "#1f2937";
  const teamFg = TEAM_FG[team.color] || "#ffffff";

  const sendDir = useCallback((dir: "up" | "down" | "left" | "right") => {
    socket.emit("pacman:direction", { sessionId, teamId: team.id, direction: dir });

    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }, [socket, sessionId, team.id]);

  const DirBtn = ({ dir, label, className }: { dir: "up" | "down" | "left" | "right"; label: string; className?: string }) => (
    <button
      onTouchStart={(e) => { e.preventDefault(); sendDir(dir); }}
      onClick={() => sendDir(dir)}
      className={`w-20 h-20 rounded-2xl font-black text-3xl select-none active:scale-95 transition-transform flex items-center justify-center ${className || ""}`}
      style={{ backgroundColor: teamFg, color: teamBg }}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: teamBg }}>
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">👾</div>
        <h2 className="text-2xl font-black text-white">PAC-MAN!</h2>
        <p className="text-sm mt-1" style={{ color: teamFg + "bb" }}>
          {playerName} — {team.name}
        </p>
        <p className="text-xs text-white/40 mt-1">Eat the most dots to win!</p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <DirBtn dir="up" label="↑" />
        <div className="flex gap-2">
          <DirBtn dir="left" label="←" />
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center opacity-20" style={{ backgroundColor: teamFg }}>
            <span className="text-3xl" style={{ color: teamBg }}>●</span>
          </div>
          <DirBtn dir="right" label="→" />
        </div>
        <DirBtn dir="down" label="↓" />
      </div>

      <p className="mt-8 text-white/30 text-xs text-center">
        Tap a direction to move your Pac-Man
      </p>
    </div>
  );
}
