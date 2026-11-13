# Defects - jupyterlab_paste_content_as_markdown_extension

Observed wrong behaviour in the extension's clipboard read, HTML-to-markdown conversion and editor insertion.

## Authors

- `@kj` Konrad Jelen

## Clipboard `CLIP`

Reading the clipboard flavours and mapping a failure onto user-facing advice

- [x] `DEF-CLIP-1` **failed plain-text read is swallowed with no log** - MINOR; when the HTML flavour converts to nothing the dialog says "No content available on the clipboard" and nothing says the plain-text fallback failed; cause: the optional `text/plain` read is caught by a bare `.catch(() => undefined)`, the only failure path in the file that does not `console.warn`; fix: warn with the same `[paste-as-markdown]` prefix as the other two handlers; `src/clipboard.ts`
  - evidence: jest 102 green on 2026-09-19; removing the warn fails 'reports the failed plain-text read rather than swallowing it'
  - repro: copy HTML that converts to nothing, deny or fail the text/plain read, invoke Paste as Markdown, read the console
  - test-tags: UNIT
  - log: 2026-09-19T20:26:54Z @kj added
  - log: 2026-09-19T20:38:00Z @kj closed: fixed: the catch now warns with the [paste-as-markdown] prefix like the other two handlers

## HTML normalisation `HTML`

Rewriting clipboard HTML into shapes turndown can convert, before conversion

- [x] `DEF-HTML-2` **Word bold is unwrapped and lost** - MAJOR; text bolded in Word pastes unformatted; cause: `UNBOLD` is unanchored, so the substring inside Word's own `mso-bidi-font-weight:normal` matches and `normaliseInlineMarkup` unwraps the `<b>` that carries the bold; fix: anchor the pattern on a semicolon or the start of the attribute, as `CSS_BOLD` already is; `src/turndown.ts`
  - evidence: jest 112 green on 2026-09-19; unanchoring the pattern again fails 'keeps the bold Word applies with its own Bold button'
  - repro: convert `<b style='mso-bidi-font-weight:normal'><span style='font-size:11.0pt'>Bold</span></b>`, observe `Bold` instead of `**Bold**`
  - test-tags: UNIT
  - root-cause: 2026-09-19T20:49:13Z @kj the pattern tests for a substring of a CSS property name, and Word prefixes the same property with `mso-bidi-`
  - log: 2026-09-19T20:49:13Z @kj added
  - log: 2026-09-19T20:59:22Z @kj closed: fixed: UNBOLD anchored on a semicolon or the start of the attribute
- [x] `DEF-HTML-3-BARE-PRE` **Code block without a code tag pastes as escaped prose** - MAJOR; a `<pre>` holding no `<code>` first child gets no fence: `my_func` pastes as `my\_func`, lines run together when rendered; Sphinx, Pygments and GitHub emit that shape; `src/turndown.ts`
  - evidence: jest 113 green on 2026-11-13; 'fences a <pre> that holds no <code>, as documentation sites emit' fails without the wrap in normaliseInlineMarkup
  - root-cause: 2026-11-13T09:21:38Z @kj turndown fences a `<pre>` only when its first child is a `<code>`; any other `<pre>` falls to the default block rule, which escapes markdown characters
  - repro: convert `<pre>def my_func(a_b):\n    return a_b * 2</pre>`, observe escaped text and no fence
  - test-tags: UNIT
  - log: 2026-11-13T09:21:03Z @kj added
  - log: 2026-11-13T09:21:38Z @kj closed
- [x] `DEF-HTML-5-SIBLING-LIST` **Google Docs nested list is flattened to one level** - MAJOR; a nested list copied from Google Docs pastes with every sub-item at column 0, so the hierarchy of the list is lost; `src/turndown.ts`
  - evidence: jest turndown.spec.ts 98 green on 2026-11-13; 'indents a nested list written as a sibling of its item' pins two levels, three levels and the `<p>`-wrapped Docs item; `nestSiblingLists` in `src/turndown.ts`
  - repro: convert `<ul><li>one</li><ul><li>nested</li></ul><li>two</li></ul>`, observe `nested` with no indentation
  - test-tags: UNIT
  - root-cause: 2026-11-13T09:40:07Z @kj Google Docs writes a nested list as a sibling of the `<li>` it belongs under, not as its child; turndown indents a list only when its parent is an `<li>`
  - log: 2026-11-13T09:40:07Z @kj added
  - log: 2026-11-13T09:40:18Z @kj closed

