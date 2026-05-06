import { useState, useRef, useEffect, useCallback } from "react";
import { Socket } from "socket.io-client";
import { Team, GameState, FaceMergeData } from "@/lib/types";
import { getTeamColors } from "@/lib/teamColors";

interface Props {
  teams: Team[];
  socket: Socket;
  sessionId: string;
  gameState: GameState;
  onEnd: (winnerTeamId?: string) => void;
}

interface SavedFaceMerge {
  merged?: string | null;
  image1?: string | null;
  image2?: string | null;
}

function loadSavedFaceMerge(): SavedFaceMerge {
  try {
    const raw = localStorage.getItem("quiz_minigames_face_merge");
    if (raw) return JSON.parse(raw) as SavedFaceMerge;
  } catch {}
  return {};
}

export default function FaceMergeGame({ teams, socket, sessionId, gameState, onEnd }: Props) {
  const [localState, setLocalState] = useState<GameState>(gameState);
  const saved = loadSavedFaceMerge();
  const [image1Preview, setImage1Preview] = useState<string | null>(saved.image1 ?? null);
  const [image2Preview, setImage2Preview] = useState<string | null>(saved.image2 ?? null);
  const [mergedPreview, setMergedPreview] = useState<string | null>(saved.merged ?? null);
  const [uploading, setUploading] = useState(false);
  const file1Ref = useRef<HTMLInputElement>(null);
  const file2Ref = useRef<HTMLInputElement>(null);
  const fileMergedRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (state: GameState) => setLocalState(state);
    socket.on("game:face_merge_updated", handler);
    socket.on("game:buzzed", ({ state }: { state: GameState }) => setLocalState(state));
    socket.on("game:buzz_reset", (state: GameState) => setLocalState(state));
    return () => {
      socket.off("game:face_merge_updated", handler);
      socket.off("game:buzzed");
      socket.off("game:buzz_reset");
    };
  }, [socket]);

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFile1 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await readFile(file);
    setImage1Preview(data);
  };

  const handleFile2 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await readFile(file);
    setImage2Preview(data);
  };

  const handleFileMerged = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await readFile(file);
    setMergedPreview(data);
  };

  const handleStartGuessing = useCallback(() => {
    if (!image1Preview || !image2Preview) return;
    setUploading(true);
    socket.emit("admin:face_merge_setup", {
      sessionId,
      image1: image1Preview,
      image2: image2Preview,
      merged: mergedPreview,
    });
    setTimeout(() => setUploading(false), 500);
  }, [image1Preview, image2Preview, mergedPreview, sessionId, socket]);

  const handleReveal = () => {
    socket.emit("admin:face_merge_reveal", { sessionId });
  };

  const handleResetBuzz = () => {
    socket.emit("admin:reset_buzz", { sessionId });
  };

  const fmData = localState.miniGameData as FaceMergeData | null;
  const phase = fmData?.phase ?? "setup";
  const buzzedBy = localState.buzzedBy;
  const hasSavedSet = !!(saved.image1 && saved.image2);

  return (
    <div className="space-y-5">
      {phase === "setup" && (
        <div className="bg-gray-800 rounded-xl p-5 space-y-4">
          {hasSavedSet && (
            <div className="bg-green-950/40 border border-green-700 rounded-lg p-2 text-center text-xs text-green-300">
              ✓ Pre-uploaded images loaded from "Manage Mini-Games"
            </div>
          )}
          <p className="text-white font-bold text-center text-lg">Face Merge — set up images</p>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 text-center">Merged image (shown to players during guessing)</label>
            <div className="flex flex-col items-center gap-2">
              {mergedPreview ? (
                <img src={mergedPreview} alt="Merged" className="w-40 h-40 object-cover rounded-xl border-2 border-pink-500" />
              ) : (
                <div onClick={() => fileMergedRef.current?.click()} className="w-40 h-40 bg-gray-700 rounded-xl border-2 border-dashed border-gray-600 flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:border-pink-500 transition">
                  <span className="text-3xl">📷</span>
                  <span className="text-xs mt-1">Optional</span>
                </div>
              )}
              <input ref={fileMergedRef} type="file" accept="image/*" className="hidden" onChange={handleFileMerged} />
              <button onClick={() => fileMergedRef.current?.click()} className="text-xs text-pink-400 hover:text-pink-300 underline">
                {mergedPreview ? "Change merged" : "Select merged image"}
              </button>
              {!mergedPreview && (
                <p className="text-xs text-gray-500 text-center">If you skip this, the app will auto-blend the two originals.</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 text-center">Original images (shown on Reveal)</label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-gray-400 font-semibold">Person 1</p>
                {image1Preview ? (
                  <img src={image1Preview} alt="Person 1" className="w-32 h-32 object-cover rounded-xl border-2 border-pink-500" />
                ) : (
                  <div className="w-32 h-32 bg-gray-700 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 text-4xl cursor-pointer hover:border-pink-500 transition" onClick={() => file1Ref.current?.click()}>
                    📷
                  </div>
                )}
                <input ref={file1Ref} type="file" accept="image/*" className="hidden" onChange={handleFile1} />
                <button onClick={() => file1Ref.current?.click()} className="text-xs text-pink-400 hover:text-pink-300 underline">
                  {image1Preview ? "Change" : "Select"}
                </button>
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-gray-400 font-semibold">Person 2</p>
                {image2Preview ? (
                  <img src={image2Preview} alt="Person 2" className="w-32 h-32 object-cover rounded-xl border-2 border-pink-500" />
                ) : (
                  <div className="w-32 h-32 bg-gray-700 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 text-4xl cursor-pointer hover:border-pink-500 transition" onClick={() => file2Ref.current?.click()}>
                    📷
                  </div>
                )}
                <input ref={file2Ref} type="file" accept="image/*" className="hidden" onChange={handleFile2} />
                <button onClick={() => file2Ref.current?.click()} className="text-xs text-pink-400 hover:text-pink-300 underline">
                  {image2Preview ? "Change" : "Select"}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleStartGuessing}
            disabled={!image1Preview || !image2Preview || uploading}
            className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-black text-lg transition disabled:opacity-40"
          >
            {uploading ? "Sending..." : "🖼️ Show to Players →"}
          </button>
        </div>
      )}

      {(phase === "guessing" || phase === "revealed") && fmData && (
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="relative w-64 h-64 rounded-2xl overflow-hidden border-2 border-pink-500 shadow-2xl">
              {fmData.merged ? (
                <img src={fmData.merged} alt="Merged" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <>
                  {fmData.image1 && <img src={fmData.image1} alt="Face 1" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.55 }} />}
                  {fmData.image2 && <img src={fmData.image2} alt="Face 2" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.55, mixBlendMode: "multiply" }} />}
                </>
              )}
              {phase === "guessing" && (
                <div className="absolute bottom-2 left-0 right-0 text-center">
                  <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-full font-bold">Who are these people?</span>
                </div>
              )}
            </div>
          </div>

          {phase === "revealed" && fmData.image1 && fmData.image2 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center gap-1">
                <p className="text-xs text-gray-400 font-semibold">Person 1</p>
                <img src={fmData.image1} alt="Person 1" className="w-full h-32 object-cover rounded-xl border-2 border-pink-400" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-xs text-gray-400 font-semibold">Person 2</p>
                <img src={fmData.image2} alt="Person 2" className="w-full h-32 object-cover rounded-xl border-2 border-pink-400" />
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
            {teams.map((team) => {
              const colors = getTeamColors(team.color);
              return (
                <button key={team.id} onClick={() => onEnd(team.id)} className={`${colors.button} text-white px-4 py-2.5 rounded-xl font-bold text-sm transition`}>
                  🏆 Award to {team.name}
                </button>
              );
            })}
            <button onClick={() => onEnd(undefined)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition">
              No Winner / End
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
