import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { gameStore, Question, MysteryPuzzleClue } from "./gameStore";
import { logger } from "./logger";

export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/api/socket.io",
  });

  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("admin:create_session", (data: { teamNames: string[]; questions?: Question[] }, cb) => {
      const session = gameStore.createSession(socket.id, data.teamNames, data.questions);
      socket.join(`session:${session.id}`);
      socket.join(`admin:${session.id}`);
      if (typeof cb === "function") cb({ sessionId: session.id, state: gameStore.getPublicState(session.id) });
      logger.info({ sessionId: session.id }, "Admin created session");
    });

    socket.on("admin:update_questions", (data: { sessionId: string; questions: Question[] }, cb) => {
      const success = gameStore.setQuestions(data.sessionId, data.questions);
      if (typeof cb === "function") cb({ success });
    });

    socket.on("admin:start_game", (data: { sessionId: string }) => {
      const started = gameStore.startGame(data.sessionId);
      if (!started) return;
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:started", state);
    });

    socket.on("admin:next_question", (data: { sessionId: string }) => {
      const question = gameStore.nextQuestion(data.sessionId);
      const state = gameStore.getPublicState(data.sessionId);
      if (!question) { io.to(`session:${data.sessionId}`).emit("game:finished", state); return; }
      io.to(`session:${data.sessionId}`).emit("game:question", { question, state });
    });

    socket.on("admin:show_question", (data: { sessionId: string; questionIndex: number }) => {
      const question = gameStore.showQuestion(data.sessionId, data.questionIndex);
      if (!question) return;
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:question", { question, state });
    });

    socket.on("admin:award_point", (data: { sessionId: string; teamId: string }) => {
      gameStore.awardPoint(data.sessionId, data.teamId);
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:score_update", state);
    });

    socket.on("admin:adjust_score", (data: { sessionId: string; teamId: string; delta: number }) => {
      const team = gameStore.adjustScore(data.sessionId, data.teamId, data.delta);
      if (!team) return;
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:score_update", state);
    });

    socket.on("admin:reset_round", (data: { sessionId: string }) => {
      const ok = gameStore.resetRound(data.sessionId);
      if (!ok) return;
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:round_reset", state);
    });

    socket.on("admin:skip_question", (data: { sessionId: string }) => {
      gameStore.skipQuestion(data.sessionId);
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:round_end", state);
    });

    socket.on("admin:end_game", (data: { sessionId: string }) => {
      gameStore.endGame(data.sessionId);
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:finished", state);
    });

    socket.on("admin:reset_buzz", (data: { sessionId: string }) => {
      const session = gameStore.getSession(data.sessionId);
      if (!session) return;
      session.buzzedBy = null;
      session.status = session.miniGameType ? "minigame" : "question_active";
      for (const player of session.players.values()) player.hasBuzzed = false;
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:buzz_reset", state);
    });

    socket.on("admin:open_buzzer", (data: { sessionId: string }) => {
      const ok = gameStore.openBuzzer(data.sessionId);
      if (!ok) return;
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:buzzer_opened", state);
    });

    socket.on("admin:close_buzzer", (data: { sessionId: string }) => {
      const ok = gameStore.closeBuzzer(data.sessionId);
      if (!ok) return;
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:buzzer_closed", state);
    });

    socket.on("player:join", (data: { sessionId: string; playerName: string; teamId: string; avatar?: string }, cb) => {
      const player = gameStore.addPlayer(data.sessionId, socket.id, data.playerName, data.teamId, data.avatar || "🎮");
      if (!player) {
        if (typeof cb === "function") cb({ success: false, error: "Could not join. Game may have already started." });
        return;
      }
      socket.join(`session:${data.sessionId}`);
      socket.join(`team:${data.sessionId}:${data.teamId}`);
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:player_joined", state);
      if (typeof cb === "function") cb({ success: true, state });
      logger.info({ sessionId: data.sessionId, playerName: data.playerName }, "Player joined");
    });

    socket.on("spectator:join", (data: { sessionId: string }, cb) => {
      const session = gameStore.getSession(data.sessionId);
      if (!session) {
        if (typeof cb === "function") cb({ success: false, error: "Session not found" });
        return;
      }
      socket.join(`session:${data.sessionId}`);
      const state = gameStore.getPublicState(data.sessionId);
      if (typeof cb === "function") cb({ success: true, state });
    });

    socket.on("player:buzz", (data: { sessionId: string }) => {
      const buzzEvent = gameStore.buzz(data.sessionId, socket.id);
      if (!buzzEvent) return;
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:buzzed", { buzzEvent, state });
      logger.info({ sessionId: data.sessionId, playerName: buzzEvent.playerName }, "Buzz event broadcast");
    });

    socket.on("session:get_state", (data: { sessionId: string }, cb) => {
      const state = gameStore.getPublicState(data.sessionId);
      if (typeof cb === "function") cb({ state });
    });

    socket.on("admin:start_minigame", (data: { sessionId: string; type: string; puzzleData?: { story: string; clues: MysteryPuzzleClue[] } }) => {
      const session = gameStore.getSession(data.sessionId);
      if (!session) return;
      session.status = "minigame";
      session.miniGameType = data.type;
      session.numberSurvivalState = null;
      session.faceMergeState = null;
      session.mysteryPuzzleState = null;

      if (data.type === "number_survival") {
        gameStore.initNumberSurvival(data.sessionId);
      } else if (data.type === "face_merge") {
        gameStore.initFaceMerge(data.sessionId);
      } else if (data.type === "mystery_puzzle" && data.puzzleData) {
        gameStore.initMysteryPuzzle(data.sessionId, data.puzzleData.story, data.puzzleData.clues);
      }

      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:minigame_started", state);
    });

    socket.on("admin:end_minigame", (data: { sessionId: string; winnerTeamId?: string }) => {
      const session = gameStore.getSession(data.sessionId);
      if (!session) return;
      if (data.winnerTeamId) gameStore.awardPoint(data.sessionId, data.winnerTeamId);
      session.status = "round_end";
      session.miniGameType = null;
      session.numberSurvivalState = null;
      session.faceMergeState = null;
      session.mysteryPuzzleState = null;
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:minigame_ended", state);
    });

    socket.on("pacman:direction", (data: { sessionId: string; teamId: string; direction: string }) => {
      io.to(`admin:${data.sessionId}`).emit("pacman:direction", { teamId: data.teamId, direction: data.direction });
    });

    socket.on("number:select", (data: { sessionId: string; number: number }) => {
      const session = gameStore.getSession(data.sessionId);
      if (!session || session.status !== "minigame" || session.miniGameType !== "number_survival") return;
      const ns = session.numberSurvivalState;
      if (!ns || ns.phase !== "selecting") return;
      const player = session.players.get(socket.id);
      if (!player || !ns.survivors.has(socket.id)) return;
      ns.roundSelections.set(socket.id, data.number);
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:number_update", state);
      if (ns.roundSelections.size >= ns.survivors.size) {
        const result = gameStore.resolveNumberRound(data.sessionId);
        if (result) {
          const newState = gameStore.getPublicState(data.sessionId);
          io.to(`session:${data.sessionId}`).emit("game:number_result", newState);
        }
      }
    });

    socket.on("admin:number_resolve", (data: { sessionId: string }) => {
      const result = gameStore.resolveNumberRound(data.sessionId);
      if (result) {
        const state = gameStore.getPublicState(data.sessionId);
        io.to(`session:${data.sessionId}`).emit("game:number_result", state);
      }
    });

    socket.on("admin:number_next_round", (data: { sessionId: string }) => {
      const ok = gameStore.advanceNumberRound(data.sessionId);
      const state = gameStore.getPublicState(data.sessionId);
      if (ok) io.to(`session:${data.sessionId}`).emit("game:number_next_round", state);
      else io.to(`session:${data.sessionId}`).emit("game:number_done", state);
    });

    socket.on("admin:face_merge_setup", (data: { sessionId: string; sets: Array<{ image1: string; image2: string; merged?: string | null }> }) => {
      if (!Array.isArray(data.sets) || data.sets.length === 0) return;
      const cleanSets = data.sets.map((s) => ({
        image1: s.image1,
        image2: s.image2,
        merged: s.merged ?? null,
      }));
      const ok = gameStore.setFaceMergeSets(data.sessionId, cleanSets);
      if (!ok) return;
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:face_merge_updated", state);
    });

    socket.on("admin:face_merge_next", (data: { sessionId: string }) => {
      const ok = gameStore.faceMergeNext(data.sessionId);
      if (!ok) return;
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:face_merge_updated", state);
    });

    socket.on("admin:face_merge_reveal", (data: { sessionId: string }) => {
      const ok = gameStore.revealFaceMerge(data.sessionId);
      if (!ok) return;
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:face_merge_updated", state);
    });

    socket.on("face_merge:buzz", (data: { sessionId: string }) => {
      const session = gameStore.getSession(data.sessionId);
      if (!session || session.miniGameType !== "face_merge") return;
      const fm = session.faceMergeState;
      if (!fm || fm.phase !== "guessing") return;
      const player = session.players.get(socket.id);
      if (!player || player.hasBuzzed) return;
      player.hasBuzzed = true;
      if (session.buzzedBy) return;
      const team = session.teams.find((t) => t.id === player.teamId);
      if (!team) return;
      session.buzzedBy = { playerId: socket.id, playerName: player.name, teamId: team.id, teamName: team.name, timestamp: Date.now() };
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:buzzed", { buzzEvent: session.buzzedBy, state });
    });

    socket.on("admin:mystery_show_clue", (data: { sessionId: string; clueIndex: number }) => {
      const ok = gameStore.showMysteryClue(data.sessionId, data.clueIndex);
      if (!ok) return;
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:mystery_updated", state);
    });

    socket.on("admin:mystery_reveal_answer", (data: { sessionId: string; clueIndex: number }) => {
      const ok = gameStore.revealMysteryAnswer(data.sessionId, data.clueIndex);
      if (!ok) return;
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:mystery_updated", state);
    });

    socket.on("admin:mystery_reveal_vault", (data: { sessionId: string }) => {
      const ok = gameStore.revealMysteryVault(data.sessionId);
      if (!ok) return;
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:mystery_updated", state);
    });

    socket.on("mystery:answer", (data: { sessionId: string; answer: string; clueIndex: number }) => {
      const session = gameStore.getSession(data.sessionId);
      if (!session) return;
      const player = session.players.get(socket.id);
      if (!player) return;
      io.to(`admin:${data.sessionId}`).emit("mystery:player_answer", {
        socketId: socket.id, name: player.name, teamId: player.teamId, avatar: player.avatar,
        answer: data.answer, clueIndex: data.clueIndex,
      });
    });

    socket.on("mystery:submit_code", (data: { sessionId: string; code: string }, ack?: (res: { ok: boolean; correct: boolean; reason?: string }) => void) => {
      const result = gameStore.submitMysteryCode(data.sessionId, socket.id, data.code);
      if (ack) ack({ ok: result.ok, correct: result.correct, reason: result.reason });
      if (!result.ok) return;
      const state = gameStore.getPublicState(data.sessionId);
      io.to(`session:${data.sessionId}`).emit("game:mystery_updated", state);
      if (result.correct && result.teamId) {
        gameStore.awardPoint(data.sessionId, result.teamId);
        const after = gameStore.getPublicState(data.sessionId);
        io.to(`session:${data.sessionId}`).emit("game:score_update", after);
      }
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Socket disconnected");
      const removed = gameStore.removePlayer(socket.id);
      if (removed) {
        const state = gameStore.getPublicState(removed.sessionId);
        io.to(`session:${removed.sessionId}`).emit("game:player_left", state);
      }
      const adminSession = gameStore.getSessionByAdmin(socket.id);
      if (adminSession) logger.info({ sessionId: adminSession.id }, "Admin disconnected");
    });
  });

  return io;
}
