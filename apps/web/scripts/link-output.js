const fs = require('fs');
const path = require('path');

// Fix for Vercel monorepo deployment:
// When Vercel Root Directory is set to apps/web AND Output Directory is overridden to apps/web/.next,
// Vercel searches for the Next.js output at /vercel/path0/apps/web/apps/web/.next.
// Next.js normally outputs to /vercel/path0/apps/web/.next.
// This script creates a symlink/junction/copy from apps/web/.next to .next so Vercel
// succeeds regardless of whether Output Directory is set to .next or apps/web/.next.

const rootWebDir = path.resolve(__dirname, '..');
const nextDir = path.join(rootWebDir, '.next');
const nestedAppsWeb = path.join(rootWebDir, 'apps', 'web');
const nestedNextDir = path.join(nestedAppsWeb, '.next');

if (fs.existsSync(nextDir)) {
  try {
    if (!fs.existsSync(nestedAppsWeb)) {
      fs.mkdirSync(nestedAppsWeb, { recursive: true });
    }
    if (!fs.existsSync(nestedNextDir)) {
      try {
        fs.symlinkSync(nextDir, nestedNextDir, 'junction');
        console.log('[link-output] Created output symlink: apps/web/.next -> .next');
      } catch (symErr) {
        fs.cpSync(nextDir, nestedNextDir, { recursive: true });
        console.log('[link-output] Copied output to apps/web/.next');
      }
    } else {
      console.log('[link-output] Output path apps/web/.next already exists');
    }
  } catch (err) {
    console.warn('[link-output] Note: Could not create output fallback link:', err);
  }
}
