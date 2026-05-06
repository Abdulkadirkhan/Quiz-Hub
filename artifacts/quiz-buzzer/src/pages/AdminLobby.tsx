import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import QRCode from "react-qr-code";
import { getSocket } from "@/lib/socket";
import { GameState, Question } from "@/lib/types";

const DEFAULT_TEAM_NAMES = ["Team A", "Team B"];

const DEFAULT_QUESTIONS: Question[] = [
  { id: "q1", text: "What is the capital of France?", choices: [{ label: "A", text: "Berlin" }, { label: "B", text: "Madrid" }, { label: "C", text: "Paris" }, { label: "D", text: "Rome" }], timeLimit: 30 },
  { id: "q2", text: "What is 7 × 8?", choices: [{ label: "A", text: "54" }, { label: "B", text: "56" }, { label: "C", text: "58" }, { label: "D", text: "64" }], timeLimit: 30 },
  { id: "q3", text: "Which planet is closest to the Sun?", choices: [{ label: "A", text: "Venus" }, { label: "B", text: "Earth" }, { label: "C", text: "Mercury" }, { label: "D", text: "Mars" }], timeLimit: 30 },
  { id: "q4", text: "Who painted the Mona Lisa?", choices: [{ label: "A", text: "Michelangelo" }, { label: "B", text: "Raphael" }, { label: "C", text: "Leonardo da Vinci" }, { label: "D", text: "Donatello" }], timeLimit: 30 },
  { id: "q5", text: "What is the chemical symbol for water?", choices: [{ label: "A", text: "H2O" }, { label: "B", text: "CO2" }, { label: "C", text: "NaCl" }, { label: "D", text: "O2" }], timeLimit: 30 },
];

function loadQuestions(): Question[] {
  try {
    const raw = localStorage.getItem("quiz_questions");
    if (raw) return JSON.parse(raw) as Question[];
  } catch {}
  return DEFAULT_QUESTIONS;
}

export default function AdminLobby() {
  const [, navigate] = useLocation();
  const [teamNames, setTeamNames] = useState<string[]>(DEFAULT_TEAM_NAMES);
  const [numTeams, setNumTeams] = useState(2);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [questions, setQuestions] = useState<Question[]>(loadQuestions);
  const [creating, setCreating] = useState(false);
  const socketRef = useRef(getSocket());
  const baseUrl = window.location.origin;

  useEffect(() => {
    const handler = () => {
      setQuestions(loadQuestions());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    socket.on("game:player_joined", (state: GameState) => setGameState(state));
    socket.on("game:player_left", (state: GameState) => setGameState(state));
    return () => { socket.off("game:player_joined"); socket.off("game:player_left"); };
  }, []);

  const handleNumTeamsChange = (n: number) => {
    setNumTeams(n);
    setTeamNames((prev) => {
      const updated = [...prev];
      while (updated.length < n) updated.push(`Team ${String.fromCharCode(65 + updated.length)}`);
      return updated.slice(0, n);
    });
  };

  const handleCreateSession = () => {
    setCreating(true);
    const socket = socketRef.current;
    socket.emit("admin:create_session", { teamNames, questions }, (res: { sessionId: string; state: GameState }) => {
      setSessionId(res.sessionId);
      setGameState(res.state);
      setCreating(false);
    });
  };

  const handleStartGame = () => {
    if (!sessionId) return;
    socketRef.current.emit("admin:start_game", { sessionId });
    navigate(`/admin/game/${sessionId}`);
  };

  const TEAM_COLORS = ["#2563EB", "#DC2626", "#16A34A", "#CA8A04", "#9333EA", "#EA580C"];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black tracking-tight mb-2">
            <span className="text-yellow-400">QUIZ</span> <span className="text-white">BUZZER</span>
          </h1>
          <p className="text-gray-400 text-lg">Admin Control Panel</p>
        </div>

        {!sessionId ? (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold mb-6 text-yellow-400">Game Setup</h2>

              <div className="mb-6 space-y-3">
                <label className="block text-sm font-semibold text-gray-400 mb-2">Team Names</label>
                {teamNames.map((name, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: TEAM_COLORS[i] }} />
                    <input
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                      value={name}
                      onChange={(e) => { const updated = [...teamNames]; updated[i] = e.target.value; setTeamNames(updated); }}
                      placeholder={`Team ${String.fromCharCode(65 + i)}`}
                    />
                  </div>
                ))}
              </div>

              <button onClick={handleCreateSession} disabled={creating} className="w-full bg-yellow-400 text-black py-3 rounded-xl font-black text-lg hover:bg-yellow-300 transition disabled:opacity-50">
                {creating ? "Creating..." : "Create Game Session"}
              </button>
            </div>

            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 flex flex-col gap-3">
              <h2 className="text-xl font-bold text-yellow-400">Questions</h2>
              <button
                onClick={() => navigate("/admin/questions")}
                className="bg-yellow-400 hover:bg-yellow-300 text-black px-6 py-4 rounded-xl font-black text-lg transition"
              >
                Manage Questions →
              </button>
              <button
                onClick={() => navigate("/admin/minigames")}
                className="bg-pink-600 hover:bg-pink-500 text-white px-6 py-4 rounded-xl font-black text-lg transition"
              >
                🎮 Manage Mini-Games →
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-yellow-400">Game Lobby</h2>
                <p className="text-gray-400">Session Code: <span className="font-mono font-bold text-white text-xl">{sessionId}</span></p>
              </div>
              <button onClick={handleStartGame} className="bg-green-500 hover:bg-green-400 text-white px-8 py-3 rounded-xl font-black text-lg transition">
                Start Game
              </button>
            </div>

            <div className="mb-4 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-gray-500 font-semibold">👁 SPECTATOR LINK</p>
                <p className="text-gray-300 text-sm font-mono break-all">{baseUrl}/watch/{sessionId}</p>
              </div>
              <a href={`${baseUrl}/watch/${sessionId}`} target="_blank" rel="noopener noreferrer" className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap">
                Open Spectator View →
              </a>
            </div>

            <div className={`grid gap-6 grid-cols-1 md:grid-cols-${Math.min(numTeams, 3)}`}>
              {gameState?.teams.map((team) => {
                const joinUrl = `${baseUrl}/join/${sessionId}/${team.id}`;
                const players = gameState.players[team.id] || [];
                const TEAM_COLORS_HEX = ["#2563EB", "#DC2626", "#16A34A", "#CA8A04", "#9333EA", "#EA580C"];
                const colorHex = TEAM_COLORS_HEX[gameState.teams.indexOf(team)] || "#60a5fa";

                return (
                  <div key={team.id} className="bg-gray-900 rounded-2xl p-6 border-2" style={{ borderColor: colorHex }}>
                    <h3 className="text-xl font-black mb-4 text-center" style={{ color: colorHex }}>{team.name}</h3>
                    <div className="flex justify-center mb-4">
                      <div className="bg-white p-3 rounded-xl"><QRCode value={joinUrl} size={160} /></div>
                    </div>
                    <p className="text-center text-xs text-gray-500 mb-1 break-all">{joinUrl}</p>
                    <div className="mt-4">
                      <p className="text-sm text-gray-400 mb-2">Players joined: {players.length}</p>
                      <div className="space-y-1">
                        {players.map((p, i) => (
                          <div key={i} className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm text-white flex items-center gap-2">
                            <span>{p.avatar || "🎮"}</span><span>{p.name}</span>
                          </div>
                        ))}
                        {players.length === 0 && <p className="text-gray-600 text-sm italic">Waiting for players...</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
