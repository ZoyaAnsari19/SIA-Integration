"use client";

import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "danger"
    | "warning";
  size?: "sm" | "md" | "lg";
  rounded?: "md" | "lg" | "xl" | "full";
};

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  rounded = "lg",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-color)] disabled:opacity-50 disabled:cursor-not-allowed";

  const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-[15px]",
  };

  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary: "bg-[var(--brand-blue)] text-white hover:opacity-90",
    secondary:
      "bg-[var(--sidebar-hover)] text-[var(--text-strong)] hover:bg-[var(--sidebar-hover)]/80 transition-colors duration-200",
    outline:
      "border border-[var(--border)] text-[var(--text-strong)] hover:bg-[var(--hover-bg)] transition-colors duration-200",
    ghost:
      "text-[var(--text-body)] hover:bg-[var(--hover-bg)] transition-colors duration-200",
    danger: "bg-red-600 text-white hover:bg-red-700",
    warning: "bg-amber-400 text-white hover:bg-amber-500",
  };

  const roundedMap: Record<NonNullable<ButtonProps["rounded"]>, string> = {
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    full: "rounded-full",
  };

  return (
    <button
      className={[
        base,
        sizes[size],
        variants[variant],
        roundedMap[rounded],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

export default Button;
