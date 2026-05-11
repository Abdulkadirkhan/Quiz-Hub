import { useState, useEffect } from "react";
import { useLocation } from "wouter";

// ============================================================
// Types
// ============================================================

export type SequenceItemKind = "question" | "manual_question" | "buzzer" | "minigame";

export interface SequenceItem {
  id: string;
  kind: SequenceItemKind;
  // for kind === "question": specific question id from the question bank
  questionId?: string;
  // for kind === "minigame": which mini-game
  minigameType?: "number_survival" | "face_merge" | "mystery_puzzle";
  // human-readable label override
  label?: string;
}

export const SEQUENCE_KEY = "quiz_sequence_v1";
const QUESTIONS_KEY = "quiz_questions";

interface SavedQuestion { id: string; text: string; }

function newId() { return "seq-" + Math.random().toString(36).slice(2, 9); }

function loadQuestions(): SavedQuestion[] {
  try {
    const raw = localStorage.getItem(QUESTIONS_KEY);
    if (raw) return JSON.parse(raw) as SavedQuestion[];
  } catch {}
  return [];
}

export function loadSequence(): SequenceItem[] {
  try {
    const raw = localStorage.getItem(SEQUENCE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

const MINIGAME_LABEL: Record<string, string> = {
  number_survival: "🔢 Number Survival",
  face_merge: "🖼️ Face Merge",
  mystery_puzzle: "🔐 Mystery Puzzle",
};

const KIND_LABEL: Record<SequenceItemKind, string> = {
  question: "📋 Question",
  manual_question: "✏️ Manual Question",
  buzzer: "🔔 Buzzer Round",
  minigame: "🎮 Mini-Game",
};

const KIND_COLOR: Record<SequenceItemKind, string> = {
  question: "border-yellow-700 bg-yellow-950/30",
  manual_question: "border-blue-700 bg-blue-950/30",
  buzzer: "border-orange-700 bg-orange-950/30",
  minigame: "border-purple-700 bg-purple-950/30",
};

// ============================================================

export default function SequenceManager() {
  const [, navigate] = useLocation();
  const [items, setItems] = useState<SequenceItem[]>(() => loadSequence());
  const [questions] = useState<SavedQuestion[]>(() => loadQuestions());
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (!savedNotice) return;
    const t = setTimeout(() => setSavedNotice(false), 2000);
    return () => clearTimeout(t);
  }, [savedNotice]);

  const addItem = (kind: SequenceItemKind) => {
    const item: SequenceItem = { id: newId(), kind };
    if (kind === "question" && questions.length > 0) item.questionId = questions[0].id;
    if (kind === "minigame") item.minigameType = "number_survival";
    setItems((prev) => [...prev, item]);
  };

  const updateItem = (id: string, patch: Partial<SequenceItem>) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
  };

  const removeItem = (id: string) => {
    if (!confirm("Remove this item?")) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const saveSequence = () => {
    try {
      localStorage.setItem(SEQUENCE_KEY, JSON.stringify(items));
      setSavedNotice(true);
    } catch {
      alert("Couldn't save the sequence.");
    }
  };

  const clearAll = () => {
    if (!confirm("Clear the entire sequence?")) return;
    setItems([]);
    localStorage.removeItem(SEQUENCE_KEY);
  };

  const itemPreview = (item: SequenceItem): string => {
    if (item.kind === "question") {
      const q = questions.find((q) => q.id === item.questionId);
      return q ? q.text : "(pick a question)";
    }
    if (item.kind === "minigame") return MINIGAME_LABEL[item.minigameType || ""] || "(pick a mini-game)";
    if (item.kind === "manual_question") return "Ask a question verbally; award points manually";
    if (item.kind === "buzzer") return "Open buzzer for a verbal question";
    return "";
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-black text-yellow-400">Manage Sequence</h1>
            <p className="text-gray-500 text-sm">Plan the order of questions, buzzers, and mini-games for the game.</p>
          </div>
          <button onClick={() => navigate("/")} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">
            ← Back to Lobby
          </button>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border-2 border-emerald-700 mb-6">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-black text-emerald-400">🗂️ Game Sequence</h2>
              <p className="text-xs text-gray-400 mt-1">During the game, click "▶ Next in sequence" on the admin screen to advance through this list. You can still trigger ad-hoc questions / mini-games at any time.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={saveSequence} className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg font-black text-sm transition">Save</button>
              <button onClick={clearAll} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">Clear All</button>
            </div>
          </div>

          {savedNotice && (
            <div className="bg-green-950/40 border border-green-700 rounded-lg p-2 text-center text-sm text-green-300 mb-4">
              ✓ Sequence saved — load up the admin game screen to use it.
            </div>
          )}

          {questions.length === 0 && (
            <div className="bg-yellow-950/30 border border-yellow-700 rounded-lg p-3 text-center text-xs text-yellow-200 mb-4">
              ⚠️ No questions saved yet. Go to <span className="font-bold">Manage Questions</span> first to populate your bank.
            </div>
          )}

          <div className="space-y-2 mb-4">
            {items.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm italic">No items yet — add some below.</div>
            )}

            {items.map((item, idx) => (
              <div key={item.id} className={`rounded-xl p-3 border-2 ${KIND_COLOR[item.kind]} space-y-2`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-bold text-white/40">#{idx + 1}</span>
                    <span className="text-sm font-bold text-white">{KIND_LABEL[item.kind]}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-xs w-7 h-7 rounded">↑</button>
                    <button onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-xs w-7 h-7 rounded">↓</button>
                    <button onClick={() => removeItem(item.id)} className="bg-red-900 hover:bg-red-800 text-white text-xs px-2 h-7 rounded">Delete</button>
                  </div>
                </div>

                {item.kind === "question" && (
                  <div className="flex gap-2 items-center">
                    <label className="text-xs text-gray-400 shrink-0">Question:</label>
                    <select
                      value={item.questionId || ""}
                      onChange={(e) => updateItem(item.id, { questionId: e.target.value })}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-yellow-400"
                    >
                      <option value="">— pick a question —</option>
                      {questions.map((q) => (
                        <option key={q.id} value={q.id}>{q.text.slice(0, 60)}{q.text.length > 60 ? "…" : ""}</option>
                      ))}
                    </select>
                  </div>
                )}

                {item.kind === "minigame" && (
                  <div className="flex gap-2 items-center">
                    <label className="text-xs text-gray-400 shrink-0">Mini-game:</label>
                    <select
                      value={item.minigameType || "number_survival"}
                      onChange={(e) => updateItem(item.id, { minigameType: e.target.value as SequenceItem["minigameType"] })}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-purple-400"
                    >
                      <option value="number_survival">🔢 Number Survival</option>
                      <option value="face_merge">🖼️ Face Merge</option>
                      <option value="mystery_puzzle">🔐 Mystery Puzzle</option>
                    </select>
                  </div>
                )}

                <p className="text-xs text-white/50 italic">{itemPreview(item)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button onClick={() => addItem("question")} className="bg-yellow-700/40 hover:bg-yellow-700/70 text-yellow-200 px-3 py-2 rounded-lg font-bold text-sm transition">+ Question</button>
            <button onClick={() => addItem("manual_question")} className="bg-blue-700/40 hover:bg-blue-700/70 text-blue-200 px-3 py-2 rounded-lg font-bold text-sm transition">+ Manual</button>
            <button onClick={() => addItem("buzzer")} className="bg-orange-700/40 hover:bg-orange-700/70 text-orange-200 px-3 py-2 rounded-lg font-bold text-sm transition">+ Buzzer</button>
            <button onClick={() => addItem("minigame")} className="bg-purple-700/40 hover:bg-purple-700/70 text-purple-200 px-3 py-2 rounded-lg font-bold text-sm transition">+ Mini-Game</button>
          </div>

          <p className="text-xs text-gray-600 text-center mt-4">{items.length} item{items.length === 1 ? "" : "s"} • Saved in this browser</p>
        </div>
      </div>
    </div>
  );
}
