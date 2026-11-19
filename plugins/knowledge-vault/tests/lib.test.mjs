import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRemote, sameRemote } from '../skills/vault-setup/scripts/lib.mjs';

test('remote URLs compare equal across ssh, https, ports, .git and trailing slashes', () => {
  const forms = [
    'git@git.example.org:team/product-vault.git',
    'https://git.example.org/team/product-vault',
    'https://user@git.example.org/team/product-vault.git/',
    'ssh://git@git.example.org:2222/team/product-vault.git',
  ];
  for (const f of forms) assert.equal(normalizeRemote(f), 'git.example.org/team/product-vault', f);
  assert.ok(sameRemote(forms[0], forms[1]));
  assert.ok(!sameRemote(forms[0], 'git@git.example.org:team/other.git'));
  assert.ok(!sameRemote(null, null));
  assert.equal(normalizeRemote('/tmp/remotes/vault.git'), '/tmp/remotes/vault');
});
