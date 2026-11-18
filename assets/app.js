/* GitHub Checker — static GitHub repository audit.
   No build step, no dependencies, no backend.
   The page talks to api.github.com and, in downloader mode only, to the
   public AlienVault OTX indicator API (a file hash at a time, never a file). */
(function () {
  'use strict';

  var API = 'https://api.github.com';
  var LS = { token: 'githubchecker.token', lang: 'githubchecker.lang', last: 'githubchecker.last', mode: 'githubchecker.mode' };

  /* The project used to be called LaunchCheck. Reading the old keys means an
     existing visitor keeps their language, mode and token after the rename. */
  var LS_OLD = { token: 'launchcheck.token', lang: 'launchcheck.lang', last: 'launchcheck.last', mode: 'launchcheck.mode' };

  function storeGet(key) {
    try {
      var v = localStorage.getItem(key);
      if (v === null && LS_OLD[key]) v = localStorage.getItem(LS_OLD[key]);
      return v;
    } catch (e) { return null; }
  }

  function storeSet(key, value) {
    try {
      localStorage.setItem(key, value);
      if (LS_OLD[key]) localStorage.removeItem(LS_OLD[key]);
    } catch (e) { }
  }

  function storeDel(key) {
    try {
      localStorage.removeItem(key);
      if (LS_OLD[key]) localStorage.removeItem(LS_OLD[key]);
    } catch (e) { }
  }

  var state = {
    lang: 'ru',
    mode: 'dev',
    token: '',
    busy: false,
    ctx: null,
    checks: [],
    findings: [],
    skipped: [],
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
      pageTitle: 'GitHub Checker — проверь репозиторий до того, как его увидят',
      h1: 'Проверь проект<br>до того, как его <em>увидят</em>',
      lead: 'Вставь ссылку на GitHub-репозиторий. Выбери, кто ты: автор проекта или человек, который собирается его скачать. Получи оценку, понятные объяснения и точные шаги.',
      noteHead: 'Полевая заметка 01',
      noteTitle: 'Три вопроса, на которые отвечает отчёт',
      note1: 'Запустится ли проект с чистого клона?',
      note2: 'Нет ли в репозитории секретов?',
      note3: 'Поверит ли этому незнакомый человек?',
      noteFoot: '2 режима · 23 правила · без ИИ',
      modeGroup: 'Режим проверки',
      modeDev: 'Автор проекта',
      modeDevSub: 'что починить',
      modeUser: 'Скачиваю',
      modeUserSub: 'стоит ли доверять',
      modeBlurbDev: 'Проверка перед публикацией: что мешает проекту выглядеть готовым и что исправить в первую очередь.',
      modeBlurbUser: 'Проверка перед скачиванием: что известно о коде, файлах и репутации проекта. Это не проверка на вирусы.',
      modeFlagDev: 'Проверка автора',
      modeFlagUser: 'Проверка перед скачиванием',
      modeShortDev: 'AUTHOR',
      modeShortUser: 'DOWNLOADER',
      check: 'Проверить',
      hint: 'Работает с публичными репозиториями. Приватные — добавь токен в настройках.',
      placeholder: 'owner/repo или ссылка на GitHub',
      settings: 'Настройки',
      tokenLabel: 'GitHub token (необязательно)',
      tokenHelp: 'Нужен для приватных репозиториев и лимита 5000 запросов в час вместо 60. Хранится только в localStorage этого браузера и уходит только на api.github.com. Хватит scope public_repo.',
      tokenCheck: 'Проверить токен',
      tokenClear: 'Удалить токен',
      done: 'Готово',
      foot: 'GitHub Checker · статический сайт на GitHub Pages',
      loadingRepo: 'Читаю репозиторий…',
      loadingTree: 'Смотрю файлы…',
      loadingReadme: 'Читаю README…',
      loadingScan: 'Читаю код и конфиги…',
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
      issuesUser: 'На что обратить внимание',
      noIssues: 'Проблем не найдено. Хороший знак — но глазами всё равно проверь.',
      noIssuesUser: 'Явных проблем не найдено. Это не гарантия безопасности: проверь файл на VirusTotal и запусти в Sandbox.',
      issueOne: 'проблема',
      issueFew: 'проблемы',
      issueMany: 'проблем',
      actionLabel: 'Что сделать',
      copyPrompt: 'Скопировать промпт',
      copyStep: 'Скопировать шаг',
      copyAll: 'Скопировать все промпты',
      copyNote: 'Скопировать памятку',
      copyAllNote: 'Скопировать памятки',
      profileHead: 'Что это за проект',
      profileNote: 'Правила ниже подстроены под этот тип проекта.',
      profileNoteUnknown: 'Тип проекта определить точно не удалось — правила применены без поправок.',
      skippedLabel: 'Не оценивалось',
      safetyHead: 'Проверка файлов',
      safetyIntro: 'GitHub Checker читает код и метаданные. Он не скачивает и не запускает файлы.',
      safetySourceOpen: 'Исходный код открыт: прочитано {n}.',
      safetySourceClosed: 'Исходный код закрыт: о содержимом можно судить только по базам и песочницам.',
      safetyNoNetwork: 'В проверенных файлах нет сетевых запросов.',
      safetyNetwork: 'В коде есть сетевые запросы: программа может связываться с интернетом.',
      safetyDeclared: 'README предупреждает о поведении: {items}. Это заявлено, а не скрыто.',
      safetyNoChecksums: 'Контрольных сумм и подписи нет: целостность файла проверить нечем.',
      safetyUnsigned: 'Файл не подписан — Windows SmartScreen может предупредить. Это не признак вируса, но и не подтверждение безопасности.',
      safetyArchive: 'Релиз лежит в архиве с паролем: антивирус не увидит содержимое, пока ты его не распакуешь.',
      safetyAdmin: 'Программа просит права администратора — это даёт ей широкий доступ к системе.',
      safetyNoScan: 'Файлы из релизов не проверены антивирусом.',
      safetyNoFiles: 'В релизах нет готовых файлов: скачивать нечего, код ставится из исходников или через пакетный менеджер.',
      safetySite: 'Это сайт: устанавливать ничего не нужно, он открывается в браузере.',
      safetyVt: 'Проверь скачанный файл на VirusTotal — это бесплатно.',
      safetyVtBtn: 'Открыть VirusTotal',
      safetyNotGuarantee: 'Это не гарантия безопасности. Решение запускать файл всегда за тобой.',
      liveHead: 'Живая проверка файлов',
      liveSource: 'AlienVault OTX',
      liveNote: 'Хеш каждого файла сверяется с AlienVault OTX: отчёты сообщества и вердикты ClamAV, Microsoft Defender и правил YARA. Файл не скачивается — уходит только хеш.',
      liveLoading: 'Проверяю…',
      liveWaiting: 'В очереди',
      liveThreat: 'Движки нашли угрозу',
      livePulse: 'Есть упоминания',
      liveUnknown: 'Нет данных',
      liveFailed: 'Не удалось проверить',
      liveEngines: 'Сработало правил: {n} — {list}',
      livePulses: 'Упоминается в отчётах сообщества: {n}',
      liveUnknownNote: 'Хеш не встречается в отчётах OTX. Это «неизвестно», а не «чисто».',
      liveNoDigest: 'GitHub не отдал SHA-256 для этого файла.',
      liveErrorNote: 'Сервис не ответил. Проверь файл по ссылкам вручную.',
      liveLimit: 'Сервис ограничил запросы, попробуй позже.',
      liveNotScore: 'Живая проверка не влияет на балл: балл считается только по правилам и не меняется со временем.',
      liveVt: 'VirusTotal',
      liveOtx: 'Отчёт OTX',
      liveCopyHash: 'Скопировать хеш',
      liveCopied: 'Хеш скопирован',
      liveCheckAgain: 'Проверить ещё раз',
      liveNoTargets: 'В релизах нет файлов с хешем — проверять по хешу нечего.',
      liveProgress: 'Проверено {n} из {m}',
      unitMb: 'МБ', unitKb: 'КБ', unitB: 'Б',
      userHeader: 'GitHub Checker — проверка перед скачиванием: {repo}, {score}/100',
      userIntro: 'Это не гарантия безопасности и не проверка на вирусы. Ниже — что известно о проекте и что стоит сделать перед запуском.',
      gradesUser: { great: 'Можно пробовать осторожно', good: 'Сначала проверь', meh: 'Много вопросов', bad: 'Лучше не запускать' },
      card: 'Скачать карточку',
      badge: 'Скачать бейдж',
      again: 'Проверить снова',
      showAll: 'Показать все ({n})',
      showLess: 'Свернуть',
      copied: 'Скопировано',
      copiedAll: 'Все промпты скопированы',
      copiedAllNote: 'Все памятки скопированы',
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
      promptHeader: 'GitHub Checker — отчёт для {repo}: {score}/100',
      promptIntro: 'Ниже список проблем по порядку важности. Исправь их по одной, не меняя остальное поведение проекта.',
      cardFooter: 'github checker · {host}',
      cta: 'GitHub Checker бесплатный, без рекламы и без регистрации. Если он помог — поставь звезду на GitHub, это помогает проекту.',
      ctaBtn: 'Поставить звезду'
    },
    en: {
      kicker: 'Free · no install · no signup',
      pageTitle: 'GitHub Checker — audit your repository before people see it',
      h1: 'Check your project<br>before people <em>see it</em>',
      lead: 'Paste a GitHub repository link. Choose who you are: the author, or someone about to download it. Get a score, plain explanations, and exact next steps.',
      noteHead: 'Field note 01',
      noteTitle: 'Three questions the report answers',
      note1: 'Does it run from a clean clone?',
      note2: 'Is anything secret sitting in the tree?',
      note3: 'Would a stranger trust it on sight?',
      noteFoot: '2 modes · 23 rules · no AI',
      modeGroup: 'Audit mode',
      modeDev: 'I am the author',
      modeDevSub: 'what to fix',
      modeUser: 'I am downloading',
      modeUserSub: 'should I trust it',
      modeBlurbDev: 'A check before publishing: what keeps the project from looking ready, and what to fix first.',
      modeBlurbUser: 'A check before downloading: what is known about the code, files and reputation. This is not a virus scan.',
      modeFlagDev: 'Author audit',
      modeFlagUser: 'Download check',
      modeShortDev: 'AUTHOR',
      modeShortUser: 'DOWNLOADER',
      check: 'Check',
      hint: 'Works with public repositories. For private ones, add a token in settings.',
      placeholder: 'owner/repo or a GitHub link',
      settings: 'Settings',
      tokenLabel: 'GitHub token (optional)',
      tokenHelp: 'Needed for private repositories and for 5000 requests/hour instead of 60. Stored only in this browser’s localStorage and sent only to api.github.com. The public_repo scope is enough.',
      tokenCheck: 'Check token',
      tokenClear: 'Remove token',
      done: 'Done',
      foot: 'GitHub Checker · a static site on GitHub Pages',
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
      issuesUser: 'What to watch for',
      noIssues: 'No problems found. Good sign — but still look at it with your own eyes.',
      noIssuesUser: 'No obvious problems found. This is not a safety guarantee: check the file on VirusTotal and run it in a sandbox.',
      issueOne: 'issue',
      issueFew: 'issues',
      issueMany: 'issues',
      actionLabel: 'What to do',
      copyPrompt: 'Copy prompt',
      copyStep: 'Copy step',
      copyAll: 'Copy all prompts',
      copyNote: 'Copy checklist',
      copyAllNote: 'Copy all steps',
      profileHead: 'What this project is',
      profileNote: 'The rules below are adjusted to this kind of project.',
      profileNoteUnknown: 'The project type could not be determined reliably, so the rules were applied without adjustments.',
      skippedLabel: 'Not scored',
      safetyHead: 'File check',
      safetyIntro: 'GitHub Checker reads code and metadata. It does not download or run any files.',
      safetySourceOpen: 'The source is open: {n} read.',
      safetySourceClosed: 'The source is closed: only threat databases and sandboxes can tell what is inside.',
      safetyNoNetwork: 'The files that were read make no network requests.',
      safetyNetwork: 'The code makes network requests: the program may talk to the internet.',
      safetyDeclared: 'The README warns about this behaviour: {items}. It is declared, not hidden.',
      safetyNoChecksums: 'There are no checksums and no signature: there is no way to verify the file’s integrity.',
      safetyUnsigned: 'The file is not signed — Windows SmartScreen may warn you. That is not a sign of a virus, but it is not proof of safety either.',
      safetyArchive: 'The release is a password-protected archive: antivirus cannot see inside until you unpack it.',
      safetyAdmin: 'The program asks for administrator rights — that gives it broad access to the system.',
      safetyNoScan: 'The release files were not scanned by antivirus.',
      safetyNoFiles: 'There are no ready-made files in the releases: there is nothing to download, the code is installed from source or through a package manager.',
      safetySite: 'This is a website: there is nothing to install, it opens in the browser.',
      safetyVt: 'Check the downloaded file on VirusTotal — it is free.',
      safetyVtBtn: 'Open VirusTotal',
      safetyNotGuarantee: 'This is not a safety guarantee. The decision to run a file is always yours.',
      liveHead: 'Live file check',
      liveSource: 'AlienVault OTX',
      liveNote: 'Each file hash is looked up in AlienVault OTX: community reports and verdicts from ClamAV, Microsoft Defender and YARA rules. The file is never downloaded — only the hash leaves the browser.',
      liveLoading: 'Checking…',
      liveWaiting: 'Queued',
      liveThreat: 'Engines detected a threat',
      livePulse: 'Reports mention it',
      liveUnknown: 'No data',
      liveFailed: 'Check failed',
      liveEngines: 'Rules that fired: {n} — {list}',
      livePulses: 'Community reports mentioning it: {n}',
      liveUnknownNote: 'The hash does not appear in OTX reports. That means unknown, not clean.',
      liveNoDigest: 'GitHub did not provide a SHA-256 for this file.',
      liveErrorNote: 'The service did not answer. Check the file through the links yourself.',
      liveLimit: 'The service rate-limited the requests, try again later.',
      liveNotScore: 'The live check does not affect the score: the score comes from the rules alone and does not change over time.',
      liveVt: 'VirusTotal',
      liveOtx: 'OTX report',
      liveCopyHash: 'Copy hash',
      liveCopied: 'Hash copied',
      liveCheckAgain: 'Check again',
      liveNoTargets: 'The releases have no file with a hash — there is nothing to look up.',
      liveProgress: 'Checked {n} of {m}',
      unitMb: 'MB', unitKb: 'KB', unitB: 'B',
      userHeader: 'GitHub Checker — pre-download check: {repo}, {score}/100',
      userIntro: 'This is not a safety guarantee and not a virus scan. Below is what is known about the project and what to do before running it.',
      gradesUser: { great: 'Try with care', good: 'Check first', meh: 'Many questions', bad: 'Better not run' },
      card: 'Download card',
      badge: 'Download badge',
      again: 'Check again',
      showAll: 'Show all ({n})',
      showLess: 'Collapse',
      copied: 'Copied',
      copiedAll: 'All prompts copied',
      copiedAllNote: 'All steps copied',
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
      promptHeader: 'GitHub Checker report for {repo}: {score}/100',
      promptIntro: 'Below are the problems in order of importance. Fix them one by one without changing the rest of the project.',
      cardFooter: 'github checker · {host}',
      cta: 'GitHub Checker is free, ad-free and needs no signup. If it helped, star it on GitHub — that is how the project grows.',
      ctaBtn: 'Star on GitHub'
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

  var PROFILES = {
    dev: {
      id: 'dev',
      cats: [
        { id: 'security', max: 25 },
        { id: 'runnable', max: 20 },
        { id: 'quality', max: 15 },
        { id: 'repo', max: 15 },
        { id: 'product', max: 15 },
        { id: 'trust', max: 10 }
      ]
    },
    user: {
      id: 'user',
      cats: [
        { id: 'security', max: 28 },
        { id: 'runnable', max: 15 },
        { id: 'quality', max: 15 },
        { id: 'repo', max: 10 },
        { id: 'product', max: 20 },
        { id: 'trust', max: 12 }
      ]
    }
  };

  /* Kept for the report card. */
  var CATS = PROFILES.dev.cats;

  var SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

  var CODE_RE = /\.(cs|fs|vb|py|js|jsx|ts|tsx|go|rs|c|h|cc|cpp|hpp|java|kt|kts|swift|m|mm|rb|php|lua|pl|sh|ps1|bat|cmd|ahk|dart|ex|exs|clj|scala|nim|zig|sol)$/i;
  var TEST_RE = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[a-z0-9]+$|_test\.[a-z0-9]+$|Tests?\.cs$/im;
  var BINARY_ASSET_RE = /\.(exe|msi|msix|dmg|pkg|appimage|deb|rpm|apk|ipa|7z|zip|rar|tar\.gz|tgz)$/i;
  var MEDIA_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg|mp3|wav|ogg|flac|mp4|webm|mov|mkv|psd|blend|fbx)$/i;
  var VISUAL_RE = /\.(png|jpe?g|gif|webp|avif|svg|mp4|webm|mov)$/i;

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
        if (p.kind === 'hardcoded credential') {
          var lit = /['"]([^'"]*)['"]\s*$/.exec(value);
          /* Reject dotted identifiers such as localStorage keys: a real secret
             is not shaped like `githubchecker.token`. */
          if (lit && /^[a-z][\w-]*(\.[a-z][\w-]*)+$/i.test(lit[1])) continue;
        }
        hits.push(p.kind);
        break; /* one hit per pattern per file is enough */
      }
    }
    return hits;
  }

  function pathsMatching(paths, re) {
    return paths.filter(function (p) { return re.test(p); });
  }

  function textHas(s, re) { re.lastIndex = 0; return re.test(s || ''); }

  function uniq(arr) {
    return arr.filter(function (v, i, a) { return a.indexOf(v) === i; });
  }

  function extOf(p) {
    var m = /\.([A-Za-z0-9]+)$/.exec(p || '');
    return m ? m[1].toLowerCase() : '';
  }

  function readmeImages(readme) {
    var out = [];
    var m;
    var re = /!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
    while ((m = re.exec(readme))) out.push(m[1]);
    var re2 = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
    while ((m = re2.exec(readme))) out.push(m[1]);
    return out.filter(function (u) {
      return !/(shields\.io|badgen\.net|badge\.fury|travis|codecov|coveralls|appveyor|circleci|discord|npmjs\.com|visitor|hits\.sexy|badge)/i.test(u);
    });
  }

  function readmeLangInfo(readme, paths) {
    var noCode = String(readme || '').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ');
    var cyr = (noCode.match(/[А-Яа-яЁё]/g) || []).length;
    var lat = (noCode.match(/[A-Za-z]/g) || []).length;
    var total = cyr + lat;
    var pathText = (paths || []).join('\n');
    var enHeading = /(^|\n)#{1,4}\s*(EN|ENG|English|English version)\s*($|\n)/i.test(noCode) ||
      /\[(English|EN)\]\([^)]*\)/i.test(noCode);
    var ruHeading = /(^|\n)#{1,4}\s*(RU|РУС|Русский)\s*($|\n)/i.test(noCode) ||
      /\[(Русский|RU)\]\([^)]*\)/i.test(noCode);
    var hasEnFile = /(^|\/)README[._-]?(en|eng|english)\.[A-Za-z0-9]+$/im.test(pathText);
    var hasRuFile = /(^|\/)README[._-]?(ru|rus|russian|рус)[^/]*$/im.test(pathText);
    var cyrShare = total ? cyr / total : 0;
    var latinProse = /[A-Za-z][^\n]{60,}/.test(noCode);
    var bilingual = enHeading || hasEnFile || (cyrShare > 0.12 && latinProse);
    return {
      cyrShare: cyrShare,
      letters: total,
      enHeading: enHeading,
      ruHeading: ruHeading,
      hasEnFile: hasEnFile,
      hasRuFile: hasRuFile,
      bilingual: bilingual,
      main: cyrShare >= 0.35 ? 'ru' : cyrShare <= 0.12 ? 'en' : 'mixed'
    };
  }

  var CLAIM_STOP = {};
  ('the and for with from that this into your you our their they will can are was were has have had not but all any how what when where which who why its it is of to in on at by as or be a an ' +
    'это для как что или его она они был была были есть нет все еще уже так тот эта эти при над под без про через свой своя свои ' +
    'project repo repository app application tool library program программа проект репозиторий приложение утилита').split(/\s+/).forEach(function (w) {
    if (w) CLAIM_STOP[w] = 1;
  });

  function scriptShare(text) {
    var cyr = (String(text || '').match(/[А-Яа-яЁё]/g) || []).length;
    var lat = (String(text || '').match(/[A-Za-z]/g) || []).length;
    var total = cyr + lat;
    if (!total) return 'none';
    if (cyr / total > 0.4) return 'cyr';
    if (lat / total > 0.8) return 'lat';
    return 'mixed';
  }

  function claimsMatch(repo, readme) {
    var source = ((repo && repo.description) || '') + ' ' + ((repo && repo.topics) || []).join(' ');
    var words = uniq((source.toLowerCase().match(/[a-zа-яё0-9][a-zа-яё0-9_.-]{3,}/gi) || []).filter(function (w) {
      return !CLAIM_STOP[w] && !/^\d+$/.test(w);
    }));
    if (words.length < 3) return { ok: true, ratio: 1, checked: words.length, words: [], mismatch: false };

    /* A Russian description next to an English README cannot be compared word by word. */
    var descScript = scriptShare((repo && repo.description) || '');
    var readmeScript = scriptShare(readme);
    if (descScript !== 'none' && readmeScript !== 'none' &&
      descScript !== 'mixed' && readmeScript !== 'mixed' && descScript !== readmeScript) {
      return { ok: true, ratio: 1, checked: words.length, words: [], mismatch: true };
    }

    var hay = String(readme || '').toLowerCase();
    var found = words.filter(function (w) {
      var stem = w.length > 5 ? w.slice(0, 5) : w;
      return hay.indexOf(stem) >= 0;
    });
    return {
      ok: found.length / words.length >= 0.5,
      ratio: found.length / words.length,
      checked: words.length,
      words: words,
      found: found,
      mismatch: false
    };
  }

  function detectStack(paths, language) {
    var counts = {};
    paths.forEach(function (p) {
      var e = extOf(p);
      if (!e) return;
      counts[e] = (counts[e] || 0) + 1;
    });
    var best = '';
    var bestN = 0;
    Object.keys(counts).forEach(function (e) {
      if (counts[e] > bestN) { bestN = counts[e]; best = e; }
    });
    var map = {
      cs: 'C# / .NET', fs: 'F# / .NET', vb: 'VB.NET', py: 'Python', js: 'JavaScript', jsx: 'JavaScript',
      ts: 'TypeScript', tsx: 'TypeScript', go: 'Go', rs: 'Rust', c: 'C', h: 'C', cc: 'C++', cpp: 'C++',
      hpp: 'C++', java: 'Java', kt: 'Kotlin', kts: 'Kotlin', swift: 'Swift', rb: 'Ruby', php: 'PHP',
      lua: 'Lua', sh: 'Shell', ps1: 'PowerShell', bat: 'Batch', cmd: 'Batch', ahk: 'AutoHotkey',
      dart: 'Dart', ex: 'Elixir', exs: 'Elixir', clj: 'Clojure', scala: 'Scala', nim: 'Nim', zig: 'Zig',
      sol: 'Solidity', vue: 'Vue', svelte: 'Svelte', html: 'HTML'
    };
    return map[best] || language || '—';
  }

  function detectPlatform(pathText, hay, assets, kind) {
    var os = {};
    var names = assets.map(function (a) { return a.name; }).join(' ');
    if (/\.(exe|msi|msix)$/i.test(names) || /\.(csproj|sln|xaml|vcxproj)$/im.test(pathText) || /\bwindows\b|win32|win64|настольн.*windows/i.test(hay)) os.windows = 1;
    if (/\.(dmg|pkg)$/i.test(names) || /\bmacos\b|\bmac os\b|osx/i.test(hay)) os.macos = 1;
    if (/\.(appimage|deb|rpm)$/i.test(names) || /\blinux\b|ubuntu|debian|fedora/i.test(hay)) os.linux = 1;
    if (kind === 'web') return 'web';
    var keys = Object.keys(os);
    if (!keys.length) return 'unknown';
    if (keys.length > 1) return 'cross';
    return keys[0];
  }

  function detectKind(ctx, pathText, hay, assets, platform, codeFiles) {
    var mdCount = ctx.paths.filter(function (p) { return /\.(md|markdown|rst|txt)$/i.test(p); }).length;
    if (!codeFiles.length && mdCount >= 3) return 'docs';

    var desktopMarkers = /(^|\/)([^/]+\.(csproj|sln|xaml|vcxproj|pbxproj)|tauri\.conf\.json|electron-builder\.(json|ya?ml))$/im.test(pathText);
    var desktopWords = /\b(desktop|windows app|macos app|gui app|tray app|native app)\b|настольн|десктоп/i.test(hay);
    var gameWords = /\b(game|unity|godot|unreal|minecraft mod|game mod)\b|игр[аыу]|мод для игр/i.test(hay);
    var libWords = /\b(library|component library|sdk|framework|ui kit|design system|package)\b|библиотек|компонент|фреймворк|пакет/i.test(hay);
    var webMarkers = /(^|\/)(index\.html?|vite\.config\.[a-z]+|next\.config\.[a-z]+|nuxt\.config\.[a-z]+|svelte\.config\.[a-z]+|astro\.config\.[a-z]+|angular\.json|gatsby-config\.[a-z]+|remix\.config\.[a-z]+)$/im.test(pathText);
    var cliWords = /\b(cli|command[- ]line|terminal tool|console app)\b|консольн|командн(ая|ой) строк/i.test(hay);
    var cliMarkers = /(^|\/)(cmd\/[^/]+\/main\.go|src\/main\.rs|main\.go|__main__\.py)$/im.test(pathText) || /\bconsole_scripts\b/.test(ctx.packageText || '');
    var botWords = /\b(bot|telegram bot|discord bot)\b|бот\b/i.test(hay);

    if (gameWords) return 'game';
    if (desktopMarkers || desktopWords || (assets.length && platform !== 'web' && platform !== 'unknown')) return 'desktop';
    if (libWords && !cliWords) return 'library';
    if (webMarkers) return 'web';
    if (cliWords || cliMarkers) return 'cli';
    if (botWords) return 'bot';
    return 'other';
  }

  function detectProfile(ctx) {
    var paths = ctx.paths || [];
    var pathText = ctx.pathText || (ctx.pathText = paths.join('\n'));
    var readme = ctx.readme || '';
    var repo = ctx.repo || {};
    var desc = repo.description || '';
    var topics = repo.topics || [];
    var declaredText = (desc + ' ' + topics.join(' ') + ' ' + readme).toLowerCase();
    var hay = (desc + ' ' + topics.join(' ') + ' ' + readme.slice(0, 1500)).toLowerCase();
    var ageDays = repo.created_at ? Math.max(0, Math.floor((Date.now() - new Date(repo.created_at).getTime()) / 86400000)) : 0;

    var assets = [];
    (ctx.releases || []).forEach(function (r) {
      (r.assets || []).forEach(function (a) {
        assets.push({
          name: a.name || '',
          size: a.size || 0,
          downloads: a.download_count || 0,
          tag: r.tag_name || '',
          url: a.browser_download_url || '',
          /* GitHub computes a SHA-256 for every uploaded release asset, so the
             file can be identified without downloading a single byte. */
          digest: a.digest || ''
        });
      });
    });
    var binaryAssets = assets.filter(function (a) { return BINARY_ASSET_RE.test(a.name) && !/source|src/i.test(a.name); });
    var codeFiles = paths.filter(function (p) { return CODE_RE.test(p); });
    var testFiles = paths.filter(function (p) { return TEST_RE.test(p); });
    var workflows = paths.filter(function (p) { return /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(p); });
    var docsPages = paths.filter(function (p) { return /(^|\/)docs\/.+\.(md|mdx|html|txt|rst)$/i.test(p); });
    var depManifests = pathsMatching(paths, /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|Pipfile|setup\.py|Gemfile|Cargo\.toml|go\.mod|composer\.json|pom\.xml|build\.gradle(\.kts)?|[^/]+\.(csproj|fsproj|vbproj))$/i);
    /* Managers that normally produce a lockfile. Plain pip / requirements.txt is
       already a version list, so it must not be punished for having no lock. */
    var lockableManifests = pathsMatching(paths, /(^|\/)(package\.json|Cargo\.toml|go\.mod|Gemfile|composer\.json|Pipfile|pom\.xml|build\.gradle(\.kts)?|packages\.config\.json)$/i);
    var stack = detectStack(paths, repo.language);
    var platform = detectPlatform(pathText, hay, binaryAssets, '');
    var kind = detectKind(ctx, pathText, hay, binaryAssets, platform, codeFiles);
    if (kind === 'web') platform = 'web';

    var images = readmeImages(readme);
    var repoVisuals = paths.filter(function (p) {
      return VISUAL_RE.test(p) && /(^|\/)(docs\/screenshots?|screenshots?|assets\/|images?\/)/i.test(p);
    });
    var visualNames = {};
    images.forEach(function (u) {
      if (VISUAL_RE.test(u.split('?')[0])) visualNames[u.split('?')[0].split('/').pop().toLowerCase()] = 1;
    });
    repoVisuals.forEach(function (p) { visualNames[p.split('/').pop().toLowerCase()] = 1; });
    var visuals = Object.keys(visualNames).length;
    var demoLink = repo.homepage || '';
    if (!demoLink) {
      var links = readme.match(/https?:\/\/[^\s)>"']+/g) || [];
      demoLink = links.filter(function (u) {
        return /(pages\.dev|netlify\.app|vercel\.app|github\.io|surge\.sh|render\.com|itch\.io|youtube\.com|youtu\.be|vimeo\.com|streamable\.com|demo\.)/i.test(u);
      })[0] || '';
    }

    var lang = readmeLangInfo(readme, paths);
    var risk = scanRisk(ctx.sources || [], declaredText);
    var claims = claimsMatch(repo, readme);
    var testHint = testFiles.length > 0;
    var toyHay = (desc + ' ' + topics.join(' ') + ' ' + readme.slice(0, 900)).toLowerCase();
    var toyWords = /(prank|joke|toy|meme|for fun|just for fun|experiment|playground|demo app|шутк|прикол|пранк|мем|игрушк|эксперимент|ради смеха)/i;
    var isToy = toyWords.test(toyHay);
    var isSmallNew = paths.length <= 25 && ageDays < 14 && !testHint;
    var lenient = isToy || isSmallNew;

    var checksums = /\b(sha-?256|sha-?512|checksums?|sigstore|minisign|cosign|gpg|pgp)\b/i.test(readme + '\n' + (ctx.releaseBodies || ''));
    var securityMd = paths.some(function (p) { return /(^|\/)(SECURITY|SECURITY-POLICY)\.md$/i.test(p); });
    var contact = /(mailto:|contact|связ[а-я]*|support|поддержк|обсужден|discussions?)/i.test(readme) ||
      paths.some(function (p) { return /(^|\/)(SECURITY|SUPPORT)\.md$/i.test(p); });

    var safety = {
      stop: /(emergency|how to (close|stop|exit|quit)|аварийн|как (закрыть|остановить|выйти))/i.test(readme),
      undo: /(restore|uninstall|remove|revert|восстанов|удал|откат|деинсталл)/i.test(readme),
      warn: /(warning|caution|responsible|antivirus|false positive|smartscreen|unsafe|осторожн|ответственн|антивирус|ложн|ненадёжн)/i.test(readme),
      admin: /(administrator|admin rights|run as admin|uac|администратор|права администратора)/i.test(readme),
      archive: binaryAssets.some(function (a) { return /\.(7z|zip|rar)$/i.test(a.name); }) && /(password|пароль)/i.test(readme),
      unsigned: /(unsigned|not signed|smart screen|smartscreen|не подписан|без подписи)/i.test(readme),
      network: risk.network
    };
    safety.hits = [safety.stop, safety.undo, safety.warn].filter(Boolean).length;

    var installCommand = /\b(npm (i|install)|pnpm add|yarn add|pip install|poetry add|cargo add|go get|gem install|composer require|dotnet add package|brew install|winget install|choco install)\b/i.test(readme);
    var distribution = kind === 'web' ? 'site' : binaryAssets.length ? 'binary' : kind === 'library' ? 'package' : 'source';

    return {
      kind: kind,
      stack: stack,
      platform: platform,
      distribution: distribution,
      ageDays: ageDays,
      isToy: isToy,
      isSmallNew: isSmallNew,
      lenient: lenient,
      isNew: ageDays < 30,
      hasSource: codeFiles.length > 0,
      sourceCount: (ctx.sources || []).length,
      codeFiles: codeFiles.length,
      hasBinaries: binaryAssets.length > 0,
      binaryAssets: binaryAssets,
      allAssets: assets,
      downloads: assets.reduce(function (n, a) { return n + a.downloads; }, 0),
      hasChecksums: checksums,
      hasSecurityMd: securityMd,
      hasContact: contact,
      hasReleaseNotes: (ctx.releases || []).some(function (r) { return (r.body || '').trim().length >= 40; }),
      demoLink: demoLink,
      visuals: visuals,
      hasScreenshots: visuals > 0,
      hasInstall: /(##+\s*(install|installation|setup|quick\s?start|usage|getting started|download|установка|запуск|быстрый старт|скач|использование))|(\bnpm (i|install|run)\b|\bpip install\b|\bdotnet run\b|\bgo run\b|\bcargo run\b|\bdocker (compose )?up\b|\bmake (run|install|dev)\b|\bpython -m\b|\bdownload\b|\bскача)/i.test(readme),
      installCommand: installCommand,
      docsPages: docsPages.length,
      hasTemplates: /(^|\/)\.github\/ISSUE_TEMPLATE\//im.test(pathText),
      depManifests: depManifests.length,
      lockable: lockableManifests.length > 0,
      workflows: workflows.length,
      testFiles: testFiles.length,
      lang: lang,
      claims: claims,
      risk: risk,
      safety: safety,
      hasAdmin: safety.admin,
      hasArchive: safety.archive,
      isUnsigned: safety.unsigned,
      topics: topics,
      description: desc
    };
  }

  function ageText(days) {
    if (state.lang === 'ru') {
      var n = days % 100;
      var w = 'дней';
      if (n % 10 === 1 && n !== 11) w = 'день';
      else if (n % 10 >= 2 && n % 10 <= 4 && (n < 12 || n > 14)) w = 'дня';
      return days + ' ' + w;
    }
    if (days === 0) return 'today';
    return days + (days === 1 ? ' day' : ' days');
  }

  function filesText(n) {
    if (state.lang === 'ru') {
      var m10 = n % 10, m100 = n % 100, w = 'файлов';
      if (m10 === 1 && m100 !== 11) w = 'файл';
      else if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) w = 'файла';
      return n + ' ' + w;
    }
    return n + (n === 1 ? ' file' : ' files');
  }

  function visualsText(n) {
    if (state.lang === 'ru') {
      var m10 = n % 10, m100 = n % 100, w = 'скриншотов';
      if (m10 === 1 && m100 !== 11) w = 'скриншот';
      else if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) w = 'скриншота';
      return n + ' ' + w + ' или видео';
    }
    return n + (n === 1 ? ' screenshot' : ' screenshots') + ' or video';
  }

  var RISK_RULES = [
    {
      id: 'network', level: 'high',
      label: M('сетевые запросы', 'network requests'),
      re: /\b(WebClient|HttpClient|WebRequest|DownloadString|DownloadFile|TcpClient|UdpClient|Dns\.GetHost|requests\.(get|post)|urllib\.request|http\.client|fetch\s*\(|axios\.|Invoke-WebRequest|Invoke-RestMethod|curl\s+-|wget\s+)/i
    },
    {
      id: 'persistence', level: 'high',
      label: M('автозапуск', 'autostart'),
      re: /(CurrentVersion\\+Run|schtasks\s+\/create|\bsc\s+create\b|LaunchAgents|LaunchDaemons|systemd\/system|\.bashrc|(^|[\s"'`/])\.profile\b)/i
    },
    {
      id: 'injection', level: 'high',
      label: M('внедрение в другие процессы', 'injecting into other processes'),
      re: /\b(CreateRemoteThread|WriteProcessMemory|VirtualAllocEx|SetThreadContext|NtUnmapViewOfSection|ptrace\s*\(|LD_PRELOAD)\b/i
    },
    {
      id: 'obfuscation', level: 'high',
      label: M('закодированный или обфусцированный код', 'encoded or obfuscated code'),
      re: /(FromBase64String|base64\s+-d|-[Ee]nc(odedCommand)?\b|Invoke-Expression|eval\s*\(|atob\s*\(|powershell.*-enc)/i
    },
    {
      id: 'masquerade', level: 'high',
      label: M('маскировка под системный процесс', 'masquerading as a system process'),
      re: /(WUDFHost|svchost\.exe|lsass\.exe|csrss\.exe|winlogon\.exe|LOCALAPPDATA[^\n]{0,40}\.exe|AppData[^\n]{0,40}\.exe)/i
    },
    {
      id: 'power', level: 'high',
      label: M('выключение или перезагрузка системы', 'system shutdown or reboot'),
      re: /\bshutdown\b[^\n]{0,30}\/[rsf]\b|\b(ExitWindowsEx|InitiateSystemShutdown|bcdedit|vssadmin)\b|(^|[;&|]\s*)(reboot|poweroff|halt)\b/im
    },
    {
      id: 'keyboard', level: 'medium',
      label: M('перехват клавиатуры', 'keyboard hooks'),
      re: /\b(SetWindowsHookEx|GetAsyncKeyState|BlockInput|keybd_event|GetKeyboardState|pynput|keyboard\.Listener)\b/i
    },
    {
      id: 'registry', level: 'medium',
      label: M('изменение реестра или политик', 'registry or policy changes'),
      re: /\b(Registry\.(CurrentUser|LocalMachine|ClassesRoot)|RegSetValue|HKEY_(CURRENT_USER|LOCAL_MACHINE)|reg\s+add)\b/i
    },
    {
      id: 'shell', level: 'medium',
      label: M('управление проводником Windows', 'control of Windows Explorer'),
      re: /(explorer\.exe|taskkill[^\n]{0,40}explorer|restart[^\n]{0,40}explorer)/i
    },
    {
      id: 'process', level: 'medium',
      label: M('запуск других программ', 'launching other programs'),
      re: /\b(Process\.Start|ShellExecute|WinExec|CreateProcess|subprocess\.(Popen|run|call)|child_process\.(exec|spawn)|Runtime\.getRuntime\(\)\.exec)\b/i
    },
    {
      id: 'files', level: 'medium',
      label: M('удаление файлов', 'file deletion'),
      re: /\b(File\.Delete|Directory\.Delete|Remove-Item|shutil\.rmtree|os\.remove|os\.unlink|fs\.rm|deleteFile)\b/i
    }
  ];

  var DECLARED_RULES = {
    network: /\b(api|server|cloud|sync\w*|upload\w*|download\w*|telemetry|webhook|socket\w*|online|telegram|discord|http|network\w*)\b|сетев|сервер|облак|синхрониз|загруж|выгруз|онлайн|телеграм|дискорд/i,
    persistence: /(autostart|auto-start|startup|run key|автозагруз|автозапуск|при запуске)/i,
    injection: /(inject|hook|cheat|mod loader|инъекц|хук|чит|мод)/i,
    obfuscation: /(obfuscat|encoded|base64|обфускац|закодирован)/i,
    masquerade: /(WUDFHost|LOCALAPPDATA|AppData|disguis|masquerad|маскир|скрыт[^\n]{0,30}процесс|имя процесс)/i,
    power: /(reboot|restart|shutdown|power off|перезагруз|выключ|заверш[^\n]{0,20}работ)/i,
    keyboard: /(keyboard|hotkey|block[^\n]{0,20}key|клавиатур|горяч|заблокир[^\n]{0,20}клавиш|перехват)/i,
    registry: /(registry|policies|policy|реестр|политик|ctrl\+alt\+del|task manager|диспетчер)/i,
    shell: /(fullscreen|full-screen|topmost|taskbar|explorer|полноэкран|панел[^\n]{0,20}задач|проводник)/i,
    process: /(launch|start|spawn|relaunch|запуск|перезапуск|распаков)/i,
    files: /(delete|remove|wipe|cleanup|uninstall|удал|очист|деинсталл)/i
  };

  function stripComments(text) {
    return String(text || '')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/gm, '$1 ')
      .replace(/^[ \t]*#[^\n]*/gm, ' ')
      /* Regex literals that look like a rule (alternation or word boundary) are
         patterns, not behaviour. Without this a scanner or a pattern list flags
         itself with every rule it contains. */
      .replace(/\/(?![*/])(?:\\.|[^\/\n\\])+\/[gimsuy]*/g, function (m) {
        return /\||\\b/.test(m) ? ' ' : m;
      });
  }

  function scanRisk(sources, declaredText) {
    var all = [];
    var declared = [];
    var undeclaredHigh = [];
    var undeclaredMedium = [];
    var network = false;
    var declaredHay = String(declaredText || '');

    RISK_RULES.forEach(function (rule) {
      var files = [];
      (sources || []).forEach(function (s) {
        var text = stripComments(s.text || '');
        rule.re.lastIndex = 0;
        if (rule.re.test(text)) files.push(s.path);
      });
      if (!files.length) return;
      var item = {
        id: rule.id,
        level: rule.level,
        label: rule.label,
        files: uniq(files)
      };
      var claimRe = DECLARED_RULES[rule.id];
      item.declared = !!(claimRe && claimRe.test(declaredHay));
      all.push(item);
      if (item.declared) declared.push(item);
      else if (rule.level === 'high') undeclaredHigh.push(item);
      else undeclaredMedium.push(item);
      if (rule.id === 'network') network = true;
    });

    return {
      all: all,
      declared: declared,
      undeclaredHigh: undeclaredHigh,
      undeclaredMedium: undeclaredMedium,
      network: network,
      scanned: (sources || []).length
    };
  }

  function kindLabel(kind) {
    var table = {
      desktop: M('настольная программа', 'desktop app'),
      web: M('веб-приложение', 'web app'),
      cli: M('консольная программа', 'command-line tool'),
      library: M('библиотека', 'library'),
      game: M('игра', 'game'),
      bot: M('бот', 'bot'),
      docs: M('документация', 'documentation'),
      other: M('проект', 'project')
    };
    return table[kind] || table.other;
  }

  function platformLabel(platform) {
    var table = {
      windows: M('Windows', 'Windows'),
      macos: M('macOS', 'macOS'),
      linux: M('Linux', 'Linux'),
      cross: M('несколько систем', 'multiple systems'),
      web: M('браузер', 'browser'),
      unknown: M('система не указана', 'system not stated')
    };
    return table[platform] || table.unknown;
  }

  function profileFacts(p, ctx) {
    var facts = [];
    var typeParts = [pick(kindLabel(p.kind))];
    if (p.stack && p.stack !== '—') typeParts.push(p.stack);
    if (p.platform && p.platform !== 'web' && p.platform !== 'unknown') typeParts.push(pick(platformLabel(p.platform)));
    facts.push({ k: M('Что это', 'What it is'), v: typeParts.join(' · ') });

    if (p.distribution === 'binary') {
      var names = p.binaryAssets.slice(0, 2).map(function (a) { return a.name; }).join(', ');
      facts.push({
        k: M('Как получить', 'How to get it'),
        v: M('готовые файлы в релизах: ' + (names || 'есть'), 'ready-made files in releases: ' + (names || 'yes'))
      });
    } else if (p.distribution === 'package') {
      facts.push({ k: M('Как получить', 'How to get it'), v: M('через пакетный менеджер', 'through a package manager') });
    } else if (p.distribution === 'site') {
      facts.push({ k: M('Как получить', 'How to get it'), v: M('открывается в браузере', 'opens in a browser') });
    } else {
      facts.push({ k: M('Как получить', 'How to get it'), v: M('только исходники, сборка вручную', 'source only, build it yourself') });
    }

    facts.push({
      k: M('Исходный код', 'Source code'),
      v: p.hasSource
        ? M('открыт, прочитано ' + filesText(p.sourceCount || 0), 'open, ' + filesText(p.sourceCount || 0) + ' read')
        : M('закрыт или не найден', 'closed or not found')
    });

    if (p.ageDays >= 0) {
      var created = ctx.repo && ctx.repo.created_at ? dateStr(ctx.repo.created_at) : '';
      facts.push({
        k: M('Возраст', 'Age'),
        v: M('создан ' + (created || '—') + ' · ' + ageText(p.ageDays), 'created ' + (created || '—') + ' · ' + ageText(p.ageDays))
      });
    }

    if (p.hasScreenshots) {
      facts.push({ k: M('Как выглядит', 'What it looks like'), v: visualsText(p.visuals) });
    }
    if (p.hasBinaries && !p.hasChecksums) {
      facts.push({ k: M('Проверка файлов', 'File verification'), v: M('контрольных сумм нет', 'no checksums') });
    }

    return facts.slice(0, 5);
  }

  function scoreChecks(checks, profile) {
    var cats = {};
    profile.cats.forEach(function (c) { cats[c.id] = { earned: 0, max: 0 }; });
    var totalW = 0;
    var earned = 0;

    checks.forEach(function (ch) {
      if (ch.skip) return;
      if (!cats[ch.cat]) cats[ch.cat] = { earned: 0, max: 0 };
      totalW += ch.points;
      cats[ch.cat].max += ch.points;
      if (ch.ok) {
        earned += ch.points;
        cats[ch.cat].earned += ch.points;
      }
    });

    var order = {};
    profile.cats.forEach(function (c, i) { order[c.id] = i; });
    var findings = checks.filter(function (c) { return !c.ok && !c.skip && !c.silent; }).sort(function (a, b) {
      var d = SEV_ORDER[a.sev] - SEV_ORDER[b.sev];
      if (d !== 0) return d;
      var co = (order[a.cat] || 0) - (order[b.cat] || 0);
      if (co !== 0) return co;
      return b.points - a.points;
    });
    var skipped = checks.filter(function (c) { return c.skip; });

    return {
      score: totalW ? Math.max(0, Math.min(100, Math.round((earned / totalW) * 100))) : 0,
      cats: cats,
      findings: findings,
      skipped: skipped,
      total: totalW,
      earned: earned
    };
  }

  function devChecks(ctx, p) {
    var out = [];
    var paths = ctx.paths || [];
    var pathText = ctx.pathText || (ctx.pathText = paths.join('\n'));
    var readme = ctx.readme || '';
    var repo = ctx.repo || {};
    var releaseText = ctx.releaseBodies || '';
    var toy = p.isToy;
    var small = p.isSmallNew;
    var lenient = p.lenient;
    var w = function (n) { return lenient ? Math.max(1, Math.round(n * 0.5)) : n; };
    var sev = function (normal, low) { return lenient && low ? low : normal; };

    function add(c) { out.push(c); }

    /* ---------- security (25) ---------- */

    var envFiles = pathsMatching(paths, /(^|\/)\.env(\.[A-Za-z0-9_-]+)?$/i).filter(function (x) {
      return !/\.(example|sample|template|dist)$/i.test(x);
    });
    add({
      id: 's_env', cat: 'security', sev: 'critical', points: 7,
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
      .filter(function (x) { return !/\.pub$/i.test(x); });
    add({
      id: 's_keys', cat: 'security', sev: 'critical', points: 5,
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

    var leaked = (ctx.scanned || []).filter(function (s) { return s.hits && s.hits.length > 0; });
    add({
      id: 's_secrets', cat: 'security', sev: 'critical', points: 8,
      skip: !(ctx.scanned || []).length,
      skipReason: M('в проекте не нашлось конфигов или исходников, где обычно лежат секреты', 'no configs or source files that usually hold secrets were found'),
      ok: leaked.length === 0,
      vars: {
        files: leaked.slice(0, 3).map(function (s) { return s.path; }).join(', '),
        kinds: uniq(leaked.reduce(function (acc, s) { return acc.concat(s.hits); }, [])).slice(0, 3).join(', ')
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

    var risky = p.risk.undeclaredHigh;
    add({
      id: 's_risk', cat: 'security', sev: 'critical', points: 5,
      skip: !p.sourceCount,
      skipReason: M('исходный код не читался — проверить опасные вызовы негде', 'source code was not read, so there is nothing to scan for dangerous calls'),
      ok: risky.length === 0,
      vars: {
        items: risky.map(function (r) { return pick(r.label); }).join(', '),
        files: uniq(risky.reduce(function (a, r) { return a.concat(r.files); }, [])).slice(0, 3).join(', ')
      },
      title: M('В коде есть опасные действия без предупреждения', 'The code does risky things without warning'),
      why: M('Найдено: {items}. В README об этом не сказано. Это не значит «вирус», но пользователь должен знать до запуска.',
        'Found: {items}. The README does not mention it. This does not mean “virus”, but a user must know before running it.'),
      prompt: M(
        'В репозитории {repo} в файлах {files} найдены потенциально опасные вызовы: {items}, но README о них не предупреждает.\n' +
        'Сделай одно из двух:\n' +
        '1) если это не нужно — убери эти вызовы и упрости код;\n' +
        '2) если это часть задуманного поведения — добавь в README раздел «Что программа делает с системой»: что именно происходит, зачем, как это остановить и как отменить.\n' +
        'Не скрывай поведение и не добавляй новых опасных вызовов.',
        'In {repo}, files {files} contain potentially dangerous calls: {items}, but the README does not warn about them.\n' +
        'Do one of two things:\n' +
        '1) if they are not needed, remove them and simplify the code;\n' +
        '2) if they are intentional, add a “What this app does to your system” section to the README: what happens, why, how to stop it and how to undo it.\n' +
        'Do not hide behaviour and do not add new dangerous calls.'
      )
    });

    /* ---------- runnable (20) ---------- */

    add({
      id: 'r_docs', cat: 'runnable', sev: 'high', points: 6,
      ok: p.hasInstall || /(##+\s*(install|installation|setup|quick\s?start|usage|getting started|download|установка|запуск|быстрый старт|скач|использование))|(\bnpm (i|install|run)\b|\bpip install\b|\bdotnet run\b|\bgo run\b|\bcargo run\b|\bdocker (compose )?up\b|\bmake (run|install|dev)\b|\bpython -m\b)/i.test(readme),
      title: M('В README нет «как запустить»', 'README does not say how to run it'),
      why: M('Человек открыл репозиторий и не понял, что делать. Без раздела установки половина посетителей уходит сразу.',
        'Someone opened the repository and could not tell what to do. Without an install section, half the visitors leave immediately.'),
      prompt: M(
        'В README репозитория {repo} нет понятного раздела о запуске. Добавь в начало README раздел «Быстрый старт»: требования (версия языка/рантайма), команды установки зависимостей, команда запуска и ожидаемый результат. ' +
        'Для настольной программы укажи, откуда скачать готовый файл и как его распаковать. Используй реальные команды проекта, не выдумывай.',
        'The README of {repo} does not explain how to run the project. Add a “Quick start” section near the top: requirements (language/runtime version), dependency install commands, the run command, and what the user should see. ' +
        'For a desktop app, say where to download the ready-made file and how to unpack it. Use the real commands of this project, do not invent them.'
      )
    });

    var manifestFiles = pathsMatching(paths, /(^|\/)(package\.json|[^/]+\.(csproj|fsproj|vbproj|sln|vcxproj|proj)|pyproject\.toml|setup\.py|requirements\.txt|Pipfile|Cargo\.toml|go\.mod|pom\.xml|build\.gradle(\.kts)?|settings\.gradle(\.kts)?|Gemfile|composer\.json|mix\.exs|pubspec\.yaml|Package\.swift|CMakeLists\.txt|Makefile|meson\.build|build\.(ps1|sh|bat|cmd)|Justfile|Taskfile\.ya?ml|configure|index\.html)$/i);
    add({
      id: 'r_manifest', cat: 'runnable', sev: 'medium', points: 4,
      ok: manifestFiles.length > 0,
      vars: { files: manifestFiles.slice(0, 3).join(', ') },
      title: M('Нет манифеста проекта', 'No project manifest'),
      why: M('Не видно, из чего собирается проект и какие у него зависимости. Агенту и человеку придётся угадывать.',
        'There is no clear build definition or dependency list. Both an agent and a human would have to guess.'),
      prompt: M(
        'В репозитории {repo} нет файла манифеста (package.json, pyproject.toml, .csproj, Cargo.toml, go.mod, build.ps1 или аналога). ' +
        'Добавь манифест для реального стека проекта: имя, версия, зависимости, скрипты сборки и запуска. Ничего не выдумывай: посмотри, какие импорты используются в коде.',
        'The repository {repo} has no manifest (package.json, pyproject.toml, .csproj, Cargo.toml, go.mod, build.ps1 or similar). ' +
        'Add a manifest for the actual stack: name, version, dependencies, build and run scripts. Do not invent anything — look at the imports used in the code.'
      )
    });

    var lockFiles = pathsMatching(paths, /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Pipfile\.lock|packages\.lock\.json|Cargo\.lock|go\.sum|composer\.lock|Gemfile\.lock)$/i);
    add({
      id: 'r_lock', cat: 'runnable', sev: 'medium', points: 3,
      skip: !p.lockable,
      skipReason: M('в проекте нет менеджера зависимостей с lockfile — фиксировать версии нечем', 'the project has no dependency manager that uses a lockfile, so there is nothing to pin'),
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

    var namedEntry = paths.filter(function (x) {
      return /(^|\/)(Program|Main|Launcher|App|Application|Index|Cli|Server|Bot)\.[A-Za-z0-9]+$/i.test(x) || /(^|\/)main\.[A-Za-z0-9]+$/i.test(x);
    })[0];
    var compiled = (ctx.buildText || '').match(/[A-Za-z0-9_./-]+\.(?:cs|c|cc|cpp|go|rs|py|js|ts|java|kt|swift)\b/g) || [];
    var rootSources = paths.filter(function (x) { return x.indexOf('/') === -1 && CODE_RE.test(x); });
    var entryOk = !!namedEntry || !!compiled.length || rootSources.length === 1 || /(^|\/)src\//.test(pathText);
    add({
      id: 'r_entry', cat: 'runnable', sev: 'medium', points: 4,
      ok: entryOk,
      vars: { entry: namedEntry || compiled[0] || (rootSources[0] || 'src/') },
      title: M('Непонятно, откуда стартует проект', 'Unclear entry point'),
      why: M('Нет очевидной точки входа: папки src, main-файла или индекса. Это первое, что ищут в чужом коде.',
        'There is no obvious entry point: no src folder, main file or index. It is the first thing people look for in unfamiliar code.'),
      prompt: M(
        'В репозитории {repo} не видно точки входа. Сейчас сборка выглядит так, что непонятно, какой файл запускается первым. ' +
        'Сделай структуру явной: один вход (main.*, Program.cs, app.py, index.html или файл, который компилирует сборка), и добавь в README строку «Точка входа: {entry}». ' +
        'Перемещай файлы аккуратно, обнови импорты и проверь, что проект собирается.',
        'The repository {repo} has no obvious entry point. Make the structure explicit: one entry (main.*, Program.cs, app.py, index.html or the file your build compiles), and add an “Entry point: {entry}” line to the README. ' +
        'Move files carefully, update imports, and verify the project still builds.'
      )
    });

    var workflows = pathsMatching(paths, /^\.github\/workflows\/[^/]+\.ya?ml$/i);
    var buildHint = ctx.buildPath
      ? M('В проекте уже есть ' + ctx.buildPath + ' — вызови его из workflow, чтобы не дублировать сборку.',
        'The project already has ' + ctx.buildPath + ' — call it from the workflow instead of duplicating the build.')
      : M('', '');
    add({
      id: 'r_ci', cat: 'runnable', sev: sev('high', 'medium'), points: w(3),
      ok: workflows.length > 0,
      vars: { branch: repo.default_branch || 'main', buildHint: buildHint },
      title: M('Нет CI', 'No CI'),
      why: toy
        ? M('Никто автоматически не проверяет, что проект собирается. Для маленькой шуточной программы это не срочно, но перед релизом полезно.',
          'Nothing automatically checks that the project builds. Not urgent for a small joke app, but useful before a release.')
        : small
          ? M('Проект новый и небольшой, поэтому CI можно добавить позже. Но перед первым релизом он ловит поломки, которые иначе заметят пользователи.',
            'The project is new and small, so CI can wait. But before the first release it catches breakage that users would otherwise find.')
          : M('Никто автоматически не проверяет, что проект собирается. Первый же сломанный коммит заметят пользователи.',
            'Nothing automatically checks that the project builds. The first broken commit will be noticed by users.'),
      prompt: M(
        'В репозитории {repo} нет GitHub Actions. Добавь .github/workflows/ci.yml: checkout, установка нужной версии рантайма, установка зависимостей, сборка и тесты. ' +
        'Триггеры: push в {branch} и pull_request. {buildHint} Сделай минимальный рабочий файл для реального стека проекта и проверь, что он проходит.',
        'The repository {repo} has no GitHub Actions. Add .github/workflows/ci.yml: checkout, set up the required runtime version, install dependencies, build and test. ' +
        'Triggers: push to {branch} and pull_request. {buildHint} Keep it minimal and real for this stack, and make sure it passes.'
      )
    });

    /* ---------- quality (15) ---------- */

    var testFiles = paths.filter(function (x) { return TEST_RE.test(x); });
    add({
      id: 'q_tests', cat: 'quality', sev: sev('high', 'medium'), points: w(6),
      ok: testFiles.length > 0,
      vars: { files: (ctx.sources || []).slice(0, 3).map(function (s) { return s.path; }).join(', ') || 'основные функции' },
      title: M('Нет тестов', 'No tests'),
      why: toy
        ? M('Без тестов любая правка — это надежда. Для маленькой утилиты это не первое, что нужно, но тесты на главный сценарий окупятся быстро.',
          'Without tests every change is a hope. Not the first thing a small tool needs, but tests for the main flow pay off quickly.')
        : small
          ? M('Проект новый: тесты на главный сценарий важнее полного покрытия. Начни с 3–5 проверок того, что точно должно работать.',
            'The project is new: tests for the main flow matter more than full coverage. Start with 3–5 checks of what must work.')
          : M('Без тестов любая правка — это надежда. Агенту особенно нужны тесты: это единственный способ проверить, что он ничего не сломал.',
            'Without tests every change is a hope. Agents especially need tests: it is the only way to verify nothing broke.'),
      prompt: M(
        'В репозитории {repo} нет тестов. Добавь минимальный набор для основного поведения (3–5 тестов) в файлах {files}. ' +
        'Используй стандартный фреймворк стека и не меняй поведение приложения. Добавь команду запуска тестов в README и в CI.',
        'The repository {repo} has no tests. Add a minimal suite for the core behaviour (3–5 tests) covering {files}. ' +
        'Use the standard framework for the stack and do not change application behaviour. Add the test command to the README and CI.'
      )
    });

    var lintRe = /(^|\/)(\.eslintrc(\.[a-z]+)?|eslint\.config\.[a-z]+|\.prettierrc(\.[a-z]+)?|prettier\.config\.[a-z]+|ruff\.toml|\.flake8|\.editorconfig|\.stylecop\.json|stylecop\.json|\.golangci\.ya?ml|clippy\.toml|detekt\.ya?ml|\.rubocop\.yml|\.swiftlint\.yml)$/im;
    add({
      id: 'q_lint', cat: 'quality', sev: 'low', points: w(4),
      ok: lintRe.test(pathText),
      title: M('Нет линтера и форматтера', 'No linter or formatter'),
      why: toy
        ? M('Стиль кода будет плавать от правки к правке. Для одноразовой утилиты это необязательно — достаточно .editorconfig.',
          'Code style will drift with every change. For a one-off tool this is optional — a .editorconfig is enough.')
        : small
          ? M('Пока проект маленький, достаточно .editorconfig и форматтера. Линтер стоит добавить, когда файлов станет больше.',
            'While the project is small, a .editorconfig and a formatter are enough. Add a linter when the codebase grows.')
          : M('Стиль кода будет плавать от правки к правке, а глупые ошибки никто не поймает автоматически.',
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
      skip: workflows.length === 0,
      skipReason: M('CI нет — правило «тесты в CI» не применяется, за это отвечает отдельная проверка', 'there is no CI, so “tests in CI” does not apply; a separate check covers that'),
      ok: ciTestRe.test(ctx.workflowText || ''),
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

    var big = (ctx.blobs || []).filter(function (b) {
      var limit = MEDIA_RE.test(b.path) ? 20 : 10;
      return b.size > limit * 1024 * 1024;
    }).sort(function (a, b) { return b.size - a.size; });
    add({
      id: 'q_big', cat: 'quality', sev: 'medium', points: 2,
      ok: big.length === 0,
      vars: {
        files: big.slice(0, 3).map(function (b) { return b.path + ' (' + Math.round(b.size / 1048576) + ' МБ)'; }).join(', ')
      },
      title: M('В репозитории очень большие файлы', 'Very large files in the repository'),
      why: M('Клонирование станет медленным, а git будет хранить каждую версию такого файла навсегда.',
        'Cloning becomes slow and git stores every version of such a file forever.'),
      prompt: M(
        'В репозитории {repo} есть очень большие файлы: {files}. Убери их из git (git rm --cached), добавь в .gitignore, ' +
        'а сами файлы выложи в GitHub Releases или подключи Git LFS. Историю при необходимости почисти через git filter-repo. Не ломай ссылки в README.',
        'The repository {repo} has very large files: {files}. Remove them from git (git rm --cached), add them to .gitignore, ' +
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
    var hasImage = p.visuals > 0;
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

    add({
      id: 'p_en', cat: 'repo', sev: 'medium', points: 2,
      skip: p.lang.letters < 200,
      skipReason: M('README слишком короткий, чтобы судить о языке', 'the README is too short to judge its language'),
      ok: p.lang.bilingual || p.lang.cyrShare < 0.15,
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

    var demoOk = !!p.demoLink || (p.kind !== 'web' && p.hasScreenshots);
    add({
      id: 'd_home', cat: 'product', sev: 'medium', points: 6,
      skip: p.kind === 'library',
      skipReason: M('библиотеке не нужно живое демо — достаточно примера использования в README', 'a library does not need a live demo; a usage example in the README is enough'),
      ok: demoOk,
      vars: { url: p.demoLink || '' },
      title: M('Нечем посмотреть продукт', 'There is nothing to look at'),
      why: p.kind === 'web'
        ? M('Попробовать проект нельзя без установки. Живое демо повышает доверие и конверсию в звёзды сильнее любого текста.',
          'There is no way to try the project without installing it. A live demo builds trust and converts to stars better than any text.')
        : M('Скачивать и устанавливать программу, чтобы просто посмотреть, готов не каждый. Скриншоты или короткое видео показывают продукт заранее.',
          'Not everyone will download and install an app just to look at it. Screenshots or a short video show the product first.'),
      prompt: p.kind === 'web'
        ? M(
          'У проекта {repo} нет ссылки на демо. Сделай минимальное демо (GitHub Pages, Netlify или Cloudflare Pages — бесплатные варианты), ' +
          'положи ссылку в поле Website репозитория и первой строкой в README, добавь бейдж Demo.',
          'The project {repo} has no demo link. Create a minimal demo (GitHub Pages, Netlify or Cloudflare Pages are free), ' +
          'put the link in the repository Website field and on the first line of the README, add a Demo badge.'
        )
        : M(
          'У проекта {repo} нет ни ссылки на демо, ни скриншотов. Для настольной программы живое демо не требуется: ' +
          'добавь в README 2–3 скриншота основного экрана или короткий GIF/видео, подпиши, что на них происходит, и положи файлы в docs/ или assets/ (до 2 МБ каждый).',
          'The project {repo} has no demo link and no screenshots. A desktop app does not need a live demo: ' +
          'add 2–3 screenshots of the main screen or a short GIF/video to the README, caption what happens, and put the files in docs/ or assets/ (under 2 MB each).'
        )
    });

    add({
      id: 'd_releases', cat: 'product', sev: 'medium', points: 3,
      skip: p.kind === 'library',
      skipReason: M('библиотеки распространяются через пакетный менеджер, GitHub Releases им не обязательны', 'libraries ship through a package manager; GitHub Releases are optional for them'),
      ok: (ctx.releases || []).length > 0,
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

    var hasChangelog = /(^|\/)(CHANGELOG|CHANGES|HISTORY)(\.md|\.txt)?$/im.test(pathText);
    add({
      id: 'd_changelog', cat: 'product', sev: 'low', points: w(2),
      ok: hasChangelog,
      title: M('Нет CHANGELOG', 'No changelog'),
      why: toy
        ? M('Пользователь не понимает, что изменилось между версиями. Для шуточной программы это мелочь, но для релизов полезно.',
          'Users cannot tell what changed between versions. A small thing for a joke app, but useful for releases.')
        : small
          ? M('Пока проект новый, список изменений короткий. Начни CHANGELOG с первого релиза — потом будет поздно восстанавливать историю.',
            'While the project is new, the change list is short. Start the changelog at the first release — later it is hard to reconstruct.')
          : M('Пользователь не понимает, что изменилось между версиями, и не может решить, обновляться ли.',
            'Users cannot tell what changed between versions, so they cannot decide whether to update.'),
      prompt: M(
        'Добавь в {repo} файл CHANGELOG.md в формате Keep a Changelog: раздел Unreleased и первый релиз с датой. ' +
        'Заполни по реальным коммитам, без выдуманных пунктов. Добавь ссылку на CHANGELOG в README.',
        'Add CHANGELOG.md to {repo} in Keep a Changelog format: an Unreleased section and the first release with a date. ' +
        'Fill it from actual commits, no invented entries. Link the changelog from the README.'
      )
    });

    var missingDocParts = [];
    if (!p.hasTemplates) missingDocParts.push(M('шаблоны issue', 'issue templates'));
    if (!p.docsPages) missingDocParts.push(M('страницы документации', 'documentation pages'));
    add({
      id: 'd_docs', cat: 'product', sev: 'low', points: w(4),
      ok: missingDocParts.length === 0,
      vars: {
        parts: function () { return missingDocParts.map(pick).join(', '); }
      },
      title: missingDocParts.length === 2
        ? M('Нет шаблонов issue и документации', 'No issue templates or docs')
        : (p.hasTemplates ? M('Нет страниц документации', 'No documentation pages') : M('Нет шаблонов issue', 'No issue templates')),
      why: M('Обратная связь приходит в хаотичном виде, а документации нет ни для пользователей, ни для агента. Не хватает: {parts}.',
        'Feedback arrives in random shapes and there is no documentation for users or agents. Missing: {parts}.'),
      prompt: M(
        'Добавь в {repo} недостающее: {parts}. Шаблоны issue — bug report и feature request в .github/ISSUE_TEMPLATE. ' +
        'Страницы документации — 3 коротких файла в docs/: установка, использование, архитектура. Пиши по реальному коду и добавь ссылки в README.',
        'Add the missing parts to {repo}: {parts}. Issue templates are bug report and feature request under .github/ISSUE_TEMPLATE. ' +
        'Documentation pages are three short files in docs/: install, usage, architecture. Base them on the real code and link them from the README.'
      )
    });

    /* ---------- trust (10) ---------- */

    var trustOk = p.distribution === 'binary' ? p.hasChecksums : (p.hasSecurityMd || p.hasChecksums);
    add({
      id: 't_trust', cat: 'trust', sev: p.distribution === 'binary' ? 'medium' : 'low', points: 4,
      ok: trustOk,
      title: p.distribution === 'binary'
        ? M('Нет контрольных сумм для скачиваемых файлов', 'No checksums for downloadable files')
        : M('Нет политики безопасности', 'No security policy'),
      why: p.distribution === 'binary'
        ? M('Пользователь не может проверить, что скачал именно твой файл. Подпись или SHA-256 решают это.',
          'Users cannot verify they downloaded your file. A signature or SHA-256 solves this.')
        : M('Непонятно, куда сообщать об уязвимости. Без SECURITY.md такие сообщения теряются.',
          'It is unclear where to report a vulnerability. Without SECURITY.md such reports get lost.'),
      prompt: p.distribution === 'binary'
        ? M(
          'Добавь в релизы {repo} файл с контрольными суммами (SHA-256) для каждого скачиваемого файла и раздел «Проверка файла» в README с командой проверки. ' +
          'Если возможно — подпиши сборку (signtool или GPG) и опиши, как проверить подпись. Не меняй код приложения.',
          'Add a checksums file (SHA-256) for every downloadable file to the releases of {repo}, and a “Verify the file” section to the README with the check command. ' +
          'If possible, sign the build (signtool or GPG) and document how to verify it. Do not change the app code.'
        )
        : M(
          'Добавь в {repo} SECURITY.md: как сообщить об уязвимости, какие версии поддерживаются и чего ждать по срокам. ' +
          'Добавь короткую ссылку в README. Не публикуй личные данные, которые не хочешь показывать.',
          'Add SECURITY.md to {repo}: how to report a vulnerability, which versions are supported, and what response to expect. ' +
          'Add a short link in the README. Do not publish personal data you do not want to share.'
        )
    });

    var hasContrib = /(^|\/)(CONTRIBUTING\.md|\.github\/CONTRIBUTING\.md)$/im.test(pathText);
    var hasCoc = /(^|\/)(CODE_OF_CONDUCT\.md|\.github\/CODE_OF_CONDUCT\.md)$/im.test(pathText);
    add({
      id: 't_contrib', cat: 'trust', sev: 'low', points: w(3),
      ok: hasContrib || hasCoc,
      vars: { parts: [!hasContrib ? 'CONTRIBUTING.md' : null, !hasCoc ? 'CODE_OF_CONDUCT.md' : null].filter(Boolean).join(', ') },
      title: M('Нет правил для участников', 'No contributor guidelines'),
      why: toy
        ? M('Непонятно, как предложить правку. Для проекта одного автора это необязательно, но первый PR без правил превращается в переписку.',
          'It is unclear how to propose a change. Optional for a one-author project, but the first PR without rules turns into a long thread.')
        : small
          ? M('Пока проект ведёт один автор, правила можно не писать. Они понадобятся, когда появится первый внешний участник.',
            'While one author runs the project, written rules can wait. You will need them when the first outside contributor appears.')
          : M('Непонятно, как предложить правку и какие правила действуют. Без этого первый же PR превращается в переписку.',
            'It is unclear how to propose a change or what the rules are. Without it the first PR turns into a long thread.'),
      prompt: M(
        'Добавь в {repo} файлы {parts}: как собрать проект, как запускать тесты, стиль кода, как оформить PR; и краткий кодекс поведения. ' +
        'Добавь ссылки в README. Не меняй код.',
        'Add {parts} to {repo}: how to build, how to run tests, code style, how to open a PR; plus a short code of conduct. ' +
        'Link them from the README. Do not change the code.'
      )
    });

    add({
      id: 't_contact', cat: 'trust', sev: 'low', points: 3,
      ok: !!repo.has_issues || p.hasContact,
      title: M('Непонятно, как связаться', 'No way to get in touch'),
      why: M('Issues выключены, а другого контакта в README нет. Люди либо пишут не туда, либо уходят.',
        'Issues are disabled and there is no other contact in the README. People either write to the wrong place or leave.'),
      prompt: M(
        'В {repo} выключены Issues и нет контакта. Включи GitHub Issues или добавь в README раздел «Контакты»: почта или ссылка на обсуждения/чат, и куда писать про безопасность. ' +
        'Не публикуй личные данные, которые не хочешь показывать.',
        'Issues are disabled in {repo} and there is no contact. Enable GitHub Issues or add a “Contact” section to the README: an email or a link to discussions/chat, and where to report security issues. ' +
        'Do not publish personal data you do not want to share.'
      )
    });

    return out;
  }

  function userChecks(ctx, p) {
    var out = [];
    var readme = ctx.readme || '';
    var repo = ctx.repo || {};
    var paths = ctx.paths || [];

    function add(c) { out.push(c); }

    /* ---------- security (28) — «можно ли качать» ---------- */

    add({
      id: 'u_source', cat: 'security', sev: 'high', points: 8,
      skip: !p.hasSource && !p.hasBinaries,
      skipReason: M('это не программа, а документация — проверять скачивание нечего', 'this is documentation, not a program, so there is nothing to download'),
      ok: p.hasSource,
      title: M('Проверить код нельзя', 'The code cannot be checked'),
      why: M('В репозитории только готовые файлы. Что внутри, можно узнать только антивирусом — а он часто ошибается на новых программах.',
        'The repository only has ready-made files. What is inside can only be judged by antivirus — and it often gets new programs wrong.'),
      action: M('Скачай файл и проверь его на virustotal.com. Если автор не показывает исходники, доверяй программе меньше — особенно если она просит права администратора.',
        'Download the file and check it on virustotal.com. If the author does not show the source, trust the program less — especially if it asks for administrator rights.')
    });

    add({
      id: 'u_risk_high', cat: 'security', sev: 'critical', points: 8,
      skip: !p.sourceCount,
      skipReason: M('исходный код не читался — проверить опасные действия негде', 'source code was not read, so there is nothing to scan for dangerous actions'),
      ok: p.risk.undeclaredHigh.length === 0,
      vars: {
        items: p.risk.undeclaredHigh.map(function (r) { return pick(r.label); }).join(', '),
        files: uniq(p.risk.undeclaredHigh.reduce(function (a, r) { return a.concat(r.files); }, [])).slice(0, 3).join(', ')
      },
      title: M('В коде есть опасные действия без предупреждения', 'The code does dangerous things without warning'),
      why: M('Найдено: {items}. В README об этом не сказано. Это не значит «вирус», но ты должен знать до запуска.',
        'Found: {items}. The README does not mention it. This does not mean “virus”, but you must know before running it.'),
      action: M('Не запускай сразу. Проверь файл на VirusTotal и запусти его в Windows Sandbox или на отдельном компьютере. Напиши автору вопрос: зачем программе {items}?',
        'Do not run it yet. Check the file on VirusTotal and run it in Windows Sandbox or on a separate machine. Ask the author why the program needs {items}.')
    });

    add({
      id: 'u_risk_med', cat: 'security', sev: 'medium', points: 4,
      skip: !p.sourceCount,
      skipReason: M('исходный код не читался — проверить опасные действия негде', 'source code was not read, so there is nothing to scan for dangerous actions'),
      ok: p.risk.undeclaredMedium.length === 0,
      vars: {
        items: p.risk.undeclaredMedium.map(function (r) { return pick(r.label); }).join(', '),
        files: uniq(p.risk.undeclaredMedium.reduce(function (a, r) { return a.concat(r.files); }, [])).slice(0, 3).join(', ')
      },
      title: M('В коде есть действия, о которых не сказано', 'The code does things the README does not mention'),
      why: M('Найдено: {items}. Само по себе это не вирус, но хорошая программа предупреждает о таком заранее.',
        'Found: {items}. Not a virus by itself, but a good program warns about this in advance.'),
      action: M('Проверь файл на VirusTotal. Если программа просит права администратора — запускай только в Sandbox или на компьютере, который не жалко.',
        'Check the file on VirusTotal. If the program asks for administrator rights, run it only in a sandbox or on a machine you do not mind risking.')
    });

    add({
      id: 'u_checksums', cat: 'security', sev: 'medium', points: 8,
      skip: !p.hasBinaries,
      skipReason: M('в релизах нет готовых файлов — проверять контрольные суммы нечего', 'there are no ready-made files in the releases, so there are no checksums to verify'),
      ok: p.hasChecksums,
      title: M('Нет контрольных сумм или подписи', 'No checksums or signature'),
      why: M('Ты не можешь проверить, что скачал именно тот файл, который собрал автор. Подпись и SHA-256 — единственный способ это сделать.',
        'You cannot verify that you downloaded the exact file the author built. A signature and SHA-256 are the only way to check.'),
      action: M('После скачивания сравни SHA-256 с суммой на странице релиза: `certutil -hashfile <файл> SHA256` (Windows) или `shasum -a 256 <файл>` (macOS/Linux). Если суммы нет — попроси автора её добавить.',
        'After downloading, compare the SHA-256 with the checksum on the release page: `certutil -hashfile <file> SHA256` (Windows) or `shasum -a 256 <file>` (macOS/Linux). If there is no checksum, ask the author to add one.')
    });

    /* ---------- runnable (15) ---------- */

    add({
      id: 'u_install', cat: 'runnable', sev: 'high', points: 5,
      ok: p.hasInstall || p.installCommand,
      title: M('Непонятно, как установить программу', 'It is unclear how to install it'),
      why: M('В README нет простой инструкции: откуда скачать, как распаковать, что нажать.',
        'The README has no simple instructions: where to download, how to unpack, what to click.'),
      action: M('Не запускай наугад. Найди на странице релиза файл для своей системы и прочитай README до конца. Если инструкции нет — попроси её у автора.',
        'Do not run it blindly. Find the file for your system on the release page and read the README to the end. If there are no instructions, ask the author.')
    });

    add({
      id: 'u_assets', cat: 'runnable', sev: 'high', points: 5,
      ok: p.hasBinaries || !!p.demoLink || (p.kind === 'library' && p.installCommand),
      title: M('Скачивать нечего', 'There is nothing to download'),
      why: M('В релизах нет готового файла, а собрать из исходников может не каждый.',
        'The releases have no ready-made file, and not everyone can build from source.'),
      action: M('Попроси автора выложить готовую сборку. Если её нет, этот проект только для разработчиков — не трать время на установку.',
        'Ask the author to publish a ready-made build. If there is none, this project is for developers only — do not waste time installing it.')
    });

    add({
      id: 'u_requirements', cat: 'runnable', sev: 'medium', points: 5,
      ok: p.kind === 'web'
        ? !!p.demoLink
        : /(windows|macos|mac os|linux|ubuntu|debian|android|ios|\.net|node(\.js)?|python|java|browser|requires|requirements|требован|нужен|нужна|версия)/i.test(readme),
      title: M('Не указаны требования', 'Requirements are not stated'),
      why: M('Непонятно, какая нужна система и что установить заранее. Программа может просто не запуститься.',
        'It is unclear which system is required and what to install first. The program may simply not start.'),
      action: M('Проверь, что у тебя подходящая версия Windows/macOS/Linux и нужный рантайм (.NET, Node.js, Python). Если не уверен — спроси в Issues.',
        'Check that you have a supported version of Windows/macOS/Linux and the required runtime (.NET, Node.js, Python). If unsure, ask in Issues.')
    });

    /* ---------- quality (15) ---------- */

    add({
      id: 'u_visual', cat: 'quality', sev: 'medium', points: 6,
      ok: p.hasScreenshots,
      title: M('Нет скриншотов или видео', 'No screenshots or video'),
      why: M('Ты не видишь, как программа выглядит и работает, до запуска.',
        'You cannot see how the program looks or works before running it.'),
      action: M('Не запускай вслепую. Попроси скриншот или посмотри видео. Если их нет — это плохой знак, особенно для новой программы.',
        'Do not run it blindly. Ask for a screenshot or watch a video. If there are none, that is a bad sign, especially for a new program.')
    });

    add({
      id: 'u_feedback', cat: 'quality', sev: 'medium', points: 4,
      skip: repo.has_issues && !repo.open_issues_count && p.ageDays < 30,
      skipReason: M('проект слишком новый, отзывов пока нет — судить не по чему', 'the project is too new and has no feedback yet, so there is nothing to judge'),
      ok: !!repo.has_issues || !!repo.has_discussions || p.hasContact,
      title: M('Негде оставить отзыв', 'There is no place to leave feedback'),
      why: M('Issues и Discussions выключены: о проблеме нельзя сообщить публично, а другие пользователи не увидят ответ.',
        'Issues and Discussions are disabled: a problem cannot be reported publicly, and other users will not see the answer.'),
      action: M('Если программа не работает, связаться с автором будет сложно. Учти это и не запускай её на важном компьютере.',
        'If the program does not work, contacting the author will be hard. Keep that in mind and do not run it on an important machine.')
    });

    add({
      id: 'u_maintained', cat: 'quality', sev: 'high', points: 5,
      ok: (function () {
        if (!repo.pushed_at) return false;
        var days = Math.floor((Date.now() - new Date(repo.pushed_at).getTime()) / 86400000);
        return days <= 180;
      })(),
      vars: { date: dateStr(repo.pushed_at) },
      title: M('Проект давно не обновлялся', 'The project has not been updated for a long time'),
      why: M('Последнее изменение — {date}. Ошибки и дыры в безопасности могли остаться без исправлений.',
        'The last change was {date}. Bugs and security holes may have been left unfixed.'),
      action: M('Проверь Issues: возможно, о проблеме уже писали. Не запускай старую сборку без проверки на VirusTotal.',
        'Check Issues: someone may have reported the problem already. Do not run an old build without checking it on VirusTotal.')
    });

    /* ---------- repository (10) ---------- */

    add({
      id: 'u_license', cat: 'repo', sev: 'medium', points: 4,
      ok: !!repo.license,
      title: M('Нет лицензии', 'No license'),
      why: M('Формально автор не разрешил использовать программу. Для скачивания это юридический риск, а не технический.',
        'Formally the author has not allowed anyone to use the program. For downloading this is a legal risk, not a technical one.'),
      action: M('Прочитай условия в README. Если лицензии нет, использовать программу можно только на свой риск.',
        'Read the terms in the README. If there is no license, you can use the program only at your own risk.')
    });

    add({
      id: 'u_readme', cat: 'repo', sev: 'medium', points: 4,
      ok: !!(p.description && p.description.trim().length >= 20) && readme.trim().length >= 600,
      title: M('Непонятно, что это за программа', 'It is unclear what this program is'),
      why: M('README короткий или не объясняет, для кого он и что делает. Приходится догадываться по файлам.',
        'The README is short or does not explain who it is for and what it does. You have to guess from the files.'),
      action: M('Прочитай описание и отзывы. Если всё равно непонятно — не запускай: скорее всего, автор сам ещё не решил, для кого это.',
        'Read the description and feedback. If it is still unclear, do not run it: most likely the author has not decided who it is for.')
    });

    add({
      id: 'u_users', cat: 'repo', sev: 'low', points: 2,
      ok: (repo.stargazers_count || 0) >= 5 || (repo.forks_count || 0) > 0 || p.downloads > 0,
      vars: { downloads: p.downloads, stars: repo.stargazers_count || 0 },
      title: M('Программой почти никто не пользуется', 'Almost nobody uses this program'),
      why: M('Нет звёзд и скачиваний: нет опыта других людей, на который можно опереться.',
        'No stars and no downloads: there is no experience of other people to rely on.'),
      action: M('Это не приговор для нового проекта, но проверь файлы особенно внимательно: запусти в Sandbox и посмотри отчёт VirusTotal.',
        'This is not a verdict on a new project, but check the files especially carefully: run it in a sandbox and read the VirusTotal report.')
    });

    /* ---------- product (20) — «насколько хорош в заявленном» ---------- */

    add({
      id: 'u_claims', cat: 'product', sev: 'medium', points: 6,
      skip: p.claims.checked < 3 || p.claims.mismatch,
      skipReason: p.claims.mismatch
        ? M('описание и README на разных языках — сверить формулировки дословно нельзя', 'the description and the README are in different languages, so the wording cannot be compared directly')
        : M('в описании слишком мало слов, чтобы сверить обещания с README', 'the description has too few words to compare its claims with the README'),
      ok: p.claims.ok,
      vars: {
        missing: p.claims.words.filter(function (w) { return p.claims.found.indexOf(w) < 0; }).slice(0, 4).join(', ')
      },
      title: M('README не подтверждает обещания', 'The README does not back up the claims'),
      why: M('В описании заявлено одно, а в README не хватает деталей: {missing}. Непонятно, что ты получишь.',
        'The description claims one thing, but the README lacks details: {missing}. It is unclear what you will get.'),
      action: M('Сверь список возможностей с описанием. Если чего-то не хватает — спроси автора до скачивания, а не после.',
        'Compare the feature list with the description. If something is missing, ask the author before downloading, not after.')
    });

    add({
      id: 'u_features', cat: 'product', sev: 'low', points: 4,
      ok: (readme.match(/^\s*[-*]\s+\S/gm) || []).length >= 5 || readme.length >= 1500,
      title: M('Возможности описаны поверхностно', 'The features are described vaguely'),
      why: M('Нет списка функций или примеров: сложно понять, что программа умеет и чего в ней нет.',
        'There is no feature list or examples: it is hard to tell what the program can and cannot do.'),
      action: M('Посмотри скриншоты и раздел возможностей. Если их нет — попроси автора описать подробнее и не жди многого.',
        'Look at the screenshots and the features section. If there are none, ask the author for details and keep your expectations low.')
    });

    add({
      id: 'u_release_notes', cat: 'product', sev: 'low', points: 3,
      skip: !(ctx.releases || []).length,
      skipReason: M('релизов нет — рассказывать об изменениях нечего', 'there are no releases, so there are no changes to describe'),
      ok: p.hasReleaseNotes,
      title: M('Нет описания изменений', 'No release notes'),
      why: M('Непонятно, что нового в версии и что исправлено. Приходится верить на слово.',
        'It is unclear what is new in this version and what was fixed. You have to take it on faith.'),
      action: M('Перед обновлением прочитай заметки к релизу. Если их нет, узнай у автора, что изменилось, и проверь новую версию заново.',
        'Read the release notes before updating. If there are none, ask the author what changed and check the new version again.')
    });

    add({
      id: 'u_platform', cat: 'product', sev: 'medium', points: 3,
      ok: p.kind === 'web' ? !!p.demoLink : (p.kind === 'library' ? p.installCommand : p.platform !== 'unknown'),
      title: M('Неясно, для какой системы файл', 'It is unclear which system the file is for'),
      why: M('В релизах нет файлов с понятными названиями для Windows, macOS или Linux.',
        'The releases have no clearly named files for Windows, macOS or Linux.'),
      action: M('Проверь расширение: .exe/.msi — Windows, .dmg — macOS, .AppImage/.deb — Linux. Не запускай файл не для своей системы.',
        'Check the extension: .exe/.msi is Windows, .dmg is macOS, .AppImage/.deb is Linux. Do not run a file made for another system.')
    });

    add({
      id: 'u_safety', cat: 'product', sev: p.hasAdmin || p.risk.declared.length ? 'high' : 'medium', points: 4,
      skip: p.kind === 'library' || p.kind === 'web' || p.kind === 'docs',
      skipReason: M('этот проект ничего не устанавливает на компьютер — предупреждать о побочных эффектах не о чем', 'this project installs nothing on your computer, so there are no side effects to warn about'),
      ok: p.safety.hits >= 2,
      title: M('Нет предупреждений о побочных эффектах', 'No warnings about side effects'),
      why: M('Не сказано, что программа делает с системой, как её остановить и как убрать последствия.',
        'It does not say what the program does to the system, how to stop it, or how to undo the changes.'),
      action: M('До запуска выясни, как закрыть программу и восстановить изменения. Если этого нет в README — не запускай.',
        'Before running, find out how to close the program and undo changes. If the README does not say, do not run it.')
    });

    /* ---------- trust (12) ---------- */

    add({
      id: 'u_policy', cat: 'trust', sev: 'medium', points: 4,
      ok: p.hasSecurityMd || /(report[^\n]{0,40}(vulnerab|security)|сообщ[^\n]{0,40}(уязвим|безопасн))/i.test(readme),
      title: M('Не сказано, куда сообщать о проблемах безопасности', 'No security contact'),
      why: M('Если программа поведёт себя странно, непонятно, кому писать и кто за это отвечает.',
        'If the program behaves strangely, it is unclear who to contact and who is responsible.'),
      action: M('Проверь раздел Issues: если он открыт, напиши туда. Если закрыт и контакта нет — это минус к доверию.',
        'Check the Issues tab: if it is open, report there. If it is closed and there is no contact, that lowers trust.')
    });

    add({
      id: 'u_ci', cat: 'trust', sev: 'medium', points: 4,
      skip: !(ctx.releases || []).length,
      skipReason: M('релизов нет — проверять происхождение файлов нечего', 'there are no releases, so there is no file provenance to check'),
      ok: p.workflows > 0,
      title: M('Сборка не автоматизирована', 'The build is not automated'),
      why: M('Не видно, из какого кода получился релиз. Проверить цепочку сборки нельзя.',
        'It is not visible which code produced the release. The build chain cannot be checked.'),
      action: M('Если умеешь — скачай исходники и собери сам. Если нет — проверь файл на VirusTotal и запускай в Sandbox.',
        'If you can, download the source and build it yourself. If not, check the file on VirusTotal and run it in a sandbox.')
    });

    add({
      id: 'u_history', cat: 'trust', sev: 'low', points: 4,
      ok: p.ageDays >= 30 || (repo.stargazers_count || 0) >= 25,
      vars: { age: function () {
        if (p.ageDays === 0) return state.lang === 'ru' ? 'сегодня' : 'today';
        return ageText(p.ageDays) + (state.lang === 'ru' ? ' назад' : ' ago');
      } },
      title: M('У проекта почти нет истории', 'The project has almost no history'),
      why: M('Репозиторий создан: {age}. У новых проектов ещё нет репутации: ни отзывов, ни исправленных ошибок.',
        'The repository was created {age}. New projects have no reputation yet: no feedback, no fixed bugs.'),
      action: M('Посмотри, есть ли у автора другие проекты и отвечает ли он на вопросы. Для нового проекта это особенно важно.',
        'See whether the author has other projects and answers questions. For a new project this matters even more.')
    });

    return out;
  }

  function buildChecks(ctx, mode) {
    var p = ctx.profile || (ctx.profile = detectProfile(ctx));
    return mode === 'user' ? userChecks(ctx, p) : devChecks(ctx, p);
  }

  /* ------------------------------------------------------------------ */
  /* Audit                                                               */
  /* ------------------------------------------------------------------ */

  function chooseConfigs(paths) {
    var re = /(^|\/)(\.env(\.[A-Za-z0-9_-]+)?|config\.(js|ts|json|py)|appsettings\.json|settings\.py|secrets?\.(json|ya?ml|toml)|firebase\.json|docker-compose\.ya?ml)$/i;
    return paths.filter(function (p) {
      return re.test(p) && !/\.(example|sample|template|dist)$/i.test(p);
    }).slice(0, 2);
  }

  function chooseSources(paths, buildCandidates) {
    var picked = [];
    function push(p) {
      if (p && picked.indexOf(p) < 0 && picked.length < 4) picked.push(p);
    }
    (buildCandidates || []).slice(0, 1).forEach(push);
    var code = paths.filter(function (p) {
      if (!CODE_RE.test(p)) return false;
      if (TEST_RE.test(p)) return false; /* fixtures in tests are not behaviour */
      if (/(^|\/)(node_modules|vendor|dist|build|coverage|\.git)\//i.test(p)) return false;
      if (/\.min\./i.test(p)) return false;
      return true;
    });
    code.filter(function (p) {
      return /(^|\/)(main|program|launcher|winlock|app|index|server|bot|cli|install|setup|core)\.[A-Za-z0-9]+$/i.test(p);
    }).forEach(push);
    code.filter(function (p) { return p.indexOf('/') < 0 || /^src\//.test(p); }).forEach(push);
    code.forEach(push);
    return picked;
  }

  function audit(repoRef) {
    var base = '/repos/' + repoRef.owner + '/' + repoRef.name;
    var ctx = { sources: [], scanned: [], releases: [] };

    setStatus(t('loadingRepo'));
    return api(base).then(function (repo) {
      ctx.repo = repo;
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
      ctx.pathText = ctx.paths.join('\n');
      if (!ctx.blobs.length) throw new HttpError(404, 'empty', 'empty');

      setStatus(t('loadingReadme'));
      return api(base + '/readme', { raw: true, accept: 'application/vnd.github.raw' }).catch(function (err) {
        if (err.kind === 'notfound') return '';
        throw err;
      });
    }).then(function (readme) {
      ctx.readme = readme || '';
      setStatus(t('loadingScan'));

      var buildCandidates = pathsMatching(ctx.paths, /(^|\/)(build\.(ps1|sh|bat|cmd)|Makefile|CMakeLists\.txt|meson\.build|Justfile|Taskfile\.ya?ml|configure)$/i);
      var configs = chooseConfigs(ctx.paths);
      var sources = chooseSources(ctx.paths, buildCandidates);
      var targets = uniq(configs.concat(sources)).slice(0, 7);

      var fetches = targets.map(function (path) {
        return api(base + '/contents/' + path.split('/').map(encodeURIComponent).join('/'), {
          raw: true, accept: 'application/vnd.github.raw'
        }).then(function (text) {
          return { path: path, text: text || '' };
        }).catch(function () {
          return { path: path, text: '' };
        });
      });

      return Promise.all(fetches).then(function (files) {
        var readable = files.filter(function (f) { return f.text && f.text.length <= 400000; });
        ctx.fetched = readable;
        ctx.scanned = readable.map(function (f) {
          return { path: f.path, hits: scanText(f.text) };
        });
        ctx.sources = readable.filter(function (f) {
          return CODE_RE.test(f.path) || buildCandidates.indexOf(f.path) >= 0;
        });
        ctx.buildPath = buildCandidates.filter(function (p) {
          return readable.some(function (f) { return f.path === p; });
        })[0] || '';
        var buildFile = readable.filter(function (f) { return f.path === ctx.buildPath; })[0];
        ctx.buildText = buildFile ? buildFile.text : '';

        var wf = ctx.paths.filter(function (p) { return /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(p); })[0];
        if (!wf) { ctx.workflowText = ''; return; }
        return api(base + '/contents/' + wf.split('/').map(encodeURIComponent).join('/'), {
          raw: true, accept: 'application/vnd.github.raw'
        }).then(function (text) {
          ctx.workflowText = text || '';
          ctx.scanned.push({ path: wf, hits: scanText(ctx.workflowText) });
        }).catch(function () { ctx.workflowText = ''; });
      });
    }).then(function () {
      return api(base + '/releases?per_page=5').catch(function () { return []; });
    }).then(function (releases) {
      ctx.releases = Array.isArray(releases) ? releases : [];
      ctx.releaseCount = ctx.releases.length;
      ctx.releaseBodies = ctx.releases.map(function (r) { return r.body || ''; }).join('\n\n');
      setStatus(t('loadingScore'));

      ctx.profile = detectProfile(ctx);
      state.ctx = ctx;
      state.checks = buildChecks(ctx, state.mode);
      computeScore();
      return true;
    });
  }

  function computeScore() {
    var res = scoreChecks(state.checks, PROFILES[state.mode]);
    state.score = res.score;
    state.catScores = res.cats;
    state.findings = res.findings;
    state.skipped = res.skipped;
    state.totalWeight = res.total;
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  function scoreColor(score) {
    if (score >= 85) return '#1f6b47';
    if (score >= 70) return '#4f6b1c';
    if (score >= 50) return '#9a6f0b';
    return '#bd3310';
  }

  function gradeText(score) {
    if (state.mode === 'user') {
      var ug = t('gradesUser');
      if (score >= 85) return ug.great;
      if (score >= 70) return ug.good;
      if (score >= 50) return ug.meh;
      return ug.bad;
    }
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

  function renderRateBadge() { renderRate(); }

  function catColor(earned, max) {
    var pct = max ? (earned / max) * 100 : 0;
    if (pct >= 85) return '#1f6b47';
    if (pct >= 60) return '#4f6b1c';
    if (pct >= 35) return '#9a6f0b';
    return '#bd3310';
  }

  function profileCard() {
    var p = state.ctx.profile;
    var repo = state.ctx.repo;
    var facts = profileFacts(p, state.ctx);
    var html = '<div class="profile-card">' +
      '<div class="profile-head">' +
      '<span class="profile-label">' + esc(t('profileHead')) + '</span>' +
      '<span class="profile-kind">' + esc(pick(kindLabel(p.kind))) + '</span>' +
      '</div>';
    if (repo.description) {
      html += '<p class="profile-desc">' + esc(repo.description) + '</p>';
    }
    html += '<ul class="profile-facts">';
    facts.forEach(function (f) {
      html += '<li><b>' + esc(pick(f.k)) + '</b>' + esc(String(pick(f.v) || '')) + '</li>';
    });
    html += '</ul>';
    html += '<p class="profile-note">' + esc(t(p.kind === 'other' ? 'profileNoteUnknown' : 'profileNote')) + '</p>';
    html += '</div>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /* Live file check                                                     */
  /*                                                                     */
  /* GitHub publishes a SHA-256 for every release asset, so a file can be */
  /* identified without downloading it. AlienVault OTX answers by hash    */
  /* from the browser and is the only third party this page talks to.     */
  /* None of this touches the score: the score is deterministic, the      */
  /* live check is evidence and changes as the databases change.          */
  /* ------------------------------------------------------------------ */

  var OTX_API = 'https://otx.alienvault.com/api/v1/indicators/';
  var LIVE_MAX_FILES = 3;
  var ENGINE_NAMES = { clamav: 'ClamAV', msdefender: 'Microsoft Defender', yarad: 'YARA', yara: 'YARA' };

  function sha256Of(asset) {
    var m = /^sha256:([a-f0-9]{64})$/i.exec(String((asset && asset.digest) || ''));
    return m ? m[1].toLowerCase() : '';
  }

  function liveTargets(profile, newestTag) {
    var p = profile || (state.ctx && state.ctx.profile);
    if (!p) return [];
    var all = p.allAssets || [];
    var newest = newestTag !== undefined ? newestTag
      : ((state.ctx && state.ctx.releases && state.ctx.releases[0] && state.ctx.releases[0].tag_name) || '');
    var fresh = newest ? all.filter(function (a) { return a.tag === newest; }) : [];
    var pool = fresh.filter(sha256Of);
    if (!pool.length) pool = all.filter(sha256Of);
    var rank = function (a) {
      if (/\.(exe|msi|msix|dmg|pkg|appimage|deb|rpm|apk|ipa)$/i.test(a.name)) return 0;
      if (/\.(7z|zip|rar|tgz|tar\.gz)$/i.test(a.name)) return 1;
      return 2;
    };
    return pool.sort(function (a, b) {
      var d = rank(a) - rank(b);
      return d !== 0 ? d : (b.downloads - a.downloads);
    }).slice(0, LIVE_MAX_FILES);
  }

  /* Pure: network payloads in, one small object out. Testable without a DOM. */
  function verdictFromOtx(hash, general, analysis) {
    var info = (general && general.pulse_info) || {};
    var pulses = typeof info.count === 'number' ? info.count : (info.pulses || []).length;
    var engines = [];
    var plugins = (analysis && analysis.analysis && analysis.analysis.plugins) || {};
    Object.keys(plugins).forEach(function (id) {
      var res = plugins[id] && plugins[id].results;
      if (!res) return;
      var d = res.detection;
      var label = '';
      if (Array.isArray(d)) label = d.length ? String(d[0].rule_name || d[0].name || '') : '';
      else if (typeof d === 'string') label = d;
      if (!label && Array.isArray(res.alerts) && res.alerts.length) label = String(res.alerts[0]);
      if (!label) return;
      engines.push({ engine: ENGINE_NAMES[id] || id, label: label });
    });
    return {
      hash: hash,
      answered: !!(general || analysis),
      pulses: pulses,
      pulseNames: (info.pulses || []).slice(0, 2).map(function (p) {
        return String((p && p.name) || '');
      }).filter(Boolean),
      engines: engines,
      verdict: engines.length ? 'threat' : (pulses ? 'pulse' : 'unknown')
    };
  }

  function otxJson(url) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 9000) : null;
    return fetch(url, {
      headers: { accept: 'application/json' },
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (res.status === 429 || res.status === 403) {
        var limited = new Error('rate limited');
        limited.rateLimited = true;
        throw limited;
      }
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json();
    }, function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  function checkHash(hash) {
    var base = OTX_API + 'file/' + hash;
    var limited = false;
    function ask(part) {
      return otxJson(base + part).catch(function (err) {
        if (err && err.rateLimited) limited = true;
        return null;
      });
    }
    return Promise.all([ask('/general'), ask('/analysis')]).then(function (res) {
      var v = verdictFromOtx(hash, res[0], res[1]);
      if (!v.answered) {
        var err = new Error('no answer');
        err.rateLimited = limited;
        throw err;
      }
      return v;
    });
  }

  function liveState() {
    var ctx = state.ctx;
    if (!ctx) return null;
    if (!ctx.live) {
      var targets = liveTargets(ctx.profile);
      ctx.live = {
        status: targets.length ? 'idle' : 'empty',
        rows: targets.map(function (a) {
          return {
            name: a.name, size: a.size, url: a.url, hash: sha256Of(a),
            status: 'waiting', verdict: null, rateLimited: false
          };
        })
      };
    }
    return ctx.live;
  }

  function fmtSize(n) {
    if (!n) return '';
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' ' + t('unitMb');
    if (n >= 1024) return Math.round(n / 1024) + ' ' + t('unitKb');
    return n + ' ' + t('unitB');
  }

  function liveChip(row) {
    if (row.status === 'failed') return { cls: 'failed', text: t(row.rateLimited ? 'liveLimit' : 'liveFailed') };
    if (row.status !== 'done' || !row.verdict) {
      return { cls: 'waiting', text: t(row.status === 'loading' ? 'liveLoading' : 'liveWaiting') };
    }
    if (row.verdict.verdict === 'threat') return { cls: 'threat', text: t('liveThreat') };
    if (row.verdict.verdict === 'pulse') return { cls: 'pulse', text: t('livePulse') };
    return { cls: 'unknown', text: t('liveUnknown') };
  }

  function liveResult(row) {
    if (row.status === 'failed') return t(row.rateLimited ? 'liveLimit' : 'liveErrorNote');
    if (row.status !== 'done' || !row.verdict) return '';
    var v = row.verdict;
    if (v.verdict === 'threat') {
      var list = v.engines.slice(0, 3).map(function (e) { return e.engine + ': ' + e.label; }).join('; ');
      if (v.engines.length > 3) list += ' …';
      return fmt(t('liveEngines'), { n: v.engines.length, list: list });
    }
    if (v.verdict === 'pulse') {
      var text = fmt(t('livePulses'), { n: v.pulses });
      if (v.pulseNames.length) text += ' — ' + v.pulseNames.join(' · ');
      return text;
    }
    return t('liveUnknownNote');
  }

  function liveRow(row, i) {
    var chip = liveChip(row);
    var result = liveResult(row);
    return '<li class="live-file ' + chip.cls + '" data-threat="' + i + '">' +
      '<div class="live-name"><span class="live-chip ' + chip.cls + '">' + esc(chip.text) + '</span>' +
      '<b>' + esc(row.name) + '</b>' +
      (row.size ? '<span class="live-size">' + esc(fmtSize(row.size)) + '</span>' : '') +
      '</div>' +
      (result ? '<p class="live-result">' + esc(result) + '</p>' : '') +
      '<div class="live-links">' +
      '<a href="https://otx.alienvault.com/indicator/file/' + esc(row.hash) + '" target="_blank" rel="noopener">' + esc(t('liveOtx')) + '</a>' +
      '<a href="https://www.virustotal.com/gui/file/' + esc(row.hash) + '" target="_blank" rel="noopener">' + esc(t('liveVt')) + '</a>' +
      '<button class="linkish" type="button" data-copy-hash="' + esc(row.hash) + '">' + esc(t('liveCopyHash')) + '</button>' +
      '</div></li>';
  }

  function liveCard() {
    var live = liveState();
    if (!live) return '';
    var p = state.ctx.profile || {};
    if (!p.hasBinaries && !p.hasArchive) return '';
    if (!live.rows.length) {
      return '<p class="live-none" id="liveCheck">' + esc(t('liveNoTargets')) + '</p>';
    }
    var finished = live.rows.filter(function (r) { return r.status === 'done' || r.status === 'failed'; }).length;
    var failed = live.rows.some(function (r) { return r.status === 'failed'; });
    var head = live.status === 'done'
      ? fmt(t('liveProgress'), { n: finished, m: live.rows.length })
      : (live.status === 'running' ? t('liveLoading') : '');

    var html = '<div class="live-card" id="liveCheck" aria-live="polite">' +
      '<div class="live-head"><h3>' + esc(t('liveHead')) + '</h3>' +
      '<span class="live-src">' + esc(t('liveSource')) + '</span>' +
      (head ? '<span class="live-progress">' + esc(head) + '</span>' : '') +
      '</div>' +
      '<p class="live-note">' + esc(t('liveNote')) + '</p>' +
      '<ul class="live-files">';
    live.rows.forEach(function (row, i) { html += liveRow(row, i); });
    html += '</ul>';
    if (failed) {
      html += '<button class="ghost live-retry" id="liveRetry" type="button">' + esc(t('liveCheckAgain')) + '</button>';
    }
    html += '<p class="live-foot">' + esc(t('liveNotScore')) + '</p></div>';
    return html;
  }

  function paintLiveRow(i) {
    var live = state.ctx && state.ctx.live;
    if (!live || !live.rows[i]) return;
    var el = document.querySelector('[data-threat="' + i + '"]');
    if (!el || !el.parentNode) return;
    var box = document.createElement('ul');
    box.innerHTML = liveRow(live.rows[i], i);
    el.parentNode.replaceChild(box.firstChild, el);
  }

  function paintLive() {
    var wrap = $('liveCheck');
    if (!wrap || !wrap.parentNode) return;
    var box = document.createElement('div');
    box.innerHTML = liveCard();
    if (box.firstChild) wrap.parentNode.replaceChild(box.firstChild, wrap);
  }

  function runLiveCheck() {
    var live = liveState();
    if (!live || !live.rows.length) return Promise.resolve();
    if (live.status === 'running' || live.status === 'done') return Promise.resolve();
    live.status = 'running';
    paintLive();

    var chain = Promise.resolve();
    live.rows.forEach(function (row, i) {
      chain = chain.then(function () {
        row.status = 'loading';
        paintLiveRow(i);
        return checkHash(row.hash).then(function (v) {
          row.status = 'done';
          row.verdict = v;
        }, function (err) {
          row.status = 'failed';
          row.rateLimited = !!(err && err.rateLimited);
        }).then(function () {
          paintLiveRow(i);
          /* stay polite: the public OTX endpoint has no key and no quota to spare */
          return new Promise(function (resolve) { setTimeout(resolve, 350); });
        });
      });
    });

    return chain.then(function () {
      live.status = 'done';
      paintLive();
    });
  }

  function filesWord(n) {
    var count = n || 0;
    if (state.lang !== 'ru') return count + ' file' + (count === 1 ? '' : 's');
    var m10 = count % 10, m100 = count % 100, w = '\u0444\u0430\u0439\u043b\u043e\u0432';
    if (m10 === 1 && m100 !== 11) w = '\u0444\u0430\u0439\u043b';
    else if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) w = '\u0444\u0430\u0439\u043b\u0430';
    return count + ' ' + w;
  }

  function safetyCard() {
    var p = state.ctx.profile;
    var risk = p.risk;
    var items = [];
    var hasFiles = !!(p.hasBinaries || p.hasArchive);
    items.push(t('safetyIntro'));
    if (p.hasSource) items.push(fmt(t('safetySourceOpen'), { n: filesWord(p.sourceCount || 0) }));
    else if (p.hasBinaries) items.push(t('safetySourceClosed'));
    if (!hasFiles) items.push(t(p.kind === 'web' ? 'safetySite' : 'safetyNoFiles'));

    if (risk.network) items.push(t('safetyNetwork'));
    else if (risk.scanned) items.push(t('safetyNoNetwork'));

    if (risk.declared.length) {
      items.push(fmt(t('safetyDeclared'), {
        items: risk.declared.map(function (r) { return pick(r.label); }).join(', ')
      }));
    }
    if (p.hasBinaries && !p.hasChecksums) items.push(t('safetyNoChecksums'));
    if (p.hasBinaries && p.isUnsigned) items.push(t('safetyUnsigned'));
    if (p.hasArchive) items.push(t('safetyArchive'));
    if (p.hasAdmin) items.push(t('safetyAdmin'));

    var live = liveState();
    var canLookup = !!(live && live.rows.length);
    if (p.hasBinaries && !canLookup) items.push(t('safetyNoScan'));

    var html = '<div class="safety-card">' +
      '<div class="safety-head"><h2>' + esc(t('safetyHead')) + '</h2>' +
      '<span class="profile-label">LC·02</span></div>' +
      '<ul class="safety-list">';
    items.forEach(function (line) { html += '<li>' + esc(line) + '</li>'; });
    html += '</ul>';
    if (hasFiles) html += liveCard();
    html += (hasFiles && !canLookup
      ? '<div class="safety-actions">' +
      '<p class="safety-vt">' + esc(t('safetyVt')) + '</p>' +
      '<a class="ghost" href="https://www.virustotal.com/gui/home/upload" target="_blank" rel="noopener">' +
      esc(t('safetyVtBtn')) + '</a></div>'
      : '') +
      '<p class="safety-not">' + esc(t('safetyNotGuarantee')) + '</p>' +
      '</div>';
    return html;
  }

  function skippedNote() {
    if (!state.skipped.length) return '';
    var list = state.skipped.slice(0, 4).map(function (s) {
      return esc(t('cats')[s.cat] || s.cat) + ' — ' + esc(fmt(pick(s.skipReason), s.vars || {}));
    });
    var extra = state.skipped.length > 4 ? ' …' : '';
    return '<p class="skipped"><b>' + esc(t('skippedLabel')) + ':</b> ' + list.join('; ') + extra + '</p>';
  }

  function render(animate) {
    var ctx = state.ctx;
    if (!ctx) return;
    var repo = ctx.repo;
    var result = $('result');
    var counts = { critical: 0, high: 0, medium: 0, low: 0 };
    state.findings.forEach(function (f) { counts[f.sev]++; });
    var isUser = state.mode === 'user';
    var profile = PROFILES[state.mode];

    var repoUrl = 'https://github.com/' + repo.full_name;
    var html = '';

    html += '<div class="repo-bar">' +
      '<div class="repo-name">' +
      '<img src="' + esc(repo.owner.avatar_url) + '" width="28" height="28" alt="">' +
      '<a href="' + esc(repoUrl) + '" target="_blank" rel="noopener">' + esc(repo.full_name) + '</a>' +
      (repo.language ? '<span class="muted">· ' + esc(repo.language) + '</span>' : '') +
      '</div>' +
      '<div class="repo-meta">' +
      '<span class="mode-flag">' + esc(t(isUser ? 'modeFlagUser' : 'modeFlagDev')) + '</span>' +
      '<span><b>' + nf(repo.stargazers_count) + '</b> ' + t('stars') + '</span>' +
      '<span><b>' + nf(repo.forks_count) + '</b> ' + t('forks') + '</span>' +
      '<span><b>' + nf(ctx.blobs.length) + '</b> ' + t('files') + '</span>' +
      '<span>' + t('updated') + ' ' + esc(dateStr(repo.pushed_at)) + '</span>' +
      '</div></div>';

    html += profileCard();

    html += '<div class="scoreboard">';

    /* score card */
    var scoreInk = scoreColor(state.score);
    html += '<div class="card score-card">' +
      '<div class="score-label"><span>' + esc(t('score')) + '</span><span>' + esc(t(isUser ? 'modeShortUser' : 'modeShortDev')) + '</span></div>' +
      '<div class="score-figure"><span id="scoreNum" style="color:' + scoreInk + '">0</span>' +
      '<span class="score-of">' + esc(t('outOf')) + '</span></div>' +
      '<div class="stamp" style="color:' + scoreInk + '">' + esc(gradeText(state.score)) + '</div>' +
      '<div class="gauge" style="color:' + scoreInk + '"><span class="gauge-fill" data-final="' + state.score + '"></span></div>' +
      '<div class="gauge-note"><span>0</span><span>50</span><span>100</span></div>' +
      '</div>';

    /* summary card */
    html += '<div class="card summary-card">' +
      '<div class="summary-head"><h2>' + esc(t('summary')) + '</h2>' +
      '<span class="counts"><b>' + state.findings.length + '</b> ' + esc(pluralIssues(state.findings.length)) + '</span></div>';

    html += '<div class="bars">';
    profile.cats.forEach(function (cat) {
      var cs = state.catScores[cat.id] || { earned: 0, max: 0 };
      var pct = cs.max ? Math.round((cs.earned / cs.max) * 100) : 0;
      html += '<div class="bar-row">' +
        '<span class="bar-name">' + esc(t('cats')[cat.id]) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" data-pct="' + pct + '" style="background:' + catColor(cs.earned, cs.max) + '"></span></span>' +
        '<span class="bar-val">' + (cs.max ? cs.earned + '/' + cs.max : '—') + '</span>' +
        '</div>';
    });
    html += '</div>';

    html += '<div class="actions">' +
      '<button class="ghost" id="btnCard" type="button">' + esc(t('card')) + '</button>' +
      '<button class="ghost" id="btnBadge" type="button">' + esc(t('badge')) + '</button>' +
      '<button class="ghost" id="btnAll" type="button">' + esc(t(isUser ? 'copyAllNote' : 'copyAll')) + '</button>' +
      '<button class="ghost" id="btnAgain" type="button">' + esc(t('again')) + '</button>' +
      '</div>';

    html += '</div></div>'; /* summary + scoreboard */

    if (isUser) html += safetyCard();

    if (ctx.truncated) {
      html += '<p class="hint">' + esc(t('truncated')) + '</p>';
    }

    /* issues */
    html += '<div class="issues"><div class="issues-head"><h2>' + esc(t(isUser ? 'issuesUser' : 'issues')) + '</h2>' +
      '<div class="legend">' +
      '<span><i style="background:#bd3310"></i>' + esc(t('severity').critical) + '</span>' +
      '<span><i style="background:#9a6f0b"></i>' + esc(t('severity').high) + '</span>' +
      '<span><i style="background:#27586f"></i>' + esc(t('severity').medium) + '</span>' +
      '</div></div>';

    if (!state.findings.length) {
      html += '<div class="issue issue-empty"><p>' + esc(t(isUser ? 'noIssuesUser' : 'noIssues')) + '</p></div>';
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

    html += skippedNote();
    html += '</div>';

    html += '<div class="cta"><p>' + esc(t('cta')) + '</p>' +
      '<a class="ghost" href="https://github.com/TIZZ13/launchcheck" target="_blank" rel="noopener">' +
      esc(t('ctaBtn')) + '</a></div>';

    result.innerHTML = html;
    result.hidden = false;

    /* animate the gauge + bars (CSS transitions) and the number */
    var gauge = result.querySelector('.gauge-fill');
    var bars = result.querySelectorAll('.bar-fill');
    void result.getBoundingClientRect(); /* flush initial styles so transitions run */
    if (gauge) gauge.style.width = gauge.getAttribute('data-final') + '%';
    bars.forEach(function (el) {
      el.style.width = el.getAttribute('data-pct') + '%';
    });
    if (animate === false) $('scoreNum').textContent = state.score;
    else animateNumber($('scoreNum'), state.score);

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

    /* live lookup starts after the report is on screen, so it never delays the score */
    if (isUser) runLiveCheck();
  }

  function renderIssue(f, index) {
    var vars = f.vars || {};
    var num = ('0' + (index + 1)).slice(-2);
    var isUser = state.mode === 'user';
    var action = '';
    if (isUser && f.action) {
      action = '<div class="issue-action"><span class="action-label">' + esc(t('actionLabel')) + '</span>' +
        '<p>' + esc(fmt(pick(f.action), vars)) + '</p></div>';
    }
    return '<article class="issue ' + f.sev + '">' +
      '<span class="issue-no" aria-hidden="true">' + num + '</span>' +
      '<div class="issue-top">' +
      '<span class="sev ' + f.sev + '">' + esc(t('severity')[f.sev]) + '</span>' +
      '<span class="issue-cat">' + esc(t('cats')[f.cat]) + '</span>' +
      '</div>' +
      '<h3>' + esc(fmt(pick(f.title), vars)) + '</h3>' +
      '<p>' + esc(fmt(pick(f.why), vars)) + '</p>' +
      action +
      '<div class="issue-actions"><button class="copy" type="button" data-issue="' + index + '">' +
      esc(t(isUser ? 'copyStep' : 'copyPrompt')) + '</button></div>' +
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
    var text = state.mode === 'user' ? f.action : f.prompt;
    return fmt(pick(text), vars);
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
    var isUser = state.mode === 'user';
    var header = fmt(t(isUser ? 'userHeader' : 'promptHeader'), { repo: repo, score: state.score });
    var parts = [header, '', t(isUser ? 'userIntro' : 'promptIntro'), ''];
    state.findings.forEach(function (f, i) {
      parts.push((i + 1) + '. [' + t('severity')[f.sev] + '] ' + fmt(pick(f.title), f.vars || {}));
      if (isUser) parts.push(t('actionLabel') + ': ' + promptText(f));
      else parts.push(promptText(f));
      parts.push('');
    });
    if (!state.findings.length) parts.push(t(isUser ? 'noIssuesUser' : 'noIssues'));
    copyText(parts.join('\n'), t(isUser ? 'copiedAllNote' : 'copiedAll'));
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

    var PAPER = '#f2ebda';
    var PAPER_HI = '#f8f2e4';
    var INK = '#17130e';
    var INK2 = '#3a3227';
    var MUTED = '#6d6252';
    var DIM = '#8a7d68';
    var RULE = '#c6b998';
    var RED = '#bd3310';
    var SERIF = '"Literata", Georgia, serif';
    var SANS = '"Onest", "Segoe UI", sans-serif';
    var MONO = '"JetBrains Mono", Consolas, monospace';

    function track(px) {
      try { x.letterSpacing = px; } catch (e) { }
    }
    function fit(str, max) {
      var s = str;
      if (x.measureText(s).width <= max) return s;
      while (s.length > 4 && x.measureText(s + '…').width > max) s = s.slice(0, -2);
      return s.replace(/[,\s]+$/, '') + '…';
    }

    /* paper + grid */
    x.fillStyle = PAPER;
    x.fillRect(0, 0, 1200, 630);
    var wash = x.createRadialGradient(90, 0, 30, 90, 0, 620);
    wash.addColorStop(0, 'rgba(201,58,20,0.10)');
    wash.addColorStop(1, 'rgba(201,58,20,0)');
    x.fillStyle = wash;
    x.fillRect(0, 0, 700, 630);
    x.strokeStyle = 'rgba(23,19,14,0.05)';
    x.lineWidth = 1;
    for (var gx = 0; gx <= 1200; gx += 26) {
      x.beginPath(); x.moveTo(gx + 0.5, 0); x.lineTo(gx + 0.5, 630); x.stroke();
    }
    for (var gy = 0; gy <= 630; gy += 26) {
      x.beginPath(); x.moveTo(0, gy + 0.5); x.lineTo(1200, gy + 0.5); x.stroke();
    }

    /* brand */
    x.fillStyle = INK;
    x.fillRect(56, 34, 22, 22);
    x.strokeStyle = PAPER_HI;
    x.lineWidth = 2.6;
    x.lineCap = 'square';
    x.lineJoin = 'miter';
    x.beginPath(); x.moveTo(61, 45); x.lineTo(66, 50); x.lineTo(74, 39); x.stroke();

    x.fillStyle = INK;
    x.font = '700 20px ' + SANS;
    var brandName = 'GitHub Checker';
    var brandW = x.measureText(brandName).width;
    x.fillText(brandName, 88, 53);
    x.fillStyle = DIM;
    x.font = '500 10px ' + MONO;
    track('1.6px');
    x.fillText('/ REPO INSPECTION', 88 + brandW + 12, 52);
    track('0px');

    x.textAlign = 'right';
    x.fillStyle = MUTED;
    x.font = '400 11px ' + MONO;
    x.fillText(fit('github.com/' + repo.full_name, 420), 1144, 52);
    x.textAlign = 'left';

    x.fillStyle = INK;
    x.fillRect(56, 76, 1088, 2);
    x.fillStyle = RULE;
    x.fillRect(56, 81, 1088, 1);

    /* repo name */
    x.fillStyle = INK;
    x.font = '700 44px ' + SERIF;
    track('-1.2px');
    x.fillText(fit(repo.full_name, 660), 56, 142);
    track('0px');

    /* description */
    if (repo.description) {
      x.fillStyle = INK2;
      x.font = '400 19px ' + SANS;
      var words = repo.description.split(/\s+/);
      var line = '';
      var lines = [];
      for (var wi = 0; wi < words.length; wi++) {
        var test = line ? line + ' ' + words[wi] : words[wi];
        if (x.measureText(test).width > 620) {
          if (line) lines.push(line);
          line = words[wi];
          if (lines.length >= 2) break;
        } else {
          line = test;
        }
      }
      if (lines.length < 2 && line) lines.push(line);
      if (lines.length === 2 && wi < words.length) {
        var last = lines[1];
        while (last.length > 4 && x.measureText(last + '…').width > 620) last = last.slice(0, -2);
        lines[1] = last.replace(/[,\s]+$/, '') + '…';
      }
      lines.forEach(function (l, idx) { x.fillText(l, 56, 180 + idx * 27); });
    }

    /* category ledger */
    x.fillStyle = DIM;
    x.font = '500 10px ' + MONO;
    track('1.6px');
    x.fillText(fit('BY CATEGORY / ' + pick(kindLabel(state.ctx.profile.kind)).toUpperCase(), 500), 56, 250);
    track('0px');

    var bx = 220, bw = 372, by = 282, gap = 38;
    PROFILES[state.mode].cats.forEach(function (cat, idx) {
      var cs = state.catScores[cat.id] || { earned: 0, max: 0 };
      var yy = by + idx * gap;
      var ccol = catColor(cs.earned, cs.max);

      x.font = '400 13.5px ' + SANS;
      x.fillStyle = INK2;
      x.fillText(fit(t('cats')[cat.id], 150), 56, yy);

      /* ruler track */
      x.strokeStyle = RULE;
      x.lineWidth = 1;
      x.beginPath(); x.moveTo(bx, yy + 1.5); x.lineTo(bx + bw, yy + 1.5); x.stroke();
      x.strokeStyle = 'rgba(23,19,14,0.30)';
      for (var tI = 0; tI <= 10; tI++) {
        var tx = bx + (bw / 10) * tI;
        x.beginPath(); x.moveTo(tx + 0.5, yy - 3); x.lineTo(tx + 0.5, yy + 1.5); x.stroke();
      }

      /* filled portion */
      var w = cs.earned ? Math.max(2, (bw * cs.earned) / cs.max) : 0;
      x.fillStyle = ccol;
      x.fillRect(bx, yy - 7, w, 8.5);

      x.font = '500 10.5px ' + MONO;
      x.fillStyle = MUTED;
      x.fillText(cs.earned + '/' + cs.max, bx + bw + 16, yy + 1);
    });

    /* score panel */
    var px = 760, py = 112, pw = 384, ph = 386;
    x.fillStyle = PAPER_HI;
    x.fillRect(px, py, pw, ph);
    x.strokeStyle = INK;
    x.lineWidth = 2;
    x.strokeRect(px + 1, py + 1, pw - 2, ph - 2);

    x.fillStyle = MUTED;
    x.font = '500 9.5px ' + MONO;
    track('1.8px');
    x.fillText('SCORE / ' + t(state.mode === 'user' ? 'modeShortUser' : 'modeShortDev'), px + 24, py + 30);
    x.textAlign = 'right';
    x.fillText('LC·01', px + pw - 24, py + 30);
    x.textAlign = 'left';
    track('0px');

    var cx = px + pw / 2;
    x.fillStyle = color;
    x.font = '700 132px ' + SERIF;
    x.textAlign = 'center';
    track('-6px');
    x.fillText(String(score), cx, py + 172);
    track('0px');

    x.fillStyle = DIM;
    x.font = '500 11px ' + MONO;
    track('1.4px');
    x.fillText('/ 100', cx, py + 196);
    track('0px');

    /* verdict stamp */
    var label = gradeText(score).toUpperCase();
    x.save();
    x.translate(cx, py + 252);
    x.rotate(-3 * Math.PI / 180);
    x.font = '600 13px ' + MONO;
    track('1.4px');
    var tw = x.measureText(label).width;
    var sw = tw + 30, sh = 36;
    x.strokeStyle = color;
    x.lineWidth = 2;
    x.strokeRect(-sw / 2, -sh / 2, sw, sh);
    x.lineWidth = 1;
    x.strokeRect(-sw / 2 + 4, -sh / 2 + 4, sw - 8, sh - 8);
    x.fillStyle = color;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(label, 0, 1);
    x.restore();
    track('0px');
    x.textAlign = 'left';
    x.textBaseline = 'alphabetic';

    /* gauge */
    var gx0 = px + 24, gw = pw - 48, gy0 = py + 320, gh = 14;
    x.fillStyle = PAPER;
    x.fillRect(gx0, gy0, gw, gh);
    x.fillStyle = color;
    x.fillRect(gx0, gy0, Math.max(2, gw * score / 100), gh);
    x.strokeStyle = INK;
    x.lineWidth = 1;
    x.strokeRect(gx0 + 0.5, gy0 + 0.5, gw - 1, gh - 1);
    x.strokeStyle = 'rgba(23,19,14,0.55)';
    for (var gi = 1; gi < 10; gi++) {
      var gtx = gx0 + (gw / 10) * gi;
      x.beginPath(); x.moveTo(gtx + 0.5, gy0 + gh - 6); x.lineTo(gtx + 0.5, gy0 + gh - 1); x.stroke();
    }
    x.fillStyle = DIM;
    x.font = '500 9px ' + MONO;
    x.fillText('0', gx0, gy0 + 26);
    x.textAlign = 'center';
    x.fillText('50', gx0 + gw / 2, gy0 + 26);
    x.textAlign = 'right';
    x.fillText('100', gx0 + gw, gy0 + 26);
    x.textAlign = 'left';

    /* footer */
    x.fillStyle = INK;
    x.fillRect(56, 548, 1088, 1);
    x.fillStyle = MUTED;
    x.font = '400 11px ' + MONO;
    track('0.4px');
    var cardHost = (location.host && !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(location.host))
      ? location.host
      : 'tizz13.github.io';
    x.fillText(fmt(t('cardFooter'), { host: cardHost }), 56, 576);
    x.fillStyle = DIM;
    x.textAlign = 'center';
    x.fillText('DETERMINISTIC AUDIT · NO AI', 600, 576);
    x.textAlign = 'right';
    x.fillText(dateStr(new Date().toISOString()), 1144, 576);
    x.textAlign = 'left';
    track('0px');

    return canvas;
  }

  function withFonts(fn) {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fn, fn);
      return;
    }
    fn();
  }

  function downloadCard() {
    withFonts(function () {
      var canvas = drawCard();
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          if (blob) downloadBlob(blob, slug(state.ctx.repo.name) + '-githubchecker.png', t('cardDone'));
        }, 'image/png');
      } else {
        var a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = slug(state.ctx.repo.name) + '-githubchecker.png';
        a.click();
        toast(t('cardDone'));
      }
    });
  }

  function badgeSvg() {
    var score = state.score;
    var color = scoreColor(score);
    var label = 'GITHUB CHECKER';
    var value = score + '/100';
    var w = 248;
    var split = 152;
    var mono = "JetBrains Mono, ui-monospace, Consolas, monospace";
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="30" role="img" aria-label="GitHub Checker: ' + value + '">' +
      '<title>GitHub Checker: ' + value + '</title>' +
      '<rect x="0.75" y="0.75" width="' + (w - 1.5) + '" height="28.5" fill="#f2ebda" stroke="#17130e" stroke-width="1.5"/>' +
      '<rect x="' + split + '" y="0" width="' + (w - split) + '" height="30" fill="' + color + '"/>' +
      '<rect x="12" y="12" width="6" height="6" fill="#bd3310"/>' +
      '<text x="24" y="20" fill="#17130e" font-family="' + mono + '" font-size="10.5" font-weight="600" letter-spacing="1.1">' + label + '</text>' +
      '<text x="200" y="20.5" fill="#f8f2e4" text-anchor="middle" font-family="' + mono + '" font-size="12" font-weight="700" letter-spacing="0.3">' + value + '</text>' +
      '</svg>';
  }

  function downloadBadge() {
    var svg = badgeSvg();
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'githubchecker-badge.svg', t('badgeDone'));
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
        storeSet('last', ref.owner + '/' + ref.name);
        var url = new URL(location.href);
        url.searchParams.set('repo', ref.owner + '/' + ref.name);
        history.replaceState(null, '', url.toString());
        document.title = ref.owner + '/' + ref.name + ' · GitHub Checker';
      } catch (e) { /* ignore */ }
      syncModeUrl();
      $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (err) {
      setBusy(false);
      fail(err);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Language, settings, init                                            */
  /* ------------------------------------------------------------------ */

  function modeBlurbText() {
    return t(state.mode === 'user' ? 'modeBlurbUser' : 'modeBlurbDev');
  }

  function syncModeButtons() {
    document.querySelectorAll('[data-mode]').forEach(function (btn) {
      var on = btn.getAttribute('data-mode') === state.mode;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var blurb = $('modeBlurb');
    if (blurb) blurb.textContent = modeBlurbText();
    var group = $('modes');
    if (group) group.setAttribute('aria-label', t('modeGroup'));
  }

  function syncModeUrl() {
    try {
      var url = new URL(location.href);
      if (state.mode === 'user') url.searchParams.set('mode', 'user');
      else url.searchParams.delete('mode');
      history.replaceState(null, '', url.toString());
    } catch (e) { }
  }

  /* Rebuild the report from the data already in memory: no second fetch. */
  function applyMode(mode, animate) {
    state.mode = mode === 'user' ? 'user' : 'dev';
    storeSet('mode', state.mode);
    syncModeButtons();
    if (!state.ctx) { syncModeUrl(); return; }
    state.showAll = false;
    state.checks = buildChecks(state.ctx, state.mode);
    computeScore();
    render(animate !== false);
    syncModeUrl();
  }

  function applyLang(lang) {
    state.lang = lang === 'en' ? 'en' : 'ru';
    document.documentElement.lang = state.lang;
    document.body.className = 'lang-' + state.lang;
    $('langBtn').textContent = state.lang === 'ru' ? 'EN' : 'RU';
    $('langBtn').setAttribute('aria-label', state.lang === 'ru' ? 'EN / English' : 'RU / Русский');
    $('langBtn').title = state.lang === 'ru' ? 'Переключить на английский' : 'Switch to Russian';

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

    if ($('repoInput')) $('repoInput').placeholder = t('placeholder');
    if (!state.ctx) document.title = t('pageTitle');
    syncModeButtons();

    storeSet('lang', state.lang);

    if (state.ctx) {
      state.checks = buildChecks(state.ctx, state.mode);
      computeScore();
      render(false);
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
        if (state.token) storeSet('token', state.token);
        else storeDel('token');
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
    var params = new URLSearchParams(location.search);
    try {
      var stored = storeGet('lang');
      if (stored === 'ru' || stored === 'en') {
        state.lang = stored;
      } else {
        /* first visit: follow the browser, Russian only for Russian speakers */
        state.lang = /^ru\b/i.test(navigator.language || '') ? 'ru' : 'en';
      }
      state.token = storeGet('token') || '';
      var storedMode = storeGet('mode');
      if (storedMode === 'user' || storedMode === 'dev') state.mode = storedMode;
    } catch (e) {
      state.lang = /^ru\b/i.test(navigator.language || '') ? 'ru' : 'en';
    }
    var urlMode = params.get('mode');
    if (urlMode === 'user' || urlMode === 'dev') state.mode = urlMode;

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

    var modes = $('modes');
    if (modes) {
      modes.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-mode]') : null;
        if (!btn) return;
        var next = btn.getAttribute('data-mode');
        if (next === state.mode) return;
        applyMode(next, true);
      });
    }
    syncModeButtons();

    $('settingsBtn').addEventListener('click', openSettings);
    $('modalClose').addEventListener('click', closeSettings);
    $('tokenClear').addEventListener('click', function () {
      $('tokenInput').value = '';
      state.token = '';
      storeDel('token');
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
    var deep = params.get('repo');
    var last = deep || null;
    if (!last) last = storeGet('last');
    if (last) {
      $('repoInput').value = last;
      if (deep) run(deep);
    }

    renderRate();
    document.addEventListener('click', function (e) {
      var hashBtn = e.target.closest ? e.target.closest('[data-copy-hash]') : null;
      if (hashBtn) {
        copyText(hashBtn.getAttribute('data-copy-hash') || '', t('liveCopied'));
        return;
      }
      var retry = e.target.closest ? e.target.closest('#liveRetry') : null;
      if (retry && state.ctx && state.ctx.live) {
        var live = state.ctx.live;
        live.status = 'idle';
        live.rows.forEach(function (row) {
          row.status = 'waiting';
          row.verdict = null;
          row.rateLimited = false;
        });
        paintLive();
        runLiveCheck();
        return;
      }
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
    module.exports = {
      parseRepo: parseRepo,
      scanText: scanText,
      fmt: fmt,
      detectStack: detectStack,
      detectProfile: detectProfile,
      readmeLangInfo: readmeLangInfo,
      claimsMatch: claimsMatch,
      scanRisk: scanRisk,
      scoreChecks: scoreChecks,
      sha256Of: sha256Of,
      liveTargets: liveTargets,
      verdictFromOtx: verdictFromOtx,
      PROFILES: PROFILES
    };
    return;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
