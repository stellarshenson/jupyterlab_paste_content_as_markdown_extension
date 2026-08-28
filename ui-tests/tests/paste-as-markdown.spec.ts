import { expect, test } from '@jupyterlab/galata';
import type { Page } from '@playwright/test';

/**
 * End-to-end coverage for the "Paste as Markdown" command.
 *
 * These tests drive the real clipboard, so the browser context needs explicit
 * clipboard permissions. JupyterLab is served from localhost here, which
 * counts as a secure context, so the Clipboard API is available.
 */
test.use({
  contextOptions: {
    permissions: ['clipboard-read', 'clipboard-write']
  }
});

const COMMAND_ID = 'paste-as-markdown:paste';
const LABEL = 'Paste as Markdown';

/** Put one or more flavours on the clipboard, keyed by MIME type. */
async function writeToClipboard(
  page: Page,
  flavours: Record<string, string>
): Promise<void> {
  await page.evaluate(async contents => {
    const blobs: Record<string, Blob> = {};
    for (const [type, value] of Object.entries(contents)) {
      blobs[type] = new Blob([value], { type });
    }
    await navigator.clipboard.write([new ClipboardItem(blobs)]);
  }, flavours);
}

/** Put HTML on the clipboard as the `text/html` flavour. */
async function writeHtmlToClipboard(page: Page, html: string): Promise<void> {
  await writeToClipboard(page, { 'text/html': html });
}

/** Open a new text file and wait for its editor. */
async function openTextFile(page: Page): Promise<void> {
  await page.evaluate(() =>
    (window as any).jupyterapp.commands.execute('fileeditor:create-new')
  );
  await page.locator('.jp-FileEditor .cm-content').waitFor();
}

/**
 * Create and open a notebook, then wait for its first input area.
 *
 * Galata's own `notebook.createNew()` blocks on a kernel-selection dialog,
 * which does not appear on every kernel configuration. Going through the
 * contents API and dismissing any dialog that does appear keeps this
 * independent of how kernels are set up.
 */
async function openNotebook(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = (window as any).jupyterapp;
    const model = await app.serviceManager.contents.newUntitled({
      path: '',
      type: 'notebook'
    });
    await app.commands.execute('docmanager:open', { path: model.path });
  });

  const inputArea = page.locator('.jp-Notebook .jp-InputArea-editor').first();
  const acceptDialog = page.locator('.jp-Dialog .jp-mod-accept');

  // Whichever appears first wins; the loser keeps waiting until its own
  // timeout, so its rejection has to be absorbed rather than left unhandled.
  await Promise.race([
    inputArea.waitFor(),
    acceptDialog.waitFor().then(
      () => acceptDialog.click(),
      () => undefined
    )
  ]);

  await inputArea.waitFor();
}

/** The source text of the currently focused document. */
async function currentSource(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (
        window as any
      ).jupyterapp.shell.currentWidget.content.model.sharedModel.getSource() as string
  );
}

/**
 * The source of the notebook's active cell.
 *
 * A notebook's own shared model serialises the whole `.ipynb`, so asserting
 * on it would pass on a paste that landed anywhere in the file.
 */
async function activeCellSource(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (
        window as any
      ).jupyterapp.shell.currentWidget.content.activeCell.model.sharedModel.getSource() as string
  );
}

/**
 * Fire the extension's command without waiting on its promise.
 *
 * The command awaits `showErrorMessage`, which only settles once the user
 * dismisses the dialog, so awaiting the command here would deadlock against
 * any assertion about that dialog. Callers assert the observable effect
 * instead.
 */
async function pasteAsMarkdown(page: Page): Promise<void> {
  await page.evaluate(id => {
    void (window as any).jupyterapp.commands.execute(id);
  }, COMMAND_ID);
}

/** Labels of the currently open context menu, in display order. */
async function contextMenuLabels(page: Page): Promise<string[]> {
  await page.locator('.lm-Menu').first().waitFor();
  return page
    .locator('.lm-Menu-content > .lm-Menu-item .lm-Menu-itemLabel')
    .allInnerTexts();
}

/**
 * The label core gives one of its own commands.
 *
 * Read from the registry rather than hard-coded, so the ordering assertions
 * do not break when JupyterLab rewords a menu item.
 */
async function commandLabel(page: Page, id: string): Promise<string> {
  return page.evaluate(
    commandId => (window as any).jupyterapp.commands.label(commandId) as string,
    id
  );
}

