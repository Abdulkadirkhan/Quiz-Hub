import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { getSocket } from "@/lib/socket";
import { GameState, FaceMergeData, NumberSurvivalData, MysteryPuzzleData } from "@/lib/types";
import { getTeamColors } from "@/lib/teamColors";

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
    socket.on("game:round_reset", onState);
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
    socket.on("game:face_merge_updated", onState);
    socket.on("game:mystery_updated", onState);
    socket.on("game:buzzer_opened", onState);
    socket.on("game:buzzer_closed", onState);

    return () => {
      socket.off("game:started", onState);
      socket.off("game:question", onQuestion);
      socket.off("game:buzzed", onBuzzed);
      socket.off("game:score_update", onState);
      socket.off("game:round_end", onState);
      socket.off("game:round_reset", onState);
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
      socket.off("game:face_merge_updated", onState);
      socket.off("game:mystery_updated", onState);
      socket.off("game:buzzer_opened", onState);
      socket.off("game:buzzer_closed", onState);
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

  const { teams, status, currentQuestion, currentQuestionIndex, totalQuestions, buzzedBy, players, miniGameType, miniGameData } = gameState;
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  const miniGameLabel: Record<string, string> = {
    pacman: "👾 Pac-Man Battle",
    number_survival: "🔢 Number Survival",
    face_merge: "🖼️ Face Merge",
    mystery_puzzle: "🔐 Mystery Puzzle",
  };

  const fmData = miniGameType === "face_merge" ? (miniGameData as FaceMergeData | null) : null;
  const nsData = miniGameType === "number_survival" ? (miniGameData as NumberSurvivalData | null) : null;
  const mpData = miniGameType === "mystery_puzzle" ? (miniGameData as MysteryPuzzleData | null) : null;

  const isMiniGame = status === "minigame" && miniGameType;

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
          {sortedTeams.map((team) => {
            const colors = getTeamColors(team.color);
            const teamPlayers = players[team.id] || [];
            return (
              <div key={team.id} className={`rounded-2xl p-4 border-2 text-center ${colors.border} bg-gray-900`}>
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

        {/* MINI-GAME RENDERINGS */}
        {isMiniGame && miniGameType === "face_merge" && fmData && (
          <div className="bg-gray-900 rounded-2xl p-6 mb-6 border-2 border-pink-700">
            <h2 className="text-xl font-black text-pink-400 text-center mb-1">🖼️ Face Merge</h2>
            {fmData.totalSets > 0 && fmData.phase !== "done" && (
              <p className="text-center text-xs text-pink-300 mb-4">Image {fmData.setIndex + 1} of {fmData.totalSets}</p>
            )}
            {fmData.phase === "done" && (
              <p className="text-center text-pink-300 font-bold">All images complete! 🎉</p>
            )}
            {fmData.phase === "guessing" && (
              <div className="flex justify-center">
                <div className="relative w-72 h-72 rounded-2xl overflow-hidden border-2 border-pink-500 shadow-2xl">
                  {fmData.merged ? (
                    <img src={fmData.merged} alt="Merged" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <>
                      {fmData.image1 && <img src={fmData.image1} alt="Face 1" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.55 }} />}
                      {fmData.image2 && <img src={fmData.image2} alt="Face 2" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.55, mixBlendMode: "multiply" }} />}
                    </>
                  )}
                  <div className="absolute bottom-2 left-0 right-0 text-center">
                    <span className="bg-black/70 text-white text-xs px-3 py-1 rounded-full font-bold">Who are these people?</span>
                  </div>
                </div>
              </div>
            )}
            {fmData.phase === "revealed" && (
              <div className="space-y-4">
                {fmData.merged && (
                  <div className="flex justify-center">
                    <div className="bg-black rounded-xl border-2 border-pink-500 overflow-hidden" style={{ width: "min(40vh, 240px)", aspectRatio: "1/1" }}>
                      <img src={fmData.merged} alt="Merged" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {fmData.image1 && (
                    <div className="text-center">
                      <p className="text-xs text-gray-400 font-semibold mb-1">Person 1</p>
                      <div className="w-full bg-black rounded-xl border-2 border-pink-400 overflow-hidden" style={{ aspectRatio: "3/4", maxHeight: "60vh" }}>
                        <img src={fmData.image1} alt="Person 1" className="w-full h-full object-contain" />
                      </div>
                    </div>
                  )}
                  {fmData.image2 && (
                    <div className="text-center">
                      <p className="text-xs text-gray-400 font-semibold mb-1">Person 2</p>
                      <div className="w-full bg-black rounded-xl border-2 border-pink-400 overflow-hidden" style={{ aspectRatio: "3/4", maxHeight: "60vh" }}>
                        <img src={fmData.image2} alt="Person 2" className="w-full h-full object-contain" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {isMiniGame && miniGameType === "number_survival" && nsData && (
          <div className="bg-gray-900 rounded-2xl p-6 mb-6 border-2 border-blue-700">
            <h2 className="text-xl font-black text-blue-400 text-center mb-2">🔢 Number Survival</h2>
            <p className="text-center text-sm text-gray-400 mb-4">
              Round {nsData.round} of {nsData.totalRounds} • {nsData.totalSurvivors} surviving
            </p>
            <div className="grid grid-cols-2 gap-3">
              {teams.map((team) => {
                const colors = getTeamColors(team.color);
                const survivors = nsData.teamSurvivors[team.id] || [];
                return (
                  <div key={team.id} className={`rounded-xl p-3 border-2 ${colors.border} bg-gray-800`}>
                    <p className={`text-sm font-black ${colors.text} text-center mb-2`}>{team.name}</p>
                    <div className="flex flex-wrap justify-center gap-1">
                      {survivors.length === 0 ? (
                        <span className="text-xs text-gray-500">Eliminated</span>
                      ) : (
                        survivors.map((name, i) => (
                          <span key={i} className="text-xs bg-gray-900 px-2 py-0.5 rounded-full">{name}</span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {nsData.currentResult && nsData.phase === "revealing" && (
              <div className="mt-4 bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-400 text-center mb-2">Round {nsData.currentResult.round} picks</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {nsData.currentResult.choices.map((c, i) => {
                    const isOut = nsData.currentResult!.eliminated.includes(c.socketId);
                    return (
                      <span key={i} className={`text-xs px-2 py-1 rounded-full ${isOut ? "bg-red-950 text-red-300 line-through" : "bg-green-950 text-green-300"}`}>
                        {c.avatar} {c.name}: {c.number}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {isMiniGame && miniGameType === "mystery_puzzle" && mpData && (
          <div className="bg-gray-900 rounded-2xl p-4 mb-6 border-2 border-amber-700">
            <h2 className="text-xl font-black text-amber-400 text-center mb-3">🔐 Mystery Puzzle</h2>

            {/* Winner banner */}
            {mpData.winnerTeamId && (() => {
              const winner = teams.find((t) => t.id === mpData.winnerTeamId);
              return winner ? (
                <div className="bg-green-900 border-2 border-green-500 rounded-xl p-3 text-center mb-4 animate-pulse">
                  <p className="text-green-300 text-xs font-bold">VAULT CRACKED!</p>
                  <p className="text-2xl font-black text-white">🏆 {winner.name} wins</p>
                </div>
              ) : null;
            })()}

            {/* Split-screen — Team A | Team B */}
            <div className="grid grid-cols-2 gap-3">
              {teams.slice(0, 2).map((team) => {
                const td = mpData.teamData?.[team.id];
                const colors = getTeamColors(team.color);
                const solverName = mpData.solverNamesByTeam?.[team.id];
                if (!td) return (
                  <div key={team.id} className={`rounded-xl p-3 border-2 ${colors.border} bg-gray-800/40 flex items-center justify-center min-h-[200px]`}>
                    <p className="text-gray-500 text-xs text-center">No puzzle for {team.name}</p>
                  </div>
                );
                const collectedDigits = td.clues.filter((c) => c.digit !== null).map((c) => c.digit as string);
                return (
                  <div key={team.id} className={`rounded-xl p-3 border-2 ${colors.border} bg-gray-800/40 space-y-2`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-black text-sm ${colors.text}`}>{team.name}</p>
                        <p className="text-[10px] text-gray-400">🔑 {solverName || "—"}</p>
                      </div>
                      <div className="text-3xl">{td.vaultUnlocked ? "🔓" : "🔒"}</div>
                    </div>

                    {td.story && (
                      <p className="text-gray-300 text-[10px] italic leading-snug">{td.story}</p>
                    )}

                    {/* Clues (only revealed text) */}
                    <div className="space-y-1">
                      {td.clues.map((clue, i) => {
                        if (!clue.revealed) {
                          return (
                            <div key={i} className="rounded p-1.5 border border-gray-700 bg-gray-900/50">
                              <p className="text-[10px] text-gray-600">Clue {i + 1} — hidden</p>
                            </div>
                          );
                        }
                        return (
                          <div key={i} className={`rounded p-1.5 border ${clue.digit !== null ? "border-green-600 bg-green-950/20" : "border-amber-500 bg-amber-950/20"}`}>
                            <div className="flex items-start gap-2">
                              <p className="text-[10px] text-amber-400 shrink-0">C{i + 1}</p>
                              <p className="text-white text-[11px] leading-snug flex-1">{clue.question}</p>
                              {clue.digit !== null && (
                                <span className="bg-green-700 text-white font-mono font-black text-xs px-1.5 rounded shrink-0">{clue.digit}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Collected digits (random order) */}
                    {collectedDigits.length > 0 && (
                      <div className="bg-black/30 rounded p-2 text-center">
                        <p className="text-[9px] text-amber-400 font-bold uppercase mb-1">Digits collected</p>
                        <div className="flex justify-center gap-1">
                          {collectedDigits.map((d, i) => (
                            <span key={i} className="bg-amber-500/30 border border-amber-400 text-amber-100 font-mono font-black text-base w-7 h-7 rounded flex items-center justify-center">{d}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Recent attempts */}
            {mpData.attempts && mpData.attempts.length > 0 && (
              <div className="bg-gray-800/50 rounded-lg p-2 mt-3">
                <p className="text-xs text-amber-400 font-bold uppercase mb-1">Recent attempts</p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {[...mpData.attempts].slice(-5).reverse().map((a, i) => {
                    const team = teams.find((t) => t.id === a.teamId);
                    const colors = team ? getTeamColors(team.color) : null;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className={colors?.text || "text-gray-400"}>{a.playerName} ({team?.name})</span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white">{a.code}</span>
                          <span className={a.correct ? "text-green-400" : "text-red-400"}>{a.correct ? "✓" : "✗"}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {isMiniGame && miniGameType === "pacman" && (
          <div className="bg-gray-900 rounded-2xl p-6 mb-6 border-2 border-purple-700 text-center">
            <div className="text-4xl mb-2">👾</div>
            <h2 className="text-xl font-black text-purple-300">Pac-Man Battle</h2>
            <p className="text-purple-400/70 text-sm mt-2">Players are competing on their devices — see the scoreboard above for results.</p>
          </div>
        )}

        {/* QUESTION DISPLAY */}
        {!isMiniGame && status === "lobby" && (
          <div className="bg-gray-900 rounded-2xl p-6 text-center border border-gray-800">
            <div className="text-5xl mb-3">⏳</div>
            <h2 className="text-xl font-bold text-white">Game hasn't started yet</h2>
            <p className="text-gray-500 text-sm mt-1">Waiting for admin to start the game</p>
          </div>
        )}

        {!isMiniGame && (status === "question_active" || status === "buzzed" || status === "round_end") && currentQuestion && (
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

        {!isMiniGame && status === "buzzer_active" && !buzzedBy && (
          <div className="bg-orange-950 rounded-2xl p-6 text-center border-2 border-orange-500 animate-pulse">
            <div className="text-4xl mb-2">🔔</div>
            <h2 className="text-xl font-black text-white">Buzzer is open!</h2>
            <p className="text-orange-300 text-sm mt-1">First team to buzz in wins the round</p>
          </div>
        )}

        {!isMiniGame && status === "playing" && currentQuestionIndex === -1 && !buzzedBy && (
          <div className="bg-gray-900 rounded-2xl p-6 text-center border border-gray-800">
            <div className="text-5xl mb-3">🎯</div>
            <h2 className="text-xl font-bold text-white">Game is live!</h2>
          </div>
        )}

        {status === "finished" && (
          <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
            <div className="text-5xl mb-3">🏁</div>
            <h2 className="text-3xl font-black text-yellow-400 mb-4">Game Over</h2>
            <div className="flex justify-center gap-6 flex-wrap">
              {teams.map((team) => {
                const colors = getTeamColors(team.color);
                return (
                  <div key={team.id} className="text-center">
                    <div className={`text-4xl font-black ${colors.text}`}>{team.score}</div>
                    <div className="text-white font-bold mt-1">{team.name}</div>
                  </div>
                );
              })}
            </div>
            <p className="text-gray-500 text-sm mt-4">Final scores — host announces the winner</p>
          </div>
        )}
      </div>
    </div>
  );
}
