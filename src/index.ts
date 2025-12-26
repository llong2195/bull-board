import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { Queue as QueueMQ } from "bullmq";
import dotenv from "dotenv";
import express from "express";
import { Redis, RedisOptions } from "ioredis";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 7712;

interface BoardConfig {
  router: string;
  redisConfig: RedisOptions;
  readOnlyMode?: boolean;
}

// Parse board configurations from environment
function loadBoardConfigs(): BoardConfig[] {
  const configs: BoardConfig[] = [];
  let idx = 1;

  // Read individual BOARD_ROUTER_N variables
  while (process.env[`BOARD_ROUTER_${idx}`]) {
    const router = process.env[`BOARD_ROUTER_${idx}`];
    configs.push({
      router: router!,
      redisConfig: {
        host: process.env[`REDIS_HOST_${idx}`] || "localhost",
        port: parseInt(process.env[`REDIS_PORT_${idx}`] || "6379"),
        db: parseInt(process.env[`REDIS_DB_${idx}`] || String(idx)),
        password: process.env[`REDIS_PASSWORD_${idx}`],
      },
      readOnlyMode: process.env[`READ_ONLY_MODE_${idx}`] === "true",
    });
    idx++;
  }

  // Default configs if none provided
  if (configs.length === 0) {
    configs.push(
      {
        router: "/board1",
        redisConfig: { host: "localhost", port: 6379, db: 1 },
        readOnlyMode: false,
      },
      {
        router: "/board2",
        redisConfig: { host: "localhost", port: 6379, db: 2 },
        readOnlyMode: false,
      },
    );
  }

  return configs;
}

const boardConfigs = loadBoardConfigs();

async function getQueueKeys(redisConfig: RedisOptions): Promise<string[]> {
  const redis = new Redis(redisConfig);
  try {
    const keys = await redis.keys("bull:*");
    return [...new Set(keys.map((key) => key.split(":")[1]))].sort();
  } catch (err) {
    console.error("Error fetching queue keys:", err);
    return [];
  } finally {
    await redis.quit();
  }
}

(async () => {
  try {
    const app = express();

    console.log(`Loading ${boardConfigs.length} board configuration(s)...`);

    // Setup each Bull Board instance
    for (const config of boardConfigs) {
      const serverAdapter = new ExpressAdapter();
      serverAdapter.setBasePath(config.router);

      const queueKeys = await getQueueKeys(config.redisConfig);
      console.log(
        `[${config.router}] Found ${queueKeys.length} queue(s):`,
        queueKeys,
      );

      const queues = queueKeys.map(
        (name) =>
          new BullMQAdapter(
            new QueueMQ(name, { connection: config.redisConfig }),
            { readOnlyMode: config.readOnlyMode },
          ),
      );

      createBullBoard({ queues, serverAdapter });
      app.use(config.router, serverAdapter.getRouter());
    }

    app.use("/healthz",(_req, res) => {
      res.status(200).send("OK");
    });

    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📊 Bull Board UIs:`);
      boardConfigs.forEach((cfg) => {
        const mode = cfg.readOnlyMode ? "[READ-ONLY]" : "";
        console.log(`   • http://localhost:${PORT}${cfg.router} ${mode}`);
      });
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
})();
