import React from "react";

type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> & {
  weight?: "bold" | "extrabold" | "semibold";
};

export function H1({
  className = "",
  weight = "extrabold",
  ...props
}: HeadingProps) {
  const weightCls =
    weight === "extrabold"
      ? "font-extrabold"
      : weight === "bold"
        ? "font-bold"
        : "font-semibold";
  return (
    <h1
      className={[
        "m-0 text-[28px] text-[var(--text-strong)] transition-colors duration-200",
        weightCls,
        className,
      ].join(" ")}
      {...props}
    />
  );
}

export function H2({
  className = "",
  weight = "bold",
  ...props
}: HeadingProps) {
  const weightCls =
    weight === "extrabold"
      ? "font-extrabold"
      : weight === "bold"
        ? "font-bold"
        : "font-semibold";
  return (
    <h2
      className={[
        "m-0 text-[22px] text-[var(--text-strong)] transition-colors duration-200",
        weightCls,
        className,
      ].join(" ")}
      {...props}
    />
  );
}

export function H3({
  className = "",
  weight = "semibold",
  ...props
}: HeadingProps) {
  const weightCls =
    weight === "extrabold"
      ? "font-extrabold"
      : weight === "bold"
        ? "font-bold"
        : "font-semibold";
  return (
    <h3
      className={[
        "m-0 text-[18px] text-[var(--text-strong)] transition-colors duration-200",
        weightCls,
        className,
      ].join(" ")}
      {...props}
    />
  );
}

type TextProps = React.HTMLAttributes<HTMLParagraphElement> & {
  muted?: boolean;
  size?: "sm" | "md" | "lg";
  lead?: boolean;
};

export function Text({
  className = "",
  muted = false,
  size = "md",
  lead = false,
  ...props
}: TextProps) {
  const sizeMap: Record<NonNullable<TextProps["size"]>, string> = {
    sm: "text-sm",
    md: "text-[15px]",
    lg: "text-[16px]",
  };
  return (
    <p
      className={[
        lead ? "leading-7" : "leading-6",
        sizeMap[size],
        muted ? "text-[var(--text-muted)]" : "text-[var(--text-body)]",
        "transition-colors duration-200",
        className,
      ].join(" ")}
      {...props}
    />
  );
}

export default { H1, H2, H3, Text };
