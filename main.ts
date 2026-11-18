// Grand Heist: Sunset City — the gta6-01 entrypoint.
//
// The game itself lives in game/: a top-down, open-world crime game that a
// desktop browser loads offline (game/index.html plus its ES modules, no
// third-party library and no network request). The player walks and drives
// around Sunset City, takes missions, earns cash, and shakes the police as
// the wanted level climbs. This file is the program the grader runs: it
// assembles the hand-in in the output directory, checks the hand-in against
// the scorer's caps first so a bad build fails here with a readable message
// instead of later in the grader, and writes /output/dossier.json, the
// summary the judge reads, through the vendored make.fun library.
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Node 22, standard library only; no dependencies are installed.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's caps (reference/gate.json): text_max_bytes is the only one
// that shapes the dossier bytes; the rest refuse an entry the scorer would
// refuse — more than 4 screenshots or one over 256 KiB; more than 993 files
// in game/ or 48 MiB of game files in all; or a path under game/ over 1000
// bytes (game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json). We check them up front as well, so the
// failure message names the exact file or limit that broke.
const CAPS = {
  textMaxBytes: 163840,
  screenshotsMax: 4,
  screenshotMaxBytes: 262144,
  gameMaxFiles: 993,
  gameMaxBytes: 50331648,
  gamePathMaxBytes: 1000,
} as const;

const SOURCE_DIR = fileURLToPath(new URL('.', import.meta.url));
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message: string): never {
  throw new Error(`main.ts: ${message}`);
}

interface TreeTotals {
  files: number;
  bytes: number;
  longestPathBytes: number;
  longestPath: string;
}

// Walk a directory tree the way the grader counts it: every regular file,
// its size in bytes, and the longest relative path in bytes.
function measureTree(root: string): TreeTotals {
  const totals: TreeTotals = { files: 0, bytes: 0, longestPathBytes: 0, longestPath: '' };
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const size = statSync(full).size;
        const rel = relative(root, full);
        totals.files += 1;
        totals.bytes += size;
        if (Buffer.byteLength(rel) > totals.longestPathBytes) {
          totals.longestPathBytes = Buffer.byteLength(rel);
          totals.longestPath = rel;
        }
      }
    }
  };
  walk(root);
  return totals;
}

function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

// The game must load offline: no game file may pull a script, image, style
// sheet or module from the network. A single external URL would make the
// entry fail in the grader's sandbox, so scan every text file the browser
// can load for one and name the exact file and line that breaks the rule.
const EXTERNAL_URL = /(?:(?:src|href)\s*=\s*["']|url\(\s*["']?|from\s+["']|import\(\s*["'])\s*https?:\/\//i;

function checkOffline(gameDir: string): void {
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && /\.(html?|js|mjs|css|json)$/i.test(entry.name)) {
        const lines = readFileSync(full, 'utf8').split('\n');
        lines.forEach((line, index) => {
          const match = EXTERNAL_URL.exec(line);
          if (match) {
            fail(
              `${relative(SOURCE_DIR, full)}:${index + 1} references an external URL (${match[0].trim()}…): the game must load offline`,
            );
          }
        });
      }
    }
  };
  walk(gameDir);
}

// The game must have its entry page, and must fit the scorer's caps.
function checkGame(gameDir: string): TreeTotals {
  if (!existsSync(join(gameDir, 'index.html'))) {
    fail(`game/index.html is missing from ${gameDir}: the game has no entry page to serve`);
  }
  const totals = measureTree(gameDir);
  if (totals.files > CAPS.gameMaxFiles) {
    fail(`game/ holds ${totals.files} files, over the cap of ${CAPS.gameMaxFiles}`);
  }
  if (totals.bytes > CAPS.gameMaxBytes) {
    fail(`game/ totals ${humanBytes(totals.bytes)}, over the cap of ${humanBytes(CAPS.gameMaxBytes)}`);
  }
  if (totals.longestPathBytes > CAPS.gamePathMaxBytes) {
    fail(`game/ path ${totals.longestPath} is ${totals.longestPathBytes} bytes, over the cap of ${CAPS.gamePathMaxBytes}`);
  }
  return totals;
}

