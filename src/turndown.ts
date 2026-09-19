import TurndownService from 'turndown';
import { strikethrough, tables, taskListItems } from 'turndown-plugin-gfm';

/**
 * HTML-to-markdown conversion.
 *
 * Kept free of any JupyterLab import: the conversion needs nothing but a DOM,
 * so it can be unit tested directly without a lab environment.
 */

const LOG_PREFIX = '[paste-as-markdown]';

/**
 * Elements carrying no markdown representation. Turndown has no rule for these
 * and does not treat them as block content, so without this their raw text
 * content is emitted inline - Word and Outlook ship a <style> block ahead of
 * the copied text, which would otherwise land in the document as escaped CSS.
 */
const DROPPED_ELEMENTS = 'style,script,noscript,title';

/**
 * Image sources that still resolve on a machine other than the one that
 * copied them. Word and Outlook reference `file:///.../msohtmlclip1/...`
 * temp files, which are dead everywhere else and unreachable from a browser.
 */
const PORTABLE_IMAGE_SRC = /^(?:https?:|data:|\/\/)/i;

/**
 * Elements that cannot sit inside a markdown link. A link wrapping any of
 * these converts to a stray `[` on its own line and a `](url)` after the
 * content, both of which render literally.
 */
const BLOCK_CONTENT =
  'address,article,aside,blockquote,div,dl,figure,footer,h1,h2,h3,h4,h5,h6,' +
  'header,hr,li,main,nav,ol,p,pre,section,table,ul';

/**
 * A `font-weight` that means "not bold". Google Docs wraps everything it
 * copies in `<b style="font-weight:normal" id="docs-internal-guid-...">`,
 * which turndown faithfully converts to a pair of stray `**`.
 *
 * Anchored: unanchored it also matched inside Word's own
 * `mso-bidi-font-weight:normal`, which sits on the `<b>` carrying the bold,
 * so every bold run in a Word paste was unwrapped and lost.
 */
const UNBOLD = /(?:^|;)\s*font-weight\s*:\s*(?:normal|400)\b/i;

/**
 * Formatting a rich-text editor expresses as CSS instead of as a tag. Word and
 * Google Docs both emit runs as a bare `<span>` and carry the formatting in
 * its style, which turndown has no rule for and drops without a trace - the
 * whole reason a Word paste arrives as unformatted text.
 *
 * Each pattern is anchored on a semicolon or the start of the attribute, so
 * Word's own `mso-bidi-font-weight:normal` cannot match `font-weight`.
 */
const CSS_BOLD = /(?:^|;)\s*font-weight\s*:\s*(?:bold(?:er)?|[5-9]00)\b/i;
const CSS_ITALIC = /(?:^|;)\s*font-style\s*:\s*italic\b/i;
const CSS_STRIKE = /(?:^|;)\s*text-decoration[\w-]*\s*:[^;]*\bline-through\b/i;

/**
 * The tag each CSS pattern stands for, and the ancestors that already say the
 * same thing. A run inside them is skipped: nesting `<strong>` in `<strong>`
 * emits a second pair of `**`, and a heading line is bold already.
 */
const CSS_FORMATTING: ReadonlyArray<readonly [RegExp, string, string]> = [
  [CSS_BOLD, 'strong', 'strong,b,h1,h2,h3,h4,h5,h6,code,pre'],
  [CSS_ITALIC, 'em', 'em,i,code,pre'],
  [CSS_STRIKE, 'del', 'del,s,strike,code,pre']
];

/**
 * The one tag per kind of formatting, so the two spellings HTML offers for
 * each compare equal when neighbouring runs are joined below.
 */
const FORMATTING_TAG: Readonly<Record<string, string>> = {
  b: 'strong',
  strong: 'strong',
  i: 'em',
  em: 'em',
  s: 'del',
  strike: 'del',
  del: 'del'
};

/**
 * Word's list paragraphs. There is no `<ul>` or `<li>` anywhere in a Word
 * paste: every item is a paragraph whose style carries `mso-list: l0 level1
 * lfo1`, and the bullet or number is literal text in a nested span.
 */
const MSO_LIST_LEVEL = /(?:^|;)\s*mso-list\s*:[^;]*\blevel(\d+)/i;
const MSO_LIST_MARKER = /mso-list\s*:\s*ignore/i;

/**
 * A marker that counts rather than bullets - `1.`, `a)`, `iv.`. Word's bullet
 * glyphs are a middle dot, a lowercase `o` and a section sign, none of which
 * carry the trailing dot or bracket this requires.
 */
