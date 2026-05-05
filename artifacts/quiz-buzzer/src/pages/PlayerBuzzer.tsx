import { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { GameState, Team, MiniGameType } from "@/lib/types";
import PacManController from "./PacManController";
import NumberSurvivalController from "./NumberSurvivalController";
import FaceMergeController from "./FaceMergeController";
import MysteryPuzzleController from "./MysteryPuzzleController";

interface Props {
  sessionId: string;
  playerName: string;
  avatar: string;
  team: Team;
  gameState: GameState;
  socket: Socket;
}

const TEAM_BG: Record<string, string> = {
  blue: "#1e3a8a", red: "#7f1d1d", green: "#14532d",
  yellow: "#713f12", purple: "#4a1d96", orange: "#7c2d12",
};
const TEAM_FG: Record<string, string> = {
  blue: "#60a5fa", red: "#f87171", green: "#4ade80",
  yellow: "#facc15", purple: "#c084fc", orange: "#fb923c",
};

export default function PlayerBuzzer({ sessionId, playerName, avatar, team, gameState: initialState, socket }: Props) {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [hasBuzzed, setHasBuzzed] = useState(false);
  const [buzzSuccess, setBuzzSuccess] = useState(false);
  const [locked, setLocked] = useState(false);
  const buzzTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mySocketId = socket.id || "";

  const teamBg = TEAM_BG[team.color] || "#1f2937";
  const teamFg = TEAM_FG[team.color] || "#ffffff";

  useEffect(() => {
    socket.on("game:question", ({ state }: { state: GameState }) => {
      setGameState(state); setHasBuzzed(false); setBuzzSuccess(false); setLocked(false);
    });
    socket.on("game:buzzed", ({ state }: { state: GameState }) => {
      setGameState(state);
      if (state.buzzedBy?.playerName === playerName) setBuzzSuccess(true);
      else { setLocked(true); setBuzzSuccess(false); }
    });
    socket.on("game:buzz_reset", (state: GameState) => {
      setGameState(state); setHasBuzzed(false); setBuzzSuccess(false); setLocked(false);
    });
    socket.on("game:buzzer_opened", (state: GameState) => {
      setGameState(state); setHasBuzzed(false); setBuzzSuccess(false); setLocked(false);
    });
    socket.on("game:buzzer_closed", (state: GameState) => {
      setGameState(state); setHasBuzzed(false); setBuzzSuccess(false); setLocked(false);
    });

    const onState = (state: GameState) => setGameState(state);
    socket.on("game:score_update", onState);
    socket.on("game:minigame_started", (state: GameState) => {
      setGameState(state); setHasBuzzed(false); setBuzzSuccess(false); setLocked(false);
    });
    socket.on("game:minigame_ended", onState);
    socket.on("game:round_end", onState);
    socket.on("game:finished", onState);
    socket.on("game:number_update", onState);
    socket.on("game:number_result", onState);
    socket.on("game:number_next_round", onState);
    socket.on("game:number_done", onState);
    socket.on("game:face_merge_updated", onState);
    socket.on("game:mystery_updated", onState);

    return () => {
      socket.off("game:question"); socket.off("game:buzzed"); socket.off("game:buzz_reset");
      socket.off("game:buzzer_opened"); socket.off("game:buzzer_closed");
      socket.off("game:score_update", onState); socket.off("game:round_end", onState);
      socket.off("game:finished", onState); socket.off("game:minigame_started");
      socket.off("game:minigame_ended", onState);
      socket.off("game:number_update", onState); socket.off("game:number_result", onState);
      socket.off("game:number_next_round", onState); socket.off("game:number_done", onState);
      socket.off("game:face_merge_updated", onState); socket.off("game:mystery_updated", onState);
    };
  }, [socket, playerName]);

  const handleBuzz = () => {
    if (hasBuzzed || locked) return;
    const s = gameState.status;
    if (s !== "question_active" && s !== "buzzer_active") return;
    setHasBuzzed(true);
    socket.emit("player:buzz", { sessionId });
    playBuzzSound();
    if (buzzTimeoutRef.current) clearTimeout(buzzTimeoutRef.current);
    buzzTimeoutRef.current = setTimeout(() => { if (!buzzSuccess) setHasBuzzed(false); }, 2000);
  };

  const playBuzzSound = () => {
    try {
      const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  const { status, currentQuestion, teams, buzzedBy, currentQuestionIndex, totalQuestions, miniGameType } = gameState;
  const myTeam = teams.find((t) => t.id === team.id);
  const iAmBuzzer = buzzedBy?.playerName === playerName;
  const someoneElseBuzzed = !!buzzedBy && !iAmBuzzer;
  const canBuzz = (status === "question_active" || status === "buzzer_active") && !hasBuzzed && !locked;
  const commonProps = { team, socket, sessionId, playerName, avatar, gameState };

  if (status === "minigame" && miniGameType) {
    if (miniGameType === "pacman") return <PacManController team={team} socket={socket} sessionId={sessionId} playerName={playerName} />;
    if (miniGameType === "number_survival") return <NumberSurvivalController {...commonProps} mySocketId={mySocketId} />;
    if (miniGameType === "face_merge") return <FaceMergeController {...commonProps} />;
    if (miniGameType === "mystery_puzzle") return <MysteryPuzzleController {...commonProps} />;
  }

  if (status === "finished") {
    const sorted = [...teams].sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    const iWon = winner.id === team.id;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: teamBg }}>
        <div className="text-6xl mb-2">{avatar}</div>
        <div className="text-5xl mb-4">{iWon ? "🏆" : "🎉"}</div>
        <h1 className="text-4xl font-black text-white mb-2">Game Over!</h1>
        {iWon ? <p className="text-2xl font-bold mb-6" style={{ color: teamFg }}>Your team won!</p>
          : <p className="text-xl text-white/60 mb-6">Great game!</p>}
        <div className="space-y-2 w-full max-w-xs">
          {sorted.map((t, i) => (
            <div key={t.id} className={`rounded-xl px-4 py-3 flex items-center justify-between ${t.id === team.id ? "border border-white/40" : ""}`} style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
              <span className="text-white font-bold">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {t.name}</span>
              <span className="text-2xl font-black text-white">{t.score}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: teamBg }}>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{avatar}</span>
            <div>
              <p className="text-white/50 text-xs">Playing as</p>
              <p className="font-black text-white text-base leading-tight">{playerName}</p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full text-sm font-bold" style={{ backgroundColor: teamFg, color: teamBg }}>{team.name}</div>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {teams.map((t) => (
            <div key={t.id} className={`flex-1 rounded-lg px-3 py-2 text-center ${t.id === team.id ? "border border-white/30" : ""}`} style={{ backgroundColor: "rgba(0,0,0,0.3)" }}>
              <div className="text-xl font-black text-white">{t.score}</div>
              <div className="text-xs text-white/50">{t.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        {status === "playing" && currentQuestionIndex === -1 && (
          <div className="text-center"><p className="text-white/60 text-xl">Waiting for first question…</p></div>
        )}

        {status === "buzzer_active" && !iAmBuzzer && !someoneElseBuzzed && (
          <div className="text-center mb-4">
            <p className="text-white/60 text-lg font-bold animate-pulse">🔔 Buzzer is open!</p>
          </div>
        )}

        {(status === "question_active" || status === "buzzed") && currentQuestion && (
          <div className="w-full max-w-sm mb-6">
            <p className="text-white/50 text-xs text-center mb-2">Question {currentQuestionIndex + 1} of {totalQuestions}</p>
            <div className="bg-black/30 rounded-2xl p-4 mb-3">
              <p className="text-white text-xl font-bold text-center leading-snug">{currentQuestion.text}</p>
            </div>
            {currentQuestion.choices && (
              <div className="grid grid-cols-2 gap-2">
                {currentQuestion.choices.map((choice) => (
                  <div key={choice.label} className="bg-black/20 rounded-xl px-3 py-2 flex items-center gap-2">
                    <span className="font-black text-sm" style={{ color: teamFg }}>{choice.label}</span>
                    <span className="text-white/70 text-sm">{choice.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {iAmBuzzer && (
          <div className="text-center mb-6 animate-pulse">
            <div className="text-5xl mb-2">🔔</div>
            <p className="text-2xl font-black text-white">YOU BUZZED FIRST!</p>
            <p className="text-white/60 text-sm mt-1">Waiting for admin…</p>
          </div>
        )}

        {someoneElseBuzzed && buzzedBy && (
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🔕</div>
            <p className="text-white/60 text-lg font-bold">{buzzedBy.playerName} buzzed first!</p>
            <p className="text-white/40 text-sm">{buzzedBy.teamName}</p>
          </div>
        )}

        {status === "round_end" && (
          <div className="text-center mb-6">
            <p className="text-white/60 text-xl animate-pulse">Next question coming…</p>
          </div>
        )}

        {(canBuzz || (hasBuzzed && !buzzSuccess)) && !iAmBuzzer && !someoneElseBuzzed && (
          <button
            onTouchStart={handleBuzz}
            onClick={handleBuzz}
            disabled={!canBuzz}
            className={`w-64 h-64 rounded-full font-black text-4xl transition-all select-none
              ${canBuzz ? "active:scale-95 shadow-2xl" : "opacity-50 cursor-not-allowed"}
              ${hasBuzzed && !buzzSuccess ? "scale-95 opacity-70" : ""}
            `}
            style={{
              backgroundColor: canBuzz ? teamFg : "rgba(255,255,255,0.2)",
              color: canBuzz ? teamBg : "rgba(255,255,255,0.5)",
              boxShadow: canBuzz ? `0 0 60px ${teamFg}66` : "none",
            }}
          >
            {hasBuzzed && !buzzSuccess ? "…" : "BUZZ!"}
          </button>
        )}

        {myTeam && (
          <div className="mt-6 text-center">
            <p className="text-white/30 text-xs">Team Score</p>
            <p className="text-4xl font-black" style={{ color: teamFg }}>{myTeam.score}</p>
          </div>
        )}
      </div>
    </div>
  );
}
