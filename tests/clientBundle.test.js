import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('built client bundle does not rely on a global React variable', () => {
  const assetsDir = path.resolve('client/dist/assets');
  const bundle = fs.readdirSync(assetsDir).find((file) => file.endsWith('.js'));
  assert.ok(bundle, 'client bundle must exist; run npm run build before this test');

  const content = fs.readFileSync(path.join(assetsDir, bundle), 'utf8');
  assert.equal(content.includes('React.createElement'), false);
});

