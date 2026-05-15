import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Team, GameState, MemoryStarsData } from "@/lib/types";
import { getTeamColors } from "@/lib/teamColors";

interface Props {
  teams: Team[];
  socket: Socket;
  sessionId: string;
  gameState: GameState;
  onEnd: (winnerTeamId?: string) => void;
}

export default function MemoryStarsGame({ teams, socket, sessionId, gameState: initialState, onEnd }: Props) {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const handler = (state: GameState) => setGameState(state);
    socket.on("game:memory_stars_updated", handler);
    socket.on("game:minigame_ended", handler);
    socket.on("game:score_update", handler);
    return () => {
      socket.off("game:memory_stars_updated", handler);
      socket.off("game:minigame_ended", handler);
      socket.off("game:score_update", handler);
    };
  }, [socket]);

  // Tick once per 100ms so the countdown re-renders smoothly
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const msData = gameState.miniGameData as MemoryStarsData | null;
  if (!msData || msData.type !== "memory_stars") return null;

  const { index, total, phase, display, showEndsAt, durationMs } = msData;
  const emit = (event: string, data?: object) => socket.emit(event, { sessionId, ...data });
  const isLast = index + 1 >= total;
  const remainingMs = phase === "showing" && showEndsAt ? Math.max(0, showEndsAt - now) : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  const awardAndNext = (teamId: string) => {
    emit("admin:adjust_score", { teamId, delta: 1 });
    if (!isLast) setTimeout(() => emit("admin:memory_stars_next"), 200);
  };

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-indigo-300 font-bold text-sm">
          Sequence <span className="text-white font-black text-lg">{index + 1}</span> of <span className="text-white">{total}</span>
          <span className="text-indigo-400/60 ml-3 text-xs font-normal">Display: {Math.round(durationMs / 1000)}s</span>
        </p>
        {total > 1 && (
          <div className="flex items-center gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                onClick={() => emit("admin:memory_stars_goto", { index: i })}
                className={`w-6 h-6 rounded text-xs font-bold transition ${i === index ? "bg-indigo-400 text-black" : i < index ? "bg-indigo-900 text-indigo-300" : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}
                title={`Jump to sequence ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* The big display */}
      <div className={`flex flex-col items-center justify-center rounded-xl p-8 transition-colors duration-300 ${
        phase === "showing" ? "bg-indigo-950/40 border-2 border-indigo-500" :
        phase === "hidden" ? "bg-purple-950/40 border-2 border-purple-500" :
        phase === "revealed" ? "bg-green-950/40 border-2 border-green-500" :
        "bg-gray-800/40 border-2 border-gray-700 border-dashed"
      }`}>
        {phase === "idle" && (
          <p className="text-gray-500 text-lg italic">Click "▶ Show sequence" to begin</p>
        )}
        {phase !== "idle" && (
          <>
            <div
              className="font-mono font-black tracking-widest"
              style={{
                fontSize: "clamp(2rem, 10vw, 6rem)",
                color: phase === "hidden" ? "#a78bfa" : phase === "revealed" ? "#86efac" : "#c7d2fe",
                letterSpacing: "0.15em",
              }}
            >
              {display}
            </div>
            {phase === "showing" && (
              <p className="text-indigo-200 text-sm font-bold mt-4">
                Auto-hides in <span className="text-2xl text-white font-mono">{remainingSec}</span>s — memorize!
              </p>
            )}
            {phase === "hidden" && (
              <p className="text-purple-200 text-sm font-bold mt-4">
                What was it? Teams shout out their guess.
              </p>
            )}
            {phase === "revealed" && (
              <p className="text-green-200 text-sm font-bold mt-4">
                ✓ Answer revealed — award the point below.
              </p>
            )}
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 justify-center">
        {phase === "idle" && (
          <button onClick={() => emit("admin:memory_stars_show")} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-black text-base transition">
            ▶ Show sequence ({Math.round(durationMs / 1000)}s)
          </button>
        )}
        {phase === "showing" && (
          <button onClick={() => emit("admin:memory_stars_hide")} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-black text-sm transition">
            🌟 Hide now
          </button>
        )}
        {phase === "hidden" && (
          <>
            <button onClick={() => emit("admin:memory_stars_reveal")} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-black text-sm transition">
              ✓ Reveal answer
            </button>
            <button onClick={() => emit("admin:memory_stars_show")} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-xl font-bold text-sm transition">
              ↻ Show again
            </button>
          </>
        )}
        {phase === "revealed" && (
          <button onClick={() => emit("admin:memory_stars_show")} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-xl font-bold text-sm transition">
            ↻ Show again
          </button>
        )}
      </div>

      {/* Award buttons — visible during hidden / revealed phases */}
      {(phase === "hidden" || phase === "revealed") && (
        <div className="grid grid-cols-2 gap-3 pt-1">
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
      )}

      {/* Navigation footer */}
      <div className="flex flex-wrap gap-2 justify-center pt-1">
        {!isLast && (phase === "hidden" || phase === "revealed") && (
          <button onClick={() => emit("admin:memory_stars_next")} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition">
            Skip (no point) →
          </button>
        )}
        {isLast && (phase === "hidden" || phase === "revealed") && (
          <p className="text-center text-amber-300 text-sm font-bold w-full">Last sequence — end the mini-game below when done.</p>
        )}
        <button onClick={() => onEnd(undefined)} className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-xl font-bold text-sm transition">
          End Mini-Game
        </button>
      </div>
    </div>
  );
}
