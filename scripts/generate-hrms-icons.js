const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 1. Vector SVG matching the exact branding & chamfered H shape
// The H has:
// - Left vertical column: 70px wide, chamfered at bottom-left (45 deg angle)
// - Right vertical column: 70px wide, chamfered at top-right (45 deg angle)
// - Center horizontal bar: 64px high, connecting them at center
// - Background: #2B2FD1 with 112px border radius on 512x512
const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="115" fill="#2B2FD1"/>
  <path fill="#FFFFFF" d="
    M 136 136
    L 208 136
    L 208 224
    L 304 224
    L 304 136
    L 340 136
    L 376 172
    L 376 376
    L 304 376
    L 304 288
    L 208 288
    L 208 376
    L 172 376
    L 136 340
    Z
  "/>
</svg>`;

// Maskable icon with 20% safe zone padding for Android adaptive icons
const svgMaskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#2B2FD1"/>
  <g transform="translate(51.2, 51.2) scale(0.8)">
    <path fill="#FFFFFF" d="
      M 136 136
      L 208 136
      L 208 224
      L 304 224
      L 304 136
      L 340 136
      L 376 172
      L 376 376
      L 304 376
      L 304 288
      L 208 288
      L 208 376
      L 172 376
      L 136 340
      Z
    "/>
  </g>
</svg>`;

// Transparent foreground H for Android adaptive icon foreground
const svgForeground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <g transform="translate(51.2, 51.2) scale(0.8)">
    <path fill="#FFFFFF" d="
      M 136 136
      L 208 136
      L 208 224
      L 304 224
      L 304 136
      L 340 136
      L 376 172
      L 376 376
      L 304 376
      L 304 288
      L 208 288
      L 208 376
      L 172 376
      L 136 340
      Z
    "/>
  </g>
</svg>`;

// Notification icon: pure white silhouette on transparent background
const svgNotification = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <path fill="#FFFFFF" d="
    M 22 22
    L 36 22
    L 36 41
    L 60 41
    L 60 22
    L 68 22
    L 74 28
    L 74 74
    L 60 74
    L 60 55
    L 36 55
    L 36 74
    L 28 74
    L 22 68
    Z
  "/>
</svg>`;

async function main() {
  console.log('Generating HRMS icons...');

  const rootDir = path.resolve(__dirname, '..');
  const webPublic = path.join(rootDir, 'apps', 'web', 'public');
  const webIcons = path.join(webPublic, 'icons');
  const androidRes = path.join(rootDir, 'android-app', 'app', 'src', 'main', 'res');

  const baseSvgBuffer = Buffer.from(svg512);
  const maskableSvgBuffer = Buffer.from(svgMaskable);
  const foregroundSvgBuffer = Buffer.from(svgForeground);
  const notificationSvgBuffer = Buffer.from(svgNotification);

  // 1. Web App Icons
  await sharp(baseSvgBuffer).resize(512, 512).png().toFile(path.join(webIcons, 'icon-512x512.png'));
  await sharp(baseSvgBuffer).resize(192, 192).png().toFile(path.join(webIcons, 'icon-192x192.png'));
  await sharp(maskableSvgBuffer).resize(512, 512).png().toFile(path.join(webIcons, 'icon-maskable-512x512.png'));
  await sharp(maskableSvgBuffer).resize(192, 192).png().toFile(path.join(webIcons, 'icon-maskable-192x192.png'));
  await sharp(baseSvgBuffer).resize(180, 180).png().toFile(path.join(webIcons, 'apple-touch-icon.png'));
  await sharp(baseSvgBuffer).resize(32, 32).png().toFile(path.join(webIcons, 'favicon-32x32.png'));

  // Also root web public
  await sharp(baseSvgBuffer).resize(512, 512).png().toFile(path.join(webPublic, 'icon-512.png'));
  await sharp(baseSvgBuffer).resize(192, 192).png().toFile(path.join(webPublic, 'icon-192.png'));
  await sharp(baseSvgBuffer).resize(512, 512).png().toFile(path.join(webPublic, 'logo.png'));
  fs.writeFileSync(path.join(webPublic, 'logo.svg'), svg512);

  // 2. Android App Mipmaps
  const mipmaps = [
    { dir: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
  ];

  for (const m of mipmaps) {
    const targetDir = path.join(androidRes, m.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // Square launcher
    await sharp(baseSvgBuffer).resize(m.size, m.size).png().toFile(path.join(targetDir, 'ic_launcher.png'));

    // Round launcher (using circular clip)
    const circleBuffer = Buffer.from(
      `<svg width="${m.size}" height="${m.size}"><circle cx="${m.size / 2}" cy="${m.size / 2}" r="${m.size / 2}" fill="#2B2FD1"/></svg>`
    );
    await sharp(baseSvgBuffer)
      .resize(m.size, m.size)
      .composite([{ input: circleBuffer, blend: 'dest-in' }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // Adaptive icon foreground
    await sharp(foregroundSvgBuffer).resize(m.fgSize, m.fgSize).png().toFile(path.join(targetDir, 'ic_launcher_foreground.png'));
  }

  // 3. Android Splash and Notification
  const drawableDir = path.join(androidRes, 'drawable');
  if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });

  // Splash screen: 512x512 centered logo
  await sharp(baseSvgBuffer).resize(256, 256).png().toFile(path.join(drawableDir, 'splash.png'));

  // Notification icon: 96x96
  await sharp(notificationSvgBuffer).resize(96, 96).png().toFile(path.join(drawableDir, 'ic_notification_icon.png'));

  console.log('All HRMS icons generated successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
