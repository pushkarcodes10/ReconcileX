"use client";

import { Fragment, ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  position?: "right" | "left";
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "lg",
  position = "right",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: DrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";
      contentRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && closeOnEscape) {
          onClose();
        }
        if (e.key === "Tab") {
          const focusableElements = contentRef.current?.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusableElements && focusableElements.length > 0) {
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            if (e.shiftKey && document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen, closeOnEscape]);

  if (!isOpen) return null;

  const sizes = {
    sm: "w-72",
    md: "w-96",
    lg: "w-[42rem]",
    xl: "w-[56rem]",
    full: "w-full max-w-4xl",
  };

  const drawerContent = (
    <Fragment>
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        className={cn(
          "fixed inset-y-0 z-50 flex animate-slide-in-right",
          position === "right" ? "justify-end" : "justify-start",
          "p-0"
        )}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "drawer-title" : undefined}
        aria-describedby={description ? "drawer-description" : undefined}
      >
        <div
          className={cn(
            "flex flex-col bg-navy-800 border-l border-navy-600 shadow-xl",
            position === "left" && "border-r border-l-0",
            sizes[size],
            "h-full max-h-full overflow-hidden"
          )}
        >
          {(title || showCloseButton) && (
            <div className="flex items-start justify-between p-6 border-b border-navy-600 flex-shrink-0">
              <div className={cn("pr-4", position === "left" && "pl-4")}>
                {title && (
                  <h2 id="drawer-title" className="text-lg font-semibold text-white">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id="drawer-description" className="mt-1 text-sm text-gray-400">
                    {description}
                  </p>
                )}
              </div>
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className={cn(
                    "p-1.5 text-gray-400 hover:text-white hover:bg-navy-700 rounded-lg transition-colors flex-shrink-0",
                    position === "left" && "mr-4",
                    position === "right" && "ml-4"
                  )}
                  aria-label="Close drawer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      </div>
    </Fragment>
  );

  if (typeof window === "undefined") return null;

  return createPortal(drawerContent, document.body);
}