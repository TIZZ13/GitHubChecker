# What GitHub Checker checks

GitHub Checker has two audit profiles over the same public repository data:

- **Author** (developer mode) — what stops the project from looking ready, with a prompt for an AI agent.
- **Downloader** (user mode) — what is known about the project and its files before running them. The score is not a guarantee; on top of it, downloader mode runs a live hash lookup (below) that shows what public threat databases know about the release files.

Every check is a fixed rule. There is no AI and no randomness: the same repository always gets the same score, in both languages and in both modes.

The report first detects **what kind of project this is** and adjusts the rules to it. Checks that do not apply are not scored at all: they are listed under "Not scored" instead of silently failing.

## How the score is calculated

Each check carries a weight. The score is

```
round(earned weight / applicable weight × 100)
```

Skipped checks add nothing to either side, so a project is never punished for a rule that does not apply. If every check in a profile is skipped, the score is 0 rather than a division by zero.

A mode switch after an audit rebuilds the check list from the data already in memory. No GitHub request is made, and the mode is stored in `?mode=` and `localStorage`.

## Live virus check (shown in both modes)

The score never depends on the network beyond GitHub, and it never changes over time. The virus check is a separate evidence layer.

1. GitHub publishes a `sha256` digest for every release asset in the releases API. The page reads the digest, so a file can be identified without downloading a single byte.
2. Only the **newest release** is checked. If its assets have no digest, older releases are used. Up to **three** files are checked, installers first (`.exe`, `.msi`, `.dmg`, `.pkg`, `.AppImage`, `.deb`, `.rpm`, `.apk`), then archives, then anything else.
3. Each hash is looked up in **AlienVault OTX**. The page asks `/analysis` first, because it already carries the antivirus verdicts; `/general` (community pulses) is requested only when no antivirus has seen the hash. That halves the number of public requests per audit. The browser sends the hash and nothing else; the file is never downloaded.
4. Only real antivirus engines get a vote: **ClamAV** and **Microsoft Defender**. OTX also runs YARA and several classifiers, but they fire on harmless installers (for example `InnoSetupInstaller`) or on signed software, so their output is not treated as a virus verdict.
5. OTX allows 100 requests per hour per IP without a key. Answers are cached in `localStorage` by hash: a real verdict for 7 days, an "unknown" answer for 24 hours. Re-opening the same repository or switching modes makes no request at all. If OTX is rate-limited or does not answer, a saved answer up to 90 days old may be shown and is explicitly marked as saved. A 10-minute cooldown stops the run on the first 429 instead of spending requests on the remaining files; the check then retries the failed files automatically up to two times, and a visible **Check again** button retries them by hand after the cooldown. Cached and already-checked files are kept.
6. The result per file is one of:
   - **Viruses found** — ClamAV or Microsoft Defender returned a detection. The report names the engine, the signature and every engine that checked the file.
   - **No viruses** — both engines returned an empty result for a file they checked. The report says who checked it.
   - **Reports mention it** — the hash appears in community pulses but no engine detected anything. The report shows how many reports.
   - **Not checked** — OTX has no antivirus report for the hash. This is *unknown*, not *clean*.
   - **Check failed** — the service did not answer or rate-limited the request. The row says why, keeps its VirusTotal and OTX links, and is retried rather than left as a dead end.
7. Above the file list, a summary line answers the question directly: whether viruses were found and which engines checked the files. If some files could not be checked, the summary says so. It never turns a missing report into a "clean" verdict.
8. Each row links to the full OTX report and to VirusTotal for the same hash, and offers a copy-hash button.
9. The card is shown for **every** repository in both modes. When there is nothing to look up, it says which case applies instead of disappearing: no releases, no attached files, no SHA-256 digest, or no file that can be matched by hash. It then offers the release page and, when a hash is missing, a manual VirusTotal upload link.

The lookup runs after the report is on screen and **never touches `scoreChecks`**: the score stays identical in Russian and English, today and a year from now.

## Project detection

