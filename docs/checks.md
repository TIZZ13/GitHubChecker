# What LaunchCheck checks

23 checks, 100 points. Every check is a fixed rule over public repository data: the same repository always gets the same score.

If a check does not apply to your project, the prompt says so — for example, a desktop app can ship a GIF instead of a live demo.

## Security — 25 points

| Check | Points | Fails when |
| --- | --- | --- |
| `.env` committed | 8 | a file matching `.env` or `.env.*` is in the tree and is not an example/template |
| Private keys | 7 | `id_rsa`, `id_ed25519`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `*.keystore` are in the tree |
| Secrets in configs | 10 | up to four config files contain strings shaped like AWS keys, GitHub tokens, API keys, Google keys, private key headers or hardcoded credentials |

Placeholders are ignored: values containing `your_`, `example`, `changeme`, `xxxx`, `<...>`, `${...}`, `process.env`, `os.environ`, `dummy` and similar do not count.

Secret values are never displayed and never leave the browser. The report names the file and the kind of secret, nothing else.

## Runnable — 20 points

| Check | Points | Fails when |
| --- | --- | --- |
| Install/run instructions | 6 | the README has no installation section and no run command |
| Project manifest | 4 | there is no `package.json`, `*.csproj`, `*.sln`, `pyproject.toml`, `requirements.txt`, `Cargo.toml`, `go.mod`, `pom.xml`, Gradle, Gemfile, `composer.json` or `index.html` |
| Lockfile | 3 | there is no lockfile for the detected package manager |
| Entry point | 4 | there is no `src/`, `main.*`, `Program.cs`, `App.*`, `index.*`, `app.py`, `manage.py` or `cmd/` |
| CI | 3 | there is no workflow in `.github/workflows/` |

## Quality — 15 points

| Check | Points | Fails when |
| --- | --- | --- |
| Tests | 6 | there is no `tests/`, `test/`, `__tests__/`, `spec/` directory and no `*.test.*`, `*.spec.*`, `*_test.*`, `*Tests.cs` |
| Linter and formatter | 4 | there is no ESLint, Prettier, Ruff, flake8, EditorConfig, StyleCop, golangci-lint, clippy, detekt or RuboCop config |
| Tests in CI | 3 | a workflow exists but never runs the test command |
| Huge files | 2 | a file in the repository is larger than 10 MB |

## Repository — 15 points

| Check | Points | Fails when |
| --- | --- | --- |
| License | 5 | GitHub does not detect a license |
| Presentation | 8 | the description is shorter than 20 characters, there are fewer than 3 topics, the README is shorter than 800 characters, or it has no image |
| English README | 2 | more than 15% of the letters in the README are Cyrillic |

## Product — 15 points

| Check | Points | Fails when |
| --- | --- | --- |
| Demo link | 5 | the repository has no Website URL |
| Releases | 3 | there are no GitHub Releases |
| Changelog | 2 | there is no `CHANGELOG`, `CHANGES` or `HISTORY` file |
| Issue templates and docs | 4 | `.github/ISSUE_TEMPLATE/` or `docs/` is missing |
| Screenshot | 1 | the README has no image and never mentions a screenshot, demo or GIF |

## Trust — 10 points

| Check | Points | Fails when |
| --- | --- | --- |
| Verifiability | 4 | there is no `SECURITY.md` and the README does not mention SHA-256, checksums or signatures |
| Contributor guidelines | 3 | there is neither `CONTRIBUTING.md` nor `CODE_OF_CONDUCT.md` |
| Contact | 3 | the README has no contact, support or security contact and there is no `SUPPORT.md` |

## Grades

| Score | Meaning |
| --- | --- |
| 85–100 | Ready to ship |
| 70–84 | Almost there |
| 50–69 | Too early to show |
| 0–49 | Fix it first |

## What is intentionally not checked

- Code quality, architecture, performance, accessibility of the product itself.
- Dependency vulnerabilities and license compatibility.
- Popularity: stars, forks and commit frequency are shown but never scored.
- Anything that requires cloning the repository. Only public API data is used.

The score measures readiness to be seen by strangers. It is not a verdict on the project.
