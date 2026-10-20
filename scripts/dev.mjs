// `npm run dev` from the project root: starts everything needed for local development.
//
// 1. MongoDB — only if nothing is already listening on the configured port and
//    dev.config.json says where mongod.exe is. (Skip this by running MongoDB
//    yourself or by using Atlas in server/.env.)
// 2. The Express API   (npm run dev in server/)
// 3. The React app     (npm run dev in client/)
//
// Press Ctrl+C once to stop all of them.

import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configFile = path.join(root, "dev.config.json");
const config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, "utf8")) : {};
const mongoPort = config.mongoPort ?? 27017;

const COLORS = { db: "\x1b[35m", api: "\x1b[36m", web: "\x1b[32m" };
const children = [];

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => (socket.end(), resolve(true)));
    socket.once("error", () => resolve(false));
  });
}

// `command` is one shell command line (a shell is needed to find npm on Windows).
function run(name, command) {
  const child = spawn(command, { cwd: root, shell: true });
  const prefix = `${COLORS[name]}[${name}]\x1b[0m `;
  const pipe = (stream, out) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) out.write(prefix + line + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    if (!stopping) {
      console.log(`${prefix}exited with code ${code}. Stopping everything.`);
      stopAll(code ?? 1);
    }
  });
  children.push(child);
  return child;
}

let stopping = false;
function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    try {
      if (process.platform === "win32") execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
      else child.kill("SIGTERM");
    } catch {
      // already gone
    }
  }
  process.exit(code);
}
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

async function startMongo() {
  if (await portOpen(mongoPort)) {
    console.log(`${COLORS.db}[db]\x1b[0m MongoDB already running on port ${mongoPort}`);
    return;
  }
  if (!config.mongodPath) {
    console.log(
      `${COLORS.db}[db]\x1b[0m Nothing on port ${mongoPort} and no "mongodPath" in dev.config.json — ` +
        "assuming server/.env points to another database (e.g. Atlas).",
    );
    return;
  }
  fs.mkdirSync(config.dbPath, { recursive: true });
  // MongoDB's own (very chatty) log goes to a file next to the data folder.
  const logPath = path.join(path.dirname(config.dbPath), "mongod.log");
  run(
    "db",
    `"${config.mongodPath}" --dbpath "${config.dbPath}" --port ${mongoPort} --bind_ip 127.0.0.1 --logpath "${logPath}" --logappend`,
  );
  for (let i = 0; i < 60; i++) {
    if (await portOpen(mongoPort)) {
      console.log(`${COLORS.db}[db]\x1b[0m MongoDB ready on port ${mongoPort} (data: ${config.dbPath})`);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error("MongoDB did not start within 30 seconds.");
  stopAll(1);
}

await startMongo();
run("api", "npm run dev --prefix server");
run("web", "npm run dev --prefix client");
console.log("\n  Open http://localhost:5173 in your browser. Press Ctrl+C to stop.\n");
