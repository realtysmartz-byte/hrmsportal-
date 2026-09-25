const fs = require('fs');
const path = require('path');

try {
  // If running inside a Vercel project with root directory set to apps/web,
  // Vercel's Turborepo detector sometimes expects apps/web/.next within the working directory.
  // Creating a symlink/junction from .next to apps/web/.next guarantees both locations exist.
  const source = path.resolve('.next');
  const targetDir = path.resolve('apps', 'web');
  const targetLink = path.resolve('apps', 'web', '.next');

  if (fs.existsSync(source) && !fs.existsSync(targetLink)) {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.symlinkSync(source, targetLink, 'junction');
    console.log('[postbuild] Created compatibility link for Vercel at:', targetLink);
  }
} catch (err) {
  console.warn('[postbuild] Notice:', err.message);
}
