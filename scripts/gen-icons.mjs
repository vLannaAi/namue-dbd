// Placeholder icon generator — only runs if real icons are missing.
// Real Namue logo PNGs ship in icons/ (committed). Don't overwrite them.
import { writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(here, "..", "icons");
const targets = ["icon-16.png", "icon-48.png", "icon-128.png"];

// If all three exist and are larger than the 70-byte placeholder, assume real.
const allReal = targets.every((f) => {
  const p = resolve(iconsDir, f);
  return existsSync(p) && statSync(p).size > 200;
});

if (allReal) {
  console.log("✓ Real Namue logo icons already in place — skipping placeholder.");
  process.exit(0);
}

const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqGf4DwAB6gFs6cKt4QAAAABJRU5ErkJggg==";
const buf = Buffer.from(PNG_B64, "base64");
mkdirSync(iconsDir, { recursive: true });
for (const f of targets) {
  writeFileSync(resolve(iconsDir, f), buf);
}
console.log("✓ Wrote placeholder icons →", iconsDir);
