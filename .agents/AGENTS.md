<!-- @import /home/lab/workspace/.claude/CLAUDE.md -->

# Project-Specific Configuration

This file imports workspace-level configuration from `/home/lab/workspace/.claude/CLAUDE.md`.
All workspace rules apply. Project-specific rules below strengthen or extend them.

The workspace `/home/lab/workspace/.claude/` directory contains additional instruction files
(MERMAID.md, NOTEBOOK.md, DATASCIENCE.md, GIT.md, and others) referenced by CLAUDE.md.
Consult workspace CLAUDE.md and the .claude directory to discover all applicable standards.

## Mandatory Bans (Reinforced)

The following workspace rules are STRICTLY ENFORCED for this project:

- **No automatic git tags** - only create tags when user explicitly requests
- **No automatic version changes** - only modify version in package.json/pyproject.toml/etc. when user explicitly requests
- **No automatic publishing** - never run `make publish`, `npm publish`, `twine upload`, or similar without explicit user request
- **No manual package installs if Makefile exists** - use `make install` or equivalent Makefile targets, not direct `pip install`/`uv install`/`npm install`
- **No automatic git commits or pushes** - only when user explicitly requests

## Project Context

JupyterLab 4.x frontend extension adding a "Paste as Markdown" context menu item. It reads the HTML flavour of the clipboard, converts it with Turndown plus the GFM plugin, and replaces the selection in a file editor or a notebook cell. Plain text is the fallback when no HTML is offered, or when the HTML converts to nothing.

**Technology stack**

- TypeScript, JupyterLab 4.x frontend extension API
- Build: webpack, babel, tsc, jlpm (JupyterLab's pinned yarn)
- Testing: Jest for unit tests, Playwright with Galata for integration
- Python packaging: hatchling, hatch-nodejs-version
- CI/CD: GitHub Actions with jupyter-releaser

**Source layout**

- `src/index.ts` - plugin registration, context menu wiring, cursor insertion
- `src/turndown.ts` - clipboard HTML normalisation and the Turndown configuration
- `src/clipboard.ts` - clipboard read
- `src/__tests__/` - Jest unit tests against jsdom
- `ui-tests/` - Playwright and Galata integration tests
- `docs/acc-crit.md`, `docs/defects.md` - the trackers, written only through `pm-tools`
- `tmp/`, `logs/`, `coverage/` - gitignored working directories

`src/turndown.ts` and `src/clipboard.ts` import no JupyterLab module, so both unit test against bare jsdom with no lab mocking. Keep that boundary - it is what lets the conversion logic be tested without a running JupyterLab.

## Journal Rules (Project-Specific)

- **APPEND ONLY**: New journal entries MUST be appended at the end of the file, never inserted between existing entries
- Entries maintain strict chronological order by position - the last entry in the file is always the most recent work
- Never reorder, move, or insert entries out of sequence
- The Stellars **journal plugin** is the canonical tool for this file: create via `/journal:create`, append via `/journal:update`, archive via `/journal:archive`. The `journal:journal` skill auto-triggers on any mention of "journal" and runs `journal-tools check` after every write
- Direct edits to `JOURNAL.md` are a last resort - prefer the plugin so modus secundis format, continuous numbering and append-only order are enforced automatically

## Makefile Version Sync

**MANDATORY**: At the start of every session, compare the version comment in the local `Makefile` (line 1: `# Makefile for Jupyterlab extensions version X.XX`) against the shared template at `/home/lab/workspace/private/jupyterlab/@utils/jupyterlab-extensions/Makefile`. If the shared version is newer, replace the local Makefile with the shared one before proceeding with any other work.

## Package Installation

**MANDATORY**: Always use `make install` to install packages. Never run `pip install`, `npm install`, `jlpm install`, or `jlpm build` directly - the Makefile orchestrates the correct build and install sequence.

## Build, Test and Release

| Target                      | Effect                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `make install_dependencies` | Creates the project-local nodeenv and installs the toolchain                                                         |
| `make install`              | Builds and installs the wheel. Reaches `increment_version`, so it raises the patch version                           |
| `make build`                | Builds the distribution packages. Leaves the version alone                                                           |
| `make test`                 | Jest and pytest only. Galata is wired to no target                                                                   |
| `make publish`              | Increments the version, publishes npm and PyPI, then makes its own metadata commit                                   |
| `make upgrade`              | `jlpm up`, which is a no-op with no package arguments, plus `npm audit --recursive`, which reports and fixes nothing |

- `make install` changes `package.json` and `package-lock.json`, so it needs explicit approval under the release policy. To build, lint or unit test without crossing that rule, call the tool directly: `jlpm test`, `jlpm jest turndown`, `jlpm run lint:check`, `jlpm prettier`
- The Makefile exports `.nodeenv/bin` onto `PATH` for its own recipes. A direct `jlpm` call outside make needs the same: `export PATH="$(pwd)/.nodeenv/bin:$PATH"`, after `make install_dependencies` has created the directory
- Galata runs in CI. The `integration-tests` job installs a wheel built from the pushed source and runs the full suite there, and CI never reaches `increment_version` - so CI, not a local rebuild, is the way to run the functional tests
- Run Galata locally only with the JupyterLab on port 8888 stopped. The test server otherwise collides with it, and reads the real `JUPYTER_CONFIG_DIR` and contents directory
- `make upgrade` once let a forced audit fix downgrade the `@jupyterlab/*` ranges and rewrite `yarn.lock` in Yarn 1 format. Review its diff before keeping it

**Verification gates**: `python -m jupyterlab.browser_check` exits 0, `jupyter labextension list` reports `enabled OK`, and `pm-tools check docs --strict` reports no issues.

## Package File Tracking

**MANDATORY**: Both `package.json` and `package-lock.json` must always be tracked in git. Never add these files to `.gitignore`. After any operation that modifies them (install, upgrade, build), ensure changes are staged for the next commit.

## Strengthened Rules

- **Do not overengineer.** This converts clipboard HTML to markdown. Markdown is not a database. Add no abstraction, configurability or validation the paste path does not need
- **Keep the runtime dependency surface small.** `@jupyterlab/codeeditor` stays in `devDependencies` - as a runtime range it gates the extension out of older JupyterLab 4.x releases
- **Stay inside the review budget.** Adversarial rounds have cost more than the change under review. Two consecutive clean verdicts end a loop
- **Finish a settled task without asking at each step.** Ask before widening scope, not before completing a scope already agreed

## Required Workspace Skills

- **jupyterlab-extension** (`/home/lab/.claude/skills/jupyterlab-extension/SKILL.md`) - extension development, testing strategy, CI/CD workflow configuration, jupyter-releaser setup, and the common caveats (TypeScript compatibility, lib0 pinning, Playwright infrastructure)
- **my-browser** (`/home/lab/.claude/skills/my-browser/SKILL.md`) - browser automation: drive the Playwright MCP for UI verification and screenshots, or the real headless Chrome over CDP when the MCP is blocked
- **git** (`/home/lab/.claude/skills/my-git/SKILL.md`) - remote hosting and credentials. Use this skill for repository operations; the `gh` CLI is not installed on this workstation

## Environment Notes

- The repository is a submodule of the `~/workspace` superproject and the clone is shallow. `.git` is a file pointing at `../../../.git/modules/private/jupyterlab/jupyterlab_paste_content_as_markdown_extension`, so `git log` shows only the shallow tip and not the history depth
- The browser Clipboard API needs a secure context. Served over plain HTTP on a LAN address, the extension cannot read the clipboard at all
- `docs/` is excluded from the sdist at `pyproject.toml:43`
