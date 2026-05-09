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

interface SavedIdentity {
  sessionId: string;
  teamId: string;
  playerKey: string;
  playerName: string;
  avatar: string;
}

const STORAGE_KEY = "quiz_player_identity";

function newPlayerKey(): string {
  // RFC4122-ish random ID; sufficient for cross-session uniqueness
  return "pk-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function loadIdentity(sessionId: string, teamId: string): SavedIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedIdentity;
    if (parsed.sessionId === sessionId && parsed.teamId === teamId) return parsed;
  } catch {}
  return null;
}

function saveIdentity(id: SavedIdentity) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(id)); } catch {}
}

export function clearIdentity() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

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
  const [autoRejoinAttempted, setAutoRejoinAttempted] = useState(false);
  const playerKeyRef = useRef<string>("");
  const socketRef = useRef(getSocket());

  // Initialize playerKey: load saved or generate fresh
  useEffect(() => {
    const saved = loadIdentity(sessionId, teamId);
    if (saved) {
      playerKeyRef.current = saved.playerKey;
      setPlayerName(saved.playerName);
      setAvatar(saved.avatar);
    } else {
      playerKeyRef.current = newPlayerKey();
    }
  }, [sessionId, teamId]);

  useEffect(() => {
    const socket = socketRef.current;

    socket.emit("session:get_state", { sessionId }, (res: { state: GameState | null }) => {
      if (res.state) {
        setGameState(res.state);
        if (res.state.status !== "lobby") setGameStarted(true);

        // Auto-rejoin if we have a saved identity for this session+team and haven't yet
        const saved = loadIdentity(sessionId, teamId);
        if (saved && !autoRejoinAttempted && !joined) {
          setAutoRejoinAttempted(true);
          socket.emit(
            "player:join",
            { sessionId, playerKey: saved.playerKey, playerName: saved.playerName, teamId: saved.teamId, avatar: saved.avatar },
            (joinRes: { success: boolean; error?: string; state: GameState }) => {
              if (joinRes.success) {
                setJoined(true);
                setGameState(joinRes.state);
                if (joinRes.state?.status && joinRes.state.status !== "lobby") setGameStarted(true);
              }
            },
          );
        }
      }
    });

    // Auto-rejoin again on reconnect (transient disconnect)
    const onReconnect = () => {
      const saved = loadIdentity(sessionId, teamId);
      if (saved) {
        socket.emit(
          "player:join",
          { sessionId, playerKey: saved.playerKey, playerName: saved.playerName, teamId: saved.teamId, avatar: saved.avatar },
          () => {},
        );
      }
    };
    socket.on("connect", onReconnect);

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
    socket.on("game:round_reset", onState);
    socket.on("game:finished", onState);
    socket.on("game:buzz_reset", onState);
    socket.on("game:player_joined", onState);
    socket.on("game:player_left", onState);
    socket.on("game:number_update", onState);
    socket.on("game:number_result", onState);
    socket.on("game:number_next_round", onState);
    socket.on("game:number_done", onState);
    socket.on("game:face_merge_updated", onState);
    socket.on("game:mystery_updated", onState);
    socket.on("game:pacman_tick", onState);
    socket.on("game:pacman_finished", ({ state }: { state: GameState }) => setGameState(state));
    socket.on("game:buzzer_opened", onState);
    socket.on("game:buzzer_closed", onState);

    return () => {
      socket.off("connect", onReconnect);
      socket.off("game:started", onStarted);
      socket.off("game:minigame_started", onState);
      socket.off("game:minigame_ended", onState);
      socket.off("game:question", onQuestion);
      socket.off("game:buzzed", onBuzzed);
      socket.off("game:score_update", onState);
      socket.off("game:round_end", onState);
      socket.off("game:round_reset", onState);
      socket.off("game:finished", onState);
      socket.off("game:buzz_reset", onState);
      socket.off("game:player_joined", onState);
      socket.off("game:player_left", onState);
      socket.off("game:number_update", onState);
      socket.off("game:number_result", onState);
      socket.off("game:number_next_round", onState);
      socket.off("game:number_done", onState);
      socket.off("game:face_merge_updated", onState);
      socket.off("game:mystery_updated", onState);
      socket.off("game:pacman_tick", onState);
      socket.off("game:pacman_finished");
      socket.off("game:buzzer_opened", onState);
      socket.off("game:buzzer_closed", onState);
    };
  }, [sessionId, teamId, autoRejoinAttempted, joined]);

  const handleJoin = () => {
    if (!playerName.trim()) { setError("Please enter your name"); return; }
    const socket = socketRef.current;
    const key = playerKeyRef.current || newPlayerKey();
    playerKeyRef.current = key;
    socket.emit(
      "player:join",
      { sessionId, playerKey: key, playerName: playerName.trim(), teamId, avatar },
      (res: { success: boolean; error?: string; state: GameState }) => {
        if (res.success) {
          saveIdentity({ sessionId, teamId, playerKey: key, playerName: playerName.trim(), avatar });
          setJoined(true);
          setGameState(res.state);
          setError("");
        } else {
          setError(res.error || "Failed to join");
        }
      },
    );
  };

  const team = gameState?.teams.find((t) => t.id === teamId);
  const TEAM_BG: Record<string, string> = { blue: "#1e3a8a", red: "#7f1d1d", green: "#14532d", yellow: "#713f12", purple: "#4a1d96", orange: "#7c2d12" };
  const TEAM_FG: Record<string, string> = { blue: "#60a5fa", red: "#f87171", green: "#4ade80", yellow: "#facc15", purple: "#c084fc", orange: "#fb923c" };
  const teamBg = team ? TEAM_BG[team.color] || "#1f2937" : "#1f2937";
  const teamFg = team ? TEAM_FG[team.color] || "#ffffff" : "#ffffff";

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="text-3xl mb-3">⏳</div>
          <p className="text-white/60">Connecting…</p>
        </div>
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
            {gameStarted && <p className="text-white/70 text-sm mt-3">Game already started — you'll join the next round</p>}
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
              <div className="text-center mt-2"><span className="text-4xl">{avatar}</span></div>
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
