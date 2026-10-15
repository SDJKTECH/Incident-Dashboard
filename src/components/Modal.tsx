import { useEffect, useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Element to focus on open; defaults to the first focusable element in the dialog. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children, initialFocusRef }: ModalProps): JSX.Element {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const backdrop = backdropRef.current;
    if (!dialog || !backdrop) return undefined;

    const focusables = (): HTMLElement[] =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
    (initialFocusRef?.current ?? focusables()[0] ?? dialog).focus();

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    const onBackdropClick = (e: MouseEvent): void => {
      if (e.target === backdrop) onCloseRef.current();
    };

    document.addEventListener('keydown', onKeyDown);
    backdrop.addEventListener('click', onBackdropClick);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      backdrop.removeEventListener('click', onBackdropClick);
      previous?.focus();
    };
  }, [initialFocusRef]);

  return (
    <div
      ref={backdropRef}
      data-testid="modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg bg-white p-4 shadow-xl focus:outline-none sm:p-6"
      >
        <h2 id={titleId} className="mb-4 text-xl font-bold text-gray-900">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
