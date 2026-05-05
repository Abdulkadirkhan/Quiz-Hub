import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { getSocket } from "@/lib/socket";
import { GameState } from "@/lib/types";
import PlayerBuzzer from "./PlayerBuzzer";

const AVATARS = [
  "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯",
  "🦁","🐮","🐷","🐸","🐵","🦆","🦉","🐺","🐴","🦄",
  "🐝","🦋","🐢","🐙","🦈","🦀","🐬","🦋","🧸","🎮",
];

export default function PlayerJoin() {
  const [, params] = useRoute("/join/:sessionId/:teamId");
  const sessionId = params?.sessionId || "";
  const teamId = params?.teamId || "";

  const [playerName, setPlayerName] = useState("");
  const [avatar, setAvatar] = useState("🐶");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const socketRef = useRef(getSocket());

  useEffect(() => {
    const socket = socketRef.current;

    socket.emit("session:get_state", { sessionId }, (res: { state: GameState | null }) => {
      if (res.state) {
        setGameState(res.state);
        if (res.state.status !== "lobby") setGameStarted(true);
      }
    });

    const onState = (state: GameState) => setGameState(state);
    const onStarted = (state: GameState) => { setGameState(state); setGameStarted(true); };
    const onQuestion = ({ state }: { state: GameState }) => setGameState(state);
    const onBuzzed = ({ state }: { state: GameState }) => setGameState(state);

    socket.on("game:started", onStarted);
    socket.on("game:minigame_started", onState);
    socket.on("game:minigame_ended", onState);
    socket.on("game:question", onQuestion);
    socket.on("game:buzzed", onBuzzed);
    socket.on("game:score_update", onState);
    socket.on("game:round_end", onState);
    socket.on("game:finished", onState);
    socket.on("game:buzz_reset", onState);
    socket.on("game:number_update", onState);
    socket.on("game:number_result", onState);
    socket.on("game:number_next_round", onState);
    socket.on("game:number_done", onState);
    socket.on("game:reaction_waiting", onState);
    socket.on("game:reaction_go", onState);
    socket.on("game:reaction_result", onState);

    return () => {
      socket.off("game:started", onStarted);
      socket.off("game:minigame_started", onState);
      socket.off("game:minigame_ended", onState);
      socket.off("game:question", onQuestion);
      socket.off("game:buzzed", onBuzzed);
      socket.off("game:score_update", onState);
      socket.off("game:round_end", onState);
      socket.off("game:finished", onState);
      socket.off("game:buzz_reset", onState);
      socket.off("game:number_update", onState);
      socket.off("game:number_result", onState);
      socket.off("game:number_next_round", onState);
      socket.off("game:number_done", onState);
      socket.off("game:reaction_waiting", onState);
      socket.off("game:reaction_go", onState);
      socket.off("game:reaction_result", onState);
    };
  }, [sessionId]);

  const handleJoin = () => {
    if (!playerName.trim()) { setError("Please enter your name"); return; }
    const socket = socketRef.current;
    socket.emit(
      "player:join",
      { sessionId, playerName: playerName.trim(), teamId, avatar },
      (res: { success: boolean; error?: string; state: GameState }) => {
        if (res.success) {
          setJoined(true);
          setGameState(res.state);
          setError("");
        } else {
          setError(res.error || "Failed to join");
        }
      }
    );
  };

  const team = gameState?.teams.find((t) => t.id === teamId);

  const TEAM_BG: Record<string, string> = {
    blue: "#1e3a8a", red: "#7f1d1d", green: "#14532d",
    yellow: "#713f12", purple: "#4a1d96", orange: "#7c2d12",
  };
  const TEAM_FG: Record<string, string> = {
    blue: "#60a5fa", red: "#f87171", green: "#4ade80",
    yellow: "#facc15", purple: "#c084fc", orange: "#fb923c",
  };

  const teamBg = team ? TEAM_BG[team.color] || "#1f2937" : "#1f2937";
  const teamFg = team ? TEAM_FG[team.color] || "#ffffff" : "#ffffff";

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg animate-pulse">Connecting...</div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-2">Team Not Found</h1>
          <p className="text-gray-400">This team link is invalid.</p>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: teamBg }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-black mb-2" style={{ color: teamFg }}>JOIN</h1>
            <div className="text-2xl font-black px-6 py-2 rounded-full inline-block" style={{ backgroundColor: teamFg, color: teamBg }}>
              {team.name}
            </div>
          </div>

          <div className="bg-black/30 rounded-2xl p-5 space-y-5">
            <div>
              <label className="block text-white text-sm font-semibold mb-2">Pick your avatar</label>
              <div className="grid grid-cols-10 gap-1">
                {AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setAvatar(emoji)}
                    className={`text-2xl rounded-lg p-1 transition-all select-none ${
                      avatar === emoji ? "ring-2 scale-110 bg-white/20" : "opacity-60 hover:opacity-100"
                    }`}
                    style={avatar === emoji ? { outline: `2px solid ${teamFg}`, outlineOffset: "2px" } : {}}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="text-center mt-2">
                <span className="text-4xl">{avatar}</span>
              </div>
            </div>

            <div>
              <label className="block text-white text-sm font-semibold mb-2">Your Name</label>
              <input
                className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-white/60 placeholder-white/30"
                placeholder="Enter your name..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                autoFocus
              />
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>

            <button
              onClick={handleJoin}
              className="w-full py-4 rounded-xl font-black text-xl transition active:scale-95"
              style={{ backgroundColor: teamFg, color: teamBg }}
            >
              Join Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameStarted || gameState.status !== "lobby") {
    return (
      <PlayerBuzzer
        sessionId={sessionId}
        playerName={playerName}
        avatar={avatar}
        team={team}
        gameState={gameState}
        socket={socketRef.current}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: teamBg }}>
      <div className="text-center">
        <div className="text-6xl mb-3">{avatar}</div>
        <div className="text-2xl font-black px-6 py-2 rounded-full inline-block mb-4" style={{ backgroundColor: teamFg, color: teamBg }}>
          {team.name}
        </div>
        <h2 className="text-2xl font-black text-white mb-1">{playerName}</h2>
        <p className="text-white/60 text-lg">Waiting for the game to start...</p>
        <div className="mt-8 animate-bounce text-5xl">⏳</div>
        <div className="mt-6">
          <p className="text-white/40 text-sm mb-2">Players in {team.name}:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {(gameState.players[teamId] || []).map((p, i) => (
              <span key={i} className="text-sm px-3 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: teamFg + "33", color: teamFg }}>
                <span>{p.avatar}</span> {p.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
