/**
 * Clipboard reading.
 *
 * Kept free of any JupyterLab import so it can be unit tested against a plain
 * jsdom navigator, the same reason `turndown.ts` is separate.
 */

const LOG_PREFIX = '[paste-as-markdown]';

/**
 * Outcome of a clipboard read. The failure modes are kept apart because only
 * some of them are actionable by the user, and they need different advice.
 */
export type ClipboardResult =
  | { kind: 'html'; html: string }
  | { kind: 'text'; text: string }
  | { kind: 'empty' }
  | { kind: 'unavailable' }
  | { kind: 'denied' }
  | { kind: 'failed'; message: string };

/**
 * Map a thrown clipboard error onto a distinct result, or null when the error
 * only means "this API is not supported here" and a fallback should be tried.
 */
function classifyClipboardError(err: unknown): ClipboardResult | null {
  const name = (err as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { kind: 'denied' };
  }
  return null;
}

/**
 * True when the browser exposes a usable Clipboard API. The whole API is
 * absent outside a secure context, which is the common case for JupyterLab
 * served over plain HTTP on a LAN address.
 */
function clipboardAvailable(): boolean {
  return !!navigator.clipboard && window.isSecureContext;
}

/**
 * Read the plain-text clipboard flavour.
 */
export async function readClipboardText(): Promise<ClipboardResult> {
  try {
    const text = await navigator.clipboard.readText();
    return text ? { kind: 'text', text } : { kind: 'empty' };
  } catch (err) {
    console.warn(`${LOG_PREFIX} Clipboard readText failed:`, err);
    return (
      classifyClipboardError(err) ?? {
        kind: 'failed',
        message: err instanceof Error ? err.message : String(err)
      }
    );
  }
}

/**
 * Read the clipboard, preferring the HTML flavour and falling back to plain
 * text when no HTML is offered or when `read()` is unsupported.
 */
export async function readClipboard(): Promise<ClipboardResult> {
  if (!clipboardAvailable()) {
    return { kind: 'unavailable' };
  }

  if (typeof navigator.clipboard.read === 'function') {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          return { kind: 'html', html: await blob.text() };
        }
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} Clipboard read failed:`, err);
      const classified = classifyClipboardError(err);
      if (classified) {
        return classified;
      }
      // read() is unsupported here - fall through to the text flavour.
    }
  }

  return readClipboardText();
}

/**
 * The message shown for a clipboard result that carries no content.
 */
export function clipboardErrorMessage(result: ClipboardResult): string {
  switch (result.kind) {
    case 'unavailable':
      return (
        'Clipboard access requires a secure context. Serve JupyterLab over ' +
        'HTTPS, or reach it on localhost, and try again.'
      );
    case 'denied':
      // Browsers raise the same error for a withheld permission and for a
      // document that does not have focus, so the advice has to cover both.
      return (
        'The browser would not allow the clipboard to be read. Check that ' +
        'this tab has focus and that clipboard access is permitted for the ' +
        'site, then try again.'
      );
    case 'failed':
      return `Could not read the clipboard: ${result.message}`;
    default:
      return 'No content available on the clipboard.';
  }
}