test.describe('Paste as Markdown', () => {
  test('converts Word-style HTML without leaking its stylesheet', async ({
    page
  }) => {
    // Word and Outlook ship a <style> block ahead of the copied text. Turndown
    // has no rule for <style>, so an unconfigured service emits its CSS as
    // document text.
    await writeHtmlToClipboard(
      page,
      '<style><!-- p.MsoNormal {margin:0cm; font-family:"Calibri",sans-serif;} --></style>' +
        '<p>Hello <b>world</b></p>'
    );

    await openTextFile(page);
    await pasteAsMarkdown(page);

    await expect.poll(() => currentSource(page)).toContain('Hello **world**');

    const source = await currentSource(page);
    expect(source).not.toContain('MsoNormal');
    expect(source).not.toContain('font-family');
  });

  test('converts a spreadsheet table rather than pasting its markup', async ({
    page
  }) => {
    // The shape a spreadsheet actually puts on the clipboard: a <colgroup>
    // ahead of the rows, no <th> anywhere, and inline styles throughout.
    await writeHtmlToClipboard(
      page,
      '<table style="border-collapse:collapse"><colgroup><col width="96">' +
        '<col width="96"></colgroup><tbody>' +
        '<tr><td>Name</td><td>Qty</td></tr>' +
        '<tr><td>Bolt</td><td align="right">12</td></tr></tbody></table>'
    );

    await openTextFile(page);
    await pasteAsMarkdown(page);

    await expect.poll(() => currentSource(page)).toContain('| Name | Qty |');

    const source = await currentSource(page);
    expect(source).toContain('| Bolt | 12 |');
    expect(source).not.toContain('<table');
    expect(source).not.toContain('border-collapse');
  });

  test('replaces the selection rather than inserting beside it', async ({
    page
  }) => {
    await writeHtmlToClipboard(page, '<p>NEW</p>');

    await openTextFile(page);

    const editor = page.locator('.jp-FileEditor .cm-content');
    await editor.click();
    await page.keyboard.type('REPLACE ME');
    await page.keyboard.press('Control+a');

    await pasteAsMarkdown(page);

    await expect
      .poll(async () => (await currentSource(page)).trim())
      .toBe('NEW');
  });

  test('offers the command directly below Paste in a file editor', async ({
    page
  }) => {
    await openTextFile(page);

    await page.locator('.jp-FileEditor .cm-content').click({ button: 'right' });

    const labels = await contextMenuLabels(page);
    const pasteIndex = labels.indexOf(
      await commandLabel(page, 'fileeditor:paste')
    );

    expect(pasteIndex).toBeGreaterThan(-1);
    expect(labels.indexOf(LABEL)).toBe(pasteIndex + 1);
  });

  test('pastes when the menu item itself is clicked', async ({ page }) => {
    // Every other test calls `commands.execute`, which never consults
    // `isEnabled`. Only clicking the item exercises the path a user takes.
    await writeHtmlToClipboard(page, '<h2>Clicked</h2>');

    await openTextFile(page);
    await page.locator('.jp-FileEditor .cm-content').click({ button: 'right' });
    await page.locator('.lm-Menu-item', { hasText: LABEL }).first().click();

    await expect.poll(() => currentSource(page)).toContain('## Clicked');
  });

  test('pastes into a notebook cell', async ({ page }) => {
    test.slow();
    await openNotebook(page);

    await writeHtmlToClipboard(page, '<p>In a <b>cell</b></p>');
    await pasteAsMarkdown(page);

    await expect.poll(() => activeCellSource(page)).toContain('In a **cell**');
  });

  test('offers the command directly below Paste in a notebook input area', async ({
    page
  }) => {
    test.slow();
    await openNotebook(page);

    await page
      .locator('.jp-Notebook .jp-InputArea-editor')
      .first()
      .click({ button: 'right' });

    const labels = await contextMenuLabels(page);
    const pasteIndex = labels.indexOf(
      await commandLabel(page, 'notebook:paste-text')
    );

    expect(pasteIndex).toBeGreaterThan(-1);
    expect(labels.indexOf(LABEL)).toBe(pasteIndex + 1);
  });

  test('pastes into a notebook cell when the menu item is clicked', async ({
    page
  }) => {
    // The notebook is a separate registration with its own selector and rank,
    // so the file-editor click test does not cover it.
    test.slow();
    await openNotebook(page);
    await writeHtmlToClipboard(page, '<p>Clicked <b>here</b></p>');

    await page
      .locator('.jp-Notebook .jp-InputArea-editor')
      .first()
      .click({ button: 'right' });
    await page.locator('.lm-Menu-item', { hasText: LABEL }).first().click();

    await expect
      .poll(() => activeCellSource(page))
      .toContain('Clicked **here**');
  });

  test('stays out of the menu on a rendered markdown cell', async ({
    page
  }) => {
    // The selector is the input area, not the cell: a rendered markdown cell
    // has no live cursor for the paste to land at.
    test.slow();
    await openNotebook(page);

    await page.evaluate(async () => {
      const commands = (window as any).jupyterapp.commands;
      await commands.execute('notebook:change-cell-to-markdown');
      await commands.execute('notebook:run-all-cells');
    });
    const rendered = page.locator('.jp-MarkdownCell .jp-RenderedMarkdown');
    await rendered.first().waitFor();

    await rendered.first().click({ button: 'right' });

    expect(await contextMenuLabels(page)).not.toContain(LABEL);
  });

  test('pastes plain text when the clipboard offers no HTML', async ({
    page
  }) => {
    await writeToClipboard(page, { 'text/plain': 'just text' });

    await openTextFile(page);
    await pasteAsMarkdown(page);

    await expect
      .poll(async () => (await currentSource(page)).trim())
      .toBe('just text');
  });

  test('falls back to plain text when the HTML converts to nothing', async ({
    page
  }) => {
    // Chrome's bare fragment wrapper converts to an empty string, but the
    // plain-text flavour beside it still carries the content.
    await writeToClipboard(page, {
      'text/html': '<meta charset="utf-8"><span style="color:red"></span>',
      'text/plain': 'fallback content'
    });

    await openTextFile(page);
    await pasteAsMarkdown(page);

    await expect
      .poll(async () => (await currentSource(page)).trim())
      .toBe('fallback content');
  });

  test('reports an empty clipboard instead of pasting nothing', async ({
    page
  }) => {
    // HTML that converts to no markdown at all, with no plain-text flavour to
    // fall back on, must raise a dialog rather than silently doing nothing.
    await writeHtmlToClipboard(page, '<span style="color:red"></span>');

    await openTextFile(page);
    await pasteAsMarkdown(page);

    await expect(page.locator('.jp-Dialog')).toBeVisible();
    await expect(page.locator('.jp-Dialog')).toContainText('clipboard');
  });
});
