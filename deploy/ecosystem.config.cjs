/**
 * pm2 process description for ICDL With Mehrdad.
 *
 * One instance on purpose: the app keeps its data in a local SQLite file, which
 * allows a single writer. `next start` is launched through its binary rather
 * than `npm start` so signals (pm2 reload/stop) reach Next directly instead of
 * being swallowed by a shell wrapper.
 *
 * Bound to loopback — nginx is the only thing that should be reachable from
 * outside; the port must never be exposed on 0.0.0.0.
 */
const path = require("node:path");

const APP_DIR = process.env.APP_DIR || path.join(__dirname, "..");

module.exports = {
  apps: [
    {
      name: process.env.APP_NAME || "icdl",
      cwd: APP_DIR,
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "3000",
      },
    },
  ],
};
