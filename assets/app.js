/* LaunchCheck — static GitHub repository audit.
   No build step, no dependencies, no backend.
   Everything runs in the browser and talks only to api.github.com. */
(function () {
  'use strict';

  var API = 'https://api.github.com';
  var LS = { token: 'launchcheck.token', lang: 'launchcheck.lang', last: 'launchcheck.last' };

  var state = {
    lang: 'ru',
    token: '',
    busy: false,
    ctx: null,
    checks: [],
    findings: [],
    score: 0,
    catScores: {},
    rate: null,
    showAll: false
  };

  /* ------------------------------------------------------------------ */
  /* i18n                                                                */
  /* ------------------------------------------------------------------ */

  var UI = {
    ru: {
      kicker: 'Бесплатно · без установки · без регистрации',
      h1: 'Проверь проект<br>до того, как его <em>увидят</em>',
      lead: 'Вставь ссылку на GitHub-репозиторий. Получи оценку по 100-балльной шкале, понятный список проблем и готовые промпты для своего ИИ-агента.',
      check: 'Проверить',
      hint: 'Работает с публичными репозиториями. Приватные — добавь токен в настройках.',
      settings: 'Настройки',
      tokenLabel: 'GitHub token (необязательно)',
      tokenHelp: 'Нужен для приватных репозиториев и лимита 5000 запросов в час вместо 60. Хранится только в localStorage этого браузера и уходит только на api.github.com. Хватит scope public_repo.',
      tokenCheck: 'Проверить токен',
      tokenClear: 'Удалить токен',
      done: 'Готово',
      foot: 'LaunchCheck · статический сайт на GitHub Pages',
      loadingRepo: 'Читаю репозиторий…',
      loadingTree: 'Смотрю файлы…',
      loadingReadme: 'Читаю README…',
      loadingScan: 'Проверяю конфиги на секреты…',
      loadingScore: 'Считаю баллы…',
      errNotFound: 'Репозиторий не найден или он приватный. Проверь ссылку — или добавь токен в настройках.',
      errRate: 'Лимит GitHub API исчерпан. Сброс в {time}. Добавь токен в настройках, чтобы получить 5000 запросов в час.',
      errAuth: 'GitHub отклонил токен. Проверь его в настройках.',
      errEmpty: 'Пустой репозиторий: в нём нет файлов.',
      errInput: 'Похоже, это не ссылка на репозиторий. Нужен формат owner/repo.',
      errGeneric: 'Не получилось проверить репозиторий: {msg}',
      score: 'Балл',
      outOf: 'из 100',
      gradeGreat: 'Готово к запуску',
      gradeGood: 'Почти готово',
      gradeMeh: 'Рано показывать',
      gradeBad: 'Сначала починить',
      summary: 'По категориям',
      issues: 'Что починить',
      noIssues: 'Проблем не найдено. Хороший знак — но глазами всё равно проверь.',
      issueOne: 'проблема',
      issueFew: 'проблемы',
      issueMany: 'проблем',
      copyPrompt: 'Скопировать промпт',
      copyAll: 'Скопировать все промпты',
      card: 'Скачать карточку',
      badge: 'Скачать бейдж',
      again: 'Проверить снова',
      showAll: 'Показать все ({n})',
      showLess: 'Свернуть',
      copied: 'Скопировано',
      copiedAll: 'Все промпты скопированы',
      copyFail: 'Браузер не дал скопировать — выдели текст вручную',
      cardDone: 'Карточка сохранена',
      badgeDone: 'Бейдж сохранён',
      rate: 'API',
      rateTitle: 'Остаток запросов к GitHub API',
      rateReset: 'сброс в {time}',
      updated: 'обновлён',
      stars: 'звёзд',
      forks: 'форков',
      files: 'файлов',
      truncated: 'Файлов очень много — проверены первые 100 000.',
      tokenOk: 'Токен работает: {login}, лимит {limit}/час',
      tokenBad: 'Токен не подошёл',
      privateHint: 'Если репозиторий приватный, добавь токен.',
      severity: { critical: 'критично', high: 'важно', medium: 'средне', low: 'мелочь' },
      cats: { security: 'Безопасность', runnable: 'Запуск', quality: 'Качество', repo: 'Репозиторий', product: 'Продукт', trust: 'Доверие' },
      promptHeader: 'LaunchCheck — отчёт для {repo}: {score}/100',
      promptIntro: 'Ниже список проблем по порядку важности. Исправь их по одной, не меняя остальное поведение проекта.',
      cardFooter: 'launchcheck · {host}'
    },
    en: {
      kicker: 'Free · no install · no signup',
      h1: 'Check your project<br>before people <em>see it</em>',
      lead: 'Paste a GitHub repository link. Get a score out of 100, a plain-language list of problems, and ready-to-paste prompts for your AI agent.',
      check: 'Check',
      hint: 'Works with public repositories. For private ones, add a token in settings.',
      settings: 'Settings',
      tokenLabel: 'GitHub token (optional)',
      tokenHelp: 'Needed for private repositories and for 5000 requests/hour instead of 60. Stored only in this browser’s localStorage and sent only to api.github.com. The public_repo scope is enough.',
      tokenCheck: 'Check token',
      tokenClear: 'Remove token',
      done: 'Done',
      foot: 'LaunchCheck · a static site on GitHub Pages',
      loadingRepo: 'Reading the repository…',
      loadingTree: 'Looking at the files…',
      loadingReadme: 'Reading the README…',
      loadingScan: 'Scanning configs for secrets…',
      loadingScore: 'Adding up the score…',
      errNotFound: 'Repository not found or private. Check the link — or add a token in settings.',
      errRate: 'GitHub API rate limit reached. Resets at {time}. Add a token in settings for 5000 requests/hour.',
      errAuth: 'GitHub rejected the token. Check it in settings.',
      errEmpty: 'Empty repository: there are no files in it.',
      errInput: 'That does not look like a repository. Use the owner/repo format.',
      errGeneric: 'Could not check the repository: {msg}',
      score: 'Score',
      outOf: 'out of 100',
      gradeGreat: 'Ready to ship',
      gradeGood: 'Almost there',
      gradeMeh: 'Too early to show',
      gradeBad: 'Fix it first',
      summary: 'By category',
      issues: 'What to fix',
      noIssues: 'No problems found. Good sign — but still look at it with your own eyes.',
      issueOne: 'issue',
      issueFew: 'issues',
      issueMany: 'issues',
      copyPrompt: 'Copy prompt',
      copyAll: 'Copy all prompts',
      card: 'Download card',
      badge: 'Download badge',
      again: 'Check again',
      showAll: 'Show all ({n})',
      showLess: 'Collapse',
      copied: 'Copied',
      copiedAll: 'All prompts copied',
      copyFail: 'The browser refused to copy — select the text manually',
      cardDone: 'Card saved',
      badgeDone: 'Badge saved',
      rate: 'API',
      rateTitle: 'Remaining GitHub API requests',
      rateReset: 'resets at {time}',
      updated: 'updated',
      stars: 'stars',
      forks: 'forks',
      files: 'files',
      truncated: 'A lot of files — only the first 100,000 were checked.',
      tokenOk: 'Token works: {login}, limit {limit}/hour',
      tokenBad: 'That token did not work',
      privateHint: 'If the repository is private, add a token.',
      severity: { critical: 'critical', high: 'high', medium: 'medium', low: 'low' },
      cats: { security: 'Security', runnable: 'Runnable', quality: 'Quality', repo: 'Repository', product: 'Product', trust: 'Trust' },
      promptHeader: 'LaunchCheck report for {repo}: {score}/100',
      promptIntro: 'Below are the problems in order of importance. Fix them one by one without changing the rest of the project.',
      cardFooter: 'launchcheck · {host}'
    }
  };

  function t(key) {
    var table = UI[state.lang] || UI.ru;
    return table[key] !== undefined ? table[key] : (UI.ru[key] !== undefined ? UI.ru[key] : key);
  }

  /* Bilingual message helper: M('русский', 'english') */
  function M(ru, en) { return { ru: ru, en: en }; }
  function pick(m) {
    if (m === null || m === undefined) return '';
    if (typeof m === 'string') return m;
    return m[state.lang] || m.ru || '';
  }
  function fmt(s, vars) {
    if (!vars) return s;
    return String(s).replace(/\{(\w+)\}/g, function (_, k) {
      var v = vars[k];
      if (typeof v === 'function') v = v();
      return v === undefined || v === null ? '' : String(v);
    });
  }

  /* ------------------------------------------------------------------ */
  /* DOM helpers                                                         */
  /* ------------------------------------------------------------------ */

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nf(n) {
    try { return new Intl.NumberFormat(state.lang === 'ru' ? 'ru-RU' : 'en-US').format(n); }
    catch (e) { return String(n); }
  }
  function dateStr(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(state.lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return ''; }
  }
  function hhmm(ts) {
    try {
      return new Date(ts * 1000).toLocaleTimeString(state.lang === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '—'; }
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.hidden = true; }, 220);
    }, 2200);
  }

  function setStatus(text, isError) {
    var el = $('status');
    if (!text) { el.hidden = true; return; }
    el.hidden = false;
    el.className = 'status' + (isError ? ' error' : '');
    el.innerHTML = '<span class="pulse"></span><span>' + esc(text) + '</span>';
  }

  function setBusy(busy) {
    state.busy = busy;
    var btn = $('go');
    btn.disabled = busy;
    btn.classList.toggle('busy', busy);
    $('repoInput').disabled = busy;
  }

  /* ------------------------------------------------------------------ */
  /* GitHub API                                                          */
  /* ------------------------------------------------------------------ */

  function HttpError(status, message, kind) {
    this.status = status;
    this.message = message || ('HTTP ' + status);
    this.kind = kind || 'http';
  }
  HttpError.prototype = Object.create(Error.prototype);

  function renderRate() {
    var el = $('rate');
    if (!state.rate) { el.textContent = t('rate') + ' —'; el.className = 'rate'; return; }
    var left = state.rate.remaining;
    el.textContent = t('rate') + ' ' + left + '/' + state.rate.limit;
    el.className = 'rate' + (left <= 0 ? ' out' : left < 10 ? ' low' : '');
    el.title = t('rateTitle') + (state.rate.reset ? ' · ' + fmt(t('rateReset'), { time: hhmm(state.rate.reset) }) : '');
  }

  function captureRate(res) {
    var rem = res.headers.get('x-ratelimit-remaining');
    var lim = res.headers.get('x-ratelimit-limit');
    var rst = res.headers.get('x-ratelimit-reset');
    if (rem !== null) {
      state.rate = { remaining: parseInt(rem, 10), limit: lim ? parseInt(lim, 10) : 60, reset: rst ? parseInt(rst, 10) : null };
      renderRate();
    }
  }

  function api(path, options) {
    options = options || {};
    var url = path.indexOf('http') === 0 ? path : API + path;
    var headers = { 'Accept': options.accept || 'application/vnd.github+json' };
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;

    return fetch(url, { headers: headers }).then(function (res) {
      captureRate(res);
      if (res.ok) {
        return options.raw ? res.text() : res.json();
      }
      if (res.status === 404) throw new HttpError(404, 'not found', 'notfound');
      if (res.status === 409) throw new HttpError(409, 'empty', 'empty');
      if (res.status === 401) throw new HttpError(401, 'bad token', 'auth');
      if (res.status === 403 || res.status === 429) throw new HttpError(res.status, 'rate limit', 'rate');
      return res.text().then(function (body) {
        throw new HttpError(res.status, body || res.statusText, 'http');
      });
    });
  }

  function parseRepo(input) {
    var raw = String(input || '').trim();
    if (!raw) return null;
    raw = raw.replace(/^https?:\/\/(www\.)?github\.com\//i, '');
    raw = raw.replace(/^github\.com\//i, '');
    raw = raw.split('?')[0].split('#')[0];
    var parts = raw.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    var owner = parts[0];
    var name = parts[1].replace(/\.git$/i, '');
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner)) return null;
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(name)) return null;
    return { owner: owner, name: name };
  }

  /* ------------------------------------------------------------------ */
  /* Checks                                                              */
  /* ------------------------------------------------------------------ */

  var CATS = [
    { id: 'security', max: 25, color: '#f87171' },
    { id: 'runnable', max: 20, color: '#60a5fa' },
    { id: 'quality', max: 15, color: '#a78bfa' },
    { id: 'repo', max: 15, color: '#6ee7b7' },
    { id: 'product', max: 15, color: '#fbbf24' },
    { id: 'trust', max: 10, color: '#38bdf8' }
  ];

  var SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

  var SECRET_PATTERNS = [
    { re: /AKIA[0-9A-Z]{16}/g, kind: 'AWS access key' },
    { re: /gh[pousr]_[A-Za-z0-9]{36,}/g, kind: 'GitHub token' },
    { re: /sk-[A-Za-z0-9]{20,}/g, kind: 'API secret key' },
    { re: /AIza[0-9A-Za-z_\-]{35}/g, kind: 'Google API key' },
    { re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g, kind: 'private key' },
    { re: /(?:api[_-]?key|secret|token|password|passwd|pwd)\s*[:=]\s*['"][^'"\s]{12,}['"]/gi, kind: 'hardcoded credential' }
  ];

  var PLACEHOLDER = /(your[_-]?|example|placeholder|changeme|change_me|xxxx|<[^>]+>|\$\{|process\.env|os\.environ|env\[|dummy|sample|test[_-]?key)/i;

  function scanText(text) {
    var hits = [];
    for (var i = 0; i < SECRET_PATTERNS.length; i++) {
      var p = SECRET_PATTERNS[i];
      p.re.lastIndex = 0;
      var m;
      while ((m = p.re.exec(text)) !== null) {
        var value = m[0];
        if (PLACEHOLDER.test(value)) continue;
        hits.push(p.kind);
        break; // one hit per pattern per file is enough
      }
    }
    return hits;
  }

  function pathsMatching(paths, re) {
    return paths.filter(function (p) { return re.test(p); });
  }

  function checkGroup(ctx) {
    var paths = ctx.paths;
    var readme = ctx.readme || '';
    var repo = ctx.repo;
    var out = [];

    function add(c) { out.push(c); }

    /* ---------- security (25) ---------- */

    var envFiles = pathsMatching(paths, /(^|\/)\.env(\.[A-Za-z0-9_-]+)?$/i).filter(function (p) {
      return !/\.(example|sample|template|dist)$/i.test(p) && !/\.env\.example$/i.test(p);
    });
    add({
      id: 's_env', cat: 'security', sev: 'critical', points: 8,
      ok: envFiles.length === 0,
      vars: { files: envFiles.slice(0, 4).join(', '), extra: envFiles.length > 4 ? ' +' + (envFiles.length - 4) : '' },
      title: M('Файл .env лежит в репозитории', '.env file is committed'),
      why: M('Файлы окружения с паролями и ключами попали в git. Даже если удалить файл сейчас, он останется в истории коммитов.',
        'Environment files with passwords and keys are in git. Deleting the file now does not remove it from commit history.'),
      prompt: M(
        'В репозитории {repo} в git попали файлы окружения: {files}{extra}.\n' +
        'Сделай по шагам:\n' +
        '1) убери эти файлы из индекса: git rm --cached <файл>;\n' +
        '2) добавь .env и .env.* в .gitignore, но оставь .env.example;\n' +
        '3) создай .env.example со списком переменных без значений;\n' +
        '4) вычисти файлы из истории (git filter-repo или BFG) и предупреди, что все ключи из них нужно перевыпустить;\n' +
        '5) проверь, что приложение читает значения из переменных окружения.\n' +
        'Не меняй остальную логику.',
        'The repository {repo} has environment files committed: {files}{extra}.\n' +
        'Do this step by step:\n' +
        '1) untrack them: git rm --cached <file>;\n' +
        '2) add .env and .env.* to .gitignore, keep .env.example;\n' +
        '3) create .env.example listing variable names with no values;\n' +
        '4) purge them from history (git filter-repo or BFG) and tell me every key from those files must be rotated;\n' +
        '5) make sure the app reads values from environment variables.\n' +
        'Do not change other logic.'
      )
    });

    var keyFiles = pathsMatching(paths, /(^|\/)(id_(rsa|dsa|ecdsa|ed25519)|[^/]+\.(pem|key|p12|pfx|jks|keystore))$/i)
      .filter(function (p) { return !/\.pub$/i.test(p); });
    add({
      id: 's_keys', cat: 'security', sev: 'critical', points: 7,
      ok: keyFiles.length === 0,
      vars: { files: keyFiles.slice(0, 4).join(', ') },
      title: M('В репозитории приватные ключи', 'Private keys are in the repository'),
      why: M('Ключи и хранилища сертификатов не должны лежать в публичном коде. Такой ключ считается скомпрометированным навсегда.',
        'Keys and certificate stores must not be in public code. Once pushed, such a key is compromised forever.'),
      prompt: M(
        'В репозитории {repo} найдены приватные ключи: {files}.\n' +
        'Убери их из репозитория и из истории git, добавь соответствующие шаблоны в .gitignore, перевыпусти затронутые ключи и сертификаты. ' +
        'Если ключ нужен приложению — объясни, как загружать его из переменной окружения или секрета CI. Не коммить новые ключи.',
        'The repository {repo} contains private keys: {files}.\n' +
        'Remove them from the working tree and from git history, add the matching patterns to .gitignore, and rotate every affected key and certificate. ' +
        'If the app needs a key, explain how to load it from an environment variable or a CI secret. Do not commit new keys.'
      )
    });

    var scannedNames = ctx.scanned.map(function (s) { return s.path; });
    var leaked = ctx.scanned.filter(function (s) { return s.hits.length > 0; });
    add({
      id: 's_secrets', cat: 'security', sev: 'critical', points: 10,
      ok: leaked.length === 0,
      vars: {
        files: leaked.slice(0, 3).map(function (s) { return s.path; }).join(', '),
        kinds: leaked.reduce(function (acc, s) { return acc.concat(s.hits); }, []).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 3).join(', ')
      },
      title: M('В конфигах похоже на настоящие секреты', 'Configs look like they contain real secrets'),
      why: M('Найдены строки, похожие на API-ключи, токены или пароли. Значения не показываются и никуда не отправляются — но их нужно считать утёкшими.',
        'Found strings that look like API keys, tokens or passwords. The values are not displayed or sent anywhere — but you should treat them as leaked.'),
      prompt: M(
        'В репозитории {repo} в файлах {files} найдены строки, похожие на секреты ({kinds}).\n' +
        'Сделай так:\n' +
        '1) вынеси значения в переменные окружения, добавь .env.example;\n' +
        '2) удали секреты из кода и истории git;\n' +
        '3) перевыпусти все затронутые ключи и токены;\n' +
        '4) добавь в CI проверку на секреты (gitleaks или trufflehog).\n' +
        'Значения не выводи в чат и не коммить.',
        'In the repository {repo}, files {files} contain strings that look like secrets ({kinds}).\n' +
        'Do this:\n' +
        '1) move the values into environment variables, add .env.example;\n' +
        '2) remove the secrets from code and git history;\n' +
        '3) rotate every affected key and token;\n' +
        '4) add a secret scan to CI (gitleaks or trufflehog).\n' +
        'Do not print the values or commit them.'
      )
    });

    /* ---------- runnable (20) ---------- */

    var runRe = /(##+\s*(install|installation|setup|quick\s?start|usage|getting started|установка|запуск|быстрый старт|использование))|(\bnpm (i|install|run)\b|\bpip install\b|\bdotnet run\b|\bgo run\b|\bcargo run\b|\bdocker (compose )?up\b|\bmake (run|install|dev)\b|\bpython -m\b)/i;
    add({
      id: 'r_docs', cat: 'runnable', sev: 'high', points: 6,
      ok: runRe.test(readme),
      title: M('В README нет «как запустить»', 'README does not say how to run it'),
      why: M('Человек открыл репозиторий и не понял, что делать. Без раздела установки половина посетителей уходит сразу.',
        'Someone opened the repository and could not tell what to do. Without an install section, half the visitors leave immediately.'),
      prompt: M(
        'В README репозитория {repo} нет понятного раздела о запуске. Добавь в начало README раздел «Быстрый старт»: требования (версия языка/рантайма), команды установки зависимостей, команда запуска и ожидаемый результат. ' +
        'Используй реальные команды проекта, не выдумывай. Если чего-то не хватает для запуска — добавь это и опиши.',
        'The README of {repo} does not explain how to run the project. Add a “Quick start” section near the top: requirements (language/runtime version), dependency install commands, the run command, and what the user should see. ' +
        'Use the real commands of this project, do not invent them. If something needed to run is missing, add it and document it.'
      )
    });

    var manifestFiles = pathsMatching(paths, /(^|\/)(package\.json|[^/]+\.csproj|[^/]+\.sln|pyproject\.toml|requirements\.txt|Cargo\.toml|go\.mod|pom\.xml|build\.gradle(\.kts)?|Gemfile|composer\.json|index\.html)$/i);
    add({
      id: 'r_manifest', cat: 'runnable', sev: 'medium', points: 4,
      ok: manifestFiles.length > 0,
      vars: { files: manifestFiles.slice(0, 3).join(', ') },
      title: M('Нет манифеста проекта', 'No project manifest'),
      why: M('Не видно, из чего собирается проект и какие у него зависимости. Агенту и человеку придётся угадывать.',
        'There is no clear build definition or dependency list. Both an agent and a human would have to guess.'),
      prompt: M(
        'В репозитории {repo} нет файла манифеста (package.json, pyproject.toml, .csproj, Cargo.toml, go.mod или аналога). ' +
        'Добавь манифест для реального стека проекта: имя, версия, зависимости, скрипты сборки и запуска. Ничего не выдумывай: посмотри, какие импорты используются в коде.',
        'The repository {repo} has no manifest (package.json, pyproject.toml, .csproj, Cargo.toml, go.mod or similar). ' +
        'Add a manifest for the actual stack: name, version, dependencies, build and run scripts. Do not invent anything — look at the imports used in the code.'
      )
    });

    var lockFiles = pathsMatching(paths, /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Pipfile\.lock|packages\.lock\.json|Cargo\.lock|go\.sum|composer\.lock|Gemfile\.lock)$/i);
    add({
      id: 'r_lock', cat: 'runnable', sev: 'medium', points: 3,
      ok: lockFiles.length > 0,
      title: M('Нет lockfile', 'No lockfile'),
      why: M('Без lockfile у каждого будут разные версии зависимостей, и «у меня работает» превращается в лотерею.',
        'Without a lockfile everyone gets different dependency versions, and “works on my machine” becomes a lottery.'),
      prompt: M(
        'В репозитории {repo} нет lockfile. Сгенерируй его штатной командой пакетного менеджера проекта (npm install, pip freeze/poetry lock, dotnet restore, cargo generate-lockfile) и закоммить. ' +
        'Не обновляй версии зависимостей без необходимости.',
        'The repository {repo} has no lockfile. Generate it with the project’s package manager (npm install, pip freeze/poetry lock, dotnet restore, cargo generate-lockfile) and commit it. ' +
        'Do not bump dependency versions unless necessary.'
      )
    });

    var entryRe = /(^|\/)(src\/|main\.[a-z0-9]+$|Program\.cs$|App\.(xaml|jsx|tsx|vue|svelte)$|index\.(js|ts|html)$|app\.py$|manage\.py$|cmd\/)/i;
    add({
      id: 'r_entry', cat: 'runnable', sev: 'medium', points: 4,
      ok: entryRe.test(paths.join('\n')),
      title: M('Непонятно, откуда стартует проект', 'Unclear entry point'),
      why: M('Нет очевидной точки входа: папки src, main-файла или индекса. Это первое, что ищут в чужом коде.',
        'There is no obvious entry point: no src folder, main file or index. It is the first thing people look for in unfamiliar code.'),
      prompt: M(
        'В репозитории {repo} не видно точки входа. Приведи структуру к понятной: исходники в src/ (или эквивалент для стека), один явный вход (main.*, Program.cs, app.py, index.html), ' +
        'и добавь в README строку «Точка входа: путь». Перемещай файлы аккуратно, обнови импорты и проверь, что проект собирается.',
        'The repository {repo} has no obvious entry point. Make the structure clear: sources in src/ (or the stack equivalent), one explicit entry (main.*, Program.cs, app.py, index.html), ' +
        'and add a “Entry point: path” line to the README. Move files carefully, update imports, and verify the project still builds.'
      )
    });

    var workflows = pathsMatching(paths, /^\.github\/workflows\/[^/]+\.ya?ml$/i);
    add({
      id: 'r_ci', cat: 'runnable', sev: 'high', points: 3,
      ok: workflows.length > 0,
      vars: {},
      title: M('Нет CI', 'No CI'),
      why: M('Никто автоматически не проверяет, что проект собирается. Первый же сломанный коммит заметят пользователи.',
        'Nothing automatically checks that the project builds. The first broken commit will be noticed by users.'),
      prompt: M(
        'В репозитории {repo} нет GitHub Actions. Добавь .github/workflows/ci.yml: checkout, установка нужной версии рантайма, установка зависимостей, сборка и тесты. ' +
        'Триггеры: push в {branch} и pull_request. Сделай минимальный рабочий файл для реального стека проекта и проверь, что он проходит.',
        'The repository {repo} has no GitHub Actions. Add .github/workflows/ci.yml: checkout, set up the required runtime version, install dependencies, build and test. ' +
        'Triggers: push to {branch} and pull_request. Keep it minimal and real for this stack, and make sure it passes.'
      )
    });

    /* ---------- quality (15) ---------- */

    var testRe = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[a-z0-9]+$|_test\.[a-z0-9]+$|Tests?\.cs$/i;
    add({
      id: 'q_tests', cat: 'quality', sev: 'high', points: 6,
      ok: testRe.test(paths.join('\n')),
      title: M('Нет тестов', 'No tests'),
      why: M('Без тестов любая правка — это надежда. Агенту особенно нужны тесты: это единственный способ проверить, что он ничего не сломал.',
        'Without tests every change is a hope. Agents especially need tests: it is the only way to verify nothing broke.'),
      prompt: M(
        'В репозитории {repo} нет тестов. Добавь минимальный тестовый набор для основного поведения: 3–5 тестов на самые важные функции или сценарии. ' +
        'Используй стандартный фреймворк стека. Добавь команду запуска тестов в README и в CI. Не меняй поведение приложения.',
        'The repository {repo} has no tests. Add a minimal suite for the core behaviour: 3–5 tests for the most important functions or flows. ' +
        'Use the standard framework for the stack. Add the test command to the README and CI. Do not change application behaviour.'
      )
    });

    var lintRe = /(^|\/)(\.eslintrc(\.[a-z]+)?|eslint\.config\.[a-z]+|\.prettierrc(\.[a-z]+)?|ruff\.toml|\.flake8|\.editorconfig|\.stylecop\.json|\.golangci\.ya?ml|clippy\.toml|detekt\.ya?ml|\.rubocop\.yml)$/i;
    add({
      id: 'q_lint', cat: 'quality', sev: 'low', points: 4,
      ok: lintRe.test(paths.join('\n')),
      title: M('Нет линтера и форматтера', 'No linter or formatter'),
      why: M('Стиль кода будет плавать от правки к правке, а глупые ошибки никто не поймает автоматически.',
        'Code style will drift with every change, and silly mistakes will not be caught automatically.'),
      prompt: M(
        'В репозитории {repo} нет настроек линтера и форматтера. Добавь конфиг для стека проекта (ESLint + Prettier, Ruff, dotnet format/StyleCop, gofmt + golangci-lint и т.п.), ' +
        'команды lint и format в README и шаг линтера в CI. Не переформатируй весь код одним коммитом — только настройки и минимальные правки.',
        'The repository {repo} has no linter or formatter config. Add one for the stack (ESLint + Prettier, Ruff, dotnet format/StyleCop, gofmt + golangci-lint, etc.), ' +
        'lint and format commands in the README, and a lint step in CI. Do not reformat the whole codebase in one commit — config and minimal fixes only.'
      )
    });

    var ciTestRe = /\b(npm (run )?test|yarn test|pnpm test|node --test|pytest|python -m pytest|dotnet test|go test|cargo test|mvn test|gradlew? test|phpunit|jest|vitest|ctest)\b/i;
    add({
      id: 'q_citest', cat: 'quality', sev: 'medium', points: 3,
      ok: workflows.length > 0 && ciTestRe.test(ctx.workflowText || ''),
      vars: {},
      title: M('CI не запускает тесты', 'CI does not run tests'),
      why: M('Сборка проверяется, а тесты — нет. Красные тесты спокойно доедут до пользователей.',
        'The build is checked but tests are not. Failing tests can ship to users unnoticed.'),
      prompt: M(
        'В репозитории {repo} CI не запускает тесты. Добавь в .github/workflows шаг с командой тестов проекта после установки зависимостей. ' +
        'Если тестов пока нет — сначала добавь минимальные тесты, потом шаг в CI. Убедись, что workflow проходит.',
        'CI in {repo} does not run tests. Add a step with the project’s test command after dependency installation in .github/workflows. ' +
        'If there are no tests yet, add a minimal suite first, then the CI step. Make sure the workflow passes.'
      )
    });

    var big = ctx.blobs.filter(function (b) { return b.size > 10 * 1024 * 1024; }).sort(function (a, b) { return b.size - a.size; });
    add({
      id: 'q_big', cat: 'quality', sev: 'medium', points: 2,
      ok: big.length === 0,
      vars: {
        files: big.slice(0, 3).map(function (b) { return b.path + ' (' + Math.round(b.size / 1048576) + ' МБ)'; }).join(', '),
        count: big.length
      },
      title: M('В репозитории очень большие файлы', 'Very large files in the repository'),
      why: M('Клонирование станет медленным, а git будет хранить каждую версию такого файла навсегда.',
        'Cloning becomes slow and git stores every version of such a file forever.'),
      prompt: M(
        'В репозитории {repo} есть файлы больше 10 МБ: {files}. Убери их из git (git rm --cached), добавь в .gitignore, ' +
        'а сами файлы выложи в GitHub Releases или подключи Git LFS. Историю при необходимости почисти через git filter-repo. Не ломай ссылки в README.',
        'The repository {repo} has files over 10 MB: {files}. Remove them from git (git rm --cached), add them to .gitignore, ' +
        'and ship them via GitHub Releases or Git LFS. Clean history with git filter-repo if needed. Do not break links in the README.'
      )
    });

    /* ---------- repository (15) ---------- */

    add({
      id: 'p_license', cat: 'repo', sev: 'high', points: 5,
      ok: !!repo.license,
      title: M('Нет лицензии', 'No license'),
      why: M('Без лицензии код формально «все права защищены»: никто не имеет права его использовать, даже если репозиторий публичный.',
        'Without a license the code is “all rights reserved” by default: nobody may legally use it, even in a public repository.'),
      prompt: M(
        'В репозитории {repo} нет лицензии. Добавь файл LICENSE (для открытого проекта обычно MIT), укажи год и имя автора, ' +
        'добавь короткий раздел «License» в README и бейдж лицензии. Не меняй код.',
        'The repository {repo} has no license. Add a LICENSE file (MIT is typical for open projects), put the year and author name in it, ' +
        'add a short “License” section to the README and a license badge. Do not change the code.'
      )
    });

    var hasDesc = !!(repo.description && repo.description.trim().length >= 20);
    var topics = repo.topics || [];
    var hasTopics = topics.length >= 3;
    var readmeLong = readme.trim().length >= 800;
    var hasImage = /!\[[^\]]*\]\([^)]+\)|<img\s/i.test(readme);
    var presentationPoints = (hasDesc ? 2 : 0) + (hasTopics ? 2 : 0) + (readmeLong ? 3 : 0) + (hasImage ? 1 : 0);
    var presentParts = [
      !hasDesc ? M('описание репозитория (1–2 предложения о том, что это и для кого)', 'repository description (1–2 sentences about what it is and who it is for)') : null,
      !hasTopics ? M('5–8 тем (topics), по которым проект найдут', '5–8 topics people can find the project by') : null,
      !readmeLong ? M('README длиннее 800 символов: что это, зачем, как запустить, скриншот', 'a README longer than 800 characters: what, why, how to run, screenshot') : null,
      !hasImage ? M('хотя бы один скриншот или GIF в README', 'at least one screenshot or GIF in the README') : null
    ].filter(Boolean);
    add({
      id: 'p_present', cat: 'repo', sev: 'medium', points: 8,
      ok: presentationPoints >= 8,
      vars: {
        parts: function () { return presentParts.map(pick).join('; '); },
        missing: presentationPoints
      },
      title: M('Репозиторий плохо себя презентует', 'The repository does not present itself well'),
      why: M('Человек за 10 секунд решает, остаться или уйти. Сейчас не хватает: {parts}.',
        'People decide in 10 seconds whether to stay. Currently missing: {parts}.'),
      prompt: M(
        'Улучши презентацию репозитория {repo}. Не хватает: {parts}.\n' +
        'Сделай описание в одну-две строки (что это и для кого), добавь 5–8 topics через GitHub, дополни README до понятного текста и вставь скриншот или GIF. ' +
        'Пиши по делу, без маркетингового шума. Код не меняй.',
        'Improve how {repo} presents itself. Missing: {parts}.\n' +
        'Write a one-to-two line description (what it is and who it is for), add 5–8 topics on GitHub, expand the README into a clear text, and embed a screenshot or GIF. ' +
        'Keep it factual, no marketing noise. Do not change the code.'
      )
    });

    var cyr = (readme.match(/[А-Яа-яЁё]/g) || []).length;
    var letters = (readme.match(/[A-Za-zА-Яа-яЁё]/g) || []).length;
    var cyrShare = letters > 40 ? cyr / letters : 0;
    add({
      id: 'p_en', cat: 'repo', sev: 'medium', points: 2,
      ok: readme.length > 0 && cyrShare < 0.15,
      silent: readme.length === 0,
      title: M('README не на английском', 'README is not in English'),
      why: M('Английский README открывает проект миру. Русскую версию можно оставить второй — это нормальная практика.',
        'An English README opens the project to the world. Keeping a Russian version second is a normal practice.'),
      prompt: M(
        'README в {repo} в основном на русском. Сделай основной README.md на английском, а русскую версию перенеси в README.ru.md и поставь переключатель языков в начале обоих файлов. ' +
        'Перевод должен быть точным, команды и пути не переводи. Ничего не выдумывай.',
        'The README in {repo} is mostly Russian. Make the main README.md English, move the Russian version to README.ru.md and add a language switcher at the top of both files. ' +
        'Keep the translation accurate; do not translate commands or paths. Do not invent content.'
      )
    });

    /* ---------- product (15) ---------- */

    add({
      id: 'd_home', cat: 'product', sev: 'medium', points: 5,
      ok: !!repo.homepage,
      vars: { url: repo.homepage || '' },
      title: M('Нет ссылки на демо', 'No demo link'),
      why: M('Попробовать проект нельзя без установки. Демо повышает доверие и конверсию в звёзды сильнее любого текста.',
        'There is no way to try the project without installing it. A demo builds trust and converts to stars better than any text.'),
      prompt: M(
        'У проекта {repo} нет ссылки на демо. Сделай минимальное демо (GitHub Pages, Netlify или Cloudflare Pages — бесплатные варианты), ' +
        'положи ссылку в поле Website репозитория и первой строкой в README, добавь бейдж Demo. Если демо объективно невозможно (десктопное приложение), ' +
        'приложи GIF или короткое видео и напиши, почему демо нет.',
        'The project {repo} has no demo link. Create a minimal demo (GitHub Pages, Netlify or Cloudflare Pages are free), ' +
        'put the link in the repository Website field and on the first line of the README, add a Demo badge. If a demo is genuinely impossible (desktop app), ' +
        'attach a GIF or short video and explain why.'
      )
    });

    var hasChangelog = /(^|\/)(CHANGELOG|CHANGES|HISTORY)(\.md|\.txt)?$/i.test(paths.join('\n'));
    add({
      id: 'd_releases', cat: 'product', sev: 'medium', points: 3,
      ok: ctx.releases > 0,
      title: M('Нет релизов', 'No releases'),
      why: M('Скачать нечего: нет тега и версии. Релиз — это точка, где проект можно взять и попробовать.',
        'There is nothing to download: no tag and no version. A release is the point where the project can be picked up and tried.'),
      prompt: M(
        'В репозитории {repo} нет GitHub Releases. Создай первый релиз: тег v0.1.0, заголовок, короткое описание изменений и собранный артефакт (или инструкцию запуска). ' +
        'Добавь бейдж последнего релиза в README. Если проект ещё не готов — выпусти v0.1.0 как «preview».',
        'The repository {repo} has no GitHub Releases. Create the first one: tag v0.1.0, a title, a short changelog and a built artifact (or run instructions). ' +
        'Add a latest-release badge to the README. If the project is not ready, ship v0.1.0 as a preview.'
      )
    });

    add({
      id: 'd_changelog', cat: 'product', sev: 'low', points: 2,
      ok: hasChangelog,
      title: M('Нет CHANGELOG', 'No changelog'),
      why: M('Пользователь не понимает, что изменилось между версиями, и не может решить, обновляться ли.',
        'Users cannot tell what changed between versions, so they cannot decide whether to update.'),
      prompt: M(
        'Добавь в {repo} файл CHANGELOG.md в формате Keep a Changelog: раздел Unreleased и первый релиз с датой. ' +
        'Заполни по реальным коммитам, без выдуманных пунктов. Добавь ссылку на CHANGELOG в README.',
        'Add CHANGELOG.md to {repo} in Keep a Changelog format: an Unreleased section and the first release with a date. ' +
        'Fill it from actual commits, no invented entries. Link the changelog from the README.'
      )
    });

    var hasTemplates = /(^|\/)\.github\/ISSUE_TEMPLATE\//i.test(paths.join('\n'));
    var hasDocs = /(^|\/)docs\//i.test(paths.join('\n'));
    add({
      id: 'd_docs', cat: 'product', sev: 'low', points: 4,
      ok: hasTemplates && hasDocs,
      vars: {
        parts: function () {
          return [
            !hasTemplates ? M('шаблоны issue', 'issue templates') : null,
            !hasDocs ? M('папка docs с документацией', 'a docs folder') : null
          ].filter(Boolean).map(pick).join(', ');
        }
      },
      title: M('Нет шаблонов issue и документации', 'No issue templates or docs'),
      why: M('Обратная связь приходит в хаотичном виде, а документации нет ни для пользователей, ни для агента. Не хватает: {parts}.',
        'Feedback arrives in random shapes and there is no documentation for users or agents. Missing: {parts}.'),
      prompt: M(
        'Добавь в {repo} шаблоны issue (bug report и feature request) в .github/ISSUE_TEMPLATE и папку docs с 3 короткими страницами: установка, использование, архитектура. ' +
        'Пиши по реальному коду. Ссылки на docs добавь в README.',
        'Add issue templates (bug report and feature request) under .github/ISSUE_TEMPLATE and a docs folder with three short pages: install, usage, architecture. ' +
        'Base them on the real code. Link the docs from the README.'
      )
    });

    add({
      id: 'd_shot', cat: 'product', sev: 'low', points: 1,
      ok: /(screenshot|скриншот|demo|демо|gif)/i.test(readme) && hasImage,
      silent: readme.length === 0,
      title: M('В README нет скриншота или GIF', 'No screenshot or GIF in the README'),
      why: M('Текстовое описание не показывает продукт. Один скриншот часто убеждает лучше десяти абзацев.',
        'A text description does not show the product. One screenshot often convinces better than ten paragraphs.'),
      prompt: M(
        'Добавь в README {repo} скриншот или GIF основного экрана и подпись к нему. Файл положи в docs/ или assets/, размер — до 2 МБ, ' +
        'чтобы страница быстро открывалась. Если это консольное приложение — вставь текстовый блок с примером вывода.',
        'Add a screenshot or GIF of the main screen to the README of {repo}, with a caption. Put the file in docs/ or assets/, keep it under 2 MB ' +
        'so the page loads fast. If it is a CLI, include a code block with example output instead.'
      )
    });

    /* ---------- trust (10) ---------- */

    var hasSecurity = /(^|\/)(SECURITY\.md|\.github\/SECURITY\.md)$/i.test(paths.join('\n')) ||
      /(sha-?256|checksum|контрольн|подпис|signed)/i.test(readme);
    add({
      id: 't_trust', cat: 'trust', sev: 'low', points: 4,
      ok: hasSecurity,
      title: M('Нет следов проверяемости', 'No signs of verifiability'),
      why: M('Нет ни контрольных сумм, ни политики безопасности, ни подписи бинарников. Пользователю остаётся верить на слово.',
        'No checksums, no security policy, no signed binaries. Users can only take your word for it.'),
      prompt: M(
        'Добавь в {repo} проверяемость: раздел «Безопасность» в README с SHA-256 для распространяемых файлов, SECURITY.md с тем, как сообщить об уязвимости, ' +
        'и подпись бинарников (если они есть). Для релизов приложи файл с контрольными суммами.',
        'Make {repo} verifiable: a “Security” section in the README with SHA-256 for distributed files, a SECURITY.md explaining how to report a vulnerability, ' +
        'and signed binaries if there are any. Attach a checksums file to each release.'
      )
    });

    var hasContrib = /(^|\/)(CONTRIBUTING\.md|\.github\/CONTRIBUTING\.md)$/i.test(paths.join('\n'));
    var hasCoc = /(^|\/)(CODE_OF_CONDUCT\.md|\.github\/CODE_OF_CONDUCT\.md)$/i.test(paths.join('\n'));
    add({
      id: 't_contrib', cat: 'trust', sev: 'low', points: 3,
      ok: hasContrib || hasCoc,
      vars: { parts: [ !hasContrib ? 'CONTRIBUTING.md' : null, !hasCoc ? 'CODE_OF_CONDUCT.md' : null ].filter(Boolean).join(', ') },
      title: M('Нет правил для участников', 'No contributor guidelines'),
      why: M('Непонятно, как предложить правку и какие правила действуют. Без этого первый же PR превращается в переписку.',
        'It is unclear how to propose a change or what the rules are. Without it the first PR turns into a long thread.'),
      prompt: M(
        'Добавь в {repo} файлы {parts}: как собрать проект, как запускать тесты, стиль кода, как оформить PR; и краткий кодекс поведения. ' +
        'Добавь ссылки в README. Не меняй код.',
        'Add {parts} to {repo}: how to build, how to run tests, code style, how to open a PR; plus a short code of conduct. ' +
        'Link them from the README. Do not change the code.'
      )
    });

    var hasContact = /(mailto:|contact|связ[а-я]*|support|поддержк)/i.test(readme) ||
      !!(repo.owner && repo.owner.html_url && /(^|\/)(SECURITY\.md|SUPPORT\.md)$/i.test(paths.join('\n')));
    add({
      id: 't_contact', cat: 'trust', sev: 'low', points: 3,
      ok: hasContact,
      title: M('Непонятно, как связаться', 'No way to get in touch'),
      why: M('Нет контакта для вопросов и проблем. Люди либо пишут в issue не по теме, либо уходят.',
        'There is no contact for questions and problems. People either open off-topic issues or leave.'),
      prompt: M(
        'Добавь в README {repo} раздел «Контакты»: почта или ссылка на обсуждения/чат, и куда писать про безопасность. ' +
        'Если есть GitHub Discussions — включи и дай ссылку. Не публикуй личные данные, которые не хочешь показывать.',
        'Add a “Contact” section to the README of {repo}: an email or a link to discussions/chat, and where to report security issues. ' +
        'If GitHub Discussions fits, enable it and link it. Do not publish personal data you do not want to share.'
      )
    });

    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Audit                                                               */
  /* ------------------------------------------------------------------ */

  function audit(repoRef) {
    var base = '/repos/' + repoRef.owner + '/' + repoRef.name;
    var ctx = {};

    setStatus(t('loadingRepo'));
    return api(base).then(function (repo) {
      ctx.repo = repo;
      if (!repo.size && repo.size !== 0) { /* keep going */ }
      setStatus(t('loadingTree'));
      return api(base + '/git/trees/' + encodeURIComponent(repo.default_branch) + '?recursive=1').catch(function (err) {
        if (err.kind === 'notfound') throw new HttpError(404, 'empty', 'empty');
        throw err;
      });
    }).then(function (tree) {
      var all = (tree && tree.tree) || [];
      ctx.truncated = !!(tree && tree.truncated);
      ctx.blobs = all.filter(function (x) { return x.type === 'blob'; }).map(function (x) {
        return { path: x.path, size: x.size || 0 };
      });
      ctx.paths = ctx.blobs.map(function (b) { return b.path; });
      if (!ctx.blobs.length) throw new HttpError(404, 'empty', 'empty');

      setStatus(t('loadingReadme'));
      return api(base + '/readme', { raw: true, accept: 'application/vnd.github.raw' }).catch(function (err) {
        if (err.kind === 'notfound') return '';
        throw err;
      });
    }).then(function (readme) {
      ctx.readme = readme || '';

      setStatus(t('loadingScan'));
      var candidates = ctx.blobs.filter(function (b) {
        if (b.size > 200000) return false;
        var p = b.path;
        if (!/(^|\/)(\.env(\.[A-Za-z0-9_-]+)?|config\.(js|ts|json|py)|appsettings\.json|settings\.py|secrets?\.(json|ya?ml|toml)|firebase\.json|docker-compose\.ya?ml)$/i.test(p)) return false;
        if (/\.(example|sample|template|dist)$/i.test(p)) return false;
        return true;
      }).slice(0, 4);

      var scans = candidates.map(function (b) {
        return api(base + '/contents/' + b.path.split('/').map(encodeURIComponent).join('/'), {
          raw: true, accept: 'application/vnd.github.raw'
        }).then(function (text) {
          return { path: b.path, hits: scanText(text || '') };
        }).catch(function () {
          return { path: b.path, hits: [] };
        });
      });

      return Promise.all(scans).then(function (results) {
        ctx.scanned = results;

        var wf = ctx.paths.filter(function (p) { return /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(p); })[0];
        if (!wf) { ctx.workflowText = ''; return; }
        setStatus(t('loadingScore'));
        return api(base + '/contents/' + wf.split('/').map(encodeURIComponent).join('/'), {
          raw: true, accept: 'application/vnd.github.raw'
        }).then(function (text) { ctx.workflowText = text || ''; }).catch(function () { ctx.workflowText = ''; });
      });
    }).then(function () {
      return api(base + '/releases?per_page=1').catch(function () { return []; });
    }).then(function (releases) {
      ctx.releases = Array.isArray(releases) ? releases.length : 0;
      setStatus(t('loadingScore'));

      var checks = checkGroup(ctx);
      state.ctx = ctx;
      state.checks = checks;
      computeScore();
      return true;
    });
  }

  function computeScore() {
    var total = 0;
    var cats = {};
    CATS.forEach(function (c) { cats[c.id] = { earned: 0, max: c.max }; });

    state.checks.forEach(function (ch) {
      var pts = ch.ok ? ch.points : 0;
      if (ch.ok) {
        total += ch.points;
        cats[ch.cat].earned += ch.points;
      }
    });

    state.score = Math.max(0, Math.min(100, total));
    state.catScores = cats;
    state.findings = state.checks
      .filter(function (c) { return !c.ok && !c.silent; })
      .sort(function (a, b) {
        var d = SEV_ORDER[a.sev] - SEV_ORDER[b.sev];
        if (d !== 0) return d;
        return CATS.findIndex(function (c) { return c.id === a.cat; }) - CATS.findIndex(function (c) { return c.id === b.cat; });
      });
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  function scoreColor(score) {
    if (score >= 85) return '#6ee7b7';
    if (score >= 70) return '#a3e635';
    if (score >= 50) return '#fbbf24';
    return '#f87171';
  }

  function gradeText(score) {
    if (score >= 85) return t('gradeGreat');
    if (score >= 70) return t('gradeGood');
    if (score >= 50) return t('gradeMeh');
    return t('gradeBad');
  }

  function pluralIssues(n) {
    if (state.lang === 'ru') {
      var mod10 = n % 10, mod100 = n % 100;
      if (mod10 === 1 && mod100 !== 11) return t('issueOne');
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return t('issueFew');
      return t('issueMany');
    }
    return n === 1 ? t('issueOne') : t('issueMany');
  }

  function ringSvg(score, size) {
    var r = size / 2 - 9;
    var c = 2 * Math.PI * r;
    var color = scoreColor(score);
    var offset = c * (1 - score / 100);
    return '' +
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
      '<circle class="ring-track" cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + r + '" fill="none" stroke-width="10"/>' +
      '<circle class="ring-value" cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="10" ' +
      'stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + c.toFixed(1) + '" data-final="' + offset.toFixed(1) + '"/>' +
      '</svg>';
  }

  function renderRateBadge() { renderRate(); }

  function catColor(earned, max) {
    var pct = max ? (earned / max) * 100 : 0;
    if (pct >= 85) return '#6ee7b7';
    if (pct >= 60) return '#a3e635';
    if (pct >= 35) return '#fbbf24';
    return '#f87171';
  }

  function render() {
    var ctx = state.ctx;
    if (!ctx) return;
    var repo = ctx.repo;
    var result = $('result');
    var counts = { critical: 0, high: 0, medium: 0, low: 0 };
    state.findings.forEach(function (f) { counts[f.sev]++; });

    var repoUrl = 'https://github.com/' + repo.full_name;
    var html = '';

    html += '<div class="repo-bar">' +
      '<div class="repo-name">' +
      '<img src="' + esc(repo.owner.avatar_url) + '" width="28" height="28" alt="">' +
      '<a href="' + esc(repoUrl) + '" target="_blank" rel="noopener">' + esc(repo.full_name) + '</a>' +
      (repo.language ? '<span class="muted">· ' + esc(repo.language) + '</span>' : '') +
      '</div>' +
      '<div class="repo-meta">' +
      '<span><b>' + nf(repo.stargazers_count) + '</b> ' + t('stars') + '</span>' +
      '<span><b>' + nf(repo.forks_count) + '</b> ' + t('forks') + '</span>' +
      '<span><b>' + nf(ctx.blobs.length) + '</b> ' + t('files') + '</span>' +
      '<span>' + t('updated') + ' ' + esc(dateStr(repo.pushed_at)) + '</span>' +
      '</div></div>';

    html += '<div class="scoreboard">';

    /* score card */
    html += '<div class="card score-card">' +
      '<div class="ring">' + ringSvg(state.score, 176) +
      '<div class="ring-label"><div class="ring-score" id="scoreNum" style="color:' + scoreColor(state.score) + '">0</div>' +
      '<div class="ring-max">' + esc(t('outOf')) + '</div></div></div>' +
      '<div class="grade">' + esc(gradeText(state.score)) + '</div>' +
      '</div>';

    /* summary card */
    html += '<div class="card summary-card">' +
      '<div class="summary-head"><h2>' + esc(t('summary')) + '</h2>' +
      '<span class="counts"><b>' + state.findings.length + '</b> ' + esc(pluralIssues(state.findings.length)) + '</span></div>';

    html += '<div class="bars">';
    CATS.forEach(function (cat) {
      var cs = state.catScores[cat.id];
      var pct = Math.round((cs.earned / cs.max) * 100);
      html += '<div class="bar-row">' +
        '<span class="bar-name">' + esc(t('cats')[cat.id]) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" data-pct="' + pct + '" style="background:' + catColor(cs.earned, cs.max) + '"></span></span>' +
        '<span class="bar-val">' + cs.earned + '/' + cs.max + '</span>' +
        '</div>';
    });
    html += '</div>';

    html += '<div class="actions">' +
      '<button class="ghost" id="btnCard" type="button">' + esc(t('card')) + '</button>' +
      '<button class="ghost" id="btnBadge" type="button">' + esc(t('badge')) + '</button>' +
      '<button class="ghost" id="btnAll" type="button">' + esc(t('copyAll')) + '</button>' +
      '<button class="ghost" id="btnAgain" type="button">' + esc(t('again')) + '</button>' +
      '</div>';

    html += '</div></div>'; /* summary + scoreboard */

    if (ctx.truncated) {
      html += '<p class="hint">' + esc(t('truncated')) + '</p>';
    }

    /* issues */
    html += '<div class="issues"><div class="issues-head"><h2>' + esc(t('issues')) + '</h2>' +
      '<div class="legend">' +
      '<span><i style="background:#f87171"></i>' + esc(t('severity').critical) + '</span>' +
      '<span><i style="background:#fbbf24"></i>' + esc(t('severity').high) + '</span>' +
      '<span><i style="background:#60a5fa"></i>' + esc(t('severity').medium) + '</span>' +
      '</div></div>';

    if (!state.findings.length) {
      html += '<div class="issue"><p>' + esc(t('noIssues')) + '</p></div>';
    } else {
      html += '<div class="issue-list">';
      var list = state.showAll ? state.findings : state.findings.slice(0, 8);
      list.forEach(function (f, idx) {
        var realIndex = state.findings.indexOf(f);
        html += renderIssue(f, realIndex);
      });
      html += '</div>';
      if (state.findings.length > 8) {
        html += '<button class="ghost show-all" id="btnShowAll" type="button">' +
          esc(state.showAll ? t('showLess') : fmt(t('showAll'), { n: state.findings.length })) + '</button>';
      }
    }

    html += '</div>';

    result.innerHTML = html;
    result.hidden = false;

    /* animate ring + bars (CSS transitions) + number */
    var circle = result.querySelector('.ring-value');
    var bars = result.querySelectorAll('.bar-fill');
    void result.getBoundingClientRect(); /* flush initial styles so transitions run */
    if (circle) circle.style.strokeDashoffset = circle.getAttribute('data-final');
    bars.forEach(function (el) {
      el.style.width = el.getAttribute('data-pct') + '%';
    });
    animateNumber($('scoreNum'), state.score);

    /* bind actions */
    var btnCard = $('btnCard'); if (btnCard) btnCard.addEventListener('click', downloadCard);
    var btnBadge = $('btnBadge'); if (btnBadge) btnBadge.addEventListener('click', downloadBadge);
    var btnAll = $('btnAll'); if (btnAll) btnAll.addEventListener('click', copyAll);
    var btnAgain = $('btnAgain'); if (btnAgain) btnAgain.addEventListener('click', function () {
      var repo = state.ctx.repo;
      run(repo.owner.login + '/' + repo.name);
    });
    var btnShow = $('btnShowAll'); if (btnShow) btnShow.addEventListener('click', function () {
      state.showAll = !state.showAll;
      render();
    });
  }

  function renderIssue(f, index) {
    var vars = f.vars || {};
    return '<article class="issue ' + f.sev + '">' +
      '<div class="issue-top">' +
      '<span class="sev ' + f.sev + '">' + esc(t('severity')[f.sev]) + '</span>' +
      '<span class="issue-cat">' + esc(t('cats')[f.cat]) + '</span>' +
      '</div>' +
      '<h3>' + esc(fmt(pick(f.title), vars)) + '</h3>' +
      '<p>' + esc(fmt(pick(f.why), vars)) + '</p>' +
      '<div class="issue-actions"><button class="copy" type="button" data-issue="' + index + '">' +
      esc(t('copyPrompt')) + '</button></div>' +
      '</article>';
  }

  function animateNumber(el, target) {
    if (!el) return;
    el.textContent = target; /* never leave a wrong number on screen */
    if (document.hidden || !window.requestAnimationFrame) return;
    var asked = performance.now();
    requestAnimationFrame(function first(now) {
      /* if the tab was throttled, skip the flash and keep the final value */
      if (now - asked > 300) { el.textContent = target; return; }
      var start = now;
      var dur = 800;
      function step(t) {
        var p = Math.min(1, (t - start) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = target;
      }
      step(now);
    });
  }

  function promptText(f) {
    var vars = Object.assign({ repo: state.ctx.repo.full_name, branch: state.ctx.repo.default_branch }, f.vars || {});
    return fmt(pick(f.prompt), vars);
  }

  function copyText(text, okMsg) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      toast(ok ? okMsg : t('copyFail'));
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback);
    } else {
      fallback();
    }
  }

  function copyAll() {
    var repo = state.ctx.repo.full_name;
    var header = fmt(t('promptHeader'), { repo: repo, score: state.score });
    var parts = [header, '', t('promptIntro'), ''];
    state.findings.forEach(function (f, i) {
      parts.push((i + 1) + '. [' + t('severity')[f.sev] + '] ' + fmt(pick(f.title), f.vars || {}));
      parts.push(promptText(f));
      parts.push('');
    });
    if (!state.findings.length) parts.push(t('noIssues'));
    copyText(parts.join('\n'), t('copiedAll'));
  }

  function downloadBlob(blob, filename, doneMsg) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast(doneMsg);
  }

  function drawCard() {
    var canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    var x = canvas.getContext('2d');
    var score = state.score;
    var color = scoreColor(score);
    var repo = state.ctx.repo;

    var bg = x.createLinearGradient(0, 0, 1200, 630);
    bg.addColorStop(0, '#0a0f16');
    bg.addColorStop(1, '#101a26');
    x.fillStyle = bg;
    x.fillRect(0, 0, 1200, 630);

    /* subtle grid */
    x.strokeStyle = 'rgba(120,160,205,0.06)';
    x.lineWidth = 1;
    for (var gx = 0; gx <= 1200; gx += 60) {
      x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, 630); x.stroke();
    }
    for (var gy = 0; gy <= 630; gy += 60) {
      x.beginPath(); x.moveTo(0, gy); x.lineTo(1200, gy); x.stroke();
    }

    /* glow */
    var glow = x.createRadialGradient(980, 300, 40, 980, 300, 420);
    glow.addColorStop(0, 'rgba(110,231,183,0.14)');
    glow.addColorStop(1, 'rgba(110,231,183,0)');
    x.fillStyle = glow;
    x.fillRect(600, 0, 600, 630);

    /* brand */
    x.fillStyle = color;
    x.beginPath();
    if (x.roundRect) x.roundRect(64, 54, 38, 38, 10); else x.rect(64, 54, 38, 38);
    x.fill();
    x.strokeStyle = '#06251a';
    x.lineWidth = 3.4;
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.beginPath(); x.moveTo(72, 73); x.lineTo(80, 81); x.lineTo(94, 64); x.stroke();

    x.fillStyle = '#e9f0f9';
    x.font = '600 26px "Segoe UI", system-ui, sans-serif';
    x.fillText('LaunchCheck', 116, 82);

    x.fillStyle = '#64788d';
    x.font = '400 18px ui-monospace, Consolas, monospace';
    x.fillText(('github.com/' + repo.full_name).slice(0, 64), 64, 140);

    /* repo name */
    x.fillStyle = '#e9f0f9';
    x.font = '700 52px "Segoe UI", system-ui, sans-serif';
    var title = repo.full_name;
    while (x.measureText(title).width > 680 && title.length > 6) {
      title = title.slice(0, -2);
    }
    if (title !== repo.full_name) title += '…';
    x.fillText(title, 64, 210);

    /* description */
    if (repo.description) {
      x.fillStyle = '#8fa3b8';
      x.font = '400 22px "Segoe UI", system-ui, sans-serif';
      var words = repo.description.split(/\s+/);
      var line = '';
      var lines = [];
      for (var i = 0; i < words.length; i++) {
        var test = line ? line + ' ' + words[i] : words[i];
        if (x.measureText(test).width > 640) { lines.push(line); line = words[i]; }
        else line = test;
        if (lines.length >= 2) break;
      }
      if (lines.length < 2 && line) lines.push(line);
      lines.forEach(function (l, idx) { x.fillText(l, 64, 258 + idx * 30); });
    }

    /* score ring */
    var cx = 960, cy = 300, r = 118;
    x.strokeStyle = 'rgba(140,170,200,0.16)';
    x.lineWidth = 16;
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = color;
    x.lineCap = 'round';
    x.beginPath();
    x.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * score) / 100);
    x.stroke();

    x.fillStyle = color;
    x.font = '750 92px "Segoe UI", system-ui, sans-serif';
    x.textAlign = 'center';
    x.fillText(String(score), cx, cy + 14);
    x.fillStyle = '#64788d';
    x.font = '400 16px "Segoe UI", system-ui, sans-serif';
    x.fillText('/ 100', cx, cy + 46);
    x.textAlign = 'left';

    /* bars */
    var bx = 64, by = 352, bw = 440, bh = 8, gap = 34;
    CATS.forEach(function (cat, idx) {
      var cs = state.catScores[cat.id];
      var yy = by + idx * gap;
      x.fillStyle = '#8fa3b8';
      x.font = '400 17px "Segoe UI", system-ui, sans-serif';
      x.fillText(t('cats')[cat.id], bx, yy);
      x.fillStyle = 'rgba(140,170,200,0.14)';
      x.beginPath();
      if (x.roundRect) x.roundRect(bx + 170, yy - 13, bw, bh, 4); else x.rect(bx + 170, yy - 13, bw, bh);
      x.fill();
      x.fillStyle = catColor(cs.earned, cs.max);
      var w = Math.max(2, (bw * cs.earned) / cs.max);
      x.beginPath();
      if (x.roundRect) x.roundRect(bx + 170, yy - 13, w, bh, 4); else x.rect(bx + 170, yy - 13, w, bh);
      x.fill();
      x.fillStyle = '#64788d';
      x.font = '400 15px ui-monospace, Consolas, monospace';
      x.fillText(cs.earned + '/' + cs.max, bx + 170 + bw + 14, yy + 1);
    });

    /* footer */
    x.fillStyle = '#64788d';
    x.font = '400 16px "Segoe UI", system-ui, sans-serif';
    x.fillText(fmt(t('cardFooter'), { host: location.host || 'launchcheck' }), 64, 588);
    x.textAlign = 'right';
    x.fillText(dateStr(new Date().toISOString()), 1136, 588);
    x.textAlign = 'left';

    return canvas;
  }

  function downloadCard() {
    var canvas = drawCard();
    if (canvas.toBlob) {
      canvas.toBlob(function (blob) {
        if (blob) downloadBlob(blob, slug(state.ctx.repo.name) + '-launchcheck.png', t('cardDone'));
      }, 'image/png');
    } else {
      var a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = slug(state.ctx.repo.name) + '-launchcheck.png';
      a.click();
      toast(t('cardDone'));
    }
  }

  function badgeSvg() {
    var score = state.score;
    var color = scoreColor(score);
    var label = 'launchcheck';
    var value = score + '/100';
    var w = 210;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="28" role="img" aria-label="' + label + ': ' + value + '">' +
      '<title>' + label + ': ' + value + '</title>' +
      '<rect width="' + w + '" height="28" rx="6" fill="#0b1119"/>' +
      '<rect x="98" width="' + (w - 98) + '" height="28" rx="6" fill="' + color + '"/>' +
      '<rect x="98" width="12" height="28" fill="' + color + '"/>' +
      '<g fill="#06251a" font-family="Segoe UI, system-ui, sans-serif" font-size="12" font-weight="600">' +
      '<text x="14" y="18">' + label + '</text></g>' +
      '<g fill="#06251a" font-family="ui-monospace, Consolas, monospace" font-size="12" font-weight="700">' +
      '<text x="112" y="18">' + value + '</text></g>' +
      '</svg>';
  }

  function downloadBadge() {
    var svg = badgeSvg();
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'launchcheck-badge.svg', t('badgeDone'));
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'repo';
  }

  /* ------------------------------------------------------------------ */
  /* Flow                                                                */
  /* ------------------------------------------------------------------ */

  function fail(err) {
    var msg;
    if (err && err.kind === 'notfound') msg = t('errNotFound');
    else if (err && err.kind === 'empty') msg = t('errEmpty');
    else if (err && err.kind === 'rate') msg = fmt(t('errRate'), { time: state.rate ? hhmm(state.rate.reset) : '—' });
    else if (err && err.kind === 'auth') msg = t('errAuth');
    else if (err && err.kind === 'input') msg = t('errInput');
    else msg = fmt(t('errGeneric'), { msg: (err && err.message) || 'unknown' });

    setStatus(msg, true);
    $('result').hidden = true;
  }

  function run(input) {
    if (state.busy) return;
    var ref = parseRepo(input);
    if (!ref) {
      fail(new HttpError(400, 'input', 'input'));
      return;
    }

    setBusy(true);
    $('result').hidden = true;
    setStatus(t('loadingRepo'));

    audit(ref).then(function () {
      setBusy(false);
      setStatus('');
      state.showAll = false;
      render();
      try {
        localStorage.setItem(LS.last, ref.owner + '/' + ref.name);
        var url = new URL(location.href);
        url.searchParams.set('repo', ref.owner + '/' + ref.name);
        history.replaceState(null, '', url.toString());
        document.title = ref.owner + '/' + ref.name + ' · LaunchCheck';
      } catch (e) { /* ignore */ }
      $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (err) {
      setBusy(false);
      fail(err);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Language, settings, init                                            */
  /* ------------------------------------------------------------------ */

  function applyLang(lang) {
    state.lang = lang === 'en' ? 'en' : 'ru';
    document.documentElement.lang = state.lang;
    document.body.className = 'lang-' + state.lang;
    $('langBtn').textContent = state.lang === 'ru' ? 'EN' : 'RU';

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = t(key);
      if (val) el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      var val = t(key);
      if (val) el.innerHTML = val;
    });

    try { localStorage.setItem(LS.lang, state.lang); } catch (e) { }

    if (state.ctx) {
      computeScore();
      render();
    }
    renderRate();
  }

  function openSettings() {
    $('tokenInput').value = state.token;
    $('tokenStatus').textContent = '';
    $('modal').hidden = false;
    $('tokenInput').focus();
  }
  function closeSettings() {
    var next = $('tokenInput').value.trim();
    if (next !== state.token) {
      state.token = next;
      try {
        if (state.token) localStorage.setItem(LS.token, state.token);
        else localStorage.removeItem(LS.token);
      } catch (e) { }
      if (state.token) checkToken(false);
    }
    $('modal').hidden = true;
  }

  function checkToken(silent) {
    var token = $('tokenInput').value.trim();
    if (!token) { $('tokenStatus').textContent = ''; return; }
    var headers = { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token };
    fetch(API + '/user', { headers: headers }).then(function (res) {
      var rem = res.headers.get('x-ratelimit-limit');
      if (!res.ok) throw new Error('bad');
      return res.json().then(function (u) {
        $('tokenStatus').textContent = fmt(t('tokenOk'), { login: u.login, limit: rem || '5000' });
        if (state.token === token && rem) {
          state.rate = { remaining: parseInt(res.headers.get('x-ratelimit-remaining') || '0', 10), limit: parseInt(rem, 10), reset: parseInt(res.headers.get('x-ratelimit-reset') || '0', 10) };
          renderRate();
        }
        return true;
      });
    }).catch(function () {
      if (!silent) $('tokenStatus').textContent = t('tokenBad');
    });
  }

  function init() {
    try {
      state.lang = localStorage.getItem(LS.lang) === 'en' ? 'en' : 'ru';
      state.token = localStorage.getItem(LS.token) || '';
    } catch (e) { }

    applyLang(state.lang);

    var examples = ['TIZZ13/FakeWinLocker', 'ossf/scorecard', 'sveltejs/svelte'];
    var chips = $('chips');
    examples.forEach(function (ex) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = ex;
      b.addEventListener('click', function () {
        $('repoInput').value = ex;
        run(ex);
      });
      chips.appendChild(b);
    });

    $('form').addEventListener('submit', function (e) {
      e.preventDefault();
      run($('repoInput').value);
    });

    $('langBtn').addEventListener('click', function () {
      applyLang(state.lang === 'ru' ? 'en' : 'ru');
    });

    $('settingsBtn').addEventListener('click', openSettings);
    $('modalClose').addEventListener('click', closeSettings);
    $('tokenClear').addEventListener('click', function () {
      $('tokenInput').value = '';
      state.token = '';
      try { localStorage.removeItem(LS.token); } catch (e) { }
      $('tokenStatus').textContent = '';
      toast(t('tokenClear'));
    });
    $('tokenCheck').addEventListener('click', function () { checkToken(false); });
    $('modal').addEventListener('click', function (e) {
      if (e.target === $('modal')) closeSettings();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('modal').hidden) closeSettings();
    });

    $('ghLink').href = 'https://github.com/' + (location.hostname.split('.')[0] === 'tizz13' ? 'TIZZ13/launchcheck' : 'TIZZ13/launchcheck');

    /* deep link + last repo */
    var params = new URLSearchParams(location.search);
    var deep = params.get('repo');
    var last = deep || null;
    if (!last) { try { last = localStorage.getItem(LS.last); } catch (e) { } }
    if (last) {
      $('repoInput').value = last;
      if (deep) run(deep);
    }

    renderRate();
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.copy') : null;
      if (!btn) return;
      var idx = parseInt(btn.getAttribute('data-issue'), 10);
      var f = state.findings[idx];
      if (!f) return;
      copyText(promptText(f), t('copied'));
    });
  }

  /* Exported for the Node test runner. The browser never sees this branch. */
  if (typeof module !== 'undefined' && module.exports && typeof document === 'undefined') {
    module.exports = { parseRepo: parseRepo, scanText: scanText, fmt: fmt };
    return;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
