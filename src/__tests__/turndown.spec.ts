import { convertHtmlToMarkdown } from '../turndown';

/**
 * The conversion needs only a DOM, so it is tested directly against jsdom
 * with no JupyterLab mocking.
 */
describe('convertHtmlToMarkdown', () => {
  const convert = convertHtmlToMarkdown;

  describe('elements with no markdown representation', () => {
    it('drops a <style> block instead of emitting its CSS as text', () => {
      const wordHtml =
        '<style><!-- p.MsoNormal {margin:0cm; font-family:"Calibri",sans-serif;} --></style>' +
        '<p>Hello <b>world</b></p>';

      const markdown = convert(wordHtml);

      expect(markdown).toBe('Hello **world**');
      expect(markdown).not.toContain('MsoNormal');
      expect(markdown).not.toContain('font-family');
    });

    it('drops a <script> block instead of emitting its source as text', () => {
      const markdown = convert('<div>ok</div><script>alert(1)</script>');

      expect(markdown).toBe('ok');
      expect(markdown).not.toContain('alert');
    });

    it('drops <head> metadata that browsers prepend to clipboard HTML', () => {
      const markdown = convert(
        '<html><head><title>Doc</title><meta charset="utf-8">' +
          '<style>p{margin:0}</style></head><body><p>Body text</p></body></html>'
      );

      expect(markdown).toBe('Body text');
    });
  });

  describe('tables', () => {
    it('preserves rows and columns as a markdown table', () => {
      const markdown = convert(
        '<table><tr><th>Name</th><th>Qty</th></tr>' +
          '<tr><td>Bolt</td><td>12</td></tr></table>'
      );

      // Structure must survive: a header row, a delimiter row, a body row.
      expect(markdown).toContain('| Name | Qty |');
      expect(markdown).toContain('| Bolt | 12 |');
      expect(markdown.split('\n').filter(Boolean)).toHaveLength(3);
    });

    it('promotes the first row when a table has no header cells', () => {
      // Spreadsheet copies routinely have no <th>. Markdown has no headerless
      // table, and leaving it alone emits raw HTML into the document.
      const markdown = convert(
        '<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>'
      );

      expect(markdown).toContain('| a | b |');
      expect(markdown).toContain('| c | d |');
      expect(markdown).not.toContain('<table');
      expect(markdown).not.toContain('<td>');
    });

    it('converts a table led by a <colgroup>, as spreadsheets emit', () => {
      // The GFM plugin only recognises a heading row that is its parent's
      // first child, so a <colgroup> ahead of the rows used to send the whole
      // table down the raw-HTML path.
      const markdown = convert(
        '<table style="border-collapse:collapse"><colgroup><col width="96">' +
          '<col width="96"></colgroup><tbody><tr><td>Item</td><td>Qty</td></tr>' +
          '<tr><td>Bolt</td><td>12</td></tr></tbody></table>'
      );

      expect(markdown).toBe('| Item | Qty |\n| --- | --- |\n| Bolt | 12 |');
    });

    it('never emits the stylesheet of a table it cannot convert', () => {
      // The raw-HTML path took the <style> with it, restoring the exact leak
      // that dropping <style> exists to prevent.
      const markdown = convert(
        '<table><colgroup><col></colgroup><tr><td>' +
          '<style>td{color:red}</style>Bolt</td></tr><tr><td>x</td></tr></table>'
      );

      expect(markdown).toBe('| Bolt |\n| --- |\n| x |');
    });

    it('accepts a header row that mixes <td> and <th>', () => {
      const markdown = convert(
        '<table><tr><td></td><th>Q1</th><th>Q2</th></tr>' +
          '<tr><td>R</td><td>1</td><td>2</td></tr></table>'
      );

      expect(markdown).toBe(
        '|  | Q1 | Q2 |\n| --- | --- | --- |\n| R | 1 | 2 |'
      );
    });

    it('lifts a caption to a paragraph ahead of the table', () => {
      const markdown = convert(
        '<table><caption>Cap</caption><tr><td>A</td></tr>' +
          '<tr><td>1</td></tr></table>'
      );

      expect(markdown).toBe('Cap\n\n| A |\n| --- |\n| 1 |');
    });

    it('keeps every column when a header cell spans the sheet', () => {
      // Renderers truncate every body row to the header's width, so a title
      // row spanning the sheet would drop the other columns on render. The
      // span itself is not resolved - the row is padded to the table's width.
      const markdown = convert(
        '<table><tr><td colspan="3">Q1 Report</td></tr>' +
          '<tr><td>a</td><td>b</td><td>c</td></tr></table>'
      );

      expect(markdown).toBe(
        '| Q1 Report |  |  |\n| --- | --- | --- |\n| a | b | c |'
      );
    });

    it('pads a ragged row out to the widest row', () => {
      const markdown = convert(
        '<table><tr><td>a</td><td>b</td></tr><tr><td>1</td></tr>' +
          '<tr><td>1</td><td>2</td><td>3</td></tr></table>'
      );

      expect(markdown.split('\n')).toEqual([
        '| a | b |  |',
        '| --- | --- | --- |',
        '| 1 |  |  |',
        '| 1 | 2 | 3 |'
      ]);
    });

    it('keeps the alignment of a header cell', () => {
      const markdown = convert(
        '<table><tr><th align="right">A</th></tr><tr><td>1</td></tr></table>'
      );

      expect(markdown).toBe('| A |\n| --: |\n| 1 |');
    });

    it('flattens a nested table to its text', () => {
      const markdown = convert(
        '<table><tr><th>A</th></tr><tr><td>' +
          '<table><tr><td>x</td></tr></table></td></tr></table>'
      );

      expect(markdown).toBe('| A |\n| --- |\n| x |');
    });

    it('flattens an empty nested table without disturbing its surroundings', () => {
      // An empty nested table is replaced by empty text, so neither the cell
      // holding it nor the paragraphs either side of the outer table move.
      const markdown = convert(
        '<p>Report</p><table><tr><td>cell<table></table></td></tr></table><p>End</p>'
      );

      expect(markdown).toContain('Report');
      expect(markdown).toContain('End');
      expect(markdown).toContain('| cell |');
    });

    it('escapes a pipe inside a cell so the row keeps its shape', () => {
      const markdown = convert(
        '<table><tr><th>A</th></tr><tr><td>x|y</td></tr></table>'
      );

      // One header column, one delimiter, one body column.
      expect(markdown.split('\n')[2]).toBe('| x\\|y |');
    });

    it('keeps a line break inside a cell from breaking the row', () => {
      const markdown = convert(
        '<table><tr><th>A</th></tr><tr><td>one<br>two</td></tr></table>'
      );

      expect(markdown.split('\n')).toHaveLength(3);
      expect(markdown.split('\n')[2]).toBe('| one two |');
    });

    it('tolerates the whitespace an indented table carries', () => {
      const markdown = convert(
        '<table>\n  <tr>\n    <td>a</td>\n    <td>b</td>\n  </tr>\n' +
          '  <tr>\n    <td>1</td>\n    <td>2</td>\n  </tr>\n</table>'
      );

      expect(markdown).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |');
    });

    it('does not let a spanned banner cell widen the table', () => {
      // The DOM clamps colspan at 1000. Resolving the span would turn one
      // attribute into 1000 cells on every row; leaving it alone costs one.
      const markdown = convert(
        '<table><tr><td colspan="1000">Banner</td></tr>' +
          '<tr><td>a</td><td>b</td></tr></table>'
      );

      expect(markdown).toBe('| Banner |  |\n| --- | --- |\n| a | b |');
    });

    it('emits one delimiter row for a two-row header', () => {
      // Every row left in a <thead> is a heading row to the plugin, so the
      // second one used to put a `---` line in the middle of the data.
      const markdown = convert(
        '<table><thead><tr><th colspan="2">2024</th></tr>' +
          '<tr><th>Q1</th><th>Q2</th></tr></thead>' +
          '<tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
      );

      expect(
        markdown.split('\n').filter(line => line.startsWith('| ---'))
      ).toHaveLength(1);
      expect(markdown).toContain('| Q1 | Q2 |');
    });

    it('puts a leading tfoot after the rows it totals', () => {
      // HTML 4 required tfoot before tbody, and generated pages still do it.
      const markdown = convert(
        '<table><tfoot><tr><td>Total</td><td>99</td></tr></tfoot>' +
          '<tbody><tr><td>Item</td><td>Qty</td></tr>' +
          '<tr><td>Bolt</td><td>12</td></tr></tbody></table>'
      );

      expect(markdown.split('\n')).toEqual([
        '| Item | Qty |',
        '| --- | --- |',
        '| Bolt | 12 |',
        '| Total | 99 |'
      ]);
    });

    it('keeps the alignment of a promoted cell', () => {
      const markdown = convert(
        '<table><tr><td align="center">A</td></tr><tr><td>1</td></tr></table>'
      );

      expect(markdown).toBe('| A |\n| :-: |\n| 1 |');
    });

    it('drops a layout table whose only content was a dropped image', () => {
      // An email signature: a company link around a file:// logo, inside a
      // one-cell table. Emptying the cell used to leave a blank table.
      const markdown = convert(
        '<p>Regards,</p><table><tr><td>' +
          '<a href="https://c.example"><img src="file:///C:/Temp/logo.png" ' +
          'alt="logo"></a></td></tr></table>'
      );

      expect(markdown).toBe('Regards,');
    });

    it('drops a spacer table holding only a non-breaking space', () => {
      expect(
        convert('<p>a</p><table><tr><td>&nbsp;</td></tr></table><p>b</p>')
      ).toBe('a\n\nb');
    });

    it('keeps a table whose only content is a resolvable image', () => {
      expect(
        convert(
          '<table><tr><td><img src="https://cdn.example/a.png" alt="A">' +
            '</td></tr></table>'
        )
      ).toBe('| ![A](https://cdn.example/a.png) |\n| --- |');
    });

    it('keeps a nested table readable instead of running its cells together', () => {
      const markdown = convert(
        '<table><tr><th>Sizes</th><th>Data</th></tr><tr><td>x</td><td>' +
          '<table><tr><td>Alpha</td><td>Beta</td></tr>' +
          '<tr><td>1</td><td>2</td></tr></table></td></tr></table>'
      );

      expect(markdown).toContain('| x | Alpha Beta; 1 2 |');
    });

    it('separates two lines sharing a nested cell', () => {
      // An email signature puts both phone numbers in one cell, split by a
      // <br> that contributes no text. Fused, the two numbers become one
      // number, and nothing in the output says so.
      const markdown = convert(
        '<table><tr><td><table><tr><td><p>12</p><p>34</p></td>' +
          '<td>T: 1<br>M: 2</td></tr></table></td><td>b</td></tr></table>'
      );

      expect(markdown).toContain('| 12 34 T: 1 M: 2 | b |');
    });

    it('separates a value that precedes a block in a nested cell', () => {
      // Generated email HTML is minified, so there is no source whitespace to
      // fall back on. Padding only the closing side of the block leaves the
      // two numbers fused into one plausible-looking wrong number.
      const markdown = convert(
        '<table><tr><td><table><tr><td>5550100<div>5550200</div></td>' +
          '</tr></table></td><td>z</td></tr></table>'
      );

      expect(markdown).toContain('| 5550100 5550200 | z |');
    });

    it('separates the text a deeper table leaves behind from its neighbours', () => {
      // The innermost table becomes a text node inside a cell that already
      // holds text either side of it. Without a boundary of its own that text
      // node fuses to both neighbours.
      const markdown = convert(
        '<table><tr><td><table><tr><td>A<table><tr><td>B</td></tr>' +
          '</table>C</td></tr></table></td><td>z</td></tr></table>'
      );

      expect(markdown).toContain('| A B C | z |');
    });

    it('flattens the deepest table first, three levels down', () => {
      // An Outlook signature nests this far as a matter of course. Taken in
      // document order the middle table is rebuilt while its cells still hold
      // an un-flattened table, and every value runs together.
      const markdown = convert(
        '<table><tr><td><table><tr><td><table>' +
          '<tr><td>Jane Doe</td><td>CTO</td></tr>' +
          '<tr><td>jane@x.com</td><td>+1 555</td></tr>' +
          '</table></td></tr></table></td></tr></table>'
      );

      expect(markdown).toBe('| Jane Doe CTO; jane@x.com +1 555 |\n| --- |');
    });

    it('carries an image out of a nested table rather than losing it', () => {
      // A marketing email lays its hero image out in a nested table. Turned
      // into text the picture is lost, and the outer table is then empty
      // enough to be dropped - which empties the whole paste.
      const markdown = convert(
        '<table><tr><td><table><tr><td>' +
          '<img src="https://cdn.example/hero.jpg" alt="Spring sale">' +
          '</td></tr></table></td></tr></table>'
      );

      expect(markdown).toBe(
        '| ![Spring sale](https://cdn.example/hero.jpg) |\n| --- |'
      );
    });

    it('reads a <thead> written after the <tbody> as the header', () => {
      // `table.rows` returns thead rows first whatever the tree order, so the
      // row snapshot has to be taken before the thead is unwrapped. Taken
      // after, the header is emitted as the last data row instead.
      const markdown = convert(
        '<table><tbody><tr><td>Bolt</td><td>12</td></tr></tbody>' +
          '<thead><tr><th>Name</th><th>Qty</th></tr></thead></table>'
      );

      expect(markdown).toBe('| Name | Qty |\n| --- | --- |\n| Bolt | 12 |');
    });

    it('ignores a non-cell element sitting inside a row', () => {
      // The plugin writes one delimiter cell per child node of the header
      // row, so a stray element desynchronises the delimiter and GFM then
      // rejects the whole table. A hidden input is one of the few things the
      // parser leaves inside a <tr> - <style> is dropped an earlier pass.
      const markdown = convert(
        '<table><tr><input type="hidden" name="rowId"><td>A</td>' +
          '<td>B</td></tr><tr><td>1</td><td>2</td></tr></table>'
      );

      expect(markdown).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |');
    });

    it('lifts every caption, not only the first', () => {
      const markdown = convert(
        '<table><caption>C1</caption><caption>C2</caption>' +
          '<tr><td>A</td></tr><tr><td>1</td></tr></table>'
      );

      expect(markdown).toBe('C1\n\nC2\n\n| A |\n| --- |\n| 1 |');
    });

    it('drops an empty table instead of throwing', () => {
      expect(convert('<p>before</p><table></table><p>after</p>')).toBe(
        'before\n\nafter'
      );
    });
  });

  describe('application quirks', () => {
    it('unwraps the non-bold <b> Google Docs wraps everything in', () => {
      // Google Docs prefixes every copy with
      // <b style="font-weight:normal" id="docs-internal-guid-...">, which
      // converts to a pair of stray ** around the whole paste.
      const markdown = convert(
        '<b style="font-weight:normal" id="docs-internal-guid-x">' +
          '<p>Hello world</p><p>Second</p></b>'
      );

      expect(markdown).toBe('Hello world\n\nSecond');
    });

    it('still converts a genuine <b> to bold', () => {
      expect(convert('<p>a <b>bold</b> c</p>')).toBe('a **bold** c');
    });

    it('unwraps a link that wraps block content, keeping the content', () => {
      // A card or tile from a documentation or news site. Markdown has no
      // link around a heading, and turndown emits one as a literal [ and
      // ](url) that render as text. The content outweighs the address.
      const markdown = convert(
        '<a href="https://e.com/post"><div><h3>Headline</h3>' +
          '<p>Teaser text</p></div></a>'
      );

      expect(markdown).toBe('### Headline\n\nTeaser text');
    });

    it('keeps a table that a link wraps, rather than dropping both', () => {
      // A linked data table from a CMS or a marketing email. Reparenting the
      // anchor into the table would leave the rows outside a table section
      // and take the whole table with it.
      const markdown = convert(
        '<a href="https://e.com/report"><table><tr><td>Region</td>' +
          '<td>Sales</td></tr><tr><td>North</td><td>100</td></tr>' +
          '</table></a>'
      );

      expect(markdown).toBe(
        '| Region | Sales |\n| --- | --- |\n| North | 100 |'
      );
    });

    it('leaves an ordinary inline link alone', () => {
      expect(convert('<p>see <a href="https://e.com">site</a> now</p>')).toBe(
        'see [site](https://e.com) now'
      );
    });
  });

  describe('images', () => {
    it('keeps an http image', () => {
      expect(convert('<img src="https://example.com/a.png" alt="A">')).toBe(
        '![A](https://example.com/a.png)'
      );
    });

    it('keeps an image title when one is present', () => {
      expect(
        convert('<img src="https://example.com/a.png" alt="A" title="T">')
      ).toBe('![A](https://example.com/a.png "T")');
    });

    it('defaults a missing alt to an empty label', () => {
      expect(convert('<img src="https://example.com/a.png">')).toBe(
        '![](https://example.com/a.png)'
      );
    });

    it('keeps a data-uri image', () => {
      expect(convert('<img src="data:image/png;base64,iVBORw0K" alt="">')).toBe(
        '![](data:image/png;base64,iVBORw0K)'
      );
    });

    it('keeps a protocol-relative image, which still resolves', () => {
      expect(convert('<img src="//cdn.example.com/a.png" alt="A">')).toBe(
        '![A](//cdn.example.com/a.png)'
      );
    });

    it('escapes a source that would otherwise break the link', () => {
      expect(convert('<img src="https://x.com/a b (1).png" alt="A">')).toBe(
        '![A](<https://x.com/a b \\(1\\).png>)'
      );
    });

    it('drops a file:// image, which cannot resolve for the reader', () => {
      const wordImage =
        '<p>Before<img src="file:///C:/Users/x/AppData/Local/Temp/' +
        'msohtmlclip1/01/clip_image001.png">After</p>';

      const markdown = convert(wordImage);

      expect(markdown).toBe('BeforeAfter');
      expect(markdown).not.toContain('file:///');
    });

    it('drops the link around a dropped image rather than emitting []()', () => {
      // An Outlook signature is a file:// logo wrapped in a company link.
      expect(
        convert(
          '<a href="https://example.com"><img src="file:///C:/tmp/logo.png" alt="logo"></a>'
        )
      ).toBe('');
    });
  });

  describe('formatting', () => {
    it('uses ATX headings', () => {
      expect(convert('<h2>Title</h2>')).toBe('## Title');
    });

    it('uses dashes for bullet lists', () => {
      const markdown = convert('<ul><li>one</li><li>two</li></ul>');

      expect(markdown.split('\n')).toEqual(['-   one', '-   two']);
    });

    it('uses hashes, not underlines, for a level-1 heading', () => {
      expect(convert('<h1>Top</h1>')).toBe('# Top');
    });

    it('uses fenced code blocks', () => {
      expect(convert('<pre><code>x = 1</code></pre>')).toBe('```\nx = 1\n```');
    });

    it('renders <br> as a hard line break', () => {
      expect(convert('<p>one<br>two</p>')).toBe('one  \ntwo');
    });

    it('uses asterisks for emphasis', () => {
      expect(convert('<em>a</em> and <strong>b</strong>')).toBe(
        '*a* and **b**'
      );
    });

    it('leaves a bracketed URL as a working autolink', () => {
      // The RFC-style <https://...> convention. Escaping the angle bracket
      // would leave a link whose href carries the closing bracket as %3E.
      expect(convert('<p>See &lt;https://example.com&gt; now</p>')).toBe(
        'See <https://example.com> now'
      );
    });

    it('escapes a tag name written as text, which would render as nothing', () => {
      // A mail-merge template or a row of an HTML reference table. Markdown
      // treats an unescaped <p> as live markup, so the value disappears when
      // the cell renders - with no error to say it went.
      expect(convert('<p>Dear &lt;Name&gt;,</p>')).toBe('Dear \\<Name>,');
      expect(convert('<p>use <code>a &lt; b</code> here</p>')).toBe(
        'use `a < b` here'
      );
    });

    it('preserves link text and href', () => {
      expect(convert('<a href="https://example.com">site</a>')).toBe(
        '[site](https://example.com)'
      );
    });
  });

  describe('content that converts to nothing', () => {
    // The command falls back to the plain-text clipboard flavour when the
    // HTML conversion is blank, so these must convert to an empty string
    // rather than to whitespace or markup.
    it("converts Chrome's bare fragment wrapper to an empty string", () => {
      expect(
        convert('<meta charset=\'utf-8\'><span style="color:red"></span>')
      ).toBe('');
    });

    it('converts a style-only document to an empty string', () => {
      expect(
        convert('<html><head><style>p{margin:0}</style></head></html>')
      ).toBe('');
    });
  });
});
