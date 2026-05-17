import { build } from "esbuild";
import { mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "dist");
mkdirSync(out, { recursive: true });
mkdirSync(resolve(out, "icons"), { recursive: true });

await build({
  entryPoints: {
    sw: resolve(here, "src/sw.ts"),
    popup: resolve(here, "src/popup.ts"),
  },
  outdir: out,
  bundle: true,
  format: "esm",
  target: "chrome120",
  platform: "browser",
  sourcemap: true,
  logLevel: "info",
});

copyFileSync(resolve(here, "manifest.json"), resolve(out, "manifest.json"));
copyFileSync(resolve(here, "src/popup.html"), resolve(out, "popup.html"));
for (const f of ["icon-16.png", "icon-48.png", "icon-128.png"]) {
  copyFileSync(resolve(here, "icons", f), resolve(out, "icons", f));
}
mkdirSync(resolve(out, "rules"), { recursive: true });
copyFileSync(resolve(here, "rules/dw-origin.json"), resolve(out, "rules/dw-origin.json"));

mkdirSync(resolve(out, "assets"), { recursive: true });
copyFileSync(resolve(here, "assets/logo.png"), resolve(out, "assets/logo.png"));

// Brand font (SIL OFL — bundle the license alongside the font, per OFL terms).
mkdirSync(resolve(out, "fonts"), { recursive: true });
copyFileSync(
  resolve(here, "font/Momo_Trust_Display/MomoTrustDisplay-Regular.ttf"),
  resolve(out, "fonts/MomoTrustDisplay-Regular.ttf"),
);
copyFileSync(
  resolve(here, "font/Momo_Trust_Display/OFL.txt"),
  resolve(out, "fonts/OFL.txt"),
);

console.log(`✓ Built extension to ${out}`);