const ORDERED_MARKER = /^\(?(?:\d+|[a-z]+)\s*[.)]/i;

/**
 * The list a paragraph belongs to. Two numbered lists written back to back
 * carry different ids and Word restarts the second; a nested level keeps its
 * parent's id, so this never splits a list from its own sub-list.
 */
const MSO_LIST_ID = /(?:^|;)\s*mso-list\s*:\s*(l\d+)/i;

const turndown = createTurndownService();

/**
 * Build the conversion service. One instance serves every paste: `turndown()`
 * clones its input, so it holds no state between calls.
 */
function createTurndownService(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
  });

  // Turndown core has no table rules; without this every cell becomes its own
  // paragraph and the row/column structure is unrecoverable. It has no rule
  // for strikethrough or for a task-list checkbox either, so both are dropped
  // without a trace unless the plugin supplies them.
  service.use([tables, strikethrough, taskListItems]);

  // The plugin emits one tilde. JupyterLab's own preview takes it, but
  // nbconvert and markdown-it-py - which File > Save and Export Notebook As
  // runs - render `~x~` as literal text, and a stray `~` elsewhere on the
  // line pairs with the delimiter and swallows everything between. Two are
  // unambiguous in all three.
  service.addRule('strikethrough', {
    // A predicate, not a tag list: `strike` is deprecated and absent from
    // TypeScript's tag-name map, which the array form is typed against.
    filter: node => ['DEL', 'S', 'STRIKE'].includes(node.nodeName),
    replacement: (content: string) => `~~${content}~~`
  });

  // Table cells, overriding the GFM plugin's own rule. Added after `use`, so
  // it takes precedence. A literal pipe or a line break inside a cell would
  // otherwise break the row apart; both have to be neutralised here rather
  // than in the DOM, because turndown escapes a backslash injected upstream.
  service.addRule('tableCell', {
    filter: ['th', 'td'],
    replacement: (content: string, node: Node) => {
      const safe = content
        .replace(/\|/g, '\\|')
        .replace(/\s*\r?\n\s*/g, ' ')
        .trim();
      return `${node.previousSibling ? ' ' : '| '}${safe} |`;
    }
  });

  // Turndown escapes the markdown metacharacters but not `<`, so text that
  // merely mentions a tag - a mail-merge `Dear <Name>,`, a row of an HTML
  // reference table - is emitted as live markup and renders as nothing at
  // all. Nothing here depends on raw HTML passing through: `promoteHeaderRow`
  // gives every surviving table a `<thead>`, so the GFM plugin's `keep` for
  // headerless tables can no longer fire.
  const escape = service.escape.bind(service);
  service.escape = (text: string) =>
    escape(text).replace(/<(?!(?:https?|mailto|ftp):)/g, '\\<');

  return service;
}

/**
 * Remove inline markup that markdown cannot express, before conversion.
 *
 * Each case is a shape a real application puts on the clipboard, and each
 * produces visible damage rather than a lost nicety: a Google Docs paste
 * bracketed in `**`, a news-site card rendered as a literal `[` and `](url)`,
 * a Word image pasted as a dead `file:///` link, and the empty `[](url)` an
 * Outlook signature leaves once its logo goes.
 *
 * The image pass has to run before the last one, which is what turns the
 * emptied link into nothing rather than into `[](url)`.
 */
function normaliseInlineMarkup(root: Document): void {
  // First, so every later test - the table emptiness test in particular -
  // reads the text that will actually be converted rather than text destined
  // to be discarded.
  root.querySelectorAll(DROPPED_ELEMENTS).forEach(element => {
    element.remove();
  });

  root.querySelectorAll('b[style],strong[style]').forEach(element => {
    if (UNBOLD.test(element.getAttribute('style') ?? '')) {
      element.replaceWith(...Array.from(element.childNodes));
    }
  });

  // A link around block content loses its address: markdown has nowhere to
  // put it, and the content it wraps is worth more than the mangled brackets
  // that keeping it would produce.
  root.querySelectorAll('a[href]').forEach(link => {
    if (link.querySelector(BLOCK_CONTENT)) {
      link.replaceWith(...Array.from(link.childNodes));
    }
  });

  root.querySelectorAll('img').forEach(image => {
    if (!PORTABLE_IMAGE_SRC.test(image.getAttribute('src') ?? '')) {
      image.remove();
    }
  });

  root.querySelectorAll('a[href]').forEach(link => {
    if (!link.textContent?.trim() && !link.querySelector('img')) {
      link.remove();
    }
  });
}

