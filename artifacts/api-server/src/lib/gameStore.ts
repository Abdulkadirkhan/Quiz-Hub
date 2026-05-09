import { logger } from "./logger";

export type TeamColor = "blue" | "red" | "green" | "yellow" | "purple" | "orange";

export interface Team { id: string; name: string; color: TeamColor; score: number; }
export interface Player {
  socketId: string;
  playerKey: string;
  name: string;
  teamId: string;
  hasBuzzed: boolean;
  avatar: string;
  eliminated: boolean;
  connected: boolean;
}
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

export interface FaceMergeSet {
  image1: string;
  image2: string;
  merged: string | null;
}

export interface FaceMergeState {
  phase: "guessing" | "revealed" | "done";
  sets: FaceMergeSet[];
  currentSetIndex: number;
}

export interface MysteryPuzzleClue { question: string; answer: string; reward: string; }

export interface PacManPlayer {
  socketId: string;
  playerKey: string;
  name: string;
  teamId: string;
  color: string;
  avatar: string;
  x: number; y: number;
  dir: { x: number; y: number };
  nextDir: { x: number; y: number };
  score: number;
  mouthOpen: boolean;
}

export interface PacManState {
  walls: boolean[][];
  pellets: boolean[][];
  players: Map<string, PacManPlayer>; // keyed by playerKey
  startedAt: number;
  endsAt: number;
  durationSec: number;
  ended: boolean;
  cols: number; rows: number;
}

export interface MysteryPuzzleAttempt {
  code: string;
  correct: boolean;
  timestamp: number;
  playerName: string;
  teamId: string;
}

export interface MysteryPuzzleState {
  story: string; clues: MysteryPuzzleClue[];
  currentClueIndex: number; revealedClues: number[];
  vaultCode: string; vaultRevealed: boolean;
  solverByTeam: Record<string, string>;          // teamId -> solver socketId
  solverNamesByTeam: Record<string, string>;     // teamId -> solver display name
  attempts: MysteryPuzzleAttempt[];
  winnerTeamId: string | null;
}

