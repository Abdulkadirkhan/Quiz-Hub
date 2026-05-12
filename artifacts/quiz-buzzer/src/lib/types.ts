export type TeamColor = "blue" | "red" | "green" | "yellow" | "purple" | "orange";

export interface Team { id: string; name: string; color: TeamColor; score: number; }
export interface PlayerInfo { name: string; teamId: string; avatar: string; connected?: boolean; }
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
  remainingMs?: number;
  durationSec?: number;
  numberRange?: number;
}

export interface FaceMergeData {
  type: "face_merge";
  phase: "guessing" | "revealed" | "done";
  setIndex: number;
  totalSets: number;
  image1: string | null;
  image2: string | null;
  merged: string | null;
}

export interface MysteryPuzzleClue { question: string; answer: string; reward: string; }

export interface MysteryPuzzleAttempt {
  code: string;
  correct: boolean;
  timestamp: number;
  playerName: string;
  teamId: string;
}

export interface MysteryPuzzleTeamView {
  story: string;
  clues: Array<{ question: string; answer: string; revealed: boolean; digit: string | null }>;
  vaultUnlocked: boolean;
}

export interface MysteryPuzzleData {
  type: "mystery_puzzle";
  teamData: Record<string, MysteryPuzzleTeamView>;
  solverByTeam: Record<string, string>;
  solverNamesByTeam: Record<string, string>;
  attempts: MysteryPuzzleAttempt[];
  winnerTeamId: string | null;
}

export interface PacManPlayerView {
  playerKey: string;
  name: string;
  teamId: string;
  color: string;
  avatar: string;
  x: number; y: number;
  dir: { x: number; y: number };
  score: number;
  mouthOpen: boolean;
}

export interface PacmanData {
  type: "pacman";
  cols: number;
  rows: number;
  walls: boolean[][];
  pellets: boolean[][];
  players: PacManPlayerView[];
  teamScores: Record<string, number>;
  durationSec: number;
  remainingMs: number;
  ended: boolean;
}

export type MiniGameData = NumberSurvivalData | FaceMergeData | MysteryPuzzleData | PacmanData | null;

export interface GameState {
  id: string; teams: Team[]; players: Record<string, PlayerInfo[]>;
  status: GameStatus; buzzedBy: BuzzEvent | null; currentQuestion: Question | null;
  currentQuestionIndex: number; totalQuestions: number;
  miniGameType: MiniGameType; miniGameData: MiniGameData;
}