/**
 * Give CSS-expressed formatting the tag turndown needs to see.
 *
 * The run is replaced by the tag rather than wrapped in it, so two runs an
 * editor split for a reason markdown cannot express end up as siblings that
 * `joinAdjacentFormatting` can reach. Document order matters: an outer run is
 * replaced first, which is what puts a nested run inside the new tag and
 * makes the redundancy test see it.
 */
function normaliseStyledRuns(root: Document): void {
  root.querySelectorAll('span[style]').forEach(run => {
    const style = run.getAttribute('style') ?? '';
    // Markdown has no emphasis spanning whole paragraphs, so a run around
    // block content emits its delimiters on lines of their own, where they
    // render as literal asterisks. The same test guards a link above.
    if (run.querySelector(BLOCK_CONTENT)) {
      return;
    }

    const tags = CSS_FORMATTING.filter(
      ([pattern, , redundantWithin]) =>
        pattern.test(style) && !run.closest(redundantWithin)
    );
    if (!tags.length) {
      return;
    }

    const outermost = root.createElement(tags[0][1]);
    let innermost = outermost;
    tags.slice(1).forEach(([, tagName]) => {
      const nested = root.createElement(tagName);
      innermost.appendChild(nested);
      innermost = nested;
    });
    while (run.firstChild) {
      innermost.appendChild(run.firstChild);
    }
    run.replaceWith(outermost);
  });
}

/**
 * Join neighbouring elements carrying the same formatting.
 *
 * Google Docs opens a new run at every style change - colour, size,
 * background - and Word splits on language and proofing attributes, so one
 * bold word arrives as two runs. Delimited separately they emit
 * `**Warn****ing**`, and the four asterisks render literally inside the word.
 *
 * Only a direct neighbour is joined: whitespace between two runs is a word
 * boundary, and `**Hello** **world**` is already right.
 */
function joinAdjacentFormatting(root: Document): void {
  root
    .querySelectorAll(Object.keys(FORMATTING_TAG).join(','))
    .forEach(element => {
      const previous = element.previousSibling;
      if (
        !previous ||
        previous.nodeType !== previous.ELEMENT_NODE ||
        FORMATTING_TAG[(previous as Element).localName] !==
          FORMATTING_TAG[element.localName]
      ) {
        return;
      }
      while (element.firstChild) {
        previous.appendChild(element.firstChild);
      }
      element.remove();
    });
}

/**
 * Remove the glyph Word drew for a list item and return its text.
 *
 * The glyph is the only thing saying whether the list counts or bullets - the
 * paragraph's style records the level and the list id, never the type - so it
 * is read on the way out rather than simply deleted.
 */
function takeListMarker(paragraph: Element): string {
  const marker = Array.from(paragraph.querySelectorAll('span[style]')).find(
    span => MSO_LIST_MARKER.test(span.getAttribute('style') ?? '')
  );
  const text = marker?.textContent ?? '';
  marker?.remove();
  return text.trim();
}

/**
 * Turn one run of consecutive Word list paragraphs into real lists.
 *
 * The stack holds the list open at each level. A deeper paragraph opens a list
 * inside the current item, a shallower one closes back to its own level, and a
 * marker that changes type at the same level starts a sibling list - Word
 * writes a bulleted and a numbered list as adjacent paragraphs with nothing
 * between them to separate them.
 */
