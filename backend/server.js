process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "16";

const cluster = require("cluster");
const os = require("os");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const migrate = require("./scripts/migrate");

const cpuCount = os.availableParallelism ? os.availableParallelism() : os.cpus().length;
const workerCount = Number(process.env.WEB_CONCURRENCY || 1);
const totalDbPoolMax = Number(process.env.DB_TOTAL_POOL_MAX || 80);
const dbPoolMaxPerWorker = process.env.DB_POOL_MAX
  || String(Math.max(5, Math.floor(totalDbPoolMax / Math.max(workerCount, 1))));

function workerEnv(runScheduledJobs) {
  return {
    WEB_CONCURRENCY: String(workerCount),
    DB_POOL_MAX: dbPoolMaxPerWorker,
    RUN_SCHEDULED_JOBS: runScheduledJobs ? "1" : "0",
  };
}

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.use("/api/auth", require("./src/routes/authRoutes"));
  app.use("/api/recipient", require("./src/routes/recipientRoutes"));
  app.use("/api/food", require("./src/routes/foodRoutes"));
  app.use("/api/user", require("./src/routes/userRoutes"));
  app.use("/api/admin", require("./src/routes/adminRoutes"));
  app.use("/api/analytics", require("./src/routes/analyticsRoutes"));

  if (process.env.RUN_SCHEDULED_JOBS !== "0") {
    const updateExpiredFood = require("./utils/foodExpiryUpdater");

    setInterval(() => {
      updateExpiredFood({ force: true });
    }, 60 * 1000);
  }

  return app;
}

async function startWorker({ runMigration = false } = {}) {
  if (runMigration) {
    await migrate();
  }

  const app = createApp();
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    const label = cluster.isWorker ? `worker ${process.pid}` : "single process";
    console.log(`Server running on port ${PORT} (${label})`);
  });
}

async function startPrimary() {
  await migrate();

  try {
    for (let i = 0; i < workerCount; i++) {
      cluster.fork(workerEnv(i === 0));
    }
  } catch (err) {
    console.error("Cluster startup failed. Falling back to single process:", err.message);
    process.env.RUN_SCHEDULED_JOBS = "1";
    await startWorker({ runMigration: false });
    return;
  }

  console.log(`Primary ${process.pid} running ${workerCount} workers with DB_POOL_MAX=${dbPoolMaxPerWorker} per worker`);

  cluster.on("exit", (worker) => {
    console.error(`Worker ${worker.process.pid} exited. Starting replacement.`);
    cluster.fork(workerEnv(false));
  });
}

const startup = cluster.isPrimary && workerCount > 1
  ? startPrimary()
  : startWorker({ runMigration: !cluster.isWorker });

startup.catch((err) => {
  console.error("Server startup error:", err);
  process.exit(1);
});
