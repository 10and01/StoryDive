import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const wrangler = process.platform === "win32"
  ? path.join(root, "..", "node_modules", ".bin", "wrangler.exe")
  : path.join(root, "..", "node_modules", ".bin", "wrangler");
const command = process.argv.includes("--upload") ? "versions upload" : "deploy";
const args = command.split(" ");
const result = spawnSync(wrangler, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, OPEN_NEXT_DEPLOY: "true" },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
