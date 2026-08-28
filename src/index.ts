import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { showErrorMessage } from '@jupyterlab/apputils';
// Type-only, and deliberately a devDependency: a runtime declaration is
// copied into the shipped labextension manifest and checked against the
// singleton, where the `^4.5.6` pin below would refuse to load on JupyterLab
// 4.0 to 4.4. The pin itself is load-bearing where it is - a wider range
// resolves a second copy of the package alongside the one the trackers hand
// back, and the two are not structurally compatible.
import type { CodeEditor } from '@jupyterlab/codeeditor';
import { IEditorTracker } from '@jupyterlab/fileeditor';
import { INotebookTracker } from '@jupyterlab/notebook';
import { pasteIcon } from '@jupyterlab/ui-components';
import {
  clipboardErrorMessage,
  readClipboard,
  readClipboardText
} from './clipboard';
import { convertHtmlToMarkdown } from './turndown';

const PLUGIN_ID = 'jupyterlab_paste_content_as_markdown_extension:plugin';
const COMMAND_ID = 'paste-as-markdown:paste';

const COMMAND_LABEL = 'Paste as Markdown';

/**
 * The editor a paste would land in, or null when the current widget is
 * neither a file editor nor a notebook with an active cell.
 *
 * `app.shell.currentWidget` is the discriminator core itself uses for its
 * paste commands. Both branches yield a `CodeEditor.IEditor`, which is the
 * shared seam that lets one insertion path serve file editors and notebooks.
 */
function resolveEditor(
  app: JupyterFrontEnd,
  editorTracker: IEditorTracker | null,
  notebookTracker: INotebookTracker | null
): CodeEditor.IEditor | null {
  const current = app.shell.currentWidget;

  const notebook = notebookTracker?.currentWidget;
  if (notebook && current === notebook) {
    return notebook.content.activeCell?.editor ?? null;
  }

  const fileEditor = editorTracker?.currentWidget;
  if (fileEditor && current === fileEditor) {
    return fileEditor.content.editor;
  }

  return null;
}

/**
 * True when the editor can actually take a paste.
 *
 * A notebook cell keeps this option in sync from its own `editable` metadata,
 * which is the case worth guarding: the write goes through the shared model
 * and would otherwise bypass the cell's read-only state. A read-only
 * *document* is not reflected here, matching core's own paste commands.
 */
function canPasteInto(
  editor: CodeEditor.IEditor | null
): editor is CodeEditor.IEditor {
  return !!editor && !editor.getOption('readOnly');
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

    app.commands.addCommand(COMMAND_ID, {
      label: COMMAND_LABEL,
      icon: pasteIcon,
      caption: 'Paste clipboard content converted to markdown',
      isEnabled: () =>
        canPasteInto(resolveEditor(app, editorTracker, notebookTracker)),
      execute: async () => {
        // Resolve the target before awaiting the clipboard: the permission
        // prompt is non-modal, so focus can move while it is open, and the
        // paste must still land where the user invoked it.
        const editor = resolveEditor(app, editorTracker, notebookTracker);
        if (!canPasteInto(editor)) {
          return;
        }

        const clipboard = await readClipboard();
        if (clipboard.kind !== 'html' && clipboard.kind !== 'text') {
          await showErrorMessage(
            COMMAND_LABEL,
            clipboardErrorMessage(clipboard)
          );
          return;
        }

        let markdown =
          clipboard.kind === 'html'
            ? convertHtmlToMarkdown(clipboard.html)
            : clipboard.text;

        // Some clipboard HTML converts to nothing at all - Chrome's bare
        // fragment wrapper, or a Word blank paragraph. Fall back to the plain
        // text flavour rather than silently inserting an empty string.
        if (clipboard.kind === 'html' && !markdown.trim()) {
          const fallback = await readClipboardText();
          if (fallback.kind !== 'text') {
            await showErrorMessage(
              COMMAND_LABEL,
              clipboardErrorMessage(fallback)
            );
            return;
          }
          markdown = fallback.text;
        }

        if (!markdown.trim()) {
          await showErrorMessage(
            COMMAND_LABEL,
            clipboardErrorMessage({ kind: 'empty' })
          );
          return;
        }

        // The document can be closed while the permission prompt is open.
        // Writing through a disposed shared model does not throw, it just
        // drops the text into a detached document.
        if (editor.isDisposed) {
          return;
        }

        editor.replaceSelection?.(markdown);
      }
    });

    // Sit directly below the built-in paste in each context menu.
    // File editor:  fileeditor:paste is rank 5, select-all is 6.
    // Notebook:     notebook:paste-text is rank 3 on the input area.
    // JupyterLab sorts rank globally across selectors, so the fractional
    // ranks order reliably.
    if (editorTracker) {
      app.contextMenu.addItem({
        command: COMMAND_ID,
        selector: '.jp-FileEditor',
        rank: 5.5
      });
    }

    if (notebookTracker) {
      // The input area, not .jp-Cell: the latter is core's selector for cell
      // clipboard operations and also matches outputs, collapsers and
      // rendered markdown, where there is no live cursor to paste at.
      app.contextMenu.addItem({
        command: COMMAND_ID,
        selector: '.jp-Notebook .jp-InputArea-editor',
        rank: 3.5
      });
    }
  }
};

export default plugin;
