const fs = require('fs');
const path = require('path');

try {
  // 1. Output directory compatibility:
  // When Vercel Turborepo detector expects apps/web/.next within apps/web,
  // ensure both .next and apps/web/.next exist.
  const sourceNext = path.resolve('.next');
  const targetDir = path.resolve('apps', 'web');
  const targetNextLink = path.resolve('apps', 'web', '.next');

  if (fs.existsSync(sourceNext) && !fs.existsSync(targetNextLink)) {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.symlinkSync(sourceNext, targetNextLink, 'junction');
    console.log('[postbuild] Created compatibility link for Vercel at:', targetNextLink);
  }

  // 2. pnpm monorepo virtual store compatibility:
  // When a Vercel project's Root Directory is configured as apps/web,
  // Next.js outputFileTracing traces to ../../node_modules/.pnpm.
  // Linking root node_modules/.pnpm into apps/web/node_modules/.pnpm allows Vercel's
  // file tracer to resolve hoisted packages without ENOENT errors.
  const rootPnpm = path.resolve('..', '..', 'node_modules', '.pnpm');
  const localNodeModules = path.resolve('node_modules');
  const localPnpm = path.resolve('node_modules', '.pnpm');

  if (fs.existsSync(rootPnpm) && !fs.existsSync(localPnpm)) {
    if (!fs.existsSync(localNodeModules)) {
      fs.mkdirSync(localNodeModules, { recursive: true });
    }
    fs.symlinkSync(rootPnpm, localPnpm, 'junction');
    console.log('[postbuild] Created pnpm virtual store link at:', localPnpm);
  }

  // 3. Double-nested node_modules compatibility (for apps/web/apps/web/node_modules):
  const nestedNodeModules = path.resolve(targetDir, 'node_modules');
  if (fs.existsSync(targetDir) && !fs.existsSync(nestedNodeModules)) {
    try {
      fs.symlinkSync(localNodeModules, nestedNodeModules, 'junction');
      console.log('[postbuild] Created nested node_modules link at:', nestedNodeModules);
    } catch (e) {
      console.warn('[postbuild] Notice on nested node_modules:', e.message);
    }
  }
} catch (err) {
  console.warn('[postbuild] Notice:', err.message);
}