// Screenshots are the judge's first look at the game: 1 to 4 of them, each a
// JPEG or PNG no bigger than 256 KiB. The first by name is the cover.
function checkScreenshots(shotsDir: string): { count: number; bytes: number; names: string[] } {
  if (!existsSync(shotsDir)) {
    fail(`screenshots/ is missing from ${SOURCE_DIR}: the entry needs at least one screenshot`);
  }
  const names = readdirSync(shotsDir)
    .filter((name) => statSync(join(shotsDir, name)).isFile())
    .sort();
  if (names.length === 0) {
    fail('screenshots/ is empty: the entry needs at least one screenshot');
  }
  if (names.length > CAPS.screenshotsMax) {
    fail(`screenshots/ holds ${names.length} files, over the cap of ${CAPS.screenshotsMax}`);
  }
  let bytes = 0;
  for (const name of names) {
    if (!/\.(png|jpe?g)$/i.test(name)) {
      fail(`screenshot ${name} is not a PNG or JPEG`);
    }
    const size = statSync(join(shotsDir, name)).size;
    if (size > CAPS.screenshotMaxBytes) {
      fail(`screenshot ${name} is ${humanBytes(size)}, over the cap of ${humanBytes(CAPS.screenshotMaxBytes)}`);
    }
    bytes += size;
  }
  return { count: names.length, bytes, names };
}

const gameDir = join(SOURCE_DIR, 'game');
const shotsDir = join(SOURCE_DIR, 'screenshots');

const gameTotals = checkGame(gameDir);
checkOffline(gameDir);
const shotTotals = checkScreenshots(shotsDir);

mkdirSync(OUTPUT_DIR, { recursive: true });
cpSync(gameDir, join(OUTPUT_DIR, 'game'), { recursive: true });
mkdirSync(join(OUTPUT_DIR, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(OUTPUT_DIR, 'screenshots'), { recursive: true });

const dossierPath = join(OUTPUT_DIR, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(OUTPUT_DIR, {
    text_max_bytes: CAPS.textMaxBytes,
    screenshots: { max: CAPS.screenshotsMax, max_bytes: CAPS.screenshotMaxBytes },
    game_max_files: CAPS.gameMaxFiles,
    game_max_bytes: CAPS.gameMaxBytes,
    game_path_max_bytes: CAPS.gamePathMaxBytes,
  }),
);

// Read the dossier back and make sure it describes the hand-in we just
// built: cover 0 (the first screenshot by name) and one image per
// screenshot file. A mismatch here means the build is corrupt, and failing
// now beats shipping a dossier the judge cannot read.
function verifyDossier(path: string, shots: { count: number; names: string[] }): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    fail(`dossier at ${path} is not valid JSON after writing`);
  }
  const dossier = parsed as { cover?: unknown; images?: unknown };
  if (dossier.cover !== 0) {
    fail(`dossier cover is ${String(dossier.cover)}, expected 0 (first screenshot by name, ${shots.names[0]})`);
  }
  if (!Array.isArray(dossier.images) || dossier.images.length !== shots.count) {
    const got = Array.isArray(dossier.images) ? dossier.images.length : 'no';
    fail(`dossier holds ${got} images, expected ${shots.count} (one per screenshot file)`);
  }
}

verifyDossier(dossierPath, shotTotals);

console.log(`Grand Heist: Sunset City — build complete`);
console.log(`  output dir:  ${OUTPUT_DIR}`);
console.log(`  game files:  ${gameTotals.files} files, ${humanBytes(gameTotals.bytes)}`);
console.log(`  offline:     OK (no external URLs in game/)`);
console.log(`  screenshots: ${shotTotals.count} files, ${humanBytes(shotTotals.bytes)}`);
console.log(`  cover:       ${shotTotals.names[0]}`);
console.log(`  dossier:     ${dossierPath}`);
