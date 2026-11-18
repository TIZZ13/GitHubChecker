# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/).

## [1.2.0] — 2026-11-18

### Added

- **Live virus check, shown in both modes.** GitHub publishes a `sha256` digest for every release asset, so each file is identified without downloading it. The hash is looked up in AlienVault OTX (`/analysis` first, `/general` only when no antivirus has seen the hash) from the browser, with no key. Up to three files from the newest release (installers first) are checked, with a short pause between requests. A summary line above the list answers the question directly: whether viruses were found and which antivirus checked the files — ClamAV and Microsoft Defender. Each row repeats the verdict, names the engines and any signatures, links to the full OTX report and to VirusTotal for the same hash, and offers a copy-hash button. Only real antivirus engines get a vote: YARA rules and OTX classifiers fire on harmless installers, so they are never treated as a detection. "No antivirus report" is explicitly *unknown*, not *clean*. The loading status says the files are being checked for viruses.
- **The virus card now answers for every repository.** It is no longer hidden when a project has no ready-made files. It states which empty case applies — no releases, no attached files, no SHA-256 digest, or no file that can be matched by hash — and offers the release page plus a manual VirusTotal upload when a hash is missing.
- The virus check carries a short **BETA** label next to the processed counter in both modes.
- **OTX answers are cached and rate limits recover.** Results are stored in `localStorage` by hash for 7 days (24 hours for "unknown"), so re-opening a repository or switching modes makes no request. A saved answer up to 90 days old is used only when the service fails and is marked as saved. The first 429 stops the run with a 10-minute cooldown instead of spending the remaining budget; failed files are retried automatically up to two times, and a visible **Check again** button retries them by hand. Successful and cached rows are kept.
- The live check is an evidence layer only: it never touches `scoreChecks`, so the score stays deterministic and language-independent.
- **CI for the repository itself.** A GitHub Actions workflow runs `node --check`, the full `node --test` suite and `scripts/check.py` on every push and pull request, so a broken rule or a missing asset cannot reach the site.

### Changed

- The project is now **GitHub Checker**. The product name changed everywhere: page title, header, footer, share card, SVG badge, download file names, docs, issue templates and launch copy. The repository is renamed to `TIZZ13/GitHubChecker`, so the site now lives at `https://tizz13.github.io/GitHubChecker/`; the old repository URL redirects there.
- Browser storage keys moved to `githubchecker.*` with a one-time read of the old `launchcheck.*` keys, so language, mode and a saved token survive the rename.
- Downloader-mode wording no longer says a file can only be checked with an antivirus: it now describes what the hash lookup does, and the safety brief separates integrity (checksums, signature) from reputation (databases, sandboxes).
- The report header and the share card use the `GC` prefix instead of the old `LC` (LaunchCheck), and the README screenshots show the current virus card.

### Fixed

- The share card image still showed the old `launchcheck` address. It now shows the current site address and names the release virus check.
- The browser storage helpers used bare `token`, `lang`, `last` and `mode` keys instead of the documented `githubchecker.*` names. They now use the namespaced keys, still read the old `launchcheck.*` values, and pick up keys written while the bug was live, so a saved token or language is not lost.

## [1.1.0] — 2026-11-18

### Added

- **Downloader mode** — a second audit profile for people who do not write code. 21 checks about whether the ready-made files are worth trusting: open source, undeclared risky calls, checksums, installation instructions, requirements, screenshots, maintenance, licence, whether the claims match the README, and warnings about side effects. It never says a file is safe or virus-free.
- **File safety brief** in downloader mode: facts from the risk scan and release metadata — how many source files were read, whether the code uses the network, which risky behaviour the README already declares, unsigned files, protected archives, admin rights — plus a VirusTotal link and the explicit reminder that this is not a safety guarantee.
- **Project profile detection.** The report first says what the project is: desktop, web, CLI, library, game, bot or docs, platform, distribution, and how old the repository is. Rules are then applied, skipped or reworded for that kind of project.
- **Risk scan over the source.** Deterministic patterns for network access, autostart, process injection, obfuscation, masquerading, shutdown, keyboard hooks, registry changes, Explorer control, process launch and file deletion, separated into declared and undeclared behaviour. Comments are stripped before scanning.
- **Mode switch after an audit.** The report is rebuilt from data already in memory, without new GitHub requests; the mode is stored in `?mode=user` and `localStorage`.
- Tests for profile detection, README language, claim matching, the risk scan and score normalisation. `docs/checks.md` now documents both profiles.
- `SECURITY.md` with a private advisory link, the scope of the audit engine and an explicit list of what the project will never do: no downloads, no safety claims.

