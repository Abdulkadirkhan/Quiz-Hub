import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { resizeImageFile } from "@/lib/imageUtils";

// ====================== SPOT THE DIFFERENCE ======================

interface SpotDiffImage { id: string; image: string | null; }

const SPOT_DIFF_KEY = "quiz_minigames_spot_difference";

function loadSpotDiffImages(): SpotDiffImage[] {
  try {
    const raw = localStorage.getItem(SPOT_DIFF_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

// ====================== FACE MERGE ======================

interface FaceMergeSet {
  id: string;
  merged?: string | null;
  image1?: string | null;
  image2?: string | null;
}

const FACE_MERGE_SETS_KEY = "quiz_minigames_face_merge_sets";
const OLD_FACE_MERGE_KEY = "quiz_minigames_face_merge";

function newId() { return Math.random().toString(36).slice(2, 9); }

function loadFaceMergeSets(): FaceMergeSet[] {
  try {
    const raw = localStorage.getItem(FACE_MERGE_SETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
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

// ====================== MYSTERY PUZZLE (v2 split-team) ======================

interface MysteryClueDraft { question: string; digit: string; }
interface MysteryTeamDraft {
  story: string;
  clues: MysteryClueDraft[]; // exactly 4
}
interface MysteryConfigV2 {
  teamA: MysteryTeamDraft;
  teamB: MysteryTeamDraft;
}

const MYSTERY_KEY_V2 = "quiz_minigames_mystery_puzzle_v2";
const MYSTERY_KEY_V1 = "quiz_minigames_mystery_puzzle"; // legacy

function emptyTeamDraft(name: string): MysteryTeamDraft {
  return {
    story: `${name}'s vault is locked. Solve 4 clues to collect 4 digits — then figure out the correct order to unlock!`,
    clues: [
      { question: "", digit: "" },
      { question: "", digit: "" },
      { question: "", digit: "" },
      { question: "", digit: "" },
    ],
  };
}

function emptyMysteryV2(): MysteryConfigV2 {
  return { teamA: emptyTeamDraft("Team A"), teamB: emptyTeamDraft("Team B") };
}

function loadMysteryV2(): MysteryConfigV2 {
  try {
    const raw = localStorage.getItem(MYSTERY_KEY_V2);
    if (raw) {
      const parsed = JSON.parse(raw) as MysteryConfigV2;
      if (parsed?.teamA && parsed?.teamB) {
        // Pad/trim clues to 4
        for (const team of [parsed.teamA, parsed.teamB]) {
          while (team.clues.length < 4) team.clues.push({ question: "", digit: "" });
          team.clues = team.clues.slice(0, 4);
        }
        return parsed;
      }
    }
  } catch {}
  return emptyMysteryV2();
}

// ============================================================

export default function MiniGameManager() {
  const [, navigate] = useLocation();

  // Face Merge state
  const [sets, setSets] = useState<FaceMergeSet[]>(loadFaceMergeSets);
  const [fmSavedNotice, setFmSavedNotice] = useState(false);
  const [fmError, setFmError] = useState("");
  const [persistedSetCount, setPersistedSetCount] = useState<number>(() => loadFaceMergeSets().length);

  // Mystery Puzzle state (split team)
  const [mystery, setMystery] = useState<MysteryConfigV2>(loadMysteryV2);
  const [mpSavedNotice, setMpSavedNotice] = useState(false);
  const [mpError, setMpError] = useState("");

  // Spot the Difference state
  const [spotImages, setSpotImages] = useState<SpotDiffImage[]>(loadSpotDiffImages);
  const [sdSavedNotice, setSdSavedNotice] = useState(false);
  const [sdError, setSdError] = useState("");
  const [sdPersistedCount, setSdPersistedCount] = useState<number>(() => loadSpotDiffImages().length);

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
  useEffect(() => {
    if (!sdSavedNotice) return;
    const t = setTimeout(() => setSdSavedNotice(false), 2000);
    return () => clearTimeout(t);
  }, [sdSavedNotice]);

  // ---------- Face Merge handlers ----------

  const updateSetImage = async (setId: string, field: "merged" | "image1" | "image2", file: File | null) => {
    setFmError("");
    if (!file) return;
    // Allow large source files (phone photos can be 10+ MB) — we downscale to ~1024px before storing.
    if (file.size > 20 * 1024 * 1024) { setFmError("Source image is larger than 20 MB. Please use a smaller photo."); return; }
    try {
      const data = await resizeImageFile(file, { maxDim: 1024, quality: 0.85 });
      setSets((prev) => prev.map((s) => s.id === setId ? { ...s, [field]: data } : s));
    } catch { setFmError("Could not read that file."); }
  };
  const removeSetImage = (setId: string, field: "merged" | "image1" | "image2") => {
    setSets((prev) => prev.map((s) => s.id === setId ? { ...s, [field]: null } : s));
  };
  const addSet = () => setSets((prev) => [...prev, { id: newId(), merged: null, image1: null, image2: null }]);
  const removeSet = (setId: string) => { if (confirm("Delete this image set?")) setSets((prev) => prev.filter((s) => s.id !== setId)); };
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
    const payload = JSON.stringify(sets);
    const sizeMB = payload.length / (1024 * 1024);
    // Browser localStorage caps vary 5–10 MB per origin. Warn over 4 MB.
    if (sizeMB > 4) {
      setFmError(`Total size is ${sizeMB.toFixed(1)} MB — browsers cap localStorage at ~5 MB. Remove some sets or use smaller images, otherwise the save may fail silently.`);
      return;
    }
    try {
      localStorage.setItem(FACE_MERGE_SETS_KEY, payload);
      localStorage.removeItem(OLD_FACE_MERGE_KEY);
      setFmSavedNotice(true);
      setPersistedSetCount(sets.length);
    } catch { setFmError(`Couldn't save — browser storage full (~${sizeMB.toFixed(1)} MB attempted). Remove some sets or use smaller images.`); }
  };
  const clearFaceMerge = () => {
    if (!confirm("Clear all Face Merge sets?")) return;
    localStorage.removeItem(FACE_MERGE_SETS_KEY);
    localStorage.removeItem(OLD_FACE_MERGE_KEY);
    setSets([]);
    setPersistedSetCount(0);
  };

  // ---------- Spot the Difference handlers ----------
  const addSpotImage = () => setSpotImages((prev) => [...prev, { id: newId(), image: null }]);
  const removeSpotImage = (id: string) => setSpotImages((prev) => prev.filter((s) => s.id !== id));
  const updateSpotImage = async (id: string, file: File | null) => {
    setSdError("");
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setSdError("Source image > 20 MB — too big even before resize."); return; }
    try {
      const data = await resizeImageFile(file, { maxDim: 1280, quality: 0.85 });
      setSpotImages((prev) => prev.map((s) => s.id === id ? { ...s, image: data } : s));
    } catch { setSdError("Could not read that file."); }
  };
  const moveSpotImage = (idx: number, dir: -1 | 1) => {
    setSpotImages((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };
  const saveSpotDifference = () => {
    setSdError("");
    const valid = spotImages.filter((s) => s.image);
    const payload = JSON.stringify(valid);
    const sizeMB = payload.length / (1024 * 1024);
    if (sizeMB > 4) {
      setSdError(`Total size is ${sizeMB.toFixed(1)} MB — browsers cap localStorage at ~5 MB. Remove some images.`);
      return;
    }
    try {
      localStorage.setItem(SPOT_DIFF_KEY, payload);
      setSdSavedNotice(true);
      setSdPersistedCount(valid.length);
    } catch { setSdError(`Couldn't save — browser storage full (~${sizeMB.toFixed(1)} MB).`); }
  };
  const clearSpotDifference = () => {
    if (!confirm("Clear all Spot the Difference images?")) return;
    localStorage.removeItem(SPOT_DIFF_KEY);
    setSpotImages([]);
    setSdPersistedCount(0);
  };

  // ---------- Mystery Puzzle handlers ----------

  const updateMysteryStory = (which: "teamA" | "teamB", value: string) => {
    setMystery((prev) => ({ ...prev, [which]: { ...prev[which], story: value } }));
  };
  const updateMysteryClue = (which: "teamA" | "teamB", clueIdx: number, field: keyof MysteryClueDraft, value: string) => {
    let v = value;
    if (field === "digit") v = value.replace(/\D/g, "").slice(0, 1);
    setMystery((prev) => ({
      ...prev,
      [which]: {
        ...prev[which],
        clues: prev[which].clues.map((c, i) => i === clueIdx ? { ...c, [field]: v } : c),
      },
    }));
  };
  const saveMystery = () => {
    setMpError("");
    const allValidA = mystery.teamA.clues.every((c) => /^[0-9]$/.test(c.digit));
    const allValidB = mystery.teamB.clues.every((c) => /^[0-9]$/.test(c.digit));
    if (!allValidA || !allValidB) {
      setMpError("Each team's 4 clues must each have a single digit (0-9).");
      return;
    }
    try {
      localStorage.setItem(MYSTERY_KEY_V2, JSON.stringify(mystery));
      localStorage.removeItem(MYSTERY_KEY_V1);
      setMpSavedNotice(true);
    } catch { setMpError("Couldn't save the puzzle."); }
  };
  const clearMystery = () => {
    if (!confirm("Clear the saved Mystery Puzzle (both teams)?")) return;
    localStorage.removeItem(MYSTERY_KEY_V2);
    setMystery(emptyMysteryV2());
  };

  const digitsPreview = (team: MysteryTeamDraft) =>
    team.clues.map((c) => /^[0-9]$/.test(c.digit) ? c.digit : "·").join(" ");

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
        <button onClick={onPick} className="text-[10px] text-pink-400 hover:text-pink-300 underline">{src ? "Change" : "Select"}</button>
        {src && <button onClick={onRemove} className="text-[10px] text-gray-500 hover:text-gray-400 underline">Remove</button>}
      </div>
    </div>
  );

  // ---------- MysteryTeam column component ----------

  const MysteryTeamColumn = ({ which, label, accent }: { which: "teamA" | "teamB"; label: string; accent: string }) => {
    const team = mystery[which];
    return (
      <div className={`rounded-2xl p-4 border-2 ${accent} space-y-3`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white">{label}</h3>
          <div className="text-xs text-amber-300 font-mono">digits: <span className="font-black tracking-widest">{digitsPreview(team)}</span></div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Story</label>
          <textarea
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400 h-16 resize-none"
            placeholder="Story shown only to this team..."
            value={team.story}
            onChange={(e) => updateMysteryStory(which, e.target.value)}
          />
        </div>
        <div className="space-y-2">
          {team.clues.map((clue, i) => (
            <div key={i} className="bg-gray-900/60 rounded-lg p-2 border border-gray-700 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-amber-300 font-bold text-xs">Clue {i + 1}</p>
                <input
                  className="bg-gray-900 border border-amber-600 rounded w-10 px-1 py-0.5 text-center text-white font-mono font-black text-base focus:outline-none focus:border-amber-400"
                  placeholder="?"
                  value={clue.digit}
                  onChange={(e) => updateMysteryClue(which, i, "digit", e.target.value)}
                  maxLength={1}
                />
              </div>
              <textarea
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-400 h-12 resize-none"
                placeholder={`Riddle for this team (the answer reveals digit ${i + 1})`}
                value={clue.question}
                onChange={(e) => updateMysteryClue(which, i, "question", e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-black text-yellow-400">Manage Mini-Games</h1>
            <p className="text-gray-500 text-sm">Pre-load assets so they're ready when you start a mini-game</p>
          </div>
          <button onClick={() => navigate("/")} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">
            ← Back to Lobby
          </button>
        </div>

        {/* FACE MERGE */}
        <div className="bg-gray-900 rounded-2xl p-6 border-2 border-pink-700 mb-6">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-black text-pink-400">🖼️ Face Merge</h2>
              <p className="text-xs text-gray-400 mt-1">Multiple image sets — played in order.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={saveFaceMerge} className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg font-black text-sm transition">Save</button>
              <button onClick={clearFaceMerge} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">Clear All</button>
            </div>
          </div>
          {fmSavedNotice && <div className="bg-green-950/40 border border-green-700 rounded-lg p-2 text-center text-sm text-green-300 mb-4">✓ Saved.</div>}
          {fmError && <div className="bg-red-950/40 border border-red-700 rounded-lg p-2 text-center text-sm text-red-300 mb-4">{fmError}</div>}
          <div className={`rounded-lg p-2 text-center text-xs mb-4 ${persistedSetCount > 0 ? "bg-gray-800 text-gray-300" : "bg-yellow-950/30 text-yellow-300 border border-yellow-800"}`}>
            {persistedSetCount > 0 ? (
              <>💾 Currently saved in this browser: <span className="font-bold text-white">{persistedSetCount}</span> set{persistedSetCount === 1 ? "" : "s"}{sets.length !== persistedSetCount && <span className="text-yellow-400"> · {sets.length} unsaved edit{sets.length === 1 ? "" : "s"} above — click Save</span>}</>
            ) : (
              <>⚠️ Nothing saved yet. Add sets above and click <span className="font-bold">Save</span>.</>
            )}
          </div>
          <div className="space-y-4">
            {sets.length === 0 && <div className="text-center py-8 text-gray-500 text-sm">No image sets yet.</div>}
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
            <button onClick={addSet} className="w-full py-3 rounded-xl border-2 border-dashed border-pink-700 text-pink-400 hover:bg-pink-950/30 hover:border-pink-500 font-bold text-sm transition">+ Add Image Set</button>
          </div>
          <p className="text-xs text-gray-600 text-center mt-4">{sets.length} {sets.length === 1 ? "set" : "sets"} • Images are auto-resized to 1024px to fit in browser storage</p>
        </div>

        {/* MYSTERY PUZZLE */}
        <div className="bg-gray-900 rounded-2xl p-6 border-2 border-amber-700 mb-6">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-black text-amber-400">🔐 Mystery Puzzle</h2>
              <p className="text-xs text-gray-400 mt-1">Each team gets their <span className="font-bold">own</span> 4 clues + digits. Server randomly shuffles each team's digits into a hidden unlock order — teams have to permute and try.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={saveMystery} className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg font-black text-sm transition">Save</button>
              <button onClick={clearMystery} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">Clear</button>
            </div>
          </div>
          {mpSavedNotice && <div className="bg-green-950/40 border border-green-700 rounded-lg p-2 text-center text-sm text-green-300 mb-4">✓ Puzzle saved.</div>}
          {mpError && <div className="bg-red-950/40 border border-red-700 rounded-lg p-2 text-center text-sm text-red-300 mb-4">{mpError}</div>}
          <div className="grid md:grid-cols-2 gap-4">
            <MysteryTeamColumn which="teamA" label="Team A puzzle" accent="border-blue-700" />
            <MysteryTeamColumn which="teamB" label="Team B puzzle" accent="border-red-700" />
          </div>
        </div>

        {/* SPOT THE DIFFERENCE */}
        <div className="bg-gray-900 rounded-2xl p-6 border-2 border-teal-700 mb-6">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-black text-teal-400">🔍 Spot the Difference</h2>
              <p className="text-xs text-gray-400 mt-1">Upload one combined image per question (both sides already shown side-by-side). During the game, host shows each image, audience yells the difference, host awards.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={saveSpotDifference} className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg font-black text-sm transition">Save</button>
              <button onClick={clearSpotDifference} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">Clear All</button>
            </div>
          </div>
          {sdSavedNotice && <div className="bg-green-950/40 border border-green-700 rounded-lg p-2 text-center text-sm text-green-300 mb-4">✓ Saved.</div>}
          {sdError && <div className="bg-red-950/40 border border-red-700 rounded-lg p-2 text-center text-sm text-red-300 mb-4">{sdError}</div>}
          <div className={`rounded-lg p-2 text-center text-xs mb-4 ${sdPersistedCount > 0 ? "bg-gray-800 text-gray-300" : "bg-yellow-950/30 text-yellow-300 border border-yellow-800"}`}>
            {sdPersistedCount > 0 ? (
              <>💾 Currently saved: <span className="font-bold text-white">{sdPersistedCount}</span> image{sdPersistedCount === 1 ? "" : "s"}{spotImages.filter((s) => s.image).length !== sdPersistedCount && <span className="text-yellow-400"> · unsaved edits above — click Save</span>}</>
            ) : (
              <>⚠️ Nothing saved yet. Add images and click <span className="font-bold">Save</span>.</>
            )}
          </div>

          <div className="space-y-3">
            {spotImages.length === 0 && <div className="text-center py-8 text-gray-500 text-sm">No images yet. Click "Add image" below.</div>}
            {spotImages.map((s, idx) => (
              <div key={s.id} className="bg-gray-800/60 rounded-xl p-3 border border-gray-700">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 flex flex-col items-center gap-1">
                    <span className="text-teal-300 font-bold text-sm">#{idx + 1}</span>
                    <button onClick={() => moveSpotImage(idx, -1)} disabled={idx === 0} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-xs w-7 h-7 rounded">↑</button>
                    <button onClick={() => moveSpotImage(idx, 1)} disabled={idx === spotImages.length - 1} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-xs w-7 h-7 rounded">↓</button>
                  </div>
                  <label className="cursor-pointer shrink-0">
                    {s.image ? (
                      <img src={s.image} alt={`Spot ${idx + 1}`} className="w-32 h-20 object-cover rounded-lg border-2 border-teal-500" />
                    ) : (
                      <div className="w-32 h-20 bg-gray-700 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 text-2xl hover:border-teal-500 transition">📷</div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => updateSpotImage(s.id, e.target.files?.[0] ?? null)} />
                  </label>
                  <div className="flex-1 flex items-center justify-end gap-2">
                    <span className="text-[10px] text-teal-400 underline cursor-pointer" onClick={() => {
                      const el = document.querySelector(`#sd-input-${s.id}`) as HTMLInputElement | null;
                      el?.click();
                    }}>
                      <input id={`sd-input-${s.id}`} type="file" accept="image/*" className="hidden" onChange={(e) => updateSpotImage(s.id, e.target.files?.[0] ?? null)} />
                      {s.image ? "Change" : "Select"}
                    </span>
                    <button onClick={() => removeSpotImage(s.id)} className="text-xs bg-red-900 hover:bg-red-800 text-white px-2 py-1 rounded">Delete</button>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addSpotImage} className="w-full py-2 bg-teal-700/40 hover:bg-teal-700/70 text-teal-200 rounded-lg font-bold text-sm transition">+ Add image</button>
          </div>
          <p className="text-xs text-gray-600 text-center mt-4">{spotImages.length} {spotImages.length === 1 ? "image" : "images"} • Auto-resized to 1280px wide for clarity</p>
        </div>
      </div>
    </div>
  );
}
