import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
const port = 4179;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
server.stdout.on("data", (x) => (logs += x));
server.stderr.on("data", (x) => (logs += x));
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    if (server.exitCode !== null) throw new Error(logs);
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(100);
  }
  assert.ok(ready, "preview server starts");
  for (const path of [
    "/",
    "/transactions",
    "/add",
    "/budgets",
    "/categories",
    "/settings",
  ]) {
    const r = await fetch(`http://127.0.0.1:${port}${path}`);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /id="root"/);
  }
  const manifest = await (
    await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`)
  ).json();
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.length, 3);
  for (const icon of manifest.icons) {
    const r = await fetch(`http://127.0.0.1:${port}${icon.src}`);
    assert.equal(r.status, 200);
    const bytes = new Uint8Array(await r.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
  const sw = await fetch(`http://127.0.0.1:${port}/sw.js`);
  assert.equal(sw.status, 200);
  assert.match(await sw.text(), /precacheAndRoute/);
  console.log(
    "PASS: six SPA routes, PWA manifest, three PNG icons and service worker. No database access.",
  );
} finally {
  server.kill("SIGTERM");
}
