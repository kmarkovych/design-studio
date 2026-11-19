// What vault sync refuses to commit or push: secret-looking file names, and added lines that look like keys, tokens or passwords.
// Pattern-based: it catches common forms only. Removing a secret is never refused.
import { gitOk } from './lib.mjs';

const SECRET_NAME = /(^|\/)(\.env(\.[^/]*)?|[^/]+\.env)$/;
const KEYS_FOLDER = /(^|\/)(keys|ключі)\//iu;
const SECRET_TEXT = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /glpat-[A-Za-z0-9_-]{10,}/,
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /"private_key"\s*:/,
  /(?<![A-Za-z0-9])sk-(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{20,}/, // OpenAI and Anthropic keys (sk-, sk-proj-, sk-ant-)
  /(?<![A-Za-z0-9])[sr]k_live_[A-Za-z0-9]{10,}/, // Stripe live keys
  /(?<![A-Za-z0-9])xox[abposr]-[A-Za-z0-9-]{10,}/, // Slack tokens
  /AIza[0-9A-Za-z_-]{35}/, // Google API keys
  /[a-z][a-z0-9+.-]*:\/\/[^/\s:@]*:[^/\s@]+@/i, // a URL carrying a password: postgres://user:pass@host
  // password: value, where the value mixes letters and digits; prose such as "token: required" passes
  /(password|passwd|secret|token|api[_-]?key|пароль)["']?\s*[:=]\s*["']?(?=[^\s"'`]*\d)(?=[^\s"'`]*\p{L})[^\s"'`]{6,}/iu,
];

const DIFF_OPTIONS = ['-p', '-U0', '--no-color', '--no-ext-diff', '--no-prefix', '-M'];

// [file, added line] pairs from a patch printed by git diff or git log -p.
function addedLines(patch) {
  const pairs = [];
  let file = null;
  let header = false;
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) { header = true; file = null; continue; }
    if (header && line.startsWith('+++ ')) { const p = line.slice(4).replace(/^"|"$/g, ''); file = p === '/dev/null' ? null : p; continue; }
    if (line.startsWith('@@')) { header = false; continue; }
    if (!header && file && line.startsWith('+')) pairs.push([file, line.slice(1)]);
  }
  return pairs;
}

// Files that look like secrets in the staged changes (staged: true) or in the commits of a range such as "origin/main..HEAD".
export function findSecrets(vault, { staged = false, range } = {}) {
  const base = staged ? ['diff', '--cached'] : ['log', '--format=', range];
  const names = gitOk(vault, [...base, '--name-only', '-z', '--diff-filter=d']).split('\0').map((s) => s.trim()).filter(Boolean);
  const byName = names.filter((f) => SECRET_NAME.test(f) || KEYS_FOLDER.test(f));
  const byText = addedLines(gitOk(vault, [...base, ...DIFF_OPTIONS]))
    .filter(([, line]) => SECRET_TEXT.some((re) => re.test(line))).map(([file]) => file);
  return [...new Set([...byName, ...byText])];
}
