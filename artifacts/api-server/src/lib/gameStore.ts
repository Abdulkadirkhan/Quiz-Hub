import { logger } from "./logger";

export type TeamColor = "blue" | "red" | "green" | "yellow" | "purple" | "orange";

export interface Team { id: string; name: string; color: TeamColor; score: number; }
export interface Player { socketId: string; name: string; teamId: string; hasBuzzed: boolean; avatar: string; eliminated: boolean; }
export interface Question { id: string; text: string; choices?: { label: string; text: string }[]; timeLimit?: number; }

export type GameStatus = "lobby" | "playing" | "question_active" | "buzzed" | "round_end" | "finished" | "minigame" | "buzzer_active";

export interface BuzzEvent { playerId: string; playerName: string; teamId: string; teamName: string; timestamp: number; }

export interface RoundResult {
  round: number;
  choices: Array<{ socketId: string; name: string; teamId: string; avatar: string; number: number }>;
  eliminated: string[];
  survivorsByTeam: Record<string, number>;
}

export interface NumberSurvivalState {
  round: number; totalRounds: number; phase: "selecting" | "revealing" | "done";
  roundSelections: Map<string, number>; survivors: Set<string>; history: RoundResult[];
}

export interface FaceMergeState {
  phase: "setup" | "guessing" | "revealed";
  image1: string | null;
  image2: string | null;
}

export interface MysteryPuzzleClue { question: string; answer: string; reward: string; }

export interface MysteryPuzzleState {
  story: string; clues: MysteryPuzzleClue[];
  currentClueIndex: number; revealedClues: number[];
  vaultCode: string; vaultRevealed: boolean;
}

export interface GameSession {
  id: string; teams: Team[]; players: Map<string, Player>; questions: Question[];
  currentQuestionIndex: number; status: GameStatus; buzzedBy: BuzzEvent | null;
  adminSocketId: string | null; createdAt: number; miniGameType: string | null;
  numberSurvivalState: NumberSurvivalState | null;
  faceMergeState: FaceMergeState | null;
  mysteryPuzzleState: MysteryPuzzleState | null;
}

const DEFAULT_QUESTIONS: Question[] = [
  { id: "q1", text: "What is the capital of France?", choices: [{ label: "A", text: "Berlin" }, { label: "B", text: "Madrid" }, { label: "C", text: "Paris" }, { label: "D", text: "Rome" }], timeLimit: 30 },
  { id: "q2", text: "What is 7 × 8?", choices: [{ label: "A", text: "54" }, { label: "B", text: "56" }, { label: "C", text: "58" }, { label: "D", text: "64" }], timeLimit: 30 },
  { id: "q3", text: "Which planet is closest to the Sun?", choices: [{ label: "A", text: "Venus" }, { label: "B", text: "Earth" }, { label: "C", text: "Mercury" }, { label: "D", text: "Mars" }], timeLimit: 30 },
];

const TEAM_COLORS: TeamColor[] = ["blue", "red", "green", "yellow", "purple", "orange"];

class GameStore {
  private sessions: Map<string, GameSession> = new Map();

  createSession(adminSocketId: string, teamNames: string[], questions?: Question[]): GameSession {
    const id = this.generateId();
    const teams: Team[] = teamNames.map((name, i) => ({ id: `team-${i}`, name, color: TEAM_COLORS[i % TEAM_COLORS.length], score: 0 }));
    const session: GameSession = {
      id, teams, players: new Map(), questions: questions || DEFAULT_QUESTIONS,
      currentQuestionIndex: -1, status: "lobby", buzzedBy: null, adminSocketId,
      createdAt: Date.now(), miniGameType: null,
      numberSurvivalState: null, faceMergeState: null, mysteryPuzzleState: null,
    };
    this.sessions.set(id, session);
    logger.info({ sessionId: id, teams: teamNames }, "Game session created");
    return session;
  }

  getSession(id: string): GameSession | undefined { return this.sessions.get(id); }

