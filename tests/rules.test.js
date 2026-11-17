'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  parseRepo, scanText, fmt, detectProfile, readmeLangInfo,
  claimsMatch, scanRisk, scoreChecks, PROFILES
} = require('../assets/app.js');

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

/* ---------- language of the README ---------- */

test('readmeLangInfo sees a real English section', () => {
  const ru = [
    '# Проект',
    '',
    'Это небольшая программа для Windows, которая показывает шуточный экран.',
    'Она ничего не удаляет и не отправляет в интернет.',
    '',
    '## ENG',
    '',
    'This is a small Windows prank app. It deletes nothing and sends nothing.',
    'The timer reboots the PC when it ends, so read the warnings first.'
  ].join('\n');
  const info = readmeLangInfo(ru, ['README.md']);
  assert.strictEqual(info.main, 'ru');
  assert.strictEqual(info.enHeading, true);
  assert.strictEqual(info.bilingual, true);
});

test('readmeLangInfo does not call a short README bilingual', () => {
  const info = readmeLangInfo('# Tiny tool\n\nRenames files.', ['README.md']);
  assert.strictEqual(info.letters < 200, true);
  assert.strictEqual(info.bilingual, false);
});

test('readmeLangInfo detects a separate README.en file', () => {
  const info = readmeLangInfo('# Проект\n\nОписание проекта на русском языке, достаточно длинное.', ['README.md', 'README.en.md']);
  assert.strictEqual(info.hasEnFile, true);
  assert.strictEqual(info.bilingual, true);
});

/* ---------- claims vs README ---------- */

test('claimsMatch passes when the README covers the description', () => {
  const repo = { description: 'Headless React component library for accessible dialogs', topics: ['react', 'components', 'accessibility'] };
  const readme = 'Orbit UI is a headless React component library. Every dialog is accessible and keyboard friendly.';
  const res = claimsMatch(repo, readme);
  assert.strictEqual(res.ok, true);
  assert.ok(res.ratio >= 0.5);
});

test('claimsMatch fails when the description promises absent features', () => {
  const repo = { description: 'Video editor with cloud sync and voice cloning', topics: [] };
  const res = claimsMatch(repo, 'A small script that renames files in a folder.');
  assert.strictEqual(res.ok, false);
});

test('claimsMatch does not judge a too-short description', () => {
  const res = claimsMatch({ description: 'Tool', topics: [] }, 'anything');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.checked < 3, true);
});

test('claimsMatch does not compare a Russian description with an English README', () => {
  const repo = { description: 'Шуточный винлокер для безвредного пранка', topics: ['prank', 'windows'] };
  const res = claimsMatch(repo, '# Fake WinLocker\n\nA joke app for a harmless prank on a friend who agreed to it.');
  assert.strictEqual(res.mismatch, true);
  assert.strictEqual(res.ok, true);
});

/* ---------- risk scan ---------- */

test('scanRisk separates declared behaviour from hidden behaviour', () => {
  const sources = [
    {
      path: 'src/app.py',
      text: 'import requests\nrequests.get("http://example.com")\n# CreateRemoteThread in a comment is ignored\n'
    },
    { path: 'src/launch.cs', text: 'Process.Start("cmd.exe");\n// shutdown /r /f is only a comment\n' }
  ];
  const declared = 'A small tool that downloads a version file from the internet.';
  const risk = scanRisk(sources, declared);
  const ids = risk.all.map(r => r.id);

  assert.ok(ids.includes('network'));
  assert.ok(ids.includes('process'));
  assert.strictEqual(ids.includes('injection'), false, 'comments must not trigger the scan');
  assert.strictEqual(ids.includes('power'), false, 'comments must not trigger the scan');
  assert.deepStrictEqual(risk.declared.map(r => r.id), ['network']);
  assert.deepStrictEqual(risk.undeclaredMedium.map(r => r.id), ['process']);
  assert.deepStrictEqual(risk.undeclaredHigh, []);
  assert.strictEqual(risk.network, true);
});

test('scanRisk treats an undeclared dangerous call as high risk', () => {
  const risk = scanRisk([{ path: 'a.cs', text: 'CreateRemoteThread(h, 0, 0, p, 0, 0, 0);' }], 'Renames files.');
  assert.deepStrictEqual(risk.undeclaredHigh.map(r => r.id), ['injection']);
});

test('scanRisk accepts a declared high-risk action', () => {
  const risk = scanRisk(
    [{ path: 'a.cs', text: 'Process.Start("shutdown", "/r /f /t 0");' }],
    'The timer reboots the computer when it ends.'
  );
  assert.deepStrictEqual(risk.undeclaredHigh, []);
  assert.deepStrictEqual(risk.declared.map(r => r.id), ['power']);
});

/* ---------- project profile ---------- */

const PRANK_README = [
  '# Шуточный винлокер',
  '',
  'Шуточный винлокер для безвредного пранка: синий экран, таймер, коты и капча для Windows.',
  'Это не вирус и не программа-вымогатель, но компьютер перезагрузится по таймеру.',
  '',
  '## Скриншоты',
  '',
  '![Экран блокировки](docs/screenshots/lockscreen.png)',
  '',
  '## Как скачать',
  '',
  'Скачай архив из релизов. Пароль архива: 123. Нужен Windows 10 или 11 и права администратора.',
  '',
  '## Что программа делает с системой',
  '',
  'Меняет реестр и политики, перехватывает клавиатуру, копирует себя в WUDFHost.exe.',
  'Полное восстановление: запусти `Launcher.exe --restore`. Аварийный выход: Ctrl+Alt+F12.',
  'Файл не подписан, SmartScreen покажет предупреждение, антивирус может ругаться.',
  '',
  '## ENG',
  '',
  'A joke Windows app for a harmless prank: a blue screen, a timer, cats and a fake captcha.',
  'It changes registry policies, hooks the keyboard and reboots the PC when the timer ends.',
  'Restore with `Launcher.exe --restore`. The file is unsigned, so SmartScreen warns you.'
].join('\n');

