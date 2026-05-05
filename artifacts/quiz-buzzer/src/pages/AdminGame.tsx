import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { getSocket } from "@/lib/socket";
import { GameState, MiniGameType, MysteryPuzzleClue } from "@/lib/types";
import { getTeamColors } from "@/lib/teamColors";
import PacManGame from "./PacManGame";
import NumberSurvivalGame from "./NumberSurvivalGame";
import FaceMergeGame from "./FaceMergeGame";
import MysteryPuzzleGame from "./MysteryPuzzleGame";
import MiniGameSelector from "./MiniGameSelector";

interface MiniGameResult { winner: "team1" | "team2" | "tie"; scores: [number, number]; }

export default function AdminGame() {
  const [, params] = useRoute("/admin/game/:sessionId");
  const [, navigate] = useLocation();
  const sessionId = params?.sessionId || "";

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [buzzFlash, setBuzzFlash] = useState(false);
  const [miniGameActive, setMiniGameActive] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [miniGameResult, setMiniGameResult] = useState<{ winnerTeamId?: string; label: string } | null>(null);
  const [miniGameKey, setMiniGameKey] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef(getSocket());

  const startTimer = (seconds: number) => {
    stopTimer();
    let remaining = seconds;
    timerRef.current = setInterval(() => {
      remaining -= 1; setTimer(remaining);
      if (remaining <= 0) { stopTimer(); setTimer(0); }
    }, 1000);
  };
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  useEffect(() => {
    const socket = socketRef.current;
    socket.emit("session:get_state", { sessionId }, (res: { state: GameState }) => {
      setGameState(res.state);
      if (res.state?.status === "minigame") setMiniGameActive(true);
    });

    socket.on("game:question", ({ state }: { state: GameState }) => {
      setGameState(state); setBuzzFlash(false); setMiniGameActive(false); setMiniGameResult(null);
      const q = state.currentQuestion;
      if (q?.timeLimit) { setTimer(q.timeLimit); startTimer(q.timeLimit); }
    });
    socket.on("game:buzzed", ({ state }: { state: GameState }) => {
      setGameState(state); setBuzzFlash(true); stopTimer(); playBuzzSound();
      setTimeout(() => setBuzzFlash(false), 1500);
    });
    socket.on("game:score_update", (state: GameState) => setGameState(state));
    socket.on("game:round_end", (state: GameState) => { setGameState(state); stopTimer(); });
    socket.on("game:finished", (state: GameState) => { setGameState(state); stopTimer(); setMiniGameActive(false); });
    socket.on("game:buzz_reset", (state: GameState) => {
      setGameState(state); setBuzzFlash(false);
      if (state.currentQuestion?.timeLimit) { setTimer(state.currentQuestion.timeLimit); startTimer(state.currentQuestion.timeLimit); }
    });
    socket.on("game:player_joined", (state: GameState) => setGameState(state));
    socket.on("game:player_left", (state: GameState) => setGameState(state));
    socket.on("game:minigame_started", (state: GameState) => {
      setGameState(state); setMiniGameActive(true); setMiniGameResult(null); setMiniGameKey((k) => k + 1);
    });
    socket.on("game:minigame_ended", (state: GameState) => { setGameState(state); setMiniGameActive(false); });
    socket.on("game:buzzer_opened", (state: GameState) => { setGameState(state); setBuzzFlash(false); });
    socket.on("game:buzzer_closed", (state: GameState) => setGameState(state));

    const onState = (state: GameState) => setGameState(state);
    socket.on("game:number_update", onState); socket.on("game:number_result", onState);
    socket.on("game:number_next_round", onState); socket.on("game:number_done", onState);
    socket.on("game:face_merge_updated", onState);
    socket.on("game:mystery_updated", onState);

    return () => {
      socket.off("game:question"); socket.off("game:buzzed"); socket.off("game:score_update");
      socket.off("game:round_end"); socket.off("game:finished"); socket.off("game:buzz_reset");
      socket.off("game:player_joined"); socket.off("game:player_left");
      socket.off("game:minigame_started"); socket.off("game:minigame_ended");
      socket.off("game:buzzer_opened"); socket.off("game:buzzer_closed");
      socket.off("game:number_update", onState); socket.off("game:number_result", onState);
      socket.off("game:number_next_round", onState); socket.off("game:number_done", onState);
      socket.off("game:face_merge_updated", onState); socket.off("game:mystery_updated", onState);
      stopTimer();
    };
  }, [sessionId]);

  const emit = useCallback((event: string, data?: object) => {
    socketRef.current.emit(event, { sessionId, ...data });
  }, [sessionId]);

  const playBuzzSound = () => {
    try {
      const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
    } catch {}
  };

  const playVictorySound = () => {
    try {
      const ctx = new AudioContext();
      [523, 659, 784, 1047].forEach((f, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.12 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
        osc.start(ctx.currentTime + i * 0.12); osc.stop(ctx.currentTime + i * 0.12 + 0.3);
      });
    } catch {}
  };

  const handleSelectMiniGame = (type: MiniGameType, data?: { story: string; clues: MysteryPuzzleClue[] }) => {
    setShowSelector(false);
    if (!type) return;
    emit("admin:start_minigame", { type, puzzleData: data });
  };

  const handleMiniGameEnd = useCallback((winnerTeamId?: string) => {
    setMiniGameActive(false);
    if (!gameState) return;
    const winnerTeam = gameState.teams.find((t) => t.id === winnerTeamId);
    setMiniGameResult({ winnerTeamId, label: winnerTeam ? `${winnerTeam.name} wins!` : "It's a tie!" });
    emit("admin:end_minigame", { winnerTeamId });
    if (winnerTeamId) playVictorySound();
  }, [gameState, emit]);

  const handlePacManEnd = useCallback((result: MiniGameResult) => {
    if (!gameState) return;
    const winnerTeamId = result.winner === "team1" ? gameState.teams[0]?.id
      : result.winner === "team2" ? gameState.teams[1]?.id : undefined;
    handleMiniGameEnd(winnerTeamId);
  }, [gameState, handleMiniGameEnd]);

  if (!gameState) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-white text-xl">Loading game…</div></div>;
  }

  const { teams, status, currentQuestion, currentQuestionIndex, totalQuestions, buzzedBy, players, miniGameType } = gameState;
  const buzzedTeam = buzzedBy ? teams.find((t) => t.id === buzzedBy.teamId) : null;
  const timerPercent = timer !== null && currentQuestion?.timeLimit ? (timer / currentQuestion.timeLimit) * 100 : 100;
  const isBuzzerMode = status === "buzzer_active" || status === "buzzed";

  const miniGameLabels: Record<string, string> = {
    pacman: "👾 PAC-MAN BATTLE",
    number_survival: "🔢 NUMBER SURVIVAL",
    face_merge: "🖼️ FACE MERGE",
    mystery_puzzle: "🔐 MYSTERY PUZZLE",
  };

  return (
    <div className={`min-h-screen transition-all duration-300 ${buzzFlash ? "bg-orange-950" : "bg-gray-950"} text-white`}>
      {showSelector && <MiniGameSelector onSelect={handleSelectMiniGame} onClose={() => setShowSelector(false)} />}

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-black text-yellow-400">QUIZ BUZZER</h1>
            <p className="text-gray-500 text-sm">Session: {sessionId}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!miniGameActive && status === "buzzer_active" && (
              <button onClick={() => emit("admin:close_buzzer")} className="px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white">
                🔔 Close Buzzer
              </button>
            )}
            {!miniGameActive && (status === "playing" || status === "round_end" || status === "question_active") && (
              <button onClick={() => emit("admin:open_buzzer")} className="px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2 bg-orange-700 hover:bg-orange-600 text-white">
                🔔 Open Buzzer
              </button>
            )}
            {!miniGameActive && (status === "playing" || status === "round_end") && (
              <button onClick={() => setShowSelector(true)} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2">
                🎮 Mini-Game
              </button>
            )}
            <button onClick={() => emit("admin:end_game")} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition">
              End Game
            </button>
          </div>
        </div>

        <div className={`grid gap-4 mb-6 ${teams.length <= 2 ? "grid-cols-2" : teams.length === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
          {teams.map((team) => {
            const colors = getTeamColors(team.color);
            const teamPlayers = players[team.id] || [];
            return (
              <div key={team.id} className={`rounded-xl p-4 border-2 text-center ${colors.border} ${colors.light}`}>
                <div className={`text-3xl font-black ${colors.text}`}>{team.score}</div>
                <div className="text-sm font-bold text-gray-700">{team.name}</div>
                <div className="flex flex-wrap justify-center gap-1 mt-1">
                  {teamPlayers.map((p, i) => (
                    <span key={i} className="text-xs bg-gray-200/60 px-1.5 py-0.5 rounded-full flex items-center gap-1 text-gray-700">
                      <span>{p.avatar}</span> {p.name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {status === "buzzer_active" && (
          <div className="bg-orange-950 rounded-2xl p-6 mb-6 border-2 border-orange-500 text-center animate-pulse">
            <div className="text-4xl mb-2">🔔</div>
            <h3 className="text-2xl font-black text-white mb-1">BUZZER IS OPEN!</h3>
            <p className="text-orange-300 text-sm">Players can now buzz in. First team to press wins!</p>
            <button onClick={() => emit("admin:close_buzzer")} className="mt-3 bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-xl font-black transition">
              Close Buzzer
            </button>
          </div>
        )}

        {miniGameActive && miniGameType && teams.length >= 2 && (
          <div className="bg-gray-900 rounded-2xl p-6 mb-6 border-2 border-purple-600">
            <div className="text-center mb-5">
              <h2 className="text-2xl font-black text-purple-400">{miniGameLabels[miniGameType] || "MINI-GAME"}</h2>
            </div>
            {miniGameType === "pacman" && (
              <div className="flex justify-center">
                <PacManGame key={miniGameKey} team1={teams[0]} team2={teams[1]} onGameEnd={handlePacManEnd} socket={socketRef.current} sessionId={sessionId} />
              </div>
            )}
            {miniGameType === "number_survival" && (
              <NumberSurvivalGame key={miniGameKey} teams={teams} socket={socketRef.current} sessionId={sessionId} gameState={gameState} onEnd={handleMiniGameEnd} />
            )}
            {miniGameType === "face_merge" && (
              <FaceMergeGame key={miniGameKey} teams={teams} socket={socketRef.current} sessionId={sessionId} gameState={gameState} onEnd={handleMiniGameEnd} />
            )}
            {miniGameType === "mystery_puzzle" && (
              <MysteryPuzzleGame key={miniGameKey} teams={teams} socket={socketRef.current} sessionId={sessionId} gameState={gameState} onEnd={handleMiniGameEnd} />
            )}
          </div>
        )}

        {miniGameResult && !miniGameActive && (
          <div className="bg-gray-900 rounded-2xl p-6 mb-6 border-2 border-purple-600 text-center">
            <div className="text-4xl mb-2">{miniGameResult.winnerTeamId ? "🏆" : "🤝"}</div>
            <h3 className="text-2xl font-black text-white mb-1">{miniGameResult.label}</h3>
            {miniGameResult.winnerTeamId && <p className="text-yellow-400 text-sm font-bold mt-1">+1 Point Awarded!</p>}
          </div>
        )}

        <div className="bg-gray-900 rounded-2xl p-6 mb-6 border border-gray-800 min-h-40">
          {status === "playing" && currentQuestionIndex === -1 && (
            <div className="text-center py-8">
              <p className="text-gray-400 text-xl mb-6">Game is live! Show a question, open the buzzer, or start a mini-game.</p>
              <div className="flex gap-4 justify-center flex-wrap">
                <button onClick={() => emit("admin:next_question")} className="bg-yellow-400 text-black px-8 py-3 rounded-xl font-black text-lg hover:bg-yellow-300 transition">
                  Show First Question
                </button>
                <button onClick={() => emit("admin:open_buzzer")} className="bg-orange-600 text-white px-8 py-3 rounded-xl font-black text-lg hover:bg-orange-500 transition">
                  🔔 Open Buzzer
                </button>
                <button onClick={() => setShowSelector(true)} className="bg-purple-600 text-white px-8 py-3 rounded-xl font-black text-lg hover:bg-purple-500 transition">
                  🎮 Mini-Game
                </button>
              </div>
            </div>
          )}

          {(status === "question_active" || status === "buzzed" || status === "round_end") && currentQuestion && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-400 text-sm">Question {currentQuestionIndex + 1} of {totalQuestions}</span>
                {timer !== null && status === "question_active" && (
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-700 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${timer <= 5 ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${timerPercent}%` }} />
                    </div>
                    <span className={`font-mono font-bold text-lg ${timer <= 5 ? "text-red-400" : "text-white"}`}>{timer}s</span>
                  </div>
                )}
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">{currentQuestion.text}</h2>
              {currentQuestion.choices && (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {currentQuestion.choices.map((choice) => (
                    <div key={choice.label} className="bg-gray-800 rounded-lg px-4 py-3 flex items-center gap-3">
                      <span className="text-yellow-400 font-black text-lg">{choice.label}</span>
                      <span className="text-white">{choice.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {status === "finished" && (
            <div className="text-center py-8">
              <h2 className="text-4xl font-black text-yellow-400 mb-4">Game Over!</h2>
              <div className="flex justify-center gap-8 mb-6">
                {[...teams].sort((a, b) => b.score - a.score).map((team, i) => {
                  const colors = getTeamColors(team.color);
                  return (
                    <div key={team.id} className={`text-center ${i === 0 ? "scale-110" : ""}`}>
                      {i === 0 && <div className="text-4xl mb-1">🏆</div>}
                      <div className={`text-3xl font-black ${colors.text}`}>{team.score}</div>
                      <div className="font-bold text-white">{team.name}</div>
                      {i === 0 && <div className="text-yellow-400 text-sm font-bold mt-1">WINNER!</div>}
                    </div>
                  );
                })}
              </div>
              <button onClick={() => navigate("/")} className="bg-yellow-400 text-black px-8 py-3 rounded-xl font-black hover:bg-yellow-300 transition">New Game</button>
            </div>
          )}
        </div>

        {buzzedBy && (status === "buzzed" || status === "round_end") && (
          <div className="rounded-2xl p-6 mb-6 border-2 border-orange-500 bg-orange-950 text-center">
            <p className="text-gray-400 text-sm mb-1">FIRST BUZZ!</p>
            <p className="text-3xl font-black text-white">{buzzedBy.playerName}</p>
            <p className="text-lg font-bold text-orange-400">{buzzedBy.teamName}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          {status === "question_active" && (
            <button onClick={() => emit("admin:skip_question")} className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-bold transition">
              Skip Question
            </button>
          )}
          {status === "buzzed" && buzzedBy && (
            <>
              <button onClick={() => emit("admin:award_point", { teamId: buzzedBy.teamId })} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold transition">
                ✅ Award Point to {buzzedBy.teamName}
              </button>
              <button onClick={() => emit("admin:reset_buzz")} className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-3 rounded-xl font-bold transition">
                Reset Buzz
              </button>
              <button onClick={() => emit("admin:skip_question")} className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-bold transition">
                No Point
              </button>
            </>
          )}
          {status === "round_end" && (
            <button onClick={() => emit("admin:next_question")} className="bg-yellow-400 text-black px-8 py-3 rounded-xl font-black text-lg hover:bg-yellow-300 transition">
              {currentQuestionIndex + 1 >= totalQuestions ? "End Game" : "Next Question"}
            </button>
          )}
          {status === "question_active" && teams.map((team) => {
            const colors = getTeamColors(team.color);
            return (
              <button key={team.id} onClick={() => emit("admin:award_point", { teamId: team.id })} className={`${colors.button} text-white px-4 py-2 rounded-lg font-bold text-sm transition`}>
                +1 {team.name}
              </button>
            );
          })}
          {isBuzzerMode && buzzedBy && teams.map((team) => {
            if (team.id !== buzzedBy.teamId) return null;
            const colors = getTeamColors(team.color);
            return (
              <button key={team.id} onClick={() => emit("admin:award_point", { teamId: team.id })} className={`${colors.button} text-white px-4 py-2 rounded-lg font-bold text-sm transition`}>
                +1 {team.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
