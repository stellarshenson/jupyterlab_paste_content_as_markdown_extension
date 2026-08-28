# Changelog

<!-- <START NEW CHANGELOG ENTRY> -->

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
