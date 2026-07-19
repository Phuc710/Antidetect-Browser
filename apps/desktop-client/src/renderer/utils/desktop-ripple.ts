/**
 * Strict Component-Scoped Desktop Soft Ripple Effect
 * Only applies to intentional interactive controls (buttons, menu items, tabs, chips).
 * Never overflows outside the component boundary.
 */

// Strict list of allowed interactive control selectors
const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="option"]',
  '.button',
  '.sidebar__link',
  '.sidebar__footer-link',
  '.sidebar__brand-container',
  '.sidebar__create-btn',
  '.sidebar__upgrade-btn',
  '.sidebar__trial-button',
  '.prow-tag-btn',
  '.row-icon-button',
  '.prow-icon-btn',
  '.ptoolbar__action-btn',
  '.ptoolbar__icon-btn',
  '.pctx__item',
  '.account-popover-item',
  '.account-item',
  '.pheader__tab',
  '.ptab',
  '.pbulk__btn',
  '.pbulk__clear-btn',
  '[data-ripple="true"]',
].join(',');

/**
 * Creates a soft desktop ripple inside an interactive component.
 */
export function createRipple(e: React.MouseEvent<HTMLElement> | MouseEvent, explicitTarget?: HTMLElement): void {
  const target = explicitTarget ?? (e.currentTarget as HTMLElement | null);
  if (!target || !(target instanceof HTMLElement)) return;

  // Skip disabled controls
  if (
    target.hasAttribute('disabled') ||
    target.getAttribute('aria-disabled') === 'true' ||
    target.classList.contains('disabled')
  ) {
    return;
  }

  const rect = target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const maxDim = Math.max(rect.width, rect.height);
  const diameter = maxDim * 2.2;

  const ripple = document.createElement('span');
  ripple.className = 'desktop-ripple';
  ripple.style.width = `${diameter}px`;
  ripple.style.height = `${diameter}px`;
  ripple.style.left = `${x - diameter / 2}px`;
  ripple.style.top = `${y - diameter / 2}px`;

  // Force component relative positioning and overflow clipping
  const compStyle = window.getComputedStyle(target);
  if (compStyle.position === 'static') {
    target.style.position = 'relative';
  }
  target.style.overflow = 'hidden';

  target.appendChild(ripple);

  setTimeout(() => {
    ripple.remove();
  }, 520);
}

export function initDesktopRipple(): () => void {
  const handleMouseDown = (e: MouseEvent) => {
    // Only primary left click
    if (e.button !== 0) return;

    const clickedEl = e.target as HTMLElement | null;
    if (!clickedEl) return;

    // Exclude input, textarea, select
    const clickedTag = clickedEl.tagName.toLowerCase();
    if (clickedTag === 'input' || clickedTag === 'textarea' || clickedTag === 'select') {
      const inputType = (clickedEl as HTMLInputElement).type;
      if (inputType !== 'button' && inputType !== 'submit' && inputType !== 'checkbox' && inputType !== 'radio') {
        return;
      }
    }

    // STRICT MATCH ONLY: find closest interactive control
    const target = clickedEl.closest<HTMLElement>(INTERACTIVE_SELECTOR);
    if (!target) return;

    createRipple(e, target);
  };

  document.addEventListener('mousedown', handleMouseDown, true);
  return () => document.removeEventListener('mousedown', handleMouseDown, true);
}
