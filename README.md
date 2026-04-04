# jupyterlab_paste_content_as_markdown_extension

[![GitHub Actions](https://github.com/stellarshenson/jupyterlab_paste_content_as_markdown_extension/actions/workflows/build.yml/badge.svg)](https://github.com/stellarshenson/jupyterlab_paste_content_as_markdown_extension/actions/workflows/build.yml)
[![npm version](https://img.shields.io/npm/v/jupyterlab_paste_content_as_markdown_extension.svg)](https://www.npmjs.com/package/jupyterlab_paste_content_as_markdown_extension)
[![PyPI version](https://img.shields.io/pypi/v/jupyterlab-paste-content-as-markdown-extension.svg)](https://pypi.org/project/jupyterlab-paste-content-as-markdown-extension/)
[![Total PyPI downloads](https://static.pepy.tech/badge/jupyterlab-paste-content-as-markdown-extension)](https://pepy.tech/project/jupyterlab-paste-content-as-markdown-extension)
[![JupyterLab 4](https://img.shields.io/badge/JupyterLab-4-orange.svg)](https://jupyterlab.readthedocs.io/en/stable/)
[![Brought To You By KOLOMOLO](https://img.shields.io/badge/Brought%20To%20You%20By-KOLOMOLO-00ffff?style=flat)](https://kolomolo.com)
[![Donate PayPal](https://img.shields.io/badge/Donate-PayPal-blue?style=flat)](https://www.paypal.com/donate/?hosted_button_id=B4KPBJDLLXTSA)

> [!TIP]
> This extension is part of the [stellars_jupyterlab_extensions](https://github.com/stellarshenson/stellars_jupyterlab_extensions) metapackage. Install all Stellars extensions at once: `pip install stellars_jupyterlab_extensions`

Paste clipboard content as markdown into JupyterLab. Copy formatted text from a web page, email, or Word document, right-click in any editor or notebook cell, and select "Paste as Markdown" - the HTML formatting is converted to clean markdown on the fly.

**Full disclosure:** This extension adds one context menu item. It reads your clipboard, converts whatever formatting it finds to markdown, and pastes it. That's it. No AI, no blockchain, no cloud sync. Just clipboard-to-markdown, the way nature intended.

![Paste as Markdown](.resources/screenshot.png)

## Features

- **Paste as Markdown context menu** - Right-click in any text editor or notebook cell to find "Paste as Markdown" right next to the regular paste
- **HTML to markdown conversion** - Converts formatted HTML content copied from web pages, emails, and documents into clean markdown using ATX headings, fenced code blocks, and standard list markers
- **Rich text support** - Handles content copied from Word, Google Docs, Confluence, Notion, and other rich text editors that place HTML on the clipboard
- **Preserves structure** - Maintains headings, lists, links, bold, italic, code blocks, tables, and images during conversion
- **Plain text fallback** - When no HTML is available on the clipboard, pastes the plain text content as-is
- **Works everywhere in JupyterLab** - File editors, markdown cells, code cells, and any editable area

## How It Works

Most applications place both plain text and HTML on the clipboard when you copy formatted content. This extension reads the HTML version via the browser Clipboard API, runs it through [Turndown](https://github.com/mixmark-io/turndown) to produce markdown, and inserts the result at your cursor position. If no HTML is found, it falls back to plain text.

## Requirements

- JupyterLab >= 4.0.0

> [!NOTE]
> The browser Clipboard API requires a secure context (HTTPS or localhost). If JupyterLab is served over plain HTTP on a remote host, the clipboard read will fail and you will see an error dialog. Use HTTPS or an SSH tunnel in that case.

## Install

```bash
pip install jupyterlab_paste_content_as_markdown_extension
```

## Usage

1. Copy formatted content from any source (web page, Word, Google Docs, email)
2. Right-click in a JupyterLab text editor or notebook cell
3. Select **Paste as Markdown** from the context menu

The converted markdown appears at your cursor position.

## Uninstall

```bash
pip uninstall jupyterlab_paste_content_as_markdown_extension
```

## License

BSD 3-Clause License
