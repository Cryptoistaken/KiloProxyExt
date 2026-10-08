// Regenerates icons/ (logo.svg + on/off PNGs).  Usage: npm i --no-save sharp && node tools/make-icons.mjs
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(new URL("../icons", import.meta.url).pathname);
fs.mkdirSync(OUT, { recursive: true });

// K monogram: stem + two arms forking from one junction, round caps.
const glyph = (ink, w = 13) => `
  <path d="M44 32v64M44 64 85 32M44 64l41 32" stroke="${ink}" stroke-width="${w}"
        stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

const tile = ({ from, to, ink, w, shine = 0.22 }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
  <defs>
    <linearGradient id="bg" x1="10" y1="6" x2="118" y2="124" gradientUnits="userSpaceOnUse">
      <stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#fff" stop-opacity="${shine}"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="30" fill="url(#bg)"/>
  <rect width="128" height="128" rx="30" fill="url(#shine)"/>${glyph(ink, w)}
</svg>`;

const ON = { from: "#2EE6C0", to: "#38BDF8", ink: "#04110D" };
const OFF = { from: "#6B7A90", to: "#3B4757", ink: "#0B1117", shine: 0.16 };

// Heavier stroke at tiny sizes so the K survives downscaling.
const widthFor = (size) => (size <= 32 ? 17 : 13);

const logo = tile({ ...ON, w: 13 });
fs.writeFileSync(path.join(OUT, "logo.svg"), logo.trim() + "\n");

for (const [name, theme] of [["on", ON], ["off", OFF]]) {
  for (const size of [16, 32, 48, 128]) {
    const svg = tile({ ...theme, w: widthFor(size) });
    await sharp(Buffer.from(svg), { density: 72 * (size < 64 ? 4 : 1) })
      .resize(size, size, { kernel: "lanczos3" })
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT, `${name}-${size}.png`));
  }
}
