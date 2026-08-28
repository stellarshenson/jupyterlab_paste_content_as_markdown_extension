/**
 * Minimal type declarations for `turndown-plugin-gfm`, which ships no types.
 * Only the plugin this extension uses is declared.
 */
declare module 'turndown-plugin-gfm' {
  import TurndownService from 'turndown';
  export const tables: TurndownService.Plugin;
}