function prankCtx() {
  const now = Date.now();
  return {
    paths: [
      'README.md', 'LICENSE', 'build.ps1', 'Launcher.cs', 'WinLock.cs',
      'docs/screenshots/lockscreen.png', 'docs/screenshots/disco.png'
    ],
    readme: PRANK_README,
    repo: {
      description: 'Шуточный винлокер для безвредного пранка: синий экран, таймер, коты и капча.',
      topics: ['prank', 'windows', 'csharp', 'joke'],
      language: 'C#',
      created_at: new Date(now - 8 * 86400000).toISOString(),
      has_issues: true
    },
    releases: [{
      tag_name: 'v1.0',
      body: 'Первый публичный релиз: синий экран, таймер, коты, капча и достижения.',
      assets: [{
        name: 'PrankLocker-1.0.7z',
        size: 18400000,
        download_count: 42,
        browser_download_url: 'https://example.com/PrankLocker-1.0.7z'
      }]
    }],
    releaseBodies: 'Первый публичный релиз: синий экран, таймер, коты, капча и достижения.',
    sources: [{
      path: 'WinLock.cs',
      text: 'Process.Start("shutdown", "/r /f /t 0");\nRegistry.CurrentUser.OpenSubKey("Policies");\nSetWindowsHookEx(13, cb, h, 0);\n'
    }]
  };
}

test('detectProfile describes a joke desktop app without guessing', () => {
  const p = detectProfile(prankCtx());
  assert.strictEqual(p.kind, 'desktop');
  assert.strictEqual(p.platform, 'windows');
  assert.strictEqual(p.distribution, 'binary');
  assert.strictEqual(p.hasBinaries, true);
  assert.strictEqual(p.hasSource, true);
  assert.strictEqual(p.sourceCount, 1);
  assert.strictEqual(p.visuals, 2, 'the README image and the repo screenshot are the same file');
  assert.strictEqual(p.isToy, true);
  assert.strictEqual(p.isSmallNew, true);
  assert.strictEqual(p.lenient, true);
  assert.strictEqual(p.lockable, false);
  assert.strictEqual(p.hasAdmin, true);
  assert.strictEqual(p.hasArchive, true);
  assert.strictEqual(p.hasChecksums, false);
  assert.strictEqual(p.lang.bilingual, true);
});

test('detectProfile treats a web project as a site, not a desktop app', () => {
  const ctx = {
    paths: ['index.html', 'styles.css', 'app.js', 'README.md'],
    readme: '# Site\n\nA small web app that runs in the browser.',
    repo: { description: 'A small web app that runs in the browser', topics: ['web'], language: 'JavaScript', created_at: new Date().toISOString(), has_issues: true },
    releases: [],
    releaseBodies: '',
    sources: []
  };
  const p = detectProfile(ctx);
  assert.strictEqual(p.kind, 'web');
  assert.strictEqual(p.platform, 'web');
  assert.strictEqual(p.distribution, 'site');
});

/* ---------- scoring ---------- */

test('scoreChecks normalises over applicable weight and never punishes skips', () => {
  const profile = { cats: [{ id: 'security', max: 25 }, { id: 'quality', max: 15 }] };
  const checks = [
    { id: 'a', cat: 'security', sev: 'critical', points: 10, ok: true },
    { id: 'b', cat: 'security', sev: 'high', points: 40, ok: false },
    { id: 'c', cat: 'quality', sev: 'low', points: 10, ok: true, skip: true }
  ];
  const res = scoreChecks(checks, profile);
  assert.strictEqual(res.total, 50);
  assert.strictEqual(res.earned, 10);
  assert.strictEqual(res.score, 20);
  assert.strictEqual(res.skipped.length, 1);
  assert.deepStrictEqual(res.findings.map(f => f.id), ['b']);
});

test('scoreChecks orders findings by severity, then category', () => {
  const profile = { cats: [{ id: 'security', max: 25 }, { id: 'quality', max: 15 }] };
  const checks = [
    { id: 'low', cat: 'quality', sev: 'low', points: 1, ok: false },
    { id: 'high-q', cat: 'quality', sev: 'high', points: 2, ok: false },
    { id: 'high-s', cat: 'security', sev: 'high', points: 2, ok: false }
  ];
  const res = scoreChecks(checks, profile);
  assert.deepStrictEqual(res.findings.map(f => f.id), ['high-s', 'high-q', 'low']);
});

test('a profile with every check skipped scores 0 instead of dividing by zero', () => {
  const res = scoreChecks([{ id: 'x', cat: 'security', sev: 'low', points: 5, ok: true, skip: true }], PROFILES.dev);
  assert.strictEqual(res.score, 0);
  assert.strictEqual(res.total, 0);
});

test('both profiles add up to 100 points', () => {
  const sum = cats => cats.reduce((n, c) => n + c.max, 0);
  assert.strictEqual(sum(PROFILES.dev.cats), 100);
  assert.strictEqual(sum(PROFILES.user.cats), 100);
});
