import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Team, GameState, MysteryPuzzleData, MysteryPuzzleTeamView } from "@/lib/types";
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

  // Per-team column
  const TeamColumn = ({ team }: { team: Team }) => {
    const td: MysteryPuzzleTeamView | undefined = mpData.teamData[team.id];
    const colors = getTeamColors(team.color);
    const solverName = mpData.solverNamesByTeam[team.id];

    if (!td) {
      return (
        <div className={`rounded-2xl p-4 border-2 ${colors.border} bg-gray-900 flex items-center justify-center min-h-[200px]`}>
          <p className="text-gray-500 text-sm">No puzzle configured for {team.name}</p>
        </div>
      );
    }

    const allDigitsRevealed = td.clues.every((c) => c.digit !== null);

    return (
      <div className={`rounded-2xl p-4 border-2 ${colors.border} bg-gray-900 space-y-3`}>
        {/* Header: team + lock + solver */}
        <div className="flex items-center justify-between">
          <div>
            <p className={`font-black text-lg ${colors.text}`}>{team.name}</p>
            <p className="text-xs text-gray-400">🔑 Solver: <span className="font-bold text-white">{solverName || "—"}</span></p>
          </div>
          <div className="text-5xl">{td.vaultUnlocked ? "🔓" : "🔒"}</div>
        </div>

        {td.vaultUnlocked && (
          <div className="bg-green-950/50 border border-green-500 rounded-lg p-2 text-center">
            <p className="text-green-300 text-xs font-bold">VAULT CRACKED 🏆</p>
          </div>
        )}

        {td.story && (
          <div className="bg-gray-800/60 rounded-lg p-2">
            <p className="text-xs text-amber-400 font-bold uppercase mb-0.5">Story</p>
            <p className="text-white/80 text-xs leading-relaxed">{td.story}</p>
          </div>
        )}

        {/* Clues — each with two-stage reveal buttons */}
        <div className="space-y-1.5">
          {td.clues.map((clue, i) => (
            <div key={i} className={`rounded-lg p-2 border ${clue.digit !== null ? "border-green-600 bg-green-950/20" : clue.revealed ? "border-amber-500 bg-amber-950/20" : "border-gray-700 bg-gray-800/50"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-amber-400 font-bold mb-0.5">Clue {i + 1}</p>
                  <p className="text-white text-xs font-semibold leading-snug">
                    {clue.question || <span className="text-gray-600 italic">(empty)</span>}
                  </p>
                  {clue.digit !== null && (
                    <p className="text-green-300 text-xs mt-1">→ Digit: <span className="font-mono font-black text-base">{clue.digit}</span></p>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {!clue.revealed && (
                    <button
                      onClick={() => emit("admin:mystery_reveal_clue", { teamId: team.id, clueIndex: i })}
                      className="bg-amber-500 hover:bg-amber-400 text-black px-2 py-1 rounded text-[10px] font-black"
                    >
                      👁 Show clue
                    </button>
                  )}
                  {clue.revealed && clue.digit === null && (
                    <button
                      onClick={() => emit("admin:mystery_reveal_digit", { teamId: team.id, clueIndex: i })}
                      className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded text-[10px] font-black"
                    >
                      ✓ Reveal digit
                    </button>
                  )}
                  {clue.digit !== null && (
                    <span className="text-[10px] text-green-400 font-bold px-2 py-1">done ✓</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {allDigitsRevealed && !td.vaultUnlocked && (
          <div className="bg-amber-950/30 border border-amber-700 rounded p-2 text-center">
            <p className="text-amber-300 text-xs">All digits revealed. {solverName || "Solver"} now needs to enter them in the correct order on their phone.</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {winnerTeam && (
        <div className="bg-green-900 border-2 border-green-500 rounded-xl p-3 text-center animate-pulse">
          <p className="text-green-300 text-xs font-bold uppercase">Vault cracked!</p>
          <p className="text-2xl font-black text-white">🏆 {winnerTeam.name} wins +1 point</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {teams.slice(0, 2).map((team) => <TeamColumn key={team.id} team={team} />)}
      </div>

      {/* Attempts log (both teams combined) */}
      {mpData.attempts.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
          <p className="text-xs text-amber-400 font-bold uppercase mb-2">📊 Code Attempts</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {[...mpData.attempts].reverse().map((a, i) => {
              const team = teams.find((t) => t.id === a.teamId);
              const colors = team ? getTeamColors(team.color) : null;
              return (
                <div key={i} className={`flex items-center justify-between rounded px-2 py-1 text-xs border ${colors?.border || "border-gray-600"} bg-gray-900`}>
                  <span><span className="text-white">{a.playerName}</span> <span className={colors?.text || ""}>({team?.name})</span></span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white">{a.code}</span>
                    <span className={`font-bold ${a.correct ? "text-green-400" : "text-red-400"}`}>{a.correct ? "✓" : "✗"}</span>
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
