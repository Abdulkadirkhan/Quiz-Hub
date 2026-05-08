import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";

// ---------- Face Merge sets ----------

interface FaceMergeSet {
  id: string;
  merged?: string | null;
  image1?: string | null;
  image2?: string | null;
}

const FACE_MERGE_SETS_KEY = "quiz_minigames_face_merge_sets";
const OLD_FACE_MERGE_KEY = "quiz_minigames_face_merge"; // legacy single-set key

function newId() { return Math.random().toString(36).slice(2, 9); }

function loadFaceMergeSets(): FaceMergeSet[] {
  try {
    const raw = localStorage.getItem(FACE_MERGE_SETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  // Migrate from legacy single-set storage
  try {
    const oldRaw = localStorage.getItem(OLD_FACE_MERGE_KEY);
    if (oldRaw) {
      const old = JSON.parse(oldRaw);
      if (old && (old.image1 || old.image2 || old.merged)) {
        const migrated: FaceMergeSet[] = [{ id: newId(), merged: old.merged ?? null, image1: old.image1 ?? null, image2: old.image2 ?? null }];
        localStorage.setItem(FACE_MERGE_SETS_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch {}
  return [];
}

// ---------- Mystery Puzzle ----------

interface MysteryClueDraft { question: string; digit: string; }
interface MysteryConfig { story: string; clues: MysteryClueDraft[]; }
const MYSTERY_KEY = "quiz_minigames_mystery_puzzle";

function emptyMystery(): MysteryConfig {
  return {
    story: "The vault is locked! Solve the 4 clues to crack the 4-digit code.",
    clues: [
      { question: "", digit: "" },
      { question: "", digit: "" },
      { question: "", digit: "" },
      { question: "", digit: "" },
    ],
  };
}

function loadMystery(): MysteryConfig {
  try {
    const raw = localStorage.getItem(MYSTERY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MysteryConfig;
      if (parsed && Array.isArray(parsed.clues)) {
        // Pad/trim to exactly 4
        const clues = [...parsed.clues];
        while (clues.length < 4) clues.push({ question: "", digit: "" });
        return { story: parsed.story || "", clues: clues.slice(0, 4) };
      }
    }
  } catch {}
  return emptyMystery();
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================

export default function MiniGameManager() {
  const [, navigate] = useLocation();

  // Face Merge state
  const [sets, setSets] = useState<FaceMergeSet[]>(loadFaceMergeSets);
  const [fmSavedNotice, setFmSavedNotice] = useState(false);
  const [fmError, setFmError] = useState("");

  // Mystery Puzzle state
  const initialMystery = loadMystery();
  const [story, setStory] = useState(initialMystery.story);
  const [clues, setClues] = useState<MysteryClueDraft[]>(initialMystery.clues);
  const [mpSavedNotice, setMpSavedNotice] = useState(false);
  const [mpError, setMpError] = useState("");

  useEffect(() => {
    if (!fmSavedNotice) return;
    const t = setTimeout(() => setFmSavedNotice(false), 2000);
    return () => clearTimeout(t);
  }, [fmSavedNotice]);
  useEffect(() => {
    if (!mpSavedNotice) return;
    const t = setTimeout(() => setMpSavedNotice(false), 2000);
    return () => clearTimeout(t);
  }, [mpSavedNotice]);

  // ---------- Face Merge handlers ----------

  const updateSetImage = async (setId: string, field: "merged" | "image1" | "image2", file: File | null) => {
    setFmError("");
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setFmError("Image is larger than 2 MB. Please use a smaller file.");
      return;
    }
    try {
      const data = await readFile(file);
      setSets((prev) => prev.map((s) => s.id === setId ? { ...s, [field]: data } : s));
    } catch {
      setFmError("Could not read that file. Try another image.");
    }
  };

  const removeSetImage = (setId: string, field: "merged" | "image1" | "image2") => {
    setSets((prev) => prev.map((s) => s.id === setId ? { ...s, [field]: null } : s));
  };

  const addSet = () => {
    setSets((prev) => [...prev, { id: newId(), merged: null, image1: null, image2: null }]);
  };

  const removeSet = (setId: string) => {
    if (!confirm("Delete this image set?")) return;
    setSets((prev) => prev.filter((s) => s.id !== setId));
  };

  const moveSet = (idx: number, dir: -1 | 1) => {
    setSets((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const saveFaceMerge = () => {
    setFmError("");
    try {
      localStorage.setItem(FACE_MERGE_SETS_KEY, JSON.stringify(sets));
      // Also clean up the legacy single-set key now that we've saved to the new one
      localStorage.removeItem(OLD_FACE_MERGE_KEY);
      setFmSavedNotice(true);
    } catch {
      setFmError("Couldn't save — total image size may be too large. Reduce file sizes or remove sets.");
    }
  };

  const clearFaceMerge = () => {
    if (!confirm("Clear all Face Merge sets?")) return;
    localStorage.removeItem(FACE_MERGE_SETS_KEY);
    localStorage.removeItem(OLD_FACE_MERGE_KEY);
    setSets([]);
  };

  // ---------- Mystery Puzzle handlers ----------

  const updateClue = (i: number, field: keyof MysteryClueDraft, value: string) => {
    let v = value;
    if (field === "digit") {
      // Allow only one digit 0-9
      v = value.replace(/\D/g, "").slice(0, 1);
    }
    setClues((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: v } : c));
  };

  const saveMystery = () => {
    setMpError("");
    const allHaveDigits = clues.every((c) => /^[0-9]$/.test(c.digit));
    if (!allHaveDigits) {
      setMpError("Each of the 4 clues must have a single digit (0-9) for the vault code.");
      return;
    }
    try {
      const payload: MysteryConfig = { story: story.trim(), clues };
      localStorage.setItem(MYSTERY_KEY, JSON.stringify(payload));
      setMpSavedNotice(true);
    } catch {
      setMpError("Couldn't save the puzzle.");
    }
  };

  const clearMystery = () => {
    if (!confirm("Clear the saved Mystery Puzzle?")) return;
    localStorage.removeItem(MYSTERY_KEY);
    const empty = emptyMystery();
    setStory(empty.story);
    setClues(empty.clues);
  };

  const vaultPreview = clues.map((c) => /^[0-9]$/.test(c.digit) ? c.digit : "·").join("");

  // ---------- helpers ----------

  const ImageSlot = ({ src, label, accent, onPick, onRemove }: {
    src: string | null | undefined;
    label: string;
    accent: string;
    onPick: () => void;
    onRemove: () => void;
  }) => (
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{label}</p>
      {src ? (
        <img src={src} alt={label} className={`w-24 h-24 object-cover rounded-lg border-2 ${accent}`} />
      ) : (
        <div onClick={onPick} className="w-24 h-24 bg-gray-800 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 text-2xl cursor-pointer hover:border-pink-500 transition">
          📷
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onPick} className="text-[10px] text-pink-400 hover:text-pink-300 underline">
          {src ? "Change" : "Select"}
        </button>
        {src && (
          <button onClick={onRemove} className="text-[10px] text-gray-500 hover:text-gray-400 underline">Remove</button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-black text-yellow-400">Manage Mini-Games</h1>
            <p className="text-gray-500 text-sm">Pre-load assets so they're ready when you start a mini-game</p>
          </div>
          <button onClick={() => navigate("/")} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">
            ← Back to Lobby
          </button>
        </div>

        {/* ============== FACE MERGE ============== */}
        <div className="bg-gray-900 rounded-2xl p-6 border-2 border-pink-700 mb-6">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-black text-pink-400">🖼️ Face Merge</h2>
              <p className="text-xs text-gray-400 mt-1">Add multiple image sets — each set is one round. During play, you'll go through them in order.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={saveFaceMerge} className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg font-black text-sm transition">Save</button>
              <button onClick={clearFaceMerge} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">Clear All</button>
            </div>
          </div>

          {fmSavedNotice && (
            <div className="bg-green-950/40 border border-green-700 rounded-lg p-2 text-center text-sm text-green-300 mb-4">
              ✓ Saved — these will load automatically when you start the Face Merge mini-game.
            </div>
          )}
          {fmError && (
            <div className="bg-red-950/40 border border-red-700 rounded-lg p-2 text-center text-sm text-red-300 mb-4">{fmError}</div>
          )}

          <div className="space-y-4">
            {sets.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">No image sets yet — click "Add Image Set" below.</div>
            )}

            {sets.map((set, idx) => {
              const refMerged = { current: null as HTMLInputElement | null };
              const ref1 = { current: null as HTMLInputElement | null };
              const ref2 = { current: null as HTMLInputElement | null };
              return (
                <div key={set.id} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-pink-300 font-bold text-sm">Set {idx + 1}</p>
                    <div className="flex gap-1">
                      <button onClick={() => moveSet(idx, -1)} disabled={idx === 0} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-xs w-7 h-7 rounded transition">↑</button>
                      <button onClick={() => moveSet(idx, 1)} disabled={idx === sets.length - 1} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-xs w-7 h-7 rounded transition">↓</button>
                      <button onClick={() => removeSet(set.id)} className="bg-red-900 hover:bg-red-800 text-white text-xs px-2 h-7 rounded transition">Delete</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <ImageSlot src={set.merged ?? null} label="Merged" accent="border-pink-500" onPick={() => refMerged.current?.click()} onRemove={() => removeSetImage(set.id, "merged")} />
                    <input ref={(el) => { refMerged.current = el; }} type="file" accept="image/*" className="hidden" onChange={(e) => updateSetImage(set.id, "merged", e.target.files?.[0] ?? null)} />
                    <ImageSlot src={set.image1 ?? null} label="Person 1" accent="border-pink-400" onPick={() => ref1.current?.click()} onRemove={() => removeSetImage(set.id, "image1")} />
                    <input ref={(el) => { ref1.current = el; }} type="file" accept="image/*" className="hidden" onChange={(e) => updateSetImage(set.id, "image1", e.target.files?.[0] ?? null)} />
                    <ImageSlot src={set.image2 ?? null} label="Person 2" accent="border-pink-400" onPick={() => ref2.current?.click()} onRemove={() => removeSetImage(set.id, "image2")} />
                    <input ref={(el) => { ref2.current = el; }} type="file" accept="image/*" className="hidden" onChange={(e) => updateSetImage(set.id, "image2", e.target.files?.[0] ?? null)} />
                  </div>
                </div>
              );
            })}

            <button onClick={addSet} className="w-full py-3 rounded-xl border-2 border-dashed border-pink-700 text-pink-400 hover:bg-pink-950/30 hover:border-pink-500 font-bold text-sm transition">
              + Add Image Set
            </button>
          </div>

          <p className="text-xs text-gray-600 text-center mt-4">{sets.length} {sets.length === 1 ? "set" : "sets"} • Saved in this browser • Keep each image under 2 MB</p>
        </div>

        {/* ============== MYSTERY PUZZLE ============== */}
        <div className="bg-gray-900 rounded-2xl p-6 border-2 border-amber-700 mb-6">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-black text-amber-400">🔐 Mystery Puzzle</h2>
              <p className="text-xs text-gray-400 mt-1">4 clues — each gives one digit. Players race to enter the 4-digit vault code on their phone keypad.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={saveMystery} className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg font-black text-sm transition">Save</button>
              <button onClick={clearMystery} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">Clear</button>
            </div>
          </div>

          {mpSavedNotice && (
            <div className="bg-green-950/40 border border-green-700 rounded-lg p-2 text-center text-sm text-green-300 mb-4">
              ✓ Puzzle saved — will load automatically when you start the Mystery Puzzle mini-game.
            </div>
          )}
          {mpError && (
            <div className="bg-red-950/40 border border-red-700 rounded-lg p-2 text-center text-sm text-red-300 mb-4">{mpError}</div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Story / Intro (read by the host)</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400 h-20 resize-none"
                placeholder="The vault is locked! Solve 4 clues to crack the 4-digit code..."
                value={story}
                onChange={(e) => setStory(e.target.value)}
              />
            </div>

            <div className="bg-amber-950/30 border border-amber-700 rounded-lg p-3 text-center">
              <p className="text-xs text-amber-400 font-bold uppercase mb-1">Vault Code Preview</p>
              <p className="font-mono text-3xl font-black text-amber-300 tracking-widest">{vaultPreview}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {clues.map((clue, i) => (
                <div key={i} className="bg-gray-800/60 rounded-xl p-3 border border-gray-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-amber-300 font-bold text-sm">Clue {i + 1}</p>
                    <span className="text-xs text-gray-500">→ digit position {i + 1}</span>
                  </div>
                  <textarea
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-400 h-16 resize-none"
                    placeholder="Riddle / question / hint that the host reads aloud"
                    value={clue.question}
                    onChange={(e) => updateClue(i, "question", e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-semibold">Digit (0-9):</span>
                    <input
                      className="bg-gray-900 border border-amber-600 rounded-lg w-14 px-2 py-1 text-center text-white font-mono font-black text-lg focus:outline-none focus:border-amber-400"
                      placeholder="?"
                      value={clue.digit}
                      onChange={(e) => updateClue(i, "digit", e.target.value)}
                      maxLength={1}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 opacity-60">
          <h2 className="text-xl font-black text-gray-500">🔢 Number Survival / 👾 Pac-Man</h2>
          <p className="text-xs text-gray-500 mt-1">No pre-game setup needed.</p>
        </div>
      </div>
    </div>
  );
}
