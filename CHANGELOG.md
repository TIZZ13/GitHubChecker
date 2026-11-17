# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/TIZZ13/launchcheck/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/TIZZ13/launchcheck/releases/tag/v1.1.0
[1.0.0]: https://github.com/TIZZ13/launchcheck/releases/tag/v1.0.0