function buildWordList(root: Document, paragraphs: Element[]): void {
  const stack: { level: number; list: Element }[] = [];

  paragraphs.forEach(paragraph => {
    const level = Number(
      MSO_LIST_LEVEL.exec(paragraph.getAttribute('style') ?? '')?.[1]
    );
    const marker = takeListMarker(paragraph);

    while (stack.length && stack[stack.length - 1].level > level) {
      stack.pop();
    }

    let open = stack[stack.length - 1];
    // A paragraph with no marker carries no type of its own - a selection
    // begun inside the first item is that shape - so it stays in the list
    // already open rather than defaulting to a bullet and cutting a numbered
    // run in half.
    const tagName = marker
      ? ORDERED_MARKER.test(marker)
        ? 'ol'
        : 'ul'
      : open?.level === level
        ? open.list.localName
        : 'ul';

    if (open && open.level === level && open.list.localName !== tagName) {
      stack.pop();
      open = stack[stack.length - 1];
    }

    if (!open || open.level < level) {
      const list = root.createElement(tagName);
      // Word restarts its own numbering and a selection can begin mid-list;
      // without this a procedure copied from step 5 reads as step 1.
      const start = Number(/^\(?(\d+)/.exec(marker)?.[1]);
      if (start > 1) {
        list.setAttribute('start', String(start));
      }
      // Inside the item it belongs to when there is one; otherwise where the
      // paragraph stands, which is still in the document at this point.
      const parentItem = open?.list.lastElementChild;
      if (parentItem) {
        parentItem.appendChild(list);
      } else {
        paragraph.before(list);
      }
      open = { level, list };
      stack.push(open);
    }

    const item = root.createElement('li');
    while (paragraph.firstChild) {
      item.appendChild(paragraph.firstChild);
    }
    open.list.appendChild(item);
    paragraph.remove();
  });
}

/**
 * Rebuild every Word list in the document.
 *
 * Paragraphs are grouped into runs of immediate siblings: two lists separated
 * by a paragraph of prose are two lists, and joining them would move the prose
 * out of its place in the document.
 */
function normaliseWordLists(root: Document): void {
  const paragraphs = Array.from(root.querySelectorAll('p[style]')).filter(
    paragraph => MSO_LIST_LEVEL.test(paragraph.getAttribute('style') ?? '')
  );

  const listId = (paragraph: Element): string =>
    MSO_LIST_ID.exec(paragraph.getAttribute('style') ?? '')?.[1] ?? '';

  let run: Element[] = [];
  const flush = (): void => {
    if (run.length) {
      buildWordList(root, run);
      run = [];
    }
  };

  paragraphs.forEach(paragraph => {
    const previous = run[run.length - 1];
    if (
      previous &&
      (previous.nextElementSibling !== paragraph ||
        listId(previous) !== listId(paragraph))
    ) {
      flush();
    }
    run.push(paragraph);
  });
  flush();
}

/**
 * A table's values as one line, caption first, cells separated and rows
 * delimited.
 *
 * The table is on its way out of the document, so its subtree is rewritten in
 * place rather than copied. Two things `textContent` alone would lose: a cell
 * holding two lines fuses them into one token - two phone numbers in an email
 * signature become one number, with nothing to show it happened; and the
 * caption sits outside `rows`, so the line that names the values goes missing
 * altogether.
 */
function tableText(table: HTMLTableElement): string {
  table.querySelectorAll(`${BLOCK_CONTENT},br`).forEach(node => {
    node.before(' ');
    node.after(' ');
  });

  const caption = table.caption?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  return [
    caption,
    ...Array.from(table.rows).map(row =>
      Array.from(row.cells)
        .map(cell => cell.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .filter(Boolean)
        .join(' ')
    )
  ]
    .filter(Boolean)
    .join('; ');
}

/**
 * Replace every table nested inside another with its own text.
 *
 * GFM has no nested table. Reversed so the deepest goes first: in document
 * order a middle table's text is rebuilt while its cells still hold an
 * un-flattened table, whose `textContent` runs every value together.
 *
 * Images cross over as elements rather than as text: an email lays its hero
 * image out in a nested table, and text would both lose the picture and leave
 * the outer table empty enough for the guard below to drop it - taking the
 * whole paste with it, since the caller reads an empty result as "nothing on
 * the clipboard".
 */
function flattenNestedTables(root: Document): void {
  Array.from(root.querySelectorAll('table table'))
    .reverse()
    .forEach(nested => {
      const images = Array.from(nested.querySelectorAll('img'));
      nested.replaceWith(
        root.createTextNode(` ${tableText(nested as HTMLTableElement)} `),
        ...images
      );
    });
}

/**
 * Replace a cell with an equivalent one under the other cell tag.
 *
 * The contents are moved rather than serialised, so nodes already rewritten
 * by an earlier pass keep their identity. `align` is the one attribute
 * anything downstream reads: the plugin turns it into the delimiter row's
 * alignment marker.
 */
function retag(root: Document, cell: Element, tagName: 'td' | 'th'): void {
  const replacement = root.createElement(tagName);
  const align = cell.getAttribute('align');
  if (align) {
    replacement.setAttribute('align', align);
  }
  while (cell.firstChild) {
    replacement.appendChild(cell.firstChild);
  }
  cell.replaceWith(replacement);
}

/**
 * Move the first row into a `<thead>`, converting its cells to `<th>`.
 *
 * This is the point of the whole normalisation: the plugin treats any row
 * whose parent is a `<thead>` as the heading row without further tests, so a
 * `<colgroup>`, a mixed `td`/`th` row or a leading `<caption>` stop mattering.
 */
function promoteHeaderRow(
  root: Document,
  table: HTMLTableElement,
  row: HTMLTableRowElement
): void {
  Array.from(row.cells).forEach(cell => {
    if (cell.tagName !== 'TH') {
      retag(root, cell, 'th');
    }
  });

  const head = root.createElement('thead');
  head.appendChild(row);
  table.insertBefore(head, table.firstChild);
}

/**
 * Make clipboard tables safe to convert.
 *
 * The GFM plugin converts a table only when its first row qualifies as a
 * heading row, and hands every other table to `keep`, which emits the raw
 * `<table style=...>` markup into the document. Its test is narrow - the row
 * must sit in a `<thead>`, or be the table's first child with every one of
 * its child nodes a `<th>` - and the shapes that fail it are exactly what
 * spreadsheets and word processors put on the clipboard.
 *
 * `colspan` and `rowspan` are left alone. Markdown has neither, so a merged
 * cell keeps one column and its row is padded out to the table's width. The
 * values all survive, which is what a paste is for; a row under a merged cell
 * can sit one column left of where the spreadsheet drew it.
 */
function normaliseTables(root: Document): void {
  flattenNestedTables(root);

  root.querySelectorAll('table').forEach(table => {
    // A caption has no rule of its own, so left in place its text is emitted
    // inside the table body. Lift each one to a paragraph ahead of the table.
    Array.from(table.querySelectorAll('caption')).forEach(caption => {
      const paragraph = root.createElement('p');
      while (caption.firstChild) {
        paragraph.appendChild(caption.firstChild);
      }
      table.before(paragraph);
      caption.remove();
    });

    // A layout table whose only content was a dropped image - an email
    // signature - would otherwise paste as an empty two-line table.
    if (!table.textContent?.trim() && !table.querySelector('img')) {
      table.remove();
      return;
    }

    // HTML 4 required <tfoot> before <tbody>, and generated pages still do
    // it. Turndown walks the document, so the totals row would be emitted
    // directly under the header rather than after the data it totals.
    const foot = table.tFoot;
    if (foot && foot !== table.lastElementChild) {
      table.appendChild(foot);
    }

    // Read before the unwrap below: `table.rows` returns every <thead> row
    // first whatever the tree order, which is the only thing identifying the
    // header of a table whose <thead> was written after its <tbody>.
    const rows = Array.from(table.rows);

    // Every row left in a <thead> is treated as a heading row and gets its
    // own delimiter line, so a two-row header would put a `---` row in the
    // middle of the data. One header row is promoted deliberately below.
    table.querySelectorAll('thead').forEach(head => {
      head.replaceWith(...Array.from(head.childNodes));
    });

    // The plugin writes one delimiter cell per child node of the header row,
    // so anything in a row that is not a cell desynchronises the delimiter
    // from the header and GFM rejects the table outright.
    rows.forEach((row, index) => {
      Array.from(row.children).forEach(child => {
        if (child.tagName !== 'TD' && child.tagName !== 'TH') {
          child.remove();
          return;
        }
        // The row promoted below is the table's only heading row. A row of
        // <th> left behind it reads as a heading row too - a blank first row
        // above the real header is the common shape - and takes its own
        // delimiter line into the middle of the data.
        if (index > 0 && child.tagName === 'TH') {
          retag(root, child, 'td');
        }
      });
    });

    // Every renderer truncates a row to the header's width, so a short row -
    // ragged, or holding a merged cell - would silently lose its trailing
    // columns. Reduced rather than spread: `Math.max(...)` throws above
    // ~125 000 arguments, and a large spreadsheet paste reaches that.
    const width = rows.reduce(
      (widest, row) => Math.max(widest, row.cells.length),
      0
    );
    rows.forEach(row => {
      while (row.cells.length < width) {
        row.appendChild(root.createElement('td'));
      }
    });

    promoteHeaderRow(
      root,
      table,
      rows.find(row => row.textContent?.trim() || row.querySelector('img')) ??
        rows[0]
    );
  });
}

/**
 * Convert clipboard HTML to markdown.
 *
 * Returns an empty string when the HTML carries nothing convertible, or when
 * conversion fails outright - the caller treats both the same way and falls
 * back to the plain-text clipboard flavour.
 */
export function convertHtmlToMarkdown(html: string): string {
  try {
    const document = new DOMParser().parseFromString(html, 'text/html');
    normaliseInlineMarkup(document);
    normaliseStyledRuns(document);
    joinAdjacentFormatting(document);
    normaliseWordLists(document);
    normaliseTables(document);
    return turndown.turndown(document.body);
  } catch (err) {
    console.warn(`${LOG_PREFIX} HTML conversion failed:`, err);
    return '';
  }
}
