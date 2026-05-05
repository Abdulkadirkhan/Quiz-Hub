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

interface PlayerAnswer {
  socketId: string; name: string; teamId: string; avatar: string;
  answer: string; clueIndex: number; timestamp: number;
}

const CLUE_ICONS = ["🧩", "🔤", "🔢", "🧠", "🎯", "💡"];

export default function MysteryPuzzleGame({ teams, socket, sessionId, gameState: initialState, onEnd }: Props) {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [answers, setAnswers] = useState<PlayerAnswer[]>([]);

  const mpData = gameState.miniGameData as MysteryPuzzleData | null;

  useEffect(() => {
    const handler = (state: GameState) => setGameState(state);
    socket.on("game:mystery_updated", handler);
    socket.on("mystery:player_answer", (data: Omit<PlayerAnswer, "timestamp">) => {
      setAnswers((prev) => {
        const filtered = prev.filter((a) => !(a.socketId === data.socketId && a.clueIndex === data.clueIndex));
        return [...filtered, { ...data, timestamp: Date.now() }];
      });
    });
    return () => {
      socket.off("game:mystery_updated", handler);
      socket.off("mystery:player_answer");
    };
  }, [socket]);

  if (!mpData) return null;

  const emit = (event: string, data?: object) => socket.emit(event, { sessionId, ...data });

  const currentAnswers = answers.filter((a) => a.clueIndex === mpData.currentClueIndex);
  const currentClue = mpData.currentClueIndex >= 0 ? mpData.clues[mpData.currentClueIndex] : null;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <p className="text-xs text-teal-400 font-bold uppercase mb-1">📖 Story</p>
        <p className="text-white text-sm leading-relaxed">{mpData.story}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => emit("admin:mystery_show_clue", { clueIndex: -1 })}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${mpData.currentClueIndex === -1 ? "bg-teal-600 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-300"}`}
        >
          Story
        </button>
        {mpData.clues.map((clue, i) => (
          <button
            key={i}
            onClick={() => emit("admin:mystery_show_clue", { clueIndex: i })}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${mpData.currentClueIndex === i ? "bg-teal-600 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-300"}`}
          >
            {CLUE_ICONS[i]} Clue {i + 1}
            {mpData.revealedClues.includes(i) && " ✅"}
          </button>
        ))}
      </div>

      {currentClue && (
        <div className="bg-gray-800 rounded-xl p-4 border-2 border-teal-700 space-y-3">
          <p className="text-teal-400 font-black text-sm uppercase">
            {CLUE_ICONS[mpData.currentClueIndex]} Clue {mpData.currentClueIndex + 1}
          </p>
          <p className="text-white font-bold text-lg leading-snug">{currentClue.question}</p>

          <div className={`p-3 rounded-lg ${mpData.revealedClues.includes(mpData.currentClueIndex) ? "bg-green-900 border border-green-600" : "bg-gray-700 border border-gray-600"}`}>
            <p className="text-xs text-gray-400 font-semibold mb-1">Answer</p>
            <p className={`font-black text-lg ${mpData.revealedClues.includes(mpData.currentClueIndex) ? "text-green-300" : "text-gray-500"}`}>
              {mpData.revealedClues.includes(mpData.currentClueIndex) ? currentClue.answer : "• • • • • •"}
            </p>
            {currentClue.reward && (
              <p className="text-yellow-400 text-sm font-bold mt-1">Code: {mpData.revealedClues.includes(mpData.currentClueIndex) ? currentClue.reward : "?"}</p>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {!mpData.revealedClues.includes(mpData.currentClueIndex) && (
              <button
                onClick={() => emit("admin:mystery_reveal_answer", { clueIndex: mpData.currentClueIndex })}
                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition"
              >
                ✅ Reveal Answer
              </button>
            )}
          </div>

          {currentAnswers.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase mb-2">Team Submissions</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {currentAnswers.map((a, i) => {
                  const team = teams.find((t) => t.id === a.teamId);
                  const colors = team ? getTeamColors(team.color) : null;
                  return (
                    <div key={i} className={`flex items-center justify-between bg-gray-700 rounded-lg px-3 py-2 text-sm border ${colors?.border || "border-gray-600"}`}>
                      <span className="flex items-center gap-2">
                        <span>{a.avatar}</span>
                        <span className="text-white font-bold">{a.name}</span>
                        <span className={`text-xs ${colors?.text || "text-gray-400"}`}>{team?.name}</span>
                      </span>
                      <span className="text-yellow-300 font-mono font-bold">{a.answer}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-800 rounded-xl p-4 border border-yellow-700">
        <p className="text-yellow-400 font-black text-sm uppercase mb-2">🔐 Vault Code</p>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {mpData.clues.map((clue, i) => (
              <span key={i} className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg border-2 ${mpData.revealedClues.includes(i) ? "border-yellow-400 text-yellow-300 bg-yellow-950" : "border-gray-600 text-gray-600 bg-gray-700"}`}>
                {mpData.revealedClues.includes(i) ? clue.reward : "?"}
              </span>
            ))}
          </div>
          {!mpData.vaultRevealed ? (
            <button
              onClick={() => emit("admin:mystery_reveal_vault")}
              className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg font-black text-sm transition"
            >
              🔓 Reveal Vault
            </button>
          ) : (
            <span className="text-yellow-300 font-black text-2xl animate-pulse">🎉 {mpData.vaultCode}</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-center pt-2">
        {teams.map((team) => {
          const colors = getTeamColors(team.color);
          return (
            <button key={team.id} onClick={() => onEnd(team.id)} className={`${colors.button} text-white px-5 py-2.5 rounded-xl font-black text-sm transition`}>
              🏆 {team.name} Wins
            </button>
          );
        })}
        <button onClick={() => onEnd(undefined)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition">
          End Game
        </button>
      </div>
    </div>
  );
}
