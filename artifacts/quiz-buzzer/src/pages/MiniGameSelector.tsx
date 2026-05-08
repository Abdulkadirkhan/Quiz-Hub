import { useState, useEffect } from "react";
import { MiniGameType, MysteryPuzzleClue } from "@/lib/types";

interface Props {
  onSelect: (type: MiniGameType, data?: { story: string; clues: MysteryPuzzleClue[] }) => void;
  onClose: () => void;
}

const EMPTY_CLUE: MysteryPuzzleClue = { question: "", answer: "", reward: "" };
const MYSTERY_KEY = "quiz_minigames_mystery_puzzle";

interface SavedMystery {
  story: string;
  clues: Array<{ question: string; digit: string; answer?: string }>;
}

function loadSavedMystery(): SavedMystery | null {
  try {
    const raw = localStorage.getItem(MYSTERY_KEY);
    if (raw) return JSON.parse(raw) as SavedMystery;
  } catch {}
  return null;
}

const GAMES = [
  { type: "pacman" as MiniGameType, icon: "👾", name: "Pac-Man Battle", desc: "Eat the most dots with infinite respawn. 30s timer!", color: "bg-purple-900 border-purple-600 hover:border-purple-400" },
  { type: "number_survival" as MiniGameType, icon: "🔢", name: "Number Survival", desc: "Pick a unique number 1–10 or get eliminated. 3 rounds!", color: "bg-orange-950 border-orange-700 hover:border-orange-400" },
  { type: "face_merge" as MiniGameType, icon: "🖼️", name: "Face Merge", desc: "Multiple image sets — race through them! Pre-load in Manage Mini-Games.", color: "bg-pink-950 border-pink-700 hover:border-pink-400" },
  { type: "mystery_puzzle" as MiniGameType, icon: "🔐", name: "Mystery Puzzle", desc: "4 clues, one 4-digit code. Solver per team races to unlock the vault.", color: "bg-amber-950 border-amber-700 hover:border-amber-400" },
];

export default function MiniGameSelector({ onSelect, onClose }: Props) {
  const [mode, setMode] = useState<"list" | "mystery">("list");
  const [story, setStory] = useState("");
  const [clues, setClues] = useState<MysteryPuzzleClue[]>([{ ...EMPTY_CLUE }, { ...EMPTY_CLUE }, { ...EMPTY_CLUE }, { ...EMPTY_CLUE }]);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    const saved = loadSavedMystery();
    if (saved && saved.clues && saved.clues.every((c) => /^[0-9]$/.test(c.digit))) {
      setHasSaved(true);
    }
  }, []);

  const handleMysteryClick = () => {
    const saved = loadSavedMystery();
    if (saved && saved.clues && saved.clues.every((c) => /^[0-9]$/.test(c.digit))) {
      // Use saved puzzle directly
      const fullClues: MysteryPuzzleClue[] = saved.clues.map((c) => ({
        question: c.question || "",
        answer: c.answer || "",
        reward: c.digit, // map digit -> reward
      }));
      onSelect("mystery_puzzle", { story: saved.story || "", clues: fullClues });
    } else {
      // Fall back to inline form
      setMode("mystery");
    }
  };

  const updateClue = (i: number, field: keyof MysteryPuzzleClue, value: string) => {
    let v = value;
    if (field === "reward") v = value.replace(/\D/g, "").slice(0, 1);
    setClues((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: v } : c));
  };

  const handleMysterySubmit = () => {
    if (!clues.every((c) => /^[0-9]$/.test(c.reward))) return;
    onSelect("mystery_puzzle", { story: story.trim(), clues });
  };

  const validMystery = clues.every((c) => /^[0-9]$/.test(c.reward));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-gray-900 rounded-2xl p-6 border border-gray-700 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-black text-white">{mode === "list" ? "🎮 Start Mini-Game" : "🔐 Mystery Puzzle Setup"}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl font-bold transition">✕</button>
        </div>

        {mode === "list" && (
          <>
            {hasSaved && (
              <div className="bg-green-950/40 border border-green-700 rounded-lg p-2 text-center text-xs text-green-300 mb-3">
                ✓ Saved Mystery Puzzle ready — click it to start instantly
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GAMES.map((game) => (
                <button
                  key={game.type}
                  onClick={() => game.type === "mystery_puzzle" ? handleMysteryClick() : onSelect(game.type)}
                  className={`text-left rounded-xl p-4 border-2 transition-all ${game.color}`}
                >
                  <div className="text-4xl mb-2">{game.icon}</div>
                  <div className="text-white font-black text-lg leading-tight">{game.name}</div>
                  <div className="text-gray-400 text-xs mt-1 leading-snug">{game.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={onClose} className="w-full mt-4 py-2 text-gray-600 hover:text-gray-400 text-sm transition">Cancel</button>
          </>
        )}

        {mode === "mystery" && (
          <div className="space-y-4">
            <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-2 text-center text-xs text-amber-300">
              💡 Tip: Save puzzles in <span className="font-bold">Manage Mini-Games</span> to skip this form next time.
            </div>
            <div>
              <label className="text-sm font-bold text-gray-400 block mb-1">📖 Story (read by host)</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400 h-20 resize-none"
                placeholder="The vault is locked! Solve 4 clues to crack the 4-digit code..."
                value={story}
                onChange={(e) => setStory(e.target.value)}
              />
            </div>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">4 Clues — each gives one digit (0-9)</p>

            {clues.map((clue, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-3 space-y-2 border border-gray-700">
                <div className="flex items-center justify-between">
                  <p className="text-amber-400 font-bold text-sm">Clue {i + 1}</p>
                  <span className="text-xs text-gray-500">→ digit position {i + 1}</span>
                </div>
                <textarea
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-400 h-14 resize-none"
                  placeholder="Riddle / question / hint that the host reads aloud"
                  value={clue.question}
                  onChange={(e) => updateClue(i, "question", e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-semibold">Digit:</span>
                  <input
                    className="bg-gray-900 border border-amber-600 rounded-lg w-14 px-2 py-1 text-center text-white font-mono font-black text-lg focus:outline-none focus:border-amber-400"
                    placeholder="?"
                    value={clue.reward}
                    onChange={(e) => updateClue(i, "reward", e.target.value)}
                    maxLength={1}
                  />
                  <input
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-gray-500"
                    placeholder="(optional) Answer hint for admin reference"
                    value={clue.answer}
                    onChange={(e) => updateClue(i, "answer", e.target.value)}
                  />
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <button onClick={() => setMode("list")} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold transition">← Back</button>
              <button
                onClick={handleMysterySubmit}
                disabled={!validMystery}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-black transition disabled:opacity-40"
              >
                Start Puzzle
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
