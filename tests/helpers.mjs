// Shared fixtures: temp dirs and a fake impeccable skill whose launcher emits canned output.
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from '../skills/studio-run/scripts/png.mjs';

export const SCRIPTS = fileURLToPath(new URL('../skills/studio-run/scripts/', import.meta.url));

export const tmp = () => mkdtempSync(join(tmpdir(), 'studio-test-'));

// Tall RGB image whose every pixel byte equals its row number mod 256, so slices can be checked by content.
export function rowImage(width, height) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) pixels.fill(y & 255, y * width * 3, (y + 1) * width * 3);
  return { width, height, colorType: 2, channels: 3, pixels };
}

const FAKE_LAUNCHER = `#!/bin/sh
verb="$1"; shift
[ -n "$FAKE_LOG" ] && echo "$verb $*" >> "$FAKE_LOG"
case "$verb" in
shot)
  out=""; suffix=""
  while [ $# -gt 0 ]; do [ "$1" = "--out" ] && out="$2"; [ "$1" = "--full" ] && suffix="-full"; shift; done
  if [ -n "$FAKE_SHOT_FAIL" ]; then echo "page failed to load" >&2; exit 1; fi
  if [ -n "$FAKE_SHOT_NOWRITE" ]; then exit 0; fi
  mkdir -p "$out"
  here="$(dirname "$0")/.."
  put() { if [ -z "$suffix" ]; then : > "$out/$1.png"; elif [ -n "$FAKE_PNG_BAD" ]; then echo "not a png" > "$out/$1$suffix.png"; else cp "$here/$1$suffix.png" "$out/$1$suffix.png"; fi; echo "$out/$1$suffix.png"; }
  put 1440x900
  if [ -z "$FAKE_SHOT_ONE" ]; then put 390x844; fi ;;
detect)
  [ -n "$FAKE_DETECT_OUT" ] && cat "$FAKE_DETECT_OUT"
  exit "\${FAKE_DETECT_CODE:-0}" ;;
*) echo "unexpected verb $verb" >&2; exit 9 ;;
esac
`;

export function makeSkill(dir, { version = '4.10.0', nested = false, windows = false } = {}) {
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  const ver = nested ? `metadata:\n  version: "${version}"` : `version: ${version}`;
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: impeccable\n${ver}\n---\nbody\n`);
  const launcher = join(dir, 'scripts', windows ? 'impeccable.cmd' : 'impeccable');
  writeFileSync(launcher, FAKE_LAUNCHER);
  chmodSync(launcher, 0o755);
  writeFileSync(join(dir, '1440x900-full.png'), encodePng(rowImage(1440, 3000)));
  writeFileSync(join(dir, '390x844-full.png'), encodePng(rowImage(390, 4000)));
  return launcher;
}

export function writeJson(file, value) {
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  return file;
}
