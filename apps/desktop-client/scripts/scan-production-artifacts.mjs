import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { basename, join, resolve } from 'path';

const appDir = resolve(import.meta.dirname, '..');
const fixturePath = join(
  appDir,
  'test',
  'fixtures',
  'fingerprint',
  'signed-fingerprint-fixture.ts',
);
const fixtureSource = readFileSync(fixturePath, 'utf8');
const privateKeyMatch = /-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/.exec(
  fixtureSource,
);
if (!privateKeyMatch) throw new Error('Test private-key fixture could not be fingerprinted.');

const privateKey = privateKeyMatch[0].replace(/\r\n/g, '\n');
const privateKeyBody = privateKey
  .replace('-----BEGIN PRIVATE KEY-----', '')
  .replace('-----END PRIVATE KEY-----', '')
  .replace(/\s/g, '');
const privateKeySha256 = createHash('sha256').update(privateKey).digest('hex');
const forbidden = new Map([
  ['test private-key PEM', Buffer.from(privateKey)],
  ['test private-key body', Buffer.from(privateKeyBody)],
  ['test private-key SHA-256', Buffer.from(privateKeySha256)],
  ['test fixture module name', Buffer.from('signed-fingerprint-fixture')],
  ['forbidden fixture filename', Buffer.from('test-private-key.json')],
  ['fixture test key ID', Buffer.from('test:fixture')],
  ['legacy development test key ID', Buffer.from('test:local-development')],
]);

const outputName = process.env.DESKTOP_PACKAGE_OUTPUT_DIR ?? 'dist';
const packagedResources = join(appDir, outputName, 'win-unpacked', 'resources');
const roots = [
  join(appDir, 'out'),
  join(packagedResources, 'app.asar'),
  join(packagedResources, 'app.asar.unpacked'),
];

for (const root of roots) {
  if (!existsSync(root)) throw new Error(`Required production artifact is missing: ${root}`);
}

function filesUnder(path) {
  const stats = statSync(path);
  if (stats.isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? filesUnder(child) : [child];
  });
}

const violations = [];
let scannedFiles = 0;
for (const root of roots) {
  for (const file of filesUnder(root)) {
    scannedFiles += 1;
    const content = readFileSync(file);
    for (const [label, needle] of forbidden) {
      if (content.includes(needle)) violations.push(`${label}: ${file}`);
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Production artifact secret scan failed:\n${violations.join('\n')}`);
}

console.log(
  `Production artifact secret scan passed (${scannedFiles} files, private-key sha256=${privateKeySha256}).`,
);
