import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { getSocket } from "@/lib/socket";
import { GameState } from "@/lib/types";
import { getTeamColors } from "@/lib/teamColors";

const TEAM_FG: Record<string, string> = {
  blue: "#60a5fa", red: "#f87171", green: "#4ade80",
  yellow: "#facc15", purple: "#c084fc", orange: "#fb923c",
};

export default function SpectatorView() {
  const [, params] = useRoute("/watch/:sessionId");
  const sessionId = params?.sessionId || "";
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState("");
  const socketRef = useRef(getSocket());

  useEffect(() => {
    const socket = socketRef.current;

    socket.emit("spectator:join", { sessionId }, (res: { success: boolean; error?: string; state: GameState }) => {
      if (res.success) {
        setGameState(res.state);
      } else {
        setError(res.error || "Session not found");
      }
    });

    const onState = (state: GameState) => setGameState(state);
    const onQuestion = ({ state }: { state: GameState }) => setGameState(state);
    const onBuzzed = ({ state }: { state: GameState }) => setGameState(state);

    socket.on("game:started", onState);
    socket.on("game:question", onQuestion);
    socket.on("game:buzzed", onBuzzed);
    socket.on("game:score_update", onState);
    socket.on("game:round_end", onState);
    socket.on("game:finished", onState);
    socket.on("game:buzz_reset", onState);
    socket.on("game:minigame_started", onState);
    socket.on("game:minigame_ended", onState);
    socket.on("game:player_joined", onState);
    socket.on("game:player_left", onState);
    socket.on("game:number_update", onState);
    socket.on("game:number_result", onState);
    socket.on("game:number_next_round", onState);
    socket.on("game:number_done", onState);
    socket.on("game:reaction_waiting", onState);
    socket.on("game:reaction_go", onState);
    socket.on("game:reaction_result", onState);

    return () => {
      socket.off("game:started", onState);
      socket.off("game:question", onQuestion);
      socket.off("game:buzzed", onBuzzed);
      socket.off("game:score_update", onState);
      socket.off("game:round_end", onState);
      socket.off("game:finished", onState);
      socket.off("game:buzz_reset", onState);
      socket.off("game:minigame_started", onState);
      socket.off("game:minigame_ended", onState);
      socket.off("game:player_joined", onState);
      socket.off("game:player_left", onState);
      socket.off("game:number_update", onState);
      socket.off("game:number_result", onState);
      socket.off("game:number_next_round", onState);
      socket.off("game:number_done", onState);
      socket.off("game:reaction_waiting", onState);
      socket.off("game:reaction_go", onState);
      socket.off("game:reaction_result", onState);
    };
  }, [sessionId]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-red-400 mb-2">Session Not Found</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg animate-pulse">Connecting as spectator…</div>
      </div>
    );
  }

  const { teams, status, currentQuestion, currentQuestionIndex, totalQuestions, buzzedBy, players } = gameState;
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  const miniGameLabel: Record<string, string> = {
    pacman: "👾 Pac-Man Battle",
    number_survival: "🔢 Number Survival",
    reaction_tap: "⚡ Reaction Tap",
    memory: "🧠 Memory Challenge",
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-yellow-400">QUIZ BUZZER</h1>
            <p className="text-gray-600 text-xs">👁 Spectator Mode</p>
          </div>
          <div className="text-gray-600 text-xs">Session: {sessionId}</div>
        </div>

        <div className={`grid gap-4 mb-6 ${teams.length <= 2 ? "grid-cols-2" : teams.length === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
          {sortedTeams.map((team, rank) => {
            const colors = getTeamColors(team.color);
            const teamPlayers = players[team.id] || [];
            return (
              <div key={team.id} className={`rounded-2xl p-4 border-2 text-center ${colors.border} bg-gray-900`}>
                {rank === 0 && status !== "lobby" && <div className="text-xl mb-1">👑</div>}
                <div className={`text-4xl font-black ${colors.text}`}>{team.score}</div>
                <div className="font-bold text-white mb-2">{team.name}</div>
                <div className="flex flex-wrap justify-center gap-1">
                  {teamPlayers.map((p, i) => (
                    <span key={i} className="text-xs bg-gray-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span>{p.avatar}</span> {p.name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {status === "minigame" && gameState.miniGameType && (
          <div className="bg-purple-950 border border-purple-700 rounded-2xl p-6 mb-6 text-center">
            <div className="text-4xl mb-2">🎮</div>
            <h2 className="text-2xl font-black text-purple-300">{miniGameLabel[gameState.miniGameType] || "Mini-Game"}</h2>
            <p className="text-purple-400/60 text-sm mt-1">Mini-game in progress…</p>
          </div>
        )}

        {status === "lobby" && (
          <div className="bg-gray-900 rounded-2xl p-6 text-center border border-gray-800">
            <div className="text-5xl mb-3">⏳</div>
            <h2 className="text-xl font-bold text-white">Game hasn't started yet</h2>
            <p className="text-gray-500 text-sm mt-1">Waiting for admin to start the game</p>
          </div>
        )}

        {(status === "question_active" || status === "buzzed" || status === "round_end") && currentQuestion && (
          <div className="bg-gray-900 rounded-2xl p-6 mb-4 border border-gray-800">
            <p className="text-gray-500 text-sm mb-3">Question {currentQuestionIndex + 1} of {totalQuestions}</p>
            <h2 className="text-2xl font-bold text-white mb-4">{currentQuestion.text}</h2>
            {currentQuestion.choices && (
              <div className="grid grid-cols-2 gap-2">
                {currentQuestion.choices.map((choice) => (
                  <div key={choice.label} className="bg-gray-800 rounded-xl px-3 py-2 flex items-center gap-2">
                    <span className="text-yellow-400 font-black">{choice.label}</span>
                    <span className="text-gray-300 text-sm">{choice.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {buzzedBy && (status === "buzzed" || status === "round_end") && (
          <div className="bg-orange-950 border border-orange-600 rounded-2xl p-4 text-center">
            <p className="text-orange-400 text-xs font-bold mb-1">FIRST BUZZ</p>
            <p className="text-2xl font-black text-white">{buzzedBy.playerName}</p>
            <p className="text-orange-400 font-bold">{buzzedBy.teamName}</p>
          </div>
        )}

        {status === "playing" && currentQuestionIndex === -1 && (
          <div className="bg-gray-900 rounded-2xl p-6 text-center border border-gray-800">
            <div className="text-5xl mb-3">🎯</div>
            <h2 className="text-xl font-bold text-white">Game is live!</h2>
            <p className="text-gray-500 text-sm mt-1">First question coming up…</p>
          </div>
        )}

        {status === "finished" && (
          <div className="bg-gray-900 rounded-2xl p-8 text-center border border-yellow-800">
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="text-3xl font-black text-yellow-400 mb-3">Game Over!</h2>
            {sortedTeams[0] && (
              <p className="text-xl text-white font-bold">{sortedTeams[0].name} wins with {sortedTeams[0].score} points!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
