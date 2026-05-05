import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Team, GameState, MysteryPuzzleData } from "@/lib/types";

interface Props {
  team: Team;
  socket: Socket;
  sessionId: string;
  playerName: string;
  avatar: string;
  gameState: GameState;
}

const TEAM_BG: Record<string, string> = { blue: "#1e3a8a", red: "#7f1d1d", green: "#14532d", yellow: "#713f12", purple: "#4a1d96", orange: "#7c2d12" };
const TEAM_FG: Record<string, string> = { blue: "#60a5fa", red: "#f87171", green: "#4ade80", yellow: "#facc15", purple: "#c084fc", orange: "#fb923c" };
const CLUE_ICONS = ["🧩", "🔤", "🔢", "🧠", "🎯", "💡"];

export default function MysteryPuzzleController({ team, socket, sessionId, playerName, avatar, gameState: initialState }: Props) {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState<Record<number, string>>({});

  const teamBg = TEAM_BG[team.color] || "#1f2937";
  const teamFg = TEAM_FG[team.color] || "#ffffff";

  useEffect(() => {
    const handler = (state: GameState) => {
      setGameState(state);
      setAnswer("");
    };
    socket.on("game:mystery_updated", handler);
    socket.on("game:minigame_ended", handler);
    return () => {
      socket.off("game:mystery_updated", handler);
      socket.off("game:minigame_ended", handler);
    };
  }, [socket]);

  const mpData = gameState.miniGameData as MysteryPuzzleData | null;
  if (!mpData) return null;

  const currentClue = mpData.currentClueIndex >= 0 ? mpData.clues[mpData.currentClueIndex] : null;
  const alreadySubmitted = mpData.currentClueIndex >= 0 ? submitted[mpData.currentClueIndex] : null;

  const handleSubmit = () => {
    if (!answer.trim() || mpData.currentClueIndex < 0) return;
    socket.emit("mystery:answer", { sessionId, answer: answer.trim(), clueIndex: mpData.currentClueIndex });
    setSubmitted((prev) => ({ ...prev, [mpData.currentClueIndex]: answer.trim() }));
    setAnswer("");
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: teamBg }}>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{avatar}</span>
            <div>
              <p className="text-white/50 text-xs">Playing as</p>
              <p className="font-black text-white text-base leading-tight">{playerName}</p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full text-sm font-bold" style={{ backgroundColor: teamFg, color: teamBg }}>{team.name}</div>
        </div>
        <div className="flex gap-2">
          {gameState.teams.map((t) => (
            <div key={t.id} className={`flex-1 rounded-lg px-2 py-1.5 text-center ${t.id === team.id ? "border border-white/30" : ""}`} style={{ backgroundColor: "rgba(0,0,0,0.3)" }}>
              <div className="text-xl font-black text-white">{t.score}</div>
              <div className="text-xs text-white/50">{t.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 pb-8 pt-4 gap-4">
        <div className="bg-black/30 rounded-xl p-4">
          <p className="text-xs font-bold uppercase mb-1" style={{ color: teamFg }}>📖 Story</p>
          <p className="text-white/80 text-sm leading-relaxed">{mpData.story}</p>
        </div>

        {mpData.revealedClues.length > 0 && (
          <div className="bg-black/20 rounded-xl p-3">
            <p className="text-xs font-bold uppercase mb-2 text-yellow-400">🔐 Code So Far</p>
            <div className="flex gap-1 flex-wrap">
              {mpData.clues.map((clue, i) => (
                <span key={i} className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-base border ${mpData.revealedClues.includes(i) ? "border-yellow-400 text-yellow-300 bg-yellow-950/60" : "border-white/10 text-white/20 bg-white/5"}`}>
                  {mpData.revealedClues.includes(i) ? clue.reward : "?"}
                </span>
              ))}
            </div>
          </div>
        )}

        {mpData.vaultRevealed && (
          <div className="bg-yellow-900/40 border-2 border-yellow-400 rounded-xl p-4 text-center animate-pulse">
            <p className="text-yellow-400 font-black text-lg">🎉 VAULT CRACKED!</p>
            <p className="text-4xl font-black text-white mt-1">{mpData.vaultCode}</p>
          </div>
        )}

        {mpData.currentClueIndex === -1 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/40 text-lg text-center animate-pulse">Waiting for first clue…</p>
          </div>
        )}

        {currentClue && (
          <div className="bg-black/30 rounded-xl p-4 space-y-3 flex-1">
            <p className="font-bold text-sm" style={{ color: teamFg }}>
              {CLUE_ICONS[mpData.currentClueIndex]} Clue {mpData.currentClueIndex + 1}
            </p>
            <p className="text-white font-bold text-lg leading-snug">{currentClue.question}</p>

            {mpData.revealedClues.includes(mpData.currentClueIndex) && (
              <div className="bg-green-900/40 border border-green-500 rounded-lg p-3">
                <p className="text-green-400 text-xs font-bold mb-1">Answer Revealed!</p>
                <p className="text-green-300 font-black text-xl">{currentClue.answer}</p>
                {currentClue.reward && <p className="text-yellow-400 text-sm mt-1">Code digit: <strong>{currentClue.reward}</strong></p>}
              </div>
            )}

            {!mpData.revealedClues.includes(mpData.currentClueIndex) && (
              <div className="space-y-2">
                {alreadySubmitted ? (
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <p className="text-white/60 text-sm">Your answer: <span className="text-white font-bold">{alreadySubmitted}</span></p>
                    <p className="text-white/40 text-xs mt-1">Waiting for host to reveal…</p>
                  </div>
                ) : (
                  <>
                    <input
                      className="w-full rounded-xl px-4 py-3 text-black font-bold text-lg focus:outline-none"
                      style={{ backgroundColor: "rgba(255,255,255,0.9)" }}
                      placeholder="Type your answer…"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    />
                    <button
                      onClick={handleSubmit}
                      disabled={!answer.trim()}
                      className="w-full py-3 rounded-xl font-black text-lg transition disabled:opacity-40"
                      style={{ backgroundColor: teamFg, color: teamBg }}
                    >
                      Submit Answer →
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
