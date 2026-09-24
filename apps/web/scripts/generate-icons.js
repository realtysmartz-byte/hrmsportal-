// TEMP: regenerate icons from the real logo once provided
// Generates PWA icons based on the Realty Smartz Logo component hexagon mark

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const outDir = path.join(__dirname, "../public/icons");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Hexagon SVG template
// Normal scale: occupies ~70% of canvas
// Maskable scale: occupies ~60% of canvas (well within 80% safe zone)
function createSvg(size, scale = 0.7, bg = "#0F5C74", outerColor = "#FFFFFF", innerColor = "#A82A42") {
  const center = size / 2;
  const viewBoxSize = 36;
  const targetEmblemSize = size * scale;
  const transformScale = targetEmblemSize / viewBoxSize;
  const translateOffset = center - (viewBoxSize * transformScale) / 2;

  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${bg}" rx="${bg === "transparent" ? 0 : 0}"/>
  <g transform="translate(${translateOffset}, ${translateOffset}) scale(${transformScale})">
    <!-- Outer Hexagon -->
    <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="${outerColor}" />
    <!-- Inner Hexagon -->
    <polygon points="18,8 26,13 26,23 18,28 10,23 10,13" fill="${innerColor}" opacity="0.9" />
  </g>
</svg>
`.trim();
}

async function generate() {
  console.log("Generating PWA icons in", outDir);

  const icons = [
    { name: "icon-192x192.png", size: 192, scale: 0.7, bg: "#0F5C74", outer: "#FFFFFF", inner: "#A82A42" },
    { name: "icon-512x512.png", size: 512, scale: 0.7, bg: "#0F5C74", outer: "#FFFFFF", inner: "#A82A42" },
    { name: "icon-maskable-192x192.png", size: 192, scale: 0.58, bg: "#0F5C74", outer: "#FFFFFF", inner: "#A82A42" },
    { name: "icon-maskable-512x512.png", size: 512, scale: 0.58, bg: "#0F5C74", outer: "#FFFFFF", inner: "#A82A42" },
    { name: "apple-touch-icon.png", size: 180, scale: 0.7, bg: "#0F5C74", outer: "#FFFFFF", inner: "#A82A42" },
    { name: "favicon-32x32.png", size: 32, scale: 0.75, bg: "#0F5C74", outer: "#FFFFFF", inner: "#A82A42" },
  ];

  for (const icon of icons) {
    const svg = createSvg(icon.size, icon.scale, icon.bg, icon.outer, icon.inner);
    const dest = path.join(outDir, icon.name);
    await sharp(Buffer.from(svg))
      .png()
      .toFile(dest);
    console.log(`✓ Generated ${icon.name} (${icon.size}x${icon.size})`);
  }

  // Also write logo.svg to public/
  const logoSvg = `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="#0F5C74"/>
  <polygon points="18,8 26,13 26,23 18,28 10,23 10,13" fill="#A82A42" opacity="0.85"/>
</svg>`;
  fs.writeFileSync(path.join(__dirname, "../public/logo.svg"), logoSvg);
  console.log("✓ Generated public/logo.svg");

  console.log("All PWA icons generated successfully.");
}

generate().catch(err => {
  console.error("Icon generation error:", err);
  process.exit(1);
});
