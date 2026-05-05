import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Question } from "@/lib/types";

const DEFAULT_QUESTIONS: Question[] = [
  { id: "q1", text: "What is the capital of France?", choices: [{ label: "A", text: "Berlin" }, { label: "B", text: "Madrid" }, { label: "C", text: "Paris" }, { label: "D", text: "Rome" }], timeLimit: 30 },
  { id: "q2", text: "What is 7 × 8?", choices: [{ label: "A", text: "54" }, { label: "B", text: "56" }, { label: "C", text: "58" }, { label: "D", text: "64" }], timeLimit: 30 },
  { id: "q3", text: "Which planet is closest to the Sun?", choices: [{ label: "A", text: "Venus" }, { label: "B", text: "Earth" }, { label: "C", text: "Mercury" }, { label: "D", text: "Mars" }], timeLimit: 30 },
  { id: "q4", text: "Who painted the Mona Lisa?", choices: [{ label: "A", text: "Michelangelo" }, { label: "B", text: "Raphael" }, { label: "C", text: "Leonardo da Vinci" }, { label: "D", text: "Donatello" }], timeLimit: 30 },
  { id: "q5", text: "What is the chemical symbol for water?", choices: [{ label: "A", text: "H2O" }, { label: "B", text: "CO2" }, { label: "C", text: "NaCl" }, { label: "D", text: "O2" }], timeLimit: 30 },
];

const LABEL_OPTIONS = ["A", "B", "C", "D"];

function loadQuestions(): Question[] {
  try {
    const raw = localStorage.getItem("quiz_questions");
    if (raw) return JSON.parse(raw) as Question[];
  } catch {}
  return DEFAULT_QUESTIONS;
}

function saveQuestions(questions: Question[]) {
  localStorage.setItem("quiz_questions", JSON.stringify(questions));
}

function makeBlankQuestion(): Question {
  return {
    id: `q${Date.now()}`,
    text: "",
    choices: [{ label: "A", text: "" }, { label: "B", text: "" }, { label: "C", text: "" }, { label: "D", text: "" }],
    timeLimit: 30,
  };
}