  addPlayer(sessionId: string, socketId: string, name: string, teamId: string, avatar: string): Player | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "lobby") return null;
    const player: Player = { socketId, name, teamId, hasBuzzed: false, avatar, eliminated: false };
    session.players.set(socketId, player);
    logger.info({ sessionId, playerName: name, teamId }, "Player joined");
    return player;
  }

  removePlayer(socketId: string): { sessionId: string; player: Player } | null {
    for (const [sessionId, session] of this.sessions.entries()) {
      const player = session.players.get(socketId);
      if (player) {
        session.players.delete(socketId);
        logger.info({ sessionId, playerName: player.name }, "Player disconnected");
        return { sessionId, player };
      }
    }
    return null;
  }

  getSessionByAdmin(adminSocketId: string): GameSession | undefined {
    for (const s of this.sessions.values()) { if (s.adminSocketId === adminSocketId) return s; }
    return undefined;
  }

  getSessionByPlayer(socketId: string): GameSession | undefined {
    for (const s of this.sessions.values()) { if (s.players.has(socketId)) return s; }
    return undefined;
  }

  startGame(sessionId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s || s.status !== "lobby") return false;
    s.status = "playing";
    logger.info({ sessionId }, "Game started");
    return true;
  }

  nextQuestion(sessionId: string): Question | null {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    const next = s.currentQuestionIndex + 1;
    if (next >= s.questions.length) { s.status = "finished"; return null; }
    s.currentQuestionIndex = next;
    s.status = "question_active";
    s.buzzedBy = null;
    for (const p of s.players.values()) p.hasBuzzed = false;
    logger.info({ sessionId, questionIndex: next }, "Next question");
    return s.questions[next];
  }

  buzz(sessionId: string, socketId: string): BuzzEvent | null {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    if (s.status !== "question_active" && s.status !== "buzzer_active") return null;
    const player = s.players.get(socketId);
    if (!player || player.hasBuzzed) return null;
    player.hasBuzzed = true;
    if (s.buzzedBy) return null;
    const team = s.teams.find((t) => t.id === player.teamId);
    if (!team) return null;
    const buzzEvent: BuzzEvent = { playerId: socketId, playerName: player.name, teamId: team.id, teamName: team.name, timestamp: Date.now() };
    s.buzzedBy = buzzEvent;
    s.status = "buzzed";
    logger.info({ sessionId, playerName: player.name }, "Buzz accepted");
    return buzzEvent;
  }

  openBuzzer(sessionId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    s.status = "buzzer_active";
    s.buzzedBy = null;
    for (const p of s.players.values()) p.hasBuzzed = false;
    return true;
  }

  closeBuzzer(sessionId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    s.status = "playing";
    s.buzzedBy = null;
    for (const p of s.players.values()) p.hasBuzzed = false;
    return true;
  }

  awardPoint(sessionId: string, teamId: string): Team | null {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    const team = s.teams.find((t) => t.id === teamId);
    if (!team) return null;
    team.score += 1;
    s.status = "round_end";
    logger.info({ sessionId, teamName: team.name, newScore: team.score }, "Point awarded");
    return team;
  }

  skipQuestion(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.status = "round_end";
    s.buzzedBy = null;
  }

  endGame(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.status = "finished";
    logger.info({ sessionId }, "Game ended");
  }

  setQuestions(sessionId: string, questions: Question[]): boolean {
    const s = this.sessions.get(sessionId);
    if (!s || s.status !== "lobby") return false;
    s.questions = questions;
    return true;
  }

  initNumberSurvival(sessionId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    const allPlayerIds = new Set<string>();
    for (const [sid] of s.players) allPlayerIds.add(sid);
    s.miniGameType = "number_survival";
    s.numberSurvivalState = { round: 1, totalRounds: 3, phase: "selecting", roundSelections: new Map(), survivors: allPlayerIds, history: [] };
    return true;
  }

  initFaceMerge(sessionId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    s.miniGameType = "face_merge";
    s.faceMergeState = { phase: "setup", image1: null, image2: null };
    return true;
  }

  setFaceMergeImages(sessionId: string, image1: string, image2: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s || !s.faceMergeState) return false;
    s.faceMergeState.image1 = image1;
    s.faceMergeState.image2 = image2;
    s.faceMergeState.phase = "guessing";
    s.buzzedBy = null;
    for (const p of s.players.values()) p.hasBuzzed = false;
    return true;
  }

  revealFaceMerge(sessionId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s || !s.faceMergeState) return false;
    s.faceMergeState.phase = "revealed";
    return true;
  }

  initMysteryPuzzle(sessionId: string, story: string, clues: MysteryPuzzleClue[]): boolean {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    s.miniGameType = "mystery_puzzle";
    s.mysteryPuzzleState = {
      story, clues, currentClueIndex: -1, revealedClues: [],
      vaultCode: clues.map((c) => c.reward).join(""), vaultRevealed: false,
    };
    return true;
  }

  showMysteryClue(sessionId: string, clueIndex: number): boolean {
    const s = this.sessions.get(sessionId);
    if (!s || !s.mysteryPuzzleState) return false;
    const mp = s.mysteryPuzzleState;
    if (clueIndex < -1 || clueIndex >= mp.clues.length) return false;
    mp.currentClueIndex = clueIndex;
    return true;
  }

  revealMysteryAnswer(sessionId: string, clueIndex: number): boolean {
    const s = this.sessions.get(sessionId);
    if (!s || !s.mysteryPuzzleState) return false;
    const mp = s.mysteryPuzzleState;
    if (!mp.revealedClues.includes(clueIndex)) mp.revealedClues.push(clueIndex);
    return true;
  }

  revealMysteryVault(sessionId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s || !s.mysteryPuzzleState) return false;
    s.mysteryPuzzleState.vaultRevealed = true;
    return true;
  }

  resolveNumberRound(sessionId: string): RoundResult | null {
    const s = this.sessions.get(sessionId);
    if (!s || !s.numberSurvivalState) return null;
    const ns = s.numberSurvivalState;
    if (ns.phase !== "selecting") return null;
    ns.phase = "revealing";

    const numToSids = new Map<number, string[]>();
    for (const [sid, num] of ns.roundSelections) {
      if (!numToSids.has(num)) numToSids.set(num, []);
      numToSids.get(num)!.push(sid);
    }

    const eliminated: string[] = [];
    for (const [, sids] of numToSids) {
      if (sids.length > 1) {
        for (const sid of sids) {
          eliminated.push(sid); ns.survivors.delete(sid);
          const p = s.players.get(sid); if (p) p.eliminated = true;
        }
      }
    }
    for (const sid of [...ns.survivors]) {
      if (!ns.roundSelections.has(sid)) {
        eliminated.push(sid); ns.survivors.delete(sid);
        const p = s.players.get(sid); if (p) p.eliminated = true;
      }
    }

    const choices: RoundResult["choices"] = [];
    for (const [sid, num] of ns.roundSelections) {
      const player = s.players.get(sid);
      if (player) choices.push({ socketId: sid, name: player.name, teamId: player.teamId, avatar: player.avatar, number: num });
    }

    const survivorsByTeam: Record<string, number> = {};
    for (const team of s.teams) survivorsByTeam[team.id] = 0;
    for (const sid of ns.survivors) {
      const p = s.players.get(sid);
      if (p) survivorsByTeam[p.teamId] = (survivorsByTeam[p.teamId] || 0) + 1;
    }

    const result: RoundResult = { round: ns.round, choices, eliminated, survivorsByTeam };
    ns.history.push(result);
    if (ns.round >= ns.totalRounds || ns.survivors.size === 0) ns.phase = "done";
    return result;
  }

  advanceNumberRound(sessionId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s || !s.numberSurvivalState) return false;
    const ns = s.numberSurvivalState;
    if (ns.phase !== "revealing") return false;
    if (ns.round >= ns.totalRounds || ns.survivors.size === 0) { ns.phase = "done"; return false; }
    ns.round += 1; ns.phase = "selecting"; ns.roundSelections = new Map();
    return true;
  }

  getPublicState(sessionId: string) {
    const s = this.sessions.get(sessionId);
    if (!s) return null;

    const players: Record<string, { name: string; teamId: string; avatar: string }[]> = {};
    for (const team of s.teams) players[team.id] = [];
    for (const player of s.players.values()) {
      if (players[player.teamId]) players[player.teamId].push({ name: player.name, teamId: player.teamId, avatar: player.avatar });
    }

    const currentQuestion = s.currentQuestionIndex >= 0 ? s.questions[s.currentQuestionIndex] : null;
    let miniGameData: Record<string, unknown> | null = null;

    if (s.miniGameType === "number_survival" && s.numberSurvivalState) {
      const ns = s.numberSurvivalState;
      const teamSurvivors: Record<string, string[]> = {};
      for (const team of s.teams) teamSurvivors[team.id] = [];
      for (const sid of ns.survivors) { const p = s.players.get(sid); if (p) teamSurvivors[p.teamId].push(p.name); }
      const mySelection: Record<string, number> = {};
      for (const [sid, num] of ns.roundSelections) mySelection[sid] = num;
      miniGameData = {
        type: "number_survival", round: ns.round, totalRounds: ns.totalRounds, phase: ns.phase,
        selectedCount: ns.roundSelections.size, totalSurvivors: ns.survivors.size,
        teamSurvivors, history: ns.history, currentResult: ns.history[ns.history.length - 1] || null,
        mySelections: mySelection, survivorIds: [...ns.survivors],
      };
    } else if (s.miniGameType === "face_merge" && s.faceMergeState) {
      const fm = s.faceMergeState;
      miniGameData = { type: "face_merge", phase: fm.phase, image1: fm.image1, image2: fm.image2 };
    } else if (s.miniGameType === "mystery_puzzle" && s.mysteryPuzzleState) {
      const mp = s.mysteryPuzzleState;
      miniGameData = {
        type: "mystery_puzzle", story: mp.story, clues: mp.clues,
        currentClueIndex: mp.currentClueIndex, revealedClues: mp.revealedClues,
        vaultCode: mp.vaultCode, vaultRevealed: mp.vaultRevealed,
      };
    } else if (s.miniGameType === "pacman") {
      miniGameData = { type: "pacman" };
    }

    return {
      id: s.id, teams: s.teams, players, status: s.status, buzzedBy: s.buzzedBy,
      currentQuestion, currentQuestionIndex: s.currentQuestionIndex, totalQuestions: s.questions.length,
      miniGameType: s.miniGameType, miniGameData,
    };
  }

  private generateId(): string { return Math.random().toString(36).substring(2, 8).toUpperCase(); }
}

export const gameStore = new GameStore();
