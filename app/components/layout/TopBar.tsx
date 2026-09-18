"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Tooltip";
import { Avatar } from "@/components/ui/Avatar";

interface TopBarProps {
  onMenuClick: () => void;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
}

export function TopBar({ onMenuClick, breadcrumbs, actions }: TopBarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 bg-navy-900/80 backdrop-blur-lg border-b border-navy-700">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-navy-800 rounded-lg"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="hidden md:flex items-center gap-2 text-sm" aria-label="Breadcrumb">
              {breadcrumbs.map((item, index) => (
                <span key={item.label} className="flex items-center gap-2">
                  {index > 0 && (
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={cn(
                        "transition-colors",
                        pathname === item.href ? "text-white font-medium" : "text-gray-400 hover:text-white"
                      )}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-white font-medium">{item.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {actions}
          <div className="hidden sm:block w-px h-6 bg-navy-600" />
          <Dropdown
            trigger={
              <Button variant="ghost" size="sm" className="gap-2">
                <Avatar name="Rahul Sharma" size="sm" />
                <span className="hidden sm:block text-sm font-medium text-white">Rahul Sharma</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </Button>
            }
            content={
              <div className="py-1">
                <Link
                  href="/dashboard/settings"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-navy-700 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </Link>
                <hr className="my-1 border-navy-600" />
                <button className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-400 hover:bg-navy-700 hover:text-red-300 text-left">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            }
            align="right"
          />
        </div>
      </div>
    </header>
  );
}