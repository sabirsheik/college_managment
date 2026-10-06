import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

export default function ConfirmationDialog({ confirmation, onResolve }) {
  const cancelButtonRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onResolve(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const buttons = event.currentTarget.querySelectorAll('button:not(:disabled)');
      const firstButton = buttons[0];
      const lastButton = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === firstButton) {
        event.preventDefault();
        lastButton.focus();
      } else if (!event.shiftKey && document.activeElement === lastButton) {
        event.preventDefault();
        firstButton.focus();
      }
    }

    const dialog = dialogRef.current;
    dialog?.addEventListener('keydown', handleKeyDown);
    return () => {
      dialog?.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onResolve]);

  const {
    title = 'Are you sure?',
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    tone = 'default'
  } = confirmation;

  return (
    <div
      className="confirmation-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onResolve(false);
      }}
    >
      <section
        className={`confirmation-dialog confirmation-${tone}`}
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-message"
      >
        <div className="confirmation-icon" aria-hidden="true">
          <Icon name={tone === 'danger' ? 'alertTriangle' : 'shield'} size={26} />
        </div>
        <span className="eyebrow">PLEASE CONFIRM</span>
        <h2 id="confirmation-title">{title}</h2>
        <p id="confirmation-message">{message}</p>
        <div className="confirmation-actions">
          <button
            className="button button-secondary"
            ref={cancelButtonRef}
            onClick={() => onResolve(false)}
          >
            {cancelLabel}
          </button>
          <button
            className={`button ${tone === 'danger' ? 'button-danger' : 'button-primary'}`}
            onClick={() => onResolve(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
