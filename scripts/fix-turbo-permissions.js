const fs = require('fs');
const path = require('path');

function makeExecutable(targetPath) {
  try {
    if (fs.existsSync(targetPath)) {
      const stats = fs.statSync(targetPath);
      if (!stats.isDirectory()) {
        fs.chmodSync(targetPath, 0o755);
        console.log(`[turbo-permissions] Executable permission granted: ${targetPath}`);
      }
    }
  } catch (error) {
    // Fail silently on read-only or unsupported filesystems
  }
}

function scanAndFixDir(dir) {
  try {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'bin') {
          const binFiles = fs.readdirSync(fullPath);
          for (const binFile of binFiles) {
            makeExecutable(path.join(fullPath, binFile));
          }
        } else {
          scanAndFixDir(fullPath);
        }
      }
    }
  } catch (error) {
    // Fail silently
  }
}

function fixTurboWrapper() {
  try {
    const wrapperPath = path.resolve(__dirname, '..', 'node_modules', 'turbo', 'bin', 'turbo');
    if (fs.existsSync(wrapperPath)) {
      makeExecutable(wrapperPath);
      let content = fs.readFileSync(wrapperPath, 'utf8');
      if (!content.includes('fs.chmodSync(resolvedBinaryPath')) {
        const targetSearch = 'const child = child_process.spawn(';
        if (content.includes(targetSearch)) {
          const injectedCode = `  const resolvedBinaryPath = getBinaryPath();\n  try { fs.chmodSync(resolvedBinaryPath, 0o755); } catch (e) {}\n  const child = child_process.spawn(\n    resolvedBinaryPath,`;
          content = content.replace(
            `const child = child_process.spawn(\n    getBinaryPath(),`,
            injectedCode
          );
          fs.writeFileSync(wrapperPath, content, 'utf8');
          console.log('[turbo-permissions] Injected auto-chmod guard into turbo wrapper');
        }
      }
    }
  } catch (error) {
    // Fail silently
  }
}

function run() {
  const rootDir = path.resolve(__dirname, '..');
  const nodeModulesDir = path.join(rootDir, 'node_modules');

  if (!fs.existsSync(nodeModulesDir)) {
    return;
  }

  // 1. Direct candidate paths
  const directBinaries = [
    path.join(nodeModulesDir, '.bin', 'turbo'),
    path.join(nodeModulesDir, 'turbo', 'bin', 'turbo'),
    path.join(nodeModulesDir, '@turbo', 'linux-64', 'bin', 'turbo'),
    path.join(nodeModulesDir, '@turbo', 'linux-arm64', 'bin', 'turbo'),
    path.join(nodeModulesDir, '@turbo', 'darwin-64', 'bin', 'turbo'),
    path.join(nodeModulesDir, '@turbo', 'darwin-arm64', 'bin', 'turbo'),
    path.join(nodeModulesDir, '@turbo', 'windows-64', 'bin', 'turbo.exe'),
    path.join(nodeModulesDir, '@turbo', 'windows-arm64', 'bin', 'turbo.exe'),
  ];

  for (const binPath of directBinaries) {
    makeExecutable(binPath);
  }

  // 2. Scan @turbo directory if exists
  const atTurboDir = path.join(nodeModulesDir, '@turbo');
  scanAndFixDir(atTurboDir);

  // 3. Scan pnpm virtual store if present
  const pnpmDir = path.join(nodeModulesDir, '.pnpm');
  if (fs.existsSync(pnpmDir)) {
    try {
      const pnpmEntries = fs.readdirSync(pnpmDir);
      for (const entry of pnpmEntries) {
        if (entry.includes('turbo')) {
          scanAndFixDir(path.join(pnpmDir, entry));
        }
      }
    } catch (e) {}
  }

  // 4. Inject auto-chmod guard into turbo's JS runner
  fixTurboWrapper();
}

run();
