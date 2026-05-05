import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// API routes mounted under /api
app.use("/api", router);

// Resolve the path to the built frontend.
// In production, esbuild bundles api-server into a single .mjs file at dist/index.mjs,
// so __dirname (set by the esbuild banner) is .../artifacts/api-server/dist.
// The built frontend is at .../artifacts/quiz-buzzer/dist/public.
const here =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const candidatePaths = [
  // When running compiled output: artifacts/api-server/dist -> ../../quiz-buzzer/dist/public
  path.resolve(here, "..", "..", "quiz-buzzer", "dist", "public"),
  // Fallback for other layouts (e.g. if frontend is copied next to backend)
  path.resolve(here, "..", "public"),
  path.resolve(here, "public"),
];
const frontendDist = candidatePaths.find((p) =>
  fs.existsSync(path.join(p, "index.html")),
);

if (frontendDist) {
  logger.info({ frontendDist }, "Serving static frontend");
  app.use(express.static(frontendDist, { maxAge: "1h", index: false }));

  // SPA fallback: any non-/api route returns index.html
  app.get(/^\/(?!api\/).*/, (_req: Request, res: Response, next: NextFunction) => {
    res.sendFile(path.join(frontendDist, "index.html"), (err) => {
      if (err) next(err);
    });
  });
} else {
  logger.warn(
    { searched: candidatePaths },
    "Frontend build not found; only /api routes will be served",
  );
}

export default app;
