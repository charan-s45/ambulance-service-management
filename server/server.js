import { config } from "./config/env.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { createApp } from "./app.js";

async function start() {
  await connectDB(config.mongoUri);
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port} (${config.env})`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
