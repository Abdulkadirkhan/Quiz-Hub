import { useEffect, useState } from "react";
import { MiniGameType, MysteryPuzzleClue } from "@/lib/types";

export type MiniGameStartData =
  | { teamPuzzles: Record<string, { story: string; clues: MysteryPuzzleClue[] }> }
  | { images: string[] };

interface Props {
  teams: { id: string }[];
  connectedPlayerCount: number;
  onSelect: (type: MiniGameType, data?: MiniGameStartData) => void;
  onClose: () => void;
}

const MYSTERY_KEY_V2 = "quiz_minigames_mystery_puzzle_v2";
const SPOT_DIFF_KEY = "quiz_minigames_spot_difference";

interface SavedV2 {
  teamA: { story: string; clues: Array<{ question: string; digit: string }> };
  teamB: { story: string; clues: Array<{ question: string; digit: string }> };
}

interface SavedSpotDiff { id: string; image: string | null; }

function loadSavedV2(): SavedV2 | null {
  try {
    const raw = localStorage.getItem(MYSTERY_KEY_V2);
    if (raw) return JSON.parse(raw) as SavedV2;
  } catch {}
  return null;
}

function loadSavedSpotDiff(): SavedSpotDiff[] {
  try {
    const raw = localStorage.getItem(SPOT_DIFF_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

const GAMES = [
  { type: "number_survival" as MiniGameType, icon: "🔢", name: "Number Survival", desc: "Pick a unique number 1–10 (vs the other team) or get eliminated. 30s per round, 3 rounds.", color: "bg-orange-950 border-orange-700 hover:border-orange-400" },
  { type: "face_merge" as MiniGameType, icon: "🖼️", name: "Face Merge", desc: "Multiple image sets — race through them. Pre-load in Manage Mini-Games.", color: "bg-pink-950 border-pink-700 hover:border-pink-400" },
  { type: "mystery_puzzle" as MiniGameType, icon: "🔐", name: "Mystery Puzzle", desc: "Split-screen vault crack. Each team gets their own 4 clues — solve them, then figure out the unlock order.", color: "bg-amber-950 border-amber-700 hover:border-amber-400" },
  { type: "spot_difference" as MiniGameType, icon: "🔍", name: "Spot the Difference", desc: "Show a combined image, audience yells the difference, host awards. No phones needed.", color: "bg-teal-950 border-teal-700 hover:border-teal-400" },
];

export default function MiniGameSelector({ teams, connectedPlayerCount, onSelect, onClose }: Props) {
  const [hasSavedMystery, setHasSavedMystery] = useState(false);
  const [mysteryError, setMysteryError] = useState("");
  const noPlayers = connectedPlayerCount === 0;

  useEffect(() => {
    const saved = loadSavedV2();
    const valid = !!saved &&
      Array.isArray(saved.teamA?.clues) && saved.teamA.clues.length === 4 && saved.teamA.clues.every((c) => /^[0-9]$/.test(c.digit)) &&
      Array.isArray(saved.teamB?.clues) && saved.teamB.clues.length === 4 && saved.teamB.clues.every((c) => /^[0-9]$/.test(c.digit));
    setHasSavedMystery(valid);
  }, []);

  const handleMysteryClick = () => {
    setMysteryError("");
    const saved = loadSavedV2();
    if (!saved) {
      setMysteryError("No Mystery Puzzle configured yet. Open Manage Mini-Games to set one up.");
      return;
    }
    // Map saved data onto team IDs from the current session.
    // Team A → first team, Team B → second team.
    if (teams.length < 2) {
      setMysteryError("Mystery Puzzle requires 2 teams.");
      return;
    }
    const mkClues = (raw: SavedV2["teamA"]["clues"]): MysteryPuzzleClue[] =>
      raw.slice(0, 4).map((c) => ({ question: c.question || "", answer: "", reward: c.digit }));
    const allValidA = saved.teamA.clues.every((c) => /^[0-9]$/.test(c.digit));
    const allValidB = saved.teamB.clues.every((c) => /^[0-9]$/.test(c.digit));
    if (!allValidA || !allValidB) {
      setMysteryError("Saved puzzle has missing digits. Edit it in Manage Mini-Games.");
      return;
    }
    const teamPuzzles: Record<string, { story: string; clues: MysteryPuzzleClue[] }> = {
      [teams[0].id]: { story: saved.teamA.story || "", clues: mkClues(saved.teamA.clues) },
      [teams[1].id]: { story: saved.teamB.story || "", clues: mkClues(saved.teamB.clues) },
    };
    onSelect("mystery_puzzle", { teamPuzzles });
  };

  const [spotDiffError, setSpotDiffError] = useState("");
  const handleSpotDiffClick = () => {
    setSpotDiffError("");
    const saved = loadSavedSpotDiff();
    const images = saved.map((s) => s.image).filter((img): img is string => !!img);
    if (images.length === 0) {
      setSpotDiffError("No Spot the Difference images saved. Open Manage Mini-Games to add some.");
      return;
    }
    onSelect("spot_difference", { images });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-gray-900 rounded-2xl p-6 border border-gray-700 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-black text-white">🎮 Start Mini-Game</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl font-bold transition">✕</button>
        </div>

        {hasSavedMystery && (
          <div className="bg-green-950/40 border border-green-700 rounded-lg p-2 text-center text-xs text-green-300 mb-3">
            ✓ Saved Mystery Puzzle ready
          </div>
        )}
        {noPlayers && (
          <div className="bg-blue-950/40 border border-blue-700 rounded-lg p-2 text-center text-xs text-blue-300 mb-3">
            🎤 <span className="font-bold">Host-only mode</span> — no player phones. Number Survival needs phones. Face Merge, Mystery Puzzle (host keypad), and Spot the Difference work fine.
          </div>
        )}
        {mysteryError && (
          <div className="bg-red-950/40 border border-red-700 rounded-lg p-2 text-center text-sm text-red-300 mb-3">
            {mysteryError}
          </div>
        )}
        {spotDiffError && (
          <div className="bg-red-950/40 border border-red-700 rounded-lg p-2 text-center text-sm text-red-300 mb-3">
            {spotDiffError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GAMES.map((game) => {
            const requiresPhones = game.type === "number_survival";
            const disabled = requiresPhones && noPlayers;
            return (
              <button
                key={game.type}
                onClick={() => {
                  if (disabled) return;
                  if (game.type === "mystery_puzzle") handleMysteryClick();
                  else if (game.type === "spot_difference") handleSpotDiffClick();
                  else onSelect(game.type);
                }}
                disabled={disabled}
                className={`text-left rounded-xl p-4 border-2 transition-all ${disabled ? "opacity-40 cursor-not-allowed border-gray-700 bg-gray-800" : game.color}`}
                title={disabled ? "Needs at least 1 player phone connected" : ""}
              >
                <div className="text-4xl mb-2">{game.icon}</div>
                <div className="text-white font-black text-lg leading-tight">{game.name}</div>
                <div className="text-gray-400 text-xs mt-1 leading-snug">{game.desc}</div>
                {disabled && <div className="text-blue-400 text-[10px] font-bold mt-1">⚠️ Needs phones — no players connected</div>}
              </button>
            );
          })}
        </div>

        <button onClick={onClose} className="w-full mt-4 py-2 text-gray-600 hover:text-gray-400 text-sm transition">Cancel</button>
      </div>
    </div>
  );
}
