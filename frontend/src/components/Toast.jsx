/**
 * SmartPark - toast notifications (entry / exit / navigation feedback).
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { IconCheckCircle, IconAlert, IconInfo } from '../data/icons.jsx';

const ToastContext = createContext(null);

let seq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast) => {
      seq += 1;
      const id = `t${seq}`;
      const item = { id, tone: 'info', ttl: 5000, ...toast };
      setToasts((list) => [...list.slice(-3), item]);
      if (item.ttl > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), item.ttl),
        );
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      push,
      dismiss,
      success: (title, message) => push({ tone: 'ok', title, message }),
      error: (title, message) => push({ tone: 'err', title, message, ttl: 7000 }),
      info: (title, message) => push({ tone: 'info', title, message }),
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-host">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`} onClick={() => dismiss(t.id)} role="status">
            <span className="ti">
              {t.tone === 'ok' ? <IconCheckCircle size={18} /> : t.tone === 'err' ? <IconAlert size={18} /> : <IconInfo size={18} />}
            </span>
            <div style={{ minWidth: 0 }}>
              <h5>{t.title}</h5>
              {t.message ? <p>{t.message}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
