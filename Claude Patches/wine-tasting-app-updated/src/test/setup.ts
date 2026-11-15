import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

if (typeof window !== 'undefined') {
  const hasWorkingStorage = (s: unknown): s is Storage =>
    Boolean(
      s &&
        typeof (s as Storage).getItem === 'function' &&
        typeof (s as Storage).setItem === 'function' &&
        typeof (s as Storage).removeItem === 'function' &&
        typeof (s as Storage).clear === 'function'
    );

  if (!hasWorkingStorage(globalThis.localStorage) || !hasWorkingStorage(window.localStorage)) {
    const store = new Map<string, string>();
    const memoryStorage: Storage = {
      get length() {
        return store.size;
      },
      clear() {
        store.clear();
      },
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null;
      },
      key(index: number) {
        return Array.from(store.keys())[index] ?? null;
      },
      removeItem(key: string) {
        store.delete(key);
      },
      setItem(key: string, value: string) {
        store.set(key, String(value));
      },
    };
    Object.defineProperty(window, 'localStorage', { configurable: true, writable: true, value: memoryStorage });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: memoryStorage });
  }

  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = vi.fn();
  }

  if (typeof HTMLDialogElement !== 'undefined') {
    const proto = HTMLDialogElement.prototype;
    if (typeof proto.showModal !== 'function') {
      proto.showModal = function showModal() {
        this.setAttribute('open', '');
      };
    }
    if (typeof proto.show !== 'function') {
      proto.show = function show() {
        this.setAttribute('open', '');
      };
    }
    if (typeof proto.close !== 'function') {
      proto.close = function close(returnValue?: string) {
        if (typeof returnValue === 'string') {
          this.returnValue = returnValue;
        }
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      };
    }
  }

  if (typeof HTMLElement !== 'undefined') {
    const htmlProto = HTMLElement.prototype as HTMLElement & {
      showPopover?: () => void;
      hidePopover?: () => void;
      togglePopover?: (force?: boolean) => boolean;
    };
    if (typeof htmlProto.showPopover !== 'function') {
      htmlProto.showPopover = function showPopover() {
        this.dataset.popoverOpen = 'true';
      };
    }
    if (typeof htmlProto.hidePopover !== 'function') {
      htmlProto.hidePopover = function hidePopover() {
        delete this.dataset.popoverOpen;
      };
    }
    if (typeof htmlProto.togglePopover !== 'function') {
      htmlProto.togglePopover = function togglePopover(force?: boolean) {
        const isOpen = this.dataset.popoverOpen === 'true';
        const next = typeof force === 'boolean' ? force : !isOpen;
        if (next) {
          this.dataset.popoverOpen = 'true';
        } else {
          delete this.dataset.popoverOpen;
        }
        return next;
      };
    }
  }
}
