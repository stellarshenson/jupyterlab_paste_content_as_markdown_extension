# Changelog

<!-- <START NEW CHANGELOG ENTRY> -->

## [1.0.8] - 2026-09-08

### Added

- Strikethrough and task-list checkboxes survive the conversion, through the GFM plugins Turndown core has no rules for

### Changed

- Scaffold updated to extension-template v4.6.5: the build moves from JupyterLab to `@jupyter/builder` and `jupyter-builder`, ESLint moves to the version 9 flat config in `eslint.config.mjs`, licence metadata moves to the PEP 639 fields, and `setup.py` is removed
- Build lifecycle updated to Makefile 1.38, which asserts `dist/` holds a wheel and an sdist before the npm push so a failed build cannot desynchronise npm from PyPI
- Dependencies upgraded and both lockfiles regenerated: eslint 9.39.5, typescript-eslint 8.70.0, `@jupyter/eslint-plugin` 1.2.0, `@jupyter/builder` 1.2.3, typescript 5.8.3
- The plain text flavour is taken from the same clipboard read as the HTML, so the empty-HTML fallback needs no second permission prompt and cannot read a clipboard that changed in between
- The activation message carries the `[paste-as-markdown]` prefix the rest of the logging uses

### Fixed

- A table flattened into text lost its caption, which is the line that names the values
- A spreadsheet copy starting with a spacer row promoted the spacer as the header, and a `<th>` row left behind the real header put a second delimiter line in the middle of the data
- A clipboard holding only spaces or a tab was rejected as empty, so copied indentation could not be pasted

<!-- <END NEW CHANGELOG ENTRY> -->

## [1.0.6] - 2026-08-28

### Added

- Jest suite covering HTML-to-markdown conversion and clipboard access (71 tests)
- Galata suite covering the file editor, notebook cells, menu placement and the plain-text fallback (12 tests)

### Changed

- Conversion and clipboard access split out of the plugin into `src/turndown.ts` and `src/clipboard.ts`, neither importing JupyterLab
- Links wrapping block content keep their content and drop the address, which markdown has nowhere to place
- `@jupyterlab/codeeditor` moved to `devDependencies`, so the extension loads on JupyterLab 4.0 to 4.4 again

### Fixed

- Tables copied from spreadsheets and word processors pasted as raw `<table style=...>` markup; the first row is now promoted into a `<thead>`, which the GFM plugin accepts
- Word and Outlook stylesheets no longer paste as CSS text
- Google Docs `<b style="font-weight:normal">` wrapper no longer brackets the paste in `**`
- Images referencing `file:///` temp paths are dropped instead of pasted as dead links
- Two lines sharing a cell of a nested table fused into one token
- An image inside a nested table was lost, and could empty the whole paste
- A `<thead>` written after its `<tbody>` was emitted as the last data row
- A tag name written as text (`Dear <Name>,`) rendered as nothing