## Documentation `DOCS`

README statements the code does not keep

- log: 2026-11-13T09:21:03Z @kj category created

- [x] `DEF-DOCS-4-CSS-CLAIM` **README says CSS formatting is lost** - MINOR; How It Works says conversion reads tags, not CSS, and Google Docs bold arrives as plain text; Features and `normaliseStyledRuns` say and do the opposite
  - evidence: paragraph removed from README.md How It Works; grep 'not CSS' README.md prints nothing
  - root-cause: 2026-11-13T09:21:38Z @kj the paragraph predates `normaliseStyledRuns` and was not removed when CSS formatting was added
  - repro: read README.md How It Works beside the Rich text support bullet
  - test-tags: MANUAL
  - log: 2026-11-13T09:21:03Z @kj added
  - log: 2026-11-13T09:21:39Z @kj closed
- [x] `DEF-DOCS-6-STALE-COMMENT` **Comments describe values and messages the code no longer has** - MINOR; `src/index.ts` names a `^4.5.6` pin and loading on JupyterLab 4.0 to 4.4, `src/clipboard.ts` quotes the dialog text "No content available"; the pin is `^4.6.0`, the extension requires JupyterLab 4.6, and the dialog says "Nothing on the clipboard could be converted to markdown."
  - test-tags: MANUAL
  - evidence: the comment in `src/index.ts` names `^4.6.0` and no JupyterLab 4.0 to 4.4; the comment at the `text/plain` read in `src/clipboard.ts` quotes the dialog text `src/index.ts` shows when the HTML converts to nothing
  - repro: read the comment above the `CodeEditor` import in `src/index.ts` and the comment above the `text/plain` read in `src/clipboard.ts`
  - root-cause: 2026-11-13T09:40:08Z @kj the pin, the JupyterLab floor and the dialog text were changed without the comments that quote them
  - log: 2026-11-13T09:40:08Z @kj added
  - log: 2026-11-13T09:40:18Z @kj closed
  - log: 2026-11-13T09:40:41Z @kj edited test-tags added "MANUAL"; evidence "`grep -n '4.5.6\|4.0 to 4.4\|No content available' src/` prints nothing; the comments name `^4.6.0` and the dialog text of `src/index.ts`" -> "the comment in `src/index.ts` names `^4.6.0` and no JupyterLab 4.0 to 4.4; the comment at the `text/plain` read in `src/clipboard.ts` quotes the dialog text `src/index.ts` shows when the HTML converts to nothing"

## Continuous integration `CI`

Defects of the GitHub Actions workflows.

- log: 2026-11-13T09:40:08Z @kj category created

- [x] `DEF-CI-7-ABSENT-EXTRA` **CI installs an extra the package does not define** - MINOR; the build job runs `python -m pip install .[test]`; `pyproject.toml` defines only the `dev` extra, so pip installs nothing for it and prints a warning; `.github/workflows/build.yml`
  - test-tags: MANUAL
  - evidence: `.github/workflows/build.yml` line 43 reads `python -m pip install .`; `grep -rn 'install .\[' .github` prints nothing
  - repro: run `python -m pip install .[test]`, observe the warning that the package does not provide the extra `test`
  - root-cause: 2026-11-13T09:40:17Z @kj the workflow step names a `test` extra and `pyproject.toml` declares only `dev` under `[project.optional-dependencies]`
  - log: 2026-11-13T09:40:08Z @kj added
  - log: 2026-11-13T09:40:17Z @kj root-cause updated "2026-11-13T09:40:08Z @kj the workflow line comes from the extension template, whose `test` extra this project does not have" -> "the workflow step names a `test` extra and `pyproject.toml` declares only `dev` under `[project.optional-dependencies]`"
  - log: 2026-11-13T09:40:18Z @kj closed
  - log: 2026-11-13T09:40:41Z @kj edited test-tags added "MANUAL"

