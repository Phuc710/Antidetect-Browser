/**
 * Reusable portal-based Tooltip component.
 *
 * - Renders via ReactDOM.createPortal → never clipped by table overflow or sticky columns.
 * - Positions itself above the trigger by default; auto-flips when near viewport edge.
 * - 250ms show delay / 80ms hide delay to prevent flicker.
 * - Supports 3 variants: compact | multiline | content.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

export type TooltipVariant = 'compact' | 'multiline' | 'content';
export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** The content to show inside the tooltip bubble */
  content: ReactNode;
  /** Visual variant — controls whitespace, max-width, alignment */
  variant?: TooltipVariant;
  /** Preferred placement (auto-flips when insufficient space) */
  placement?: TooltipPlacement;
  /** The trigger element */
  children: ReactNode;
  /** Delay in ms before the tooltip appears (default 250) */
  showDelay?: number;
  /** Delay in ms before the tooltip hides (default 80) */
  hideDelay?: number;
  /** Extra class on the wrapper span */
  className?: string;
  /** Disable tooltip entirely */
  disabled?: boolean;
}

interface TooltipPos {
  top: number;
  left: number;
  actualPlacement: TooltipPlacement;
}

const VIEWPORT_PAD = 8; // px gap from viewport edge

function computePosition(
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  preferred: TooltipPlacement,
  gap = 8,
): TooltipPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Try preferred placement first, then opposite vertical/horizontal, then others
  const placements: TooltipPlacement[] = [
    preferred,
    preferred === 'top' ? 'bottom' : preferred === 'bottom' ? 'top' : preferred === 'left' ? 'right' : 'left',
    'top',
    'bottom',
  ];
  const unique = [...new Set(placements)];

  for (const placement of unique) {
    let top = 0;
    let left = 0;

    if (placement === 'top') {
      top = triggerRect.top - tooltipRect.height - gap;
      left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    } else if (placement === 'bottom') {
      top = triggerRect.bottom + gap;
      left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    } else if (placement === 'left') {
      top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
      left = triggerRect.left - tooltipRect.width - gap;
    } else {
      top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
      left = triggerRect.right + gap;
    }

    const clampedLeft = Math.min(Math.max(left, VIEWPORT_PAD), vw - tooltipRect.width - VIEWPORT_PAD);
    const clampedTop = Math.min(Math.max(top, VIEWPORT_PAD), vh - tooltipRect.height - VIEWPORT_PAD);

    // Vertical placements ('top' / 'bottom') only require vertical clearance; horizontal fits via clamping
    const fitsVertically =
      placement === 'top'
        ? top >= VIEWPORT_PAD
        : placement === 'bottom'
        ? top + tooltipRect.height <= vh - VIEWPORT_PAD
        : top >= VIEWPORT_PAD && top + tooltipRect.height <= vh - VIEWPORT_PAD;

    const fitsHorizontally =
      placement === 'left'
        ? left >= VIEWPORT_PAD
        : placement === 'right'
        ? left + tooltipRect.width <= vw - VIEWPORT_PAD
        : true; // clamped horizontally

    if ((fitsVertically && fitsHorizontally) || placement === unique[unique.length - 1]) {
      return { top: clampedTop, left: clampedLeft, actualPlacement: placement };
    }
  }

  return {
    top: Math.max(VIEWPORT_PAD, triggerRect.top - tooltipRect.height - gap),
    left: Math.min(Math.max(triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2, VIEWPORT_PAD), vw - tooltipRect.width - VIEWPORT_PAD),
    actualPlacement: 'top',
  };
}

export function Tooltip({
  content,
  variant = 'compact',
  placement = 'top',
  children,
  showDelay = 250,
  hideDelay = 80,
  className,
  disabled = false,
}: TooltipProps): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<TooltipPos | null>(null);
  const [actualPlacement, setActualPlacement] = useState<TooltipPlacement>(placement);

  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = (): void => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  };

  const scheduleShow = useCallback((): void => {
    if (disabled || !content) return;
    clearTimers();
    showTimerRef.current = setTimeout(() => {
      setVisible(true);
    }, showDelay);
  }, [disabled, content, showDelay]);

  const scheduleHide = useCallback((): void => {
    clearTimers();
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
    }, hideDelay);
  }, [hideDelay]);

  // Reposition when visible
  useLayoutEffect(() => {
    if (!visible || !wrapperRef.current || !tooltipRef.current) return;
    const triggerEl = (wrapperRef.current.firstElementChild as HTMLElement | null) ?? wrapperRef.current;
    const triggerRect = triggerEl.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const computed = computePosition(triggerRect, tooltipRect, placement);
    setPos(computed);
    setActualPlacement(computed.actualPlacement);
  }, [visible, placement, content]);

  // Hide on scroll / resize
  useEffect(() => {
    if (!visible) return;
    const hide = (): void => setVisible(false);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide, true);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide, true);
    };
  }, [visible]);

  // Hide on Escape
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setVisible(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible]);

  useEffect(() => () => clearTimers(), []);

  const tooltipStyle: CSSProperties = pos
    ? { top: pos.top, left: pos.left, opacity: 1, transform: 'translateY(0)' }
    : { top: -9999, left: -9999, opacity: 0, transform: 'translateY(2px)' };

  const tooltipEl = (
    <div
      ref={tooltipRef}
      className={`ui-tooltip ui-tooltip--${variant} ui-tooltip--${actualPlacement}`}
      style={tooltipStyle}
      role="tooltip"
      aria-hidden={!visible}
    >
      {content}
    </div>
  );

  return (
    <span
      ref={wrapperRef}
      className={`ui-tooltip-trigger${className ? ` ${className}` : ''}`}
      onMouseEnter={scheduleShow}
      onMouseLeave={scheduleHide}
      onFocus={scheduleShow}
      onBlur={scheduleHide}
    >
      {children}
      {visible && createPortal(tooltipEl, document.body)}
    </span>
  );
}
