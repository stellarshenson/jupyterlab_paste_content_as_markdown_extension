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

Paste clipboard content as markdown into JupyterLab text editors and notebook cells. Right-click and select "Paste as Markdown" to convert HTML formatted text or DOCX content with formatting into clean markdown code.

**Full disclosure:** This extension adds one context menu item. It reads your clipboard, converts whatever formatting it finds to markdown, and pastes it. That's it. No AI, no blockchain, no cloud sync. Just clipboard-to-markdown, the way nature intended.

## Features

- **Paste as Markdown context menu** - Right-click in any text editor or notebook cell to paste clipboard content as markdown
- **HTML to markdown conversion** - Converts formatted HTML content (copied from web pages, emails, documents) into markdown
- **DOCX content support** - Handles rich text copied from Word documents and similar editors
- **Preserves structure** - Maintains headings, lists, links, bold, italic, and code blocks during conversion
- **Works everywhere in JupyterLab** - Text editors, markdown cells, code cells, and any editable area

## Installation

Requires JupyterLab 4.0.0 or higher.

```bash
pip install jupyterlab_paste_content_as_markdown_extension
```

## Uninstall

```bash
pip uninstall jupyterlab_paste_content_as_markdown_extension
```
