// Shared fixtures: temp dirs and a fake impeccable skill whose launcher emits canned output.
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPTS = fileURLToPath(new URL('../skills/studio-run/scripts/', import.meta.url));

export const tmp = () => mkdtempSync(join(tmpdir(), 'studio-test-'));

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
  : > "$out/1440x900$suffix.png"; echo "$out/1440x900$suffix.png"
  if [ -z "$FAKE_SHOT_ONE" ]; then : > "$out/390x844$suffix.png"; echo "$out/390x844$suffix.png"; fi ;;
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
  return launcher;
}

export function writeJson(file, value) {
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  return file;
}
