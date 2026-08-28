import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';

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
 */
const UNBOLD = /font-weight\s*:\s*(?:normal|400)\b/i;

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
  // paragraph and the row/column structure is unrecoverable.
  service.use(tables);

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
  service.escape = (text: string) => escape(text).replace(/</g, '\\<');

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
 * A table's values as one line, cells separated and rows delimited.
 *
 * The table is on its way out of the document, so its subtree is rewritten in
 * place rather than copied. Two things `textContent` alone would lose: a cell
 * holding two lines fuses them into one token - two phone numbers in an email
 * signature become one number, with nothing to show it happened.
 */
function tableText(table: HTMLTableElement): string {
  table.querySelectorAll('br,p,div,li').forEach(node => node.after(' '));

  return Array.from(table.rows)
    .map(row =>
      Array.from(row.cells)
        .map(cell => cell.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .filter(Boolean)
        .join(' ')
    )
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
        root.createTextNode(tableText(nested as HTMLTableElement)),
        ...images
      );
    });
}

/**
 * Move the first row into a `<thead>`, converting its cells to `<th>`.
 *
 * This is the point of the whole normalisation: the plugin treats any row
 * whose parent is a `<thead>` as the heading row without further tests, so a
 * `<colgroup>`, a mixed `td`/`th` row or a leading `<caption>` stop mattering.
 * The cell contents are moved rather than serialised, so nodes already
 * rewritten by an earlier pass keep their identity.
 */
function promoteHeaderRow(
  root: Document,
  table: HTMLTableElement,
  row: HTMLTableRowElement
): void {
  Array.from(row.cells).forEach(cell => {
    if (cell.tagName === 'TH') {
      return;
    }
    const heading = root.createElement('th');
    // `align` is the one attribute anything downstream reads: the plugin
    // turns it into the delimiter row's alignment marker.
    const align = cell.getAttribute('align');
    if (align) {
      heading.setAttribute('align', align);
    }
    while (cell.firstChild) {
      heading.appendChild(cell.firstChild);
    }
    cell.replaceWith(heading);
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
    rows.forEach(row => {
      Array.from(row.children).forEach(child => {
        if (child.tagName !== 'TD' && child.tagName !== 'TH') {
          child.remove();
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

    promoteHeaderRow(root, table, rows[0]);
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
    normaliseTables(document);
    return turndown.turndown(document.body);
  } catch (err) {
    console.warn(`${LOG_PREFIX} HTML conversion failed:`, err);
    return '';
  }
}
