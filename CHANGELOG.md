# Changelog

<!-- <START NEW CHANGELOG ENTRY> -->

## [1.0.10] - 2026-09-20

### Changed

- Republished from the same source as 1.0.9, with no change to the extension. The 1.0.9 release commit has since been verified by CI - build, isolated install, link check and the 14 integration tests all green against a wheel built from the published source

<!-- <END NEW CHANGELOG ENTRY> -->

## [1.0.9] - 2026-09-20

### Added

- Formatting a word processor carries in CSS rather than in tags now converts: a run whose style sets bold, italic or line-through becomes markdown, which is how Word and Google Docs express most of their formatting
- Word's list paragraphs become real markdown lists, keeping the nesting level, the number the list started at, and the separation between two lists Word numbered independently. Word emits no `<ul>`, `<ol>` or `<li>` at all, so these previously pasted as paragraphs each opening with a stray bullet character
- Acceptance criteria and defects tracked in `docs/acc-crit.md` and `docs/defects.md`

### Changed

- Strikethrough is delimited with two tildes rather than one. JupyterLab's own preview accepts either, but nbconvert and markdown-it-py, which File > Save and Export Notebook As runs, render the one-tilde form as literal text, and a stray tilde elsewhere on the line pairs with the delimiter and swallows the text between
- A paste whose content converted to nothing says so, rather than reporting the clipboard as empty. A Word figure is the everyday case: its only image points at a local temp file and is dropped
- A `text/plain` read that fails is logged instead of being discarded without a trace
- Build lifecycle updated to Makefile 1.40, which stages `yarn.lock` in the post-publish commit so an immutable-lockfile install in CI cannot fail on a dependency added since the previous commit

### Fixed

- Text bolded with Word's own Bold button pasted unformatted. The "not bold" pattern was unanchored and matched inside Word's own `mso-bidi-font-weight:normal`, unwrapping the `<b>` element that carried the bold
- Two neighbouring runs carrying the same formatting emitted two pairs of delimiters, so a bold word Google Docs split at a colour change pasted as `**Warn****ing**`
- A styled run wrapping whole paragraphs emitted its delimiters on lines of their own, where they render as literal asterisks
- A styled run inside inline code put its markers into the code text

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
