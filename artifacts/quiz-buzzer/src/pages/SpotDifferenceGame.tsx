import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Team, GameState, SpotDifferenceData } from "@/lib/types";
import { getTeamColors } from "@/lib/teamColors";

interface Props {
  teams: Team[];
  socket: Socket;
  sessionId: string;
  gameState: GameState;
  onEnd: (winnerTeamId?: string) => void;
}

export default function SpotDifferenceGame({ teams, socket, sessionId, gameState: initialState, onEnd }: Props) {
  const [gameState, setGameState] = useState<GameState>(initialState);

  useEffect(() => {
    const handler = (state: GameState) => setGameState(state);
    socket.on("game:spot_diff_updated", handler);
    socket.on("game:minigame_ended", handler);
    socket.on("game:score_update", handler);
    return () => {
      socket.off("game:spot_diff_updated", handler);
      socket.off("game:minigame_ended", handler);
      socket.off("game:score_update", handler);
    };
  }, [socket]);

  const sdData = gameState.miniGameData as SpotDifferenceData | null;
  if (!sdData || sdData.type !== "spot_difference") return null;

  const { image, index, total } = sdData;
  const emit = (event: string, data?: object) => socket.emit(event, { sessionId, ...data });

  const isLast = index + 1 >= total;

  const awardAndNext = (teamId: string) => {
    emit("admin:adjust_score", { teamId, delta: 1 });
    if (!isLast) {
      // brief delay so the score change is visible
      setTimeout(() => emit("admin:spot_diff_next"), 200);
    }
  };

  const skipToNext = () => {
    if (!isLast) emit("admin:spot_diff_next");
  };

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-teal-300 font-bold text-sm">
          Image <span className="text-white font-black text-lg">{index + 1}</span> of <span className="text-white">{total}</span>
        </p>
        {total > 1 && (
          <div className="flex items-center gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                onClick={() => emit("admin:spot_diff_goto", { index: i })}
                className={`w-6 h-6 rounded text-xs font-bold transition ${i === index ? "bg-teal-400 text-black" : i < index ? "bg-teal-900 text-teal-300" : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}
                title={`Jump to image ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* The image */}
      <div className="flex items-center justify-center bg-black/40 rounded-xl p-2">
        {image ? (
          <img
            src={image}
            alt={`Spot the difference ${index + 1}`}
            className="rounded-lg max-w-full"
            style={{ maxHeight: "70vh", objectFit: "contain" }}
          />
        ) : (
          <div className="text-gray-500 italic py-12">No image to display.</div>
        )}
      </div>

      <p className="text-center text-xs text-gray-500">Audience finds the difference. You award the point.</p>

      {/* Award buttons */}
      <div className="grid grid-cols-2 gap-3">
        {teams.slice(0, 2).map((team) => {
          const colors = getTeamColors(team.color);
          return (
            <button
              key={team.id}
              onClick={() => awardAndNext(team.id)}
              className={`${colors.button} text-white py-3 rounded-xl font-black text-base transition flex items-center justify-center gap-2`}
            >
              🏆 +1 {team.name}
            </button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 justify-center pt-1">
        {!isLast && (
          <button onClick={skipToNext} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition">
            Skip (no point) →
          </button>
        )}
        {isLast && (
          <p className="text-center text-amber-300 text-sm font-bold">Last image — end the mini-game below when done.</p>
        )}
        <button onClick={() => onEnd(undefined)} className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-xl font-bold text-sm transition">
          End Mini-Game
        </button>
      </div>
    </div>
  );
}
