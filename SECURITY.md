# Security policy

GitHub Checker is a static page. It has no backend, no accounts and no database. It talks to `api.github.com` and, in downloader mode, sends a release file's SHA-256 to `otx.alienvault.com`. It never downloads the file itself. A GitHub token, if you add one, stays in your browser's `localStorage`.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private reporting instead:

**https://github.com/TIZZ13/GitHubChecker/security/advisories/new**

Include the page or repository that triggers the problem, what you expected and what happened. A short reproduction is more useful than a long report.

You will get an answer within a few days. There is no bug bounty: this is a free project maintained by one person.

## Scope

In scope:

- the audit page and the rule engine in `assets/app.js`;
- secret detection, including cases where a detected value is rendered, logged or sent anywhere;
- a rule that produces a clearly wrong score from public repository data;
- a hash, file name or URL that leaks into a third-party request in downloader mode.

Out of scope:

- the score itself as a judgement about a project;
- vulnerabilities in audited repositories — report those to their maintainers;
- missing headers or settings on GitHub Pages, which this project does not control.

## What the project will not do

- It will not download or run release files.
- It will not send anything to AlienVault OTX except a SHA-256 hash.
- It will not claim that a file is safe or virus-free.
- It will not send repository data anywhere except the GitHub API.
