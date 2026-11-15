import { useEffect, RefObject } from 'react';

const CONTROL_SELECTOR = 'input, select, textarea';

let globalAnnouncer: HTMLDivElement | null = null;
let announceTimer: ReturnType<typeof setTimeout> | undefined;
let announcedField: Element | null = null;

const getOrCreateAnnouncer = (): HTMLDivElement | null => {
  if (typeof document === 'undefined' || !document.body) return null;
  if (globalAnnouncer && document.body.contains(globalAnnouncer)) {
    return globalAnnouncer;
  }
  const el = document.createElement('div');
  el.setAttribute('aria-live', 'polite');
  el.className = 'visually-hidden';
  el.dataset.formErrorAnnouncer = 'true';
  document.body.appendChild(el);
  globalAnnouncer = el;
  return el;
};

const spokenText = (node: HTMLElement): string => {
  const copy = node.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[aria-hidden="true"]').forEach(n => n.remove());
  copy.querySelectorAll('[role="img"][aria-label]').forEach(n => {
    const label = n.getAttribute('aria-label') || 'Error';
    n.replaceWith(`${label}: `);
  });
  return (copy.textContent || '').replace(/\s+/g, ' ').trim();
};

const linkError = (el: Element, shown: boolean) => {
  const errorId = (el as HTMLElement).dataset?.error;
  if (!errorId) return;
  const ids = (el.getAttribute('aria-describedby') || '')
    .split(/\s+/)
    .filter(id => id && id !== errorId);
  if (shown) ids.push(errorId);
  if (ids.length > 0) {
    el.setAttribute('aria-describedby', ids.join(' '));
  } else {
    el.removeAttribute('aria-describedby');
  }
};

const matchesUserInvalid = (el: HTMLElement, touchedSet: WeakSet<Element>): boolean => {
  try {
    if (el.matches(':user-invalid')) return true;
  } catch {
    // Environments like jsdom or older WebKit may not support :user-invalid in selectors
  }
  if (!touchedSet.has(el)) return false;
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  ) {
    return !el.validity.valid;
  }
  return false;
};

/**
 * Synchronizes `aria-invalid`, dynamic error `aria-describedby`, and fallback classes
 * with native `:user-invalid` timing so errors are announced only after user interaction
 * or an attempted form submission.
 */
export const useFormAriaSync = (
  formRef: RefObject<HTMLFormElement | null>,
  deps: unknown[] = []
) => {
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const flagged = new WeakSet<Element>();
    const announced = new WeakSet<Element>();
    const interacted = new WeakSet<Element>();
    const hasNativeUserInvalid = (() => {
      try {
        return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('selector(:user-invalid)');
      } catch {
        return false;
      }
    })();

    const announceError = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
      const errorId = el.dataset?.error;
      if (!errorId) return;
      const errorEl = document.getElementById(errorId);
      const announcer = getOrCreateAnnouncer();
      if (!errorEl || !announcer) return;

      const labelEl = el.labels?.[0];
      const labelPrefix = labelEl ? `${spokenText(labelEl)}: ` : '';
      if (announceTimer) clearTimeout(announceTimer);
      announcer.textContent = '';
      announcedField = el;
      announceTimer = setTimeout(() => {
        announcer.textContent = labelPrefix + spokenText(errorEl);
      }, 500);
    };

    const syncField = (target: EventTarget | null, announce = false) => {
      if (!(target instanceof HTMLElement) || !target.matches(CONTROL_SELECTOR)) return;
      const field = target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      const isInvalid = matchesUserInvalid(field, interacted);

      if (!hasNativeUserInvalid && interacted.has(field)) {
        field.classList.toggle('user-invalid-fallback', isInvalid);
        field.closest('.field-group')?.classList.toggle('has-error-fallback', isInvalid);
      }

      if (isInvalid) {
        if (announce && !announced.has(field)) {
          announceError(field);
          announced.add(field);
        }
        field.setAttribute('aria-invalid', 'true');
        linkError(field, true);
        flagged.add(field);
      } else if (flagged.has(field) || field.getAttribute('aria-invalid') !== 'true') {
        field.setAttribute('aria-invalid', 'false');
        linkError(field, false);
        flagged.delete(field);
        announced.delete(field);
        field.classList.remove('user-invalid-fallback');
        field.closest('.field-group')?.classList.remove('has-error-fallback');
        if (announcedField === field && globalAnnouncer) {
          if (announceTimer) clearTimeout(announceTimer);
          globalAnnouncer.textContent = '';
        }
      }
    };

    form.querySelectorAll(CONTROL_SELECTOR).forEach(el => {
      if (!el.hasAttribute('aria-invalid')) {
        el.setAttribute('aria-invalid', 'false');
      }
      syncField(el, false);
    });

    const onBlur = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement && e.target.matches(CONTROL_SELECTOR)) {
        interacted.add(e.target);
      }
      syncField(e.target, true);
    };
    const onInput = (e: Event) => {
      if (e.target instanceof HTMLElement && e.target.hasAttribute('aria-invalid')) {
        syncField(e.target, false);
      }
    };
    const onChange = (e: Event) => {
      if (e.target instanceof HTMLElement && e.target.matches(CONTROL_SELECTOR)) {
        interacted.add(e.target);
      }
      syncField(e.target, true);
    };
    const onInvalid = (e: Event) => {
      if (e.target instanceof HTMLElement && e.target.matches(CONTROL_SELECTOR)) {
        interacted.add(e.target);
        announced.add(e.target);
        syncField(e.target, false);
      }
    };
    const onReset = () => {
      setTimeout(() => {
        Array.from(form.elements).forEach(el => {
          interacted.delete(el);
          syncField(el, false);
        });
      });
    };

    form.addEventListener('blur', onBlur, true);
    form.addEventListener('input', onInput);
    form.addEventListener('change', onChange, true);
    form.addEventListener('invalid', onInvalid, true);
    form.addEventListener('reset', onReset, true);

    return () => {
      form.removeEventListener('blur', onBlur, true);
      form.removeEventListener('input', onInput);
      form.removeEventListener('change', onChange, true);
      form.removeEventListener('invalid', onInvalid, true);
      form.removeEventListener('reset', onReset, true);
    };
  }, [formRef, ...deps]);
};
