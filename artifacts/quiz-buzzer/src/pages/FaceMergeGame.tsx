import { useState, useEffect, useCallback } from "react";
import { Socket } from "socket.io-client";
import { Team, GameState, FaceMergeData } from "@/lib/types";
import { getTeamColors } from "@/lib/teamColors";
import { resizeImageFile } from "@/lib/imageUtils";

interface Props {
  teams: Team[];
  socket: Socket;
  sessionId: string;
  gameState: GameState;
  onEnd: (winnerTeamId?: string) => void;
}

interface SavedSet { id: string; merged?: string | null; image1?: string | null; image2?: string | null; }

const FACE_MERGE_SETS_KEY = "quiz_minigames_face_merge_sets";
const OLD_FACE_MERGE_KEY = "quiz_minigames_face_merge";

function loadSets(): SavedSet[] {
  try {
    const raw = localStorage.getItem(FACE_MERGE_SETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  // Fallback: legacy single set
  try {
    const oldRaw = localStorage.getItem(OLD_FACE_MERGE_KEY);
    if (oldRaw) {
      const old = JSON.parse(oldRaw);
      if (old && (old.image1 || old.image2 || old.merged)) {
        return [{ id: "legacy", merged: old.merged ?? null, image1: old.image1 ?? null, image2: old.image2 ?? null }];
      }
    }
  } catch {}
  return [];
}

interface UploadSet { id: string; merged: string | null; image1: string | null; image2: string | null; }

export default function FaceMergeGame({ teams, socket, sessionId, gameState, onEnd }: Props) {
  const [localState, setLocalState] = useState<GameState>(gameState);
  const [sentSets, setSentSets] = useState(false);
  const [error, setError] = useState("");

  // Manual upload fallback (if localStorage is empty)
  const [manualSets, setManualSets] = useState<UploadSet[]>([{ id: "1", merged: null, image1: null, image2: null }]);

  useEffect(() => {
    const handler = (state: GameState) => setLocalState(state);
    const onScore = (state: GameState) => setLocalState(state);
    socket.on("game:face_merge_updated", handler);
    socket.on("game:score_update", onScore);
    socket.on("game:buzzed", ({ state }: { state: GameState }) => setLocalState(state));
    socket.on("game:buzz_reset", (state: GameState) => setLocalState(state));
    return () => {
      socket.off("game:face_merge_updated", handler);
      socket.off("game:score_update", onScore);
      socket.off("game:buzzed");
      socket.off("game:buzz_reset");
    };
  }, [socket]);

  const fmData = localState.miniGameData as FaceMergeData | null;
  const totalSets = fmData?.totalSets ?? 0;
  const phase = fmData?.phase;
  const setIndex = fmData?.setIndex ?? 0;
  const buzzedBy = localState.buzzedBy;

  // Auto-send saved sets on first mount (if puzzle hasn't been set up yet)
  useEffect(() => {
    if (sentSets) return;
    if (totalSets > 0) { setSentSets(true); return; }
    const saved = loadSets();
    // A set is playable if it has a merged image OR both Person 1 and Person 2 (overlay fallback).
    const valid = saved.filter((s) => s.merged || (s.image1 && s.image2));
    if (valid.length === 0) return;
    const payload = valid.map((s) => ({
      image1: s.image1 as string,
      image2: s.image2 as string,
      merged: s.merged ?? null,
    }));
    socket.emit("admin:face_merge_setup", { sessionId, sets: payload });
    setSentSets(true);
  }, [sentSets, totalSets, socket, sessionId]);

  const sendManualSets = useCallback(() => {
    setError("");
    const valid = manualSets.filter((s) => s.merged || (s.image1 && s.image2));
    if (valid.length === 0) {
      setError("Each set needs at least the Merged image (or both Person 1 and Person 2).");
      return;
    }
    const payload = valid.map((s) => ({
      image1: s.image1 as string,
      image2: s.image2 as string,
      merged: s.merged,
    }));
    // Persist to localStorage so the next game session auto-loads these
    try {
      const persistable = valid.map((s, i) => ({
        id: `g-${Date.now()}-${i}`,
        merged: s.merged ?? null,
        image1: s.image1 ?? null,
        image2: s.image2 ?? null,
      }));
      localStorage.setItem(FACE_MERGE_SETS_KEY, JSON.stringify(persistable));
    } catch {
      // localStorage full or unavailable — game continues with this session's uploads regardless
    }
    socket.emit("admin:face_merge_setup", { sessionId, sets: payload });
    setSentSets(true);
  }, [manualSets, socket, sessionId]);

  const handleManualPick = async (idx: number, field: "merged" | "image1" | "image2", file: File | null) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setError("Source image > 20 MB — too big even before resize."); return; }
    try {
      const data = await resizeImageFile(file, { maxDim: 1024, quality: 0.85 });
      setManualSets((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: data } : s));
    } catch { setError("Couldn't read file"); }
  };

  const addManualSet = () => setManualSets((prev) => [...prev, { id: String(prev.length + 1), merged: null, image1: null, image2: null }]);
  const removeManualSet = (idx: number) => setManualSets((prev) => prev.filter((_, i) => i !== idx));

  const handleReveal = () => socket.emit("admin:face_merge_reveal", { sessionId });
  const handleResetBuzz = () => socket.emit("admin:reset_buzz", { sessionId });
  const handleNext = () => socket.emit("admin:face_merge_next", { sessionId });
  const handleAwardAndNext = (teamId: string) => {
    socket.emit("admin:adjust_score", { sessionId, teamId, delta: 1 });
    if (setIndex + 1 < totalSets) {
      socket.emit("admin:face_merge_next", { sessionId });
    } else {
      onEnd(undefined); // mini-game ends, scores already updated
    }
  };

  // ----- Setup screen (no sets sent yet) -----
  if (!totalSets || phase === undefined) {
    // Diagnostic info: what's actually in localStorage right now?
    let diagnostic = "No saved Face Merge sets found.";
    let detail = "";
    try {
      const raw = localStorage.getItem(FACE_MERGE_SETS_KEY);
      const legacyRaw = localStorage.getItem(OLD_FACE_MERGE_KEY);
      if (!raw && !legacyRaw) {
        detail = `Looked at localStorage key "${FACE_MERGE_SETS_KEY}" → empty.`;
      } else if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const total = parsed.length;
            const valid = parsed.filter((s: SavedSet) => s.merged || (s.image1 && s.image2)).length;
            detail = `Found ${total} saved set${total === 1 ? "" : "s"} in localStorage, ${valid} valid (with Merged or both originals). ${valid === 0 ? "None passed validation — re-upload in Manage Mini-Games." : ""}`;
            if (valid > 0) diagnostic = `${valid} valid sets found. Reloading…`;
          } else {
            detail = `localStorage data is not an array — corrupted. Clear in Manage Mini-Games and re-save.`;
          }
        } catch {
          detail = `localStorage data is invalid JSON — corrupted. Clear in Manage Mini-Games and re-save.`;
        }
      } else if (legacyRaw) {
        detail = "Legacy single-set data exists but new multi-set is missing. Open Manage Mini-Games and click Save once.";
      }
    } catch {
      detail = "Can't read localStorage — your browser may have it disabled.";
    }

    return (
      <div className="space-y-4">
        <div className="bg-gray-800/60 rounded-lg p-3 text-sm text-center">
          <p className="text-gray-300 font-bold">{diagnostic}</p>
          {detail && <p className="text-gray-500 text-xs mt-1">{detail}</p>}
          <p className="text-gray-400 text-xs mt-2">Either upload sets right here, or go to <span className="text-pink-400 font-semibold">Manage Mini-Games</span> to save them.</p>
        </div>
        {error && <div className="bg-red-950/40 border border-red-700 rounded-lg p-2 text-center text-sm text-red-300">{error}</div>}
        <div className="space-y-3">
          {manualSets.map((s, idx) => (
            <div key={s.id} className="bg-gray-800/60 rounded-xl p-3 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-pink-300 font-bold text-sm">Set {idx + 1}</p>
                {manualSets.length > 1 && <button onClick={() => removeManualSet(idx)} className="text-xs bg-red-900 hover:bg-red-800 text-white px-2 py-1 rounded">Remove</button>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["merged", "image1", "image2"] as const).map((field) => {
                  const labels: Record<string, string> = { merged: "Merged", image1: "Person 1", image2: "Person 2" };
                  const src = s[field];
                  return (
                    <label key={field} className="flex flex-col items-center gap-1 cursor-pointer">
                      <span className="text-[10px] text-gray-400 uppercase font-bold">{labels[field]}</span>
                      {src ? (
                        <img src={src} alt={labels[field]} className="w-20 h-20 object-cover rounded-lg border-2 border-pink-500" />
                      ) : (
                        <div className="w-20 h-20 bg-gray-700 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 text-xl hover:border-pink-500 transition">📷</div>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleManualPick(idx, field, e.target.files?.[0] ?? null)} />
                      <span className="text-[10px] text-pink-400 underline">{src ? "Change" : "Select"}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex gap-2 justify-center">
            <button onClick={addManualSet} className="text-xs text-pink-400 hover:text-pink-300 underline">+ Add another set</button>
          </div>
          <button onClick={sendManualSets} className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-black text-lg transition">
            🖼️ Show to Players →
          </button>
        </div>
      </div>
    );
  }

  // ----- All sets done -----
  if (phase === "done") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-pink-300 font-bold">All {totalSets} image{totalSets === 1 ? "" : "s"} complete!</p>
        <button onClick={() => onEnd(undefined)} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl font-bold transition">
          End Mini-Game
        </button>
      </div>
    );
  }

  // ----- Active set -----
  return (
    <div className="space-y-4">
      <div className="text-center text-sm font-bold text-pink-400">
        Image {setIndex + 1} of {totalSets}
      </div>

      <div className="flex justify-center">
        <div className="relative w-64 h-64 rounded-2xl overflow-hidden border-2 border-pink-500 shadow-2xl">
          {fmData!.merged ? (
            <img src={fmData!.merged} alt="Merged" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <>
              {fmData!.image1 && <img src={fmData!.image1} alt="Face 1" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.55 }} />}
              {fmData!.image2 && <img src={fmData!.image2} alt="Face 2" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.55, mixBlendMode: "multiply" }} />}
            </>
          )}
          {phase === "guessing" && (
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-full font-bold">Who are these people?</span>
            </div>
          )}
        </div>
      </div>

      {phase === "revealed" && fmData!.image1 && fmData!.image2 && (
        <div className="grid grid-cols-2 gap-3 max-w-3xl mx-auto">
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs text-gray-400 font-semibold">Person 1</p>
            <div className="w-full bg-black rounded-xl border-2 border-pink-400 overflow-hidden" style={{ aspectRatio: "3/4", maxHeight: "70vh" }}>
              <img src={fmData!.image1} alt="Person 1" className="w-full h-full object-contain" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs text-gray-400 font-semibold">Person 2</p>
            <div className="w-full bg-black rounded-xl border-2 border-pink-400 overflow-hidden" style={{ aspectRatio: "3/4", maxHeight: "70vh" }}>
              <img src={fmData!.image2} alt="Person 2" className="w-full h-full object-contain" />
            </div>
          </div>
        </div>
      )}

      {buzzedBy && (
        <div className="bg-orange-950 border-2 border-orange-500 rounded-xl p-4 text-center">
          <p className="text-orange-400 text-xs font-bold">BUZZED FIRST!</p>
          <p className="text-2xl font-black text-white">{buzzedBy.playerName}</p>
          <p className="text-orange-400 font-bold">{buzzedBy.teamName}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        {phase === "guessing" && (
          <button onClick={handleReveal} className="bg-yellow-500 hover:bg-yellow-400 text-black px-5 py-2.5 rounded-xl font-black transition">
            👁 Reveal Original Images
          </button>
        )}
        {buzzedBy && (
          <button onClick={handleResetBuzz} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2.5 rounded-xl font-bold transition">
            Reset Buzz
          </button>
        )}
        {phase === "revealed" && teams.map((team) => {
          const colors = getTeamColors(team.color);
          return (
            <button key={team.id} onClick={() => handleAwardAndNext(team.id)} className={`${colors.button} text-white px-4 py-2.5 rounded-xl font-bold text-sm transition`}>
              🏆 +1 {team.name}{setIndex + 1 < totalSets ? " → next" : " → end"}
            </button>
          );
        })}
        {phase === "revealed" && setIndex + 1 < totalSets && (
          <button onClick={handleNext} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition">
            → Next image (no winner)
          </button>
        )}
        {phase === "revealed" && setIndex + 1 >= totalSets && (
          <button onClick={() => onEnd(undefined)} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition">
            End Mini-Game
          </button>
        )}
        <button onClick={() => onEnd(undefined)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2.5 rounded-xl font-bold text-xs transition">
          End early
        </button>
      </div>
    </div>
  );
}