export default function QuestionsPage() {
  const [, navigate] = useLocation();
  const [questions, setQuestions] = useState<Question[]>(loadQuestions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState<Question | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [saved, setSaved] = useState(false);

  const persist = (qs: Question[]) => {
    setQuestions(qs);
    saveQuestions(qs);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setEditBuf(JSON.parse(JSON.stringify(q)));
  };

  const cancelEdit = () => { setEditingId(null); setEditBuf(null); };

  const commitEdit = () => {
    if (!editBuf) return;
    const updated = questions.map((q) => q.id === editBuf.id ? editBuf : q);
    persist(updated);
    setEditingId(null); setEditBuf(null);
  };

  const addQuestion = () => {
    const blank = makeBlankQuestion();
    const updated = [...questions, blank];
    setQuestions(updated);
    startEdit(blank);
  };

  const deleteQuestion = (id: string) => {
    if (!window.confirm("Delete this question?")) return;
    persist(questions.filter((q) => q.id !== id));
  };

  const moveQuestion = (id: string, dir: -1 | 1) => {
    const idx = questions.findIndex((q) => q.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= questions.length) return;
    const updated = [...questions];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    persist(updated);
  };

  const handleJsonImport = () => {
    try {
      const parsed = JSON.parse(jsonText) as Question[];
      if (!Array.isArray(parsed)) throw new Error("Must be an array");
      parsed.forEach((q, i) => { if (!q.text) throw new Error(`Question ${i + 1} missing text`); });
      persist(parsed.map((q, i) => ({ ...q, id: q.id || `q${i + 1}` })));
      setShowJson(false); setJsonText(""); setJsonError("");
    } catch (e) {
      setJsonError((e as Error).message);
    }
  };

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(questions, null, 2));
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/")} className="text-gray-400 hover:text-white text-sm transition">← Back</button>
          <div className="flex-1">
            <h1 className="text-3xl font-black text-yellow-400">Question Manager</h1>
            <p className="text-gray-500 text-sm">{questions.length} questions loaded · saved to this browser</p>
          </div>
          {saved && <span className="text-green-400 text-sm font-bold">✓ Saved</span>}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={addQuestion} className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg font-black text-sm transition">
            + Add Question
          </button>
          <button onClick={() => setShowJson(!showJson)} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">
            {showJson ? "Hide JSON" : "Import JSON"}
          </button>
          <button onClick={copyJson} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">
            Copy JSON
          </button>
          <button
            onClick={() => { if (window.confirm("Reset to default questions?")) persist(DEFAULT_QUESTIONS); }}
            className="bg-gray-800 hover:bg-red-900 text-gray-400 hover:text-red-300 px-4 py-2 rounded-lg font-bold text-sm transition"
          >
            Reset Defaults
          </button>
        </div>

        {showJson && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 mb-6 space-y-3">
            <p className="text-sm text-gray-400 font-semibold">Paste JSON array of questions</p>
            <textarea
              className="w-full h-40 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-yellow-400 resize-none"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder={`[{"id":"q1","text":"Question?","choices":[{"label":"A","text":"Option"}...],"timeLimit":30}]`}
            />
            {jsonError && <p className="text-red-400 text-xs">{jsonError}</p>}
            <button onClick={handleJsonImport} className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-black text-sm hover:bg-yellow-300 transition">
              Import & Replace All
            </button>
          </div>
        )}

        <div className="space-y-3">
          {questions.map((q, idx) => {
            const isEditing = editingId === q.id && editBuf;
            return (
              <div key={q.id} className={`bg-gray-900 rounded-xl border ${isEditing ? "border-yellow-400" : "border-gray-800"} overflow-hidden`}>
                {isEditing && editBuf ? (
                  <div className="p-4 space-y-3">
                    <input
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-bold focus:outline-none focus:border-yellow-400"
                      value={editBuf.text}
                      onChange={(e) => setEditBuf({ ...editBuf, text: e.target.value })}
                      placeholder="Question text"
                      autoFocus
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {LABEL_OPTIONS.map((label, i) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="text-yellow-400 font-black text-sm w-4">{label}</span>
                          <input
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-400"
                            value={(editBuf.choices || [])[i]?.text || ""}
                            onChange={(e) => {
                              const choices = [...(editBuf.choices || [])];
                              while (choices.length <= i) choices.push({ label: LABEL_OPTIONS[choices.length], text: "" });
                              choices[i] = { label, text: e.target.value };
                              setEditBuf({ ...editBuf, choices });
                            }}
                            placeholder={`Option ${label}`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-gray-400 font-semibold">Time Limit</label>
                      <select
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none"
                        value={editBuf.timeLimit || 30}
                        onChange={(e) => setEditBuf({ ...editBuf, timeLimit: parseInt(e.target.value) })}
                      >
                        {[10, 15, 20, 30, 45, 60].map((t) => <option key={t} value={t}>{t}s</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={commitEdit} disabled={!editBuf.text.trim()} className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-black text-sm hover:bg-yellow-300 transition disabled:opacity-40">Save</button>
                      <button onClick={cancelEdit} className="bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-600 transition">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 flex items-start gap-3">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => moveQuestion(q.id, -1)} disabled={idx === 0} className="text-gray-600 hover:text-gray-300 disabled:opacity-20 text-xs">▲</button>
                      <span className="text-gray-600 font-mono text-xs text-center">{idx + 1}</span>
                      <button onClick={() => moveQuestion(q.id, 1)} disabled={idx === questions.length - 1} className="text-gray-600 hover:text-gray-300 disabled:opacity-20 text-xs">▼</button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm leading-snug">{q.text || <span className="text-gray-600 italic">No question text</span>}</p>
                      {q.choices && (
                        <div className="grid grid-cols-2 gap-1 mt-2">
                          {q.choices.map((c) => (
                            <span key={c.label} className="text-xs text-gray-500">{c.label}: {c.text}</span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-600 mt-1">⏱ {q.timeLimit || 30}s</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => startEdit(q)} className="bg-gray-800 hover:bg-gray-700 text-white px-2 py-1.5 rounded-lg text-xs font-bold transition">Edit</button>
                      <button onClick={() => deleteQuestion(q.id)} className="bg-gray-800 hover:bg-red-900 text-gray-400 hover:text-red-300 px-2 py-1.5 rounded-lg text-xs font-bold transition">✕</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {questions.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <p className="text-5xl mb-4">❓</p>
            <p className="text-xl font-bold">No questions yet</p>
            <button onClick={addQuestion} className="mt-4 bg-yellow-400 text-black px-6 py-2 rounded-lg font-black hover:bg-yellow-300 transition">Add First Question</button>
          </div>
        )}
      </div>
    </div>
  );
}
