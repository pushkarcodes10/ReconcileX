"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  className?: string;
}

export function Tooltip({ content, children, position = "top", delay = 200, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const childRef = useRef<HTMLElement | null>(null);

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const positions = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrows = {
    top: "border-t-gray-800 bottom-[-4px] left-1/2 -translate-x-1/2",
    bottom: "border-b-gray-800 top-[-4px] left-1/2 -translate-x-1/2",
    left: "border-l-gray-800 right-[-4px] top-1/2 -translate-y-1/2",
    right: "border-r-gray-800 left-[-4px] top-1/2 -translate-y-1/2",
  };

  const tooltipContent = (
    <div
      className={cn(
        "fixed z-[100] px-3 py-2 text-xs font-medium text-white bg-gray-800 rounded-lg shadow-lg whitespace-nowrap animate-fade-in",
        positions[position],
        className
      )}
      role="tooltip"
    >
      {content}
      <div
        className={cn(
          "absolute w-0 h-0 border-2 border-transparent",
          arrows[position]
        )}
      />
    </div>
  );

  const trigger = (
    <span
      ref={childRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={0}
    >
      {children}
    </span>
  );

  if (typeof window === "undefined") return <>{trigger}</>;

  return (
    <>
      {trigger}
      {visible && createPortal(tooltipContent, document.body)}
    </>
  );
}

interface DropdownProps {
  trigger: ReactNode;
  content: ReactNode;
  align?: "left" | "right";
  offset?: number;
}

export function Dropdown({ trigger, content, align = "right", offset = 4 }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <div
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        tabIndex={0}
        role="button"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {trigger}
      </div>

      {open && createPortal(
        <div
          ref={contentRef}
          className={cn(
            "fixed z-[100] mt-2 min-w-[16rem] bg-navy-800 border border-navy-600 rounded-lg shadow-xl animate-scale-in overflow-hidden",
            align === "right" ? "right-0" : "left-0"
          )}
          role="menu"
        >
          {content}
        </div>,
        document.body
      )}
    </div>
  );
}

interface TabsProps {
  tabs: { id: string; label: string; disabled?: boolean }[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: "default" | "pills" | "underline";
}

export function Tabs({ tabs, activeTab, onChange, className, variant = "default" }: TabsProps) {
  const variants = {
    default: "border-b border-navy-600",
    pills: "gap-1 bg-navy-700 p-1 rounded-lg",
    underline: "border-b border-navy-600",
  };

  const tabVariants = {
    default: "pb-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors",
    pills: "px-4 py-2 rounded-md text-gray-400 hover:text-white transition-colors",
    underline: "pb-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors",
  };

  const activeVariants = {
    default: "border-cyan-500 text-white",
    pills: "bg-navy-600 text-white shadow-sm",
    underline: "border-cyan-500 text-white",
  };

  return (
    <div className={cn("flex", variants[variant], className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`${tab.id}-panel`}
          id={`${tab.id}-tab`}
          onClick={() => !tab.disabled && onChange(tab.id)}
          disabled={tab.disabled}
          className={cn(
            "px-4 text-sm font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            tabVariants[variant],
            activeTab === tab.id && activeVariants[variant]
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

interface TabPanelProps {
  id: string;
  activeTab: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ id, activeTab, children, className }: TabPanelProps) {
  if (activeTab !== id) return null;

  return (
    <div
      role="tabpanel"
      id={`${id}-panel`}
      aria-labelledby={`${id}-tab`}
      className={cn("animate-fade-in", className)}
    >
      {children}
    </div>
  );
}