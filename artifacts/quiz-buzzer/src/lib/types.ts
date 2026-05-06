export type TeamColor = "blue" | "red" | "green" | "yellow" | "purple" | "orange";

export interface Team { id: string; name: string; color: TeamColor; score: number; }
export interface PlayerInfo { name: string; teamId: string; avatar: string; }
export interface Question { id: string; text: string; choices?: { label: string; text: string }[]; timeLimit?: number; }

export type GameStatus = "lobby" | "playing" | "question_active" | "buzzed" | "round_end" | "finished" | "minigame" | "buzzer_active";

export type MiniGameType = "pacman" | "number_survival" | "face_merge" | "mystery_puzzle" | null;

export interface BuzzEvent { playerId: string; playerName: string; teamId: string; teamName: string; timestamp: number; }

export interface NumberSurvivalData {
  type: "number_survival";
  round: number; totalRounds: number; phase: "selecting" | "revealing" | "done";
  selectedCount: number; totalSurvivors: number; teamSurvivors: Record<string, string[]>;
  history: Array<{ round: number; choices: Array<{ socketId: string; name: string; teamId: string; avatar: string; number: number }>; eliminated: string[]; survivorsByTeam: Record<string, number> }>;
  currentResult: { round: number; choices: Array<{ socketId: string; name: string; teamId: string; avatar: string; number: number }>; eliminated: string[]; survivorsByTeam: Record<string, number> } | null;
  mySelections: Record<string, number>;
  survivorIds: string[];
}

export interface FaceMergeData {
  type: "face_merge";
  phase: "setup" | "guessing" | "revealed";
  image1: string | null;
  image2: string | null;
  merged: string | null;
}

export interface MysteryPuzzleClue { question: string; answer: string; reward: string; }

export interface MysteryPuzzleData {
  type: "mystery_puzzle";
  story: string;
  clues: MysteryPuzzleClue[];
  currentClueIndex: number;
  revealedClues: number[];
  vaultCode: string;
  vaultRevealed: boolean;
}

export interface PacmanData { type: "pacman"; }

export type MiniGameData = NumberSurvivalData | FaceMergeData | MysteryPuzzleData | PacmanData | null;

export interface GameState {
  id: string; teams: Team[]; players: Record<string, PlayerInfo[]>;
  status: GameStatus; buzzedBy: BuzzEvent | null; currentQuestion: Question | null;
  currentQuestionIndex: number; totalQuestions: number;
  miniGameType: MiniGameType; miniGameData: MiniGameData;
}
