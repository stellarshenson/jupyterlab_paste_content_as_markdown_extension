import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IEditorTracker } from '@jupyterlab/fileeditor';
import { INotebookTracker } from '@jupyterlab/notebook';
import { showErrorMessage } from '@jupyterlab/apputils';
import TurndownService from 'turndown';

const PLUGIN_ID =
  'jupyterlab_paste_content_as_markdown_extension:plugin';
const COMMAND_ID = 'paste-as-markdown:paste';

/**
 * Create a configured TurndownService instance for HTML-to-markdown conversion.
 */
function createTurndownService(): TurndownService {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
  });

  // Preserve <br> as line breaks
  turndown.addRule('lineBreak', {
    filter: 'br',
    replacement: () => '  \n'
  });

  return turndown;
}

/**
 * Read HTML content from the clipboard.
 * Returns the HTML string, or null if no HTML content is available.
 */
async function readClipboardHtml(): Promise<string | null> {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes('text/html')) {
        const blob = await item.getType('text/html');
        return await blob.text();
      }
    }
  } catch (err) {
    console.warn(`[${PLUGIN_ID}] Clipboard API read failed:`, err);
  }
  return null;
}

/**
 * Read plain text from the clipboard as fallback.
 */
async function readClipboardText(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch (err) {
    console.warn(`[${PLUGIN_ID}] Clipboard readText failed:`, err);
  }
  return null;
}

/**
 * Insert text at the cursor position in a file editor.
 */
function insertInFileEditor(
  editorTracker: IEditorTracker,
  text: string
): boolean {
  const widget = editorTracker.currentWidget;
  if (!widget) {
    return false;
  }

  const editor = widget.content.editor;
  const model = widget.content.model;
  const cursor = editor.getCursorPosition();
  const offset = editor.getOffsetAt(cursor);

  model.sharedModel.updateSource(offset, offset, text);
  return true;
}

/**
 * Insert text at the cursor position in a notebook cell.
 */
function insertInNotebook(
  notebookTracker: INotebookTracker,
  text: string
): boolean {
  const panel = notebookTracker.currentWidget;
  if (!panel) {
    return false;
  }

  const activeCell = panel.content.activeCell;
  if (!activeCell) {
    return false;
  }

  const editor = activeCell.editor;
  if (!editor) {
    return false;
  }

  const cursor = editor.getCursorPosition();
  const offset = editor.getOffsetAt(cursor);
  const currentText = activeCell.model.sharedModel.getSource();

  activeCell.model.sharedModel.setSource(
    currentText.slice(0, offset) + text + currentText.slice(offset)
  );
  return true;
}

/**
 * Initialization data for the jupyterlab_paste_content_as_markdown_extension extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description:
    'JupyterLab extension to paste clipboard content (HTML, formatted text) as markdown into text editors and notebook cells',
  autoStart: true,
  optional: [IEditorTracker, INotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    editorTracker: IEditorTracker | null,
    notebookTracker: INotebookTracker | null
  ) => {
    console.log(
      'JupyterLab extension jupyterlab_paste_content_as_markdown_extension is activated!'
    );

    const turndown = createTurndownService();

    app.commands.addCommand(COMMAND_ID, {
      label: 'Paste as Markdown',
      caption: 'Paste clipboard content converted to markdown',
      execute: async () => {
        // Try HTML first, fall back to plain text
        const html = await readClipboardHtml();
        let markdown: string;

        if (html) {
          markdown = turndown.turndown(html);
        } else {
          const text = await readClipboardText();
          if (!text) {
            await showErrorMessage(
              'Paste as Markdown',
              'No content available on the clipboard.'
            );
            return;
          }
          markdown = text;
        }

        // Determine active context and insert
        const currentWidget = app.shell.currentWidget;

        if (
          notebookTracker?.currentWidget &&
          currentWidget === notebookTracker.currentWidget
        ) {
          if (!insertInNotebook(notebookTracker, markdown)) {
            await showErrorMessage(
              'Paste as Markdown',
              'No active notebook cell to paste into.'
            );
          }
          return;
        }

        if (
          editorTracker?.currentWidget &&
          currentWidget === editorTracker.currentWidget
        ) {
          if (!insertInFileEditor(editorTracker, markdown)) {
            await showErrorMessage(
              'Paste as Markdown',
              'No active editor to paste into.'
            );
          }
          return;
        }

        await showErrorMessage(
          'Paste as Markdown',
          'No active editor or notebook cell found.'
        );
      }
    });

    // Register context menu items
    if (editorTracker) {
      app.contextMenu.addItem({
        command: COMMAND_ID,
        selector: '.jp-FileEditor',
        rank: 3
      });
    }

    if (notebookTracker) {
      app.contextMenu.addItem({
        command: COMMAND_ID,
        selector: '.jp-Cell .jp-InputArea-editor',
        rank: 3
      });
    }

    console.log(`[${PLUGIN_ID}] Paste as Markdown command registered`);
  }
};

export default plugin;
