"use client";

import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  src?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const sizes = {
    xs: "w-6 h-6 text-xs",
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-12 h-12 text-lg",
    xl: "w-16 h-16 text-xl",
  };

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const colors = [
    "bg-cyan-500",
    "bg-green-500",
    "bg-amber-500",
    "bg-red-500",
    "bg-purple-500",
    "bg-blue-500",
    "bg-pink-500",
    "bg-indigo-500",
  ];

  const colorIndex = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("rounded-full object-cover", sizes[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-medium text-white select-none",
        colors[colorIndex],
        sizes[size],
        className
      )}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

interface AvatarGroupProps {
  avatars: { name: string; src?: string }[];
  max?: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function AvatarGroup({ avatars, max = 5, size = "md", className }: AvatarGroupProps) {
  const visibleAvatars = avatars.slice(0, max);
  const remaining = avatars.length - max;

  const sizes = {
    xs: "-mr-1",
    sm: "-mr-1.5",
    md: "-mr-2",
    lg: "-mr-2.5",
    xl: "-mr-3",
  };

  return (
    <div className={cn("flex", className)} aria-label={`${avatars.length} users`}>
      {visibleAvatars.map((avatar, index) => (
        <Avatar
          key={avatar.name}
          name={avatar.name}
          src={avatar.src}
          size={size}
          className={cn(index > 0 && sizes[size], "border-2 border-navy-900")}
        />
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            "rounded-full flex items-center justify-center font-medium text-xs text-gray-400 bg-navy-700 border-2 border-navy-900",
            sizes[size]
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}