### Changed

- The score is normalised over the weight that actually applies: `round(earned / applicable × 100)`. Checks that do not apply are not scored and are listed as "Not scored" with the reason.
- Context rules: a library needs no demo or releases, a desktop app satisfies the demo rule with screenshots or a GIF, a web app needs a live demo, build scripts count as manifests, the entry point is also read from `Launcher.cs` / `Program.cs` / the file a build script compiles, a bilingual README counts as English, and enabled Issues count as contact.
- A small new project (≤25 files, under 14 days, no tests) or a clearly joke project gets halved weights and lower severity for CI, tests, linter, changelog and contributor rules — with wording that explains why.
- Author-mode Security now includes risky calls that the README never mentions (7/5/8/5 = 25).
- New visual identity: a printed inspection dossier on cream paper. Type is set in self-hosted Literata (display), Onest (text) and JetBrains Mono (numbers and labels), with a ruler-tick score gauge, stamped verdicts and a numbered issue ledger instead of cards.
- Share card, SVG badge and the social preview are drawn in the same paper palette.
- Small text now meets WCAG AA contrast on the paper background: muted browns instead of the light ones, a darker vermillion and ochre.
- The language button announces the language it switches to and updates its label and accessible name together.
- Fonts are bundled under the SIL Open Font License 1.1 (`assets/fonts/OFL.txt`), so the page makes no third-party requests.

### Fixed

- The same repository now gets the same score in Russian and English: no check depends on the interface language.
- The lockfile check no longer fires on projects with no package manager, and `requirements.txt` is no longer treated as a manager that needs a lockfile — it already pins versions.
- The "CI does not run tests" check no longer fires when the repository has no workflow at all. `No CI` already covers that case, and the old rule deducted the points twice.
- A screenshot referenced by the README and present in the repository counts once, not twice.
- The claims check is skipped with a reason when the description and the README are written in different languages, instead of comparing a Russian description with an English README word by word.
- The risk scan no longer flags a project for the names of dangerous functions in its own rule table: test files are not scanned, regex patterns are ignored, `.profile` as an object property is not a shell profile, and a localStorage key like `launchcheck.token` is not a hardcoded credential.
- Russian plurals: "4 файла", "2 скриншота", "8 дней назад" instead of the wrong forms, in the profile card and in the issue text.
- The empty state renders as one sentence instead of one word per line, and a zero-value category bar no longer shows a stray nub.

## [1.0.0] — 2026-11-18

First public release.

### Added

- Audit of any public GitHub repository with 23 deterministic checks across six categories: Security (25), Runnable (20), Quality (15), Repository (15), Product (15), Trust (10).
- Plain-language issue cards with a ready-to-paste prompt for each issue, ordered by severity.
- "Copy all prompts" — one block for the whole audit.
- Shareable report card (1200×630 PNG) and a static SVG badge.
- Russian and English interface with a one-click switch.
- Optional GitHub token stored in `localStorage` for private repositories and a 5000 requests/hour limit, with the remaining quota shown in the header.
- Deep links (`?repo=owner/name`) and the last checked repository in `localStorage`.
- Node test runner suite for URL parsing and the secret scanner, plus a structural check for local assets.

[1.2.0]: https://github.com/TIZZ13/GitHubChecker/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/TIZZ13/GitHubChecker/releases/tag/v1.1.0
[1.0.0]: https://github.com/TIZZ13/GitHubChecker/releases/tag/v1.0.0
