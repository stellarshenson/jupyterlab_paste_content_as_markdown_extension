import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the jupyterlab_paste_content_as_markdown_extension extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_paste_content_as_markdown_extension:plugin',
  description: 'Jupyterlab extension to paste contents of the clipboard (e.g. html formatted text or content of docx with formatting) into the text (e.g. text editor, jupyter notebook cell etc)as markdown code. There will be a \'paste as markdown\' item in the context menu below \'paste\' out of the box item',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jupyterlab_paste_content_as_markdown_extension is activated!');
  }
};

export default plugin;
