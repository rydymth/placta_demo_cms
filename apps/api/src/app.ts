import express, { type Application } from "express";
import helmet from "helmet";
import { requestLogger } from "./middleware/logging.middleware.ts";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.ts";
import config from "./utils/config.ts";
import healthRoutes from "./routes/health.routes.ts";
import v1Routes from "./routes/v1.routes.ts";
import { connectDb, disconnectDb } from "./database/connection.ts";
import { initModels } from "./database/indexes.ts";

const app: Application = express();
app.disable("x-powered-by");
if (config.trustProxy) app.set("trust proxy", 1);
app.use(helmet());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.vary("Origin");
  if (origin && (origin === config.adminOrigin || origin === config.publicOrigin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Access-Control-Allow-Credentials", "true");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(origin && (origin === config.adminOrigin || origin === config.publicOrigin) ? 204 : 403);
    return;
  }
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);
app.use("/api", healthRoutes);
app.use("/api/v1", v1Routes);
app.use(notFoundHandler);
app.use(errorHandler);

async function start(): Promise<void> {
  config.jwtAccessSecret;
  await connectDb();
  await initModels();
  const server = app.listen(config.port, config.host, () => {
    console.info(`API listening on ${config.host}:${config.port}`);
  });
  const shutdown = () => {
    server.close(async () => {
      try { await disconnectDb(); }
      catch (err) { console.error("Database shutdown failed", err); process.exitCode = 1; }
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exitCode = 1;
});
