import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";

interface SavedFaceMerge {
  merged?: string | null;
  image1?: string | null;
  image2?: string | null;
}

const FACE_MERGE_KEY = "quiz_minigames_face_merge";

function loadSaved(): SavedFaceMerge {
  try {
    const raw = localStorage.getItem(FACE_MERGE_KEY);
    if (raw) return JSON.parse(raw) as SavedFaceMerge;
  } catch {}
  return {};
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MiniGameManager() {
  const [, navigate] = useLocation();
  const initial = loadSaved();
  const [merged, setMerged] = useState<string | null>(initial.merged ?? null);
  const [image1, setImage1] = useState<string | null>(initial.image1 ?? null);
  const [image2, setImage2] = useState<string | null>(initial.image2 ?? null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState("");

  const refMerged = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!savedNotice) return;
    const t = setTimeout(() => setSavedNotice(false), 2000);
    return () => clearTimeout(t);
  }, [savedNotice]);

  const onPick = (setter: (v: string | null) => void) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Image is larger than 2 MB. Please use a smaller file (browser storage is limited).");
      return;
    }
    try {
      const data = await readFile(file);
      setter(data);
    } catch {
      setError("Could not read that file. Try another image.");
    }
  };

  const handleSave = () => {
    setError("");
    try {
      const payload: SavedFaceMerge = { merged, image1, image2 };
      localStorage.setItem(FACE_MERGE_KEY, JSON.stringify(payload));
      setSavedNotice(true);
    } catch (e) {
      setError("Couldn't save — images may be too large. Try smaller files.");
    }
  };

  const handleClear = () => {
    if (!confirm("Clear all saved Face Merge images?")) return;
    localStorage.removeItem(FACE_MERGE_KEY);
    setMerged(null); setImage1(null); setImage2(null);
  };

  const Slot = ({
    label, src, onChange, inputRef, accent,
  }: { label: string; src: string | null; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; inputRef: React.RefObject<HTMLInputElement | null>; accent: string }) => (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-semibold text-gray-400">{label}</p>
      {src ? (
        <img src={src} alt={label} className={`w-40 h-40 object-cover rounded-xl border-2 ${accent}`} />
      ) : (
        <div onClick={() => inputRef.current?.click()} className={`w-40 h-40 bg-gray-800 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 text-4xl cursor-pointer hover:border-pink-500 transition`}>
          📷
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
      <div className="flex gap-2">
        <button onClick={() => inputRef.current?.click()} className="text-xs text-pink-400 hover:text-pink-300 underline">
          {src ? "Change" : "Select"}
        </button>
        {src && (
          <button onClick={() => {
            if (label === "Merged image") setMerged(null);
            else if (label === "Person 1") setImage1(null);
            else if (label === "Person 2") setImage2(null);
          }} className="text-xs text-gray-500 hover:text-gray-400 underline">Remove</button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-black text-yellow-400">Manage Mini-Games</h1>
            <p className="text-gray-500 text-sm">Pre-load assets so they're ready when you start a mini-game</p>
          </div>
          <button onClick={() => navigate("/")} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">
            ← Back to Lobby
          </button>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border-2 border-pink-700 mb-6">
          <div className="flex items-start justify-between mb-5 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-black text-pink-400">🖼️ Face Merge</h2>
              <p className="text-xs text-gray-400 mt-1">Upload one merged image (shown during guessing) and the two originals (shown on Reveal).</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg font-black text-sm transition">
                Save
              </button>
              <button onClick={handleClear} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">
                Clear
              </button>
            </div>
          </div>

          {savedNotice && (
            <div className="bg-green-950/40 border border-green-700 rounded-lg p-2 text-center text-sm text-green-300 mb-4">
              ✓ Saved. These will load automatically when you start the Face Merge mini-game.
            </div>
          )}
          {error && (
            <div className="bg-red-950/40 border border-red-700 rounded-lg p-2 text-center text-sm text-red-300 mb-4">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-3 text-center uppercase tracking-wider">Merged Image (shown during guessing)</p>
              <div className="flex justify-center">
                <Slot label="Merged image" src={merged} onChange={onPick(setMerged)} inputRef={refMerged} accent="border-pink-500" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-3 text-center uppercase tracking-wider">Originals (shown when admin clicks Reveal)</p>
              <div className="grid grid-cols-2 gap-4">
                <Slot label="Person 1" src={image1} onChange={onPick(setImage1)} inputRef={ref1} accent="border-pink-400" />
                <Slot label="Person 2" src={image2} onChange={onPick(setImage2)} inputRef={ref2} accent="border-pink-400" />
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-600 text-center mt-6">Saved in this browser only • Keep images under 2 MB each</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 opacity-60">
          <h2 className="text-xl font-black text-gray-500">🔐 Mystery Puzzle / 🔢 Number Survival / 👾 Pac-Man</h2>
          <p className="text-xs text-gray-500 mt-1">No pre-game setup needed — these mini-games are configured when you start them.</p>
        </div>
      </div>
    </div>
  );
}
