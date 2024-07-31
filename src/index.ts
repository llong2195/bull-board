import express from "express";
import Queue from "bull";
import { createBullBoard } from "@bull-board/api";
import { BullAdapter } from "@bull-board/api/bullAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { Redis } from "ioredis";

const PORT = 7712;

const redisConfig = {
  host: "localhost",
  port: 6379,
  db: 1,
}; // Your Redis configuration

const redis = new Redis(redisConfig);

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
          redis: redisConfig,
        })
      )
  );

  // queues.map((queue) => {
  //   queue.addJob("__TESTING__", { foo: "bar" }, { delay: 10000 });
  //   queue.addJob("__TESTING__", { foo: "bar" }, { delay: 10000 });
  //   queue.addJob("__TESTING__", { foo: "bar" }, { delay: 10000 });
  //   queue.addJob("__TESTING__", { foo: "bar" }, { delay: 10000 });
  // });

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
