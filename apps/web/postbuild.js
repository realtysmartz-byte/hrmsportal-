const fs = require('fs');
const path = require('path');

try {
  const targetDir = path.resolve('apps', 'web');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 1. Output directory compatibility:
  // When Vercel Turborepo detector expects apps/web/.next within apps/web,
  // ensure both .next and apps/web/.next exist.
  const sourceNext = path.resolve('.next');
  const targetNextLink = path.resolve(targetDir, '.next');
  if (fs.existsSync(sourceNext) && !fs.existsSync(targetNextLink)) {
    fs.symlinkSync(sourceNext, targetNextLink, 'junction');
    console.log('[postbuild] Created compatibility link for Vercel at:', targetNextLink);
  }

  // 1b. Hosts that resolve the output directory (.next) from the repository root (e.g. Hostinger)
  const rootNextLink = path.resolve('..', '..', '.next');
  if (fs.existsSync(sourceNext) && fs.existsSync(path.resolve('..', '..', 'pnpm-workspace.yaml'))) {
    try {
      fs.lstatSync(rootNextLink);
    } catch {
      fs.symlinkSync(path.relative(path.dirname(rootNextLink), sourceNext), rootNextLink, 'junction');
      console.log('[postbuild] Created root output link at:', rootNextLink);
    }
  }

  // 2. package.json in targetDir:
  // Resolves Vercel's NFT server file tracer looking for apps/web/apps/web/package.json
  const sourcePkg = path.resolve('package.json');
  const targetPkg = path.resolve(targetDir, 'package.json');
  if (fs.existsSync(sourcePkg) && !fs.existsSync(targetPkg)) {
    fs.copyFileSync(sourcePkg, targetPkg);
    console.log('[postbuild] Created package.json in nested dir at:', targetPkg);
  }

  // 3. Root node_modules/.pnpm compatibility:
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

  // 4. Double-nested node_modules compatibility (for apps/web/apps/web/node_modules):
  const nestedNodeModules = path.resolve(targetDir, 'node_modules');
  if (fs.existsSync(localNodeModules) && !fs.existsSync(nestedNodeModules)) {
    try {
      fs.symlinkSync(localNodeModules, nestedNodeModules, 'junction');
      console.log('[postbuild] Created nested node_modules link at:', nestedNodeModules);
    } catch (e) {
      console.warn('[postbuild] Notice on nested node_modules:', e.message);
    }
  }

  // 5. Monorepo packages directory compatibility (for apps/web/packages & apps/web/apps/web/packages):
  const rootPackages = path.resolve('..', '..', 'packages');
  const localPackages = path.resolve('packages');
  if (fs.existsSync(rootPackages) && !fs.existsSync(localPackages)) {
    try {
      fs.symlinkSync(rootPackages, localPackages, 'junction');
      console.log('[postbuild] Created local packages link at:', localPackages);
    } catch (e) {
      console.warn('[postbuild] Notice on local packages:', e.message);
    }
  }

  const nestedPackages = path.resolve(targetDir, 'packages');
  if (fs.existsSync(rootPackages) && !fs.existsSync(nestedPackages)) {
    try {
      fs.symlinkSync(rootPackages, nestedPackages, 'junction');
      console.log('[postbuild] Created nested packages link at:', nestedPackages);
    } catch (e) {
      console.warn('[postbuild] Notice on nested packages:', e.message);
    }
  }
} catch (err) {
  console.warn('[postbuild] Notice:', err.message);
}


