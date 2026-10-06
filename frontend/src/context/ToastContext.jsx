import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import ConfirmationDialog from '../components/ConfirmationDialog.jsx';

const ToastContext = createContext(null);
const ConfirmationContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const confirmationQueue = useRef([]);
  const activeConfirmation = useRef(null);
  const toastTimers = useRef(new Map());

  const notify = useCallback((message, type = 'success') => {
    const id = crypto.randomUUID();
    setToasts((items) => [...items, { id, message, type }]);
    const timer = window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
      toastTimers.current.delete(id);
    }, 4200);
    toastTimers.current.set(id, timer);
  }, []);

  useEffect(() => () => {
    toastTimers.current.forEach((timer) => window.clearTimeout(timer));
    toastTimers.current.clear();
    activeConfirmation.current?.resolve(false);
    confirmationQueue.current.forEach((request) => request.resolve(false));
    confirmationQueue.current = [];
  }, []);

  const confirm = useCallback((options) => new Promise((resolve) => {
    const request = { ...options, resolve };
    if (activeConfirmation.current) {
      confirmationQueue.current.push(request);
      return;
    }
    activeConfirmation.current = request;
    setConfirmation(request);
  }), []);

  const resolveConfirmation = useCallback((result) => {
    const active = activeConfirmation.current;
    if (!active) return;

    activeConfirmation.current = null;
    active.resolve(result);
    const next = confirmationQueue.current.shift() || null;
    activeConfirmation.current = next;
    setConfirmation(next);
  }, []);

  const dismissToast = useCallback((id) => {
    const timer = toastTimers.current.get(id);
    if (timer) window.clearTimeout(timer);
    toastTimers.current.delete(id);
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  return (
    <ConfirmationContext.Provider value={confirm}>
      <ToastContext.Provider value={notify}>
        {children}
        <div className="toast-stack" aria-label="Notifications">
          {toasts.map((toast) => (
            <div
              className={`toast toast-${toast.type}`}
              key={toast.id}
              role={toast.type === 'error' ? 'alert' : 'status'}
              aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            >
              <span className="toast-mark" aria-hidden="true">{toast.type === 'error' ? '!' : '✓'}</span>
              <div className="toast-copy">
                <strong>{toast.type === 'error' ? 'Something went wrong' : 'Success'}</strong>
                <span>{toast.message}</span>
              </div>
              <button onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">×</button>
            </div>
          ))}
        </div>
        {confirmation && (
          <ConfirmationDialog
            confirmation={confirmation}
            onResolve={resolveConfirmation}
          />
        )}
      </ToastContext.Provider>
    </ConfirmationContext.Provider>
  );
}

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error('useToast must be used within ToastProvider.');
  return notify;
}

export function useConfirm() {
  const confirm = useContext(ConfirmationContext);
  if (!confirm) throw new Error('useConfirm must be used within ToastProvider.');
  return confirm;
}
