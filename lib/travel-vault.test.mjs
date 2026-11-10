import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('supplier credentials and order log are encrypted and recover across process restarts', () => {
  const parent = path.resolve('.automation'); fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, 'travel-vault-test-'));
  const module = new URL('./travel-vault.mjs', import.meta.url).href;
  function run(source) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import * as vault from ${JSON.stringify(module)}; ${source}`], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout.trim());
  }
  const id = run(`const id=vault.saveTravelAccount({type:'apiKey',secret:'fixture-credential-only'}); vault.writeTravelPrivate('orders', [{receipt:{supplierOrderId:'fixture-123'}}]); console.log(JSON.stringify(id));`);
  const bytes = fs.readFileSync(path.join(directory, '.automation/travel-private/sessions.enc'));
  assert.equal(bytes.includes(Buffer.from('fixture-credential-only')), false);
  const restored = run(`console.log(JSON.stringify({valid:vault.getTravelAccount(${JSON.stringify(id)})?.credential.secret==='fixture-credential-only',order:vault.readTravelPrivate('orders',[])[0].receipt.supplierOrderId}));`);
  assert.deepEqual(restored, { valid: true, order: 'fixture-123' });
  const deleted = run(`vault.deleteTravelAccount(${JSON.stringify(id)}); console.log(JSON.stringify(vault.getTravelAccount(${JSON.stringify(id)})));`);
  assert.equal(deleted, null);
  assert.equal(fileURLToPath(new URL('./travel-vault.mjs', import.meta.url)).endsWith('travel-vault.mjs'), true);
});
