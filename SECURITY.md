# Security policy

LaunchCheck is a static page. It has no backend, no accounts and no database, and it makes no requests except to `api.github.com`. A GitHub token, if you add one, stays in your browser's `localStorage`.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private reporting instead:

**https://github.com/TIZZ13/launchcheck/security/advisories/new**

Include the page or repository that triggers the problem, what you expected and what happened. A short reproduction is more useful than a long report.

You will get an answer within a few days. There is no bug bounty: this is a free project maintained by one person.

## Scope

In scope:

- the audit page and the rule engine in `assets/app.js`;
- secret detection, including cases where a detected value is rendered, logged or sent anywhere;
- a rule that produces a clearly wrong score from public repository data.

Out of scope:

- the score itself as a judgement about a project;
- vulnerabilities in audited repositories — report those to their maintainers;
- missing headers or settings on GitHub Pages, which this project does not control.

## What the project will not do

- It will not download or run release files.
- It will not claim that a file is safe or virus-free.
- It will not send repository data anywhere except the GitHub API.
