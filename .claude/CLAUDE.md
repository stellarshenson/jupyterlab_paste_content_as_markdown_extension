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

JupyterLab 4.x frontend extension that adds a "Paste as Markdown" context menu item. When users paste clipboard content (HTML formatted text, DOCX content with formatting), the extension converts it to markdown before inserting into text editors and notebook cells. Generated from `jupyterlab/extension-template` (Copier v4.5.2).

**Technology Stack**:

- TypeScript, JupyterLab 4.x frontend extension API
- Build: webpack, babel, tsc, jlpm (JupyterLab's pinned yarn)
- Testing: Jest (unit), Playwright/Galata (integration)
- Python packaging: hatchling, hatch-nodejs-version
- CI/CD: GitHub Actions with jupyter-releaser

## Makefile Version Sync

**MANDATORY**: At the start of every session, compare the version comment in the local `Makefile` (line 1: `# Makefile for Jupyterlab extensions version X.XX`) against the shared template at `/home/lab/workspace/private/jupyterlab/@utils/jupyterlab-extensions/Makefile`. If the shared version is newer, replace the local Makefile with the shared one before proceeding with any other work.

## Package File Tracking

**MANDATORY**: Both `package.json` and `package-lock.json` must always be tracked in git. Never add these files to `.gitignore`. After any operation that modifies them (install, upgrade, build), ensure changes are staged for the next commit.

## Package Installation

**MANDATORY**: Always use `make install` to install packages. Never run `pip install`, `npm install`, `jlpm install`, or `jlpm build` directly - the Makefile orchestrates the correct build and install sequence.

## Required Workspace Skills

The following workspace skills MUST be consulted when performing related work:

- **jupyterlab-extension** (`/home/lab/workspace/.claude/skills/jupyterlab-extension/SKILL.md`) - Extension development guidelines, testing strategy, CI/CD workflow configuration, jupyter-releaser setup, common caveats (TypeScript compatibility, lib0 pinning, Playwright test infrastructure, syntax highlighting patterns)
- **playwright** (`/home/lab/workspace/.claude/skills/playwright/SKILL.md`) - Browser automation for screenshots, UI verification, serving local files for inspection. Use when testing rendered output or capturing extension screenshots
