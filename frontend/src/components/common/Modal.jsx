/**
 * Modal dialog (declarative). Restricted to brief critical subtasks with an
 * obvious Cancel. Focus moves into the dialog on open and is restored on
 * close; ESC closes; a minimal focus trap keeps Tab inside the dialog.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon.jsx';

export default function Modal({ open, title, onClose, children, actions = null }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    const initial = dialog && (dialog.querySelector('input, textarea, select, button:not(.btn-icon)') || dialog);
    if (initial instanceof HTMLElement) initial.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab' && dialog) {
        // Minimal focus trap.
        const focusable = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" data-state="open">
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={dialogRef}>
        <div className="modal-heading">
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Close dialog" onClick={onClose}>
            <Icon name="x-lg" />
          </button>
        </div>
        <div>{children}</div>
        {actions ? <div className="form-actions">{actions}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