export interface GameSession {
  id: string; teams: Team[]; players: Map<string, Player>; questions: Question[];
  currentQuestionIndex: number; status: GameStatus; buzzedBy: BuzzEvent | null;
  adminSocketId: string | null; createdAt: number; miniGameType: string | null;
  numberSurvivalState: NumberSurvivalState | null;
  faceMergeState: FaceMergeState | null;
  mysteryPuzzleState: MysteryPuzzleState | null;
  pacmanState: PacManState | null;
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
      pacmanState: null,
    };
    this.sessions.set(id, session);
    logger.info({ sessionId: id, teams: teamNames }, "Game session created");
    return session;
  }

  getSession(id: string): GameSession | undefined { return this.sessions.get(id); }

  // Join or rejoin a player. If a player with the same playerKey already exists in the session,
  // we reattach them to the new socket (preserves score/eliminated/etc.). Otherwise we create a new player.
  // Allowed at any session status — game-in-progress reconnect works seamlessly.
  addPlayer(sessionId: string, socketId: string, playerKey: string, name: string, teamId: string, avatar: string): Player | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Try to find existing player by playerKey (rejoin path)
    for (const [oldSocketId, existing] of session.players) {
      if (existing.playerKey === playerKey) {
        // Move record to new socket id, freshen the connection
        session.players.delete(oldSocketId);
        const updated: Player = { ...existing, socketId, name: name || existing.name, avatar: avatar || existing.avatar, teamId: existing.teamId, connected: true };
        session.players.set(socketId, updated);
        // If they were the Mystery Puzzle solver, update solver mapping to the new socketId
        if (session.mysteryPuzzleState && session.mysteryPuzzleState.solverByTeam[updated.teamId] === oldSocketId) {
          session.mysteryPuzzleState.solverByTeam[updated.teamId] = socketId;
        }
        logger.info({ sessionId, playerName: updated.name, teamId: updated.teamId }, "Player rejoined");
        return updated;
      }
    }

    // New player
    const player: Player = { socketId, playerKey, name, teamId, hasBuzzed: false, avatar, eliminated: false, connected: true };
    session.players.set(socketId, player);
    logger.info({ sessionId, playerName: name, teamId }, "Player joined");
    return player;
  }

  // Marks a player disconnected on socket disconnect, but keeps the record so they can rejoin
  // with the same playerKey and resume their state.
  removePlayer(socketId: string): { sessionId: string; player: Player } | null {
    for (const [sessionId, session] of this.sessions.entries()) {
      const player = session.players.get(socketId);
      if (player) {
        player.connected = false;
        logger.info({ sessionId, playerName: player.name }, "Player disconnected (record kept for rejoin)");
        return { sessionId, player };
      }
    }
    return null;
  }

  // Permanently delete a player (e.g., they tapped "Leave Game"). Cleans up references.
  leavePlayer(socketId: string): { sessionId: string; player: Player } | null {
    for (const [sessionId, session] of this.sessions.entries()) {
      const player = session.players.get(socketId);
      if (player) {
        session.players.delete(socketId);
        // Clean up Mystery Puzzle solver references
        if (session.mysteryPuzzleState && session.mysteryPuzzleState.solverByTeam[player.teamId] === socketId) {
          delete session.mysteryPuzzleState.solverByTeam[player.teamId];
          delete session.mysteryPuzzleState.solverNamesByTeam[player.teamId];
        }
        logger.info({ sessionId, playerName: player.name }, "Player left game (record removed)");
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

  showQuestion(sessionId: string, index: number): Question | null {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    if (index < 0 || index >= s.questions.length) return null;
    s.currentQuestionIndex = index;
    s.status = "question_active";
    s.buzzedBy = null;
    s.miniGameType = null;
    s.numberSurvivalState = null;
    s.faceMergeState = null;
    s.mysteryPuzzleState = null;
    s.pacmanState = null;
    for (const p of s.players.values()) p.hasBuzzed = false;
    logger.info({ sessionId, questionIndex: index }, "Show specific question");
    return s.questions[index];
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

  adjustScore(sessionId: string, teamId: string, delta: number): Team | null {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    const team = s.teams.find((t) => t.id === teamId);
    if (!team) return null;
    team.score = Math.max(0, team.score + delta);
    logger.info({ sessionId, teamName: team.name, delta, newScore: team.score }, "Score adjusted");
    return team;
  }

  resetRound(sessionId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    s.currentQuestionIndex = -1;
    s.status = "playing";
    s.buzzedBy = null;
    s.miniGameType = null;
    s.numberSurvivalState = null;
    s.faceMergeState = null;
    s.mysteryPuzzleState = null;
    s.pacmanState = null;
    for (const p of s.players.values()) p.hasBuzzed = false;
    logger.info({ sessionId }, "Round reset to live screen");
    return true;
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
    s.faceMergeState = { phase: "guessing", sets: [], currentSetIndex: 0 };
    return true;
  }

  setFaceMergeSets(sessionId: string, sets: FaceMergeSet[]): boolean {
    const s = this.sessions.get(sessionId);
    if (!s || !s.faceMergeState) return false;
    if (sets.length === 0) return false;
    s.faceMergeState.sets = sets;
    s.faceMergeState.currentSetIndex = 0;
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

  faceMergeNext(sessionId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s || !s.faceMergeState) return false;
    const fm = s.faceMergeState;
    if (fm.currentSetIndex + 1 >= fm.sets.length) {
      fm.phase = "done";
      return true;
    }
    fm.currentSetIndex += 1;
    fm.phase = "guessing";
    s.buzzedBy = null;
    for (const p of s.players.values()) p.hasBuzzed = false;
    return true;
  }

  initMysteryPuzzle(sessionId: string, story: string, clues: MysteryPuzzleClue[]): boolean {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    s.miniGameType = "mystery_puzzle";

    // Pick a random solver per team from currently joined players
    const solverByTeam: Record<string, string> = {};
    const solverNamesByTeam: Record<string, string> = {};
    for (const team of s.teams) {
      const teamPlayers: { sid: string; name: string }[] = [];
      for (const [sid, p] of s.players) {
        if (p.teamId === team.id) teamPlayers.push({ sid, name: p.name });
      }
      if (teamPlayers.length > 0) {
        const pick = teamPlayers[Math.floor(Math.random() * teamPlayers.length)];
        solverByTeam[team.id] = pick.sid;
        solverNamesByTeam[team.id] = pick.name;
      }
    }

    s.mysteryPuzzleState = {
      story, clues, currentClueIndex: -1, revealedClues: [],
      vaultCode: clues.map((c) => c.reward).join(""),
      vaultRevealed: false,
      solverByTeam, solverNamesByTeam,
      attempts: [],
      winnerTeamId: null,
    };
    return true;
  }

  submitMysteryCode(sessionId: string, socketId: string, code: string): { ok: boolean; correct: boolean; reason?: string; teamId?: string; playerName?: string } {
    const s = this.sessions.get(sessionId);
    if (!s || !s.mysteryPuzzleState) return { ok: false, correct: false, reason: "No active puzzle" };
    const mp = s.mysteryPuzzleState;
    if (mp.winnerTeamId) return { ok: false, correct: false, reason: "Already solved" };
    const player = s.players.get(socketId);
    if (!player) return { ok: false, correct: false, reason: "Not joined" };
    if (mp.solverByTeam[player.teamId] !== socketId) {
      return { ok: false, correct: false, reason: "Only the chosen solver can submit" };
    }
    const trimmed = code.trim();
    const correct = trimmed === mp.vaultCode;
    mp.attempts.push({
      code: trimmed, correct, timestamp: Date.now(),
      playerName: player.name, teamId: player.teamId,
    });
    if (correct) {
      mp.winnerTeamId = player.teamId;
      mp.vaultRevealed = true;
    }
    return { ok: true, correct, teamId: player.teamId, playerName: player.name };
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
      if (sids.length <= 1) continue;
      // Group these picks by team — same-team duplicates are SAFE; only cross-team collisions eliminate
      const teamsHit = new Set<string>();
      for (const sid of sids) {
        const p = s.players.get(sid);
        if (p) teamsHit.add(p.teamId);
      }
      if (teamsHit.size <= 1) continue; // all from same team -> nobody eliminated
      // Multiple teams collided on this number -> eliminate everyone who picked it
      for (const sid of sids) {
        eliminated.push(sid); ns.survivors.delete(sid);
        const p = s.players.get(sid); if (p) p.eliminated = true;
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

  // -------- PAC-MAN (server-authoritative, multi-player) --------

  private buildPacManMaze(): { walls: boolean[][]; pellets: boolean[][]; cols: number; rows: number } {
    const TEMPLATE = [
      "#####################",
      "#........#..........#",
      "#.##.###.#.###.##.###",
      "#...................#",
      "#.##.#.#####.#.##.##",
      "#....#...#...#....##",
      "####.###.#.###.#####",
      "#....#.......#.....#",
      "#.##.#.#####.#.##.##",
      "#...................#",
      "#.##.###.#.###.##.###",
      "#........#..........#",
      "#.##.###.#.###.##.###",
      "#...................#",
      "#.##.#.#####.#.##.##",
      "#....#...#...#....##",
      "#...................#",
      "#........#..........#",
      "#####################",
    ];
    const rows = TEMPLATE.length;
    const cols = 21;
    const walls: boolean[][] = [];
    const pellets: boolean[][] = [];
    for (let r = 0; r < rows; r++) {
      const wallRow: boolean[] = [];
      const pelletRow: boolean[] = [];
      const rowStr = (TEMPLATE[r] || "#####################").padEnd(cols, "#");
      for (let c = 0; c < cols; c++) {
        const ch = rowStr[c];
        wallRow.push(ch === "#");
        pelletRow.push(ch === ".");
      }
      walls.push(wallRow);
      pellets.push(pelletRow);
    }
    return { walls, pellets, cols, rows };
  }

  private pickPacManSpawnPositions(walls: boolean[][], cols: number, rows: number, n: number): { x: number; y: number }[] {
    const candidates: { x: number; y: number }[] = [];
    const seeds = [
      { x: 1, y: 1 }, { x: cols - 2, y: 1 }, { x: 1, y: rows - 2 }, { x: cols - 2, y: rows - 2 },
      { x: Math.floor(cols / 2), y: 1 }, { x: Math.floor(cols / 2), y: rows - 2 },
      { x: 1, y: Math.floor(rows / 2) }, { x: cols - 2, y: Math.floor(rows / 2) },
      { x: 3, y: 3 }, { x: cols - 4, y: 3 }, { x: 3, y: rows - 4 }, { x: cols - 4, y: rows - 4 },
      { x: 7, y: 5 }, { x: cols - 8, y: 5 }, { x: 7, y: rows - 6 }, { x: cols - 8, y: rows - 6 },
    ];
    const isOpen = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < cols && y < rows && !walls[y]?.[x];
    for (const s of seeds) {
      if (isOpen(s.x, s.y) && !candidates.some((c) => c.x === s.x && c.y === s.y)) candidates.push(s);
    }
    if (candidates.length < n) {
      for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
          if (isOpen(x, y) && !candidates.some((c) => c.x === x && c.y === y)) candidates.push({ x, y });
          if (candidates.length >= n + 8) break;
        }
        if (candidates.length >= n + 8) break;
      }
    }
    return candidates.slice(0, n);
  }

  private static PAC_COLORS = [
    "#facc15", "#fb923c", "#f87171", "#f472b6", "#a78bfa", "#60a5fa", "#22d3ee", "#4ade80",
    "#f97316", "#ef4444", "#ec4899", "#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#eab308",
  ];

  initPacMan(sessionId: string, durationSec = 30): boolean {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    s.miniGameType = "pacman";
    const { walls, pellets, cols, rows } = this.buildPacManMaze();
    const playerEntries = [...s.players.values()].filter((p) => p.connected);
    const spawns = this.pickPacManSpawnPositions(walls, cols, rows, playerEntries.length);
    const players = new Map<string, PacManPlayer>();
    playerEntries.forEach((p, i) => {
      const pos = spawns[i] ?? { x: 1, y: 1 };
      const color = GameStore.PAC_COLORS[i % GameStore.PAC_COLORS.length];
      players.set(p.playerKey, {
        socketId: p.socketId, playerKey: p.playerKey, name: p.name, teamId: p.teamId,
        avatar: p.avatar, color,
        x: pos.x, y: pos.y, dir: { x: 0, y: 0 }, nextDir: { x: 0, y: 0 },
        score: 0, mouthOpen: true,
      });
    });
    const now = Date.now();
    s.pacmanState = {
      walls, pellets, players, cols, rows,
      startedAt: now, endsAt: now + durationSec * 1000,
      durationSec, ended: false,
    };
    return true;
  }

  pacmanSetDirection(sessionId: string, socketId: string, dir: { x: number; y: number }): boolean {
    const s = this.sessions.get(sessionId);
    if (!s || !s.pacmanState || s.pacmanState.ended) return false;
    const player = s.players.get(socketId);
    if (!player) return false;
    const pm = s.pacmanState.players.get(player.playerKey);
    if (!pm) return false;
    pm.nextDir = dir;
    return true;
  }

  pacmanTick(sessionId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s || !s.pacmanState || s.pacmanState.ended) return false;
    const pm = s.pacmanState;
    const tryMove = (x: number, y: number, dir: { x: number; y: number }): { x: number; y: number } | null => {
      if (dir.x === 0 && dir.y === 0) return null;
      const nx = x + dir.x; const ny = y + dir.y;
      if (nx < 0 || ny < 0 || nx >= pm.cols || ny >= pm.rows) return null;
      if (pm.walls[ny]?.[nx]) return null;
      return { x: nx, y: ny };
    };
    for (const p of pm.players.values()) {
      const tryNext = tryMove(p.x, p.y, p.nextDir);
      if (tryNext) {
        p.dir = { ...p.nextDir };
        p.x = tryNext.x; p.y = tryNext.y;
      } else {
        const tryCur = tryMove(p.x, p.y, p.dir);
        if (tryCur) { p.x = tryCur.x; p.y = tryCur.y; }
        else continue;
      }
      if (pm.pellets[p.y]?.[p.x]) {
        pm.pellets[p.y][p.x] = false;
        p.score += 1;
      }
      p.mouthOpen = !p.mouthOpen;
    }
    let pelletCount = 0;
    for (const row of pm.pellets) for (const v of row) if (v) pelletCount++;
    if (pelletCount === 0) {
      const fresh = this.buildPacManMaze();
      pm.pellets = fresh.pellets;
    }
    if (Date.now() >= pm.endsAt) pm.ended = true;
    return true;
  }

  pacmanFinish(sessionId: string): { teamScores: Record<string, number>; winnerTeamId: string | null } | null {
    const s = this.sessions.get(sessionId);
    if (!s || !s.pacmanState) return null;
    const pm = s.pacmanState;
    pm.ended = true;
    const teamScores: Record<string, number> = {};
    for (const t of s.teams) teamScores[t.id] = 0;
    for (const p of pm.players.values()) teamScores[p.teamId] = (teamScores[p.teamId] || 0) + p.score;
    let best = -1; let winnerTeamId: string | null = null; let tied = false;
    for (const [tid, sc] of Object.entries(teamScores)) {
      if (sc > best) { best = sc; winnerTeamId = tid; tied = false; }
      else if (sc === best) { tied = true; }
    }
    return { teamScores, winnerTeamId: tied ? null : winnerTeamId };
  }

  // -------- end PAC-MAN --------

  getPublicState(sessionId: string) {
    const s = this.sessions.get(sessionId);
    if (!s) return null;

    const players: Record<string, { name: string; teamId: string; avatar: string; connected: boolean }[]> = {};
    for (const team of s.teams) players[team.id] = [];
    for (const player of s.players.values()) {
      if (players[player.teamId]) players[player.teamId].push({ name: player.name, teamId: player.teamId, avatar: player.avatar, connected: player.connected });
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
      const cur = fm.sets[fm.currentSetIndex] ?? null;
      miniGameData = {
        type: "face_merge",
        phase: fm.phase,
        setIndex: fm.currentSetIndex,
        totalSets: fm.sets.length,
        image1: cur?.image1 ?? null,
        image2: cur?.image2 ?? null,
        merged: cur?.merged ?? null,
      };
    } else if (s.miniGameType === "mystery_puzzle" && s.mysteryPuzzleState) {
      const mp = s.mysteryPuzzleState;
      miniGameData = {
        type: "mystery_puzzle", story: mp.story, clues: mp.clues,
        currentClueIndex: mp.currentClueIndex, revealedClues: mp.revealedClues,
        vaultCode: mp.vaultCode, vaultRevealed: mp.vaultRevealed,
        solverByTeam: mp.solverByTeam, solverNamesByTeam: mp.solverNamesByTeam,
        attempts: mp.attempts, winnerTeamId: mp.winnerTeamId,
      };
    } else if (s.miniGameType === "pacman" && s.pacmanState) {
      const pm = s.pacmanState;
      const players: Array<{ playerKey: string; name: string; teamId: string; color: string; avatar: string; x: number; y: number; dir: { x: number; y: number }; score: number; mouthOpen: boolean }> = [];
      for (const p of pm.players.values()) {
        players.push({ playerKey: p.playerKey, name: p.name, teamId: p.teamId, color: p.color, avatar: p.avatar, x: p.x, y: p.y, dir: p.dir, score: p.score, mouthOpen: p.mouthOpen });
      }
      const teamScores: Record<string, number> = {};
      for (const t of s.teams) teamScores[t.id] = 0;
      for (const p of pm.players.values()) teamScores[p.teamId] += p.score;
      const remainingMs = Math.max(0, pm.endsAt - Date.now());
      miniGameData = {
        type: "pacman",
        cols: pm.cols, rows: pm.rows,
        walls: pm.walls, pellets: pm.pellets,
        players, teamScores,
        durationSec: pm.durationSec,
        remainingMs, ended: pm.ended,
      };
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
