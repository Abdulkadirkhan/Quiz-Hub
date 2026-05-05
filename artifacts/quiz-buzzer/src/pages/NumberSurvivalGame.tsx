import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { GameState, NumberSurvivalData, Team } from "@/lib/types";

interface Props {
  teams: Team[];
  socket: Socket;
  sessionId: string;
  gameState: GameState;
  onEnd: (winnerTeamId?: string) => void;
}

const TEAM_FG: Record<string, string> = {
  blue: "#60a5fa", red: "#f87171", green: "#4ade80",
  yellow: "#facc15", purple: "#c084fc", orange: "#fb923c",
};

export default function NumberSurvivalGame({ teams, socket, sessionId, gameState, onEnd }: Props) {
  const [localState, setLocalState] = useState<GameState>(gameState);

  useEffect(() => {
    setLocalState(gameState);
  }, [gameState]);

  useEffect(() => {
    const onUpdate = (state: GameState) => setLocalState(state);
    socket.on("game:number_update", onUpdate);
    socket.on("game:number_result", onUpdate);
    socket.on("game:number_next_round", onUpdate);
    socket.on("game:number_done", onUpdate);
    return () => {
      socket.off("game:number_update", onUpdate);
      socket.off("game:number_result", onUpdate);
      socket.off("game:number_next_round", onUpdate);
      socket.off("game:number_done", onUpdate);
    };
  }, [socket]);

  const data = localState.miniGameData as NumberSurvivalData | null;
  if (!data) return null;

  const { round, totalRounds, phase, selectedCount, totalSurvivors, teamSurvivors, currentResult, history } = data;

  const forceResolve = () => {
    socket.emit("admin:number_resolve", { sessionId });
  };

  const nextRound = () => {
    socket.emit("admin:number_next_round", { sessionId });
  };

  const endGame = () => {
    const survivorCounts = teams.map((t) => ({ team: t, count: (teamSurvivors[t.id] || []).length }));
    survivorCounts.sort((a, b) => b.count - a.count);
    const winner = survivorCounts[0];
    const isTie = survivorCounts.length > 1 && survivorCounts[0].count === survivorCounts[1].count;
    onEnd(isTie ? undefined : winner?.team.id);
  };

  const isDone = phase === "done";

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-sm text-gray-400 mb-1">Round {round} of {totalRounds} • {totalSurvivors} survivors remaining</div>
        <div className="flex justify-center gap-2 mb-3">
          {[...Array(totalRounds)].map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full ${i < round - 1 ? "bg-gray-600" : i === round - 1 ? "bg-orange-400" : "bg-gray-800"}`} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {teams.map((team) => {
          const survivors = teamSurvivors[team.id] || [];
          return (
            <div key={team.id} className="bg-gray-800 rounded-xl p-3 text-center">
              <div className="text-2xl font-black" style={{ color: TEAM_FG[team.color] || "#fff" }}>
                {survivors.length}
              </div>
              <div className="text-xs text-gray-400 mb-1">{team.name}</div>
              <div className="flex flex-wrap gap-1 justify-center">
                {survivors.map((name, i) => (
                  <span key={i} className="text-xs bg-gray-700 px-2 py-0.5 rounded-full text-white">{name}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {phase === "selecting" && (
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-white font-bold text-lg mb-1">Players are picking numbers…</p>
          <div className="text-gray-400 text-sm mb-3">
            <span className="text-yellow-400 font-black text-2xl">{selectedCount}</span>
            <span className="text-gray-500"> / {totalSurvivors}</span>
            <span className="text-gray-400"> chosen</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
            <div
              className="bg-yellow-400 h-2 rounded-full transition-all"
              style={{ width: totalSurvivors > 0 ? `${(selectedCount / totalSurvivors) * 100}%` : "0%" }}
            />
          </div>
          <button
            onClick={forceResolve}
            className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-xl font-bold text-sm"
          >
            Force Resolve Now ({selectedCount} chosen)
          </button>
        </div>
      )}

      {phase === "revealing" && currentResult && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h4 className="text-white font-bold text-center mb-3">Round {currentResult.round} Results</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {currentResult.choices.map((c) => {
              const isEliminated = currentResult.eliminated.includes(c.socketId);
              const teamColor = TEAM_FG[teams.find(t => t.id === c.teamId)?.color || "blue"] || "#fff";
              return (
                <div
                  key={c.socketId}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 ${isEliminated ? "bg-red-950/60 opacity-70" : "bg-green-950/60"}`}
                >
                  <span className="text-2xl">{c.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold truncate">{c.name}</p>
                    <p className="text-xs" style={{ color: teamColor }}>{teams.find(t => t.id === c.teamId)?.name}</p>
                  </div>
                  <div className={`text-2xl font-black ${isEliminated ? "text-red-400 line-through" : "text-green-400"}`}>
                    {c.number}
                  </div>
                  {isEliminated && <span className="text-red-400 text-xl">💀</span>}
                  {!isEliminated && <span className="text-green-400 text-xl">✅</span>}
                </div>
              );
            })}
          </div>
          {!isDone && (
            <button onClick={nextRound} className="w-full bg-yellow-400 text-black font-black py-3 rounded-xl text-lg hover:bg-yellow-300">
              Next Round →
            </button>
          )}
          {isDone && (
            <button onClick={endGame} className="w-full bg-green-500 text-white font-black py-3 rounded-xl text-lg hover:bg-green-400">
              Finish & Award Point 🏆
            </button>
          )}
        </div>
      )}

      {isDone && (
        <div className="text-center">
          <button onClick={endGame} className="bg-green-500 text-white font-black px-8 py-3 rounded-xl text-lg hover:bg-green-400">
            Finish & Award Point 🏆
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-3">
          <p className="text-gray-500 text-xs font-bold mb-2">ROUND HISTORY</p>
          <div className="space-y-1">
            {history.map((r) => (
              <div key={r.round} className="flex items-center gap-2 text-xs text-gray-400">
                <span className="text-gray-600">Round {r.round}:</span>
                <span className="text-red-400">{r.eliminated.length} eliminated</span>
                {teams.map(t => (
                  <span key={t.id} style={{ color: TEAM_FG[t.color] }}>
                    {t.name}: {r.survivorsByTeam[t.id] ?? 0}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
