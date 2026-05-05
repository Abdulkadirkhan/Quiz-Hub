import { useState } from "react";
import { MiniGameType, MysteryPuzzleClue } from "@/lib/types";

interface Props {
  onSelect: (type: MiniGameType, data?: { story: string; clues: MysteryPuzzleClue[] }) => void;
  onClose: () => void;
}

const EMPTY_CLUE: MysteryPuzzleClue = { question: "", answer: "", reward: "" };

const GAMES = [
  { type: "pacman" as MiniGameType, icon: "👾", name: "Pac-Man Battle", desc: "Eat the most dots with infinite respawn. 30s timer!", color: "bg-purple-900 border-purple-600 hover:border-purple-400" },
  { type: "number_survival" as MiniGameType, icon: "🔢", name: "Number Survival", desc: "Pick a unique number 1–10 or get eliminated. 3 rounds!", color: "bg-orange-950 border-orange-700 hover:border-orange-400" },
  { type: "face_merge" as MiniGameType, icon: "🖼️", name: "Face Merge", desc: "Upload 2 face images, blend them, teams buzz in to guess!", color: "bg-pink-950 border-pink-700 hover:border-pink-400" },
  { type: "mystery_puzzle" as MiniGameType, icon: "🔐", name: "Mystery Puzzle", desc: "Present a mystery story with clues. Teams crack the vault code!", color: "bg-teal-950 border-teal-700 hover:border-teal-400" },
];

export default function MiniGameSelector({ onSelect, onClose }: Props) {
  const [mode, setMode] = useState<"list" | "mystery">("list");
  const [story, setStory] = useState("");
  const [clues, setClues] = useState<MysteryPuzzleClue[]>([{ ...EMPTY_CLUE }, { ...EMPTY_CLUE }, { ...EMPTY_CLUE }, { ...EMPTY_CLUE }]);

  const updateClue = (i: number, field: keyof MysteryPuzzleClue, value: string) => {
    setClues((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  };

  const handleMysterySubmit = () => {
    const validClues = clues.filter((c) => c.question.trim());
    if (!story.trim()) return;
    if (validClues.length === 0) return;
    onSelect("mystery_puzzle", { story: story.trim(), clues: validClues });
  };

  const validMystery = story.trim() && clues.some((c) => c.question.trim());

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-gray-900 rounded-2xl p-6 border border-gray-700 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-black text-white">{mode === "list" ? "🎮 Start Mini-Game" : "🔐 Mystery Puzzle Setup"}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl font-bold transition">✕</button>
        </div>

        {mode === "list" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GAMES.map((game) => (
                <button
                  key={game.type}
                  onClick={() => game.type === "mystery_puzzle" ? setMode("mystery") : onSelect(game.type)}
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
            <div>
              <label className="text-sm font-bold text-gray-400 block mb-1">🎬 Story Introduction</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-400 h-20 resize-none"
                placeholder="e.g. The company's vault has been locked! Solve 4 clues to crack the code before time runs out..."
                value={story}
                onChange={(e) => setStory(e.target.value)}
              />
            </div>

            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Clues (fill in as many as you need)</p>

            {clues.map((clue, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-4 space-y-2 border border-gray-700">
                <p className="text-teal-400 font-bold text-sm">Clue {i + 1}</p>
                <input
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-400"
                  placeholder="Question / Riddle / Puzzle"
                  value={clue.question}
                  onChange={(e) => updateClue(i, "question", e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-400"
                    placeholder="Answer (e.g. KEYBOARD)"
                    value={clue.answer}
                    onChange={(e) => updateClue(i, "answer", e.target.value)}
                  />
                  <input
                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                    placeholder="Code digit/word (e.g. 7)"
                    value={clue.reward}
                    onChange={(e) => updateClue(i, "reward", e.target.value)}
                  />
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setMode("list")} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold text-sm transition">← Back</button>
              <button
                onClick={handleMysterySubmit}
                disabled={!validMystery}
                className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-black text-sm transition disabled:opacity-40"
              >
                Start Mystery Puzzle →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
