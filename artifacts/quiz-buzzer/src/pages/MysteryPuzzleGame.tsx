import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Team, GameState, MysteryPuzzleData } from "@/lib/types";
import { getTeamColors } from "@/lib/teamColors";

interface Props {
  teams: Team[];
  socket: Socket;
  sessionId: string;
  gameState: GameState;
  onEnd: (winnerTeamId?: string) => void;
}

export default function MysteryPuzzleGame({ teams, socket, sessionId, gameState: initialState, onEnd }: Props) {
  const [gameState, setGameState] = useState<GameState>(initialState);

  useEffect(() => {
    const handler = (state: GameState) => setGameState(state);
    socket.on("game:mystery_updated", handler);
    socket.on("game:score_update", handler);
    return () => {
      socket.off("game:mystery_updated", handler);
      socket.off("game:score_update", handler);
    };
  }, [socket]);

  const mpData = gameState.miniGameData as MysteryPuzzleData | null;
  if (!mpData) return null;

  const emit = (event: string, data?: object) => socket.emit(event, { sessionId, ...data });

  const winnerTeam = mpData.winnerTeamId ? teams.find((t) => t.id === mpData.winnerTeamId) : null;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* 2 decorative locks */}
      <div className="flex items-center justify-center gap-8 py-2">
        <div className={`text-6xl transition-all ${mpData.vaultRevealed ? "" : "opacity-90"}`}>
          {mpData.vaultRevealed ? "🔓" : "🔒"}
        </div>
        <div className="text-center">
          <p className="text-xs text-amber-400 font-bold uppercase">Vault Code</p>
          <p className="font-mono text-3xl font-black tracking-widest text-amber-300">{mpData.vaultCode || "????"}</p>
        </div>
        <div className={`text-6xl transition-all ${mpData.vaultRevealed ? "" : "opacity-90"}`}>
          {mpData.vaultRevealed ? "🔓" : "🔒"}
        </div>
      </div>

      {winnerTeam && (
        <div className="bg-green-900 border-2 border-green-500 rounded-xl p-4 text-center animate-pulse">
          <p className="text-green-300 text-xs font-bold uppercase">Vault cracked!</p>
          <p className="text-2xl font-black text-white">🏆 {winnerTeam.name} wins</p>
        </div>
      )}

      {mpData.story && (
        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
          <p className="text-xs text-amber-400 font-bold uppercase mb-1">📖 Story</p>
          <p className="text-white text-sm leading-relaxed">{mpData.story}</p>
        </div>
      )}

      {/* Solver assignments */}
      <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
        <p className="text-xs text-amber-400 font-bold uppercase mb-2">🎯 Selected solvers (only they can submit on their team)</p>
        <div className="grid grid-cols-2 gap-2">
          {teams.map((team) => {
            const solverName = mpData.solverNamesByTeam[team.id];
            const colors = getTeamColors(team.color);
            return (
              <div key={team.id} className={`rounded-lg p-2 border ${colors.border} bg-gray-900`}>
                <p className={`text-xs font-bold ${colors.text}`}>{team.name}</p>
                <p className="text-white text-sm font-bold mt-0.5">
                  {solverName ? `🔑 ${solverName}` : <span className="text-gray-500">No players joined</span>}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clues with reveal-clue buttons */}
      <div className="space-y-2">
        <p className="text-xs text-amber-400 font-bold uppercase">🧩 Clues — click to reveal each one to spectators/players</p>
        {mpData.clues.map((clue, i) => {
          const isRevealed = mpData.revealedClues.includes(i);
          return (
            <div key={i} className={`rounded-xl p-3 border-2 ${isRevealed ? "border-green-700 bg-green-950/20" : "border-gray-700 bg-gray-800"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs text-amber-400 font-bold mb-1">Clue {i + 1} → digit position {i + 1}</p>
                  <p className="text-white text-sm font-bold">{clue.question || <span className="text-gray-500 italic">(no question text)</span>}</p>
                  {clue.answer && (
                    <p className="text-xs text-gray-400 mt-1">Answer hint: <span className="text-white">{clue.answer}</span></p>
                  )}
                  <p className="text-amber-300 text-sm mt-1">→ Digit: <span className="font-mono font-black text-lg">{clue.reward}</span></p>
                </div>
                <button
                  onClick={() => emit("admin:mystery_reveal_answer", { clueIndex: i })}
                  disabled={isRevealed}
                  className={`px-3 py-2 rounded-lg font-bold text-xs transition flex-shrink-0 ${isRevealed ? "bg-green-700 text-green-200 cursor-default" : "bg-amber-500 hover:bg-amber-400 text-black"}`}
                >
                  {isRevealed ? "✓ Revealed" : "👁 Reveal"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Attempts log */}
      {mpData.attempts.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
          <p className="text-xs text-amber-400 font-bold uppercase mb-2">📊 Code Attempts</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {[...mpData.attempts].reverse().map((a, i) => {
              const team = teams.find((t) => t.id === a.teamId);
              const colors = team ? getTeamColors(team.color) : null;
              return (
                <div key={i} className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm border ${colors?.border || "border-gray-600"} bg-gray-900`}>
                  <span className="flex items-center gap-2">
                    <span className="text-white text-xs">{a.playerName}</span>
                    <span className={`text-xs ${colors?.text || "text-gray-400"}`}>({team?.name})</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white">{a.code || "—"}</span>
                    <span className={`text-xs font-bold ${a.correct ? "text-green-400" : "text-red-400"}`}>
                      {a.correct ? "✓ correct" : "✗ wrong"}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-center pt-2">
        {!winnerTeam && teams.map((team) => {
          const colors = getTeamColors(team.color);
          return (
            <button key={team.id} onClick={() => onEnd(team.id)} className={`${colors.button} text-white px-5 py-2.5 rounded-xl font-black text-sm transition`}>
              🏆 {team.name} Wins
            </button>
          );
        })}
        <button onClick={() => onEnd(winnerTeam?.id)} className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition">
          End Mini-Game
        </button>
        <button onClick={() => onEnd(undefined)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition">
          No Winner
        </button>
      </div>
    </div>
  );
}
