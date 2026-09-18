"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

const toasts: Toast[] = [];
const listeners: Set<() => void> = new Set();

function notify() {
  listeners.forEach((listener) => listener());
}

export function useToast() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast = { ...toast, id };
    toasts.push(newToast);
    notify();

    if (toast.duration !== 0) {
      setTimeout(() => {
        const index = toasts.findIndex((t) => t.id === id);
        if (index !== -1) {
          toasts.splice(index, 1);
          notify();
        }
      }, toast.duration ?? 5000);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    const index = toasts.findIndex((t) => t.id === id);
    if (index !== -1) {
      toasts.splice(index, 1);
      notify();
    }
  }, []);

  return { toasts, addToast, removeToast };
}

const typeStyles = {
  success: "border-green-500/50 bg-green-500/10",
  error: "border-red-500/50 bg-red-500/10",
  warning: "border-amber-500/50 bg-amber-500/10",
  info: "border-cyan-500/50 bg-cyan-500/10",
};

const typeIcons = {
  success: (
    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-slide-in-right",
        typeStyles[toast.type]
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0 mt-0.5">{typeIcons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{toast.title}</p>
        {toast.message && (
          <p className="mt-1 text-sm text-gray-300">{toast.message}</p>
        )}
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onClick();
              onClose(toast.id);
            }}
            className="mt-2 text-sm font-medium text-cyan-400 hover:text-cyan-300 underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 p-1 text-gray-400 hover:text-white transition-colors"
        aria-label="Dismiss toast"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  const container = (
    <div
      className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 w-96 max-w-[calc(100vw-2rem)]"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );

  if (typeof window === "undefined") return null;

  return createPortal(container, document.body);
}