// Render PWA icons from public/icons/*.svg. Uses sharp when available, else macOS qlmanage.
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = "public/icons";
const jobs = [
  ["icon.svg", "icon-192.png", 192],
  ["icon.svg", "icon-512.png", 512],
  ["icon.svg", "apple-touch-icon.png", 180],
  ["icon-maskable.svg", "icon-512-maskable.png", 512],
];

let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {}

for (const [src, dest, size] of jobs) {
  const from = join(out, src);
  const to = join(out, dest);
  if (sharp) {
    await sharp(from, { density: 384 }).resize(size, size).png().toFile(to);
  } else {
    const dir = mkdtempSync(join(tmpdir(), "lifeos-icons-"));
    execSync(`qlmanage -t -s ${size} -o "${dir}" "${from}"`, { stdio: "ignore" });
    const produced = readdirSync(dir).find((f) => f.endsWith(".png"));
    if (!produced) throw new Error(`qlmanage produced nothing for ${src}`);
    copyFileSync(join(dir, produced), to);
  }
  console.log("wrote", to, existsSync(to));
}
