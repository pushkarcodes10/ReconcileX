"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  name: string;
  href: string;
  icon: (props: { className?: string }) => React.ReactElement;
  badge?: string | number;
}

interface SidebarProps {
  navigation: NavItem[];
  pathname: string;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ navigation, pathname, open, onClose }: SidebarProps) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-navy-800 border-r border-navy-700 flex flex-col transition-transform duration-300 ease-out",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-navy-700">
          <Link href="/dashboard" className="flex items-center gap-2" aria-label="ReconcileX Home">
            <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-navy-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-semibold text-lg text-white">ReconcileX</span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-navy-700 rounded-lg"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" role="navigation" aria-label="Main">
          <ul className="space-y-1" role="list">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-800",
                      isActive
                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                        : "text-gray-300 hover:bg-navy-700 hover:text-white"
                    )}
                    aria-current={isActive ? "page" : undefined}
                    onClick={onClose}
                  >
                    <span className={cn("flex-shrink-0", isActive ? "text-cyan-400" : "text-gray-400")}>
                      {item.icon({ className: "w-5 h-5" })}
                    </span>
                    <span className="truncate flex-1">{item.name}</span>
                    {item.badge && (
                      <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-navy-600 text-gray-300 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-navy-700">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Acme Corporation</p>
              <p className="text-xs text-gray-500 truncate">Finance Manager</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}