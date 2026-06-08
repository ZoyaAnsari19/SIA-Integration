import React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  as?: React.ElementType;
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "tinted" | "dashed";
};

export function Card({
  as = "div",
  className = "",
  padding = "md",
  variant = "default",
  ...props
}: CardProps) {
  const Comp: React.ElementType = as || "div";
  const base =
    "rounded-xl border bg-[var(--card-bg)] border-[var(--border)] shadow-sm transition-colors duration-200";
  const paddingMap: Record<NonNullable<CardProps["padding"]>, string> = {
    none: "",
    sm: "p-4",
    md: "p-5",
    lg: "p-7",
  };
  const variantMap: Record<NonNullable<CardProps["variant"]>, string> = {
    default: "",
    tinted: "bg-[var(--sidebar-hover)]",
    dashed: "border-dashed",
  };

  return (
    <Comp
      className={[
        base,
        paddingMap[padding],
        variantMap[variant],
        className,
      ].join(" ")}
      {...props}
    />
  );
}

export function CardHeader({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        "mb-3 border-b border-[var(--border)] pb-3 transition-colors duration-200",
        className,
      ].join(" ")}
      {...props}
    />
  );
}

export function CardTitle({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={[
        "m-0 text-[18px] font-semibold text-[var(--text-strong)] transition-colors duration-200",
        className,
      ].join(" ")}
      {...props}
    />
  );
}

export function CardContent({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

export default Card;