| Signal | Used for |
| --- | --- |
| File tree and README | kind: desktop, web, CLI, library, game, bot, docs, other |
| Release assets, manifests, README words | platform: Windows, macOS, Linux, multiple, browser, unknown |
| Main language, extensions | stack label (C# / .NET, TypeScript, Python…) |
| Release assets | distribution: ready-made files, package manager, website, source only |
| Repository age and size | a new small project gets lenient weights |
| README and description | "toy" wording, English section, feature claims |

Context rules currently applied:

- A **library** does not need a live demo or GitHub Releases; a usage example and a package install command are enough.
- A **desktop app** satisfies the demo check with screenshots or a GIF in the README.
- A **web app** needs a live demo link; requirements are satisfied by the demo itself.
- **Build scripts** (`build.ps1`, `Makefile`, `CMakeLists.txt`, `*.sln`) count as a project manifest.
- The **entry point** is also recognised in `Launcher.cs`, `Program.cs`, `App.*` and in the file a build script compiles.
- A **bilingual README** counts as English if it has an English section (`## ENG`) or a `README.en` file.
- **Contact** is satisfied when GitHub Issues are enabled.
- A **small new project** (≤25 files, <14 days, no tests) or a clearly **joke/toy project** gets halved weights and a lower severity for CI, tests, linter, changelog and contributor rules. The text explains why.
- `requirements.txt` is not treated as a package manager that needs a lockfile: it already pins versions.

## Author mode — 23 checks, 100 points

### Security — 25

| Check | Points | Fails when |
| --- | --- | --- |
| `.env` committed | 7 | a `.env` or `.env.*` file is in the tree and is not an example/template |
| Private keys | 5 | `id_rsa`, `id_ed25519`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `*.keystore` are in the tree |
| Secrets in configs | 8 | a fetched config or source file contains an AWS key, GitHub token, API key, Google key, private-key header or hardcoded credential |
| Dangerous calls without warning | 5 | the source uses a high-risk API that the README does not mention |

Placeholders are ignored: `your_`, `example`, `changeme`, `xxxx`, `<...>`, `${...}`, `process.env`, `os.environ`, `dummy` and similar do not count.

Secret values are never displayed and never leave the browser. The report names the file and the kind of secret, nothing else.

### Runnable — 20

| Check | Points | Fails when |
| --- | --- | --- |
| Install/run instructions | 6 | the README has no installation section, download hint or run command |
| Project manifest | 4 | there is no `package.json`, `*.csproj`, `*.sln`, Python manifest, `Cargo.toml`, `go.mod`, Maven/Gradle, Gemfile, `composer.json`, `CMakeLists.txt`, `Makefile`, build script or `index.html` |
| Lockfile | 3 | a manager that normally writes a lockfile is present and none exists. Skipped for plain `requirements.txt` / `setup.py` |
| Entry point | 4 | there is no `src/`, `main.*`, `Program.cs`, `Launcher.cs`, `App.*`, `index.*`, `app.py` and no file compiled by the build script |
| CI | 3 | there is no workflow in `.github/workflows/` |

### Quality — 15

| Check | Points | Fails when |
| --- | --- | --- |
| Tests | 6 | there is no `tests/`, `test/`, `__tests__/`, `spec/` directory and no `*.test.*`, `*.spec.*`, `*_test.*`, `*Tests.cs` |
| Linter and formatter | 4 | there is no ESLint, Prettier, Ruff, flake8, EditorConfig, StyleCop, golangci-lint, clippy, detekt or RuboCop config |
| Tests in CI | 3 | a workflow exists but never runs the test command. Skipped when there is no CI at all |
| Huge files | 2 | a media file is larger than 20 MB or another file is larger than 10 MB |

### Repository — 15

| Check | Points | Fails when |
| --- | --- | --- |
| License | 5 | GitHub does not detect a license |
| Presentation | 8 | the description is shorter than 20 characters, there are fewer than 3 topics, the README is shorter than 800 characters (or no image) |
| English README | 2 | the README is mostly Russian and has no English section or `README.en`. Skipped for very short READMEs |

### Product — 15

| Check | Points | Fails when |
| --- | --- | --- |
| Demo | 6 | no Website URL, no demo link, and no screenshot/GIF for a non-web project. Skipped for libraries |
| Releases | 3 | there are no GitHub Releases. Skipped for libraries |
| Changelog | 2 | there is no `CHANGELOG`, `CHANGES` or `HISTORY` file |
| Issue templates and docs | 4 | `.github/ISSUE_TEMPLATE/` or documentation pages are missing |
| — | — | The screenshot requirement is part of Presentation, not a separate check |

### Trust — 10

| Check | Points | Fails when |
| --- | --- | --- |
| Verifiability | 4 | for a binary release: no checksums or signature; otherwise: no `SECURITY.md` and no checksums in the README |
| Contributor guidelines | 3 | there is neither `CONTRIBUTING.md` nor `CODE_OF_CONDUCT.md` |
| Contact | 3 | Issues are disabled and the README has no contact or security contact |

### Author grades

| Score | Meaning |
| --- | --- |
| 85–100 | Ready to ship |
| 70–84 | Almost there |
| 50–69 | Too early to show |
| 0–49 | Fix it first |

## Downloader mode — 21 checks, 100 points

This mode answers a different question: *if I download this, what should I know first?* It never claims that a file is safe; the virus block reports only what the engines saw, with a caveat.

### Security — 28

| Check | Points | Fails when |
| --- | --- | --- |
| Source is open | 8 | there are only ready-made files; skipped for documentation-only repositories |
| Dangerous calls without warning | 8 | the source uses network, autostart, process injection, obfuscation, masquerading, shutdown, keyboard hooks, registry changes, Explorer control, process launch or file deletion, and the README does not mention it |
| Other undeclared actions | 4 | the same, for medium-risk actions only |
| Checksums or signature | 8 | there are downloadable release files and no SHA-256/checksum/signature. Skipped when there is nothing to download |

### Runnable — 15

| Check | Points | Fails when |
| --- | --- | --- |
| Install instructions | 5 | the README does not explain how to install or download |
| Something to download | 5 | no release file, no demo and no package install command |
| Requirements | 5 | the README does not state the system, runtime or browser |

### Quality — 15

| Check | Points | Fails when |
| --- | --- | --- |
| Screenshots or video | 6 | the README and `docs/` have no screenshots, GIF or video |
| A place for feedback | 4 | Issues and Discussions are disabled and there is no contact. Skipped for a brand-new project with no feedback yet |
| Still maintained | 5 | the last push is older than 180 days |

### Repository — 10

| Check | Points | Fails when |
| --- | --- | --- |
| License | 4 | GitHub does not detect a license |
| Clear description | 4 | the description is shorter than 20 characters or the README is shorter than 600 characters |
| Other users | 2 | fewer than 5 stars, no forks and no release downloads |

### Product — 20

| Check | Points | Fails when |
| --- | --- | --- |
| Claims match the README | 6 | the README covers fewer than half of the meaningful words from the description. Skipped when the description and README are in different languages, because they cannot be compared word by word |
| Features described | 4 | there is no feature list (5+ bullets) and the README is shorter than 1500 characters |
| Release notes | 3 | a release exists but its description is shorter than 40 characters. Skipped when there are no releases |
| File for your system | 3 | the platform is unknown, or a web demo / package install command is missing |
| Warnings about side effects | 4 | fewer than two of these are in the README: how to stop the app, how to undo changes, a warning about antivirus/SmartScreen/admin rights. Skipped for libraries, web apps and docs |

### Trust — 12

| Check | Points | Fails when |
| --- | --- | --- |
| Security contact | 4 | there is no `SECURITY.md` and the README does not say how to report a vulnerability |
| Automated build | 4 | releases exist but there is no CI workflow. Skipped when there are no releases |
| Project history | 4 | the repository is younger than 30 days and has fewer than 25 stars |

### Downloader grades

| Score | Meaning |
| --- | --- |
| 85–100 | Try with care |
| 70–84 | Check first |
| 50–69 | Many questions |
| 0–49 | Better not run |

## The file safety brief

Downloader mode adds a separate card built from the risk scan and release metadata. It lists facts, not verdicts:

- how many source files were read, or that the source is closed;
- whether the code makes network requests;
- which risky behaviours the README already declares (declared behaviour is shown, not punished);
- whether checksums or a signature exist;
- whether the file is unsigned, inside a password-protected archive, or asks for administrator rights;
- if there is nothing to download (a library, a website, source-only), the card says so and still shows the virus block with its explicit "nothing to check" state;
- when the release file has no published SHA-256, a note that the hash cannot be looked up and a link to upload it to VirusTotal.

The card never says "safe". The virus block reports what the engines saw, names them, and always ends with the caveat that no detection is not a guarantee.

## What the risk scan looks for

| Risk | Level | Examples |
| --- | --- | --- |
| Network access | high | `HttpClient`, `requests.get`, `fetch(`, `Invoke-WebRequest` |
| Autostart | high | `CurrentVersion\Run`, `schtasks /create`, LaunchAgents, `.bashrc` |
| Process injection | high | `CreateRemoteThread`, `WriteProcessMemory`, `LD_PRELOAD` |
| Obfuscation | high | `FromBase64String`, `eval(`, `-EncodedCommand` |
| Masquerading | high | `WUDFHost`, `svchost.exe`, writing an `.exe` into `LOCALAPPDATA` |
| Shutdown or reboot | high | `shutdown /r`, `ExitWindowsEx`, `bcdedit`, `vssadmin` |
| Keyboard hooks | medium | `SetWindowsHookEx`, `GetAsyncKeyState`, `BlockInput` |
| Registry or policy changes | medium | `Registry.CurrentUser`, `reg add` |
| Explorer control | medium | killing or restarting `explorer.exe` |
| Launching other programs | medium | `Process.Start`, `subprocess.Popen` |
| File deletion | medium | `File.Delete`, `Remove-Item`, `shutil.rmtree` |

Comments are stripped before scanning. A call is **declared** when the README or description mentions the matching behaviour (network, reboot, keyboard, registry, fullscreen, restore, delete…). Undeclared high-risk calls are critical; undeclared medium-risk calls are a partial deduction.

Two accuracy rules keep the scan honest:

- **Test files are not scanned.** A fixture such as `Process.Start("shutdown", "/r /f")` inside `tests/` is not behaviour that runs on the user's machine.
- **Regex literals that contain alternation or a word boundary are ignored.** A scanner, a linter rule set or a pattern list contains the names of dangerous APIs without calling them, and must not flag itself.

## What is intentionally not checked

- Actual code quality, architecture, performance or accessibility of the product.
- Dependency vulnerabilities and license compatibility.
- Antivirus verdicts as part of the score. Hash lookups are shown as separate evidence in both modes and never change the number. The project never downloads or runs a release file.
- Popularity as a score: stars, forks and downloads are shown where relevant but are not a quality verdict.
- Anything that requires cloning the repository. Only public API data is used.

The score measures readiness (author mode) or the number of open questions before downloading (downloader mode). It is not a verdict on the project.
