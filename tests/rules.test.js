'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { parseRepo, scanText, fmt } = require('../assets/app.js');

test('parseRepo accepts a full GitHub URL', () => {
  assert.deepStrictEqual(parseRepo('https://github.com/TIZZ13/FakeWinLocker'), {
    owner: 'TIZZ13',
    name: 'FakeWinLocker'
  });
});

test('parseRepo accepts owner/repo, .git suffix and extra path', () => {
  assert.deepStrictEqual(parseRepo('TIZZ13/FakeWinLocker.git'), { owner: 'TIZZ13', name: 'FakeWinLocker' });
  assert.deepStrictEqual(parseRepo('github.com/sveltejs/svelte/tree/main'), { owner: 'sveltejs', name: 'svelte' });
  assert.deepStrictEqual(parseRepo('  https://www.github.com/a/b?tab=readme  '), { owner: 'a', name: 'b' });
});

test('parseRepo rejects input without owner/repo', () => {
  assert.strictEqual(parseRepo(''), null);
  assert.strictEqual(parseRepo('svelte'), null);
  assert.strictEqual(parseRepo('https://gitlab.com/a/b'), null);
  assert.strictEqual(parseRepo('-bad-/repo'), null);
});

test('scanText finds a GitHub token', () => {
  const hits = scanText('const token = "ghp_' + 'a'.repeat(36) + '";');
  assert.ok(hits.includes('GitHub token'));
});

test('scanText finds a private key header', () => {
  const hits = scanText('-----BEGIN RSA PRIVATE KEY-----\nMIIEow...');
  assert.ok(hits.includes('private key'));
});

test('scanText ignores placeholders and env references', () => {
  assert.deepStrictEqual(scanText('api_key: "your_key_goes_here_1234"'), []);
  assert.deepStrictEqual(scanText('const password = process.env.DB_PASSWORD;'), []);
});

test('scanText finds a hardcoded credential but not a short one', () => {
  assert.ok(scanText('password: "hunter2hunter2hunter2"').includes('hardcoded credential'));
  assert.deepStrictEqual(scanText('password: "short"'), []);
});

test('fmt replaces only known placeholders', () => {
  assert.strictEqual(fmt('{repo} — {score}/100', { repo: 'a/b', score: 54 }), 'a/b — 54/100');
  assert.strictEqual(fmt('{missing}', {}), '');
  assert.strictEqual(fmt('plain', null), 'plain');
});
