// Runs `next build` / `next start` with NODE_ENV=production, regardless of the
// hosting panel's NODE_ENV (a non-standard value mixes dev/prod React and breaks prerendering).
const { spawnSync } = require("child_process");

const result = spawnSync(
  process.execPath,
  [require.resolve("next/dist/bin/next"), ...process.argv.slice(2)],
  { stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } }
);
process.exit(result.status ?? 1);
