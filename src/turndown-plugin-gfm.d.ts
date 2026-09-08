/**
 * Minimal type declarations for `turndown-plugin-gfm`, which ships no types.
 * Only the plugins this extension uses are declared.
 */
declare module 'turndown-plugin-gfm' {
  import TurndownService from 'turndown';
  export const strikethrough: TurndownService.Plugin;
  export const tables: TurndownService.Plugin;
  export const taskListItems: TurndownService.Plugin;
}
