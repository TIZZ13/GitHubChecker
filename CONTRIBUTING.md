# Contributing to GitHub Checker

Thanks for wanting to help. GitHub Checker is a small, dependency-free static site, so contributing is mostly about writing good rules and honest text.

## The most useful contribution: a new check

A check is a small rule plus a prompt. To add one, open an issue first and describe:

1. **The mistake.** What does a maintainer do wrong before launch?
2. **The rule.** How can it be detected from public repository data (file names, README text, repository metadata, releases)?
3. **The cost.** Why does it matter to a stranger who just found the repository?
4. **The prompt.** What exactly should an AI agent do to fix it?

Rules must be deterministic: the same repository must always produce the same result. The rule engine makes no network calls beyond `api.github.com`: the live hash lookup in downloader mode is a separate evidence layer and never changes the score, so it cannot make a result depend on time or popularity.

There are two profiles, `PROFILES.dev` and `PROFILES.user`. A check belongs to one profile and one category, carries a weight, and must declare when it does not apply (`skip` plus `skipReason`) instead of quietly failing. Downloader-mode text must never claim that a file is safe or virus-free: it reports signals, and the decision stays with the reader.

## Text rules

- Explain the problem, not the solution. The prompt explains the solution.
- No marketing language, no exclamation marks, no shaming.
- Russian and English must say the same thing. Keep the Russian natural, not a literal translation.
- A prompt must be safe to paste into an agent: explicit steps, "do not change anything else", no invented commands.

## Code rules

- Plain HTML, CSS and JavaScript. No build step, no npm dependencies, no frameworks.
- Support the current versions of Chrome, Firefox and Safari.
- Every new pure function should be exported for tests (`module.exports` branch at the bottom of `assets/app.js`) and covered in `tests/`.
- Keep the UI usable at 360 px wide.

## Before opening a pull request

```bash
node --check assets/app.js
node --test tests/
python3 scripts/check.py
```

If you changed `assets/app.js` or `assets/styles.css`, bump the `?v=` number in `index.html` so browsers pick up the new file.

## Good first issues

- A new check for a stack you know well (monorepos, mobile apps, data projects).
- Better wording for an existing issue or prompt.
- A translation fix in the Russian interface.
- A bug report with the repository that produced a wrong score.

## Code of conduct

Be decent. Critique the repository, never the person. Assume the other side is acting in good faith.
