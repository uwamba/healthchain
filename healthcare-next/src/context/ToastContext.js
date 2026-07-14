"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback((toast) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, ...toast }]);
    return id;
  }, []);

  const update = useCallback((id, patch) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  // Confirmed/reverted toasts auto-dismiss; pending/submitted ones don't
  // (there's nothing worse than a spinner disappearing before the tx lands).
  const autoDismiss = useCallback(
    (id, delayMs = 4000) => {
      const timer = setTimeout(() => dismiss(id), delayMs);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toasts, push, update, dismiss, autoDismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
