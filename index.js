"use strict";

const express = require("express");
const Queue = require("bull");
const { createBullBoard } = require("@bull-board/api");
const { BullAdapter } = require("@bull-board/api/bullAdapter");
const { ExpressAdapter } = require("@bull-board/express");
const { Redis } = require("ioredis");

const PORT = 7712;

const redis = new Redis({
  host: "localhost",
  port: 6379,
  db: 1,
});

async function getQueueKeys() {
  try {
    const keys = await redis.keys("bull:*");
    return Array.from(new Set(keys.map((i) => i.split(":")[1])));
  } catch (err) {
    console.error("Error fetching keys:", err);
    throw err;
  } finally {
    redis.disconnect();
  }
}

(async () => {
  const app = express();
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/queues");
  const queueKeys = await getQueueKeys();
  console.log(queueKeys);
  const queues = queueKeys.map(
    (i) =>
      new BullAdapter(
        new Queue(i, {
          redis: { db: 1 },
        })
      )
  );
  const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
    queues,
    serverAdapter,
  });

  app.use("/queues", serverAdapter.getRouter());

  app.listen(PORT, () => {
    console.log(`Running on ${PORT}...`);
    console.log(`For the UI, open http://localhost:${PORT}/queues`);
    console.log("Make sure Redis is running on port 6379 by default");
  });
})();
