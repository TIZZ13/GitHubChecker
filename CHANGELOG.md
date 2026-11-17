# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/).

## [Unreleased]

### Changed

- New visual identity: a printed inspection dossier on cream paper. Type is set in self-hosted Literata (display), Onest (text) and JetBrains Mono (numbers and labels), with a ruler-tick score gauge, stamped verdicts and a numbered issue ledger instead of cards.
- Share card, SVG badge and the social preview are drawn in the same paper palette.
- Small text now meets WCAG AA contrast on the paper background: muted browns instead of the light ones, a darker vermillion and ochre.
- The language button announces the language it switches to and updates its label and accessible name together.
- Fonts are bundled under the SIL Open Font License 1.1 (`assets/fonts/OFL.txt`), so the page makes no third-party requests.

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

[Unreleased]: https://github.com/TIZZ13/launchcheck/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/TIZZ13/launchcheck/releases/tag/v1.0.0
