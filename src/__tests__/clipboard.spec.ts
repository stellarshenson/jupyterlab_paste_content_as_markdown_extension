import {
  clipboardErrorMessage,
  readClipboard,
  readClipboardText
} from '../clipboard';

/**
 * The clipboard layer touches nothing but `navigator` and `window`, so it is
 * tested against jsdom with a stubbed Clipboard API.
 */

/** Install a fake `navigator.clipboard`, or remove it when given null. */
function stubClipboard(clipboard: unknown): void {
  Object.defineProperty(navigator, 'clipboard', {
    value: clipboard,
    configurable: true
  });
}

/** Mark the document a secure context, as localhost and HTTPS both are. */
function stubSecureContext(secure: boolean): void {
  Object.defineProperty(window, 'isSecureContext', {
    value: secure,
    configurable: true
  });
}

/** A `ClipboardItem` carrying one flavour. */
function clipboardItem(type: string, contents: string): unknown {
  return {
    types: [type],
    getType: async () => ({ text: async () => contents })
  };
}

function namedError(name: string, message = 'stub'): Error {
  const err = new Error(message);
  err.name = name;
  return err;
}

describe('clipboard', () => {
  beforeEach(() => {
    // The failure paths log, and the noise would drown the test output.
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    stubSecureContext(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    stubClipboard(undefined);
  });

  describe('readClipboardText', () => {
    it('returns the text flavour', async () => {
      stubClipboard({ readText: async () => 'hello' });
      await expect(readClipboardText()).resolves.toEqual({
        kind: 'text',
        text: 'hello'
      });
    });

    it('reports an empty clipboard rather than empty text', async () => {
      stubClipboard({ readText: async () => '' });
      await expect(readClipboardText()).resolves.toEqual({ kind: 'empty' });
    });

    it('reports a denial as such', async () => {
      stubClipboard({
        readText: async () => {
          throw namedError('NotAllowedError');
        }
      });
      await expect(readClipboardText()).resolves.toEqual({ kind: 'denied' });
    });

    it('carries the message of an unclassified failure', async () => {
      stubClipboard({
        readText: async () => {
          throw new TypeError('broken');
        }
      });
      await expect(readClipboardText()).resolves.toEqual({
        kind: 'failed',
        message: 'broken'
      });
    });
  });

  describe('readClipboard', () => {
    it('reports an unavailable API instead of throwing', async () => {
      stubClipboard(undefined);
      await expect(readClipboard()).resolves.toEqual({ kind: 'unavailable' });
    });

    it('prefers the HTML flavour', async () => {
      stubClipboard({
        read: async () => [clipboardItem('text/html', '<p>x</p>')],
        readText: async () => 'x'
      });
      await expect(readClipboard()).resolves.toEqual({
        kind: 'html',
        html: '<p>x</p>'
      });
    });

    it('falls back to text when no HTML flavour is offered', async () => {
      stubClipboard({
        read: async () => [clipboardItem('text/plain', 'x')],
        readText: async () => 'x'
      });
      await expect(readClipboard()).resolves.toEqual({
        kind: 'text',
        text: 'x'
      });
    });

    it('falls back to text when read() is not implemented', async () => {
      // Firefox exposes readText but not read for web content.
      stubClipboard({
        read: async () => {
          throw new TypeError('read is not a function');
        },
        readText: async () => 'x'
      });
      await expect(readClipboard()).resolves.toEqual({
        kind: 'text',
        text: 'x'
      });
    });

    it('reports a denial without retrying the same permission', async () => {
      const readText = jest.fn();
      stubClipboard({
        read: async () => {
          throw namedError('NotAllowedError');
        },
        readText
      });

      await expect(readClipboard()).resolves.toEqual({ kind: 'denied' });
      expect(readText).not.toHaveBeenCalled();
    });
  });

  describe('clipboardErrorMessage', () => {
    it('tells an insecure context what to change', () => {
      expect(clipboardErrorMessage({ kind: 'unavailable' })).toContain('HTTPS');
    });

    it('covers both causes of a denial, since the error cannot tell them apart', () => {
      const message = clipboardErrorMessage({ kind: 'denied' });
      expect(message).toContain('focus');
      expect(message).toContain('permitted');
    });

    it('quotes the underlying message of an unclassified failure', () => {
      expect(clipboardErrorMessage({ kind: 'failed', message: 'boom' })).toBe(
        'Could not read the clipboard: boom'
      );
    });

    it('has one wording for an empty clipboard', () => {
      expect(clipboardErrorMessage({ kind: 'empty' })).toBe(
        'No content available on the clipboard.'
      );
    });
  });
});
