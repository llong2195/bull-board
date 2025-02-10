import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
// import { BullAdapter } from "@bull-board/api/bullAdapter";
import { ExpressAdapter } from "@bull-board/express";
import Queue from "bull";
import { Queue as QueueMQ } from "bullmq";
import dotenv from "dotenv";
import express from "express";
import { Redis, RedisOptions } from "ioredis";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 7712;

const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  db: parseInt(process.env.REDIS_DB || "1"),
  password: process.env.REDIS_PASSWORD,
}; // Your Redis configuration

const redis = new Redis(redisConfig);

const createQueueMQ = (name: string) =>
  new QueueMQ(name, { connection: redisConfig });

const createQueue = (name: string) => new Queue(name, { redis: redisConfig });

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

  const queues = queueKeys.map((i) => new BullMQAdapter(createQueueMQ(i)));
  // const queues = queueKeys.map((i) => new BullAdapter(createQueue(i)));

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
